/**
 * Icônes vectorielles (style gravure dorée / glyphe lumineux), lisibles de 16 à 48 px.
 * Chaque icône est rendue une fois par (clé, taille en pixels appareil, couleur) dans un
 * petit canvas mis en cache : drawIcon ne coûte ensuite qu'un drawImage.
 *
 * La couleur passée teinte le métal (dégradé clair → foncé) ; le contour reste encré.
 * L'icône occupe un carré `size` × `size` centré sur (x, y).
 */
import { GB } from './art/glyphBuilder';
import type { GlyphOp } from './art/glyphBuilder';
import { GLYPHS } from './art/glyphs';
import type { GlyphKey } from './art/glyphs';
import { INK, SHADOW_TINT, darken, lighten, rgba } from './art/color';

export type IconKey = GlyphKey;

export const ICON_KEYS = Object.keys(GLYPHS) as IconKey[];

export function isIconKey(k: string): k is IconKey {
  return Object.prototype.hasOwnProperty.call(GLYPHS, k);
}

const opsCache = new Map<IconKey, GlyphOp[]>();

function opsFor(key: IconKey): GlyphOp[] {
  let ops = opsCache.get(key);
  if (!ops) {
    const g = new GB();
    (GLYPHS[key] ?? GLYPHS.info)(g);
    ops = g.ops;
    opsCache.set(key, ops);
  }
  return ops;
}

const bmpCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();
const MAX_BMP = 900;

function remember<T>(m: Map<string, T>, k: string, v: T, max: number): void {
  if (m.size >= max) {
    // éviction simple : on retire les plus anciennes entrées
    let n = Math.ceil(max / 4);
    for (const key of m.keys()) {
      m.delete(key);
      if (--n <= 0) break;
    }
  }
  m.set(k, v);
}

/** Rend une icône dans un canvas carré de `px` pixels. */
export function renderIcon(key: IconKey, px: number, color: string): HTMLCanvasElement {
  const P = Math.max(4, Math.round(px));
  const c = document.createElement('canvas');
  c.width = P;
  c.height = P;
  const g = c.getContext('2d');
  if (!g) return c;
  const box = P * 0.86;
  const off = (P - box) / 2;
  const sc = box / 100;
  g.translate(off, off);
  g.scale(sc, sc);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const ops = opsFor(key);
  const ol = (0.85 + P * 0.017) / sc;
  const dw = Math.max(0.9, P * 0.034) / sc;
  const grad = g.createLinearGradient(0, 2, 0, 98);
  grad.addColorStop(0, lighten(color, 0.6));
  grad.addColorStop(0.35, lighten(color, 0.18));
  grad.addColorStop(0.62, color);
  grad.addColorStop(1, darken(color, 0.42));
  const gemGrad = g.createLinearGradient(0, 0, 0, 100);
  gemGrad.addColorStop(0, '#ffffff');
  gemGrad.addColorStop(1, lighten(color, 0.45));
  const fine = P >= 22;

  // Halo lumineux discret
  if (P >= 20) {
    g.save();
    g.shadowColor = rgba(color, 0.6);
    g.shadowBlur = P * 0.09;
    g.fillStyle = rgba(color, 0.55);
    g.strokeStyle = rgba(color, 0.55);
    for (const op of ops) {
      if (op.k === 'fill') g.fill(op.p);
      else if (op.k === 'line') {
        g.lineWidth = op.w;
        g.stroke(op.p);
      }
    }
    g.restore();
  }

  let group: GlyphOp[] = [];
  const flush = () => {
    if (!group.length) return;
    g.strokeStyle = INK;
    for (const op of group) {
      if (op.k === 'fill') {
        g.lineWidth = ol * 2;
        g.stroke(op.p);
      } else if (op.k === 'line') {
        g.lineWidth = op.w + ol * 2;
        g.stroke(op.p);
      }
    }
    for (const op of group) {
      if (op.k === 'fill') {
        g.fillStyle = grad;
        g.fill(op.p);
        if (fine) {
          // Biseau : reflet en haut, ombre en bas
          g.save();
          g.clip(op.p);
          g.translate(0, ol * 1.1);
          g.strokeStyle = 'rgba(255,255,255,0.42)';
          g.lineWidth = ol * 1.1;
          g.stroke(op.p);
          g.translate(0, -ol * 2.2);
          g.strokeStyle = rgba(SHADOW_TINT, 0.3);
          g.stroke(op.p);
          g.restore();
        }
      } else if (op.k === 'line') {
        g.strokeStyle = grad;
        g.lineWidth = op.w;
        g.stroke(op.p);
      }
    }
    group = [];
  };

  for (const op of ops) {
    if (op.k === 'fill' || op.k === 'line') {
      if (op.sep) flush();
      group.push(op);
      continue;
    }
    flush();
    switch (op.k) {
      case 'cut':
        g.strokeStyle = rgba(INK, 0.85);
        g.lineWidth = dw * op.w;
        g.stroke(op.p);
        if (P >= 32) {
          g.save();
          g.translate(0, dw * 0.55);
          g.strokeStyle = 'rgba(255,250,230,0.22)';
          g.lineWidth = dw * op.w * 0.55;
          g.stroke(op.p);
          g.restore();
        }
        break;
      case 'hole':
        g.fillStyle = rgba(INK, 0.9);
        g.fill(op.p);
        break;
      case 'gem':
        g.fillStyle = gemGrad;
        g.fill(op.p);
        if (fine) {
          g.strokeStyle = rgba(INK, 0.55);
          g.lineWidth = dw * 0.5;
          g.stroke(op.p);
        }
        break;
      case 'shade':
        g.fillStyle = rgba(SHADOW_TINT, op.a);
        g.fill(op.p);
        break;
    }
  }
  flush();
  return c;
}

