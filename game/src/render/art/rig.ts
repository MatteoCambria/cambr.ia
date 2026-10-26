/**
 * Gabarits (« rigs ») des corps : proportions de chaque BodyShape dans le repère
 * local de la figurine. Repère : pieds en (0, 0), y vers le bas, la figurine regarde
 * vers +x. Une figurine standard mesure ~100 unités de haut.
 */
import type { BodyShape } from '../../core/defs';

export type RigKind = 'humanoid' | 'quad' | 'bird';
export type LegKind = 'legs' | 'robe' | 'none' | 'tail' | 'digi';
export type HandKind = 'skin' | 'glove' | 'paw' | 'metal' | 'spirit';

export interface Rig {
  kind: RigKind;
  body: BodyShape;
  hipY: number;
  shoulderY: number;
  headX: number;
  headY: number;
  headR: number;
  /** Pivots d'épaule (bras proche = côté caméra, bras lointain = derrière le torse). */
  shN: readonly [number, number];
  shF: readonly [number, number];
  armLen: number;
  armW: number;
  hipN: number;
  hipF: number;
  footN: number;
  footF: number;
  legW: number;
  topW: number;
  botW: number;
  /** Échelle des armes. */
  wScale: number;
  legs: LegKind;
  hand: HandKind;
  /** Hauteur de lévitation de base. */
  hover: number;
  /** Demi-largeur de l'ombre portée. */
  shadow: number;
  /** Inclinaison permanente du buste (bête voûtée). */
  hunch: number;
  /** Hauteur approximative du sommet de la figurine (négatif). */
  top: number;
}

function H(p: Partial<Rig> & Pick<Rig, 'body'>): Rig {
  return {
    kind: 'humanoid',
    hipY: -22,
    shoulderY: -47,
    headX: 1.5,
    headY: -67,
    headR: 18.5,
    shN: [-4, -45],
    shF: [7, -46],
    armLen: 17,
    armW: 6,
    hipN: -4,
    hipF: 4.5,
    footN: -5,
    footF: 6,
    legW: 6.5,
    topW: 13,
    botW: 10,
    wScale: 1,
    legs: 'legs',
    hand: 'skin',
    hover: 0,
    shadow: 17,
    hunch: 0,
    top: -88,
    ...p,
  };
}

const RIGS: Record<BodyShape, Rig> = {
  knight: H({ body: 'knight', hand: 'glove', armW: 6.4, legW: 7 }),
  robe: H({ body: 'robe', legs: 'robe', armW: 7, topW: 12, botW: 11, shadow: 18 }),
  slim: H({
    body: 'slim', hipY: -24, shoulderY: -46, headY: -65, headR: 17.5, topW: 10, botW: 8,
    armW: 5.2, legW: 5.6, shN: [-3, -44], shF: [6, -45], hipN: -3.5, hipF: 3.5, footN: -4.5, footF: 5, shadow: 15, top: -85,
  }),
  heavy: H({
    body: 'heavy', hipY: -19, shoulderY: -46, headX: 2.5, headY: -64, headR: 17.5, topW: 18, botW: 15.5,
    armLen: 19, armW: 8.5, legW: 8.5, shN: [-8, -43], shF: [11, -44], hipN: -6, hipF: 6, footN: -7.5, footF: 8,
    hand: 'glove', shadow: 22, top: -84, wScale: 1.08,
  }),
  beast: H({
    body: 'beast', hipY: -23, shoulderY: -47, headX: 6, headY: -63, headR: 17, topW: 15, botW: 11,
    armLen: 19, armW: 7.5, legW: 7.5, legs: 'digi', hand: 'paw', shN: [-3, -45], shF: [10, -46], hunch: 0.13,
    shadow: 19, top: -84,
  }),
  construct: H({
    body: 'construct', hipY: -24, shoulderY: -49, headY: -68, headR: 17, topW: 15, botW: 11, armLen: 18,
    armW: 6.2, legW: 7, hand: 'metal', shN: [-6, -46], shF: [9, -47], shadow: 19, top: -88,
  }),
  serpent: H({
    body: 'serpent', hipY: -27, shoulderY: -50, headY: -69, headR: 17.5, topW: 11, botW: 9, armLen: 16, armW: 5.5,
    legs: 'tail', shN: [-3, -48], shF: [6.5, -49], shadow: 24, top: -89,
  }),
  floating: H({
    body: 'floating', hipY: -28, shoulderY: -48, headY: -67, headR: 18, topW: 12, botW: 10, armLen: 16,
    armW: 5.5, legs: 'none', hand: 'spirit', hover: 9, shadow: 14, top: -88,
  }),
  small: H({
    body: 'small', hipY: -13, shoulderY: -32, headX: 1, headY: -49, headR: 16, topW: 10, botW: 9.5, armLen: 11.5,
    armW: 4.8, legW: 5.4, shN: [-3.5, -30], shF: [5.5, -31], hipN: -3.2, hipF: 3.5, footN: -4, footF: 4.5,
    wScale: 0.78, shadow: 13, top: -67,
  }),
  giant: H({
    body: 'giant', hipY: -36, shoulderY: -75, headX: 3, headY: -92, headR: 19, topW: 24, botW: 18, armLen: 29,
    armW: 11, legW: 11.5, shN: [-9, -71], shF: [14, -72], hipN: -8, hipF: 8, footN: -10, footF: 10.5,
    wScale: 1.38, hand: 'glove', shadow: 28, top: -113,
  }),
  quadruped: H({
    body: 'quadruped', kind: 'quad', hipY: -30, shoulderY: -42, headX: 31, headY: -52, headR: 16, topW: 26,
    botW: 12, armLen: 18, armW: 6, legW: 6, legs: 'legs', hand: 'paw', shadow: 30, top: -76, wScale: 0.9,
    shN: [16, -38], shF: [18, -40],
  }),
  bird: H({
    body: 'bird', kind: 'bird', hipY: -18, shoulderY: -46, headX: 6, headY: -60, headR: 14.5, topW: 15, botW: 13,
    armLen: 16, armW: 6, legW: 3, hand: 'paw', shadow: 17, top: -78, wScale: 0.85, shN: [-3, -44], shF: [5, -45],
  }),
};

export function rigFor(body: BodyShape): Rig {
  return RIGS[body] ?? RIGS.knight;
}
