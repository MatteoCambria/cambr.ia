/**
 * Libellés des modificateurs de statistiques, partagés par l'interface et la documentation générée.
 */
import type { StatKey, StatMod } from '../combat/dsl';
import { fmt, val } from '../combat/values';

const STAT_LABEL: Record<StatKey, (v: number) => string> = {
  hp: (v) => `+${fmt(v)} PV`,
  hpPct: (v) => `+${fmt(v)} % PV max`,
  ad: (v) => `+${fmt(v)} PA`,
  adPct: (v) => `+${fmt(v)} % de PA`,
  ap: (v) => `+${fmt(v)} Puissance`,
  asPct: (v) => `${v >= 0 ? '+' : ''}${fmt(v)} % vitesse d’attaque`,
  armor: (v) => `+${fmt(v)} armure`,
  mr: (v) => `+${fmt(v)} résistance magique`,
  armorPct: (v) => `${fmt(v)} % armure`,
  mrPct: (v) => `${fmt(v)} % résistance magique`,
  critChance: (v) => `+${fmt(v)} % chances de critique`,
  critDamage: (v) => `+${fmt(v)} % dégâts critiques`,
  mana: (v) => `+${fmt(v)} mana de départ`,
  manaCostPct: (v) => `${fmt(v)} % coût de mana`,
  manaPerAttack: (v) => `+${fmt(v)} mana par attaque`,
  manaRegen: (v) => `+${fmt(v)} mana par seconde`,
  omnivamp: (v) => `${fmt(v)} % d’omnivampirisme`,
  damageAmp: (v) => `+${fmt(v)} % de dégâts infligés`,
  damageReduction: (v) => `−${fmt(v)} % de dégâts subis`,
  healPower: (v) => `+${fmt(v)} % soins et boucliers`,
  healReceived: (v) => `${fmt(v)} % soins reçus`,
  range: (v) => `+${fmt(v)} portée`,
  moveSpeedPct: (v) => `+${fmt(v)} % vitesse de déplacement`,
  tenacity: (v) => `+${fmt(v)} % ténacité`,
  dmgPerHex: (v) => `+${fmt(v)} % dégâts par hexagone`,
  abilityCrit: () => 'Compétences critiques',
  summonPower: (v) => `+${fmt(v)} % invocations`,
  damageTakenAmp: (v) => `+${fmt(v)} % dégâts subis`,
};

export function statText(m: StatMod): string {
  return STAT_LABEL[m.stat](val(m.value, 1));
}

