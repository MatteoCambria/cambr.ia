/**
 * Calcul de la pose d'une figurine à partir de l'animation en cours.
 * Toute l'animation est procédurale : une pose est un petit ensemble d'angles et
 * de décalages que les fonctions de dessin appliquent aux différentes parties.
 */
import type { Rig } from './rig';
import type { WSpec, CreatureMount } from './weaponSpec';
import { TAU, PI, clamp, kf, lerp, seg, smooth } from './math';

export type AnimKind = 'idle' | 'walk' | 'attack' | 'cast' | 'hit' | 'stunned' | 'death' | 'leap';

export interface Arm {
  /** Angle depuis la verticale descendante (+ = vers l'avant). */
  a: number;
  /** Extension relative (1 = longueur de bras). */
  e: number;
}

export type Eyes = 'open' | 'closed' | 'squint' | 'dizzy';

export interface Pose {
  anim: AnimKind;
  t: number;
  time: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** Rotation de tout le corps autour des pieds. */
  rot: number;
  /** Inclinaison du buste autour des hanches. */
  lean: number;
  headTilt: number;
  headDy: number;
  breath: number;
  near: Arm;
  far: Arm;
  /** Rotation de l'arme principale. */
  wr: number;
  /** Rotation de l'objet de la main lointaine (arc, seconde dague). */
  fr: number;
  /** Tension de la corde d'arc 0..1. */
  pull: number;
  /** Arme lancée (masquée). */
  wHide: boolean;
  /** Traînée de coup 0..1 et arc couvert (rotations d'arme). */
  trail: number;
  trailA: number;
  trailB: number;
  muzzle: number;
  /** Lueur d'incantation (0..1). */
  glow: number;
  /** Lueur au bout de l'arme (0..1). */
  wGlow: number;
  /** Cycle de marche. */
  phase: number;
  walk: number;
  tuck: number;
  hover: number;
  flap: number;
  sway: number;
  eyes: Eyes;
  stun: number;
  dissolve: number;
  /** Hauteur au-dessus du sol (saut), pour l'ombre. */
  air: number;
  bite: number;
  /** Déploiement du fouet 0..1. */
  lash: number;
  spin: number;
}

