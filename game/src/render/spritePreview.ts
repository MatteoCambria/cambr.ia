/**
 * Planche de vérification visuelle (sprite-preview.html).
 * Paramètres d'URL : ?t=secondes (fige le temps), ?anim=attack&at=0.35 (force une
 * animation et sa progression), ?only=arena,grid,strip,portraits,icons, ?bench=1.
 */
import { drawUnit } from './sprites';
import type { AnimKind, DrawUnitOpts } from './sprites';
import { DEMO_LOOKS } from './art/previewLooks';
import { drawArenaBackground, drawHexTile } from './arenaArt';
import type { HexTileState } from './arenaArt';
import { portraitCanvas, portraitDataUrl } from './portraits';
import { ICON_KEYS, drawIcon, iconDataUrl } from './icons';
import type { IconKey } from './icons';
import { benchSlotCenter, combatHexToScreen, computeLayout, TILT } from './layout';
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS } from '../config/balance';

const ANIMS: AnimKind[] = ['idle', 'walk', 'attack', 'cast', 'hit', 'stunned', 'death', 'leap'];
const ANIM_LEN: Record<AnimKind, number> = {
  idle: 2.2,
  walk: 1.8,
  attack: 0.9,
  cast: 1.4,
  hit: 0.6,
  stunned: 1.6,
  death: 1.6,
  leap: 1.1,
};

const params = new URLSearchParams(location.search);
const frozenT = params.has('t') ? parseFloat(params.get('t') ?? '0') : null;
const forcedAnim = (params.get('anim') as AnimKind | null) ?? null;
const forcedAt = params.has('at') ? parseFloat(params.get('at') ?? '0') : null;
const only = params.get('only')?.split(',') ?? null;
const dpr = Math.min(2, window.devicePixelRatio || 1);

const root = document.getElementById('root') as HTMLElement;
const animSel = document.getElementById('anim') as HTMLSelectElement;
const slowBox = document.getElementById('slow') as HTMLInputElement;
const clock = document.getElementById('clock') as HTMLElement;

for (const a of ['cycle', ...ANIMS]) {
  const o = document.createElement('option');
  o.value = a;
  o.textContent = a === 'cycle' ? 'toutes (en boucle)' : a;
  animSel.appendChild(o);
}
if (forcedAnim) animSel.value = forcedAnim;

function section(id: string, title: string, note?: string): HTMLElement | null {
  if (only && !only.includes(id)) return null;
  const h = document.createElement('h2');
  h.textContent = title;
  root.appendChild(h);
  if (note) {
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = note;
    root.appendChild(p);
  }
  const s = document.createElement('section');
  s.id = id;
  root.appendChild(s);
  return s;
}

