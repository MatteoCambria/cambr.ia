/**
 * Paramètres d'équilibrage centralisés.
 * Toute valeur numérique de règle du jeu vit ici (ou dans les données déclaratives des
 * champions, synergies et objets). Aucune duplication ailleurs dans le code.
 */

// ── Plateau ────────────────────────────────────────────────────────────────
export const BOARD_COLS = 7;
export const BOARD_ROWS = 8; // plateau de combat complet
export const PLAYER_ROWS = 4; // moitié d'un joueur
export const BENCH_SIZE = 9;
export const ITEM_BENCH_SIZE = 10;
export const MAX_ITEMS_PER_UNIT = 3;

// ── Joueurs ────────────────────────────────────────────────────────────────
export const PLAYER_START_HP = 100;
export const DEFAULT_PLAYER_COUNT = 8;
export const MIN_PLAYER_COUNT = 4;
export const MAX_PLAYER_COUNT = 8;

// ── Économie ───────────────────────────────────────────────────────────────
export const ECONOMY = {
  startGold: 2,
  baseIncome: 5,
  /** Revenu passif des premières manches (index = numéro de manche global, 0 = 1-1). */
  earlyIncome: [0, 2, 2, 3, 4] as readonly number[],
  interestPer: 10, // 1 or par tranche de 10
  interestMax: 5,
  pvpWinGold: 1,
  /** Bonus de série (victoires ou défaites) selon la longueur de la série. */
  streakBonus(streak: number): number {
    const s = Math.abs(streak);
    if (s >= 5) return 3;
    if (s === 4) return 2;
    if (s >= 2) return 1;
    return 0;
  },
  rerollCost: 2,
  xpBuyCost: 4,
  xpBuyAmount: 4,
  passiveXpPerRound: 2,
} as const;

// ── Niveaux ────────────────────────────────────────────────────────────────
export const MAX_LEVEL = 10;
/** XP nécessaire pour passer du niveau i au niveau i+1 (index = niveau actuel). */
export const XP_TO_NEXT: readonly number[] = [0, 2, 2, 6, 10, 20, 36, 48, 72, 84, Infinity];

/** Probabilités de la boutique par niveau, en % pour les coûts 1 à 5. */
export const SHOP_ODDS: Readonly<Record<number, readonly number[]>> = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 35, 15, 1],
  8: [16, 20, 35, 25, 4],
  9: [10, 15, 30, 30, 15],
  10: [5, 10, 20, 40, 25],
};

export const SHOP_SIZE = 5;

/** Nombre d'exemplaires de chaque champion dans le pool partagé, par coût. */
export const POOL_COPIES: Readonly<Record<number, number>> = { 1: 29, 2: 22, 3: 18, 4: 12, 5: 10 };

// ── Rangs (étoiles) ────────────────────────────────────────────────────────
export const COPIES_TO_UPGRADE = 3;
export const MAX_STAR = 3;
export const STAR_HP_MULT: readonly number[] = [0, 1, 1.8, 3.24];
export const STAR_AD_MULT: readonly number[] = [0, 1, 1.5, 2.25];

/** Valeur de revente : 1★ = coût ; au-delà, coût × exemplaires − 1 (minimum coût). */
export function sellValue(cost: number, star: number): number {
  const copies = Math.pow(COPIES_TO_UPGRADE, star - 1);
  if (star === 1) return cost;
  return Math.max(cost, cost * copies - 1);
}

/** Nombre d'exemplaires du pool représentés par une unité d'un rang donné. */
export function copiesForStar(star: number): number {
  return Math.pow(COPIES_TO_UPGRADE, star - 1);
}

// ── Combat ─────────────────────────────────────────────────────────────────
export const COMBAT = {
  dt: 1 / 30, // pas de simulation fixe (s)
  overtimeStart: 30, // début de l'Embrasement
  hardLimit: 48, // fin forcée : match nul
  overtimeDamageRampPerSec: 0.12, // +12 % de dégâts infligés par seconde d'Embrasement
  overtimeHealingCut: 0.5,
  manaPerAttackDefault: 10,
  manaFromDamagePre: 0.01,
  manaFromDamagePost: 0.03,
  manaFromDamageCap: 40,
  baseCritChance: 0.25,
  baseCritDamage: 1.4,
  attackSpeedCap: 5,
  attackSpeedFloor: 0.2,
  windupFraction: 0.32, // part de l'intervalle d'attaque avant l'impact
  minWindup: 0.1,
  maxWindup: 0.45,
  defaultProjectileSpeed: 10, // hexagones par seconde
  defaultMoveSpeed: 2.2, // hexagones par seconde
  retargetInterval: 0.5,
  blockedRetargetDelay: 1.0,
  stunGraceDuration: 0.6, // fenêtre de résistance après un étourdissement (anti-contrôle permanent)
  stunGraceReduction: 0.5,
  maxDamageReduction: 0.8,
  maxTriggerDepth: 6,
  maxEventsPerTick: 4000,
  dotTickInterval: 0.5,
  hpHistoryInterval: 0.25,
  hpHistorySeconds: 6,
  leapDuration: 0.55,
  dashDuration: 0.25,
} as const;

// ── Dégâts aux joueurs ─────────────────────────────────────────────────────
/** Dégâts fixes infligés au perdant selon l'étape. */
export const STAGE_DAMAGE: readonly number[] = [0, 0, 2, 4, 6, 8, 10, 13, 16, 20];

/** Dégâts additionnels par unité survivante, selon son rang et son coût. */
export function survivorDamage(star: number, cost: number): number {
  const byStar = star >= 3 ? 4 : star === 2 ? 2 : 1;
  return byStar + (cost >= 4 ? 1 : 0);
}

// ── Manches ────────────────────────────────────────────────────────────────
export const PREP_TIME_OPTIONS = [30, 45, 60, 0] as const; // 0 = illimité
export const DEFAULT_PREP_TIME = 45;
export const CAROUSEL_TIME = 18;
