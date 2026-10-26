/**
 * Contrôleur de l'application : relie l'état de partie (règles pures) à l'interface,
 * au rendu et à l'audio. Gère les écrans, les minuteries, le combat en direct
 * (pas de simulation fixe, indépendant de l'affichage) et les notifications.
 */
import { COMBAT, CAROUSEL_TIME } from '../config/balance';
import { roundAt } from '../config/rounds';
import { getChampion, getTrait } from '../core/content';
import type { CombatResult, CombatSim } from '../combat/sim';
import type { CombatEvent } from '../combat/events';
import { computeTraits } from '../combat/setup';
import * as A from '../game/actions';
import {
  advanceCarousel,
  autoCarouselPick,
  buildPairingCombat,
  carouselPick,
  carouselTurn,
  createGame,
  fastForwardToEnd,
  HUMAN_ID,
  humanPairingIndex,
  resolveRound,
  simulateCombats,
  startCombatPhase,
} from '../game/game';
import type { GameState, Pairing, PlayerState } from '../game/types';
import {
  clearGame,
  loadGame,
  loadProfile,
  loadSettings,
  saveGame,
  saveProfile,
  saveSettings,
  type CareerProfile,
  type UserSettings,
} from '../save/save';
import { audio, type SfxId } from '../audio/AudioManager';

export type Screen = 'menu' | 'setup' | 'game' | 'end' | 'encyclopedia' | 'rules' | 'settings' | 'credits' | 'training';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success' | 'trait' | 'gold' | 'star';
  until: number;
}

export type DragSource = { kind: 'unit'; uid: string } | { kind: 'item'; index: number };

export interface DragState {
  source: DragSource;
  x: number;
  y: number;
  /** Cible survolée (calculée par le plateau ou les zones DOM). */
  over: { kind: 'board'; col: number; row: number } | { kind: 'bench'; index: number } | { kind: 'unit'; uid: string } | { kind: 'sell' } | { kind: 'itemSlot'; index: number } | null;
}

export type Modal =
  | { kind: 'unit'; uid?: string; defId: string; star: number; items: string[]; combatId?: number }
  | { kind: 'scout'; playerId: number }
  | { kind: 'pause' }
  | { kind: 'help' }
  | null;

export interface LiveCombat {
  sim: CombatSim;
  pairingIndex: number;
  flipped: boolean;
  results: (CombatResult | null)[];
  acc: number;
  doneAt: number | null;
  audioCursor: number;
  opponentName: string;
  opponentId: number | null;
  ghost: boolean;
  pve: boolean;
}

export interface Banner {
  title: string;
  subtitle: string;
  kind: 'win' | 'loss' | 'draw' | 'info' | 'final';
  until: number;
}

type Listener = () => void;

let toastId = 1;

export class Controller {
  screen: Screen = 'menu';
  state: GameState | null = null;
  settings: UserSettings = loadSettings();
  profile: CareerProfile = loadProfile();
  live: LiveCombat | null = null;
  timer = 0;
  paused = false;
  toasts: Toast[] = [];
  banner: Banner | null = null;
  modal: Modal = null;
  drag: DragState | null = null;
  hoverUid: string | null = null;
  selectedUid: string | null = null;
  /** Adversaire observé (son dernier plateau public s'affiche dans la moitié haute). */
  scoutId: number | null = null;
  now = 0;
  private lastLiveNotify = 0;
  private version = 0;
  private listeners = new Set<Listener>();
  private prevTraitLevels = new Map<string, number>();
  private lastTick = -1;
  /** Partie terminée (pour l'écran de fin). */
  endState: GameState | null = null;
  endRecorded = false;

  constructor() {
    audio.setVolumes({ master: this.settings.master, music: this.settings.music, sfx: this.settings.sfx, ui: this.settings.ui });
    audio.setMuted(this.settings.muted);
  }

