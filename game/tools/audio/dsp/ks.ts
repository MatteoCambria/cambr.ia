/**
 * Karplus-Strong étendu (Jaffe & Smith) : excitation filtrée, position de pincement, filtre de
 * perte à un zéro, accord fractionnaire par passe-tout, temps de décroissance réglable (t60).
 */
import { SR, type Rng } from './core';

export interface KSOptions {
  /** Temps de décroissance à -60 dB (s) pour le fondamental. */
  t60: number;
  /** 0 = sombre, 1 = très brillant (filtre de boucle et d'excitation). */
  brightness: number;
  /** Position de pincement 0..0.5 (filtre en peigne sur l'excitation). */
  pickPos?: number;
  /** Amplitude de l'excitation (vélocité). */
  amp?: number;
  /** Mélange d'une excitation impulsionnelle douce (0 = bruit pur). */
  softness?: number;
  /** Étouffement final : durée de note après laquelle la corde est amortie (s). */
  damp?: number;
  /** Temps de décroissance une fois étouffée. */
  dampT60?: number;
  /** Non-linéarité « sitar » (0..1) : bourdonnement par limitation asymétrique. */
  buzz?: number;
}

export function karplus(freq: number, seconds: number, rng: Rng, o: KSOptions): Float32Array {
  const n = Math.max(1, Math.round(seconds * SR));
  const out = new Float32Array(n);
  const f = Math.min(Math.max(freq, 20), SR / 4);
  const period = SR / f;
  // Filtre de boucle y = (1-a)·x + a·x[-1] : retard de phase ≈ a échantillons.
  const bright = Math.min(Math.max(o.brightness, 0), 1);
  const a = 0.5 - 0.42 * bright;
  const total = period - a;
  let L = Math.floor(total - 0.1);
  if (L < 2) L = 2;
  const frac = total - L; // dans [0.1, 1.1)
  const c = (1 - frac) / (1 + frac); // passe-tout fractionnaire
  // Gain de boucle par période pour obtenir t60.
  const loopGain = (t60: number): number => Math.pow(10, -3 / (Math.max(0.02, t60) * f));
  let g = loopGain(o.t60);
  const gDamp = loopGain(o.dampT60 ?? 0.08);
  const dampAt = o.damp !== undefined ? Math.round(o.damp * SR) : Number.POSITIVE_INFINITY;

  // Excitation : bruit filtré (brillance) + impulsion douce, peigne de pincement.
  const buf = new Float32Array(L);
  const amp = o.amp ?? 1;
  const soft = o.softness ?? 0;
  let lp = 0;
  const lpA = 0.15 + 0.85 * bright;
  for (let i = 0; i < L; i++) {
    lp += lpA * (rng.bi() - lp);
    const x = i / L;
    const tri = 1 - Math.abs(2 * x - 1);
    buf[i] = (lp * (1 - soft) + tri * soft * 1.6) * amp;
  }
  const pp = o.pickPos ?? 0;
  if (pp > 0) {
    const d = Math.max(1, Math.round(pp * L));
    const tmp = Float32Array.from(buf);
    for (let i = 0; i < L; i++) buf[i] = tmp[i] - 0.9 * (i >= d ? tmp[i - d] : 0);
  }
  // Retire la composante continue de l'excitation.
  let mean = 0;
  for (let i = 0; i < L; i++) mean += buf[i];
  mean /= L;
  for (let i = 0; i < L; i++) buf[i] -= mean;

  let idx = 0;
  let prev = 0;
  let apX1 = 0;
  let apY1 = 0;
  const buzz = o.buzz ?? 0;
  for (let i = 0; i < n; i++) {
    if (i === dampAt) g = gDamp;
    const x = buf[idx];
    // Filtre de perte (un zéro) puis gain de boucle.
    let y = ((1 - a) * x + a * prev) * g;
    prev = x;
    // Passe-tout d'accord fractionnaire.
    const ap = c * y + apX1 - c * apY1;
    apX1 = y;
    apY1 = ap;
    y = ap;
    if (buzz > 0) {
      // Bourdonnement : la corde « frotte » sur un chevalet plat côté positif.
      const th = 0.25 * (1 - buzz * 0.8);
      if (y > th) y = th + (y - th) * 0.35;
    }
    buf[idx] = y;
    out[i] = x;
    idx++;
    if (idx >= L) idx = 0;
  }
  return out;
}
