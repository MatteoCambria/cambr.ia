/**
 * Placement des unités de l'IA : règles tactiques (front, arrière, protection du carry),
 * variantes, et — en difficulté élevée — sélection par simulation contre les plateaux
 * publics des adversaires.
 */
import { buildCombat } from '../combat/setup';
import { getChampion } from '../core/content';
import type { Rng } from '../core/rng';
import type { AiMemory, BoardSlot, OwnedUnit } from '../game/types';
import type { PublicView } from '../game/snapshot';
import { unitPower } from './evaluate';

type Pos = { col: number; row: number };

const FRONT_COLS = [3, 2, 4, 1, 5, 0, 6];
const BACK_COLS_CORNER_L = [0, 1, 2, 6, 5, 3, 4];
const BACK_COLS_CORNER_R = [6, 5, 4, 0, 1, 3, 2];
const BACK_COLS_SPREAD = [0, 6, 2, 4, 1, 5, 3];

export interface PlacementStyle {
  carrySide: 'left' | 'right' | 'center';
  spread: boolean;
  frontRow: 0 | 1;
}

function isFront(u: OwnedUnit): boolean {
  return getChampion(u.defId).position === 'front';
}

function isFlex(u: OwnedUnit): boolean {
  return getChampion(u.defId).position === 'flex';
}

export function placeUnits(units: OwnedUnit[], mem: AiMemory, style: PlacementStyle, quality: 0 | 1 | 2, rng: Rng): BoardSlot[] {
  const taken = new Set<string>();
  const out: BoardSlot[] = [];
  const put = (u: OwnedUnit, p: Pos) => {
    taken.add(p.col + ',' + p.row);
    out.push({ ...u, col: p.col, row: p.row });
  };
  const free = (p: Pos) => !taken.has(p.col + ',' + p.row);

  if (quality === 0) {
    // placement approximatif : avant ou arrière selon le rôle, colonnes au hasard
    for (const u of units) {
      const rows = isFront(u) ? [0, 1] : [3, 2];
      let placed = false;
      for (let tries = 0; tries < 30 && !placed; tries++) {
        const p = { col: rng.int(7), row: rows[rng.int(2)] };
        if (free(p)) {
          put(u, p);
          placed = true;
        }
      }
      if (!placed) for (let r = 0; r < 4 && !placed; r++) for (let c = 0; c < 7 && !placed; c++) if (free({ col: c, row: r })) (put(u, { col: c, row: r }), (placed = true));
    }
    return out;
  }

  const fronts = units.filter(isFront).sort((a, b) => unitPower(b, mem) - unitPower(a, mem));
  const flexes = units.filter(isFlex);
  const backs = units.filter((u) => !isFront(u) && !isFlex(u)).sort((a, b) => carryRank(b, mem) - carryRank(a, mem));

  // Ligne de front : les plus solides au centre
  const frontRow = style.frontRow;
  for (const u of fronts) {
    const col = FRONT_COLS.find((c) => free({ col: c, row: frontRow }));
    if (col !== undefined) put(u, { col, row: frontRow });
    else {
      const col2 = FRONT_COLS.find((c) => free({ col: c, row: frontRow + 1 }));
      if (col2 !== undefined) put(u, { col: col2, row: frontRow + 1 });
    }
  }

  // Ligne arrière : carry principal dans un coin (ou étalé)
  const cols = style.spread ? BACK_COLS_SPREAD : style.carrySide === 'left' ? BACK_COLS_CORNER_L : style.carrySide === 'right' ? BACK_COLS_CORNER_R : [3, 2, 4, 1, 5, 0, 6];
  const supports = backs.filter((u) => isSupport(u));
  const carriesBack = backs.filter((u) => !isSupport(u));
  const ordered = [...carriesBack.slice(0, 1), ...supports.slice(0, 1), ...carriesBack.slice(1), ...supports.slice(1)];
  for (const u of ordered) {
    const col = cols.find((c) => free({ col: c, row: 3 }));
    if (col !== undefined) put(u, { col, row: 3 });
    else {
      const col2 = cols.find((c) => free({ col: c, row: 2 }));
      if (col2 !== undefined) put(u, { col: col2, row: 2 });
    }
  }

  // Unités polyvalentes (assassins, duellistes de flanc) : coins de la 2e rangée
  for (const u of flexes) {
    const solitary = getChampion(u.defId).id === 'oriel';
    const candidates: Pos[] = solitary
      ? [{ col: 6, row: 1 }, { col: 0, row: 1 }, { col: 6, row: 2 }, { col: 0, row: 2 }]
      : [{ col: 0, row: 2 }, { col: 6, row: 2 }, { col: 1, row: 2 }, { col: 5, row: 2 }, { col: 0, row: 1 }, { col: 6, row: 1 }];
    const p = candidates.find(free);
    if (p) put(u, p);
  }

  // Ce qui reste : première case libre
  for (const u of units) {
    if (out.some((o) => o.uid === u.uid)) continue;
    for (let r = 0; r < 4; r++)
      for (const c of FRONT_COLS)
        if (free({ col: c, row: r }) && !out.some((o) => o.uid === u.uid)) put(u, { col: c, row: r });
  }

  if (quality >= 1) protectCarry(out, mem);
  return out;
}

