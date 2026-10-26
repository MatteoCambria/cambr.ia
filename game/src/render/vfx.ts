/**
 * Effets visuels du combat. Ils sont créés à partir des événements de la simulation et
 * n'ont aucune influence sur elle. Chaque clé d'effet (« vfx ») des données est traduite
 * en une recette (type + couleurs) ; les clés inconnues ont un rendu générique cohérent.
 */
import type { CombatEvent } from '../combat/events';
import type { CombatSim, Projectile, Zone } from '../combat/sim';
import { hexToWorld, type Vec2 } from '../board/hex';
import { TILT, worldToScreen, type BoardLayout } from './layout';

type Kind = 'burst' | 'ring' | 'pillar' | 'warn' | 'beam' | 'sweep' | 'heal' | 'shield' | 'slash' | 'mark' | 'summon' | 'trail' | 'screen' | 'rebirth' | 'none';

interface Recipe {
  kind: Kind;
  color: string;
  color2: string;
}

const PALETTES: [RegExp, string, string][] = [
  [/sun|holy|dawn|light|banner|censer|sunrise|gold/i, '#ffd36b', '#fff6d0'],
  [/moon|dream|veil|lull|sleep|eclipse|mark|mirage/i, '#c6b6ff', '#f2ecff'],
  [/gear|bolt|clock|steam|drill|wind|ricochet|time|rewind|windUp|mortar/i, '#ffb35c', '#ffe9b8'],
  [/leaf|root|thorn|bark|spore|season|pounce|claw|awaken|charge/i, '#8be07a', '#e6ffd0'],
  [/wave|water|tide|whirl|jelly|drown|bubble|devour|harpoon|counter|bite|chain/i, '#5fe0d0', '#d8fff8'],
  [/fire|ember|explo|erupt|phoenix|hammer|smash|grenade|shell|throw|raise/i, '#ff8a3d', '#ffe0a0'],
  [/sand|coin|caravan|spyglass|broadside|flask|acid/i, '#f0c987', '#fff4d8'],
  [/void|star|black|meteor|nova|gravity|rift|blink|shadow|constellation|singular/i, '#a07bff', '#efe6ff'],
];

function paletteFor(key: string): [string, string] {
  for (const [re, a, b] of PALETTES) if (re.test(key)) return [a, b];
  return ['#e8e0ff', '#ffffff'];
}

function kindFor(key: string): Kind {
  const k = key.toLowerCase();
  if (/warn$/.test(k)) return 'warn';
  if (/timestop|sunrise|fullmoon|caravancall|broadsidecall/.test(k)) return 'screen';
  if (/pillar|meteor$|timeshatter/.test(k)) return 'pillar';
  if (/beam|chain|lightning|dreamlink|chainpull|boltchain/.test(k)) return 'beam';
  if (/firewave|broadside|sandslash|fireWings/i.test(k)) return 'sweep';
  if (/heal|tide|rewindunit|holypulse|leafheal|holylight/.test(k)) return 'heal';
  if (/shield|veil/.test(k)) return 'shield';
  if (/slash|bite|smash|drill|impact|hammer|claw/.test(k)) return 'slash';
  if (/mark|eclipse|drown|devour|sleep|roots/.test(k)) return 'mark';
  if (/assemble|raisedead|sandpuff|voidspawn|summon/.test(k)) return 'summon';
  if (/leap|dust|trail|blink|pounce|charge/.test(k)) return 'trail';
  if (/rebirth|dawnsave|phoenixegg|awaken|transform/.test(k)) return 'rebirth';
  if (/slam|eruption|steam|gravity|tidepull|firespin|spin|rootslam|groundslam|pulse/.test(k)) return 'ring';
  if (/tilehidden/.test(k)) return 'none';
  return 'burst';
}

export function recipe(key: string): Recipe {
  const [color, color2] = paletteFor(key);
  return { kind: kindFor(key), color, color2 };
}

interface Effect {
  kind: Kind;
  t0: number;
  dur: number;
  at: Vec2; // monde
  to?: Vec2;
  radius: number; // en hexagones
  color: string;
  color2: string;
  seed: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

interface FloatText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
  bold: boolean;
}

