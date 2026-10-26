/**
 * Niveau du joueur : expérience, limite de déploiement.
 */
import { MAX_LEVEL, XP_TO_NEXT } from '../config/balance';
import type { PlayerState } from '../game/types';

export function xpToNext(level: number): number {
  return XP_TO_NEXT[level] ?? Infinity;
}

/** Ajoute de l'expérience ; renvoie le nombre de niveaux gagnés. */
export function addXp(p: PlayerState, amount: number): number {
  if (p.level >= MAX_LEVEL) return 0;
  p.xp += amount;
  let gained = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    gained++;
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return gained;
}

/** Nombre maximal d'unités déployées sur le plateau. */
export function deployLimit(p: PlayerState): number {
  return p.level;
}
