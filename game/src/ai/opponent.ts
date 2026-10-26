/**
 * Décisions d'un adversaire IA pendant la préparation.
 *
 * Contraintes : l'IA agit exclusivement via les mêmes actions que le joueur (actions.ts),
 * avec les mêmes coûts et limites. Pour les autres joueurs, elle ne consulte que la vue
 * publique (instantanés du dernier combat). Elle ne lit jamais le pool, la boutique ou
 * l'aléatoire d'autrui.
 */
import { hashString, Rng } from '../core/rng';
import { ECONOMY, BENCH_SIZE, sellValue } from '../config/balance';
import { roundAt } from '../config/rounds';
import { combine, getChampion, getItem, isComponent, COMPONENTS, findConsumable } from '../core/content';
import type { ItemDef } from '../core/defs';
import { buyUnit, buyXp, combineBenchItems, equipItem, reroll, sellUnit, toggleLock } from '../game/actions';
import { publicView } from '../game/snapshot';
import type { AiMemory, AiProfileId, BoardSlot, GameState, OwnedUnit, PlayerState } from '../game/types';
import { deployLimit } from '../progression/levels';
import { chooseBoard, ownedCopies, pickTargetTraits, unitPower, unitValue, type EvalCtx } from './evaluate';
import { adaptStyle, optimizePlacement, pickBoardBySimulation, placeUnits } from './placement';
import { DIFFICULTIES, PROFILES } from './profiles';
import { ARCHETYPES } from './archetypes';
import { CHAMPIONS } from '../core/content';

export function initMemory(profile: AiProfileId, rng: Rng): AiMemory {
  const mem: AiMemory = { profile, targetTraits: [], carries: [], pivots: 0, lastPlanRound: -1, rollDownDone: false, strength: 0.5 };
  if (profile === 'specialiste') {
    const traits = ['zenith', 'selene', 'rouage', 'sylve', 'abysse', 'braise', 'nomade', 'astral', 'duelliste', 'tireur', 'arcaniste', 'assassin'];
    mem.favoriteTrait = rng.pick(traits);
    const arch = ARCHETYPES.find((a) => a.traits[0] === mem.favoriteTrait) ?? ARCHETYPES.find((a) => a.traits.includes(mem.favoriteTrait!));
    if (arch) {
      mem.targetTraits = [...arch.traits];
      mem.carries = [...arch.carries];
    }
  }
  return mem;
}

function makeCtx(state: GameState, p: PlayerState, salt: string): EvalCtx {
  const r = roundAt(state.roundIndex);
  return {
    self: p,
    mem: p.ai!,
    view: publicView(state, p.id),
    stage: r.stage,
    diff: DIFFICULTIES[p.ai?.difficulty ?? state.settings.difficulty],
    rng: new Rng(hashString(`${state.settings.seed}:ai:${p.id}:${state.roundIndex}:${salt}`)),
  };
}

function targetLevel(mem: AiMemory, roundIndex: number): number {
  let lvl = 1;
  for (const [ri, l] of PROFILES[mem.profile].levelPlan) if (roundIndex >= ri) lvl = l;
  return lvl;
}

function benchCount(p: PlayerState): number {
  return p.bench.filter((u) => u !== null).length;
}

/** Passe d'achats sur la boutique actuelle. */
function shopPass(state: GameState, p: PlayerState, ctx: EvalCtx, floor: number, threshold: number): void {
  const order = p.shop
    .map((id, i) => ({ id, i, v: id ? unitValue(ctx, id) : -Infinity }))
    .filter((x) => x.id)
    .sort((a, b) => b.v - a.v);
  for (const s of order) {
    const def = getChampion(s.id!);
    const pairUp = ownedCopies(p, def.id) % 3 === 2;
    const affordable = p.gold - def.cost >= floor || (pairUp && p.gold >= def.cost);
    if (!affordable) continue;
    if (s.v < threshold && !pairUp) continue;
    if (benchCount(p) >= BENCH_SIZE - 1 && !pairUp) {
      if (!makeRoom(state, p, ctx, s.v)) continue;
    }
    buyUnit(state, p, s.i);
  }
}

