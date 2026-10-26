/**
 * Portraits (buste cadré sur le visage) pour l'interface React : boutique, fiches,
 * barre de banc… Rendu une seule fois par (look, taille, options) puis mis en cache.
 *
 * Le canvas fait exactement `size` × `size` pixels. Pour un affichage net sur écran
 * haute densité, demandez size × devicePixelRatio et fixez la taille CSS.
 */
import type { Look } from '../core/defs';
import { drawFigure } from './art/figure';
import { darken, lighten, lookKey, mix, palette, rgba } from './art/color';
import { clamp, rng, TAU } from './art/math';
import { rigFor } from './art/rig';
import { sparkle } from './art/paths';
import { drawGlow } from './art/paint';

export interface PortraitOpts {
  /** Couleur de fond (sinon dérivée de la couleur primaire). */
  bg?: string;
  /** Cadre doré ciselé (défaut : true). */
  frame?: boolean;
}

const canvasCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();
const MAX = 400;

function keyOf(look: Look, size: number, opts?: PortraitOpts): string {
  return lookKey(look) + '#' + Math.round(size) + '#' + (opts?.bg ?? '') + '#' + (opts?.frame === false ? 0 : 1);
}

/** Tête et ornements hauts : on recule un peu le cadrage. */
const TALL = new Set(['hat', 'antlers', 'halo', 'crown', 'horns', 'flame', 'tricorn', 'helm']);

export function portraitCanvas(look: Look, size: number, opts?: PortraitOpts): HTMLCanvasElement {
  const key = keyOf(look, size, opts);
  const hit = canvasCache.get(key);
  if (hit) return hit;
  const S = Math.max(8, Math.round(size));
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  if (g) paint(g, look, S, opts);
  if (canvasCache.size > MAX) canvasCache.clear();
  canvasCache.set(key, c);
  return c;
}

export function portraitDataUrl(look: Look, size: number, opts?: PortraitOpts): string {
  const key = keyOf(look, size, opts);
  const hit = urlCache.get(key);
  if (hit) return hit;
  const url = portraitCanvas(look, size, opts).toDataURL('image/png');
  if (urlCache.size > MAX) urlCache.clear();
  urlCache.set(key, url);
  return url;
}

// ---------------------------------------------------------------------------

