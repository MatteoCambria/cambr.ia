/**
 * Déroulement d'une partie solo : manches, carrousel, combats, résolution, éliminations.
 * Toutes les fonctions opèrent sur un GameState sérialisable ; aucune dépendance au rendu.
 */
import { BENCH_SIZE, ECONOMY, PLAYER_START_HP, STAGE_DAMAGE, copiesForStar, sellValue, survivorDamage } from '../config/balance';
import { PVE_ENCOUNTERS, carouselCosts, roundAt, type Loot } from '../config/rounds';
import { CHAMPIONS, COMBINED, COMPONENTS, getChampion, getTrait } from '../core/content';
import { Rng, hashString } from '../core/rng';
import { buildCombat, computeTraits, type SideSpec } from '../combat/setup';
import type { CombatResult, CombatSim } from '../combat/sim';
import { applyIncome, earn } from '../economy/economy';
import { addXp } from '../progression/levels';
import { mergeUnits } from '../progression/starup';
import { createPool, returnPlayerUnits, returnToPool, takeFromPool } from '../shop/pool';
import { refreshShop } from '../shop/shop';
import { initMemory, pickCarouselOffer, planTurn } from '../ai/opponent';
import { AI_PERSONAS } from '../ai/profiles';
import { autoFillBoard, freeBenchIndex, newUid } from './actions';
import { takeSnapshot } from './snapshot';
import type { CombatSideSummary, GameSettings, GameState, Pairing, PlayerRunStats, PlayerState, RoundRecord } from './types';

export const STATE_VERSION = 1;
export const HUMAN_ID = 0;

function emptyStats(): PlayerRunStats {
  return {
    goldEarned: 0,
    goldSpent: 0,
    interestEarned: 0,
    rerolls: 0,
    xpBought: 0,
    unitsBought: 0,
    unitsSold: 0,
    starUps2: 0,
    starUps3: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    damageDealt: 0,
    damageTaken: 0,
    bestStreak: 0,
    itemsCrafted: 0,
    championDamage: {},
    championRounds: {},
    hpHistory: [PLAYER_START_HP],
  };
}

export interface CreateOptions {
  /** Tous les sièges sont joués par l'IA (simulations d'équilibrage). */
  allBots?: boolean;
}

export function createGame(settings: GameSettings, opts: CreateOptions = {}): GameState {
  const rng = new Rng('partie:' + settings.seed);
  const personas = rng.shuffle(AI_PERSONAS.slice());
  const players: PlayerState[] = [];
  for (let i = 0; i < settings.playerCount; i++) {
    const human = i === HUMAN_ID;
    const persona = personas[(i - 1 + personas.length) % personas.length];
    const p: PlayerState = {
      id: i,
      name: human ? settings.playerName || 'Vous' : persona.name,
      title: human ? 'Archonte' : persona.title,
      isHuman: human,
      color: human ? '#ffd27a' : persona.color,
      hp: PLAYER_START_HP,
      gold: ECONOMY.startGold,
      level: 1,
      xp: 0,
      board: [],
      bench: Array.from({ length: BENCH_SIZE }, () => null),
      items: [],
      shop: [],
      shopLocked: false,
      shopRng: rng.fork('boutique:' + i).getState(),
      streak: 0,
      alive: true,
      placement: null,
      eliminatedRound: null,
      stats: emptyStats(),
      nomadeWins: 0,
      recentOpponents: [],
      snapshot: null,
      lastIncome: null,
    };
    if (!human || opts.allBots) p.ai = initMemory(human ? 'flexible' : persona.profile, rng.fork('ia:' + i));
    players.push(p);
  }
  const state: GameState = {
    version: STATE_VERSION,
    settings: { ...settings },
    roundIndex: 0,
    phase: 'carousel',
    players,
    pool: createPool(),
    rng: rng.getState(),
    pairings: [],
    carousel: null,
    history: [],
    nextUid: 1,
    startedAt: Date.now(),
    lastRound: null,
    winnerId: null,
  };
  beginRound(state);
  return state;
}

function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.rng);
  const out = fn(rng);
  state.rng = rng.getState();
  return out;
}

export function alivePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => p.alive);
}

export function human(state: GameState): PlayerState {
  return state.players[HUMAN_ID];
}