function makeCanvas(parent: HTMLElement, w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  parent.appendChild(c);
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d indisponible');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}

/** Animation courante d'une cellule (cycle de toutes les animations). */
function animFor(time: number, offset: number): { anim: AnimKind; t: number } {
  const sel = animSel.value;
  if (sel !== 'cycle') {
    const a = sel as AnimKind;
    const L = ANIM_LEN[a];
    return { anim: a, t: forcedAt ?? ((time + offset) % L) / L };
  }
  const total = ANIMS.reduce((s, a) => s + ANIM_LEN[a], 0);
  let u = (time + offset) % total;
  for (const a of ANIMS) {
    if (u < ANIM_LEN[a]) return { anim: a, t: u / ANIM_LEN[a] };
    u -= ANIM_LEN[a];
  }
  return { anim: 'idle', t: 0 };
}

function panelBg(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, '#1a1538');
  gr.addColorStop(1, '#110e28');
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(232,196,106,0.18)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

type Painter = (time: number) => void;
const painters: Painter[] = [];


// ---------------------------------------------------------------------------
// Arène complète (mise en page réelle du plateau)

type Mood = 'prep' | 'combat' | 'final';
const mood = (params.get('mood') as Mood | null) ?? 'combat';

interface Placed {
  id: number;
  col: number;
  row: number;
  anim: AnimKind;
  facing: 1 | -1;
  star: 1 | 2 | 3;
  sel?: boolean;
  hov?: boolean;
}

const ARENA_UNITS: Placed[] = [
  { id: 0, col: 1, row: 4, anim: 'attack', facing: 1, star: 2 },
  { id: 1, col: 3, row: 4, anim: 'idle', facing: 1, star: 3, sel: true },
  { id: 24, col: 4, row: 4, anim: 'walk', facing: 1, star: 1 },
  { id: 16, col: 2, row: 5, anim: 'attack', facing: 1, star: 1 },
  { id: 8, col: 5, row: 5, anim: 'cast', facing: -1, star: 2 },
  { id: 3, col: 0, row: 6, anim: 'attack', facing: 1, star: 1 },
  { id: 12, col: 6, row: 4, anim: 'idle', facing: -1, star: 1, hov: true },
  { id: 57, col: 3, row: 6, anim: 'idle', facing: 1, star: 2 },
  { id: 20, col: 1, row: 7, anim: 'attack', facing: 1, star: 3 },
  { id: 40, col: 1, row: 3, anim: 'hit', facing: -1, star: 2 },
  { id: 43, col: 3, row: 3, anim: 'attack', facing: -1, star: 1 },
  { id: 45, col: 5, row: 2, anim: 'attack', facing: -1, star: 1 },
  { id: 41, col: 2, row: 1, anim: 'cast', facing: -1, star: 2 },
  { id: 47, col: 4, row: 3, anim: 'stunned', facing: -1, star: 1 },
  { id: 44, col: 6, row: 2, anim: 'walk', facing: -1, star: 1 },
  { id: 46, col: 4, row: 0, anim: 'death', facing: -1, star: 1 },
  { id: 27, col: 0, row: 2, anim: 'idle', facing: 1, star: 1 },
  { id: 53, col: 5, row: 6, anim: 'leap', facing: -1, star: 1 },
  { id: 33, col: 2, row: 0, anim: 'idle', facing: 1, star: 3 },
  { id: 59, col: 6, row: 6, anim: 'attack', facing: -1, star: 2 },
];
const BENCH_IDS = [5, 13, 21, 30, 36, 61, 64];

function paintArena(g: CanvasRenderingContext2D, W: number, H: number, time: number, m: Mood, parts = 7): void {
  const L = computeLayout(W, H);
  if (parts & 1) drawArenaBackground(g, W, H, time, m);
  if (parts & 2) {
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const c = combatHexToScreen(L, { col, row });
      let hl: HexTileState['highlight'] = 'none';
      if (row === 5 && col === 4) hl = 'hover';
      if (row === 7 && (col === 5 || col === 6)) hl = 'valid';
      if (row === 6 && col === 2) hl = 'invalid';
      if (row === 2 && (col === 2 || col === 3)) hl = 'range';
      if (row === 1 && (col === 0 || col === 1)) hl = 'zone';
      g.save();
      g.translate(c.x, c.y);
      g.scale(1, TILT);
      drawHexTile(g, 0, 0, L.hexR * 0.97, { owner: row >= 4 ? 0 : 1, highlight: hl, parity: (col + row) & 1 });
      g.restore();
    }
  }
  for (let i = 0; i < BENCH_SIZE; i++) {
    const c = benchSlotCenter(L, i);
    g.save();
    g.translate(c.x, c.y);
    g.scale(1, TILT);
    drawHexTile(g, 0, 0, L.benchSlotR, { owner: 0, highlight: i === 7 ? 'hover' : 'none', parity: i & 1 });
    g.restore();
  }
  }
  if (!(parts & 4)) return;
  const sorted = ARENA_UNITS.slice().sort((a, b) => a.row - b.row);
  for (const u of sorted) {
    const c = combatHexToScreen(L, { col: u.col, row: u.row });
    const d = DEMO_LOOKS[u.id % DEMO_LOOKS.length];
    const L0 = ANIM_LEN[u.anim];
    const t = forcedAt ?? ((time + u.id * 0.31) % L0) / L0;
    const o: DrawUnitOpts = {
      x: c.x,
      y: c.y,
      size: L.hexR,
      facing: u.facing,
      time: time + u.id * 0.7,
      anim: u.anim,
      animT: t,
      aimX: c.x + u.facing * L.hexR * 2,
      aimY: c.y + (u.row >= 4 ? -L.hexR : L.hexR) * 0.5,
      team: u.row >= 4 ? 0 : 1,
      star: u.star,
      selected: u.sel,
      hovered: u.hov,
      flash: u.anim === 'hit' ? Math.max(0, 1 - t * 4) : 0,
    };
    drawUnit(g, d.look, o);
  }
  BENCH_IDS.forEach((id, i) => {
    const c = benchSlotCenter(L, i);
    const sz = L.benchSlotR * 0.95;
    drawUnit(g, DEMO_LOOKS[id].look, {
      x: c.x,
      y: c.y + sz * 0.15,
      size: sz,
      facing: 1,
      time: time + i,
      anim: 'idle',
      animT: 0,
      team: 0,
      star: ((i % 3) + 1) as 1 | 2 | 3,
      silhouetteOnly: i === 3,
      alpha: i === 3 ? 0.35 : 1,
    });
  });
  // Quelques icônes de statut au-dessus des unités
  const st: IconKey[] = ['stun', 'burn', 'poison', 'buffAd'];
  st.forEach((k, i) => {
    const c = combatHexToScreen(L, { col: 4, row: 3 });
    drawIcon(g, k, c.x - 30 + i * 20, c.y - L.hexR * 1.7, 18, ['#ffe680', '#ff8a3a', '#7dff8a', '#ffd36b'][i]);
  });
}

