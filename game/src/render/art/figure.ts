/**
 * Orchestrateur : calcule la pose puis dessine la figurine couche par couche
 * dans le repère local (pieds en 0,0 ; regard vers +x ; ~100 unités de haut).
 */
import type { Extra, Look } from '../../core/defs';
import { palette, rgba, mix } from './color';
import { PI, clamp } from './math';
import type { AnimKind } from './pose';
import { computePose } from './pose';
import type { RS } from './paint';
import { glow } from './paint';
import { rigFor } from './rig';
import { creatureMount, specFor } from './weaponSpec';
import { drawArm, drawHand, drawLegs, drawTorso, handPos } from './bodies';
import { drawHead, stunStars } from './heads';
import { bowNockY, drawWeapon } from './weapons';
import { drawExtras } from './extras';
import { drawBird, drawQuad } from './creatures';

export interface FigureParams {
  anim: AnimKind;
  animT: number;
  time: number;
  /** Angle vertical de visée (+ = vers le bas), en radians. */
  aim: number;
  /** Pixels (appareil) par unité locale. */
  lod: number;
  /** Épaisseur de contour en unités locales. */
  lw: number;
  sil: string | null;
}

const EMPTY: ReadonlySet<Extra> = new Set();
const exCache = new WeakMap<object, ReadonlySet<Extra>>();

function extrasSet(look: Look): ReadonlySet<Extra> {
  if (!look.extras || look.extras.length === 0) return EMPTY;
  let s = exCache.get(look.extras);
  if (!s) {
    s = new Set(look.extras);
    exCache.set(look.extras, s);
  }
  return s;
}

/** Crée l'état de rendu (sans dessiner). Exposé pour les portraits. */
export function makeRS(ctx: CanvasRenderingContext2D, look: Look, fp: FigureParams): RS {
  const pal = palette(look);
  const rig = rigFor(look.body);
  const spec = specFor(look.weapon);
  const mount = rig.kind === 'humanoid' ? 'none' : creatureMount(look.weapon);
  const pose = computePose(fp.anim, fp.animT, fp.time, rig, spec, fp.aim, pal.seed, mount);
  return {
    ctx,
    look,
    pal,
    rig,
    spec,
    pose,
    lw: fp.lw,
    lod: fp.lod,
    sil: fp.sil,
    time: fp.time,
    ex: extrasSet(look),
    mount,
    headAt: { x: rig.headX, y: rig.headY, r: rig.headR },
  };
}

export function drawFigure(ctx: CanvasRenderingContext2D, look: Look, fp: FigureParams): RS {
  const rs = makeRS(ctx, look, fp);
  const ps = rs.pose;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.translate(ps.x, ps.y - ps.hover);
  if (ps.rot !== 0) {
    if (rs.rig.kind === 'quad') {
      const px = ps.rot < 0 ? -17 : 15;
      ctx.translate(px, 0);
      ctx.rotate(ps.rot);
      ctx.translate(-px, 0);
    } else ctx.rotate(ps.rot);
  }
  ctx.scale(ps.sx, ps.sy);
  if (rs.rig.kind === 'quad') drawQuad(rs);
  else if (rs.rig.kind === 'bird') drawBird(rs);
  else drawHumanoid(rs);
  ctx.restore();
  return rs;
}

// ---------------------------------------------------------------------------

function normAngle(a: number): number {
  let x = a % (PI * 2);
  if (x > PI) x -= PI * 2;
  if (x < -PI) x += PI * 2;
  return x;
}

function drawHumanoid(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const ps = rs.pose;
  const spec = rs.spec;
  const w = rs.look.weapon;
  const ws = r.wScale;
  const lean = ps.lean + r.hunch;
  const upper = (fn: () => void) => {
    ctx.save();
    ctx.translate(0, r.hipY);
    ctx.rotate(lean);
    ctx.translate(0, -r.hipY);
    fn();
    ctx.restore();
  };

  // Positions des mains
  const nh = handPos(rs, true);
  let fh = handPos(rs, false);
  const isBow = spec.style === 'bow';
  if (spec.two && !ps.wHide) {
    const g = spec.grip2 * ws;
    fh = { x: nh.x - g * Math.sin(ps.wr), y: nh.y + g * Math.cos(ps.wr) };
  }
  let bowNock = { x: 0, y: 0 };
  let nearHand = nh;
  if (isBow) {
    const ny = bowNockY(ps.pull) * ws;
    bowNock = { x: fh.x - ny * Math.sin(ps.fr), y: fh.y + ny * Math.cos(ps.fr) };
    // La main proche tient la corde pendant la visée, sinon reste libre.
    const hold = ps.anim === 'attack' && ps.t > 0.08 && ps.t < 0.38;
    if (hold) nearHand = bowNock;
  }

  upper(() => drawExtras(rs, 'back'));
  drawLegs(rs);
  upper(() => {
    // Bras lointain (derrière le torse)
    drawArm(rs, false, fh.x, fh.y);
    if (w === 'daggers' && !ps.wHide) {
      weaponAt(rs, fh.x, fh.y, ps.fr, 'daggers', 0.92);
    }
    if (!spec.two && !isBow) drawHand(rs, false, fh.x, fh.y);
    drawTorso(rs);
    drawExtras(rs, 'body');

    const wn = normAngle(ps.wr);
    const longUp = spec.tip >= 28 && Math.abs(wn) < 0.75 && ps.anim !== 'cast';
    const behindHead = !spec.upright && !isBow && spec.style !== 'bash' && ((wn < -0.25 && wn > -PI + 0.35) || longUp);
    if (behindHead) nearArm(rs, nearHand.x, nearHand.y, fh);

    // Traînée de coup derrière la tête (ne masque pas le visage)
    if (ps.trail > 0.02) trail(rs, nh);
    // Tête
    ctx.save();
    ctx.translate(r.headX, r.headY + ps.headDy);
    ctx.rotate(ps.headTilt);
    drawHead(rs, r.headR, 'hum');
    if (ps.stun > 0) stunStars(rs, 0, -r.headR * 1.2, r.headR);
    ctx.restore();

    if (isBow) {
      weaponAt(rs, fh.x, fh.y, ps.fr, 'bow', 1);
      drawHand(rs, false, fh.x, fh.y);
    }
    if (!behindHead) nearArm(rs, nearHand.x, nearHand.y, fh);
    if (ps.glow > 0.02) {
      glow(rs, nh.x, nh.y - 4, 12 + ps.glow * 10, rs.pal.a, ps.glow * 0.75);
    }
    drawExtras(rs, 'front');
  });
}

