/**
 * Armes et objets tenus. Repère : origine dans la main, l'arme pointe vers -y
 * (la rotation est appliquée par l'appelant). Les objets « upright » (orbe,
 * lanterne, encensoir, fiole, grimoire) sont dessinés sans rotation.
 */
import type { WeaponShape } from '../../core/defs';
import { INK, darken, lighten, mix, rgba } from './color';
import { TAU } from './math';
import { circle, ellipse, poly, roundRect, sparkle, star, taper } from './paths';
import type { RS } from './paint';
import { detail, fl, fo, glow, lin, rad, spec, st } from './paint';

export interface WOpts {
  glow: number;
  pull: number;
  lash: number;
  spin: number;
  muzzle: number;
  /** Arme tenue par une créature (montée / flottante) : pas de main. */
  creature?: boolean;
}

/** Ordonnée (repère arc) du point d'encoche selon la tension. */
export function bowNockY(pull: number): number {
  return 3 + pull * 13;
}

export function drawWeapon(rs: RS, w: WeaponShape, o: WOpts): void {
  switch (w) {
    case 'sword':
      return sword(rs, 1, o);
    case 'greatsword':
      return sword(rs, 1.55, o);
    case 'staff':
      return staff(rs, o);
    case 'bow':
      return bow(rs, o);
    case 'crossbow':
      return crossbow(rs, o);
    case 'daggers':
      return dagger(rs, o);
    case 'hammer':
      return hammer(rs, o);
    case 'shield':
      return shield(rs, o);
    case 'tome':
      rs.ctx.save();
      rs.ctx.translate(0, 7);
      tome(rs, o);
      rs.ctx.restore();
      return;
    case 'gun':
      return gun(rs, o);
    case 'cannon':
      return cannon(rs, o);
    case 'lance':
      return lance(rs, o, false);
    case 'harpoon':
      return lance(rs, o, true);
    case 'claws':
      return claws(rs, o);
    case 'orb':
      return orb(rs, o);
    case 'scythe':
      return scythe(rs, o);
    case 'fan':
      return fan(rs, o);
    case 'wrench':
      return wrench(rs, o);
    case 'censer':
      return censer(rs, o);
    case 'flask':
      return flask(rs, o);
    case 'banner':
      return banner(rs, o);
    case 'chakram':
      return chakram(rs, o);
    case 'lantern':
      return lantern(rs, o);
    case 'drill':
      return drill(rs, o);
    case 'whip':
      return whip(rs, o);
    case 'none':
    default:
      return;
  }
}

function tipGlow(rs: RS, x: number, y: number, r: number, g: number): void {
  if (g <= 0.02) return;
  glow(rs, x, y, r * (1 + g * 0.6), rs.pal.a, Math.min(1, g * 0.85));
  if (g > 0.3 && detail(rs, 0.4)) {
    const ctx = rs.ctx;
    ctx.beginPath();
    sparkle(ctx, x, y, r * 0.45 * g, 0.2);
    fl(rs, rgba('#ffffff', Math.min(1, g)));
  }
}

function grip(rs: RS, y0: number, y1: number, w: number): void {
  const ctx = rs.ctx;
  ctx.beginPath();
  roundRect(ctx, -w / 2, y0, w, y1 - y0, w * 0.4);
  fo(rs, rs.pal.leather);
  if (detail(rs, 0.7)) {
    ctx.beginPath();
    for (let y = y0 + 1.6; y < y1 - 0.5; y += 2) {
      ctx.moveTo(-w / 2, y);
      ctx.lineTo(w / 2, y - 1);
    }
    st(rs, rs.pal.leatherD, rs.lw * 0.6);
  }
}

function sword(rs: RS, k: number, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const bw = 2.4 * k * (k > 1 ? 1.25 : 1);
  const len = 33 * k;
  grip(rs, -1, 7 * k, 2.8 * k);
  ctx.beginPath();
  circle(ctx, 0, 8 * k, 2.1 * k);
  fo(rs, p.trim);
  // Lame
  ctx.beginPath();
  ctx.moveTo(-bw, -4 * k);
  ctx.lineTo(-bw * 0.92, -len + 5 * k);
  ctx.lineTo(0, -len);
  ctx.lineTo(bw * 0.92, -len + 5 * k);
  ctx.lineTo(bw, -4 * k);
  ctx.closePath();
  fo(rs, lin(rs, 'w:blade' + k, -bw, 0, bw, 0, p.steelL, p.steel, p.steelD));
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    ctx.moveTo(0, -5 * k);
    ctx.lineTo(0, -len + 6 * k);
    st(rs, rgba(p.a, 0.75), Math.max(rs.lw * 0.8, 0.9 * k));
    ctx.beginPath();
    ctx.moveTo(-bw * 0.6, -6 * k);
    ctx.lineTo(-bw * 0.55, -len + 7 * k);
    st(rs, 'rgba(255,255,255,0.7)', rs.lw * 0.7);
  }
  // Garde
  ctx.beginPath();
  ctx.moveTo(-7 * k, -2.2 * k);
  ctx.quadraticCurveTo(-8.5 * k, -5.5 * k, -6.2 * k, -6 * k);
  ctx.quadraticCurveTo(0, -3.6 * k, 6.2 * k, -6 * k);
  ctx.quadraticCurveTo(8.5 * k, -5.5 * k, 7 * k, -2.2 * k);
  ctx.quadraticCurveTo(0, -0.6 * k, -7 * k, -2.2 * k);
  ctx.closePath();
  fo(rs, lin(rs, 'w:guard' + k, 0, -6 * k, 0, 0, p.trimL, p.trim, p.trimD));
  if (k > 1 && detail(rs)) {
    ctx.beginPath();
    ellipse(ctx, 0, -3.6 * k, 1.4 * k, 1.4 * k);
    fo(rs, p.aL, true, 0.6);
  }
  tipGlow(rs, 0, -len + 4, 9 * k, o.glow);
}

