/**
 * Corps humanoïdes : jambes (ou robe, queue de serpent, volute spectrale),
 * torse, bras et mains. Repère local de la figurine (pieds en 0,0, regard vers +x).
 */
import { INK, darken, lighten, rgba } from './color';
import { PI, clamp, lerp } from './math';
import { circle, ellipse, limb, roundRect, taper } from './paths';
import type { RS } from './paint';
import { detail, fl, fo, glow, lin, rad, spec, st } from './paint';

// ---------------------------------------------------------------------------
// Couleurs par type de corps

interface BodyCols {
  pants: string;
  pantsF: string;
  boot: string;
  bootF: string;
  sleeve: string;
  sleeveF: string;
}

function cols(rs: RS): BodyCols {
  const p = rs.pal;
  switch (rs.rig.body) {
    case 'knight':
      return { pants: p.s, pantsF: p.sD, boot: p.steel, bootF: p.steelD, sleeve: p.pL, sleeveF: p.pD };
    case 'heavy':
      return { pants: p.sD, pantsF: p.sDD, boot: p.leatherD, bootF: darken(p.leatherD, 0.3), sleeve: p.p, sleeveF: p.pD };
    case 'construct':
      return { pants: p.trimD, pantsF: darken(p.trimD, 0.3), boot: p.trim, bootF: p.trimD, sleeve: p.trim, sleeveF: p.trimD };
    case 'beast':
      return { pants: p.p, pantsF: p.pD, boot: p.pD, bootF: p.pDD, sleeve: p.p, sleeveF: p.pD };
    case 'giant':
      return { pants: p.sD, pantsF: p.sDD, boot: p.leather, bootF: p.leatherD, sleeve: p.skin, sleeveF: p.skinD };
    case 'slim':
      return { pants: p.sD, pantsF: p.sDD, boot: p.leather, bootF: p.leatherD, sleeve: p.s, sleeveF: p.sD };
    case 'small':
      return { pants: p.sD, pantsF: p.sDD, boot: p.leather, bootF: p.leatherD, sleeve: p.p, sleeveF: p.pD };
    case 'serpent':
      return { pants: p.s, pantsF: p.sD, boot: p.s, bootF: p.sD, sleeve: p.skin, sleeveF: p.skinD };
    case 'floating':
      return { pants: p.p, pantsF: p.pD, boot: p.p, bootF: p.pD, sleeve: p.p, sleeveF: p.pD };
    case 'robe':
    default:
      return { pants: p.pD, pantsF: p.pDD, boot: p.leatherD, bootF: darken(p.leatherD, 0.3), sleeve: p.p, sleeveF: p.pD };
  }
}

// ---------------------------------------------------------------------------
// Jambes

export function drawLegs(rs: RS): void {
  switch (rs.rig.legs) {
    case 'robe':
      return robeSkirt(rs);
    case 'tail':
      return serpentTail(rs);
    case 'none':
      return wisp(rs);
    case 'digi':
      leg(rs, false, true);
      leg(rs, true, true);
      return;
    default:
      leg(rs, false, false);
      leg(rs, true, false);
  }
}

function footPos(rs: RS, near: boolean): { x: number; lift: number } {
  const r = rs.rig;
  const p = rs.pose;
  const base = near ? r.footN : r.footF;
  const ph = p.phase + (near ? 0 : PI);
  let x = base;
  let lift = 0;
  if (p.walk > 0) {
    const stride = r.body === 'small' ? 4 : r.body === 'giant' ? 8 : 6;
    x += stride * Math.sin(ph);
    lift = Math.max(0, Math.cos(ph)) * (r.body === 'giant' ? 4 : 3);
  }
  if (p.tuck > 0) {
    const hx = near ? r.hipN : r.hipF;
    x = lerp(x, hx + (near ? 3 : 5), p.tuck * 0.6);
    lift += p.tuck * (r.body === 'small' ? 4 : 7);
  }
  return { x, lift };
}

