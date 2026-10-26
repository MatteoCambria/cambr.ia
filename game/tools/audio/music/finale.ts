/**
 * Moments décisifs et conclusions :
 *   decisive — « Le Cœur-Horloge s'éveille » : manche finale, ré mineur héroïque, 108 bpm,
 *              24 mesures (≈ 53 s), le motif de l'Horloge en mineur au chœur et aux cuivres ;
 *   victory  — « Aube sur les Sphères » : jingle de victoire (≈ 16 s), le motif en ré majeur, cadence
 *              ♭VI – ♭VII – I (si♭ – do – ré) avec un mi lydien sur si♭ ;
 *   defeat   — « Le Ressort s'épuise » : jingle de défaite (≈ 17 s), la boîte à musique ralentit
 *              comme un ressort qui se détend, le tic-tac s'arrête.
 */
import type { SongDef, TrackDef } from '../engine';
import { ritardando } from '../engine';
import * as I from '../instruments';
import { mel, prog, padPart, bassPart, arpPart, rhythm, double, type NoteEv, type ChordSpan } from '../seq/sequencer';
import { noteToMidi as n } from '../seq/theory';
import { PAD_EQ, LEAD_EQ, BASS_EQ, BELL_EQ, PERC_EQ, MASTER_EQ, GLUE, GLUE_HARD, clock, barAt } from './common';

const BPB = 4;
const between = (h: ChordSpan[], a: number, b: number): ChordSpan[] => h.filter((s) => s.t >= barAt(a) - 1e-9 && s.t < barAt(b + 1) - 1e-9);

// ------------------------------------------------------------------------------------------------
// decisive
// ------------------------------------------------------------------------------------------------

const D = prog(
  `Dm | Bb | Gm | A | Dm | Bb | Gm | A |
   F | C | Dm | Bb | F | C | Bb | A |
   Dm | Bb | C | A/C# | Dm | Bb | Gm | A`,
  BPB,
);

const D_A = `A4:1.5 G4:.5 A4:1 D5 | Bb4:1.5 C5:.5 D5:1 Bb4 | G4:1.5 Bb4:.5 D5:1 G5 | E5:1.5 D5:.5 C#5:2 |
  A4:1.5 G4:.5 A4:1 D5 | F5:1.5 E5:.5 D5:1 Bb4 | G5:1.5 F5:.5 E5:1 D5 | C#5:2 E5:1 A5 |`;
const D_B = `A5:2 C6:1 A5 | G5:2 E5:1 G5 | F5:1.5 E5:.5 D5:1 A5 | Bb5:3 A5:.5 G5 |
  A5:2 C6:1 F6 | E6:1.5 D6:.5 C6:1 G5 | D6:1.5 C6:.5 Bb5:1 F5 | E5:2 C#6:2 |`;
const D_C = `D6:1.5 C6:.5 D6:1 A5 | F5:1 Bb5 D6:2 | E6:1.5 D6:.5 C6:1 G5 | A5:2 E5:2 |
  A5:1.5 G5:.5 A5:1 D6 | Bb5:1.5 C6:.5 D6:1 F5 | G5:1.5 Bb5:.5 D6:1 Bb5 | A5:2 C#5:1 E5 |`;

