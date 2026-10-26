/**
 * Invocations (créées pendant le combat) et créatures des manches neutres.
 */
import type { CreatureDef, SummonDef } from '../core/defs';

export const SUMMONS: Readonly<Record<string, SummonDef>> = {
  tic_turret: {
    id: 'tic_turret',
    name: 'Tourelle de poche',
    desc: 'Tourelle immobile qui tire sur l’ennemi le plus proche.',
    stats: { hp: 380, ad: 34, as: 0.85, armor: 20, mr: 20, range: 3, mana: [0, 0], moveSpeed: 0.6 },
    attack: { projectile: 'boltCopper', speed: 14 },
    look: { body: 'construct', head: 'goggles', weapon: 'gun', primary: '#b87333', secondary: '#5a3a22', accent: '#ffcf6b', scale: 0.7 },
  },
  octave_golem: {
    id: 'octave_golem',
    name: 'Golem d’engrenages',
    desc: 'Automate massif qui provoque les ennemis adjacents toutes les 4 s.',
    stats: { hp: 1150, ad: 60, as: 0.6, armor: 50, mr: 50, range: 1, mana: [0, 0] },
    passive: {
      triggers: [{ on: 'interval', every: 4, actions: [{ do: 'status', area: { shape: 'circle', at: 'self', radius: 1, side: 'enemies' }, status: { kind: 'taunt', duration: 1.25, tag: 'Provoqué' } }] }],
    },
    look: { body: 'construct', head: 'visor', weapon: 'hammer', primary: '#a8783c', secondary: '#3b2c1e', accent: '#ffd27a', extras: ['gears'], scale: 1.15 },
  },
  ash_revenant: {
    id: 'ash_revenant',
    name: 'Revenant de cendres',
    desc: 'Guerrier de cendres dont les attaques brûlent.',
    stats: { hp: 620, ad: 55, as: 0.8, armor: 25, mr: 25, range: 1, mana: [0, 0] },
    passive: {
      triggers: [{ on: 'attack', actions: [{ do: 'status', status: { kind: 'burn', duration: 2, id: 'revenant_burn', dps: { base: 18, noAp: true }, tag: 'Brûlure' } }] }],
    },
    look: { body: 'slim', head: 'skull', weapon: 'sword', primary: '#5b5552', secondary: '#2a2422', accent: '#ff8a3d', extras: ['embers'], scale: 0.9 },
  },
  mirage_decoy: {
    id: 'mirage_decoy',
    name: 'Mirage',
    desc: 'Leurre fragile qui provoque les ennemis adjacents.',
    stats: { hp: 320, ad: 10, as: 0.4, armor: 0, mr: 0, range: 1, mana: [0, 0] },
    passive: {
      triggers: [
        { on: 'interval', every: 1.5, actions: [{ do: 'status', area: { shape: 'circle', at: 'self', radius: 1, side: 'enemies' }, status: { kind: 'taunt', duration: 1.5, tag: 'Provoqué' } }] },
      ],
    },
    look: { body: 'slim', head: 'mask', weapon: 'daggers', primary: '#e8d6a8', secondary: '#6b5aa8', accent: '#fff3c4', extras: ['scarf'], scale: 0.95 },
  },
  caravan_rider: {
    id: 'caravan_rider',
    name: 'Cavalier spectral',
    desc: 'Cavalier fantôme rapide qui fonce sur l’ennemi le plus proche.',
    stats: { hp: 720, ad: 68, as: 0.8, armor: 30, mr: 30, range: 1, mana: [0, 0], moveSpeed: 3.2 },
    look: { body: 'quadruped', head: 'hood', weapon: 'lance', primary: '#7fd8e0', secondary: '#c9a46a', accent: '#ffffff', extras: ['scarf', 'aura'], scale: 1.05 },
  },
  void_shard: {
    id: 'void_shard',
    name: 'Éclat du vide',
    desc: 'Fragment d’étoile morte qui tire à courte distance.',
    stats: { hp: 380, ad: 42, as: 0.9, armor: 15, mr: 15, range: 2, mana: [0, 0] },
    attack: { projectile: 'voidBolt', speed: 12 },
    look: { body: 'floating', head: 'orb', weapon: 'none', primary: '#2a1f4a', secondary: '#7d5cff', accent: '#e9e0ff', extras: ['stars', 'crystals'], scale: 0.7 },
  },
  rouage_automaton: {
    id: 'rouage_automaton',
    name: 'Automate',
    desc: 'Automate de laiton assemblé par la Fonderie.',
    stats: { hp: 650, ad: 48, as: 0.7, armor: 35, mr: 35, range: 1, mana: [0, 0] },
    look: { body: 'construct', head: 'visor', weapon: 'wrench', primary: '#c48a4a', secondary: '#4a3424', accent: '#ffd27a', extras: ['gears'], scale: 0.85 },
  },
  rouage_sentinel: {
    id: 'rouage_sentinel',
    name: 'Sentinelle',
    desc: 'Sentinelle blindée qui provoque les ennemis adjacents toutes les 4 s.',
    stats: { hp: 1100, ad: 65, as: 0.7, armor: 45, mr: 45, range: 1, mana: [0, 0] },
    passive: {
      triggers: [{ on: 'interval', every: 4, actions: [{ do: 'status', area: { shape: 'circle', at: 'self', radius: 1, side: 'enemies' }, status: { kind: 'taunt', duration: 1.25, tag: 'Provoqué' } }] }],
    },
    look: { body: 'construct', head: 'helm', weapon: 'shield', primary: '#b9824a', secondary: '#3a2a1d', accent: '#ffe08a', extras: ['gears', 'pauldrons'], scale: 1.0 },
  },
  rouage_colossus: {
    id: 'rouage_colossus',
    name: 'Colosse de la Fonderie',
    desc: 'Colosse qui provoque les ennemis proches et frappe le sol toutes les 3 s.',
    stats: { hp: 2600, ad: 95, as: 0.65, armor: 70, mr: 70, range: 1, mana: [0, 0] },
    passive: {
      triggers: [
        {
          on: 'interval',
          every: 3,
          actions: [
            { do: 'damage', area: { shape: 'circle', at: 'self', radius: 1, side: 'enemies' }, amount: { base: 180, noAp: true }, type: 'magic', vfx: 'groundSlam' },
            { do: 'status', area: { shape: 'circle', at: 'self', radius: 1, side: 'enemies' }, status: { kind: 'taunt', duration: 1.5, tag: 'Provoqué' } },
          ],
        },
      ],
    },
    look: { body: 'giant', head: 'visor', weapon: 'hammer', primary: '#c9934e', secondary: '#33251a', accent: '#ffe6a0', extras: ['gears', 'pauldrons'], scale: 1.25 },
  },
};

