/**
 * État de rendu d'une figurine et primitives de peinture communes :
 * remplissage + contour sombre, dégradés mis en cache, lueurs pré-rendues.
 */
import type { Extra, Look } from '../../core/defs';
import type { Pal } from './color';
import { INK, rgba } from './color';
import type { Pose } from './pose';
import type { Rig } from './rig';
import type { CreatureMount, WSpec } from './weaponSpec';

export interface RS {
  ctx: CanvasRenderingContext2D;
  look: Look;
  pal: Pal;
  rig: Rig;
  spec: WSpec;
  pose: Pose;
  /** Épaisseur du contour en unités locales. */
  lw: number;
  /** Pixels écran par unité locale (niveau de détail). */
  lod: number;
  /** Couleur d'aplat (silhouette / fantôme) ou null. */
  sil: string | null;
  time: number;
  ex: ReadonlySet<Extra>;
  mount: CreatureMount;
  /** Position de la tête (repère local) relevée pendant le dessin, pour les effets. */
  headAt: { x: number; y: number; r: number };
}

/** Remplit le chemin courant puis trace le contour encré. */
export function fo(rs: RS, fill: string | CanvasGradient, outline = true, olScale = 1): void {
  const ctx = rs.ctx;
  ctx.fillStyle = rs.sil ?? fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = rs.sil ?? INK;
    ctx.lineWidth = rs.lw * olScale;
    ctx.stroke();
  }
}

/** Trace le chemin courant (détail, pas de contour). */
export function st(rs: RS, color: string | CanvasGradient, w: number): void {
  const ctx = rs.ctx;
  ctx.strokeStyle = rs.sil ?? color;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** Remplissage sans contour. */
export function fl(rs: RS, color: string | CanvasGradient): void {
  rs.ctx.fillStyle = rs.sil ?? color;
  rs.ctx.fill();
}

/** Détails fins : sautés quand la figurine est petite à l'écran. */
export function detail(rs: RS, minLod = 0.55): boolean {
  return rs.sil === null && rs.lod >= minLod;
}

/**
 * Dégradé linéaire mis en cache par palette. La clé doit identifier
 * de façon unique les coordonnées et les couleurs.
 */
export function lin(
  rs: RS,
  key: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c0: string,
  c1: string,
  c2?: string,
): string | CanvasGradient {
  if (rs.sil) return rs.sil;
  const m = rs.pal.grads;
  let g = m.get(key);
  if (!g) {
    g = rs.ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c0);
    if (c2) {
      g.addColorStop(0.5, c1);
      g.addColorStop(1, c2);
    } else g.addColorStop(1, c1);
    m.set(key, g);
  }
  return g;
}

/** Dégradé radial mis en cache par palette. */
export function rad(
  rs: RS,
  key: string,
  x: number,
  y: number,
  r: number,
  stops: readonly (readonly [number, string])[],
  fx = x,
  fy = y,
): string | CanvasGradient {
  if (rs.sil) return rs.sil;
  const m = rs.pal.grads;
  let g = m.get(key);
  if (!g) {
    g = rs.ctx.createRadialGradient(fx, fy, 0, x, y, r);
    for (const [o, c] of stops) g.addColorStop(o, c);
    m.set(key, g);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Lueurs pré-rendues (évite shadowBlur et dégradés radiaux à chaque image).

const glowCache = new Map<string, HTMLCanvasElement>();

export function glowSprite(color: string): HTMLCanvasElement | null {
  let c = glowCache.get(color);
  if (c) return c;
  if (typeof document === 'undefined') return null;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(color, 1));
  gr.addColorStop(0.25, rgba(color, 0.55));
  gr.addColorStop(0.6, rgba(color, 0.16));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  if (glowCache.size > 200) glowCache.clear();
  glowCache.set(color, c);
  return c;
}

/** Halo lumineux additif centré en (x, y), rayon r. */
export function glow(rs: RS, x: number, y: number, r: number, color: string, alpha: number, ry = r): void {
  if (rs.sil || alpha <= 0.01) return;
  drawGlow(rs.ctx, x, y, r, color, alpha, ry);
}

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
  ry = r,
): void {
  const s = glowSprite(color);
  if (!s) return;
  const pa = ctx.globalAlpha;
  const pc = ctx.globalCompositeOperation;
  ctx.globalAlpha = pa * Math.min(1, alpha);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(s, x - r, y - ry, r * 2, ry * 2);
  ctx.globalAlpha = pa;
  ctx.globalCompositeOperation = pc;
}

/** Petit reflet spéculaire (ellipse claire). */
export function spec(rs: RS, x: number, y: number, rx: number, ry: number, rot = -0.5, a = 0.55): void {
  if (!detail(rs, 0.4)) return;
  const ctx = rs.ctx;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fill();
}