{
  const s = section('arena', `Arène — humeur « ${mood} » (?mood=prep|combat|final)`, 'Décor (ciel, Cœur-Horloge, orrery, plateforme, quai de réserve), cases hexagonales dans tous les états et ~20 unités animées, avec la mise en page réelle du plateau (layout.ts).');
  if (s) {
    const W = 1600;
    const H = 1000;
    const cssW = 1500;
    const c = document.createElement('canvas');
    c.width = Math.round(cssW * dpr);
    c.height = Math.round((cssW * H) / W * dpr);
    c.style.width = cssW + 'px';
    c.style.height = (cssW * H) / W + 'px';
    s.appendChild(c);
    const g = c.getContext('2d', { alpha: false });
    if (g) {
      const k = (cssW / W) * dpr;
      painters.push((time) => {
        g.setTransform(k, 0, 0, k, 0, 0);
        paintArena(g, W, H, time, mood);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Grille des combinaisons

{
  const s = section('grid', `Combinaisons (${DEMO_LOOKS.length}) — toutes les animations en boucle`, 'Chaque case enchaîne idle → walk → attack → cast → hit → stunned → death → leap. Équipes alternées (socle bleu-or / rouge-cuivre), étoiles 1★/2★/3★.');
  if (s) {
    const cols = 8;
    const cw = 190;
    const ch = 214;
    const rows = Math.ceil(DEMO_LOOKS.length / cols);
    const g = makeCanvas(s, cols * cw, rows * ch);
    painters.push((time) => {
      g.clearRect(0, 0, cols * cw, rows * ch);
      DEMO_LOOKS.forEach((d, i) => {
        const cx = (i % cols) * cw;
        const cy = Math.floor(i / cols) * ch;
        panelBg(g, cx + 2, cy + 2, cw - 4, ch - 4);
        const { anim, t } = animFor(time, i * 0.37);
        const team = (i % 2) as 0 | 1;
        drawUnit(g, d.look, {
          x: cx + cw / 2,
          y: cy + 158,
          size: 46,
          facing: 1,
          time: time + i * 0.21,
          anim,
          animT: t,
          aimX: cx + cw / 2 + 120,
          aimY: cy + 158,
          team,
          star: ((i % 3) + 1) as 1 | 2 | 3,
          flash: anim === 'hit' ? Math.max(0, 1 - t * 3) : 0,
        });
        g.fillStyle = '#f1d58a';
        g.font = '12px Georgia, serif';
        g.textAlign = 'center';
        g.fillText(d.name, cx + cw / 2, cy + 184);
        g.fillStyle = '#9d93bd';
        g.font = '10px ui-monospace, monospace';
        g.fillText(`${d.look.body}·${d.look.head}·${d.look.weapon}`, cx + cw / 2, cy + 197);
        g.fillText((d.look.extras ?? []).join(',') || '—', cx + cw / 2, cy + 208);
        g.fillStyle = '#6fe0c0';
        g.textAlign = 'left';
        g.fillText(anim, cx + 8, cy + 16);
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Zoom (grandes figurines pour inspecter les détails)

{
  const zs = params.get('zoom');
  const s = zs !== null || (only && only.includes('zoom')) ? section('zoom', 'Zoom') : null;
  if (s) {
    const ids = (zs && zs.length ? zs : '0,1,2,3,4,5').split(',').map((x) => parseInt(x, 10));
    const cols = Math.min(6, ids.length);
    const cw = 260;
    const ch = 300;
    const rows = Math.ceil(ids.length / cols);
    const g = makeCanvas(s, cols * cw, rows * ch);
    painters.push((time) => {
      g.clearRect(0, 0, cols * cw, rows * ch);
      ids.forEach((id, i) => {
        const d = DEMO_LOOKS[id % DEMO_LOOKS.length];
        const cx = (i % cols) * cw;
        const cy = Math.floor(i / cols) * ch;
        panelBg(g, cx + 2, cy + 2, cw - 4, ch - 4);
        const { anim, t } = animFor(time, 0);
        drawUnit(g, d.look, {
          x: cx + cw / 2 - 10,
          y: cy + ch - 46,
          size: 100,
          facing: 1,
          time,
          anim,
          animT: t,
          aimX: cx + cw / 2 + 200,
          aimY: cy + ch - 46,
          team: (i % 2) as 0 | 1,
          star: 1,
        });
        g.fillStyle = '#f1d58a';
        g.font = '13px Georgia, serif';
        g.textAlign = 'center';
        g.fillText(`${id} · ${d.name}`, cx + cw / 2, cy + ch - 10);
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Bandes d'animation (images fixes à différents instants)

{
  const s = section('strip', 'Décomposition des animations', 'Lignes : animations ; colonnes : progression animT = 0 · 0,15 · 0,3 · 0,38 · 0,5 · 0,7 · 0,9.');
  if (s) {
    const ids = (params.get('strip') ?? '0,3,16,8,24,12,57,46').split(',').map((x) => parseInt(x, 10));
    const frames = [0, 0.15, 0.3, 0.38, 0.5, 0.7, 0.9];
    const big = params.get('stripbig') === '1';
    const cw = big ? 150 : 92;
    const ch = big ? 168 : 112;
    const perRow = big ? 1 : 2;
    const blockW = frames.length * cw + 70;
    const blockH = ANIMS.length * ch + 26;
    const nb = ids.length;
    const W = perRow * blockW;
    const H = Math.ceil(nb / perRow) * blockH;
    const g = makeCanvas(s, W, H);
    painters.push((time) => {
      g.clearRect(0, 0, W, H);
      ids.forEach((id, bi) => {
        const d = DEMO_LOOKS[id % DEMO_LOOKS.length];
        const bx = (bi % perRow) * blockW;
        const by = Math.floor(bi / perRow) * blockH;
        g.fillStyle = '#f1d58a';
        g.font = '13px Georgia, serif';
        g.textAlign = 'left';
        g.fillText(`${d.name} — ${d.look.body}/${d.look.head}/${d.look.weapon}`, bx + 6, by + 16);
        ANIMS.forEach((a, ri) => {
          g.fillStyle = '#9d93bd';
          g.font = '11px ui-monospace, monospace';
          g.fillText(a, bx + 4, by + 26 + ri * ch + ch / 2);
          frames.forEach((f, fi) => {
            const x = bx + 66 + fi * cw;
            const y = by + 24 + ri * ch;
            panelBg(g, x, y, cw - 2, ch - 2);
            drawUnit(g, d.look, {
              x: x + cw / 2 - 6,
              y: y + ch - 22,
              size: big ? 58 : 34,
              facing: 1,
              // Animations cycliques (idle, walk, stunned) : pilotées par le temps.
              time: a === 'idle' || a === 'walk' || a === 'stunned' ? time + f * (a === 'walk' ? 0.625 : 2.6) : time,
              anim: a,
              animT: f,
              aimX: x + cw / 2 + 80,
              aimY: y + ch - 22,
              team: 0,
              flash: a === 'hit' ? Math.max(0, 1 - f * 3) : 0,
            });
          });
        });
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Portraits

{
  const s = section('portraits', 'Portraits (96 px avec cadre · 64 px sans cadre · 48 px)', 'portraitCanvas / portraitDataUrl — cadrage buste, fond teinté par la couleur primaire, mis en cache.');
  if (s) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
    s.appendChild(wrap);
    DEMO_LOOKS.forEach((d) => {
      const c = portraitCanvas(d.look, Math.round(96 * dpr));
      c.style.width = '96px';
      c.style.height = '96px';
      c.title = d.name;
      wrap.appendChild(c);
    });
    const row2 = document.createElement('div');
    row2.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;';
    s.appendChild(row2);
    DEMO_LOOKS.slice(0, 24).forEach((d) => {
      const img = document.createElement('img');
      img.src = portraitDataUrl(d.look, Math.round(64 * dpr), { frame: false });
      img.width = 64;
      img.height = 64;
      img.style.borderRadius = '10px';
      row2.appendChild(img);
    });
    DEMO_LOOKS.slice(24, 40).forEach((d) => {
      const img = document.createElement('img');
      img.src = portraitDataUrl(d.look, Math.round(48 * dpr), { bg: '#2a1f3a' });
      img.width = 48;
      img.height = 48;
      row2.appendChild(img);
    });
  }
}

// ---------------------------------------------------------------------------
// Icônes

{
  const s = section('icons', `Icônes (${ICON_KEYS.length}) — 48 px or, puis 32 / 24 / 16 px en couleurs`, 'drawIcon (bitmap mis en cache par taille et couleur) et iconDataUrl pour <img>.');
  if (s) {
    const cols = 12;
    const cw = 124;
    const ch = 80;
    const rows = Math.ceil(ICON_KEYS.length / cols);
    const g = makeCanvas(s, cols * cw, rows * ch);
    g.fillStyle = '#120f2a';
    g.fillRect(0, 0, cols * cw, rows * ch);
    ICON_KEYS.forEach((k, i) => {
      const x = (i % cols) * cw;
      const y = Math.floor(i / cols) * ch;
      g.strokeStyle = 'rgba(232,196,106,0.12)';
      g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      drawIcon(g, k, x + cw / 2, y + 32, 48, '#e8c25c');
      g.fillStyle = '#b8aedb';
      g.font = '11px ui-monospace, monospace';
      g.textAlign = 'center';
      g.fillText(k, x + cw / 2, y + ch - 8);
    });
    const palette = ['#e8c25c', '#9fd8ff', '#ff8a5a', '#8fe07a', '#c9a8ff', '#5ff2e0', '#ffffff', '#ff6f8a'];
    for (const px of [32, 24, 16]) {
      const per = Math.floor(1488 / (px + 10));
      const rr = Math.ceil(ICON_KEYS.length / per);
      const g2 = makeCanvas(s, per * (px + 10), rr * (px + 10) + 6);
      g2.fillStyle = '#120f2a';
      g2.fillRect(0, 0, per * (px + 10), rr * (px + 10) + 6);
      ICON_KEYS.forEach((k, i) => {
        drawIcon(g2, k, (i % per) * (px + 10) + (px + 10) / 2, Math.floor(i / per) * (px + 10) + (px + 10) / 2 + 3, px, palette[Math.floor(i / 8) % palette.length]);
      });
    }
    const imgs = document.createElement('div');
    imgs.style.cssText = 'display:flex;gap:6px;margin-top:8px;align-items:center;background:#e9e2cf;padding:6px;border-radius:6px;width:max-content;';
    (['gold', 'xp', 'hp', 'level', 'reroll', 'lock', 'unlock', 'sell', 'speed', 'pause', 'play', 'settings', 'book-open', 'trophy', 'swords', 'skull-round', 'crown-round', 'dice', 'info', 'close'] as IconKey[]).forEach((k) => {
      const img = document.createElement('img');
      img.src = iconDataUrl(k, 28, '#b8862e');
      img.width = 28;
      img.height = 28;
      img.title = k;
      imgs.appendChild(img);
    });
    s.appendChild(imgs);
  }
}

// ---------------------------------------------------------------------------
// Banc d'essai de performance (?bench=1)

if (params.get('bench') === '1') {
  const out = document.getElementById('perf') as HTMLElement;
  const run = (scale: number, frames: number, parts = 7, m: Mood = 'combat'): number => {
    const W = 1600;
    const H = 1000;
    const c = document.createElement('canvas');
    c.width = W * scale;
    c.height = H * scale;
    const g = c.getContext('2d', { alpha: false });
    if (!g) return NaN;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    paintArena(g, W, H, 0, m, 7);
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      g.setTransform(scale, 0, 0, scale, 0, 0);
      paintArena(g, W, H, f / 60, m, parts);
    }
    g.getImageData(0, 0, 1, 1);
    return (performance.now() - t0) / frames;
  };
  const runUnitsOnly = (frames: number): number => {
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1000;
    const g = c.getContext('2d');
    if (!g) return NaN;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      g.clearRect(0, 0, 1600, 1000);
      for (let i = 0; i < 20; i++) {
        const d = DEMO_LOOKS[(i * 3) % DEMO_LOOKS.length];
        drawUnit(g, d.look, {
          x: 120 + (i % 10) * 150,
          y: 300 + Math.floor(i / 10) * 400,
          size: 90,
          facing: 1,
          time: f / 60 + i,
          anim: (['idle', 'walk', 'attack', 'cast'] as AnimKind[])[i % 4],
          animT: (f % 60) / 60,
          team: (i % 2) as 0 | 1,
          star: 2,
        });
      }
    }
    g.getImageData(0, 0, 1, 1);
    return (performance.now() - t0) / frames;
  };
  setTimeout(() => {
    const u = runUnitsOnly(120);
    const bgP = run(1, 60, 1, 'prep');
    const bgC = run(1, 60, 1, 'combat');
    const bgF = run(1, 60, 1, 'final');
    const tiles = run(1, 60, 2);
    const units = run(1, 60, 4);
    const a1 = run(1, 60);
    const a2 = run(2, 30);
    const msg = `PERF (Chromium sans tête, rendu logiciel) — 20 unités seules : ${u.toFixed(2)} ms · décor prep/combat/final : ${bgP.toFixed(2)}/${bgC.toFixed(2)}/${bgF.toFixed(2)} ms · 65 cases : ${tiles.toFixed(2)} ms · 27 unités de l'arène : ${units.toFixed(2)} ms · arène complète 1600×1000 : ${a1.toFixed(2)} ms à 1×, ${a2.toFixed(2)} ms à 2×`;
    out.textContent = msg;
    console.log(msg);
  }, 300);
}

// ---------------------------------------------------------------------------

let last = performance.now();
let simTime = 0;
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  simTime += dt * (slowBox.checked ? 0.25 : 1);
  const time = frozenT ?? simTime;
  clock.textContent = `t = ${time.toFixed(2)} s`;
  for (const p of painters) p(time);
  if (frozenT === null) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