/** Angle vertical de visée en radians (+ = vers le bas), déjà borné. */
export function computePose(
  anim: AnimKind,
  tIn: number,
  time: number,
  rig: Rig,
  spec: WSpec,
  aim: number,
  seed: number,
  mount: CreatureMount,
): Pose {
  const t = clamp(tIn, 0, 1);
  const ph = time * 2.4 + (seed % 1000) * 0.0137;
  const sp = Math.sin(ph);
  const isHum = rig.kind === 'humanoid';
  const p: Pose = {
    anim,
    t,
    time,
    x: 0,
    y: 0,
    sx: 1 - 0.007 * sp,
    sy: 1 + 0.013 * sp,
    rot: 0,
    lean: 0,
    headTilt: 0.02 * Math.sin(ph * 0.5),
    headDy: 0.6 * Math.sin(ph - 0.7),
    breath: 0.5 + 0.5 * sp,
    near: { a: spec.na + 0.04 * Math.sin(ph - 0.4), e: spec.ne },
    far: { a: spec.fa + 0.04 * Math.sin(ph - 0.9), e: spec.fe },
    wr: spec.r + 0.03 * Math.sin(ph - 0.8),
    fr: spec.style === 'bow' ? spec.r : spec.r,
    pull: 0,
    wHide: false,
    trail: 0,
    trailA: 0,
    trailB: 0,
    muzzle: 0,
    glow: 0,
    wGlow: 0,
    phase: 0,
    walk: 0,
    tuck: 0,
    hover: rig.hover > 0 ? rig.hover + 2.2 * Math.sin(time * 1.9 + seed * 0.01) : 0,
    flap: 0.12 * Math.sin(time * 2.2 + seed * 0.01),
    sway: Math.sin(time * 1.6 + seed * 0.02),
    eyes: 'open',
    stun: 0,
    dissolve: 0,
    air: 0,
    bite: 0,
    lash: 0,
    spin: time * 1.5,
  };

  // Clignement des yeux occasionnel.
  const blink = (time + (seed % 97) * 0.13) % 4.2;
  if (blink < 0.12) p.eyes = 'closed';

  switch (anim) {
    case 'idle':
      break;
    case 'walk': {
      const phase = time * TAU * 1.6;
      p.phase = phase;
      p.walk = 1;
      const s = Math.sin(phase);
      if (rig.legs !== 'none') p.y = -Math.abs(s) * 2.6;
      p.lean = isHum ? 0.1 : 0;
      p.rot = isHum ? 0.03 * Math.sin(phase) : 0;
      p.sy = 1 + 0.025 * Math.abs(Math.cos(phase));
      const swing = spec.two || spec.style === 'bow' || spec.style === 'bash' ? 0.1 : 0.4;
      p.near.a = spec.na - swing * s;
      p.far.a = spec.fa + swing * s;
      p.wr = spec.r + 0.06 * s;
      p.sway = 1.2 + 0.4 * Math.sin(phase * 0.5);
      p.flap = Math.sin(time * 9) * 0.5;
      break;
    }
    case 'attack':
      attackPose(p, t, spec, aim, rig, mount);
      break;
    case 'cast': {
      const g = kf(t, [0, 0, 0.3, 1, 0.78, 1, 1, 0]);
      p.glow = g;
      p.wGlow = Math.max(g, kf(t, [0, 0, 0.5, 0.6, 0.6, 1.4, 0.75, 1, 1, 0]));
      p.y = -3 * g;
      p.lean = -0.06 * g;
      if (spec.style === 'bow') {
        p.far.a = lerp(spec.fa, 2.2, g);
        p.fr = lerp(spec.r, 0.55, g);
        p.near.a = lerp(spec.na, 1.6, g);
      } else if (spec.style === 'recoil') {
        p.near.a = lerp(spec.na, 1.9, g);
        p.wr = lerp(spec.r, 0.45, g);
        p.far.a = lerp(spec.fa, 2.0, g);
      } else if (spec.style === 'bash') {
        p.near.a = lerp(spec.na, 1.75, g);
        p.near.e = lerp(spec.ne, 0.85, g);
        p.far.a = lerp(spec.fa, 2.6, g);
      } else if (spec.upright) {
        // Objet magique tendu vers l'avant, à hauteur de poitrine (ne masque pas le visage).
        p.near.a = lerp(spec.na, 1.6, g);
        p.near.e = lerp(spec.ne, 1.15, g);
        p.far.a = lerp(spec.fa, 1.35, g);
        p.far.e = lerp(spec.fe, 1.05, g);
      } else {
        // Arme brandie en diagonale vers le ciel, devant le personnage.
        p.near.a = lerp(spec.na, 2.05, g);
        p.near.e = lerp(spec.ne, 1.05, g);
        p.wr = lerp(spec.r, 0.72, g);
        p.far.a = lerp(spec.fa, spec.two ? 1.9 : 1.45, g);
      }
      p.flap = lerp(p.flap, -0.9, g);
      p.sway = p.sway + g * 1.5;
      p.eyes = g > 0.5 ? 'squint' : p.eyes;
      if (rig.kind === 'quad') p.rot = -0.28 * g;
      break;
    }
    case 'hit': {
      const k = kf(t, [0, 0, 0.07, 1, 1, 0]);
      p.x = -5 * k;
      p.lean = -0.22 * k;
      p.headTilt = -0.25 * k;
      p.sx = 1 + 0.06 * k;
      p.sy = 1 - 0.07 * k;
      p.near.a = spec.na + 0.35 * k;
      p.far.a = spec.fa + 0.5 * k;
      p.wr = spec.r + 0.25 * k;
      if (k > 0.25) p.eyes = 'squint';
      if (rig.kind === 'quad') p.rot = -0.12 * k;
      break;
    }
    case 'stunned': {
      const w = Math.sin(time * 3.6);
      p.lean = 0.07 * w;
      p.rot = 0.03 * Math.sin(time * 3.6 + 1);
      p.headTilt = 0.16 * Math.sin(time * 3.6 + 0.6);
      p.near.a = 0.15;
      p.near.e = 0.95;
      p.far.a = 0.1;
      p.wr = spec.upright ? 0 : spec.r + 0.55;
      p.sy = 0.97;
      p.eyes = 'dizzy';
      p.stun = 1;
      p.flap = -0.2;
      break;
    }
    case 'death': {
      const c = smooth(seg(t, 0, 0.4));
      p.sy = lerp(1, 0.74, c);
      p.sx = lerp(1, 1.06, c);
      p.lean = 0.32 * c;
      p.headTilt = 0.35 * c;
      p.near.a = lerp(spec.na, 0.1, c);
      p.far.a = lerp(spec.fa, 0.05, c);
      p.wr = lerp(spec.r, spec.upright ? 0.4 : PI / 2 + 0.7, c);
      p.eyes = 'closed';
      p.dissolve = smooth(seg(t, 0.32, 1));
      p.hover = p.hover * (1 - c);
      if (rig.kind === 'quad') {
        p.rot = 0.08 * c;
        p.lean = 0;
      }
      p.flap = lerp(p.flap, 0.5, c);
      break;
    }
    case 'leap': {
      const crouch = kf(t, [0, 0, 0.18, 1, 0.26, 0, 0.84, 0, 0.9, 0.8, 1, 0]);
      const airT = seg(t, 0.2, 0.86);
      const h = Math.sin(airT * PI);
      p.air = h * 30;
      p.y = -p.air;
      p.sy = 1 - 0.18 * crouch + (airT > 0 && airT < 1 ? 0.1 * Math.cos(airT * PI) : 0);
      p.sx = 1 + 0.12 * crouch - (airT > 0 && airT < 1 ? 0.04 : 0);
      p.tuck = airT > 0 && airT < 1 ? Math.sin(airT * PI) : 0;
      p.lean = 0.1 * crouch + 0.12 * p.tuck;
      p.near.a = lerp(spec.na, 2.3, p.tuck * 0.7);
      p.far.a = lerp(spec.fa, 2.5, p.tuck * 0.7);
      p.flap = airT > 0 && airT < 1 ? Math.sin(time * 14) * 0.7 - 0.3 : p.flap;
      p.sway = 1.5 * p.tuck;
      if (rig.kind === 'quad') {
        p.rot = -0.2 * Math.cos(airT * PI) * (airT > 0 && airT < 1 ? 1 : 0);
        p.lean = 0;
      }
      break;
    }
  }
  return p;
}