const DMG_COLORS = { physical: '#ffb070', magic: '#b8a2ff', true: '#ffffff' } as const;

export class VfxSystem {
  effects: Effect[] = [];
  particles: Particle[] = [];
  texts: FloatText[] = [];
  flash: { color: string; until: number; dur: number } | null = null;
  shake = 0;
  private seed = 1;
  private dotAccum = new Map<number, { amount: number; color: string; t: number }>();

  reset(): void {
    this.effects = [];
    this.particles = [];
    this.texts = [];
    this.flash = null;
    this.dotAccum.clear();
  }

  /** Convertit un événement de simulation en effets visuels. */
  ingest(e: CombatEvent, sim: CombatSim, L: BoardLayout, now: number, showNumbers: boolean, reduceMotion: boolean): void {
    const unitPos = (id: number | null | undefined): Vec2 | null => {
      if (id === null || id === undefined) return null;
      const u = sim.unit(id);
      return u ? sim.unitWorld(u) : null;
    };
    switch (e.e) {
      case 'vfx': {
        if (e.vfx.endsWith(':open')) {
          const r = recipe(e.vfx.replace(':open', ''));
          if (r.kind !== 'none') this.add({ kind: 'ring', t0: now, dur: 0.5, at: e.at, radius: e.radius ?? 1, color: r.color, color2: r.color2, seed: this.seed++ });
          return;
        }
        const r = recipe(e.vfx);
        if (r.kind === 'none') return;
        if (r.kind === 'screen') {
          if (!reduceMotion) this.flash = { color: r.color, until: now + 0.6, dur: 0.6 };
          this.add({ kind: 'ring', t0: now, dur: 0.9, at: e.at, radius: 4, color: r.color, color2: r.color2, seed: this.seed++ });
          return;
        }
        const dur = r.kind === 'warn' ? e.dur ?? 0.8 : r.kind === 'beam' ? 0.35 : r.kind === 'pillar' ? 0.7 : r.kind === 'trail' ? Math.max(0.3, e.dur ?? 0.3) : 0.55;
        this.add({ kind: r.kind, t0: now, dur, at: e.at, to: e.to, radius: e.radius ?? (r.kind === 'burst' ? 0.8 : 1), color: r.color, color2: r.color2, seed: this.seed++ });
        if (r.kind === 'burst' || r.kind === 'pillar' || r.kind === 'sweep') {
          const s = worldToScreen(L, e.at);
          this.burstParticles(s.x, s.y - L.hexR * 0.3, r.color, r.kind === 'pillar' ? 26 : 16, L.hexR);
          if (!reduceMotion && (r.kind === 'pillar' || (e.radius ?? 0) >= 1)) this.shake = Math.max(this.shake, 0.18);
        }
        return;
      }
      case 'castFx': {
        const p = unitPos(e.src);
        if (!p) return;
        const r = recipe(e.vfx ?? 'cast');
        this.add({ kind: 'ring', t0: now, dur: 0.4, at: p, radius: 0.7, color: r.color, color2: r.color2, seed: this.seed++ });
        return;
      }
      case 'hit': {
        const p = unitPos(e.tgt);
        if (!p) return;
        const s = worldToScreen(L, p);
        if (e.kind !== 'dot' && (e.kind === 'ability' || e.crit)) this.sparks(s.x, s.y - L.hexR * 0.7, DMG_COLORS[e.dmgType], e.crit ? 8 : 5, L.hexR);
        if (!showNumbers) return;
        const total = e.amount;
        if (total < 0.5) return;
        if (e.kind === 'dot') {
          const acc = this.dotAccum.get(e.tgt) ?? { amount: 0, color: e.dmgType === 'true' ? '#ffffff' : '#ff9a5c', t: now };
          acc.amount += total;
          this.dotAccum.set(e.tgt, acc);
          if (now - acc.t > 0.45) {
            this.text(s.x, s.y - L.hexR * 1.4, String(Math.round(acc.amount)), acc.color, L.hexR * 0.32, false);
            this.dotAccum.delete(e.tgt);
          }
          return;
        }
        const size = (e.crit ? 0.5 : e.kind === 'ability' ? 0.42 : 0.34) * L.hexR;
        this.text(s.x + (Math.random() - 0.5) * L.hexR * 0.5, s.y - L.hexR * 1.5, Math.round(total) + (e.crit ? '!' : ''), DMG_COLORS[e.dmgType], size, e.crit || e.kind === 'ability');
        return;
      }
      case 'heal': {
        if (!showNumbers || e.amount < 12) return;
        const p = unitPos(e.tgt);
        if (!p) return;
        const s = worldToScreen(L, p);
        this.text(s.x, s.y - L.hexR * 1.3, '+' + Math.round(e.amount), '#7ef08a', L.hexR * 0.32, false);
        return;
      }
      case 'shield': {
        const p = unitPos(e.tgt);
        if (!p) return;
        this.add({ kind: 'shield', t0: now, dur: 0.6, at: p, radius: 0.6, color: '#e8f4ff', color2: '#ffffff', seed: this.seed++ });
        return;
      }
      case 'death': {
        const p = unitPos(e.tgt);
        if (!p) return;
        const s = worldToScreen(L, p);
        this.burstParticles(s.x, s.y - L.hexR * 0.4, '#e8e0ff', 18, L.hexR);
        return;
      }
      case 'revive': {
        const p = unitPos(e.tgt);
        if (!p) return;
        this.add({ kind: 'rebirth', t0: now, dur: 0.9, at: p, radius: 0.9, color: '#fff2a0', color2: '#ffffff', seed: this.seed++ });
        return;
      }
      case 'summon': {
        const p = unitPos(e.tgt);
        if (!p) return;
        this.add({ kind: 'summon', t0: now, dur: 0.7, at: p, radius: 0.8, color: '#9ff3ff', color2: '#ffffff', seed: this.seed++ });
        return;
      }
      case 'text': {
        const p = unitPos(e.tgt);
        if (!p) return;
        const s = worldToScreen(L, p);
        this.text(s.x, s.y - L.hexR * 1.9, e.text, e.color ?? '#ffffff', L.hexR * 0.34, true);
        return;
      }
      case 'gold': {
        const p = unitPos(e.tgt);
        if (!p) return;
        const s = worldToScreen(L, p);
        this.text(s.x, s.y - L.hexR * 1.8, `+${e.amount} or`, '#ffd36b', L.hexR * 0.36, true);
        this.sparks(s.x, s.y - L.hexR * 1.2, '#ffd36b', 10, L.hexR);
        return;
      }
      case 'immune': {
        const p = unitPos(e.tgt);
        if (!p || !showNumbers) return;
        const s = worldToScreen(L, p);
        this.text(s.x, s.y - L.hexR * 1.6, 'Immunisé', '#d8e8ff', L.hexR * 0.26, false);
        return;
      }
      default:
        return;
    }
  }

