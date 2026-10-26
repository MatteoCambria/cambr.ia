/**
 * Décor de l'arène : ciel indigo étoilé, constellations, Cœur-Horloge arrêté,
 * anneaux d'orrery lents où gravitent les huit Sphères, plateforme de pierre
 * flottante (cadran de laiton) et quai de la réserve. La grille et les unités
 * sont dessinées par-dessus par le moteur.
 *
 * Performance : tout le statique (ciel + plateforme) est pré-rendu dans un seul
 * canvas mis en cache par (w, h, échelle) ; chaque image ne redessine que les
 * éléments animés (scintillements, anneaux, sphères, runes, poussières, humeur).
 * Les cases hexagonales sont elles aussi pré-rendues par état.
 */
import { computeLayout, TILT } from './layout';
import { BENCH_SIZE } from '../config/balance';
import { darken, lighten, rgba } from './art/color';
import { TAU, rng } from './art/math';
import { hexPointy, sparkle } from './art/paths';
import { drawGlow } from './art/paint';

export type ArenaMood = 'prep' | 'combat' | 'final';

export interface HexTileState {
  owner: 0 | 1 | -1;
  highlight?: 'none' | 'hover' | 'valid' | 'invalid' | 'range' | 'zone';
  parity: number;
}

const SPHERE_COLS = ['#f0c85a', '#b9c8f0', '#d0864a', '#6fbf5a', '#3fb8b0', '#ff7a3a', '#e8c890', '#9a7aff'];
const MOOD_RUNE: Record<ArenaMood, string> = { prep: '#6fc8ff', combat: '#c58cff', final: '#ff6a4a' };

// ---------------------------------------------------------------------------
// Géométrie partagée (dérivée de la mise en page du plateau)

interface Geo {
  w: number;
  h: number;
  hexR: number;
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  ch: number;
  chT: number;
  T: number;
  plate: number[];
  bench: { x0: number; x1: number; y: number; hh: number; T: number };
}

let geoCache: Geo | null = null;

function geo(w: number, h: number): Geo {
  if (geoCache && geoCache.w === w && geoCache.h === h) return geoCache;
  const L = computeLayout(w, h);
  const R = L.hexR;
  const SQ3 = Math.sqrt(3);
  const worldW = SQ3 * 7.5;
  const worldH = 1.5 * 7 + 2;
  const left = L.originX - (SQ3 / 2) * R;
  const top = L.originY - R * TILT;
  const cx = left + (worldW * R) / 2;
  const cy = top + (worldH * R * TILT) / 2;
  const hw = (worldW / 2 + 0.6) * R;
  const hh = (worldH / 2 + 0.5) * R * TILT;
  const ch = 1.7 * R;
  const chT = ch * TILT;
  const plate = [
    cx - hw + ch, cy - hh,
    cx + hw - ch, cy - hh,
    cx + hw, cy - hh + chT,
    cx + hw, cy + hh - chT,
    cx + hw - ch, cy + hh,
    cx - hw + ch, cy + hh,
    cx - hw, cy + hh - chT,
    cx - hw, cy - hh + chT,
  ];
  const slotR = L.benchSlotR;
  const bench = {
    x0: L.benchX0 - L.benchStep * 0.62,
    x1: L.benchX0 + (BENCH_SIZE - 1) * L.benchStep + L.benchStep * 0.62,
    y: L.benchY,
    hh: slotR * TILT * 1.32,
    T: R * 0.2,
  };
  geoCache = { w, h, hexR: R, cx, cy, hw, hh, ch, chT, T: R * 0.34, plate, bench };
  return geoCache;
}

function platePath(g: CanvasPath, pts: readonly number[], dy = 0, inset = 0, cx = 0, cy = 0): void {
  for (let i = 0; i < pts.length; i += 2) {
    let x = pts[i];
    let y = pts[i + 1];
    if (inset) {
      x = cx + (x - cx) * (1 - inset);
      y = cy + (y - cy) * (1 - inset * 1.08);
    }
    if (i === 0) g.moveTo(x, y + dy);
    else g.lineTo(x, y + dy);
  }
  g.closePath();
}

// ---------------------------------------------------------------------------
// Couche statique

let staticCache: { key: string; c: HTMLCanvasElement; sc: number } | null = null;

