/**
 * Têtes : visages chibi (3/4 tourné vers +x), coiffes et têtes non humaines.
 * Repère : origine au centre de la tête, R = rayon de la tête.
 * Les mêmes coiffes (couronne, auréole, cornes…) s'adaptent aux têtes de bêtes
 * et d'oiseaux grâce à la géométrie HG (position des yeux, du sommet…).
 */
import type { HeadShape } from '../../core/defs';
import { INK, darken, lighten, mix, rgba } from './color';
import { TAU, noise1 } from './math';
import { circle, ellipse, poly, sparkle, star, taper } from './paths';
import type { RS } from './paint';
import { detail, fl, fo, glow, lin, rad, spec, st } from './paint';

export type HeadKind = 'hum' | 'quad' | 'bird';

interface HG {
  kind: HeadKind;
  R: number;
  /** Œil proche et œil lointain. */
  ex: number;
  ey: number;
  fx: number;
  fy: number;
  ew: number;
  eh: number;
  /** Sommet du crâne. */
  top: number;
}

function geom(kind: HeadKind, R: number): HG {
  if (kind === 'quad') return { kind, R, ex: 0.42 * R, ey: -0.22 * R, fx: 0.86 * R, fy: -0.26 * R, ew: 0.15 * R, eh: 0.2 * R, top: -R };
  if (kind === 'bird') return { kind, R, ex: 0.3 * R, ey: -0.14 * R, fx: 0.74 * R, fy: -0.16 * R, ew: 0.17 * R, eh: 0.22 * R, top: -R };
  return { kind, R, ex: 0.04 * R, ey: 0.16 * R, fx: 0.56 * R, fy: 0.14 * R, ew: 0.155 * R, eh: 0.25 * R, top: -R };
}

export function drawHead(rs: RS, R: number, kind: HeadKind): void {
  const g = geom(kind, R);
  const h = rs.look.head;
  behind(rs, h, g);
  base(rs, h, g);
  over(rs, h, g);
}

// ---------------------------------------------------------------------------
// Yeux

function eye(rs: RS, x: number, y: number, w: number, h: number, glowy: string | null, far: boolean): void {
  const ctx = rs.ctx;
  const st0 = rs.pose.eyes;
  const ww = far ? w * 0.86 : w;
  if (st0 === 'closed') {
    ctx.beginPath();
    ctx.moveTo(x - ww * 1.1, y);
    ctx.quadraticCurveTo(x, y + h * 0.45, x + ww * 1.1, y);
    st(rs, INK, Math.max(rs.lw * 1.1, w * 0.4));
    return;
  }
  if (st0 === 'squint') {
    ctx.beginPath();
    const d = far ? -1 : 1;
    ctx.moveTo(x - ww * d, y - h * 0.45);
    ctx.lineTo(x + ww * 0.9 * d, y);
    ctx.lineTo(x - ww * d, y + h * 0.4);
    ctx.lineJoin = 'round';
    st(rs, glowy ?? INK, Math.max(rs.lw * 1.1, w * 0.42));
    return;
  }
  if (st0 === 'dizzy') {
    ctx.beginPath();
    const r0 = Math.max(w, h * 0.7);
    for (let i = 0; i <= 16; i++) {
      const a = i * 0.7 + rs.time * 6;
      const r = (r0 * i) / 16;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    st(rs, INK, Math.max(rs.lw, w * 0.3));
    return;
  }
  if (glowy) {
    ctx.beginPath();
    ellipse(ctx, x, y, ww, h * 0.62);
    fl(rs, glowy);
    if (detail(rs, 0.5)) {
      ctx.beginPath();
      ellipse(ctx, x, y, ww * 0.45, h * 0.3);
      fl(rs, '#ffffff');
    }
    glow(rs, x, y, w * 3.2, glowy, 0.55);
    return;
  }
  ctx.beginPath();
  ellipse(ctx, x, y, ww, h);
  fl(rs, rs.pal.eye);
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    ellipse(ctx, x, y + h * 0.38, ww * 0.78, h * 0.42);
    fl(rs, rgba(rs.pal.a, 0.8));
    ctx.beginPath();
    circle(ctx, x - ww * 0.25, y - h * 0.38, ww * 0.42);
    fl(rs, '#ffffff');
  }
}

function eyes(rs: RS, g: HG, glowy: string | null = null): void {
  eye(rs, g.fx, g.fy, g.ew, g.eh, glowy, true);
  eye(rs, g.ex, g.ey, g.ew, g.eh, glowy, false);
}

// ---------------------------------------------------------------------------
// Visage humanoïde

function facePath(ctx: CanvasRenderingContext2D, R: number): void {
  ctx.moveTo(R * 0.98, -R * 0.1);
  ctx.bezierCurveTo(R * 1.0, R * 0.55, R * 0.62, R * 0.93, R * 0.2, R * 0.94);
  ctx.bezierCurveTo(-R * 0.45, R * 0.96, -R * 0.99, R * 0.6, -R * 0.99, 0);
  ctx.bezierCurveTo(-R * 0.99, -R * 0.62, -R * 0.56, -R * 0.99, 0, -R * 0.99);
  ctx.bezierCurveTo(R * 0.6, -R * 0.99, R * 0.97, -R * 0.6, R * 0.98, -R * 0.1);
  ctx.closePath();
}

function skinFill(rs: RS, R: number): string | CanvasGradient {
  const p = rs.pal;
  return rad(rs, 'h:skin', R * 0.15, -R * 0.1, R * 1.25, [[0, p.skinL], [0.62, p.skin], [1, p.skinD]], R * 0.3, -R * 0.45);
}

function face(rs: RS, g: HG, opts: { mouth?: boolean; blush?: boolean; ear?: boolean } = {}): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  ctx.beginPath();
  facePath(ctx, R);
  fo(rs, skinFill(rs, R));
  if (opts.ear !== false) {
    ctx.beginPath();
    ellipse(ctx, -R * 0.52, R * 0.16, R * 0.15, R * 0.21);
    fo(rs, p.skin);
    if (detail(rs)) {
      ctx.beginPath();
      ctx.arc(-R * 0.52, R * 0.17, R * 0.07, -1.2, 1.4);
      st(rs, p.skinD, rs.lw * 0.8);
    }
  }
  eyes(rs, g);
  if (opts.blush !== false && detail(rs, 0.6)) {
    ctx.beginPath();
    ellipse(ctx, g.ex - R * 0.05, g.ey + R * 0.36, R * 0.13, R * 0.07);
    ellipse(ctx, g.fx + R * 0.1, g.fy + R * 0.36, R * 0.1, R * 0.06);
    fl(rs, p.blush);
  }
  if (opts.mouth !== false && detail(rs, 0.5)) {
    ctx.beginPath();
    if (rs.pose.eyes === 'squint') {
      ellipse(ctx, R * 0.36, R * 0.6, R * 0.09, R * 0.07);
      fl(rs, '#5a1f2c');
    } else {
      ctx.moveTo(R * 0.26, R * 0.56);
      ctx.quadraticCurveTo(R * 0.36, R * 0.64, R * 0.46, R * 0.55);
      st(rs, darken(p.skin, 0.55), rs.lw * 0.85);
    }
  }
}

type HairStyle = 'spiky' | 'smooth' | 'back';

function hair(rs: RS, R: number, style: HairStyle): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.beginPath();
  if (style === 'back') {
    ctx.moveTo(-R * 0.2, -R * 0.95);
    ctx.quadraticCurveTo(-R * 1.15, -R * 0.95, -R * 1.08, R * 0.2);
    ctx.quadraticCurveTo(-R * 1.02, R * 0.68, -R * 0.62, R * 0.66);
    ctx.lineTo(-R * 0.6, R * 0.05);
    ctx.quadraticCurveTo(-R * 0.55, -R * 0.55, -R * 0.2, -R * 0.95);
  } else {
    ctx.moveTo(R * 0.99, -R * 0.02);
    ctx.quadraticCurveTo(R * 1.02, -R * 1.08, -R * 0.1, -R * 1.1);
    ctx.quadraticCurveTo(-R * 1.17, -R * 1.02, -R * 1.1, R * 0.18);
    ctx.quadraticCurveTo(-R * 1.02, R * 0.7, -R * 0.62, R * 0.68);
    ctx.lineTo(-R * 0.58, R * 0.02);
    if (style === 'spiky') {
      ctx.lineTo(-R * 0.36, -R * 0.3);
      ctx.lineTo(-R * 0.12, -R * 0.08);
      ctx.lineTo(R * 0.06, -R * 0.4);
      ctx.lineTo(R * 0.3, -R * 0.1);
      ctx.lineTo(R * 0.5, -R * 0.42);
      ctx.lineTo(R * 0.74, -R * 0.12);
      ctx.lineTo(R * 0.86, -R * 0.36);
    } else {
      ctx.quadraticCurveTo(-R * 0.3, -R * 0.42, R * 0.1, -R * 0.3);
      ctx.quadraticCurveTo(R * 0.6, -R * 0.2, R * 0.99, -R * 0.02);
    }
  }
  ctx.closePath();
  fo(rs, lin(rs, 'h:hair' + style, 0, -R * 1.1, 0, R * 0.7, p.hairL, p.hair, p.hairD));
  if (detail(rs, 0.7) && style !== 'back') {
    ctx.beginPath();
    ctx.moveTo(-R * 0.62, -R * 0.66);
    ctx.quadraticCurveTo(-R * 0.1, -R * 1.02, R * 0.48, -R * 0.82);
    st(rs, rgba(p.hairL, 0.7), rs.lw * 1.3);
  }
}