  // ── Abonnement React ──────────────────────────────────────────────────────
  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;
  notify(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  get me(): PlayerState | null {
    return this.state ? this.state.players[HUMAN_ID] : null;
  }

  // ── Écrans ────────────────────────────────────────────────────────────────
  go(screen: Screen): void {
    this.screen = screen;
    this.modal = null;
    if (screen === 'menu' || screen === 'setup' || screen === 'encyclopedia' || screen === 'rules' || screen === 'settings' || screen === 'credits') {
      audio.playMusic('menu');
      audio.setIntensity(0);
    }
    this.sfx('uiOpen');
    this.notify();
  }

  updateSettings(patch: Partial<UserSettings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    audio.setVolumes({ master: this.settings.master, music: this.settings.music, sfx: this.settings.sfx, ui: this.settings.ui });
    audio.setMuted(this.settings.muted);
    this.notify();
  }

  newGame(opts: { difficulty: UserSettings['difficulty']; opponents: number; prepTime: number; seed?: string; playerName: string }): void {
    const seed = opts.seed?.trim() || Math.random().toString(36).slice(2, 10);
    this.updateSettings({ difficulty: opts.difficulty, opponents: opts.opponents, prepTime: opts.prepTime, playerName: opts.playerName });
    this.state = createGame({ playerCount: opts.opponents + 1, prepTime: opts.prepTime, difficulty: opts.difficulty, seed, playerName: opts.playerName });
    this.endState = null;
    this.endRecorded = false;
    this.live = null;
    this.banner = { title: 'La Convergence commence', subtitle: `${opts.opponents} Archontes rivaux · ${labelDifficulty(opts.difficulty)}`, kind: 'info', until: this.now + 3.2 };
    this.enterPhase();
    this.screen = 'game';
    this.sfx('roundStart');
    this.notify();
  }

  continueGame(): boolean {
    const loaded = loadGame();
    if (!loaded) {
      this.toast('Aucune partie sauvegardée valide.', 'error');
      return false;
    }
    this.state = loaded.state;
    this.endState = null;
    this.endRecorded = false;
    this.live = null;
    if (this.state.phase === 'combat') this.startLiveCombat();
    else this.enterPhase();
    this.screen = 'game';
    this.toast('Partie reprise.', 'success');
    this.notify();
    return true;
  }

  quitToMenu(save = true): void {
    if (save && this.state && this.state.phase !== 'gameOver' && !this.live) saveGame(this.state);
    this.live = null;
    this.state = null;
    this.modal = null;
    this.drag = null;
    this.go('menu');
  }

  abandon(): void {
    if (!this.state) return;
    const me = this.me!;
    me.hp = 0;
    me.alive = false;
    me.placement = this.state.players.filter((p) => p.alive).length + 1;
    this.state.phase = 'gameOver';
    clearGame();
    this.finishGame();
  }

  // ── Phases ────────────────────────────────────────────────────────────────
  private enterPhase(): void {
    const st = this.state!;
    if (st.phase === 'carousel') {
      this.timer = CAROUSEL_TIME;
      audio.playMusic('event');
      audio.setIntensity(0);
    } else if (st.phase === 'planning') {
      this.timer = st.settings.prepTime || Infinity;
      const r = roundAt(st.roundIndex);
      const alive = st.players.filter((p) => p.alive).length;
      if (alive <= 2 && r.kind === 'pvp') audio.playMusic('decisive');
      else audio.playMusic('prep');
      audio.setIntensity(r.stage >= 4 ? 1 : 0);
      saveGame(st);
    }
    this.snapshotTraitLevels();
  }

  private snapshotTraitLevels(): void {
    this.prevTraitLevels.clear();
    const me = this.me;
    if (!me) return;
    for (const t of computeTraits(me.board)) this.prevTraitLevels.set(t.id, t.level);
  }

  /** Signale les synergies nouvellement activées après une action. */
  private checkTraitActivation(): void {
    const me = this.me;
    if (!me) return;
    for (const t of computeTraits(me.board)) {
      const prev = this.prevTraitLevels.get(t.id) ?? 0;
      if (t.level > prev) {
        this.toast(`${getTrait(t.id).name} (${t.count}) activé !`, 'trait');
        this.sfx('traitActivate');
      }
      this.prevTraitLevels.set(t.id, t.level);
    }
    for (const id of [...this.prevTraitLevels.keys()]) if (!computeTraits(me.board).some((t) => t.id === id)) this.prevTraitLevels.delete(id);
  }

  ready(): void {
    const st = this.state;
    if (!st || st.phase !== 'planning' || this.live) return;
    startCombatPhase(st);
    this.startLiveCombat();
    this.notify();
  }

  private startLiveCombat(): void {
    const st = this.state!;
    const idx = humanPairingIndex(st);
    const results = simulateCombats(st, true);
    if (idx < 0) {
      // ne devrait pas arriver : le joueur est toujours apparié
      resolveRound(st, results as CombatResult[]);
      this.afterResolve();
      return;
    }
    const pr = st.pairings[idx];
    const flipped = pr.b === HUMAN_ID && pr.ghostOf === undefined;
    const view: Pairing = flipped ? { a: HUMAN_ID, b: pr.a, seed: pr.seed } : pr;
    const sim = buildPairingCombat(st, view, true);
    const oppId = view.b;
    this.live = {
      sim,
      pairingIndex: idx,
      flipped,
      results,
      acc: 0,
      doneAt: null,
      audioCursor: 0,
      opponentName: oppId === null ? 'Créatures neutres' : st.players[oppId].name + (pr.ghostOf !== undefined ? ' (reflet)' : ''),
      opponentId: oppId,
      ghost: pr.ghostOf !== undefined,
      pve: oppId === null,
    };
    this.selectedUid = null;
    this.drag = null;
    this.scoutId = null;
    this.modal = null;
    const alive = st.players.filter((p) => p.alive).length;
    audio.playMusic(alive <= 2 && oppId !== null ? 'decisive' : 'combat');
    audio.setIntensity(1);
    this.sfx('combatStart');
  }

  private finishLiveCombat(): void {
    const st = this.state!;
    const live = this.live!;
    let res = live.sim.result();
    if (live.flipped) res = flipResult(res);
    live.results[live.pairingIndex] = res;
    const humanSide = live.flipped ? 1 : 0;
    const won = res.winner === humanSide;
    this.live = null;
    resolveRound(st, live.results as CombatResult[]);
    const sum = st.lastRound?.summaries.find((s) => s.playerId === HUMAN_ID);
    if (sum) {
      const lootText = sum.loot.length ? ` · Butin : ${sum.loot.join(', ')}` : '';
      if (sum.won) this.banner = { title: 'Victoire', subtitle: `+${sum.goldGained} or${lootText}`, kind: 'win', until: this.now + 2.6 };
      else if (sum.draw) this.banner = { title: 'Égalité', subtitle: `−${sum.damageTaken} PV`, kind: 'draw', until: this.now + 2.6 };
      else this.banner = { title: 'Défaite', subtitle: `−${sum.damageTaken} PV${sum.goldGained ? ` · +${sum.goldGained} or` : ''}${lootText}`, kind: 'loss', until: this.now + 2.6 };
    }
    this.sfx(won ? 'roundWin' : 'roundLoss');
    // éliminations de la manche
    for (const p of st.players) {
      if (!p.alive && p.eliminatedRound === st.history[st.history.length - 1]?.round && p.id !== HUMAN_ID) {
        this.toast(`${p.name} est éliminé (${p.placement}e).`, 'info');
        this.sfx('eliminated');
      }
    }
    this.afterResolve();
  }

  private afterResolve(): void {
    const st = this.state!;
    if (st.phase === 'gameOver') {
      this.finishGame();
      return;
    }
    const alive = st.players.filter((p) => p.alive).length;
    if (alive === 2 && roundAt(st.roundIndex).kind === 'pvp') {
      this.banner = { title: 'Affrontement final', subtitle: 'Plus que deux Archontes. Tout se joue maintenant.', kind: 'final', until: this.now + 3 };
    }
    this.enterPhase();
    this.notify();
  }

  private finishGame(): void {
    const st = this.state!;
    const me = this.me!;
    if (me.alive && st.winnerId === HUMAN_ID) {
      audio.playMusic('victory');
      this.sfx('victoryFanfare');
    } else {
      audio.playMusic('defeat');
    }
    // classement final : on termine la partie des IA pour connaître le vainqueur
    if (!me.alive) fastForwardToEnd(st);
    clearGame();
    this.recordCareer(st);
    this.endState = st;
    this.screen = 'end';
    this.notify();
  }

  private recordCareer(st: GameState): void {
    if (this.endRecorded) return;
    this.endRecorded = true;
    const me = st.players[HUMAN_ID];
    const place = me.placement ?? st.players.length;
    const p = this.profile;
    p.games++;
    if (place === 1) p.wins++;
    if (place <= 4) p.top4++;
    p.placements.push(place);
    p.bestPlacement = p.bestPlacement === null ? place : Math.min(p.bestPlacement, place);
    const d = p.byDifficulty[st.settings.difficulty];
    d.games++;
    if (place === 1) d.wins++;
    if (place <= 4) d.top4++;
    const comp = Object.entries(me.stats.championRounds)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);
    for (const id of comp) {
      p.championPlays[id] = (p.championPlays[id] ?? 0) + 1;
      if (place <= 4) p.championTop4[id] = (p.championTop4[id] ?? 0) + 1;
    }
    for (const t of computeTraits(comp.map((defId) => ({ defId }))).filter((x) => x.level > 0)) {
      p.traitPlays[t.id] = (p.traitPlays[t.id] ?? 0) + 1;
      if (place <= 4) p.traitTop4[t.id] = (p.traitTop4[t.id] ?? 0) + 1;
    }
    p.lastGames.push({ date: Date.now(), placement: place, difficulty: st.settings.difficulty, rounds: st.roundIndex + 1, comp });
    if (p.lastGames.length > 20) p.lastGames.shift();
    saveProfile(p);
  }