function staff(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const wood = mix(p.leather, p.s, 0.35);
  ctx.beginPath();
  taper(ctx, [0, 14, 0.5, -20, 0, -54], [1.6, 1.5, 1.7]);
  fo(rs, lin(rs, 'w:staff', -2, 0, 2, 0, lighten(wood, 0.3), wood, darken(wood, 0.3)));
  if (detail(rs, 0.6)) {
    ctx.beginPath();
    roundRect(ctx, -2, -8, 4, 3, 1);
    roundRect(ctx, -2.1, -51, 4.2, 3, 1);
    fo(rs, p.trim, true, 0.7);
  }
  ctx.save();
  ctx.translate(0, -18);
  // Berceau doré
  ctx.beginPath();
  ctx.moveTo(-1.5, -34);
  ctx.quadraticCurveTo(-7.5, -38, -5, -47);
  ctx.quadraticCurveTo(-4.8, -40.5, -0.8, -38.5);
  ctx.moveTo(1.5, -34);
  ctx.quadraticCurveTo(7.5, -38, 5, -47);
  ctx.quadraticCurveTo(4.8, -40.5, 0.8, -38.5);
  fo(rs, p.trim, true, 0.8);
  // Cristal
  const cy = -42;
  glow(rs, 0, cy, 10 + o.glow * 8, p.a, 0.35 + o.glow * 0.6);
  ctx.beginPath();
  poly(ctx, [0, cy - 7.5, 3.6, cy - 1, 0, cy + 4.5, -3.6, cy - 1]);
  fo(rs, lin(rs, 'w:cryst', -3, cy - 6, 3, cy + 4, p.aLL, p.a, p.aD));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    poly(ctx, [0, cy - 7.5, 3.6, cy - 1, 0, cy - 0.5]);
    fl(rs, 'rgba(255,255,255,0.45)');
  }
  tipGlow(rs, 0, cy - 1, 11, o.glow);
  ctx.restore();
}

function bow(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const wood = mix(p.leather, p.p, 0.4);
  const ny = bowNockY(o.pull);
  const flex = o.pull * 1.6;
  // Corde
  ctx.beginPath();
  ctx.moveTo(-17.5 + flex * 0.6, 3);
  ctx.lineTo(0, ny);
  ctx.lineTo(17.5 - flex * 0.6, 3);
  st(rs, 'rgba(240,232,214,0.95)', Math.max(0.6, rs.lw * 0.55));
  // Corps de l'arc
  ctx.beginPath();
  taper(
    ctx,
    [-18 + flex * 0.6, 1.5, -15.5 + flex * 0.4, -3, -8, -5.5 - flex * 0.3, 0, -4.2, 8, -5.5 - flex * 0.3, 15.5 - flex * 0.4, -3, 18 - flex * 0.6, 1.5],
    [0.7, 1.1, 1.5, 2.0, 1.5, 1.1, 0.7],
  );
  fo(rs, lin(rs, 'w:bow', 0, -6, 0, 2, lighten(wood, 0.35), wood, darken(wood, 0.3)));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    roundRect(ctx, -2.2, -6.2, 4.4, 4.2, 1.2);
    fo(rs, p.trim, true, 0.6);
    ctx.beginPath();
    circle(ctx, -17.8 + flex * 0.6, 1.6, 1.1);
    circle(ctx, 17.8 - flex * 0.6, 1.6, 1.1);
    fl(rs, p.aL);
  }
  // Flèche encochée
  if (o.pull > 0.04) {
    const tipY = ny - 25;
    ctx.beginPath();
    ctx.moveTo(0, ny);
    ctx.lineTo(0, tipY + 3);
    st(rs, INK, 2.4);
    ctx.beginPath();
    ctx.moveTo(0, ny);
    ctx.lineTo(0, tipY + 3);
    st(rs, '#d9c3a0', 1.1);
    ctx.beginPath();
    poly(ctx, [0, tipY - 1.5, 1.9, tipY + 3.5, -1.9, tipY + 3.5]);
    fo(rs, p.steelL, true, 0.6);
    ctx.beginPath();
    poly(ctx, [0, ny - 1, 2.2, ny + 1.5, 0, ny - 4.5, -2.2, ny + 1.5]);
    fo(rs, p.a, true, 0.5);
    tipGlow(rs, 0, tipY, 7, o.pull * 0.6);
  }
}

