/**
 * Définitions déclaratives du contenu : champions, synergies, objets, invocations, créatures.
 */
import type { AbilityDef, PassiveDef, ValueMap } from '../combat/dsl';

export type Cost = 1 | 2 | 3 | 4 | 5;

export type Role =
  | 'tank'
  | 'bruiser'
  | 'initiator'
  | 'protector'
  | 'controller'
  | 'marksman'
  | 'assassin'
  | 'duelist'
  | 'fighter'
  | 'skirmisher'
  | 'aoeMage'
  | 'burstMage'
  | 'summoner'
  | 'dotMage'
  | 'artillery'
  | 'healer'
  | 'enchanter'
  | 'amplifier'
  | 'shielder'
  | 'battery';

export const ROLE_LABELS: Record<Role, string> = {
  tank: 'Tank',
  bruiser: 'Combattant résistant',
  initiator: 'Initiateur',
  protector: 'Protecteur',
  controller: 'Contrôleur de zone',
  marksman: 'Tireur',
  assassin: 'Assassin',
  duelist: 'Duelliste',
  fighter: 'Combattant de mêlée',
  skirmisher: 'Attaques rapides',
  aoeMage: 'Mage de zone',
  burstMage: 'Lanceur monocible',
  summoner: 'Invocateur',
  dotMage: 'Dégâts sur la durée',
  artillery: 'Artillerie',
  healer: 'Soigneur',
  enchanter: 'Enchanteur',
  amplifier: 'Amplificateur',
  shielder: 'Protecteur d’alliés',
  battery: 'Énergie et régénération',
};

/** Rôle tactique « macro » utilisé par l'IA et le placement. */
export type Position = 'front' | 'back' | 'flex';

export type BodyShape =
  | 'knight'
  | 'robe'
  | 'slim'
  | 'heavy'
  | 'beast'
  | 'construct'
  | 'serpent'
  | 'floating'
  | 'small'
  | 'giant'
  | 'quadruped'
  | 'bird';

export type HeadShape =
  | 'helm'
  | 'hood'
  | 'horns'
  | 'crown'
  | 'mask'
  | 'bare'
  | 'beast'
  | 'orb'
  | 'antlers'
  | 'tricorn'
  | 'flame'
  | 'tentacles'
  | 'visor'
  | 'halo'
  | 'hat'
  | 'ponytail'
  | 'fins'
  | 'skull'
  | 'goggles'
  | 'veil';

export type WeaponShape =
  | 'sword'
  | 'greatsword'
  | 'staff'
  | 'bow'
  | 'crossbow'
  | 'daggers'
  | 'hammer'
  | 'shield'
  | 'tome'
  | 'gun'
  | 'cannon'
  | 'lance'
  | 'claws'
  | 'orb'
  | 'scythe'
  | 'fan'
  | 'harpoon'
  | 'wrench'
  | 'censer'
  | 'flask'
  | 'banner'
  | 'chakram'
  | 'lantern'
  | 'drill'
  | 'whip'
  | 'none';

export type Extra =
  | 'cape'
  | 'wings'
  | 'tail'
  | 'aura'
  | 'pauldrons'
  | 'gears'
  | 'leaves'
  | 'bubbles'
  | 'embers'
  | 'stars'
  | 'scarf'
  | 'backpack'
  | 'chains'
  | 'crystals'
  | 'moon'
  | 'sun';

export interface Look {
  body: BodyShape;
  head: HeadShape;
  weapon: WeaponShape;
  primary: string;
  secondary: string;
  accent: string;
  skin?: string;
  extras?: readonly Extra[];
  scale?: number;
}

export interface BaseStats {
  hp: number;
  ad: number;
  as: number;
  armor: number;
  mr: number;
  range: number;
  mana: readonly [number, number]; // [départ, maximum]
  moveSpeed?: number;
  manaPerAttack?: number;
  critChance?: number; // en %
}

export interface AttackDef {
  projectile?: string; // clé visuelle du projectile (attaque à distance)
  speed?: number;
}

export interface ChampionDef {
  id: string;
  name: string;
  title: string;
  cost: Cost;
  traits: readonly string[];
  role: Role;
  secondaryRole?: Role;
  position: Position;
  stats: BaseStats;
  ability: AbilityDef;
  passive?: PassiveDef;
  attack?: AttackDef;
  look: Look;
  lore: string;
  /** Pourquoi le recruter : rôle dans une composition. */
  roleNote: string;
  /** Compte plusieurs fois pour une synergie (règle explicite). */
  countsAs?: Readonly<Record<string, number>>;
  /** Objets conseillés (utilisés par l'IA et affichés dans la fiche). */
  preferredItems?: readonly string[];
}

export interface TraitLevelDef {
  desc: string;
  /** Effet appliqué à chaque porteur de la synergie. */
  holders?: PassiveDef;
  /** Effet appliqué à toutes les unités alliées. */
  team?: PassiveDef;
  /** Effet appliqué à un seul porteur choisi (le plus en retrait). */
  leader?: PassiveDef;
  /** Effets hors combat. */
  economy?: { goldAfterCombat?: number; goldOnWin?: number; componentEveryNWins?: number };
  values?: ValueMap;
}

export interface TraitDef {
  id: string;
  name: string;
  kind: 'origin' | 'class';
  color: string;
  icon: string;
  desc: string;
  lore: string;
  thresholds: readonly number[];
  levels: readonly TraitLevelDef[];
  counter: string; // comment le contrer (aide)
}

export type ItemKind = 'component' | 'combined';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  recipe?: readonly [string, string];
  stats: readonly import('../combat/dsl').StatMod[];
  passive?: PassiveDef;
  desc: string;
  icon: string;
  color: string;
  unique?: boolean;
  /** Catégories pour l'IA : à qui le donner. */
  tags: readonly ('carry-ad' | 'carry-ap' | 'tank' | 'support' | 'utility' | 'any')[];
}

export interface SummonDef {
  id: string;
  name: string;
  stats: BaseStats;
  ability?: AbilityDef;
  passive?: PassiveDef;
  attack?: AttackDef;
  look: Look;
  desc: string;
  values?: ValueMap;
}

export interface CreatureDef {
  id: string;
  name: string;
  stats: BaseStats;
  ability?: AbilityDef;
  passive?: PassiveDef;
  attack?: AttackDef;
  look: Look;
}