  restart(): void {
    const s = this.settings;
    this.newGame({ difficulty: s.difficulty, opponents: s.opponents, prepTime: s.prepTime, playerName: s.playerName });
  }

  // ── Boucle ────────────────────────────────────────────────────────────────
  /** Appelée à chaque image ; dtReal en secondes. */
  update(dtReal: number): void {
    this.now += dtReal;
    const dt = Math.min(0.1, dtReal);
    let changed = false;
    if (this.toasts.length && this.toasts[0].until < this.now) {
      this.toasts = this.toasts.filter((t) => t.until >= this.now);
      changed = true;
    }
    if (this.banner && this.banner.until < this.now) {
      this.banner = null;
      changed = true;
    }
    const st = this.state;
    if (this.screen === 'game' && st && !this.paused && this.modal?.kind !== 'pause') {
      if (this.live) {
        // pendant le combat, le canvas lit l'état à chaque image ; l'interface DOM est rafraîchie ~8 fois/s
        if (this.stepLive(dt) && this.now - this.lastLiveNotify > 0.12) {
          this.lastLiveNotify = this.now;
          changed = true;
        }
      } else if ((st.phase === 'planning' || st.phase === 'carousel') && !this.banner) {
        if (this.timer !== Infinity) {
          const before = Math.ceil(this.timer);
          this.timer -= dt;
          const after = Math.ceil(this.timer);
          if (after !== before) {
            changed = true;
            if (after <= 5 && after > 0 && after !== this.lastTick) {
              this.lastTick = after;
              this.sfx('timerTick');
            }
          }
          if (this.timer <= 0) {
            if (st.phase === 'planning') this.ready();
            else this.carouselTimeout();
            changed = true;
          }
        }
      }
    }
    if (changed) this.notify();
  }

