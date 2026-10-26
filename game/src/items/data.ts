/**
 * Objets : 8 composants et 36 objets combinés (toutes les paires de composants, doublons inclus).
 * Les statistiques d'un objet combiné reprennent celles de ses deux composants, plus un effet propre.
 */
import type { ItemDef } from '../core/defs';
import type { StatMod } from '../combat/dsl';

export const COMPONENTS: readonly ItemDef[] = [
  { id: 'lame', name: 'Lame d’éther', kind: 'component', stats: [{ stat: 'adPct', value: 12 }], desc: '+12 % de puissance d’attaque.', icon: 'sword', color: '#e2b04a', tags: ['carry-ad'] },
  { id: 'arc', name: 'Arc d’if courbe', kind: 'component', stats: [{ stat: 'asPct', value: 12 }], desc: '+12 % de vitesse d’attaque.', icon: 'bow', color: '#c98b4a', tags: ['carry-ad'] },
  { id: 'baguette', name: 'Baguette d’onyx', kind: 'component', stats: [{ stat: 'ap', value: 12 }], desc: '+12 Puissance.', icon: 'wand', color: '#8a6cff', tags: ['carry-ap'] },
  { id: 'larme', name: 'Larme d’azur', kind: 'component', stats: [{ stat: 'mana', value: 15 }], desc: '+15 mana de départ.', icon: 'tear', color: '#5aa8ff', tags: ['carry-ap', 'support'] },
  { id: 'cotte', name: 'Cotte de mailles', kind: 'component', stats: [{ stat: 'armor', value: 20 }], desc: '+20 armure.', icon: 'mail', color: '#b8b8c8', tags: ['tank'] },
  { id: 'cape', name: 'Cape de brume', kind: 'component', stats: [{ stat: 'mr', value: 20 }], desc: '+20 résistance magique.', icon: 'cloak', color: '#7fb0c8', tags: ['tank'] },
  { id: 'ceinture', name: 'Ceinture du colosse', kind: 'component', stats: [{ stat: 'hp', value: 150 }], desc: '+150 PV.', icon: 'belt', color: '#c86a4a', tags: ['tank'] },
  { id: 'gantelet', name: 'Gantelet d’affût', kind: 'component', stats: [{ stat: 'critChance', value: 15 }], desc: '+15 % de chances de coup critique.', icon: 'gauntlet', color: '#d0d6e0', tags: ['carry-ad'] },
];

const compStats = new Map(COMPONENTS.map((c) => [c.id, c.stats]));
function sum(a: string, b: string, extra: StatMod[] = []): StatMod[] {
  const out = new Map<string, number>();
  for (const m of [...(compStats.get(a) ?? []), ...(compStats.get(b) ?? []), ...extra]) {
    out.set(m.stat, (out.get(m.stat) ?? 0) + (m.value as number));
  }
  return [...out.entries()].map(([stat, value]) => ({ stat: stat as StatMod['stat'], value }));
}

function combined(
  id: string,
  name: string,
  a: string,
  b: string,
  desc: string,
  icon: string,
  color: string,
  tags: ItemDef['tags'],
  passive?: ItemDef['passive'],
  extraStats: StatMod[] = [],
  unique = false,
): ItemDef {
  return { id, name, kind: 'combined', recipe: [a, b], stats: sum(a, b, extraStats), passive, desc, icon, color, tags, unique };
}