// ---------------------------------------------------------------------------
// Têtes animales

function animalCranium(rs: RS, g: HG, fur: string, furL: string, furD: string, muzzle: string): void {
  const ctx = rs.ctx;
  const R = g.R;
  // Oreilles
  earPair(rs, R, fur, furD);
  // Mâchoire inférieure (s'ouvre avec la morsure)
  const bite = rs.pose.bite;
  ctx.save();
  ctx.translate(R * 0.25, R * 0.3);
  ctx.rotate(bite * 0.45);
  ctx.beginPath();
  ctx.moveTo(-R * 0.1, -R * 0.05);
  ctx.quadraticCurveTo(R * 0.6, R * 0.32, R * 1.05, R * 0.12);
  ctx.lineTo(R * 1.0, -R * 0.02);
  ctx.lineTo(0, -R * 0.1);
  ctx.closePath();
  fo(rs, darken(muzzle, 0.15));
  if (bite > 0.2 && detail(rs)) {
    ctx.beginPath();
    poly(ctx, [R * 0.75, -R * 0.02, R * 0.82, -R * 0.2, R * 0.88, -R * 0.02]);
    fl(rs, '#ffffff');
  }
  ctx.restore();
  // Crâne
  ctx.beginPath();
  ctx.moveTo(R * 0.6, -R * 0.62);
  ctx.bezierCurveTo(R * 0.2, -R * 1.08, -R * 0.75, -R * 1.02, -R * 0.95, -R * 0.25);
  ctx.bezierCurveTo(-R * 1.1, R * 0.45, -R * 0.4, R * 0.95, R * 0.25, R * 0.62);
  ctx.lineTo(R * 0.6, R * 0.42);
  ctx.closePath();
  fo(rs, rad(rs, 'h:fur', 0, -R * 0.3, R * 1.3, [[0, furL], [0.6, fur], [1, furD]], R * 0.1, -R * 0.6));
  // Museau
  ctx.beginPath();
  ctx.moveTo(R * 0.2, -R * 0.5);
  ctx.bezierCurveTo(R * 0.8, -R * 0.62, R * 1.45, -R * 0.35, R * 1.5, R * 0.05);
  ctx.bezierCurveTo(R * 1.52, R * 0.36, R * 1.1, R * 0.45, R * 0.55, R * 0.42);
  ctx.bezierCurveTo(R * 0.2, R * 0.4, R * 0.05, R * 0.1, R * 0.2, -R * 0.5);
  ctx.closePath();
  fo(rs, lin(rs, 'h:muz', 0, -R * 0.6, 0, R * 0.45, lighten(muzzle, 0.25), muzzle, darken(muzzle, 0.2)));
  // Truffe
  ctx.beginPath();
  ellipse(ctx, R * 1.42, -R * 0.08, R * 0.16, R * 0.12, 0.3);
  fo(rs, '#2a1a2a', true, 0.6);
  if (detail(rs)) {
    spec(rs, R * 1.38, -R * 0.13, R * 0.06, R * 0.03, -0.3, 0.6);
    ctx.beginPath();
    ctx.moveTo(R * 1.4, R * 0.04);
    ctx.quadraticCurveTo(R * 1.3, R * 0.28, R * 1.0, R * 0.28);
    st(rs, darken(muzzle, 0.5), rs.lw * 0.8);
  }
  eyes(rs, g, rs.look.head === 'beast' ? rs.pal.aL : null);
}

function earPair(rs: RS, R: number, fur: string, furD: string): void {
  const ctx = rs.ctx;
  const inner = mix(rs.pal.skin, rs.pal.a, 0.35);
  const ear = (bx: number, tipx: number, tipy: number, dark: boolean) => {
    ctx.beginPath();
    ctx.moveTo(bx - R * 0.3, -R * 0.62);
    ctx.quadraticCurveTo(tipx - R * 0.2, tipy + R * 0.2, tipx, tipy);
    ctx.quadraticCurveTo(bx + R * 0.32, tipy + R * 0.45, bx + R * 0.34, -R * 0.66);
    ctx.closePath();
    fo(rs, dark ? furD : fur);
    if (detail(rs) && !dark) {
      ctx.beginPath();
      ctx.moveTo(bx - R * 0.15, -R * 0.68);
      ctx.quadraticCurveTo(tipx - R * 0.08, tipy + R * 0.35, tipx + R * 0.02, tipy + R * 0.22);
      ctx.quadraticCurveTo(bx + R * 0.18, tipy + R * 0.5, bx + R * 0.18, -R * 0.7);
      ctx.closePath();
      fl(rs, inner);
    }
  };
  ear(R * 0.15, R * 0.32, -R * 1.55, true);
  ear(-R * 0.4, -R * 0.5, -R * 1.5, false);
}

function birdHead(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  // Bec (inférieur puis supérieur)
  const beak = mix('#f0b44a', p.a, 0.35);
  const bite = rs.pose.bite;
  ctx.save();
  ctx.translate(R * 0.75, R * 0.12);
  ctx.rotate(bite * 0.35);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(R * 0.5, R * 0.18, R * 0.75, R * 0.12);
  ctx.lineTo(0, R * 0.22);
  ctx.closePath();
  fo(rs, darken(beak, 0.2));
  ctx.restore();
  ctx.beginPath();
  circle(ctx, 0, 0, R);
  fo(rs, rad(rs, 'h:bird', 0, -R * 0.2, R * 1.2, [[0, p.pL], [0.65, p.p], [1, p.pD]], R * 0.2, -R * 0.5));
  // Joue claire
  if (detail(rs, 0.4)) {
    ctx.beginPath();
    ellipse(ctx, R * 0.35, R * 0.3, R * 0.52, R * 0.45, -0.3);
    fl(rs, rgba(p.sL, 0.85));
  }
  ctx.beginPath();
  ctx.moveTo(R * 0.62, -R * 0.3);
  ctx.quadraticCurveTo(R * 1.35, -R * 0.35, R * 1.62, R * 0.28);
  ctx.quadraticCurveTo(R * 1.25, R * 0.12, R * 0.68, R * 0.22);
  ctx.closePath();
  fo(rs, lin(rs, 'h:beak', 0, -R * 0.3, 0, R * 0.3, lighten(beak, 0.3), beak));
  eyes(rs, g, null);
}

// ---------------------------------------------------------------------------
// Couches

function behind(rs: RS, h: HeadShape, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  switch (h) {
    case 'ponytail': {
      const sw = rs.pose.sway * 0.12 + Math.sin(rs.time * 2.1) * 0.05;
      const tx = g.kind === 'hum' ? -R * 0.78 : -R * 0.7;
      ctx.beginPath();
      taper(
        ctx,
        [tx, -R * 0.62, -R * 1.45, -R * 0.55 + sw * R, -R * 1.85, R * 0.2 + sw * R * 1.5, -R * 1.65, R * 1.0 + sw * R * 2],
        [R * 0.28, R * 0.3, R * 0.2, R * 0.04],
      );
      fo(rs, lin(rs, 'h:pony', 0, -R, 0, R, p.hairL, p.hair, p.hairD));
      break;
    }
    case 'horns':
      horn(rs, R, g, true);
      break;
    case 'antlers':
      antler(rs, R, g, true);
      break;
    case 'hood':
      if (g.kind !== 'hum') cloth(rs, g, p.p, true);
      break;
    case 'fins':
      fin(rs, R * 0.55, -R * 0.15, R * 0.75, -0.6, true);
      break;
    case 'beast':
      if (g.kind === 'quad') mane(rs, g, p.s);
      else if (g.kind === 'hum') mane(rs, g, p.s);
      break;
    case 'flame':
      if (g.kind !== 'hum') flameMane(rs, g);
      break;
    case 'tentacles':
      if (g.kind === 'hum') tentacleBack(rs, R);
      break;
    case 'veil':
      if (g.kind === 'hum') {
        // pan arrière du foulard
        const sw = rs.pose.sway * 0.1;
        ctx.beginPath();
        taper(ctx, [-R * 0.7, -R * 0.2, -R * 1.25, R * 0.4 + sw * R, -R * 1.45, R * 1.2 + sw * R * 1.6], [R * 0.4, R * 0.36, R * 0.22]);
        fo(rs, p.pD);
      }
      break;
    default:
      break;
  }
}

