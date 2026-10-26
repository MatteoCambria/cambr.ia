/**
 * Construction d'un combat à partir de deux plateaux : calcul des synergies actives,
 * application des objets, passifs de champions et effets de synergie.
 */
import type { Hex } from '../board/hex';
import { prepToCombat } from '../board/hex';
import { CREATURES, SUMMONS, getChampion, getItem, getTrait, TRAITS } from '../core/content';
import type { ChampionDef } from '../core/defs';
import { CombatSim, type PassiveAttach } from './sim';
import type { ResolvedMod, SideId, UnitIdentity } from './unit';
import { val } from './values';

export interface BoardUnitSpec {
  uid?: string;
  defId: string;
  star: number;
  items: readonly string[];
  /** Coordonnées locales de préparation (rangée 0 = front). */
  hex: Hex;
}

export interface CreatureSpec {
  defId: string;
  hex: Hex;
  level?: number;
}

export interface SideSpec {
  units: readonly BoardUnitSpec[];
  creatures?: readonly CreatureSpec[];
}

export interface TraitState {
  id: string;
  count: number;
  /** 0 = inactif ; n = n-ième palier atteint. */
  level: number;
  thresholds: readonly number[];
  contributors: string[];
}

/** Synergies d'un ensemble d'unités (un même champion ne compte qu'une fois). */
export function computeTraits(units: readonly { defId: string }[]): TraitState[] {
  const seen = new Set<string>();
  const counts = new Map<string, { count: number; contributors: string[] }>();
  for (const u of units) {
    if (seen.has(u.defId)) continue;
    seen.add(u.defId);
    const def = getChampion(u.defId);
    for (const t of def.traits) {
      const n = def.countsAs?.[t] ?? 1;
      const cur = counts.get(t) ?? { count: 0, contributors: [] };
      cur.count += n;
      cur.contributors.push(def.id);
      counts.set(t, cur);
    }
  }
  const out: TraitState[] = [];
  for (const [id, c] of counts) {
    const def = getTrait(id);
    let level = 0;
    def.thresholds.forEach((th, i) => {
      if (c.count >= th) level = i + 1;
    });
    out.push({ id, count: c.count, level, thresholds: def.thresholds, contributors: c.contributors });
  }
  // tri : actives d'abord (palier décroissant), puis par progression
  out.sort((a, b) => b.level - a.level || b.count - a.count || TRAITS.findIndex((t) => t.id === a.id) - TRAITS.findIndex((t) => t.id === b.id));
  return out;
}

export function championIdentity(def: ChampionDef, star: number, items: readonly string[], uid?: string): UnitIdentity {
  return {
    defId: def.id,
    name: def.name,
    kind: 'champion',
    star,
    cost: def.cost,
    traits: def.traits,
    items,
    look: def.look,
    ability: def.ability,
    base: def.stats,
    attackProjectile: def.attack?.projectile ?? (def.stats.range >= 2 ? 'bolt' : undefined),
    attackProjectileSpeed: def.attack?.speed,
    ownerUid: uid,
    role: def.role,
  };
}

export function itemMods(items: readonly string[]): { mods: ResolvedMod[]; passives: PassiveAttach[] } {
  const mods: ResolvedMod[] = [];
  const passives: PassiveAttach[] = [];
  for (const id of items) {
    const it = getItem(id);
    for (const m of it.stats) mods.push({ stat: m.stat, value: val(m.value, 1) });
    if (it.passive) passives.push({ passive: it.passive, star: 1, source: 'item', label: it.name });
  }
  return { mods, passives };
}

export interface BuildOptions {
  seed: number;
  stage: number;
  recordEvents?: boolean;
  labels?: [string, string];
}

export function buildCombat(sides: readonly [SideSpec, SideSpec], opts: BuildOptions): CombatSim {
  const sim = new CombatSim({ seed: opts.seed, stage: opts.stage, recordEvents: opts.recordEvents, summons: SUMMONS, labels: opts.labels });
  sides.forEach((spec, sideIdx) => {
    const side = sideIdx as SideId;
    const traits = computeTraits(spec.units).filter((t) => t.level > 0);
    const units = spec.units.slice().sort((a, b) => a.hex.row - b.hex.row || a.hex.col - b.hex.col);

    // meneur de chaque synergie : le porteur le plus en retrait
    const leaders = new Map<string, BoardUnitSpec>();
    for (const t of traits) {
      const holders = units.filter((u) => getChampion(u.defId).traits.includes(t.id));
      holders.sort((a, b) => b.hex.row - a.hex.row || a.hex.col - b.hex.col);
      if (holders[0]) leaders.set(t.id, holders[0]);
    }

    for (const u of units) {
      const def = getChampion(u.defId);
      const passives: PassiveAttach[] = [];
      if (def.passive) passives.push({ passive: def.passive, star: u.star, source: 'passive', label: def.passive.name ?? def.name });
      const im = itemMods(u.items);
      passives.push(...im.passives);
      for (const t of traits) {
        const tdef = getTrait(t.id);
        const lvl = tdef.levels[t.level - 1];
        if (!lvl) continue;
        if (lvl.team) passives.push({ passive: lvl.team, star: u.star, values: lvl.values, source: 'trait', label: tdef.name });
        if (def.traits.includes(t.id) && lvl.holders) passives.push({ passive: lvl.holders, star: u.star, values: lvl.values, source: 'trait', label: tdef.name });
        if (lvl.leader && leaders.get(t.id) === u) passives.push({ passive: lvl.leader, star: u.star, values: lvl.values, source: 'trait', label: tdef.name });
      }
      sim.addUnit(championIdentity(def, u.star, u.items, u.uid), side, prepToCombat(u.hex, side), passives, im.mods);
    }

    for (const c of spec.creatures ?? []) {
      const def = CREATURES[c.defId];
      if (!def) throw new Error(`Créature inconnue : ${c.defId}`);
      const ident: UnitIdentity = {
        defId: def.id,
        name: def.name,
        kind: 'creature',
        star: 1,
        cost: 0,
        traits: [],
        items: [],
        look: def.look,
        ability: def.ability,
        base: def.stats,
        attackProjectile: def.attack?.projectile ?? (def.stats.range >= 2 ? 'bolt' : undefined),
        attackProjectileSpeed: def.attack?.speed,
        role: 'creature',
      };
      const passives: PassiveAttach[] = def.passive ? [{ passive: def.passive, star: 1, source: 'passive', label: def.name }] : [];
      sim.addUnit(ident, side, prepToCombat(c.hex, side), passives, [], c.level ?? 1);
    }
  });
  return sim;
}
