/**
 * Rendu des unités (figurines) sur le plateau : socle d'équipe, ombre portée,
 * figurine animée, effets (flash, dissolution, silhouette, étoiles d'étourdissement).
 *
 * Coût : la figurine est dessinée en vectoriel direct (pas de filtre canvas, pas de
 * shadowBlur) ; dégradés, lueurs, socles et ombres sont mis en cache. Un canvas
 * hors-écran partagé n'est utilisé que pour les cas qui l'exigent (opacité < 1,
 * flash, dissolution, silhouette) afin d'éviter les superpositions translucides.
 */
import type { Look } from '../core/defs';
import { drawFigure } from './art/figure';
import type { AnimKind } from './art/pose';
import { clamp, hashStr, rng, seg, smooth, TAU } from './art/math';
import { rgba, palette } from './art/color';
import { drawGlow } from './art/paint';
import { rigFor } from './art/rig';
import { sparkle } from './art/paths';

export type { AnimKind };

export interface DrawUnitOpts {
  x: number;
  y: number;
  size: number;
  facing: 1 | -1;
  time: number;
  anim: AnimKind;
  animT: number;
  aimX?: number;
  aimY?: number;
  flash?: number;
  alpha?: number;
  scale?: number;
  team: 0 | 1;
  selected?: boolean;
  hovered?: boolean;
  star?: 1 | 2 | 3;
  silhouetteOnly?: boolean;
}

/** Hauteur d'une figurine standard (unités locales) ; 100 u = 1,7 × size. */
const UNIT_H = 100;
/** Boîte englobante locale (armes longues, géants, sauts inclus). */
const BX0 = -98;
const BX1 = 98;
const BY0 = -182;
const BY1 = 26;
/** Aplatissement du socle (proche de l'inclinaison du plateau, TILT = 0.66). */
const BASE_RY = 0.55;

const TEAM = [
  { rim: '#e9c46a', rimL: '#fff2c4', glow: '#5fb4ff', base: '#1b2448', baseL: '#2c3a6e' },
  { rim: '#c9733f', rimL: '#ffc9a0', glow: '#ff5a48', base: '#3a1a22', baseL: '#5a2a30' },
] as const;

// ---------------------------------------------------------------------------
// Caches (ombre, socles, canvas de travail)

let scratch: HTMLCanvasElement | null = null;
let sctx: CanvasRenderingContext2D | null = null;

function getScratch(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = 256;
    scratch.height = 256;
    sctx = scratch.getContext('2d');
  }
  if (!scratch || !sctx) return null;
  if (scratch.width < w || scratch.height < h) {
    scratch.width = Math.max(scratch.width, Math.ceil(w));
    scratch.height = Math.max(scratch.height, Math.ceil(h));
  }
  return sctx;
}

let shadowSprite: HTMLCanvasElement | null = null;

function getShadow(): HTMLCanvasElement | null {
  if (shadowSprite) return shadowSprite;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  g.translate(64, 32);
  g.scale(1, 0.5);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 62);
  gr.addColorStop(0, 'rgba(6,3,16,0.85)');
  gr.addColorStop(0.55, 'rgba(6,3,16,0.55)');
  gr.addColorStop(1, 'rgba(6,3,16,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, 62, 0, TAU);
  g.fill();
  shadowSprite = c;
  return c;
}

const baseCache = new Map<string, HTMLCanvasElement>();