function base(rs: RS, h: HeadShape, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  // Têtes de remplacement communes
  if (h === 'orb') return orbHead(rs, g);
  if (h === 'skull') return skullHead(rs, g);
  if (h === 'flame' && g.kind === 'hum') return flameHead(rs, g);

  if (g.kind === 'quad') {
    const fur = p.p;
    animalCranium(rs, g, fur, p.pL, p.pD, p.sL);
    return;
  }
  if (g.kind === 'bird') {
    birdHead(rs, g);
    return;
  }
  switch (h) {
    case 'helm':
      return helm(rs, g);
    case 'visor':
      return visorHelm(rs, g);
    case 'hood':
      return hood(rs, g);
    case 'beast': {
      animalCranium(rs, { ...g, ex: 0.3 * R, ey: -0.2 * R, fx: 0.75 * R, fy: -0.24 * R, ew: 0.16 * R, eh: 0.2 * R }, p.p, p.pL, p.pD, p.sL);
      return;
    }
    case 'mask':
      face(rs, g, { mouth: false, blush: false });
      hair(rs, R, 'back');
      return;
    case 'tentacles':
      face(rs, g, { mouth: false, blush: false });
      if (detail(rs)) {
        ctx.beginPath();
        ctx.moveTo(-R * 0.6, -R * 0.55);
        ctx.quadraticCurveTo(-R * 0.1, -R * 0.85, R * 0.5, -R * 0.62);
        ctx.moveTo(-R * 0.7, -R * 0.25);
        ctx.quadraticCurveTo(-R * 0.2, -R * 0.55, R * 0.4, -R * 0.38);
        st(rs, p.skinD, rs.lw);
      }
      return;
    case 'fins':
      face(rs, g, { blush: false });
      if (detail(rs)) {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          ctx.moveTo(-R * 0.25 + i * R * 0.12, R * 0.35);
          ctx.quadraticCurveTo(-R * 0.18 + i * R * 0.12, R * 0.5, -R * 0.25 + i * R * 0.12, R * 0.62);
        }
        st(rs, p.skinD, rs.lw * 0.8);
      }
      return;
    case 'veil':
      face(rs, g, { mouth: false });
      return;
    case 'goggles':
      face(rs, g, {});
      hair(rs, R, 'spiky');
      return;
    case 'hat':
    case 'tricorn':
      face(rs, g, {});
      hair(rs, R, 'back');
      return;
    case 'ponytail':
    case 'crown':
    case 'halo':
      face(rs, g, {});
      hair(rs, R, 'smooth');
      return;
    case 'horns':
    case 'antlers':
    case 'bare':
    default:
      face(rs, g, {});
      hair(rs, R, 'spiky');
      return;
  }
}

function over(rs: RS, h: HeadShape, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  switch (h) {
    case 'crown':
      return crown(rs, g);
    case 'halo':
      return halo(rs, g);
    case 'horns':
      return horn(rs, R, g, false);
    case 'antlers':
      return antler(rs, R, g, false);
    case 'hat':
      return hat(rs, g);
    case 'tricorn':
      return tricorn(rs, g);
    case 'goggles':
      return goggles(rs, g);
    case 'mask':
      return mask(rs, g);
    case 'veil':
      if (g.kind === 'hum') return veil(rs, g);
      return cloth(rs, g, p.s, false);
    case 'hood':
      if (g.kind !== 'hum') cloth(rs, g, p.p, false);
      return;
    case 'helm':
      if (g.kind !== 'hum') chanfron(rs, g);
      return;
    case 'visor':
      if (g.kind !== 'hum') {
        ctx.beginPath();
        ctx.moveTo(g.ex - R * 0.35, g.ey - R * 0.16);
        ctx.lineTo(g.fx + R * 0.25, g.fy - R * 0.2);
        ctx.lineTo(g.fx + R * 0.25, g.fy + R * 0.12);
        ctx.lineTo(g.ex - R * 0.35, g.ey + R * 0.16);
        ctx.closePath();
        fo(rs, lin(rs, 'h:visq', 0, g.ey - R * 0.2, 0, g.ey + R * 0.2, p.aLL, p.a, p.aD));
        glow(rs, (g.ex + g.fx) / 2, g.ey, R * 0.9, p.a, 0.45);
      }
      return;
    case 'fins':
      fin(rs, -R * 0.1, -R * 0.85, R * 0.95, -1.2, false);
      fin(rs, -R * 0.5, R * 0.2, R * 0.6, 0.6, false);
      return;
    case 'tentacles':
      return tentacles(rs, g);
    case 'ponytail':
      if (detail(rs, 0.4)) {
        ctx.beginPath();
        ellipse(ctx, -R * 0.82, -R * 0.6, R * 0.13, R * 0.17, 0.5);
        fo(rs, p.a, true, 0.7);
      }
      return;
    case 'flame':
      if (g.kind !== 'hum') {
        // flammèches devant
        flameTips(rs, g, 0.6);
      }
      return;
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Coiffes et têtes spéciales

function helm(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  // Plumet
  const sw = rs.pose.sway * 0.12;
  ctx.beginPath();
  taper(
    ctx,
    [R * 0.15, -R * 1.02, -R * 0.4, -R * 1.42 + sw * R * 0.4, -R * 1.15, -R * 1.2 + sw * R, -R * 1.55, -R * 0.45 + sw * R * 1.4],
    [R * 0.18, R * 0.3, R * 0.26, R * 0.05],
  );
  fo(rs, lin(rs, 'h:plume', 0, -R * 1.5, 0, -R * 0.4, p.aL, p.a, p.aD));
  // Coque
  ctx.beginPath();
  ctx.moveTo(R * 1.04, R * 0.0);
  ctx.bezierCurveTo(R * 1.08, -R * 0.75, R * 0.55, -R * 1.08, -R * 0.05, -R * 1.07);
  ctx.bezierCurveTo(-R * 0.75, -R * 1.06, -R * 1.1, -R * 0.55, -R * 1.08, R * 0.1);
  ctx.bezierCurveTo(-R * 1.06, R * 0.62, -R * 0.75, R * 0.98, -R * 0.15, R * 1.0);
  ctx.lineTo(R * 0.55, R * 0.98);
  ctx.bezierCurveTo(R * 0.92, R * 0.9, R * 1.05, R * 0.55, R * 1.04, R * 0.0);
  ctx.closePath();
  fo(rs, rad(rs, 'h:helm', R * 0.1, -R * 0.2, R * 1.35, [[0, p.pLL], [0.45, p.pL], [0.8, p.p], [1, p.pD]], R * 0.35, -R * 0.55));
  // Arête centrale
  if (detail(rs, 0.4)) {
    ctx.beginPath();
    ctx.moveTo(R * 0.18, -R * 1.05);
    ctx.bezierCurveTo(R * 0.62, -R * 0.82, R * 0.72, -R * 0.2, R * 0.62, R * 0.95);
    st(rs, rgba(p.pDD, 0.55), rs.lw * 1.2);
  }
  // Fente de visière
  ctx.beginPath();
  ctx.moveTo(-R * 0.18, R * 0.02);
  ctx.quadraticCurveTo(R * 0.45, -R * 0.08, R * 1.02, R * 0.0);
  ctx.lineTo(R * 1.02, R * 0.2);
  ctx.quadraticCurveTo(R * 0.45, R * 0.12, -R * 0.15, R * 0.22);
  ctx.closePath();
  fo(rs, '#120a1e', true, 0.6);
  if (rs.pose.eyes !== 'closed') {
    ctx.beginPath();
    ellipse(ctx, R * 0.2, R * 0.1, R * 0.11, R * 0.05);
    ellipse(ctx, R * 0.68, R * 0.08, R * 0.09, R * 0.045);
    fl(rs, p.aLL);
    glow(rs, R * 0.45, R * 0.1, R * 0.6, p.a, 0.4);
  }
  // Grille respiratoire + bande dorée
  if (detail(rs)) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(R * (0.45 + i * 0.16), R * 0.42);
      ctx.lineTo(R * (0.43 + i * 0.16), R * 0.7);
    }
    st(rs, rgba(p.pDD, 0.8), rs.lw * 0.9);
    ctx.beginPath();
    ctx.moveTo(-R * 1.0, R * 0.42);
    ctx.quadraticCurveTo(-R * 0.6, R * 0.3, -R * 0.22, R * 0.36);
    st(rs, p.trim, rs.lw * 1.4);
    spec(rs, R * 0.15, -R * 0.62, R * 0.32, R * 0.12, -0.35, 0.5);
  }
}

