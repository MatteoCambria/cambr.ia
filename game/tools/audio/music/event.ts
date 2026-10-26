/**
 * « Le Manège des Échos » — musique d'événement (carrousel). Valse à 3/4, 144 bpm, 32 mesures
 * (40 s, boucle). Orgue de barbarie et glockenspiel, « oum-pa-pa » de pizzicati et tuba, harpe ;
 * fa lydien (si naturel sur la pédale de fa) avec un pont en si♭.
 */
import type { SongDef, TrackDef } from '../engine';
import * as I from '../instruments';
import { mel, prog, padPart, arpPart, rhythm, chordAt, window, type NoteEv, type ChordSpan } from '../seq/sequencer';
import { noteToMidi as n, voiceChord, pcAtOrAbove } from '../seq/theory';
import { PAD_EQ, LEAD_EQ, BASS_EQ, BELL_EQ, PERC_EQ, MASTER_EQ, GLUE } from './common';

const BPB = 3;
const bar = (k: number): number => (k - 1) * BPB;

const H = prog(
  `F | Fmaj7 | G/F | G/F | Em7 | Am | Dm7 | C |
   F | Fmaj7 | G/F | G/F | Em7 | A7 | Dm | Bb:2 C:1 |
   Bb | C | Am | Dm | Bb | C | Gm7 | C7 |
   F | Fmaj7 | G/F | G/F | Em7 | Am | Bb | C7`,
  BPB,
);

const M_A = `C5:1 F5 A5 | G5:2 E5:1 | B5:1.5 A5:.5 G5:1 | D5:3 | E5:1 G5 B5 | A5:2 E5:1 | F5:1 E5 D5 | G5:2 r:1 |
  C5:1 F5 A5 | C6:2 A5:1 | B5:1.5 C6:.5 D6:1 | B5:3 | G5:1 B5 E6 | C#6:2 A5:1 | D6:1 A5 F5 | D5:2 E5:1 |`;
const M_B = `F5:2 D5:1 | E5:2 C5:1 | A5:1.5 G5:.5 E5:1 | F5:3 | D6:2 Bb5:1 | C6:2 G5:1 | Bb5:1 A5 G5 | E5:1 G5 Bb5 |`;
const M_A3 = `A5:1 F5 C5 | E5:2 F5:1 | G5:1.5 A5:.5 B5:1 | D6:3 | B5:1 G5 E5 | C6:2 A5:1 | D5:1 F5 Bb5 | G5:1 E5 Bb4 |`;

/** Oum-pa-pa : basse au 1er temps (fondamentale / quinte en alternance), accords aux 2e et 3e. */
function waltz(spans: ChordSpan[], totalBars: number): { oom: NoteEv[]; pah: NoteEv[] } {
  const oom: NoteEv[] = [];
  const pah: NoteEv[] = [];
  let prev: number[] | null = null;
  for (let b = 0; b < totalBars * BPB; b++) {
    const ch = chordAt(spans, b + 0.01);
    const pos = b % BPB;
    const barIdx = Math.floor(b / BPB);
    if (pos === 0) {
      const root = pcAtOrAbove(ch.bass, n('E2'));
      const m = barIdx % 2 === 0 ? root : pcAtOrAbove(ch.root, n('E2')) + 7 - (pcAtOrAbove(ch.root, n('E2')) + 7 > n('D3') ? 12 : 0);
      oom.push({ t: b, d: 1, m, v: 0.7, gate: 0.6 });
    } else {
      const v = voiceChord(ch, prev, 3, n('A3'), n('E5'));
      prev = v;
      for (const m of v) pah.push({ t: b, d: 1, m, v: pos === 1 ? 0.55 : 0.45, gate: 0.5 });
    }
  }
  return { oom, pah };
}

