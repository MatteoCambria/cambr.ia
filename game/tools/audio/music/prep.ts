/**
 * Musiques de préparation (phase de planification), deux variations à stems synchronisés.
 *
 * prep  — « L'Atelier des Rouages » : la dorien, 96 bpm, 20 mesures (50 s). Base : pizzicati en
 *         engrenage (fondamentale-quinte-octave), nappe, contrebasses, tic-tac. Couche : flûte
 *         (motif de l'Horloge transposé), marimba en croches, violoncelles, harpe, shaker.
 * prep2 — « Cartographie des Orbites » : fa lydien / ré dorien, 100 bpm, 20 mesures (48 s), en
 *         triolets (balancement ternaire). Base : harpe en triolets, nappe chaude, basse pincée,
 *         horloge. Couche : boîte à musique, pizzicati, chœur « o », shaker ternaire.
 */
import type { SongDef, TrackDef } from '../engine';
import * as I from '../instruments';
import { mel, prog, padPart, bassPart, arpPart, rhythm, window, type NoteEv } from '../seq/sequencer';
import { noteToMidi as n } from '../seq/theory';
import { PAD_EQ, LEAD_EQ, BASS_EQ, BELL_EQ, PERC_EQ, MASTER_EQ, GLUE, clock, barAt } from './common';

const BPB = 4;

// ------------------------------------------------------------------------------------------------
// prep : la dorien
// ------------------------------------------------------------------------------------------------

const PREP_HARMONY = prog(
  `Am | D/A | Fmaj7 | G | Am | D/F# | Fmaj7 | E7sus4 E |
   C | G/B | Am | D | F | C/E | Dm7 | E |
   Am | D/A | Fmaj7 | Esus4 E`,
  BPB,
);

const PREP_MEL_1 = `E5:1.5 D5:.5 E5:1 A5 | F#5:1.5 G5:.5 A5:1 D5 | E5:1 C5 A4 C5 | B4:1 D5 G5:2 |
  E5:1.5 D5:.5 E5:1 A5 | F#5:1.5 G5:.5 A5:1 B5 | C6:1.5 B5:.5 A5:1 F5 | E5:2 G#5:2 |`;
const PREP_MEL_2 = `G5:.5 E5 C5 E5 G5:1 C6 | B5:.5 G5 D5 G5 B5:2 | A5:.5 E5 C5 E5 A5:1 G5 | F#5:2 A5:1 F#5 |
  A5:.5 F5 C5 F5 A5:1 C6 | G5:2 E5:1 C5 | D5:1 F5 A5 C6 | B5:2 G#5:2 |`;
const PREP_MEL_3 = `E5:1.5 D5:.5 E5:1 A5 | F#5:1.5 E5:.5 D5:1 C5 | A4:2 C5:2 | B4:2 r:2 |`;

function prepBase(): TrackDef[] {
  const h = PREP_HARMONY;
  const gears = arpPart(h, { pattern: [0, 2, 3, 2, 4, 2, 3, 2], step: 0.5, from: n('A2'), vel: 0.58, accents: [1.2, 0.75, 0.95, 0.75, 1.05, 0.75, 0.95, 0.8], resetOnChord: true });
  const pad = padPart(h, { voices: 4, low: n('A3'), high: n('C5'), vel: 0.34, overlap: 0.3, holdCommon: true });
  const bass = bassPart(h, { low: n('E2'), pattern: 'R:4', vel: 0.45, gate: 1.02 });
  const harp = arpPart(h, { pattern: [0, 1, 2, 3, -1, -1, -1, -1], step: 0.25, from: n('A3'), vel: 0.3, beatsPerBar: BPB });
  const clk = clock({ bars: 20, beatsPerBar: BPB, vel: 0.3, sub: 1 });
  const bells: NoteEv[] = [{ t: 0, d: 4, m: n('A3'), v: 0.25 }, { t: barAt(9), d: 4, m: n('C4'), v: 0.22 }, { t: barAt(17), d: 4, m: n('A3'), v: 0.25 }];
  return [
    { name: 'pizzicati engrenages', inst: I.pizz, notes: gears, gain: 5, pan: 0.15, spread: 0.1, rev: 0.28, eq: [{ type: 'highpass', f: 70 }] },
    { name: 'nappe cordes', inst: I.stringsPad, notes: pad, gain: -13, spread: 0.3, rev: 0.4, eq: PAD_EQ, chorus: { mix: 0.35, rate: 0.25 }, width: 1.2 },
    { name: 'contrebasses', inst: I.lowStrings, notes: bass, gain: -9, rev: 0.2, eq: BASS_EQ },
    { name: 'harpe', inst: I.harp, notes: harp, gain: -9, pan: -0.35, rev: 0.35, eq: [{ type: 'highpass', f: 120 }] },
    { name: 'tic', inst: I.tick, notes: clk.tick, gain: -7, pan: 0.3, rev: 0.25, humanize: 0.001 },
    { name: 'tac', inst: I.tock, notes: clk.tock, gain: -7, pan: -0.3, rev: 0.25, humanize: 0.001 },
    { name: 'cloche', inst: I.chime, notes: bells, gain: -8, pan: -0.2, rev: 0.5, eq: BELL_EQ },
  ];
}