function crossbow(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const wood = mix(p.leather, p.s, 0.3);
  ctx.beginPath();
  ctx.moveTo(-1.6, -19);
  ctx.lineTo(1.6, -19);
  ctx.lineTo(1.8, 3);
  ctx.lineTo(3.2, 9);
  ctx.lineTo(-2.4, 10);
  ctx.lineTo(-1.8, 3);
  ctx.closePath();
  fo(rs, lin(rs, 'w:xstock', -3, 0, 3, 0, lighten(wood, 0.3), wood, darken(wood, 0.3)));
  // Arc frontal
  ctx.beginPath();
  taper(ctx, [-12, -11.5, -7, -16.5, 0, -18, 7, -16.5, 12, -11.5], [0.7, 1.2, 1.6, 1.2, 0.7]);
  fo(rs, lin(rs, 'w:xprod', 0, -19, 0, -11, p.steelL, p.steelD));
  const loaded = o.muzzle <= 0.01;
  ctx.beginPath();
  ctx.moveTo(-12, -11.5);
  ctx.lineTo(0, loaded ? -5 : -14);
  ctx.lineTo(12, -11.5);
  st(rs, 'rgba(240,232,214,0.95)', Math.max(0.6, rs.lw * 0.55));
  if (loaded) {
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, -24);
    st(rs, INK, 2.6);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, -24);
    st(rs, '#d9c3a0', 1.2);
    ctx.beginPath();
    poly(ctx, [0, -27, 1.8, -23, -1.8, -23]);
    fo(rs, p.steelL, true, 0.6);
  }
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    roundRect(ctx, -2.2, -6, 4.4, 3, 1);
    fo(rs, p.trim, true, 0.6);
  }
}

function dagger(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  grip(rs, -0.5, 4.5, 2.4);
  ctx.beginPath();
  ctx.moveTo(-1.6, -2.5);
  ctx.quadraticCurveTo(-2.4, -9, -0.2, -16);
  ctx.quadraticCurveTo(1.6, -10, 1.6, -2.5);
  ctx.closePath();
  fo(rs, lin(rs, 'w:dag', -2, 0, 2, 0, p.steelL, p.steel, p.steelD));
  if (detail(rs, 0.6)) {
    ctx.beginPath();
    ctx.moveTo(-0.9, -3.5);
    ctx.quadraticCurveTo(-1.4, -9, -0.3, -13.5);
    st(rs, rgba(p.a, 0.8), rs.lw * 0.7);
  }
  ctx.beginPath();
  roundRect(ctx, -4, -3, 8, 2, 1);
  fo(rs, p.trim, true, 0.7);
  tipGlow(rs, 0, -14, 6, o.glow);
}

function hammer(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const wood = darken(mix(p.leather, p.s, 0.3), 0.1);
  ctx.beginPath();
  roundRect(ctx, -1.5, -26, 3, 32, 1.4);
  fo(rs, lin(rs, 'w:hshaft', -2, 0, 2, 0, lighten(wood, 0.3), wood, darken(wood, 0.3)));
  grip(rs, -1, 6, 3.2);
  // Tête
  ctx.beginPath();
  ctx.moveTo(-3.5, -27);
  ctx.lineTo(-11, -26);
  ctx.lineTo(-11.5, -36);
  ctx.lineTo(-3.5, -35);
  ctx.lineTo(3.5, -35);
  ctx.lineTo(9, -37.5);
  ctx.lineTo(9, -24.5);
  ctx.lineTo(3.5, -27);
  ctx.closePath();
  fo(rs, lin(rs, 'w:hhead', 0, -37, 0, -24, p.steelL, p.steel, p.steelD));
  ctx.beginPath();
  roundRect(ctx, -4, -37, 8, 12, 1.5);
  fo(rs, lin(rs, 'w:hband', -4, 0, 4, 0, p.trimL, p.trim, p.trimD));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    circle(ctx, 0, -31, 1.8);
    fo(rs, p.aL, true, 0.6);
    spec(rs, -8, -33, 2.2, 0.9, 0, 0.6);
  }
  tipGlow(rs, 0, -31, 12, o.glow);
}

function shield(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.save();
  ctx.scale(0.88, 1);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-11, -13);
    ctx.quadraticCurveTo(0, -16.5, 11, -13);
    ctx.lineTo(11, -2);
    ctx.quadraticCurveTo(10, 10, 0, 16);
    ctx.quadraticCurveTo(-10, 10, -11, -2);
    ctx.closePath();
  };
  path();
  fo(rs, lin(rs, 'w:shrim', 0, -16, 0, 16, p.trimL, p.trim, p.trimD), true, 1.2);
  ctx.save();
  ctx.translate(0, 0.4);
  ctx.scale(0.82, 0.84);
  path();
  fo(rs, rad(rs, 'w:shfield', 0, -2, 18, [[0, p.pL], [0.6, p.p], [1, p.pD]], -3, -8), false);
  ctx.restore();
  if (detail(rs, 0.4)) {
    // Emblème
    ctx.beginPath();
    star(ctx, 0, -1, 4, 7, 2.2);
    fo(rs, p.aL, true, 0.7);
    ctx.beginPath();
    circle(ctx, 0, -1, 2.4);
    fo(rs, p.trimL, true, 0.6);
    ctx.beginPath();
    ctx.moveTo(-7.5, -10.5);
    ctx.quadraticCurveTo(-1, -12.8, 4, -11.8);
    st(rs, 'rgba(255,255,255,0.5)', rs.lw);
  }
  ctx.restore();
  tipGlow(rs, 0, -1, 14, o.glow * 0.8);
}

