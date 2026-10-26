/**
 * Simulation de combat automatique, déterministe à graine et état initial identiques.
 *
 * - Pas de temps fixe (COMBAT.dt), indépendant de la fréquence d'affichage.
 * - Ordre de traitement stable (identifiants croissants).
 * - File d'événements différés ordonnée (temps, numéro de séquence).
 * - Garde-fous : profondeur de déclenchements, budget d'actions par pas, durée maximale.
 */
import { COMBAT } from '../config/balance';
import { Rng } from '../core/rng';
import {
  HEX_STEP,
  hexDistance,
  hexFromKey,
  hexKey,
  hexToWorld,
  inCombatBounds,
  neighbors,
  pointSegmentDistance,
  type Hex,
  type Vec2,
} from '../board/hex';
import type { Action, DmgType, PassiveDef, StatusSpec, TriggerOn, ValueMap } from './dsl';
import type { CombatEvent } from './events';
import { exec, calcAmount } from './actions';
import { evalCond, selectTarget, backlineDepth } from './targeting';
import { val } from './values';
import {
  CombatUnit,
  type ActionCtx,
  type ResolvedMod,
  type RuntimeTrigger,
  type SideId,
  type StatusInst,
  type UnitIdentity,
} from './unit';
import type { SummonDef } from '../core/defs';

export interface PassiveAttach {
  passive: PassiveDef;
  star: number;
  values?: ValueMap;
  source: 'passive' | 'item' | 'trait';
  label: string;
}

export interface SimOptions {
  seed: number;
  stage: number;
  recordEvents?: boolean;
  summons: Readonly<Record<string, SummonDef>>;
  /** Noms des camps pour les journaux. */
  labels?: [string, string];
}

export interface DamageOpts {
  src: CombatUnit | null;
  tgt: CombatUnit;
  amount: number;
  type: DmgType;
  isAttack?: boolean;
  isAbility?: boolean;
  canCrit?: boolean;
  kind?: 'attack' | 'ability' | 'dot' | 'other';
  noRedirect?: boolean;
  noLink?: boolean;
  noReflect?: boolean;
  noTriggers?: boolean;
  tag?: string;
}

export interface DamageResult {
  dealt: number;
  killed: boolean;
  crit: boolean;
}

export interface Projectile {
  id: number;
  ownerId: number;
  side: SideId;
  vfx: string;
  pos: Vec2;
  prev: Vec2;
  targetId: number | null;
  dest: Vec2;
  speed: number; // unités monde / s
  pierce: boolean;
  width: number;
  hit: Set<number>;
  onHit: (target: CombatUnit) => void;
  done: boolean;
  isAttack: boolean;
}

export interface Zone {
  id: number;
  ownerId: number;
  side: SideId;
  affects: 'enemies' | 'allies' | 'all';
  center: Hex | null;
  hexes: Hex[] | null;
  radius: number;
  remaining: number;
  total: number;
  interval: number;
  timer: number;
  actions: readonly Action[];
  ctx: ActionCtx;
  pull: boolean;
  follow: boolean;
  vfx: string;
}

interface Scheduled {
  at: number;
  seq: number;
  fn: () => void;
}

export interface SurvivorInfo {
  side: SideId;
  defId: string;
  star: number;
  cost: number;
  kind: CombatUnit['kind'];
  ownerUid?: string;
}

export interface CombatResult {
  winner: 0 | 1 | -1;
  duration: number;
  survivors: SurvivorInfo[];
  units: {
    id: number;
    side: SideId;
    defId: string;
    name: string;
    star: number;
    kind: CombatUnit['kind'];
    ownerUid?: string;
    alive: boolean;
    stats: CombatUnit['combat'];
  }[];
  gold: [number, number];
  overtime: boolean;
  aborted: boolean;
}

export class CombatSim {
  readonly rng: Rng;
  readonly stage: number;
  readonly opts: SimOptions;
  units: CombatUnit[] = [];
  private byId = new Map<number, CombatUnit>();
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  events: CombatEvent[] = [];
  readonly recordEvents: boolean;
  time = 0;
  tick = 0;
  done = false;
  winner: 0 | 1 | -1 = -1;
  overtime = false;
  aborted = false;
  gold: [number, number] = [0, 0];
  goldBySource = new Map<number, number>();
  corpses: Hex[] = [];
  private nextId = 1;
  private nextProjId = 1;
  private nextZoneId = 1;
  private nextLinkGroup = 1;
  private scheduled: Scheduled[] = [];
  private seq = 0;
  private depth = 0;
  private budget = 0;
  private started = false;
  private condTimer = 0;
  warnings: string[] = [];

  constructor(opts: SimOptions) {
    this.opts = opts;
    this.rng = new Rng(opts.seed);
    this.stage = opts.stage;
    this.recordEvents = !!opts.recordEvents;
  }

  // ── Construction ─────────────────────────────────────────────────────────
  addUnit(ident: UnitIdentity, side: SideId, hex: Hex, passives: PassiveAttach[], mods: ResolvedMod[] = [], statMult = 1): CombatUnit {
    const u = new CombatUnit(this.nextId++, side, ident, hex, statMult);
    u.permMods.push(...mods);
    for (const p of passives) this.attachPassive(u, p);
    u.finalizeSetup();
    this.units.push(u);
    this.byId.set(u.id, u);
    u.facing = side === 0 ? 1 : -1;
    return u;
  }

  attachPassive(u: CombatUnit, p: PassiveAttach): void {
    const pv = p.passive;
    const values = pv.values ?? p.values;
    if (pv.stats) for (const m of pv.stats) u.permMods.push({ stat: m.stat, value: val(m.value, p.star, values) });
    if (pv.triggers)
      for (const def of pv.triggers) {
        const rt: RuntimeTrigger = {
          def,
          values,
          star: p.star,
          source: p.source,
          label: p.label,
          fired: false,
          nextAllowed: 0,
          counter: 0,
          timer: 0,
        };
        u.triggers.push(rt);
      }
    if (pv.conditional)
      for (const c of pv.conditional)
        u.conditionals.push({
          cond: c.cond,
          mods: c.stats.map((m) => ({ stat: m.stat, value: val(m.value, p.star, values) })),
          active: false,
          label: c.label,
        });
    if (pv.guard) u.guards.push({ pct: val(pv.guard.pct, p.star, values) / 100, radius: pv.guard.radius });
    if (pv.splash) u.splash = { radius: pv.splash.radius, pct: val(pv.splash.pct, p.star, values) / 100 };
  }