function visorHelm(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  // Antenne
  ctx.beginPath();
  ctx.moveTo(-R * 0.35, -R * 0.9);
  ctx.lineTo(-R * 0.62, -R * 1.45);
  st(rs, INK, rs.lw * 2.2);
  ctx.beginPath();
  ctx.moveTo(-R * 0.35, -R * 0.9);
  ctx.lineTo(-R * 0.62, -R * 1.45);
  st(rs, p.trim, rs.lw * 1.0);
  ctx.beginPath();
  circle(ctx, -R * 0.63, -R * 1.47, R * 0.11);
  fo(rs, p.aL, true, 0.7);
  glow(rs, -R * 0.63, -R * 1.47, R * 0.4, p.a, 0.5);
  // Coque arrondie
  ctx.beginPath();
  ctx.moveTo(R * 1.0, R * 0.2);
  ctx.bezierCurveTo(R * 1.08, -R * 0.8, R * 0.4, -R * 1.06, -R * 0.15, -R * 1.04);
  ctx.bezierCurveTo(-R * 0.85, -R * 1.0, -R * 1.08, -R * 0.4, -R * 1.05, R * 0.25);
  ctx.bezierCurveTo(-R * 1.0, R * 0.8, -R * 0.4, R * 1.02, R * 0.2, R * 0.98);
  ctx.bezierCurveTo(R * 0.75, R * 0.94, R * 0.98, R * 0.65, R * 1.0, R * 0.2);
  ctx.closePath();
  fo(rs, rad(rs, 'h:vis', R * 0.1, -R * 0.2, R * 1.3, [[0, p.pLL], [0.5, p.pL], [0.85, p.p], [1, p.pD]], R * 0.3, -R * 0.55));
  // Bande lumineuse
  ctx.beginPath();
  ctx.moveTo(-R * 0.35, -R * 0.12);
  ctx.quadraticCurveTo(R * 0.4, -R * 0.24, R * 1.06, -R * 0.1);
  ctx.lineTo(R * 1.04, R * 0.3);
  ctx.quadraticCurveTo(R * 0.4, R * 0.2, -R * 0.32, R * 0.3);
  ctx.closePath();
  const blinkDim = rs.pose.eyes === 'closed' ? 0.55 : 1;
  fo(rs, lin(rs, 'h:band', 0, -R * 0.2, 0, R * 0.3, p.aLL, p.a, p.aD));
  glow(rs, R * 0.4, R * 0.05, R * 1.1, p.a, 0.4 * blinkDim);
  if (detail(rs)) {
    ctx.beginPath();
    ctx.moveTo(-R * 0.1, -R * 0.05);
    ctx.quadraticCurveTo(R * 0.4, -R * 0.13, R * 0.9, -R * 0.04);
    st(rs, 'rgba(255,255,255,0.75)', rs.lw * 0.9);
    // Mentonnière
    ctx.beginPath();
    ctx.moveTo(R * 0.15, R * 0.55);
    ctx.lineTo(R * 0.85, R * 0.48);
    st(rs, rgba(p.pDD, 0.6), rs.lw);
    spec(rs, -R * 0.2, -R * 0.7, R * 0.3, R * 0.1, -0.2, 0.45);
  }
}

function hood(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  ctx.beginPath();
  ctx.moveTo(R * 0.92, R * 0.86);
  ctx.bezierCurveTo(R * 1.18, R * 0.3, R * 1.18, -R * 0.5, R * 0.62, -R * 0.95);
  ctx.bezierCurveTo(R * 0.15, -R * 1.3, -R * 0.75, -R * 1.25, -R * 1.25, -R * 0.95);
  ctx.bezierCurveTo(-R * 1.05, -R * 0.6, -R * 1.2, R * 0.2, -R * 1.05, R * 0.6);
  ctx.bezierCurveTo(-R * 0.85, R * 1.0, R * 0.2, R * 1.08, R * 0.92, R * 0.86);
  ctx.closePath();
  fo(rs, rad(rs, 'h:hood', -R * 0.1, -R * 0.3, R * 1.5, [[0, p.pL], [0.55, p.p], [1, p.pDD]], -R * 0.2, -R * 0.8));
  // Ouverture
  ctx.beginPath();
  ellipse(ctx, R * 0.42, R * 0.16, R * 0.58, R * 0.68, 0.12);
  fo(rs, lin(rs, 'h:hoodin', 0, -R * 0.5, 0, R * 0.8, '#07040e', '#1d1430'), false);
  if (detail(rs, 0.4)) {
    ctx.beginPath();
    ctx.ellipse(R * 0.42, R * 0.16, R * 0.62, R * 0.72, 0.12, Math.PI * 0.85, Math.PI * 2.2);
    st(rs, rgba(p.pLL, 0.6), rs.lw * 1.2);
  }
  // Yeux lumineux en amande
  if (rs.pose.eyes !== 'closed') {
    const ey = R * 0.15;
    ctx.beginPath();
    ellipse(ctx, R * 0.18, ey, R * 0.12, R * 0.07, 0.15);
    ellipse(ctx, R * 0.62, ey - R * 0.02, R * 0.1, R * 0.06, 0.15);
    fl(rs, p.aLL);
    glow(rs, R * 0.4, ey, R * 0.75, p.a, 0.55);
  } else {
    ctx.beginPath();
    ctx.moveTo(R * 0.06, R * 0.16);
    ctx.lineTo(R * 0.3, R * 0.17);
    ctx.moveTo(R * 0.52, R * 0.14);
    ctx.lineTo(R * 0.72, R * 0.15);
    st(rs, p.a, rs.lw);
  }
}

function crown(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const cy = g.top + R * (g.kind === 'hum' ? 0.32 : 0.28);
  const w = g.kind === 'hum' ? 0.72 : 0.6;
  const x0 = -R * w + R * 0.08;
  const x1 = R * w + R * 0.08;
  const hgt = R * 0.48;
  ctx.beginPath();
  ctx.moveTo(x0, cy + R * 0.1);
  ctx.quadraticCurveTo((x0 + x1) / 2, cy + R * 0.24, x1, cy + R * 0.1);
  ctx.lineTo(x1 + R * 0.06, cy - hgt * 0.75);
  const n = 5;
  for (let i = n - 1; i >= 0; i--) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    const peak = i % 2 === 0 ? hgt : hgt * 0.62;
    ctx.lineTo(x + (x1 - x0) / (n * 2), cy - hgt * 0.35);
    ctx.lineTo(x, cy - peak - R * 0.05);
    ctx.lineTo(x - (x1 - x0) / (n * 2), cy - hgt * 0.35);
  }
  ctx.lineTo(x0 - R * 0.06, cy - hgt * 0.75);
  ctx.closePath();
  fo(rs, lin(rs, 'h:crown' + g.kind, 0, cy - hgt, 0, cy + R * 0.2, p.trimL, p.trim, p.trimD));
  if (detail(rs, 0.4)) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = x0 + ((x1 - x0) * (i * 2 + 0.5)) / n;
      circle(ctx, x, cy - hgt - R * 0.07, R * 0.07);
    }
    ellipse(ctx, (x0 + x1) / 2 + R * 0.05, cy - R * 0.04, R * 0.12, R * 0.09);
    fo(rs, p.aL, true, 0.6);
    glow(rs, (x0 + x1) / 2, cy - R * 0.1, R * 0.7, p.trimL, 0.25);
  }
}

function halo(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const y = g.top - R * 0.32 + Math.sin(rs.time * 2) * R * 0.04;
  const x = g.kind === 'hum' ? R * 0.05 : -R * 0.05;
  glow(rs, x, y, R * 1.3, p.a, 0.45, R * 0.5);
  ctx.beginPath();
  ctx.ellipse(x, y, R * 0.72, R * 0.22, -0.12, 0, TAU);
  st(rs, INK, rs.lw * 2 + R * 0.16);
  ctx.beginPath();
  ctx.ellipse(x, y, R * 0.72, R * 0.22, -0.12, 0, TAU);
  st(rs, lin(rs, 'h:halo', 0, y - R * 0.2, 0, y + R * 0.2, p.aLL, p.trimL, p.trim), R * 0.16);
}

