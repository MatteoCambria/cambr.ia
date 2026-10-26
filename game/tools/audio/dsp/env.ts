/**
 * Enveloppes : ADSR (attaque linéaire légèrement bombée, décroissance et relâchement exponentiels),
 * décroissances exponentielles, rampes.
 */
import { SR } from './core';

export interface ADSR {
  a: number; // s
  d: number; // s
  s: number; // niveau 0..1
  r: number; // s
}

/** Enveloppe ADSR pour une note tenue `gate` secondes. Longueur = gate + r (+ extra). */
export function adsr(gate: number, e: ADSR, extra = 0): Float32Array {
  const ng = Math.max(1, Math.round(gate * SR));
  const nr = Math.max(1, Math.round(e.r * SR));
  const n = ng + nr + Math.round(extra * SR);
  const out = new Float32Array(n);
  const na = Math.max(1, Math.round(e.a * SR));
  const nd = Math.max(1, Math.round(e.d * SR));
  const dCoef = Math.exp(-4.6 / nd);
  const rCoef = Math.exp(-6.9 / nr);
  let lvl = 0;
  for (let i = 0; i < n; i++) {
    if (i < ng) {
      if (i < na) {
        const x = (i + 1) / na;
        lvl = x * (2 - x) * 0.6 + x * 0.4; // attaque légèrement convexe
      } else {
        lvl = e.s + (lvl - e.s) * dCoef;
      }
    } else {
      lvl *= rCoef;
    }
    out[i] = lvl;
  }
  // Anti-clic final.
  const tail = Math.min(64, n);
  for (let i = 0; i < tail; i++) out[n - 1 - i] = out[n - 1 - i] * (i / tail);
  return out;
}

/** Décroissance exponentielle atteignant -60 dB en t60 secondes, avec attaque optionnelle. */
export function expDecay(n: number, t60: number, attack = 0.001): Float32Array {
  const out = new Float32Array(n);
  const dec = Math.exp(-6.907755 / Math.max(1, t60 * SR));
  const na = Math.max(1, attack * SR);
  let a = 1;
  for (let i = 0; i < n; i++) {
    out[i] = i < na ? (a * i) / na : a;
    a *= dec;
  }
  return out;
}

/** Multiplie un signal par une enveloppe (longueur = min des deux). */
export function applyEnv(x: Float32Array, env: Float32Array): Float32Array {
  const n = Math.min(x.length, env.length);
  for (let i = 0; i < n; i++) x[i] = x[i] * env[i];
  for (let i = n; i < x.length; i++) x[i] = 0;
  return x;
}

/** Rampe exponentielle d'une valeur a à b sur n échantillons (a, b > 0). */
export function expRamp(n: number, a: number, b: number): Float32Array {
  const out = new Float32Array(n);
  const la = Math.log(a);
  const lb = Math.log(b);
  for (let i = 0; i < n; i++) out[i] = Math.exp(la + ((lb - la) * i) / Math.max(1, n - 1));
  return out;
}

/** Enveloppe en points (temps en s, valeurs), interpolation linéaire. */
export function breakpoints(n: number, pts: ReadonlyArray<readonly [number, number]>): Float32Array {
  const out = new Float32Array(n);
  if (pts.length === 0) return out;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    while (k < pts.length - 1 && t > pts[k + 1][0]) k++;
    const p0 = pts[k];
    const p1 = pts[Math.min(k + 1, pts.length - 1)];
    if (t <= p0[0] || p1 === p0) out[i] = p0[1];
    else if (t >= p1[0]) out[i] = p1[1];
    else out[i] = p0[1] + ((p1[1] - p0[1]) * (t - p0[0])) / (p1[0] - p0[0]);
  }
  return out;
}
