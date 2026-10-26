/**
 * Sauvegarde locale versionnée : paramètres, statistiques de carrière et partie en cours
 * sont stockés séparément. Toute donnée lue est validée ; en cas de corruption on revient
 * à des valeurs sûres sans bloquer le jeu. Le stockage peut être indisponible (navigation
 * privée, stockage bloqué) : chaque accès est protégé.
 */
import type { GameState, Difficulty } from '../game/types';
import { STATE_VERSION } from '../game/game';
import { BENCH_SIZE, PREP_TIME_OPTIONS, DEFAULT_PREP_TIME } from '../config/balance';
import { findChampion, findItem, findConsumable } from '../core/content';
import { isRngState } from '../core/rng';

const KEYS = {
  settings: 'orrhea.settings.v1',
  profile: 'orrhea.profile.v1',
  game: 'orrhea.game.v1',
} as const;

export interface UserSettings {
  version: 1;
  master: number;
  music: number;
  sfx: number;
  ui: number;
  muted: boolean;
  combatSpeed: 1 | 2 | 3;
  showDamageNumbers: boolean;
  reduceMotion: boolean;
  prepTime: number;
  difficulty: Difficulty;
  opponents: number;
  playerName: string;
  tutorialSeen: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  version: 1,
  master: 0.8,
  music: 0.6,
  sfx: 0.75,
  ui: 0.7,
  muted: false,
  combatSpeed: 1,
  showDamageNumbers: true,
  reduceMotion: false,
  prepTime: DEFAULT_PREP_TIME,
  difficulty: 'normal',
  opponents: 7,
  playerName: 'Archonte',
  tutorialSeen: false,
};

export interface CareerProfile {
  version: 1;
  games: number;
  wins: number;
  top4: number;
  placements: number[];
  bestPlacement: number | null;
  championPlays: Record<string, number>;
  championTop4: Record<string, number>;
  traitPlays: Record<string, number>;
  traitTop4: Record<string, number>;
  byDifficulty: Record<Difficulty, { games: number; wins: number; top4: number }>;
  lastGames: { date: number; placement: number; difficulty: Difficulty; rounds: number; comp: string[] }[];
}

export function defaultProfile(): CareerProfile {
  return {
    version: 1,
    games: 0,
    wins: 0,
    top4: 0,
    placements: [],
    bestPlacement: null,
    championPlays: {},
    championTop4: {},
    traitPlays: {},
    traitTop4: {},
    byDifficulty: { facile: { games: 0, wins: 0, top4: 0 }, normal: { games: 0, wins: 0, top4: 0 }, difficile: { games: 0, wins: 0, top4: 0 } },
    lastGames: [],
  };
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__orrhea_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  return storage() !== null;
}

function read(key: string): unknown {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[sauvegarde] données illisibles pour ${key}, valeurs par défaut utilisées`, e);
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[sauvegarde] écriture impossible pour ${key}`, e);
    return false;
  }
}

const num = (v: unknown, min: number, max: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
const isDifficulty = (v: unknown): v is Difficulty => v === 'facile' || v === 'normal' || v === 'difficile';

export function validateSettings(raw: unknown): UserSettings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== 'object') return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    version: 1,
    master: num(r.master, 0, 1, d.master),
    music: num(r.music, 0, 1, d.music),
    sfx: num(r.sfx, 0, 1, d.sfx),
    ui: num(r.ui, 0, 1, d.ui),
    muted: bool(r.muted, d.muted),
    combatSpeed: r.combatSpeed === 2 || r.combatSpeed === 3 ? r.combatSpeed : 1,
    showDamageNumbers: bool(r.showDamageNumbers, d.showDamageNumbers),
    reduceMotion: bool(r.reduceMotion, d.reduceMotion),
    prepTime: (PREP_TIME_OPTIONS as readonly number[]).includes(r.prepTime as number) ? (r.prepTime as number) : d.prepTime,
    difficulty: isDifficulty(r.difficulty) ? r.difficulty : d.difficulty,
    opponents: Math.round(num(r.opponents, 3, 7, d.opponents)),
    playerName: typeof r.playerName === 'string' && r.playerName.trim() ? r.playerName.trim().slice(0, 18) : d.playerName,
    tutorialSeen: bool(r.tutorialSeen, d.tutorialSeen),
  };
}

export function loadSettings(): UserSettings {
  return validateSettings(read(KEYS.settings));
}

export function saveSettings(s: UserSettings): boolean {
  return write(KEYS.settings, s);
}

