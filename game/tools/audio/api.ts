/**
 * API publique du synthétiseur hors-ligne (utilisée par render.ts et par les tests).
 *   - renderSong(getSong(id), { maxSeconds }) : morceau complet ou extrait court ;
 *   - renderSfx(getSfx(id)) : effet sonore normalisé (sonie + plafond de crête vraie) ;
 *   - loopFile(stem) : tampon de boucle prêt à encoder (boucle + amorce de LOOP_PAD secondes).
 */
import { Rng, hashString, makeStereo, type Stereo, SR, dbToGain, secs, applyGainCurve, scaleStereo } from './dsp/core';
import { maxLoudness, peak, truePeak, lufs } from './dsp/analysis';
import { limiterGain } from './dsp/effects';
import { Biquad } from './dsp/filters';
import type { SfxDef } from './sfx/library';

export { renderSong, stemFileId, type SongDef, type RenderedSong } from './engine';
export { SONGS, CUES, getSong, cueOf } from './music/index';
export { SFX, SFX_IDS, getSfx, type SfxDef } from './sfx/library';

/** Amorce ajoutée en fin de fichier bouclé (copie du début) : tolère le délai d'encodeur MP3. */
export const LOOP_PAD = 0.25;
/** Point de départ de boucle conseillé (s) : au-delà de tout délai de décodage MP3 (< 0,05 s). */
export const LOOP_START = 0.1;
/** Plafond de crête vraie des SFX (dBFS). */
export const SFX_CEILING = -1.5;

export interface RenderedSfx {
  def: SfxDef;
  audio: Stereo | Float32Array;
  channels: 1 | 2;
  duration: number;
  loudness: number;
  peakDb: number;
  truePeakDb: number;
}

const asStereo = (x: Stereo | Float32Array): Stereo => (x instanceof Float32Array ? { l: x, r: x } : x);

/** Rend un effet sonore, coupe le silence final, normalise et limite. */
export function renderSfx(def: SfxDef): RenderedSfx {
  const raw = def.render(new Rng(hashString(def.id)));
  // Canaux : mono demandé → moyenne ; stéréo demandé → duplique si besoin.
  let s: Stereo;
  if (def.stereo) {
    s = raw instanceof Float32Array ? { l: Float32Array.from(raw), r: Float32Array.from(raw) } : raw;
  } else {
    const m = raw instanceof Float32Array ? Float32Array.from(raw) : Float32Array.from(raw.l, (v, i) => 0.5 * (v + raw.r[i]));
    s = { l: m, r: m };
  }
  // Retire le continu / l'infra-grave.
  for (const ch of def.stereo ? [s.l, s.r] : [s.l]) new Biquad('highpass', 28, 0.7).run(ch);
  // Coupe le silence final (−60 dB sous la crête) et adoucit les bords.
  const p = peak(s);
  const thr = p * dbToGain(-60);
  let last = s.l.length - 1;
  while (last > 0 && Math.abs(s.l[last]) < thr && Math.abs(s.r[last]) < thr) last--;
  const len = Math.min(s.l.length, last + secs(0.01));
  const out: Stereo = def.stereo ? { l: s.l.slice(0, len), r: s.r.slice(0, len) } : { l: s.l.slice(0, len), r: s.l.slice(0, len) };
  const fo = Math.min(secs(0.03), Math.floor(len / 4));
  const fi = Math.min(secs(0.001), Math.floor(len / 8));
  for (let i = 0; i < fo; i++) {
    out.l[len - 1 - i] *= i / fo;
    out.r[len - 1 - i] *= i / fo;
  }
  for (let i = 0; i < fi; i++) {
    out.l[i] *= i / fi;
    out.r[i] *= i / fi;
  }
  // Normalisation sur la sonie max (fenêtre 200 ms), puis plafond de crête vraie.
  const lu = maxLoudness(def.stereo ? out : out.l, 0.2);
  scaleStereo(out, dbToGain(def.level - lu));
  for (let pass = 0; pass < 3; pass++) {
    const tp = truePeak(out);
    if (20 * Math.log10(tp) <= SFX_CEILING) break;
    const margin = 20 * Math.log10(tp / Math.max(peak(out), 1e-9));
    applyGainCurve(out, limiterGain(out, SFX_CEILING - margin - 0.1 * (pass + 1), 2, 60, false));
  }
  const audio = def.stereo ? out : out.l;
  return {
    def,
    audio,
    channels: def.stereo ? 2 : 1,
    duration: len / SR,
    loudness: maxLoudness(audio, 0.2),
    peakDb: 20 * Math.log10(Math.max(peak(audio), 1e-9)),
    truePeakDb: 20 * Math.log10(Math.max(truePeak(audio), 1e-9)),
  };
}

/** Fichier de boucle : la boucle suivie de son début (LOOP_PAD s), pour un bouclage robuste. */
export function loopFile(s: Stereo): Stereo {
  const L = s.l.length;
  const P = Math.min(secs(LOOP_PAD), L);
  const out = makeStereo(L + P);
  out.l.set(s.l);
  out.r.set(s.r);
  out.l.set(s.l.subarray(0, P), L);
  out.r.set(s.r.subarray(0, P), L);
  return out;
}

export function measure(s: Stereo | Float32Array): { lufs: number; truePeakDb: number } {
  return { lufs: lufs(asStereo(s)), truePeakDb: 20 * Math.log10(Math.max(truePeak(s), 1e-9)) };
}