function leg(rs: RS, near: boolean, digi: boolean): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const c = cols(rs);
  const hx = near ? r.hipN : r.hipF;
  const hy = r.hipY + 1;
  const f = footPos(rs, near);
  const w = r.legW;
  const pants = near ? c.pants : c.pantsF;
  const boot = near ? c.boot : c.bootF;
  const ay = -4.5 - f.lift;
  if (digi) {
    // Patte digitigrade : cuisse vers l'avant, jarret vers l'arrière.
    const kx = hx + 4;
    const ky = lerp(hy, ay, 0.45);
    const jx = f.x - 2.5;
    const jy = ay - 1;
    ctx.beginPath();
    limb(ctx, hx, hy, kx, ky, w * 0.62, w * 0.5);
    fo(rs, pants);
    ctx.beginPath();
    limb(ctx, kx, ky, jx, jy, w * 0.45, w * 0.36);
    fo(rs, pants);
    ctx.beginPath();
    ctx.moveTo(jx - w * 0.4, jy - 1);
    ctx.quadraticCurveTo(f.x + w * 1.3, jy - 1.5, f.x + w * 1.3, -f.lift - 0.5);
    ctx.lineTo(jx - w * 0.45, -f.lift);
    ctx.closePath();
    fo(rs, boot);
    if (detail(rs, 0.6)) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const tx = f.x + w * (0.55 + i * 0.32);
        ctx.moveTo(tx, -f.lift - 0.4);
        ctx.lineTo(tx + 1.2, -f.lift + 0.2);
      }
      st(rs, '#f2ead8', 1.1);
    }
    return;
  }
  // Jambe tubulaire
  const ky = lerp(hy, ay, 0.5);
  const kx = lerp(hx, f.x, 0.5) + 0.8;
  if (r.body === 'construct') {
    ctx.beginPath();
    limb(ctx, hx, hy, kx, ky, w * 0.42, w * 0.38);
    limb(ctx, kx, ky, f.x, ay, w * 0.38, w * 0.36);
    fo(rs, near ? rs.pal.steelD : darken(rs.pal.steelD, 0.3));
    ctx.beginPath();
    circle(ctx, kx, ky, w * 0.55);
    fo(rs, near ? rs.pal.trim : rs.pal.trimD);
  } else {
    ctx.beginPath();
    ctx.moveTo(hx - w * 0.55, hy);
    ctx.quadraticCurveTo(kx - w * 0.62, ky, f.x - w * 0.46, ay);
    ctx.lineTo(f.x + w * 0.46, ay);
    ctx.quadraticCurveTo(kx + w * 0.6, ky, hx + w * 0.55, hy);
    ctx.closePath();
    fo(rs, rs.sil ? pants : lin(rs, 'b:leg' + (near ? 'n' : 'f'), hx - w, 0, hx + w, 0, lighten(pants, 0.12), pants, darken(pants, 0.18)));
    if (r.body === 'knight' && detail(rs, 0.5)) {
      // genouillère
      ctx.beginPath();
      ellipse(ctx, kx + 0.4, ky, w * 0.5, w * 0.42);
      fo(rs, near ? rs.pal.steel : rs.pal.steelD, true, 0.8);
    }
  }
  // Botte
  const bx = f.x;
  const by = -f.lift;
  const bh = r.body === 'small' ? 4.5 : r.body === 'giant' ? 9 : 6.5;
  ctx.beginPath();
  ctx.moveTo(bx - w * 0.55, by - bh);
  ctx.lineTo(bx + w * 0.52, by - bh);
  ctx.lineTo(bx + w * 0.58, by - bh * 0.48);
  ctx.quadraticCurveTo(bx + w * 1.4, by - bh * 0.45, bx + w * 1.45, by - bh * 0.12);
  ctx.quadraticCurveTo(bx + w * 1.45, by, bx + w * 1.1, by);
  ctx.lineTo(bx - w * 0.62, by);
  ctx.quadraticCurveTo(bx - w * 0.78, by - bh * 0.45, bx - w * 0.55, by - bh);
  ctx.closePath();
  fo(rs, rs.sil ? boot : lin(rs, 'b:boot' + (near ? 'n' : 'f'), 0, -bh, 0, 0, lighten(boot, 0.25), boot, darken(boot, 0.3)));
  if (near && detail(rs, 0.6)) {
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.55, by - bh + 1.2);
    ctx.lineTo(bx + w * 0.55, by - bh + 1.2);
    st(rs, rs.rig.body === 'knight' ? rs.pal.trim : rgba(lighten(boot, 0.4), 0.8), rs.lw * 1.1);
  }
}

function robeSkirt(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const r = rs.rig;
  const ps = rs.pose;
  const sw = ps.walk > 0 ? Math.sin(ps.phase) * 2.2 : 0;
  const sway = ps.sway * 0.8;
  // Pointes de pieds
  const fn = footPos(rs, true);
  const ff = footPos(rs, false);
  ctx.beginPath();
  ellipse(ctx, ff.x + 2, -1.5 - ff.lift, 4, 2.4);
  fo(rs, darken(p.leatherD, 0.2));
  ctx.beginPath();
  ellipse(ctx, fn.x + 2, -1.5 - fn.lift, 4.2, 2.5);
  fo(rs, p.leatherD);
  const top = r.hipY - 6;
  const hw = r.botW;
  const hem = 17;
  const tuck = ps.tuck * 5;
  ctx.beginPath();
  ctx.moveTo(-hw, top);
  ctx.quadraticCurveTo(-hw - 3, -14, -hem - sway - sw * 0.5, -1.5 - tuck);
  ctx.quadraticCurveTo(-hem * 0.5, 0.6 - tuck, -2 + sw * 0.4, -1.2 - tuck);
  ctx.quadraticCurveTo(hem * 0.5, 0.4 - tuck, hem - 1 + sw * 0.6, -2 - tuck);
  ctx.quadraticCurveTo(hw + 4, -14, hw, top);
  ctx.closePath();
  fo(rs, lin(rs, 'b:skirt', -hem, 0, hem, 0, p.pD, p.pL, p.p));
  if (detail(rs, 0.4)) {
    // Panneau central et ourlet doré
    ctx.beginPath();
    ctx.moveTo(1, top + 2);
    ctx.lineTo(7, top + 2);
    ctx.quadraticCurveTo(9.5, -12, 10 + sw * 0.5, -1.6 - tuck);
    ctx.lineTo(2 + sw * 0.4, -1.2 - tuck);
    ctx.quadraticCurveTo(1.5, -12, 1, top + 2);
    ctx.closePath();
    fo(rs, lin(rs, 'b:panel', 0, top, 0, 0, p.sL, p.s, p.sD), true, 0.7);
    ctx.beginPath();
    ctx.moveTo(-hem - sway - sw * 0.5 + 0.8, -3.2 - tuck);
    ctx.quadraticCurveTo(-hem * 0.5, -1.2 - tuck, -2 + sw * 0.4, -2.9 - tuck);
    ctx.quadraticCurveTo(hem * 0.5, -1.4 - tuck, hem - 1.8 + sw * 0.6, -3.6 - tuck);
    st(rs, p.trim, rs.lw * 1.5);
    ctx.beginPath();
    ctx.moveTo(-5, top + 4);
    ctx.quadraticCurveTo(-7, -12, -9 - sway, -3);
    st(rs, rgba(p.pDD, 0.5), rs.lw);
  }
}

