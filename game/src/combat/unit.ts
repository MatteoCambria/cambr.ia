/**
 * Unité de combat : état dynamique d'un champion, d'une invocation ou d'une créature
 * pendant une simulation. Les statistiques finales sont recalculées à la demande
 * (drapeau « dirty ») à partir des statistiques de base, des modificateurs permanents
 * (objets, synergies, passifs) et des statuts actifs.
 */
import type { AbilityDef, Action, Condition, DmgType, StatKey, StatusKind, TriggerDef, ValueMap } from './dsl';
import type { BaseStats, Look } from '../core/defs';
import type { Hex } from '../board/hex';
import { COMBAT, STAR_AD_MULT, STAR_HP_MULT } from '../config/balance';

export type SideId = 0 | 1;
export type UnitKind = 'champion' | 'summon' | 'creature';

export interface FinalStats {
  maxHp: number;
  ad: number;
  ap: number;
  as: number;
  armor: number;
  mr: number;
  critChance: number; // 0..1
  critDamage: number; // multiplicateur
  range: number;
  moveSpeed: number;
  maxMana: number;
  manaPerAttack: number;
  manaRegen: number;
  omnivamp: number; // 0..1
  damageAmp: number; // 0..x
  damageReduction: number; // 0..cap
  damageTakenAmp: number;
  healPower: number;
  healReceived: number; // multiplicateur additif (-0.5 = moitié)
  tenacity: number;
  dmgPerHex: number;
  abilityCrit: boolean;
  summonPower: number;
}

export interface ResolvedMod {
  stat: StatKey;
  value: number;
}

export interface StatusInst {
  uid: number;
  kind: StatusKind;
  key: string;
  remaining: number; // Infinity = permanent
  total: number;
  value: number;
  mods: ResolvedMod[];
  stacks: number;
  maxStacks: number;
  sourceId: number;
  dps: number;
  dmgType: DmgType;
  dotTimer: number;
  tag?: string;
  icon?: string;
  linkGroup?: number;
  /** Statut posé par une compétence : ses dégâts sur la durée comptent comme dégâts de compétence. */
  fromAbility?: boolean;
}

export interface ShieldInst {
  uid: number;
  amount: number;
  initial: number;
  remaining: number; // durée
  sourceId: number;
  onExpireHeal: boolean;
  id?: string;
}

/** Contexte d'exécution d'actions (compétence, passif, synergie, objet). */
export interface ActionCtx {
  casterId: number;
  targetId: number | null;
  anchor: Hex | null;
  star: number;
  values: ValueMap | undefined;
  eventAmount: number;
  killed: boolean;
  source: 'ability' | 'passive' | 'item' | 'trait' | 'attack';
  label: string;
}

export interface RuntimeTrigger {
  def: TriggerDef;
  values: ValueMap | undefined;
  star: number;
  source: 'passive' | 'item' | 'trait';
  label: string;
  fired: boolean;
  nextAllowed: number;
  counter: number;
  timer: number;
}

export interface ConditionalMods {
  cond: Condition;
  mods: ResolvedMod[];
  active: boolean;
  label?: string;
}

export interface UnitCombatStats {
  damageDealt: number;
  physicalDealt: number;
  magicDealt: number;
  trueDealt: number;
  damageTaken: number;
  mitigated: number;
  healing: number;
  shielding: number;
  kills: number;
  casts: number;
  timeAlive: number;
}

export interface MoveAnim {
  from: Hex;
  to: Hex;
  t: number;
  dur: number;
  kind: 'walk' | 'dash' | 'leap' | 'blink' | 'knock';
}

export interface UnitIdentity {
  defId: string;
  name: string;
  kind: UnitKind;
  star: number;
  cost: number;
  traits: readonly string[];
  items: readonly string[];
  look: Look;
  ability?: AbilityDef;
  base: BaseStats;
  attackProjectile?: string;
  attackProjectileSpeed?: number;
  /** Uid de l'unité possédée (plateau du joueur) pour remonter les statistiques. */
  ownerUid?: string;
  /** Rôle principal (influence le score de ciblage). */
  role?: string;
}

let statusUid = 1;
let shieldUid = 1;

export class CombatUnit {
  readonly id: number;
  readonly side: SideId;
  readonly ident: UnitIdentity;
  readonly kind: UnitKind;

  // Statistiques de base après application du rang
  baseHp: number;
  baseAd: number;
  baseAs: number;
  baseArmor: number;
  baseMr: number;
  baseRange: number;
  baseMaxMana: number;
  baseStartMana: number;
  baseMoveSpeed: number;
  baseManaPerAttack: number;
  baseCrit: number;