/** Vend l'unité de réserve la moins utile si sa valeur est inférieure au seuil. */
function makeRoom(state: GameState, p: PlayerState, ctx: EvalCtx, incomingValue: number): boolean {
  const benchUnits = p.bench.filter((u): u is OwnedUnit => !!u);
  if (!benchUnits.length) return false;
  let worst: OwnedUnit | null = null;
  let worstV = Infinity;
  for (const u of benchUnits) {
    const v = unitValue(ctx, u.defId) + (u.star - 1) * 6;
    if (v < worstV) {
      worstV = v;
      worst = u;
    }
  }
  if (!worst || worstV >= incomingValue) return false;
  return sellUnit(state, p, worst.uid).ok;
}

/** Nettoie la réserve en fin de tour : garde les paires et les unités du plan. */
function trimBench(state: GameState, p: PlayerState, ctx: EvalCtx): void {
  const keepMax = ctx.stage >= 4 ? 4 : 6;
  let units = p.bench.filter((u): u is OwnedUnit => !!u);
  if (units.length <= keepMax) return;
  const scored = units.map((u) => ({ u, v: unitValue(ctx, u.defId) + (u.star - 1) * 6 + (ownedCopies(p, u.defId) >= 2 ? 4 : 0) })).sort((a, b) => a.v - b.v);
  while (units.length > keepMax && scored.length) {
    const s = scored.shift()!;
    sellUnit(state, p, s.u.uid);
    units = p.bench.filter((u): u is OwnedUnit => !!u);
  }
}

function isApCarry(defId: string): boolean {
  const d = getChampion(defId);
  return ['aoeMage', 'burstMage', 'dotMage', 'controller', 'summoner', 'healer', 'enchanter', 'shielder', 'battery'].includes(d.role) || d.role === 'artillery';
}

function itemFits(item: ItemDef, unitDef: string, isTank: boolean): number {
  const t = item.tags;
  if (isTank) return t.includes('tank') ? 3 : t.includes('any') || t.includes('utility') ? 1 : -1;
  const ap = isApCarry(unitDef);
  if (ap) return t.includes('carry-ap') ? 3 : t.includes('support') ? 1.5 : t.includes('carry-ad') ? -1 : 0.5;
  return t.includes('carry-ad') ? 3 : t.includes('carry-ap') ? -0.5 : 0.5;
}

