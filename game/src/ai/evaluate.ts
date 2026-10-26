/**
 * Évaluation heuristique des champions et des équipes pour l'IA.
 */
import { computeTraits } from '../combat/setup';
import { getChampion, getTrait } from '../core/content';
import type { AiMemory, OwnedUnit, PlayerState } from '../game/types';
import type { PublicView } from '../game/snapshot';
import { PROFILES, type DifficultyDef } from './profiles';
import type { Rng } from '../core/rng';
import { ARCHETYPES } from './archetypes';

const STAR_POWER = [0, 1, 2.6, 6.2];

export interface EvalCtx {
  self: PlayerState;
  mem: AiMemory;
  view: PublicView;
  stage: number;
  diff: DifficultyDef;
  rng: Rng;
}

export function traitWeight(mem: AiMemory, traitId: string): number {
  const i = mem.targetTraits.indexOf(traitId);
  const base = i === 0 ? 1 : i === 1 ? 0.7 : i === 2 ? 0.45 : 0;
  return base + (mem.favoriteTrait === traitId ? 0.6 : 0);
}

/** Exemplaires d'un champion visibles chez les autres joueurs (information publique). */
export function contested(view: PublicView, defId: string): number {
  let n = 0;
  for (const p of view.players) {
    if (!p.alive || !p.snapshot) continue;
    for (const u of p.snapshot.board) if (u.defId === defId) n += u.star === 1 ? 1 : u.star === 2 ? 3 : 9;
    for (const u of p.snapshot.bench) if (u.defId === defId) n += u.star === 1 ? 1 : u.star === 2 ? 3 : 9;
  }
  return n;
}

export function ownedCopies(p: PlayerState, defId: string): number {
  let n = 0;
  for (const u of p.board) if (u.defId === defId) n += u.star === 1 ? 1 : u.star === 2 ? 3 : 9;
  for (const u of p.bench) if (u && u.defId === defId) n += u.star === 1 ? 1 : u.star === 2 ? 3 : 9;
  return n;
}

function costFit(cost: number, stage: number, highCostBias: number): number {
  const ideal = stage <= 1 ? 1 : stage === 2 ? 2 : stage === 3 ? 3 : stage === 4 ? 3.8 : 4.5;
  return 2.5 - Math.abs(cost - ideal) * 0.9 + (cost >= 4 ? highCostBias : 0);
}

/** Valeur d'achat d'un champion pour cette IA, compte tenu de son plan. */
export function unitValue(ctx: EvalCtx, defId: string): number {
  const def = getChampion(defId);
  const prof = PROFILES[ctx.mem.profile];
  let v = 0;
  for (const t of def.traits) v += 6 * traitWeight(ctx.mem, t);
  // proximité d'un palier avec l'équipe actuelle
  const traits = computeTraits(ctx.self.board);
  for (const t of def.traits) {
    const st = traits.find((x) => x.id === t);
    if (!st) continue;
    const next = st.thresholds.find((th) => th > st.count);
    if (next !== undefined && next - st.count === 1 && !ctx.self.board.some((b) => b.defId === defId)) v += 2.2;
  }
  v += costFit(def.cost, ctx.stage, prof.highCostBias);
  if (ctx.mem.carries.includes(defId)) v += 5;
  const owned = ownedCopies(ctx.self, defId);
  if (owned > 0 && owned < 9) v += 2.5 + Math.min(owned, 5) * 1.6;
  const mod3 = owned % 3;
  if (mod3 === 2) v += 3.5;
  if (ctx.diff.adapt || ctx.diff.placement >= 1) v -= contested(ctx.view, defId) * 0.6;
  if (def.position === 'front') v += prof.frontBias;
  if (ctx.mem.favoriteTrait && def.traits.includes(ctx.mem.favoriteTrait)) v += prof.favoriteBias;
  if (ctx.diff.noise > 0) v += ctx.rng.range(-ctx.diff.noise, ctx.diff.noise);
  return v;
}

export function unitPower(u: OwnedUnit, mem?: AiMemory): number {
  const def = getChampion(u.defId);
  let p = Math.pow(def.cost, 1.15) * STAR_POWER[u.star] + u.items.length * 1.4;
  if (mem?.carries.includes(def.id)) p += 0.8;
  return p;
}

