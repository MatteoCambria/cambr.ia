/** Générateurs de bruit (blanc, rose, brun) déterministes. */
import type { Rng } from './core';

export function white(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rng.bi();
  return out;
}

/** Bruit rose (filtre de Paul Kellet), amplitude crête ≈ 1. */
export function pink(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng.bi();
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.18;
    b6 = w * 0.115926;
  }
  return out;
}

/** Bruit brun (intégré avec fuite), amplitude crête ≈ 1. */
export function brown(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    y = (y + 0.02 * rng.bi()) * 0.998;
    out[i] = y * 3.2;
  }
  return out;
}