function prepLayer(): TrackDef[] {
  const h = PREP_HARMONY;
  const flute1 = mel(PREP_MEL_1, { at: 0, vel: 0.62 });
  const marim = mel(PREP_MEL_2, { at: barAt(9), vel: 0.62 });
  const flute3 = mel(PREP_MEL_3, { at: barAt(17), vel: 0.6 });
  const glock = marim.filter((e) => Math.abs(e.t % 2) < 1e-6).map((e) => ({ ...e, m: e.m + 12, v: 0.3 }));
  const celli = padPart(h.filter((s) => s.t >= barAt(9) && s.t < barAt(17)), { voices: 1, low: n('C3'), high: n('A3'), vel: 0.5, overlap: 0.2, holdCommon: true });
  const harp16 = arpPart(h.filter((s) => s.t >= barAt(9) && s.t < barAt(17)), { pattern: [0, 1, 2, 3, 4, 3, 2, 1], step: 0.25, from: n('E4'), vel: 0.28 });
  const marimbaOff = arpPart(h.filter((s) => s.t < barAt(9) || s.t >= barAt(17)), { pattern: [-1, 2, -1, 3, -1, 2, -1, 4], step: 0.5, from: n('A4'), vel: 0.36 });
  const shaker = rhythm('x.o.x.o.x.o.x.oo', { bars: 20, m: 60, vel: 0.42 });
  const frame = rhythm('....x.......x..o', { bars: 20, m: n('A2'), vel: 0.45 });
  return [
    { name: 'flûte', inst: I.flute, notes: [...flute1, ...flute3], gain: -6, pan: -0.1, rev: 0.36, dly: 0.12, eq: LEAD_EQ },
    { name: 'marimba mélodie', inst: I.marimba, notes: marim, gain: -3, pan: 0.15, rev: 0.3, dly: 0.15, eq: [{ type: 'highpass', f: 150 }] },
    { name: 'marimba contretemps', inst: I.marimba, notes: marimbaOff, gain: -9, pan: 0.35, rev: 0.3, eq: [{ type: 'highpass', f: 150 }] },
    { name: 'glockenspiel', inst: I.glock, notes: glock, gain: -11, pan: 0.25, rev: 0.4, eq: BELL_EQ },
    { name: 'violoncelles', inst: I.celli, notes: celli, gain: -9, pan: -0.25, rev: 0.32, eq: [{ type: 'highpass', f: 70 }, { type: 'lowpass', f: 3500 }] },
    { name: 'harpe 16e', inst: I.harp, notes: harp16, gain: -11, pan: 0.35, spread: 0.15, rev: 0.35, eq: [{ type: 'highpass', f: 150 }] },
    { name: 'shaker', inst: I.shaker, notes: shaker, gain: -9, pan: 0.4, rev: 0.2 },
    { name: 'tambour', inst: I.frameDrum, notes: frame, gain: -5, pan: -0.15, rev: 0.25, eq: PERC_EQ },
  ];
}

export const prep: SongDef = {
  id: 'prep',
  title: "L'Atelier des Rouages",
  description: 'Préparation — la dorien, pizzicati en engrenage ; stems base + couche.',
  bpm: 96,
  beatsPerBar: BPB,
  bars: 20,
  loop: true,
  tail: 6,
  seed: 3301,
  reverb: { rt60: 2.4, damping: 8000, preDelay: 0.02, size: 1, lowCut: 200 },
  delay: { l: 0.75, r: 0.5, feedback: 0.28, lowpass: 4000 },
  stems: [
    { name: 'base', minIntensity: 0, tracks: prepBase },
    { name: 'layer', minIntensity: 1, tracks: prepLayer },
  ],
  master: { lufs: -16.5, levels: [-18.5, -16.5], eq: MASTER_EQ, comp: GLUE },
};

// ------------------------------------------------------------------------------------------------
// prep2 : fa lydien / ré dorien, ternaire
// ------------------------------------------------------------------------------------------------

const PREP2_HARMONY = prog(
  `F | G/F | Am | Em | F | G/F | Dm7 | Esus4 E |
   Bb | C | Am | Dm | Bb | C | Asus4 | A |
   Dm | G/D | Bbmaj7 | C`,
  BPB,
);

const PREP2_MEL = `C5:1 F5 A5:1.5 G5:.5 | B5:1 A5:.5 G5 D5:2 | E5:1 C5 A4 C5 | B4:3 r:1 |
  C5:1 F5 A5:1.5 C6:.5 | B5:1 D6 B5 G5 | A5:1.5 F5:.5 D5:1 C5 | B4:2 G#4:2 |
  D5:1 F5 Bb5:1.5 A5:.5 | G5:1 E5 C5:2 | A4:1 C5 E5:1.5 D5:.5 | F5:3 r:1 |
  D5:1 F5 Bb5:1.5 C6:.5 | D6:1 C6 G5:2 | A5:1.5 G5:.5 E5:1 D5 | C#5:3 r:1 |
  A4:1.5 G4:.5 A4:1 D5 | B4:1.5 C5:.5 D5:1 G4 | F5:2 D5:1 A4 | G4:2 E5:2 |`;