function attackPose(p: Pose, t: number, spec: WSpec, aim: number, rig: Rig, mount: CreatureMount): void {
  const fwd = PI / 2 - aim; // angle de bras pour viser la cible
  const wfwd = PI / 2 + aim; // rotation d'arme pointée vers la cible
  if (rig.kind !== 'humanoid') {
    creatureAttack(p, t, aim, rig, mount);
    return;
  }
  switch (spec.style) {
    case 'swing':
    case 'heavy': {
      const hv = spec.style === 'heavy';
      const a1 = hv ? 0.3 : 0.22;
      const a2 = hv ? 0.42 : 0.36;
      const up = hv ? -1.55 : -1.15;
      p.near.a = kf(t, [0, spec.na, a1, 2.55, a2, 0.95 - aim * 0.4, 0.6, 0.85, 1, spec.na]);
      p.near.e = kf(t, [0, spec.ne, a1, 0.95, a2, 1.05, 1, spec.ne]);
      p.far.a = spec.two ? p.near.a : kf(t, [0, spec.fa, a1, 0.9, a2, 0.1, 1, spec.fa]);
      p.wr = kf(t, [0, spec.r, a1, up, a2, 2.15 + aim * 0.6, 0.62, 1.95, 1, spec.r]);
      p.lean = kf(t, [0, 0, a1, -0.11, a2, 0.17, 0.62, 0.08, 1, 0]);
      p.x = kf(t, [0, 0, a1, -1.5, a2, hv ? 6 : 4.5, 0.62, 3, 1, 0]);
      if (hv) {
        p.sy = kf(t, [0, 1, a1, 1.04, a2, 0.92, 0.6, 0.98, 1, 1]);
        p.y = kf(t, [0, 0, a1, -2, a2, 0, 1, 0]);
      }
      p.trail = t > a1 + 0.02 && t < a2 + 0.2 ? 1 - seg(t, a2, a2 + 0.2) : 0;
      p.trailA = up + 0.4;
      p.trailB = p.wr;
      if (t > a1 && t < a2 + 0.15) p.eyes = 'squint';
      break;
    }
    case 'slash': {
      p.near.a = kf(t, [0, spec.na, 0.2, 2.3, 0.34, 0.75, 0.55, 0.7, 1, spec.na]);
      p.far.a = kf(t, [0, spec.fa, 0.2, 0.6, 0.34, 1.5, 0.5, 1.3, 1, spec.fa]);
      p.wr = kf(t, [0, spec.r, 0.2, -0.3, 0.34, 2.3 + aim * 0.5, 0.55, 2.0, 1, spec.r]);
      p.lean = kf(t, [0, 0, 0.2, -0.1, 0.34, 0.18, 0.6, 0.05, 1, 0]);
      p.x = kf(t, [0, 0, 0.2, -2, 0.34, 6, 0.6, 3, 1, 0]);
      p.trail = t > 0.24 && t < 0.55 ? 1 - seg(t, 0.36, 0.55) : 0;
      p.trailA = -0.1;
      p.trailB = p.wr;
      if (t > 0.2 && t < 0.5) p.eyes = 'squint';
      break;
    }
    case 'stab': {
      p.near.a = kf(t, [0, spec.na, 0.16, 0.85, 0.3, fwd, 0.44, 1.0, 1, spec.na]);
      p.near.e = kf(t, [0, spec.ne, 0.16, 0.5, 0.3, 1.25, 0.44, 0.8, 1, spec.ne]);
      p.far.a = kf(t, [0, spec.fa, 0.36, 0.7, 0.52, fwd + 0.05, 0.68, 1.0, 1, spec.fa]);
      p.far.e = kf(t, [0, spec.fe, 0.36, 0.5, 0.52, 1.25, 0.68, 0.85, 1, spec.fe]);
      p.wr = kf(t, [0, spec.r, 0.16, 0.6, 0.3, wfwd, 0.44, 1.1, 1, spec.r]);
      p.fr = kf(t, [0, spec.r, 0.36, 0.6, 0.52, wfwd, 0.68, 1.1, 1, spec.r]);
      p.x = kf(t, [0, 0, 0.16, -1, 0.3, 4.5, 0.52, 5.5, 1, 0]);
      p.lean = kf(t, [0, 0, 0.16, -0.05, 0.3, 0.14, 0.52, 0.16, 1, 0]);
      p.trail = t > 0.22 && t < 0.62 ? 0.7 : 0;
      p.trailA = wfwd - 0.4;
      p.trailB = wfwd + 0.2;
      break;
    }
    case 'thrust': {
      p.near.a = kf(t, [0, spec.na, 0.22, fwd - 0.25, 0.36, fwd, 0.56, fwd, 1, spec.na]);
      p.near.e = kf(t, [0, spec.ne, 0.22, 0.45, 0.36, 1.25, 0.56, 1.15, 1, spec.ne]);
      p.far.a = kf(t, [0, spec.fa, 0.22, fwd - 0.4, 0.36, fwd - 0.2, 1, spec.fa]);
      p.wr = kf(t, [0, spec.r, 0.22, wfwd - 0.08, 0.36, wfwd, 0.56, wfwd, 1, spec.r]);
      p.x = kf(t, [0, 0, 0.22, -3, 0.36, 6.5, 0.56, 5, 1, 0]);
      p.lean = kf(t, [0, 0, 0.22, -0.06, 0.36, 0.13, 0.56, 0.1, 1, 0]);
      p.trail = t > 0.28 && t < 0.56 ? 0.8 : 0;
      p.trailA = wfwd - 0.05;
      p.trailB = wfwd + 0.05;
      p.spin = t * 40;
      if (t > 0.22 && t < 0.5) p.eyes = 'squint';
      break;
    }
    case 'bow': {
      const hold = kf(t, [0, 0, 0.12, 1, 0.8, 1, 1, 0]);
      p.far.a = lerp(spec.fa, fwd, hold);
      p.far.e = lerp(spec.fe, 1.08, hold);
      p.fr = lerp(spec.r, wfwd, hold);
      p.pull = kf(t, [0, 0, 0.12, 0.15, 0.32, 1, 0.35, 1, 0.38, 0, 1, 0]);
      p.lean = kf(t, [0, 0, 0.32, -0.05, 0.4, 0.02, 1, 0]);
      p.x = kf(t, [0, 0, 0.35, -0.5, 0.42, -2, 1, 0]);
      if (t > 0.15 && t < 0.36) p.eyes = 'squint';
      break;
    }
    case 'recoil': {
      const hold = kf(t, [0, 0, 0.18, 1, 0.8, 1, 1, 0]);
      const kick = kf(t, [0, 0, 0.35, 0, 0.39, 1, 0.7, 0.1, 1, 0]) * (spec.kick ?? 1);
      p.near.a = lerp(spec.na, fwd - 0.05, hold) + kick * 0.12;
      p.near.e = lerp(spec.ne, spec.kick ? 0.6 : 0.9, hold) - kick * 0.08;
      p.far.a = lerp(spec.fa, fwd + 0.15, hold) + kick * 0.12;
      p.far.e = lerp(spec.fe, 1.05, hold);
      p.wr = lerp(spec.r, wfwd, hold) - kick * 0.28;
      p.x = -kick * 3.2;
      p.lean = -kick * 0.08;
      p.muzzle = t > 0.35 && t < 0.5 ? 1 - seg(t, 0.35, 0.5) : 0;
      if (t > 0.34 && t < 0.5) p.eyes = 'squint';
      break;
    }
    case 'point':
    case 'magic': {
      const ext = kf(t, [0, 0, 0.24, -0.4, 0.36, 1, 0.6, 1, 1, 0]);
      p.near.a = ext >= 0 ? lerp(spec.na, fwd + (spec.style === 'point' ? 0.25 : 0), ext) : spec.na + 0.4 * -ext;
      p.near.e = lerp(spec.ne, 1.1, Math.max(0, ext));
      p.wr = spec.style === 'point' ? lerp(spec.r, wfwd - 0.55, Math.max(0, ext)) - 0.25 * Math.min(0, ext) : spec.r;
      p.far.a = lerp(spec.fa, 0.9, Math.max(0, ext));
      p.wGlow = kf(t, [0, 0, 0.24, 0.5, 0.36, 1.4, 0.55, 0.8, 1, 0]);
      p.lean = kf(t, [0, 0, 0.24, -0.06, 0.36, 0.1, 1, 0]);
      p.x = kf(t, [0, 0, 0.24, -1, 0.36, 2.5, 1, 0]);
      break;
    }
    case 'throw': {
      p.near.a = kf(t, [0, spec.na, 0.22, 2.75, 0.36, 1.25, 0.56, 0.85, 1, spec.na]);
      p.near.e = kf(t, [0, spec.ne, 0.22, 0.9, 0.36, 1.15, 1, spec.ne]);
      p.wr = kf(t, [0, spec.r, 0.22, -0.8, 0.36, 1.6, 1, spec.r]);
      p.wHide = t > 0.37 && t < 0.74;
      p.lean = kf(t, [0, 0, 0.22, -0.12, 0.36, 0.15, 0.6, 0.05, 1, 0]);
      p.x = kf(t, [0, 0, 0.22, -1.5, 0.36, 3, 1, 0]);
      p.spin = t * 30;
      p.far.a = kf(t, [0, spec.fa, 0.22, 1.2, 0.36, 0.2, 1, spec.fa]);
      break;
    }
    case 'bash': {
      p.near.a = kf(t, [0, spec.na, 0.22, 0.7, 0.36, 1.4, 0.6, 1.3, 1, spec.na]);
      p.near.e = kf(t, [0, spec.ne, 0.22, 0.5, 0.36, 1.05, 0.6, 1, 1, spec.ne]);
      p.wr = kf(t, [0, 0, 0.22, -0.15, 0.36, 0.25, 1, 0]);
      p.x = kf(t, [0, 0, 0.22, -3, 0.36, 7.5, 0.6, 5, 1, 0]);
      p.lean = kf(t, [0, 0, 0.22, -0.08, 0.36, 0.16, 0.6, 0.1, 1, 0]);
      if (t > 0.22 && t < 0.5) p.eyes = 'squint';
      break;
    }
    case 'lash': {
      p.near.a = kf(t, [0, spec.na, 0.22, 2.6, 0.34, 1.25, 0.6, 1.1, 1, spec.na]);
      p.lash = kf(t, [0, 0, 0.22, 0.15, 0.34, 1, 0.5, 0.75, 0.8, 0.1, 1, 0]);
      p.wr = kf(t, [0, spec.r, 0.22, -0.9, 0.34, wfwd - 0.2, 0.6, wfwd, 1, spec.r]);
      p.lean = kf(t, [0, 0, 0.22, -0.1, 0.34, 0.12, 1, 0]);
      p.x = kf(t, [0, 0, 0.22, -1, 0.34, 3, 1, 0]);
      break;
    }
    case 'punch': {
      p.near.a = kf(t, [0, spec.na, 0.2, 0.9, 0.33, fwd, 0.52, 1.3, 1, spec.na]);
      p.near.e = kf(t, [0, spec.ne, 0.2, 0.5, 0.33, 1.25, 0.52, 1.05, 1, spec.ne]);
      p.far.a = kf(t, [0, spec.fa, 0.2, 1.3, 0.33, 0.8, 1, spec.fa]);
      p.x = kf(t, [0, 0, 0.2, -2, 0.33, 6, 0.52, 4, 1, 0]);
      p.lean = kf(t, [0, 0, 0.2, -0.06, 0.33, 0.18, 0.52, 0.1, 1, 0]);
      if (t > 0.2 && t < 0.5) p.eyes = 'squint';
      break;
    }
  }
}