function serpentTail(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const r = rs.rig;
  const t = rs.time;
  const ps = rs.pose;
  const sp = ps.walk > 0 ? 6 : 1.6;
  const wv = (i: number) => Math.sin(t * sp + i * 1.1) * (ps.walk > 0 ? 2.4 : 1.2);
  const tuck = ps.tuck * 6;
  const pts = [
    0, r.hipY + 1,
    -3, r.hipY + 10,
    -9 + wv(0), -8 - tuck * 0.5,
    -15 + wv(1) * 0.5, -3.5 - tuck,
    -6 + wv(2) * 0.4, -2.2 - tuck,
    6 + wv(3) * 0.5, -3 - tuck,
    14 + wv(4), -5 - tuck,
    19 + wv(5), -11 - tuck,
    16 + wv(6) * 1.3, -15 - tuck,
  ];
  const w = [r.botW + 0.5, r.botW, 8.5, 7, 6.2, 5, 3.8, 2.2, 0.4];
  const col = p.s;
  ctx.beginPath();
  taper(ctx, pts, w);
  fo(rs, rs.sil ? col : lin(rs, 'b:tail', 0, r.hipY, 0, 0, lighten(col, 0.2), col, darken(col, 0.3)));
  if (detail(rs, 0.45)) {
    // Écailles ventrales
    ctx.beginPath();
    const belly: number[] = [];
    const bw: number[] = [];
    for (let i = 2; i < pts.length / 2; i++) {
      belly.push(pts[i * 2] + 0.5, pts[i * 2 + 1] + w[i] * 0.45);
      bw.push(w[i] * 0.38);
    }
    taper(ctx, belly, bw);
    fl(rs, rgba(p.aL, 0.55));
    ctx.beginPath();
    for (let i = 1; i < pts.length / 2 - 1; i++) {
      const x = pts[i * 2];
      const y = pts[i * 2 + 1];
      ctx.moveTo(x - w[i] * 0.4, y - w[i] * 0.2);
      ctx.quadraticCurveTo(x, y + w[i] * 0.2, x + w[i] * 0.4, y - w[i] * 0.2);
    }
    st(rs, rgba(darken(col, 0.45), 0.6), rs.lw * 0.8);
  }
}

function wisp(rs: RS): void {
  const ctx = rs.ctx;
  const p = rs.pal;
  const r = rs.rig;
  const t = rs.time;
  const top = r.hipY - 4;
  const w = r.botW + 1;
  const s1 = Math.sin(t * 2.6) * 3;
  const s2 = Math.sin(t * 2.6 + 1.7) * 3;
  const s3 = Math.sin(t * 2.6 + 3.1) * 2.5;
  const drift = rs.pose.walk > 0 ? -5 : -2;
  ctx.beginPath();
  ctx.moveTo(-w, top);
  ctx.quadraticCurveTo(-w - 2, top + 12, -9 + drift + s1, top + 22);
  ctx.quadraticCurveTo(-5 + drift, top + 15, -2 + drift + s2, top + 24);
  ctx.quadraticCurveTo(1 + drift * 0.5, top + 15, 4 + drift * 0.6 + s3, top + 20);
  ctx.quadraticCurveTo(w + 2, top + 10, w, top);
  ctx.closePath();
  if (rs.sil) {
    fl(rs, rs.sil);
  } else {
    const g = lin(rs, 'b:wisp', 0, top, 0, top + 24, p.pL, rgba(p.p, 0.9), rgba(p.aL, 0.05));
    fl(rs, g);
    st(rs, lin(rs, 'b:wispol', 0, top, 0, top + 22, INK, rgba(INK, 0)), rs.lw);
    ctx.save();
    ctx.globalAlpha *= 0.8;
    ctx.beginPath();
    ctx.moveTo(-w + 3, top + 3);
    ctx.quadraticCurveTo(-4 + drift, top + 12, -2 + drift + s2 * 0.8, top + 20);
    st(rs, lin(rs, 'b:wisprim', 0, top, 0, top + 20, rgba(p.aLL, 0.9), rgba(p.aLL, 0)), rs.lw * 1.4);
    ctx.restore();
  }
  glow(rs, 0, top + 18, 14, p.a, 0.35);
}

// ---------------------------------------------------------------------------
// Torse

export function drawTorso(rs: RS): void {
  switch (rs.rig.body) {
    case 'knight':
      return knightTorso(rs);
    case 'robe':
      return robeTorso(rs);
    case 'heavy':
      return heavyTorso(rs);
    case 'beast':
      return beastTorso(rs);
    case 'construct':
      return constructTorso(rs);
    case 'serpent':
      return slimTorso(rs, true);
    case 'floating':
      return floatTorso(rs);
    case 'small':
      return smallTorso(rs);
    case 'giant':
      return giantTorso(rs);
    case 'slim':
    default:
      return slimTorso(rs, false);
  }
}