/** Score d'une équipe candidate (plateau). */
export function teamScore(units: OwnedUnit[], mem: AiMemory): number {
  let s = 0;
  for (const u of units) s += unitPower(u, mem);
  const traits = computeTraits(units);
  for (const t of traits) {
    if (t.level <= 0) continue;
    const w = 1 + traitWeight(mem, t.id) * 1.5;
    let bonus = 2.2 * t.level * w;
    if (t.id === 'nomade') bonus += 1.5 * t.level; // valeur économique
    s += bonus;
  }
  const n = units.length;
  const front = units.filter((u) => getChampion(u.defId).position === 'front').length;
  const back = units.filter((u) => getChampion(u.defId).position === 'back').length;
  const need = Math.ceil(n * 0.35);
  if (front < need) s -= (need - front) * 2.8;
  if (n >= 3 && back === 0) s -= 2;
  return s;
}

/** Sélectionne les unités à déployer (glouton + échanges locaux). */
export function chooseBoard(candidates: OwnedUnit[], limit: number, mem: AiMemory, rng?: Rng, noise = 0): OwnedUnit[] {
  // un seul exemplaire de chaque champion compte pour les synergies : on évite les doublons inutiles
  const chosen: OwnedUnit[] = [];
  const pool = candidates.slice();
  while (chosen.length < limit && pool.length) {
    if (rng && noise > 0 && rng.chance(noise)) {
      chosen.push(pool.splice(rng.int(pool.length), 1)[0]);
      continue;
    }
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const s = teamScore([...chosen, pool[i]], mem);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    chosen.push(pool.splice(best, 1)[0]);
  }
  // améliorations par échange
  for (let pass = 0; pass < (noise > 0.2 ? 0 : 2); pass++) {
    let improved = false;
    for (let i = 0; i < chosen.length; i++) {
      const cur = teamScore(chosen, mem);
      for (let j = 0; j < pool.length; j++) {
        const trial = chosen.slice();
        trial[i] = pool[j];
        if (teamScore(trial, mem) > cur + 0.01) {
          const out = chosen[i];
          chosen[i] = pool[j];
          pool[j] = out;
          improved = true;
          break;
        }
      }
    }
    if (!improved) break;
  }
  return chosen;
}

/** Choisit (ou révise) les synergies visées à partir des unités possédées et du profil. */
export function pickTargetTraits(ctx: EvalCtx, allowPivot: boolean): void {
  const mem = ctx.mem;
  const owned = [...ctx.self.board, ...ctx.self.bench.filter((u): u is OwnedUnit => !!u)];
  const scores = new Map<string, number>();
  for (const a of ARCHETYPES) {
    if (a.reroll && !PROFILES[mem.profile].rerollComp && mem.profile !== 'specialiste') continue;
    let s = 0;
    for (const u of owned) {
      const def = getChampion(u.defId);
      for (const [i, t] of a.traits.entries()) if (def.traits.includes(t)) s += (3 - i) * STAR_POWER[u.star];
      if (a.carries.includes(def.id)) s += 3 * STAR_POWER[u.star];
    }
    if (mem.favoriteTrait && a.traits.includes(mem.favoriteTrait)) s += 10;
    // adaptation : éviter une voie disputée (repérage public)
    if (ctx.diff.adapt || ctx.diff.discipline >= 0.9) {
      let dispute = 0;
      for (const p of ctx.view.players) {
        if (!p.alive || !p.snapshot) continue;
        const main = p.snapshot.traits.find((t) => t.id === a.traits[0]);
        if (main && main.count >= 3) dispute++;
      }
      s -= dispute * 4;
    }
    s += ctx.rng.range(0, ctx.diff.noise + 1.5);
    scores.set(a.id, s);
  }
  let bestId = '';
  let best = -Infinity;
  for (const [id, s] of scores) if (s > best) ((best = s), (bestId = id));
  const arch = ARCHETYPES.find((a) => a.id === bestId)!;
  const current = ARCHETYPES.find((a) => a.traits[0] === mem.targetTraits[0] && a.traits[1] === mem.targetTraits[1]);
  if (current && !allowPivot) return;
  if (current && current.id !== arch.id) {
    const curScore = scores.get(current.id) ?? -Infinity;
    if (best < curScore + 6) return; // n'abandonne pas sa voie pour un gain marginal
    mem.pivots++;
  }
  mem.targetTraits = [...arch.traits];
  mem.carries = [...arch.carries];
}

export function traitLabel(id: string): string {
  return getTrait(id).name;
}