export const COMBINED: readonly ItemDef[] = [
  // ── Doublons ──────────────────────────────────────────────────────────────
  combined('fendeur', 'Fendeur d’astres', 'lame', 'lame', 'Les dégâts infligés augmentent de 12 %.', 'axe', '#f0c060', ['carry-ad'], undefined, [{ stat: 'damageAmp', value: 12 }]),
  combined(
    'arc_vent',
    'Arc du vent rapide',
    'arc',
    'arc',
    'Chaque attaque confère +5 % de vitesse d’attaque (cumulable 8 fois).',
    'feather',
    '#9fd8a8',
    ['carry-ad'],
    { triggers: [{ on: 'attack', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'arc_vent', stack: 'stack', maxStacks: 8, stats: [{ stat: 'asPct', value: 5 }], tag: 'Vent rapide' } }] }] },
  ),
  combined('grimoire', 'Grimoire d’Orrhéa', 'baguette', 'baguette', '+30 Puissance supplémentaire.', 'book', '#a07cff', ['carry-ap'], undefined, [{ stat: 'ap', value: 30 }]),
  combined(
    'sablier',
    'Sablier d’azur',
    'larme',
    'larme',
    'Après avoir lancé sa compétence, récupère 20 mana.',
    'hourglass',
    '#6ab8ff',
    ['carry-ap', 'support'],
    { triggers: [{ on: 'cast', actions: [{ do: 'mana', area: { shape: 'self' }, amount: 20 }] }] },
  ),
  combined(
    'bastion',
    'Bastion de laiton',
    'cotte',
    'cotte',
    'Réduit de 18 % les dégâts subis pendant les 8 premières secondes.',
    'helm',
    '#c8b48a',
    ['tank'],
    { triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 8, id: 'bastion', stats: [{ stat: 'damageReduction', value: 18 }], tag: 'Bastion' } }] }] },
  ),
  combined(
    'linceul',
    'Linceul des marées',
    'cape',
    'cape',
    'Au début du combat, les alliés adjacents gagnent 25 résistance magique.',
    'wave',
    '#6fc3d8',
    ['tank'],
    { triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'adjacentAllies' }, status: { kind: 'stats', duration: 0, id: 'linceul', stats: [{ stat: 'mr', value: 25 }], tag: 'Linceul' } }] }] },
  ),
  combined(
    'coeur_geant',
    'Cœur de géant',
    'ceinture',
    'ceinture',
    'Régénère 1,5 % de ses PV max chaque seconde.',
    'heart',
    '#e06a5a',
    ['tank'],
    { triggers: [{ on: 'interval', every: 1, actions: [{ do: 'heal', area: { shape: 'self' }, amount: { casterHp: 1.5 } }] }] },
  ),
  combined(
    'oeil_chasseur',
    'Œil du chasseur',
    'gantelet',
    'gantelet',
    'Les coups critiques infligent Blessure (−33 % de soins reçus) pendant 3 s.',
    'eye',
    '#f0f0f8',
    ['carry-ad'],
    { triggers: [{ on: 'crit', actions: [{ do: 'status', status: { kind: 'stats', duration: 3, id: 'wound', stats: [{ stat: 'healReceived', value: -33 }], tag: 'Blessure' } }] }] },
    [{ stat: 'critDamage', value: 10 }],
  ),

  // ── Lame ─────────────────────────────────────────────────────────────────
  combined(
    'lame_marees',
    'Lame des marées',
    'lame',
    'arc',
    'Les attaques infligent Brèche : −20 % d’armure pendant 3 s.',
    'dagger',
    '#d8b070',
    ['carry-ad'],
    { triggers: [{ on: 'attack', actions: [{ do: 'status', status: { kind: 'stats', duration: 3, id: 'sunder', stats: [{ stat: 'armorPct', value: -20 }], tag: 'Brèche' } }] }] },
  ),
  combined('faux_crepuscule', 'Faux du crépuscule', 'lame', 'baguette', '20 % d’omnivampirisme : se soigne d’une partie de tous les dégâts infligés.', 'moon', '#b07ad8', ['carry-ad', 'carry-ap'], undefined, [{ stat: 'omnivamp', value: 20 }]),
  combined('epee_runique', 'Épée runique', 'lame', 'larme', 'Chaque attaque rend 5 mana supplémentaires.', 'crystal', '#7ab8f0', ['carry-ad', 'carry-ap'], undefined, [{ stat: 'manaPerAttack', value: 5 }]),
  combined(
    'rancune_acier',
    'Rancune d’acier',
    'lame',
    'cotte',
    'Chaque fois qu’il subit des dégâts : +2 % de PA et +2 armure (20 fois max).',
    'shield',
    '#c0a070',
    ['tank', 'carry-ad'],
    { triggers: [{ on: 'damaged', icd: 0.4, actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'rancune', stack: 'stack', maxStacks: 20, stats: [{ stat: 'adPct', value: 2 }, { stat: 'armor', value: 2 }], tag: 'Rancune' } }] }] },
  ),
  combined(
    'briselame',
    'Briselame',
    'lame',
    'cape',
    '15 % d’omnivampirisme. Sous 40 % de PV, reçoit un bouclier de 25 % de ses PV max pendant 5 s (1 fois).',
    'fang',
    '#d86a6a',
    ['carry-ad'],
    { triggers: [{ on: 'hpBelow', pct: 40, once: true, actions: [{ do: 'shield', area: { shape: 'self' }, amount: { casterHp: 25 }, duration: 5 }] }] },
    [{ stat: 'omnivamp', value: 15 }],
  ),
  combined(
    'fend_montagne',
    'Fend-montagne',
    'lame',
    'ceinture',
    'Sous 60 % de PV : +30 % de PA et un bouclier de 25 % de ses PV max pendant 4 s (1 fois).',
    'hammer',
    '#d0905a',
    ['tank', 'carry-ad'],
    {
      triggers: [
        {
          on: 'hpBelow',
          pct: 60,
          once: true,
          actions: [
            { do: 'shield', area: { shape: 'self' }, amount: { casterHp: 25 }, duration: 4 },
            { do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'fend_montagne', stats: [{ stat: 'adPct', value: 30 }], tag: 'Furie' } },
          ],
        },
      ],
    },
  ),
  combined('croc_abysse', 'Croc d’abysse', 'lame', 'gantelet', 'Les compétences peuvent être critiques. +20 % de dégâts critiques.', 'claw', '#e0e0f0', ['carry-ad', 'carry-ap'], undefined, [{ stat: 'abilityCrit', value: 1 }, { stat: 'critDamage', value: 20 }]),

  // ── Arc ──────────────────────────────────────────────────────────────────
  combined(
    'baton_courants',
    'Bâton des courants',
    'arc',
    'baguette',
    'Après avoir lancé sa compétence, gagne 40 % de vitesse d’attaque pendant 5 s.',
    'spiral',
    '#7ad0d8',
    ['carry-ap', 'carry-ad'],
    { triggers: [{ on: 'cast', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 5, id: 'courants', stats: [{ stat: 'asPct', value: 40 }], tag: 'Courants' } }] }] },
  ),
  combined(
    'carillon',
    'Carillon d’éther',
    'arc',
    'larme',
    'Toutes les 3 attaques, un arc électrique frappe la cible et rebondit sur 3 ennemis (70 dégâts magiques).',
    'bell',
    '#a0d8ff',
    ['carry-ad'],
    { triggers: [{ on: 'nthAttack', every: 3, actions: [{ do: 'chain', vfx: 'lightning', bounces: 3, range: 3, onHit: [{ do: 'damage', amount: { base: 70, noAp: true }, type: 'magic' }] }] }] },
  ),
  combined(
    'cuirasse_titan',
    'Cuirasse du titan',
    'arc',
    'cotte',
    'En attaquant ou en subissant des dégâts : +2 % de PA et +2 Puissance (25 fois max).',
    'gear',
    '#c8a060',
    ['tank', 'carry-ad'],
    {
      triggers: [
        { on: 'attack', icd: 0.3, actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'titan', stack: 'stack', maxStacks: 25, stats: [{ stat: 'adPct', value: 2 }, { stat: 'ap', value: 2 }], tag: 'Titan' } }] },
        { on: 'damaged', icd: 0.3, actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'titan', stack: 'stack', maxStacks: 25, stats: [{ stat: 'adPct', value: 2 }, { stat: 'ap', value: 2 }], tag: 'Titan' } }] },
      ],
    },
  ),
  combined(
    'fleau_colosses',
    'Fléau des colosses',
    'arc',
    'cape',
    'Les attaques infligent en plus 4 % des PV actuels de la cible en dégâts magiques.',
    'thorn',
    '#a07ad8',
    ['carry-ad'],
    { triggers: [{ on: 'attack', actions: [{ do: 'damage', amount: { targetCurrentHp: 4 }, type: 'magic' }] }] },
  ),
  combined('arbalete_siege', 'Arbalète de siège', 'arc', 'ceinture', 'Les attaques touchent aussi les ennemis adjacents à la cible (35 % des dégâts).', 'anchor', '#c08a5a', ['carry-ad'], { splash: { radius: 1, pct: 35 } }),
  combined('longue_vue', 'Longue-vue d’affût', 'arc', 'gantelet', '+1 portée d’attaque et +8 % de dégâts.', 'compass', '#d8d0a0', ['carry-ad'], undefined, [{ stat: 'range', value: 1 }, { stat: 'damageAmp', value: 8 }]),

  // ── Baguette ─────────────────────────────────────────────────────────────
  combined(
    'calice_maree',
    'Calice de la marée',
    'baguette',
    'larme',
    'Toutes les 5 s, gagne 15 Puissance (cumulable).',
    'chalice',
    '#7a9cff',
    ['carry-ap'],
    { triggers: [{ on: 'interval', every: 5, actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'calice', stack: 'stack', maxStacks: 12, stats: [{ stat: 'ap', value: 15 }], tag: 'Marée montante' } }] }] },
  ),
  combined(
    'couronne_braise',
    'Couronne de braise',
    'baguette',
    'cotte',
    'Les dégâts des compétences brûlent la cible (1 % de ses PV max par seconde pendant 4 s) et infligent Blessure (−33 %).',
    'flame',
    '#f08a4a',
    ['carry-ap', 'tank'],
    { triggers: [{ on: 'abilityHit', actions: [{ do: 'status', status: { kind: 'burn', duration: 4, id: 'couronne_burn', dps: { targetHp: 1 }, stats: [{ stat: 'healReceived', value: -33 }], tag: 'Brûlure' } }] }] },
  ),
  combined(
    'masque_eclipse',
    'Masque de l’éclipse',
    'baguette',
    'cape',
    'Les ennemis à 2 hexagones ou moins perdent 25 % de résistance magique.',
    'mask',
    '#9a7ad8',
    ['tank', 'carry-ap'],
    { triggers: [{ on: 'interval', every: 0.5, actions: [{ do: 'status', area: { shape: 'circle', at: 'self', radius: 2, side: 'enemies' }, status: { kind: 'stats', duration: 0.6, id: 'eclipse_aura', stats: [{ stat: 'mrPct', value: -25 }], tag: 'Éclipse' } }] }] },
  ),
  combined(
    'talisman',
    'Talisman de régénération',
    'baguette',
    'ceinture',
    'Après chaque compétence, rend 12 % de ses PV max.',
    'sprout',
    '#7ad08a',
    ['carry-ap', 'tank'],
    { triggers: [{ on: 'cast', actions: [{ do: 'heal', area: { shape: 'self' }, amount: { casterHp: 12 } }] }] },
  ),
  combined('gemme_savant', 'Gemme du savant', 'baguette', 'gantelet', 'Les compétences peuvent être critiques. +15 % de dégâts critiques.', 'prism', '#c0a0ff', ['carry-ap'], undefined, [{ stat: 'abilityCrit', value: 1 }, { stat: 'critDamage', value: 15 }]),

  // ── Larme ────────────────────────────────────────────────────────────────
  combined(
    'sceau_recueil',
    'Sceau du recueillement',
    'larme',
    'cotte',
    'Sous 50 % de PV : bouclier de 25 % de ses PV max et +30 armure et RM pendant 5 s (1 fois).',
    'ring',
    '#b0c8e0',
    ['tank', 'support'],
    {
      triggers: [
        {
          on: 'hpBelow',
          pct: 50,
          once: true,
          actions: [
            { do: 'shield', area: { shape: 'self' }, amount: { casterHp: 25 }, duration: 5 },
            { do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 5, id: 'recueil', stats: [{ stat: 'armor', value: 30 }, { stat: 'mr', value: 30 }], tag: 'Recueillement' } },
          ],
        },
      ],
    },
  ),
  combined('couronne_lunaire', 'Couronne lunaire', 'larme', 'cape', 'Régénère 2,5 mana par seconde.', 'crown', '#c0b0f0', ['carry-ap', 'support', 'tank'], undefined, [{ stat: 'manaRegen', value: 2.5 }]),
  combined(
    'egide_cierge',
    'Égide du cierge',
    'larme',
    'ceinture',
    'Toutes les 5 s, soigne les alliés adjacents de 12 % de leurs PV manquants.',
    'lantern',
    '#f0d080',
    ['support', 'tank'],
    { triggers: [{ on: 'interval', every: 5, actions: [{ do: 'heal', area: { shape: 'adjacentAllies', includeSelf: true }, amount: { targetMissingHp: 12 }, vfx: 'holyPulse' }] }] },
  ),
  combined('lunettes_horloger', 'Lunettes d’horloger', 'larme', 'gantelet', '+10 % de dégâts et 10 % d’omnivampirisme.', 'scales', '#e0c890', ['carry-ap', 'carry-ad'], undefined, [{ stat: 'damageAmp', value: 10 }, { stat: 'omnivamp', value: 10 }]),

  // ── Cotte / Cape / Ceinture / Gantelet ───────────────────────────────────
  combined(
    'pierre_garde',
    'Pierre-garde',
    'cotte',
    'cape',
    'Chaque fois qu’il subit des dégâts : +3 armure et RM (15 fois max).',
    'key',
    '#a0a8b8',
    ['tank'],
    { triggers: [{ on: 'damaged', icd: 0.25, actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'pierre_garde', stack: 'stack', maxStacks: 15, stats: [{ stat: 'armor', value: 3 }, { stat: 'mr', value: 3 }], tag: 'Pierre-garde' } }] }] },
  ),
  combined(
    'cuirasse_lave',
    'Cuirasse de lave',
    'cotte',
    'ceinture',
    'Toutes les 2 s, brûle les ennemis adjacents (1 % de leurs PV max par seconde pendant 3 s, Blessure −33 %).',
    'skull',
    '#e07040',
    ['tank'],
    {
      triggers: [
        {
          on: 'interval',
          every: 2,
          actions: [{ do: 'status', area: { shape: 'circle', at: 'self', radius: 1, side: 'enemies' }, status: { kind: 'burn', duration: 3, id: 'lave_burn', dps: { targetHp: 1 }, stats: [{ stat: 'healReceived', value: -33 }], tag: 'Brûlure' } }],
        },
      ],
    },
  ),
  combined(
    'cotte_epines',
    'Cotte d’épines',
    'cotte',
    'gantelet',
    'Renvoie 20 % des dégâts subis à l’attaquant sous forme de dégâts magiques.',
    'web',
    '#b8b0a0',
    ['tank'],
    { triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'reflect', duration: 0, value: 20, id: 'epines', tag: 'Épines' } }] }] },
  ),
  combined('ecaille_dragon', 'Écaille de dragon', 'cape', 'ceinture', 'Réduit de 10 % tous les dégâts subis.', 'wing', '#80c0a0', ['tank'], undefined, [{ stat: 'damageReduction', value: 10 }]),
  combined(
    'pendule_argent',
    'Pendule d’argent',
    'cape',
    'gantelet',
    'Immunisé aux contrôles pendant les 14 premières secondes du combat.',
    'mirror',
    '#d0e0f0',
    ['carry-ad', 'carry-ap', 'tank'],
    { triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'ccImmune', duration: 14, tag: 'Imperturbable' } }] }] },
  ),
  combined(
    'trophee_chasseur',
    'Trophée du chasseur',
    'ceinture',
    'gantelet',
    'Après chaque élimination : rend 25 % de ses PV max et gagne 15 % de vitesse d’attaque (cumulable).',
    'horn',
    '#d0a080',
    ['carry-ad', 'tank'],
    {
      triggers: [
        {
          on: 'kill',
          actions: [
            { do: 'heal', area: { shape: 'self' }, amount: { casterHp: 25 } },
            { do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'trophee', stack: 'stack', maxStacks: 6, stats: [{ stat: 'asPct', value: 15 }], tag: 'Trophée' } },
          ],
        },
      ],
    },
  ),
];

export const ITEMS: readonly ItemDef[] = [...COMPONENTS, ...COMBINED];

/** Consommables : ne s'équipent pas, ils s'utilisent sur une unité. */
export interface ConsumableDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
}

export const CONSUMABLES: readonly ConsumableDef[] = [
  {
    id: 'cle_demontage',
    name: 'Clé de démontage',
    desc: 'Utilisée sur un champion, retire tous ses objets et les replace dans la réserve d’objets.',
    icon: 'key',
    color: '#ffd27a',
  },
];
