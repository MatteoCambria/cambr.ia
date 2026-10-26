/**
 * Langage déclaratif des compétences, passifs, synergies et objets.
 *
 * Une compétence n'est jamais du code spécifique : c'est une liste d'actions typées
 * (dégâts, soins, boucliers, statuts, projectiles, zones, invocations…) que le moteur
 * interprète. Les valeurs numériques sont nommées (`values`) et réutilisées par la
 * description affichée, ce qui garantit que le texte correspond au moteur.
 */

/** Valeur : nombre fixe, triplet par rang d'étoile, ou clé d'une valeur nommée. */
export type V = number | readonly [number, number, number] | string;

export type ValueMap = Readonly<Record<string, number | readonly [number, number, number]>>;

export type DmgType = 'physical' | 'magic' | 'true';

export type StatKey =
  | 'hp' // PV max (plat)
  | 'hpPct' // PV max (%)
  | 'ad' // puissance d'attaque (plat)
  | 'adPct' // puissance d'attaque (% de la base)
  | 'ap' // puissance des compétences (base 100)
  | 'asPct' // vitesse d'attaque (% de la base)
  | 'armor'
  | 'mr'
  | 'armorPct' // modif. % d'armure (négatif = Brèche)
  | 'mrPct' // modif. % de résistance magique (négatif = Corrosion)
  | 'critChance' // en points de %
  | 'critDamage' // en points de %
  | 'mana' // mana de départ
  | 'manaCostPct' // modif. % du coût de la compétence
  | 'manaPerAttack'
  | 'manaRegen' // mana par seconde
  | 'omnivamp' // % des dégâts infligés rendus en PV
  | 'damageAmp' // % de dégâts infligés
  | 'damageReduction' // % de dégâts subis en moins
  | 'healPower' // % de soins et boucliers prodigués
  | 'healReceived' // % de soins reçus (négatif = Blessure)
  | 'range'
  | 'moveSpeedPct'
  | 'tenacity' // % de réduction de durée des contrôles
  | 'dmgPerHex' // % de dégâts par hexagone de distance (Tireur)
  | 'abilityCrit' // > 0 : les compétences peuvent être critiques
  | 'summonPower' // % de statistiques pour les invocations
  | 'damageTakenAmp'; // % de dégâts subis en plus (Marque)

export interface StatMod {
  stat: StatKey;
  value: V;
}

export type Side = 'enemies' | 'allies' | 'all';

/**
 * Montant d'un effet. `base` est multiplié par la Puissance (PA/100) sauf si noAp.
 * Les ratios (ad, ap, armor, mr, casterHp, targetHp…) sont exprimés en POURCENTAGE :
 * ad: 180 signifie 180 % de la puissance d'attaque.
 */
export interface Amount {
  base?: V;
  ad?: V; // × puissance d'attaque actuelle
  ap?: V; // × PA (en points, ex. 0.5 × 140 PA)
  armor?: V; // × armure du lanceur
  mr?: V;
  casterHp?: V; // × PV max du lanceur
  targetHp?: V; // × PV max de la cible
  targetMissingHp?: V; // × PV manquants de la cible
  targetCurrentHp?: V;
  event?: V; // × montant de l'événement déclencheur (dégâts subis, bouclier…)
  perCounter?: { name: string; value: V };
  noAp?: boolean;
}

export type TargetSel =
  | 'current' // cible actuelle de l'attaque
  | 'self'
  | 'nearestEnemy'
  | 'farthestEnemy'
  | 'lowestHpEnemy'
  | 'lowestHpPctEnemy'
  | 'highestHpEnemy'
  | 'carryEnemy' // ennemi le plus menaçant (dégâts estimés)
  | 'clusterEnemy' // ennemi au centre du plus gros groupe
  | 'randomEnemy'
  | 'backlineEnemy' // ennemi le plus en retrait
  | 'highestManaEnemy'
  | 'lowestHpPctAlly'
  | 'lowestHpPctOtherAlly'
  | 'highestManaAlly'
  | 'carryAlly'
  | 'frontAlly';

