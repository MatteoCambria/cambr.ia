/**
 * Gestionnaire audio d'Orrhéa (navigateur, Web Audio API).
 *
 * - Bus : master → écrêteur doux de sécurité → sortie ; music (+ ambiance), sfx, ui.
 * - Musique : fondus enchaînés à puissance constante ; les stems d'un morceau démarrent sur la
 *   même horloge (même `start(when)`) et bouclent sur les mêmes points, donc restent synchrones ;
 *   l'intensité (0/1/2) ne fait que fondre leurs gains. `prep` et `combat` alternent
 *   automatiquement entre leurs variations à chaque nouveau départ.
 * - Effets : décodés au préchargement ; limite de voix par effet, par groupe (attaques, impacts,
 *   sorts) et globale, anti-répétition (throttle), variation de hauteur aléatoire.
 * - Robustesse : aucune méthode publique ne lève d'exception ; en cas d'échec (pas d'AudioContext,
 *   fichier manquant, décodage impossible), un avertissement est journalisé et le jeu continue
 *   en silence. Sans `window` (tests Node, SSR), toutes les méthodes sont sans effet.
 * - Mémoire : la musique décodée est gardée dans un cache LRU borné ; les octets MP3 compressés
 *   restent en mémoire pour un redécodage rapide. Le morceau suivant probable est pré-décodé.
 */

export type MusicCue = 'mainTheme' | 'menu' | 'prep' | 'combat' | 'decisive' | 'victory' | 'defeat' | 'event' | 'ambience';

export const MUSIC_CUES: readonly MusicCue[] = ['mainTheme', 'menu', 'prep', 'combat', 'decisive', 'victory', 'defeat', 'event', 'ambience'];

export const SFX_IDS = [
  'uiClick', 'uiHover', 'uiOpen', 'uiClose', 'uiError', 'timerTick', 'gold',
  'buy', 'sell', 'reroll', 'levelUp', 'starUp2', 'starUp3', 'traitActivate', 'itemEquip', 'itemCombine', 'lock',
  'attackMelee', 'attackRanged', 'attackMagic', 'impactPhysical', 'impactMagic', 'impactTrue', 'crit', 'heal', 'shield',
  'shieldBreak', 'stun', 'explosion', 'summon', 'death', 'revive', 'execute',
  'castZenith', 'castSelene', 'castRouage', 'castSylve', 'castAbysse', 'castBraise', 'castNomade', 'castAstral',
  'roundStart', 'combatStart', 'roundWin', 'roundLoss', 'overtime', 'eliminated', 'carouselPick', 'victoryFanfare',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  ui: number;
}

/** Effets routés sur le bus « ui » (les autres passent par « sfx »). */
export const UI_SFX: ReadonlySet<SfxId> = new Set<SfxId>(['uiClick', 'uiHover', 'uiOpen', 'uiClose', 'uiError', 'timerTick', 'gold', 'buy', 'sell', 'reroll', 'lock']);

// --------------------------------------------------------------------------- Manifeste (sous-ensemble)

interface StemEntry {
  id: string;
  role: string;
  file: string;
  minIntensity: number;
  duration: number;
}

interface MusicEntry {
  id: string;
  cue: MusicCue;
  variation: number;
  duration: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  bpm: number;
  gain: number;
  stems: StemEntry[];
}

interface SfxEntry {
  id: SfxId;
  file: string;
  duration: number;
  bus: 'ui' | 'sfx';
  gain: number;
  pitchVar: number;
  maxVoices: number;
  throttleMs: number;
  group: string | null;
}

interface ManifestData {
  version: number;
  music: MusicEntry[];
  sfx: SfxEntry[];
}

// ------------------------------------------------------------------------------------- Interne

