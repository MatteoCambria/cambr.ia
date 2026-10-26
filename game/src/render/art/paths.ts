/**
 * Construction de tracés (sans beginPath : on peut composer plusieurs formes
 * dans un même chemin). Toutes les coordonnées sont dans le repère courant.
 */
import { TAU } from './math';

type C = CanvasPath;

export function ellipse(ctx: C, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

export function circle(ctx: C, x: number, y: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, Math.max(0.01, r), 0, TAU);
}

export function roundRect(ctx: C, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function poly(ctx: C, pts: readonly number[]): void {
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

/** Étoile à n branches. */
export function star(ctx: C, x: number, y: number, n: number, ro: number, ri: number, rot = -Math.PI / 2): void {
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = rot + (i * Math.PI) / n;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Étincelle à 4 branches incurvées. */
export function sparkle(ctx: C, x: number, y: number, r: number, thin = 0.22): void {
  const t = r * thin;
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + t, y - t, x + r, y);
  ctx.quadraticCurveTo(x + t, y + t, x, y + r);
  ctx.quadraticCurveTo(x - t, y + t, x - r, y);
  ctx.quadraticCurveTo(x - t, y - t, x, y - r);
  ctx.closePath();
}

/** Engrenage : n dents, rayon extérieur ro, rayon de pied ri. */
export function gear(ctx: C, x: number, y: number, n: number, ro: number, ri: number, rot = 0): void {
  const step = TAU / n;
  for (let i = 0; i < n; i++) {
    const a = rot + i * step;
    const a0 = a - step * 0.5;
    const a1 = a - step * 0.22;
    const a2 = a + step * 0.22;
    const a3 = a + step * 0.5;
    const pts: [number, number][] = [
      [Math.cos(a0) * ri, Math.sin(a0) * ri],
      [Math.cos(a1 - step * 0.04) * ri, Math.sin(a1 - step * 0.04) * ri],
      [Math.cos(a1) * ro, Math.sin(a1) * ro],
      [Math.cos(a2) * ro, Math.sin(a2) * ro],
      [Math.cos(a2 + step * 0.04) * ri, Math.sin(a2 + step * 0.04) * ri],
      [Math.cos(a3) * ri, Math.sin(a3) * ri],
    ];
    for (let j = 0; j < pts.length; j++) {
      const px = x + pts[j][0];
      const py = y + pts[j][1];
      if (i === 0 && j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

/** Croissant de lune : disque r privé d'un disque décalé (dx, dy) de rayon r2. */
export function crescent(ctx: C, x: number, y: number, r: number, dx: number, dy: number, r2: number): void {
  // Intersections des deux cercles.
  const d = Math.hypot(dx, dy);
  if (d <= 0.001 || d >= r + r2) {
    circle(ctx, x, y, r);
    return;
  }
  const a = (r * r - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const mx = x + ux * a;
  const my = y + uy * a;
  const p1x = mx - uy * h;
  const p1y = my + ux * h;
  const p2x = mx + uy * h;
  const p2y = my - ux * h;
  const a1 = Math.atan2(p1y - y, p1x - x);
  const a2 = Math.atan2(p2y - y, p2x - x);
  const b1 = Math.atan2(p1y - (y + dy), p1x - (x + dx));
  const b2 = Math.atan2(p2y - (y + dy), p2x - (x + dx));
  ctx.moveTo(p1x, p1y);
  ctx.arc(x, y, r, a1, a2, false);
  ctx.arc(x + dx, y + dy, r2, b2, b1, true);
  ctx.closePath();
}

/**
 * Forme effilée le long d'une ligne médiane (queue, tentacule, cape…).
 * pts = [x0,y0,x1,y1,…], w = demi-largeurs par point. Extrémités arrondies si w > 0.
 */
export function taper(ctx: C, pts: readonly number[], w: readonly number[]): void {
  const n = pts.length / 2;
  if (n < 2) return;
  const lx: number[] = [];
  const ly: number[] = [];
  const rx: number[] = [];
  const ry: number[] = [];
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(n - 1, i + 1);
    let tx = pts[i1 * 2] - pts[i0 * 2];
    let ty = pts[i1 * 2 + 1] - pts[i0 * 2 + 1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const hw = w[Math.min(i, w.length - 1)];
    lx.push(pts[i * 2] - ty * hw);
    ly.push(pts[i * 2 + 1] + tx * hw);
    rx.push(pts[i * 2] + ty * hw);
    ry.push(pts[i * 2 + 1] - tx * hw);
  }
  ctx.moveTo(lx[0], ly[0]);
  for (let i = 1; i < n; i++) {
    const mx = (lx[i - 1] + lx[i]) / 2;
    const my = (ly[i - 1] + ly[i]) / 2;
    ctx.quadraticCurveTo(lx[i - 1], ly[i - 1], mx, my);
  }
  ctx.lineTo(lx[n - 1], ly[n - 1]);
  // Bout arrondi.
  const we = w[Math.min(n - 1, w.length - 1)];
  if (we > 0.3) {
    const ex = pts[(n - 1) * 2];
    const ey = pts[(n - 1) * 2 + 1];
    ctx.quadraticCurveTo(ex + (ex - pts[(n - 2) * 2]) * 0.6, ey + (ey - pts[(n - 2) * 2 + 1]) * 0.6, rx[n - 1], ry[n - 1]);
  } else {
    ctx.lineTo(rx[n - 1], ry[n - 1]);
  }
  for (let i = n - 2; i >= 0; i--) {
    const mx = (rx[i + 1] + rx[i]) / 2;
    const my = (ry[i + 1] + ry[i]) / 2;
    ctx.quadraticCurveTo(rx[i + 1], ry[i + 1], mx, my);
  }
  ctx.lineTo(rx[0], ry[0]);
  const ws = w[0];
  if (ws > 0.3) {
    const sx = pts[0];
    const sy = pts[1];
    ctx.quadraticCurveTo(sx - (pts[2] - sx) * 0.6, sy - (pts[3] - sy) * 0.6, lx[0], ly[0]);
  }
  ctx.closePath();
}

/** Membre (capsule effilée) d'un point à un autre. */
export function limb(ctx: C, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 0.001;
  const nx = -dy / l;
  const ny = dx / l;
  const a = Math.atan2(dy, dx);
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.arc(x1, y1, w1, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.arc(x0, y0, w0, a - Math.PI / 2, a + Math.PI / 2, true);
  ctx.closePath();
}

/** Hexagone « pointe en haut ». */
export function hexPointy(ctx: C, x: number, y: number, r: number): void {
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