function tome(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const fl0 = Math.sin(rs.time * 3) * 0.6 * (0.3 + o.glow);
  // Couverture
  ctx.beginPath();
  poly(ctx, [-12.5, -3.5, -11.5, -14.5, 0, -11.5, 11.5, -14.5, 12.5, -3.5, 0, -0.8]);
  fo(rs, lin(rs, 'w:tcover', 0, -15, 0, 0, p.pL, p.pD));
  // Pages
  ctx.beginPath();
  poly(ctx, [-11, -4.6, -10.2, -13.2 - fl0, 0, -10.4, 10.2, -13.2 + fl0, 11, -4.6, 0, -2.2]);
  fo(rs, lin(rs, 'w:tpage', 0, -13, 0, -2, '#fffaf0', '#e8dcc4'), true, 0.7);
  if (detail(rs, 0.55)) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = -10.5 + i * 2.4;
      ctx.moveTo(-8.6, y + 0.3);
      ctx.lineTo(-2, y + 1.2);
      ctx.moveTo(2, y + 1.2);
      ctx.lineTo(8.6, y + 0.3);
    }
    st(rs, rgba(p.aD, 0.55), rs.lw * 0.6);
    ctx.beginPath();
    ctx.moveTo(0, -10.4);
    ctx.lineTo(0, -2.2);
    st(rs, rgba(INK, 0.5), rs.lw * 0.6);
  }
  // Signet
  ctx.beginPath();
  taper(ctx, [2, -1.5, 2.6, 2.5, 2.2, 6], [0.9, 0.9, 0.7]);
  fo(rs, p.a, true, 0.6);
  // Runes flottantes
  const g = Math.max(0.25, o.glow);
  glow(rs, 0, -12, 12 + g * 8, p.a, 0.25 + g * 0.5);
  if (detail(rs, 0.45)) {
    for (let i = 0; i < 3; i++) {
      const a = rs.time * 1.4 + i * 2.1;
      const yy = -16 - ((rs.time * 6 + i * 5) % 10);
      const xx = Math.sin(a) * 6;
      ctx.beginPath();
      sparkle(ctx, xx, yy, 1.6 + g * 1.2);
      fl(rs, rgba(p.aLL, 0.9 - ((rs.time * 6 + i * 5) % 10) / 12));
    }
  }
}

function gun(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const wood = mix(p.leather, p.s, 0.3);
  // Crosse
  ctx.beginPath();
  ctx.moveTo(-1.6, -4);
  ctx.lineTo(1.8, -4);
  ctx.lineTo(2.2, 4);
  ctx.lineTo(4.2, 11);
  ctx.lineTo(-2.6, 11.5);
  ctx.lineTo(-1.8, 4);
  ctx.closePath();
  fo(rs, lin(rs, 'w:gstock', -3, 0, 4, 0, lighten(wood, 0.3), wood, darken(wood, 0.35)));
  // Canon
  ctx.beginPath();
  roundRect(ctx, -1.25, -34, 2.5, 31, 1);
  fo(rs, lin(rs, 'w:gbarrel', -1.3, 0, 1.3, 0, p.steelL, p.steelD));
  // Fût + mécanisme
  ctx.beginPath();
  roundRect(ctx, -1.9, -20, 3.4, 17, 1.4);
  fo(rs, wood);
  ctx.beginPath();
  roundRect(ctx, -2.4, -7.5, 4.8, 5, 1.2);
  fo(rs, lin(rs, 'w:glock', -2.4, 0, 2.4, 0, p.trimL, p.trimD), true, 0.8);
  if (detail(rs, 0.55)) {
    ctx.beginPath();
    roundRect(ctx, -1.6, -27, 3.2, 1.6, 0.6);
    roundRect(ctx, -1.6, -14, 3.2, 1.6, 0.6);
    roundRect(ctx, -1.7, -35, 3.4, 2.2, 0.6);
    fl(rs, p.trim);
    ctx.beginPath();
    circle(ctx, 0, -5, 0.9);
    fl(rs, p.aL);
  }
  muzzle(rs, 0, -36, o.muzzle, 1);
}

function cannon(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const iron = darken(mix(p.steel, p.p, 0.25), 0.35);
  // Poignée sous le canon
  ctx.beginPath();
  roundRect(ctx, -1.6, -2, 3.2, 7, 1.2);
  fo(rs, p.leather);
  // Fût
  ctx.beginPath();
  ctx.moveTo(-4.2, 9);
  ctx.lineTo(-3.7, -22);
  ctx.lineTo(-4.8, -26);
  ctx.lineTo(4.8, -26);
  ctx.lineTo(3.7, -22);
  ctx.lineTo(4.2, 9);
  ctx.closePath();
  fo(rs, lin(rs, 'w:cbody', -4.5, 0, 4.5, 0, lighten(iron, 0.45), iron, darken(iron, 0.35)));
  // Cerclages de laiton
  ctx.beginPath();
  roundRect(ctx, -4.9, -24.5, 9.8, 3, 1);
  roundRect(ctx, -4.6, -10, 9.2, 3, 1);
  roundRect(ctx, -4.8, 4, 9.6, 3, 1);
  fo(rs, lin(rs, 'w:cband', -4.8, 0, 4.8, 0, p.trimL, p.trim, p.trimD), true, 0.8);
  // Culasse
  ctx.beginPath();
  circle(ctx, 0, 10.5, 3);
  fo(rs, p.trim);
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    ellipse(ctx, 0, -25.5, 3.2, 1.2);
    fl(rs, '#0d0814');
    ctx.beginPath();
    circle(ctx, 0, -3, 1.3);
    fo(rs, p.aL, true, 0.5);
    glow(rs, 0, -3, 4, p.a, 0.5);
    spec(rs, -2.2, -16, 0.8, 5, 0, 0.45);
  }
  muzzle(rs, 0, -28, o.muzzle, 1.7);
}

