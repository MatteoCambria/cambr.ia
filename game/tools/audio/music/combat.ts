/**
 * Musiques de combat, deux variations à trois stems synchronisés :
 *   base  — ostinato de cordes en 3-3-2, contrebasses, sub, pulsation de taiko, tic-tac en croches ;
 *   drive — cors (mélodie), violons, chœur, cuivres staccato, charleston et tambour sur cadre ;
 *   perc  — ensemble de taikos, shime-daiko, timbales, cymbales (moments critiques).
 *
 * combat  — « La Convergence » : ré mineur, 128 bpm, 24 mesures (45 s).
 * combat2 — « Éclipse des Rouages » : la mineur (touches phrygiennes, si♭), 132 bpm, 24 mesures.
 */
import type { SongDef, TrackDef } from '../engine';
import * as I from '../instruments';
import { mel, prog, padPart, bassPart, arpPart, rhythm, window, double, type NoteEv, type ChordSpan } from '../seq/sequencer';
import { noteToMidi as n } from '../seq/theory';
import { PAD_EQ, LEAD_EQ, BASS_EQ, PERC_EQ, MASTER_EQ, GLUE_HARD, clock, barAt } from './common';

const BPB = 4;
const between = (h: ChordSpan[], a: number, b: number): ChordSpan[] => h.filter((s) => s.t >= barAt(a) - 1e-9 && s.t < barAt(b + 1) - 1e-9);

/** Ostinato 3-3-2 en doubles croches (accents 0, 3, 6, 8, 11, 14). */
const OSTINATO_332 = "R:.25> R:.25_ R:.25_ 8:.25> R:.25_ R:.25_ R:.25> R:.25_ R:.25> R:.25_ R:.25_ 8:.25> R:.25_ R:.25_ 5:.25> R:.25_";

function timpaniRoll(bar: number, m: number, from = 2, beats = 2): NoteEv[] {
  const out: NoteEv[] = [];
  const steps = beats * 8;
  for (let k = 0; k < steps; k++) out.push({ t: barAt(bar) + from + k * 0.125, d: 0.125, m, v: 0.25 + (0.5 * k) / steps, gate: 1 });
  return out;
}

function fill(bar: number, m: number, pattern = 'x.x.xxxx', vel = 0.6): NoteEv[] {
  // Remplissage sur le dernier temps et demi (doubles croches).
  return rhythm(pattern.padStart(16, '.'), { bars: 1, at: barAt(bar), m, vel }).map((e, k) => ({ ...e, v: Math.min(1, e.v * (0.8 + 0.06 * k)) }));
}

// ------------------------------------------------------------------------------------------------
// combat : ré mineur
// ------------------------------------------------------------------------------------------------

const C1 = prog(
  `Dm | Dm | Bb | C | Dm | Dm | Gm | A |
   Bb | C | Dm | Dm | Bb | C | Gm | A |
   Dm | Bb | F | C | Gm | Bb | Asus4 | A`,
  BPB,
);

const C1_A = `D5:1.5 C5:.5 D5:1 A4 | F4:.5 G4 A4:1 D5:2 | D5:1.5 C5:.5 Bb4:1 F4 | G4:.5 A4 Bb4:1 C5:2 |
  D5:1.5 C5:.5 D5:1 F5 | E5:.5 D5 C5:1 A4:2 | Bb4:1.5 A4:.5 G4:1 Bb4 | A4:1 C#5 E5:2 |`;
const C1_B = `F5:2 D5:1 F5 | G5:2 E5:1 C5 | A5:1.5 G5:.5 F5:1 E5 | D5:3 r:1 |
  F5:2 D5:1 F5 | G5:1.5 A5:.5 Bb5:1 C6 | D6:1.5 C6:.5 Bb5:1 G5 | A5:2 C#5:1 E5 |`;
const C1_C = `r:1 D5:.5 D5 F5:1 A5 | G5:1.5 F5:.5 D5:2 | r:1 C5:.5 C5 F5:1 A5 | G5:1.5 E5:.5 C5:2 |
  r:1 Bb4:.5 Bb4 D5:1 G5 | F5:1.5 D5:.5 Bb4:2 | A4:1 D5 E5:2 | C#5:2 E5:1 A5 |`;