function torsoPath(rs: RS, topW: number, botW: number, topY: number, botY: number, bulge = 1.5): void {
  const ctx = rs.ctx;
  ctx.beginPath();
  ctx.moveTo(-botW, botY);
  ctx.quadraticCurveTo(-topW - 0.5, (topY + botY) / 2, -topW + 0.5, topY + 4);
  ctx.quadraticCurveTo(-topW, topY - 1, -topW + 5, topY - 1.5);
  ctx.lineTo(topW - 4.5, topY - 2);
  ctx.quadraticCurveTo(topW + 1, topY - 1, topW, topY + 5);
  ctx.quadraticCurveTo(topW + bulge, (topY + botY) / 2, botW + 0.5, botY);
  ctx.quadraticCurveTo(0, botY + 2, -botW, botY);
  ctx.closePath();
}

function metalFill(rs: RS, key: string, c: string, cL: string, cLL: string, cD: string, y0: number, y1: number): string | CanvasGradient {
  return rad(rs, key, 4, lerp(y0, y1, 0.3), Math.abs(y1 - y0) * 1.1, [[0, cLL], [0.35, cL], [0.75, c], [1, cD]], 6, lerp(y0, y1, 0.15));
}

function belt(rs: RS, y: number, w: number, h: number, col: string, buckle: string): void {
  const ctx = rs.ctx;
  ctx.beginPath();
  ctx.moveTo(-w, y);
  ctx.quadraticCurveTo(0, y + 1.4, w + 0.5, y);
  ctx.lineTo(w + 0.5, y + h);
  ctx.quadraticCurveTo(0, y + h + 1.4, -w, y + h);
  ctx.closePath();
  fo(rs, col);
  ctx.beginPath();
  roundRect(ctx, 1.5, y - 0.3, h + 1.6, h + 1.4, 1);
  fo(rs, buckle, true, 0.8);
}

function emblem(rs: RS, x: number, y: number, r: number): void {
  if (!detail(rs, 0.45)) return;
  const ctx = rs.ctx;
  const p = rs.pal;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.8, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.8, y);
  ctx.closePath();
  fo(rs, p.aL, true, 0.7);
  glow(rs, x, y, r * 2.4, p.a, 0.3);
}

function knightTorso(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  const breath = rs.pose.breath * 0.4;
  // Tassettes
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const x0 = -r.botW + i * ((r.botW * 2) / 3) - 0.3;
    roundRect(ctx, x0, r.hipY + 1, (r.botW * 2) / 3 + 0.6, 9, 2.4);
  }
  fo(rs, lin(rs, 'b:tasset', 0, r.hipY, 0, r.hipY + 10, p.p, p.pD));
  torsoPath(rs, r.topW + breath, r.botW, r.shoulderY, r.hipY + 3);
  fo(rs, metalFill(rs, 'b:kplate', p.p, p.pL, p.pLL, p.pD, r.shoulderY, r.hipY));
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    ctx.moveTo(3.5, r.shoulderY - 1);
    ctx.quadraticCurveTo(5, (r.shoulderY + r.hipY) / 2, 3.5, r.hipY + 1);
    st(rs, rgba(p.pDD, 0.5), rs.lw * 1.1);
    ctx.beginPath();
    ctx.moveTo(-r.topW + 2, r.shoulderY + 1);
    ctx.quadraticCurveTo(2, r.shoulderY + 6, r.topW - 1, r.shoulderY + 1);
    st(rs, p.trim, rs.lw * 1.6);
    spec(rs, 7, r.shoulderY + 7, 3.2, 1.6, -0.5, 0.5);
  }
  emblem(rs, 4, r.shoulderY + 11, 3.4);
  belt(rs, r.hipY - 2, r.botW, 4, p.sD, p.trim);
}

function robeTorso(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  torsoPath(rs, r.topW, r.botW, r.shoulderY, r.hipY - 3, 1);
  fo(rs, lin(rs, 'b:robe', -r.topW, 0, r.topW, 0, p.pD, p.pL, p.p));
  if (detail(rs, 0.4)) {
    // Col en V et revers
    ctx.beginPath();
    ctx.moveTo(-3, r.shoulderY - 1.5);
    ctx.lineTo(4, r.shoulderY + 9);
    ctx.lineTo(9.5, r.shoulderY - 1.8);
    ctx.lineTo(6, r.shoulderY - 1.8);
    ctx.lineTo(4, r.shoulderY + 4);
    ctx.lineTo(0, r.shoulderY - 1.6);
    ctx.closePath();
    fo(rs, p.sL, true, 0.7);
    ctx.beginPath();
    ctx.moveTo(-r.topW + 2, r.shoulderY + 1);
    ctx.quadraticCurveTo(1, r.shoulderY + 4, r.topW - 1, r.shoulderY + 1);
    st(rs, p.trim, rs.lw * 1.2);
  }
  // Ceinture-écharpe et pan
  ctx.beginPath();
  roundRect(ctx, -r.botW - 0.5, r.hipY - 6, r.botW * 2 + 1, 4.5, 1.5);
  fo(rs, p.a);
  ctx.beginPath();
  taper(ctx, [5, r.hipY - 3, 6.5 + rs.pose.sway * 0.6, r.hipY + 5, 6 + rs.pose.sway, r.hipY + 11], [1.6, 1.4, 1.2]);
  fo(rs, p.aD, true, 0.8);
  emblem(rs, 3, r.hipY - 3.8, 2.4);
}