/** Début d'une manche : revenus, expérience, boutique, puis décisions de l'IA. */
export function beginRound(state: GameState): void {
  const r = roundAt(state.roundIndex);
  for (const p of alivePlayers(state)) {
    if (state.roundIndex > 0) applyIncome(state, p);
    if (state.roundIndex > 0) addXp(p, ECONOMY.passiveXpPerRound);
    if (state.roundIndex > 0 && !p.shopLocked) refreshShop(state, p);
  }
  if (r.kind === 'carousel') {
    setupCarousel(state);
    state.phase = 'carousel';
    advanceCarousel(state);
    return;
  }
  state.phase = 'planning';
  for (const p of alivePlayers(state)) if (p.ai) planTurn(state, p);
}

// ── Carrousel ───────────────────────────────────────────────────────────────
function setupCarousel(state: GameState): void {
  const r = roundAt(state.roundIndex);
  const alive = alivePlayers(state);
  withRng(state, (rng) => {
    const count = Math.max(5, alive.length + 1);
    const costs = carouselCosts(r.stage);
    const offers = [];
    for (let i = 0; i < count; i++) {
      const cost = costs[i % costs.length];
      const cands = CHAMPIONS.filter((c) => c.cost === cost && (state.pool[c.id] ?? 0) > 0);
      if (!cands.length) continue;
      const idx = rng.weightedIndex(cands.map((c) => state.pool[c.id]));
      const def = cands[Math.max(0, idx)];
      takeFromPool(state, def.id, 1);
      const combined = r.stage >= 4 && rng.chance(0.35);
      const item = combined ? rng.pick(COMBINED).id : rng.pick(COMPONENTS).id;
      offers.push({ defId: def.id, item, takenBy: null as number | null });
    }
    const order = rng
      .shuffle(alive.slice())
      .sort((a, b) => a.hp - b.hp)
      .map((p) => p.id);
    state.carousel = { offers, order, cursor: 0 };
  });
}

export function carouselTurn(state: GameState): number | null {
  const c = state.carousel;
  if (!c || c.cursor >= c.order.length) return null;
  return c.order[c.cursor];
}

export function carouselPick(state: GameState, playerId: number, offerIndex: number): boolean {
  const c = state.carousel;
  if (!c || state.phase !== 'carousel') return false;
  if (carouselTurn(state) !== playerId) return false;
  const offer = c.offers[offerIndex];
  if (!offer || offer.takenBy !== null) return false;
  offer.takenBy = playerId;
  const p = state.players[playerId];
  const free = freeBenchIndex(p);
  if (free >= 0) {
    p.bench[free] = { uid: newUid(state), defId: offer.defId, star: 1, items: [] };
    mergeUnits(p);
  } else {
    // réserve pleine : le champion est revendu, l'objet est conservé
    returnToPool(state, offer.defId, 1);
    earn(p, sellValue(getChampion(offer.defId).cost, 1));
  }
  p.items.push(offer.item);
  c.cursor++;
  return true;
}

/** Fait choisir les IA jusqu'au tour du joueur humain ; termine le carrousel s'il est fini. */
export function advanceCarousel(state: GameState): void {
  const c = state.carousel;
  if (!c) return;
  while (c.cursor < c.order.length) {
    const pid = c.order[c.cursor];
    const p = state.players[pid];
    if (!p.ai) return; // au joueur de choisir
    const free = c.offers.map((o, index) => ({ ...o, index })).filter((o) => o.takenBy === null);
    const pick = pickCarouselOffer(state, p, free);
    if (pick < 0 || !carouselPick(state, pid, pick)) c.cursor++;
  }
  finishCarousel(state);
}

/** Choix automatique pour le joueur humain (temps écoulé). */
export function autoCarouselPick(state: GameState): void {
  const c = state.carousel;
  const pid = carouselTurn(state);
  if (!c || pid === null) return;
  const free = c.offers.map((o, i) => ({ o, i })).filter((x) => x.o.takenBy === null);
  if (!free.length) return;
  const best = free.sort((a, b) => getChampion(b.o.defId).cost - getChampion(a.o.defId).cost)[0];
  carouselPick(state, pid, best.i);
}

function finishCarousel(state: GameState): void {
  const c = state.carousel;
  if (c) for (const o of c.offers) if (o.takenBy === null) returnToPool(state, o.defId, 1);
  state.carousel = null;
  state.history.push({ round: state.roundIndex, label: roundAt(state.roundIndex).label, kind: 'carousel', results: [] });
  state.roundIndex++;
  beginRound(state);
}