  private stepLive(dt: number): boolean {
    const live = this.live!;
    const sim = live.sim;
    if (!sim.done) {
      live.acc += dt * this.settings.combatSpeed;
      let steps = 0;
      while (live.acc >= COMBAT.dt && !sim.done && steps < 12) {
        sim.step();
        live.acc -= COMBAT.dt;
        steps++;
      }
      this.processCombatAudio();
      return true;
    }
    if (live.doneAt === null) {
      live.doneAt = this.now;
      this.processCombatAudio();
    }
    if (this.now - live.doneAt > 1.4) {
      this.finishLiveCombat();
      return true;
    }
    return false;
  }

  private sfxThrottle = new Map<string, number>();
  private processCombatAudio(): void {
    const live = this.live!;
    const evs = live.sim.events;
    const sim = live.sim;
    let i = live.audioCursor;
    for (; i < evs.length; i++) this.combatSfx(evs[i], sim);
    live.audioCursor = i;
    // intensité adaptative : moment critique quand un camp est presque vaincu
    let a0 = 0;
    let a1 = 0;
    let t0 = 0;
    let t1 = 0;
    for (const u of sim.units) {
      if (u.kind === 'summon') continue;
      if (u.side === 0) {
        t0++;
        if (u.alive) a0++;
      } else {
        t1++;
        if (u.alive) a1++;
      }
    }
    const critical = sim.overtime || (t0 > 0 && a0 / t0 <= 0.4) || (t1 > 0 && a1 / t1 <= 0.4);
    audio.setIntensity(critical ? 2 : 1);
  }