/** Socle de figurine (disque elliptique) pré-rendu. */
function getBase(team: 0 | 1, rxPx: number, hover: boolean, star: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const rx = Math.max(8, Math.round(rxPx));
  const key = team + '|' + rx + '|' + (hover ? 1 : 0) + '|' + star;
  const hit = baseCache.get(key);
  if (hit) return hit;
  const ry = rx * BASE_RY;
  const pad = Math.ceil(rx * 0.25) + 4;
  const c = document.createElement('canvas');
  c.width = Math.ceil(rx * 2 + pad * 2);
  c.height = Math.ceil(ry * 2 + pad * 2 + rx * 0.12);
  const g = c.getContext('2d');
  if (!g) return null;
  const T = TEAM[team];
  const cx = c.width / 2;
  const cy = pad + ry;
  const th = rx * 0.1; // épaisseur du socle
  // Lueur d'équipe
  const gl = g.createRadialGradient(cx, cy, rx * 0.5, cx, cy, rx * 1.2);
  gl.addColorStop(0, rgba(T.glow, 0));
  gl.addColorStop(0.75, rgba(T.glow, hover ? 0.32 : 0.18));
  gl.addColorStop(1, rgba(T.glow, 0));
  g.save();
  g.translate(cx, cy);
  g.scale(1, BASE_RY);
  g.translate(-cx, -cy);
  g.fillStyle = gl;
  g.fillRect(0, 0, c.width, c.height * 3);
  g.restore();
  // Tranche
  g.beginPath();
  g.ellipse(cx, cy + th, rx, ry, 0, 0, Math.PI);
  g.lineTo(cx - rx, cy);
  g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
  g.closePath();
  const sg = g.createLinearGradient(0, cy, 0, cy + ry + th);
  sg.addColorStop(0, T.rim);
  sg.addColorStop(1, '#2a1a10');
  g.fillStyle = sg;
  g.fill();
  // Dessus
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  const tg = g.createRadialGradient(cx, cy - ry * 0.4, 0, cx, cy, rx);
  tg.addColorStop(0, T.baseL);
  tg.addColorStop(1, T.base);
  g.fillStyle = tg;
  g.fill();
  // Liseré doré + filet lumineux
  g.lineWidth = Math.max(1.2, rx * 0.06);
  g.strokeStyle = hover ? T.rimL : T.rim;
  g.stroke();
  g.beginPath();
  g.ellipse(cx, cy, rx * 0.8, ry * 0.8, 0, 0, TAU);
  g.lineWidth = Math.max(0.8, rx * 0.025);
  g.strokeStyle = rgba(T.glow, hover ? 0.9 : 0.6);
  g.stroke();
  // Graduations d'horloger
  g.strokeStyle = rgba(T.rimL, 0.55);
  g.lineWidth = Math.max(0.6, rx * 0.018);
  g.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24;
    const r0 = i % 6 === 0 ? 0.84 : 0.88;
    g.moveTo(cx + Math.cos(a) * rx * r0, cy + Math.sin(a) * ry * r0);
    g.lineTo(cx + Math.cos(a) * rx * 0.94, cy + Math.sin(a) * ry * 0.94);
  }
  g.stroke();
  // Ornements d'étoiles (2★ argent, 3★ or)
  if (star >= 2) {
    const col = star === 3 ? '#ffd86a' : '#dfe7f5';
    const n = star;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.28;
      const px = cx + Math.cos(a) * rx * 0.97;
      const py = cy + Math.sin(a) * ry * 0.97 + th * 0.5;
      const s = Math.max(2.5, rx * 0.11);
      g.beginPath();
      g.moveTo(px, py - s);
      g.lineTo(px + s * 0.65, py);
      g.lineTo(px, py + s);
      g.lineTo(px - s * 0.65, py);
      g.closePath();
      g.fillStyle = col;
      g.fill();
      g.lineWidth = Math.max(0.8, s * 0.22);
      g.strokeStyle = '#140b22';
      g.stroke();
    }
    if (star === 3) {
      g.beginPath();
      g.ellipse(cx, cy, rx * 1.04, ry * 1.04, 0, 0, TAU);
      g.lineWidth = Math.max(1, rx * 0.03);
      g.strokeStyle = 'rgba(255,216,106,0.8)';
      g.stroke();
    }
  }
  if (baseCache.size > 300) baseCache.clear();
  baseCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------------------