function c1Base(): TrackDef[] {
  const h = C1;
  const ost = bassPart(h, { low: n('A2'), pattern: OSTINATO_332, vel: 0.68, gate: 0.6 });
  const pad = padPart(h, { voices: 3, low: n('D3'), high: n('A4'), vel: 0.32, overlap: 0.2, holdCommon: true });
  const basses = bassPart(h, { low: n('D2'), pattern: 'R:4', vel: 0.5, gate: 1.02 });
  const sub = bassPart(h, { low: n('D1'), pattern: 'R:2 R:2', vel: 0.45, gate: 1.02 });
  const pulse = rhythm('X.......x.......', { bars: 24, m: n('D2'), vel: 0.5 });
  const clk = clock({ bars: 24, beatsPerBar: BPB, vel: 0.26, sub: 2, pitch: 74 });
  return [
    { name: 'ostinato spiccato', inst: I.spiccato, notes: ost, gain: -1, pan: -0.15, spread: 0.1, rev: 0.2, eq: [{ type: 'highpass', f: 70 }, { type: 'peak', f: 2500, q: 1, g: -2 }] },
    { name: 'nappe cordes', inst: I.stringsPad, notes: pad, gain: -12, spread: 0.3, rev: 0.3, eq: PAD_EQ, chorus: { mix: 0.3 }, width: 1.2 },
    { name: 'contrebasses', inst: I.lowStrings, notes: basses, gain: -9, rev: 0.15, eq: BASS_EQ },
    { name: 'sub', inst: I.subBass, notes: sub, gain: -21, eq: [{ type: 'lowpass', f: 130 }] },
    { name: 'pulsation taiko', inst: I.taikoBig, notes: pulse, gain: -7, rev: 0.22, eq: PERC_EQ },
    { name: 'tic', inst: I.tick, notes: clk.tick, gain: -8, pan: 0.3, rev: 0.15, humanize: 0.0008 },
    { name: 'tac', inst: I.tock, notes: clk.tock, gain: -8, pan: -0.3, rev: 0.15, humanize: 0.0008 },
  ];
}

function c1Drive(): TrackDef[] {
  const h = C1;
  const a = mel(C1_A, { at: barAt(1), vel: 0.8 });
  const b = mel(C1_B, { at: barAt(9), vel: 0.78 });
  const c = mel(C1_C, { at: barAt(17), vel: 0.82 });
  const hornsLine = [...a, ...b.map((e) => ({ ...e, m: e.m - 12 })), ...c.map((e) => ({ ...e, m: e.m - 12 }))];
  const violins = [...b, ...c];
  const violOst = arpPart(between(h, 1, 8), { pattern: [0, 1, 2, 1, 3, 1, 2, 1], step: 0.5, from: n('A4'), vel: 0.42, gate: 0.5 });
  const choir = padPart(between(h, 9, 24), { voices: 4, low: n('D4'), high: n('A5'), vel: 0.5, overlap: 0.3, holdCommon: true });
  const stabs = padPart(between(h, 17, 24), { voices: 4, low: n('D4'), high: n('G5'), vel: 0.7, restrike: 4, overlap: 0 }).map((e) => ({ ...e, d: 0.5, gate: 0.6 }));
  const hats = rhythm('x.x.x.x.x.x.x.xo', { bars: 24, m: 60, vel: 0.4 });
  const frame = rhythm('....X.......X...', { bars: 24, m: n('D3'), vel: 0.5 });
  return [
    { name: 'cors', inst: I.horns, notes: hornsLine, gain: -3, pan: 0.2, rev: 0.32, eq: [{ type: 'highpass', f: 120 }, { type: 'lowpass', f: 5000 }] },
    { name: 'violons', inst: I.stringsLead, notes: violins, gain: -6, pan: -0.25, spread: 0.05, rev: 0.32, eq: LEAD_EQ, chorus: { mix: 0.25 } },
    { name: 'violons ostinato', inst: I.spiccato, notes: violOst, gain: -5, pan: -0.35, rev: 0.25, eq: [{ type: 'highpass', f: 250 }] },
    { name: 'chœur', inst: I.choir('a'), notes: choir, gain: -14, spread: 0.4, rev: 0.4, eq: PAD_EQ, chorus: { mix: 0.3 } },
    { name: 'cuivres staccato', inst: I.brassStab, notes: stabs, gain: -8, pan: 0.1, spread: 0.2, rev: 0.3, eq: [{ type: 'highpass', f: 150 }] },
    { name: 'charleston', inst: I.hat, notes: hats, gain: -9, pan: 0.35, rev: 0.12 },
    { name: 'tambour', inst: I.frameDrum, notes: frame, gain: -3, pan: -0.1, rev: 0.22, eq: PERC_EQ },
  ];
}