interface StemVoice {
  minIntensity: number;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

interface MusicVoice {
  cue: MusicCue;
  entry: MusicEntry;
  out: GainNode;
  stems: StemVoice[];
  ended: boolean;
}

interface SfxVoice {
  id: SfxId;
  group: string | null;
  src: AudioBufferSourceNode;
  gain: GainNode;
  started: number;
  ends: number;
}

interface CachedBuffer {
  buffer: AudioBuffer;
  bytes: number;
  used: number;
}

/** Volumes par défaut (gains linéaires 0..1, identiques aux réglages par défaut du jeu). */
const DEFAULT_VOLUMES: Volumes = { master: 0.8, music: 0.6, sfx: 0.75, ui: 0.7 };
/** Budget mémoire de la musique décodée (octets de PCM flottant). */
const MUSIC_CACHE_BUDGET = 120 * 1024 * 1024;
const MAX_SFX_VOICES = 32;
const GROUP_LIMITS: Record<string, number> = { attack: 8, impact: 8, cast: 4 };
const DEFAULT_FADE = 1.2;

const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

function warn(msg: string, err?: unknown): void {
  try {
    console.warn(`[audio] ${msg}`, err ?? '');
  } catch {
    /* console indisponible */
  }
}

/** Courbe de fondu à puissance constante (montée en sinus, descente en cosinus). */
function fadeCurve(from: number, to: number, points = 32): Float32Array {
  const c = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    c[i] = to >= from ? from + (to - from) * Math.sin((x * Math.PI) / 2) : to + (from - to) * Math.cos((x * Math.PI) / 2);
  }
  return c;
}

/** Fige un paramètre à sa valeur courante à `now` (annule les automations en cours). */
function hold(p: AudioParam, now: number): number {
  const cur = p.value;
  const anyP = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  try {
    if (typeof anyP.cancelAndHoldAtTime === 'function') anyP.cancelAndHoldAtTime(now);
    else p.cancelScheduledValues(now);
  } catch {
    p.cancelScheduledValues(now);
  }
  p.setValueAtTime(cur, now);
  return cur;
}