function muzzle(rs: RS, x: number, y: number, m: number, k: number): void {
  if (m <= 0.01) return;
  const ctx = rs.ctx;
  glow(rs, x, y - 3 * k, 16 * k * (0.6 + m * 0.6), '#ffcf6a', m);
  ctx.beginPath();
  star(ctx, x, y - 4 * k * m, 7, 8 * k * (0.5 + m * 0.5), 3 * k, -Math.PI / 2 + m);
  fl(rs, rgba('#ffe9a8', m));
  ctx.beginPath();
  circle(ctx, x, y - 3 * k, 2.6 * k * m);
  fl(rs, rgba('#ffffff', m));
}

function lance(rs: RS, o: WOpts, harpoon: boolean): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const wood = harpoon ? mix(p.leather, p.s, 0.3) : p.p;
  const top = harpoon ? -48 : -60;
  const bot = harpoon ? 12 : 14;
  ctx.beginPath();
  roundRect(ctx, -1.15, top, 2.3, bot - top, 1);
  fo(rs, lin(rs, 'w:lshaft' + harpoon, -1.2, 0, 1.2, 0, lighten(wood, 0.35), wood, darken(wood, 0.3)));
  if (harpoon) {
    // corde enroulée
    if (detail(rs, 0.5)) {
      ctx.beginPath();
      ctx.moveTo(0, bot - 2);
      ctx.bezierCurveTo(6, bot + 2, 7, bot - 9, 2, bot - 8);
      ctx.bezierCurveTo(-3, bot - 7, -2, bot + 6, 5, bot + 6);
      st(rs, '#d9c3a0', 1.1);
    }
    ctx.beginPath();
    poly(ctx, [0, top - 11, 2.6, top - 3, 5.2, top + 1.5, 1.2, top - 0.5, 1.2, top + 1, -1.2, top + 1, -1.2, top - 0.5, -5.2, top + 1.5, -2.6, top - 3]);
    fo(rs, lin(rs, 'w:harp', -5, 0, 5, 0, p.steelL, p.steel, p.steelD));
    tipGlow(rs, 0, top - 8, 8, o.glow);
    return;
  }
  // Fanion
  const sw = Math.sin(rs.time * 4) * 1.5 + rs.pose.sway;
  ctx.beginPath();
  ctx.moveTo(-1, top + 3);
  ctx.quadraticCurveTo(-7, top + 3 + sw * 0.5, -13, top + 5 + sw);
  ctx.lineTo(-8.5, top + 7.5 + sw * 0.7);
  ctx.lineTo(-12.5, top + 10 + sw);
  ctx.quadraticCurveTo(-6, top + 10 + sw * 0.5, -1, top + 11);
  ctx.closePath();
  fo(rs, lin(rs, 'w:pennant', 0, top, -12, top + 10, p.aL, p.a), true, 0.8);
  // Rondelle
  ctx.beginPath();
  poly(ctx, [-4.2, 3.5, -1.3, -3.5, 1.3, -3.5, 4.2, 3.5]);
  fo(rs, lin(rs, 'w:vamp', -4, 0, 4, 0, p.trimL, p.trim, p.trimD));
  // Fer
  ctx.beginPath();
  ctx.moveTo(0, top - 13);
  ctx.quadraticCurveTo(3.4, top - 6, 2, top + 0.5);
  ctx.lineTo(-2, top + 0.5);
  ctx.quadraticCurveTo(-3.4, top - 6, 0, top - 13);
  ctx.closePath();
  fo(rs, lin(rs, 'w:lhead', -3, 0, 3, 0, p.steelL, p.steel, p.steelD));
  tipGlow(rs, 0, top - 9, 9, o.glow);
}

function claws(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    taper(ctx, [i * 2.2, -1.5, i * 2.6 + 1, -7, i * 2.2 + 3.5, -12.5 + Math.abs(i) * 1.5], [1.2, 0.9, 0.1]);
    fo(rs, lin(rs, 'w:claw', -3, 0, 3, 0, p.steelL, p.steel, p.steelD), true, 0.8);
  }
  if (detail(rs, 0.6)) {
    ctx.beginPath();
    roundRect(ctx, -3.8, -2.6, 7.6, 3.2, 1.2);
    fo(rs, p.trim, true, 0.7);
  }
  tipGlow(rs, 2, -10, 8, o.glow);
}

function orb(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const bob = Math.sin(rs.time * 2.6) * 1.2;
  const cy = -9 + bob;
  const r = 5.2;
  const g = 0.45 + o.glow * 0.7;
  glow(rs, 0, cy, 14 + o.glow * 10, p.a, Math.min(1, g));
  // Anneau arrière
  const tilt = 0.4;
  const ra = rs.time * 2;
  ctx.beginPath();
  ctx.ellipse(0, cy, 8.5, 2.4, tilt, Math.PI, TAU);
  st(rs, rgba(p.aLL, 0.8), 0.9);
  ctx.beginPath();
  circle(ctx, 0, cy, r);
  fo(rs, rad(rs, 'w:orb', 0, cy, r, [[0, '#ffffff'], [0.3, p.aLL], [0.75, p.a], [1, p.aD]], -1.8, cy - 2));
  if (detail(rs, 0.5)) spec(rs, -1.8, cy - 2.2, 1.6, 0.9, -0.6, 0.85);
  ctx.beginPath();
  ctx.ellipse(0, cy, 8.5, 2.4, tilt, 0, Math.PI);
  st(rs, rgba(p.aLL, 0.9), 0.9);
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    const px = Math.cos(ra) * 8.5;
    const py = Math.sin(ra) * 2.4;
    const qx = px * Math.cos(tilt) - py * Math.sin(tilt);
    const qy = px * Math.sin(tilt) + py * Math.cos(tilt);
    circle(ctx, qx, cy + qy, 1);
    fl(rs, '#ffffff');
  }
  tipGlow(rs, 0, cy, 10, o.glow);
}

