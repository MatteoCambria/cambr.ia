/**
 * Moteur de rendu des morceaux.
 *
 * Un morceau (SongDef) est une liste de stems ; chaque stem est une liste de pistes (instrument +
 * notes + réglages de console). Pipeline :
 *   notes → pistes (inserts EQ/chorus) → bus sec + envois réverbération/délai → stem
 *   → boucles : repli de la queue (réverbération, relâchements) sur le début = boucle sans couture
 *   → mastering lié : même gain de normalisation, même courbe de compression/limitation pour
 *     tous les stems (calculée sur le mixage complet) afin que toute combinaison reste sous le
 *     plafond et que les stems restent cohérents entre eux.
 */
import { SR, Rng, makeStereo, addMono, addStereo, panGains, midiToFreq, clamp, secs, scaleStereo, applyGainCurve, sumStereo, dbToGain, hashString, fadeEdges, type Stereo } from './dsp/core';
import { hallReverb, stereoDelay, chorus, eqStereo, widen, compressorGain, limiterGain, circular, type HallOptions, type ChorusOptions, type EqBand, type CompressorOptions } from './dsp/effects';
import { lufs, peak, truePeak, loopSeamRatio } from './dsp/analysis';
import type { Instrument } from './instruments';
import type { NoteEv } from './seq/sequencer';

export interface TrackDef {
  name: string;
  inst: Instrument;
  notes: NoteEv[];
  /** Gain de piste (dB). */
  gain?: number;
  pan?: number;
  /** Dispersion aléatoire du pan par note. */
  spread?: number;
  /** Envoi vers la réverbération (linéaire). */
  rev?: number;
  /** Envoi vers le délai (linéaire). */
  dly?: number;
  eq?: EqBand[];
  chorus?: ChorusOptions;
  /** Élargissement mid/side après chorus. */
  width?: number;
  /** Écart-type du jeu humain (s). */
  humanize?: number;
  /** Variation aléatoire de vélocité (±). */
  velJitter?: number;
  /** Accentuation métrique (temps fort +, contretemps −) ; 0 = désactivée. */
  accent?: number;
}

export interface StemDef {
  name: string;
  /** Intensité minimale (setIntensity) à partir de laquelle ce stem est audible. */
  minIntensity: 0 | 1 | 2;
  tracks: () => TrackDef[];
}

export type TempoMap = (beat: number) => number;

export interface SongDef {
  id: string;
  title: string;
  description: string;
  bpm: number;
  beatsPerBar: number;
  bars: number;
  loop: boolean;
  /** Secondes rendues après la fin musicale (queue de réverbération). */
  tail: number;
  seed: number;
  tempo?: TempoMap;
  reverb: HallOptions;
  /** Délai synchronisé au tempo (temps en noires). */
  delay?: { l: number; r: number; feedback: number; lowpass?: number; toReverb?: number };
  stems: StemDef[];
  master: {
    /** Sonie cible (LUFS intégrés) du mixage complet (tous stems). */
    lufs: number;
    /**
     * Morceaux à stems : sonie cible de chaque niveau d'intensité cumulé (0 = base seule,
     * 1 = base + couche/drive, 2 = tout). Les gains de stems sont résolus automatiquement.
     */
    levels?: number[];
    ceilingDb?: number;
    eq?: EqBand[];
    comp?: CompressorOptions;
  };
  /** Couche continue strictement périodique ajoutée après repli (ambiances). */
  continuous?: (loopSamples: number, rng: Rng) => Stereo;
  /** Gain de lecture conseillé (manifeste). */
  gain?: number;
}

export interface RenderOptions {
  /** Rendu d'un extrait (tests) : pas de repli, longueur limitée. */
  maxSeconds?: number;
  /** Remplace le nombre de mesures (tests de couture sur une boucle courte). */
  loopBars?: number;
  /** Journalisation de la progression. */
  log?: (msg: string) => void;
  /** Crochet d'analyse : reçoit chaque piste rendue (après gain, avant réverbération). */
  onTrack?: (stem: string, track: TrackDef, audio: Stereo, a: number, b: number) => void;
}

export interface RenderedStem {
  name: string;
  minIntensity: number;
  audio: Stereo;
  lufs: number;
  peakDb: number;
  truePeakDb: number;
  seam?: number;
}

export interface RenderedSong {
  def: SongDef;
  stems: RenderedStem[];
  /** Longueur de la boucle (ou du morceau) en échantillons. */
  length: number;
  durationSec: number;
  fullLufs: number;
  fullTruePeakDb: number;
  /** Crête vraie de chaque niveau d'intensité cumulé (0, 1, 2). */
  intensityPeaksDb: number[];
  intensityLufs: number[];
  excerpt: boolean;
}