  private combatSfx(e: CombatEvent, sim: CombatSim): void {
    const throttled = (id: SfxId, ms: number, opts?: { volume?: number; detune?: number }) => {
      const last = this.sfxThrottle.get(id) ?? -1;
      if (this.now * 1000 - last < ms / this.settings.combatSpeed) return;
      this.sfxThrottle.set(id, this.now * 1000);
      audio.playSfx(id, { ...opts, detune: (opts?.detune ?? 0) + (Math.random() - 0.5) * 120 });
    };
    switch (e.e) {
      case 'attack':
        throttled(e.ranged ? 'attackRanged' : 'attackMelee', 70, { volume: 0.45 });
        break;
      case 'hit':
        if (e.kind === 'dot') break;
        if (e.crit) throttled('crit', 90, { volume: 0.7 });
        else throttled(e.dmgType === 'magic' ? 'impactMagic' : e.dmgType === 'true' ? 'impactTrue' : 'impactPhysical', 55, { volume: 0.4 });
        break;
      case 'cast': {
        const u = sim.unit(e.src);
        const trait = u?.ident.traits[0];
        const map: Record<string, SfxId> = {
          zenith: 'castZenith',
          selene: 'castSelene',
          rouage: 'castRouage',
          sylve: 'castSylve',
          abysse: 'castAbysse',
          braise: 'castBraise',
          nomade: 'castNomade',
          astral: 'castAstral',
        };
        throttled(trait && map[trait] ? map[trait] : 'castAstral', 120, { volume: 0.75 });
        break;
      }
      case 'heal':
        if (e.amount > 40) throttled('heal', 250, { volume: 0.4 });
        break;
      case 'shield':
        throttled('shield', 200, { volume: 0.5 });
        break;
      case 'shieldBreak':
        throttled('shieldBreak', 150, { volume: 0.5 });
        break;
      case 'status':
        if (e.kind === 'stun') throttled('stun', 150, { volume: 0.5 });
        break;
      case 'death':
        throttled('death', 120, { volume: 0.7 });
        break;
      case 'summon':
        throttled('summon', 200, { volume: 0.6 });
        break;
      case 'revive':
        throttled('revive', 300, { volume: 0.7 });
        break;
      case 'text':
        if (e.text === 'Exécuté') throttled('execute', 200, { volume: 0.7 });
        break;
      case 'vfx':
        if (/explosion|meteor|eruption|broadside|sunPillar$|groundSlam/.test(e.vfx)) throttled('explosion', 120, { volume: 0.6 });
        break;
      case 'gold':
        throttled('gold', 150, { volume: 0.6 });
        break;
      case 'overtime':
        audio.playSfx('overtime');
        this.toast('Embrasement : les dégâts augmentent, les soins diminuent.', 'info');
        break;
      default:
        break;
    }
  }