/** Gestion des objets : recettes visées pour le carry et le tank, sinon équipement opportun. */
function handleItems(state: GameState, p: PlayerState, ctx: EvalCtx): void {
  if (!p.items.length || !p.board.length) return;
  const board = p.board;
  const carry = board
    .filter((s) => getChampion(s.defId).position !== 'front')
    .sort((a, b) => unitPower(b, ctx.mem) + (ctx.mem.carries.includes(b.defId) ? 5 : 0) - (unitPower(a, ctx.mem) + (ctx.mem.carries.includes(a.defId) ? 5 : 0)))[0];
  const tank = board.filter((s) => getChampion(s.defId).position === 'front').sort((a, b) => unitPower(b, ctx.mem) - unitPower(a, ctx.mem))[0];

  // consommables : jamais utilisés par l'IA hors cas évident (rien à faire)
  if (!ctx.diff.itemSmarts) {
    for (let guard = 0; guard < 12; guard++) {
      const idx = p.items.findIndex((i) => !findConsumable(i));
      if (idx < 0) break;
      const targets = board.filter((s) => s.items.length < 3);
      if (!targets.length) break;
      const t = targets[ctx.rng.int(targets.length)];
      if (!equipItem(state, p, idx, t.uid).ok) break;
    }
    return;
  }

  const tryRecipeFor = (unit: BoardSlot | undefined, isTank: boolean) => {
    if (!unit) return;
    const def = getChampion(unit.defId);
    const wanted = (def.preferredItems ?? []).map((id) => getItem(id)).filter((it) => it.recipe);
    for (const it of wanted) {
      if (unit.items.length >= 3 && !unit.items.some(isComponent)) break;
      if (unit.items.includes(it.id) && it.unique) continue;
      const [a, b] = it.recipe!;
      // compléter un composant déjà porté
      const held = unit.items.find(isComponent);
      if (held && (held === a || held === b)) {
        const need = held === a ? b : a;
        const idx = p.items.indexOf(need);
        if (idx >= 0) {
          equipItem(state, p, idx, unit.uid);
          continue;
        }
      }
      if (unit.items.length >= 3) continue;
      const ia = p.items.indexOf(a);
      const ib = a === b ? p.items.indexOf(b, ia + 1) : p.items.indexOf(b);
      if (ia >= 0 && ib >= 0) {
        const r = combineBenchItems(state, p, ia, ib);
        if (r.ok) {
          const ci = p.items.indexOf(it.id);
          if (ci >= 0) equipItem(state, p, ci, unit.uid);
        }
      }
    }
    void isTank;
  };
  tryRecipeFor(carry, false);
  tryRecipeFor(tank, true);

  // objets combinés en réserve : à l'unité qui en profite le plus
  for (let guard = 0; guard < 10; guard++) {
    const idx = p.items.findIndex((i) => !isComponent(i) && !findConsumable(i));
    if (idx < 0) break;
    const it = getItem(p.items[idx]);
    const best = board
      .filter((s) => s.items.length < 3)
      .map((s) => ({ s, f: itemFits(it, s.defId, getChampion(s.defId).position === 'front') + unitPower(s, ctx.mem) * 0.2 }))
      .sort((a, b) => b.f - a.f)[0];
    if (!best) break;
    if (!equipItem(state, p, idx, best.s.uid).ok) break;
  }

  // composants restants : on assemble quand il y en a beaucoup ou en milieu de partie
  const comps = () => p.items.map((id, i) => ({ id, i })).filter((x) => isComponent(x.id));
  if (comps().length >= 4 || (ctx.stage >= 3 && comps().length >= 2)) {
    for (let guard = 0; guard < 4; guard++) {
      const cs = comps();
      if (cs.length < 2) break;
      let bestPair: [number, number] | null = null;
      let bestScore = -Infinity;
      for (let x = 0; x < cs.length; x++)
        for (let y = x + 1; y < cs.length; y++) {
          const res = combine(cs[x].id, cs[y].id);
          if (!res) continue;
          const sc = Math.max(carry ? itemFits(res, carry.defId, false) : -2, tank ? itemFits(res, tank.defId, true) : -2);
          if (sc > bestScore) {
            bestScore = sc;
            bestPair = [cs[x].i, cs[y].i];
          }
        }
      if (!bestPair || bestScore < 1) break;
      if (!combineBenchItems(state, p, bestPair[0], bestPair[1]).ok) break;
      const ci = p.items.findIndex((i) => !isComponent(i) && !findConsumable(i));
      const it = getItem(p.items[ci]);
      const dest = [carry, tank]
        .filter((u): u is BoardSlot => !!u && u.items.length < 3)
        .sort((a, b) => itemFits(it, b.defId, b === tank) - itemFits(it, a.defId, a === tank))[0];
      if (!dest || !equipItem(state, p, ci, dest.uid).ok) break;
    }
  }
}

