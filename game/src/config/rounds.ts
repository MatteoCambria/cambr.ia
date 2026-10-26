/**
 * Calendrier des manches, rencontres neutres et butins.
 */
import type { Hex } from '../board/hex';

export type RoundKind = 'carousel' | 'pve' | 'pvp';

export interface RoundDef {
  index: number;
  stage: number;
  round: number;
  kind: RoundKind;
  pve?: string;
  label: string;
}

export interface Loot {
  gold?: number;
  components?: number;
  champions?: { cost: number; count: number };
  combined?: number;
  consumables?: string[];
}

export interface PveEncounter {
  id: string;
  name: string;
  units: { defId: string; hex: Hex; level?: number }[];
  loot: Loot;
  /** Butin de consolation en cas de défaite. */
  lossLoot: Loot;
}

export const PVE_ENCOUNTERS: Readonly<Record<string, PveEncounter>> = {
  lucioles: {
    id: 'lucioles',
    name: 'Essaim de lucioles',
    units: [
      { defId: 'luciole', hex: { col: 2, row: 1 } },
      { defId: 'luciole', hex: { col: 4, row: 1 } },
    ],
    loot: { components: 1, gold: 1 },
    lossLoot: { components: 1 },
  },
  golems: {
    id: 'golems',
    name: 'Golems de quartz',
    units: [
      { defId: 'golem_quartz', hex: { col: 2, row: 0 } },
      { defId: 'luciole', hex: { col: 3, row: 2 } },
      { defId: 'golem_quartz', hex: { col: 4, row: 0 } },
    ],
    loot: { components: 1, gold: 2 },
    lossLoot: { components: 1 },
  },
  chimeres: {
    id: 'chimeres',
    name: 'Chimères des brumes',
    units: [
      { defId: 'chimere', hex: { col: 2, row: 0 } },
      { defId: 'chimere', hex: { col: 4, row: 0 } },
      { defId: 'golem_quartz', hex: { col: 3, row: 1 } },
    ],
    loot: { components: 1, champions: { cost: 2, count: 1 }, gold: 1 },
    lossLoot: { components: 1 },
  },
  cristaux: {
    id: 'cristaux',
    name: 'Gardiens de cristal',
    units: [
      { defId: 'gardien_cristal', hex: { col: 2, row: 0 } },
      { defId: 'gardien_cristal', hex: { col: 4, row: 0 } },
      { defId: 'eclat_cristal', hex: { col: 1, row: 3 } },
      { defId: 'eclat_cristal', hex: { col: 5, row: 3 } },
    ],
    loot: { components: 2, gold: 2 },
    lossLoot: { components: 1 },
  },
  loups: {
    id: 'loups',
    name: 'Meute d’ombre-étoile',
    units: [
      { defId: 'loup_etoile', hex: { col: 1, row: 0 } },
      { defId: 'loup_etoile', hex: { col: 3, row: 0 } },
      { defId: 'loup_etoile', hex: { col: 5, row: 0 } },
      { defId: 'loup_etoile', hex: { col: 2, row: 1 } },
      { defId: 'loup_etoile', hex: { col: 4, row: 1 } },
    ],
    loot: { components: 1, combined: 1, gold: 3 },
    lossLoot: { components: 1 },
  },
  hydre: {
    id: 'hydre',
    name: 'Hydre des marées noires',
    units: [
      { defId: 'hydre', hex: { col: 3, row: 1 } },
      { defId: 'eclat_cristal', hex: { col: 1, row: 3 }, level: 1.6 },
      { defId: 'eclat_cristal', hex: { col: 5, row: 3 }, level: 1.6 },
    ],
    loot: { combined: 1, champions: { cost: 4, count: 1 }, gold: 3 },
    lossLoot: { components: 1, gold: 2 },
  },
  drake: {
    id: 'drake',
    name: 'Drake d’Orrhéa',
    units: [{ defId: 'drake', hex: { col: 3, row: 1 } }],
    loot: { combined: 1, champions: { cost: 5, count: 1 }, consumables: ['cle_demontage'] },
    lossLoot: { components: 1, gold: 3 },
  },
  spectre: {
    id: 'spectre',
    name: 'Spectre du Cœur-Horloge',
    units: [
      { defId: 'horloger_spectre', hex: { col: 3, row: 1 } },
      { defId: 'loup_etoile', hex: { col: 1, row: 0 }, level: 1.8 },
      { defId: 'loup_etoile', hex: { col: 5, row: 0 }, level: 1.8 },
    ],
    loot: { combined: 2, gold: 5 },
    lossLoot: { gold: 4 },
  },
};

const PVE_BY_STAGE: Record<number, string> = { 2: 'cristaux', 3: 'loups', 4: 'hydre', 5: 'drake', 6: 'spectre' };

/** Construit le calendrier jusqu'à l'étape maxStage (les étapes suivantes répètent le dernier modèle). */
export function buildSchedule(maxStage = 9): RoundDef[] {
  const out: RoundDef[] = [];
  const push = (stage: number, round: number, kind: RoundKind, pve?: string) =>
    out.push({ index: out.length, stage, round, kind, pve, label: `${stage}-${round}` });
  push(1, 1, 'carousel');
  push(1, 2, 'pve', 'lucioles');
  push(1, 3, 'pve', 'golems');
  push(1, 4, 'pve', 'chimeres');
  for (let s = 2; s <= maxStage; s++) {
    push(s, 1, 'pvp');
    push(s, 2, 'pvp');
    push(s, 3, 'pvp');
    push(s, 4, 'carousel');
    push(s, 5, 'pvp');
    push(s, 6, 'pvp');
    push(s, 7, 'pve', PVE_BY_STAGE[s] ?? 'spectre');
  }
  return out;
}

export const SCHEDULE: readonly RoundDef[] = buildSchedule(12);

export function roundAt(index: number): RoundDef {
  return SCHEDULE[Math.min(index, SCHEDULE.length - 1)];
}

/** Coûts proposés au carrousel selon l'étape. */
export function carouselCosts(stage: number): number[] {
  if (stage <= 1) return [1];
  if (stage === 2) return [1, 2, 2];
  if (stage === 3) return [2, 3, 3];
  if (stage === 4) return [3, 3, 4];
  return [3, 4, 4, 5];
}