function c1Perc(): TrackDef[] {
  const big = rhythm('X..x..x.X..x..x.', { bars: 24, m: n('D2'), vel: 0.62 });
  const mid: NoteEv[] = [...rhythm('....x.......x.x.', { bars: 24, m: n('A2'), vel: 0.5 })];
  for (const b of [4, 8, 12, 16, 20, 24]) mid.push(...fill(b, n('B2'), 'x.xxx.xx', 0.55));
  const shime = rhythm('X.x.x.x.X.x.x.xx', { bars: 24, m: n('A4'), vel: 0.4 });
  const timp: NoteEv[] = [];
  for (const [bar, note] of [[1, 'D2'], [5, 'D2'], [9, 'Bb2'], [13, 'Bb2'], [17, 'D2'], [21, 'G2']] as const) timp.push({ t: barAt(bar), d: 2, m: n(note), v: 0.75 });
  timp.push(...timpaniRoll(8, n('A2')), ...timpaniRoll(16, n('A2')), ...timpaniRoll(24, n('A2')));
  const crash: NoteEv[] = [1, 9, 17].map((b) => ({ t: barAt(b), d: 1, m: 60, v: 0.6 }));
  const swells: NoteEv[] = [8, 16, 24].map((b) => ({ t: barAt(b), d: 4, m: 60, v: 0.6 }));
  return [
    { name: 'ō-daiko', inst: I.taikoBig, notes: big, gain: -4, rev: 0.25, eq: PERC_EQ },
    { name: 'nagadō', inst: I.taikoMid, notes: mid, gain: -6, pan: 0.2, spread: 0.15, rev: 0.25, eq: PERC_EQ },
    { name: 'shime', inst: I.taikoHigh, notes: shime, gain: -4, pan: -0.3, rev: 0.2 },
    { name: 'timbales', inst: I.timpani, notes: timp, gain: -4, pan: -0.1, rev: 0.3, eq: PERC_EQ },
    { name: 'cymbales', inst: I.cymbal, notes: crash, gain: -11, pan: 0.25, rev: 0.3 },
    { name: 'montées', inst: I.swell, notes: swells, gain: -11, pan: -0.25, rev: 0.25 },
  ];
}

export const combat: SongDef = {
  id: 'combat',
  title: 'La Convergence',
  description: 'Combat — ré mineur, ostinato 3-3-2, cors ; stems base + drive + perc.',
  bpm: 128,
  beatsPerBar: BPB,
  bars: 24,
  loop: true,
  tail: 5,
  seed: 4409,
  reverb: { rt60: 2.1, damping: 7500, preDelay: 0.015, size: 1, lowCut: 220 },
  stems: [
    { name: 'base', minIntensity: 0, tracks: c1Base },
    { name: 'drive', minIntensity: 1, tracks: c1Drive },
    { name: 'perc', minIntensity: 2, tracks: c1Perc },
  ],
  master: { lufs: -15, levels: [-17.5, -16, -15], eq: MASTER_EQ, comp: GLUE_HARD },
};

// ------------------------------------------------------------------------------------------------
// combat2 : la mineur / phrygien
// ------------------------------------------------------------------------------------------------

const C2 = prog(
  `Am | F | G | Em | Am | F | Dm | E |
   F | G | Am | Am | F | G | Bb | E |
   Dm | Am | Bb | F | Dm | E | F | E`,
  BPB,
);

const C2_A = `E5:1 A4:.5 B4 C5:1 E5 | F5:1.5 E5:.5 C5:2 | D5:1 G4:.5 A4 B4:1 D5 | E5:1.5 D5:.5 B4:2 |
  E5:1 A4:.5 B4 C5:1 E5 | A5:1.5 G5:.5 F5:1 C5 | D5:1 F5 A5 F5 | E5:2 G#4:2 |`;