/** Réorganise plateau et réserve en respectant les règles (permutation des mêmes unités, limite de déploiement). */
function applyArrangement(p: PlayerState, slots: BoardSlot[]): void {
  const all = [...p.board, ...p.bench.filter((u): u is OwnedUnit => !!u)];
  const limit = deployLimit(p);
  const chosenIds = new Set(slots.map((s) => s.uid));
  if (slots.length > limit) throw new Error('IA : dépassement de la limite de déploiement');
  const seen = new Set<string>();
  for (const s of slots) {
    if (s.col < 0 || s.col > 6 || s.row < 0 || s.row > 3) throw new Error('IA : case invalide');
    const k = s.col + ',' + s.row;
    if (seen.has(k)) throw new Error('IA : deux unités sur la même case');
    seen.add(k);
  }
  const rest = all.filter((u) => !chosenIds.has(u.uid)).map((u) => ({ uid: u.uid, defId: u.defId, star: u.star, items: u.items }));
  if (rest.length > BENCH_SIZE) throw new Error('IA : réserve débordante');
  p.board = slots.map((s) => {
    const src = all.find((u) => u.uid === s.uid)!;
    return { uid: src.uid, defId: src.defId, star: src.star, items: src.items, col: s.col, row: s.row };
  });
  p.bench = Array.from({ length: BENCH_SIZE }, (_, i) => rest[i] ?? null);
}

