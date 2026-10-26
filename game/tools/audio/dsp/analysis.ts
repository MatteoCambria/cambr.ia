/**
 * Mesures : crête, RMS, sonie intégrée ITU-R BS.1770-4 (pondération K, double porte), sonie
 * momentanée maximale, crête vraie estimée par suréchantillonnage ×4, discontinuité de bouclage.
 */
import { SR, type Stereo } from './core';

export function peak(s: Stereo | Float32Array): number {
  let m = 0;
  const chans = s instanceof Float32Array ? [s] : [s.l, s.r];
  for (const c of chans) for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i]));
  return m;
}

export function rms(s: Stereo | Float32Array): number {
  const chans = s instanceof Float32Array ? [s] : [s.l, s.r];
  let acc = 0;
  let n = 0;
  for (const c of chans) {
    for (let i = 0; i < c.length; i++) acc += c[i] * c[i];
    n += c.length;
  }
  return n ? Math.sqrt(acc / n) : 0;
}

/** Coefficients de pondération K pour une fréquence d'échantillonnage arbitraire. */
function kFilters(): Array<[number, number, number, number, number]> {
  const design = (type: 'shelf' | 'hp', G: number, Q: number, fc: number): [number, number, number, number, number] => {
    const A = Math.pow(10, G / 40);
    const w0 = (2 * Math.PI * fc) / SR;
    const cw = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Q);
    let b0: number;
    let b1: number;
    let b2: number;
    let a0: number;
    let a1: number;
    let a2: number;
    if (type === 'shelf') {
      b0 = A * (A + 1 + (A - 1) * cw + 2 * Math.sqrt(A) * alpha);
      b1 = -2 * A * (A - 1 + (A + 1) * cw);
      b2 = A * (A + 1 + (A - 1) * cw - 2 * Math.sqrt(A) * alpha);
      a0 = A + 1 - (A - 1) * cw + 2 * Math.sqrt(A) * alpha;
      a1 = 2 * (A - 1 - (A + 1) * cw);
      a2 = A + 1 - (A - 1) * cw - 2 * Math.sqrt(A) * alpha;
    } else {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = (1 + cw) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cw;
      a2 = 1 - alpha;
    }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  };
  return [design('shelf', 3.99984385397, 0.7071752369554193, 1681.9744509555319), design('hp', 0, 0.5003270373253953, 38.13547087613982)];
}

function kWeight(x: Float32Array): Float32Array {
  const out = new Float32Array(x);
  for (const [b0, b1, b2, a1, a2] of kFilters()) {
    let z1 = 0;
    let z2 = 0;
    for (let i = 0; i < out.length; i++) {
      const v = out[i];
      const y = b0 * v + z1;
      z1 = b1 * v - a1 * y + z2;
      z2 = b2 * v - a2 * y;
      out[i] = y;
    }
  }
  return out;
}

/** Puissances moyennes des blocs de 400 ms (recouvrement 75 %). */
function blockPowers(s: Stereo | Float32Array, blockS = 0.4, hop = 0.1): number[] {
  const chans = s instanceof Float32Array ? [s] : [s.l, s.r];
  const kw = chans.map(kWeight);
  const n = kw[0].length;
  const bl = Math.round(blockS * SR);
  const hp = Math.round(hop * SR);
  const out: number[] = [];
  if (n < bl) {
    // Signal plus court qu'un bloc : un seul bloc (complété par du silence).
    let acc = 0;
    for (const c of kw) for (let i = 0; i < n; i++) acc += c[i] * c[i];
    out.push(acc / bl);
    return out;
  }
  // Sommes cumulées pour un calcul rapide.
  const cum = new Float64Array(n + 1);
  for (const c of kw) {
    let a = 0;
    for (let i = 0; i < n; i++) {
      a += c[i] * c[i];
      cum[i + 1] += a;
    }
  }
  for (let st = 0; st + bl <= n; st += hp) out.push((cum[st + bl] - cum[st]) / bl);
  return out;
}