export function validateProfile(raw: unknown): CareerProfile {
  const d = defaultProfile();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<CareerProfile>;
  if (r.version !== 1) return d;
  const recNum = (o: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    return out;
  };
  const diffs = d.byDifficulty;
  if (r.byDifficulty && typeof r.byDifficulty === 'object')
    for (const k of ['facile', 'normal', 'difficile'] as Difficulty[]) {
      const x = (r.byDifficulty as Record<string, unknown>)[k] as Record<string, unknown> | undefined;
      if (x) diffs[k] = { games: num(x.games, 0, 1e9, 0), wins: num(x.wins, 0, 1e9, 0), top4: num(x.top4, 0, 1e9, 0) };
    }
  return {
    version: 1,
    games: num(r.games, 0, 1e9, 0),
    wins: num(r.wins, 0, 1e9, 0),
    top4: num(r.top4, 0, 1e9, 0),
    placements: Array.isArray(r.placements) ? r.placements.filter((x) => typeof x === 'number').slice(-200) : [],
    bestPlacement: typeof r.bestPlacement === 'number' ? r.bestPlacement : null,
    championPlays: recNum(r.championPlays),
    championTop4: recNum(r.championTop4),
    traitPlays: recNum(r.traitPlays),
    traitTop4: recNum(r.traitTop4),
    byDifficulty: diffs,
    lastGames: Array.isArray(r.lastGames) ? r.lastGames.filter((g) => g && typeof g === 'object' && typeof g.placement === 'number').slice(-20) : [],
  };
}

export function loadProfile(): CareerProfile {
  return validateProfile(read(KEYS.profile));
}

export function saveProfile(p: CareerProfile): boolean {
  return write(KEYS.profile, p);
}

interface GameEnvelope {
  format: 'orrhea-save';
  version: number;
  savedAt: number;
  checksum: number;
  state: GameState;
}

function checksum(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Vérifie la structure d'un état de partie (références de contenu, bornes, cohérence). */
export function validateGameState(st: unknown): st is GameState {
  if (!st || typeof st !== 'object') return false;
  const s = st as GameState;
  if (s.version !== STATE_VERSION) return false;
  if (!Array.isArray(s.players) || s.players.length < 2 || s.players.length > 8) return false;
  if (!isRngState(s.rng)) return false;
  if (typeof s.roundIndex !== 'number' || s.roundIndex < 0) return false;
  if (!['carousel', 'planning', 'combat', 'gameOver'].includes(s.phase)) return false;
  if (!s.pool || typeof s.pool !== 'object') return false;
  for (const [id, n] of Object.entries(s.pool)) if (!findChampion(id) || typeof n !== 'number' || n < 0) return false;
  for (const p of s.players) {
    if (typeof p.hp !== 'number' || typeof p.gold !== 'number' || p.gold < 0) return false;
    if (!Array.isArray(p.bench) || p.bench.length !== BENCH_SIZE) return false;
    if (!isRngState(p.shopRng)) return false;
    const units = [...p.board, ...p.bench.filter((u) => u !== null)];
    for (const u of units) {
      if (!u || !findChampion(u.defId) || ![1, 2, 3].includes(u.star) || !Array.isArray(u.items) || u.items.length > 3) return false;
      for (const it of u.items) if (!findItem(it)) return false;
    }
    for (const b of p.board) if (b.col < 0 || b.col > 6 || b.row < 0 || b.row > 3) return false;
    for (const it of p.items) if (!findItem(it) && !findConsumable(it)) return false;
    for (const sh of p.shop) if (sh !== null && !findChampion(sh)) return false;
  }
  return true;
}

export function saveGame(state: GameState): boolean {
  if (state.phase === 'gameOver') {
    clearGame();
    return true;
  }
  const json = JSON.stringify(state);
  const env: GameEnvelope = { format: 'orrhea-save', version: STATE_VERSION, savedAt: Date.now(), checksum: checksum(json), state };
  return write(KEYS.game, env);
}

export interface LoadedGame {
  state: GameState;
  savedAt: number;
}

export function loadGame(): LoadedGame | null {
  const raw = read(KEYS.game) as GameEnvelope | null;
  if (!raw) return null;
  try {
    if (raw.format !== 'orrhea-save' || raw.version !== STATE_VERSION) {
      console.warn('[sauvegarde] version de partie incompatible, sauvegarde ignorée');
      return null;
    }
    if (checksum(JSON.stringify(raw.state)) !== raw.checksum) {
      console.warn('[sauvegarde] somme de contrôle invalide, sauvegarde ignorée');
      return null;
    }
    if (!validateGameState(raw.state)) {
      console.warn('[sauvegarde] état de partie invalide, sauvegarde ignorée');
      return null;
    }
    return { state: raw.state, savedAt: raw.savedAt };
  } catch (e) {
    console.warn('[sauvegarde] lecture impossible', e);
    return null;
  }
}

export function hasSavedGame(): boolean {
  return loadGame() !== null;
}

export function clearGame(): void {
  const s = storage();
  try {
    s?.removeItem(KEYS.game);
  } catch {
    /* stockage indisponible */
  }
}

export function resetAllData(): void {
  const s = storage();
  if (!s) return;
  try {
    for (const k of Object.values(KEYS)) s.removeItem(k);
  } catch {
    /* stockage indisponible */
  }
}