export function beatToSec(song: SongDef, beat: number): number {
  return song.tempo ? song.tempo(beat) : (beat * 60) / song.bpm;
}

/** Ritardando : tempo linéaire de bpm0 à bpm1 entre deux temps. */
export function ritardando(bpm0: number, bpm1: number, startBeat: number, endBeat: number): TempoMap {
  const k = (bpm1 - bpm0) / Math.max(1e-9, endBeat - startBeat);
  const integ = (x: number): number => (Math.abs(k) < 1e-9 ? (x * 60) / bpm0 : (60 / k) * Math.log((bpm0 + k * x) / bpm0));
  const tStart = (startBeat * 60) / bpm0;
  const tEnd = tStart + integ(endBeat - startBeat);
  return (b: number): number => {
    if (b <= startBeat) return (b * 60) / bpm0;
    if (b <= endBeat) return tStart + integ(b - startBeat);
    return tEnd + ((b - endBeat) * 60) / bpm1;
  };
}

/** Replie la partie au-delà de L sur le début (somme circulaire). */
export function foldLoop(s: Stereo, L: number): Stereo {
  const out = makeStereo(L);
  for (let i = 0; i < s.l.length; i++) {
    const j = i % L;
    out.l[j] += s.l[i];
    out.r[j] += s.r[i];
  }
  return out;
}

interface TrackAudio {
  audio: Stereo;
  /** Plage active [a, b) en échantillons (le reste est silencieux). */
  a: number;
  b: number;
}

function renderTrack(song: SongDef, tr: TrackDef, bufLen: number, totalBeats: number, rng: Rng, excerpt: boolean): TrackAudio {
  const buf = makeStereo(bufLen);
  const basePan = tr.pan ?? 0;
  const spread = tr.spread ?? 0;
  const hum = tr.humanize ?? 0.004;
  const vj = tr.velJitter ?? 0.04;
  let idx = 0;
  let lo = bufLen;
  let hi = 0;
  for (const e of tr.notes) {
    idx++;
    let t = e.t;
    if (song.loop && !excerpt) {
      // Anacrouses (t < 0) : jouées en fin de boucle précédente.
      if (t < 0) t += totalBeats;
      if (t >= totalBeats - 1e-9) continue;
    } else if (t < 0) continue;
    const nrng = rng.fork(idx * 7919 + Math.round(e.m * 13));
    const start = beatToSec(song, t) + nrng.gauss() * hum;
    const at = Math.round(Math.max(0, start) * SR);
    if (at >= bufLen) continue;
    const end = beatToSec(song, t + e.d * (e.gate ?? 0.92));
    const dur = Math.max(0.03, end - beatToSec(song, t));
    // Phrasé : premier temps appuyé, temps légèrement, contretemps allégés.
    const acc = tr.accent ?? 0.06;
    const pos = ((t % song.beatsPerBar) + song.beatsPerBar) % song.beatsPerBar;
    const metric = pos < 1e-6 ? 1 : Math.abs(pos - Math.round(pos)) < 1e-6 ? 0.3 : -0.5;
    const vel = clamp(e.v * (1 + acc * metric) + nrng.bi() * vj, 0.02, 1);
    const voice = tr.inst.render({ f: midiToFreq(e.m), m: e.m, dur, vel, rng: nrng });
    const [gl, gr] = panGains(clamp(basePan + (e.pan ?? 0) + spread * nrng.bi(), -1, 1));
    addMono(buf, voice, at, gl * Math.SQRT2, gr * Math.SQRT2);
    lo = Math.min(lo, at);
    hi = Math.max(hi, Math.min(bufLen, at + voice.length));
  }
  if (hi <= lo) return { audio: buf, a: 0, b: 0 };
  // Traitements limités à la plage active (+ marge pour les queues de filtres/chorus).
  const a = lo;
  const b = Math.min(bufLen, hi + secs(0.25));
  const view: Stereo = { l: buf.l.subarray(a, b), r: buf.r.subarray(a, b) };
  if (tr.eq) eqStereo(view, tr.eq);
  let processed = view;
  if (tr.chorus) processed = chorus(view, tr.chorus);
  if (tr.width && tr.width !== 1) widen(processed, tr.width);
  const g = dbToGain(tr.gain ?? 0);
  if (g !== 1) scaleStereo(processed, g);
  if (processed !== view) {
    buf.l.set(processed.l, a);
    buf.r.set(processed.r, a);
  }
  return { audio: buf, a, b };
}

