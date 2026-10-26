/**
 * Économie : revenus de manche, intérêts, séries, coûts.
 */
import { ECONOMY } from '../config/balance';
import { roundAt } from '../config/rounds';
import type { GameState, IncomeBreakdown, PlayerState } from '../game/types';

export function interestFor(gold: number): number {
  return Math.min(ECONOMY.interestMax, Math.floor(Math.max(0, gold) / ECONOMY.interestPer));
}

/** Revenu attendu au début de la manche roundIndex, d'après l'état actuel du joueur. */
export function computeIncome(roundIndex: number, p: PlayerState): IncomeBreakdown {
  const r = roundAt(roundIndex);
  const early = ECONOMY.earlyIncome;
  const base = roundIndex < early.length ? early[roundIndex] : ECONOMY.baseIncome;
  const interest = r.stage >= 2 ? interestFor(p.gold) : 0;
  const streak = r.stage >= 2 ? ECONOMY.streakBonus(p.streak) : 0;
  return { base, interest, streak, total: base + interest + streak };
}

export function applyIncome(state: GameState, p: PlayerState): IncomeBreakdown {
  const inc = computeIncome(state.roundIndex, p);
  p.gold += inc.total;
  p.stats.goldEarned += inc.total;
  p.stats.interestEarned += inc.interest;
  p.lastIncome = inc;
  return inc;
}

export function spend(p: PlayerState, amount: number): boolean {
  if (p.gold < amount) return false;
  p.gold -= amount;
  p.stats.goldSpent += amount;
  return true;
}

export function earn(p: PlayerState, amount: number): void {
  if (amount <= 0) return;
  p.gold += amount;
  p.stats.goldEarned += amount;
}

/** Seuil d'intérêt suivant (pour l'affichage) : or à atteindre et intérêt correspondant. */
export function nextInterestThreshold(gold: number): { gold: number; interest: number } | null {
  const cur = interestFor(gold);
  if (cur >= ECONOMY.interestMax) return null;
  return { gold: (cur + 1) * ECONOMY.interestPer, interest: cur + 1 };
}