function weaponAt(rs: RS, x: number, y: number, rot: number, w: Look['weapon'], s: number): void {
  const ctx = rs.ctx;
  const ps = rs.pose;
  ctx.save();
  ctx.translate(x, y);
  const spec = rs.spec;
  if (!spec.upright) ctx.rotate(rot);
  else ctx.rotate(clamp(rot, -0.3, 0.3) * 0.3);
  const k = rs.rig.wScale * s;
  ctx.scale(k, k);
  drawWeapon(rs, w, { glow: ps.wGlow, pull: ps.pull, lash: ps.lash, spin: ps.spin, muzzle: ps.muzzle });
  ctx.restore();
}

function nearArm(rs: RS, hx: number, hy: number, fh: { x: number; y: number }): void {
  const ps = rs.pose;
  const spec = rs.spec;
  const w = rs.look.weapon;
  drawArm(rs, true, hx, hy);
  if (spec.style === 'bow') {
    drawHand(rs, true, hx, hy);
    return;
  }
  if (w === 'none') {
    drawHand(rs, true, hx, hy);
    return;
  }
  const itemOverHand = w === 'orb' || w === 'tome' || w === 'flask' || w === 'claws';
  if (spec.style === 'bash') {
    drawHand(rs, true, hx, hy);
    if (!ps.wHide) weaponAt(rs, hx, hy, ps.wr, w, 1);
    return;
  }
  if (itemOverHand) {
    drawHand(rs, true, hx, hy, w === 'orb');
    if (!ps.wHide) weaponAt(rs, hx, hy, ps.wr, w, 1);
  } else {
    if (!ps.wHide) weaponAt(rs, hx, hy, ps.wr, w, 1);
    drawHand(rs, true, hx, hy);
  }
  if (spec.two && !ps.wHide) drawHand(rs, false, fh.x, fh.y);
  if (ps.wHide && ps.t < 0.8) {
    // éclat au moment du lancer
    const k = 1 - (ps.t - 0.37) / 0.35;
    if (k > 0) glow(rs, hx, hy, 10, rs.pal.a, k * 0.5);
  }
}

function trail(rs: RS, nh: { x: number; y: number }): void {
  if (rs.sil) return;
  const ctx = rs.ctx;
  const ps = rs.pose;
  const r = rs.rig;
  const spec = rs.spec;
  const a = ps.trail;
  const col = mix('#ffffff', rs.pal.a, 0.35);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (spec.style === 'thrust' || spec.style === 'stab') {
    // Lignes de vitesse le long de l'arme
    const dx = Math.sin(ps.wr);
    const dy = -Math.cos(ps.wr);
    const L = spec.tip * r.wScale;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const ox = -dy * i * 2.6;
      const oy = dx * i * 2.6;
      ctx.beginPath();
      ctx.moveTo(nh.x + ox - dx * 6, nh.y + oy - dy * 6);
      ctx.lineTo(nh.x + ox + dx * L * 0.7, nh.y + oy + dy * L * 0.7);
      ctx.strokeStyle = rgba(col, a * (i === 0 ? 0.55 : 0.3));
      ctx.lineWidth = i === 0 ? 2 : 1.2;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  // Arc de coup autour de l'épaule
  const sh = r.shN;
  const R1 = r.armLen * 1.05 + spec.tip * r.wScale * 0.95;
  const R0 = R1 * (spec.style === 'slash' ? 0.72 : 0.52);
  const a0 = Math.min(ps.trailA, ps.trailB) - PI / 2;
  const a1 = Math.max(ps.trailA, ps.trailB) - PI / 2;
  if (a1 - a0 < 0.05) {
    ctx.restore();
    return;
  }
  const grad = ctx.createRadialGradient(sh[0], sh[1], R0, sh[0], sh[1], R1);
  grad.addColorStop(0, rgba(col, 0));
  grad.addColorStop(0.7, rgba(col, 0.4 * a));
  grad.addColorStop(1, rgba('#ffffff', 0.85 * a));
  ctx.beginPath();
  ctx.arc(sh[0], sh[1], R1, a0, a1);
  ctx.arc(sh[0], sh[1], R0, a1, a0, true);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}
