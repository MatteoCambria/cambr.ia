/**
 * Noyau DSP : constantes, tampons stéréo, conversions, générateur pseudo-aléatoire déterministe.
 * Tout le moteur travaille à 44,1 kHz en flottants 32 bits.
 */

export const SR = 44100;
export const TAU = Math.PI * 2;

/** Tampon stéréo (deux canaux de même longueur). */
export interface Stereo {
  l: Float32Array;
  r: Float32Array;
}

export function makeStereo(n: number): Stereo {
  const len = Math.max(0, Math.floor(n));
  return { l: new Float32Array(len), r: new Float32Array(len) };
}

/** Secondes → échantillons (arrondi). */
export function secs(s: number): number {
  return Math.max(0, Math.round(s * SR));
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(g: number): number {
  return 20 * Math.log10(Math.max(Math.abs(g), 1e-12));
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hachage FNV-1a 32 bits d'une chaîne (pour dériver des graines). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32 : rapide, déterministe, suffisant pour l'audio. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniforme dans [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  /** Uniforme dans [-1, 1). */
  bi(): number {
    return this.next() * 2 - 1;
  }

  /** Entier uniforme dans [a, b] (inclus). */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length] as T;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Loi normale centrée réduite (Box-Muller). */
  gauss(): number {
    const u = Math.max(1e-12, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  /** Nouveau générateur indépendant dérivé de celui-ci. */
  fork(salt: number | string): Rng {
    const k = typeof salt === 'string' ? hashString(salt) : salt >>> 0;
    return new Rng((Math.imul(this.s ^ k, 0x9e3779b1) + k) >>> 0);
  }
}

/** Gains gauche/droite à puissance constante pour pan ∈ [-1, 1]. */
export function panGains(pan: number): [number, number] {
  const p = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(p), Math.sin(p)];
}

/** Ajoute un signal mono dans un tampon stéréo à la position `at` (échantillons). */
export function addMono(dst: Stereo, src: Float32Array, at: number, gl: number, gr: number): void {
  const start = Math.max(0, at);
  const end = Math.min(dst.l.length, at + src.length);
  const { l, r } = dst;
  for (let i = start; i < end; i++) {
    const x = src[i - at];
    l[i] = (l[i]) + x * gl;
    r[i] = (r[i]) + x * gr;
  }
}

/** Ajoute un tampon stéréo dans un autre à la position `at`. */
export function addStereo(dst: Stereo, src: Stereo, at = 0, g = 1): void {
  const start = Math.max(0, at);
  const end = Math.min(dst.l.length, at + src.l.length);
  for (let i = start; i < end; i++) {
    dst.l[i] = (dst.l[i]) + (src.l[i - at]) * g;
    dst.r[i] = (dst.r[i]) + (src.r[i - at]) * g;
  }
}

export function scaleStereo(s: Stereo, g: number): void {
  for (let i = 0; i < s.l.length; i++) {
    s.l[i] = (s.l[i]) * g;
    s.r[i] = (s.r[i]) * g;
  }
}

export function scaleMono(s: Float32Array, g: number): void {
  for (let i = 0; i < s.length; i++) s[i] = (s[i]) * g;
}

export function monoToStereo(m: Float32Array, pan = 0): Stereo {
  const [gl, gr] = panGains(pan);
  const out = makeStereo(m.length);
  for (let i = 0; i < m.length; i++) {
    out.l[i] = (m[i]) * gl * Math.SQRT2;
    out.r[i] = (m[i]) * gr * Math.SQRT2;
  }
  return out;
}

export function cloneStereo(s: Stereo): Stereo {
  return { l: new Float32Array(s.l), r: new Float32Array(s.r) };
}

export function sliceStereo(s: Stereo, a: number, b: number): Stereo {
  return { l: s.l.slice(a, b), r: s.r.slice(a, b) };
}

/** Somme de plusieurs tampons stéréo (longueur = la plus grande). */
export function sumStereo(list: readonly Stereo[]): Stereo {
  const n = list.reduce((m, s) => Math.max(m, s.l.length), 0);
  const out = makeStereo(n);
  for (const s of list) addStereo(out, s, 0, 1);
  return out;
}

/** Applique une courbe de gain (même longueur) sur un tampon stéréo. */
export function applyGainCurve(s: Stereo, g: Float32Array): void {
  const n = Math.min(s.l.length, g.length);
  for (let i = 0; i < n; i++) {
    const k = g[i];
    s.l[i] = (s.l[i]) * k;
    s.r[i] = (s.r[i]) * k;
  }
}

/** Fondu d'entrée/sortie linéaire sur n échantillons (in place). */
export function fadeEdges(s: Stereo, nIn: number, nOut: number): void {
  const len = s.l.length;
  for (let i = 0; i < Math.min(nIn, len); i++) {
    const g = i / nIn;
    s.l[i] = (s.l[i]) * g;
    s.r[i] = (s.r[i]) * g;
  }
  for (let i = 0; i < Math.min(nOut, len); i++) {
    const g = i / nOut;
    const j = len - 1 - i;
    s.l[j] = (s.l[j]) * g;
    s.r[j] = (s.r[j]) * g;
  }
}

/** Mono → somme moyenne des deux canaux. */
export function toMono(s: Stereo): Float32Array {
  const out = new Float32Array(s.l.length);
  for (let i = 0; i < out.length; i++) out[i] = 0.5 * ((s.l[i]) + (s.r[i]));
  return out;
}