export type Area =
  | { shape: 'target' }
  | { shape: 'self' }
  | { shape: 'circle'; at: 'target' | 'self' | 'anchor'; radius: number; side: Side; excludeTarget?: boolean; excludeSelf?: boolean }
  | { shape: 'line'; length: number; width?: number; side: Side }
  | { shape: 'all'; side: Side; excludeSelf?: boolean }
  | { shape: 'lowestHpAllies'; count: V; includeSelf?: boolean }
  | { shape: 'nearest'; count: V; side: Side; of: 'self' | 'target'; excludeTarget?: boolean }
  | { shape: 'random'; count: V; side: Side }
  | { shape: 'adjacentAllies'; includeSelf?: boolean }
  | { shape: 'rowAllies'; includeSelf?: boolean }
  | { shape: 'highestStat'; stat: 'ad' | 'ap' | 'mana'; count: V; side: Side; includeSelf?: boolean }
  | { shape: 'select'; sel: TargetSel; range?: number };

export type StatusKind =
  | 'stun'
  | 'root'
  | 'disarm'
  | 'silence'
  | 'taunt'
  | 'burn'
  | 'poison'
  | 'bleed'
  | 'stats' // modificateurs de statistiques (buffs, ralentissements, brèche…)
  | 'untargetable'
  | 'invulnerable'
  | 'ccImmune'
  | 'reflect'
  | 'link'
  | 'stasis';

export type StackRule = 'refresh' | 'stack' | 'max';

export interface StatusSpec {
  kind: StatusKind;
  duration: V; // secondes ; 0 = jusqu'à la fin du combat
  value?: V; // reflet (%), part de lien (%)
  stats?: readonly StatMod[];
  dps?: Amount; // dégâts par seconde (brûlure, poison, saignement)
  dmgType?: DmgType;
  id?: string; // clé de cumul
  stack?: StackRule;
  maxStacks?: number;
  perSource?: boolean; // une instance par source
  tag?: string; // libellé affiché (ex. « Brèche », « Ralenti »)
  icon?: string;
}

export type Condition =
  | { c: 'targetHpBelow'; pct: V }
  | { c: 'targetHpAbove'; pct: V }
  | { c: 'selfHpBelow'; pct: V }
  | { c: 'killed' }
  | { c: 'alone'; radius: number }
  | { c: 'alliesWithin'; radius: number; min: number }
  | { c: 'counterAtLeast'; name: string; value: V }
  | { c: 'stageAtLeast'; stage: number }
  | { c: 'stageBelow'; stage: number }
  | { c: 'chance'; p: V }
  | { c: 'targetHas'; tag: string }
  | { c: 'targetShielded' }
  | { c: 'targetIsSummon' }
  | { c: 'targetHasTrait'; trait: string }
  | { c: 'selfHasTrait'; trait: string }
  | { c: 'selfShielded' }
  | { c: 'distanceAtLeast'; hexes: number }
  | { c: 'not'; cond: Condition }
  | { c: 'all'; conds: readonly Condition[] };

export type MoveMode =
  | 'dashBehind'
  | 'dashAdjacent'
  | 'teleportBehind'
  | 'leapBackline'
  | 'dashThrough'
  | 'leapCluster'
  | 'retreat';

export type SummonAt = 'adjacentSelf' | 'nearTarget' | 'corpse' | 'front';

