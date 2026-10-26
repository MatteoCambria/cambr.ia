/**
 * Actions de préparation, communes au joueur humain et aux adversaires IA.
 * Chaque action valide les règles et renvoie un résultat explicite (jamais d'échec silencieux).
 */
import { BENCH_SIZE, ECONOMY, MAX_ITEMS_PER_UNIT, MAX_LEVEL, PLAYER_ROWS, BOARD_COLS, sellValue, copiesForStar } from '../config/balance';
import { combine, findConsumable, findItem, getChampion, isComponent } from '../core/content';
import type { ItemDef } from '../core/defs';
import { earn, spend } from '../economy/economy';
import { addXp, deployLimit } from '../progression/levels';
import { mergeUnits, purchaseWouldMerge, type MergeEvent } from '../progression/starup';
import { returnToPool } from '../shop/pool';
import { refreshShop } from '../shop/shop';
import type { ActionResult, BoardSlot, GameState, OwnedUnit, PlayerState } from './types';

export type Dest = { zone: 'board'; col: number; row: number } | { zone: 'bench'; index: number };

export interface ActionEvents {
  merges: MergeEvent[];
  levelUps: number;
}

const ok = (message?: string): ActionResult => ({ ok: true, message });
const fail = (error: string): ActionResult => ({ ok: false, error });

export function canPlan(state: GameState, p: PlayerState): boolean {
  return p.alive && (state.phase === 'planning' || state.phase === 'combat' || state.phase === 'carousel');
}

function canEditBoard(state: GameState): boolean {
  return state.phase === 'planning';
}

export function newUid(state: GameState): string {
  return 'u' + state.nextUid++;
}

export function findUnit(p: PlayerState, uid: string): { unit: OwnedUnit; where: 'board' | 'bench'; index: number } | null {
  const bi = p.board.findIndex((s) => s.uid === uid);
  if (bi >= 0) return { unit: p.board[bi], where: 'board', index: bi };
  const ri = p.bench.findIndex((u) => u?.uid === uid);
  if (ri >= 0) return { unit: p.bench[ri]!, where: 'bench', index: ri };
  return null;
}

export function boardAt(p: PlayerState, col: number, row: number): BoardSlot | undefined {
  return p.board.find((s) => s.col === col && s.row === row);
}

export function freeBenchIndex(p: PlayerState): number {
  return p.bench.findIndex((u) => u === null);
}

let lastEvents: ActionEvents = { merges: [], levelUps: 0 };
/** Événements produits par la dernière action (fusions, montées de niveau), pour l'interface et l'audio. */
export function takeActionEvents(): ActionEvents {
  const e = lastEvents;
  lastEvents = { merges: [], levelUps: 0 };
  return e;
}

export function buyUnit(state: GameState, p: PlayerState, shopIndex: number): ActionResult {
  if (!canPlan(state, p)) return fail('Action impossible maintenant.');
  const defId = p.shop[shopIndex];
  if (!defId) return fail('Cet emplacement est vide.');
  const def = getChampion(defId);
  if (p.gold < def.cost) return fail(`Il faut ${def.cost} or pour recruter ${def.name}.`);
  const free = freeBenchIndex(p);
  if (free < 0 && !purchaseWouldMerge(p, defId)) return fail('La réserve est pleine.');
  spend(p, def.cost);
  p.shop[shopIndex] = null;
  const unit: OwnedUnit = { uid: newUid(state), defId, star: 1, items: [] };
  if (free >= 0) p.bench[free] = unit;
  else {
    // réserve pleine : la fusion libère la place immédiatement
    p.bench.push(unit);
  }
  p.stats.unitsBought++;
  const merges = mergeUnits(p);
  normalizeBench(p);
  lastEvents.merges.push(...merges);
  return ok();
}

/** Garantit que la réserve garde exactement BENCH_SIZE emplacements. */
function normalizeBench(p: PlayerState): void {
  if (p.bench.length <= BENCH_SIZE) {
    while (p.bench.length < BENCH_SIZE) p.bench.push(null);
    return;
  }
  const units = p.bench.filter((u): u is OwnedUnit => u !== null);
  const kept: (OwnedUnit | null)[] = p.bench.slice(0, BENCH_SIZE);
  for (const u of units) {
    if (kept.includes(u)) continue;
    const i = kept.findIndex((x) => x === null);
    if (i >= 0) kept[i] = u;
  }
  p.bench = kept;
}

