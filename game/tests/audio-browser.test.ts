/**
 * Test d'intégration dans un vrai navigateur (Chromium via Playwright), ignoré automatiquement si
 * Playwright, Chromium ou esbuild ne sont pas disponibles. Vérifie : décodage des MP3 par Chromium
 * (durée = boucle + amorce), couture de boucle rendue par l'implémentation Web Audio du navigateur
 * avec les loopStart/loopEnd du manifeste, et comportement du gestionnaire (stems, alternance,
 * SFX, ambiance) sans erreur console.
 */
import { createServer, type Server } from 'node:http';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');

type Browser = { newPage(): Promise<Page>; close(): Promise<void> };
type Page = {
  on(ev: string, cb: (x: { type?: () => string; text?: () => string; message?: string }) => void): void;
  goto(url: string): Promise<unknown>;
  evaluate<T>(fn: () => Promise<T>): Promise<T>;
};
type PlaywrightLike = { chromium: { launch(o: { args: string[] }): Promise<Browser> } };
type EsbuildLike = { build(o: Record<string, unknown>): Promise<unknown> };

function load<T>(name: string): T | null {
  const req = createRequire(import.meta.url);
  try {
    return req(name) as T;
  } catch {
    try {
      const globalRoot = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      return req(req.resolve(name, { paths: [globalRoot] })) as T;
    } catch {
      return null;
    }
  }
}

const playwright = load<PlaywrightLike>('playwright');
const esbuild = load<EsbuildLike>('esbuild');
const hasManifest = existsSync(join(PUBLIC, 'audio', 'manifest.json'));

interface BrowserReport {
  ready: boolean;
  decoded: Array<{ id: string; decoded: number; expected: number }>;
  seams: Array<{ id: string; jumpRatio: number }>;
  prepStems: number;
  prepCue: string;
  combatStems: number;
  prepCue2: string;
  ambience: boolean;
  sfxVoices: number;
}

