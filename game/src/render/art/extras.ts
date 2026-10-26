/**
 * Accessoires (Extra) : cape, ailes, queue, aura, épaulières, engrenages, feuilles,
 * bulles, braises, étoiles, écharpe, sac, chaînes, cristaux, lune, soleil.
 * Trois couches : 'back' (derrière le corps), 'body' (sur le torse, sous la tête)
 * et 'front' (devant tout). Les positions s'appuient sur des ancrages (Anchors)
 * calculés pour chaque famille de corps.
 */
import { INK, darken, lighten, mix, rgba } from './color';
import { TAU, hashStr } from './math';
import { circle, crescent, ellipse, gear, poly, sparkle, taper } from './paths';
import type { RS } from './paint';
import { detail, fl, fo, glow, lin, rad, st } from './paint';
import { pauldron } from './bodies';

export interface Anchors {
  back: readonly [number, number];
  neck: readonly [number, number];
  hip: readonly [number, number];
  center: readonly [number, number];
  head: readonly [number, number, number];
  width: number;
  /** Hauteur de l'ourlet de cape. */
  hem: number;
}

export function anchors(rs: RS): Anchors {
  const r = rs.rig;
  if (r.kind === 'quad') {
    return { back: [-4, -44], neck: [18, -41], hip: [-25, -35], center: [-2, -31], head: [r.headX, r.headY, r.headR], width: 26, hem: -22 };
  }
  if (r.kind === 'bird') {
    return { back: [-6, -47], neck: [4, -49], hip: [-10, -22], center: [0, -34], head: [r.headX, r.headY, r.headR], width: 16, hem: -12 };
  }
  return {
    back: [-r.topW + 3, r.shoulderY + 4],
    neck: [1, r.shoulderY - 1],
    hip: [-r.botW + 2, r.hipY + 1],
    center: [0, (r.shoulderY + r.hipY) / 2],
    head: [r.headX, r.headY, r.headR],
    width: r.topW,
    hem: r.body === 'small' ? -3 : r.body === 'giant' ? -10 : r.body === 'floating' ? r.hipY + 8 : -5,
  };
}

export function drawExtras(rs: RS, layer: 'back' | 'body' | 'front'): void {
  const ex = rs.ex;
  if (ex.size === 0) return;
  const A = anchors(rs);
  if (layer === 'back') {
    if (ex.has('aura')) aura(rs, A);
    if (ex.has('sun')) sun(rs, A);
    if (ex.has('moon')) moon(rs, A);
    if (ex.has('wings') && rs.rig.kind !== 'bird') wings(rs, A);
    if (ex.has('gears')) gears(rs, A);
    if (ex.has('crystals')) crystals(rs, A, true);
    if (ex.has('cape') && rs.rig.kind === 'humanoid') cape(rs, A);
    if (ex.has('scarf')) scarfTails(rs, A);
    if (ex.has('backpack') && rs.rig.kind === 'humanoid') backpack(rs, A);
    if (ex.has('tail') && rs.rig.kind !== 'quad') tail(rs, A);
    particles(rs, A, false);
  } else if (layer === 'body') {
    if (rs.rig.kind === 'quad') {
      if (ex.has('cape')) caparison(rs);
      if (ex.has('backpack')) saddlebags(rs);
      if (ex.has('pauldrons')) quadPlates(rs);
    }
    if (ex.has('chains')) chains(rs, A);
    if (ex.has('scarf')) scarfWrap(rs, A);
    if (ex.has('leaves')) leafMantle(rs, A);
    if (ex.has('backpack') && rs.rig.kind === 'humanoid') strap(rs);
    if (ex.has('pauldrons') && rs.rig.kind === 'humanoid') pauldron(rs, false);
    if (ex.has('crystals') && rs.rig.kind !== 'humanoid') crystals(rs, A, false);
  } else {
    if (ex.has('pauldrons') && rs.rig.kind === 'humanoid') pauldron(rs, true);
    particles(rs, A, true);
  }
}

// ---------------------------------------------------------------------------

function aura(rs: RS, A: Anchors): void {
  const p = rs.pal;
  const k = 0.32 + 0.1 * Math.sin(rs.time * 2.2);
  glow(rs, A.center[0], A.center[1] - 6, A.width * 2.6, p.a, k, A.width * 3.3);
  glow(rs, A.center[0], A.center[1] - 4, A.width * 1.4, p.aL, k * 0.5, A.width * 2);
}

