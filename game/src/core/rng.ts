/**
 * Générateur pseudo-aléatoire déterministe (sfc32) avec graine.
 * Tout l'aléatoire du moteur passe par ici : jamais de Math.random() dans les règles.
 * L'état est sérialisable (4 entiers 32 bits) pour les sauvegardes et la reproduction des parties.
 */

export type RngState = [number, number, number, number];

/** Hash d'une chaîne en graine 32 bits (xmur3). */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string | RngState) {
    if (Array.isArray(seed)) {
      [this.a, this.b, this.c, this.d] = seed;
      return;
    }
    const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.a = s ^ 0x9e3779b9;
    this.b = hashString('b' + s);
    this.c = hashString('c' + s);
    this.d = hashString('d' + s);
    for (let i = 0; i < 15; i++) this.nextU32();
  }

  nextU32(): number {
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    const t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    const r = (t + this.d) | 0;
    this.c = (this.c + r) | 0;
    return r >>> 0;
  }

  /** Flottant uniforme dans [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Entier uniforme dans [0, n). */
  int(n: number): number {
    if (n <= 0) return 0;
    return Math.floor(this.next() * n);
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick sur un tableau vide');
    return arr[this.int(arr.length)];
  }

  /** Tirage pondéré : renvoie l'index choisi, ou -1 si tous les poids sont nuls. */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += Math.max(0, w);
    if (total <= 0) return -1;
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = Math.max(0, weights[i]);
      if (roll < w) return i;
      roll -= w;
    }
    return weights.length - 1;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Dérive un flux indépendant (ex. une boutique par joueur) sans perturber ce flux-ci. */
  fork(label: string): Rng {
    return new Rng(hashString(label + ':' + this.a + ':' + this.b + ':' + this.c + ':' + this.d));
  }

  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  setState(s: RngState): void {
    [this.a, this.b, this.c, this.d] = s;
  }
}

export function isRngState(v: unknown): v is RngState {
  return Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number' && Number.isFinite(x));
}
