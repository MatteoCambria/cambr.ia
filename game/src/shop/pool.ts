/**
 * Pool partagé de champions : chaque exemplaire n'existe qu'à un seul endroit
 * (pool, boutique d'un joueur, carrousel, réserve ou plateau).
 */
import { CHAMPIONS, getChampion } from '../core/content';
import { POOL_COPIES, copiesForStar } from '../config/balance';
import type { GameState, PlayerState } from '../game/types';

export function createPool(): Record<string, number> {
  const pool: Record<string, number> = {};
  for (const c of CHAMPIONS) pool[c.id] = POOL_COPIES[c.cost];
  return pool;
}

export function takeFromPool(state: GameState, defId: string, n = 1): boolean {
  const cur = state.pool[defId] ?? 0;
  if (cur < n) return false;
  state.pool[defId] = cur - n;
  return true;
}

export function returnToPool(state: GameState, defId: string, n = 1): void {
  const max = POOL_COPIES[getChampion(defId).cost];
  state.pool[defId] = Math.min(max, (state.pool[defId] ?? 0) + n);
}

/** Rend au pool tout ce que possède un joueur éliminé. */
export function returnPlayerUnits(state: GameState, p: PlayerState): void {
  for (const u of p.board) returnToPool(state, u.defId, copiesForStar(u.star));
  for (const u of p.bench) if (u) returnToPool(state, u.defId, copiesForStar(u.star));
  for (const s of p.shop) if (s) returnToPool(state, s, 1);
  p.board = [];
  p.bench = p.bench.map(() => null);
  p.shop = p.shop.map(() => null);
}

/** Nombre d'exemplaires d'un champion détenus par tous les joueurs (contrôle d'intégrité). */
export function copiesHeld(state: GameState, defId: string): number {
  let n = 0;
  for (const p of state.players) {
    for (const u of p.board) if (u.defId === defId) n += copiesForStar(u.star);
    for (const u of p.bench) if (u && u.defId === defId) n += copiesForStar(u.star);
    for (const s of p.shop) if (s === defId) n++;
  }
  if (state.carousel) for (const o of state.carousel.offers) if (o.takenBy === null && o.defId === defId) n++;
  return n;
}

/** Vérifie que pool + exemplaires détenus = total pour chaque champion. */
export function checkPoolIntegrity(state: GameState): string[] {
  const errs: string[] = [];
  for (const c of CHAMPIONS) {
    const total = (state.pool[c.id] ?? 0) + copiesHeld(state, c.id);
    if (total !== POOL_COPIES[c.cost]) errs.push(`${c.id} : ${total} exemplaires au lieu de ${POOL_COPIES[c.cost]}`);
  }
  return errs;
}
