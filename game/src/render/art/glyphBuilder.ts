/**
 * Mini-langage de construction des icônes (boîte de 100 × 100 unités).
 * - fill / line : forme principale en métal doré (contour encré, dégradé, reflet) ;
 * - cut  : trait gravé sombre ;
 * - hole : creux gravé (aplat sombre) ;
 * - gem  : incrustation lumineuse ;
 * - shade: voile d'ombre (faces d'un volume).
 * Les formes peuvent être des chaînes SVG (« M10 10 L… ») ou des fonctions de tracé.
 */
import { taper as taperPath } from './paths';

export type PathSrc = string | Path2D | ((p: Path2D) => void);

export type GlyphOp =
  | { k: 'fill'; p: Path2D; sep: boolean }
  | { k: 'line'; p: Path2D; w: number; sep: boolean }
  | { k: 'cut'; p: Path2D; w: number }
  | { k: 'hole'; p: Path2D }
  | { k: 'gem'; p: Path2D }
  | { k: 'shade'; p: Path2D; a: number };

export class GB {
  ops: GlyphOp[] = [];
  private m: DOMMatrix | null = null;

  private mk(src: PathSrc): Path2D {
    let p: Path2D;
    if (typeof src === 'string') p = new Path2D(src);
    else if (src instanceof Path2D) p = src;
    else {
      p = new Path2D();
      src(p);
    }
    if (!this.m) return p;
    const q = new Path2D();
    q.addPath(p, this.m);
    return q;
  }

  /** Transformation appliquée aux formes suivantes (rotation en degrés autour de cx, cy). */
  tf(deg: number, cx = 50, cy = 50, s = 1, dx = 0, dy = 0): this {
    this.m = new DOMMatrix().translate(cx + dx, cy + dy).rotate(deg).scale(s).translate(-cx, -cy);
    return this;
  }

  reset(): this {
    this.m = null;
    return this;
  }

  fill(src: PathSrc, sep = false): this {
    this.ops.push({ k: 'fill', p: this.mk(src), sep });
    return this;
  }

  line(src: PathSrc, w: number, sep = false): this {
    this.ops.push({ k: 'line', p: this.mk(src), w, sep });
    return this;
  }

  cut(src: PathSrc, w = 1): this {
    this.ops.push({ k: 'cut', p: this.mk(src), w });
    return this;
  }

  hole(src: PathSrc): this {
    this.ops.push({ k: 'hole', p: this.mk(src) });
    return this;
  }

  gem(src: PathSrc): this {
    this.ops.push({ k: 'gem', p: this.mk(src) });
    return this;
  }

  shade(src: PathSrc, a = 0.28): this {
    this.ops.push({ k: 'shade', p: this.mk(src), a });
    return this;
  }
}

// ---------------------------------------------------------------------------
// Générateurs de chemins SVG (chaînes) — boîte 100 × 100

const f = (n: number) => +n.toFixed(2);

export function C(cx: number, cy: number, r: number, rev = false): string {
  const s = rev ? 1 : 0;
  return `M${f(cx - r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 ${s} ${f(cx + r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 ${s} ${f(cx - r)} ${f(cy)} Z`;
}

export function E(cx: number, cy: number, rx: number, ry: number, rotDeg = 0, rev = false): (p: Path2D) => void {
  return (p) => {
    const a = (rotDeg * Math.PI) / 180;
    p.moveTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * rx);
    p.ellipse(cx, cy, rx, ry, a, 0, Math.PI * 2, rev);
    p.closePath();
  };
}

export function R(x: number, y: number, w: number, h: number, r = 0): string {
  const rr = Math.min(r, w / 2, h / 2);
  if (rr <= 0) return `M${f(x)} ${f(y)} H${f(x + w)} V${f(y + h)} H${f(x)} Z`;
  return (
    `M${f(x + rr)} ${f(y)} H${f(x + w - rr)} Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + rr)} ` +
    `V${f(y + h - rr)} Q${f(x + w)} ${f(y + h)} ${f(x + w - rr)} ${f(y + h)} H${f(x + rr)} ` +
    `Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - rr)} V${f(y + rr)} Q${f(x)} ${f(y)} ${f(x + rr)} ${f(y)} Z`
  );
}

