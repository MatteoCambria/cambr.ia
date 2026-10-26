/**
 * Géométrie du plateau hexagonal (hexagones « pointe en haut », décalage odd-r).
 * Le plateau de combat fait 7 colonnes × 8 rangées ; chaque joueur possède les 4 rangées du bas
 * (rangées 4 à 7) pendant la préparation. L'adversaire est placé par rotation de 180°.
 */
import { BOARD_COLS, BOARD_ROWS, PLAYER_ROWS } from '../config/balance';

export interface Hex {
  col: number;
  row: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

const SQRT3 = Math.sqrt(3);

export function hexKey(h: Hex): number {
  return h.row * BOARD_COLS + h.col;
}

export function hexFromKey(k: number): Hex {
  return { col: k % BOARD_COLS, row: Math.floor(k / BOARD_COLS) };
}

export function sameHex(a: Hex, b: Hex): boolean {
  return a.col === b.col && a.row === b.row;
}

export function inCombatBounds(h: Hex): boolean {
  return h.col >= 0 && h.col < BOARD_COLS && h.row >= 0 && h.row < BOARD_ROWS;
}

/** Hexagones de la moitié joueur (préparation) : rangées locales 0..3, 0 = ligne de front. */
export function inPlayerBounds(h: Hex): boolean {
  return h.col >= 0 && h.col < BOARD_COLS && h.row >= 0 && h.row < PLAYER_ROWS;
}

/**
 * Position de préparation (rangée locale 0 = front, 3 = fond) vers le plateau de combat.
 * side 0 : moitié basse (rangées 4..7), side 1 : moitié haute, tournée de 180°.
 */
export function prepToCombat(local: Hex, side: 0 | 1): Hex {
  const row = PLAYER_ROWS + local.row; // 4..7, 4 = front
  const h = { col: local.col, row };
  return side === 0 ? h : rotate180(h);
}

export function rotate180(h: Hex): Hex {
  return { col: BOARD_COLS - 1 - h.col, row: BOARD_ROWS - 1 - h.row };
}

interface Cube {
  x: number;
  y: number;
  z: number;
}

export function toCube(h: Hex): Cube {
  const x = h.col - (h.row - (h.row & 1)) / 2;
  const z = h.row;
  return { x, y: -x - z, z };
}

export function fromCube(c: Cube): Hex {
  const col = c.x + (c.z - (c.z & 1)) / 2;
  return { col, row: c.z };
}

export function hexDistance(a: Hex, b: Hex): number {
  const ca = toCube(a);
  const cb = toCube(b);
  return (Math.abs(ca.x - cb.x) + Math.abs(ca.y - cb.y) + Math.abs(ca.z - cb.z)) / 2;
}

const ODD_R_DIRS: [number, number][][] = [
  // rangées paires
  [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],
  // rangées impaires
  [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],
];

export function neighbors(h: Hex): Hex[] {
  const out: Hex[] = [];
  for (const [dc, dr] of ODD_R_DIRS[h.row & 1]) {
    const n = { col: h.col + dc, row: h.row + dr };
    if (inCombatBounds(n)) out.push(n);
  }
  return out;
}

/** Tous les hexagones du plateau de combat à distance <= radius de center. */
export function hexesInRadius(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const h = { col, row };
      if (hexDistance(center, h) <= radius) out.push(h);
    }
  }
  return out;
}

export function allCombatHexes(): Hex[] {
  const out: Hex[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) for (let col = 0; col < BOARD_COLS; col++) out.push({ col, row });
  return out;
}

/** Centre d'un hexagone dans l'espace « plateau » (taille d'hexagone = 1). */
export function hexToWorld(h: Hex): Vec2 {
  return { x: SQRT3 * (h.col + 0.5 * (h.row & 1)), y: 1.5 * h.row };
}

/** Distance euclidienne exprimée en « hexagones » (1 = distance entre deux centres voisins). */
export function worldDistanceHex(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y) / SQRT3;
}

export const HEX_STEP = SQRT3; // distance monde entre deux centres voisins

function cubeRound(x: number, y: number, z: number): Cube {
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: ry, z: rz };
}

/** Hexagone le plus proche d'un point du monde. */
export function worldToHex(p: Vec2): Hex {
  const q = (SQRT3 / 3) * p.x - (1 / 3) * p.y;
  const r = (2 / 3) * p.y;
  const c = cubeRound(q, -q - r, r);
  return fromCube(c);
}

/** Ligne d'hexagones de a vers b (inclus), prolongée de `extra` hexagones au-delà de b. */
export function hexLine(a: Hex, b: Hex, extra = 0): Hex[] {
  const ca = toCube(a);
  const cb = toCube(b);
  const n = hexDistance(a, b);
  if (n === 0) return [a];
  const total = n + extra;
  const out: Hex[] = [];
  const seen = new Set<number>();
  for (let i = 0; i <= total; i++) {
    const t = i / n;
    const c = cubeRound(
      ca.x + (cb.x - ca.x) * t + 1e-6,
      ca.y + (cb.y - ca.y) * t + 1e-6,
      ca.z + (cb.z - ca.z) * t - 2e-6,
    );
    const h = fromCube(c);
    if (!inCombatBounds(h)) break;
    const k = hexKey(h);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(h);
    }
  }
  return out;
}

/** Distance d'un point à un segment, en unités monde. */
export function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