export type Action =
  | { do: 'damage'; area?: Area; amount: Amount; type: DmgType; canCrit?: boolean; vfx?: string; onHit?: readonly Action[]; tag?: string }
  | { do: 'heal'; area?: Area; amount: Amount; vfx?: string }
  | { do: 'shield'; area?: Area; amount: Amount; duration: V; onExpire?: 'heal'; vfx?: string; id?: string }
  | { do: 'status'; area?: Area; status: StatusSpec; vfx?: string }
  | { do: 'cleanse'; area?: Area }
  | { do: 'mana'; area?: Area; amount: V }
  | { do: 'projectile'; vfx: string; speed?: number; pierce?: { length: number; width?: number }; onHit: readonly Action[] }
  | { do: 'chain'; vfx: string; bounces: V; range: number; onHit: readonly Action[]; interval?: number }
  | { do: 'delay'; seconds: number; actions: readonly Action[]; vfx?: string; anchorTarget?: boolean }
  | { do: 'repeat'; times: V; interval: number; actions: readonly Action[]; retarget?: TargetSel }
  | { do: 'move'; mode: MoveMode; duration?: number; untargetable?: boolean; then?: readonly Action[]; vfx?: string; hexes?: number }
  | { do: 'displace'; area?: Area; mode: 'pull' | 'push'; hexes?: number; vfx?: string }
  | { do: 'summon'; unit: string; count?: V; at: SummonAt; level?: V; vfx?: string }
  | {
      do: 'zone';
      at: 'target' | 'self' | 'anchor' | 'alliedCarries';
      radius: number;
      count?: number; // pour alliedCarries : nombre de cases
      duration: V;
      interval: number;
      side: Side;
      actions: readonly Action[];
      pull?: boolean;
      follow?: boolean; // la zone suit le lanceur
      vfx: string;
    }
  | { do: 'empower'; attacks: V; onHit: readonly Action[]; tag?: string }
  | { do: 'transform'; stats: readonly StatMod[]; splash?: { radius: number; pct: V }; scale?: number; vfx?: string }
  | { do: 'execute'; area?: Area; threshold: V; vfx?: string }
  | { do: 'link'; area: Area; share: V; duration: V; vfx?: string }
  | { do: 'rewind'; area: Area; seconds: number; vfx?: string }
  | { do: 'counter'; name: string; add?: V; addEvent?: number; max?: number }
  | { do: 'resetCounter'; name: string }
  | { do: 'if'; cond: Condition; then: readonly Action[]; else?: readonly Action[] }
  | { do: 'gold'; amount: number; cap: number }
  | { do: 'preventDeath'; hpPct: V; invulnerable?: number; vfx?: string }
  | { do: 'rebirth'; eggHpPct: number; duration: number; reviveHpPct: V; vfx?: string }
  | { do: 'recast'; max: number }
  | { do: 'vfx'; vfx: string; at?: 'self' | 'target' };

export type TriggerOn =
  | 'combatStart'
  | 'interval' // every = secondes
  | 'attack' // attaque réussie (cible = unité touchée)
  | 'nthAttack' // every = n
  | 'abilityHit' // dégâts de compétence infligés
  | 'damageDealt' // tous dégâts infligés
  | 'damaged' // dégâts subis (cible = attaquant)
  | 'mitigated' // dégâts bloqués par armure/RM/boucliers (event = montant)
  | 'kill'
  | 'allyDeath'
  | 'enemyDeath'
  | 'cast'
  | 'allyCast'
  | 'shieldBroken'
  | 'hpBelow' // pct
  | 'crit'
  | 'lethal' // dégâts mortels sur soi (peut empêcher la mort)
  | 'allyLethal' // dégâts mortels sur un allié
  | 'combatEnd'; // fin du combat, unités encore en vie

export interface TriggerDef {
  on: TriggerOn;
  every?: number;
  pct?: number;
  once?: boolean;
  icd?: number; // délai interne en secondes
  cond?: Condition;
  actions: readonly Action[];
}

export interface PassiveDef {
  name?: string;
  desc?: string;
  values?: ValueMap;
  stats?: readonly StatMod[];
  triggers?: readonly TriggerDef[];
  conditional?: readonly { cond: Condition; stats: readonly StatMod[]; label?: string }[];
  /** Part des dégâts subis par les alliés proches redirigée vers le porteur. */
  guard?: { pct: V; radius: number };
  /** Attaques qui touchent aussi autour de la cible. */
  splash?: { radius: number; pct: V };
}

export interface AbilityDef {
  name: string;
  desc: string;
  values: ValueMap;
  target: TargetSel;
  range?: number;
  castTime?: number;
  actions: readonly Action[];
  vfx?: string;
  sfx?: string;
}