function creatureAttack(p: Pose, t: number, aim: number, rig: Rig, mount: CreatureMount): void {
  if (mount === 'mount') {
    const kick = kf(t, [0, 0, 0.35, 0, 0.39, 1, 0.7, 0.1, 1, 0]);
    p.x = -kick * 3;
    p.muzzle = t > 0.35 && t < 0.5 ? 1 - seg(t, 0.35, 0.5) : 0;
    p.wr = aim - kick * 0.2;
    p.rot = rig.kind === 'quad' ? -kick * 0.05 : 0;
    return;
  }
  if (mount === 'float') {
    p.wGlow = kf(t, [0, 0, 0.24, 0.5, 0.36, 1.4, 0.55, 0.8, 1, 0]);
  }
  if (rig.kind === 'quad') {
    p.x = kf(t, [0, 0, 0.22, -3.5, 0.36, 9, 0.6, 6, 1, 0]);
    p.rot = kf(t, [0, 0, 0.22, -0.09, 0.36, 0.1 + aim * 0.2, 0.6, 0.05, 1, 0]);
    p.sy = kf(t, [0, 1, 0.22, 0.92, 0.36, 1.03, 1, 1]);
    p.bite = kf(t, [0, 0, 0.24, 1, 0.36, 0, 0.5, 0.2, 1, 0]);
    p.headTilt = kf(t, [0, 0, 0.22, -0.25, 0.36, 0.25, 1, 0]);
    p.trail = mount === 'claws' && t > 0.25 && t < 0.55 ? 1 - seg(t, 0.38, 0.55) : 0;
  } else {
    p.x = kf(t, [0, 0, 0.22, -2, 0.36, 6, 0.6, 3, 1, 0]);
    p.lean = kf(t, [0, 0, 0.22, -0.15, 0.36, 0.25, 0.6, 0.1, 1, 0]);
    p.flap = kf(t, [0, 0, 0.22, -1.1, 0.36, 0.6, 0.6, 0.2, 1, 0]);
    p.bite = kf(t, [0, 0, 0.24, 1, 0.36, 0, 1, 0]);
    p.trail = mount === 'claws' && t > 0.25 && t < 0.55 ? 1 - seg(t, 0.38, 0.55) : 0;
  }
  if (t > 0.2 && t < 0.45) p.eyes = 'squint';
}
