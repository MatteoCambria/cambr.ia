/**
 * Rendu Canvas 2D du plateau, de la réserve et du combat. Le rendu ne fait que lire
 * l'état (préparation) ou la simulation (combat) : il n'influence jamais les calculs.
 */
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS, COMBAT, PLAYER_ROWS } from '../config/balance';
import { findConsumable, findItem, getChampion } from '../core/content';
import type { CombatSim } from '../combat/sim';
import type { CombatUnit } from '../combat/unit';
import { hexDistance, hexToWorld, neighbors, type Hex, type Vec2 } from '../board/hex';
import type { OwnedUnit, PlayerState } from '../game/types';
import type { DragState } from '../app/controller';
import { drawUnit, type AnimKind } from './sprites';
import { drawArenaBackground, drawHexTile } from './arenaArt';
import { drawIcon, type IconKey } from './icons';
import { benchSlotCenter, combatHexToScreen, computeLayout, localToCombat, pickCell, TILT, worldToScreen, type BoardLayout, type Pick } from './layout';
import { VfxSystem, drawProjectile } from './vfx';

export interface RenderInput {
  time: number;
  dt: number;
  me: PlayerState | null;
  live: { sim: CombatSim; alpha: number } | null;
  locked: boolean;
  drag: DragState | null;
  hoverUid: string | null;
  selectedUid: string | null;
  hoverCombatId: number | null;
  pointer: Vec2 | null;
  showNumbers: boolean;
  reduceMotion: boolean;
  mood: 'prep' | 'combat' | 'final';
  /** Plateau adverse à afficher en préparation (repérage). */
  ghostBoard?: { defId: string; star: number; items: string[]; col: number; row: number }[] | null;
}

interface DrawnUnit {
  x: number;
  y: number;
  uid?: string;
  combatId?: number;
}

const STATUS_ICON: Partial<Record<string, IconKey>> = {
  stun: 'stun',
  root: 'root',
  disarm: 'disarm',
  silence: 'silence',
  taunt: 'taunt',
  burn: 'burn',
  poison: 'poison',
  bleed: 'bleed',
  untargetable: 'untargetable',
  invulnerable: 'invulnerable',
  ccImmune: 'ccImmune',
  reflect: 'reflect',
  link: 'link',
  stasis: 'stasis',
};

