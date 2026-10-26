/**
 * Outils de couleur : lecture hex/rgb, mélanges, éclaircissement/assombrissement
 * « thématiques » (ombres froides indigo, lumières chaudes ivoire), avec cache.
 */
import type { Look } from '../../core/defs';
import { hashStr } from './math';

export type RGB = readonly [number, number, number];

/** Encre des contours : indigo très sombre plutôt que noir pur. */
export const INK = '#140b22';
export const INK_SOFT = 'rgba(20,11,34,0.55)';
/** Teinte d'ombre (froide) et de lumière (chaude) de la direction artistique. */
export const SHADOW_TINT = '#120a2a';
export const LIGHT_TINT = '#fff6e0';
export const STEEL = '#d5dceb';
export const GOLD = '#e8c25c';

const parseCache = new Map<string, RGB>();

export function parse(c: string): RGB {
  const hit = parseCache.get(c);
  if (hit) return hit;
  let out: RGB = [128, 128, 128];
  const s = c.trim();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    if (h.length >= 6) {
      const n = parseInt(h.slice(0, 6), 16);
      if (!Number.isNaN(n)) out = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
  } else {
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const p = m[1].split(',').map((x) => parseFloat(x));
      if (p.length >= 3) out = [p[0] | 0, p[1] | 0, p[2] | 0];
    }
  }
  parseCache.set(c, out);
  return out;
}

function hex2(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return (v < 16 ? '0' : '') + v.toString(16);
}

export function toHex(c: RGB): string {
  return '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
}

const mixCache = new Map<string, string>();

/** Mélange linéaire de deux couleurs (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const key = a + '|' + b + '|' + t.toFixed(3);
  const hit = mixCache.get(key);
  if (hit) return hit;
  const A = parse(a);
  const B = parse(b);
  const out = toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  if (mixCache.size > 8000) mixCache.clear();
  mixCache.set(key, out);
  return out;
}

export function lighten(c: string, t: number): string {
  return mix(c, LIGHT_TINT, t);
}

export function darken(c: string, t: number): string {
  return mix(c, SHADOW_TINT, t);
}

const rgbaCache = new Map<string, string>();

export function rgba(c: string, a: number): string {
  const key = c + '|' + a.toFixed(3);
  const hit = rgbaCache.get(key);
  if (hit) return hit;
  const p = parse(c);
  const out = `rgba(${p[0]},${p[1]},${p[2]},${a.toFixed(3)})`;
  if (rgbaCache.size > 8000) rgbaCache.clear();
  rgbaCache.set(key, out);
  return out;
}

/** Luminance relative approximative (0..1). */
export function luma(c: string): number {
  const p = parse(c);
  return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255;
}

/** Palette dérivée d'un Look, calculée une fois puis mise en cache. */
export interface Pal {
  key: string;
  seed: number;
  p: string; pL: string; pLL: string; pD: string; pDD: string;
  s: string; sL: string; sD: string; sDD: string;
  a: string; aL: string; aLL: string; aD: string;
  skin: string; skinL: string; skinD: string; blush: string;
  hair: string; hairL: string; hairD: string;
  steel: string; steelL: string; steelD: string;
  trim: string; trimL: string; trimD: string;
  leather: string; leatherD: string;
  eye: string;
  /** Cache des dégradés (coordonnées locales de la figurine, réutilisables d'une image à l'autre). */
  grads: Map<string, CanvasGradient>;
}

const palCache = new WeakMap<object, Pal>();
const palByKey = new Map<string, Pal>();

export function lookKey(look: Look): string {
  return [
    look.body,
    look.head,
    look.weapon,
    look.primary,
    look.secondary,
    look.accent,
    look.skin ?? '',
    (look.extras ?? []).join(','),
    look.scale ?? 1,
  ].join('|');
}

export function palette(look: Look): Pal {
  const hit = palCache.get(look);
  if (hit) return hit;
  const key = lookKey(look);
  let pal = palByKey.get(key);
  if (!pal) {
    pal = buildPal(look, key);
    if (palByKey.size > 400) palByKey.clear();
    palByKey.set(key, pal);
  }
  palCache.set(look, pal);
  return pal;
}

function buildPal(look: Look, key: string): Pal {
  const p = look.primary;
  const s = look.secondary;
  const a = look.accent;
  const skin = look.skin ?? '#f1c9a5';
  // Les garnitures (bordures, boucles) tirent vers l'or, teintées par l'accent.
  const trim = mix(GOLD, a, 0.35);
  const hair = s;
  return {
    key,
    seed: hashStr(key),
    p, pL: lighten(p, 0.28), pLL: lighten(p, 0.55), pD: darken(p, 0.32), pDD: darken(p, 0.58),
    s, sL: lighten(s, 0.3), sD: darken(s, 0.32), sDD: darken(s, 0.58),
    a, aL: lighten(a, 0.35), aLL: lighten(a, 0.7), aD: darken(a, 0.3),
    skin, skinL: lighten(skin, 0.25), skinD: darken(skin, 0.22), blush: rgba(mix(skin, '#ff6f7d', 0.6), 0.45),
    hair, hairL: lighten(hair, 0.3), hairD: darken(hair, 0.35),
    steel: mix(STEEL, a, 0.12), steelL: lighten(mix(STEEL, a, 0.08), 0.6), steelD: darken(mix(STEEL, a, 0.15), 0.42),
    trim, trimL: lighten(trim, 0.4), trimD: darken(trim, 0.35),
    leather: mix('#7a4a2e', s, 0.25), leatherD: darken(mix('#7a4a2e', s, 0.25), 0.35),
    eye: '#1b1030',
    grads: new Map(),
  };
}
