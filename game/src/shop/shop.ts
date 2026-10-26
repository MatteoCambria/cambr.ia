/**
 * Boutique : tirage selon le niveau du joueur, pondéré par les exemplaires restants du pool.
 */
import { CHAMPIONS } from '../core/content';
import { SHOP_ODDS, SHOP_SIZE } from '../config/balance';
import { Rng } from '../core/rng';
import type { GameState, PlayerState } from '../game/types';
import { returnToPool, takeFromPool } from './pool';

export function shopOdds(level: number): readonly number[] {
  return SHOP_ODDS[Math.max(1, Math.min(10, level))];
}

/** Tire un champion pour un emplacement ; renvoie null si le pool est vide. */
export function drawChampion(state: GameState, rng: Rng, level: number): string | null {
  const odds = shopOdds(level);
  const tierWeights = odds.map((o, i) => {
    const cost = i + 1;
    const available = CHAMPIONS.some((c) => c.cost === cost && (state.pool[c.id] ?? 0) > 0);
    return available ? o : 0;
  });
  const tier = rng.weightedIndex(tierWeights);
  if (tier < 0) return null;
  const cost = tier + 1;
  const candidates = CHAMPIONS.filter((c) => c.cost === cost);
  const idx = rng.weightedIndex(candidates.map((c) => state.pool[c.id] ?? 0));
  if (idx < 0) return null;
  const id = candidates[idx].id;
  takeFromPool(state, id, 1);
  return id;
}

/** Renouvelle la boutique : les champions non achetés retournent au pool. */
export function refreshShop(state: GameState, p: PlayerState): void {
  for (const s of p.shop) if (s) returnToPool(state, s, 1);
  const rng = new Rng(p.shopRng);
  const out: (string | null)[] = [];
  for (let i = 0; i < SHOP_SIZE; i++) out.push(drawChampion(state, rng, p.level));
  p.shop = out;
  p.shopRng = rng.getState();
}