function scythe(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const wood = darken(mix(p.leather, p.p, 0.35), 0.2);
  ctx.beginPath();
  taper(ctx, [0, 16, 0.8, -18, -0.5, -54], [1.3, 1.3, 1.4]);
  fo(rs, lin(rs, 'w:sshaft', -2, 0, 2, 0, lighten(wood, 0.3), wood, darken(wood, 0.3)));
  grip(rs, -2, 5, 2.8);
  ctx.save();
  ctx.translate(0, -14);
  // Lame
  ctx.beginPath();
  ctx.moveTo(-1.5, -41.5);
  ctx.bezierCurveTo(6, -48, 16, -46, 23, -34);
  ctx.bezierCurveTo(16, -40, 8, -40.5, -0.5, -36.5);
  ctx.closePath();
  fo(rs, lin(rs, 'w:sblade', 0, -47, 0, -36, p.steelL, p.steel, p.steelD));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    ctx.moveTo(1, -38.5);
    ctx.bezierCurveTo(8, -41.5, 15, -40.5, 21.5, -35);
    st(rs, rgba(p.aL, 0.9), rs.lw * 0.9);
    ctx.beginPath();
    roundRect(ctx, -2.3, -42.5, 4.6, 4.5, 1.2);
    fo(rs, p.trim, true, 0.7);
  }
  tipGlow(rs, 18, -39, 10, o.glow);
  ctx.restore();
}

function fan(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const a0 = -Math.PI / 2 - 1.05;
  const a1 = -Math.PI / 2 + 1.05;
  const R = 16;
  ctx.beginPath();
  ctx.moveTo(Math.cos(a0) * 5, Math.sin(a0) * 5);
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const am = a0 + ((a1 - a0) * (i - 0.5)) / n;
    if (i > 0) ctx.quadraticCurveTo(Math.cos(am) * (R + 1.6), Math.sin(am) * (R + 1.6), Math.cos(a) * R, Math.sin(a) * R);
    else ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
  }
  ctx.lineTo(Math.cos(a1) * 5, Math.sin(a1) * 5);
  ctx.arc(0, 0, 5, a1, a0, true);
  ctx.closePath();
  fo(rs, rad(rs, 'w:fan', 0, 0, R, [[0, p.sL], [0.5, p.p], [1, p.pD]]));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (R - 0.5), Math.sin(a) * (R - 0.5));
    }
    st(rs, p.trimD, rs.lw * 0.7);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.72, a0 + 0.1, a1 - 0.1);
    st(rs, p.a, rs.lw * 1.2);
  }
  ctx.beginPath();
  circle(ctx, 0, 0, 1.8);
  fo(rs, p.trim, true, 0.6);
  tipGlow(rs, 0, -R * 0.7, 10, o.glow);
}

function wrench(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.beginPath();
  roundRect(ctx, -1.9, -18, 3.8, 24, 1.6);
  fo(rs, lin(rs, 'w:wr', -2, 0, 2, 0, p.steelL, p.steel, p.steelD));
  grip(rs, 0, 6.5, 4.2);
  ctx.beginPath();
  ctx.moveTo(-2.5, -16);
  ctx.bezierCurveTo(-8.5, -18, -9, -27, -4.8, -30);
  ctx.lineTo(-2.5, -24.5);
  ctx.lineTo(2.5, -24.5);
  ctx.lineTo(4.8, -30);
  ctx.bezierCurveTo(9, -27, 8.5, -18, 2.5, -16);
  ctx.closePath();
  fo(rs, lin(rs, 'w:wrh', -8, 0, 8, 0, p.trimL, p.trim, p.trimD));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    circle(ctx, 0, -19.5, 1.6);
    fo(rs, p.aL, true, 0.5);
    ctx.beginPath();
    ctx.moveTo(-1, -8);
    ctx.lineTo(1, -8);
    ctx.moveTo(-1, -12);
    ctx.lineTo(1, -12);
    st(rs, p.steelD, rs.lw);
  }
  tipGlow(rs, 0, -24, 9, o.glow);
}

function censer(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const sw = Math.sin(rs.time * 2.2) * 0.35 + rs.pose.sway * 0.1;
  const L = 13;
  const cx = Math.sin(sw) * L;
  const cy = Math.cos(sw) * L;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(cx, cy - 3);
  st(rs, INK, 1.6);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(cx, cy - 3);
  st(rs, p.trimL, 0.7);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-sw * 0.5);
  ctx.beginPath();
  ctx.moveTo(-4.5, 0);
  ctx.quadraticCurveTo(-4.5, -4, 0, -4.5);
  ctx.quadraticCurveTo(4.5, -4, 4.5, 0);
  ctx.quadraticCurveTo(4, 5, 0, 5.5);
  ctx.quadraticCurveTo(-4, 5, -4.5, 0);
  ctx.closePath();
  fo(rs, lin(rs, 'w:cens', 0, -5, 0, 6, p.trimL, p.trim, p.trimD));
  ctx.beginPath();
  ellipse(ctx, -1.8, 0.6, 0.9, 1.2);
  ellipse(ctx, 1.8, 0.6, 0.9, 1.2);
  fl(rs, p.aLL);
  ctx.restore();
  glow(rs, cx, cy, 9 + o.glow * 8, p.a, 0.35 + o.glow * 0.5);
  // Fumée
  if (detail(rs, 0.45)) {
    for (let i = 0; i < 4; i++) {
      const k = ((rs.time * 0.5 + i * 0.25) % 1 + 1) % 1;
      const sx = cx + Math.sin(rs.time + i * 2) * 3 * k - k * 4;
      const sy = cy - 4 - k * 20;
      ctx.beginPath();
      circle(ctx, sx, sy, 1.6 + k * 3);
      fl(rs, rgba(mix('#d8d0e8', p.a, 0.3), 0.45 * (1 - k)));
    }
  }
  tipGlow(rs, cx, cy, 8, o.glow);
}