function sun(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const [hx, hy, R] = A.head;
  // Disque solaire flottant derrière l'épaule, distinct de la tête.
  const cx = hx - R * 1.05;
  const cy = hy - R * 0.55 + Math.sin(rs.time * 1.2) * R * 0.05;
  const r0 = R * 0.5;
  const gold = mix('#ffd45e', p.a, 0.25);
  glow(rs, cx, cy, R * 1.6, gold, 0.5);
  ctx.beginPath();
  const n = 10;
  const rot = rs.time * 0.3;
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    const r1 = r0 * (i % 2 === 0 ? 1.75 : 1.45);
    ctx.moveTo(cx + Math.cos(a - 0.2) * r0 * 0.95, cy + Math.sin(a - 0.2) * r0 * 0.95);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a + 0.2) * r0 * 0.95, cy + Math.sin(a + 0.2) * r0 * 0.95);
    ctx.closePath();
  }
  fo(rs, lin(rs, 'x:sunray', 0, cy - r0 * 1.8, 0, cy + r0 * 1.8, lighten(gold, 0.5), gold), true, 0.7);
  ctx.beginPath();
  circle(ctx, cx, cy, r0);
  fo(rs, rad(rs, 'x:sun', cx, cy, r0, [[0, '#fffbe6'], [0.6, lighten(gold, 0.3)], [1, gold]]), true, 0.8);
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    circle(ctx, cx, cy, r0 * 0.62);
    st(rs, rgba(darken(gold, 0.2), 0.7), rs.lw * 0.9);
  }
}

function moon(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const [hx, hy, R] = A.head;
  const cx = hx - R * 1.05;
  const cy = hy - R * 0.85 + Math.sin(rs.time * 1.3) * R * 0.06;
  const col = mix('#e3ecff', p.a, 0.2);
  glow(rs, cx, cy, R * 1.5, col, 0.45);
  ctx.beginPath();
  crescent(ctx, cx, cy, R * 0.62, R * 0.32, -R * 0.18, R * 0.52);
  fo(rs, lin(rs, 'x:moon', cx - R * 0.6, cy - R * 0.6, cx + R * 0.4, cy + R * 0.6, '#ffffff', col, darken(col, 0.25)), true, 0.8);
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    sparkle(ctx, cx + R * 0.55, cy - R * 0.55, R * 0.2);
    fl(rs, '#ffffff');
  }
}

export function featherWing(rs: RS, x: number, y: number, s: number, ang: number, far: boolean, col: string, tipCol: string): void {
  const ctx = rs.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const c = far ? darken(col, 0.3) : col;
  const tc = far ? darken(tipCol, 0.3) : tipCol;
  // Grandes rémiges (bande de couleur accent)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-0.25 * s, -0.7 * s, -0.85 * s, -1.05 * s, -1.3 * s, -0.98 * s);
  ctx.quadraticCurveTo(-1.08 * s, -0.78 * s, -1.22 * s, -0.62 * s);
  ctx.quadraticCurveTo(-1.0 * s, -0.48 * s, -1.08 * s, -0.3 * s);
  ctx.quadraticCurveTo(-0.85 * s, -0.22 * s, -0.86 * s, -0.04 * s);
  ctx.quadraticCurveTo(-0.62 * s, -0.04 * s, -0.56 * s, 0.14 * s);
  ctx.quadraticCurveTo(-0.3 * s, 0.05 * s, 0, 0.12 * s);
  ctx.closePath();
  fo(rs, rs.sil ? tc : lin(rs, 'x:wtip' + (far ? 'f' : 'n'), -1.3 * s, 0, 0, 0, tc, lighten(tc, 0.3)));
  // Couvertures
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-0.22 * s, -0.62 * s, -0.7 * s, -0.92 * s, -1.05 * s, -0.86 * s);
  ctx.quadraticCurveTo(-0.85 * s, -0.68 * s, -0.92 * s, -0.5 * s);
  ctx.quadraticCurveTo(-0.7 * s, -0.42 * s, -0.72 * s, -0.24 * s);
  ctx.quadraticCurveTo(-0.5 * s, -0.2 * s, -0.42 * s, -0.04 * s);
  ctx.quadraticCurveTo(-0.2 * s, -0.06 * s, 0, 0.06 * s);
  ctx.closePath();
  fo(rs, rs.sil ? c : lin(rs, 'x:wcov' + (far ? 'f' : 'n'), 0, -s, 0, 0, lighten(c, 0.35), c, darken(c, 0.15)));
  if (!far && detail(rs, 0.5)) {
    ctx.beginPath();
    ctx.moveTo(-0.15 * s, -0.25 * s);
    ctx.quadraticCurveTo(-0.45 * s, -0.55 * s, -0.8 * s, -0.66 * s);
    ctx.moveTo(-0.12 * s, -0.08 * s);
    ctx.quadraticCurveTo(-0.35 * s, -0.28 * s, -0.6 * s, -0.36 * s);
    st(rs, rgba(darken(c, 0.4), 0.55), rs.lw * 0.8);
  }
  ctx.restore();
}

