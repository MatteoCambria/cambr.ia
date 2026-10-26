/**
 * Effets : réverbération Freeverb (Schroeder/Moorer), réverbération « salle » à réseau de lignes à
 * retard rebouclées (FDN 8 lignes, matrice de Hadamard, modulation), délai stéréo ping-pong,
 * chorus stéréo, compresseur à genou doux, limiteur à anticipation, saturation douce.
 * Tous les effets à mémoire peuvent être appliqués « circulairement » sur une boucle (voir circular()).
 */
import { SR, TAU, makeStereo, type Stereo, dbToGain } from './core';
import { Biquad, OnePole } from './filters';

// ---------------------------------------------------------------------------------------------
// Freeverb (Jezar) : 8 filtres en peigne amortis + 4 passe-tout par canal.
// ---------------------------------------------------------------------------------------------

class Comb {
  private buf: Float32Array;
  private idx = 0;
  private store = 0;
  constructor(size: number, private feedback: number, private damp: number) {
    this.buf = new Float32Array(size);
  }
  process(x: number): number {
    const y = this.buf[this.idx];
    this.store = y * (1 - this.damp) + this.store * this.damp + 1e-18;
    this.buf[this.idx] = x + this.store * this.feedback;
    if (++this.idx >= this.buf.length) this.idx = 0;
    return y;
  }
}

class Allpass {
  private buf: Float32Array;
  private idx = 0;
  constructor(size: number, private g = 0.5) {
    this.buf = new Float32Array(size);
  }
  process(x: number): number {
    const b = this.buf[this.idx] + 1e-18;
    const y = -x + b;
    this.buf[this.idx] = x + b * this.g;
    if (++this.idx >= this.buf.length) this.idx = 0;
    return y;
  }
}

/** Vrai passe-tout de Schroeder (|H| = 1) : w = x + g·w[-M] ; y = -g·w + w[-M]. */
class SchroederAllpass {
  private buf: Float32Array;
  private idx = 0;
  constructor(size: number, private g = 0.6) {
    this.buf = new Float32Array(Math.max(1, size));
  }
  process(x: number): number {
    const d = this.buf[this.idx];
    const w = x + this.g * d + 1e-18;
    this.buf[this.idx] = w;
    if (++this.idx >= this.buf.length) this.idx = 0;
    return d - this.g * w;
  }
}

export interface FreeverbOptions {
  room?: number; // 0..1
  damp?: number; // 0..1
  width?: number; // 0..1
}

