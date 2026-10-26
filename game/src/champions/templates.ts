/**
 * Gabarits de statistiques par rôle et multiplicateurs par coût.
 * Chaque champion part d'un gabarit puis surcharge ce qui fait son identité.
 */
import type { BaseStats, Cost } from '../core/defs';

export type Template = 'tank' | 'bruiser' | 'duelist' | 'assassin' | 'marksman' | 'mage' | 'support' | 'artillery';

const BASE: Record<Template, Omit<BaseStats, 'mana'>> = {
  tank: { hp: 700, ad: 48, as: 0.6, armor: 45, mr: 40, range: 1 },
  bruiser: { hp: 680, ad: 56, as: 0.65, armor: 35, mr: 30, range: 1 },
  duelist: { hp: 600, ad: 54, as: 0.75, armor: 30, mr: 25, range: 1 },
  assassin: { hp: 560, ad: 60, as: 0.75, armor: 25, mr: 25, range: 1, moveSpeed: 2.6 },
  marksman: { hp: 500, ad: 55, as: 0.72, armor: 15, mr: 15, range: 4 },
  mage: { hp: 500, ad: 38, as: 0.65, armor: 15, mr: 18, range: 4 },
  support: { hp: 530, ad: 36, as: 0.65, armor: 18, mr: 20, range: 3 },
  artillery: { hp: 510, ad: 46, as: 0.62, armor: 15, mr: 15, range: 4 },
};

export const COST_HP: Readonly<Record<Cost, number>> = { 1: 1, 2: 1.12, 3: 1.26, 4: 1.42, 5: 1.62 };
export const COST_AD: Readonly<Record<Cost, number>> = { 1: 1, 2: 1.08, 3: 1.17, 4: 1.28, 5: 1.42 };

export function makeStats(t: Template, cost: Cost, mana: readonly [number, number], over: Partial<Omit<BaseStats, 'mana'>> = {}): BaseStats {
  const b = BASE[t];
  return {
    ...b,
    hp: Math.round((over.hp ?? b.hp) * COST_HP[cost]),
    ad: Math.round((over.ad ?? b.ad) * COST_AD[cost]),
    as: over.as ?? b.as,
    armor: over.armor ?? b.armor,
    mr: over.mr ?? b.mr,
    range: over.range ?? b.range,
    moveSpeed: over.moveSpeed ?? b.moveSpeed,
    manaPerAttack: over.manaPerAttack,
    critChance: over.critChance,
    mana,
  };
}

export const ITEMS_AD = ['fendeur', 'lame_marees', 'croc_abysse', 'arc_vent', 'longue_vue', 'oeil_chasseur'] as const;
export const ITEMS_AP = ['grimoire', 'sablier', 'calice_maree', 'gemme_savant', 'baton_courants', 'lunettes_horloger'] as const;
export const ITEMS_TANK = ['coeur_geant', 'bastion', 'pierre_garde', 'ecaille_dragon', 'cuirasse_lave', 'cotte_epines'] as const;
export const ITEMS_BRUISER = ['fend_montagne', 'briselame', 'faux_crepuscule', 'rancune_acier', 'cuirasse_titan', 'trophee_chasseur'] as const;
export const ITEMS_SUPPORT = ['sablier', 'couronne_lunaire', 'egide_cierge', 'sceau_recueil', 'talisman', 'linceul'] as const;
export const ITEMS_ASSASSIN = ['croc_abysse', 'briselame', 'fendeur', 'oeil_chasseur', 'trophee_chasseur', 'pendule_argent'] as const;