// ── Combats ─────────────────────────────────────────────────────────────────
function makePairings(state: GameState): Pairing[] {
  const alive = alivePlayers(state).map((p) => p.id);
  return withRng(state, (rng) => {
    let best: number[] = alive;
    let bestCost = Infinity;
    for (let attempt = 0; attempt < 24; attempt++) {
      const order = rng.shuffle(alive.slice());
      let cost = 0;
      for (let i = 0; i + 1 < order.length; i += 2) {
        const a = state.players[order[i]];
        const k = a.recentOpponents.indexOf(order[i + 1]);
        if (k >= 0) cost += k === a.recentOpponents.length - 1 ? 10 : 3;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = order;
      }
      if (cost === 0) break;
    }
    const out: Pairing[] = [];
    for (let i = 0; i + 1 < best.length; i += 2) out.push({ a: best[i], b: best[i + 1], seed: rng.nextU32() });
    if (best.length % 2 === 1) {
      const last = best[best.length - 1];
      const others = alive.filter((id) => id !== last);
      const ghostOf = others.length ? rng.pick(others) : last;
      out.push({ a: last, b: ghostOf, ghostOf, seed: rng.nextU32() });
    }
    return out;
  });
}

export function sideSpec(p: PlayerState): SideSpec {
  return { units: p.board.map((s) => ({ uid: s.uid, defId: s.defId, star: s.star, items: s.items, hex: { col: s.col, row: s.row } })) };
}

/** Passe en phase de combat : place automatiquement, prend les instantanés publics, apparie. */
export function startCombatPhase(state: GameState): Pairing[] {
  if (state.phase !== 'planning') return state.pairings;
  const r = roundAt(state.roundIndex);
  for (const p of alivePlayers(state)) {
    autoFillBoard(p);
    p.snapshot = takeSnapshot(state, p);
    for (const s of p.board) p.stats.championRounds[s.defId] = (p.stats.championRounds[s.defId] ?? 0) + 1;
  }
  if (r.kind === 'pve') {
    state.pairings = withRng(state, (rng) => alivePlayers(state).map((p) => ({ a: p.id, b: null, seed: rng.nextU32() })));
  } else state.pairings = makePairings(state);
  state.phase = 'combat';
  return state.pairings;
}

export function buildPairingCombat(state: GameState, pairing: Pairing, recordEvents = false): CombatSim {
  const r = roundAt(state.roundIndex);
  const a = state.players[pairing.a];
  let side1: SideSpec;
  if (pairing.b === null) {
    const enc = PVE_ENCOUNTERS[r.pve ?? 'lucioles'];
    side1 = { units: [], creatures: enc.units };
  } else {
    side1 = sideSpec(state.players[pairing.b]);
  }
  return buildCombat([sideSpec(a), side1], {
    seed: pairing.seed,
    stage: r.stage,
    recordEvents,
    labels: [a.name, pairing.b === null ? 'Créatures' : state.players[pairing.b].name],
  });
}

/** Simule tous les combats sauf (optionnellement) celui du joueur humain. */
export function simulateCombats(state: GameState, skipHuman: boolean): (CombatResult | null)[] {
  return state.pairings.map((pr) => {
    if (skipHuman && (pr.a === HUMAN_ID || (pr.b === HUMAN_ID && pr.ghostOf === undefined))) return null;
    return buildPairingCombat(state, pr, false).run();
  });
}

export function humanPairingIndex(state: GameState): number {
  return state.pairings.findIndex((pr) => pr.a === HUMAN_ID || (pr.b === HUMAN_ID && pr.ghostOf === undefined));
}