function decisiveTracks(): TrackDef[] {
  const h = D;
  const a = mel(D_A, { at: barAt(1), vel: 0.78 });
  const b = mel(D_B, { at: barAt(9), vel: 0.8 });
  const c = mel(D_C, { at: barAt(17), vel: 0.86 });
  const choirA = a.map((e) => ({ ...e, v: e.v * 0.9 }));
  const horns = [...a.map((e) => ({ ...e, m: e.m - 12 })), ...b.map((e) => ({ ...e, m: e.m - 12 })), ...c.map((e) => ({ ...e, m: e.m - 12 }))];
  const violins = [...b, ...c];
  const ost = bassPart(h, { low: n('A2'), pattern: "R:.5> R:.5_ 8:.5 R:.5_ R:.5> 5:.5 8:.5 R:.5_", vel: 0.62, gate: 0.6 });
  const gears = arpPart(between(h, 17, 24), { pattern: [0, 1, 2, 3, 2, 1, 2, 3], step: 0.25, from: n('D5'), vel: 0.34 });
  const pad = padPart(h, { voices: 4, low: n('D3'), high: n('D5'), vel: 0.45, overlap: 0.25, holdCommon: true });
  const choirPad = padPart(between(h, 9, 24), { voices: 4, low: n('D4'), high: n('A5'), vel: 0.55, overlap: 0.3, holdCommon: true });
  const basses = bassPart(h, { low: n('D2'), pattern: 'R:2 R:2', vel: 0.6, gate: 1.02 });
  const sub = bassPart(h, { low: n('D1'), pattern: 'R:4', vel: 0.45, gate: 1.02 });
  const taikoBig = rhythm('X.......X.....x.', { bars: 24, m: n('D2'), vel: 0.62 });
  const taikoMid = rhythm('....x.......x.x.', { bars: 24, m: n('A2'), vel: 0.42 }).filter((e) => e.t >= barAt(9));
  const timp: NoteEv[] = [];
  for (let bar = 1; bar <= 24; bar += 2) timp.push({ t: barAt(bar), d: 2, m: bar % 4 === 1 ? n('D2') : n('A2'), v: 0.7 });
  for (const bar of [8, 16, 24]) for (let k = 0; k < 16; k++) timp.push({ t: barAt(bar) + 2 + k * 0.125, d: 0.125, m: n('A2'), v: 0.3 + 0.03 * k });
  const crash: NoteEv[] = [1, 9, 17].map((bar) => ({ t: barAt(bar), d: 1, m: 60, v: 0.6 }));
  const swells: NoteEv[] = [8, 16, 24].map((bar) => ({ t: barAt(bar), d: 4, m: 60, v: 0.65 }));
  const bells: NoteEv[] = [1, 9, 17].map((bar) => ({ t: barAt(bar), d: 4, m: bar === 9 ? n('F3') : n('D3'), v: 0.45 }));
  const clk = clock({ bars: 24, beatsPerBar: BPB, vel: 0.26, sub: 2, pitch: 70 });
  const gong: NoteEv[] = [{ t: barAt(17), d: 4, m: n('D2'), v: 0.6 }];
  return [
    { name: 'chœur motif', inst: I.choir('a'), notes: choirA, gain: -4, spread: 0.3, rev: 0.45, eq: PAD_EQ, chorus: { mix: 0.3 } },
    { name: 'cors', inst: I.horns, notes: horns, gain: -1, pan: 0.2, rev: 0.38, eq: [{ type: 'highpass', f: 110 }, { type: 'lowpass', f: 5000 }] },
    { name: 'violons', inst: I.stringsLead, notes: violins, gain: -6, pan: -0.25, rev: 0.36, eq: LEAD_EQ, chorus: { mix: 0.25 } },
    { name: 'engrenages', inst: I.celesta, notes: gears, gain: -20, pan: 0.4, rev: 0.3, eq: BELL_EQ },
    { name: 'ostinato', inst: I.spiccato, notes: ost, gain: -1, pan: -0.15, rev: 0.22, eq: [{ type: 'highpass', f: 70 }, { type: 'peak', f: 2500, q: 1, g: -2 }] },
    { name: 'nappe cordes', inst: I.stringsPad, notes: pad, gain: -13, spread: 0.3, rev: 0.38, eq: PAD_EQ, chorus: { mix: 0.3 }, width: 1.2 },
    { name: 'chœur tutti', inst: I.choir('o'), notes: choirPad, gain: -14, spread: 0.4, rev: 0.45, eq: PAD_EQ, chorus: { mix: 0.3 } },
    { name: 'contrebasses', inst: I.lowStrings, notes: basses, gain: -8, rev: 0.2, eq: BASS_EQ },
    { name: 'sub', inst: I.subBass, notes: sub, gain: -21, eq: [{ type: 'lowpass', f: 130 }] },
    { name: 'ō-daiko', inst: I.taikoBig, notes: taikoBig, gain: -4, rev: 0.28, eq: PERC_EQ },
    { name: 'nagadō', inst: I.taikoMid, notes: taikoMid, gain: -8, pan: 0.2, rev: 0.28, eq: PERC_EQ },
    { name: 'timbales', inst: I.timpani, notes: timp, gain: -7, pan: -0.1, rev: 0.32, eq: PERC_EQ },
    { name: 'cymbales', inst: I.cymbal, notes: crash, gain: -11, pan: 0.25, rev: 0.3 },
    { name: 'montées', inst: I.swell, notes: swells, gain: -11, pan: -0.25, rev: 0.25 },
    { name: 'cloches', inst: I.bell, notes: double(bells, 12, 0.3), gain: -6, rev: 0.45, eq: BELL_EQ },
    { name: 'tam-tam', inst: I.gong, notes: gong, gain: -4, rev: 0.4 },
    { name: 'tic', inst: I.tick, notes: clk.tick, gain: -8, pan: 0.3, rev: 0.2, humanize: 0.0008 },
    { name: 'tac', inst: I.tock, notes: clk.tock, gain: -8, pan: -0.3, rev: 0.2, humanize: 0.0008 },
  ];
}

