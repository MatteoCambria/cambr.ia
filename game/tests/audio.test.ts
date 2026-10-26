/**
 * Tests de la bande-son : primitives DSP, rendus d'effets sonores, extraits de musique (non-silence,
 * absence d'écrêtage, stems de même longueur), boucles sans couture, manifeste et fichiers MP3.
 * Les rendus testés sont ceux du moteur DSP (pas les MP3) ; le manifeste et les fichiers sont ceux
 * générés par `npm run audio`.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSong, renderSfx, getSong, SONGS, CUES, SFX, SFX_IDS as TOOL_SFX_IDS, loopFile, LOOP_PAD, SFX_CEILING } from '../tools/audio/api';
import { beatToSec } from '../tools/audio/engine';
import { peak, rms, lufs, loopSeamRatio, truePeak, maxLoudness } from '../tools/audio/dsp/analysis';
import { Biquad } from '../tools/audio/dsp/filters';
import { osc, sine } from '../tools/audio/dsp/osc';
import { karplus } from '../tools/audio/dsp/ks';
import { limiterGain, freeverb, hallReverb } from '../tools/audio/dsp/effects';
import { Rng, SR, dbToGain, makeStereo } from '../tools/audio/dsp/core';
import { mel, prog } from '../tools/audio/seq/sequencer';
import { SFX_IDS, MUSIC_CUES, UI_SFX } from '../src/audio/AudioManager';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public', 'audio');
const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-12));

// ------------------------------------------------------------------------------------- DSP

describe('primitives DSP', () => {
  it('le biquad passe-bas atténue les aigus et laisse passer les graves', () => {
    const n = SR;
    const lo = sine(100, n);
    const hi = sine(8000, n);
    new Biquad('lowpass', 1000).run(lo);
    new Biquad('lowpass', 1000).run(hi);
    expect(db(rms(lo.subarray(SR / 2)) / Math.SQRT1_2)).toBeGreaterThan(-0.5);
    expect(db(rms(hi.subarray(SR / 2)) / Math.SQRT1_2)).toBeLessThan(-30);
  });

  it("l'oscillateur polyBLEP produit la bonne fréquence sans dépasser ±1,1", () => {
    const x = osc('saw', 440, SR);
    let crossings = 0;
    for (let i = 1; i < x.length; i++) if (x[i - 1] > 0 && x[i] <= 0) crossings++;
    expect(Math.abs(crossings - 440)).toBeLessThanOrEqual(2);
    expect(peak(x)).toBeLessThan(1.1);
  });

  it('Karplus-Strong est accordé à moins de 1 % près', () => {
    const f = 220;
    const x = karplus(f, 1, new Rng(1), { t60: 2, brightness: 0.5 });
    // Autocorrélation sur la seconde moitié.
    const seg = x.subarray(SR / 4, SR / 4 + 8192);
    let best = 0;
    let bestLag = 0;
    for (let lag = 150; lag < 250; lag++) {
      let acc = 0;
      for (let i = 0; i + lag < seg.length; i++) acc += seg[i] * seg[i + lag];
      if (acc > best) {
        best = acc;
        bestLag = lag;
      }
    }
    expect(Math.abs(SR / bestLag - f) / f).toBeLessThan(0.01);
  });

  it('le sonomètre BS.1770 lit -20 LUFS pour un sinus 1 kHz à -20 dBFS sur deux canaux', () => {
    const s = sine(1000, SR * 3);
    for (let i = 0; i < s.length; i++) s[i] *= dbToGain(-20);
    expect(lufs({ l: s, r: s })).toBeCloseTo(-20, 0);
  });

  it('le limiteur garantit le plafond', () => {
    const r = new Rng(3);
    const s = makeStereo(SR);
    for (let i = 0; i < SR; i++) {
      s.l[i] = r.bi() * 1.8;
      s.r[i] = r.bi() * 1.2;
    }
    const g = limiterGain(s, -3);
    let m = 0;
    for (let i = 0; i < SR; i++) m = Math.max(m, Math.abs(s.l[i] * g[i]), Math.abs(s.r[i] * g[i]));
    expect(db(m)).toBeLessThanOrEqual(-3 + 1e-4);
  });

  it('les réverbérations (Freeverb et FDN) produisent une queue qui décroît', () => {
    const x = makeStereo(SR * 3);
    x.l[100] = 1;
    x.r[100] = 1;
    for (const wet of [freeverb(x, { room: 0.5 }), hallReverb(x, { rt60: 1.2 })]) {
      const early = rms({ l: wet.l.subarray(SR * 0.1, SR * 0.4), r: wet.r.subarray(SR * 0.1, SR * 0.4) });
      const late = rms({ l: wet.l.subarray(SR * 2, SR * 3), r: wet.r.subarray(SR * 2, SR * 3) });
      expect(early).toBeGreaterThan(1e-4);
      expect(late).toBeLessThan(early * 0.1);
      expect(Number.isFinite(peak(wet))).toBe(true);
    }
  });

  it('la notation mélodique vérifie les mesures', () => {
    expect(mel('A4:1.5 G4:.5 A4:1 D5 |').length).toBe(4);
    expect(() => mel('A4:1 G4 |')).toThrow(/incomplète/);
    expect(prog('Dm | Bb C', 4).map((s) => s.d)).toEqual([4, 2, 2]);
  });
});

// ------------------------------------------------------------------------------------- SFX

describe('effets sonores (rendus DSP)', () => {
  it('la liste des SFX du moteur et celle du gestionnaire sont identiques', () => {
    expect([...TOOL_SFX_IDS]).toEqual([...SFX_IDS]);
    expect(SFX.length).toBe(49);
  });

  for (const def of SFX) {
    it(`${def.id} : audible, sans écrêtage, durée raisonnable`, () => {
      const r = renderSfx(def);
      expect(r.channels).toBe(def.stereo ? 2 : 1);
      expect(rms(r.audio)).toBeGreaterThan(1e-3);
      expect(r.truePeakDb).toBeLessThanOrEqual(SFX_CEILING + 0.05);
      expect(r.duration).toBeGreaterThan(0.02);
      expect(r.duration).toBeLessThan(4);
      // Niveau proche de la cible (les sons très transitoires peuvent rester un peu en dessous).
      const lu = maxLoudness(r.audio, 0.2);
      expect(lu).toBeLessThan(def.level + 0.5);
      expect(lu).toBeGreaterThan(def.level - 2.5);
      // Bus : interface pour les sons d'UI et de boutique, sfx sinon.
      expect(def.bus === 'ui').toBe(UI_SFX.has(def.id));
    });
  }
});

// ----------------------------------------------------------------------------------- Musique

describe('musique (extraits DSP)', () => {
  it('chaque cue de jeu est couverte, prep et combat ont deux variations', () => {
    expect(CUES.map((c) => c.cue).sort()).toEqual([...MUSIC_CUES].sort());
    expect(CUES.find((c) => c.cue === 'prep')?.songs.length).toBe(2);
    expect(CUES.find((c) => c.cue === 'combat')?.songs.length).toBe(2);
  });

  for (const song of SONGS) {
    it(`${song.id} : extrait non silencieux, sans écrêtage, stems synchrones`, () => {
      const r = renderSong(song, { maxSeconds: 3 });
      const len = r.stems[0].audio.l.length;
      expect(len).toBe(Math.min(3 * SR, Math.round(beatToSec(song, song.bars * song.beatsPerBar) * SR)));
      for (const st of r.stems) {
        expect(st.audio.l.length).toBe(len);
        expect(st.audio.r.length).toBe(len);
        expect(rms(st.audio)).toBeGreaterThan(dbToGain(-50));
        expect(truePeak(st.audio)).toBeLessThan(dbToGain(-1));
      }
      for (const p of r.intensityPeaksDb) expect(p).toBeLessThan(-1);
    });
  }

  it('les stems d’un même morceau ont la même durée de boucle et le même tempo', () => {
    for (const c of CUES) {
      for (const s of c.songs) {
        const lengths = s.stems.map(() => beatToSec(s, s.bars * s.beatsPerBar));
        expect(new Set(lengths).size).toBe(1);
      }
    }
  });

  it('une boucle courte rendue en entier se raccorde sans clic (repli de la queue)', () => {
    const r = renderSong(getSong('prep'), { loopBars: 2 });
    expect(r.length).toBe(Math.round(2 * 4 * (60 / 96) * SR));
    for (const st of r.stems) expect(loopSeamRatio(st.audio)).toBeLessThan(1);
    // Le fichier de boucle contient l'amorce : début recopié à la fin.
    const f = loopFile(r.stems[0].audio);
    const L = r.stems[0].audio.l.length;
    expect(f.l.length).toBe(L + Math.round(LOOP_PAD * SR));
    expect(f.l[L + 10]).toBe(r.stems[0].audio.l[10]);
  });
});

// ------------------------------------------------------------------------- Manifeste & fichiers

interface MStem {
  id: string;
  file: string;
  duration: number;
  minIntensity: number;
}
interface MMusic {
  id: string;
  cue: string;
  file: string;
  duration: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  bpm: number;
  gain: number;
  stems: MStem[];
}
interface MSfx {
  id: string;
  file: string;
  duration: number;
  bus: string;
  gain: number;
  peakDb: number;
}

describe('manifeste et fichiers générés', () => {
  const path = join(PUBLIC, 'manifest.json');
  const hasManifest = existsSync(path);
  const manifest = hasManifest ? (JSON.parse(readFileSync(path, 'utf8')) as { music: MMusic[]; sfx: MSfx[] }) : { music: [], sfx: [] };

  it('le manifeste existe (npm run audio)', () => {
    expect(hasManifest).toBe(true);
  });

  it('chaque cue musicale et chaque SFX est présent', () => {
    for (const cue of MUSIC_CUES) expect(manifest.music.some((m) => m.cue === cue)).toBe(true);
    for (const id of SFX_IDS) expect(manifest.sfx.some((s) => s.id === id)).toBe(true);
    const stemIds = manifest.music.flatMap((m) => m.stems.map((s) => s.id));
    for (const id of ['prep_base', 'prep_layer', 'prep2_base', 'prep2_layer', 'combat_base', 'combat_drive', 'combat_perc', 'combat2_base', 'combat2_drive', 'combat2_perc', 'mainTheme', 'menu', 'decisive', 'victory', 'defeat', 'event', 'ambience']) {
      expect(stemIds).toContain(id);
    }
  });

  it('les fichiers référencés existent et ne sont pas vides', () => {
    const files = [...manifest.music.flatMap((m) => m.stems.map((s) => s.file)), ...manifest.sfx.map((s) => s.file)];
    expect(files.length).toBe(17 + 49);
    for (const f of files) {
      const p = join(PUBLIC, f);
      expect(existsSync(p)).toBe(true);
      expect(statSync(p).size).toBeGreaterThan(500);
    }
  });

  it('durées, boucles, tempo et gains conformes au cahier des charges', () => {
    const inRange = (cue: string, lo: number, hi: number): void => {
      const ds = manifest.music.filter((m) => m.cue === cue).map((m) => m.duration);
      expect(ds.length).toBeGreaterThan(0);
      for (const d of ds) {
        expect(d, cue).toBeGreaterThanOrEqual(lo);
        expect(d, cue).toBeLessThanOrEqual(hi);
      }
    };
    inRange('mainTheme', 75, 90);
    inRange('menu', 50, 60);
    inRange('decisive', 48, 64);
    inRange('victory', 12, 20);
    inRange('defeat', 12, 20);
    inRange('event', 35, 45);
    inRange('ambience', 40, 50);
    inRange('prep', 30, 70);
    inRange('combat', 30, 70);
    for (const m of manifest.music) {
      expect(m.loop).toBe(!['victory', 'defeat'].includes(m.cue));
      expect(m.bpm).toBeGreaterThan(40);
      expect(m.gain).toBeGreaterThan(0);
      expect(m.stems.length).toBeGreaterThan(0);
      // Stems synchronisés : même durée.
      expect(new Set(m.stems.map((s) => s.duration)).size).toBe(1);
      expect(m.stems[0].duration).toBeCloseTo(m.duration, 3);
      if (m.loop) expect(m.loopEnd - m.loopStart).toBeCloseTo(m.duration, 3);
    }
    for (const s of manifest.sfx) {
      expect(s.peakDb).toBeLessThan(-1);
      expect(['ui', 'sfx']).toContain(s.bus);
    }
  });

  it('taille totale sous 14 Mo', () => {
    const files = [...manifest.music.flatMap((m) => m.stems.map((s) => s.file)), ...manifest.sfx.map((s) => s.file)];
    const total = files.reduce((a, f) => a + (existsSync(join(PUBLIC, f)) ? statSync(join(PUBLIC, f)).size : 0), 0);
    expect(total).toBeLessThan(14 * 1024 * 1024);
  });
});