  // ── Accès ────────────────────────────────────────────────────────────────
  unit(id: number): CombatUnit | null {
    return this.byId.get(id) ?? null;
  }

  aliveUnits(): CombatUnit[] {
    return this.units.filter((u) => u.alive);
  }

  enemiesOf(u: CombatUnit): CombatUnit[] {
    return this.units.filter((o) => o.alive && o.side !== u.side);
  }

  targetableEnemiesOf(u: CombatUnit): CombatUnit[] {
    return this.units.filter((o) => o.alive && o.side !== u.side && !o.isUntargetable);
  }

  alliesOf(u: CombatUnit, includeSelf: boolean): CombatUnit[] {
    return this.units.filter((o) => o.alive && o.side === u.side && (includeSelf || o.id !== u.id));
  }

  isOccupied(h: Hex, except?: CombatUnit): boolean {
    for (const u of this.units) if (u.alive && u !== except && u.hex.col === h.col && u.hex.row === h.row) return true;
    return false;
  }

  occupiedSet(except?: CombatUnit): Set<number> {
    const s = new Set<number>();
    for (const u of this.units) if (u.alive && u !== except) s.add(hexKey(u.hex));
    return s;
  }

  unitWorld(u: CombatUnit): Vec2 {
    if (u.move) {
      const a = hexToWorld(u.move.from);
      const b = hexToWorld(u.move.to);
      const t = Math.min(1, u.move.t / u.move.dur);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    return hexToWorld(u.hex);
  }

  emit(ev: CombatEvent): void {
    if (this.recordEvents) this.events.push(ev);
  }

  schedule(delay: number, fn: () => void): void {
    const item: Scheduled = { at: this.time + Math.max(0, delay), seq: this.seq++, fn };
    // insertion triée (file courte)
    let i = this.scheduled.length;
    while (i > 0 && (this.scheduled[i - 1].at > item.at || (this.scheduled[i - 1].at === item.at && this.scheduled[i - 1].seq > item.seq))) i--;
    this.scheduled.splice(i, 0, item);
  }

  /** Consomme une unité du budget d'actions ; false si le budget du pas est épuisé. */
  spend(): boolean {
    this.budget++;
    if (this.budget > COMBAT.maxEventsPerTick) {
      if (this.budget === COMBAT.maxEventsPerTick + 1) this.warnings.push(`Budget d'actions dépassé au pas ${this.tick}`);
      return false;
    }
    return true;
  }

  // ── Déclencheurs ─────────────────────────────────────────────────────────
  fire(u: CombatUnit, on: TriggerOn, targetId: number | null, eventAmount = 0): void {
    if (!u.alive && on !== 'lethal') return;
    if (this.depth >= COMBAT.maxTriggerDepth) return;
    if (!u.triggers.length) return;
    this.depth++;
    try {
      for (const tr of u.triggers) {
        if (tr.def.on !== on) continue;
        if (tr.def.once && tr.fired) continue;
        if (tr.def.icd && this.time < tr.nextAllowed) continue;
        if (on === 'nthAttack') {
          tr.counter++;
          if (tr.counter < (tr.def.every ?? 3)) continue;
          tr.counter = 0;
        }
        const ctx: ActionCtx = {
          casterId: u.id,
          targetId,
          anchor: null,
          star: tr.star,
          values: tr.values,
          eventAmount,
          killed: false,
          source: tr.source === 'passive' ? 'passive' : tr.source,
          label: tr.label,
        };
        const tgt = targetId !== null ? this.unit(targetId) : null;
        if (tgt) ctx.anchor = { ...tgt.hex };
        if (tr.def.cond && !evalCond(this, tr.def.cond, ctx)) continue;
        tr.fired = true;
        if (tr.def.icd) tr.nextAllowed = this.time + tr.def.icd;
        exec(this, tr.def.actions, ctx);
        if (!u.alive && on !== 'lethal') break;
      }
    } finally {
      this.depth--;
    }
  }

  // ── Boucle ───────────────────────────────────────────────────────────────
  private start(): void {
    this.started = true;
    this.emit({ t: 0, e: 'start' });
    const order = this.units.slice().sort((a, b) => a.id - b.id);
    for (const u of order) {
      u.hpHistory.push(u.hp);
      this.fire(u, 'combatStart', null);
    }
    this.updateConditionals(true);
  }

  run(maxSeconds = COMBAT.hardLimit + 1): CombatResult {
    const maxTicks = Math.ceil(maxSeconds / COMBAT.dt) + 5;
    while (!this.done && this.tick < maxTicks) this.step();
    if (!this.done) this.finish(-1, true);
    return this.result();
  }

  step(): void {
    if (this.done) return;
    if (!this.started) this.start();
    const dt = COMBAT.dt;
    this.time += dt;
    this.tick++;
    this.budget = 0;

    if (!this.overtime && this.time >= COMBAT.overtimeStart) {
      this.overtime = true;
      this.emit({ t: this.time, e: 'overtime' });
    }

    this.runScheduled();
    this.updateProjectiles(dt);
    this.updateZones(dt);

    const order = this.units.slice();
    for (const u of order) if (u.alive) this.updateTimers(u, dt);
    this.condTimer += dt;
    if (this.condTimer >= 0.25) {
      this.condTimer = 0;
      this.updateConditionals(false);
    }
    for (const u of order) if (u.alive) this.updateAI(u, dt);

    this.checkEnd();
  }

  private runScheduled(): void {
    while (this.scheduled.length && this.scheduled[0].at <= this.time + 1e-9) {
      const s = this.scheduled.shift()!;
      s.fn();
      if (this.done) return;
    }
  }

  private updateConditionals(force: boolean): void {
    for (const u of this.units) {
      if (!u.alive || !u.conditionals.length) continue;
      let changed = false;
      for (const c of u.conditionals) {
        const ctx: ActionCtx = {
          casterId: u.id,
          targetId: u.targetId,
          anchor: null,
          star: u.ident.star,
          values: undefined,
          eventAmount: 0,
          killed: false,
          source: 'passive',
          label: c.label ?? '',
        };
        const now = evalCond(this, c.cond, ctx);
        if (now !== c.active) {
          c.active = now;
          changed = true;
        }
      }
      if (changed || force) u.invalidate();
    }
  }

  private updateTimers(u: CombatUnit, dt: number): void {
    u.combat.timeAlive += dt;
    if (u.attackCd > 0) u.attackCd -= dt;

    // Statuts
    if (u.statuses.length) {
      for (const st of u.statuses.slice()) {
        if (st.dps > 0) {
          st.dotTimer += dt;
          while (st.dotTimer >= COMBAT.dotTickInterval && u.alive) {
            st.dotTimer -= COMBAT.dotTickInterval;
            const src = this.unit(st.sourceId);
            this.dealDamage({
              src,
              tgt: u,
              amount: st.dps * COMBAT.dotTickInterval,
              type: st.dmgType,
              kind: 'dot',
              isAbility: !!st.fromAbility,
              noReflect: true,
              tag: st.tag,
            });
          }
          if (!u.alive) return;
        }
        if (st.remaining !== Infinity) {
          st.remaining -= dt;
          if (st.remaining <= 0) {
            u.removeStatus(st);
            if (st.kind === 'stun') u.ccGraceUntil = this.time + COMBAT.stunGraceDuration;
          }
        }
      }
    }

    // Boucliers
    if (u.shields.length) {
      for (const sh of u.shields.slice()) {
        if (sh.remaining === Infinity) continue;
        sh.remaining -= dt;
        if (sh.remaining <= 0) {
          u.shields.splice(u.shields.indexOf(sh), 1);
          if (sh.onExpireHeal && sh.amount > 0) this.heal(this.unit(sh.sourceId), u, sh.amount, true);
        }
      }
    }

    // Œuf de renaissance
    if (u.stasis) {
      u.stasis.remaining -= dt;
      if (u.stasis.remaining <= 0) {
        const pct = u.stasis.reviveHpPct;
        u.stasis = null;
        u.hp = Math.max(u.hp, u.stats.maxHp * pct);
        for (const st of u.statuses.slice()) if (st.kind === 'stasis') u.removeStatus(st);
        this.emit({ t: this.time, e: 'revive', tgt: u.id });
      }
    }

    // Régénération de mana
    const s = u.stats;
    if (s.manaRegen > 0 && u.hasAbility && u.state !== 'casting' && !u.isSilenced) {
      u.mana = Math.min(s.maxMana, u.mana + s.manaRegen * dt);
    }

    // Déclencheurs périodiques et de seuil
    for (const tr of u.triggers) {
      if (tr.def.on === 'interval') {
        tr.timer += dt;
        const every = tr.def.every ?? 1;
        if (tr.timer >= every) {
          tr.timer -= every;
          this.fireOne(u, tr);
          if (!u.alive) return;
        }
      } else if (tr.def.on === 'hpBelow' && !tr.fired && u.hpPct() * 100 < (tr.def.pct ?? 50)) {
        this.fireOne(u, tr);
        if (!u.alive) return;
      }
    }

    // Historique des PV (Rembobinage)
    u.hpHistoryTimer += dt;
    if (u.hpHistoryTimer >= COMBAT.hpHistoryInterval) {
      u.hpHistoryTimer -= COMBAT.hpHistoryInterval;
      u.hpHistory.push(u.hp);
      const max = Math.ceil(COMBAT.hpHistorySeconds / COMBAT.hpHistoryInterval) + 1;
      if (u.hpHistory.length > max) u.hpHistory.shift();
    }

    // Déplacement en cours
    if (u.move) {
      u.move.t += dt;
      if (u.move.t >= u.move.dur) {
        u.move = null;
        if (u.state === 'moving') u.state = 'idle';
      }
    }

    // Action « occupée » (ruée, saut)
    if (u.state === 'busy') {
      u.busyLeft -= dt;
      if (u.busyLeft <= 0) {
        u.state = 'idle';
        const then = u.busyThen;
        u.busyThen = null;
        if (then) exec(this, then.actions, then.ctx);
      }
    }
  }

  private fireOne(u: CombatUnit, tr: RuntimeTrigger): void {
    if (tr.def.once && tr.fired) return;
    if (this.depth >= COMBAT.maxTriggerDepth) return;
    const ctx: ActionCtx = {
      casterId: u.id,
      targetId: u.targetId,
      anchor: null,
      star: tr.star,
      values: tr.values,
      eventAmount: 0,
      killed: false,
      source: tr.source === 'passive' ? 'passive' : tr.source,
      label: tr.label,
    };
    if (tr.def.cond && !evalCond(this, tr.def.cond, ctx)) return;
    tr.fired = true;
    this.depth++;
    try {
      exec(this, tr.def.actions, ctx);
    } finally {
      this.depth--;
    }
  }

  // ── Intelligence de combat ───────────────────────────────────────────────
  private updateAI(u: CombatUnit, dt: number): void {
    if (u.stasis || u.state === 'busy') return;
    if (u.isStunned) {
      if (u.state === 'windup') u.state = 'idle';
      return;
    }
    if (u.state === 'casting') {
      u.castLeft -= dt;
      if (u.castLeft <= 0) this.finishCast(u);
      return;
    }
    if (u.move) return;

    if (u.state === 'windup') {
      u.windupLeft -= dt;
      if (u.windupLeft <= 0) this.resolveAttack(u);
      return;
    }

    if (u.hasAbility && !u.isSilenced && u.mana >= u.stats.maxMana) {
      if (this.tryCast(u, false)) return;
    }

    const target = this.ensureTarget(u, dt);
    if (!target) return;
    const dist = hexDistance(u.hex, target.hex);
    const tw = hexToWorld(target.hex);
    const uw = hexToWorld(u.hex);
    if (Math.abs(tw.x - uw.x) > 0.01) u.facing = tw.x > uw.x ? 1 : -1;

    if (dist <= u.stats.range) {
      u.blockedTime = 0;
      if (!u.isDisarmed && u.attackCd <= 0) this.startAttack(u, target);
      return;
    }
    if (u.isRooted) return;
    this.stepToward(u, target, dt);
  }

  /** Score de ciblage : plus bas = meilleur. Dépend du rôle, de la portée et de l'état. */
  private targetScore(u: CombatUnit, e: CombatUnit): number {
    const d = hexDistance(u.hex, e.hex);
    const role = u.ident.role;
    let s = d * 10;
    if (role === 'assassin') {
      s = d * 4 - backlineDepth(e) * 6 - (1 - e.hpPct()) * 10;
    } else if (u.stats.range >= 2) {
      // les unités à distance concentrent leurs tirs sur les cibles affaiblies à portée
      if (d <= u.stats.range) s = d * 2 + e.hpPct() * 9 - 20;
    }
    if (e.kind === 'summon') s += 3;
    if (u.targetId === e.id) s -= 6; // persistance
    return s;
  }

  private ensureTarget(u: CombatUnit, dt: number): CombatUnit | null {
    for (const st of u.statuses) {
      if (st.kind === 'taunt') {
        const t = this.unit(st.sourceId);
        if (t && t.alive && !t.isUntargetable) {
          u.targetId = t.id;
          return t;
        }
      }
    }
    let t = u.targetId !== null ? this.unit(u.targetId) : null;
    const valid = !!t && t.alive && !t.isUntargetable && t.side !== u.side;
    u.retargetTimer -= dt;
    if (!valid || (u.retargetTimer <= 0 && hexDistance(u.hex, t!.hex) > u.stats.range)) {
      u.retargetTimer = COMBAT.retargetInterval;
      const enemies = this.targetableEnemiesOf(u);
      let best: CombatUnit | null = null;
      let bestScore = Infinity;
      for (const e of enemies) {
        const sc = this.targetScore(u, e);
        if (sc < bestScore || (sc === bestScore && best && e.id < best.id)) {
          best = e;
          bestScore = sc;
        }
      }
      t = best;
      u.targetId = t ? t.id : null;
    }
    return t;
  }

  private startAttack(u: CombatUnit, target: CombatUnit): void {
    const interval = 1 / u.stats.as;
    const windup = Math.min(COMBAT.maxWindup, Math.max(COMBAT.minWindup, interval * COMBAT.windupFraction));
    u.state = 'windup';
    u.windupLeft = windup;
    u.windupTarget = target.id;
    u.attackCd = interval;
    u.lastAttackAt = this.time;
    this.emit({ t: this.time, e: 'attack', src: u.id, tgt: target.id, ranged: u.stats.range >= 2 });
  }

  private resolveAttack(u: CombatUnit): void {
    u.state = 'idle';
    const target = u.windupTarget !== null ? this.unit(u.windupTarget) : null;
    u.windupTarget = null;
    if (!target || !target.alive || target.isUntargetable) return;
    if (hexDistance(u.hex, target.hex) > u.stats.range + 1) return;
    const ranged = u.stats.range >= 2 && !!u.ident.attackProjectile;
    if (ranged) {
      this.spawnProjectile(u, target, u.ident.attackProjectile!, u.ident.attackProjectileSpeed ?? COMBAT.defaultProjectileSpeed, (t) =>
        this.applyAttackHit(u, t),
      true);
    } else {
      this.applyAttackHit(u, target);
    }
  }

  applyAttackHit(u: CombatUnit, target: CombatUnit): void {
    if (!target.alive) return;
    const res = this.dealDamage({
      src: u,
      tgt: target,
      amount: u.stats.ad,
      type: 'physical',
      isAttack: true,
      canCrit: true,
      kind: 'attack',
    });
    if (u.splash) {
      for (const o of this.enemiesOf(u)) {
        if (o.id === target.id || hexDistance(o.hex, target.hex) > u.splash.radius) continue;
        this.dealDamage({ src: u, tgt: o, amount: u.stats.ad * u.splash.pct, type: 'physical', kind: 'other', noReflect: true });
      }
    }
    if (u.empower && u.alive) {
      const emp = u.empower;
      emp.remaining--;
      if (emp.remaining <= 0) u.empower = null;
      exec(this, emp.onHit, { ...emp.ctx, targetId: target.id, anchor: { ...target.hex }, eventAmount: res.dealt, killed: res.killed });
    }
    if (u.alive) {
      this.gainMana(u, u.stats.manaPerAttack);
      u.attacksDone++;
      this.fire(u, 'attack', target.id, res.dealt);
      this.fire(u, 'nthAttack', target.id, res.dealt);
    }
  }

  gainMana(u: CombatUnit, amount: number): void {
    if (!u.alive || !u.hasAbility || u.state === 'casting' || u.isSilenced) return;
    u.mana = Math.min(u.stats.maxMana, u.mana + amount);
  }

  // ── Compétences ──────────────────────────────────────────────────────────
  tryCast(u: CombatUnit, free: boolean): boolean {
    const ab = u.ident.ability;
    if (!ab) return false;
    const target = selectTarget(this, u, ab.target, ab.range);
    const needsEnemy = !['self', 'lowestHpPctAlly', 'lowestHpPctOtherAlly', 'highestManaAlly', 'carryAlly', 'frontAlly'].includes(ab.target);
    if (needsEnemy && !target) return false;
    const castTime = ab.castTime ?? 0.4;
    u.state = 'casting';
    u.castLeft = castTime;
    u.castTotal = castTime;
    if (!free) u.mana = 0;
    u.lastCastAt = this.time;
    u.castCtx = {
      casterId: u.id,
      targetId: target ? target.id : null,
      anchor: target ? { ...target.hex } : null,
      star: u.ident.star,
      values: ab.values,
      eventAmount: 0,
      killed: false,
      source: 'ability',
      label: ab.name,
    };
    if (target && target.side !== u.side) u.targetId = target.id;
    u.combat.casts++;
    this.emit({ t: this.time, e: 'cast', src: u.id, tgt: target ? target.id : null, name: ab.name, vfx: ab.vfx, dur: castTime });
    this.fire(u, 'cast', target ? target.id : null);
    for (const a of this.alliesOf(u, false)) this.fire(a, 'allyCast', u.id);
    if (castTime <= 0) this.finishCast(u);
    return true;
  }

  private finishCast(u: CombatUnit): void {
    u.state = 'idle';
    const ab = u.ident.ability;
    const ctx = u.castCtx;
    u.castCtx = null;
    if (!ab || !ctx || !u.alive) return;
    // La cible est morte pendant l'incantation : on recherche une cible équivalente.
    const tgt = ctx.targetId !== null ? this.unit(ctx.targetId) : null;
    if (tgt && !tgt.alive) {
      const re = selectTarget(this, u, ab.target, ab.range !== undefined ? ab.range + 1 : undefined);
      ctx.targetId = re ? re.id : null;
      if (re) ctx.anchor = { ...re.hex };
    }
    this.emit({ t: this.time, e: 'castFx', src: u.id, tgt: ctx.targetId, vfx: ab.vfx });
    exec(this, ab.actions, ctx);
  }

  // ── Déplacement ──────────────────────────────────────────────────────────
  /** Premier pas d'un plus court chemin vers une case satisfaisant goal. */
  firstStep(from: Hex, goal: (h: Hex) => boolean, occupied: Set<number>): { step: Hex; len: number } | null {
    const startK = hexKey(from);
    const prev = new Map<number, number>();
    prev.set(startK, -1);
    const queue: Hex[] = [from];
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      const ck = hexKey(cur);
      if (ck !== startK && goal(cur)) {
        // remonter jusqu'au premier pas
        let k = ck;
        let len = 1;
        while (prev.get(k) !== startK) {
          k = prev.get(k)!;
          len++;
        }
        return { step: hexFromKey(k), len };
      }
      for (const n of neighbors(cur)) {
        const nk = hexKey(n);
        if (prev.has(nk) || occupied.has(nk)) continue;
        prev.set(nk, ck);
        queue.push(n);
      }
    }
    return null;
  }