function horn(rs: RS, R: number, g: HG, far: boolean): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const col = mix('#ece0c6', p.s, 0.3);
  const colD = darken(col, 0.4);
  ctx.beginPath();
  if (g.kind === 'hum') {
    if (far) taper(ctx, [R * 0.45, -R * 0.75, R * 0.62, -R * 1.25, R * 0.42, -R * 1.62], [R * 0.17, R * 0.12, R * 0.02]);
    else taper(ctx, [-R * 0.38, -R * 0.78, -R * 0.75, -R * 1.25, -R * 0.55, -R * 1.72], [R * 0.2, R * 0.14, R * 0.02]);
  } else {
    // cornes de bélier/taureau sur les bêtes
    if (far) taper(ctx, [R * 0.25, -R * 0.8, R * 0.55, -R * 1.25, R * 0.95, -R * 1.25], [R * 0.17, R * 0.12, R * 0.02]);
    else taper(ctx, [-R * 0.1, -R * 0.85, -R * 0.5, -R * 1.35, -R * 0.05, -R * 1.62], [R * 0.21, R * 0.15, R * 0.02]);
  }
  fo(rs, far ? colD : lin(rs, 'h:horn', 0, -R * 1.7, 0, -R * 0.7, lighten(col, 0.4), col, colD));
  if (!far && detail(rs)) {
    ctx.beginPath();
    const bx = g.kind === 'hum' ? -R * 0.5 : -R * 0.25;
    for (let i = 0; i < 3; i++) {
      const yy = -R * (0.98 + i * 0.18);
      ctx.moveTo(bx - R * 0.12 - i * R * 0.04, yy);
      ctx.lineTo(bx + R * 0.1 - i * R * 0.04, yy - R * 0.05);
    }
    st(rs, colD, rs.lw * 0.8);
  }
}

function antler(rs: RS, R: number, g: HG, far: boolean): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const col = mix('#9b7550', p.s, 0.25);
  const c = far ? darken(col, 0.35) : col;
  const bx = g.kind === 'hum' ? (far ? R * 0.42 : -R * 0.32) : far ? R * 0.2 : -R * 0.2;
  const by = -R * 0.78;
  const dir = far ? 1 : -1;
  const w = R * 0.11;
  const beam = [bx, by, bx + dir * R * 0.25, by - R * 0.55, bx + dir * R * 0.15, by - R * 1.05, bx + dir * R * 0.45, by - R * 1.45];
  ctx.beginPath();
  taper(ctx, beam, [w * 1.3, w, w * 0.8, w * 0.35]);
  fo(rs, c);
  const tines: number[][] = [
    [bx + dir * R * 0.22, by - R * 0.5, bx + dir * R * 0.7, by - R * 0.72],
    [bx + dir * R * 0.17, by - R * 0.95, bx - dir * R * 0.2, by - R * 1.32],
    [bx + dir * R * 0.3, by - R * 1.2, bx + dir * R * 0.82, by - R * 1.3],
  ];
  for (const tn of tines) {
    ctx.beginPath();
    taper(ctx, tn, [w * 0.75, w * 0.3]);
    fo(rs, c);
  }
  if (!far && detail(rs, 0.6)) {
    // petite feuille / bourgeon lumineux
    ctx.beginPath();
    ellipse(ctx, bx + dir * R * 0.78, by - R * 0.78, R * 0.14, R * 0.07, -0.6);
    fo(rs, mix('#7fcf6a', p.a, 0.3), true, 0.6);
  }
}

function hat(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const by = g.top + R * (g.kind === 'hum' ? 0.42 : 0.3);
  const cx = g.kind === 'hum' ? R * 0.08 : 0;
  const sw = rs.pose.sway * 0.08;
  // Bord
  ctx.beginPath();
  ctx.ellipse(cx, by, R * 1.38, R * 0.3, -0.06, 0, TAU);
  fo(rs, lin(rs, 'h:brim' + g.kind, 0, by - R * 0.3, 0, by + R * 0.3, p.pL, p.pD));
  // Cône coudé
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.68, by - R * 0.05);
  ctx.quadraticCurveTo(cx - R * 0.45, by - R * 0.85, cx - R * 0.2, by - R * 1.15);
  ctx.quadraticCurveTo(cx - R * 0.55 + sw * R, by - R * 1.5, cx - R * 1.15 + sw * R * 2, by - R * 1.45);
  ctx.quadraticCurveTo(cx - R * 0.35, by - R * 1.9, cx + R * 0.25, by - R * 1.2);
  ctx.quadraticCurveTo(cx + R * 0.55, by - R * 0.6, cx + R * 0.72, by - R * 0.05);
  ctx.quadraticCurveTo(cx, by + R * 0.1, cx - R * 0.68, by - R * 0.05);
  ctx.closePath();
  fo(rs, lin(rs, 'h:cone' + g.kind, cx - R * 0.6, 0, cx + R * 0.7, 0, p.pD, p.pL, p.p));
  // Bande
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.66, by - R * 0.08);
  ctx.quadraticCurveTo(cx, by + R * 0.06, cx + R * 0.71, by - R * 0.08);
  ctx.lineTo(cx + R * 0.66, by - R * 0.3);
  ctx.quadraticCurveTo(cx, by - R * 0.18, cx - R * 0.6, by - R * 0.32);
  ctx.closePath();
  fo(rs, p.s, true, 0.8);
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    star(ctx, cx + R * 0.15, by - R * 0.65, 4, R * 0.2, R * 0.07);
    fo(rs, p.aL, true, 0.6);
    glow(rs, cx + R * 0.15, by - R * 0.65, R * 0.5, p.a, 0.35);
    ctx.beginPath();
    circle(ctx, cx + R * 0.05, by - R * 0.2, R * 0.08);
    fl(rs, p.trimL);
  }
}

function tricorn(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const by = g.top + R * (g.kind === 'hum' ? 0.45 : 0.32);
  const cx = g.kind === 'hum' ? R * 0.05 : 0;
  // Plume
  const sw = rs.pose.sway * 0.1;
  ctx.beginPath();
  taper(ctx, [cx - R * 0.3, by - R * 0.55, cx - R * 0.95, by - R * 0.95 + sw * R, cx - R * 1.45, by - R * 0.55 + sw * R * 1.5], [R * 0.1, R * 0.22, R * 0.04]);
  fo(rs, p.aL);
  // Calotte
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.62, by - R * 0.15);
  ctx.bezierCurveTo(cx - R * 0.65, by - R * 1.0, cx + R * 0.65, by - R * 1.0, cx + R * 0.62, by - R * 0.15);
  ctx.closePath();
  fo(rs, lin(rs, 'h:tcrown' + g.kind, 0, by - R, 0, by, p.pL, p.pD));
  // Bords relevés (trois pointes)
  ctx.beginPath();
  ctx.moveTo(cx - R * 1.3, by - R * 0.42);
  ctx.quadraticCurveTo(cx - R * 0.8, by + R * 0.12, cx - R * 0.05, by + R * 0.05);
  ctx.quadraticCurveTo(cx + R * 0.7, by + R * 0.15, cx + R * 1.28, by - R * 0.38);
  ctx.quadraticCurveTo(cx + R * 0.95, by - R * 0.25, cx + R * 0.55, by - R * 0.55);
  ctx.quadraticCurveTo(cx, by - R * 0.3, cx - R * 0.6, by - R * 0.58);
  ctx.quadraticCurveTo(cx - R * 1.0, by - R * 0.3, cx - R * 1.3, by - R * 0.42);
  ctx.closePath();
  fo(rs, lin(rs, 'h:tbrim' + g.kind, 0, by - R * 0.6, 0, by + R * 0.15, p.p, p.pDD));
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    ctx.moveTo(cx - R * 1.24, by - R * 0.4);
    ctx.quadraticCurveTo(cx - R * 0.8, by + R * 0.06, cx - R * 0.05, by - R * 0.01);
    ctx.quadraticCurveTo(cx + R * 0.7, by + R * 0.08, cx + R * 1.22, by - R * 0.36);
    st(rs, p.trim, rs.lw * 1.3);
    ctx.beginPath();
    circle(ctx, cx - R * 0.05, by - R * 0.18, R * 0.1);
    fo(rs, p.aL, true, 0.6);
  }
}

function goggles(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  // Sangle
  ctx.beginPath();
  if (g.kind === 'hum') {
    ctx.moveTo(-R * 1.0, g.ey - R * 0.25);
    ctx.quadraticCurveTo(-R * 0.4, g.ey - R * 0.08, g.fx + R * 0.4, g.fy - R * 0.05);
  } else {
    ctx.moveTo(-R * 0.9, g.ey - R * 0.1);
    ctx.quadraticCurveTo(0, g.ey - R * 0.1, g.fx + R * 0.2, g.fy);
  }
  st(rs, INK, R * 0.26 + rs.lw * 2);
  ctx.beginPath();
  if (g.kind === 'hum') {
    ctx.moveTo(-R * 1.0, g.ey - R * 0.25);
    ctx.quadraticCurveTo(-R * 0.4, g.ey - R * 0.08, g.fx + R * 0.4, g.fy - R * 0.05);
  } else {
    ctx.moveTo(-R * 0.9, g.ey - R * 0.1);
    ctx.quadraticCurveTo(0, g.ey - R * 0.1, g.fx + R * 0.2, g.fy);
  }
  st(rs, p.leather, R * 0.26);
  const lens = (x: number, y: number, r: number, sq: number) => {
    ctx.beginPath();
    ellipse(ctx, x, y, r * sq, r);
    fo(rs, p.trim);
    ctx.beginPath();
    ellipse(ctx, x, y, r * sq * 0.72, r * 0.72);
    fo(rs, rad(rs, 'h:lens' + g.kind + x.toFixed(1), x, y, r, [[0, p.aLL], [0.6, p.a], [1, p.aD]], x - r * 0.3, y - r * 0.3), false);
    if (detail(rs, 0.45)) spec(rs, x - r * 0.25, y - r * 0.3, r * 0.25, r * 0.14, -0.6, 0.8);
  };
  lens(g.fx + R * 0.02, g.fy, R * 0.25, 0.8);
  lens(g.ex, g.ey, R * 0.29, 0.92);
  ctx.beginPath();
  ctx.moveTo(g.ex + R * 0.25, g.ey);
  ctx.lineTo(g.fx - R * 0.18, g.fy);
  st(rs, p.trimD, rs.lw * 1.5);
}

