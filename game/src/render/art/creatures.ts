/**
 * Créatures : quadrupède (bête à quatre pattes) et oiseau (créature ailée).
 * Les armes « sans sens » sont intégrées (montées sur le dos, en lévitation,
 * corne frontale, griffes renforcées) ou ignorées proprement (voir creatureMount).
 */
import { INK, darken, lighten, mix, rgba } from './color';
import { PI } from './math';
import { circle, ellipse, limb, poly, roundRect, taper } from './paths';
import type { RS } from './paint';
import { detail, fl, fo, glow, lin, rad, st } from './paint';
import { drawHead, stunStars } from './heads';
import { drawExtras, featherWing } from './extras';
import { barding, drawWeapon } from './weapons';

// ---------------------------------------------------------------------------
// Quadrupède

function qLeg(rs: RS, jx: number, front: boolean, near: boolean, phase: number): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const ps = rs.pose;
  let fx = jx + (front ? 1.5 : -1);
  let lift = 0;
  if (ps.walk > 0) {
    fx += 5 * Math.sin(phase);
    lift = Math.max(0, Math.cos(phase)) * 3.2;
  }
  if (ps.tuck > 0) {
    fx += (front ? 5 : -5) * ps.tuck;
    lift += ps.tuck * 7;
  }
  const col = near ? p.p : p.pD;
  const colD = near ? p.pD : p.pDD;
  const fy = -3 - lift;
  ctx.beginPath();
  if (front) {
    const kx = (jx + fx) / 2 + 1.2;
    const ky = -15 - lift * 0.5;
    limb(ctx, jx, -30, kx, ky, 5, 3.6);
    limb(ctx, kx, ky, fx, fy, 3.6, 3.1);
  } else {
    const hx = jx - 4;
    const hy = -12 - lift * 0.5;
    limb(ctx, jx + 1, -31, hx, hy, 7, 3.3);
    limb(ctx, hx, hy, fx, fy, 3.1, 2.9);
  }
  fo(rs, rs.sil ? col : lin(rs, 'q:leg' + (near ? 'n' : 'f') + (front ? 'a' : 'b'), jx - 6, 0, jx + 6, 0, lighten(col, 0.12), col, colD));
  // Patte
  ctx.beginPath();
  ellipse(ctx, fx + 1.6, fy + 1.4, 4, 2.4);
  fo(rs, colD);
  if (detail(rs, 0.55)) {
    const big = rs.mount === 'claws';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const tx = fx + 2.6 + i * 1.3;
      ctx.moveTo(tx, fy + 2.2);
      ctx.lineTo(tx + (big ? 2.4 : 1.1), fy + (big ? 3.8 : 3.2));
    }
    st(rs, big ? rs.pal.steelL : '#efe6d6', big ? 1.6 : 1);
  }
}

function quadTail(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const big = rs.ex.has('tail');
  const sw = Math.sin(rs.time * 2.6) * 2.4 + rs.pose.sway * 1.2 + (rs.pose.walk > 0 ? Math.sin(rs.pose.phase) * 2 : 0);
  const k = big ? 1.45 : 1;
  const pts = [-23, -36, -31 * k + 6, -39, -36 * k + 8 + sw * 0.6, -46 * k + 10, -34 * k + 7 + sw * 1.4, -54 * k + 12];
  const w = big ? [3.4, 5.2, 5.6, 2.2] : [2.6, 2.8, 2.4, 1.2];
  ctx.beginPath();
  taper(ctx, pts, w);
  fo(rs, lin(rs, 'q:tail', -40, 0, -22, 0, p.pD, p.p, p.pL));
  ctx.beginPath();
  taper(ctx, pts.slice(4), [w[2] * 0.95, w[3]]);
  fo(rs, p.sL, true, 0.7);
}

function quadBody(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const b = rs.pose.breath * 0.6;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(21, -43);
    ctx.bezierCurveTo(9, -47 - b * 0.5, -12, -46, -22, -42);
    ctx.bezierCurveTo(-31, -38, -31, -24, -22, -21);
    ctx.bezierCurveTo(-10, -17 + b * 0.3, 8, -17 + b * 0.3, 18, -20);
    ctx.bezierCurveTo(27, -23, 29, -36, 21, -43);
    ctx.closePath();
  };
  path();
  fo(rs, rad(rs, 'q:body', 0, -40, 34, [[0, p.pL], [0.55, p.p], [1, p.pD]], 4, -46));
  if (detail(rs, 0.4)) {
    ctx.save();
    path();
    ctx.clip();
    ctx.beginPath();
    ellipse(ctx, 2, -19.5, 18, 4.6);
    fl(rs, rgba(p.sL, 0.85));
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = -12 + i * 7;
      ctx.moveTo(x, -46);
      ctx.quadraticCurveTo(x + 3.5, -39, x + 1, -33);
    }
    st(rs, rgba(p.pDD, 0.5), rs.lw * 1.6);
    ctx.restore();
  }
}