function devScale(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

/**
 * Dessine une unité. (x, y) = pieds de la figurine (centre de l'hexagone).
 * Le saut (anim 'leap') ajoute lui-même l'arc vertical : passez la position au sol.
 */
export function drawUnit(ctx: CanvasRenderingContext2D, look: Look, o: DrawUnitOpts): void {
  const dev = devScale(ctx);
  const ls = look.scale ?? 1;
  const k = ((1.7 * o.size) / UNIT_H) * ls * (o.scale ?? 1);
  if (k <= 0.01) return;
  const lod = k * dev;
  const olPx = clamp(0.85 + lod * 0.55, 1, 2.4);
  const lw = olPx / lod;
  const anim = o.anim;
  const t = clamp(o.animT, 0, 1);
  let alpha = o.alpha ?? 1;
  if (anim === 'death') alpha *= 1 - smooth(seg(t, 0.55, 1));
  if (alpha <= 0.003) return;
  const rig = rigFor(look.body);
  const facing = o.facing;

  // Visée
  let aim = 0;
  if (o.aimX !== undefined && o.aimY !== undefined) {
    const dx = Math.abs(o.aimX - o.x);
    const dy = o.aimY - o.y;
    aim = clamp(Math.atan2(dy, Math.max(dx, o.size * 0.6)), -0.75, 0.75);
  }

  // Hauteur de saut pour l'ombre
  const air = anim === 'leap' ? Math.sin(seg(t, 0.2, 0.86) * Math.PI) * 30 * k : 0;
  const hover = rig.hover * k;

  // --- Sol : socle + ombre -------------------------------------------------
  const prevA = ctx.globalAlpha;
  if (!o.silhouetteOnly) {
    ctx.globalAlpha = prevA * Math.min(1, alpha * 1.4);
    const rxBase = o.size * 0.6 * Math.min(1.25, Math.max(0.85, ls));
    const base = getBase(o.team, rxBase * dev, !!o.hovered || !!o.selected, o.star ?? 1);
    if (base) {
      const bw = base.width / dev;
      const bh = base.height / dev;
      const pad = (base.width / dev - rxBase * 2) / 2;
      ctx.drawImage(base, o.x - bw / 2, o.y - rxBase * BASE_RY - pad, bw, bh);
    }
    // Ombre portée sur le socle (rétrécit pendant un saut ou la lévitation)
    const sh = getShadow();
    const srx = Math.min(rig.shadow * k * 1.25, rxBase * 1.05) / (1 + (air + hover) / (40 * k));
    if (sh) {
      ctx.globalAlpha = prevA * Math.min(1, alpha * 1.2) * 0.7;
      ctx.drawImage(sh, o.x - srx, o.y - srx * 0.46, srx * 2, srx * 0.92);
    }
    ctx.globalAlpha = prevA * Math.min(1, alpha * 1.4);
    if (rig.hover > 0) {
      const pal = palette(look);
      drawGlow(ctx, o.x, o.y, rxBase * 0.9, pal.a, 0.45 + 0.1 * Math.sin(o.time * 1.9), rxBase * 0.4);
    }
    if (o.selected) selectionRing(ctx, o.x, o.y, rxBase, o.time, o.team);
    if (anim === 'cast') castCircle(ctx, look, o.x, o.y, rxBase, o.time, t);
    if ((o.star ?? 1) === 3) {
      drawGlow(ctx, o.x, o.y - 45 * k, 42 * k, '#ffd86a', 0.22 * alpha, 55 * k);
    }
    ctx.globalAlpha = prevA;
  }

  // --- Figurine ------------------------------------------------------------
  const flash = clamp(o.flash ?? 0, 0, 1);
  const dissolve = anim === 'death' ? smooth(seg(t, 0.32, 1)) : 0;
  const needOff = alpha < 0.999 || flash > 0.01 || dissolve > 0 || !!o.silhouetteOnly;
  const fpBase = {
    anim,
    animT: t,
    time: o.time,
    aim,
    lod,
    lw,
    sil: o.silhouetteOnly ? (o.team === 0 ? '#cfe2ff' : '#ffd0c4') : null,
  };

  if (!needOff) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(k * facing, k);
    drawFigure(ctx, look, fpBase);
    ctx.restore();
  } else {
    const W = Math.ceil((BX1 - BX0) * lod);
    const H = Math.ceil((BY1 - BY0) * lod);
    const g = getScratch(W, H);
    if (g && scratch) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W + 2, H + 2);
      g.setTransform(lod * facing, 0, 0, lod, -BX0 * lod, -BY0 * lod);
      drawFigure(g, look, fpBase);
      if (dissolve > 0) dissolveHoles(g, look, dissolve, lod, facing);
      if (flash > 0.01) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = `rgba(255,250,240,${(flash * 0.85).toFixed(3)})`;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
      }
      ctx.save();
      ctx.globalAlpha = prevA * (o.silhouetteOnly ? alpha * (o.alpha === undefined ? 0.55 : 1) : alpha);
      ctx.drawImage(scratch, 0, 0, W, H, o.x + BX0 * k, o.y + BY0 * k, W / dev, H / dev);
      ctx.restore();
    }
  }

  if (dissolve > 0) deathMotes(ctx, look, o.x, o.y, k, dissolve, alpha);
}

