/**
 * Petites fonctions mathématiques partagées par tout le rendu procédural.
 */
export const TAU = Math.PI * 2;
export const PI = Math.PI;

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smooth(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/** Progression normalisée de t dans [a, b] (bornée). */
export function seg(t: number, a: number, b: number): number {
  return clamp((t - a) / (b - a), 0, 1);
}

export function easeOut(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - (1 - c) * (1 - c);
}

export function easeIn(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c;
}

/**
 * Interpolation par images clés avec lissage (smoothstep) entre deux clés.
 * keys = [t0, v0, t1, v1, …] avec t croissants.
 */
export function kf(t: number, keys: readonly number[]): number {
  const n = keys.length;
  if (t <= keys[0]) return keys[1];
  for (let i = 2; i < n; i += 2) {
    const t1 = keys[i];
    if (t <= t1) {
      const t0 = keys[i - 2];
      const u = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
      return lerp(keys[i - 1], keys[i + 1], smooth(u));
    }
  }
  return keys[n - 1];
}

/** Hachage FNV-1a 32 bits d'une chaîne. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit 1D pseudo-aléatoire lisse (pour scintillements, flammes). */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin((n + seed * 17.13) * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}