function quadNeck(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const r = rs.rig;
  ctx.beginPath();
  limb(ctx, 14, -36, r.headX - 5, r.headY + 6, 8, 6.5);
  fo(rs, rs.sil ? p.p : lin(rs, 'q:neck', 0, r.headY, 0, -30, p.pL, p.p));
  // Collier aux couleurs de la faction
  ctx.beginPath();
  ctx.moveTo(14, -45.5);
  ctx.quadraticCurveTo(19.5, -42, 21.5, -33.5);
  st(rs, INK, 3.6 + rs.lw);
  ctx.beginPath();
  ctx.moveTo(14, -45.5);
  ctx.quadraticCurveTo(19.5, -42, 21.5, -33.5);
  st(rs, p.a, 3.4);
  ctx.beginPath();
  circle(ctx, 20.5, -37, 1.8);
  fo(rs, p.trimL, true, 0.6);
}

function hornWeapon(rs: RS, R: number): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const w = rs.look.weapon;
  ctx.save();
  ctx.translate(R * 0.35, -R * 0.82);
  ctx.rotate(0.62);
  if (w === 'drill') {
    ctx.scale(0.7, 0.7);
    drawWeapon(rs, 'drill', { glow: rs.pose.wGlow, pull: 0, lash: 0, spin: rs.pose.spin, muzzle: 0, creature: true });
  } else {
    const L = w === 'lance' ? R * 1.5 : R * 1.15;
    ctx.beginPath();
    poly(ctx, [-R * 0.18, 0, 0, -L, R * 0.18, 0]);
    fo(rs, lin(rs, 'q:horn', -R * 0.2, 0, R * 0.2, 0, p.steelL, p.steel, p.steelD));
    if (w === 'harpoon') {
      ctx.beginPath();
      poly(ctx, [-R * 0.1, -L * 0.6, -R * 0.32, -L * 0.45, -R * 0.08, -L * 0.48]);
      poly(ctx, [R * 0.1, -L * 0.6, R * 0.32, -L * 0.45, R * 0.08, -L * 0.48]);
      fo(rs, p.steel, true, 0.6);
    }
    ctx.beginPath();
    roundRect(ctx, -R * 0.22, -R * 0.12, R * 0.44, R * 0.22, R * 0.08);
    fo(rs, p.trim, true, 0.7);
  }
  ctx.restore();
}

function floatingItem(rs: RS, x: number, y: number, s: number): void {
  const ctx = rs.ctx;
  const w = rs.look.weapon;
  const bob = Math.sin(rs.time * 2) * 1.6;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(s, s);
  if (w === 'staff') {
    ctx.rotate(0.35);
    ctx.scale(0.7, 0.7);
    ctx.translate(0, 20);
  }
  if (w === 'chakram') ctx.translate(0, 6);
  if (w === 'censer' || w === 'lantern') ctx.translate(0, -8);
  glow(rs, 0, -6, 14, rs.pal.a, 0.25);
  drawWeapon(rs, w, { glow: rs.pose.wGlow, pull: 0, lash: 0, spin: rs.time * 2, muzzle: 0, creature: true });
  ctx.restore();
}