function slimTorso(rs: RS, serpent: boolean): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  const bot = serpent ? r.hipY + 4 : r.hipY + 2;
  if (!serpent) {
    // Pans de tunique
    ctx.beginPath();
    ctx.moveTo(-r.botW - 1, r.hipY);
    ctx.lineTo(-r.botW - 2.5 - rs.pose.sway * 0.5, r.hipY + 8);
    ctx.lineTo(-1, r.hipY + 6.5);
    ctx.lineTo(1.5, r.hipY + 9);
    ctx.lineTo(r.botW + 2, r.hipY + 7);
    ctx.lineTo(r.botW + 1, r.hipY);
    ctx.closePath();
    fo(rs, p.pD);
  }
  torsoPath(rs, r.topW, r.botW, r.shoulderY, bot, 1.2);
  fo(rs, lin(rs, 'b:slim', -r.topW, r.shoulderY, r.topW, r.hipY, p.pL, p.p, p.pD));
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    ctx.moveTo(-2, r.shoulderY - 1.5);
    ctx.lineTo(3.5, r.shoulderY + 7);
    ctx.lineTo(8, r.shoulderY - 1.8);
    st(rs, p.s, rs.lw * 1.6);
    if (serpent) {
      // Brassière d'écailles
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const y = r.hipY - 2 + i * 2.2;
        ctx.moveTo(-r.botW + 1, y);
        ctx.quadraticCurveTo(0, y + 2, r.botW, y);
      }
      st(rs, rgba(p.aL, 0.7), rs.lw * 0.9);
    }
  }
  if (!serpent) belt(rs, r.hipY - 2, r.botW, 3.2, p.leather, p.trim);
  else {
    ctx.beginPath();
    roundRect(ctx, -r.botW - 0.5, r.hipY - 4.5, r.botW * 2 + 1, 3.4, 1.4);
    fo(rs, p.trim);
    emblem(rs, 3, r.hipY - 2.8, 2.4);
  }
  if (!serpent && detail(rs, 0.55)) {
    ctx.beginPath();
    roundRect(ctx, -r.botW + 0.5, r.hipY - 1, 4.5, 4.5, 1.2);
    fo(rs, p.leatherD, true, 0.7);
  }
}

function heavyTorso(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  const b = rs.pose.breath * 0.5;
  ctx.beginPath();
  ctx.moveTo(-r.botW, r.hipY + 3);
  ctx.bezierCurveTo(-r.topW - 3, r.hipY - 4, -r.topW - 2, r.shoulderY + 4, -r.topW + 4, r.shoulderY - 1.5);
  ctx.lineTo(r.topW - 4, r.shoulderY - 2);
  ctx.bezierCurveTo(r.topW + 3 + b, r.shoulderY + 4, r.topW + 4 + b, r.hipY - 4, r.botW + 1, r.hipY + 3);
  ctx.quadraticCurveTo(0, r.hipY + 5.5, -r.botW, r.hipY + 3);
  ctx.closePath();
  fo(rs, metalFill(rs, 'b:heavy', p.p, p.pL, p.pLL, p.pD, r.shoulderY, r.hipY));
  if (detail(rs, 0.45)) {
    // Plastron à lames
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = r.shoulderY + 9 + i * 5;
      ctx.moveTo(-r.topW + 3, y);
      ctx.quadraticCurveTo(2, y + 2.5, r.topW - 1, y - 0.5);
    }
    st(rs, rgba(p.pDD, 0.55), rs.lw * 1.1);
    ctx.beginPath();
    ctx.moveTo(-r.topW + 4, r.shoulderY + 1);
    ctx.quadraticCurveTo(2, r.shoulderY + 5, r.topW - 3, r.shoulderY + 0.5);
    st(rs, p.trim, rs.lw * 1.8);
    spec(rs, 8, r.shoulderY + 6, 4, 2, -0.4, 0.45);
  }
  emblem(rs, 4, r.shoulderY + 7.5, 3.4);
  belt(rs, r.hipY - 2.5, r.botW + 1.5, 5.5, p.leatherD, p.trim);
}

function beastTorso(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  // Pagne
  ctx.beginPath();
  ctx.moveTo(-r.botW + 1, r.hipY);
  ctx.lineTo(-r.botW - 1 - rs.pose.sway * 0.6, r.hipY + 9);
  ctx.lineTo(r.botW - 2, r.hipY + 10);
  ctx.lineTo(r.botW + 1, r.hipY);
  ctx.closePath();
  fo(rs, p.sD);
  ctx.beginPath();
  ctx.moveTo(-r.botW, r.hipY + 3);
  ctx.quadraticCurveTo(-r.topW - 2, (r.shoulderY + r.hipY) / 2, -r.topW + 2, r.shoulderY + 1);
  ctx.quadraticCurveTo(-r.topW + 3, r.shoulderY - 3, -r.topW + 8, r.shoulderY - 2.5);
  ctx.lineTo(r.topW - 5, r.shoulderY - 2.5);
  ctx.quadraticCurveTo(r.topW + 2, r.shoulderY - 1, r.topW + 1, r.shoulderY + 6);
  // Bordure de fourrure en dents de scie
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const y = lerp(r.shoulderY + 6, r.hipY + 2, i / n);
    const x = lerp(r.topW + 1, r.botW + 1, i / n);
    ctx.lineTo(x + 2.2, y - 2.5);
    ctx.lineTo(x, y);
  }
  ctx.quadraticCurveTo(0, r.hipY + 5, -r.botW, r.hipY + 3);
  ctx.closePath();
  fo(rs, rad(rs, 'b:beast', 3, r.shoulderY + 8, 24, [[0, p.pL], [0.6, p.p], [1, p.pD]], 5, r.shoulderY + 2));
  // Poitrail clair
  ctx.beginPath();
  ctx.moveTo(-1, r.shoulderY + 1);
  ctx.quadraticCurveTo(10, r.shoulderY + 2, 9, r.shoulderY + 12);
  ctx.lineTo(6, r.shoulderY + 10);
  ctx.lineTo(5, r.shoulderY + 15);
  ctx.lineTo(2, r.shoulderY + 12);
  ctx.quadraticCurveTo(-2, r.shoulderY + 8, -1, r.shoulderY + 1);
  ctx.closePath();
  fo(rs, p.sL, true, 0.7);
  belt(rs, r.hipY - 1.5, r.botW, 3, p.leatherD, p.trim);
}

