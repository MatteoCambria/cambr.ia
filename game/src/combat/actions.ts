/**
 * Interpréteur des actions du DSL. Chaque action est une donnée ; ce module traduit
 * ces données en appels au simulateur (dégâts, statuts, déplacements, invocations…).
 */
import type { Action, Amount, Area, StatusSpec } from './dsl';
import type { CombatSim, PassiveAttach } from './sim';
import type { ActionCtx, CombatUnit, UnitIdentity } from './unit';
import { evalCond, resolveArea, selectTarget, threat } from './targeting';
import { val } from './values';
import { COMBAT } from '../config/balance';
import { hexDistance, hexKey, hexLine, hexToWorld, neighbors, type Hex } from '../board/hex';

export function exec(sim: CombatSim, actions: readonly Action[], ctx: ActionCtx): void {
  for (const a of actions) {
    if (sim.done) return;
    if (!sim.spend()) return;
    run(sim, a, ctx);
  }
}

export function calcAmount(sim: CombatSim, amount: Amount, ctx: ActionCtx, target: CombatUnit | null): number {
  const c = sim.unit(ctx.casterId);
  if (!c) return 0;
  const s = c.stats;
  const star = ctx.star;
  const v = ctx.values;
  let total = 0;
  if (amount.base !== undefined) total += val(amount.base, star, v) * (amount.noAp ? 1 : s.ap / 100);
  if (amount.ad !== undefined) total += (val(amount.ad, star, v) / 100) * s.ad;
  if (amount.ap !== undefined) total += (val(amount.ap, star, v) / 100) * s.ap;
  if (amount.armor !== undefined) total += (val(amount.armor, star, v) / 100) * s.armor;
  if (amount.mr !== undefined) total += (val(amount.mr, star, v) / 100) * s.mr;
  if (amount.casterHp !== undefined) total += (val(amount.casterHp, star, v) / 100) * s.maxHp;
  if (target) {
    const ts = target.stats;
    if (amount.targetHp !== undefined) total += (val(amount.targetHp, star, v) / 100) * ts.maxHp;
    if (amount.targetMissingHp !== undefined) total += (val(amount.targetMissingHp, star, v) / 100) * Math.max(0, ts.maxHp - target.hp);
    if (amount.targetCurrentHp !== undefined) total += (val(amount.targetCurrentHp, star, v) / 100) * Math.max(0, target.hp);
  }
  if (amount.event !== undefined) total += (val(amount.event, star, v) / 100) * ctx.eventAmount;
  if (amount.perCounter) total += val(amount.perCounter.value, star, v) * c.counter(amount.perCounter.name);
  return Math.max(0, total);
}

const DEBUFF_KINDS = new Set(['stun', 'root', 'disarm', 'silence', 'taunt', 'burn', 'poison', 'bleed', 'link']);

function cleanse(u: CombatUnit): void {
  for (const st of u.statuses.slice()) {
    const harmful = DEBUFF_KINDS.has(st.kind) || (st.kind === 'stats' && st.mods.some((m) => m.value < 0 && m.stat !== 'damageTakenAmp')) || (st.kind === 'stats' && st.mods.some((m) => m.stat === 'damageTakenAmp' && m.value > 0));
    if (harmful) u.removeStatus(st);
  }
}

function vfxAt(sim: CombatSim, vfx: string | undefined, at: Hex | null, extra?: { radius?: number; src?: number; tgt?: number; to?: Hex | null; dur?: number }): void {
  if (!vfx || !sim.recordEvents || !at) return;
  sim.emit({
    t: sim.time,
    e: 'vfx',
    vfx,
    at: hexToWorld(at),
    to: extra?.to ? hexToWorld(extra.to) : undefined,
    radius: extra?.radius,
    src: extra?.src,
    tgt: extra?.tgt,
    dur: extra?.dur,
  });
}

