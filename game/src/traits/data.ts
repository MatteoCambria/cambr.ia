/**
 * Synergies (traits) : 8 origines (Sphères d'Orrhéa) et 10 classes.
 * Chaque palier est déclaratif : effets sur les porteurs, l'équipe ou un « meneur ».
 */
import type { TraitDef } from '../core/defs';

export const TRAITS: readonly TraitDef[] = [
  // ── Origines ──────────────────────────────────────────────────────────────
  {
    id: 'zenith',
    name: 'Zénith',
    kind: 'origin',
    color: '#f2c14e',
    icon: 'zenith',
    desc: "Au début du combat, les champions du Zénith reçoivent un bouclier proportionnel à leurs PV max.",
    lore: "Les chevaliers de la Sphère solaire jurent de tenir la ligne tant que l'aube n'est pas levée.",
    counter: 'Les dégâts bruts et les exécutions contournent les boucliers ; attendre leur expiration (8 s) avant de s’engager.',
    thresholds: [2, 4, 6],
    levels: [
      {
        desc: 'Bouclier de 25 % des PV max pendant 8 s.',
        holders: { triggers: [{ on: 'combatStart', actions: [{ do: 'shield', area: { shape: 'self' }, amount: { targetHp: 25 }, duration: 8, vfx: 'sunShield' }] }] },
      },
      {
        desc: 'Bouclier de 40 % des PV max. Quand un bouclier d’un champion du Zénith se brise, il libère un éclat de 160 dégâts magiques autour de lui.',
        holders: {
          triggers: [
            { on: 'combatStart', actions: [{ do: 'shield', area: { shape: 'self' }, amount: { targetHp: 40 }, duration: 8, vfx: 'sunShield' }] },
            { on: 'shieldBroken', icd: 2, actions: [{ do: 'damage', area: { shape: 'circle', at: 'self', radius: 1, side: 'enemies' }, amount: { base: 160 }, type: 'magic', vfx: 'sunFlash' }] },
          ],
        },
      },
      {
        desc: 'Bouclier de 55 % des PV max et éclat de 280 dégâts. Tous les autres alliés reçoivent un bouclier de 20 % de leurs PV max.',
        holders: {
          triggers: [
            { on: 'combatStart', actions: [{ do: 'shield', area: { shape: 'self' }, amount: { targetHp: 55 }, duration: 8, vfx: 'sunShield' }] },
            { on: 'shieldBroken', icd: 2, actions: [{ do: 'damage', area: { shape: 'circle', at: 'self', radius: 1, side: 'enemies' }, amount: { base: 280 }, type: 'magic', vfx: 'sunFlash' }] },
          ],
        },
        team: { triggers: [{ on: 'combatStart', cond: { c: 'not', cond: { c: 'selfHasTrait', trait: 'zenith' } }, actions: [{ do: 'shield', area: { shape: 'self' }, amount: { targetHp: 20 }, duration: 8 }] }] },
      },
    ],
  },
  {
    id: 'selene',
    name: 'Sélène',
    kind: 'origin',
    color: '#b9a7f5',
    icon: 'selene',
    desc: "Les champions de Sélène se soignent en infligeant des dégâts ; la marée lunaire soigne régulièrement l’allié le plus blessé.",
    lore: "Sur la Sphère lunaire, chaque blessure est un reflet que la marée finit par effacer.",
    counter: 'Les Blessures (réduction des soins) et les dégâts concentrés en rafale empêchent la marée de compenser.',
    thresholds: [2, 4, 6],
    levels: [
      {
        desc: '10 % d’omnivampirisme pour les champions de Sélène. Toutes les 3 s, l’allié le plus blessé récupère 70 PV.',
        holders: { stats: [{ stat: 'omnivamp', value: 10 }] },
        leader: { triggers: [{ on: 'interval', every: 3, actions: [{ do: 'heal', area: { shape: 'select', sel: 'lowestHpPctAlly' }, amount: { base: 70, noAp: true }, vfx: 'moonTide' }] }] },
      },
      {
        desc: '18 % d’omnivampirisme. Toutes les 3 s, l’allié le plus blessé récupère 140 PV.',
        holders: { stats: [{ stat: 'omnivamp', value: 18 }] },
        leader: { triggers: [{ on: 'interval', every: 3, actions: [{ do: 'heal', area: { shape: 'select', sel: 'lowestHpPctAlly' }, amount: { base: 140, noAp: true }, vfx: 'moonTide' }] }] },
      },
      {
        desc: '30 % d’omnivampirisme. Toutes les 2 s, les deux alliés les plus blessés récupèrent 180 PV.',
        holders: { stats: [{ stat: 'omnivamp', value: 30 }] },
        leader: { triggers: [{ on: 'interval', every: 2, actions: [{ do: 'heal', area: { shape: 'lowestHpAllies', count: 2 }, amount: { base: 180, noAp: true }, vfx: 'moonTide' }] }] },
      },
    ],
  },
  {
    id: 'rouage',
    name: 'Rouage',
    kind: 'origin',
    color: '#d08a4c',
    icon: 'rouage',
    desc: "Au début du combat, le champion Rouage le plus en retrait assemble un automate à ses côtés. Les Rouages gagnent de la vitesse d’attaque.",
    lore: "La Fonderie n’a jamais cessé de produire, même lorsque le Cœur-Horloge s’est figé.",
    counter: 'Les dégâts de zone détruisent l’automate et les Rouages fragiles d’un même geste ; viser le Rouage le plus en retrait.',
    thresholds: [2, 4, 6],
    levels: [
      {
        desc: 'Automate (650 PV). Les Rouages gagnent 10 % de vitesse d’attaque.',
        holders: { stats: [{ stat: 'asPct', value: 10 }] },
        leader: { triggers: [{ on: 'combatStart', actions: [{ do: 'summon', unit: 'rouage_automaton', at: 'front', level: 1, vfx: 'gearAssemble' }] }] },
      },
      {
        desc: 'Sentinelle (≈1 100 PV) qui provoque les ennemis adjacents toutes les 4 s. Les Rouages gagnent 15 % de vitesse d’attaque.',
        holders: { stats: [{ stat: 'asPct', value: 15 }] },
        leader: { triggers: [{ on: 'combatStart', actions: [{ do: 'summon', unit: 'rouage_sentinel', at: 'front', level: 1, vfx: 'gearAssemble' }] }] },
      },
      {
        desc: 'Colosse (≈2 600 PV) qui provoque et frappe le sol toutes les 3 s. Les Rouages gagnent 30 % de vitesse d’attaque.',
        holders: { stats: [{ stat: 'asPct', value: 30 }] },
        leader: { triggers: [{ on: 'combatStart', actions: [{ do: 'summon', unit: 'rouage_colossus', at: 'front', level: 1, vfx: 'gearAssemble' }] }] },
      },
    ],
  },
  {
    id: 'sylve',
    name: 'Sylve',
    kind: 'origin',
    color: '#6fbf5a',
    icon: 'sylve',
    desc: "Toutes les 3 secondes, les champions de la Sylve grandissent : ils gagnent des PV max (et se soignent d’autant).",
    lore: "La forêt-monde pousse sur la Sphère verte depuis avant le premier tic-tac.",
    counter: 'Une composition qui gagne vite (assassins, rafales) prive la Sylve du temps de croissance ; les dégâts en % des PV restent efficaces.',
    thresholds: [2, 4, 6],
    levels: [
      {
        desc: '+5,5 % PV max toutes les 3 s (8 fois max).',
        holders: { triggers: [{ on: 'interval', every: 3, actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'sylve_growth', stack: 'stack', maxStacks: 8, stats: [{ stat: 'hpPct', value: 5.5 }], tag: 'Croissance' } }] }] },
      },
      {
        desc: '+7 % PV max toutes les 3 s (8 fois max).',
        holders: { triggers: [{ on: 'interval', every: 3, actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'sylve_growth', stack: 'stack', maxStacks: 8, stats: [{ stat: 'hpPct', value: 7 }], tag: 'Croissance' } }] }] },
      },
      {
        desc: '+10 % PV max, +5 % PA et +5 Puissance toutes les 3 s (8 fois max).',
        holders: {
          triggers: [
            {
              on: 'interval',
              every: 3,
              actions: [
                {
                  do: 'status',
                  area: { shape: 'self' },
                  status: { kind: 'stats', duration: 0, id: 'sylve_growth', stack: 'stack', maxStacks: 8, stats: [{ stat: 'hpPct', value: 10 }, { stat: 'adPct', value: 5 }, { stat: 'ap', value: 5 }], tag: 'Croissance' },
                },
              ],
            },
          ],
        },
      },
    ],
  },
  {
    id: 'abysse',
    name: 'Abysse',
    kind: 'origin',
    color: '#3fb7b0',
    icon: 'abysse',
    desc: "Les dégâts infligés par les champions de l’Abysse noient (exécutent) les ennemis sous un seuil de PV.",
    lore: "Ceux qui sombrent dans la Sphère des marées noires n’en remontent jamais.",
    counter: 'Les boucliers et les gros soins éloignent les unités du seuil ; les Gardiens et Briseurs résistent mieux.',
    thresholds: [2, 4, 6],
    levels: [
      {
        desc: 'Exécute les ennemis sous 12 % de PV.',
        holders: { triggers: [{ on: 'damageDealt', cond: { c: 'targetHpBelow', pct: 12 }, actions: [{ do: 'execute', threshold: 12, vfx: 'drown' }] }] },
      },
      {
        desc: 'Exécute les ennemis sous 20 % de PV.',
        holders: { triggers: [{ on: 'damageDealt', cond: { c: 'targetHpBelow', pct: 20 }, actions: [{ do: 'execute', threshold: 20, vfx: 'drown' }] }] },
      },
      {
        desc: 'Exécute sous 25 % de PV, et tous les alliés exécutent sous 12 %.',
        holders: { triggers: [{ on: 'damageDealt', cond: { c: 'targetHpBelow', pct: 25 }, actions: [{ do: 'execute', threshold: 25, vfx: 'drown' }] }] },
        team: { triggers: [{ on: 'damageDealt', cond: { c: 'targetHpBelow', pct: 12 }, actions: [{ do: 'execute', threshold: 12, vfx: 'drown' }] }] },
      },
    ],
  },
  {
    id: 'braise',
    name: 'Braise',
    kind: 'origin',
    color: '#f0743e',
    icon: 'braise',
    desc: "Les attaques des champions de Braise brûlent la cible (dégâts en % des PV max, Blessure). Chaque allié tombé attise leur colère.",
    lore: "Les Cendrés ont brûlé une première fois. Ils ne craignent plus le feu, seulement l’oubli.",
    counter: 'Les compositions à forte armure de PV peinent face aux brûlures ; privilégier la protection magique et tuer les Braises avant que les alliés ne tombent.',
    thresholds: [2, 4, 6],
    levels: [
      {
        desc: 'Brûlure : 1 % des PV max par seconde pendant 3 s (Blessure −33 %). +5 % de dégâts à chaque allié tombé.',
        holders: {
          triggers: [
            { on: 'attack', actions: [{ do: 'status', status: { kind: 'burn', duration: 3, id: 'braise_burn', dps: { targetHp: 1 }, stats: [{ stat: 'healReceived', value: -33 }], tag: 'Brûlure' } }] },
            { on: 'allyDeath', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'braise_rage', stack: 'stack', maxStacks: 6, stats: [{ stat: 'damageAmp', value: 5 }], tag: 'Colère' } }] },
          ],
        },
      },
      {
        desc: 'Brûlure : 1,2 % des PV max par seconde. +10 % de dégâts à chaque allié tombé.',
        holders: {
          triggers: [
            { on: 'attack', actions: [{ do: 'status', status: { kind: 'burn', duration: 3, id: 'braise_burn', dps: { targetHp: 1.2 }, stats: [{ stat: 'healReceived', value: -33 }], tag: 'Brûlure' } }] },
            { on: 'allyDeath', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'braise_rage', stack: 'stack', maxStacks: 6, stats: [{ stat: 'damageAmp', value: 10 }], tag: 'Colère' } }] },
          ],
        },
      },
      {
        desc: 'Brûlure : 2,5 % des PV max par seconde. +15 % de dégâts à chaque allié tombé.',
        holders: {
          triggers: [
            { on: 'attack', actions: [{ do: 'status', status: { kind: 'burn', duration: 3, id: 'braise_burn', dps: { targetHp: 2.5 }, stats: [{ stat: 'healReceived', value: -33 }], tag: 'Brûlure' } }] },
            { on: 'allyDeath', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'braise_rage', stack: 'stack', maxStacks: 6, stats: [{ stat: 'damageAmp', value: 15 }], tag: 'Colère' } }] },
          ],
        },
      },
    ],
  },
  {
    id: 'nomade',
    name: 'Nomade',
    kind: 'origin',
    color: '#4fc9d8',
    icon: 'nomade',
    desc: "Synergie économique : or supplémentaire après chaque combat contre un Archonte, et des composants d’objets au fil des victoires. Les Nomades démarrent le combat portés par le vent.",
    lore: "Les caravanes célestes relient toutes les Sphères. Tout s’y vend, même le vent.",
    counter: 'Les Nomades sont faibles au combat : les punir tôt (forte pression en début de partie) les empêche de capitaliser.',
    thresholds: [2, 4, 6],
    levels: [
      {
        desc: '+1 or après chaque combat contre un Archonte. Les Nomades gagnent 15 % de vitesse d’attaque et 25 % de vitesse de déplacement pendant 6 s.',
        economy: { goldAfterCombat: 1 },
        holders: { triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 6, id: 'nomade_wind', stats: [{ stat: 'asPct', value: 15 }, { stat: 'moveSpeedPct', value: 25 }], tag: 'Vent porteur' } }] }] },
      },
      {
        desc: '+2 or après chaque combat contre un Archonte et un composant toutes les 3 victoires. 22 % de vitesse d’attaque pendant 6 s.',
        economy: { goldAfterCombat: 2, componentEveryNWins: 3 },
        holders: { triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 6, id: 'nomade_wind', stats: [{ stat: 'asPct', value: 22 }, { stat: 'moveSpeedPct', value: 25 }], tag: 'Vent porteur' } }] }] },
      },
      {
        desc: '+3 or après chaque combat contre un Archonte et un composant toutes les 2 victoires. 32 % de vitesse d’attaque pendant 6 s.',
        economy: { goldAfterCombat: 3, componentEveryNWins: 2 },
        holders: { triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 6, id: 'nomade_wind', stats: [{ stat: 'asPct', value: 32 }, { stat: 'moveSpeedPct', value: 25 }], tag: 'Vent porteur' } }] }] },
      },
    ],
  },
  {
    id: 'astral',
    name: 'Astral',
    kind: 'origin',
    color: '#9b6bff',
    icon: 'astral',
    desc: "Les entités astrales refusent la mort : la première fois qu’elles devraient tomber, elles renaissent sous forme d’étoile.",
    lore: "Venus d’au-delà du cadran, les Astraux ne connaissent ni l’heure ni la fin.",
    counter: 'Les exécutions et les dégâts répartis (plusieurs cibles) obligent chaque Astral à mourir deux fois ; concentrer sur un seul est inefficace.',
    thresholds: [2, 4, 6],
    levels: [
      {
        desc: 'Le premier champion Astral qui devrait mourir renaît avec 30 % de ses PV (1 fois par combat).',
        leader: {
          triggers: [
            {
              on: 'allyLethal',
              cond: { c: 'all', conds: [{ c: 'targetHasTrait', trait: 'astral' }, { c: 'not', cond: { c: 'counterAtLeast', name: 'astral_used', value: 1 } }] },
              actions: [{ do: 'preventDeath', hpPct: 30, invulnerable: 1, vfx: 'starRebirth' }, { do: 'counter', name: 'astral_used', add: 1 }],
            },
            {
              on: 'lethal',
              cond: { c: 'not', cond: { c: 'counterAtLeast', name: 'astral_used', value: 1 } },
              actions: [{ do: 'preventDeath', hpPct: 30, invulnerable: 1, vfx: 'starRebirth' }, { do: 'counter', name: 'astral_used', add: 1 }],
            },
          ],
        },
      },
      {
        desc: 'Chaque champion Astral renaît une fois avec 30 % de ses PV.',
        holders: { triggers: [{ on: 'lethal', once: true, actions: [{ do: 'preventDeath', hpPct: 30, invulnerable: 1, vfx: 'starRebirth' }] }] },
      },
      {
        desc: 'Chaque champion Astral renaît une fois avec 45 % de ses PV et gagne 30 Puissance.',
        holders: {
          triggers: [
            {
              on: 'lethal',
              once: true,
              actions: [
                { do: 'preventDeath', hpPct: 45, invulnerable: 1, vfx: 'starRebirth' },
                { do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'astral_reborn', stats: [{ stat: 'ap', value: 30 }], tag: 'Étoile renée' } },
              ],
            },
          ],
        },
      },
    ],
  },

  // ── Classes ───────────────────────────────────────────────────────────────
  {
    id: 'gardien',
    name: 'Gardien',
    kind: 'class',
    color: '#c9b37a',
    icon: 'gardien',
    desc: "Les Gardiens gagnent de l’armure et de la résistance magique, et en confèrent aux alliés placés à côté d’eux au début du combat.",
    lore: "Un Gardien ne recule pas : il choisit où se tenir, et protège ceux qui l’entourent.",
    counter: 'Les dégâts bruts, la Brèche et la Corrosion annulent leurs résistances ; contourner par des assassins.',
    thresholds: [2, 4, 6],
    levels: [
      {
        desc: 'Gardiens : +30 armure et RM. Alliés adjacents au début du combat : +15.',
        holders: {
          stats: [{ stat: 'armor', value: 30 }, { stat: 'mr', value: 30 }],
          triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'adjacentAllies' }, status: { kind: 'stats', duration: 0, id: 'gardien_aura', stats: [{ stat: 'armor', value: 15 }, { stat: 'mr', value: 15 }], tag: 'Rempart' } }] }],
        },
      },
      {
        desc: 'Gardiens : +42 armure et RM. Alliés adjacents : +22.',
        holders: {
          stats: [{ stat: 'armor', value: 42 }, { stat: 'mr', value: 42 }],
          triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'adjacentAllies' }, status: { kind: 'stats', duration: 0, id: 'gardien_aura', stats: [{ stat: 'armor', value: 22 }, { stat: 'mr', value: 22 }], tag: 'Rempart' } }] }],
        },
      },
      {
        desc: 'Gardiens : +70 armure et RM. Alliés adjacents : +35.',
        holders: {
          stats: [{ stat: 'armor', value: 70 }, { stat: 'mr', value: 70 }],
          triggers: [{ on: 'combatStart', actions: [{ do: 'status', area: { shape: 'adjacentAllies' }, status: { kind: 'stats', duration: 0, id: 'gardien_aura', stats: [{ stat: 'armor', value: 35 }, { stat: 'mr', value: 35 }], tag: 'Rempart' } }] }],
        },
      },
    ],
  },
  {
    id: 'briseur',
    name: 'Briseur',
    kind: 'class',
    color: '#c45b4a',
    icon: 'briseur',
    desc: "Toute l’équipe gagne des PV max ; les Briseurs en gagnent beaucoup plus.",
    lore: "Les Briseurs encaissent pour que les autres puissent frapper.",
    counter: 'Les dégâts en pourcentage des PV (brûlure, Singularité) et les exécutions punissent les grosses réserves de PV.',
    thresholds: [2, 4, 6],
    levels: [
      { desc: 'Équipe : +100 PV. Briseurs : +20 % PV max.', team: { stats: [{ stat: 'hp', value: 100 }] }, holders: { stats: [{ stat: 'hpPct', value: 20 }] } },
      { desc: 'Équipe : +120 PV. Briseurs : +25 % PV max.', team: { stats: [{ stat: 'hp', value: 120 }] }, holders: { stats: [{ stat: 'hpPct', value: 25 }] } },
      { desc: 'Équipe : +200 PV. Briseurs : +50 % PV max.', team: { stats: [{ stat: 'hp', value: 200 }] }, holders: { stats: [{ stat: 'hpPct', value: 50 }] } },
    ],
  },
  {
    id: 'duelliste',
    name: 'Duelliste',
    kind: 'class',
    color: '#e0a03a',
    icon: 'duelliste',
    desc: "Chaque attaque d’un Duelliste lui confère de la vitesse d’attaque, cumulable 10 fois.",
    lore: "Le duel est une conversation : chaque échange accélère la suivante.",
    counter: 'Les étourdissements et le désarmement coupent la montée en puissance ; les dégâts de zone tuent avant les cumuls.',
    thresholds: [2, 4, 6],
    levels: [
      { desc: '+6 % de vitesse d’attaque par attaque (10 fois).', holders: { triggers: [{ on: 'attack', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'duel', stack: 'stack', maxStacks: 10, stats: [{ stat: 'asPct', value: 6 }], tag: 'Fièvre du duel' } }] }] } },
      { desc: '+8 % de vitesse d’attaque par attaque (10 fois).', holders: { triggers: [{ on: 'attack', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'duel', stack: 'stack', maxStacks: 10, stats: [{ stat: 'asPct', value: 8 }], tag: 'Fièvre du duel' } }] }] } },
      {
        desc: '+11 % de vitesse d’attaque par attaque (10 fois) et 12 % d’omnivampirisme.',
        holders: {
          stats: [{ stat: 'omnivamp', value: 12 }],
          triggers: [{ on: 'attack', actions: [{ do: 'status', area: { shape: 'self' }, status: { kind: 'stats', duration: 0, id: 'duel', stack: 'stack', maxStacks: 10, stats: [{ stat: 'asPct', value: 11 }], tag: 'Fièvre du duel' } }] }],
        },
      },
    ],
  },
  {
    id: 'assassin',
    name: 'Assassin',
    kind: 'class',
    color: '#8e5ad6',
    icon: 'assassin',
    desc: "Au début du combat, les Assassins bondissent sur la ligne arrière ennemie. Leurs compétences peuvent être critiques.",
    lore: "La ligne de front n’est qu’un décor. Le vrai combat se joue derrière.",
    counter: 'Placer ses unités fragiles au centre, entourées d’alliés, et des Gardiens près d’elles ; les contrôles à l’atterrissage les neutralisent.',
    thresholds: [2, 4],
    levels: [
      {
        desc: '+10 % de chances de coup critique et +15 % de dégâts critiques.',
        holders: {
          stats: [{ stat: 'critChance', value: 10 }, { stat: 'critDamage', value: 15 }, { stat: 'abilityCrit', value: 1 }],
          triggers: [{ on: 'combatStart', actions: [{ do: 'move', mode: 'leapBackline', untargetable: true, vfx: 'shadowLeap' }] }],
        },
      },
      {
        desc: '+16 % de chances de coup critique et +20 % de dégâts critiques.',
        holders: {
          stats: [{ stat: 'critChance', value: 16 }, { stat: 'critDamage', value: 20 }, { stat: 'abilityCrit', value: 1 }],
          triggers: [{ on: 'combatStart', actions: [{ do: 'move', mode: 'leapBackline', untargetable: true, vfx: 'shadowLeap' }] }],
        },
      },
    ],
  },
  {
    id: 'tireur',
    name: 'Tireur',
    kind: 'class',
    color: '#7fb3e8',
    icon: 'tireur',
    desc: "Les Tireurs infligent davantage de dégâts pour chaque hexagone qui les sépare de leur cible.",
    lore: "La distance est une arme ; les Tireurs la cultivent.",
    counter: 'Les assassins, les harpons et les attirances réduisent la distance ; placer ses tanks près de leur ligne.',
    thresholds: [2, 4, 6],
    levels: [
      { desc: '+7 % de dégâts par hexagone de distance.', holders: { stats: [{ stat: 'dmgPerHex', value: 7 }] } },
      { desc: '+10 % de dégâts par hexagone de distance.', holders: { stats: [{ stat: 'dmgPerHex', value: 10 }] } },
      { desc: '+15 % de dégâts par hexagone de distance.', holders: { stats: [{ stat: 'dmgPerHex', value: 15 }] } },
    ],
  },
  {
    id: 'arcaniste',
    name: 'Arcaniste',
    kind: 'class',
    color: '#5b8cff',
    icon: 'arcaniste',
    desc: "Toute l’équipe gagne de la Puissance ; les Arcanistes en gagnent bien davantage.",
    lore: "L’Observatoire enseigne que toute étoile est une équation qu’on peut réécrire.",
    counter: 'La résistance magique, le silence et les interruptions de mana neutralisent les Arcanistes.',
    thresholds: [2, 4, 6],
    levels: [
      { desc: 'Équipe : +10 Puissance. Arcanistes : +20.', team: { stats: [{ stat: 'ap', value: 10 }] }, holders: { stats: [{ stat: 'ap', value: 20 }] } },
      { desc: 'Équipe : +20 Puissance. Arcanistes : +45.', team: { stats: [{ stat: 'ap', value: 20 }] }, holders: { stats: [{ stat: 'ap', value: 45 }] } },
      { desc: 'Équipe : +30 Puissance. Arcanistes : +80.', team: { stats: [{ stat: 'ap', value: 30 }] }, holders: { stats: [{ stat: 'ap', value: 80 }] } },
    ],
  },
  {
    id: 'invocateur',
    name: 'Invocateur',
    kind: 'class',
    color: '#5fd1a0',
    icon: 'invocateur',
    desc: "Les invocations des Invocateurs sont plus puissantes, et les Invocateurs commencent le combat avec du mana.",
    lore: "Invoquer, c’est convaincre le monde de prêter un corps à une idée.",
    counter: 'Les dégâts de zone et les exécutions dispersent les invocations ; frapper directement l’Invocateur.',
    thresholds: [2, 4],
    levels: [
      { desc: 'Invocations +20 % (PV et dégâts). +10 mana de départ.', holders: { stats: [{ stat: 'summonPower', value: 20 }, { stat: 'mana', value: 10 }] } },
      { desc: 'Invocations +55 %. +30 mana de départ.', holders: { stats: [{ stat: 'summonPower', value: 55 }, { stat: 'mana', value: 30 }] } },
    ],
  },
  {
    id: 'oracle',
    name: 'Oracle',
    kind: 'class',
    color: '#ffd9a0',
    icon: 'oracle',
    desc: "Toute l’équipe régénère du mana ; les soins et boucliers des Oracles sont renforcés.",
    lore: "Les Oracles entendent le battement du Cœur-Horloge, et le donnent aux autres.",
    counter: 'Les Blessures et le silence ; tuer les Oracles en premier avec des assassins.',
    thresholds: [2, 4],
    levels: [
      { desc: 'Équipe : +1 mana par seconde. Oracles : soins et boucliers +20 %.', team: { stats: [{ stat: 'manaRegen', value: 1 }] }, holders: { stats: [{ stat: 'healPower', value: 20 }] } },
      { desc: 'Équipe : +2 mana par seconde. Oracles : soins et boucliers +35 %.', team: { stats: [{ stat: 'manaRegen', value: 2 }] }, holders: { stats: [{ stat: 'healPower', value: 35 }] } },
    ],
  },
  {
    id: 'alchimiste',
    name: 'Alchimiste',
    kind: 'class',
    color: '#a6d65a',
    icon: 'alchimiste',
    desc: "Les dégâts des compétences des Alchimistes corrodent la cible : armure et résistance magique réduites.",
    lore: "Tout se dissout, il suffit de trouver le bon solvant.",
    counter: 'Les boucliers absorbent les dégâts avant la corrosion ; les contrôles empêchent les Alchimistes de lancer leurs compétences.',
    thresholds: [2, 4],
    levels: [
      {
        desc: 'Les Alchimistes gagnent 15 Puissance. Corrosion : −35 % d’armure et de RM pendant 4 s.',
        holders: {
          stats: [{ stat: 'ap', value: 15 }],
          triggers: [{ on: 'abilityHit', actions: [{ do: 'status', status: { kind: 'stats', duration: 4, id: 'corrosion', stats: [{ stat: 'armorPct', value: -35 }, { stat: 'mrPct', value: -35 }], tag: 'Corrosion' } }] }],
        },
      },
      {
        desc: 'Les Alchimistes gagnent 35 Puissance. Corrosion : −50 % d’armure et de RM pendant 4 s, et Blessure (−33 % de soins).',
        holders: {
          stats: [{ stat: 'ap', value: 35 }],
          triggers: [
            {
              on: 'abilityHit',
              actions: [{ do: 'status', status: { kind: 'stats', duration: 4, id: 'corrosion', stats: [{ stat: 'armorPct', value: -50 }, { stat: 'mrPct', value: -50 }, { stat: 'healReceived', value: -33 }], tag: 'Corrosion' } }],
            },
          ],
        },
      },
    ],
  },
  {
    id: 'artilleur',
    name: 'Artilleur',
    kind: 'class',
    color: '#d6b25a',
    icon: 'artilleur',
    desc: "Toutes les 2 attaques, l’Artilleur tire un obus qui touche les ennemis autour de sa cible.",
    lore: "Les Artilleurs considèrent que les ennemis regroupés sont une invitation.",
    counter: 'Espacer ses unités ; les assassins et harpons atteignent facilement les Artilleurs immobiles.',
    thresholds: [2, 4],
    levels: [
      {
        desc: 'Toutes les 2 attaques, obus : 110 % de la PA en dégâts physiques aux ennemis adjacents à la cible.',
        holders: { triggers: [{ on: 'nthAttack', every: 2, actions: [{ do: 'damage', area: { shape: 'circle', at: 'target', radius: 1, side: 'enemies', excludeTarget: true }, amount: { ad: 110 }, type: 'physical', vfx: 'shell' }] }] },
      },
      {
        desc: 'Toutes les 2 attaques, obus : 150 % de la PA. Les Artilleurs gagnent 15 % de vitesse d’attaque.',
        holders: {
          stats: [{ stat: 'asPct', value: 15 }],
          triggers: [{ on: 'nthAttack', every: 2, actions: [{ do: 'damage', area: { shape: 'circle', at: 'target', radius: 1, side: 'enemies', excludeTarget: true }, amount: { ad: 150 }, type: 'physical', vfx: 'shell' }] }],
        },
      },
    ],
  },
];