/** Réverbération Freeverb ; renvoie le signal humide seul (même longueur). */
export function freeverb(input: Stereo, o: FreeverbOptions = {}): Stereo {
  const k = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apT = [556, 441, 341, 225];
  const spread = 23;
  const room = 0.7 + 0.28 * (o.room ?? 0.5);
  const damp = 0.4 * (o.damp ?? 0.5);
  const combsL = combT.map((t) => new Comb(Math.round(t * k), room, damp));
  const combsR = combT.map((t) => new Comb(Math.round((t + spread) * k), room, damp));
  const apL = apT.map((t) => new Allpass(Math.round(t * k)));
  const apR = apT.map((t) => new Allpass(Math.round((t + spread) * k)));
  const width = o.width ?? 1;
  const w1 = width / 2 + 0.5;
  const w2 = (1 - width) / 2;
  const n = input.l.length;
  const out = makeStereo(n);
  for (let i = 0; i < n; i++) {
    const x = (input.l[i] + input.r[i]) * 0.015;
    let l = 0;
    let r = 0;
    for (let c = 0; c < 8; c++) {
      l += combsL[c].process(x);
      r += combsR[c].process(x);
    }
    for (let c = 0; c < 4; c++) {
      l = apL[c].process(l);
      r = apR[c].process(r);
    }
    out.l[i] = l * w1 + r * w2;
    out.r[i] = r * w1 + l * w2;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// FDN 8 lignes : réverbération de salle douce et dense pour la musique.
// ---------------------------------------------------------------------------------------------

export interface HallOptions {
  /** Temps de réverbération (s) aux fréquences moyennes. */
  rt60: number;
  /** Fréquence de coupure de l'amortissement des aigus (Hz). */
  damping?: number;
  /** Pré-délai (s). */
  preDelay?: number;
  /** Taille relative de la salle (0.5..2). */
  size?: number;
  /** Coupe-bas sur l'entrée (Hz). */
  lowCut?: number;
  /** Coupe-haut sur l'entrée (Hz). */
  highCut?: number;
  /** Profondeur de modulation (échantillons). */
  mod?: number;
}

/** Réverbération FDN ; renvoie le signal humide seul. */
export function hallReverb(input: Stereo, o: HallOptions): Stereo {
  const n = input.l.length;
  const out = makeStereo(n);
  const size = o.size ?? 1;
  const base = [1031, 1327, 1523, 1801, 2063, 2399, 2659, 2971];
  const lens = base.map((b) => Math.round(b * size * (SR / 44100)));
  const N = 8;
  const maxMod = Math.ceil(o.mod ?? 6) + 2;
  const lines = lens.map((L) => new Float32Array(L + maxMod + 2));
  const widx = new Array<number>(N).fill(0);
  const gains = lens.map((L) => Math.pow(10, (-3 * L) / (SR * o.rt60)));
  const damps = lens.map(() => new OnePole(o.damping ?? 7500));
  const modDepth = o.mod ?? 6;
  const modRates = [0.31, 0.47, 0.23, 0.39, 0.53, 0.29, 0.43, 0.37];
  // Diffusion d'entrée : passe-tout courts en série par canal.
  const diffL = [142, 107, 379, 277].map((t) => new SchroederAllpass(Math.round(t * size), 0.6));
  const diffR = [151, 113, 397, 263].map((t) => new SchroederAllpass(Math.round(t * size), 0.6));
  const pre = Math.max(1, Math.round((o.preDelay ?? 0.02) * SR));
  const preL = new Float32Array(pre);
  const preR = new Float32Array(pre);
  let pIdx = 0;
  const lcL = new Biquad('highpass', o.lowCut ?? 160, 0.6);
  const lcR = new Biquad('highpass', o.lowCut ?? 160, 0.6);
  const hcL = new Biquad('lowpass', o.highCut ?? 11000, 0.6);
  const hcR = new Biquad('lowpass', o.highCut ?? 11000, 0.6);
  const v = new Float64Array(N);
  const sgnL = [1, -1, 1, -1, 1, -1, 1, -1];
  const sgnR = [1, 1, -1, -1, 1, 1, -1, -1];
  const outL = [1, 1, 1, 1, -1, -1, -1, -1];
  const outR = [1, -1, -1, 1, 1, -1, -1, 1];
  const norm = 1 / Math.sqrt(N);
  // Gain de sortie : puissance unitaire en régime établi (bruit blanc), quel que soit rt60.
  const lineEnergy = gains.reduce((acc, g) => acc + 0.5 / (1 - g * g), 0);
  const outGain = 1 / Math.sqrt(lineEnergy);
  const invSR = 1 / SR;
  const tau = TAU;
  for (let i = 0; i < n; i++) {
    // Entrée filtrée + pré-délai.
    let xl = hcL.process(lcL.process(input.l[i]));
    let xr = hcR.process(lcR.process(input.r[i]));
    const dl = preL[pIdx];
    const dr = preR[pIdx];
    preL[pIdx] = xl;
    preR[pIdx] = xr;
    if (++pIdx >= pre) pIdx = 0;
    xl = dl;
    xr = dr;
    for (let d = 0; d < 4; d++) {
      xl = diffL[d].process(xl);
      xr = diffR[d].process(xr);
    }
    // Lecture des lignes (modulées par interpolation linéaire).
    const t = i * invSR;
    for (let k = 0; k < N; k++) {
      const line = lines[k];
      const L = lens[k];
      const m = k < 4 ? modDepth * (0.5 + 0.5 * Math.sin(tau * modRates[k] * t + k)) : 0;
      let rp = widx[k] - L - m;
      while (rp < 0) rp += line.length;
      const i0 = Math.floor(rp);
      const fr = rp - i0;
      const a = line[i0 % line.length];
      const b = line[(i0 + 1) % line.length];
      v[k] = damps[k].lp((a + (b - a) * fr) * gains[k]);
    }
    // Sorties stéréo décorrélées.
    let ol = 0;
    let or = 0;
    for (let k = 0; k < N; k++) {
      ol += v[k] * outL[k];
      or += v[k] * outR[k];
    }
    out.l[i] = ol * outGain;
    out.r[i] = or * outGain;
    // Matrice de Hadamard rapide (8x8).
    for (let h = 1; h < N; h <<= 1) {
      for (let j = 0; j < N; j += h << 1) {
        for (let q = j; q < j + h; q++) {
          const x0 = v[q];
          const x1 = v[q + h];
          v[q] = x0 + x1;
          v[q + h] = x0 - x1;
        }
      }
    }
    for (let k = 0; k < N; k++) {
      const line = lines[k];
      line[widx[k]] = v[k] * norm + xl * sgnL[k] * 0.5 + xr * sgnR[k] * 0.5 + 1e-18;
      if (++widx[k] >= line.length) widx[k] = 0;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Délai stéréo ping-pong (signal humide seul).
// ---------------------------------------------------------------------------------------------

export interface DelayOptions {
  timeL: number; // s
  timeR: number; // s
  feedback: number; // 0..0.9
  lowpass?: number; // Hz dans la boucle
  highpass?: number;
  pingPong?: boolean;
}

export function stereoDelay(input: Stereo, o: DelayOptions): Stereo {
  const n = input.l.length;
  const out = makeStereo(n);
  const dL = Math.max(1, Math.round(o.timeL * SR));
  const dR = Math.max(1, Math.round(o.timeR * SR));
  const bl = new Float32Array(dL);
  const br = new Float32Array(dR);
  let il = 0;
  let ir = 0;
  const lpL = new OnePole(o.lowpass ?? 5000);
  const lpR = new OnePole(o.lowpass ?? 5000);
  const hpL = new OnePole(o.highpass ?? 200);
  const hpR = new OnePole(o.highpass ?? 200);
  const fb = o.feedback;
  const pp = o.pingPong ?? true;
  for (let i = 0; i < n; i++) {
    const yl = bl[il];
    const yr = br[ir];
    out.l[i] = yl;
    out.r[i] = yr;
    const fl = hpL.hp(lpL.lp(pp ? yr : yl)) * fb;
    const fr = hpR.hp(lpR.lp(pp ? yl : yr)) * fb;
    const mono = (input.l[i] + input.r[i]) * 0.5;
    bl[il] = (pp ? mono : input.l[i]) + fl;
    br[ir] = (pp ? 0 : input.r[i]) + fr;
    if (++il >= dL) il = 0;
    if (++ir >= dR) ir = 0;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Chorus stéréo (insert : renvoie sec + humide).
// ---------------------------------------------------------------------------------------------

export interface ChorusOptions {
  delayMs?: number;
  depthMs?: number;
  rate?: number; // Hz
  mix?: number; // 0..1
  voices?: number;
}

export function chorus(input: Stereo, o: ChorusOptions = {}): Stereo {
  const n = input.l.length;
  const base = ((o.delayMs ?? 14) / 1000) * SR;
  const depth = ((o.depthMs ?? 3) / 1000) * SR;
  const rate = o.rate ?? 0.35;
  const mix = o.mix ?? 0.4;
  const voices = o.voices ?? 2;
  const size = Math.ceil(base + depth + 4);
  const bl = new Float32Array(size);
  const br = new Float32Array(size);
  const out = makeStereo(n);
  let w = 0;
  const read = (buf: Float32Array, d: number): number => {
    let rp = w - d;
    while (rp < 0) rp += size;
    const i0 = Math.floor(rp);
    const fr = rp - i0;
    const a = buf[i0 % size];
    const b = buf[(i0 + 1) % size];
    return a + (b - a) * fr;
  };
  const invSR = 1 / SR;
  const tau = TAU;
  for (let i = 0; i < n; i++) {
    bl[w] = input.l[i];
    br[w] = input.r[i];
    const t = i * invSR;
    let wl = 0;
    let wr = 0;
    for (let v = 0; v < voices; v++) {
      const ph = (v / voices) * tau;
      const r = rate * (1 + v * 0.17);
      wl += read(bl, base + depth * (0.5 + 0.5 * Math.sin(tau * r * t + ph)));
      wr += read(br, base + depth * (0.5 + 0.5 * Math.sin(tau * r * t + ph + Math.PI / 2)));
    }
    wl /= voices;
    wr /= voices;
    out.l[i] = input.l[i] * (1 - mix * 0.5) + wl * mix;
    out.r[i] = input.r[i] * (1 - mix * 0.5) + wr * mix;
    if (++w >= size) w = 0;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Dynamique : compresseur (courbe de gain), limiteur à anticipation (courbe de gain).
// ---------------------------------------------------------------------------------------------

export interface CompressorOptions {
  thresholdDb: number;
  ratio: number;
  kneeDb?: number;
  attackMs?: number;
  releaseMs?: number;
  /** Détecteur RMS (fenêtre en ms) ; 0 = crête. */
  rmsMs?: number;
}

/**
 * Calcule la courbe de gain linéaire d'un compresseur stéréo lié (détection sur max(|L|,|R|)).
 * Si `circular`, l'état du détecteur est amorcé par un premier passage sur la boucle.
 */
export function compressorGain(s: Stereo, o: CompressorOptions, circular = false): Float32Array {
  const n = s.l.length;
  const g = new Float32Array(n);
  const T = o.thresholdDb;
  const R = o.ratio;
  const W = o.kneeDb ?? 6;
  const aA = Math.exp(-1 / (((o.attackMs ?? 10) / 1000) * SR));
  const aR = Math.exp(-1 / (((o.releaseMs ?? 150) / 1000) * SR));
  const rmsA = o.rmsMs ? Math.exp(-1 / ((o.rmsMs / 1000) * SR)) : 0;
  let env = 0; // réduction de gain lissée (dB, ≤ 0)
  let ms = 0;
  const passes = circular ? 2 : 1;
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) {
      const x = Math.max(Math.abs(s.l[i]), Math.abs(s.r[i]));
      let lvl: number;
      if (rmsA > 0) {
        ms = rmsA * ms + (1 - rmsA) * x * x;
        lvl = 10 * Math.log10(ms + 1e-20);
      } else {
        lvl = 20 * Math.log10(x + 1e-20);
      }
      const over = lvl - T;
      let y: number;
      if (2 * over < -W) y = lvl;
      else if (2 * Math.abs(over) <= W) y = lvl + ((1 / R - 1) * (over + W / 2) * (over + W / 2)) / (2 * W);
      else y = T + over / R;
      const gr = y - lvl;
      env = gr < env ? aA * env + (1 - aA) * gr : aR * env + (1 - aR) * gr;
      if (p === passes - 1) g[i] = Math.pow(10, env / 20);
    }
  }
  return g;
}

/**
 * Courbe de gain d'un limiteur à anticipation hors-ligne : garantit |x·g| ≤ plafond.
 * Minimum glissant sur la fenêtre d'anticipation, lissage par moyenne glissante (attaque) puis
 * relâchement exponentiel. `circular` traite le signal comme une boucle.
 */
export function limiterGain(s: Stereo, ceilingDb: number, lookaheadMs = 5, releaseMs = 120, circular = false): Float32Array {
  const n = s.l.length;
  const c = dbToGain(ceilingDb);
  const la = Math.max(1, Math.round((lookaheadMs / 1000) * SR));
  const req = new Float32Array(n);
  let any = false;
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(s.l[i]), Math.abs(s.r[i]));
    req[i] = x > c ? c / x : 1;
    if (x > c) any = true;
  }
  const g = new Float32Array(n).fill(1);
  if (!any || n === 0) return g;
  // Tableau étendu de `la` échantillons de part et d'autre (1 hors signal, ou valeurs repliées en
  // mode boucle) : index étendu e = i + la.
  const E = n + 2 * la;
  const ext = new Float32Array(E);
  for (let e = 0; e < E; e++) {
    const i = e - la;
    ext[e] = circular ? req[((i % n) + n) % n] : i >= 0 && i < n ? req[i] : 1;
  }
  // h[e] = min(ext[e .. e+la]) (minimum glissant vers l'avant, file monotone).
  const h = new Float32Array(E).fill(1);
  const dq = new Int32Array(E);
  let head = 0;
  let tail = 0;
  for (let j = 0; j < E; j++) {
    const v = ext[j];
    while (tail > head && ext[dq[tail - 1]] >= v) tail--;
    dq[tail++] = j;
    const e = j - la;
    if (e >= 0) {
      while (dq[head] < e) head++;
      h[e] = ext[dq[head]];
    }
  }
  for (let e = Math.max(0, E - la); e < E; e++) {
    let m = 1;
    for (let k = e; k < E; k++) m = Math.min(m, ext[k]);
    h[e] = m;
  }
  // Moyenne glissante de h sur [e-la, e] : à une crête p, toutes les valeurs de la fenêtre sont
  // ≤ req[p], donc la moyenne aussi (garantie du plafond).
  const sm = new Float32Array(n);
  let acc = 0;
  for (let e = 0; e <= la; e++) acc += h[e];
  for (let i = 0; i < n; i++) {
    const e = i + la;
    sm[i] = acc / (la + 1);
    acc -= h[e - la];
    if (e + 1 < E) acc += h[e + 1];
  }
  // Relâchement exponentiel (jamais au-dessus de sm).
  const rel = 1 - Math.exp(-1 / ((releaseMs / 1000) * SR));
  let r = 1;
  const passes = circular ? 2 : 1;
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) {
      r = r + (1 - r) * rel;
      if (sm[i] < r) r = sm[i];
      g[i] = r;
    }
  }
  return g;
}

/** Saturation douce (tanh normalisée) avec dosage. */
export function saturate(buf: Float32Array, drive: number, mix = 1): Float32Array {
  const k = Math.max(0.01, drive);
  const norm = 1 / Math.tanh(k);
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    buf[i] = x * (1 - mix) + Math.tanh(x * k) * norm * mix;
  }
  return buf;
}

/**
 * Applique un traitement à mémoire de façon circulaire : on traite [x, x] et on garde la seconde
 * moitié, de sorte que l'état en fin de boucle se raccorde au début (boucle sans couture).
 */
export function circular(s: Stereo, fn: (x: Stereo) => Stereo): Stereo {
  const n = s.l.length;
  const two = makeStereo(n * 2);
  two.l.set(s.l, 0);
  two.l.set(s.l, n);
  two.r.set(s.r, 0);
  two.r.set(s.r, n);
  const y = fn(two);
  return { l: y.l.slice(n, 2 * n), r: y.r.slice(n, 2 * n) };
}

/** Égaliseur : chaîne de biquads appliquée aux deux canaux. */
export interface EqBand {
  type: 'lowpass' | 'highpass' | 'bandpass' | 'peak' | 'lowshelf' | 'highshelf' | 'notch';
  f: number;
  q?: number;
  g?: number;
}

export function eqStereo(s: Stereo, bands: readonly EqBand[]): Stereo {
  for (const b of bands) {
    new Biquad(b.type, b.f, b.q ?? Math.SQRT1_2, b.g ?? 0).run(s.l);
    new Biquad(b.type, b.f, b.q ?? Math.SQRT1_2, b.g ?? 0).run(s.r);
  }
  return s;
}

/** Élargissement stéréo mid/side (w > 1 élargit). */
export function widen(s: Stereo, w: number): Stereo {
  for (let i = 0; i < s.l.length; i++) {
    const m = (s.l[i] + s.r[i]) * 0.5;
    const d = (s.l[i] - s.r[i]) * 0.5 * w;
    s.l[i] = m + d;
    s.r[i] = m - d;
  }
  return s;
}
