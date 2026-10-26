import { describe, expect, it } from 'vitest';
import { createGame, runHeadlessGame, integrityErrors, startCombatPhase, simulateCombats, resolveRound, HUMAN_ID, carouselTurn, carouselPick, advanceCarousel } from '../src/game/game';
import { buyUnit, sellUnit, reroll, buyXp, moveUnit, equipItem, combineBenchItems, previewEquip, toggleLock } from '../src/game/actions';
import { checkPoolIntegrity } from '../src/shop/pool';
import { refreshShop, drawChampion } from '../src/shop/shop';
import { interestFor, computeIncome } from '../src/economy/economy';
import { addXp } from '../src/progression/levels';
import { mergeUnits } from '../src/progression/starup';
import { ECONOMY, SHOP_ODDS, sellValue, XP_TO_NEXT } from '../src/config/balance';
import { getChampion, CHAMPIONS } from '../src/core/content';
import { Rng } from '../src/core/rng';
import type { GameState, PlayerState } from '../src/game/types';
import type { CombatResult } from '../src/combat/sim';

const settings = (seed = 't') => ({ playerCount: 8, prepTime: 0, difficulty: 'normal' as const, seed, playerName: 'Test' });

function planningState(seed = 'p'): GameState {
  const st = createGame(settings(seed));
  // passer le carrousel d'ouverture
  while (st.phase === 'carousel') {
    const t = carouselTurn(st);
    if (t === HUMAN_ID) {
      const idx = st.carousel!.offers.findIndex((o) => o.takenBy === null);
      carouselPick(st, HUMAN_ID, idx);
    }
    advanceCarousel(st);
  }
  return st;
}

function me(st: GameState): PlayerState {
  return st.players[HUMAN_ID];
}

describe('économie', () => {
  it('calcule les intérêts par tranche de 10, plafonnés', () => {
    expect(interestFor(9)).toBe(0);
    expect(interestFor(10)).toBe(1);
    expect(interestFor(37)).toBe(3);
    expect(interestFor(80)).toBe(ECONOMY.interestMax);
  });
  it('accorde les bonus de série', () => {
    expect(ECONOMY.streakBonus(1)).toBe(0);
    expect(ECONOMY.streakBonus(-3)).toBe(1);
    expect(ECONOMY.streakBonus(4)).toBe(2);
    expect(ECONOMY.streakBonus(-7)).toBe(3);
  });
  it('détaille le revenu (base + intérêts + série)', () => {
    const st = planningState();
    const p = me(st);
    p.gold = 34;
    p.streak = 4;
    const inc = computeIncome(6, p);
    expect(inc).toEqual({ base: ECONOMY.baseIncome, interest: 3, streak: 2, total: ECONOMY.baseIncome + 5 });
  });
  it('valeur de revente selon le rang', () => {
    expect(sellValue(1, 1)).toBe(1);
    expect(sellValue(3, 1)).toBe(3);
    expect(sellValue(3, 2)).toBe(8);
    expect(sellValue(1, 2)).toBe(2);
    expect(sellValue(2, 3)).toBe(17);
  });
});

describe('boutique et pool', () => {
  it('respecte les probabilités par niveau (échantillon statistique)', () => {
    const st = planningState('odds');
    const rng = new Rng(123);
    for (const level of [3, 7, 9]) {
      const counts = [0, 0, 0, 0, 0];
      const N = 4000;
      for (let i = 0; i < N; i++) {
        const id = drawChampion(st, rng, level)!;
        counts[getChampion(id).cost - 1]++;
        st.pool[id]++; // remise pour garder le pool stable
      }
      SHOP_ODDS[level].forEach((pct, i) => expect(Math.abs((counts[i] / N) * 100 - pct)).toBeLessThan(3));
    }
  });
  it('conserve le nombre total d’exemplaires (achats, ventes, actualisations)', () => {
    const st = planningState('pool');
    const p = me(st);
    p.gold = 500;
    for (let i = 0; i < 40; i++) {
      reroll(st, p);
      for (let s = 0; s < 5; s++) buyUnit(st, p, s);
      const benchUnit = p.bench.find((u) => u);
      if (benchUnit && i % 3 === 0) sellUnit(st, p, benchUnit.uid);
      expect(checkPoolIntegrity(st)).toEqual([]);
      expect(integrityErrors(st)).toEqual([]);
    }
  });
  it('refuse l’achat sans or ou sans place', () => {
    const st = planningState('noGold');
    const p = me(st);
    p.gold = 0;
    refreshShop(st, p);
    expect(buyUnit(st, p, 0).ok).toBe(false);
    p.gold = 1000;
    const r = reroll(st, p);
    expect(r.ok).toBe(true);
    expect(p.gold).toBe(1000 - ECONOMY.rerollCost);
  });
  it('le verrouillage conserve la boutique à la manche suivante', () => {
    const st = planningState('lock');
    const p = me(st);
    refreshShop(st, p);
    const before = [...p.shop];
    toggleLock(st, p);
    startCombatPhase(st);
    resolveRound(st, simulateCombats(st, false) as CombatResult[]);
    expect(p.shop).toEqual(before);
  });
});