function constructTorso(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  // Bassin
  ctx.beginPath();
  roundRect(ctx, -r.botW + 1, r.hipY - 3, r.botW * 2 - 1, 7, 2.5);
  fo(rs, p.steelD);
  // Pistons latéraux
  ctx.beginPath();
  roundRect(ctx, -r.topW - 1.5, r.shoulderY + 4, 3, 16, 1.4);
  fo(rs, p.steel);
  // Chaudière
  ctx.beginPath();
  roundRect(ctx, -r.topW, r.shoulderY - 2.5, r.topW * 2, r.hipY - r.shoulderY + 1.5, 6);
  fo(rs, metalFill(rs, 'b:boiler', p.trim, p.trimL, lighten(p.trimL, 0.4), p.trimD, r.shoulderY, r.hipY));
  // Plaque frontale
  ctx.beginPath();
  roundRect(ctx, -3, r.shoulderY + 2, r.topW + 1, r.hipY - r.shoulderY - 7, 4);
  fo(rs, lin(rs, 'b:cplate', 0, r.shoulderY, 0, r.hipY, p.pL, p.p, p.pD), true, 0.8);
  // Cœur lumineux
  const cx = 4.5;
  const cy = r.shoulderY + 10;
  const pulse = 0.75 + 0.25 * Math.sin(rs.time * 3.2);
  glow(rs, cx, cy, 14, p.a, 0.5 * pulse + rs.pose.glow * 0.4);
  ctx.beginPath();
  circle(ctx, cx, cy, 5);
  fo(rs, p.trimD);
  ctx.beginPath();
  circle(ctx, cx, cy, 3.4);
  fo(rs, rad(rs, 'b:core', cx, cy, 3.4, [[0, '#ffffff'], [0.4, p.aLL], [1, p.a]]), false);
  if (detail(rs, 0.5)) {
    ctx.beginPath();
    const rv: [number, number][] = [
      [-r.topW + 2.5, r.shoulderY + 0.5],
      [r.topW - 2.5, r.shoulderY + 0.5],
      [-r.topW + 2.5, r.hipY - 3.5],
      [r.topW - 2.5, r.hipY - 3.5],
    ];
    for (const [x, y] of rv) circle(ctx, x, y, 0.95);
    fl(rs, p.trimD);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(-1, r.hipY - 9 + i * 2);
      ctx.lineTo(10, r.hipY - 9 + i * 2);
    }
    st(rs, rgba(p.pDD, 0.7), rs.lw * 0.8);
    spec(rs, -6, r.shoulderY + 3, 3, 1.4, -0.3, 0.5);
  }
}

function floatTorso(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  torsoPath(rs, r.topW, r.botW + 1, r.shoulderY, r.hipY, 1.2);
  fo(rs, lin(rs, 'b:float', -r.topW, r.shoulderY, r.topW, r.hipY, p.pL, p.p, p.pD));
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    ctx.moveTo(-r.topW + 1, r.shoulderY + 1);
    ctx.quadraticCurveTo(0, r.shoulderY + 7, r.topW, r.shoulderY);
    st(rs, p.trim, rs.lw * 1.3);
    ctx.beginPath();
    ctx.moveTo(3, r.shoulderY + 5);
    ctx.lineTo(3.5, r.hipY);
    st(rs, rgba(p.s, 0.9), rs.lw * 1.6);
  }
  emblem(rs, 3.5, r.shoulderY + 11, 3);
}

function smallTorso(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  const cy = (r.shoulderY + r.hipY) / 2 + 1;
  ctx.beginPath();
  ctx.moveTo(-r.botW, r.hipY + 2);
  ctx.bezierCurveTo(-r.botW - 3, cy, -r.topW - 1, r.shoulderY, -2, r.shoulderY - 1.5);
  ctx.lineTo(3, r.shoulderY - 1.5);
  ctx.bezierCurveTo(r.topW + 2, r.shoulderY, r.botW + 3.5, cy, r.botW, r.hipY + 2);
  ctx.quadraticCurveTo(0, r.hipY + 4.5, -r.botW, r.hipY + 2);
  ctx.closePath();
  fo(rs, rad(rs, 'b:small', 3, cy - 3, 14, [[0, p.pL], [0.65, p.p], [1, p.pD]], 4, cy - 6));
  if (detail(rs, 0.45)) {
    ctx.beginPath();
    ctx.moveTo(-r.topW + 1, r.shoulderY + 1);
    ctx.quadraticCurveTo(1, r.shoulderY + 4.5, r.topW - 0.5, r.shoulderY + 0.5);
    st(rs, p.s, rs.lw * 1.8);
    ctx.beginPath();
    circle(ctx, 4, cy - 1, 1.1);
    circle(ctx, 4.5, cy + 3, 1.1);
    fl(rs, p.trim);
  }
  belt(rs, r.hipY - 2, r.botW, 2.8, p.leather, p.trim);
}