function mask(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const col = mix('#f3eadb', p.s, 0.18);
  ctx.beginPath();
  if (g.kind === 'hum') {
    ctx.moveTo(-R * 0.3, -R * 0.5);
    ctx.bezierCurveTo(R * 0.3, -R * 0.78, R * 1.05, -R * 0.55, R * 1.04, R * 0.05);
    ctx.bezierCurveTo(R * 1.02, R * 0.6, R * 0.6, R * 0.95, R * 0.22, R * 0.92);
    ctx.bezierCurveTo(-R * 0.15, R * 0.88, -R * 0.38, R * 0.4, -R * 0.3, -R * 0.5);
  } else {
    ctx.moveTo(-R * 0.1, -R * 0.75);
    ctx.bezierCurveTo(R * 0.8, -R * 0.8, R * 1.55, -R * 0.4, R * 1.5, R * 0.0);
    ctx.lineTo(R * 0.2, R * 0.2);
    ctx.closePath();
  }
  ctx.closePath();
  fo(rs, lin(rs, 'h:mask' + g.kind, 0, -R * 0.7, 0, R * 0.9, lighten(col, 0.5), col, darken(col, 0.18)));
  // Ornements de couleur
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    if (g.kind === 'hum') {
      ctx.moveTo(g.ex, g.ey + R * 0.2);
      ctx.quadraticCurveTo(g.ex - R * 0.05, g.ey + R * 0.45, g.ex + R * 0.05, g.ey + R * 0.62);
      ctx.moveTo(g.fx, g.fy + R * 0.2);
      ctx.quadraticCurveTo(g.fx + R * 0.02, g.fy + R * 0.42, g.fx + R * 0.08, g.fy + R * 0.58);
    } else {
      ctx.moveTo(R * 0.1, -R * 0.55);
      ctx.lineTo(R * 1.3, -R * 0.2);
    }
    st(rs, p.a, rs.lw * 1.6);
    ctx.beginPath();
    ctx.moveTo(R * 0.2, -R * 0.62);
    ctx.lineTo(R * 0.32, -R * 0.42);
    ctx.lineTo(R * 0.44, -R * 0.64);
    st(rs, p.trim, rs.lw * 1.2);
  }
  // Orbites
  const hole = (x: number, y: number, w: number) => {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - w * 0.9, x + w, y - w * 0.15);
    ctx.quadraticCurveTo(x, y + w * 0.6, x - w, y);
    ctx.closePath();
    fl(rs, '#140a20');
  };
  hole(g.ex, g.ey, R * 0.2);
  hole(g.fx, g.fy, R * 0.16);
  if (rs.pose.eyes !== 'closed') {
    ctx.beginPath();
    circle(ctx, g.ex + R * 0.02, g.ey - R * 0.02, R * 0.055);
    circle(ctx, g.fx + R * 0.02, g.fy - R * 0.02, R * 0.045);
    fl(rs, p.aLL);
    glow(rs, (g.ex + g.fx) / 2, g.ey, R * 0.7, p.a, 0.3);
  }
}

function veil(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  // Turban / foulard de tête
  ctx.beginPath();
  ctx.moveTo(R * 1.0, -R * 0.1);
  ctx.bezierCurveTo(R * 1.05, -R * 1.0, R * 0.1, -R * 1.3, -R * 0.5, -R * 1.02);
  ctx.bezierCurveTo(-R * 1.15, -R * 0.75, -R * 1.2, R * 0.0, -R * 1.0, R * 0.5);
  ctx.lineTo(-R * 0.6, R * 0.55);
  ctx.quadraticCurveTo(-R * 0.6, -R * 0.12, -R * 0.3, -R * 0.3);
  ctx.quadraticCurveTo(R * 0.4, -R * 0.46, R * 1.0, -R * 0.2);
  ctx.closePath();
  fo(rs, lin(rs, 'h:turban', 0, -R * 1.2, 0, R * 0.5, p.pL, p.p, p.pD));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    ctx.moveTo(-R * 0.85, -R * 0.55);
    ctx.quadraticCurveTo(-R * 0.1, -R * 1.0, R * 0.85, -R * 0.55);
    ctx.moveTo(-R * 0.95, -R * 0.15);
    ctx.quadraticCurveTo(-R * 0.1, -R * 0.65, R * 0.95, -R * 0.3);
    st(rs, rgba(p.pDD, 0.55), rs.lw);
  }
  // Joyau frontal
  ctx.beginPath();
  ctx.moveTo(R * 0.42, -R * 0.7);
  ctx.lineTo(R * 0.55, -R * 0.52);
  ctx.lineTo(R * 0.42, -R * 0.34);
  ctx.lineTo(R * 0.29, -R * 0.52);
  ctx.closePath();
  fo(rs, p.aL, true, 0.6);
  glow(rs, R * 0.42, -R * 0.52, R * 0.45, p.a, 0.35);
  // Voile du bas du visage
  const sw = rs.pose.sway * 0.05;
  ctx.beginPath();
  ctx.moveTo(-R * 0.42, R * 0.46);
  ctx.quadraticCurveTo(R * 0.35, R * 0.38, R * 1.02, R * 0.44);
  ctx.quadraticCurveTo(R * 1.1, R * 0.9, R * 0.75 - sw * R, R * 1.25);
  ctx.quadraticCurveTo(R * 0.2, R * 1.12, -R * 0.4, R * 1.15);
  ctx.closePath();
  fo(rs, lin(rs, 'h:veil', 0, R * 0.2, 0, R * 1.2, p.sL, p.s, p.sD));
  if (detail(rs, 0.55)) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) circle(ctx, -R * 0.3 + i * R * 0.27, R * 1.17 - (i === 4 ? R * 0.03 : 0), R * 0.055);
    fl(rs, p.trimL);
  }
}

function tentacles(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const col = mix(p.skin, p.s, 0.45);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const bx = (g.kind === 'hum' ? R * 0.05 : R * 0.6) + i * R * 0.22;
    const by = g.kind === 'hum' ? R * 0.52 : R * 0.42;
    const ph = rs.time * 2.4 + i * 1.3;
    const s1 = Math.sin(ph) * R * 0.18;
    const s2 = Math.sin(ph + 1.2) * R * 0.25;
    const len = R * (0.75 + (i % 2) * 0.25);
    ctx.beginPath();
    taper(ctx, [bx, by, bx + s1 * 0.5, by + len * 0.45, bx + s2, by + len * 0.85, bx + s2 + R * 0.2, by + len], [R * 0.11, R * 0.09, R * 0.06, R * 0.015]);
    fo(rs, i % 2 === 0 ? col : darken(col, 0.15), true, 0.8);
  }
  if (detail(rs, 0.6)) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const bx = (g.kind === 'hum' ? R * 0.05 : R * 0.6) + i * R * 0.22;
      circle(ctx, bx + R * 0.04, (g.kind === 'hum' ? R * 0.52 : R * 0.42) + R * 0.3, R * 0.03);
    }
    fl(rs, p.aL);
  }
}

function tentacleBack(rs: RS, R: number): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const col = darken(mix(p.skin, p.s, 0.45), 0.25);
  for (let i = 0; i < 3; i++) {
    const ph = rs.time * 2 + i;
    ctx.beginPath();
    taper(
      ctx,
      [-R * 0.6, -R * 0.4 + i * R * 0.3, -R * 1.2, -R * 0.2 + i * R * 0.35 + Math.sin(ph) * R * 0.1, -R * 1.5, R * 0.3 + i * R * 0.35 + Math.sin(ph + 1) * R * 0.2],
      [R * 0.16, R * 0.1, R * 0.02],
    );
    fo(rs, col, true, 0.8);
  }
}

