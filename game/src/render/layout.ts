/**
 * Géométrie écran du plateau : projection légèrement inclinée (2,5D) des hexagones,
 * emplacements de la réserve, conversions monde ↔ écran et tests de sélection.
 */
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS, PLAYER_ROWS } from '../config/balance';
import { hexToWorld, worldToHex, type Hex, type Vec2 } from '../board/hex';

export const TILT = 0.66;
const SQRT3 = Math.sqrt(3);

export interface BoardLayout {
  width: number;
  height: number;
  hexR: number; // rayon d'un hexagone en pixels (avant inclinaison verticale)
  originX: number;
  originY: number;
  benchY: number;
  benchX0: number;
  benchStep: number;
  benchSlotR: number;
}

/** Calcule la mise en page pour un canvas de w × h pixels CSS. */
export function computeLayout(w: number, h: number): BoardLayout {
  const worldW = SQRT3 * (BOARD_COLS + 0.5);
  const worldH = 1.5 * (BOARD_ROWS - 1) + 2;
  // place pour la réserve sous le plateau
  const benchBand = 1.7;
  const rByW = (w * 0.94) / worldW;
  const rByH = (h * 0.92) / (worldH * TILT + benchBand * 1.15);
  const hexR = Math.max(18, Math.min(rByW, rByH));
  const boardPxW = worldW * hexR;
  const boardPxH = worldH * hexR * TILT;
  const totalH = boardPxH + benchBand * hexR * 1.15;
  const originX = (w - boardPxW) / 2 + (SQRT3 / 2) * hexR;
  const originY = (h - totalH) / 2 + hexR * TILT;
  const benchStep = Math.min((boardPxW * 0.98) / BENCH_SIZE, hexR * 1.75);
  const benchX0 = w / 2 - (benchStep * (BENCH_SIZE - 1)) / 2;
  const benchY = originY + boardPxH + hexR * 0.55;
  return { width: w, height: h, hexR, originX, originY, benchY, benchX0, benchStep, benchSlotR: Math.min(hexR * 0.82, benchStep * 0.46) };
}

/** Monde (unités hexagone) → écran (pixels CSS). */
export function worldToScreen(L: BoardLayout, p: Vec2): Vec2 {
  return { x: L.originX + p.x * L.hexR, y: L.originY + p.y * L.hexR * TILT };
}

export function screenToWorld(L: BoardLayout, x: number, y: number): Vec2 {
  return { x: (x - L.originX) / L.hexR, y: (y - L.originY) / (L.hexR * TILT) };
}

/** Centre écran d'une case du plateau de combat. */
export function combatHexToScreen(L: BoardLayout, h: Hex): Vec2 {
  return worldToScreen(L, hexToWorld(h));
}

/** Case locale (préparation) du joueur → coordonnées de combat (moitié basse). */
export function localToCombat(local: { col: number; row: number }): Hex {
  return { col: local.col, row: PLAYER_ROWS + local.row };
}

export function combatToLocal(h: Hex): { col: number; row: number } | null {
  if (h.row < PLAYER_ROWS) return null;
  return { col: h.col, row: h.row - PLAYER_ROWS };
}

export function benchSlotCenter(L: BoardLayout, i: number): Vec2 {
  return { x: L.benchX0 + i * L.benchStep, y: L.benchY };
}

export type Pick =
  | { kind: 'board'; col: number; row: number } // coordonnées locales du joueur
  | { kind: 'enemyHalf'; hex: Hex }
  | { kind: 'bench'; index: number }
  | null;

export function pickCell(L: BoardLayout, x: number, y: number): Pick {
  // réserve
  for (let i = 0; i < BENCH_SIZE; i++) {
    const c = benchSlotCenter(L, i);
    if (Math.abs(x - c.x) <= L.benchStep / 2 && Math.abs(y - c.y) <= L.benchSlotR * 1.05) return { kind: 'bench', index: i };
  }
  const w = screenToWorld(L, x, y);
  const h = worldToHex(w);
  if (h.col < 0 || h.col >= BOARD_COLS || h.row < 0 || h.row >= BOARD_ROWS) return null;
  // vérification de distance pour éviter les bords
  const c = hexToWorld(h);
  if (Math.hypot(c.x - w.x, c.y - w.y) > 1.05) return null;
  const local = combatToLocal(h);
  if (local) return { kind: 'board', col: local.col, row: local.row };
  return { kind: 'enemyHalf', hex: h };
}