function grantLoot(state: GameState, p: PlayerState, loot: Loot, rng: Rng): string[] {
  const got: string[] = [];
  if (loot.gold) {
    earn(p, loot.gold);
    got.push(`${loot.gold} or`);
  }
  for (let i = 0; i < (loot.components ?? 0); i++) {
    const c = rng.pick(COMPONENTS);
    p.items.push(c.id);
    got.push(c.name);
  }
  for (let i = 0; i < (loot.combined ?? 0); i++) {
    const c = rng.pick(COMBINED);
    p.items.push(c.id);
    got.push(c.name);
  }
  for (const id of loot.consumables ?? []) {
    p.items.push(id);
    got.push('Clé de démontage');
  }
  if (loot.champions) {
    for (let i = 0; i < loot.champions.count; i++) {
      const cands = CHAMPIONS.filter((c) => c.cost === loot.champions!.cost && (state.pool[c.id] ?? 0) > 0);
      if (!cands.length) continue;
      const def = cands[Math.max(0, rng.weightedIndex(cands.map((c) => state.pool[c.id])))];
      const free = freeBenchIndex(p);
      takeFromPool(state, def.id, 1);
      if (free >= 0) {
        p.bench[free] = { uid: newUid(state), defId: def.id, star: 1, items: [] };
        mergeUnits(p);
        got.push(def.name);
      } else {
        returnToPool(state, def.id, 1);
        earn(p, def.cost);
        got.push(`${def.cost} or (réserve pleine)`);
      }
    }
  }
  return got;
}

function nomadeLevel(p: PlayerState): number {
  const t = computeTraits(p.board).find((x) => x.id === 'nomade');
  return t ? t.level : 0;
}

/** Applique les résultats de tous les combats de la manche et passe à la suivante. */
export function resolveRound(state: GameState, results: CombatResult[], stopOnHumanDeath = true): void {
  const r = roundAt(state.roundIndex);
  const summaries: CombatSideSummary[] = [];
  const record: RoundRecord = { round: state.roundIndex, label: r.label, kind: r.kind === 'pve' ? 'pve' : 'pvp', results: [] };
  const stageDmg = STAGE_DAMAGE[Math.min(r.stage, STAGE_DAMAGE.length - 1)];
  const damageOf = (res: CombatResult, winnerSide: 0 | 1) =>
    stageDmg + res.survivors.filter((s) => s.side === winnerSide).reduce((s, u) => s + survivorDamage(u.star, u.cost), 0);

  withRng(state, (rng) => {
    state.pairings.forEach((pr, i) => {
      const res = results[i];
      if (!res) throw new Error('Résultat de combat manquant');
      const sides: { pid: number; side: 0 | 1 }[] = [{ pid: pr.a, side: 0 }];
      if (pr.b !== null && pr.ghostOf === undefined) sides.push({ pid: pr.b, side: 1 });
      for (const { pid, side } of sides) {
        const p = state.players[pid];
        const won = res.winner === side;
        const draw = res.winner === -1;
        let damage = 0;
        let goldGained = res.gold[side];
        const loot: string[] = [];
        if (pr.b === null) {
          // rencontre neutre
          const enc = PVE_ENCOUNTERS[r.pve ?? 'lucioles'];
          if (won) loot.push(...grantLoot(state, p, enc.loot, rng));
          else {
            damage = stageDmg + res.survivors.filter((s) => s.side === 1).length;
            loot.push(...grantLoot(state, p, enc.lossLoot, rng));
          }
        } else {
          if (won) {
            goldGained += ECONOMY.pvpWinGold;
            p.streak = p.streak >= 0 ? p.streak + 1 : 1;
            p.stats.wins++;
            if (pr.ghostOf === undefined) p.stats.damageDealt += damageOf(res, side);
          } else if (draw) {
            damage = stageDmg;
            p.streak = 0;
            p.stats.draws++;
          } else {
            damage = damageOf(res, side === 0 ? 1 : 0);
            p.streak = p.streak <= 0 ? p.streak - 1 : -1;
            p.stats.losses++;
          }
          p.stats.bestStreak = Math.max(p.stats.bestStreak, Math.abs(p.streak));
          // synergie Nomade
          const nl = nomadeLevel(p);
          if (nl > 0) {
            const eco = getTrait('nomade').levels[nl - 1].economy;
            goldGained += eco?.goldAfterCombat ?? 0;
            if (won && eco?.componentEveryNWins) {
              p.nomadeWins++;
              if (p.nomadeWins % eco.componentEveryNWins === 0) loot.push(...grantLoot(state, p, { components: 1 }, rng));
            }
          }
          const opp = pr.ghostOf ?? (side === 0 ? pr.b : pr.a);
          p.recentOpponents.push(opp);
          if (p.recentOpponents.length > 3) p.recentOpponents.shift();
        }
        earn(p, goldGained);
        p.hp -= damage;
        p.stats.damageTaken += damage;
        for (const u of res.units) {
          if (u.side !== side || u.kind !== 'champion') continue;
          p.stats.championDamage[u.defId] = (p.stats.championDamage[u.defId] ?? 0) + u.stats.damageDealt;
        }
        summaries.push({ playerId: pid, won, draw, damageTaken: damage, survivors: res.survivors.filter((s) => s.side === side).length, goldGained, loot });
        record.results.push({ playerId: pid, opponent: pr.b === null ? null : side === 0 ? pr.b : pr.a, ghost: pr.ghostOf !== undefined, won, draw, damage, duration: res.duration });
      }
    });
  });

  // Éliminations
  const dying = alivePlayers(state)
    .filter((p) => p.hp <= 0)
    .sort((a, b) => a.hp - b.hp);
  let place = alivePlayers(state).length;
  for (const p of dying) {
    p.alive = false;
    p.placement = place--;
    p.eliminatedRound = state.roundIndex;
    returnPlayerUnits(state, p);
  }
  for (const p of state.players) p.stats.hpHistory.push(Math.max(0, p.hp));

  state.history.push(record);
  state.lastRound = { label: r.label, summaries };

  const alive = alivePlayers(state);
  if (alive.length <= 1 || (stopOnHumanDeath && !state.players[HUMAN_ID].alive)) {
    if (alive.length === 1) {
      alive[0].placement = 1;
      state.winnerId = alive[0].id;
    }
    state.phase = 'gameOver';
    return;
  }
  state.roundIndex++;
  beginRound(state);
}