/** Fondu à puissance constante ; repli sur une rampe linéaire si la courbe est refusée. */
function fadeParam(p: AudioParam, from: number, to: number, start: number, dur: number): void {
  try {
    p.setValueCurveAtTime(fadeCurve(from, to), start, dur);
  } catch {
    try {
      p.setValueAtTime(from, start);
      p.linearRampToValueAtTime(to, start + dur);
    } catch {
      p.value = to;
    }
  }
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private ctxFailed = false;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private uiBus: GainNode | null = null;

  private volumes: Volumes = { ...DEFAULT_VOLUMES };
  private muted = false;
  private intensity: 0 | 1 | 2 = 0;
  private isReady = false;

  private manifest: ManifestData | null = null;
  private manifestPromise: Promise<ManifestData | null> | null = null;
  private preloadPromise: Promise<void> | null = null;

  private sfxIndex = new Map<SfxId, SfxEntry>();
  private sfxBuffers = new Map<SfxId, { buffer: AudioBuffer; offset: number }>();
  private sfxVoices: SfxVoice[] = [];
  private lastSfx = new Map<SfxId, number>();

  private bytes = new Map<string, Promise<ArrayBuffer | null>>();
  private musicCache = new Map<string, CachedBuffer>();
  private decoding = new Map<string, Promise<AudioBuffer | null>>();

  private music: MusicVoice | null = null;
  private pendingCue: MusicCue | null = null;
  private musicToken = 0;
  private variationIdx = new Map<MusicCue, number>();

  private ambience: MusicVoice | null = null;
  private ambienceWanted = false;
  private ambienceToken = 0;

  private unlocked = false;
  private visibilityHooked = false;

  constructor(private readonly basePath = 'audio/') {}

  /** Vrai quand le manifeste est chargé et les effets sonores décodés. */
  get ready(): boolean {
    return this.isReady;
  }

  // ------------------------------------------------------------------------------ API publique

  async unlock(): Promise<void> {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state !== 'running') {
        try {
          await ctx.resume();
        } catch (e) {
          warn('reprise du contexte audio impossible', e);
        }
      }
      // Astuce iOS : jouer un tampon silencieux pendant le geste utilisateur.
      try {
        const b = ctx.createBuffer(1, 1, ctx.sampleRate);
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(ctx.destination);
        s.start(0);
      } catch {
        /* sans importance */
      }
      this.unlocked = true;
      this.hookVisibility();
    } catch (e) {
      warn('unlock a échoué', e);
    }
  }

  preload(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadPromise = (async (): Promise<void> => {
      try {
        const m = await this.loadManifest();
        const ctx = this.ensureContext();
        if (!m || !ctx) {
          // Échec (réseau, pas de Web Audio) : un appel ultérieur pourra réessayer.
          this.preloadPromise = null;
          return;
        }
        // Effets sonores : tous décodés (petits).
        await this.pool(m.sfx, 6, async (s) => {
          const buf = await this.decodeFile(s.file);
          if (buf) this.sfxBuffers.set(s.id, { buffer: buf, offset: leadingSilence(buf) });
        });
        this.isReady = true;
        // Musique de l'écran titre + ambiance décodées, le reste seulement téléchargé.
        const first = ['mainTheme', 'menu', 'ambience'] as MusicCue[];
        await Promise.all(first.map((c) => this.decodeEntry(this.peekVariation(c))));
        for (const e of m.music) for (const st of e.stems) void this.fetchBytes(st.file);
      } catch (e) {
        warn('préchargement incomplet', e);
      }
    })();
    return this.preloadPromise;
  }

  setVolumes(v: Partial<Volumes>): void {
    try {
      for (const k of ['master', 'music', 'sfx', 'ui'] as const) {
        const x = v[k];
        if (typeof x === 'number') this.volumes[k] = clamp01(x);
      }
      this.applyVolumes();
    } catch (e) {
      warn('setVolumes a échoué', e);
    }
  }

  getVolumes(): Volumes {
    return { ...this.volumes };
  }

  setMuted(m: boolean): void {
    try {
      this.muted = !!m;
      this.applyVolumes();
    } catch (e) {
      warn('setMuted a échoué', e);
    }
  }

  playMusic(cue: MusicCue, opts: { fade?: number } = {}): void {
    try {
      if (!MUSIC_CUES.includes(cue)) {
        warn(`cue musicale inconnue : ${String(cue)}`);
        return;
      }
      if (this.music && this.music.cue === cue && !this.music.ended) {
        // Déjà en cours : on annule un éventuel changement demandé entre-temps.
        if (this.pendingCue !== null) {
          this.musicToken++;
          this.pendingCue = null;
        }
        return;
      }
      if (this.pendingCue === cue) return;
      if (!this.ensureContext()) return;
      const fade = Math.max(0.01, opts.fade ?? DEFAULT_FADE);
      const token = ++this.musicToken;
      this.pendingCue = cue;
      void (async (): Promise<void> => {
        try {
          await this.loadManifest();
          const entry = this.nextVariation(cue);
          if (!entry) {
            if (token === this.musicToken) this.pendingCue = null;
            return;
          }
          const buffers = await this.decodeEntry(entry);
          if (token !== this.musicToken) return; // remplacé entre-temps
          this.pendingCue = null;
          if (!buffers) return;
          this.startMusic(cue, entry, buffers, fade);
          this.predict(cue);
        } catch (e) {
          if (token === this.musicToken) this.pendingCue = null;
          warn(`lecture de « ${cue} » impossible`, e);
        }
      })();
    } catch (e) {
      warn('playMusic a échoué', e);
    }
  }

  stopMusic(fade = DEFAULT_FADE): void {
    try {
      this.musicToken++;
      this.pendingCue = null;
      if (this.music) {
        this.fadeOutVoice(this.music, Math.max(0.01, fade));
        this.music = null;
      }
    } catch (e) {
      warn('stopMusic a échoué', e);
    }
  }

  setIntensity(level: 0 | 1 | 2): void {
    try {
      const l = level >= 2 ? 2 : level >= 1 ? 1 : 0;
      this.intensity = l;
      const ctx = this.ctx;
      if (!ctx || !this.music) return;
      const now = ctx.currentTime;
      for (const st of this.music.stems) {
        const target = this.stemTarget(st.minIntensity);
        const p = st.gain.gain;
        const cur = hold(p, now);
        // Montée ≈ 1 s, descente ≈ 2 s.
        p.setTargetAtTime(target, now, target > cur ? 0.3 : 0.6);
      }
    } catch (e) {
      warn('setIntensity a échoué', e);
    }
  }

  playAmbience(on: boolean): void {
    try {
      this.ambienceWanted = !!on;
      if (!on) {
        this.ambienceToken++;
        if (this.ambience) {
          this.fadeOutVoice(this.ambience, 2);
          this.ambience = null;
        }
        return;
      }
      if (this.ambience || !this.ensureContext()) return;
      const token = ++this.ambienceToken;
      void (async (): Promise<void> => {
        try {
          await this.loadManifest();
          const entry = this.peekVariation('ambience');
          if (!entry) return;
          const buffers = await this.decodeEntry(entry);
          if (!buffers || token !== this.ambienceToken || !this.ambienceWanted || this.ambience) return;
          this.ambience = this.createVoice('ambience', entry, buffers, this.ambienceBus as GainNode, 2.5, true);
        } catch (e) {
          warn("lecture de l'ambiance impossible", e);
        }
      })();
    } catch (e) {
      warn('playAmbience a échoué', e);
    }
  }

  playSfx(id: SfxId, opts: { volume?: number; detune?: number; pan?: number; throttleMs?: number } = {}): void {
    try {
      const ctx = this.ctx;
      if (!ctx || !this.isReady) return;
      const def = this.sfxIndex.get(id);
      const data = this.sfxBuffers.get(id);
      if (!def || !data) return;
      const now = ctx.currentTime;
      const throttle = opts.throttleMs ?? def.throttleMs ?? 0;
      const last = this.lastSfx.get(id);
      if (last !== undefined && (now - last) * 1000 < throttle) return;
      this.pruneVoices(now);
      // Polyphonie : par effet, par groupe, globale (on coupe la voix la plus ancienne).
      const same = this.sfxVoices.filter((v) => v.id === id);
      if (same.length >= Math.max(1, def.maxVoices)) this.steal(same[0], now);
      if (def.group && GROUP_LIMITS[def.group]) {
        const g = this.sfxVoices.filter((v) => v.group === def.group);
        if (g.length >= GROUP_LIMITS[def.group]) this.steal(g[0], now);
      }
      if (this.sfxVoices.length >= MAX_SFX_VOICES) this.steal(this.sfxVoices[0], now);

      const src = ctx.createBufferSource();
      src.buffer = data.buffer;
      const cents = (opts.detune ?? 0) + (def.pitchVar ? (Math.random() * 2 - 1) * def.pitchVar : 0);
      const rate = Math.pow(2, cents / 1200);
      src.playbackRate.value = rate;
      const gain = ctx.createGain();
      const vol = typeof opts.volume === 'number' && Number.isFinite(opts.volume) ? Math.max(0, Math.min(4, opts.volume)) : 1;
      gain.gain.value = (def.gain ?? 1) * vol;
      src.connect(gain);
      let tail: AudioNode = gain;
      if (typeof opts.pan === 'number' && opts.pan !== 0 && typeof ctx.createStereoPanner === 'function') {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, opts.pan));
        gain.connect(p);
        tail = p;
      }
      const bus = (UI_SFX.has(id) || def.bus === 'ui' ? this.uiBus : this.sfxBus) as GainNode;
      tail.connect(bus);
      src.start(now, data.offset);
      const voice: SfxVoice = { id, group: def.group, src, gain, started: now, ends: now + (data.buffer.duration - data.offset) / rate };
      this.sfxVoices.push(voice);
      this.lastSfx.set(id, now);
      src.onended = (): void => {
        const i = this.sfxVoices.indexOf(voice);
        if (i >= 0) this.sfxVoices.splice(i, 1);
        try {
          tail.disconnect();
          gain.disconnect();
        } catch {
          /* déjà déconnecté */
        }
      };
    } catch (e) {
      warn(`playSfx(${String(id)}) a échoué`, e);
    }
  }

  // --------------------------------------------------------------------------------- Contexte

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (this.ctxFailed) return null;
    try {
      if (typeof window === 'undefined') {
        this.ctxFailed = true;
        return null;
      }
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) {
        this.ctxFailed = true;
        warn('Web Audio API indisponible : le jeu continue sans son');
        return null;
      }
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const master = ctx.createGain();
      // Écrêteur doux de sécurité (linéaire jusqu'à -2 dBFS) contre l'empilement d'effets.
      const shaper = ctx.createWaveShaper();
      const N = 2048;
      const curve = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * 2 - 1;
        const a = Math.abs(x);
        const y = a < 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2);
        curve[i] = Math.sign(x) * y;
      }
      shaper.curve = curve;
      shaper.oversample = '2x';
      master.connect(shaper);
      shaper.connect(ctx.destination);
      const music = ctx.createGain();
      const amb = ctx.createGain();
      const sfx = ctx.createGain();
      const ui = ctx.createGain();
      amb.connect(music);
      music.connect(master);
      sfx.connect(master);
      ui.connect(master);
      this.masterGain = master;
      this.musicBus = music;
      this.ambienceBus = amb;
      this.sfxBus = sfx;
      this.uiBus = ui;
      this.applyVolumes(true);
      return ctx;
    } catch (e) {
      this.ctxFailed = true;
      this.ctx = null;
      warn("création de l'AudioContext impossible : le jeu continue sans son", e);
      return null;
    }
  }

  private applyVolumes(immediate = false): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || !this.musicBus || !this.sfxBus || !this.uiBus) return;
    const now = ctx.currentTime;
    const set = (g: GainNode, v: number): void => {
      if (immediate) g.gain.value = v;
      else {
        hold(g.gain, now);
        g.gain.setTargetAtTime(v, now, 0.05);
      }
    };
    // Gains linéaires (les fichiers sont déjà normalisés en sonie).
    set(this.masterGain, this.muted ? 0 : this.volumes.master);
    set(this.musicBus, this.volumes.music);
    set(this.sfxBus, this.volumes.sfx);
    set(this.uiBus, this.volumes.ui);
  }

  private hookVisibility(): void {
    if (this.visibilityHooked || typeof document === 'undefined') return;
    this.visibilityHooked = true;
    try {
      document.addEventListener('visibilitychange', () => {
        const ctx = this.ctx;
        if (!ctx) return;
        try {
          if (document.hidden) void ctx.suspend().catch(() => undefined);
          else if (this.unlocked) void ctx.resume().catch(() => undefined);
        } catch {
          /* ignoré */
        }
      });
    } catch {
      /* ignoré */
    }
  }

  // -------------------------------------------------------------------------------- Chargement

  private loadManifest(): Promise<ManifestData | null> {
    if (this.manifestPromise) return this.manifestPromise;
    this.manifestPromise = (async (): Promise<ManifestData | null> => {
      try {
        if (typeof fetch !== 'function') return null;
        const res = await fetch(`${this.basePath}manifest.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const m = (await res.json()) as ManifestData;
        if (!m || !Array.isArray(m.music) || !Array.isArray(m.sfx)) throw new Error('manifeste invalide');
        this.manifest = m;
        for (const s of m.sfx) this.sfxIndex.set(s.id, s);
        return m;
      } catch (e) {
        warn('manifeste audio introuvable ou invalide : le jeu continue sans son', e);
        this.manifestPromise = null; // nouvel essai possible plus tard
        return null;
      }
    })();
    return this.manifestPromise;
  }

  private fetchBytes(file: string): Promise<ArrayBuffer | null> {
    let p = this.bytes.get(file);
    if (!p) {
      p = (async (): Promise<ArrayBuffer | null> => {
        try {
          const res = await fetch(`${this.basePath}${file}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.arrayBuffer();
        } catch (e) {
          warn(`téléchargement impossible : ${file}`, e);
          this.bytes.delete(file);
          return null;
        }
      })();
      this.bytes.set(file, p);
    }
    return p;
  }

  private async decodeFile(file: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return null;
    const data = await this.fetchBytes(file);
    if (!data) return null;
    try {
      // Copie : decodeAudioData détache le tampon, on garde l'original pour un redécodage.
      const copy = data.slice(0);
      return await new Promise<AudioBuffer>((resolve, reject) => {
        const r = ctx.decodeAudioData(copy, resolve, reject) as unknown;
        if (r && typeof (r as Promise<AudioBuffer>).catch === 'function') (r as Promise<AudioBuffer>).catch(reject);
      });
    } catch (e) {
      warn(`décodage impossible : ${file}`, e);
      return null;
    }
  }

  /** Décode (ou récupère du cache) tous les stems d'un morceau. */
  private async decodeEntry(entry: MusicEntry | null): Promise<AudioBuffer[] | null> {
    if (!entry) return null;
    const bufs = await Promise.all(entry.stems.map((st) => this.decodeMusic(st.file)));
    if (bufs.some((b) => !b)) return null;
    return bufs as AudioBuffer[];
  }

  private decodeMusic(file: string): Promise<AudioBuffer | null> {
    const cached = this.musicCache.get(file);
    if (cached) {
      cached.used = Date.now();
      return Promise.resolve(cached.buffer);
    }
    let p = this.decoding.get(file);
    if (!p) {
      p = this.decodeFile(file).then((b) => {
        this.decoding.delete(file);
        if (b) {
          this.musicCache.set(file, { buffer: b, bytes: b.length * b.numberOfChannels * 4, used: Date.now() });
          this.evictMusic();
        }
        return b;
      });
      this.decoding.set(file, p);
    }
    return p;
  }

  /** Éviction LRU de la musique décodée au-delà du budget (jamais ce qui joue). */
  private evictMusic(): void {
    let total = 0;
    for (const c of this.musicCache.values()) total += c.bytes;
    if (total <= MUSIC_CACHE_BUDGET) return;
    const inUse = new Set<string>();
    for (const v of [this.music, this.ambience]) if (v) for (const st of v.entry.stems) inUse.add(st.file);
    const entries = [...this.musicCache.entries()].filter(([f]) => !inUse.has(f)).sort((a, b) => a[1].used - b[1].used);
    for (const [f, c] of entries) {
      if (total <= MUSIC_CACHE_BUDGET) break;
      this.musicCache.delete(f);
      total -= c.bytes;
    }
  }

  private async pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
    let i = 0;
    const lanes = Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const x = items[i++];
        try {
          await fn(x);
        } catch (e) {
          warn('chargement partiel', e);
        }
      }
    });
    await Promise.all(lanes);
  }

  // ------------------------------------------------------------------------------- Variations

  private entriesFor(cue: MusicCue): MusicEntry[] {
    return (this.manifest?.music ?? []).filter((m) => m.cue === cue).sort((a, b) => a.variation - b.variation);
  }

  /** Prochaine variation sans avancer le compteur (pré-décodage). */
  private peekVariation(cue: MusicCue): MusicEntry | null {
    const list = this.entriesFor(cue);
    if (!list.length) return null;
    const i = this.variationIdx.get(cue);
    return list[i === undefined ? 0 : (i + 1) % list.length];
  }

  /** Variation à jouer maintenant : alterne à chaque nouveau départ du cue. */
  private nextVariation(cue: MusicCue): MusicEntry | null {
    const list = this.entriesFor(cue);
    if (!list.length) {
      warn(`aucun morceau pour « ${cue} »`);
      return null;
    }
    const i = this.variationIdx.get(cue);
    const next = i === undefined ? 0 : (i + 1) % list.length;
    this.variationIdx.set(cue, next);
    return list[next];
  }

  /** Pré-décode ce qui suivra probablement. */
  private predict(cue: MusicCue): void {
    const next: MusicCue[] =
      cue === 'prep' ? ['combat'] : cue === 'combat' ? ['prep'] : cue === 'decisive' ? ['victory', 'defeat'] : cue === 'menu' || cue === 'mainTheme' ? ['prep'] : cue === 'event' ? ['prep'] : [];
    for (const c of next) void this.decodeEntry(this.peekVariation(c));
  }

  // ---------------------------------------------------------------------------------- Lecture

  private stemTarget(minIntensity: number): number {
    return this.intensity >= minIntensity ? 1 : 0;
  }

  private createVoice(cue: MusicCue, entry: MusicEntry, buffers: AudioBuffer[], bus: GainNode, fade: number, isAmbience = false): MusicVoice {
    const ctx = this.ctx as AudioContext;
    const now = ctx.currentTime;
    const when = now + 0.06;
    const out = ctx.createGain();
    const g = Number.isFinite(entry.gain) ? entry.gain : 1;
    out.gain.setValueAtTime(0, now);
    fadeParam(out.gain, 0, g, when, fade);
    out.connect(bus);
    const voice: MusicVoice = { cue, entry, out, stems: [], ended: false };
    entry.stems.forEach((st, i) => {
      const buffer = buffers[i];
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      if (entry.loop) {
        src.loop = true;
        const ls = Math.max(0, Math.min(entry.loopStart, buffer.duration - 0.05));
        const le = Math.min(buffer.duration, ls + entry.duration);
        src.loopStart = ls;
        src.loopEnd = le > ls + 0.05 ? le : buffer.duration;
      }
      const gain = ctx.createGain();
      gain.gain.value = isAmbience ? 1 : this.stemTarget(st.minIntensity);
      src.connect(gain);
      gain.connect(out);
      // Même instant de départ pour tous les stems : synchronisation garantie.
      src.start(when, 0);
      voice.stems.push({ minIntensity: st.minIntensity, src, gain });
    });
    if (!entry.loop && voice.stems[0]) {
      voice.stems[0].src.onended = (): void => {
        voice.ended = true;
        if (this.music === voice) this.music = null;
        this.disconnectVoice(voice);
      };
    }
    return voice;
  }

  private startMusic(cue: MusicCue, entry: MusicEntry, buffers: AudioBuffer[], fade: number): void {
    const prev = this.music;
    this.music = this.createVoice(cue, entry, buffers, this.musicBus as GainNode, fade);
    if (prev) this.fadeOutVoice(prev, fade);
  }

  private fadeOutVoice(v: MusicVoice, fade: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const p = v.out.gain;
      const cur = hold(p, now);
      fadeParam(p, cur, 0, now + 0.01, fade);
      for (const st of v.stems) {
        try {
          st.src.stop(now + fade + 0.1);
        } catch {
          /* déjà arrêté */
        }
      }
      setTimeout(() => this.disconnectVoice(v), (fade + 0.3) * 1000);
    } catch (e) {
      warn('fondu de sortie impossible', e);
      this.disconnectVoice(v);
    }
  }

  private disconnectVoice(v: MusicVoice): void {
    for (const st of v.stems) {
      try {
        st.src.onended = null;
        st.src.disconnect();
        st.gain.disconnect();
      } catch {
        /* ignoré */
      }
    }
    try {
      v.out.disconnect();
    } catch {
      /* ignoré */
    }
  }

  private pruneVoices(now: number): void {
    this.sfxVoices = this.sfxVoices.filter((v) => v.ends > now - 0.05);
  }

  private steal(v: SfxVoice | undefined, now: number): void {
    if (!v) return;
    try {
      hold(v.gain.gain, now);
      v.gain.gain.setTargetAtTime(0, now, 0.012);
      v.src.stop(now + 0.06);
    } catch {
      /* ignoré */
    }
    const i = this.sfxVoices.indexOf(v);
    if (i >= 0) this.sfxVoices.splice(i, 1);
  }
}

/** Silence initial d'un tampon décodé (délai d'encodeur MP3 non retiré par certains navigateurs). */
function leadingSilence(b: AudioBuffer): number {
  try {
    const ch = b.getChannelData(0);
    const max = Math.min(ch.length, Math.round(b.sampleRate * 0.06));
    for (let i = 0; i < max; i++) if (Math.abs(ch[i]) > 1e-4) return Math.max(0, (i - 16) / b.sampleRate);
    return 0;
  } catch {
    return 0;
  }
}

/** Instance unique utilisée par le jeu. */
export const audio = new AudioManager();