function paint(g: CanvasRenderingContext2D, look: Look, S: number, opts?: PortraitOpts): void {
  const pal = palette(look);
  const framed = opts?.frame !== false;
  const inset = framed ? Math.max(2, S * 0.06) : 0;
  const rr = S * 0.12;
  g.save();
  // Zone intérieure arrondie
  g.beginPath();
  g.roundRect(inset, inset, S - inset * 2, S - inset * 2, Math.max(1, rr - inset * 0.6));
  g.clip();
  background(g, S, look, opts?.bg);

  // Cadrage sur la tête
  const rig = rigFor(look.body);
  const quadShift = rig.kind === 'quad' ? -6 : 0;
  const tall = TALL.has(look.head);
  const R = rig.headR;
  const k = (S * (tall ? 0.235 : 0.27)) / R;
  const hx = rig.headX + quadShift + (rig.kind === 'quad' ? R * 0.3 : 0);
  const hy = rig.headY - rig.hover;
  const cy = S * (tall ? 0.53 : 0.47);
  // Instant sans clignement des yeux
  let t = 0.6;
  for (const cand of [0.6, 1.4, 2.3, 3.1]) {
    if ((cand + (pal.seed % 97) * 0.13) % 4.2 >= 0.15) {
      t = cand;
      break;
    }
  }
  g.save();
  g.translate(S * 0.5 - hx * k, cy - hy * k);
  g.scale(k, k);
  const lod = k;
  const lw = clamp(0.85 + lod * 0.5, 1, 3) / lod;
  drawFigure(g, look, { anim: 'idle', animT: 0, time: t, aim: 0, lod, lw, sil: null });
  g.restore();

  // Vignettage bas + liseré lumineux
  const vg = g.createLinearGradient(0, S * 0.6, 0, S);
  vg.addColorStop(0, 'rgba(10,6,24,0)');
  vg.addColorStop(1, 'rgba(10,6,24,0.7)');
  g.fillStyle = vg;
  g.fillRect(0, 0, S, S);
  const rg = g.createRadialGradient(S / 2, S * 0.45, S * 0.35, S / 2, S * 0.5, S * 0.75);
  rg.addColorStop(0, 'rgba(10,6,24,0)');
  rg.addColorStop(1, 'rgba(10,6,24,0.55)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  g.restore();

  if (framed) frame(g, S, inset, rr, pal.a);
}

function background(g: CanvasRenderingContext2D, S: number, look: Look, bg?: string): void {
  const pal = palette(look);
  const base = bg ?? mix(darken(pal.p, 0.45), '#1c1546', 0.45);
  const gr = g.createRadialGradient(S * 0.5, S * 0.38, S * 0.05, S * 0.5, S * 0.5, S * 0.8);
  gr.addColorStop(0, lighten(base, 0.22));
  gr.addColorStop(0.55, base);
  gr.addColorStop(1, darken(base, 0.55));
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  // Anneaux d'orrery et étoiles
  g.save();
  g.strokeStyle = rgba(lighten(pal.a, 0.3), 0.16);
  g.lineWidth = Math.max(0.6, S * 0.006);
  g.beginPath();
  g.ellipse(S * 0.5, S * 0.42, S * 0.42, S * 0.16, -0.25, 0, TAU);
  g.moveTo(S * 0.5 + S * 0.32, S * 0.42);
  g.ellipse(S * 0.5, S * 0.42, S * 0.32, S * 0.32, 0, 0, TAU);
  g.stroke();
  const rnd = rng(pal.seed);
  g.fillStyle = 'rgba(255,248,225,0.7)';
  const n = Math.round(10 + S / 12);
  for (let i = 0; i < n; i++) {
    const x = rnd() * S;
    const y = rnd() * S * 0.8;
    const r = (0.3 + rnd() * 0.9) * Math.max(0.6, S / 160);
    g.globalAlpha = 0.25 + rnd() * 0.6;
    g.beginPath();
    if (r > 1.1) sparkle(g, x, y, r * 2.2, 0.22);
    else g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
  g.restore();
  drawGlow(g, S * 0.5, S * 0.45, S * 0.42, pal.a, 0.28);
}

function frame(g: CanvasRenderingContext2D, S: number, inset: number, rr: number, accent: string): void {
  const w = inset;
  g.save();
  // Bande dorée
  g.beginPath();
  g.roundRect(w * 0.5, w * 0.5, S - w, S - w, rr);
  const gg = g.createLinearGradient(0, 0, S, S);
  gg.addColorStop(0, '#fff0b8');
  gg.addColorStop(0.3, '#e2b45a');
  gg.addColorStop(0.6, '#9a6a2a');
  gg.addColorStop(1, '#f2cf7a');
  g.strokeStyle = gg;
  g.lineWidth = w;
  g.stroke();
  // Filets sombres intérieur / extérieur
  g.lineWidth = Math.max(0.8, S * 0.008);
  g.strokeStyle = 'rgba(20,11,34,0.9)';
  g.beginPath();
  g.roundRect(w, w, S - w * 2, S - w * 2, Math.max(1, rr - w * 0.6));
  g.stroke();
  g.beginPath();
  g.roundRect(g.lineWidth / 2, g.lineWidth / 2, S - g.lineWidth, S - g.lineWidth, rr + w * 0.4);
  g.stroke();
  // Ornements d'angle + gemme
  const orn = (x: number, y: number) => {
    const s = w * 1.15;
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s * 0.7, y);
    g.lineTo(x, y + s);
    g.lineTo(x - s * 0.7, y);
    g.closePath();
    g.fillStyle = '#ffe6a0';
    g.fill();
    g.lineWidth = Math.max(0.7, w * 0.22);
    g.strokeStyle = 'rgba(20,11,34,0.9)';
    g.stroke();
  };
  const o = w * 0.9;
  if (S >= 40) {
    orn(o + rr * 0.3, o + rr * 0.3);
    orn(S - o - rr * 0.3, o + rr * 0.3);
    orn(o + rr * 0.3, S - o - rr * 0.3);
    orn(S - o - rr * 0.3, S - o - rr * 0.3);
  }
  // Gemme de faction en haut
  if (S >= 48) {
    const gx = S / 2;
    const gy = w * 0.55;
    const r = w * 0.9;
    g.beginPath();
    g.ellipse(gx, gy, r * 1.25, r, 0, 0, TAU);
    g.fillStyle = '#e2b45a';
    g.fill();
    g.strokeStyle = 'rgba(20,11,34,0.9)';
    g.stroke();
    g.beginPath();
    g.ellipse(gx, gy, r * 0.75, r * 0.6, 0, 0, TAU);
    g.fillStyle = lighten(accent, 0.2);
    g.fill();
  }
  g.restore();
}
