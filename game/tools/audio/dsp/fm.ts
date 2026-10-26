/**
 * Synthèse FM (modulation de phase) à 2 ou 3 opérateurs, avec enveloppes d'indice par échantillon.
 */
import { SR, TAU } from './core';

export interface FMOp {
  /** Rapport de fréquence par rapport à la fondamentale. */
  ratio: number;
  /** Décalage fixe en Hz (inharmonicité / battements). */
  detuneHz?: number;
  /** Indice de modulation initial (radians) et sa constante de temps de décroissance (s). */
  index: number;
  indexDecay: number;
  /** Indice résiduel (plancher). */
  indexSustain?: number;
  /** Rétroaction de l'opérateur sur lui-même. */
  feedback?: number;
}

/**
 * Porteuse sinusoïdale modulée par une chaîne de modulateurs (mod2 → mod1 → porteuse).
 * Retourne un signal d'amplitude crête ≈ 1 (sans enveloppe d'amplitude).
 */
export function fmVoice(freq: number, n: number, mods: FMOp[], carrierRatio = 1, freqCurve?: Float32Array): Float32Array {
  const out = new Float32Array(n);
  const m1 = mods[0];
  const m2 = mods[1];
  let pc = 0;
  let p1 = 0;
  let p2 = 0;
  let fb1 = 0;
  const d1 = m1 ? Math.exp(-1 / Math.max(1, m1.indexDecay * SR)) : 0;
  const d2 = m2 ? Math.exp(-1 / Math.max(1, m2.indexDecay * SR)) : 0;
  let i1 = m1 ? m1.index - (m1.indexSustain ?? 0) : 0;
  let i2 = m2 ? m2.index - (m2.indexSustain ?? 0) : 0;
  const s1 = m1?.indexSustain ?? 0;
  const s2 = m2?.indexSustain ?? 0;
  const invSR = 1 / SR;
  const tau = TAU;
  for (let i = 0; i < n; i++) {
    const f = freqCurve ? freqCurve[i] : freq;
    let mod2 = 0;
    if (m2) {
      mod2 = Math.sin(tau * p2) * (i2 + s2);
      p2 += (f * m2.ratio + (m2.detuneHz ?? 0)) * invSR;
      if (p2 >= 1) p2 -= Math.floor(p2);
      i2 *= d2;
    }
    let mod1 = 0;
    if (m1) {
      const fb = (m1.feedback ?? 0) * fb1;
      const s = Math.sin(tau * p1 + mod2 + fb);
      fb1 = s;
      mod1 = s * (i1 + s1);
      p1 += (f * m1.ratio + (m1.detuneHz ?? 0)) * invSR;
      if (p1 >= 1) p1 -= Math.floor(p1);
      i1 *= d1;
    }
    out[i] = Math.sin(tau * pc + mod1);
    pc += f * carrierRatio * invSR;
    if (pc >= 1) pc -= Math.floor(pc);
  }
  return out;
}
