/**
 * Profils stratégiques des adversaires et réglages par difficulté.
 * La difficulté agit sur la QUALITÉ des décisions, jamais sur les statistiques des unités.
 */
import type { AiProfileId, Difficulty } from '../game/types';

export interface ProfileDef {
  id: AiProfileId;
  label: string;
  desc: string;
  /** Niveau visé à partir d'une manche donnée : [index de manche, niveau]. */
  levelPlan: readonly [number, number][];
  /** Or à conserver (intérêts) selon les PV. */
  floor: (hp: number, stage: number) => number;
  /** En dessous de ces PV, l'IA dépense pour stabiliser. */
  panicHp: number;
  frontBias: number;
  highCostBias: number;
  favoriteBias: number;
  rerollComp: boolean;
}

// index de manche : 1-1 = 0, 2-1 = 4, 2-5 = 8, 3-1 = 11, 3-2 = 12, 4-1 = 18, 4-2 = 19, 4-5 = 22, 5-1 = 25, 5-2 = 26, 6-1 = 32
const R = { '2-1': 4, '2-3': 6, '2-5': 8, '3-1': 11, '3-2': 12, '3-5': 15, '4-1': 18, '4-2': 19, '4-5': 22, '5-1': 25, '5-2': 26, '5-5': 29, '6-1': 32, '6-2': 33 } as const;

export const PROFILES: Readonly<Record<AiProfileId, ProfileDef>> = {
  agressif: {
    id: 'agressif',
    label: 'Agressif',
    desc: 'Monte de niveau tôt et dépense pour remporter les premières manches.',
    levelPlan: [[R['2-1'], 4], [R['2-5'], 5], [R['3-2'], 6], [R['4-1'], 7], [R['4-5'], 8], [R['5-5'], 9]],
    floor: (hp) => (hp > 70 ? 20 : hp > 40 ? 10 : 0),
    panicHp: 45,
    frontBias: 0.5,
    highCostBias: 0,
    favoriteBias: 0,
    rerollComp: false,
  },
  econome: {
    id: 'econome',
    label: 'Économe',
    desc: 'Accumule l’or pour maximiser les intérêts, puis investit massivement en milieu de partie.',
    levelPlan: [[R['2-5'], 5], [R['3-2'], 6], [R['4-1'], 7], [R['4-2'], 8], [R['5-2'], 9]],
    floor: (hp, stage) => (stage >= 5 ? 30 : hp > 65 ? 50 : hp > 45 ? 30 : 10),
    panicHp: 40,
    frontBias: 0,
    highCostBias: 1,
    favoriteBias: 0,
    rerollComp: false,
  },
  defensif: {
    id: 'defensif',
    label: 'Défensif',
    desc: 'Privilégie une ligne de front solide et des objets défensifs pour préserver ses PV.',
    levelPlan: [[R['2-3'], 4], [R['2-5'], 5], [R['3-2'], 6], [R['4-1'], 7], [R['5-1'], 8], [R['6-1'], 9]],
    floor: (hp) => (hp > 60 ? 30 : hp > 35 ? 20 : 0),
    panicHp: 55,
    frontBias: 2.5,
    highCostBias: 0,
    favoriteBias: 0,
    rerollComp: false,
  },
  specialiste: {
    id: 'specialiste',
    label: 'Spécialiste',
    desc: 'Se consacre à une synergie fétiche et cherche à l’amener à son palier maximal.',
    levelPlan: [[R['2-5'], 5], [R['3-2'], 6], [R['4-1'], 7], [R['5-1'], 8], [R['6-1'], 9]],
    floor: (hp) => (hp > 60 ? 40 : hp > 35 ? 20 : 0),
    panicHp: 40,
    frontBias: 0,
    highCostBias: 0,
    favoriteBias: 6,
    rerollComp: false,
  },
  flexible: {
    id: 'flexible',
    label: 'Flexible',
    desc: 'Suit ce que la boutique propose et change de composition si sa voie est disputée.',
    levelPlan: [[R['2-5'], 5], [R['3-2'], 6], [R['4-1'], 7], [R['4-5'], 8], [R['6-1'], 9]],
    floor: (hp) => (hp > 60 ? 40 : hp > 35 ? 20 : 0),
    panicHp: 40,
    frontBias: 0.5,
    highCostBias: 0.5,
    favoriteBias: 0,
    rerollComp: false,
  },
  legendes: {
    id: 'legendes',
    label: 'Chasseur de légendes',
    desc: 'Sacrifie le début de partie pour atteindre un niveau élevé et des champions rares.',
    levelPlan: [[R['3-2'], 6], [R['3-5'], 7], [R['4-2'], 8], [R['5-1'], 9], [R['6-2'], 10]],
    floor: (hp, stage) => (stage >= 5 ? 20 : hp > 60 ? 40 : hp > 35 ? 20 : 0),
    panicHp: 50,
    frontBias: 0,
    highCostBias: 3,
    favoriteBias: 0,
    rerollComp: false,
  },
};

