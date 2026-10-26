/**
 * Caractéristiques d'animation de chaque arme : style d'attaque, prise à une
 * ou deux mains et pose de repos. Les angles de bras sont mesurés depuis la
 * verticale descendante (0 = bras pendant, π/2 = bras tendu vers l'avant, π = levé).
 * La rotation d'arme suit la convention canvas : 0 = arme pointée vers le haut,
 * π/2 = vers l'avant (+x), π = vers le bas.
 */
import type { WeaponShape } from '../../core/defs';

export type Style =
  | 'swing'
  | 'heavy'
  | 'thrust'
  | 'stab'
  | 'bow'
  | 'recoil'
  | 'point'
  | 'magic'
  | 'throw'
  | 'bash'
  | 'lash'
  | 'punch'
  | 'slash';

export interface WSpec {
  style: Style;
  /** La main lointaine tient aussi l'arme, à `grip2` unités le long de l'axe (négatif = vers la pointe). */
  two: boolean;
  grip2: number;
  na: number;
  ne: number;
  r: number;
  fa: number;
  fe: number;
  /** Distance poignée → pointe (traînées, lueurs, flash de bouche). */
  tip: number;
  /** L'arme reste verticale quelle que soit la rotation du bras (orbe, lanterne…). */
  upright?: boolean;
  /** Recul important (canon). */
  kick?: number;
}

const D = Math.PI / 2;

function S(style: Style, p: Partial<WSpec>): WSpec {
  return { style, two: false, grip2: 0, na: 0.45, ne: 0.95, r: 0.35, fa: 0.25, fe: 0.9, tip: 20, ...p };
}

export const WEAPONS: Record<WeaponShape, WSpec> = {
  sword: S('swing', { r: 1.0, tip: 33 }),
  greatsword: S('heavy', { two: true, grip2: 5, na: 0.95, ne: 0.72, r: -0.78, fa: 0.95, fe: 0.68, tip: 46 }),
  staff: S('point', { na: 0.55, ne: 0.9, r: 0.2, fa: 0.3, tip: 59 }),
  bow: S('bow', { na: 0.35, ne: 0.85, r: D + 0.3, fa: 1.15, fe: 0.95, tip: 0 }),
  crossbow: S('recoil', { two: true, grip2: -11, na: 0.95, ne: 0.75, r: D + 0.25, fa: 1.15, fe: 0.92, tip: 22 }),
  daggers: S('stab', { na: 0.55, ne: 0.9, r: 0.9, fa: 0.5, fe: 0.92, tip: 14 }),
  hammer: S('heavy', { na: 1.0, ne: 0.7, r: -0.62, fa: 0.6, fe: 0.8, tip: 32 }),
  shield: S('bash', { na: 0.95, ne: 0.72, r: 0, fa: 0.3, fe: 0.85, tip: 12 }),
  tome: S('magic', { na: 1.2, ne: 0.85, r: 0, fa: 0.5, upright: true, tip: 8 }),
  gun: S('recoil', { two: true, grip2: -13, na: 0.8, ne: 0.8, r: 1.2, fa: 1.05, fe: 0.88, tip: 34 }),
  cannon: S('recoil', { two: true, grip2: -9, na: 1.15, ne: 0.6, r: D - 0.32, fa: 1.3, fe: 0.62, tip: 24, kick: 1.6 }),
  lance: S('thrust', { na: 0.5, ne: 0.95, r: 0.2, fa: 0.3, tip: 68 }),
  claws: S('slash', { na: 0.6, ne: 0.95, r: 1.3, fa: 0.5, fe: 0.92, tip: 10 }),
  orb: S('magic', { na: 1.1, ne: 0.8, r: 0, upright: true, tip: 11 }),
  scythe: S('heavy', { two: true, grip2: 13, na: 0.42, ne: 0.95, r: 0.08, fa: 0.6, fe: 0.8, tip: 58 }),
  fan: S('swing', { na: 0.8, ne: 0.9, r: 0.7, tip: 17 }),
  harpoon: S('thrust', { na: 0.5, ne: 0.95, r: 0.26, tip: 56 }),
  wrench: S('swing', { na: 0.45, ne: 0.95, r: 0.95, tip: 25 }),
  censer: S('magic', { na: 0.95, ne: 0.9, r: 0, upright: true, tip: 16 }),
  flask: S('throw', { na: 1.0, ne: 0.8, r: 0.15, upright: true, tip: 7 }),
  banner: S('thrust', { na: 0.4, ne: 0.95, r: 0.04, fa: 0.3, tip: 82 }),
  chakram: S('throw', { na: 0.65, ne: 0.95, r: 0, tip: 10 }),
  lantern: S('magic', { na: 0.9, ne: 0.95, r: 0, upright: true, tip: 9 }),
  drill: S('thrust', { na: 1.25, ne: 0.8, r: D - 0.15, tip: 20 }),
  whip: S('lash', { na: 0.4, ne: 0.95, r: 0, tip: 30 }),
  none: S('punch', { na: 0.35, ne: 0.9, r: 0, fa: 0.25, tip: 0 }),
};

export function specFor(w: WeaponShape): WSpec {
  return WEAPONS[w] ?? WEAPONS.none;
}

/**
 * Armes qui gardent un sens sur une créature (quadrupède / oiseau) et la façon de les intégrer.
 * - 'float' : objet magique en lévitation près de la créature ;
 * - 'mount' : monté sur le dos (arme à feu, bannière, bouclier = barde) ;
 * - 'horn'  : corne / éperon frontal (lance, harpon, foret) ;
 * - 'claws' : griffes renforcées ;
 * - 'none'  : arme ignorée proprement.
 */
export type CreatureMount = 'float' | 'mount' | 'horn' | 'claws' | 'none';

export function creatureMount(w: WeaponShape): CreatureMount {
  switch (w) {
    case 'orb':
    case 'tome':
    case 'lantern':
    case 'censer':
    case 'chakram':
    case 'flask':
    case 'staff':
      return 'float';
    case 'cannon':
    case 'gun':
    case 'crossbow':
    case 'banner':
    case 'shield':
      return 'mount';
    case 'lance':
    case 'harpoon':
    case 'drill':
      return 'horn';
    case 'claws':
    case 'daggers':
      return 'claws';
    default:
      return 'none';
  }
}