function run(sim: CombatSim, a: Action, ctx: ActionCtx): void {
  const caster = sim.unit(ctx.casterId);
  if (!caster) return;
  const target = ctx.targetId !== null ? sim.unit(ctx.targetId) : null;
  const star = ctx.star;
  const values = ctx.values;

  switch (a.do) {
    case 'damage': {
      const targets = resolveArea(sim, a.area, ctx);
      if (a.vfx) vfxAt(sim, a.vfx, areaCenter(a.area, caster, target, ctx), { radius: areaRadius(a.area), src: caster.id, tgt: target?.id });
      for (const t of targets) {
        if (!t.alive) continue;
        const amount = calcAmount(sim, a.amount, ctx, t);
        const res = sim.dealDamage({
          src: caster,
          tgt: t,
          amount,
          type: a.type,
          isAbility: ctx.source === 'ability',
          canCrit: a.canCrit ?? true,
          kind: ctx.source === 'ability' ? 'ability' : 'other',
          tag: a.tag,
        });
        if (res.killed && (t.id === ctx.targetId || targets.length === 1)) ctx.killed = true;
        if (a.onHit) exec(sim, a.onHit, { ...ctx, targetId: t.id, anchor: { ...t.hex }, eventAmount: res.dealt, killed: res.killed });
      }
      return;
    }
    case 'heal': {
      for (const t of resolveArea(sim, a.area, ctx)) {
        sim.heal(caster, t, calcAmount(sim, a.amount, ctx, t));
        if (a.vfx) vfxAt(sim, a.vfx, t.hex, { tgt: t.id });
      }
      return;
    }
    case 'shield': {
      const dur = val(a.duration, star, values);
      for (const t of resolveArea(sim, a.area, ctx)) {
        sim.shield(caster, t, calcAmount(sim, a.amount, ctx, t), dur, a.onExpire === 'heal', a.id);
        if (a.vfx) vfxAt(sim, a.vfx, t.hex, { tgt: t.id, dur });
      }
      return;
    }
    case 'status': {
      for (const t of resolveArea(sim, a.area, ctx)) {
        sim.applyStatus(caster, t, a.status, ctx);
        if (a.vfx) vfxAt(sim, a.vfx, t.hex, { tgt: t.id });
      }
      return;
    }
    case 'cleanse': {
      for (const t of resolveArea(sim, a.area, ctx)) cleanse(t);
      return;
    }
    case 'mana': {
      const amt = val(a.amount, star, values);
      for (const t of resolveArea(sim, a.area, ctx)) {
        if (!t.hasAbility || t.isSilenced) continue;
        t.mana = Math.min(t.stats.maxMana, t.mana + amt);
        if (sim.recordEvents) sim.emit({ t: sim.time, e: 'mana', tgt: t.id, amount: amt });
      }
      return;
    }
    case 'projectile': {
      if (!caster.alive) return;
      const onHit = (t: CombatUnit) => exec(sim, a.onHit, { ...ctx, targetId: t.id, anchor: { ...t.hex }, killed: false });
      const speed = a.speed ?? COMBAT.defaultProjectileSpeed;
      if (a.pierce) {
        const toward = target ? target.hex : ctx.anchor;
        if (!toward) return;
        sim.spawnPiercing(caster, toward, a.vfx, speed, a.pierce.length, a.pierce.width ?? 0, onHit);
      } else {
        if (!target || !target.alive) return;
        sim.spawnProjectile(caster, target, a.vfx, speed, onHit);
      }
      return;
    }
    case 'chain': {
      if (!target || !target.alive) return;
      const total = 1 + Math.round(val(a.bounces, star, values));
      const hit = new Set<number>();
      const interval = a.interval ?? 0.12;
      const doHit = (t: CombatUnit, idx: number) => {
        if (sim.done || !t.alive) return;
        hit.add(t.id);
        exec(sim, a.onHit, { ...ctx, targetId: t.id, anchor: { ...t.hex }, killed: false });
        if (idx + 1 >= total) return;
        let next: CombatUnit | null = null;
        let best = Infinity;
        for (const e of sim.targetableEnemiesOf(caster)) {
          if (hit.has(e.id)) continue;
          const d = hexDistance(e.hex, t.hex);
          if (d <= a.range && (d < best || (d === best && next && e.id < next.id))) {
            best = d;
            next = e;
          }
        }
        if (!next) return;
        vfxAt(sim, a.vfx, t.hex, { to: next.hex, src: t.id, tgt: next.id });
        const n = next;
        sim.schedule(interval, () => doHit(n, idx + 1));
      };
      vfxAt(sim, a.vfx, caster.hex, { to: target.hex, src: caster.id, tgt: target.id });
      doHit(target, 0);
      return;
    }
    case 'delay': {
      const anchor = a.anchorTarget !== false && target ? { ...target.hex } : ctx.anchor ? { ...ctx.anchor } : { ...caster.hex };
      const c2: ActionCtx = { ...ctx, anchor };
      vfxAt(sim, a.vfx, anchor, { dur: a.seconds, src: caster.id });
      sim.schedule(a.seconds, () => exec(sim, a.actions, c2));
      return;
    }
    case 'repeat': {
      const n = Math.round(val(a.times, star, values));
      for (let i = 0; i < n; i++) {
        const fn = () => {
          if (!caster.alive && a.retarget) return;
          const c2: ActionCtx = { ...ctx, killed: false };
          if (a.retarget) {
            const t = selectTarget(sim, caster, a.retarget);
            if (!t) return;
            c2.targetId = t.id;
            c2.anchor = { ...t.hex };
          }
          exec(sim, a.actions, c2);
        };
        if (i === 0) fn();
        else sim.schedule(i * a.interval, fn);
      }
      return;
    }
    case 'move': {
      doMove(sim, a, caster, target, ctx);
      return;
    }
    case 'displace': {
      for (const t of resolveArea(sim, a.area, ctx)) {
        if (!t.alive || t.isCcImmune || t.state === 'busy' || t.stasis) continue;
        let dest: Hex | null = null;
        if (a.mode === 'pull') {
          dest = sim.nearestFreeHex(caster.hex, t, (h) => hexDistance(h, t.hex) * 10 + hexDistance(h, caster.hex) * 30);
          if (dest && hexDistance(dest, caster.hex) > 1) dest = null;
        } else {
          let cur = t.hex;
          const steps = a.hexes ?? 1;
          for (let i = 0; i < steps; i++) {
            const occ = sim.occupiedSet(t);
            let best: Hex | null = null;
            let bestD = hexDistance(cur, caster.hex);
            for (const nb of neighbors(cur)) {
              if (occ.has(hexKey(nb))) continue;
              const d = hexDistance(nb, caster.hex);
              if (d > bestD) {
                bestD = d;
                best = nb;
              }
            }
            if (!best) break;
            cur = best;
          }
          if (cur !== t.hex) dest = cur;
        }
        if (dest && (dest.col !== t.hex.col || dest.row !== t.hex.row)) {
          if (t.state === 'windup' || t.state === 'moving') t.state = 'idle';
          sim.beginMove(t, dest, 'knock', 0.28);
          if (sim.recordEvents) sim.emit({ t: sim.time, e: 'dash', tgt: t.id, kind: 'knock' });
          if (a.vfx) vfxAt(sim, a.vfx, dest, { src: caster.id, tgt: t.id });
        }
      }
      return;
    }
    case 'summon': {
      doSummon(sim, a, caster, target, ctx);
      return;
    }
    case 'zone': {
      const dur = val(a.duration, star, values);
      let center: Hex | null = null;
      let hexes: Hex[] | null = null;
      if (a.at === 'self') center = { ...caster.hex };
      else if (a.at === 'anchor') center = ctx.anchor ? { ...ctx.anchor } : target ? { ...target.hex } : null;
      else if (a.at === 'target') center = target ? { ...target.hex } : ctx.anchor ? { ...ctx.anchor } : null;
      else {
        const allies = sim.alliesOf(caster, true).filter((u) => u.kind !== 'summon');
        allies.sort((x, y) => threat(y) - threat(x) || x.id - y.id);
        hexes = allies.slice(0, a.count ?? 3).map((u) => ({ ...u.hex }));
        center = hexes[0] ?? null;
      }
      if (!center && !hexes) return;
      sim.addZone({
        ownerId: caster.id,
        side: caster.side,
        affects: a.side,
        center,
        hexes,
        radius: a.radius,
        remaining: dur,
        total: dur,
        interval: a.interval,
        timer: a.interval - COMBAT.dt,
        actions: a.actions,
        ctx: { ...ctx, killed: false },
        pull: !!a.pull,
        follow: !!a.follow,
        vfx: a.vfx,
      });
      if (sim.recordEvents && center) vfxAt(sim, a.vfx + ':open', center, { radius: a.radius, dur, src: caster.id });
      return;
    }
    case 'empower': {
      if (!caster.alive) return;
      caster.empower = { remaining: Math.round(val(a.attacks, star, values)), onHit: a.onHit, ctx: { ...ctx }, tag: a.tag };
      caster.attackCd = Math.min(caster.attackCd, 0.05);
      return;
    }
    case 'transform': {
      if (!caster.alive) return;
      const spec: StatusSpec = { kind: 'stats', duration: 0, stats: a.stats, id: 'transform', tag: 'Transformé' };
      sim.applyStatus(caster, caster, spec, ctx);
      if (a.splash) caster.splash = { radius: a.splash.radius, pct: val(a.splash.pct, star, values) / 100 };
      caster.transformed = true;
      caster.scale = a.scale ?? 1.3;
      if (a.vfx) vfxAt(sim, a.vfx, caster.hex, { src: caster.id });
      return;
    }
    case 'execute': {
      const thr = val(a.threshold, star, values);
      for (const t of resolveArea(sim, a.area, ctx)) {
        if (!t.alive || t.hpPct() * 100 > thr) continue;
        if (sim.recordEvents) sim.emit({ t: sim.time, e: 'text', tgt: t.id, text: 'Exécuté', color: '#7ef0e0' });
        if (a.vfx) vfxAt(sim, a.vfx, t.hex, { tgt: t.id });
        const res = sim.dealDamage({ src: caster, tgt: t, amount: t.hp + t.shieldTotal + 1, type: 'true', kind: 'other', noRedirect: true, noLink: true, noReflect: true, tag: 'execute' });
        if (res.killed && t.id === ctx.targetId) ctx.killed = true;
      }
      return;
    }
    case 'link': {
      const group = sim.newLinkGroup();
      const share = val(a.share, star, values) / 100;
      const dur = val(a.duration, star, values);
      const targets = resolveArea(sim, a.area, ctx);
      if (targets.length < 2) return;
      for (const t of targets) {
        t.addStatus({
          kind: 'link',
          key: 'link:' + group,
          remaining: dur,
          total: dur,
          value: share,
          mods: [],
          stacks: 1,
          maxStacks: 1,
          sourceId: caster.id,
          dps: 0,
          dmgType: 'true',
          dotTimer: 0,
          tag: 'Lié',
          linkGroup: group,
        });
        if (sim.recordEvents) sim.emit({ t: sim.time, e: 'status', tgt: t.id, kind: 'link', tag: 'Lié', dur });
      }
      if (a.vfx) for (let i = 1; i < targets.length; i++) vfxAt(sim, a.vfx, targets[0].hex, { to: targets[i].hex, dur });
      return;
    }
    case 'rewind': {
      const steps = Math.round(a.seconds / COMBAT.hpHistoryInterval);
      for (const t of resolveArea(sim, a.area, ctx)) {
        const h = t.hpHistory;
        if (!h.length) continue;
        const then = h[Math.max(0, h.length - 1 - steps)];
        if (then > t.hp) {
          const gain = Math.min(then, t.stats.maxHp) - t.hp;
          t.hp += gain;
          caster.combat.healing += gain;
          if (sim.recordEvents) sim.emit({ t: sim.time, e: 'heal', src: caster.id, tgt: t.id, amount: gain });
        }
        cleanse(t);
        if (a.vfx) vfxAt(sim, a.vfx, t.hex, { tgt: t.id });
      }
      return;
    }
    case 'counter': {
      const cur = caster.counter(a.name);
      const next = cur + (a.add !== undefined ? val(a.add, star, values) : 0) + (a.addEvent !== undefined ? (ctx.eventAmount * a.addEvent) / 100 : 0);
      caster.counters.set(a.name, a.max !== undefined ? Math.min(a.max, next) : next);
      return;
    }
    case 'resetCounter': {
      caster.counters.set(a.name, 0);
      return;
    }
    case 'if': {
      if (evalCond(sim, a.cond, ctx)) exec(sim, a.then, ctx);
      else if (a.else) exec(sim, a.else, ctx);
      return;
    }
    case 'gold': {
      sim.addGold(caster, a.amount, a.cap);
      return;
    }
    case 'preventDeath': {
      const who = target ?? caster;
      if (who.hp > 0 || !who.alive) return;
      who.hp = Math.max(1, (who.stats.maxHp * val(a.hpPct, star, values)) / 100);
      cleanse(who);
      if (a.invulnerable) sim.applyStatus(caster, who, { kind: 'invulnerable', duration: a.invulnerable, tag: 'Invulnérable' }, ctx);
      if (sim.recordEvents) sim.emit({ t: sim.time, e: 'revive', tgt: who.id });
      if (a.vfx) vfxAt(sim, a.vfx, who.hex, { tgt: who.id });
      return;
    }
    case 'rebirth': {
      if (caster.hp > 0 || !caster.alive) return;
      caster.hp = Math.max(1, (caster.stats.maxHp * a.eggHpPct) / 100);
      caster.stasis = { remaining: a.duration, reviveHpPct: val(a.reviveHpPct, star, values) / 100 };
      caster.state = 'idle';
      caster.castCtx = null;
      caster.shields = [];
      cleanse(caster);
      caster.addStatus({
        kind: 'stasis',
        key: 'stasis',
        remaining: a.duration,
        total: a.duration,
        value: 0,
        mods: [],
        stacks: 1,
        maxStacks: 1,
        sourceId: caster.id,
        dps: 0,
        dmgType: 'true',
        dotTimer: 0,
        tag: 'Œuf',
      });
      if (sim.recordEvents) sim.emit({ t: sim.time, e: 'text', tgt: caster.id, text: 'Œuf de cendres', color: '#ffb35c' });
      if (a.vfx) vfxAt(sim, a.vfx, caster.hex, { tgt: caster.id, dur: a.duration });
      return;
    }
    case 'recast': {
      if (caster.recastCount >= a.max) return;
      caster.recastCount++;
      sim.schedule(0.18, () => {
        if (!caster.alive || caster.isStunned || caster.stasis) return;
        if (caster.state === 'casting' || caster.state === 'busy') return;
        caster.state = 'idle';
        sim.tryCast(caster, true);
      });
      return;
    }
    case 'vfx': {
      const at = a.at === 'target' && target ? target.hex : caster.hex;
      vfxAt(sim, a.vfx, at, { src: caster.id, tgt: target?.id });
      return;
    }
  }
}