function wings(rs: RS, A: Anchors): void {
  const p = rs.pal;
  const col = lighten(mix(p.s, '#ffffff', 0.25), 0.15);
  const tip = p.a;
  const f = rs.pose.flap;
  const base = 0.15;
  if (rs.rig.kind === 'quad') {
    const s = 30;
    featherWing(rs, 6, -42, s, base - 0.25 - f * 0.6, true, col, tip);
    featherWing(rs, 2, -41, s * 1.05, base - 0.05 - f * 0.7, false, col, tip);
    return;
  }
  const s = rs.rig.body === 'giant' ? 38 : rs.rig.body === 'small' ? 22 : 28;
  const [bx, by] = A.back;
  featherWing(rs, bx + 6, by - 2, s * 0.92, base + 0.12 - f * 0.6, true, col, tip);
  featherWing(rs, bx + 2, by, s, base - 0.08 - f * 0.75, false, col, tip);
}

function cape(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const r = rs.rig;
  const top = r.shoulderY - 1;
  const hem = A.hem;
  const left = -r.topW + 1;
  const right = r.topW * 0.4;
  const sw = rs.pose.sway;
  const wave = Math.sin(rs.time * 3.1) * 1.2;
  const trail = sw * 3.5 + (rs.pose.walk > 0 ? 3 : 0);
  ctx.beginPath();
  ctx.moveTo(left + 2, top);
  ctx.quadraticCurveTo(left - 6 - trail * 0.6, (top + hem) / 2, left - 8 - trail, hem + wave);
  ctx.quadraticCurveTo(left - 2 - trail * 0.5, hem + 2.5, left + 4 - trail * 0.3, hem + 0.5 - wave * 0.5);
  ctx.quadraticCurveTo(right * 0.5, hem + 2.5, right + 2, hem);
  ctx.quadraticCurveTo(right + 3, (top + hem) / 2, right, top);
  ctx.closePath();
  fo(rs, lin(rs, 'x:cape', left - 8, 0, right, 0, p.sD, p.s, p.sL));
  if (detail(rs, 0.45)) {
    // Doublure visible sur le bord arrière + ourlet doré
    ctx.beginPath();
    ctx.moveTo(left + 1, top + 3);
    ctx.quadraticCurveTo(left - 5 - trail * 0.6, (top + hem) / 2, left - 7 - trail, hem + wave - 0.5);
    st(rs, p.pD, rs.lw * 2.2);
    ctx.beginPath();
    ctx.moveTo(left - 7.5 - trail, hem + wave - 0.8);
    ctx.quadraticCurveTo(left - 2 - trail * 0.5, hem + 1.6, left + 4 - trail * 0.3, hem - 0.4 - wave * 0.5);
    ctx.quadraticCurveTo(right * 0.5, hem + 1.6, right + 1.5, hem - 0.8);
    st(rs, p.trim, rs.lw * 1.4);
    ctx.beginPath();
    ctx.moveTo(left + 1, top + 8);
    ctx.quadraticCurveTo(left - 2 - trail * 0.3, (top + hem) / 2 + 4, left - 3 - trail * 0.6, hem - 2);
    st(rs, rgba(p.sDD, 0.5), rs.lw);
  }
}