function tracks(): TrackDef[] {
  const a = mel(M_A, { at: bar(1), beatsPerBar: BPB, vel: 0.75 });
  const b = mel(M_B, { at: bar(17), beatsPerBar: BPB, vel: 0.7 });
  const a3 = mel(M_A3, { at: bar(25), beatsPerBar: BPB, vel: 0.78 });
  const { oom, pah } = waltz(H, 32);
  const glock = [...window(a, bar(1), bar(2)), ...window(a, bar(9), bar(10)), ...a3].map((e) => ({ ...e, m: e.m + 12, v: e.v * 0.5 }));
  const Bspans = H.filter((s) => s.t >= bar(17) && s.t < bar(25));
  const pad = padPart(Bspans, { voices: 4, low: n('F3'), high: n('D5'), vel: 0.42, overlap: 0.3, holdCommon: true });
  const harp = arpPart(Bspans, { pattern: [0, 2, 4, 6, 4, 2], step: 0.5, from: n('F3'), vel: 0.42, beatsPerBar: BPB });
  const counter = arpPart(H.filter((s) => s.t >= bar(9) && s.t < bar(17)), { pattern: [4, 3, 2, 3, 4, 5], step: 0.5, from: n('F4'), vel: 0.3, beatsPerBar: BPB });
  const tickBeat = rhythm('X..', { bars: 32, m: n('C6'), vel: 0.4, beatsPerBar: BPB });
  const shaker = rhythm('..x.x.', { bars: 32, m: 60, vel: 0.35, beatsPerBar: BPB });
  const frame = rhythm('x..', { bars: 32, m: n('F2'), vel: 0.38, beatsPerBar: BPB }).filter((e) => e.t < bar(17) || e.t >= bar(25));
  const chimes: NoteEv[] = [
    { t: bar(1), d: 3, m: n('F5'), v: 0.4 },
    { t: bar(17), d: 3, m: n('Bb4'), v: 0.35 },
    { t: bar(25), d: 3, m: n('F5'), v: 0.4 },
  ];
  return [
    { name: 'orgue de barbarie', inst: I.barrelOrgan, notes: [...a, ...a3], gain: -1, pan: 0.05, rev: 0.3, eq: [{ type: 'highpass', f: 200 }, { type: 'peak', f: 2500, q: 1, g: -2 }] },
    { name: 'boîte à musique', inst: I.musicBox, notes: b.map((e) => ({ ...e, m: e.m + 12 })), gain: -5, pan: -0.15, rev: 0.4, dly: 0.2, eq: BELL_EQ },
    { name: 'glockenspiel', inst: I.glock, notes: glock, gain: -13, pan: 0.3, rev: 0.35, eq: BELL_EQ },
    { name: 'célesta contre-chant', inst: I.celesta, notes: counter, gain: -20, pan: -0.35, rev: 0.35, eq: BELL_EQ },
    { name: 'tuba', inst: I.tuba, notes: oom, gain: -6, pan: 0, rev: 0.18, eq: BASS_EQ },
    { name: 'pizzicati', inst: I.pizz, notes: [...oom.map((e) => ({ ...e, m: e.m + 12, v: 0.55 })), ...pah], gain: -1, pan: 0.2, spread: 0.2, rev: 0.25, eq: [{ type: 'highpass', f: 90 }] },
    { name: 'nappe cordes', inst: I.stringsPad, notes: pad, gain: -12, spread: 0.3, rev: 0.4, eq: PAD_EQ, chorus: { mix: 0.3 }, width: 1.2 },
    { name: 'harpe', inst: I.harp, notes: harp, gain: -8, pan: -0.3, rev: 0.35 },
    { name: 'tic du manège', inst: I.tick, notes: tickBeat, gain: -9, pan: 0.25, rev: 0.3, humanize: 0.001 },
    { name: 'shaker', inst: I.shaker, notes: shaker, gain: -10, pan: -0.3, rev: 0.2 },
    { name: 'tambour', inst: I.frameDrum, notes: frame, gain: -7, rev: 0.25, eq: PERC_EQ },
    { name: 'carillon', inst: I.chime, notes: chimes, gain: -12, pan: 0.2, rev: 0.45, eq: BELL_EQ },
    { name: 'flûte', inst: I.flute, notes: window(b, bar(21), bar(25)).map((e) => ({ ...e, m: e.m - 12, v: e.v * 0.7 })), gain: -11, pan: 0.3, rev: 0.4, eq: LEAD_EQ },
  ];
}

export const event: SongDef = {
  id: 'event',
  title: 'Le Manège des Échos',
  description: 'Carrousel — valse à 3/4, orgue de barbarie, boîte à musique, oum-pa-pa.',
  bpm: 144,
  beatsPerBar: BPB,
  bars: 32,
  loop: true,
  tail: 5,
  seed: 7303,
  reverb: { rt60: 2.2, damping: 8000, preDelay: 0.02, size: 1, lowCut: 200 },
  delay: { l: 0.5, r: 1, feedback: 0.25, lowpass: 4000 },
  stems: [{ name: 'main', minIntensity: 0, tracks }],
  master: { lufs: -16, eq: MASTER_EQ, comp: GLUE },
};