const toLufs = (p: number): number => -0.691 + 10 * Math.log10(Math.max(p, 1e-20));

/** Sonie intégrée (LUFS) selon BS.1770-4. */
export function lufs(s: Stereo | Float32Array): number {
  const blocks = blockPowers(s);
  const abs = blocks.filter((p) => toLufs(p) > -70);
  if (abs.length === 0) return -70;
  const meanAbs = abs.reduce((a, b) => a + b, 0) / abs.length;
  const rel = toLufs(meanAbs) - 10;
  const gated = abs.filter((p) => toLufs(p) > rel);
  const mean = gated.reduce((a, b) => a + b, 0) / Math.max(1, gated.length);
  return toLufs(mean);
}

/** Sonie maximale sur une fenêtre glissante (momentanée : 400 ms ; plus court pour les SFX). */
export function maxLoudness(s: Stereo | Float32Array, windowS = 0.4): number {
  const blocks = blockPowers(s, windowS, Math.min(0.05, windowS / 4));
  return toLufs(Math.max(...blocks));
}

/** Crête vraie estimée (interpolation sinc fenêtrée ×4). */
export function truePeak(s: Stereo | Float32Array): number {
  const chans = s instanceof Float32Array ? [s] : [s.l, s.r];
  const taps = 16;
  const os = 4;
  const kernels: Float64Array[] = [];
  for (let p = 1; p < os; p++) {
    const k = new Float64Array(taps * 2);
    const frac = p / os;
    for (let j = -taps + 1; j <= taps; j++) {
      const x = j - frac;
      const sinc = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / taps);
      k[j + taps - 1] = sinc * w;
    }
    kernels.push(k);
  }
  let m = 0;
  for (const c of chans) {
    for (let i = 0; i < c.length; i++) {
      const v = Math.abs(c[i]);
      if (v > m) m = v;
    }
    // On n'interpole qu'autour des échantillons déjà proches de la crête (rapide).
    const thr = m * 0.7;
    for (let i = 0; i < c.length; i++) {
      if (Math.abs(c[i]) < thr) continue;
      for (const k of kernels) {
        let acc = 0;
        for (let j = -taps + 1; j <= taps; j++) {
          const idx = i + j;
          if (idx >= 0 && idx < c.length) acc += c[idx] * k[j + taps - 1];
        }
        if (Math.abs(acc) > m) m = Math.abs(acc);
      }
    }
  }
  return m;
}

/**
 * Indicateur de couture d'une boucle : rapport entre le saut au point de bouclage (fin → début) et
 * le 99,9e centile des différences entre échantillons consécutifs. ≤ 1 : aucune discontinuité
 * anormale.
 */
export function loopSeamRatio(s: Stereo): number {
  const n = s.l.length;
  const diffs: number[] = [];
  const step = Math.max(1, Math.floor(n / 200000));
  for (let i = 1; i < n; i += step) {
    diffs.push(Math.abs(s.l[i] - s.l[i - 1]), Math.abs(s.r[i] - s.r[i - 1]));
  }
  diffs.sort((a, b) => a - b);
  const p999 = diffs[Math.floor(diffs.length * 0.999)] || 1e-9;
  const jump = Math.max(Math.abs(s.l[0] - s.l[n - 1]), Math.abs(s.r[0] - s.r[n - 1]));
  return jump / Math.max(p999, 1e-9);
}

/** Durée (s) jusqu'au dernier échantillon dépassant le seuil (dB relatif à la crête). */
export function activeLength(s: Stereo | Float32Array, relDb = -60): number {
  const chans = s instanceof Float32Array ? [s] : [s.l, s.r];
  const p = peak(s);
  const thr = p * Math.pow(10, relDb / 20);
  let last = 0;
  for (const c of chans) for (let i = c.length - 1; i > last; i--) if (Math.abs(c[i]) > thr) {
    last = i;
    break;
  }
  return (last + 1) / SR;
}