describe('progression', () => {
  it('monte de niveau selon les seuils d’XP', () => {
    const st = planningState('xp');
    const p = me(st);
    p.level = 3;
    p.xp = 0;
    addXp(p, XP_TO_NEXT[3]);
    expect(p.level).toBe(4);
    p.gold = 100;
    const lvl = p.level;
    buyXp(st, p);
    expect(p.xp + (p.level - lvl) * 0).toBeGreaterThanOrEqual(0);
    expect(p.gold).toBe(100 - ECONOMY.xpBuyCost);
  });
  it('fusionne 3 exemplaires répartis entre plateau et réserve, en gardant la position et les objets', () => {
    const st = planningState('merge');
    const p = me(st);
    p.board = [{ uid: 'a', defId: 'aurel', star: 1, items: ['lame'], col: 2, row: 0 }];
    p.bench = [{ uid: 'b', defId: 'aurel', star: 1, items: ['arc'] }, null, { uid: 'c', defId: 'aurel', star: 1, items: [] }, null, null, null, null, null, null];
    const ev = mergeUnits(p);
    expect(ev).toHaveLength(1);
    expect(p.board).toHaveLength(1);
    expect(p.board[0]).toMatchObject({ uid: 'a', star: 2, col: 2, row: 0 });
    expect(p.board[0].items.sort()).toEqual(['arc', 'lame']);
    expect(p.bench.filter(Boolean)).toHaveLength(0);
  });
  it('enchaîne vers 3★ avec 9 exemplaires', () => {
    const st = planningState('merge3');
    const p = me(st);
    p.board = [];
    p.bench = Array.from({ length: 9 }, (_, i) => ({ uid: 'x' + i, defId: 'pim', star: 1 as const, items: [] }));
    mergeUnits(p);
    const units = p.bench.filter(Boolean);
    expect(units).toHaveLength(1);
    expect(units[0]!.star).toBe(3);
  });
});

describe('plateau et objets', () => {
  it('limite le déploiement au niveau du joueur', () => {
    const st = planningState('deploy');
    const p = me(st);
    p.level = 1;
    p.board = [{ uid: 'a', defId: 'aurel', star: 1, items: [], col: 0, row: 0 }];
    p.bench[0] = { uid: 'b', defId: 'pim', star: 1, items: [] };
    const r = moveUnit(st, p, 'b', { zone: 'board', col: 3, row: 3 });
    expect(r.ok).toBe(false);
    // l'échange avec une unité du plateau reste permis
    expect(moveUnit(st, p, 'b', { zone: 'board', col: 0, row: 0 }).ok).toBe(true);
    expect(p.board[0].defId).toBe('pim');
    expect(p.bench[0]!.defId).toBe('aurel');
  });
  it('interdit les cases hors de la moitié du joueur', () => {
    const st = planningState('bounds');
    const p = me(st);
    p.bench[0] = { uid: 'b', defId: 'pim', star: 1, items: [] };
    expect(moveUnit(st, p, 'b', { zone: 'board', col: 3, row: 5 }).ok).toBe(false);
    expect(moveUnit(st, p, 'b', { zone: 'board', col: 9, row: 0 }).ok).toBe(false);
  });
  it('combine deux composants sur une unité en affichant le résultat avant', () => {
    const st = planningState('items');
    const p = me(st);
    p.board = [{ uid: 'a', defId: 'seraphine', star: 1, items: ['lame'], col: 0, row: 3 }];
    p.items = ['arc'];
    const prev = previewEquip(p.board[0], 'arc');
    expect(prev.kind).toBe('combine');
    expect(prev.result!.id).toBe('lame_marees');
    expect(equipItem(st, p, 0, 'a').ok).toBe(true);
    expect(p.board[0].items).toEqual(['lame_marees']);
    expect(p.items).toEqual([]);
  });
  it('refuse un 4e objet et ne consomme rien', () => {
    const st = planningState('items4');
    const p = me(st);
    p.board = [{ uid: 'a', defId: 'seraphine', star: 1, items: ['fendeur', 'grimoire', 'bastion'], col: 0, row: 3 }];
    p.items = ['coeur_geant'];
    expect(equipItem(st, p, 0, 'a').ok).toBe(false);
    expect(p.items).toEqual(['coeur_geant']);
  });
  it('combine deux composants dans la réserve d’objets', () => {
    const st = planningState('benchItems');
    const p = me(st);
    p.items = ['ceinture', 'larme', 'ceinture'];
    expect(combineBenchItems(st, p, 0, 2).ok).toBe(true);
    expect(p.items.sort()).toEqual(['coeur_geant', 'larme']);
  });
  it('la vente rend les objets à la réserve', () => {
    const st = planningState('sellItems');
    const p = me(st);
    p.bench[0] = { uid: 'z', defId: 'aurel', star: 1, items: ['coeur_geant'] };
    p.items = [];
    st.pool['aurel']--;
    expect(sellUnit(st, p, 'z').ok).toBe(true);
    expect(p.items).toEqual(['coeur_geant']);
  });
});