const TAG_ICON: Record<string, IconKey> = {
  Brèche: 'sunder',
  Corrosion: 'shred',
  Dissous: 'shred',
  Marqué: 'mark',
  Blessure: 'wound',
  Ralenti: 'slow',
  Alourdi: 'slow',
  Givré: 'slow',
  Trempé: 'slow',
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export class BoardRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  L: BoardLayout;
  vfx = new VfxSystem();
  private simRef: CombatSim | null = null;
  private eventCursor = 0;
  drawn: DrawnUnit[] = [];
  private cssW = 0;
  private cssH = 0;
  private tileLayer: HTMLCanvasElement | null = null;
  private tileSig = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.L = computeLayout(800, 600);
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssW = w;
    this.cssH = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.L = computeLayout(w, h);
  }

  pick(x: number, y: number): Pick {
    return pickCell(this.L, x, y);
  }

  /** Unité sous le pointeur (plateau, réserve ou combat). */
  pickUnit(x: number, y: number): DrawnUnit | null {
    const R = this.L.hexR;
    let best: DrawnUnit | null = null;
    let bestD = Infinity;
    for (const d of this.drawn) {
      if (Math.abs(x - d.x) > R * 0.62) continue;
      if (y < d.y - R * 1.75 || y > d.y + R * 0.35) continue;
      const dist = Math.abs(x - d.x) + Math.abs(y - (d.y - R * 0.7)) * 0.5;
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  render(inp: RenderInput): void {
    const ctx = this.ctx;
    const L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // tremblement d'écran discret lors des impacts importants
    const shake = !inp.reduceMotion && this.vfx.shake > 0 ? this.vfx.shake * L.hexR * 0.08 : 0;
    drawArenaBackground(ctx, this.cssW, this.cssH, inp.time, inp.mood);
    if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // Ingestion des événements de combat
    const sim = inp.live?.sim ?? null;
    if (sim !== this.simRef) {
      this.simRef = sim;
      this.eventCursor = 0;
      this.vfx.reset();
    }
    if (sim) {
      for (; this.eventCursor < sim.events.length; this.eventCursor++) this.vfx.ingest(sim.events[this.eventCursor], sim, L, inp.time, inp.showNumbers, inp.reduceMotion);
    }
    this.vfx.update(inp.dt, inp.time);

    this.drawTiles(inp);
    this.vfx.drawGround(ctx, L, inp.time, sim ? sim.zones : [], inp.time);
    this.drawBench(inp);

    this.drawn = [];
    if (sim && inp.live) this.drawCombatUnits(inp, sim, inp.live.alpha);
    else this.drawPlanningUnits(inp);
    this.drawBenchUnits(inp);

    if (sim && inp.live) for (const p of sim.projectiles) drawProjectile(ctx, L, p, inp.live.alpha);
    this.vfx.drawAir(ctx, L, inp.time);
    this.drawDragGhost(inp);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.vfx.drawScreenFlash(ctx, this.cssW, this.cssH, inp.time);
  }

  // ── Plateau ───────────────────────────────────────────────────────────────
  private drawTiles(inp: RenderInput): void {
    const ctx = this.ctx;
    const L = this.L;
    const me = inp.me;
    // cases mises en évidence
    const range = new Set<number>();
    const adjacency = new Set<number>();
    const key = (h: Hex) => h.row * BOARD_COLS + h.col;
    let target: number | null = null;
    let targetValid = true;
    const focusUid = inp.drag?.source.kind === 'unit' ? inp.drag.source.uid : inp.hoverUid ?? inp.selectedUid;
    if (me && !inp.live && focusUid) {
      const slot = me.board.find((s) => s.uid === focusUid);
      const unit = slot ?? me.bench.find((u) => u?.uid === focusUid) ?? null;
      let origin: Hex | null = slot ? localToCombat(slot) : null;
      if (inp.drag && inp.drag.over?.kind === 'board') origin = localToCombat(inp.drag.over);
      if (unit && origin) {
        const def = getChampion(unit.defId);
        const r = def.stats.range;
        for (let row = 0; row < BOARD_ROWS; row++)
          for (let col = 0; col < BOARD_COLS; col++) {
            const h = { col, row };
            const d = hexDistance(origin, h);
            if (d > 0 && d <= r) range.add(key(h));
          }
        const adjEffect = def.traits.includes('gardien') || def.id === 'orrheon' || def.id === 'valerian' || def.id === 'taliya' || unit.items.includes('linceul');
        if (adjEffect) for (const n of neighbors(origin)) if (n.row >= PLAYER_ROWS) adjacency.add(key(n));
      }
    }
    if (inp.drag && inp.drag.over?.kind === 'board') {
      target = key(localToCombat(inp.drag.over));
      if (inp.drag.source.kind === 'unit' && me) {
        const fromBench = me.bench.some((u) => u?.uid === (inp.drag!.source as { uid: string }).uid);
        const occupied = me.board.some((s) => s.col === (inp.drag!.over as { col: number }).col && s.row === (inp.drag!.over as { row: number }).row);
        if (fromBench && !occupied && me.board.length >= me.level) targetValid = false;
      }
    }
    const dragging = !!inp.drag && inp.drag.source.kind === 'unit' && !inp.locked;
    // Les cases ne changent que lors d'un survol, d'un glisser ou d'un changement de phase :
    // on les dessine dans un calque mis en cache, réutilisé tant que leur état est identique.
    const states: string[] = [];
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const k = key({ col, row });
        const own = row >= PLAYER_ROWS;
        let highlight: 'none' | 'hover' | 'valid' | 'invalid' | 'range' | 'zone' = 'none';
        if (target === k) highlight = targetValid ? 'hover' : 'invalid';
        else if (adjacency.has(k)) highlight = 'zone';
        else if (range.has(k)) highlight = 'range';
        else if (dragging && own) highlight = 'valid';
        states.push(highlight);
      }
    }
    const sig = `${L.width}x${L.height}|${this.dpr}|${inp.live ? 1 : 0}|${states.join(',')}`;
    if (sig !== this.tileSig || !this.tileLayer) {
      this.tileSig = sig;
      const layer = this.tileLayer ?? document.createElement('canvas');
      layer.width = Math.round(L.width * this.dpr);
      layer.height = Math.round(L.height * this.dpr);
      const lctx = layer.getContext('2d')!;
      lctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      lctx.clearRect(0, 0, L.width, L.height);
      let i = 0;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const c = combatHexToScreen(L, { col, row });
          const own = row >= PLAYER_ROWS;
          lctx.save();
          lctx.translate(c.x, c.y);
          lctx.scale(1, TILT);
          drawHexTile(lctx, 0, 0, L.hexR * 0.97, { owner: inp.live ? (own ? 0 : 1) : own ? 0 : -1, highlight: states[i++] as 'none', parity: (col + row) & 1 });
          lctx.restore();
        }
      }
      this.tileLayer = layer;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.tileLayer, 0, 0);
    ctx.restore();
  }

  private drawBench(inp: RenderInput): void {
    const ctx = this.ctx;
    const L = this.L;
    for (let i = 0; i < BENCH_SIZE; i++) {
      const c = benchSlotCenter(L, i);
      const over = inp.drag?.over?.kind === 'bench' && inp.drag.over.index === i;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(1, TILT);
      drawHexTile(ctx, 0, 0, L.benchSlotR, { owner: 0, highlight: over ? 'hover' : 'none', parity: i & 1 });
      ctx.restore();
    }
  }

  private unitTime(seed: string): number {
    return (hashStr(seed) % 1000) / 137;
  }

  private drawPlanningUnits(inp: RenderInput): void {
    const ctx = this.ctx;
    const L = this.L;
    const me = inp.me;
    // repérage : plateau adverse fantôme dans la moitié haute
    if (inp.ghostBoard) {
      for (const g of inp.ghostBoard) {
        const h = { col: BOARD_COLS - 1 - g.col, row: PLAYER_ROWS - 1 - g.row };
        const c = combatHexToScreen(L, h);
        const def = getChampion(g.defId);
        drawUnit(ctx, def.look, { x: c.x, y: c.y, size: L.hexR, facing: -1, time: inp.time + this.unitTime(g.defId + g.col), anim: 'idle', animT: 0, team: 1, star: g.star as 1 | 2 | 3, alpha: 0.75 });
        this.drawPips(c.x, c.y, g.star, g.items, 1);
      }
    }
    if (!me) return;
    const sorted = me.board.slice().sort((a, b) => a.row - b.row || a.col - b.col);
    for (const s of sorted) {
      const c = combatHexToScreen(L, localToCombat(s));
      const dragging = inp.drag?.source.kind === 'unit' && inp.drag.source.uid === s.uid;
      const def = getChampion(s.defId);
      drawUnit(ctx, def.look, {
        x: c.x,
        y: c.y,
        size: L.hexR,
        facing: 1,
        time: inp.time + this.unitTime(s.uid),
        anim: 'idle',
        animT: 0,
        team: 0,
        star: s.star,
        hovered: inp.hoverUid === s.uid,
        selected: inp.selectedUid === s.uid,
        silhouetteOnly: dragging,
        alpha: dragging ? 0.35 : 1,
        scale: s.star === 3 ? 1.08 : s.star === 2 ? 1.03 : 1,
      });
      this.drawn.push({ x: c.x, y: c.y, uid: s.uid });
      if (!dragging) this.drawPips(c.x, c.y, s.star, s.items, 0);
    }
  }

  private drawBenchUnits(inp: RenderInput): void {
    const ctx = this.ctx;
    const L = this.L;
    const me = inp.me;
    if (!me) return;
    me.bench.forEach((u, i) => {
      if (!u) return;
      const c = benchSlotCenter(L, i);
      const dragging = inp.drag?.source.kind === 'unit' && inp.drag.source.uid === u.uid;
      const def = getChampion(u.defId);
      const sz = L.benchSlotR * 0.95;
      drawUnit(ctx, def.look, {
        x: c.x,
        y: c.y + sz * 0.15,
        size: sz,
        facing: 1,
        time: inp.time + this.unitTime(u.uid),
        anim: 'idle',
        animT: 0,
        team: 0,
        star: u.star,
        hovered: inp.hoverUid === u.uid,
        selected: inp.selectedUid === u.uid,
        silhouetteOnly: dragging,
        alpha: dragging ? 0.35 : 1,
      });
      this.drawn.push({ x: c.x, y: c.y + sz * 0.15, uid: u.uid });
      if (!dragging) this.drawPips(c.x, c.y + sz * 0.15, u.star, u.items, 0, sz);
    });
  }

  /** Étoiles et objets sous une unité. */
  private drawPips(x: number, y: number, star: number, items: readonly string[], team: 0 | 1, size = this.L.hexR): void {
    const ctx = this.ctx;
    const pipY = y - size * 1.86;
    const col = star === 3 ? '#ffd36b' : star === 2 ? '#dfe7f5' : '#c88a5a';
    ctx.save();
    for (let i = 0; i < star; i++) {
      const px = x + (i - (star - 1) / 2) * size * 0.26;
      starShape(ctx, px, pipY, size * 0.12, size * 0.055, col);
    }
    if (items.length) {
      const s = size * 0.3;
      items.forEach((id, i) => {
        const ix = x + (i - (items.length - 1) / 2) * (s + 2);
        const iy = y + size * 0.22;
        ctx.fillStyle = 'rgba(12,10,28,0.85)';
        ctx.strokeStyle = team === 0 ? 'rgba(227,194,122,0.9)' : 'rgba(230,120,100,0.9)';
        ctx.lineWidth = 1.2;
        roundRect(ctx, ix - s / 2, iy - s / 2, s, s, 3);
        ctx.fill();
        ctx.stroke();
        const it = itemIcon(id);
        drawIcon(ctx, it.icon, ix, iy, s * 0.82, it.color);
      });
    }
    ctx.restore();
  }

  // ── Combat ────────────────────────────────────────────────────────────────
  private drawCombatUnits(inp: RenderInput, sim: CombatSim, alpha: number): void {
    const ctx = this.ctx;
    const L = this.L;
    const simTime = sim.time + alpha * COMBAT.dt;
    const units = sim.units
      .filter((u) => u.alive || simTime - u.deathTime < 0.9)
      .map((u) => ({ u, p: this.interpWorld(u, alpha) }))
      .sort((a, b) => a.p.y - b.p.y);
    const bars: { u: CombatUnit; x: number; y: number }[] = [];
    for (const { u, p } of units) {
      const s = worldToScreen(L, p);
      const anim = this.combatAnim(u, simTime);
      const flash = u.alive ? Math.max(0, 1 - (simTime - u.lastHitAt) / 0.14) : 0;
      let lift = 0;
      if (u.move && u.move.kind === 'leap') lift = Math.sin(Math.min(1, u.move.t / u.move.dur) * Math.PI) * L.hexR * 1.6;
      const target = u.targetId !== null ? sim.unit(u.targetId) : null;
      const aim = target ? worldToScreen(L, sim.unitWorld(target)) : null;
      const size = u.kind === 'champion' ? L.hexR : L.hexR * 0.95;
      if (u.stasis) {
        drawEgg(ctx, s.x, s.y, L.hexR, inp.time);
      } else {
        drawUnit(ctx, u.ident.look, {
          x: s.x,
          y: s.y - lift,
          size,
          facing: u.facing,
          time: inp.time + (u.id % 7) * 0.37,
          anim: anim.kind,
          animT: anim.t,
          aimX: aim?.x,
          aimY: aim ? aim.y - L.hexR * 0.6 : undefined,
          flash,
          alpha: u.alive ? (u.isUntargetable ? 0.55 : 1) : Math.max(0, 1 - (simTime - u.deathTime) / 0.9),
          scale: u.scale * (u.ident.look.scale ?? 1),
          team: u.side,
          star: u.kind === 'champion' ? (u.ident.star as 1 | 2 | 3) : undefined,
          hovered: inp.hoverCombatId === u.id,
        });
      }
      if (u.alive) {
        bars.push({ u, x: s.x, y: s.y - lift });
        this.drawn.push({ x: s.x, y: s.y, combatId: u.id });
      }
    }
    for (const b of bars) this.drawBars(b.u, b.x, b.y);
  }

  private interpWorld(u: CombatUnit, alpha: number): Vec2 {
    if (u.move) {
      const a = hexToWorld(u.move.from);
      const b = hexToWorld(u.move.to);
      const t = Math.min(1, (u.move.t + alpha * COMBAT.dt) / u.move.dur);
      const e = u.move.kind === 'walk' ? t : 1 - Math.pow(1 - t, 3);
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
    return hexToWorld(u.hex);
  }

  private combatAnim(u: CombatUnit, simTime: number): { kind: AnimKind; t: number } {
    if (!u.alive) return { kind: 'death', t: Math.min(1, (simTime - u.deathTime) / 0.9) };
    if (u.isStunned) return { kind: 'stunned', t: 0 };
    if (u.move && u.move.kind === 'leap') return { kind: 'leap', t: Math.min(1, u.move.t / u.move.dur) };
    if (u.state === 'casting') return { kind: 'cast', t: u.castTotal > 0 ? 1 - u.castLeft / u.castTotal : 1 };
    const interval = 1 / u.stats.as;
    const windup = Math.min(COMBAT.maxWindup, Math.max(COMBAT.minWindup, interval * COMBAT.windupFraction));
    const animDur = Math.min(interval, windup / 0.35);
    const sinceAttack = simTime - u.lastAttackAt;
    if (sinceAttack >= 0 && sinceAttack < animDur) return { kind: 'attack', t: sinceAttack / animDur };
    if (u.move) return { kind: 'walk', t: Math.min(1, u.move.t / u.move.dur) };
    if (simTime - u.lastHitAt < 0.18) return { kind: 'hit', t: (simTime - u.lastHitAt) / 0.18 };
    return { kind: 'idle', t: 0 };
  }

  private drawBars(u: CombatUnit, x: number, y: number): void {
    const ctx = this.ctx;
    const L = this.L;
    const s = u.stats;
    const w = L.hexR * (u.kind === 'champion' ? 1.15 : 0.9);
    const h = Math.max(5, L.hexR * 0.12);
    const top = y - L.hexR * 1.95 * u.scale * (u.ident.look.scale ?? 1);
    const left = x - w / 2;
    const ally = u.side === 0;
    ctx.save();
    // fond
    ctx.fillStyle = 'rgba(8,6,20,0.85)';
    roundRect(ctx, left - 1.5, top - 1.5, w + 3, h + (u.hasAbility ? h * 0.55 + 2 : 0) + 3, 3);
    ctx.fill();
    const maxTotal = Math.max(s.maxHp, u.hp + u.shieldTotal);
    const hpW = (u.hp / maxTotal) * w;
    const shW = (u.shieldTotal / maxTotal) * w;
    const grad = ctx.createLinearGradient(left, top, left, top + h);
    if (ally) {
      grad.addColorStop(0, '#9ff08a');
      grad.addColorStop(1, '#3fa64f');
    } else {
      grad.addColorStop(0, '#ff8a76');
      grad.addColorStop(1, '#b8352a');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(left, top, hpW, h);
    if (shW > 0) {
      ctx.fillStyle = 'rgba(240,244,255,0.92)';
      ctx.fillRect(left + hpW, top, shW, h);
    }
    // graduations tous les 300 PV
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    for (let v = 300; v < maxTotal; v += 300) {
      const gx = left + (v / maxTotal) * w;
      ctx.beginPath();
      ctx.moveTo(gx, top);
      ctx.lineTo(gx, top + (v % 1500 === 0 ? h : h * 0.5));
      ctx.stroke();
    }
    if (u.hasAbility) {
      const mh = h * 0.55;
      ctx.fillStyle = 'rgba(40,40,80,0.9)';
      ctx.fillRect(left, top + h + 2, w, mh);
      const full = u.mana >= s.maxMana;
      ctx.fillStyle = u.isSilenced ? '#666a80' : full ? '#d9f3ff' : '#4fa8ff';
      ctx.fillRect(left, top + h + 2, (Math.min(u.mana, s.maxMana) / s.maxMana) * w, mh);
    }
    // étoiles
    if (u.kind === 'champion') {
      const col = u.ident.star === 3 ? '#ffd36b' : u.ident.star === 2 ? '#dfe7f5' : '#c88a5a';
      for (let i = 0; i < u.ident.star; i++) starShape(ctx, left + 5 + i * L.hexR * 0.2, top - h * 0.9, L.hexR * 0.09, L.hexR * 0.04, col);
    }
    // statuts
    const icons: IconKey[] = [];
    for (const st of u.statuses) {
      const k = (st.tag && TAG_ICON[st.tag]) || STATUS_ICON[st.kind];
      if (k && !icons.includes(k)) icons.push(k);
      if (icons.length >= 4) break;
    }
    const isz = L.hexR * 0.26;
    icons.forEach((k, i) => drawIcon(ctx, k, left + w - isz / 2 - i * (isz + 1), top - isz * 0.75, isz, '#ffffff'));
    ctx.restore();
  }

  private drawDragGhost(inp: RenderInput): void {
    const d = inp.drag;
    const me = inp.me;
    if (!d || d.source.kind !== 'unit' || !me) return;
    const uid = d.source.uid;
    const u: OwnedUnit | undefined = me.board.find((s) => s.uid === uid) ?? me.bench.find((b) => b?.uid === uid) ?? undefined;
    if (!u) return;
    const def = getChampion(u.defId);
    drawUnit(this.ctx, def.look, { x: d.x, y: d.y + this.L.hexR * 0.6, size: this.L.hexR, facing: 1, time: inp.time, anim: 'leap', animT: 0.5, team: 0, star: u.star, alpha: 0.95 });
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starShape(ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(20,14,30,0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? r1 : r2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawEgg(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, time: number): void {
  ctx.save();
  const pulse = 1 + Math.sin(time * 8) * 0.04;
  const g = ctx.createRadialGradient(x, y - R * 0.6, R * 0.1, x, y - R * 0.6, R * 0.8);
  g.addColorStop(0, '#fff2b0');
  g.addColorStop(0.5, '#f0a030');
  g.addColorStop(1, '#5a2a10');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y - R * 0.55, R * 0.42 * pulse, R * 0.58 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd36b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function itemIcon(id: string): { icon: IconKey; color: string } {
  const it = findItem(id);
  if (it) return { icon: it.icon as IconKey, color: it.color };
  const c = findConsumable(id);
  return { icon: (c?.icon ?? 'key') as IconKey, color: c?.color ?? '#ffffff' };
}
