/**
 * Sélection des cibles, résolution des zones d'effet et évaluation des conditions.
 * Toutes les fonctions sont déterministes : départage systématique par identifiant.
 */
import type { Area, Condition, Side, TargetSel } from './dsl';
import type { CombatSim } from './sim';
import type { ActionCtx, CombatUnit } from './unit';
import { BOARD_ROWS } from '../config/balance';
import { HEX_STEP, hexDistance, hexToWorld, pointSegmentDistance, type Hex } from '../board/hex';
import { val } from './values';

/** Menace estimée d'une unité (dégâts potentiels) : sert aux sélecteurs « carry ». */
export function threat(u: CombatUnit): number {
  const s = u.stats;
  const attack = s.ad * s.as * (1 + s.critChance * (s.critDamage - 1));
  const spell = u.hasAbility ? (s.ap / 100) * 55 * (1 + u.ident.cost * 0.35) : 0;
  return attack + spell + u.ident.items.length * 18 + u.ident.cost * 6;
}

/** 0 = ligne de front, 3 = fond, selon le camp. */
export function backlineDepth(u: CombatUnit): number {
  const half = BOARD_ROWS / 2;
  return u.side === 0 ? u.hex.row - half : half - 1 - u.hex.row;
}

function byScore<T extends CombatUnit>(list: T[], score: (u: T) => number): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const u of list) {
    const s = score(u);
    if (s < bestScore - 1e-9 || (Math.abs(s - bestScore) <= 1e-9 && best !== null && u.id < best.id)) {
      best = u;
      bestScore = s;
    }
  }
  return best;
}

export function selectTarget(sim: CombatSim, caster: CombatUnit, sel: TargetSel, range?: number): CombatUnit | null {
  const enemiesAll = sim.targetableEnemiesOf(caster);
  const enemies = range !== undefined ? enemiesAll.filter((e) => hexDistance(caster.hex, e.hex) <= range) : enemiesAll;
  const allies = sim.alliesOf(caster, true);
  const dist = (u: CombatUnit) => hexDistance(caster.hex, u.hex);
  switch (sel) {
    case 'self':
      return caster;
    case 'current': {
      const cur = caster.targetId !== null ? sim.unit(caster.targetId) : null;
      if (cur && cur.alive && !cur.isUntargetable && cur.side !== caster.side && dist(cur) <= caster.stats.range + 1) return cur;
      const inRange = enemiesAll.filter((e) => dist(e) <= caster.stats.range);
      return byScore(inRange, dist);
    }
    case 'nearestEnemy':
      return byScore(enemies, dist);
    case 'farthestEnemy':
      return byScore(enemies, (u) => -dist(u));
    case 'lowestHpEnemy':
      return byScore(enemies, (u) => u.hp + u.shieldTotal);
    case 'lowestHpPctEnemy':
      return byScore(enemies, (u) => u.hpPct());
    case 'highestHpEnemy':
      return byScore(enemies, (u) => -u.hp);
    case 'carryEnemy':
      return byScore(enemies, (u) => -threat(u) + dist(u) * 0.01);
    case 'clusterEnemy':
      return byScore(enemies, (u) => {
        let n = 0;
        for (const o of enemiesAll) if (hexDistance(o.hex, u.hex) <= 1) n++;
        return -n * 10 + dist(u) * 0.1;
      });
    case 'randomEnemy':
      return enemies.length ? enemies[sim.rng.int(enemies.length)] : null;
    case 'backlineEnemy':
      return byScore(enemies, (u) => -backlineDepth(u) * 10 + dist(u) * 0.5);
    case 'highestManaEnemy':
      return byScore(enemies, (u) => -(u.hasAbility ? u.mana / Math.max(1, u.stats.maxMana) : -1));
    case 'lowestHpPctAlly':
      return byScore(allies, (u) => u.hpPct());
    case 'lowestHpPctOtherAlly': {
      const others = allies.filter((a) => a.id !== caster.id);
      return byScore(others.length ? others : allies, (u) => u.hpPct());
    }
    case 'highestManaAlly': {
      const others = allies.filter((a) => a.id !== caster.id && a.hasAbility);
      if (!others.length) return caster;
      // l'allié dont la compétence est la plus proche d'être lancée
      return byScore(others, (u) => -(u.mana / Math.max(1, u.stats.maxMana)) - (u.stats.maxMana >= 80 ? 0.05 : 0));
    }
    case 'carryAlly': {
      const others = allies.filter((a) => a.id !== caster.id && a.kind !== 'summon');
      if (!others.length) return caster;
      return byScore(others, (u) => -threat(u));
    }
    case 'frontAlly': {
      const others = allies.filter((a) => a.id !== caster.id);
      if (!others.length) return caster;
      return byScore(others, (u) => backlineDepth(u) * 10 + dist(u));
    }
  }
}

function sideUnits(sim: CombatSim, caster: CombatUnit, side: Side): CombatUnit[] {
  if (side === 'enemies') return sim.enemiesOf(caster);
  if (side === 'allies') return sim.alliesOf(caster, true);
  return sim.aliveUnits();
}