function mounted(rs: RS, x: number, y: number, s: number): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const w = rs.look.weapon;
  if (w === 'shield') {
    barding(rs, x + 2, y + 13, 0.85);
    return;
  }
  // Selle
  ctx.beginPath();
  ctx.moveTo(x - 9, y + 3);
  ctx.quadraticCurveTo(x, y - 2, x + 9, y + 3);
  ctx.lineTo(x + 8, y + 6);
  ctx.quadraticCurveTo(x, y + 4, x - 8, y + 6);
  ctx.closePath();
  fo(rs, p.leather);
  if (w === 'banner') {
    ctx.save();
    ctx.translate(x - 6, y + 2);
    ctx.scale(s * 0.85, s * 0.85);
    drawWeapon(rs, 'banner', { glow: rs.pose.wGlow, pull: 0, lash: 0, spin: 0, muzzle: 0, creature: true });
    ctx.restore();
    return;
  }
  // Tourelle
  ctx.beginPath();
  roundRect(ctx, x - 3.5, y - 4, 7, 5, 1.5);
  fo(rs, p.trimD);
  ctx.save();
  ctx.translate(x, y - 4);
  ctx.rotate(PI / 2 + rs.pose.wr * 0.6 - 0.15);
  ctx.scale(s, s);
  drawWeapon(rs, w, { glow: rs.pose.wGlow, pull: 0, lash: 0, spin: 0, muzzle: rs.pose.muzzle, creature: true });
  ctx.restore();
}

export function drawQuad(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const ps = rs.pose;
  const ph = ps.phase;
  // Recentre la bête (tête à droite) au-dessus de son socle.
  ctx.save();
  ctx.translate(-6, 0);
  drawExtras(rs, 'back');
  quadTail(rs);
  // Pattes lointaines
  qLeg(rs, 18, true, false, ph + PI);
  qLeg(rs, -13, false, false, ph);
  quadBody(rs);
  drawExtras(rs, 'body');
  if (rs.mount === 'mount') mounted(rs, -3, -48, 0.8);
  // Pattes proches
  qLeg(rs, 13, true, true, ph);
  qLeg(rs, -18, false, true, ph + PI);
  quadNeck(rs);
  // Tête
  ctx.save();
  ctx.translate(r.headX, r.headY + ps.headDy * 0.6);
  ctx.rotate(ps.headTilt);
  drawHead(rs, r.headR, 'quad');
  if (rs.mount === 'horn') hornWeapon(rs, r.headR);
  if (ps.stun > 0) stunStars(rs, 0, -r.headR * 1.25, r.headR);
  ctx.restore();
  rs.headAt.x = r.headX;
  rs.headAt.y = r.headY;
  rs.headAt.r = r.headR;
  // Coups de griffes
  if (ps.trail > 0.02) clawMarks(rs, r.headX + 14, r.headY + 14, ps.trail);
  if (rs.mount === 'float') floatingItem(rs, -4, -62, 0.85);
  drawExtras(rs, 'front');
  ctx.restore();
  rs.headAt.x -= 6;
}

function clawMarks(rs: RS, x: number, y: number, a: number): void {
  if (rs.sil) return;
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    taper(ctx, [x - 6 + i * 4, y - 12, x - 1 + i * 4, y - 3, x + 1 + i * 4, y + 7], [0.3, 1.6, 0.2]);
    ctx.fillStyle = rgba(mix('#ffffff', p.a, 0.4), a * 0.85);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Oiseau

function birdLeg(rs: RS, x: number, near: boolean): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const col = darken(mix('#e7a948', p.a, 0.35), near ? 0.1 : 0.35);
  const ps = rs.pose;
  const lift = ps.tuck * 6;
  const fx = x + 1 + ps.tuck * 2;
  ctx.beginPath();
  limb(ctx, x, -18, fx, -2.5 - lift, 1.9, 1.4);
  fo(rs, col, true, 0.8);
  const big = rs.mount === 'claws';
  ctx.beginPath();
  const fy = -1 - lift;
  ctx.moveTo(fx - 3, fy);
  ctx.lineTo(fx + (big ? 6 : 4.5), fy + 0.4);
  ctx.moveTo(fx, fy - 1);
  ctx.lineTo(fx + (big ? 5 : 3.6), fy - 2.6);
  ctx.moveTo(fx, fy - 0.5);
  ctx.lineTo(fx - 3.6, fy + 0.4);
  st(rs, INK, 2.8 + rs.lw * 0.5);
  ctx.beginPath();
  ctx.moveTo(fx - 3, fy);
  ctx.lineTo(fx + (big ? 6 : 4.5), fy + 0.4);
  ctx.moveTo(fx, fy - 1);
  ctx.lineTo(fx + (big ? 5 : 3.6), fy - 2.6);
  ctx.moveTo(fx, fy - 0.5);
  ctx.lineTo(fx - 3.6, fy + 0.4);
  st(rs, big ? p.steelL : col, 1.6);
}