export interface DifficultyDef {
  id: Difficulty;
  label: string;
  desc: string;
  /** Bruit sur l'évaluation des unités (erreurs de jugement). */
  noise: number;
  /** Probabilité d'oublier une décision (achat d'XP, roll, objet). */
  slip: number;
  /** Qualité du placement : 0 = approximatif, 1 = règles, 2 = optimisé par simulation. */
  placement: 0 | 1 | 2;
  /** Adaptation aux adversaires (repérage public). */
  adapt: boolean;
  /** Optimisation des objets. */
  itemSmarts: boolean;
  /** Respect du plan de niveau (0..1). */
  discipline: number;
  /** Probabilité de choisir une unité au hasard lors de la composition du plateau. */
  boardNoise: number;
  /** Effectue les « roll-down » de stabilisation au bon moment. */
  rollDowns: boolean;
}

export const DIFFICULTIES: Readonly<Record<Difficulty, DifficultyDef>> = {
  facile: {
    id: 'facile',
    label: 'Facile',
    desc: 'Adversaires hésitants : économie approximative, placements perfectibles. Idéal pour découvrir.',
    noise: 8,
    slip: 0.4,
    placement: 0,
    adapt: false,
    itemSmarts: false,
    discipline: 0.35,
    boardNoise: 0.35,
    rollDowns: false,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    desc: 'Décisions cohérentes, économie raisonnable et compositions fonctionnelles.',
    noise: 2.5,
    slip: 0.1,
    placement: 1,
    adapt: false,
    itemSmarts: true,
    discipline: 0.85,
    boardNoise: 0.04,
    rollDowns: true,
  },
  difficile: {
    id: 'difficile',
    label: 'Difficile',
    desc: 'Économie optimisée, placement testé par simulation et adaptation aux compositions adverses observées.',
    noise: 0.4,
    slip: 0,
    placement: 2,
    adapt: true,
    itemSmarts: true,
    discipline: 1,
    boardNoise: 0,
    rollDowns: true,
  },
};

export const AI_PERSONAS: readonly { name: string; title: string; color: string; profile: AiProfileId }[] = [
  { name: 'Séverin', title: 'l’Inflexible', color: '#c9b37a', profile: 'defensif' },
  { name: 'Ondine', title: 'la Rapace', color: '#e0634a', profile: 'agressif' },
  { name: 'Maître Quillon', title: 'le Thésauriseur', color: '#e8c15a', profile: 'econome' },
  { name: 'Isolde', title: 'la Fidèle', color: '#b48aff', profile: 'specialiste' },
  { name: 'Ambre', title: 'la Cartographe', color: '#4fc9d8', profile: 'flexible' },
  { name: 'Varek', title: 'le Collectionneur', color: '#9b6bff', profile: 'legendes' },
  { name: 'Nyra', title: 'Sans-Heure', color: '#6fbf5a', profile: 'flexible' },
  { name: 'Corvin', title: 'le Spécialiste', color: '#f0743e', profile: 'specialiste' },
  { name: 'Lisandre', title: 'la Prudente', color: '#7fb3e8', profile: 'defensif' },
];