  setSpeed(s: 1 | 2 | 3): void {
    this.updateSettings({ combatSpeed: s });
  }

  togglePause(): void {
    if (this.modal?.kind === 'pause') this.modal = null;
    else this.modal = { kind: 'pause' };
    this.sfx(this.modal ? 'uiOpen' : 'uiClose');
    this.notify();
  }

  // ── Notifications & audio ─────────────────────────────────────────────────
  toast(text: string, kind: Toast['kind'] = 'info', seconds = 2.8): void {
    this.toasts = [...this.toasts.slice(-4), { id: toastId++, text, kind, until: this.now + seconds }];
    this.notify();
  }

  sfx(id: SfxId, opts?: { volume?: number; detune?: number }): void {
    audio.playSfx(id, opts);
  }

  private handle(r: { ok: boolean; message?: string; error?: string }, okSfx?: SfxId): boolean {
    if (!r.ok) {
      this.toast((r as { error: string }).error, 'error');
      this.sfx('uiError');
      this.notify();
      return false;
    }
    const ev = A.takeActionEvents();
    if (ev.merges.length) {
      const last = ev.merges[ev.merges.length - 1];
      this.sfx(last.star === 3 ? 'starUp3' : 'starUp2');
      this.toast(`${getChampion(last.defId).name} passe à ${last.star} étoiles !`, 'star');
    } else if (okSfx) this.sfx(okSfx);
    if (ev.levelUps) {
      this.sfx('levelUp');
      this.toast(`Niveau ${this.me!.level} : ${this.me!.level} unités déployables.`, 'success');
    } else if (r.message && !ev.merges.length) this.toast(r.message, 'success', 2);
    this.checkTraitActivation();
    this.notify();
    return true;
  }

  // ── Actions du joueur ─────────────────────────────────────────────────────
  buy(slot: number): void {
    if (!this.state || !this.me) return;
    this.handle(A.buyUnit(this.state, this.me, slot), 'buy');
  }
  sell(uid: string): void {
    if (!this.state || !this.me) return;
    if (this.selectedUid === uid) this.selectedUid = null;
    if (this.modal?.kind === 'unit' && this.modal.uid === uid) this.modal = null;
    this.handle(A.sellUnit(this.state, this.me, uid), 'sell');
  }
  reroll(): void {
    if (!this.state || !this.me) return;
    this.handle(A.reroll(this.state, this.me), 'reroll');
  }
  buyXp(): void {
    if (!this.state || !this.me) return;
    this.handle(A.buyXp(this.state, this.me), 'uiClick');
  }
  toggleLock(): void {
    if (!this.state || !this.me) return;
    this.handle(A.toggleLock(this.state, this.me), 'lock');
  }
  move(uid: string, dest: A.Dest): void {
    if (!this.state || !this.me) return;
    this.handle(A.moveUnit(this.state, this.me, uid, dest), 'uiClick');
  }
  equip(itemIndex: number, uid: string): void {
    if (!this.state || !this.me) return;
    const crafted = this.me.stats.itemsCrafted;
    const ok = this.handle(A.equipItem(this.state, this.me, itemIndex, uid));
    if (ok) this.sfx(this.me.stats.itemsCrafted > crafted ? 'itemCombine' : 'itemEquip');
  }
  combineItems(i: number, j: number): void {
    if (!this.state || !this.me) return;
    if (this.handle(A.combineBenchItems(this.state, this.me, i, j))) this.sfx('itemCombine');
  }
  /** Échange plateau ↔ réserve pour l'unité survolée (raccourci W). */
  quickMove(uid: string): void {
    const me = this.me;
    if (!me || !this.state) return;
    const f = A.findUnit(me, uid);
    if (!f) return;
    if (f.where === 'bench') {
      const def = getChampion(f.unit.defId);
      const rows = def.position === 'front' ? [0, 1, 2, 3] : [3, 2, 1, 0];
      for (const row of rows)
        for (const col of [3, 2, 4, 1, 5, 0, 6])
          if (!A.boardAt(me, col, row)) {
            this.move(uid, { zone: 'board', col, row });
            return;
          }
      this.toast('Le plateau est plein.', 'error');
    } else {
      const free = A.freeBenchIndex(me);
      if (free < 0) this.toast('La réserve est pleine.', 'error');
      else this.move(uid, { zone: 'bench', index: free });
    }
  }