function devScale(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

/** Dessine l'icône centrée en (x, y), dans un carré de `size` unités du canvas. */
export function drawIcon(ctx: CanvasRenderingContext2D, key: IconKey, x: number, y: number, size: number, color: string): void {
  if (size <= 0) return;
  const px = Math.max(4, Math.round(size * devScale(ctx)));
  const k = key + '|' + px + '|' + color;
  let bmp = bmpCache.get(k);
  if (!bmp) {
    bmp = renderIcon(key, px, color);
    remember(bmpCache, k, bmp, MAX_BMP);
  }
  ctx.drawImage(bmp, x - size / 2, y - size / 2, size, size);
}

/** URL de données PNG (taille naturelle = size px) pour un <img>. */
export function iconDataUrl(key: IconKey, size: number, color: string): string {
  const k = key + '|' + Math.round(size) + '|' + color;
  const hit = urlCache.get(k);
  if (hit) return hit;
  const url = renderIcon(key, size, color).toDataURL('image/png');
  remember(urlCache, k, url, MAX_BMP);
  return url;
}

/** Clés exigées par le cahier des charges (erreur de compilation si l'une manque). */
export const REQUIRED_ICON_KEYS: readonly IconKey[] = [
  // synergies
  'zenith', 'selene', 'rouage', 'sylve', 'abysse', 'braise', 'nomade', 'astral',
  'gardien', 'briseur', 'duelliste', 'assassin', 'tireur', 'arcaniste', 'invocateur', 'oracle', 'alchimiste', 'artilleur',
  // composants
  'sword', 'bow', 'wand', 'tear', 'mail', 'cloak', 'belt', 'gauntlet',
  // objets combinés
  'crown', 'skull', 'flame', 'snowflake', 'eye', 'hourglass', 'gear', 'leaf', 'wave', 'moon', 'sun', 'star', 'shield',
  'heart', 'bolt', 'fang', 'feather', 'chalice', 'ring', 'mask', 'hammer', 'lantern', 'scales', 'key', 'book', 'orb',
  'thorn', 'spiral', 'anchor', 'compass', 'mirror', 'chain', 'helm', 'axe', 'dagger', 'horn', 'scroll', 'bell', 'prism',
  'droplet', 'web', 'vortex', 'claw', 'wing', 'crystal', 'sprout', 'coin',
  // statuts
  'stun', 'root', 'disarm', 'silence', 'taunt', 'burn', 'poison', 'bleed', 'slow', 'sunder', 'shred', 'mark',
  'untargetable', 'invulnerable', 'ccImmune', 'buffAd', 'buffAs', 'buffAp', 'buffArmor', 'heal', 'wound', 'link', 'reflect', 'stasis',
  // interface
  'gold', 'xp', 'hp', 'level', 'reroll', 'lock', 'unlock', 'sell', 'speed', 'pause', 'play', 'settings', 'book-open',
  'trophy', 'swords', 'skull-round', 'crown-round', 'dice', 'info', 'close',
];