export function sellUnit(state: GameState, p: PlayerState, uid: string): ActionResult {
  if (!canPlan(state, p)) return fail('Action impossible maintenant.');
  const found = findUnit(p, uid);
  if (!found) return fail('Unité introuvable.');
  if (found.where === 'board' && !canEditBoard(state)) return fail('Impossible de vendre une unité du plateau pendant le combat.');
  const def = getChampion(found.unit.defId);
  const value = sellValue(def.cost, found.unit.star);
  if (found.where === 'board') p.board.splice(found.index, 1);
  else p.bench[found.index] = null;
  returnToPool(state, def.id, copiesForStar(found.unit.star));
  p.items.push(...found.unit.items);
  earn(p, value);
  p.stats.unitsSold++;
  return ok(`${def.name} vendu pour ${value} or.`);
}

export function reroll(state: GameState, p: PlayerState): ActionResult {
  if (!canPlan(state, p)) return fail('Action impossible maintenant.');
  if (!spend(p, ECONOMY.rerollCost)) return fail(`Il faut ${ECONOMY.rerollCost} or pour actualiser la boutique.`);
  refreshShop(state, p);
  p.stats.rerolls++;
  return ok();
}

export function buyXp(state: GameState, p: PlayerState): ActionResult {
  if (!canPlan(state, p)) return fail('Action impossible maintenant.');
  if (p.level >= MAX_LEVEL) return fail('Niveau maximal atteint.');
  if (!spend(p, ECONOMY.xpBuyCost)) return fail(`Il faut ${ECONOMY.xpBuyCost} or pour acheter de l’expérience.`);
  const gained = addXp(p, ECONOMY.xpBuyAmount);
  p.stats.xpBought += ECONOMY.xpBuyAmount;
  lastEvents.levelUps += gained;
  return ok(gained ? `Niveau ${p.level} atteint !` : undefined);
}

export function toggleLock(state: GameState, p: PlayerState): ActionResult {
  if (!canPlan(state, p)) return fail('Action impossible maintenant.');
  p.shopLocked = !p.shopLocked;
  return ok(p.shopLocked ? 'Boutique verrouillée pour la prochaine manche.' : 'Boutique déverrouillée.');
}

function validBoardHex(col: number, row: number): boolean {
  return col >= 0 && col < BOARD_COLS && row >= 0 && row < PLAYER_ROWS;
}

/** Déplace une unité (échange si la destination est occupée). */
export function moveUnit(state: GameState, p: PlayerState, uid: string, dest: Dest): ActionResult {
  if (!canPlan(state, p)) return fail('Action impossible maintenant.');
  const found = findUnit(p, uid);
  if (!found) return fail('Unité introuvable.');
  const touchesBoard = found.where === 'board' || dest.zone === 'board';
  if (touchesBoard && !canEditBoard(state)) return fail('Le plateau est verrouillé pendant le combat.');

  if (dest.zone === 'board') {
    if (!validBoardHex(dest.col, dest.row)) return fail('Case hors de votre moitié du plateau.');
    const occupant = boardAt(p, dest.col, dest.row);
    if (found.where === 'board') {
      const slot = p.board[found.index];
      if (occupant && occupant !== slot) {
        occupant.col = slot.col;
        occupant.row = slot.row;
      }
      slot.col = dest.col;
      slot.row = dest.row;
      return ok();
    }
    // réserve → plateau
    const unit = found.unit;
    if (occupant) {
      // échange : l'occupant part dans la réserve à la place de l'unité
      p.board.splice(p.board.indexOf(occupant), 1);
      p.bench[found.index] = { uid: occupant.uid, defId: occupant.defId, star: occupant.star, items: occupant.items };
    } else {
      if (p.board.length >= deployLimit(p)) return fail(`Limite de déploiement atteinte (${deployLimit(p)} unités au niveau ${p.level}).`);
      p.bench[found.index] = null;
    }
    p.board.push({ ...unit, col: dest.col, row: dest.row });
    return ok();
  }

  // destination : réserve
  if (dest.index < 0 || dest.index >= BENCH_SIZE) return fail('Emplacement de réserve invalide.');
  const occupant = p.bench[dest.index];
  if (found.where === 'bench') {
    p.bench[found.index] = occupant;
    p.bench[dest.index] = found.unit;
    return ok();
  }
  // plateau → réserve
  const slot = p.board[found.index];
  p.board.splice(found.index, 1);
  if (occupant) {
    p.board.push({ ...occupant, col: slot.col, row: slot.row });
  }
  p.bench[dest.index] = { uid: slot.uid, defId: slot.defId, star: slot.star, items: slot.items };
  return ok();
}

export interface EquipPreview {
  kind: 'equip' | 'combine' | 'invalid';
  result?: ItemDef;
  reason?: string;
}