describe.skipIf(!playwright || !esbuild || !hasManifest)('AudioManager dans Chromium (intégration)', () => {
  let dir = '';
  let server: Server | null = null;
  let browser: Browser | null = null;
  let report: BrowserReport | null = null;
  const logs: string[] = [];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orrhea-audio-web-'));
    await (esbuild as EsbuildLike).build({
      entryPoints: [join(ROOT, 'src', 'audio', 'AudioManager.ts')],
      bundle: true,
      format: 'iife',
      globalName: 'AM',
      outfile: join(dir, 'am.js'),
      logLevel: 'silent',
    });
    await writeFile(join(dir, 'index.html'), '<!doctype html><meta charset="utf-8"><script src="am.js"></script>');
    server = createServer((req, res) => {
      const u = decodeURIComponent((req.url ?? '/').split('?')[0]);
      const p = u.startsWith('/audio/') ? join(PUBLIC, u) : join(dir, u === '/' ? 'index.html' : u);
      readFile(p)
        .then((d) => {
          const type = p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : p.endsWith('.mp3') ? 'audio/mpeg' : 'text/html';
          res.writeHead(200, { 'Content-Type': type });
          res.end(d);
        })
        .catch(() => {
          res.writeHead(404);
          res.end();
        });
    });
    await new Promise<void>((r) => server?.listen(0, () => r()));
    const port = (server.address() as { port: number }).port;
    browser = await (playwright as PlaywrightLike).chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage();
    page.on('console', (m) => logs.push(`[${m.type?.()}] ${m.text?.()}`));
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto(`http://localhost:${port}/`);
    report = await page.evaluate(async () => {
      type AMType = { audio: Record<string, unknown> & { ready: boolean; unlock(): Promise<void>; preload(): Promise<void>; playMusic(c: string): void; setIntensity(l: number): void; playSfx(id: string, o?: object): void; playAmbience(on: boolean): void; stopMusic(f?: number): void } };
      const a = (window as unknown as { AM: AMType }).AM.audio;
      const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
      await a.unlock();
      await a.preload();
      const ctx = a.ctx as AudioContext;
      const man = (await (await fetch('audio/manifest.json')).json()) as { loopPadding: number; music: Array<{ id: string; loop: boolean; duration: number; loopStart: number; loopEnd: number; stems: Array<{ id: string; file: string }> }> };
      const decoded: Array<{ id: string; decoded: number; expected: number }> = [];
      for (const m of man.music) {
        for (const st of m.stems) {
          const buf = await ctx.decodeAudioData(await (await fetch(`audio/${st.file}`)).arrayBuffer());
          decoded.push({ id: st.id, decoded: buf.duration, expected: m.duration + (m.loop ? man.loopPadding : 0) });
        }
      }
      const seams: Array<{ id: string; jumpRatio: number }> = [];
      for (const m of man.music.filter((x) => x.loop)) {
        const data = await (await fetch(`audio/${m.stems[0].file}`)).arrayBuffer();
        const sr = 44100;
        const off = new OfflineAudioContext(2, Math.round((m.loopEnd + 0.5) * sr), sr);
        const buf = await off.decodeAudioData(data);
        const src = off.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = m.loopStart;
        src.loopEnd = m.loopEnd;
        src.connect(off.destination);
        src.start(0);
        const out = (await off.startRendering()).getChannelData(0);
        const seam = Math.round(m.loopEnd * sr);
        let jump = 0;
        for (let i = seam - 3; i <= seam + 3; i++) jump = Math.max(jump, Math.abs(out[i] - out[i - 1]));
        const diffs: number[] = [];
        for (let i = 1; i < seam; i += 5) diffs.push(Math.abs(out[i] - out[i - 1]));
        diffs.sort((x, y) => x - y);
        seams.push({ id: m.stems[0].id, jumpRatio: jump / Math.max(diffs[Math.floor(diffs.length * 0.999)], 1e-9) });
      }
      const music = (): { stems: unknown[]; entry: { id: string } } | null => a.music as { stems: unknown[]; entry: { id: string } } | null;
      a.playMusic('prep');
      await sleep(1500);
      const prepStems = music()?.stems.length ?? 0;
      const prepCue = music()?.entry.id ?? '';
      a.setIntensity(1);
      a.playMusic('combat');
      await sleep(2500);
      const combatStems = music()?.stems.length ?? 0;
      for (const id of ['uiClick', 'impactPhysical', 'explosion', 'castAstral', 'victoryFanfare']) a.playSfx(id, { pan: 0.3 });
      const sfxVoices = (a.sfxVoices as unknown[]).length;
      a.playMusic('prep');
      await sleep(2500);
      const prepCue2 = music()?.entry.id ?? '';
      a.playAmbience(true);
      await sleep(1500);
      const ambience = !!a.ambience;
      a.stopMusic(0.3);
      a.playAmbience(false);
      return { ready: a.ready, decoded, seams, prepStems, prepCue, combatStems, prepCue2, ambience, sfxVoices };
    });
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    server?.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('décode tous les MP3 à la durée attendue (délai d’encodeur retiré)', () => {
    const r = report as BrowserReport;
    expect(r.ready).toBe(true);
    expect(r.decoded.length).toBe(17);
    for (const d of r.decoded) expect(Math.abs(d.decoded - d.expected), d.id).toBeLessThan(0.01);
  });

  it('les boucles rendues par Chromium ne présentent aucun saut au point de bouclage', () => {
    const r = report as BrowserReport;
    expect(r.seams.length).toBe(9);
    for (const s of r.seams) expect(s.jumpRatio, s.id).toBeLessThan(1);
  });

  it('le gestionnaire joue stems, variations, effets et ambiance sans erreur', () => {
    const r = report as BrowserReport;
    expect(r.prepStems).toBe(2);
    expect(r.prepCue).toBe('prep');
    expect(r.combatStems).toBe(3);
    expect(r.prepCue2).toBe('prep2');
    expect(r.sfxVoices).toBe(5);
    expect(r.ambience).toBe(true);
    expect(logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]') || l.includes('[audio]'))).toEqual([]);
  });
});