/** Rectangle parcouru en sens inverse (creux dans une forme en règle non nulle). */
export function Rrev(x: number, y: number, w: number, h: number): string {
  return `M${f(x)} ${f(y)} V${f(y + h)} H${f(x + w)} V${f(y)} Z`;
}

export function P(...pts: number[]): string {
  let s = `M${f(pts[0])} ${f(pts[1])}`;
  for (let i = 2; i < pts.length; i += 2) s += ` L${f(pts[i])} ${f(pts[i + 1])}`;
  return s + ' Z';
}

export function star(cx: number, cy: number, n: number, ro: number, ri: number, rotDeg = -90): string {
  const pts: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = ((rotDeg + (i * 180) / n) * Math.PI) / 180;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return P(...pts);
}

/** Soleil à rayons alternés. */
export function sunburst(cx: number, cy: number, n: number, rin: number, rlong: number, rshort: number): string {
  const pts: number[] = [];
  const step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step;
    const rt = i % 2 === 0 ? rlong : rshort;
    pts.push(cx + Math.cos(a - step / 2) * rin, cy + Math.sin(a - step / 2) * rin);
    pts.push(cx + Math.cos(a) * rt, cy + Math.sin(a) * rt);
  }
  return P(...pts);
}

export function gearP(cx: number, cy: number, n: number, ro: number, ri: number, hole = 0): string {
  const pts: number[] = [];
  const step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step;
    const q = [
      [a - step * 0.5, ri],
      [a - step * 0.26, ri],
      [a - step * 0.18, ro],
      [a + step * 0.18, ro],
      [a + step * 0.26, ri],
    ];
    for (const [ang, r] of q) pts.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
  }
  let s = P(...pts);
  if (hole > 0) s += ' ' + C(cx, cy, hole, false);
  return s;
}

/** Étincelle à 4 branches. */
export function spark(cx: number, cy: number, r: number, thin = 0.22): string {
  const t = r * thin;
  return (
    `M${f(cx)} ${f(cy - r)} Q${f(cx + t)} ${f(cy - t)} ${f(cx + r)} ${f(cy)} Q${f(cx + t)} ${f(cy + t)} ${f(cx)} ${f(cy + r)} ` +
    `Q${f(cx - t)} ${f(cy + t)} ${f(cx - r)} ${f(cy)} Q${f(cx - t)} ${f(cy - t)} ${f(cx)} ${f(cy - r)} Z`
  );
}

/** Forme effilée le long d'une ligne médiane. */
export function TP(pts: number[], w: number[]): (p: Path2D) => void {
  return (p) => taperPath(p, pts, w);
}

/** Arc ouvert (pour les traits « line »). */
export function arcP(cx: number, cy: number, r: number, a0deg: number, a1deg: number): (p: Path2D) => void {
  return (p) => {
    const a0 = (a0deg * Math.PI) / 180;
    const a1 = (a1deg * Math.PI) / 180;
    p.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    p.arc(cx, cy, r, a0, a1);
  };
}

/** Spirale échantillonnée (centre → extérieur). */
export function spiralPts(cx: number, cy: number, r0: number, k: number, turns: number, a0 = 0, n = 26): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * turns * Math.PI * 2;
    const r = r0 + k * t;
    pts.push(cx + Math.cos(t + a0) * r, cy + Math.sin(t + a0) * r);
  }
  return pts;
}

/** Croissant (disque r privé d'un disque décalé). */
export function crescentP(cx: number, cy: number, r: number, dx: number, dy: number, r2: number): (p: Path2D) => void {
  return (p) => {
    const d = Math.hypot(dx, dy);
    const a = (r * r - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r * r - a * a));
    const ux = dx / d;
    const uy = dy / d;
    const mx = cx + ux * a;
    const my = cy + uy * a;
    const p1x = mx - uy * h;
    const p1y = my + ux * h;
    const p2x = mx + uy * h;
    const p2y = my - ux * h;
    p.moveTo(p1x, p1y);
    p.arc(cx, cy, r, Math.atan2(p1y - cy, p1x - cx), Math.atan2(p2y - cy, p2x - cx), false);
    p.arc(cx + dx, cy + dy, r2, Math.atan2(p2y - cy - dy, p2x - cx - dx), Math.atan2(p1y - cy - dy, p1x - cx - dx), true);
    p.closePath();
  };
}