  private stepToward(u: CombatUnit, target: CombatUnit, dt: number): void {
    const occ = this.occupiedSet(u);
    const range = u.stats.range;
    let path = this.firstStep(u.hex, (h) => hexDistance(h, target.hex) <= range, occ);
    if (!path) {
      u.blockedTime += dt;
      if (u.blockedTime >= COMBAT.blockedRetargetDelay) {
        // cible inaccessible : on choisit l'ennemi atteignable le plus proche
        let best: { e: CombatUnit; len: number } | null = null;
        for (const e of this.targetableEnemiesOf(u)) {
          if (e.id === target.id) continue;
          if (hexDistance(u.hex, e.hex) <= range) {
            best = { e, len: 0 };
            break;
          }
          const p = this.firstStep(u.hex, (h) => hexDistance(h, e.hex) <= range, occ);
          if (p && (!best || p.len < best.len)) best = { e, len: p.len };
        }
        if (best) {
          u.targetId = best.e.id;
          u.blockedTime = 0;
          u.retargetTimer = COMBAT.retargetInterval * 2;
          return;
        }
      }
      // à défaut, se rapprocher d'une case libre qui réduit la distance
      let bestN: Hex | null = null;
      let bestD = hexDistance(u.hex, target.hex);
      for (const n of neighbors(u.hex)) {
        if (occ.has(hexKey(n))) continue;
        const d = hexDistance(n, target.hex);
        if (d < bestD) {
          bestD = d;
          bestN = n;
        }
      }
      if (!bestN) return;
      path = { step: bestN, len: 1 };
    } else {
      u.blockedTime = 0;
    }
    this.beginMove(u, path.step, 'walk', 1 / u.stats.moveSpeed);
    u.state = 'moving';
  }

