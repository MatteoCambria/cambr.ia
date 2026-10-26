/**
 * État de partie : uniquement des données sérialisables (sauvegardes, reproduction).
 * Aucune référence à l'interface ni au rendu.
 */
import type { RngState } from '../core/rng';

export type Difficulty = 'facile' | 'normal' | 'difficile';
export type Phase = 'carousel' | 'planning' | 'combat' | 'gameOver';

export interface OwnedUnit {
  uid: string;
  defId: string;
  star: 1 | 2 | 3;
  items: string[];
}

export interface BoardSlot extends OwnedUnit {
  col: number;
  row: number; // local : 0 = ligne de front, 3 = fond
}

export type AiProfileId = 'agressif' | 'econome' | 'defensif' | 'specialiste' | 'flexible' | 'legendes';

export interface AiMemory {
  profile: AiProfileId;
  /** Synergies visées (ordre de priorité). */
  targetTraits: string[];
  /** Champions « carry » visés. */
  carries: string[];
  /** Synergie fétiche du profil spécialiste. */
  favoriteTrait?: string;
  pivots: number;
  lastPlanRound: number;
  rollDownDone: boolean;
  /** Dernière évaluation de sa force relative (0..1). */
  strength: number;
}

export interface PlayerRunStats {
  goldEarned: number;
  goldSpent: number;
  interestEarned: number;
  rerolls: number;
  xpBought: number;
  unitsBought: number;
  unitsSold: number;
  starUps2: number;
  starUps3: number;
  wins: number;
  losses: number;
  draws: number;
  damageDealt: number; // dégâts infligés aux autres joueurs
  damageTaken: number;
  bestStreak: number;
  itemsCrafted: number;
  /** Dégâts infligés en combat par champion (cumul). */
  championDamage: Record<string, number>;
  /** Manches passées sur le plateau par champion. */
  championRounds: Record<string, number>;
  hpHistory: number[];
}

export interface PublicSnapshot {
  round: number;
  level: number;
  hp: number;
  gold: number;
  streak: number;
  board: { defId: string; star: number; items: string[]; col: number; row: number }[];
  bench: { defId: string; star: number }[];
  traits: { id: string; count: number; level: number }[];
}

export interface PlayerState {
  id: number;
  name: string;
  title: string;
  isHuman: boolean;
  color: string;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  board: BoardSlot[];
  bench: (OwnedUnit | null)[];
  items: string[];
  shop: (string | null)[];
  shopLocked: boolean;
  shopRng: RngState;
  streak: number; // > 0 : victoires consécutives, < 0 : défaites
  alive: boolean;
  placement: number | null;
  eliminatedRound: number | null;
  ai?: AiMemory;
  stats: PlayerRunStats;
  nomadeWins: number;
  recentOpponents: number[];
  snapshot: PublicSnapshot | null;
  /** Gain d'or de la dernière manche, détaillé (affichage). */
  lastIncome: IncomeBreakdown | null;
}

export interface IncomeBreakdown {
  base: number;
  interest: number;
  streak: number;
  total: number;
}

export interface CarouselOffer {
  defId: string;
  item: string;
  takenBy: number | null;
}

export interface CarouselState {
  offers: CarouselOffer[];
  order: number[]; // ordre de passage (ids des joueurs)
  cursor: number;
}

export interface Pairing {
  a: number;
  /** id de l'adversaire, ou null pour une rencontre neutre. */
  b: number | null;
  /** Combat contre un reflet (copie) du plateau d'un autre joueur. */
  ghostOf?: number;
  seed: number;
}

export interface CombatSideSummary {
  playerId: number;
  won: boolean;
  draw: boolean;
  damageTaken: number;
  survivors: number;
  goldGained: number;
  loot: string[];
}

export interface RoundRecord {
  round: number;
  label: string;
  kind: 'pvp' | 'pve' | 'carousel';
  results: { playerId: number; opponent: number | null; ghost: boolean; won: boolean; draw: boolean; damage: number; duration: number }[];
}

export interface GameSettings {
  playerCount: number;
  prepTime: number; // secondes, 0 = illimité
  difficulty: Difficulty;
  seed: string;
  playerName: string;
}

export interface GameState {
  version: number;
  settings: GameSettings;
  roundIndex: number;
  phase: Phase;
  players: PlayerState[];
  pool: Record<string, number>;
  rng: RngState;
  pairings: Pairing[];
  carousel: CarouselState | null;
  history: RoundRecord[];
  nextUid: number;
  startedAt: number;
  /** Résumé de la dernière manche jouée (pour l'interface). */
  lastRound: { label: string; summaries: CombatSideSummary[] } | null;
  winnerId: number | null;
}

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