function caparison(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const sw = Math.sin(rs.time * 2.5) * 0.8;
  ctx.beginPath();
  ctx.moveTo(-18, -43);
  ctx.quadraticCurveTo(-2, -48, 12, -43);
  ctx.lineTo(13 + sw * 0.4, -26);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x0 = 13 - (31 * (i + 0.5)) / n;
    const x1 = 13 - (31 * (i + 1)) / n;
    ctx.quadraticCurveTo(x0 + sw * 0.4, -22, x1 + sw * 0.3, -26);
  }
  ctx.closePath();
  fo(rs, lin(rs, 'x:capar', 0, -46, 0, -22, p.sL, p.s, p.sD));
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    ctx.moveTo(12.5, -27);
    for (let i = 0; i < n; i++) {
      const x0 = 13 - (31 * (i + 0.5)) / n;
      const x1 = 13 - (31 * (i + 1)) / n;
      ctx.quadraticCurveTo(x0 + sw * 0.4, -23.5, x1 + sw * 0.3, -27);
    }
    st(rs, p.trim, rs.lw * 1.4);
    ctx.beginPath();
    circle(ctx, -3, -36, 3.4);
    fo(rs, p.aL, true, 0.7);
  }
}

function backpack(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const [bx, by] = A.back;
  const x = bx - 9;
  const y = by - 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 10, y - 1);
  ctx.quadraticCurveTo(x + 12, y + 8, x + 10, y + 17);
  ctx.lineTo(x + 1, y + 17);
  ctx.quadraticCurveTo(x - 2.5, y + 8, x, y);
  ctx.closePath();
  fo(rs, lin(rs, 'x:pack', x - 2, 0, x + 12, 0, p.leatherD, p.leather, lighten(p.leather, 0.2)));
  // Rouleau de couchage
  ctx.beginPath();
  ellipse(ctx, x + 4.5, y - 2.5, 7.5, 3.4);
  fo(rs, lin(rs, 'x:roll', 0, y - 6, 0, y + 1, p.sL, p.s, p.sD));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 5.5);
    ctx.lineTo(x + 1, y + 0.6);
    ctx.moveTo(x + 8, y - 5.5);
    ctx.lineTo(x + 8, y + 0.6);
    st(rs, p.leatherD, rs.lw * 1.2);
    ctx.beginPath();
    ctx.moveTo(x - 0.5, y + 6);
    ctx.lineTo(x + 10.5, y + 5.5);
    st(rs, p.leatherD, rs.lw * 1.2);
    ctx.beginPath();
    circle(ctx, x + 5, y + 6, 1.2);
    fl(rs, p.trim);
    // Lanterne accrochée
    ctx.beginPath();
    circle(ctx, x - 1, y + 13, 1.8);
    fo(rs, p.aL, true, 0.6);
    glow(rs, x - 1, y + 13, 6, p.a, 0.4);
  }
}

function strap(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  ctx.beginPath();
  ctx.moveTo(-r.topW + 3, r.shoulderY - 1);
  ctx.lineTo(r.botW - 1, r.hipY - 3);
  st(rs, INK, 3.4 + rs.lw);
  ctx.beginPath();
  ctx.moveTo(-r.topW + 3, r.shoulderY - 1);
  ctx.lineTo(r.botW - 1, r.hipY - 3);
  st(rs, rs.pal.leather, 3.2);
}

function saddlebags(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.beginPath();
  ctx.moveTo(-14, -38);
  ctx.lineTo(-3, -38);
  ctx.quadraticCurveTo(-2, -30, -4, -26);
  ctx.lineTo(-13, -26);
  ctx.quadraticCurveTo(-15.5, -31, -14, -38);
  ctx.closePath();
  fo(rs, lin(rs, 'x:sbag', 0, -38, 0, -26, lighten(p.leather, 0.2), p.leather, p.leatherD));
  ctx.beginPath();
  ellipse(ctx, -8, -44, 8, 3);
  fo(rs, p.s);
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    circle(ctx, -8.5, -32, 1.2);
    fl(rs, p.trim);
  }
}

function quadPlates(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.beginPath();
  ctx.moveTo(8, -43);
  ctx.quadraticCurveTo(18, -46, 24, -38);
  ctx.quadraticCurveTo(22, -31, 16, -30);
  ctx.quadraticCurveTo(10, -33, 8, -43);
  ctx.closePath();
  fo(rs, lin(rs, 'x:qplate', 0, -46, 0, -30, p.pLL, p.p, p.pD));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    ctx.moveTo(10, -41);
    ctx.quadraticCurveTo(18, -43, 22.5, -37.5);
    st(rs, p.trim, rs.lw * 1.4);
  }
}