function flask(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const cy = -6.5;
  glow(rs, 0, cy, 9 + o.glow * 7, p.a, 0.3 + o.glow * 0.5);
  ctx.beginPath();
  ctx.moveTo(-1.6, -13);
  ctx.lineTo(-1.6, -10.2);
  ctx.arc(0, cy, 5.2, -Math.PI / 2 - 0.32, Math.PI * 1.5 + 0.32, true);
  ctx.lineTo(1.6, -13);
  ctx.closePath();
  fo(rs, 'rgba(225,240,255,0.55)');
  // Liquide
  ctx.save();
  ctx.beginPath();
  circle(ctx, 0, cy, 4.4);
  ctx.clip();
  const lv = cy - 0.8 + Math.sin(rs.time * 3) * 0.5;
  ctx.beginPath();
  ctx.rect(-6, lv, 12, 12);
  fl(rs, lin(rs, 'w:liq', 0, lv, 0, cy + 5, p.aL, p.a, p.aD));
  ctx.restore();
  if (detail(rs, 0.5)) {
    spec(rs, -2, cy - 2, 1.3, 0.8, -0.6, 0.85);
    const k = (rs.time * 1.2) % 1;
    ctx.beginPath();
    circle(ctx, 1.2, cy + 2 - k * 4, 0.7);
    fl(rs, 'rgba(255,255,255,0.7)');
  }
  ctx.beginPath();
  roundRect(ctx, -2, -15.5, 4, 3, 1);
  fo(rs, p.leather, true, 0.7);
  tipGlow(rs, 0, cy, 7, o.glow);
}

function banner(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const wood = darken(mix(p.leather, p.s, 0.3), 0.15);
  ctx.beginPath();
  roundRect(ctx, -1.1, -84, 2.2, 96, 1);
  fo(rs, lin(rs, 'w:bpole', -1.2, 0, 1.2, 0, lighten(wood, 0.35), wood, darken(wood, 0.3)));
  ctx.save();
  ctx.translate(0, -24);
  // Traverse + drapeau flottant vers l'arrière
  ctx.beginPath();
  roundRect(ctx, -18, -57.5, 19, 2, 1);
  fo(rs, p.trim, true, 0.7);
  const t = rs.time * 3;
  const sw = rs.pose.sway * 1.2;
  const wv = (y: number) => Math.sin(t + y * 0.18) * 1.6 + sw * ((y + 56) / 24);
  ctx.beginPath();
  ctx.moveTo(-1.5, -55.5);
  ctx.lineTo(-17, -55.5);
  ctx.lineTo(-17 + wv(-44), -44);
  ctx.lineTo(-17 + wv(-32), -31);
  ctx.lineTo(-9.5 + wv(-36), -36);
  ctx.lineTo(-1.5 + wv(-31), -31);
  ctx.lineTo(-1.5 + wv(-44) * 0.3, -44);
  ctx.closePath();
  fo(rs, lin(rs, 'w:flag', 0, -56, 0, -31, p.pL, p.p, p.pD));
  if (detail(rs, 0.4)) {
    ctx.beginPath();
    ctx.moveTo(-15.5, -53.5);
    ctx.lineTo(-15.3 + wv(-44), -44);
    ctx.lineTo(-15.5 + wv(-34), -34.5);
    st(rs, p.trim, rs.lw * 1.1);
    ctx.beginPath();
    circle(ctx, -9 + wv(-46) * 0.8, -46, 3.6);
    fo(rs, p.aL, true, 0.6);
    ctx.beginPath();
    star(ctx, -9 + wv(-46) * 0.8, -46, 6, 2.4, 1.1);
    fl(rs, p.trimL);
  }
  // Pointe
  ctx.beginPath();
  poly(ctx, [0, -67, 2.4, -61, 0, -59, -2.4, -61]);
  fo(rs, p.trimL, true, 0.8);
  tipGlow(rs, 0, -63, 9, o.glow);
  ctx.restore();
}

function chakram(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const cy = -7;
  ctx.save();
  ctx.translate(0, cy);
  ctx.rotate(o.spin);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6;
    const b = a + 0.5;
    ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7);
    ctx.lineTo(Math.cos(b) * 11.5, Math.sin(b) * 11.5);
    ctx.lineTo(Math.cos(a + 0.9) * 7, Math.sin(a + 0.9) * 7);
    ctx.closePath();
  }
  fo(rs, p.steel, true, 0.8);
  ctx.beginPath();
  circle(ctx, 0, 0, 8.5);
  ctx.moveTo(5.2, 0);
  ctx.arc(0, 0, 5.2, 0, TAU, true);
  fo(rs, lin(rs, 'w:chak', 0, -8.5, 0, 8.5, p.trimL, p.trim, p.trimD));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    ctx.arc(0, 0, 6.8, 0, TAU);
    st(rs, rgba(p.aL, 0.85), rs.lw * 0.9);
  }
  ctx.restore();
  tipGlow(rs, 0, cy, 12, o.glow);
}