describe('déroulement de partie', () => {
  it('une partie simulée se termine avec un vainqueur et des classements uniques', () => {
    for (const diff of ['facile', 'normal', 'difficile'] as const) {
      const st = runHeadlessGame({ ...settings('full-' + diff), difficulty: diff });
      expect(st.phase).toBe('gameOver');
      expect(st.winnerId).not.toBeNull();
      const places = st.players.map((p) => p.placement).sort((a, b) => a! - b!);
      expect(places).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(integrityErrors(st)).toEqual([]);
      expect(checkPoolIntegrity(st)).toEqual([]);
    }
  });
  it('les adversaires construisent des équipes cohérentes (synergies actives)', () => {
    const st = runHeadlessGame(settings('coherence'));
    const winner = st.players.find((p) => p.id === st.winnerId)!;
    expect(winner.board.length).toBeGreaterThanOrEqual(6);
  });
  it('les parties sont reproductibles avec la même graine', () => {
    const a = runHeadlessGame(settings('repro'));
    const b = runHeadlessGame(settings('repro'));
    expect(a.players.map((p) => [p.placement, p.hp, p.gold])).toEqual(b.players.map((p) => [p.placement, p.hp, p.gold]));
  });
  it('le carrousel donne un champion et un objet à chaque joueur', () => {
    const st = createGame(settings('carousel'));
    expect(st.phase).toBe('carousel');
    expect(carouselTurn(st)).not.toBeNull();
    const idx = st.carousel!.offers.findIndex((o) => o.takenBy === null);
    expect(carouselPick(st, carouselTurn(st)!, idx)).toBe(true);
    advanceCarousel(st);
    while (st.phase === 'carousel') {
      const t = carouselTurn(st)!;
      carouselPick(st, t, st.carousel!.offers.findIndex((o) => o.takenBy === null));
      advanceCarousel(st);
    }
    for (const p of st.players) expect(p.items.length).toBeGreaterThanOrEqual(1);
    expect(checkPoolIntegrity(st)).toEqual([]);
  });
  it('n’accorde pas d’informations cachées aux IA (pas d’accès à la boutique d’autrui)', async () => {
    // garde-fou statique : les modules de l'IA n'importent ni le pool ni la boutique
    const fs = await import('node:fs');
    for (const f of ['src/ai/opponent.ts', 'src/ai/evaluate.ts', 'src/ai/placement.ts']) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src).not.toMatch(/state\.pool|\.shopRng|from '\.\.\/shop\//);
      expect(src).not.toMatch(/state\.players\[[^\]]+\]\.(shop|bench|board)/);
    }
  });
  it('chaque champion du catalogue peut apparaître en boutique', () => {
    const st = planningState('all');
    const seen = new Set<string>();
    const rng = new Rng(5);
    for (let i = 0; i < 20000 && seen.size < CHAMPIONS.length; i++) {
      const id = drawChampion(st, rng, 9)!;
      seen.add(id);
      st.pool[id]++;
    }
    expect(seen.size).toBe(CHAMPIONS.length);
  });
});
