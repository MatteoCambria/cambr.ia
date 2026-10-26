/**
 * Oscillateurs à bande limitée (polyBLEP) : dent de scie, carré/impulsion, triangle (carré intégré),
 * sinus. Fréquence constante ou suivie échantillon par échantillon (vibrato, glissando, FM lente).
 */
import { SR, TAU } from './core';

export type Wave = 'sine' | 'saw' | 'square' | 'tri' | 'pulse';

/** Résidu polyBLEP (correction de discontinuité de valeur). */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

export interface OscOptions {
  /** Phase initiale dans [0, 1). */
  phase?: number;
  /** Rapport cyclique pour 'pulse' (0..1). */
  pw?: number;
}

/**
 * Génère n échantillons d'oscillateur. `freq` est soit une constante (Hz), soit une courbe par
 * échantillon (Hz). Amplitude crête ≈ 1.
 */
export function osc(wave: Wave, freq: number | Float32Array, n: number, opts: OscOptions = {}): Float32Array {
  const out = new Float32Array(n);
  let t = opts.phase ?? 0;
  const pw = wave === 'square' ? 0.5 : opts.pw ?? 0.5;
  const constF = typeof freq === 'number';
  const invSR = 1 / SR;
  const tau = TAU;
  let tri = -1;
  // Pour le triangle intégré, la phase initiale décale la valeur de départ.
  if (wave === 'tri') tri = t < 0.5 ? -1 + 4 * t : 3 - 4 * t;
  for (let i = 0; i < n; i++) {
    const f = constF ? (freq as number) : (freq as Float32Array)[i];
    let dt = f * invSR;
    if (dt > 0.49) dt = 0.49;
    if (dt < 0) dt = 0;
    let v: number;
    switch (wave) {
      case 'sine':
        v = Math.sin(tau * t);
        break;
      case 'saw':
        v = 2 * t - 1 - polyBlep(t, dt);
        break;
      case 'square':
      case 'pulse': {
        v = t < pw ? 1 : -1;
        v += polyBlep(t, dt);
        let t2 = t - pw;
        if (t2 < 0) t2 += 1;
        v -= polyBlep(t2, dt);
        break;
      }
      case 'tri': {
        let sq = t < 0.5 ? 1 : -1;
        sq += polyBlep(t, dt);
        let t2 = t - 0.5;
        if (t2 < 0) t2 += 1;
        sq -= polyBlep(t2, dt);
        // Intégrateur légèrement fuyant pour rester centré.
        tri = tri * 0.9995 + 4 * dt * sq + 1e-18;
        v = tri;
        break;
      }
    }
    out[i] = v;
    t += dt;
    if (t >= 1) t -= 1;
  }
  return out;
}

/** Courbe de fréquence : base × vibrato (sinus, retard progressif) × glissando initial. */
export function freqCurve(
  n: number,
  base: number,
  opts: {
    vibRate?: number;
    vibDepth?: number; // fraction (0.005 = ±0,5 %)
    vibDelay?: number; // s avant que le vibrato ne s'installe
    vibPhase?: number;
    glideFrom?: number; // rapport initial (0.97 = part 3 % en dessous)
    glideTime?: number; // s
    driftDepth?: number; // dérive lente aléatoire (fraction)
    driftRate?: number;
    drift?: number; // phase de dérive
    end?: number; // rapport final (pente linéaire en log sur toute la note)
  } = {},
): Float32Array {
  const out = new Float32Array(n);
  const vr = opts.vibRate ?? 0;
  const vd = opts.vibDepth ?? 0;
  const vdel = Math.max(1, (opts.vibDelay ?? 0) * SR);
  const vp = opts.vibPhase ?? 0;
  const g0 = opts.glideFrom ?? 1;
  const gt = Math.max(1, (opts.glideTime ?? 0.05) * SR);
  const dd = opts.driftDepth ?? 0;
  const dr = opts.driftRate ?? 0.3;
  const dp = opts.drift ?? 0;
  const endR = opts.end ?? 1;
  const logEnd = Math.log(endR);
  // Valeur au taux de contrôle (tous les K échantillons), interpolée linéairement.
  const K = 16;
  const at = (i: number): number => {
    let f = base;
    if (vd > 0) {
      const ramp = Math.min(1, i / vdel);
      f *= 1 + vd * ramp * ramp * Math.sin(TAU * ((vr * i) / SR + vp));
    }
    if (g0 !== 1 && i < gt) {
      const x = i / gt;
      const k = 1 - (1 - x) * (1 - x);
      f *= g0 + (1 - g0) * k;
    }
    if (dd > 0) {
      const tt = i / SR;
      f *= 1 + dd * (Math.sin(TAU * dr * tt + dp) * 0.6 + Math.sin(TAU * dr * 2.37 * tt + dp * 1.7) * 0.4);
    }
    if (endR !== 1) f *= Math.exp((logEnd * i) / n);
    return f;
  };
  let prev = at(0);
  for (let c = 0; c < n; c += K) {
    const next = at(Math.min(n, c + K));
    const m = Math.min(K, n - c);
    const step = (next - prev) / K;
    for (let j = 0; j < m; j++) out[c + j] = prev + step * j;
    prev = next;
  }
  return out;
}

/** Sinus pur à fréquence constante, phase initiale en cycles. */
export function sine(freq: number, n: number, phase = 0): Float32Array {
  const out = new Float32Array(n);
  const w = (TAU * freq) / SR;
  // Récurrence de rotation (rapide et précise sur quelques secondes).
  let c = Math.cos(TAU * phase);
  let s = Math.sin(TAU * phase);
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  for (let i = 0; i < n; i++) {
    out[i] = s;
    const nc = c * cw - s * sw;
    s = s * cw + c * sw;
    c = nc;
    if ((i & 1023) === 1023) {
      // Renormalisation périodique pour éviter la dérive d'amplitude.
      const m = 1 / Math.sqrt(c * c + s * s);
      c *= m;
      s *= m;
    }
  }
  return out;
}

/** Ajoute un partiel sinusoïdal amorti exponentiellement dans `out` (synthèse additive rapide). */
export function addPartial(
  out: Float32Array,
  freq: number,
  amp: number,
  t60: number,
  opts: { phase?: number; attack?: number; start?: number; beatHz?: number } = {},
): void {
  if (freq >= SR * 0.48 || amp === 0) return;
  const start = opts.start ?? 0;
  const n = out.length;
  const w = (TAU * freq) / SR;
  const dec = Math.exp(-6.907755 / Math.max(1, t60 * SR));
  const att = Math.max(1, (opts.attack ?? 0.001) * SR);
  let c = Math.cos(TAU * (opts.phase ?? 0));
  let s = Math.sin(TAU * (opts.phase ?? 0));
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  let a = amp;
  const beat = opts.beatHz ?? 0;
  const bw = (TAU * beat) / SR;
  for (let i = start; i < n; i++) {
    const k = i - start;
    let env = a;
    if (k < att) env *= k / att;
    if (beat > 0) env *= 0.75 + 0.25 * Math.cos(bw * k);
    out[i] = out[i] + s * env;
    const nc = c * cw - s * sw;
    s = s * cw + c * sw;
    c = nc;
    a *= dec;
    if ((k & 1023) === 1023) {
      const m = 1 / Math.sqrt(c * c + s * s);
      c *= m;
      s *= m;
      if (a < 1e-6 * amp) break;
    }
  }
}