/** Termine la partie restante sans le joueur (après son élimination) pour connaître le classement final. */
export function fastForwardToEnd(state: GameState, maxRounds = 80): void {
  for (const p of state.players) if (p.alive && !p.ai) p.ai = initMemory('flexible', new Rng(hashString(state.settings.seed + p.id)));
  if (state.phase === 'gameOver' && alivePlayers(state).length > 1) {
    state.roundIndex++;
    beginRound(state);
  }
  let guard = 0;
  while (state.phase !== 'gameOver' && guard++ < maxRounds) {
    if (state.phase === 'carousel') advanceCarousel(state);
    else if (state.phase === 'planning') {
      startCombatPhase(state);
      resolveRound(state, simulateCombats(state, false) as CombatResult[], false);
    } else break;
  }
}

/** Partie entièrement simulée (toutes les places tenues par l'IA). */
export function runHeadlessGame(settings: GameSettings, maxRounds = 120): GameState {
  const state = createGame(settings, { allBots: true });
  let guard = 0;
  while (state.phase !== 'gameOver' && guard++ < maxRounds) {
    if (state.phase === 'carousel') {
      advanceCarousel(state);
      continue;
    }
    if (state.phase === 'planning') {
      startCombatPhase(state);
      resolveRound(state, simulateCombats(state, false) as CombatResult[], false);
    }
  }
  return state;
}

/** Contrôle d'intégrité : aucun exemplaire ni objet dupliqué ou perdu. */
export function integrityErrors(state: GameState): string[] {
  const errs: string[] = [];
  for (const p of state.players) {
    const uids = new Set<string>();
    for (const u of [...p.board, ...p.bench.filter((x): x is NonNullable<typeof x> => !!x)]) {
      if (uids.has(u.uid)) errs.push(`${p.name} : unité ${u.uid} en double`);
      uids.add(u.uid);
      if (u.items.length > 3) errs.push(`${p.name} : ${u.defId} porte plus de 3 objets`);
    }
    if (p.board.length > p.level && p.alive) errs.push(`${p.name} : ${p.board.length} unités pour le niveau ${p.level}`);
    const cells = new Set<string>();
    for (const s of p.board) {
      const k = s.col + ',' + s.row;
      if (cells.has(k)) errs.push(`${p.name} : deux unités en ${k}`);
      cells.add(k);
      if (s.col < 0 || s.col > 6 || s.row < 0 || s.row > 3) errs.push(`${p.name} : case invalide ${k}`);
    }
    if (p.bench.length !== BENCH_SIZE) errs.push(`${p.name} : réserve de ${p.bench.length} emplacements`);
    if (p.gold < 0) errs.push(`${p.name} : or négatif`);
  }
  return errs;
}

export { copiesForStar };