const C2_B = `C6:2 A5:1 F5 | B5:2 G5:1 D5 | C6:1.5 B5:.5 A5:1 E5 | A5:3 r:1 |
  A5:1 C6 A5 F5 | G5:1 B5 D6 B5 | D6:1.5 C6:.5 Bb5:1 F5 | G#5:2 B5:2 |`;
const C2_C = `r:1 A4:.5 A4 D5:1 F5 | E5:2 C5:2 | r:1 Bb4:.5 Bb4 D5:1 F5 | A5:2 F5:2 |
  D5:1 F5 A5 D6 | B5:1.5 G#5:.5 E5:2 | C6:1.5 A5:.5 F5:1 A5 | G#5:2 B5:1 E5 |`;

function c2Base(): TrackDef[] {
  const h = C2;
  const bass = bassPart(h, { low: n('E2'), pattern: "R:.75> R:.75 8:.5' R:.75> 5:.75 8:.5'", vel: 0.7 });
  const celli = arpPart(h, { pattern: [0, 2, 1, 2, 0, 2, 1, 3], step: 0.5, from: n('A2'), vel: 0.5, gate: 0.55, accents: [1.2, 0.8, 0.9, 0.8, 1.1, 0.8, 0.9, 0.85] });
  const pad = padPart(h, { voices: 3, low: n('C3'), high: n('G4'), vel: 0.3, overlap: 0.2, holdCommon: true });
  const sub = bassPart(h, { low: n('E1'), pattern: 'R:4', vel: 0.42, gate: 1.02 });
  const pulse = rhythm('X......x..X.....', { bars: 24, m: n('C2'), vel: 0.5 });
  const clk = clock({ bars: 24, beatsPerBar: BPB, vel: 0.25, sub: 2, pitch: 70 });
  return [
    { name: 'basse pincée', inst: I.pluckBass, notes: bass, gain: -8, pan: 0.05, rev: 0.12, eq: BASS_EQ },
    { name: 'violoncelles', inst: I.spiccato, notes: celli, gain: 1, pan: -0.2, spread: 0.1, rev: 0.2, eq: [{ type: 'highpass', f: 80 }, { type: 'peak', f: 2500, q: 1, g: -2 }] },
    { name: 'nappe cordes', inst: I.stringsPad, notes: pad, gain: -12, spread: 0.3, rev: 0.3, eq: PAD_EQ, chorus: { mix: 0.3 }, width: 1.2 },
    { name: 'sub', inst: I.subBass, notes: sub, gain: -21, eq: [{ type: 'lowpass', f: 130 }] },
    { name: 'pulsation taiko', inst: I.taikoBig, notes: pulse, gain: -7, rev: 0.22, eq: PERC_EQ },
    { name: 'tic', inst: I.tick, notes: clk.tick, gain: -8, pan: 0.3, rev: 0.15, humanize: 0.0008 },
    { name: 'tac', inst: I.tock, notes: clk.tock, gain: -8, pan: -0.3, rev: 0.15, humanize: 0.0008 },
  ];
}