function fin(rs: RS, x: number, y: number, size: number, rot: number, far: boolean): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const col = far ? darken(p.a, 0.35) : p.a;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-size * 0.3, -size * 0.8, -size * 1.05, -size * 0.85);
  ctx.quadraticCurveTo(-size * 0.8, -size * 0.45, -size * 1.0, -size * 0.2);
  ctx.quadraticCurveTo(-size * 0.5, -size * 0.1, 0, size * 0.25);
  ctx.closePath();
  fo(rs, lin(rs, 'h:fin' + (far ? 'f' : 'n') + size.toFixed(1), 0, -size, 0, size * 0.25, lighten(col, 0.4), col, darken(col, 0.2)), true, 0.8);
  if (detail(rs, 0.55)) {
    ctx.beginPath();
    for (let i = 1; i <= 3; i++) {
      ctx.moveTo(0, size * 0.05);
      ctx.lineTo(-size * (0.25 + i * 0.22), -size * (0.85 - i * 0.18));
    }
    st(rs, rgba(darken(col, 0.4), 0.7), rs.lw * 0.7);
  }
  ctx.restore();
}

function mane(rs: RS, g: HG, col: string): void {
  const ctx = rs.ctx;
  const R = g.R;
  const cx = g.kind === 'quad' ? -R * 0.25 : -R * 0.15;
  const cy = g.kind === 'quad' ? R * 0.05 : R * 0.1;
  const n = 11;
  ctx.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = -Math.PI * 0.95 + (i / (n * 2)) * Math.PI * 1.75;
    const r = i % 2 === 0 ? R * 1.32 : R * 1.02;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.lineTo(cx, cy);
  ctx.closePath();
  fo(rs, rad(rs, 'h:mane' + g.kind, cx, cy, R * 1.35, [[0, darken(col, 0.3)], [0.7, col], [1, lighten(col, 0.2)]]));
}

function flameMane(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const n = 7;
  ctx.beginPath();
  ctx.moveTo(R * 0.4, -R * 0.4);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.35 - (i / (n - 1)) * Math.PI * 0.95;
    const fl0 = noise1(rs.time * 4 + i * 3.1, 3) * 0.5;
    const r = R * (1.45 + fl0);
    const ax = Math.cos(a) * r - R * 0.4;
    const ay = Math.sin(a) * r * 1.05;
    ctx.quadraticCurveTo(Math.cos(a + 0.2) * R * 0.95, Math.sin(a + 0.2) * R * 0.95, ax, ay);
  }
  ctx.quadraticCurveTo(-R * 0.9, R * 0.6, -R * 0.2, R * 0.6);
  ctx.closePath();
  fo(rs, lin(rs, 'h:fmane', 0, -R * 1.6, 0, R * 0.6, p.aLL, p.a, darken(p.a, 0.2)));
  glow(rs, -R * 0.3, -R * 0.3, R * 1.8, p.a, 0.4);
}

function flameTips(rs: RS, g: HG, a: number): void {
  if (!detail(rs, 0.5)) return;
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const fx = -R * 0.2 + i * R * 0.35;
    const h0 = R * (0.35 + noise1(rs.time * 5 + i * 7, 1) * 0.3);
    ctx.moveTo(fx - R * 0.12, -R * 0.82);
    ctx.quadraticCurveTo(fx - R * 0.05, -R * 0.9 - h0, fx - R * 0.15, -R * 0.95 - h0);
    ctx.quadraticCurveTo(fx + R * 0.15, -R * 0.9, fx + R * 0.12, -R * 0.8);
    ctx.closePath();
  }
  rs.ctx.globalAlpha *= a;
  fl(rs, p.aLL);
  rs.ctx.globalAlpha /= a;
}

function flameHead(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const t = rs.time;
  glow(rs, 0, -R * 0.3, R * 2.2, p.a, 0.55);
  const tongue = (scale: number, col: string | CanvasGradient, off: number) => {
    ctx.beginPath();
    const n1 = noise1(t * 5 + off, 2) - 0.5;
    const n2 = noise1(t * 6 + off + 4, 5) - 0.5;
    const n3 = noise1(t * 4.5 + off + 9, 8) - 0.5;
    const s = R * scale;
    ctx.moveTo(s * 0.92, s * 0.25);
    ctx.bezierCurveTo(s * 1.0, s * 0.9, -s * 0.9, s * 1.0, -s * 0.95, s * 0.2);
    ctx.quadraticCurveTo(-s * 1.15, -s * 0.5, -s * (1.25 + n1 * 0.3), -s * (1.05 + n1 * 0.2));
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.85, -s * 0.45, -s * 0.6);
    ctx.quadraticCurveTo(-s * 0.5, -s * 1.3, -s * (0.25 + n2 * 0.3), -s * (1.85 + n2 * 0.3));
    ctx.quadraticCurveTo(s * 0.15, -s * 1.1, s * 0.2, -s * 0.75);
    ctx.quadraticCurveTo(s * 0.45, -s * 1.1, s * (0.55 + n3 * 0.2), -s * (1.35 + n3 * 0.25));
    ctx.quadraticCurveTo(s * 1.05, -s * 0.6, s * 0.92, s * 0.25);
    ctx.closePath();
    fo(rs, col, scale > 0.9);
  };
  tongue(1.04, lin(rs, 'h:fl0', 0, -R * 1.9, 0, R, mix(p.a, '#ffd36a', 0.4), p.a, darken(p.a, 0.25)), 0);
  tongue(0.74, lin(rs, 'h:fl1', 0, -R * 1.4, 0, R * 0.8, '#fff3c4', mix(p.a, '#ffd36a', 0.6)), 11);
  tongue(0.45, '#fffbea', 23);
  // Visage de braise : yeux sombres et lumineux
  const ctx2 = rs.ctx;
  if (rs.pose.eyes === 'closed') {
    ctx2.beginPath();
    ctx2.moveTo(-R * 0.15, R * 0.15);
    ctx2.lineTo(R * 0.15, R * 0.18);
    ctx2.moveTo(R * 0.45, R * 0.14);
    ctx2.lineTo(R * 0.7, R * 0.16);
    st(rs, darken(p.a, 0.7), rs.lw * 1.4);
  } else {
    ctx2.beginPath();
    ellipse(ctx2, R * 0.0, R * 0.15, R * 0.15, R * 0.2, 0.2);
    ellipse(ctx2, R * 0.55, R * 0.12, R * 0.12, R * 0.17, 0.2);
    fl(rs, darken(p.a, 0.75));
    ctx2.beginPath();
    circle(ctx2, R * 0.03, R * 0.12, R * 0.06);
    circle(ctx2, R * 0.57, R * 0.09, R * 0.05);
    fl(rs, '#ffffff');
  }
}

function orbHead(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const cx = g.kind === 'quad' ? R * 0.2 : 0;
  // Collier mécanique
  ctx.beginPath();
  ellipse(ctx, cx, R * 0.82, R * 0.55, R * 0.2);
  fo(rs, lin(rs, 'h:collar', 0, R * 0.6, 0, R, p.trimL, p.trimD));
  // Anneau (moitié arrière)
  const rr = R * 1.32;
  const tilt = -0.28 + Math.sin(rs.time * 0.8) * 0.05;
  ctx.beginPath();
  ctx.ellipse(cx, 0, rr, R * 0.32, tilt, Math.PI, TAU);
  st(rs, INK, R * 0.14 + rs.lw * 2);
  ctx.beginPath();
  ctx.ellipse(cx, 0, rr, R * 0.32, tilt, Math.PI, TAU);
  st(rs, p.trimD, R * 0.14);
  glow(rs, cx, 0, R * 2.1, p.a, 0.5);
  ctx.beginPath();
  circle(ctx, cx, 0, R * 0.92);
  fo(rs, rad(rs, 'h:orb' + g.kind, cx, 0, R * 0.95, [[0, '#ffffff'], [0.25, p.aLL], [0.7, p.a], [1, p.aD]], cx - R * 0.3, -R * 0.35));
  if (detail(rs, 0.45)) {
    // tourbillon interne
    ctx.beginPath();
    ctx.arc(cx, 0, R * 0.55, rs.time * 1.5, rs.time * 1.5 + 2.2);
    ctx.moveTo(cx + Math.cos(rs.time * 1.5 + 3.1) * R * 0.35, Math.sin(rs.time * 1.5 + 3.1) * R * 0.35);
    ctx.arc(cx, 0, R * 0.35, rs.time * 1.5 + 3.1, rs.time * 1.5 + 4.9);
    st(rs, rgba('#ffffff', 0.55), rs.lw * 1.1);
    spec(rs, cx - R * 0.35, -R * 0.4, R * 0.22, R * 0.12, -0.6, 0.85);
  }
  // Fente d'yeux
  if (rs.pose.eyes !== 'closed') {
    ctx.beginPath();
    ellipse(ctx, cx + R * 0.15, R * 0.05, R * 0.1, R * 0.05);
    ellipse(ctx, cx + R * 0.58, R * 0.03, R * 0.08, R * 0.045);
    fl(rs, rs.pose.eyes === 'dizzy' ? p.aD : '#ffffff');
  }
  // Anneau (moitié avant)
  ctx.beginPath();
  ctx.ellipse(cx, 0, rr, R * 0.32, tilt, 0, Math.PI);
  st(rs, INK, R * 0.14 + rs.lw * 2);
  ctx.beginPath();
  ctx.ellipse(cx, 0, rr, R * 0.32, tilt, 0, Math.PI);
  st(rs, p.trim, R * 0.14);
}