function areaCenter(area: Area | undefined, caster: CombatUnit, target: CombatUnit | null, ctx: ActionCtx): Hex | null {
  if (!area || area.shape === 'target') return target ? target.hex : ctx.anchor;
  if (area.shape === 'circle') {
    if (area.at === 'self') return caster.hex;
    if (area.at === 'anchor') return ctx.anchor ?? target?.hex ?? null;
    return target ? target.hex : ctx.anchor;
  }
  if (area.shape === 'line') return caster.hex;
  if (area.shape === 'self' || area.shape === 'adjacentAllies' || area.shape === 'rowAllies') return caster.hex;
  return target ? target.hex : caster.hex;
}

function areaRadius(area: Area | undefined): number | undefined {
  if (area && area.shape === 'circle') return area.radius;
  if (area && area.shape === 'line') return area.length;
  return undefined;
}

function doMove(sim: CombatSim, a: Extract<Action, { do: 'move' }>, caster: CombatUnit, target: CombatUnit | null, ctx: ActionCtx): void {
  if (!caster.alive || caster.stasis) return;
  if (caster.isRooted && a.mode !== 'teleportBehind') {
    if (a.then) exec(sim, a.then, ctx);
    return;
  }
  let tgt = target;
  const origin = { ...caster.hex };
  let dest: Hex | null = null;
  switch (a.mode) {
    case 'leapBackline': {
      tgt = selectTarget(sim, caster, 'backlineEnemy');
      if (!tgt) return;
      const t = tgt;
      dest = sim.nearestFreeHex(t.hex, caster, (h) => -backlineDepthOfHex(h, t.side) * 10 + hexDistance(h, t.hex) * 100);
      break;
    }
    case 'dashBehind':
    case 'teleportBehind': {
      if (!tgt || !tgt.alive) return;
      const t = tgt;
      dest = sim.nearestFreeHex(t.hex, caster, (h) => hexDistance(h, t.hex) * 100 - hexDistance(h, origin));
      break;
    }
    case 'dashAdjacent':
    case 'leapCluster': {
      if (!tgt || !tgt.alive) return;
      const t = tgt;
      dest = sim.nearestFreeHex(t.hex, caster, (h) => hexDistance(h, t.hex) * 100 + hexDistance(h, origin));
      break;
    }
    case 'dashThrough': {
      if (!tgt || !tgt.alive) return;
      const line = hexLine(origin, tgt.hex, a.hexes ?? 2);
      const idx = line.findIndex((h) => h.col === tgt!.hex.col && h.row === tgt!.hex.row);
      const occ = sim.occupiedSet(caster);
      for (let i = line.length - 1; i > idx && idx >= 0; i--) {
        if (!occ.has(hexKey(line[i]))) {
          dest = line[i];
          break;
        }
      }
      if (!dest) {
        const t = tgt;
        dest = sim.nearestFreeHex(t.hex, caster, (h) => hexDistance(h, t.hex) * 100 - hexDistance(h, origin));
      }
      break;
    }
    case 'retreat': {
      const enemies = sim.enemiesOf(caster);
      if (!enemies.length) return;
      const minDist = (h: Hex) => Math.min(...enemies.map((e) => hexDistance(h, e.hex)));
      dest = sim.nearestFreeHex(origin, caster, (h) => -minDist(h) * 10 + hexDistance(h, origin) * (hexDistance(h, origin) > (a.hexes ?? 2) ? 100 : 0));
      break;
    }
  }
  if (!dest) {
    if (a.then) exec(sim, a.then, { ...ctx, targetId: tgt ? tgt.id : ctx.targetId });
    return;
  }
  const kind = a.mode === 'leapBackline' || a.mode === 'leapCluster' ? 'leap' : a.mode === 'teleportBehind' ? 'blink' : 'dash';
  const dur = a.duration ?? (kind === 'leap' ? COMBAT.leapDuration : kind === 'blink' ? 0.12 : COMBAT.dashDuration);
  if (caster.state === 'windup') caster.state = 'idle';
  sim.beginMove(caster, dest, kind, dur);
  if (a.untargetable) sim.applyStatus(caster, caster, { kind: 'untargetable', duration: dur + 0.05, tag: 'Insaisissable' }, ctx);
  caster.state = 'busy';
  caster.busyLeft = dur;
  if (tgt) {
    caster.targetId = tgt.id;
    const tw = hexToWorld(tgt.hex);
    const dw = hexToWorld(dest);
    if (Math.abs(tw.x - dw.x) > 0.01) caster.facing = tw.x > dw.x ? 1 : -1;
  }
  caster.busyThen = a.then ? { actions: a.then, ctx: { ...ctx, targetId: tgt ? tgt.id : ctx.targetId, anchor: tgt ? { ...tgt.hex } : ctx.anchor } } : null;
  if (sim.recordEvents) sim.emit({ t: sim.time, e: 'dash', tgt: caster.id, kind });
  if (a.vfx) vfxAt(sim, a.vfx, origin, { to: dest, src: caster.id, dur });
}