  beginMove(u: CombatUnit, to: Hex, kind: 'walk' | 'dash' | 'leap' | 'blink' | 'knock', dur: number): void {
    const from = u.move ? this.currentApproxHex(u) : { ...u.hex };
    u.move = { from, to: { ...to }, t: 0, dur: Math.max(0.05, dur), kind };
    u.hex = { ...to };
    const fw = hexToWorld(from);
    const tw = hexToWorld(to);
    if (Math.abs(tw.x - fw.x) > 0.01) u.facing = tw.x > fw.x ? 1 : -1;
  }

  private currentApproxHex(u: CombatUnit): Hex {
    return u.move && u.move.t / u.move.dur < 0.5 ? { ...u.move.from } : { ...u.hex };
  }

  /** Case libre la plus proche d'une position (recherche en largeur). */
  nearestFreeHex(around: Hex, except?: CombatUnit, prefer?: (h: Hex) => number): Hex | null {
    const occ = this.occupiedSet(except);
    if (!occ.has(hexKey(around)) && inCombatBounds(around) && !prefer) return { ...around };
    const seen = new Set<number>([hexKey(around)]);
    let frontier: Hex[] = [around];
    for (let ring = 0; ring < 10; ring++) {
      const candidates: Hex[] = [];
      const next: Hex[] = [];
      for (const h of frontier) {
        if (!occ.has(hexKey(h)) && (ring > 0 || !prefer)) candidates.push(h);
        for (const n of neighbors(h)) {
          const k = hexKey(n);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(n);
        }
      }
      if (candidates.length) {
        if (!prefer) return candidates[0];
        candidates.sort((a, b) => prefer(a) - prefer(b) || hexKey(a) - hexKey(b));
        return candidates[0];
      }
      frontier = next;
    }
    return null;
  }

