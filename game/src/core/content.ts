/**
 * Registre central du contenu : index par identifiant, recettes d'objets.
 */
import type { ChampionDef, ItemDef, TraitDef } from './defs';
import { ZENITH } from '../champions/data/zenith';
import { SELENE } from '../champions/data/selene';
import { ROUAGE } from '../champions/data/rouage';
import { SYLVE } from '../champions/data/sylve';
import { ABYSSE } from '../champions/data/abysse';
import { BRAISE } from '../champions/data/braise';
import { NOMADE } from '../champions/data/nomade';
import { ASTRAL } from '../champions/data/astral';
import { TRAITS } from '../traits/data';
import { ITEMS, COMPONENTS, COMBINED, CONSUMABLES, type ConsumableDef } from '../items/data';
import { SUMMONS, CREATURES } from '../creatures/data';

export const CHAMPIONS: readonly ChampionDef[] = [...ZENITH, ...SELENE, ...ROUAGE, ...SYLVE, ...ABYSSE, ...BRAISE, ...NOMADE, ...ASTRAL];

const championById = new Map(CHAMPIONS.map((c) => [c.id, c]));
const traitById = new Map(TRAITS.map((t) => [t.id, t]));
const itemById = new Map(ITEMS.map((i) => [i.id, i]));
const recipes = new Map<string, ItemDef>();
for (const it of COMBINED) {
  if (!it.recipe) continue;
  recipes.set(recipeKey(it.recipe[0], it.recipe[1]), it);
}

function recipeKey(a: string, b: string): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}

export function getChampion(id: string): ChampionDef {
  const c = championById.get(id);
  if (!c) throw new Error(`Champion inconnu : ${id}`);
  return c;
}

export function findChampion(id: string): ChampionDef | undefined {
  return championById.get(id);
}

export function getTrait(id: string): TraitDef {
  const t = traitById.get(id);
  if (!t) throw new Error(`Synergie inconnue : ${id}`);
  return t;
}

export function getItem(id: string): ItemDef {
  const i = itemById.get(id);
  if (!i) throw new Error(`Objet inconnu : ${id}`);
  return i;
}

export function findItem(id: string): ItemDef | undefined {
  return itemById.get(id);
}

/** Objet obtenu en combinant deux composants, ou undefined. */
export function combine(a: string, b: string): ItemDef | undefined {
  return recipes.get(recipeKey(a, b));
}

export function isComponent(id: string): boolean {
  return itemById.get(id)?.kind === 'component';
}

export function championsByCost(cost: number): ChampionDef[] {
  return CHAMPIONS.filter((c) => c.cost === cost);
}

export function championsWithTrait(trait: string): ChampionDef[] {
  return CHAMPIONS.filter((c) => c.traits.includes(trait));
}

export function findConsumable(id: string): ConsumableDef | undefined {
  return CONSUMABLES.find((c) => c.id === id);
}

export { TRAITS, ITEMS, COMPONENTS, COMBINED, CONSUMABLES, SUMMONS, CREATURES };
export type { ConsumableDef };