function tail(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const [hx, hy] = A.hip;
  const sw = Math.sin(rs.time * 2.4) * 2.2 + rs.pose.sway * 1.5;
  const big = rs.rig.body === 'giant' ? 1.5 : rs.rig.body === 'small' ? 0.75 : 1;
  const pts = [hx, hy, hx - 9 * big, hy + 2, hx - 16 * big + sw * 0.5, hy - 4 * big, hx - 18 * big + sw, hy - 14 * big, hx - 14 * big + sw * 1.3, hy - 21 * big];
  ctx.beginPath();
  taper(ctx, pts, [2.6 * big, 3.4 * big, 3.6 * big, 3 * big, 1.2 * big]);
  fo(rs, lin(rs, 'x:tail' + rs.rig.body, hx - 18, 0, hx, 0, p.pL, p.p, p.pD));
  ctx.beginPath();
  taper(ctx, pts.slice(6), [3 * big, 1.2 * big]);
  fo(rs, p.sL, true, 0.7);
}

function gears(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const [bx, by] = A.back;
  const big = rs.rig.kind === 'quad' ? 1.1 : 1;
  const g1x = bx - 3;
  const g1y = by + 3;
  const g2x = bx + 3;
  const g2y = by - 9;
  const one = (x: number, y: number, ro: number, n: number, rot: number, key: string) => {
    ctx.beginPath();
    gear(ctx, x, y, n, ro, ro * 0.78, rot);
    ctx.moveTo(x + ro * 0.32, y);
    ctx.arc(x, y, ro * 0.32, 0, TAU, true);
    fo(rs, lin(rs, key, x - ro, y - ro, x + ro, y + ro, p.trimL, p.trim, p.trimD), true, 0.8);
    if (detail(rs, 0.55)) {
      ctx.beginPath();
      ctx.arc(x, y, ro * 0.58, 0, TAU);
      st(rs, rgba(p.trimD, 0.8), rs.lw * 0.9);
    }
  };
  one(g1x, g1y, 9 * big, 10, rs.time * 0.8, 'x:gear1');
  one(g2x, g2y, 5.5 * big, 8, -rs.time * 1.45 + 0.2, 'x:gear2');
}

function crystal(rs: RS, x: number, y: number, s: number, rot: number, key: string): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  poly(ctx, [0, -s, s * 0.32, -s * 0.55, s * 0.3, s * 0.2, 0, s * 0.42, -s * 0.3, s * 0.2, -s * 0.32, -s * 0.55]);
  fo(rs, lin(rs, key, -s * 0.3, -s, s * 0.3, s * 0.4, p.aLL, p.a, p.aD), true, 0.8);
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    poly(ctx, [0, -s, s * 0.32, -s * 0.55, s * 0.3, s * 0.2, 0, s * 0.1]);
    fl(rs, 'rgba(255,255,255,0.35)');
  }
  ctx.restore();
}

function crystals(rs: RS, A: Anchors, back: boolean): void {
  const [bx, by] = A.back;
  const bob = Math.sin(rs.time * 1.8) * 0.8;
  if (rs.rig.kind === 'humanoid') {
    if (!back) return;
    glow(rs, bx - 2, by - 6, 16, rs.pal.a, 0.35);
    crystal(rs, bx - 3, by - 7 + bob, 9, -0.55, 'x:cr1');
    crystal(rs, bx - 7, by + 3 + bob * 0.6, 7, -1.0, 'x:cr2');
    crystal(rs, bx + 3, by - 11 + bob * 0.4, 6, -0.15, 'x:cr3');
    return;
  }
  // Créatures : cristaux le long du dos
  glow(rs, bx, by - 4, 18, rs.pal.a, 0.35);
  crystal(rs, bx - 8, by - 2, 7, -0.5, 'x:cq1');
  crystal(rs, bx + 1, by - 5, 9, -0.2, 'x:cq2');
  crystal(rs, bx + 9, by - 2, 6.5, 0.25, 'x:cq3');
}

function scarfTails(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const [nx, ny] = A.neck;
  const sw = rs.pose.sway * 3 + (rs.pose.walk > 0 ? 4 : 0);
  const t = rs.time * 4;
  for (let i = 0; i < 2; i++) {
    const o = i * 3.5;
    ctx.beginPath();
    taper(
      ctx,
      [nx - 5, ny + 2 + o * 0.3, nx - 12 - sw * 0.5, ny + 4 + o + Math.sin(t + i) * 1.5, nx - 19 - sw, ny + 3 + o * 1.4 + Math.sin(t + 1 + i) * 2.4, nx - 25 - sw * 1.4, ny + 6 + o * 1.6 + Math.sin(t + 2 + i) * 3],
      [2.4, 2.6, 2.4, 1.6],
    );
    fo(rs, i === 0 ? p.s : p.sD);
  }
}