function prep2Base(): TrackDef[] {
  const h = PREP2_HARMONY;
  const harp = arpPart(h, { pattern: [0, 1, 2, 3, 2, 1], step: 1 / 3, from: n('F3'), vel: 0.42, accents: [1.2, 0.8, 0.85, 1.05, 0.8, 0.85, 1.1, 0.8, 0.85, 1.05, 0.8, 0.85] });
  const pad = padPart(h, { voices: 3, low: n('A3'), high: n('C5'), vel: 0.4, overlap: 0.3, holdCommon: true });
  const bass = bassPart(h, { low: n('D2'), pattern: "R:2 5:4/3 8:2/3'", vel: 0.55 });
  const sub = bassPart(h, { low: n('D1'), pattern: 'R:4', vel: 0.3, gate: 1.02 });
  const clk = clock({ bars: 20, beatsPerBar: BPB, vel: 0.28, sub: 1 });
  return [
    { name: 'harpe triolets', inst: I.harp, notes: harp, gain: -4, pan: -0.25, spread: 0.2, rev: 0.32, eq: [{ type: 'highpass', f: 100 }] },
    { name: 'nappe chaude', inst: I.warmPad, notes: pad, gain: -6, spread: 0.4, rev: 0.45, eq: PAD_EQ, chorus: { mix: 0.4, rate: 0.2 }, width: 1.3 },
    { name: 'basse pincée', inst: I.pluckBass, notes: bass, gain: -5, pan: 0.05, rev: 0.15, eq: BASS_EQ },
    { name: 'sub', inst: I.subBass, notes: sub, gain: -17, eq: [{ type: 'lowpass', f: 130 }] },
    { name: 'tic', inst: I.tick, notes: clk.tick, gain: -7, pan: 0.3, rev: 0.3, humanize: 0.001 },
    { name: 'tac', inst: I.tock, notes: clk.tock, gain: -7, pan: -0.3, rev: 0.3, humanize: 0.001 },
  ];
}

function prep2Layer(): TrackDef[] {
  const h = PREP2_HARMONY;
  const box = mel(PREP2_MEL, { at: 0, vel: 0.62 });
  const counter = bassPart(h, { low: n('D3'), pattern: "R:1' 5:1' 8:1' 5:1'", vel: 0.45 });
  const choir = padPart(h.filter((s) => s.t >= barAt(9) && s.t < barAt(17)), { voices: 3, low: n('A3'), high: n('D5'), vel: 0.42, overlap: 0.5, holdCommon: true });
  const shaker = rhythm('x.ox.ox.ox.o', { bars: 20, m: 60, vel: 0.4 });
  const frame = rhythm('x.....x..x..', { bars: 20, m: n('G2'), vel: 0.42 });
  const flute = window(box, barAt(9), barAt(17)).map((e) => ({ ...e, m: e.m - 12, v: e.v * 0.75 }));
  return [
    { name: 'boîte à musique', inst: I.musicBox, notes: box.map((e) => ({ ...e, m: e.m + 12 })), gain: -2.5, pan: 0.15, rev: 0.4, dly: 0.22, eq: BELL_EQ },
    { name: 'flûte', inst: I.flute, notes: flute, gain: -9, pan: -0.2, rev: 0.4, eq: LEAD_EQ },
    { name: 'pizzicati', inst: I.pizz, notes: counter, gain: 2, pan: 0.3, spread: 0.1, rev: 0.25, eq: [{ type: 'highpass', f: 120 }] },
    { name: 'chœur', inst: I.choir('o'), notes: choir, gain: -11, spread: 0.4, rev: 0.5, eq: PAD_EQ, chorus: { mix: 0.3 } },
    { name: 'shaker', inst: I.shaker, notes: shaker, gain: -9, pan: 0.4, rev: 0.2 },
    { name: 'tambour', inst: I.frameDrum, notes: frame, gain: -6, pan: -0.15, rev: 0.25, eq: PERC_EQ },
  ];
}

export const prep2: SongDef = {
  id: 'prep2',
  title: 'Cartographie des Orbites',
  description: 'Préparation (variation) — fa lydien, harpe en triolets ; stems base + couche.',
  bpm: 100,
  beatsPerBar: BPB,
  bars: 20,
  loop: true,
  tail: 6,
  seed: 3417,
  reverb: { rt60: 2.8, damping: 8000, preDelay: 0.02, size: 1.1, lowCut: 200 },
  delay: { l: 2 / 3, r: 4 / 3, feedback: 0.27, lowpass: 4000 },
  stems: [
    { name: 'base', minIntensity: 0, tracks: prep2Base },
    { name: 'layer', minIntensity: 1, tracks: prep2Layer },
  ],
  master: { lufs: -16.5, levels: [-18.5, -16.5], eq: MASTER_EQ, comp: GLUE },
};