function giantTorso(rs: RS): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  const b = rs.pose.breath * 0.6;
  // Pagne / jupe lourde
  ctx.beginPath();
  ctx.moveTo(-r.botW - 1, r.hipY - 1);
  ctx.lineTo(-r.botW - 3 - rs.pose.sway, r.hipY + 13);
  ctx.lineTo(r.botW + 2, r.hipY + 13);
  ctx.lineTo(r.botW + 1, r.hipY - 1);
  ctx.closePath();
  fo(rs, lin(rs, 'b:gskirt', 0, r.hipY, 0, r.hipY + 13, p.s, p.sD));
  ctx.beginPath();
  ctx.moveTo(-r.botW, r.hipY + 2);
  ctx.bezierCurveTo(-r.topW - 2, r.hipY - 10, -r.topW - 3, r.shoulderY + 6, -r.topW + 5, r.shoulderY - 2);
  ctx.lineTo(r.topW - 5, r.shoulderY - 2.5);
  ctx.bezierCurveTo(r.topW + 3 + b, r.shoulderY + 6, r.topW + 2 + b, r.hipY - 10, r.botW + 1, r.hipY + 2);
  ctx.quadraticCurveTo(0, r.hipY + 5, -r.botW, r.hipY + 2);
  ctx.closePath();
  fo(rs, rad(rs, 'b:giant', 6, r.shoulderY + 12, 40, [[0, p.pL], [0.6, p.p], [1, p.pD]], 9, r.shoulderY + 4));
  if (detail(rs, 0.35)) {
    // Bandoulière
    ctx.beginPath();
    ctx.moveTo(-r.topW + 4, r.shoulderY - 1);
    ctx.lineTo(r.botW - 1, r.hipY - 2);
    ctx.lineTo(r.botW - 6, r.hipY - 1);
    ctx.lineTo(-r.topW + 1, r.shoulderY + 3);
    ctx.closePath();
    fo(rs, p.leather, true, 0.8);
    ctx.beginPath();
    circle(ctx, 2, (r.shoulderY + r.hipY) / 2 - 1, 2.6);
    fo(rs, p.trim, true, 0.8);
    ctx.beginPath();
    ctx.moveTo(2, r.shoulderY + 6);
    ctx.quadraticCurveTo(10, r.shoulderY + 9, 16, r.shoulderY + 5);
    st(rs, rgba(p.pDD, 0.45), rs.lw * 1.2);
  }
  belt(rs, r.hipY - 3, r.botW + 1, 6, p.leatherD, p.trim);
}

// ---------------------------------------------------------------------------
// Bras et mains

export function handPos(rs: RS, near: boolean): { x: number; y: number } {
  const r = rs.rig;
  const arm = near ? rs.pose.near : rs.pose.far;
  const sh = near ? r.shN : r.shF;
  const L = r.armLen * arm.e;
  return { x: sh[0] + Math.sin(arm.a) * L, y: sh[1] + Math.cos(arm.a) * L };
}

/** Membre du bras de l'épaule jusqu'à (hx, hy) — la main est dessinée à part. */
export function drawArm(rs: RS, near: boolean, hx: number, hy: number): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const c = cols(rs);
  const sh = near ? r.shN : r.shF;
  // Bras trop étirés : on borne la longueur visuelle.
  let dx = hx - sh[0];
  let dy = hy - sh[1];
  const d = Math.hypot(dx, dy);
  const maxL = r.armLen * 1.35;
  if (d > maxL) {
    dx *= maxL / d;
    dy *= maxL / d;
  }
  const ex = sh[0] + dx;
  const ey = sh[1] + dy;
  const w0 = r.armW * 0.62;
  const w1 = r.armW * 0.48;
  const sleeve = near ? c.sleeve : c.sleeveF;
  if (r.body === 'robe' || r.body === 'floating') {
    // Manche évasée
    ctx.beginPath();
    limb(ctx, sh[0], sh[1], ex, ey, w0, w1 * 1.55);
    fo(rs, sleeve);
    if (detail(rs, 0.5)) {
      ctx.beginPath();
      const ux = dx / (Math.hypot(dx, dy) || 1);
      const uy = dy / (Math.hypot(dx, dy) || 1);
      ctx.moveTo(ex - uy * w1 * 1.5 - ux * 1.2, ey + ux * w1 * 1.5 - uy * 1.2);
      ctx.lineTo(ex + uy * w1 * 1.5 - ux * 1.2, ey - ux * w1 * 1.5 - uy * 1.2);
      st(rs, rs.pal.trim, rs.lw * 1.4);
    }
    return;
  }
  if (r.body === 'construct') {
    const mx = (sh[0] + ex) / 2;
    const my = (sh[1] + ey) / 2;
    ctx.beginPath();
    limb(ctx, sh[0], sh[1], ex, ey, w0 * 0.7, w1 * 0.7);
    fo(rs, near ? rs.pal.steelD : darken(rs.pal.steelD, 0.3));
    ctx.beginPath();
    limb(ctx, lerp(sh[0], mx, 0.15), lerp(sh[1], my, 0.15), lerp(mx, ex, 0.2), lerp(my, ey, 0.2), w0, w0 * 0.9);
    fo(rs, near ? rs.pal.trim : rs.pal.trimD);
    ctx.beginPath();
    circle(ctx, mx + (ex - mx) * 0.45, my + (ey - my) * 0.45, w0 * 0.75);
    fo(rs, near ? rs.pal.steel : rs.pal.steelD, true, 0.8);
    return;
  }
  ctx.beginPath();
  limb(ctx, sh[0], sh[1], ex, ey, w0, w1);
  fo(rs, sleeve);
  if (detail(rs, 0.5)) {
    const p = rs.pal;
    if (r.body === 'knight' || r.body === 'heavy') {
      ctx.beginPath();
      circle(ctx, lerp(sh[0], ex, 0.52), lerp(sh[1], ey, 0.52), w0 * 0.78);
      fo(rs, near ? p.steel : p.steelD, true, 0.8);
    } else if (r.body === 'giant' || r.body === 'serpent') {
      ctx.beginPath();
      limb(ctx, lerp(sh[0], ex, 0.62), lerp(sh[1], ey, 0.62), lerp(sh[0], ex, 0.86), lerp(sh[1], ey, 0.86), w1 * 1.18, w1 * 1.12);
      fo(rs, r.body === 'giant' ? p.leather : p.trim, true, 0.8);
    }
  }
}