  pickCarousel(i: number): void {
    const st = this.state;
    if (!st || st.phase !== 'carousel') return;
    if (carouselTurn(st) !== HUMAN_ID) return;
    if (!carouselPick(st, HUMAN_ID, i)) return;
    this.sfx('carouselPick');
    advanceCarousel(st);
    this.afterCarousel();
  }

  private carouselTimeout(): void {
    const st = this.state!;
    if (carouselTurn(st) === HUMAN_ID) {
      autoCarouselPick(st);
      this.toast('Temps écoulé : un champion a été choisi pour vous.', 'info');
    }
    advanceCarousel(st);
    this.afterCarousel();
  }

  private afterCarousel(): void {
    const st = this.state!;
    if (st.phase !== 'carousel') {
      this.enterPhase();
      this.banner = { title: `Manche ${roundAt(st.roundIndex).label}`, subtitle: roundSubtitle(st), kind: 'info', until: this.now + 1.6 };
    }
    this.notify();
  }

  openUnit(uid: string): void {
    const me = this.me;
    if (!me) return;
    const f = A.findUnit(me, uid);
    if (!f) return;
    this.modal = { kind: 'unit', uid, defId: f.unit.defId, star: f.unit.star, items: [...f.unit.items] };
    this.sfx('uiOpen');
    this.notify();
  }

  openLive(combatId: number): void {
    const live = this.live;
    if (!live) return;
    const u = live.sim.unit(combatId);
    if (!u || u.kind !== 'champion') return;
    this.modal = { kind: 'unit', defId: u.ident.defId, star: u.ident.star, items: [...u.ident.items], combatId };
    this.sfx('uiOpen');
    this.notify();
  }

  scout(playerId: number | null): void {
    this.scoutId = this.scoutId === playerId ? null : playerId;
    this.sfx('uiClick');
    this.notify();
  }

  openDef(defId: string, star = 1, items: string[] = []): void {
    this.modal = { kind: 'unit', defId, star, items };
    this.sfx('uiOpen');
    this.notify();
  }

  closeModal(): void {
    if (!this.modal) return;
    this.modal = null;
    this.sfx('uiClose');
    this.notify();
  }
}

function flipResult(r: CombatResult): CombatResult {
  const flip = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0);
  return {
    ...r,
    winner: r.winner === -1 ? -1 : flip(r.winner),
    survivors: r.survivors.map((s) => ({ ...s, side: flip(s.side) })),
    units: r.units.map((u) => ({ ...u, side: flip(u.side) })),
    gold: [r.gold[1], r.gold[0]],
  };
}

export function labelDifficulty(d: string): string {
  return d === 'facile' ? 'Facile' : d === 'difficile' ? 'Difficile' : 'Normal';
}

export function roundSubtitle(st: GameState): string {
  const r = roundAt(st.roundIndex);
  if (r.kind === 'carousel') return 'Carrousel : choisissez un champion et son objet';
  if (r.kind === 'pve') return 'Rencontre neutre';
  return 'Préparez votre équipe';
}

export const controller = new Controller();
