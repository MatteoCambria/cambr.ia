/**
 * « Salle des Cartes Célestes » — boucle de menu. Variation calme du thème principal :
 * le motif de l'Horloge revient augmenté à la flûte puis à la boîte à musique, sur une
 * harmonie qui oscille entre fa lydien (émerveillement, si naturel) et ré dorien.
 * 72 bpm, 16 mesures (≈ 53 s).
 */
import type { SongDef, TrackDef } from '../engine';
import * as I from '../instruments';
import { mel, prog, padPart, bassPart, arpPart, window, type NoteEv } from '../seq/sequencer';
import { noteToMidi as n } from '../seq/theory';
import { PAD_EQ, LEAD_EQ, BASS_EQ, BELL_EQ, MASTER_EQ, GLUE, clock, barAt } from './common';

const BPB = 4;
const HARMONY = prog(
  `Fmaj7 | G/F | Em7 | Am7 | Dm7 | G/D | Bbmaj7 | Asus4 A |
   Fmaj7 | G/F | Em7 | Am7 | Dm7 | G/D | Bbmaj7 | Csus4 C`,
  BPB,
);

const MELODY_1 = `r:2 C5:1 E5 | D5:3 B4:1 | E5:1.5 D5:.5 E5:1 G5 | C5:4 |
  A4:1.5 G4:.5 A4:1 D5 | B4:1.5 C5:.5 D5:1 G4 | F5:2 E5:1 D5 | E5:2 C#5:2 |`;
const MELODY_2 = `E5:1.5 D5:.5 E5:1 A5 | B5:2 A5:1 G5 | G5:1.5 E5:.5 D5:1 B4 | C5:2 r:1 E5:1 |
  F5:1.5 E5:.5 D5:1 A4 | B4:2 D5:2 | D5:1.5 C5:.5 A4:2 | G4:2 r:2 |`;

function tracks(): TrackDef[] {
  const second = HARMONY.filter((s) => s.t >= barAt(9));
  const flute = mel(MELODY_1, { at: 0, vel: 0.62 });
  const box = mel(MELODY_2, { at: barAt(9), vel: 0.6 });
  // Écho lointain de la flûte dans la seconde moitié (fragments en tierces inférieures).
  const fluteEcho = window(mel(MELODY_2, { at: barAt(9), vel: 0.4, transpose: -12 }), barAt(13), barAt(16));

  const harp = arpPart(HARMONY, { pattern: [0, 2, 4, 5, 6, 5, 4, 2], step: 0.5, from: n('F3'), vel: 0.36, accents: [1.15, 0.85, 0.95, 0.85] });
  const pad = padPart(HARMONY, { voices: 4, low: n('F3'), high: n('A4'), vel: 0.36, overlap: 0.3, holdCommon: true });
  const glass = padPart(HARMONY, { voices: 2, low: n('C5'), high: n('A5'), vel: 0.32, overlap: 0.25, holdCommon: true });
  const choir = padPart(second, { voices: 3, low: n('A3'), high: n('A4'), vel: 0.36, overlap: 0.3, holdCommon: true });
  const bass = bassPart(HARMONY, { low: n('D2'), pattern: 'R:4', vel: 0.42, gate: 1.02 });
  const sub = bassPart(HARMONY, { low: n('D1'), pattern: 'R:4', vel: 0.35, gate: 1.02 });
  // Lueurs de célesta : une note de l'accord au 3e temps, une mesure sur deux plus haute.
  const stars = arpPart(HARMONY, { pattern: [-1, -1, -1, -1, 5, -1, -1, 6, -1, -1, -1, -1, 7, -1, -1, -1], step: 0.5, from: n('A5'), vel: 0.34 });
  const clk = clock({ bars: 16, beatsPerBar: BPB, vel: 0.24, sub: 1 });
  const bells: NoteEv[] = [
    { t: barAt(1), d: 4, m: n('F3'), v: 0.3 },
    { t: barAt(9), d: 4, m: n('D3'), v: 0.3 },
  ];
  return [
    { name: 'flûte', inst: I.flute, notes: [...flute, ...fluteEcho], gain: -6.5, pan: -0.15, rev: 0.45, dly: 0.12, eq: LEAD_EQ },
    { name: 'boîte à musique', inst: I.musicBox, notes: box.map((e) => ({ ...e, m: e.m + 12 })), gain: -4.5, pan: 0.2, rev: 0.45, dly: 0.25, eq: BELL_EQ },
    { name: 'lueurs', inst: I.celesta, notes: stars, gain: -18, pan: 0.4, spread: 0.3, rev: 0.5, dly: 0.35, eq: BELL_EQ },
    { name: 'harpe', inst: I.harp, notes: harp, gain: -7, pan: -0.3, spread: 0.15, rev: 0.4, eq: [{ type: 'highpass', f: 90 }] },
    { name: 'nappe cordes', inst: I.stringsPad, notes: pad, gain: -10, spread: 0.3, rev: 0.45, eq: PAD_EQ, chorus: { mix: 0.35, depthMs: 3, rate: 0.22 }, width: 1.2 },
    { name: 'nappe de verre', inst: I.glassPad, notes: glass, gain: -13, spread: 0.5, rev: 0.6, eq: PAD_EQ, chorus: { mix: 0.4, rate: 0.15 } },
    { name: 'chœur', inst: I.choir('u'), notes: choir, gain: -12, spread: 0.4, rev: 0.55, eq: PAD_EQ, chorus: { mix: 0.3 } },
    { name: 'contrebasses', inst: I.lowStrings, notes: bass, gain: -9, rev: 0.25, eq: BASS_EQ },
    { name: 'sub', inst: I.subBass, notes: sub, gain: -21, eq: [{ type: 'lowpass', f: 130 }] },
    { name: 'tic', inst: I.tick, notes: clk.tick, gain: -9, pan: 0.35, rev: 0.4, humanize: 0.001 },
    { name: 'tac', inst: I.tock, notes: clk.tock, gain: -9, pan: -0.35, rev: 0.4, humanize: 0.001 },
    { name: 'cloche', inst: I.bell, notes: bells, gain: -6, rev: 0.5, eq: BELL_EQ },
  ];
}

export const menu: SongDef = {
  id: 'menu',
  title: 'Salle des Cartes Célestes',
  description: 'Boucle de menu — variation calme du thème, flûte, boîte à musique, harpe.',
  bpm: 72,
  beatsPerBar: BPB,
  bars: 16,
  loop: true,
  tail: 8,
  seed: 2207,
  reverb: { rt60: 3.8, damping: 7500, preDelay: 0.03, size: 1.3, lowCut: 170 },
  delay: { l: 0.75, r: 1.5, feedback: 0.32, lowpass: 3500 },
  stems: [{ name: 'main', minIntensity: 0, tracks }],
  master: { lufs: -17, eq: MASTER_EQ, comp: GLUE },
};