  permMods: ResolvedMod[] = [];
  statuses: StatusInst[] = [];
  shields: ShieldInst[] = [];
  conditionals: ConditionalMods[] = [];
  triggers: RuntimeTrigger[] = [];
  guards: { pct: number; radius: number }[] = [];
  splash: { radius: number; pct: number } | null = null;

  private cached: FinalStats | null = null;

  hp = 0;
  mana = 0;
  hex: Hex;
  alive = true;
  deathTime = -1;

  state: 'idle' | 'moving' | 'windup' | 'casting' | 'busy' | 'dead' = 'idle';
  targetId: number | null = null;
  attackCd = 0;
  windupLeft = 0;
  windupTarget: number | null = null;
  castLeft = 0;
  castCtx: ActionCtx | null = null;
  castTotal = 0;
  busyLeft = 0;
  busyThen: { actions: readonly Action[]; ctx: ActionCtx } | null = null;
  move: MoveAnim | null = null;
  retargetTimer = 0;
  blockedTime = 0;
  attacksDone = 0;
  counters = new Map<string, number>();
  empower: { remaining: number; onHit: readonly Action[]; ctx: ActionCtx; tag?: string } | null = null;
  stasis: { remaining: number; reviveHpPct: number } | null = null;
  ccGraceUntil = -1;
  hpHistory: number[] = [];
  hpHistoryTimer = 0;
  summonerId: number | null = null;
  recastCount = 0;
  transformed = false;
  scale = 1;
  facing: 1 | -1 = 1;
  lastAttackAt = -10;
  lastCastAt = -10;
  lastHitAt = -10;
  untargetableUntil = -1;

  combat: UnitCombatStats = {
    damageDealt: 0,
    physicalDealt: 0,
    magicDealt: 0,
    trueDealt: 0,
    damageTaken: 0,
    mitigated: 0,
    healing: 0,
    shielding: 0,
    kills: 0,
    casts: 0,
    timeAlive: 0,
  };

  constructor(id: number, side: SideId, ident: UnitIdentity, hex: Hex, statMult = 1) {
    this.id = id;
    this.side = side;
    this.ident = ident;
    this.kind = ident.kind;
    this.hex = { ...hex };
    const b = ident.base;
    const star = ident.star;
    const hpMult = ident.kind === 'champion' ? starHp(star) : 1;
    const adMult = ident.kind === 'champion' ? starAd(star) : 1;
    this.baseHp = b.hp * hpMult * statMult;
    this.baseAd = b.ad * adMult * statMult;
    this.baseAs = b.as;
    this.baseArmor = b.armor;
    this.baseMr = b.mr;
    this.baseRange = b.range;
    this.baseStartMana = b.mana[0];
    this.baseMaxMana = b.mana[1];
    this.baseMoveSpeed = b.moveSpeed ?? COMBAT.defaultMoveSpeed;
    this.baseManaPerAttack = b.manaPerAttack ?? COMBAT.manaPerAttackDefault;
    this.baseCrit = b.critChance ?? COMBAT.baseCritChance * 100;
  }

  /** Initialise PV et mana une fois tous les modificateurs permanents posés. */
  finalizeSetup(): void {
    this.cached = null;
    const s = this.stats;
    this.hp = s.maxHp;
    this.mana = Math.min(s.maxMana, this.baseStartMana + this.sumMods('mana'));
  }

  get name(): string {
    return this.ident.name;
  }

  get hasAbility(): boolean {
    return !!this.ident.ability && this.baseMaxMana > 0;
  }

  invalidate(): void {
    if (!this.cached) return;
    const oldMax = this.cached.maxHp;
    this.cached = null;
    const newMax = this.stats.maxHp;
    if (this.alive && newMax !== oldMax) {
      if (newMax > oldMax) this.hp += newMax - oldMax;
      this.hp = Math.min(this.hp, newMax);
    }
  }

  private sumMods(stat: StatKey): number {
    let s = 0;
    for (const m of this.permMods) if (m.stat === stat) s += m.value;
    for (const st of this.statuses) for (const m of st.mods) if (m.stat === stat) s += m.value * st.stacks;
    for (const c of this.conditionals) {
      if (!c.active) continue;
      for (const m of c.mods) if (m.stat === stat) s += m.value;
    }
    return s;
  }

