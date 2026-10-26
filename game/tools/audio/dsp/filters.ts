/**
 * Filtres : biquad RBJ (forme transposée directe II), filtre à variables d'état TPT (stable sous
 * modulation rapide), un-pôle, bloqueur de continu, passe-tout.
 */
import { SR } from './core';

export type BiquadType = 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'peak' | 'lowshelf' | 'highshelf' | 'allpass';

export class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  private z1 = 0;
  private z2 = 0;

  constructor(type?: BiquadType, f = 1000, q = Math.SQRT1_2, gainDb = 0) {
    if (type) this.set(type, f, q, gainDb);
  }

  set(type: BiquadType, f: number, q = Math.SQRT1_2, gainDb = 0): this {
    const fc = Math.min(Math.max(f, 1), SR * 0.49);
    const w0 = (2 * Math.PI * fc) / SR;
    const cw = Math.cos(w0);
    const sw = Math.sin(w0);
    const alpha = sw / (2 * Math.max(q, 1e-4));
    const A = Math.pow(10, gainDb / 40);
    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;
    switch (type) {
      case 'lowpass':
        b0 = (1 - cw) / 2;
        b1 = 1 - cw;
        b2 = (1 - cw) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case 'highpass':
        b0 = (1 + cw) / 2;
        b1 = -(1 + cw);
        b2 = (1 + cw) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case 'bandpass':
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case 'notch':
        b0 = 1;
        b1 = -2 * cw;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case 'allpass':
        b0 = 1 - alpha;
        b1 = -2 * cw;
        b2 = 1 + alpha;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case 'peak':
        b0 = 1 + alpha * A;
        b1 = -2 * cw;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cw;
        a2 = 1 - alpha / A;
        break;
      case 'lowshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 - (A - 1) * cw + s);
        b1 = 2 * A * (A - 1 - (A + 1) * cw);
        b2 = A * (A + 1 - (A - 1) * cw - s);
        a0 = A + 1 + (A - 1) * cw + s;
        a1 = -2 * (A - 1 + (A + 1) * cw);
        a2 = A + 1 + (A - 1) * cw - s;
        break;
      }
      case 'highshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 + (A - 1) * cw + s);
        b1 = -2 * A * (A - 1 + (A + 1) * cw);
        b2 = A * (A + 1 + (A - 1) * cw - s);
        a0 = A + 1 - (A - 1) * cw + s;
        a1 = 2 * (A - 1 - (A + 1) * cw);
        a2 = A + 1 - (A - 1) * cw - s;
        break;
      }
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
    return this;
  }

  reset(): void {
    this.z1 = 0;
    this.z2 = 0;
  }

  process(xin: number): number {
    const x = xin + 1e-18;
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  /** Filtre un tampon (in place par défaut). */
  run(buf: Float32Array, out: Float32Array = buf): Float32Array {
    let z1 = this.z1;
    let z2 = this.z2;
    const { b0, b1, b2, a1, a2 } = this;
    // Décalage anti-dénormaux (états float64 qui s'éteignent pendant les silences).
    let dn = 1e-18;
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i] + dn;
      dn = -dn;
      const y = b0 * x + z1;
      z1 = b1 * x - a1 * y + z2;
      z2 = b2 * x - a2 * y;
      out[i] = y;
    }
    // Évite les dénormaux.
    this.z1 = Math.abs(z1) < 1e-25 ? 0 : z1;
    this.z2 = Math.abs(z2) < 1e-25 ? 0 : z2;
    return out;
  }
}

/** Raccourci : filtre un tampon avec un biquad neuf. */
export function biquad(buf: Float32Array, type: BiquadType, f: number, q = Math.SQRT1_2, gainDb = 0): Float32Array {
  return new Biquad(type, f, q, gainDb).run(buf);
}

/**
 * Filtre à variables d'état topologiquement préservé (Zavalishin / Simper).
 * Sorties simultanées passe-bas / passe-bande / passe-haut ; recalcul de coefficients bon marché.
 */
export class SVF {
  private ic1 = 0;
  private ic2 = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  private k = 1;
  bp = 0;
  hp = 0;

  constructor(f = 1000, q = Math.SQRT1_2) {
    this.set(f, q);
  }

  set(f: number, q: number): void {
    const g = Math.tan((Math.PI * Math.min(Math.max(f, 5), SR * 0.49)) / SR);
    this.k = 1 / Math.max(q, 0.05);
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }

  /** Traite un échantillon ; renvoie le passe-bas (bp/hp disponibles ensuite). */
  lp(xin: number): number {
    const x = xin + 1e-18;
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.bp = v1;
    this.hp = x - this.k * v1 - v2;
    return v2;
  }
}

/**
 * Passe-bas modulé : `cutoff` est une courbe (Hz) par échantillon ; coefficients recalculés tous les
 * 8 échantillons.
 */
export function modLowpass(x: Float32Array, cutoff: Float32Array | number, q = 0.707, mode: 'lp' | 'bp' | 'hp' = 'lp'): Float32Array {
  const f = new SVF(typeof cutoff === 'number' ? cutoff : cutoff[0], q);
  const out = new Float32Array(x.length);
  const isConst = typeof cutoff === 'number';
  for (let i = 0; i < x.length; i++) {
    if (!isConst && (i & 7) === 0) f.set((cutoff as Float32Array)[i], q);
    const lp = f.lp(x[i]);
    out[i] = mode === 'lp' ? lp : mode === 'bp' ? f.bp : f.hp;
  }
  return out;
}

/** Filtre un pôle (passe-bas) et dérivé passe-haut. */
export class OnePole {
  private y = 0;
  private a = 0;

  constructor(f: number) {
    this.setFreq(f);
  }

  setFreq(f: number): void {
    this.a = 1 - Math.exp((-2 * Math.PI * Math.min(f, SR * 0.49)) / SR);
  }

  lp(x: number): number {
    this.y += this.a * (x + 1e-18 - this.y);
    return this.y;
  }

  hp(x: number): number {
    return x - this.lp(x);
  }
}

export function onePoleLP(buf: Float32Array, f: number): Float32Array {
  const p = new OnePole(f);
  for (let i = 0; i < buf.length; i++) buf[i] = p.lp(buf[i]);
  return buf;
}

export function onePoleHP(buf: Float32Array, f: number): Float32Array {
  const p = new OnePole(f);
  for (let i = 0; i < buf.length; i++) buf[i] = p.hp(buf[i]);
  return buf;
}

/** Bloqueur de composante continue. */
export function dcBlock(buf: Float32Array, r = 0.9995): Float32Array {
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] + 1e-18;
    const y = x - x1 + r * y1;
    x1 = x;
    y1 = y;
    buf[i] = y;
  }
  return buf;
}