function c2Drive(): TrackDef[] {
  const h = C2;
  const a = mel(C2_A, { at: barAt(1), vel: 0.8 });
  const b = mel(C2_B, { at: barAt(9), vel: 0.78 });
  const c = mel(C2_C, { at: barAt(17), vel: 0.82 });
  const horns = [...a, ...b.map((e) => ({ ...e, m: e.m - 12 })), ...c.map((e) => ({ ...e, m: e.m - 12, v: e.v * 0.9 }))];
  const violins = [...b, ...c];
  const trem = padPart(between(h, 1, 8), { voices: 3, low: n('A4'), high: n('E5'), vel: 0.38, overlap: 0.1, holdCommon: true });
  const choir = padPart(between(h, 9, 24), { voices: 4, low: n('C4'), high: n('G5'), vel: 0.48, overlap: 0.3, holdCommon: true });
  const hats = rhythm('xoxox.xoxoxox.xo', { bars: 24, m: 60, vel: 0.36 });
  const frame = rhythm('....X.......X..o', { bars: 24, m: n('C3'), vel: 0.5 });
  const flute = window(double(a, 12, 0.6), barAt(1), barAt(9)).filter((e) => e.m > n('B5'));
  return [
    { name: 'cors', inst: I.horns, notes: horns, gain: -3, pan: 0.2, rev: 0.32, eq: [{ type: 'highpass', f: 120 }, { type: 'lowpass', f: 5000 }] },
    { name: 'violons', inst: I.stringsLead, notes: violins, gain: -6, pan: -0.25, rev: 0.32, eq: LEAD_EQ, chorus: { mix: 0.25 } },
    { name: 'trémolo', inst: I.tremolo, notes: trem, gain: -13, pan: -0.3, spread: 0.3, rev: 0.3, eq: PAD_EQ },
    { name: 'chœur', inst: I.choir('o'), notes: choir, gain: -16, spread: 0.4, rev: 0.4, eq: PAD_EQ, chorus: { mix: 0.3 } },
    { name: 'flûte', inst: I.flute, notes: flute, gain: -12, pan: 0.3, rev: 0.35, eq: LEAD_EQ },
    { name: 'charleston', inst: I.hat, notes: hats, gain: -10, pan: 0.35, rev: 0.12 },
    { name: 'tambour', inst: I.frameDrum, notes: frame, gain: -7, pan: -0.1, rev: 0.22, eq: PERC_EQ },
  ];
}

function c2Perc(): TrackDef[] {
  const big = rhythm('X..x..x...x.x...', { bars: 24, m: n('C2'), vel: 0.62 });
  const mid: NoteEv[] = [...rhythm('..x.....x.....x.', { bars: 24, m: n('G2'), vel: 0.5 })];
  for (const b of [4, 8, 12, 16, 20, 24]) mid.push(...fill(b, n('A2'), 'xxx.x.xx', 0.55));
  const shime = rhythm('x.xxx.xxx.xxx.xx', { bars: 24, m: n('G4'), vel: 0.34 });
  const timp: NoteEv[] = [];
  for (const [bar, note] of [[1, 'A2'], [5, 'A2'], [9, 'F2'], [13, 'F2'], [17, 'D2'], [21, 'D2']] as const) timp.push({ t: barAt(bar), d: 2, m: n(note), v: 0.75 });
  timp.push(...timpaniRoll(8, n('E2')), ...timpaniRoll(16, n('E2')), ...timpaniRoll(24, n('E2')));
  const crash: NoteEv[] = [1, 9, 17].map((b) => ({ t: barAt(b), d: 1, m: 60, v: 0.6 }));
  const swells: NoteEv[] = [8, 16, 24].map((b) => ({ t: barAt(b), d: 4, m: 60, v: 0.6 }));
  return [
    { name: 'ō-daiko', inst: I.taikoBig, notes: big, gain: -4, rev: 0.25, eq: PERC_EQ },
    { name: 'nagadō', inst: I.taikoMid, notes: mid, gain: -6, pan: -0.2, spread: 0.15, rev: 0.25, eq: PERC_EQ },
    { name: 'shime', inst: I.taikoHigh, notes: shime, gain: -5, pan: 0.3, rev: 0.2 },
    { name: 'timbales', inst: I.timpani, notes: timp, gain: -10, pan: 0.1, rev: 0.3, eq: PERC_EQ },
    { name: 'cymbales', inst: I.cymbal, notes: crash, gain: -11, pan: -0.25, rev: 0.3 },
    { name: 'montées', inst: I.swell, notes: swells, gain: -11, pan: 0.25, rev: 0.25 },
  ];
}

export const combat2: SongDef = {
  id: 'combat2',
  title: 'Éclipse des Rouages',
  description: 'Combat (variation) — la mineur phrygien, basse syncopée ; stems base + drive + perc.',
  bpm: 132,
  beatsPerBar: BPB,
  bars: 24,
  loop: true,
  tail: 5,
  seed: 4523,
  reverb: { rt60: 2.0, damping: 7500, preDelay: 0.015, size: 1, lowCut: 220 },
  stems: [
    { name: 'base', minIntensity: 0, tracks: c2Base },
    { name: 'drive', minIntensity: 1, tracks: c2Drive },
    { name: 'perc', minIntensity: 2, tracks: c2Perc },
  ],
  master: { lufs: -15, levels: [-17.5, -16, -15], eq: MASTER_EQ, comp: GLUE_HARD },
};