function backlineDepthOfHex(h: Hex, side: 0 | 1): number {
  return side === 0 ? h.row - 4 : 3 - h.row;
}

function doSummon(sim: CombatSim, a: Extract<Action, { do: 'summon' }>, caster: CombatUnit, target: CombatUnit | null, ctx: ActionCtx): void {
  const def = sim.opts.summons[a.unit];
  if (!def) {
    sim.warnings.push(`Invocation inconnue : ${a.unit}`);
    return;
  }
  const count = Math.max(1, Math.round(val(a.count ?? 1, ctx.star, ctx.values)));
  const level = a.level !== undefined ? val(a.level, ctx.star, ctx.values) : 1;
  const mult = level * (1 + caster.stats.summonPower);
  for (let i = 0; i < count; i++) {
    let hex: Hex | null = null;
    if (a.at === 'nearTarget' && target) hex = sim.nearestFreeHex(target.hex);
    else if (a.at === 'corpse' && sim.corpses.length) {
      for (let k = sim.corpses.length - 1; k >= 0 && !hex; k--) if (!sim.isOccupied(sim.corpses[k])) hex = { ...sim.corpses[k] };
    } else if (a.at === 'front') {
      const enemies = sim.enemiesOf(caster);
      hex = sim.nearestFreeHex(caster.hex, undefined, (h) => (enemies.length ? Math.min(...enemies.map((e) => hexDistance(h, e.hex))) : 0) * 10 + hexDistance(h, caster.hex));
    }
    if (!hex) hex = sim.nearestFreeHex(caster.hex);
    if (!hex) return;
    const ident: UnitIdentity = {
      defId: def.id,
      name: def.name,
      kind: 'summon',
      star: ctx.star,
      cost: 0,
      traits: [],
      items: [],
      look: def.look,
      ability: def.ability,
      base: def.stats,
      attackProjectile: def.attack?.projectile,
      attackProjectileSpeed: def.attack?.speed,
      role: 'summon',
    };
    const passives: PassiveAttach[] = def.passive ? [{ passive: def.passive, star: ctx.star, values: def.values, source: 'passive', label: def.name }] : [];
    const u = sim.addUnit(ident, caster.side, hex, passives, [], mult);
    u.summonerId = caster.id;
    u.hpHistory.push(u.hp);
    u.attackCd = 0.3;
    if (sim.recordEvents) sim.emit({ t: sim.time, e: 'summon', tgt: u.id, src: caster.id });
    if (a.vfx) vfxAt(sim, a.vfx, hex, { src: caster.id, tgt: u.id });
  }
}