  // ── Projectiles ──────────────────────────────────────────────────────────
  spawnProjectile(owner: CombatUnit, target: CombatUnit, vfx: string, speedHex: number, onHit: (t: CombatUnit) => void, isAttack = false): void {
    const pos = this.unitWorld(owner);
    const p: Projectile = {
      id: this.nextProjId++,
      ownerId: owner.id,
      side: owner.side,
      vfx,
      pos: { ...pos },
      prev: { ...pos },
      targetId: target.id,
      dest: this.unitWorld(target),
      speed: speedHex * HEX_STEP,
      pierce: false,
      width: 0,
      hit: new Set(),
      onHit,
      done: false,
      isAttack,
    };
    this.projectiles.push(p);
    this.emit({ t: this.time, e: 'proj', id: p.id, vfx, src: owner.id });
  }

  spawnPiercing(owner: CombatUnit, toward: Hex, vfx: string, speedHex: number, length: number, width: number, onHit: (t: CombatUnit) => void): void {
    const pos = this.unitWorld(owner);
    const tw = hexToWorld(toward);
    const dx = tw.x - pos.x;
    const dy = tw.y - pos.y;
    const len = Math.hypot(dx, dy) || 1;
    const p: Projectile = {
      id: this.nextProjId++,
      ownerId: owner.id,
      side: owner.side,
      vfx,
      pos: { ...pos },
      prev: { ...pos },
      targetId: null,
      dest: { x: pos.x + (dx / len) * length * HEX_STEP, y: pos.y + (dy / len) * length * HEX_STEP },
      speed: speedHex * HEX_STEP,
      pierce: true,
      width,
      hit: new Set(),
      onHit,
      done: false,
      isAttack: false,
    };
    this.projectiles.push(p);
    this.emit({ t: this.time, e: 'proj', id: p.id, vfx, src: owner.id });
  }