export function drawHand(rs: RS, near: boolean, x: number, y: number, open = false): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  const hr = r.armW * (r.body === 'giant' ? 0.58 : 0.6);
  switch (r.hand) {
    case 'glove':
      ctx.beginPath();
      circle(ctx, x, y, hr);
      fo(rs, near ? p.sD : p.sDD);
      if (detail(rs, 0.6)) {
        ctx.beginPath();
        ctx.arc(x, y, hr * 0.62, -2.4, -0.6);
        st(rs, rgba(lighten(p.sD, 0.4), 0.8), rs.lw * 0.8);
      }
      break;
    case 'metal':
      ctx.beginPath();
      circle(ctx, x, y, hr * 0.95);
      fo(rs, near ? p.trim : p.trimD);
      if (detail(rs, 0.6)) {
        ctx.beginPath();
        circle(ctx, x, y, hr * 0.35);
        fl(rs, p.steelD);
      }
      break;
    case 'paw':
      ctx.beginPath();
      circle(ctx, x, y, hr * 1.05);
      fo(rs, near ? p.p : p.pD);
      if (detail(rs, 0.5)) {
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          const a = 1.2 + i * 0.45;
          ctx.moveTo(x + Math.cos(a) * hr * 0.8, y + Math.sin(a) * hr * 0.8);
          ctx.lineTo(x + Math.cos(a) * hr * 1.55, y + Math.sin(a) * hr * 1.55);
        }
        st(rs, '#f4ecdc', Math.max(1, rs.lw));
      }
      break;
    case 'spirit':
      glow(rs, x, y, hr * 3, p.a, 0.45);
      ctx.beginPath();
      circle(ctx, x, y, hr * 0.85);
      fo(rs, near ? p.skin : p.skinD);
      break;
    case 'skin':
    default:
      ctx.beginPath();
      if (open) ellipse(ctx, x, y, hr * 1.05, hr * 0.8);
      else circle(ctx, x, y, hr * 0.9);
      fo(rs, near ? p.skin : p.skinD);
      break;
  }
}

/** Épaulière (couche avant ou arrière). */
export function pauldron(rs: RS, near: boolean): void {
  const ctx = rs.ctx;
  const r = rs.rig;
  const p = rs.pal;
  const sh = near ? r.shN : r.shF;
  const s = r.armW / 6.2;
  const a = (near ? rs.pose.near.a : rs.pose.far.a) * 0.18;
  ctx.save();
  ctx.translate(sh[0], sh[1] - 0.5);
  ctx.rotate(clamp(a, -0.3, 0.45));
  ctx.scale(s, s);
  const lame = (y: number, w: number, h: number, c: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.moveTo(-w, y + h * 0.4);
    ctx.quadraticCurveTo(-w * 1.05, y - h, 0, y - h * 1.15);
    ctx.quadraticCurveTo(w * 1.05, y - h, w, y + h * 0.4);
    ctx.quadraticCurveTo(0, y + h * 0.75, -w, y + h * 0.4);
    ctx.closePath();
    fo(rs, c);
  };
  const base = near ? p.pL : p.pD;
  lame(4.5, 6.5, 3.5, near ? p.p : p.pDD);
  lame(1.2, 8, 5, rs.sil ? base : lin(rs, 'b:paul' + (near ? 'n' : 'f'), 0, -5, 0, 4, near ? p.pLL : p.p, base, near ? p.pD : p.pDD));
  if (near && detail(rs, 0.5)) {
    ctx.beginPath();
    ctx.moveTo(-7.4, 2.4);
    ctx.quadraticCurveTo(0, 4.6, 7.4, 2.4);
    st(rs, p.trim, rs.lw * 1.6 / s);
    spec(rs, -2, -2.2, 2.6, 1.2, -0.3, 0.55);
  }
  ctx.restore();
}

/** Lueur douce au point visé (utilisée par le moteur d'incantation). */
export function castHands(rs: RS, x: number, y: number): void {
  const g = rs.pose.glow;
  if (g <= 0.02) return;
  glow(rs, x, y, 10 + g * 10, rs.pal.a, g * 0.8);
}

