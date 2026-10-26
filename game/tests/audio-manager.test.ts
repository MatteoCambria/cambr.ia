/**
 * Tests du gestionnaire audio (src/audio/AudioManager.ts) avec une fausse Web Audio API :
 * synchronisation des stems, alternance des variations, intensité, routage des bus, anti-spam,
 * polyphonie et robustesse (pas de contexte, fichiers manquants).
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AudioManager, audio, SFX_IDS, type SfxId } from '../src/audio/AudioManager';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MANIFEST_PATH = join(ROOT, 'public', 'audio', 'manifest.json');

interface StemJ {
  id: string;
  file: string;
  fileDuration: number;
}
interface MusicJ {
  id: string;
  cue: string;
  duration: number;
  loopStart: number;
  loopEnd: number;
  stems: StemJ[];
}
interface SfxJ {
  id: string;
  file: string;
  duration: number;
}
const manifest = existsSync(MANIFEST_PATH) ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { music: MusicJ[]; sfx: SfxJ[] }) : { music: [], sfx: [] };
const durations = new Map<string, number>();
for (const m of manifest.music) for (const s of m.stems) durations.set(s.file, s.fileDuration);
for (const s of manifest.sfx) durations.set(s.file, s.duration);

// ------------------------------------------------------------------------ Fausse Web Audio API

class FakeParam {
  events: Array<{ type: string; v: number; t: number }> = [];
  constructor(public value: number) {}
  setValueAtTime(v: number, t: number): this {
    this.events.push({ type: 'set', v, t });
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.events.push({ type: 'ramp', v, t });
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number): this {
    this.events.push({ type: 'target', v, t });
    this.value = v;
    return this;
  }
  setValueCurveAtTime(c: Float32Array, t: number): this {
    this.events.push({ type: 'curve', v: c[c.length - 1], t });
    this.value = c[c.length - 1];
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
  cancelAndHoldAtTime(): this {
    return this;
  }
}

class FakeNode {
  out: FakeNode[] = [];
  connect<T extends FakeNode>(n: T): T {
    this.out.push(n);
    return n;
  }
  disconnect(): void {
    this.out = [];
  }
}
class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}
class FakePanner extends FakeNode {
  pan = new FakeParam(0);
}
class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = 'none';
}
class FakeBuffer {
  constructor(public duration: number, public file = '', public sampleRate = 48000, public numberOfChannels = 2) {}
  get length(): number {
    return Math.round(this.duration * this.sampleRate);
  }
  getChannelData(): Float32Array {
    return new Float32Array(64).fill(0.5);
  }
}
class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  playbackRate = new FakeParam(1);
  onended: (() => void) | null = null;
  started: { when: number; offset: number } | null = null;
  stopped: number | null = null;
  constructor(private ctx: FakeCtx) {
    super();
  }
  start(when = 0, offset = 0): void {
    this.started = { when, offset };
    // On ignore le tampon silencieux du déverrouillage (astuce iOS).
    if (this.buffer?.file) this.ctx.sources.push(this);
  }
  stop(t = 0): void {
    this.stopped = t;
  }
}
class FakeCtx {
  static last: FakeCtx | null = null;
  currentTime = 0;
  state = 'suspended';
  sampleRate = 48000;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  constructor() {
    FakeCtx.last = this;
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
  createBufferSource(): FakeSource {
    return new FakeSource(this);
  }
  createStereoPanner(): FakePanner {
    return new FakePanner();
  }
  createWaveShaper(): FakeShaper {
    return new FakeShaper();
  }
  createBuffer(_c: number, len: number, sr: number): FakeBuffer {
    return new FakeBuffer(len / sr);
  }
  decodeAudioData(data: ArrayBuffer, ok: (b: FakeBuffer) => void, err: (e: unknown) => void): void {
    const file = new TextDecoder().decode(data);
    const d = durations.get(file);
    if (d === undefined) err(new Error(`inconnu ${file}`));
    else queueMicrotask(() => ok(new FakeBuffer(d, file)));
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
}

const g = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
const realFetch = g.fetch;

function installFakes(opts: { failFiles?: boolean } = {}): void {
  g.window = { AudioContext: FakeCtx };
  g.fetch = (async (url: string) => {
    const u = String(url);
    if (u.endsWith('manifest.json')) return { ok: true, status: 200, json: async () => manifest } as unknown as Response;
    if (opts.failFiles) return { ok: false, status: 404 } as unknown as Response;
    const file = u.replace(/^audio\//, '');
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(file).buffer } as unknown as Response;
  }) as typeof fetch;
}

function removeFakes(): void {
  delete g.window;
  g.fetch = realFetch;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
};

type Internals = { uiBus: FakeGain; sfxBus: FakeGain; musicBus: FakeGain };

// ------------------------------------------------------------------------------------- Tests

describe('AudioManager (fausse Web Audio API)', () => {
  let restoreWarn: () => void = () => undefined;
  beforeEach(() => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    restoreWarn = () => spy.mockRestore();
  });
  afterEach(() => {
    restoreWarn();
    removeFakes();
  });

  it('sans window ni fichiers, toutes les méthodes sont sans effet et ne lèvent rien', async () => {
    const m = new AudioManager();
    await expect(m.unlock()).resolves.toBeUndefined();
    await expect(m.preload()).resolves.toBeUndefined();
    expect(() => {
      m.setVolumes({ master: 0.5, music: 2, sfx: -1 });
      m.setMuted(true);
      m.playMusic('combat');
      m.setIntensity(2);
      m.playAmbience(true);
      m.playSfx('crit', { volume: 2, detune: 100, pan: -1 });
      m.stopMusic();
    }).not.toThrow();
    expect(m.ready).toBe(false);
    expect(m.getVolumes()).toEqual({ master: 0.5, music: 1, sfx: 0, ui: 0.7 });
    // Le singleton ne touche à rien à l'import.
    expect(audio.ready).toBe(false);
  });

  it('les volumes sont appliqués linéairement aux bus, la sourdine coupe le master', async () => {
    installFakes();
    const m = new AudioManager();
    await m.unlock();
    const internals = m as unknown as Internals & { masterGain: FakeGain };
    m.setVolumes({ master: 0.5, music: 0.25, sfx: 1, ui: 0.4 });
    expect(internals.masterGain.gain.value).toBeCloseTo(0.5, 6);
    expect(internals.musicBus.gain.value).toBeCloseTo(0.25, 6);
    expect(internals.sfxBus.gain.value).toBeCloseTo(1, 6);
    expect(internals.uiBus.gain.value).toBeCloseTo(0.4, 6);
    m.setMuted(true);
    expect(internals.masterGain.gain.value).toBe(0);
    m.setMuted(false);
    expect(internals.masterGain.gain.value).toBeCloseTo(0.5, 6);
  });

  it('fichiers introuvables : le jeu continue en silence', async () => {
    installFakes({ failFiles: true });
    const m = new AudioManager();
    await m.unlock();
    await m.preload();
    m.playMusic('menu');
    m.playSfx('uiClick');
    await flush();
    expect(FakeCtx.last?.sources.length ?? 0).toBe(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('préchargement, stems synchrones, intensité et alternance des variations', async () => {
    installFakes();
    const m = new AudioManager();
    await m.unlock();
    await m.preload();
    expect(m.ready).toBe(true);
    const ctx = FakeCtx.last as FakeCtx;
    expect(ctx.state).toBe('running');

    // prep (variation 1) : deux stems, même instant de départ, mêmes points de boucle.
    m.playMusic('prep');
    await flush();
    const prep1 = ctx.sources.slice();
    expect(prep1.length).toBe(2);
    expect(new Set(prep1.map((s) => s.started?.when)).size).toBe(1);
    const prepEntry = manifest.music.find((e) => e.id === 'prep') as MusicJ;
    for (const s of prep1) {
      expect(s.loop).toBe(true);
      expect(s.loopStart).toBeCloseTo(prepEntry.loopStart, 6);
      expect(s.loopEnd).toBeCloseTo(prepEntry.loopEnd, 6);
      expect(s.buffer?.file.startsWith('music/prep_')).toBe(true);
    }
    // Intensité 0 : la couche est muette mais joue (synchronisation conservée).
    const layerGain = (src: FakeSource): FakeGain => src.out[0] as FakeGain;
    const byFile = (list: FakeSource[], f: string): FakeSource => list.find((s) => s.buffer?.file.includes(f)) as FakeSource;
    expect(layerGain(byFile(prep1, 'prep_layer')).gain.value).toBe(0);
    expect(layerGain(byFile(prep1, 'prep_base')).gain.value).toBe(1);
    m.setIntensity(1);
    expect(layerGain(byFile(prep1, 'prep_layer')).gain.value).toBe(1);

    // Redemander le même cue ne relance rien.
    m.playMusic('prep');
    await flush();
    expect(ctx.sources.length).toBe(2);

    // combat (variation 1) : trois stems synchrones, perc muette à l'intensité 1.
    ctx.currentTime = 10;
    m.playMusic('combat', { fade: 2 });
    await flush();
    const combat1 = ctx.sources.slice(2);
    expect(combat1.length).toBe(3);
    expect(new Set(combat1.map((s) => s.started?.when)).size).toBe(1);
    expect(combat1.every((s) => s.buffer?.file.startsWith('music/combat_'))).toBe(true);
    expect(layerGain(byFile(combat1, 'combat_perc')).gain.value).toBe(0);
    expect(layerGain(byFile(combat1, 'combat_drive')).gain.value).toBe(1);
    m.setIntensity(2);
    expect(layerGain(byFile(combat1, 'combat_perc')).gain.value).toBe(1);
    // L'ancien morceau est arrêté après le fondu.
    expect(prep1.every((s) => s.stopped !== null && (s.stopped as number) >= 10)).toBe(true);

    // Nouveaux départs : les variations alternent.
    ctx.currentTime = 20;
    m.playMusic('prep');
    await flush();
    const prep2 = ctx.sources.slice(5);
    expect(prep2.length).toBe(2);
    expect(prep2.every((s) => s.buffer?.file.startsWith('music/prep2_'))).toBe(true);
    ctx.currentTime = 30;
    m.playMusic('combat');
    await flush();
    const combat2 = ctx.sources.slice(7);
    expect(combat2.every((s) => s.buffer?.file.startsWith('music/combat2_'))).toBe(true);
    ctx.currentTime = 40;
    m.playMusic('combat');
    await flush();
    expect(ctx.sources.length).toBe(10); // déjà en cours : pas de relance

    // Arrêt.
    m.stopMusic(1);
    expect(combat2.every((s) => s.stopped !== null)).toBe(true);
  });

  it('routage des bus, anti-spam et polyphonie des effets', async () => {
    installFakes();
    const m = new AudioManager();
    await m.unlock();
    await m.preload();
    const ctx = FakeCtx.last as FakeCtx;
    const internals = m as unknown as Internals;

    m.playSfx('uiClick');
    m.playSfx('impactPhysical', { pan: 0.5, volume: 0.5 });
    const [click, impact] = ctx.sources;
    const busOf = (src: FakeSource): FakeNode => {
      let n: FakeNode = src.out[0];
      while (n.out[0] && n !== internals.uiBus && n !== internals.sfxBus) n = n.out[0];
      return n;
    };
    expect(busOf(click)).toBe(internals.uiBus);
    expect(busOf(impact)).toBe(internals.sfxBus);
    expect((impact.out[0] as FakeGain).gain.value).toBeCloseTo(0.5, 6);

    // Anti-spam : même instant → ignoré.
    const before = ctx.sources.length;
    m.playSfx('impactPhysical');
    expect(ctx.sources.length).toBe(before);

    // Polyphonie : 12 impacts sans throttle → au plus 6 voix actives de cet effet.
    for (let i = 0; i < 12; i++) {
      ctx.currentTime += 0.001;
      m.playSfx('impactPhysical', { throttleMs: 0 });
    }
    const impacts = ctx.sources.filter((s) => s.buffer?.file === 'sfx/impactPhysical.mp3');
    const active = impacts.filter((s) => s.stopped === null);
    expect(active.length).toBeLessThanOrEqual(6);
    expect(impacts.length).toBe(13);

    // Tous les identifiants sont jouables.
    for (const id of SFX_IDS) {
      ctx.currentTime += 1;
      expect(() => m.playSfx(id as SfxId)).not.toThrow();
    }
    expect(new Set(ctx.sources.map((s) => s.buffer?.file)).size).toBe(SFX_IDS.length);
    // Variation de hauteur bornée par le manifeste.
    for (const s of ctx.sources) expect(Math.abs(1200 * Math.log2(s.playbackRate.value))).toBeLessThanOrEqual(150);
  });

  it('ambiance indépendante de la musique', async () => {
    installFakes();
    const m = new AudioManager();
    await m.unlock();
    await m.preload();
    const ctx = FakeCtx.last as FakeCtx;
    m.playAmbience(true);
    await flush();
    expect(ctx.sources.length).toBe(1);
    expect(ctx.sources[0].buffer?.file).toBe('music/ambience.mp3');
    m.playMusic('menu');
    await flush();
    expect(ctx.sources.length).toBe(2);
    expect(ctx.sources[0].stopped).toBeNull();
    m.playAmbience(false);
    expect(ctx.sources[0].stopped).not.toBeNull();
  });
});
