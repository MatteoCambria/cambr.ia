/**
 * Informations publiques : ce que tout joueur (humain ou IA) peut légitimement observer.
 * L'IA n'a accès qu'à ces instantanés pour les autres joueurs — jamais à leur boutique,
 * à leur générateur aléatoire ou à leurs décisions de la manche en cours.
 */
import { computeTraits } from '../combat/setup';
import type { GameState, PlayerState, PublicSnapshot } from './types';

export function takeSnapshot(state: GameState, p: PlayerState): PublicSnapshot {
  return {
    round: state.roundIndex,
    level: p.level,
    hp: p.hp,
    gold: p.gold,
    streak: p.streak,
    board: p.board.map((s) => ({ defId: s.defId, star: s.star, items: [...s.items], col: s.col, row: s.row })),
    bench: p.bench.filter((u): u is NonNullable<typeof u> => !!u).map((u) => ({ defId: u.defId, star: u.star })),
    traits: computeTraits(p.board).map((t) => ({ id: t.id, count: t.count, level: t.level })),
  };
}

export interface PublicPlayer {
  id: number;
  name: string;
  alive: boolean;
  hp: number;
  snapshot: PublicSnapshot | null;
}

export interface PublicView {
  round: number;
  players: PublicPlayer[];
}

/** Vue publique pour un observateur : les autres joueurs, tels qu'observés au dernier combat. */
export function publicView(state: GameState, viewerId: number): PublicView {
  return {
    round: state.roundIndex,
    players: state.players
      .filter((p) => p.id !== viewerId)
      .map((p) => ({ id: p.id, name: p.name, alive: p.alive, hp: p.hp, snapshot: p.snapshot ? structuredClone(p.snapshot) : null })),
  };
}