function isSupport(u: OwnedUnit): boolean {
  const r = getChampion(u.defId).role;
  return r === 'healer' || r === 'enchanter' || r === 'shielder' || r === 'amplifier' || r === 'battery';
}

function carryRank(u: OwnedUnit, mem: AiMemory): number {
  return unitPower(u, mem) + (mem.carries.includes(u.defId) ? 4 : 0) + u.items.length * 2;
}

/** Rapproche un Gardien ou un soutien du carry principal (bonus d'adjacence). */
function protectCarry(slots: BoardSlot[], mem: AiMemory): void {
  const backs = slots.filter((s) => s.row >= 2 && !isFront(s));
  if (!backs.length) return;
  const carry = backs.slice().sort((a, b) => carryRank(b, mem) - carryRank(a, mem))[0];
  const neighborsOf = (c: Pos): Pos[] => {
    const odd = c.row & 1;
    const dirs = odd ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]] : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
    return dirs.map(([dc, dr]) => ({ col: c.col + dc, row: c.row + dr })).filter((p) => p.col >= 0 && p.col < 7 && p.row >= 0 && p.row < 4);
  };
  const adj = neighborsOf(carry);
  const occupied = (p: Pos) => slots.find((s) => s.col === p.col && s.row === p.row);
  // Taliya et les Oracles près du carry
  const helper = slots.find((s) => s !== carry && (s.defId === 'taliya' || getChampion(s.defId).traits.includes('oracle')) && s.row >= 2);
  if (helper && !adj.some((p) => p.col === helper.col && p.row === helper.row)) {
    const spot = adj.find((p) => !occupied(p) && p.row >= 2);
    if (spot) {
      helper.col = spot.col;
      helper.row = spot.row;
    }
  }
  // un Gardien de la première ligne devant le carry, si la synergie est présente
  const guardian = slots.find((s) => isFront(s) && getChampion(s.defId).traits.includes('gardien'));
  if (guardian) {
    const spot = adj.find((p) => !occupied(p) && p.row === 2);
    if (spot && slots.filter((s) => isFront(s)).length >= 3) {
      guardian.col = spot.col;
      guardian.row = spot.row;
    }
  }
}

/** Menaces observées chez les adversaires (repérage public) → style de placement adapté. */
export function adaptStyle(view: PublicView, rng: Rng): PlacementStyle {
  let assassins = 0;
  let aoe = 0;
  for (const p of view.players) {
    if (!p.alive || !p.snapshot) continue;
    for (const t of p.snapshot.traits) {
      if (t.id === 'assassin' && t.level > 0) assassins += t.level;
      if ((t.id === 'artilleur' || t.id === 'arcaniste') && t.level > 0) aoe += t.level;
    }
    for (const u of p.snapshot.board) {
      if (['amara', 'phenea', 'neantis', 'nerea', 'heliodore', 'chronaxe'].includes(u.defId)) aoe++;
    }
  }
  return {
    carrySide: rng.chance(0.5) ? 'left' : 'right',
    spread: aoe > assassins + 2,
    frontRow: assassins >= 3 ? 1 : 0,
  };
}

/** Choisit le meilleur placement parmi plusieurs variantes en simulant contre les plateaux publics les plus forts. */
export function optimizePlacement(units: OwnedUnit[], mem: AiMemory, view: PublicView, stage: number, rng: Rng, seedBase: number): BoardSlot[] {
  const base = adaptStyle(view, rng);
  const styles: PlacementStyle[] = [
    base,
    { ...base, carrySide: base.carrySide === 'left' ? 'right' : 'left' },
    { ...base, spread: !base.spread },
    { ...base, frontRow: base.frontRow === 0 ? 1 : 0 },
  ];
  const opponents = view.players
    .filter((p) => p.alive && p.snapshot && p.snapshot.board.length > 0)
    .sort((a, b) => (b.snapshot!.level - a.snapshot!.level) || b.hp - a.hp)
    .slice(0, 2);
  const candidates = styles.map((st) => placeUnits(units, mem, st, 1, rng));
  if (!opponents.length) return candidates[0];
  let best = candidates[0];
  let bestScore = -Infinity;
  candidates.forEach((cand, ci) => {
    let score = 0;
    opponents.forEach((op, oi) => {
      const sim = buildCombat(
        [
          { units: cand.map((s) => ({ defId: s.defId, star: s.star, items: s.items, hex: { col: s.col, row: s.row } })) },
          { units: op.snapshot!.board.map((s) => ({ defId: s.defId, star: s.star, items: s.items, hex: { col: s.col, row: s.row } })) },
        ],
        { seed: seedBase + ci * 7 + oi, stage },
      );
      const r = sim.run();
      if (r.winner === 0) score += 10 + r.survivors.filter((s) => s.side === 0).length;
      else if (r.winner === 1) score -= r.survivors.filter((s) => s.side === 1).length;
      // dégâts infligés comme départage
      score += sim.units.filter((u) => u.side === 0).reduce((s2, u) => s2 + u.combat.damageDealt, 0) / 2000;
    });
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  });
  return best;
}