export function planTurn(state: GameState, p: PlayerState): void {
  if (!p.ai || !p.alive) return;
  const ctx = makeCtx(state, p, 'plan');
  const mem = p.ai;
  const prof = PROFILES[mem.profile];
  const diff = ctx.diff;
  const ri = state.roundIndex;

  // 1. Plan de composition
  if (!mem.targetTraits.length || (ri !== mem.lastPlanRound && (ri === 4 || ri === 8 || ri === 11 || ri === 15))) {
    const allowPivot = mem.profile === 'flexible' || ctx.stage <= 2 || diff.adapt;
    pickTargetTraits(ctx, allowPivot);
  }
  mem.lastPlanRound = ri;

  // 2. Niveau
  const panic = p.hp < prof.panicHp;
  let floor = prof.floor(p.hp, ctx.stage);
  if (panic) floor = Math.min(floor, p.hp < 25 ? 0 : 10);
  const tl = targetLevel(mem, ri) + (panic && p.hp < 30 && ctx.stage >= 4 ? 1 : 0);
  const reachedNow = p.level < tl;
  if (ctx.rng.next() < diff.discipline) {
    let guard = 0;
    while (p.level < tl && p.gold >= ECONOMY.xpBuyCost && guard++ < 20) {
      // l'IA monte de niveau même en entamant ses intérêts lorsque c'est le moment prévu
      if (!buyXp(state, p).ok) break;
    }
  }
  // surplus d'or en fin de partie : convertir en expérience
  if (ctx.stage >= 4 && p.level < 9 && p.gold > floor + 24 && ctx.rng.next() > diff.slip) {
    let guard = 0;
    while (p.gold > floor + 16 && p.level < 9 && guard++ < 10) if (!buyXp(state, p).ok) break;
  }

  // 3. Achats et actualisations
  const threshold = 5.5 + (ctx.stage >= 4 ? 1.5 : 0) - (panic ? 1.5 : 0);
  shopPass(state, p, ctx, floor, threshold);
  const rollDown = diff.rollDowns && ((reachedNow && p.level >= 7 && !mem.rollDownDone) || (panic && ctx.stage >= 3));
  if (reachedNow && p.level >= 7) mem.rollDownDone = true;
  if (p.level < 7) mem.rollDownDone = false;
  let rollBudget = 0;
  const rollFloor = rollDown ? (p.hp < 30 ? 0 : 10) : floor;
  if (rollDown) rollBudget = 40;
  else if (ctx.stage >= 3 && p.gold > floor + 10) rollBudget = Math.floor((p.gold - floor) / ECONOMY.rerollCost / 2);
  if (prof.rerollComp && p.level >= 5 && p.level <= 7 && p.gold > 50) rollBudget = Math.max(rollBudget, Math.floor((p.gold - 50) / 2));
  if (ctx.rng.next() < diff.slip) rollBudget = Math.floor(rollBudget / 2);
  let rolls = 0;
  while (rolls < rollBudget && p.gold - ECONOMY.rerollCost >= rollFloor) {
    if (!reroll(state, p).ok) break;
    rolls++;
    shopPass(state, p, ctx, rollFloor, threshold - (rollDown ? 1 : 0));
  }

  // 4. Plateau
  const candidates = [...p.board, ...p.bench.filter((u): u is OwnedUnit => !!u)].map((u) => ({ uid: u.uid, defId: u.defId, star: u.star, items: u.items }));
  let limit = deployLimit(p);
  if (diff.slip > 0 && ctx.rng.next() < diff.slip * 0.5) limit = Math.max(1, limit - 1);
  let chosen = chooseBoard(candidates, Math.min(limit, candidates.length), mem, ctx.rng, diff.boardNoise);
  if (diff.placement === 2 && candidates.length > limit && ctx.stage >= 2) {
    // variantes : la plus puissante brute, et la planifiée avec la meilleure unité de réserve en plus
    const byPower = candidates.slice().sort((a, b) => unitPower(b, mem) - unitPower(a, mem)).slice(0, limit);
    const rest = candidates.filter((u) => !chosen.includes(u)).sort((a, b) => unitPower(b, mem) - unitPower(a, mem));
    const weakest = chosen.slice().sort((a, b) => unitPower(a, mem) - unitPower(b, mem))[0];
    const swapped = rest.length && weakest ? chosen.map((u) => (u === weakest ? rest[0] : u)) : chosen;
    chosen = pickBoardBySimulation([chosen, byPower, swapped], mem, ctx.view, ctx.stage, ctx.rng, hashString(`${state.settings.seed}:board:${p.id}:${ri}`));
  }

  // 5. Objets (sur le plateau pressenti) puis placement
  const provisional = placeUnits(chosen, mem, adaptStyle(ctx.view, ctx.rng), Math.min(1, diff.placement) as 0 | 1, ctx.rng);
  applyArrangement(p, provisional);
  handleItems(state, p, ctx);
  const finalUnits: OwnedUnit[] = p.board.map((s) => ({ uid: s.uid, defId: s.defId, star: s.star, items: s.items }));
  let slots: BoardSlot[];
  if (diff.placement === 2) slots = optimizePlacement(finalUnits, mem, ctx.view, ctx.stage, ctx.rng, hashString(`${state.settings.seed}:${p.id}:${ri}`));
  else slots = placeUnits(finalUnits, mem, diff.adapt ? adaptStyle(ctx.view, ctx.rng) : { carrySide: ctx.rng.chance(0.5) ? 'left' : 'right', spread: false, frontRow: 0 }, diff.placement, ctx.rng);
  applyArrangement(p, slots);

  // 6. Réserve et verrouillage
  trimBench(state, p, ctx);
  if (diff.itemSmarts) {
    const want = p.shop.some((id) => id && unitValue(ctx, id) > threshold + 3 && p.gold < getChampion(id).cost);
    if (want !== p.shopLocked) toggleLock(state, p);
  } else if (p.shopLocked) toggleLock(state, p);
}

/** Choix au carrousel : champion + objet le plus utiles au plan. */
export function pickCarouselOffer(state: GameState, p: PlayerState, offers: { defId: string; item: string; index: number }[]): number {
  if (!offers.length) return -1;
  const ctx = makeCtx(state, p, 'carousel');
  let best = offers[0].index;
  let bestV = -Infinity;
  for (const o of offers) {
    const item = getItem(o.item);
    const comp = item.kind === 'component' ? COMPONENTS.length : 0;
    let v = unitValue(ctx, o.defId) + (item.kind === 'combined' ? 4 : 1.5) + comp * 0;
    // composant utile aux recettes du carry
    const carryDef = ctx.mem.carries.map((id) => CHAMPIONS.find((c) => c.id === id)).find(Boolean);
    if (carryDef?.preferredItems?.some((pi) => getItem(pi).recipe?.includes(o.item))) v += 2;
    if (v > bestV) {
      bestV = v;
      best = o.index;
    }
  }
  return best;
}

/** Valeur de revente totale (diagnostic). */
export function boardValue(p: PlayerState): number {
  return [...p.board, ...p.bench.filter((u): u is OwnedUnit => !!u)].reduce((s, u) => s + sellValue(getChampion(u.defId).cost, u.star), 0);
}