function birdTail(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const sw = Math.sin(rs.time * 2.2) * 0.06 + rs.pose.sway * 0.04;
  ctx.save();
  ctx.translate(-9, -21);
  ctx.rotate(sw);
  const feathers: [number, number, string][] = [
    [-0.15, 17, p.pD],
    [0.15, 19, p.a],
    [0.45, 16, p.pD],
  ];
  for (const [a, L, c] of feathers) {
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    taper(ctx, [0, 0, -L * 0.55, 2, -L, 3.5], [2.2, 3.2, 1.2]);
    fo(rs, c, true, 0.8);
    ctx.restore();
  }
  ctx.restore();
}

function birdBody(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.save();
  ctx.translate(0, -33);
  ctx.rotate(0.12);
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.bezierCurveTo(11, -18, 15, -7, 14, 4);
  ctx.bezierCurveTo(13, 13, 6, 17, -1, 17);
  ctx.bezierCurveTo(-9, 17, -15, 11, -14.5, 1);
  ctx.bezierCurveTo(-14, -10, -9, -18, 0, -18);
  ctx.closePath();
  fo(rs, rad(rs, 'q:bbody', 2, -6, 22, [[0, p.pL], [0.6, p.p], [1, p.pD]], 4, -12));
  // Plastron clair écaillé
  ctx.beginPath();
  ctx.moveTo(3, -12);
  ctx.bezierCurveTo(12, -10, 13, 4, 9, 11);
  ctx.bezierCurveTo(5, 15, 0, 14, -1, 9);
  ctx.bezierCurveTo(-2, 0, -1, -9, 3, -12);
  ctx.closePath();
  fo(rs, lin(rs, 'q:bchest', 0, -12, 0, 14, lighten(p.s, 0.45), p.sL, p.s), true, 0.7);
  if (detail(rs, 0.55)) {
    ctx.beginPath();
    for (let row = 0; row < 4; row++) {
      const y = -7 + row * 5;
      for (let i = 0; i < 2; i++) {
        const x = 3 + i * 4 + (row % 2) * 2;
        ctx.moveTo(x - 2, y);
        ctx.quadraticCurveTo(x, y + 2, x + 2, y);
      }
    }
    st(rs, rgba(p.sD, 0.7), rs.lw * 0.8);
  }
  ctx.restore();
}

export function drawBird(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const ps = rs.pose;
  const p = rs.pal;
  const big = rs.ex.has('wings');
  const wcol = p.pL;
  const wtip = p.a;
  const ws = big ? 30 : 24;
  const rest = big ? -0.75 : -1.35;
  const ang = rest - ps.flap * 1.0;
  drawExtras(rs, 'back');
  birdTail(rs);
  // Aile lointaine
  featherWing(rs, 4, -46, ws * 0.92, ang + 0.18, true, wcol, wtip);
  birdLeg(rs, 4, false);
  birdLeg(rs, -3, true);
  ctx.save();
  ctx.translate(0, r.hipY);
  ctx.rotate(ps.lean);
  ctx.translate(0, -r.hipY);
  birdBody(rs);
  drawExtras(rs, 'body');
  // Crête
  if (rs.look.head === 'bare' || rs.look.head === 'beast' || rs.look.head === 'ponytail') {
    const R = r.headR;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      taper(ctx, [r.headX - R * 0.3, r.headY - R * 0.7, r.headX - R * (0.9 + i * 0.25), r.headY - R * (1.3 - i * 0.25) + Math.sin(rs.time * 3 + i) * 0.8], [R * 0.16, R * 0.04]);
      fo(rs, i === 1 ? p.aL : p.a, true, 0.7);
    }
  }
  ctx.save();
  ctx.translate(r.headX, r.headY + ps.headDy * 0.5);
  ctx.rotate(ps.headTilt + ps.lean * 0.5);
  drawHead(rs, r.headR, 'bird');
  if (ps.stun > 0) stunStars(rs, 0, -r.headR * 1.25, r.headR);
  ctx.restore();
  rs.headAt.x = r.headX;
  rs.headAt.y = r.headY;
  rs.headAt.r = r.headR;
  // Aile proche (devant le corps)
  featherWing(rs, 1, -45, ws, ang, false, wcol, wtip);
  if (rs.mount === 'mount') mounted(rs, -8, -47, 0.62);
  ctx.restore();
  if (ps.trail > 0.02) clawMarks(rs, 20, -28, ps.trail);
  if (rs.mount === 'float') floatingItem(rs, -18, -66, 0.8);
  drawExtras(rs, 'front');
}