function skullHead(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  const bone = mix('#efe6d2', p.s, 0.12);
  const boneD = darken(bone, 0.35);
  if (g.kind === 'quad' || g.kind === 'bird') {
    // Crâne de bête : boîte crânienne + long museau osseux
    ctx.beginPath();
    ctx.moveTo(-R * 0.9, -R * 0.2);
    ctx.bezierCurveTo(-R * 0.9, -R * 1.0, R * 0.4, -R * 1.05, R * 0.7, -R * 0.5);
    ctx.lineTo(R * 1.55, -R * 0.15);
    ctx.lineTo(R * 1.5, R * 0.18);
    ctx.lineTo(R * 0.5, R * 0.35);
    ctx.bezierCurveTo(R * 0.1, R * 0.75, -R * 0.8, R * 0.6, -R * 0.9, -R * 0.2);
    ctx.closePath();
    fo(rs, lin(rs, 'h:bskull', 0, -R, 0, R * 0.6, lighten(bone, 0.4), bone, boneD));
    ctx.beginPath();
    ellipse(ctx, R * 0.35, -R * 0.25, R * 0.22, R * 0.2);
    fl(rs, '#150b1c');
    ctx.beginPath();
    poly(ctx, [R * 1.3, -R * 0.05, R * 1.42, -R * 0.12, R * 1.4, R * 0.03]);
    fl(rs, '#150b1c');
    if (detail(rs)) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(R * (0.6 + i * 0.18), R * 0.25);
        ctx.lineTo(R * (0.62 + i * 0.18), R * 0.4);
      }
      st(rs, boneD, rs.lw);
    }
    if (rs.pose.eyes !== 'closed') {
      ctx.beginPath();
      circle(ctx, R * 0.38, -R * 0.25, R * 0.08);
      fl(rs, p.aLL);
      glow(rs, R * 0.38, -R * 0.25, R * 0.6, p.a, 0.6);
    }
    return;
  }
  // Mâchoire
  ctx.beginPath();
  ctx.moveTo(-R * 0.35, R * 0.45);
  ctx.quadraticCurveTo(-R * 0.25, R * 1.0, R * 0.35, R * 0.98);
  ctx.quadraticCurveTo(R * 0.85, R * 0.95, R * 0.9, R * 0.45);
  ctx.closePath();
  fo(rs, darken(bone, 0.12));
  // Crâne
  ctx.beginPath();
  ctx.moveTo(R * 0.95, R * 0.25);
  ctx.bezierCurveTo(R * 1.08, -R * 0.65, R * 0.5, -R * 1.02, -R * 0.08, -R * 1.0);
  ctx.bezierCurveTo(-R * 0.75, -R * 0.98, -R * 1.05, -R * 0.45, -R * 1.0, R * 0.12);
  ctx.bezierCurveTo(-R * 0.98, R * 0.5, -R * 0.6, R * 0.62, -R * 0.3, R * 0.62);
  ctx.lineTo(R * 0.85, R * 0.6);
  ctx.closePath();
  fo(rs, rad(rs, 'h:skull', R * 0.1, -R * 0.2, R * 1.25, [[0, lighten(bone, 0.5)], [0.6, bone], [1, boneD]], R * 0.3, -R * 0.5));
  // Orbites
  ctx.beginPath();
  ellipse(ctx, R * 0.05, R * 0.12, R * 0.24, R * 0.27, 0.1);
  ellipse(ctx, R * 0.62, R * 0.1, R * 0.19, R * 0.24, 0.1);
  fl(rs, '#150b1c');
  ctx.beginPath();
  poly(ctx, [R * 0.36, R * 0.38, R * 0.44, R * 0.52, R * 0.3, R * 0.52]);
  fl(rs, '#150b1c');
  if (detail(rs)) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.moveTo(-R * 0.1 + i * R * 0.2, R * 0.62);
      ctx.lineTo(-R * 0.08 + i * R * 0.2, R * 0.8);
    }
    st(rs, boneD, rs.lw * 0.9);
    ctx.beginPath();
    ctx.moveTo(-R * 0.5, -R * 0.75);
    ctx.lineTo(-R * 0.35, -R * 0.5);
    ctx.lineTo(-R * 0.45, -R * 0.3);
    st(rs, boneD, rs.lw * 0.8);
  }
  if (rs.pose.eyes === 'closed') return;
  if (rs.pose.eyes === 'dizzy') {
    eyes(rs, geom('hum', R), null);
    return;
  }
  ctx.beginPath();
  circle(ctx, R * 0.08, R * 0.14, R * 0.09);
  circle(ctx, R * 0.63, R * 0.12, R * 0.075);
  fl(rs, p.aLL);
  glow(rs, R * 0.35, R * 0.13, R * 0.9, p.a, 0.55);
}

/** Barde frontale (casque de bête). */
function chanfron(rs: RS, g: HG): void {
  const ctx = rs.ctx;
  const R = g.R;
  const p = rs.pal;
  ctx.beginPath();
  ctx.moveTo(-R * 0.5, -R * 0.9);
  ctx.bezierCurveTo(R * 0.3, -R * 1.12, R * 1.1, -R * 0.7, R * 1.38, -R * 0.25);
  ctx.lineTo(R * 1.15, -R * 0.05);
  ctx.bezierCurveTo(R * 0.8, -R * 0.38, R * 0.3, -R * 0.42, g.ex - R * 0.2, g.ey - R * 0.08);
  ctx.lineTo(-R * 0.35, -R * 0.2);
  ctx.closePath();
  fo(rs, lin(rs, 'h:chanf', 0, -R, 0, 0, p.pLL, p.p, p.pD));
  // Pointe frontale
  ctx.beginPath();
  poly(ctx, [R * 0.05, -R * 0.95, R * 0.25, -R * 1.65, R * 0.4, -R * 0.9]);
  fo(rs, p.steel);
  if (detail(rs)) {
    ctx.beginPath();
    circle(ctx, R * 0.6, -R * 0.62, R * 0.07);
    circle(ctx, R * 0.95, -R * 0.45, R * 0.06);
    fl(rs, p.trim);
  }
}

/** Drapé de tissu sur une tête de bête (capuche / voile). */
function cloth(rs: RS, g: HG, col: string, back: boolean): void {
  const ctx = rs.ctx;
  const R = g.R;
  const sw = rs.pose.sway * 0.08;
  ctx.beginPath();
  if (back) {
    taper(ctx, [-R * 0.3, -R * 0.7, -R * 1.1, -R * 0.2 + sw * R, -R * 1.35, R * 0.7 + sw * R * 2], [R * 0.5, R * 0.55, R * 0.4]);
    fo(rs, darken(col, 0.3));
  } else {
    ctx.moveTo(R * 0.55, -R * 0.65);
    ctx.bezierCurveTo(R * 0.2, -R * 1.2, -R * 0.75, -R * 1.15, -R * 1.0, -R * 0.35);
    ctx.lineTo(-R * 0.75, R * 0.1);
    ctx.quadraticCurveTo(-R * 0.3, -R * 0.45, R * 0.55, -R * 0.65);
    ctx.closePath();
    fo(rs, lin(rs, 'h:cloth' + col, 0, -R * 1.1, 0, R * 0.1, lighten(col, 0.25), col, darken(col, 0.25)));
    if (detail(rs, 0.5)) {
      ctx.beginPath();
      ctx.moveTo(R * 0.5, -R * 0.66);
      ctx.quadraticCurveTo(-R * 0.3, -R * 0.42, -R * 0.75, R * 0.08);
      st(rs, rs.pal.trim, rs.lw * 1.2);
    }
  }
}

/** Petite étoile tournoyante (étourdissement). */
export function stunStars(rs: RS, x: number, y: number, R: number): void {
  const ctx = rs.ctx;
  for (let i = 0; i < 3; i++) {
    const a = rs.time * 4 + (i * TAU) / 3;
    const px = x + Math.cos(a) * R * 1.0;
    const py = y + Math.sin(a) * R * 0.3;
    const s = R * (0.3 + 0.07 * Math.sin(a));
    ctx.beginPath();
    star(ctx, px, py, 5, s, s * 0.45, a);
    fo(rs, '#ffe680', true, 0.7);
    ctx.beginPath();
    sparkle(ctx, px + R * 0.3, py - R * 0.2, s * 0.4);
    fl(rs, 'rgba(255,255,255,0.8)');
  }
}