/** Ajoute la plage [a, b) de src dans dst avec un gain. */
function addRange(dst: Stereo, src: Stereo, a: number, b: number, g = 1): void {
  for (let i = a; i < b; i++) {
    dst.l[i] += src.l[i] * g;
    dst.r[i] += src.r[i] * g;
  }
}

/** Rend un morceau complet (ou un extrait) et applique le mastering. */
export function renderSong(song: SongDef, opts: RenderOptions = {}): RenderedSong {
  const log = opts.log ?? ((): void => undefined);
  const bars = opts.loopBars ?? song.bars;
  const totalBeats = bars * song.beatsPerBar;
  const L = secs(beatToSec(song, totalBeats));
  const excerpt = opts.maxSeconds !== undefined;
  const bodyLen = excerpt ? Math.min(L, secs(opts.maxSeconds ?? 0)) : L;
  const bufLen = bodyLen + (excerpt ? 0 : secs(song.tail));
  const rng = new Rng(song.seed);
  const delaySec = song.delay ? { l: beatToSec(song, song.delay.l), r: beatToSec(song, song.delay.r) } : null;

  let stems: Stereo[] = [];
  for (const st of song.stems) {
    const dry = makeStereo(bufLen);
    const revBus = makeStereo(bufLen);
    const dlyBus = makeStereo(bufLen);
    let anyDly = false;
    for (const tr of st.tracks()) {
      const trng = new Rng(hashString(`${song.id}/${st.name}/${tr.name}`) ^ song.seed);
      const t0 = Date.now();
      const { audio, a, b } = renderTrack(song, tr, bufLen, totalBeats, trng, excerpt);
      log(`    piste « ${tr.name} » : ${tr.notes.length} notes, ${Date.now() - t0} ms`);
      opts.onTrack?.(st.name, tr, audio, a, b);
      addRange(dry, audio, a, b);
      if (tr.rev) addRange(revBus, audio, a, b, tr.rev);
      if (tr.dly && delaySec) {
        addRange(dlyBus, audio, a, b, tr.dly);
        anyDly = true;
      }
    }
    if (anyDly && song.delay && delaySec) {
      const d = stereoDelay(dlyBus, { timeL: delaySec.l, timeR: delaySec.r, feedback: song.delay.feedback, lowpass: song.delay.lowpass ?? 4500, highpass: 250, pingPong: true });
      addStereo(dry, d);
      addStereo(revBus, d, 0, song.delay.toReverb ?? 0.35);
    }
    const tr0 = Date.now();
    const wet = hallReverb(revBus, song.reverb);
    log(`    réverbération : ${Date.now() - tr0} ms`);
    addStereo(dry, wet);
    stems.push(dry);
    log(`  stem ${st.name} rendu`);
  }

  let length = bodyLen;
  if (song.loop && !excerpt) {
    stems = stems.map((s) => foldLoop(s, L));
    length = L;
    if (song.continuous) addStereo(stems[0], song.continuous(L, rng.fork('continuous')));
  } else if (!excerpt) {
    // Morceau non bouclé : coupe le silence final, fondu de sortie.
    const full = sumStereo(stems);
    const p = peak(full);
    const thr = p * dbToGain(-72);
    let last = full.l.length - 1;
    while (last > 0 && Math.abs(full.l[last]) < thr && Math.abs(full.r[last]) < thr) last--;
    length = Math.min(full.l.length, last + secs(0.05));
    stems = stems.map((s) => {
      const t = { l: s.l.slice(0, length), r: s.r.slice(0, length) };
      fadeEdges(t, 0, secs(0.4));
      return t;
    });
  }

  // ------------------------------- Mastering ------------------------------------------------
  const circ = song.loop && !excerpt;
  const m = song.master;
  // 1) Égalisation et compression propres à chaque stem (détecteur individuel : un stem joué seul
  //    ne « pompe » jamais au rythme d'un autre stem muet).
  stems = stems.map((s) => {
    let x = s;
    if (m.eq && m.eq.length) x = circ ? circular(x, (y) => eqStereo(y, m.eq ?? [])) : eqStereo(x, m.eq);
    if (m.comp) applyGainCurve(x, compressorGain(x, m.comp, circ));
    return x;
  });
  // 2) Équilibrage : gain de chaque stem résolu pour atteindre la sonie de chaque niveau.
  const levelOf = (k: number): number => song.stems[k].minIntensity;
  const cumulative = (lvl: number): Stereo => sumStereo(stems.filter((_, k) => levelOf(k) <= lvl));
  if (stems.length > 1 && m.levels && m.levels.length) {
    const lvls = Array.from(new Set(song.stems.map((st) => st.minIntensity))).sort((a, b) => a - b);
    for (const lvl of lvls) {
      const target = m.levels[Math.min(lvl, m.levels.length - 1)];
      const idxs = stems.map((_, k) => k).filter((k) => levelOf(k) === lvl);
      const below = lvl === lvls[0] ? null : cumulative(lvl - 1);
      const own = sumStereo(idxs.map((k) => stems[k]));
      // Dichotomie sur le gain (dB) du groupe de stems de ce niveau.
      let lo = -40;
      let hi = 24;
      const lufsWith = (gDb: number): number => {
        const g = dbToGain(gDb);
        const mix = makeStereo(own.l.length);
        for (let i = 0; i < mix.l.length; i++) {
          mix.l[i] = (below ? below.l[i] : 0) + own.l[i] * g;
          mix.r[i] = (below ? below.r[i] : 0) + own.r[i] * g;
        }
        return lufs(mix);
      };
      for (let it = 0; it < 18; it++) {
        const mid = (lo + hi) / 2;
        if (lufsWith(mid) < target) lo = mid;
        else hi = mid;
      }
      const g = dbToGain((lo + hi) / 2);
      for (const k of idxs) scaleStereo(stems[k], g);
      log(`  niveau ${lvl} : gain ${(20 * Math.log10(g)).toFixed(2)} dB → ${lufs(cumulative(lvl)).toFixed(2)} LUFS`);
    }
  } else {
    const g = dbToGain(m.lufs - lufs(sumStereo(stems)));
    for (const s of stems) scaleStereo(s, g);
  }
  // 3) Limiteur lié : la crête est évaluée sur toutes les combinaisons d'intensité cumulées,
  //    de sorte qu'aucune ne dépasse le plafond (marge pour la crête vraie après encodage).
  const ceiling = m.ceilingDb ?? -1.5;
  const levelsPresent = Array.from(new Set(song.stems.map((st) => st.minIntensity))).sort((a, b) => a - b);
  for (let pass = 0; pass < 3; pass++) {
    const combos = levelsPresent.map((lvl) => cumulative(lvl));
    let tp = 0;
    let sp = 0;
    for (const c of combos) {
      tp = Math.max(tp, truePeak(c));
      sp = Math.max(sp, peak(c));
    }
    if (20 * Math.log10(Math.max(tp, 1e-9)) <= ceiling) break;
    // Enveloppe de crête : max |x| sur toutes les combinaisons, échantillon par échantillon.
    const env = makeStereo(stems[0].l.length);
    for (const c of combos) {
      for (let i = 0; i < env.l.length; i++) {
        const a = Math.abs(c.l[i]);
        const b = Math.abs(c.r[i]);
        if (a > env.l[i]) env.l[i] = a;
        if (b > env.r[i]) env.r[i] = b;
      }
    }
    const margin = 20 * Math.log10(tp / Math.max(sp, 1e-9));
    const g = limiterGain(env, ceiling - margin - 0.1 * (pass + 1), 5, 140, circ);
    for (const s of stems) applyGainCurve(s, g);
  }

  // ------------------------------- Mesures ----------------------------------------------------
  const rendered: RenderedStem[] = song.stems.map((st, i) => {
    const a = stems[i];
    const p = peak(a);
    return {
      name: st.name,
      minIntensity: st.minIntensity,
      audio: a,
      lufs: lufs(a),
      peakDb: 20 * Math.log10(Math.max(p, 1e-9)),
      truePeakDb: 20 * Math.log10(Math.max(truePeak(a), 1e-9)),
      seam: circ ? loopSeamRatio(a) : undefined,
    };
  });
  const intensityPeaksDb: number[] = [];
  const intensityLufs: number[] = [];
  for (let lvl = 0; lvl <= 2; lvl++) {
    const mix = sumStereo(rendered.filter((s) => s.minIntensity <= lvl).map((s) => s.audio));
    intensityPeaksDb.push(20 * Math.log10(Math.max(truePeak(mix), 1e-9)));
    intensityLufs.push(lufs(mix));
  }
  const full = sumStereo(stems);
  return {
    def: song,
    stems: rendered,
    length,
    durationSec: length / SR,
    fullLufs: lufs(full),
    fullTruePeakDb: 20 * Math.log10(Math.max(truePeak(full), 1e-9)),
    intensityPeaksDb,
    intensityLufs,
    excerpt,
  };
}

/** Identifiant de fichier d'un stem (« prep_base ») ou du morceau s'il n'a qu'un stem « main ». */
export function stemFileId(song: SongDef, stemName: string): string {
  return song.stems.length === 1 && stemName === 'main' ? song.id : `${song.id}_${stemName}`;
}
