import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../src/game/game';
import {
  DEFAULT_SETTINGS,
  clearGame,
  loadGame,
  loadProfile,
  loadSettings,
  saveGame,
  saveSettings,
  validateGameState,
  validateSettings,
} from '../src/save/save';

class MemoryStorage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

const g = globalThis as unknown as { localStorage?: MemoryStorage };

describe('sauvegarde', () => {
  beforeEach(() => {
    g.localStorage = new MemoryStorage();
  });
  afterEach(() => {
    delete g.localStorage;
  });

  it('enregistre et recharge une partie identique', () => {
    const st = createGame({ playerCount: 6, prepTime: 30, difficulty: 'normal', seed: 'save', playerName: 'Test' });
    expect(saveGame(st)).toBe(true);
    const back = loadGame();
    expect(back).not.toBeNull();
    expect(back!.state).toEqual(JSON.parse(JSON.stringify(st)));
  });

  it('ignore une sauvegarde altérée (somme de contrôle)', () => {
    const st = createGame({ playerCount: 4, prepTime: 30, difficulty: 'normal', seed: 'tamper', playerName: 'T' });
    saveGame(st);
    const raw = JSON.parse(g.localStorage!.getItem('orrhea.game.v1')!);
    raw.state.players[0].gold = 9999;
    g.localStorage!.setItem('orrhea.game.v1', JSON.stringify(raw));
    expect(loadGame()).toBeNull();
  });

  it('ignore des données corrompues ou d’une autre version sans lever d’erreur', () => {
    g.localStorage!.setItem('orrhea.game.v1', '{pas du json');
    expect(loadGame()).toBeNull();
    g.localStorage!.setItem('orrhea.game.v1', JSON.stringify({ format: 'orrhea-save', version: 999, state: {} }));
    expect(loadGame()).toBeNull();
    g.localStorage!.setItem('orrhea.settings.v1', 'nimporte quoi');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    g.localStorage!.setItem('orrhea.profile.v1', '[1,2,3]');
    expect(loadProfile().games).toBe(0);
  });

  it('valide la structure : références inconnues refusées', () => {
    const st = createGame({ playerCount: 4, prepTime: 30, difficulty: 'normal', seed: 'val', playerName: 'T' });
    expect(validateGameState(st)).toBe(true);
    const bad = JSON.parse(JSON.stringify(st));
    bad.players[0].bench[0] = { uid: 'x', defId: 'champion_inexistant', star: 1, items: [] };
    expect(validateGameState(bad)).toBe(false);
    const bad2 = JSON.parse(JSON.stringify(st));
    bad2.players[1].board = [{ uid: 'y', defId: 'aurel', star: 1, items: ['objet_fantome'], col: 0, row: 0 }];
    expect(validateGameState(bad2)).toBe(false);
  });

  it('borne les paramètres à des valeurs sûres', () => {
    const s = validateSettings({ master: 9, music: -2, combatSpeed: 7, prepTime: 13, difficulty: 'impossible', opponents: 99, playerName: '   ' });
    expect(s.master).toBe(1);
    expect(s.music).toBe(0);
    expect(s.combatSpeed).toBe(1);
    expect(s.prepTime).toBe(DEFAULT_SETTINGS.prepTime);
    expect(s.difficulty).toBe('normal');
    expect(s.opponents).toBe(7);
    expect(s.playerName).toBe(DEFAULT_SETTINGS.playerName);
    saveSettings({ ...s, music: 0.3 });
    expect(loadSettings().music).toBe(0.3);
  });

  it('fonctionne sans stockage disponible (navigation privée)', () => {
    delete g.localStorage;
    const st = createGame({ playerCount: 4, prepTime: 30, difficulty: 'normal', seed: 'nostore', playerName: 'T' });
    expect(saveGame(st)).toBe(false);
    expect(loadGame()).toBeNull();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => clearGame()).not.toThrow();
  });
});