  private add(e: Effect): void {
    this.effects.push(e);
    if (this.effects.length > 220) this.effects.shift();
  }

  private text(x: number, y: number, text: string, color: string, size: number, bold: boolean): void {
    this.texts.push({ x, y, vy: -size * 2.2, text, color, size, life: 0, max: 0.95, bold });
    if (this.texts.length > 90) this.texts.shift();
  }

  sparks(x: number, y: number, color: string, n: number, r: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.8 + Math.random() * 1.6) * r;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - r * 0.6, life: 0, max: 0.35 + Math.random() * 0.25, size: r * (0.04 + Math.random() * 0.04), color, gravity: r * 3 });
    }
    this.capParticles();
  }

  burstParticles(x: number, y: number, color: string, n: number, r: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random() * 1.4) * r;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * TILT - r * 0.9, life: 0, max: 0.5 + Math.random() * 0.4, size: r * (0.05 + Math.random() * 0.07), color, gravity: r * 2.2 });
    }
    this.capParticles();
  }

  private capParticles(): void {
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }

  update(dt: number, now: number): void {
    this.effects = this.effects.filter((e) => now - e.t0 < e.dur);
    for (const p of this.particles) {
      p.life += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 1.5;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const t of this.texts) {
      t.life += dt;
      t.y += t.vy * dt;
      t.vy *= 1 - dt * 2.4;
    }
    this.texts = this.texts.filter((t) => t.life < t.max);
    if (this.flash && now > this.flash.until) this.flash = null;
    this.shake = Math.max(0, this.shake - dt);
  }

  /** Effets au sol (sous les unités). */
  drawGround(ctx: CanvasRenderingContext2D, L: BoardLayout, now: number, zones: readonly Zone[], time: number): void {
    for (const z of zones) drawZone(ctx, L, z, time);
    for (const e of this.effects) {
      const k = (now - e.t0) / e.dur;
      const s = worldToScreen(L, e.at);
      const R = e.radius * L.hexR * 1.6;
      if (e.kind === 'ring' || e.kind === 'summon' || e.kind === 'rebirth') {
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = Math.max(2, L.hexR * 0.09 * (1 - k));
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, R * (0.3 + k * 0.8), R * (0.3 + k * 0.8) * TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = (1 - k) * 0.25;
        ctx.fillStyle = e.color;
        ctx.fill();
        ctx.restore();
      } else if (e.kind === 'warn') {
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.35 * k;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, R * k, R * k * TILT, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = e.color;
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, R, R * TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'sweep' && e.to === undefined) {
        // balayage : on dessine une bande lumineuse depuis le point d'origine
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.5;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, R * 1.2, R * 0.6 * TILT, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** Effets aériens (au-dessus des unités) et nombres flottants. */
  drawAir(ctx: CanvasRenderingContext2D, L: BoardLayout, now: number): void {
    for (const e of this.effects) {
      const k = Math.min(1, (now - e.t0) / e.dur);
      const s = worldToScreen(L, e.at);
      const R = e.radius * L.hexR * 1.5;
      ctx.save();
      switch (e.kind) {
        case 'burst': {
          const g = ctx.createRadialGradient(s.x, s.y - L.hexR * 0.4, 0, s.x, s.y - L.hexR * 0.4, R * (0.4 + k));
          g.addColorStop(0, e.color2);
          g.addColorStop(0.4, e.color);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 1 - k;
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(s.x, s.y - L.hexR * 0.4, R * (0.4 + k), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'pillar': {
          const w = L.hexR * (0.9 - k * 0.5) * Math.max(1, e.radius);
          const top = s.y - L.hexR * 9;
          const g = ctx.createLinearGradient(s.x, top, s.x, s.y);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.7, e.color);
          g.addColorStop(1, e.color2);
          ctx.globalAlpha = 1 - k * k;
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = g;
          ctx.fillRect(s.x - w / 2, top, w, s.y - top);
          break;
        }
        case 'beam': {
          if (!e.to) break;
          const t = worldToScreen(L, e.to);
          ctx.globalAlpha = 1 - k;
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = e.color;
          ctx.lineWidth = L.hexR * 0.14 * (1 - k * 0.6);
          ctx.lineCap = 'round';
          ctx.beginPath();
          const y0 = s.y - L.hexR * 0.7;
          const y1 = t.y - L.hexR * 0.7;
          // tracé légèrement zigzagué (arc électrique)
          const steps = 6;
          ctx.moveTo(s.x, y0);
          for (let i = 1; i < steps; i++) {
            const f = i / steps;
            const j = (Math.sin(e.seed * 13.7 + i * 2.1 + now * 30) * L.hexR) / 6;
            ctx.lineTo(s.x + (t.x - s.x) * f + j, y0 + (y1 - y0) * f - j);
          }
          ctx.lineTo(t.x, y1);
          ctx.stroke();
          ctx.lineWidth = L.hexR * 0.05;
          ctx.strokeStyle = e.color2;
          ctx.stroke();
          break;
        }
        case 'sweep': {
          const to = e.to ? worldToScreen(L, e.to) : null;
          ctx.globalAlpha = (1 - k) * 0.85;
          ctx.globalCompositeOperation = 'lighter';
          if (to) {
            ctx.strokeStyle = e.color;
            ctx.lineWidth = L.hexR * 1.1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(s.x, s.y - L.hexR * 0.4);
            ctx.lineTo(s.x + (to.x - s.x) * k, s.y - L.hexR * 0.4 + (to.y - s.y) * k);
            ctx.stroke();
          } else {
            const g = ctx.createRadialGradient(s.x, s.y - L.hexR * 0.3, 0, s.x, s.y - L.hexR * 0.3, R * (0.8 + k * 1.5));
            g.addColorStop(0, e.color2);
            g.addColorStop(0.5, e.color);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y - L.hexR * 0.3, R * (0.8 + k * 1.5), R * (0.8 + k * 1.5) * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'heal': {
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = e.color;
          for (let i = 0; i < 6; i++) {
            const a = e.seed * 3.1 + i * 1.05;
            const px = s.x + Math.cos(a) * L.hexR * 0.45;
            const py = s.y - L.hexR * (0.3 + k * 1.3 + (i % 3) * 0.15);
            plus(ctx, px, py, L.hexR * 0.12 * (1 - k * 0.5));
          }
          break;
        }
        case 'shield': {
          ctx.globalAlpha = (1 - k) * 0.7;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y - L.hexR * 0.75, L.hexR * (0.75 + k * 0.15), L.hexR * (0.95 + k * 0.15), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = (1 - k) * 0.15;
          ctx.fillStyle = e.color;
          ctx.fill();
          break;
        }
        case 'slash': {
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = e.color2;
          ctx.lineWidth = L.hexR * 0.1 * (1 - k);
          ctx.lineCap = 'round';
          const a0 = -2.4 + k * 1.6;
          ctx.beginPath();
          ctx.arc(s.x, s.y - L.hexR * 0.7, L.hexR * 0.6, a0, a0 + 1.6);
          ctx.stroke();
          ctx.strokeStyle = e.color;
          ctx.lineWidth = L.hexR * 0.05;
          ctx.stroke();
          break;
        }
        case 'mark': {
          ctx.globalAlpha = Math.sin(k * Math.PI);
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 2.5;
          const cy = s.y - L.hexR * 2.0;
          ctx.translate(s.x, cy);
          ctx.rotate(now * 3);
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            ctx.moveTo(Math.cos(a) * L.hexR * 0.15, Math.sin(a) * L.hexR * 0.15);
            ctx.lineTo(Math.cos(a) * L.hexR * 0.35, Math.sin(a) * L.hexR * 0.35);
          }
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, L.hexR * 0.25, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'summon':
        case 'rebirth': {
          ctx.globalAlpha = 1 - k;
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(s.x, s.y - L.hexR * 2.2, s.x, s.y);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, e.color);
          ctx.fillStyle = g;
          ctx.fillRect(s.x - L.hexR * 0.55, s.y - L.hexR * 2.2, L.hexR * 1.1, L.hexR * 2.2);
          break;
        }
        case 'trail': {
          if (!e.to) break;
          const t = worldToScreen(L, e.to);
          ctx.globalAlpha = (1 - k) * 0.7;
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, e.color);
          ctx.strokeStyle = g;
          ctx.lineWidth = L.hexR * 0.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y - L.hexR * 0.5);
          ctx.lineTo(t.x, t.y - L.hexR * 0.5);
          ctx.stroke();
          break;
        }
        default:
          break;
      }
      ctx.restore();
    }

    // particules
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const k = p.life / p.max;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // nombres flottants
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const pop = k < 0.12 ? 1 + (0.12 - k) * 3 : 1;
      ctx.font = `${t.bold ? 800 : 700} ${Math.round(t.size * pop)}px "Alegreya Sans", system-ui, sans-serif`;
      ctx.lineWidth = Math.max(2, t.size * 0.18);
      ctx.strokeStyle = 'rgba(10,8,24,0.85)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  drawScreenFlash(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
    if (!this.flash) return;
    const k = 1 - (this.flash.until - now) / this.flash.dur;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.28 * (1 - k));
    ctx.fillStyle = this.flash.color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function plus(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillRect(x - s, y - s / 3, s * 2, (s * 2) / 3);
  ctx.fillRect(x - s / 3, y - s, (s * 2) / 3, s * 2);
}

function drawZone(ctx: CanvasRenderingContext2D, L: BoardLayout, z: Zone, time: number): void {
  const r = recipe(z.vfx);
  if (r.kind === 'none') return;
  const fade = Math.min(1, z.remaining / 0.4, (z.total - z.remaining) / 0.25 + 0.2);
  ctx.save();
  ctx.globalAlpha = 0.9 * fade;
  if (z.hexes) {
    // cases transformées (étoiles)
    for (const h of z.hexes) {
      const s = worldToScreen(L, hexToWorld(h));
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(1, TILT);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, L.hexR);
      g.addColorStop(0, r.color2);
      g.addColorStop(0.6, r.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.35 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, L.hexR * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9 * fade;
      ctx.rotate(time * 0.8);
      star(ctx, 0, 0, L.hexR * 0.5, L.hexR * 0.2, r.color2);
      ctx.restore();
    }
    ctx.restore();
    return;
  }
  if (!z.center) {
    ctx.restore();
    return;
  }
  const s = worldToScreen(L, hexToWorld(z.center));
  const R = (z.radius + 0.5) * L.hexR * Math.sqrt(3);
  ctx.translate(s.x, s.y);
  ctx.scale(1, TILT);
  if (/whirl|black|singular/i.test(z.vfx)) {
    const dark = /black|singular/i.test(z.vfx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, dark ? 'rgba(5,2,15,0.95)' : 'rgba(20,90,100,0.6)');
    g.addColorStop(0.55, dark ? 'rgba(80,40,160,0.45)' : 'rgba(60,200,200,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const rot = time * (dark ? -2.5 : 3) + i * 2.1;
      for (let a = 0; a < Math.PI * 3; a += 0.15) {
        const rr = R * (0.15 + (a / (Math.PI * 3)) * 0.8);
        const x = Math.cos(a + rot) * rr;
        const y = Math.sin(a + rot) * rr;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.5 * fade;
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -time * 20;
    ctx.globalAlpha = 0.75 * fade;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.12 * fade;
    ctx.fillStyle = r.color;
    ctx.fill();
  }
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? r1 : r2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

/** Dessine un projectile en vol. */
export function drawProjectile(ctx: CanvasRenderingContext2D, L: BoardLayout, p: Projectile, alpha: number): void {
  const pos = { x: p.prev.x + (p.pos.x - p.prev.x) * alpha, y: p.prev.y + (p.pos.y - p.prev.y) * alpha };
  const s = worldToScreen(L, pos);
  const y = s.y - L.hexR * 0.75;
  const dx = p.pos.x - p.prev.x;
  const dy = (p.pos.y - p.prev.y) * TILT;
  const ang = Math.atan2(dy, dx);
  const r = recipe(p.vfx);
  const R = L.hexR;
  ctx.save();
  ctx.translate(s.x, y);
  ctx.rotate(ang);
  const key = p.vfx.toLowerCase();
  if (/arrow|thorn|harpoon|bolt(?!chain)|pellet/.test(key) && !/holy|moon|clock|void|water|star|leaf|wind/.test(key)) {
    ctx.strokeStyle = r.color2;
    ctx.lineWidth = Math.max(1.5, R * 0.05);
    ctx.beginPath();
    ctx.moveTo(-R * 0.45, 0);
    ctx.lineTo(R * 0.2, 0);
    ctx.stroke();
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.moveTo(R * 0.3, 0);
    ctx.lineTo(R * 0.12, -R * 0.08);
    ctx.lineTo(R * 0.12, R * 0.08);
    ctx.fill();
  } else if (/beam|wave|broadside/.test(key)) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(-R * 1.2, 0, R * 0.4, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, r.color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(-R * 0.3, 0, R * 0.9, R * (/wave/.test(key) ? 0.45 : 0.18), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = r.color2;
    ctx.beginPath();
    ctx.ellipse(R * 0.2, 0, R * 0.25, R * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (/coin/.test(key)) {
    ctx.fillStyle = '#ffd36b';
    ctx.strokeStyle = '#8a5a14';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.14, R * 0.14 * Math.abs(Math.sin(performance.now() / 60)) + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // orbe lumineux (boules de feu, éclats d'étoile, traits magiques)
    ctx.globalCompositeOperation = 'lighter';
    const size = /fireball|firebomb|nova|cannon|flask/.test(key) ? R * 0.28 : R * 0.17;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.2);
    g.addColorStop(0, r.color2);
    g.addColorStop(0.35, r.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.ellipse(-size * 1.6, 0, size * 1.8, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