export function resolveArea(sim: CombatSim, area: Area | undefined, ctx: ActionCtx): CombatUnit[] {
  const caster = sim.unit(ctx.casterId);
  if (!caster) return [];
  const target = ctx.targetId !== null ? sim.unit(ctx.targetId) : null;
  const a = area ?? { shape: 'target' as const };
  const star = ctx.star;
  switch (a.shape) {
    case 'target':
      return target && target.alive ? [target] : [];
    case 'self':
      return caster.alive || caster.stasis ? [caster] : [];
    case 'circle': {
      let center: Hex | null = null;
      if (a.at === 'self') center = caster.hex;
      else if (a.at === 'anchor') center = ctx.anchor ?? target?.hex ?? null;
      else center = target ? target.hex : ctx.anchor;
      if (!center) return [];
      const c = center;
      return sideUnits(sim, caster, a.side).filter(
        (u) =>
          hexDistance(u.hex, c) <= a.radius &&
          !(a.excludeTarget && target && u.id === target.id) &&
          !(a.excludeSelf && u.id === caster.id),
      );
    }
    case 'line': {
      const from = hexToWorld(caster.hex);
      const toHex = target ? target.hex : ctx.anchor;
      if (!toHex) return [];
      const to = hexToWorld(toHex);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const end = { x: from.x + (dx / len) * a.length * HEX_STEP, y: from.y + (dy / len) * a.length * HEX_STEP };
      const thr = 0.78 + (a.width ?? 0) * 1.5;
      return sideUnits(sim, caster, a.side).filter((u) => u.id !== caster.id && pointSegmentDistance(hexToWorld(u.hex), from, end) <= thr);
    }
    case 'all':
      return sideUnits(sim, caster, a.side).filter((u) => !(a.excludeSelf && u.id === caster.id));
    case 'lowestHpAllies': {
      const n = Math.round(val(a.count, star, ctx.values));
      const list = sim.alliesOf(caster, a.includeSelf !== false).slice();
      list.sort((x, y) => x.hpPct() - y.hpPct() || x.id - y.id);
      return list.slice(0, n);
    }
    case 'nearest': {
      const n = Math.round(val(a.count, star, ctx.values));
      const origin = a.of === 'target' && target ? target.hex : caster.hex;
      const list = sideUnits(sim, caster, a.side).filter(
        (u) => u.id !== caster.id && !(a.excludeTarget && target && u.id === target.id),
      );
      list.sort((x, y) => hexDistance(x.hex, origin) - hexDistance(y.hex, origin) || x.id - y.id);
      return list.slice(0, n);
    }
    case 'random': {
      const n = Math.round(val(a.count, star, ctx.values));
      const list = sideUnits(sim, caster, a.side).slice();
      sim.rng.shuffle(list);
      return list.slice(0, n);
    }
    case 'adjacentAllies':
      return sim.alliesOf(caster, true).filter((u) => (u.id === caster.id ? !!a.includeSelf : hexDistance(u.hex, caster.hex) <= 1));
    case 'rowAllies':
      return sim.alliesOf(caster, true).filter((u) => u.hex.row === caster.hex.row && (u.id !== caster.id || !!a.includeSelf));
    case 'highestStat': {
      const n = Math.round(val(a.count, star, ctx.values));
      const list = sideUnits(sim, caster, a.side).filter((u) => a.includeSelf || u.id !== caster.id);
      const key = (u: CombatUnit) => (a.stat === 'ad' ? u.stats.ad * u.stats.as : a.stat === 'ap' ? u.stats.ap : u.stats.maxMana);
      list.sort((x, y) => key(y) - key(x) || x.id - y.id);
      return list.slice(0, n);
    }
    case 'select': {
      const u = selectTarget(sim, caster, a.sel, a.range);
      return u ? [u] : [];
    }
  }
}

export function evalCond(sim: CombatSim, cond: Condition, ctx: ActionCtx): boolean {
  const caster = sim.unit(ctx.casterId);
  const target = ctx.targetId !== null ? sim.unit(ctx.targetId) : null;
  const star = ctx.star;
  switch (cond.c) {
    case 'targetHpBelow':
      return !!target && target.alive && target.hpPct() * 100 < val(cond.pct, star, ctx.values);
    case 'targetHpAbove':
      return !!target && target.alive && target.hpPct() * 100 > val(cond.pct, star, ctx.values);
    case 'selfHpBelow':
      return !!caster && caster.hpPct() * 100 < val(cond.pct, star, ctx.values);
    case 'killed':
      return ctx.killed;
    case 'alone':
      return !!caster && sim.alliesOf(caster, false).every((a) => hexDistance(a.hex, caster.hex) > cond.radius);
    case 'alliesWithin':
      return !!caster && sim.alliesOf(caster, false).filter((a) => hexDistance(a.hex, caster.hex) <= cond.radius).length >= cond.min;
    case 'counterAtLeast':
      return !!caster && caster.counter(cond.name) >= val(cond.value, star, ctx.values);
    case 'stageAtLeast':
      return sim.stage >= cond.stage;
    case 'stageBelow':
      return sim.stage < cond.stage;
    case 'chance':
      return sim.rng.chance(val(cond.p, star, ctx.values) / 100);
    case 'targetHas':
      return !!target && target.hasTag(cond.tag);
    case 'targetShielded':
      return !!target && target.shieldTotal > 0;
    case 'selfShielded':
      return !!caster && caster.shieldTotal > 0;
    case 'targetIsSummon':
      return !!target && target.kind === 'summon';
    case 'targetHasTrait':
      return !!target && target.ident.traits.includes(cond.trait);
    case 'selfHasTrait':
      return !!caster && caster.ident.traits.includes(cond.trait);
    case 'distanceAtLeast':
      return !!caster && !!target && hexDistance(caster.hex, target.hex) >= cond.hexes;
    case 'not':
      return !evalCond(sim, cond.cond, ctx);
    case 'all':
      return cond.conds.every((c) => evalCond(sim, c, ctx));
  }
}