function scarfWrap(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const [nx, ny] = A.neck;
  const w = rs.rig.kind === 'humanoid' ? A.width * 0.82 : 8;
  ctx.beginPath();
  ctx.moveTo(nx - w, ny - 1);
  ctx.quadraticCurveTo(nx, ny - 3.5, nx + w, ny - 1.5);
  ctx.quadraticCurveTo(nx + w + 1.5, ny + 2.5, nx + w - 1, ny + 4);
  ctx.quadraticCurveTo(nx, ny + 6, nx - w + 1, ny + 3.5);
  ctx.quadraticCurveTo(nx - w - 1.5, ny + 1.5, nx - w, ny - 1);
  ctx.closePath();
  fo(rs, lin(rs, 'x:scarf', 0, ny - 4, 0, ny + 6, p.sL, p.s, p.sD));
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    ctx.moveTo(nx - w + 2, ny + 1);
    ctx.quadraticCurveTo(nx, ny - 1, nx + w - 2, ny + 0.5);
    st(rs, rgba(p.sDD, 0.6), rs.lw * 0.9);
    ctx.beginPath();
    ctx.moveTo(nx - w + 2, ny + 2.5);
    ctx.quadraticCurveTo(nx, ny + 0.6, nx + w - 2, ny + 2);
    st(rs, p.a, rs.lw * 1.1);
  }
}

function chains(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const r = rs.rig;
  let x0: number, y0: number, x1: number, y1: number;
  if (r.kind === 'humanoid') {
    x0 = -r.topW + 2;
    y0 = r.shoulderY + 1;
    x1 = r.botW;
    y1 = r.hipY - 3;
  } else {
    x0 = A.neck[0] - 6;
    y0 = A.neck[1] - 2;
    x1 = A.neck[0] + 4;
    y1 = A.neck[1] + 8;
  }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * u;
    const y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 2.5;
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    if (i % 2 === 0) ellipse(ctx, x, y, 2.4, 1.4, a);
    else ellipse(ctx, x, y, 2.4, 0.8, a);
    ctx.moveTo(x + 1, y);
    st(rs, INK, 1.8 + rs.lw);
    ctx.beginPath();
    if (i % 2 === 0) ellipse(ctx, x, y, 2.4, 1.4, a);
    else ellipse(ctx, x, y, 2.4, 0.8, a);
    st(rs, i % 2 === 0 ? p.steelL : p.steel, 1.5);
  }
  if (r.kind === 'humanoid' && detail(rs, 0.5)) {
    // Maillon pendant
    const sw = Math.sin(rs.time * 2.2) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1 + 1 + sw * 0.4, y1 + 5, x1 + sw, y1 + 9);
    st(rs, INK, 2.2 + rs.lw);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(x1 + 1 + sw * 0.4, y1 + 5, x1 + sw, y1 + 9);
    st(rs, p.steel, 1.4);
    ctx.beginPath();
    circle(ctx, x1 + sw, y1 + 10.5, 2);
    st(rs, p.steelL, 1.4);
  }
}

function leafMantle(rs: RS, A: Anchors): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const green = mix('#6fbf5a', p.a, 0.25);
  const [nx, ny] = A.neck;
  const w = rs.rig.kind === 'humanoid' ? A.width : 9;
  const spots: [number, number, number][] = [
    [-w + 1, ny + 2, -2.2],
    [-w * 0.45, ny - 0.5, -1.7],
    [0, ny - 1.5, -1.4],
    [w * 0.5, ny - 0.5, -1.1],
    [w - 1, ny + 2, -0.7],
  ];
  for (let i = 0; i < spots.length; i++) {
    const [x, y, a] = spots[i];
    ctx.save();
    ctx.translate(nx + x, y);
    ctx.rotate(a + Math.sin(rs.time * 2 + i) * 0.08);
    leafShape(rs, 6, i % 2 === 0 ? green : darken(green, 0.2));
    ctx.restore();
  }
}

function leafShape(rs: RS, s: number, col: string): void {
  const ctx = rs.ctx;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(s * 0.45, -s * 0.45, s, 0);
  ctx.quadraticCurveTo(s * 0.45, s * 0.45, 0, 0);
  ctx.closePath();
  fo(rs, col, true, 0.7);
  if (detail(rs, 0.6)) {
    ctx.beginPath();
    ctx.moveTo(s * 0.1, 0);
    ctx.lineTo(s * 0.85, 0);
    st(rs, rgba(darken(col, 0.4), 0.8), rs.lw * 0.6);
  }
}