  private updateProjectiles(dt: number): void {
    if (!this.projectiles.length) return;
    for (const p of this.projectiles) {
      if (p.done) continue;
      p.prev = { ...p.pos };
      if (!p.pierce) {
        let tgt = p.targetId !== null ? this.unit(p.targetId) : null;
        if (tgt && !tgt.alive) {
          if (p.isAttack) {
            p.done = true;
            continue;
          }
          // projectile de compétence : on cherche un ennemi proche du point visé
          const owner = this.unit(p.ownerId);
          let best: CombatUnit | null = null;
          let bestD = 1.6;
          for (const u of this.units) {
            if (!u.alive || u.side === p.side) continue;
            const d = Math.hypot(hexToWorld(u.hex).x - p.dest.x, hexToWorld(u.hex).y - p.dest.y) / HEX_STEP;
            if (d < bestD) {
              bestD = d;
              best = u;
            }
          }
          tgt = best;
          p.targetId = best ? best.id : null;
          if (!best || !owner) {
            p.done = true;
            continue;
          }
        }
        if (tgt) p.dest = this.unitWorld(tgt);
        const dx = p.dest.x - p.pos.x;
        const dy = p.dest.y - p.pos.y;
        const d = Math.hypot(dx, dy);
        const stepLen = p.speed * dt;
        if (d <= stepLen || d < 0.05) {
          p.pos = { ...p.dest };
          p.done = true;
          if (tgt && tgt.alive) {
            if (p.isAttack && tgt.isUntargetable) continue;
            p.onHit(tgt);
          }
        } else {
          p.pos = { x: p.pos.x + (dx / d) * stepLen, y: p.pos.y + (dy / d) * stepLen };
        }
      } else {
        const dx = p.dest.x - p.pos.x;
        const dy = p.dest.y - p.pos.y;
        const d = Math.hypot(dx, dy);
        const stepLen = p.speed * dt;
        if (d <= stepLen) {
          p.pos = { ...p.dest };
          p.done = true;
        } else {
          p.pos = { x: p.pos.x + (dx / d) * stepLen, y: p.pos.y + (dy / d) * stepLen };
        }
        const thr = 0.78 + p.width * 1.5;
        for (const u of this.units) {
          if (!u.alive || u.side === p.side || p.hit.has(u.id)) continue;
          if (pointSegmentDistance(this.unitWorld(u), p.prev, p.pos) <= thr) {
            p.hit.add(u.id);
            p.onHit(u);
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
  }

  // ── Zones ────────────────────────────────────────────────────────────────
  addZone(z: Omit<Zone, 'id'>): Zone {
    const zone = { ...z, id: this.nextZoneId++ };
    this.zones.push(zone);
    return zone;
  }

  zoneContains(z: Zone, h: Hex): boolean {
    if (z.hexes) return z.hexes.some((x) => x.col === h.col && x.row === h.row);
    return !!z.center && hexDistance(z.center, h) <= z.radius;
  }

  private updateZones(dt: number): void {
    if (!this.zones.length) return;
    for (const z of this.zones) {
      z.remaining -= dt;
      if (z.follow) {
        const o = this.unit(z.ownerId);
        if (o && o.alive) z.center = { ...o.hex };
      }
      z.timer += dt;
      while (z.timer >= z.interval && z.remaining > -1e-9) {
        z.timer -= z.interval;
        const affected = this.units.filter(
          (u) =>
            u.alive &&
            (z.affects === 'all' || (z.affects === 'enemies' ? u.side !== z.side : u.side === z.side)) &&
            this.zoneContains(z, u.hex),
        );
        for (const u of affected) {
          if (!u.alive) continue;
          exec(this, z.actions, { ...z.ctx, targetId: u.id, anchor: z.center ? { ...z.center } : z.ctx.anchor });
          if (z.pull && u.alive && z.center && hexDistance(u.hex, z.center) > 0 && !u.isCcImmune && u.state !== 'busy') {
            const c = z.center;
            const occ = this.occupiedSet(u);
            let best: Hex | null = null;
            let bestD = hexDistance(u.hex, c);
            for (const n of neighbors(u.hex)) {
              if (occ.has(hexKey(n))) continue;
              const dd = hexDistance(n, c);
              if (dd < bestD) {
                bestD = dd;
                best = n;
              }
            }
            if (best) {
              if (u.state === 'windup') u.state = 'idle';
              this.beginMove(u, best, 'knock', 0.25);
              if (u.state === 'moving' || u.state === 'idle') u.state = 'idle';
            }
          }
        }
      }
    }
    this.zones = this.zones.filter((z) => z.remaining > 0);
  }

  // ── Dégâts, soins, boucliers ─────────────────────────────────────────────
  dealDamage(o: DamageOpts): DamageResult {
    const tgt = o.tgt;
    const src = o.src;
    const zero: DamageResult = { dealt: 0, killed: false, crit: false };
    if (!tgt.alive || o.amount <= 0) return zero;
    if (tgt.isInvulnerable) {
      this.emit({ t: this.time, e: 'immune', tgt: tgt.id });
      return zero;
    }
    if (o.isAttack && tgt.isUntargetable) return zero;
    if (!this.spend()) return zero;

    let amt = o.amount;
    let crit = false;
    if (o.canCrit && src && (o.isAttack || src.stats.abilityCrit)) {
      if (this.rng.chance(src.stats.critChance)) {
        crit = true;
        amt *= src.stats.critDamage;
      }
    }
    let amp = 1;
    if (src) {
      amp += src.stats.damageAmp;
      if (src.stats.dmgPerHex > 0) amp += src.stats.dmgPerHex * hexDistance(src.hex, tgt.hex);
    }
    if (this.overtime) amp += (this.time - COMBAT.overtimeStart) * COMBAT.overtimeDamageRampPerSec;
    amt *= amp;
    amt *= Math.max(0, 1 + tgt.stats.damageTakenAmp);
    const pre = amt;
    if (o.type === 'physical') amt *= mitigation(tgt.stats.armor);
    else if (o.type === 'magic') amt *= mitigation(tgt.stats.mr);
    amt *= 1 - tgt.stats.damageReduction;
    let mitigated = Math.max(0, pre - amt);

    // Redirection (protecteurs)
    if (!o.noRedirect && amt > 0) {
      for (const g of this.units) {
        if (!g.alive || g === tgt || g.side !== tgt.side || !g.guards.length) continue;
        const guard = g.guards[0];
        if (hexDistance(g.hex, tgt.hex) > guard.radius) continue;
        const part = amt * guard.pct;
        amt -= part;
        this.dealDamage({ src, tgt: g, amount: part, type: 'true', kind: 'other', noRedirect: true, noLink: true, noReflect: true, tag: 'redirect' });
        break;
      }
    }

    // Lien (partage des dégâts)
    if (!o.noLink && amt > 0) {
      const link = tgt.statuses.find((s) => s.kind === 'link');
      if (link) {
        const others = this.units.filter(
          (u) => u.alive && u !== tgt && u.statuses.some((s) => s.kind === 'link' && s.linkGroup === link.linkGroup),
        );
        if (others.length) {
          const part = amt * link.value;
          amt -= part;
          for (const ou of others)
            this.dealDamage({ src, tgt: ou, amount: part / others.length, type: 'true', kind: 'other', noLink: true, noRedirect: true, noReflect: true, tag: 'link' });
        }
      }
    }

    // Boucliers
    let remaining = amt;
    let absorbed = 0;
    if (tgt.shields.length && remaining > 0) {
      tgt.shields.sort((a, b) => a.remaining - b.remaining || a.uid - b.uid);
      for (const sh of tgt.shields.slice()) {
        if (remaining <= 0) break;
        const take = Math.min(sh.amount, remaining);
        sh.amount -= take;
        remaining -= take;
        absorbed += take;
        if (sh.amount <= 1e-6) {
          tgt.shields.splice(tgt.shields.indexOf(sh), 1);
          this.emit({ t: this.time, e: 'shieldBreak', tgt: tgt.id });
          if (!o.noTriggers) this.fire(tgt, 'shieldBroken', src ? src.id : null, sh.initial);
        }
      }
    }
    mitigated += absorbed;

    tgt.hp -= remaining;
    tgt.lastHitAt = this.time;
    const dealt = amt;
    tgt.combat.damageTaken += dealt;
    tgt.combat.mitigated += mitigated;
    if (src) {
      src.combat.damageDealt += dealt;
      if (o.type === 'physical') src.combat.physicalDealt += dealt;
      else if (o.type === 'magic') src.combat.magicDealt += dealt;
      else src.combat.trueDealt += dealt;
    }
    this.emit({ t: this.time, e: 'hit', src: src ? src.id : null, tgt: tgt.id, amount: dealt, absorbed, dmgType: o.type, crit, kind: o.kind ?? (o.isAttack ? 'attack' : 'ability') });

    // Mana gagné en subissant des dégâts
    if (o.kind !== 'dot') {
      const manaGain = Math.min(COMBAT.manaFromDamageCap, pre * COMBAT.manaFromDamagePre + dealt * COMBAT.manaFromDamagePost);
      this.gainMana(tgt, manaGain);
    }
    // Omnivampirisme
    if (src && src.alive && src.stats.omnivamp > 0 && dealt > 0) this.heal(src, src, dealt * src.stats.omnivamp, true);

    if (!o.noTriggers) {
      if (src && src.alive) {
        this.fire(src, 'damageDealt', tgt.id, dealt);
        if (o.isAbility) this.fire(src, 'abilityHit', tgt.id, dealt);
        if (crit) this.fire(src, 'crit', tgt.id, dealt);
      }
      if (tgt.alive) {
        if (src) this.fire(tgt, 'damaged', src.id, dealt);
        if (mitigated > 0) this.fire(tgt, 'mitigated', src ? src.id : null, mitigated);
      }
    }

    // Renvoi
    if (!o.noReflect && src && src.alive && tgt.alive && dealt > 0) {
      const rf = tgt.statuses.find((s) => s.kind === 'reflect');
      if (rf) this.dealDamage({ src: tgt, tgt: src, amount: dealt * rf.value, type: 'magic', kind: 'other', noReflect: true, noRedirect: true, tag: 'reflect' });
    }

    let killed = false;
    if (tgt.alive && tgt.hp <= 0) killed = this.handleLethal(tgt, src);
    return { dealt, killed, crit };
  }

  /** Dégâts mortels : passifs « lethal » puis « allyLethal » peuvent empêcher la mort. */
  private handleLethal(tgt: CombatUnit, src: CombatUnit | null): boolean {
    tgt.hp = Math.min(tgt.hp, 0);
    // Pendant l'œuf de renaissance, la mort est définitive
    if (!tgt.stasis) {
      this.fire(tgt, 'lethal', tgt.id, 0);
      if (tgt.hp > 0) return false;
      for (const a of this.alliesOf(tgt, false)) {
        this.fire(a, 'allyLethal', tgt.id, 0);
        if (tgt.hp > 0) return false;
      }
    }
    this.kill(tgt, src);
    return true;
  }

  kill(tgt: CombatUnit, src: CombatUnit | null): void {
    if (!tgt.alive) return;
    tgt.alive = false;
    tgt.hp = 0;
    tgt.state = 'dead';
    tgt.deathTime = this.time;
    tgt.shields = [];
    tgt.castCtx = null;
    tgt.empower = null;
    tgt.stasis = null;
    this.corpses.push({ ...tgt.hex });
    this.emit({ t: this.time, e: 'death', tgt: tgt.id, src: src ? src.id : null });
    if (src && src !== tgt) {
      src.combat.kills++;
      if (src.alive) this.fire(src, 'kill', tgt.id);
    }
    for (const u of this.units.slice()) {
      if (!u.alive) continue;
      if (u.side === tgt.side) this.fire(u, 'allyDeath', tgt.id);
      else this.fire(u, 'enemyDeath', tgt.id);
    }
  }

  heal(src: CombatUnit | null, tgt: CombatUnit, amount: number, noAmp = false): number {
    if (!tgt.alive || amount <= 0) return 0;
    let amt = amount;
    if (!noAmp && src) amt *= 1 + src.stats.healPower;
    amt *= Math.max(0, 1 + tgt.stats.healReceived);
    if (this.overtime) amt *= 1 - COMBAT.overtimeHealingCut;
    const actual = Math.max(0, Math.min(amt, tgt.stats.maxHp - tgt.hp));
    if (actual <= 0) return 0;
    tgt.hp += actual;
    if (src) src.combat.healing += actual;
    if (actual >= 1) this.emit({ t: this.time, e: 'heal', src: src ? src.id : null, tgt: tgt.id, amount: actual });
    return actual;
  }

  shield(src: CombatUnit | null, tgt: CombatUnit, amount: number, duration: number, onExpireHeal: boolean, id?: string): void {
    if (!tgt.alive || amount <= 0) return;
    let amt = amount;
    if (src) amt *= 1 + src.stats.healPower;
    if (id) {
      const ex = tgt.shields.find((s) => s.id === id);
      if (ex) {
        ex.amount = Math.max(ex.amount, amt);
        ex.initial = Math.max(ex.initial, amt);
        ex.remaining = duration <= 0 ? Infinity : duration;
        return;
      }
    }
    tgt.addShield(amt, duration, src ? src.id : tgt.id, onExpireHeal, id);
    if (src) src.combat.shielding += amt;
    this.emit({ t: this.time, e: 'shield', src: src ? src.id : null, tgt: tgt.id, amount: amt });
  }

  applyStatus(src: CombatUnit | null, tgt: CombatUnit, spec: StatusSpec, ctx: ActionCtx): void {
    if (!tgt.alive) return;
    const isCc = spec.kind === 'stun' || spec.kind === 'root' || spec.kind === 'disarm' || spec.kind === 'silence' || spec.kind === 'taunt';
    if (isCc && tgt.isCcImmune) {
      this.emit({ t: this.time, e: 'immune', tgt: tgt.id });
      return;
    }
    let duration = val(spec.duration, ctx.star, ctx.values);
    if (duration <= 0) duration = Infinity;
    if (isCc && src && src.side !== tgt.side) duration *= 1 - tgt.stats.tenacity;
    if (spec.kind === 'stun' && this.time < tgt.ccGraceUntil) duration *= 1 - COMBAT.stunGraceReduction;
    const isDot = !!spec.dps;
    const perSource = spec.perSource ?? isDot;
    const key = (spec.id ?? spec.kind) + (perSource && src ? ':' + src.id : '');
    const rule = spec.stack ?? (isCc ? 'max' : 'refresh');
    const value = spec.value !== undefined ? val(spec.value, ctx.star, ctx.values) / 100 : 0;
    const mods = (spec.stats ?? []).map((m) => ({ stat: m.stat, value: val(m.value, ctx.star, ctx.values) }));
    const dps = spec.dps ? calcAmount(this, spec.dps, ctx, tgt) : 0;
    const existing = tgt.statuses.find((s) => s.key === key);
    if (existing) {
      if (rule === 'max') {
        existing.remaining = Math.max(existing.remaining, duration);
        existing.total = Math.max(existing.total, duration);
        existing.value = Math.max(existing.value, value);
      } else if (rule === 'stack') {
        if (existing.stacks < existing.maxStacks) {
          existing.stacks++;
          if (existing.mods.length) tgt.invalidate();
        }
        existing.remaining = duration;
        existing.total = duration;
      } else {
        existing.remaining = duration;
        existing.total = duration;
        existing.value = value;
        existing.dps = dps;
        existing.mods = mods;
        existing.sourceId = src ? src.id : existing.sourceId;
        if (existing.mods.length || mods.length) tgt.invalidate();
      }
    } else {
      const inst: Omit<StatusInst, 'uid'> = {
        kind: spec.kind,
        key,
        remaining: duration,
        total: duration,
        value,
        mods,
        stacks: 1,
        maxStacks: spec.maxStacks ?? 1,
        sourceId: src ? src.id : tgt.id,
        dps,
        dmgType: spec.dmgType ?? 'magic',
        dotTimer: 0,
        tag: spec.tag,
        icon: spec.icon,
        fromAbility: ctx.source === 'ability',
      };
      tgt.addStatus(inst);
    }
    if (spec.kind === 'stun' && tgt.state === 'windup') tgt.state = 'idle';
    if (spec.kind === 'taunt' && src) tgt.targetId = src.id;
    this.emit({ t: this.time, e: 'status', tgt: tgt.id, kind: spec.kind, tag: spec.tag, dur: duration });
  }

  newLinkGroup(): number {
    return this.nextLinkGroup++;
  }

  addGold(caster: CombatUnit, amount: number, cap: number): void {
    const got = this.goldBySource.get(caster.id) ?? 0;
    const give = Math.max(0, Math.min(amount, cap - got));
    if (give <= 0) return;
    this.goldBySource.set(caster.id, got + give);
    this.gold[caster.side] += give;
    this.emit({ t: this.time, e: 'gold', side: caster.side, amount: give, tgt: caster.id });
  }

  // ── Fin du combat ────────────────────────────────────────────────────────
  private checkEnd(): void {
    let a0 = 0;
    let a1 = 0;
    for (const u of this.units) if (u.alive) u.side === 0 ? a0++ : a1++;
    if (a0 === 0 || a1 === 0) {
      this.finish(a0 === 0 && a1 === 0 ? -1 : a0 === 0 ? 1 : 0, false);
    } else if (this.time >= COMBAT.hardLimit) {
      this.finish(-1, false);
    }
  }

  private finish(winner: 0 | 1 | -1, aborted: boolean): void {
    if (this.done) return;
    this.done = true;
    this.winner = winner;
    this.aborted = aborted;
    for (const u of this.units.slice().sort((a, b) => a.id - b.id)) if (u.alive) this.fire(u, 'combatEnd', null);
    this.emit({ t: this.time, e: 'end', winner });
  }

  result(): CombatResult {
    const survivors: SurvivorInfo[] = [];
    for (const u of this.units) {
      if (!u.alive || u.kind !== 'champion') continue;
      survivors.push({ side: u.side, defId: u.ident.defId, star: u.ident.star, cost: u.ident.cost, kind: u.kind, ownerUid: u.ident.ownerUid });
    }
    return {
      winner: this.winner,
      duration: this.time,
      survivors,
      units: this.units.map((u) => ({
        id: u.id,
        side: u.side,
        defId: u.ident.defId,
        name: u.ident.name,
        star: u.ident.star,
        kind: u.kind,
        ownerUid: u.ident.ownerUid,
        alive: u.alive,
        stats: { ...u.combat },
      })),
      gold: [this.gold[0], this.gold[1]],
      overtime: this.overtime,
      aborted: this.aborted,
    };
  }
}

export function mitigation(resist: number): number {
  return resist >= 0 ? 100 / (100 + resist) : 2 - 100 / (100 - resist);
}