export const decisive: SongDef = {
  id: 'decisive',
  title: "Le Cœur-Horloge s'éveille",
  description: 'Manche décisive — ré mineur héroïque, chœur, cuivres, taikos, timbales.',
  bpm: 108,
  beatsPerBar: BPB,
  bars: 24,
  loop: true,
  tail: 6,
  seed: 5501,
  reverb: { rt60: 2.8, damping: 7000, preDelay: 0.02, size: 1.2, lowCut: 200 },
  stems: [{ name: 'main', minIntensity: 0, tracks: decisiveTracks }],
  master: { lufs: -15, eq: MASTER_EQ, comp: GLUE_HARD },
};

// ------------------------------------------------------------------------------------------------
// victory
// ------------------------------------------------------------------------------------------------

const V = prog(`D | G | Bb | C | D | D`, BPB);
const V_MEL = `A4:1.5 G4:.5 A4:1 D5 | B4:1.5 C#5:.5 D5:1 G5 | F5:1.5 E5:.5 D5:1 F5 | G5:1.5 F5:.5 E5:1 G5 | F#5:4 | r:4 |`;

function victoryTracks(): TrackDef[] {
  const h = V;
  const m = mel(V_MEL, { at: 0, vel: 0.85 });
  const last = m[m.length - 1];
  last.d = 7.5;
  // Accord final tenu : toutes les voix finales résonnent jusqu'au 4e temps de la 6e mesure.
  const END = barAt(7) + 1.5;
  const sustainToEnd = (evs: NoteEv[]): NoteEv[] => evs.map((e) => (e.t >= barAt(5) ? { ...e, d: Math.max(e.d, END - e.t), gate: 1 } : e));
  const pad = sustainToEnd(padPart(h, { voices: 5, low: n('D3'), high: n('A5'), vel: 0.6, overlap: 0.2, holdCommon: true }));
  const choir = sustainToEnd(padPart(h.slice(4), { voices: 4, low: n('D4'), high: n('A5'), vel: 0.6, overlap: 2, holdCommon: true }));
  const bass = sustainToEnd(bassPart(h, { low: n('D2'), pattern: 'R:4', vel: 0.65, gate: 1.02 }));
  // Le Cœur-Horloge repart : tic-tac doux sous l'accord final.
  const restart = clock({ bars: 2, beatsPerBar: BPB, at: barAt(6), vel: 0.22, sub: 1 });
  const harp = arpPart(h.slice(0, 4), { pattern: [0, 1, 2, 3, 4, 5, 6, 7], step: 0.25, from: n('D3'), vel: 0.42 });
  const gliss: NoteEv[] = [];
  const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
  steps.forEach((iv, k) => gliss.push({ t: barAt(5) + k * 0.18, d: 3, m: n('D4') + iv, v: 0.35 + 0.02 * k, gate: 1 }));
  const sparkle: NoteEv[] = mel('A5:.5 D6 F#6 A6 D7:2 | F#6:.5 A6 D7 F#7 A7:2 |', { at: barAt(5), vel: 0.4 });
  const timp: NoteEv[] = [
    { t: 0, d: 2, m: n('D2'), v: 0.8 },
    { t: barAt(3), d: 2, m: n('Bb2'), v: 0.7 },
    { t: barAt(4), d: 2, m: n('C3'), v: 0.75 },
  ];
  for (let k = 0; k < 16; k++) timp.push({ t: barAt(4) + 2 + k * 0.125, d: 0.125, m: n('A2'), v: 0.35 + 0.035 * k });
  timp.push({ t: barAt(5), d: 4, m: n('D2'), v: 0.95 });
  const taiko: NoteEv[] = [{ t: 0, d: 1, m: n('D2'), v: 0.7 }, { t: barAt(5), d: 1, m: n('D2'), v: 0.95 }];
  const bells: NoteEv[] = [{ t: barAt(5), d: 6, m: n('D3'), v: 0.6 }, { t: barAt(5), d: 6, m: n('A3'), v: 0.35 }];
  return [
    { name: 'cors', inst: I.horns, notes: m.map((e) => ({ ...e, m: e.m - 12 })), gain: 0, pan: 0.2, rev: 0.4, eq: [{ type: 'highpass', f: 110 }, { type: 'lowpass', f: 5500 }] },
    { name: 'violons', inst: I.stringsLead, notes: m, gain: -5, pan: -0.2, rev: 0.4, eq: LEAD_EQ, chorus: { mix: 0.25 } },
    { name: 'célesta', inst: I.celesta, notes: [...m.map((e) => ({ ...e, m: e.m + 12, v: e.v * 0.6 })), ...sparkle], gain: -13, pan: 0.35, rev: 0.4, eq: BELL_EQ },
    { name: 'harpe', inst: I.harp, notes: [...harp, ...gliss], gain: -7, pan: -0.35, spread: 0.2, rev: 0.4, eq: [{ type: 'highpass', f: 100 }] },
    { name: 'nappe cordes', inst: I.stringsPad, notes: pad, gain: -12, spread: 0.3, rev: 0.45, eq: PAD_EQ, chorus: { mix: 0.3 }, width: 1.2 },
    { name: 'chœur', inst: I.choir('a'), notes: choir, gain: -8, spread: 0.4, rev: 0.5, eq: PAD_EQ, chorus: { mix: 0.3 } },
    { name: 'contrebasses', inst: I.lowStrings, notes: bass, gain: -7, rev: 0.25, eq: BASS_EQ },
    { name: 'timbales', inst: I.timpani, notes: timp, gain: -8, rev: 0.35, eq: PERC_EQ },
    { name: 'taiko', inst: I.taikoBig, notes: taiko, gain: -6, rev: 0.35, eq: PERC_EQ },
    { name: 'cymbale', inst: I.cymbal, notes: [{ t: barAt(5), d: 1, m: 60, v: 0.7 }], gain: -10, rev: 0.4 },
    { name: 'montée', inst: I.swell, notes: [{ t: barAt(4), d: 4, m: 60, v: 0.6 }], gain: -11, rev: 0.3 },
    { name: 'cloches', inst: I.bell, notes: bells, gain: -9, rev: 0.5, eq: BELL_EQ },
    { name: 'tic', inst: I.tick, notes: restart.tick, gain: -10, pan: 0.3, rev: 0.4, humanize: 0.001, accent: 0 },
    { name: 'tac', inst: I.tock, notes: restart.tock, gain: -10, pan: -0.3, rev: 0.4, humanize: 0.001, accent: 0 },
  ];
}