function lantern(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const sw = Math.sin(rs.time * 2) * 0.12;
  ctx.save();
  ctx.rotate(sw);
  const g = 0.55 + o.glow * 0.6;
  glow(rs, 0, 11, 18 + o.glow * 12, p.a, Math.min(1, g));
  ctx.beginPath();
  ctx.moveTo(0, -1);
  ctx.lineTo(0, 3);
  st(rs, INK, 1.6);
  ctx.beginPath();
  ctx.arc(0, 2.5, 2.2, Math.PI, 0);
  st(rs, p.trimD, 1);
  // Verre lumineux
  ctx.beginPath();
  roundRect(ctx, -4, 5, 8, 11, 2);
  fo(rs, rad(rs, 'w:lant', 0, 10.5, 7, [[0, '#ffffff'], [0.35, p.aLL], [1, p.a]]));
  // Armature
  ctx.beginPath();
  poly(ctx, [-5, 6, -3, 3, 3, 3, 5, 6]);
  poly(ctx, [-5, 15, 5, 15, 3.5, 18, -3.5, 18]);
  fo(rs, lin(rs, 'w:lframe', 0, 3, 0, 18, p.trimL, p.trimD), true, 0.8);
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 15);
    st(rs, p.trimD, rs.lw * 0.8);
  }
  ctx.restore();
}

function drill(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.beginPath();
  roundRect(ctx, -4.6, -6, 9.2, 8, 2);
  fo(rs, lin(rs, 'w:dbase', -4.6, 0, 4.6, 0, p.trimL, p.trim, p.trimD));
  ctx.beginPath();
  poly(ctx, [-4.2, -6, 4.2, -6, 0, -22]);
  fo(rs, lin(rs, 'w:dcone', -4, 0, 4, 0, p.steelL, p.steel, p.steelD));
  if (detail(rs, 0.4)) {
    ctx.save();
    ctx.beginPath();
    poly(ctx, [-4.2, -6, 4.2, -6, 0, -22]);
    ctx.clip();
    ctx.beginPath();
    const off = (o.spin * 3) % 4;
    for (let i = -1; i < 5; i++) {
      const y = -6 - i * 4 - off;
      ctx.moveTo(-5, y);
      ctx.lineTo(5, y - 3);
    }
    st(rs, rgba(p.steelD, 0.9), rs.lw * 1.1);
    ctx.restore();
    ctx.beginPath();
    circle(ctx, 0, -2, 1.4);
    fo(rs, p.aL, true, 0.5);
  }
  if (o.spin > 0.5 && rs.pose.anim === 'attack' && rs.pose.t > 0.3 && rs.pose.t < 0.6) {
    for (let i = 0; i < 4; i++) {
      const a = o.spin * 2 + i * 1.7;
      ctx.beginPath();
      sparkle(ctx, Math.cos(a) * 5, -22 - Math.abs(Math.sin(a)) * 4, 1.5);
      fl(rs, '#ffe08a');
    }
  }
  tipGlow(rs, 0, -20, 8, o.glow);
}

function whip(rs: RS, o: WOpts): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const L = o.lash;
  const t = rs.time * 3;
  // Repos : lanière enroulée qui pend ; déployé : tendu vers -y
  const pts: number[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const rx = 4 * Math.sin(u * 2.4) + Math.sin(t + u * 3) * 0.6;
    const ry = -5 + u * 26;
    const ex = Math.sin(u * 6 + t * 2) * 2.2 * (1 - u * 0.4) * (1 - L * 0.6);
    const ey = -5 - u * 42;
    pts.push(rx + (ex - rx) * L, ry + (ey - ry) * L);
  }
  ctx.beginPath();
  taper(ctx, pts, [1.9, 1.7, 1.5, 1.3, 1.1, 0.85, 0.5]);
  fo(rs, lin(rs, 'w:whip', 0, -40, 0, 20, p.sL, p.s, p.sD), true, 0.7);
  grip(rs, -6, 4, 2.6);
  if (L > 0.85) {
    const ex = pts[pts.length - 2];
    const ey = pts[pts.length - 1];
    glow(rs, ex, ey, 9, p.a, (L - 0.85) * 6);
    ctx.beginPath();
    star(ctx, ex, ey, 5, 3.5, 1.2);
    fl(rs, rgba('#ffffff', (L - 0.85) * 6));
  }
}

/** Barde de flanc (bouclier sur une créature). */
export function barding(rs: RS, x: number, y: number, s: number): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-14, -8);
  ctx.quadraticCurveTo(0, -12, 14, -8);
  ctx.quadraticCurveTo(15, 4, 0, 9);
  ctx.quadraticCurveTo(-15, 4, -14, -8);
  ctx.closePath();
  fo(rs, lin(rs, 'w:bard', 0, -12, 0, 9, p.trimL, p.trim, p.trimD));
  ctx.beginPath();
  ctx.moveTo(-11, -6);
  ctx.quadraticCurveTo(0, -9, 11, -6);
  ctx.quadraticCurveTo(11.5, 2.5, 0, 6.5);
  ctx.quadraticCurveTo(-11.5, 2.5, -11, -6);
  ctx.closePath();
  fo(rs, p.p, false);
  ctx.beginPath();
  star(ctx, 0, -1, 4, 5, 1.6);
  fo(rs, p.aL, true, 0.6);
  ctx.restore();
}