function staticLayer(w: number, h: number, dev: number): { c: HTMLCanvasElement; sc: number } | null {
  if (typeof document === 'undefined') return null;
  // On plafonne la taille du cache (~4,2 Mpx) : le ciel n'a pas besoin de plus.
  let sc = dev;
  if (w * h * sc * sc > 4.2e6) sc = Math.sqrt(4.2e6 / (w * h));
  const key = w + 'x' + h + '@' + sc.toFixed(3);
  if (staticCache && staticCache.key === key) return staticCache;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * sc));
  c.height = Math.max(1, Math.round(h * sc));
  const g = c.getContext('2d');
  if (!g) return null;
  g.scale(sc, sc);
  const G = geo(w, h);
  paintSky(g, G);
  paintClock(g, G);
  paintPlate(g, G);
  paintBench(g, G);
  // Vignettage
  const vg = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(4,2,12,0)');
  vg.addColorStop(1, 'rgba(4,2,12,0.6)');
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  staticCache = { key, c, sc };
  return staticCache;
}

function paintSky(g: CanvasRenderingContext2D, G: Geo): void {
  const { w, h } = G;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#05051a');
  sky.addColorStop(0.5, '#110e34');
  sky.addColorStop(1, '#090820');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const rnd = rng(1337);
  const M = Math.min(w, h);
  // Nébuleuses
  const neb: [string, number][] = [
    ['#6a3fb0', 0.26],
    ['#1f7a9a', 0.18],
    ['#9a3f8a', 0.14],
    ['#3f4fb0', 0.2],
    ['#b0803a', 0.07],
    ['#5a2f9a', 0.2],
    ['#1f6a8a', 0.14],
  ];
  for (const [col, a] of neb) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = M * (0.25 + rnd() * 0.35);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col, a));
    gr.addColorStop(0.5, rgba(col, a * 0.4));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Voie lactée diagonale
  for (let i = 0; i < 1400; i++) {
    const u = rnd();
    const spread = (rnd() + rnd() + rnd() - 1.5) * M * 0.12;
    const x = u * w + spread * 0.5;
    const y = h - u * h * 1.05 + spread;
    g.fillStyle = `rgba(230,225,255,${(0.08 + rnd() * 0.3).toFixed(2)})`;
    g.fillRect(x, y, 0.8 + rnd() * 0.6, 0.8 + rnd() * 0.6);
  }
  // Étoiles
  for (let i = 0; i < 650; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 0.35 + rnd() * rnd() * 1.3;
    const t = rnd();
    g.fillStyle = t < 0.15 ? `rgba(190,210,255,${0.4 + rnd() * 0.5})` : t < 0.3 ? `rgba(255,230,190,${0.4 + rnd() * 0.5})` : `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 2.5 + rnd() * 4;
    drawGlow(g, x, y, r * 3, '#bfd0ff', 0.35);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    sparkle(g, x, y, r, 0.15);
    g.fill();
  }
  // Constellations (de préférence dans les marges visibles)
  g.lineWidth = 1;
  for (let k = 0; k < 9; k++) {
    let x = rnd() < 0.5 ? rnd() * w * 0.16 : w - rnd() * w * 0.16;
    let y = h * (0.08 + rnd() * 0.84);
    if (k < 3) {
      x = w * (0.2 + rnd() * 0.6);
      y = h * (0.02 + rnd() * 0.06);
    }
    const pts: number[] = [x, y];
    const n = 4 + Math.floor(rnd() * 3);
    for (let i = 1; i < n; i++) {
      x += (rnd() - 0.5) * M * 0.12;
      y += (rnd() - 0.5) * M * 0.12;
      pts.push(x, y);
    }
    g.strokeStyle = 'rgba(232,196,106,0.22)';
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke();
    for (let i = 0; i < pts.length; i += 2) {
      g.fillStyle = 'rgba(255,240,200,0.85)';
      g.beginPath();
      g.arc(pts[i], pts[i + 1], 1.6, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(232,196,106,0.35)';
      g.beginPath();
      g.arc(pts[i], pts[i + 1], 4, 0, TAU);
      g.stroke();
    }
  }
}

function paintClock(g: CanvasRenderingContext2D, G: Geo): void {
  // Le Cœur-Horloge : cadran géant arrêté, visible autour de la plateforme.
  const { cx, cy, hw } = G;
  const R = hw * 1.16;
  g.save();
  g.translate(cx, cy);
  const ring = (r: number, wdt: number, a: number) => {
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.lineWidth = wdt;
    g.strokeStyle = `rgba(232,196,106,${a})`;
    g.stroke();
  };
  const glowRing = g.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.12);
  glowRing.addColorStop(0, 'rgba(232,196,106,0)');
  glowRing.addColorStop(0.5, 'rgba(232,196,106,0.06)');
  glowRing.addColorStop(1, 'rgba(232,196,106,0)');
  g.fillStyle = glowRing;
  g.beginPath();
  g.arc(0, 0, R * 1.12, 0, TAU);
  g.fill();
  ring(R, 3, 0.32);
  ring(R * 1.035, 1, 0.22);
  ring(R * 0.94, 1.4, 0.2);
  ring(R * 1.09, 1, 0.12);
  // Graduations
  for (let i = 0; i < 120; i++) {
    const a = (i * TAU) / 120;
    const major = i % 10 === 0;
    const r0 = major ? R * 0.945 : i % 2 === 0 ? R * 0.965 : R * 0.98;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * R * 0.998, Math.sin(a) * R * 0.998);
    g.lineWidth = major ? 3 : 1;
    g.strokeStyle = `rgba(232,196,106,${major ? 0.45 : 0.22})`;
    g.stroke();
  }
  // Index des heures (losanges ciselés) + filigranes
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12 - Math.PI / 2;
    const r = R * 1.065;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2);
    g.beginPath();
    g.moveTo(0, -11);
    g.lineTo(6, 0);
    g.lineTo(0, 11);
    g.lineTo(-6, 0);
    g.closePath();
    g.fillStyle = 'rgba(232,196,106,0.35)';
    g.fill();
    g.strokeStyle = 'rgba(255,240,200,0.4)';
    g.lineWidth = 1;
    g.stroke();
    g.beginPath();
    g.arc(-22, 4, 10, -Math.PI * 0.9, -Math.PI * 0.2);
    g.moveTo(22 + 10 * Math.cos(-Math.PI * 0.8), 4 + 10 * Math.sin(-Math.PI * 0.8));
    g.arc(22, 4, 10, -Math.PI * 0.8, -Math.PI * 0.1);
    g.strokeStyle = 'rgba(232,196,106,0.25)';
    g.stroke();
    g.restore();
  }
  // Aiguilles figées (11 h 58)
  const hand = (ang: number, len: number, wdt: number) => {
    g.save();
    g.rotate(ang);
    g.beginPath();
    g.moveTo(-wdt, 0);
    g.lineTo(0, -len);
    g.lineTo(wdt, 0);
    g.lineTo(0, len * 0.12);
    g.closePath();
    g.fillStyle = 'rgba(232,196,106,0.2)';
    g.fill();
    g.strokeStyle = 'rgba(255,236,190,0.35)';
    g.lineWidth = 1.2;
    g.stroke();
    g.beginPath();
    g.arc(0, -len * 0.93, wdt * 1.6, 0, TAU);
    g.stroke();
    g.restore();
  };
  hand(-0.21, R * 1.02, 9);
  hand(-0.52, R * 0.98, 13);
  g.restore();
}

function paintPlate(g: CanvasRenderingContext2D, G: Geo): void {
  const { cx, cy, hw, hh, T, plate, hexR } = G;
  // Dessous rocheux + cristaux suspendus (visibles sur les flancs)
  const rnd = rng(77);
  g.save();
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = cx + side * (hw * (0.55 + rnd() * 0.42));
    const y0 = cy + hh * 0.6 + T;
    const len = hexR * (0.6 + rnd() * 1.4);
    const wdt = hexR * (0.18 + rnd() * 0.25);
    g.beginPath();
    g.moveTo(x - wdt, y0 - hexR * 0.4);
    g.lineTo(x + wdt, y0 - hexR * 0.4);
    g.lineTo(x + wdt * 0.2, y0 + len);
    g.closePath();
    g.fillStyle = '#120e26';
    g.fill();
    g.strokeStyle = 'rgba(20,11,34,0.9)';
    g.stroke();
    if (i % 3 === 0) {
      const crx = x + wdt * 0.1;
      const cry = y0 + len * 0.55;
      drawGlow(g, crx, cry, hexR * 0.5, '#5fd8e8', 0.35);
      g.beginPath();
      g.moveTo(crx, cry - hexR * 0.2);
      g.lineTo(crx + hexR * 0.08, cry);
      g.lineTo(crx, cry + hexR * 0.22);
      g.lineTo(crx - hexR * 0.08, cry);
      g.closePath();
      g.fillStyle = '#9ff0f8';
      g.fill();
    }
  }
  // Tranche (épaisseur) de la plateforme
  g.beginPath();
  const p = plate;
  g.moveTo(p[4], p[5]);
  g.lineTo(p[6], p[7]);
  g.lineTo(p[8], p[9]);
  g.lineTo(p[10], p[11]);
  g.lineTo(p[12], p[13]);
  g.lineTo(p[14], p[15]);
  g.lineTo(p[14], p[15] + T);
  g.lineTo(p[12], p[13] + T);
  g.lineTo(p[10], p[11] + T);
  g.lineTo(p[8], p[9] + T);
  g.lineTo(p[6], p[7] + T);
  g.lineTo(p[4], p[5] + T);
  g.closePath();
  const side = g.createLinearGradient(0, cy, 0, cy + hh + T);
  side.addColorStop(0, '#2a2246');
  side.addColorStop(1, '#0e0b1e');
  g.fillStyle = side;
  g.fill();
  g.strokeStyle = 'rgba(20,11,34,0.95)';
  g.lineWidth = 2;
  g.stroke();
  // Liseré de laiton sur la tranche
  g.beginPath();
  g.moveTo(p[6], p[7] + T * 0.35);
  g.lineTo(p[8], p[9] + T * 0.35);
  g.lineTo(p[10], p[11] + T * 0.35);
  g.lineTo(p[12], p[13] + T * 0.35);
  g.lineTo(p[14], p[15] + T * 0.35);
  g.strokeStyle = 'rgba(232,196,106,0.55)';
  g.lineWidth = Math.max(1, hexR * 0.03);
  g.stroke();
  // Dessus
  g.beginPath();
  platePath(g, plate);
  const top = g.createRadialGradient(cx, cy - hh * 0.2, hw * 0.1, cx, cy, hw * 1.05);
  top.addColorStop(0, '#2e2a5c');
  top.addColorStop(0.6, '#221e4a');
  top.addColorStop(1, '#17132f');
  g.fillStyle = top;
  g.fill();
  g.save();
  g.clip();
  // Dallage : anneaux concentriques gravés + rayons
  const E = (r: number) => {
    g.beginPath();
    g.ellipse(cx, cy, r, r * TILT, 0, 0, TAU);
  };
  const Rm = hw;
  for (const k of [0.22, 0.42, 0.62, 0.82, 1.02]) {
    E(Rm * k);
    g.strokeStyle = 'rgba(8,5,20,0.55)';
    g.lineWidth = 2;
    g.stroke();
    g.save();
    g.translate(0, 1.5);
    E(Rm * k);
    g.strokeStyle = 'rgba(255,240,210,0.05)';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }
  for (let i = 0; i < 24; i++) {
    const a = (i * TAU) / 24;
    const r0 = Rm * (i % 2 === 0 ? 0.22 : 0.42);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * TILT);
    g.lineTo(cx + Math.cos(a) * Rm * 1.3, cy + Math.sin(a) * Rm * 1.3 * TILT);
    g.strokeStyle = 'rgba(8,5,20,0.4)';
    g.lineWidth = 1.5;
    g.stroke();
  }
  // Fissures et taches de pierre
  for (let i = 0; i < 40; i++) {
    const x = cx + (rnd() * 2 - 1) * hw;
    const y = cy + (rnd() * 2 - 1) * hh;
    const r = hexR * (0.3 + rnd() * 1.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = rnd() < 0.5 ? 'rgba(80,70,140,0.10)' : 'rgba(5,3,14,0.14)';
    gr.addColorStop(0, c);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r * TILT, r * 2, r * 2 * TILT);
  }
  g.strokeStyle = 'rgba(6,4,16,0.45)';
  g.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    let x = cx + (rnd() * 2 - 1) * hw * 0.95;
    let y = cy + (rnd() * 2 - 1) * hh * 0.95;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * hexR * 0.9;
      y += (rnd() - 0.5) * hexR * 0.5;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  // Cadran de laiton incrusté près du bord
  const dial = Math.min(hw * 0.985, (hh / TILT) * 1.02);
  g.save();
  g.beginPath();
  platePath(g, plate, 0, 0.012, cx, cy);
  g.clip();
  E(dial);
  g.strokeStyle = 'rgba(8,5,20,0.7)';
  g.lineWidth = hexR * 0.09;
  g.stroke();
  E(dial);
  const brass = g.createLinearGradient(0, cy - hh, 0, cy + hh);
  brass.addColorStop(0, '#f6dc8a');
  brass.addColorStop(0.5, '#b8862e');
  brass.addColorStop(1, '#e8c25c');
  g.strokeStyle = brass;
  g.lineWidth = hexR * 0.045;
  g.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i * TAU) / 60;
    const major = i % 5 === 0;
    const r0 = dial * (major ? 0.94 : 0.965);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * TILT);
    g.lineTo(cx + Math.cos(a) * dial * 0.985, cy + Math.sin(a) * dial * 0.985 * TILT);
    g.strokeStyle = major ? 'rgba(246,220,138,0.7)' : 'rgba(232,196,106,0.35)';
    g.lineWidth = major ? Math.max(1.5, hexR * 0.03) : 1;
    g.stroke();
  }
  g.restore();
  // Bord de la plateforme : arête claire + filet doré
  g.beginPath();
  platePath(g, plate);
  g.strokeStyle = 'rgba(20,11,34,0.95)';
  g.lineWidth = 3;
  g.stroke();
  g.beginPath();
  platePath(g, plate, 0, 0.006, cx, cy);
  g.strokeStyle = 'rgba(246,220,138,0.55)';
  g.lineWidth = Math.max(1.2, hexR * 0.022);
  g.stroke();
  // Rivets de laiton aux angles
  for (let i = 0; i < plate.length; i += 2) {
    const x = cx + (plate[i] - cx) * 0.975;
    const y = cy + (plate[i + 1] - cy) * 0.965;
    const r = Math.max(2.5, hexR * 0.07);
    const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r);
    rg.addColorStop(0, '#fff2c0');
    rg.addColorStop(1, '#8a6224');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(20,11,34,0.9)';
    g.lineWidth = 1;
    g.stroke();
  }
}

function paintBench(g: CanvasRenderingContext2D, G: Geo): void {
  const b = G.bench;
  const R = G.hexR;
  const x0 = b.x0;
  const x1 = b.x1;
  const y0 = b.y - b.hh;
  const y1 = b.y + b.hh;
  const rr = b.hh * 0.9;
  // Tranche
  g.beginPath();
  g.roundRect(x0, y0 + b.T, x1 - x0, y1 - y0, rr);
  g.fillStyle = '#0f0b20';
  g.fill();
  g.strokeStyle = 'rgba(20,11,34,0.95)';
  g.lineWidth = 2;
  g.stroke();
  // Dessus
  g.beginPath();
  g.roundRect(x0, y0, x1 - x0, y1 - y0, rr);
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, '#2b2552');
  gr.addColorStop(1, '#1a1636');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(20,11,34,0.95)';
  g.lineWidth = 2.5;
  g.stroke();
  g.beginPath();
  g.roundRect(x0 + 3, y0 + 3, x1 - x0 - 6, y1 - y0 - 6, rr * 0.85);
  g.strokeStyle = 'rgba(232,196,106,0.5)';
  g.lineWidth = Math.max(1, R * 0.02);
  g.stroke();
  // Engrenages décoratifs aux extrémités
  for (const x of [x0 + rr * 0.15, x1 - rr * 0.15]) {
    const gy = b.y + b.T * 0.5;
    const ro = b.hh * 0.75;
    g.save();
    g.translate(x, gy);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * TAU) / 10;
      g.lineTo(Math.cos(a - 0.12) * ro * 0.78, Math.sin(a - 0.12) * ro * 0.78);
      g.lineTo(Math.cos(a - 0.08) * ro, Math.sin(a - 0.08) * ro);
      g.lineTo(Math.cos(a + 0.08) * ro, Math.sin(a + 0.08) * ro);
      g.lineTo(Math.cos(a + 0.12) * ro * 0.78, Math.sin(a + 0.12) * ro * 0.78);
    }
    g.closePath();
    g.moveTo(ro * 0.3, 0);
    g.arc(0, 0, ro * 0.3, 0, TAU, true);
    const gg = g.createLinearGradient(-ro, -ro, ro, ro);
    gg.addColorStop(0, '#f6dc8a');
    gg.addColorStop(1, '#7a5420');
    g.fillStyle = gg;
    g.fill();
    g.strokeStyle = 'rgba(20,11,34,0.9)';
    g.lineWidth = 1.2;
    g.stroke();
    g.restore();
  }
}

// ---------------------------------------------------------------------------
// Sphères pré-rendues

const sphereCache = new Map<string, HTMLCanvasElement>();

function sphereSprite(col: string): HTMLCanvasElement | null {
  let c = sphereCache.get(col);
  if (c) return c;
  if (typeof document === 'undefined') return null;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const gr = g.createRadialGradient(24, 22, 2, 32, 32, 26);
  gr.addColorStop(0, lighten(col, 0.7));
  gr.addColorStop(0.45, col);
  gr.addColorStop(1, darken(col, 0.65));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(32, 32, 26, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(20,11,34,0.9)';
  g.lineWidth = 2;
  g.stroke();
  // Liseré lumineux
  g.beginPath();
  g.arc(32, 32, 24, Math.PI * 0.15, Math.PI * 0.75);
  g.strokeStyle = rgba(lighten(col, 0.6), 0.7);
  g.lineWidth = 2;
  g.stroke();
  // Bandes
  g.save();
  g.beginPath();
  g.arc(32, 32, 26, 0, TAU);
  g.clip();
  g.strokeStyle = rgba(darken(col, 0.4), 0.45);
  g.lineWidth = 3;
  for (const dy of [-8, 4]) {
    g.beginPath();
    g.ellipse(32, 32 + dy, 30, 6, -0.2, 0, TAU);
    g.stroke();
  }
  g.restore();
  sphereCache.set(col, c);
  return c;
}

// ---------------------------------------------------------------------------

function devScale(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

let outsideClip: { key: string; p: Path2D } | null = null;

export function drawArenaBackground(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, mood: ArenaMood = 'prep'): void {
  const dev = devScale(ctx);
  const st = staticLayer(w, h, dev);
  const G = geo(w, h);
  if (st) ctx.drawImage(st.c, 0, 0, w, h);
  else {
    ctx.fillStyle = '#0d0b26';
    ctx.fillRect(0, 0, w, h);
  }

  // Zone « hors plateforme » pour les éléments célestes animés.
  const ck = w + 'x' + h;
  if (!outsideClip || outsideClip.key !== ck) {
    const p = new Path2D();
    p.rect(0, 0, w, h);
    platePath(p, G.plate, 0);
    p.rect(G.bench.x0, G.bench.y - G.bench.hh, G.bench.x1 - G.bench.x0, G.bench.hh * 2 + G.bench.T);
    outsideClip = { key: ck, p };
  }
  const rnd = rng(4242);
  ctx.save();
  ctx.clip(outsideClip.p, 'evenodd');

  // Scintillement
  for (let i = 0; i < 80; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const ph = rnd() * TAU;
    const sp = 0.6 + rnd() * 2.2;
    const a = 0.5 + 0.5 * Math.sin(time * sp + ph);
    if (a < 0.25) continue;
    const r = 0.6 + rnd() * 1.6;
    ctx.fillStyle = `rgba(255,252,240,${(a * 0.9).toFixed(3)})`;
    ctx.beginPath();
    if (r > 1.6) sparkle(ctx, x, y, r * 2.2 * a, 0.18);
    else ctx.arc(x, y, r * a, 0, TAU);
    ctx.fill();
  }

  // Anneaux d'orrery et Sphères
  const rings = [1.08, 1.24, 1.42];
  const speed = mood === 'final' ? 1.8 : mood === 'combat' ? 1.3 : 1;
  ctx.lineWidth = 1.2;
  rings.forEach((k, i) => {
    const rx = G.hw * k;
    const ry = rx * 0.36;
    const rot = -0.08 + i * 0.07;
    ctx.beginPath();
    ctx.ellipse(G.cx, G.cy, rx, ry, rot, 0, TAU);
    ctx.strokeStyle = 'rgba(232,196,106,0.16)';
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(G.cx, G.cy, rx, ry, rot, 0, TAU);
    ctx.setLineDash([2, 16]);
    ctx.lineDashOffset = -time * (14 + i * 6) * speed;
    ctx.strokeStyle = 'rgba(246,220,138,0.45)';
    ctx.stroke();
  });
  ctx.setLineDash([]);
  for (let i = 0; i < 8; i++) {
    const ri = i % 3;
    const k = rings[ri];
    const rx = G.hw * k;
    const ry = rx * 0.36;
    const rot = -0.08 + ri * 0.07;
    const a = i * 0.785 + time * (0.035 + ri * 0.012) * speed * (i % 2 ? 1 : -1) + ri;
    const ex = Math.cos(a) * rx;
    const ey = Math.sin(a) * ry;
    const x = G.cx + ex * Math.cos(rot) - ey * Math.sin(rot);
    const y = G.cy + ex * Math.sin(rot) + ey * Math.cos(rot);
    const depth = Math.sin(a);
    const size = G.hexR * (0.22 + 0.06 * depth + (i === 7 ? 0.08 : 0));
    const spr = sphereSprite(SPHERE_COLS[i]);
    drawGlow(ctx, x, y, size * 2.6, SPHERE_COLS[i], 0.35);
    if (spr) ctx.drawImage(spr, x - size, y - size, size * 2, size * 2);
  }
  ctx.restore();

  // Runes du cadran (sur la plateforme)
  const runeCol = MOOD_RUNE[mood];
  const dial = Math.min(G.hw * 0.985, (G.hh / TILT) * 1.02) * 0.9;
  const pulse = 0.5 + 0.5 * Math.sin(time * (mood === 'final' ? 3 : 1.4));
  ctx.save();
  ctx.beginPath();
  platePath(ctx, G.plate, 0, 0.015, G.cx, G.cy);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.ellipse(G.cx, G.cy, dial, dial * TILT, 0, 0, TAU);
  ctx.strokeStyle = rgba(runeCol, 0.1 + 0.1 * pulse);
  ctx.lineWidth = G.hexR * 0.08;
  ctx.stroke();
  ctx.strokeStyle = rgba(lighten(runeCol, 0.4), 0.25 + 0.2 * pulse);
  ctx.lineWidth = Math.max(1, G.hexR * 0.015);
  ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16 + time * 0.05;
    const x = G.cx + Math.cos(a) * dial;
    const y = G.cy + Math.sin(a) * dial * TILT;
    ctx.fillStyle = rgba(lighten(runeCol, 0.5), 0.35 + 0.35 * Math.sin(time * 2 + i));
    ctx.beginPath();
    sparkle(ctx, x, y, G.hexR * 0.09, 0.25);
    ctx.fill();
  }
  ctx.restore();

  // Poussières dorées qui s'élèvent du bord de la plateforme
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const nM = 28;
  for (let i = 0; i < nM; i++) {
    const u = (time * (0.05 + (i % 5) * 0.012) + i / nM) % 1;
    const a = (i / nM) * TAU + i * 1.7;
    const bx = G.cx + Math.cos(a) * G.hw * 0.98;
    const by = G.cy + Math.sin(a) * G.hh * 0.98;
    const x = bx + Math.sin(time * 0.7 + i) * G.hexR * 0.25;
    const y = by - u * G.hexR * 2.2;
    const al = Math.sin(u * Math.PI) * 0.7;
    ctx.fillStyle = rgba(mood === 'final' ? '#ff9a5a' : '#ffe2a0', al);
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3) * 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Ambiance
  if (mood !== 'prep') moodOverlay(ctx, G, time, mood);
}

let moodGrad: { key: string; g: CanvasGradient } | null = null;

function moodOverlay(ctx: CanvasRenderingContext2D, G: Geo, time: number, mood: ArenaMood): void {
  const { w, h } = G;
  const key = w + 'x' + h + mood;
  if (!moodGrad || moodGrad.key !== key) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.72);
    if (mood === 'final') {
      g.addColorStop(0, 'rgba(120,20,30,0)');
      g.addColorStop(1, 'rgba(150,30,30,0.42)');
    } else {
      g.addColorStop(0, 'rgba(80,40,140,0)');
      g.addColorStop(1, 'rgba(90,40,150,0.22)');
    }
    moodGrad = { key, g };
  }
  ctx.save();
  ctx.globalAlpha = mood === 'final' ? 0.75 + 0.25 * Math.sin(time * 1.6) : 1;
  ctx.fillStyle = moodGrad.g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  if (mood === 'final') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 36; i++) {
      const u = (time * (0.04 + (i % 7) * 0.01) + i * 0.137) % 1;
      const x = ((i * 0.618 * w) % w) + Math.sin(time + i) * 20;
      const y = h - u * h * 1.1;
      const al = Math.sin(u * Math.PI) * 0.8;
      ctx.fillStyle = rgba(i % 3 ? '#ff8a3a' : '#ffd27a', al);
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + (i % 3) * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Cases hexagonales

const tileCache = new Map<string, HTMLCanvasElement>();

const HL: Record<string, { fill: string; edge: string; a: number } | null> = {
  none: null,
  hover: { fill: '#ffe2a0', edge: '#ffefc0', a: 0.2 },
  valid: { fill: '#5af0b0', edge: '#8ff8cc', a: 0.16 },
  invalid: { fill: '#ff5a50', edge: '#ff8a7a', a: 0.22 },
  range: { fill: '#ffbe5a', edge: '#ffd08a', a: 0.13 },
  zone: { fill: '#b47cff', edge: '#d2b0ff', a: 0.2 },
};

export function drawHexTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, state: HexTileState): void {
  if (r <= 1) return;
  const dev = devScale(ctx);
  const hl = state.highlight ?? 'none';
  const rPx = Math.round(r * dev * 2) / 2;
  const key = rPx + '|' + state.owner + '|' + hl + '|' + (state.parity & 1);
  let c = tileCache.get(key);
  if (!c) {
    c = renderTile(rPx, state.owner, hl, state.parity & 1);
    if (tileCache.size > 400) tileCache.clear();
    tileCache.set(key, c);
  }
  const pad = c.width / 2 / dev;
  ctx.drawImage(c, cx - pad, cy - pad, pad * 2, pad * 2);
}

function renderTile(r: number, owner: number, hl: string, parity: number): HTMLCanvasElement {
  const pad = Math.ceil(r * 0.12) + 3;
  const S = Math.ceil(r * 2 + pad * 2);
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  if (!g) return c;
  const x = S / 2;
  const y = S / 2;
  const base = owner === 0 ? '#25305e' : owner === 1 ? '#45233a' : '#2a2650';
  const col = parity ? lighten(base, 0.05) : base;
  // Joint sombre
  g.beginPath();
  hexPointy(g, x, y, r);
  g.fillStyle = 'rgba(8,5,20,0.55)';
  g.fill();
  // Dalle
  const ri = r * 0.94;
  g.beginPath();
  hexPointy(g, x, y, ri);
  const gr = g.createLinearGradient(0, y - ri, 0, y + ri);
  gr.addColorStop(0, rgba(lighten(col, 0.12), 0.86));
  gr.addColorStop(0.6, rgba(col, 0.8));
  gr.addColorStop(1, rgba(darken(col, 0.25), 0.86));
  g.fillStyle = gr;
  g.fill();
  // Biseau : arêtes hautes claires, basses sombres
  const lw = Math.max(1, r * 0.035);
  const corners: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    corners.push([x + Math.cos(a) * ri * 0.93, y + Math.sin(a) * ri * 0.93]);
  }
  g.lineWidth = lw * 1.3;
  g.lineCap = 'round';
  const edge = (i: number, color: string) => {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 6];
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.strokeStyle = color;
    g.stroke();
  };
  edge(4, 'rgba(255,240,210,0.13)');
  edge(5, 'rgba(255,240,210,0.16)');
  edge(3, 'rgba(255,240,210,0.08)');
  edge(1, 'rgba(4,2,12,0.35)');
  edge(2, 'rgba(4,2,12,0.3)');
  edge(0, 'rgba(4,2,12,0.18)');
  // Motif gravé central discret (petit cadran)
  g.beginPath();
  g.arc(x, y, ri * 0.22, 0, TAU);
  g.strokeStyle = 'rgba(232,196,106,0.07)';
  g.lineWidth = Math.max(1, r * 0.02);
  g.stroke();
  // Filet doré
  g.beginPath();
  hexPointy(g, x, y, ri);
  g.strokeStyle = owner === 1 ? 'rgba(220,140,110,0.4)' : 'rgba(232,196,106,0.38)';
  g.lineWidth = Math.max(1, r * 0.025);
  g.stroke();
  // Surbrillance
  const H = HL[hl];
  if (H) {
    g.beginPath();
    hexPointy(g, x, y, ri);
    const hg = g.createRadialGradient(x, y, ri * 0.2, x, y, ri);
    hg.addColorStop(0, rgba(H.fill, H.a * 0.6));
    hg.addColorStop(1, rgba(H.fill, H.a * 1.6));
    g.fillStyle = hg;
    g.fill();
    g.beginPath();
    hexPointy(g, x, y, ri * 0.97);
    g.strokeStyle = rgba(H.edge, 0.35);
    g.lineWidth = Math.max(2, r * 0.1);
    g.stroke();
    g.strokeStyle = rgba(H.edge, 0.95);
    g.lineWidth = Math.max(1.2, r * 0.035);
    g.stroke();
    if (hl === 'invalid') {
      g.save();
      g.beginPath();
      hexPointy(g, x, y, ri * 0.9);
      g.clip();
      g.strokeStyle = rgba(H.edge, 0.28);
      g.lineWidth = Math.max(1, r * 0.04);
      for (let k = -4; k <= 4; k++) {
        g.beginPath();
        g.moveTo(x + k * r * 0.28 - r, y + r);
        g.lineTo(x + k * r * 0.28 + r, y - r);
        g.stroke();
      }
      g.restore();
    }
  }
  return c;
}

/** Libère les caches (changement de taille d'écran par exemple). */
export function clearArenaCaches(): void {
  staticCache = null;
  geoCache = null;
  outsideClip = null;
  moodGrad = null;
  tileCache.clear();
}