export const victory: SongDef = {
  id: 'victory',
  title: 'Aube sur les Sphères',
  description: 'Victoire — le motif en ré majeur, cadence si♭ – do – ré, cloches et chœur.',
  bpm: 104,
  beatsPerBar: BPB,
  bars: 6,
  loop: false,
  tail: 4.5,
  seed: 6101,
  reverb: { rt60: 3.4, damping: 7500, preDelay: 0.025, size: 1.3, lowCut: 180 },
  stems: [{ name: 'main', minIntensity: 0, tracks: victoryTracks }],
  master: { lufs: -15, eq: MASTER_EQ, comp: GLUE },
};

// ------------------------------------------------------------------------------------------------
// defeat
// ------------------------------------------------------------------------------------------------

const F = prog(`Dm | Bbmaj7 | Gm | Dm`, BPB);
const F_MEL = `A4:1.5 G4:.5 A4:1 D5 | C5:1.5 Bb4:.5 A4:1 F4 | Bb4:1.5 A4:.5 G4:1 E4 | F4:2 D4:2 |`;

function defeatTracks(): TrackDef[] {
  const h = F;
  const box = mel(F_MEL, { at: 0, vel: 0.62 });
  // Le ressort se détend : la dernière note baisse d'un tiers de ton.
  const lastBox = box[box.length - 1];
  lastBox.m -= 0.3;
  lastBox.d = 4;
  const pad = padPart(h.slice(0, 4), { voices: 4, low: n('D3'), high: n('D5'), vel: 0.42, overlap: 0.4, holdCommon: true });
  pad.forEach((e) => {
    if (e.t >= barAt(4)) e.d = 4.5;
  });
  const choir: NoteEv[] = [
    { t: barAt(3), d: 4, m: n('G3'), v: 0.4 },
    { t: barAt(3), d: 4, m: n('D4'), v: 0.35 },
    { t: barAt(4), d: 4.5, m: n('D3'), v: 0.45 },
    { t: barAt(4), d: 4.5, m: n('A3'), v: 0.38 },
    { t: barAt(4), d: 4.5, m: n('F4'), v: 0.32 },
  ];
  const bass = bassPart(h.slice(0, 4), { low: n('D2'), pattern: 'R:4', vel: 0.5, gate: 1.02 });
  bass[bass.length - 1].d = 4.5;
  // Tic-tac qui ralentit puis s'arrête au 3e temps de la 4e mesure.
  const clk = clock({ bars: 4, beatsPerBar: BPB, vel: 0.3, sub: 1 });
  const stop = barAt(4) + 2;
  const tick = clk.tick.filter((e) => e.t <= stop);
  const tock = clk.tock.filter((e) => e.t <= stop);
  const harp = arpPart(h.slice(0, 3), { pattern: [0, 2, 4, 2], step: 1, from: n('D3'), vel: 0.32 });
  const gong: NoteEv[] = [{ t: barAt(4), d: 4, m: n('D2'), v: 0.42 }];
  return [
    { name: 'boîte à musique', inst: I.musicBox, notes: box.map((e) => ({ ...e, m: e.m + 12 })), gain: -2, pan: 0.1, rev: 0.45, eq: BELL_EQ },
    { name: 'violoncelle', inst: I.celli, notes: box.slice(-6).map((e) => ({ ...e, m: e.m - 12, v: 0.45 })), gain: -11, pan: -0.25, rev: 0.4, eq: [{ type: 'highpass', f: 70 }, { type: 'lowpass', f: 3000 }] },
    { name: 'nappe cordes', inst: I.stringsPad, notes: pad, gain: -9, spread: 0.3, rev: 0.45, eq: PAD_EQ, chorus: { mix: 0.3 }, width: 1.2 },
    { name: 'chœur', inst: I.choir('u'), notes: choir, gain: -8, spread: 0.3, rev: 0.5, eq: PAD_EQ, chorus: { mix: 0.3 } },
    { name: 'contrebasses', inst: I.lowStrings, notes: bass, gain: -8, rev: 0.25, eq: BASS_EQ },
    { name: 'harpe', inst: I.harp, notes: harp, gain: -11, pan: -0.35, rev: 0.4 },
    { name: 'tic', inst: I.tick, notes: tick, gain: -8, pan: 0.3, rev: 0.4, humanize: 0.001 },
    { name: 'tac', inst: I.tock, notes: tock, gain: -8, pan: -0.3, rev: 0.4, humanize: 0.001 },
    { name: 'tam-tam', inst: I.gong, notes: gong, gain: -2, rev: 0.4 },
  ];
}

export const defeat: SongDef = {
  id: 'defeat',
  title: "Le Ressort s'épuise",
  description: 'Défaite — la boîte à musique ralentit, le tic-tac s’arrête ; ré mineur, cadence plagale.',
  bpm: 72,
  beatsPerBar: BPB,
  bars: 4,
  loop: false,
  tail: 3.5,
  seed: 6203,
  tempo: ritardando(72, 50, 4, 16),
  reverb: { rt60: 3.6, damping: 6500, preDelay: 0.03, size: 1.3, lowCut: 180 },
  stems: [{ name: 'main', minIntensity: 0, tracks: defeatTracks }],
  master: { lufs: -17, eq: MASTER_EQ, comp: GLUE },
};