  get stats(): FinalStats {
    if (this.cached) return this.cached;
    const sums = new Map<StatKey, number>();
    const add = (m: ResolvedMod, k = 1) => sums.set(m.stat, (sums.get(m.stat) ?? 0) + m.value * k);
    for (const m of this.permMods) add(m);
    for (const st of this.statuses) for (const m of st.mods) add(m, st.stacks);
    for (const c of this.conditionals) if (c.active) for (const m of c.mods) add(m);
    const g = (k: StatKey) => sums.get(k) ?? 0;

    const maxHp = Math.max(1, (this.baseHp + g('hp')) * (1 + g('hpPct') / 100));
    const ad = Math.max(0, this.baseAd * (1 + g('adPct') / 100) + g('ad'));
    const ap = Math.max(0, 100 + g('ap'));
    const as = clamp(this.baseAs * (1 + g('asPct') / 100), COMBAT.attackSpeedFloor, COMBAT.attackSpeedCap);
    const armor = (this.baseArmor + g('armor')) * Math.max(0, 1 + g('armorPct') / 100);
    const mr = (this.baseMr + g('mr')) * Math.max(0, 1 + g('mrPct') / 100);
    const critChance = clamp((this.baseCrit + g('critChance')) / 100, 0, 1);
    const critDamage = COMBAT.baseCritDamage + g('critDamage') / 100;
    const range = Math.max(1, this.baseRange + g('range'));
    const moveSpeed = Math.max(0.6, this.baseMoveSpeed * (1 + g('moveSpeedPct') / 100));
    const maxMana = this.baseMaxMana > 0 ? Math.max(10, Math.round(this.baseMaxMana * (1 + g('manaCostPct') / 100))) : 0;
    this.cached = {
      maxHp,
      ad,
      ap,
      as,
      armor,
      mr,
      critChance,
      critDamage,
      range,
      moveSpeed,
      maxMana,
      manaPerAttack: Math.max(0, this.baseManaPerAttack + g('manaPerAttack')),
      manaRegen: g('manaRegen'),
      omnivamp: g('omnivamp') / 100,
      damageAmp: g('damageAmp') / 100,
      damageReduction: clamp(g('damageReduction') / 100, -1, COMBAT.maxDamageReduction),
      damageTakenAmp: g('damageTakenAmp') / 100,
      healPower: g('healPower') / 100,
      healReceived: g('healReceived') / 100,
      tenacity: clamp(g('tenacity') / 100, 0, 0.8),
      dmgPerHex: g('dmgPerHex') / 100,
      abilityCrit: g('abilityCrit') > 0,
      summonPower: g('summonPower') / 100,
    };
    return this.cached;
  }

  hasStatus(kind: StatusKind): boolean {
    for (const s of this.statuses) if (s.kind === kind) return true;
    return false;
  }

  hasTag(tag: string): boolean {
    for (const s of this.statuses) if (s.tag === tag || s.kind === tag) return true;
    return false;
  }

  get isStunned(): boolean {
    return this.hasStatus('stun') || this.stasis !== null;
  }
  get isRooted(): boolean {
    return this.hasStatus('root');
  }
  get isDisarmed(): boolean {
    return this.hasStatus('disarm');
  }
  get isSilenced(): boolean {
    return this.hasStatus('silence');
  }
  get isUntargetable(): boolean {
    return this.hasStatus('untargetable');
  }
  get isInvulnerable(): boolean {
    return this.hasStatus('invulnerable');
  }
  get isCcImmune(): boolean {
    return this.hasStatus('ccImmune');
  }

  get shieldTotal(): number {
    let s = 0;
    for (const sh of this.shields) s += sh.amount;
    return s;
  }

  hpPct(): number {
    return this.hp / this.stats.maxHp;
  }

  addStatus(st: Omit<StatusInst, 'uid'>): StatusInst {
    const inst: StatusInst = { ...st, uid: statusUid++ };
    this.statuses.push(inst);
    if (inst.mods.length) this.invalidate();
    return inst;
  }

  removeStatus(inst: StatusInst): void {
    const i = this.statuses.indexOf(inst);
    if (i >= 0) {
      this.statuses.splice(i, 1);
      if (inst.mods.length) this.invalidate();
    }
  }

  addShield(amount: number, duration: number, sourceId: number, onExpireHeal: boolean, id?: string): ShieldInst {
    const sh: ShieldInst = {
      uid: shieldUid++,
      amount,
      initial: amount,
      remaining: duration <= 0 ? Infinity : duration,
      sourceId,
      onExpireHeal,
      id,
    };
    this.shields.push(sh);
    return sh;
  }

  counter(name: string): number {
    return this.counters.get(name) ?? 0;
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function starHp(star: number): number {
  return STAR_HP_MULT[star] ?? 1;
}
function starAd(star: number): number {
  return STAR_AD_MULT[star] ?? 1;
}