// ---------------------------------------------------------------------------
// Particules (braises, bulles, étoiles, feuilles)

function frac(x: number): number {
  return x - Math.floor(x);
}

function particles(rs: RS, A: Anchors, front: boolean): void {
  const ex = rs.ex;
  if (rs.sil) return;
  const ctx = rs.ctx;
  const p = rs.pal;
  const t = rs.time;
  const [cx, cy] = A.center;
  const W = A.width;
  const seed = p.seed;
  if (ex.has('embers')) {
    const ember = mix('#ff9a3c', p.a, 0.3);
    for (let i = 0; i < 7; i++) {
      if ((i % 2 === 0) !== front) continue;
      const h = (hashStr('e' + i + seed) % 1000) / 1000;
      const u = frac(t * 0.5 + i / 7 + h);
      const x = cx + (h * 2 - 1) * W * 1.2 + Math.sin(t * 2.3 + i) * 2.5;
      const y = cy + 16 - u * 70;
      const a = Math.sin(u * Math.PI);
      const s = 1.1 + (1 - u) * 1.1;
      glow(rs, x, y, s * 4, ember, a * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, y - s * 1.6);
      ctx.lineTo(x + s * 0.7, y);
      ctx.lineTo(x, y + s * 0.8);
      ctx.lineTo(x - s * 0.7, y);
      ctx.closePath();
      fl(rs, rgba(lighten(ember, 0.5), a));
    }
  }
  if (ex.has('bubbles')) {
    for (let i = 0; i < 6; i++) {
      if ((i % 2 === 0) !== front) continue;
      const h = (hashStr('b' + i + seed) % 1000) / 1000;
      const u = frac(t * 0.32 + i / 6 + h);
      const x = cx + (h * 2 - 1) * W * 1.3 + Math.sin(t * 1.6 + i * 2) * 3;
      const y = cy + 14 - u * 62;
      const r = 1.1 + u * 1.8;
      const a = Math.min(1, u * 5) * (1 - u);
      ctx.beginPath();
      circle(ctx, x, y, r);
      fl(rs, rgba(p.aL, 0.18 * a));
      st(rs, rgba(p.aLL, 0.85 * a), 0.8);
      ctx.beginPath();
      circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.28);
      fl(rs, rgba('#ffffff', 0.9 * a));
    }
  }
  if (ex.has('stars')) {
    for (let i = 0; i < 5; i++) {
      const a = t * 0.8 + (i * TAU) / 5;
      const depth = Math.sin(a);
      if (depth > 0 !== front) continue;
      const x = cx + Math.cos(a) * W * 1.7;
      const y = cy - 8 + depth * W * 0.32 + Math.sin(a * 2 + i) * 4;
      const tw = 0.6 + 0.4 * Math.sin(t * 5 + i * 1.7);
      const s = (front ? 2.6 : 1.9) * tw;
      glow(rs, x, y, s * 3.5, p.a, 0.5 * tw);
      ctx.beginPath();
      sparkle(ctx, x, y, s, 0.18);
      fl(rs, '#ffffff');
    }
  }
  if (ex.has('leaves')) {
    const green = mix('#7ccf5e', p.a, 0.25);
    for (let i = 0; i < 4; i++) {
      const a = t * 0.6 + (i * TAU) / 4;
      const depth = Math.sin(a);
      if (depth > 0 !== front) continue;
      const u = frac(t * 0.18 + i / 4);
      const x = cx + Math.cos(a) * W * 1.55;
      const y = cy - 26 + u * 46 + depth * 3;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 1.6 + i);
      ctx.globalAlpha *= Math.min(1, Math.sin(u * Math.PI) * 2);
      leafShape(rs, 5, i % 2 ? green : darken(green, 0.15));
      ctx.restore();
    }
  }
  if (ex.has('aura') && front) {
    for (let i = 0; i < 3; i++) {
      const u = frac(t * 0.4 + i / 3);
      const x = cx + Math.sin(i * 2.4 + t) * W;
      const y = cy + 12 - u * 50;
      ctx.beginPath();
      circle(ctx, x, y, 0.9);
      fl(rs, rgba(p.aLL, Math.sin(u * Math.PI)));
    }
  }
}