function selectionRing(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, time: number, team: 0 | 1): void {
  const T = TEAM[team];
  const ry = rx * BASE_RY;
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, rx * 0.06);
  ctx.strokeStyle = rgba(T.rimL, 0.6 + 0.4 * pulse);
  const rot = time * 1.2;
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * TAU) / 3;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 1.12, ry * 1.12, 0, a, a + 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

function castCircle(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, rx: number, time: number, t: number): void {
  const p = palette(look);
  const g = smooth(seg(t, 0, 0.25)) * (1 - smooth(seg(t, 0.75, 1)));
  if (g <= 0.01) return;
  const R = rx * (1.05 + 0.15 * g);
  const ry = R * BASE_RY;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(p.aL, 0.75 * g);
  ctx.lineWidth = Math.max(1, rx * 0.04);
  ctx.beginPath();
  ctx.ellipse(x, y, R, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, R * 0.78, ry * 0.78, 0, 0, TAU);
  ctx.stroke();
  const n = 8;
  const rot = time * 1.4;
  ctx.fillStyle = rgba(p.aLL, 0.9 * g);
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    const px = x + Math.cos(a) * R * 0.89;
    const py = y + Math.sin(a) * ry * 0.89;
    ctx.beginPath();
    sparkle(ctx, px, py, Math.max(1.5, rx * 0.07), 0.25);
    ctx.fill();
  }
  drawGlow(ctx, x, y, R * 1.2, p.a, 0.35 * g, ry * 1.4);
  ctx.restore();
}

function dissolveHoles(g: CanvasRenderingContext2D, look: Look, d: number, lod: number, facing: 1 | -1): void {
  const rig = rigFor(look.body);
  const rnd = rng(hashStr(look.primary + look.body) ^ 0x9e3779b9);
  g.setTransform(lod * facing, 0, 0, lod, -BX0 * lod, -BY0 * lod);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  const top = rig.top;
  const n = 46;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const hx = (rnd() * 2 - 1) * (rig.kind === 'quad' ? 40 : 28);
    const hy = top + rnd() * (-top + 4);
    // Se dissout du haut vers le bas, avec du hasard.
    const th = 0.7 * rnd() + 0.3 * ((hy - top) / -top);
    const r = Math.max(0, d - th * 0.85) * 34;
    if (r > 0.2) {
      g.moveTo(hx + r, hy);
      g.arc(hx, hy, r, 0, TAU);
    }
  }
  g.fill();
  if (d > 0.6) {
    g.globalAlpha = (d - 0.6) / 0.4;
    g.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
    g.globalAlpha = 1;
  }
  g.globalCompositeOperation = 'source-over';
}

function deathMotes(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, k: number, d: number, alpha: number): void {
  const p = palette(look);
  const rnd = rng(hashStr(look.accent + look.head));
  const a = Math.sin(Math.min(1, d) * Math.PI) * Math.max(alpha, 0.4);
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const ox = (rnd() * 2 - 1) * 24;
    const oy = -10 - rnd() * 70;
    const sp = 0.5 + rnd();
    const px = x + (ox + Math.sin(d * 6 + i) * 4) * k;
    const py = y + (oy - d * 40 * sp) * k;
    const s = (1.2 + rnd() * 1.6) * k;
    ctx.fillStyle = rgba(i % 3 === 0 ? '#ffffff' : p.aLL, a * 0.9);
    ctx.beginPath();
    sparkle(ctx, px, py, s * 1.8, 0.25);
    ctx.fill();
  }
  ctx.restore();
}