/** Prévisualise l'effet de l'équipement d'un objet sur une unité (jamais de consommation cachée). */
export function previewEquip(unit: OwnedUnit, itemId: string): EquipPreview {
  const item = findItem(itemId);
  if (!item) {
    const cons = findConsumable(itemId);
    if (cons) return unit.items.length ? { kind: 'equip' } : { kind: 'invalid', reason: 'Ce champion n’a aucun objet à retirer.' };
    return { kind: 'invalid', reason: 'Objet inconnu.' };
  }
  if (isComponent(itemId)) {
    const compIndex = unit.items.findIndex((i) => isComponent(i));
    if (compIndex >= 0) {
      const res = combine(unit.items[compIndex], itemId);
      if (res) {
        if (res.unique && unit.items.includes(res.id)) return { kind: 'invalid', reason: `${res.name} est unique.` };
        return { kind: 'combine', result: res };
      }
    }
  }
  if (unit.items.length >= MAX_ITEMS_PER_UNIT) return { kind: 'invalid', reason: 'Ce champion porte déjà 3 objets.' };
  if (item.unique && unit.items.includes(itemId)) return { kind: 'invalid', reason: `${item.name} est unique.` };
  return { kind: 'equip', result: item };
}

export function equipItem(state: GameState, p: PlayerState, itemIndex: number, uid: string): ActionResult {
  if (!canPlan(state, p)) return fail('Action impossible maintenant.');
  const itemId = p.items[itemIndex];
  if (!itemId) return fail('Objet introuvable.');
  const found = findUnit(p, uid);
  if (!found) return fail('Unité introuvable.');
  if (found.where === 'board' && !canEditBoard(state)) return fail('Le plateau est verrouillé pendant le combat.');
  const unit = found.unit;
  const cons = findConsumable(itemId);
  if (cons) {
    if (!unit.items.length) return fail('Ce champion n’a aucun objet à retirer.');
    p.items.splice(itemIndex, 1);
    p.items.push(...unit.items);
    unit.items = [];
    return ok(`${cons.name} : objets récupérés.`);
  }
  const prev = previewEquip(unit, itemId);
  if (prev.kind === 'invalid') return fail(prev.reason ?? 'Impossible d’équiper cet objet.');
  p.items.splice(itemIndex, 1);
  if (prev.kind === 'combine' && prev.result) {
    const compIndex = unit.items.findIndex((i) => isComponent(i));
    unit.items[compIndex] = prev.result.id;
    p.stats.itemsCrafted++;
    return ok(`${prev.result.name} assemblé !`);
  }
  unit.items.push(itemId);
  return ok();
}

/** Combine deux composants de la réserve d'objets. */
export function combineBenchItems(state: GameState, p: PlayerState, i: number, j: number): ActionResult {
  if (!canPlan(state, p)) return fail('Action impossible maintenant.');
  if (i === j) return fail('Choisissez deux objets différents.');
  const a = p.items[i];
  const b = p.items[j];
  if (!a || !b) return fail('Objet introuvable.');
  if (!isComponent(a) || !isComponent(b)) return fail('Seuls deux composants peuvent être combinés.');
  const res = combine(a, b);
  if (!res) return fail('Aucune recette pour ces composants.');
  const [hi, lo] = i > j ? [i, j] : [j, i];
  p.items.splice(hi, 1);
  p.items.splice(lo, 1, res.id);
  p.stats.itemsCrafted++;
  return ok(`${res.name} assemblé !`);
}

/** Avant le combat : complète le plateau avec la réserve et retire l'excédent. */
export function autoFillBoard(p: PlayerState): void {
  const limit = deployLimit(p);
  while (p.board.length > limit) {
    const slot = p.board.pop()!;
    const free = freeBenchIndex(p);
    if (free >= 0) p.bench[free] = { uid: slot.uid, defId: slot.defId, star: slot.star, items: slot.items };
    else p.board.unshift(slot); // ne jamais perdre une unité : on la remet si la réserve est pleine
    if (free < 0) break;
  }
  while (p.board.length < limit) {
    const idx = p.bench.findIndex((u) => u !== null);
    if (idx < 0) break;
    const u = p.bench[idx]!;
    const hex = firstFreeHex(p, getChampion(u.defId).position);
    if (!hex) break;
    p.bench[idx] = null;
    p.board.push({ ...u, col: hex.col, row: hex.row });
  }
}

function firstFreeHex(p: PlayerState, position: 'front' | 'back' | 'flex'): { col: number; row: number } | null {
  const rows = position === 'front' ? [0, 1, 2, 3] : position === 'back' ? [3, 2, 1, 0] : [1, 2, 0, 3];
  const cols = [3, 2, 4, 1, 5, 0, 6];
  for (const row of rows) for (const col of cols) if (!boardAt(p, col, row)) return { col, row };
  return null;
}