/** Créatures des manches neutres. Leurs statistiques sont fixes (pas d'étoiles). */
export const CREATURES: Readonly<Record<string, CreatureDef>> = {
  luciole: {
    id: 'luciole',
    name: 'Luciole d’éther',
    stats: { hp: 260, ad: 22, as: 0.7, armor: 5, mr: 5, range: 1, mana: [0, 0] },
    look: { body: 'floating', head: 'orb', weapon: 'none', primary: '#9fe8ff', secondary: '#3a6a9a', accent: '#ffffff', extras: ['aura'], scale: 0.6 },
  },
  golem_quartz: {
    id: 'golem_quartz',
    name: 'Golem de quartz',
    stats: { hp: 650, ad: 35, as: 0.6, armor: 25, mr: 10, range: 1, mana: [0, 0] },
    look: { body: 'construct', head: 'bare', weapon: 'none', primary: '#d6cdf5', secondary: '#7a6fb0', accent: '#ffffff', extras: ['crystals'], scale: 0.95 },
  },
  chimere: {
    id: 'chimere',
    name: 'Chimère des brumes',
    stats: { hp: 780, ad: 48, as: 0.7, armor: 25, mr: 25, range: 1, mana: [0, 0] },
    look: { body: 'quadruped', head: 'beast', weapon: 'claws', primary: '#8b8fb8', secondary: '#3c3f60', accent: '#d2f0ff', extras: ['wings', 'tail'], scale: 1.05 },
  },
  gardien_cristal: {
    id: 'gardien_cristal',
    name: 'Gardien de cristal',
    stats: { hp: 1100, ad: 58, as: 0.65, armor: 45, mr: 45, range: 1, mana: [0, 0] },
    passive: { triggers: [{ on: 'interval', every: 5, actions: [{ do: 'shield', area: { shape: 'self' }, amount: { base: 200, noAp: true }, duration: 3 }] }] },
    look: { body: 'heavy', head: 'helm', weapon: 'shield', primary: '#a5e3f0', secondary: '#3f6f80', accent: '#ffffff', extras: ['crystals'], scale: 1.0 },
  },
  eclat_cristal: {
    id: 'eclat_cristal',
    name: 'Éclat de cristal',
    stats: { hp: 650, ad: 55, as: 0.75, armor: 15, mr: 15, range: 3, mana: [0, 0] },
    attack: { projectile: 'crystalShard', speed: 12 },
    look: { body: 'floating', head: 'orb', weapon: 'none', primary: '#b9f0ff', secondary: '#4e8ea8', accent: '#ffffff', extras: ['crystals'], scale: 0.75 },
  },
  loup_etoile: {
    id: 'loup_etoile',
    name: 'Loup d’ombre-étoile',
    stats: { hp: 1250, ad: 85, as: 0.85, armor: 35, mr: 30, range: 1, mana: [0, 0], moveSpeed: 2.8 },
    look: { body: 'quadruped', head: 'beast', weapon: 'claws', primary: '#3b3566', secondary: '#191632', accent: '#cbbcff', extras: ['stars', 'tail'], scale: 1.0 },
  },
  hydre: {
    id: 'hydre',
    name: 'Hydre des marées noires',
    stats: { hp: 3400, ad: 120, as: 0.6, armor: 60, mr: 60, range: 2, mana: [0, 0] },
    passive: {
      triggers: [
        {
          on: 'interval',
          every: 4,
          actions: [{ do: 'damage', area: { shape: 'circle', at: 'self', radius: 2, side: 'enemies' }, amount: { base: 220, noAp: true }, type: 'magic', vfx: 'wave' }],
        },
      ],
    },
    look: { body: 'serpent', head: 'fins', weapon: 'none', primary: '#1f6f73', secondary: '#0c2a30', accent: '#7ef0e0', extras: ['bubbles', 'tail'], scale: 1.35 },
  },
  drake: {
    id: 'drake',
    name: 'Drake d’Orrhéa',
    stats: { hp: 5200, ad: 160, as: 0.65, armor: 70, mr: 70, range: 2, mana: [0, 0] },
    passive: {
      triggers: [
        {
          on: 'interval',
          every: 3.5,
          actions: [
            { do: 'damage', area: { shape: 'circle', at: 'target', radius: 1, side: 'enemies' }, amount: { base: 320, noAp: true }, type: 'magic', vfx: 'fireWave' },
            { do: 'status', area: { shape: 'circle', at: 'target', radius: 1, side: 'enemies' }, status: { kind: 'burn', duration: 3, dps: { base: 40, noAp: true }, tag: 'Brûlure' } },
          ],
        },
      ],
    },
    look: { body: 'bird', head: 'horns', weapon: 'none', primary: '#c8553d', secondary: '#3a1a14', accent: '#ffcf6b', extras: ['wings', 'embers', 'tail'], scale: 1.45 },
  },
  horloger_spectre: {
    id: 'horloger_spectre',
    name: 'Spectre du Cœur-Horloge',
    stats: { hp: 8000, ad: 210, as: 0.7, armor: 80, mr: 80, range: 2, mana: [0, 0] },
    passive: {
      triggers: [
        {
          on: 'interval',
          every: 5,
          actions: [
            { do: 'status', area: { shape: 'all', side: 'enemies' }, status: { kind: 'stun', duration: 1, tag: 'Figé' } },
            { do: 'damage', area: { shape: 'all', side: 'enemies' }, amount: { base: 260, noAp: true }, type: 'magic', vfx: 'timeStop' },
          ],
        },
      ],
    },
    look: { body: 'floating', head: 'orb', weapon: 'staff', primary: '#d9b45a', secondary: '#2c2348', accent: '#9ff3ff', extras: ['gears', 'aura', 'stars'], scale: 1.5 },
  },
};
