/**
 * « L'Horloge des Sphères » — thème principal d'Orrhéa (écran titre, crédits).
 * Ré dorien, 88 bpm, 32 mesures (≈ 87 s), bouclable.
 *
 * Forme : Introduction (engrenages de célesta, tic-tac) → A (thème au célesta, harpe, pizzicati)
 * → B (fa lydien : violons, chœur « ou », harpe en doubles croches) → A' (tutti : cors et violons
 * à l'octave, chœur « a », taikos, timbales) → Coda (la boîte à musique se souvient du motif et
 * ramène à l'introduction).
 * Motif-signature (« motif de l'Horloge ») : quinte – quarte – quinte – octave (A G A D), rythme
 * pointé, réutilisé dans tous les morceaux du jeu.
 */
import type { SongDef, TrackDef } from '../engine';
import * as I from '../instruments';
import { mel, prog, padPart, bassPart, arpPart, rhythm, window, ramp, double, type NoteEv } from '../seq/sequencer';
import { noteToMidi as n } from '../seq/theory';
import { PAD_EQ, LEAD_EQ, BASS_EQ, BELL_EQ, PERC_EQ, MASTER_EQ, GLUE, clock, barAt } from './common';

const BPB = 4;

export const HARMONY = prog(
  `Dmadd9 | G/D | Dmadd9 | Asus4 A |
   Dm | G | F | C/E | Dm | G | Bb | A |
   F | G/F | Em7 | Am | F | G/F | Asus4 | A |
   Dm | G | F | C/E | Dm | G | Bb C | Dm |
   Bbadd9 | F/A | Gm7 | Asus4 A`,
  BPB,
);

/** Le motif de l'Horloge et la phrase A (8 mesures). */
export const THEME_A = `A4:1.5 G4:.5 A4:1 D5 | B4:1.5 C5:.5 D5:1 G4 | A4:1 C5 F5:1.5 E5:.5 | D5:.5 C5 G4:1 E4:2 |
  A4:1.5 G4:.5 A4:1 D5 | B4:1.5 C5:.5 D5:1 E5 | F5:1.5 E5:.5 D5:1 Bb4 | C#5:1 E5 A4:2 |`;

const THEME_B = `C5:1 F5 G5 A5 | B5:2 A5:1 G5 | G5:1.5 E5:.5 D5:1 E5 | C5:2 r:1 C5:.5 E5 |
  F5:1 G5:.5 A5 C6:1 A5 | B5:1.5 C6:.5 D6:1 B5 | A5:1.5 G5:.5 E5:1 D5 | E5:2 C#5:1 E5 |`;

const THEME_A2 = `A4:1.5 G4:.5 A4:1 D5 | B4:1.5 C5:.5 D5:1 G4 | A4:1 C5 F5:1.5 E5:.5 | D5:.5 C5 G4:1 E4:2 |
  A4:1.5 G4:.5 A4:1 D5 | B4:1.5 C5:.5 D5:1 E5 | F5:1.5 E5:.5 D5:1 E5 | D5:4 |`;

const CODA = `A4:1.5 G4:.5 A4:1 D5 | C5:4 | Bb4:1.5 A4:.5 G4:1 F4 | E4:4 |`;

const sect = (a: number, b: number) => HARMONY.filter((s) => s.t >= barAt(a) - 1e-9 && s.t < barAt(b + 1) - 1e-9);

function tracks(): TrackDef[] {
  const intro = sect(1, 4);
  const A = sect(5, 12);
  const B = sect(13, 20);
  const A2 = sect(21, 28);
  const coda = sect(29, 32);

  // --- Mélodies ---------------------------------------------------------------------------------
  const themeA = mel(THEME_A, { at: barAt(5), vel: 0.72 });
  const themeB = mel(THEME_B, { at: barAt(13), vel: 0.7 });
  const themeA2 = mel(THEME_A2, { at: barAt(21), vel: 0.82 });
  const coda1 = mel(CODA, { at: barAt(29), vel: 0.6 });

  // Célesta : thème A (doublé à l'octave par la boîte à musique sur la 1re phrase).
  const celestaMel = themeA.map((e) => ({ ...e, m: e.m + 12 }));
  const musicBoxA = window(themeA, barAt(5), barAt(9)).map((e) => ({ ...e, m: e.m + 24, v: e.v * 0.55 }));
  // Flûte : 2e phrase de A.
  const fluteA = window(themeA, barAt(9), barAt(13)).map((e) => ({ ...e, m: e.m + 12, v: e.v * 0.8 }));
  // Engrenages : arpège en croches (cycle de 3 contre 8) — introduction puis contre-chant en A'.
  const gearsIntro = arpPart(intro, { pattern: [0, 3, 1], step: 0.5, from: n('D5'), vel: 0.5, accents: [1.15, 0.8, 0.9, 0.8, 1.05, 0.8, 0.9, 0.8] });
  const gearsA2 = arpPart(A2, { pattern: [0, 3, 1, 4, 2, 3], step: 0.5, from: n('A5'), vel: 0.36, accents: [1.1, 0.8, 0.95, 0.8, 1.05, 0.8, 0.95, 0.8] });
  const gearsCoda = arpPart(coda, { pattern: [0, 3, 1], step: 0.5, from: n('D5'), vel: 0.38 });

  // Harpe : croches brisées (A), doubles croches ascendantes (B), arpèges larges (A').
  const harpA = arpPart(A, { pattern: [0, 2, 4, 2, 1, 3, 5, 3], step: 0.5, from: n('D3'), vel: 0.5, accents: [1.1, 0.85, 0.95, 0.85] });
  const harpB = arpPart(B, { pattern: [0, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1], step: 0.25, from: n('F3'), vel: 0.42, accents: [1.2, 0.8, 0.9, 0.8] });
  const harpA2 = arpPart(A2, { pattern: [0, 2, 4, 6, 7, 6, 4, 2], step: 0.5, from: n('D3'), vel: 0.5 });
  const harpGliss: NoteEv[] = [];
  // Glissando de harpe vers A et vers A'.
  for (const [startBar, from] of [[4, n('A3')], [20, n('E3')]] as const) {
    const ladder = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
    ladder.forEach((iv, k) => harpGliss.push({ t: barAt(startBar) + 2 + k * (2 / ladder.length), d: 1.5, m: from + iv, v: 0.25 + 0.03 * k, gate: 1 }));
  }

  // --- Nappes -----------------------------------------------------------------------------------
  const padIntro = padPart(intro, { voices: 4, low: n('A3'), high: n('E5'), vel: 0.4, overlap: 0.3, holdCommon: true });
  const padA = padPart(A, { voices: 4, low: n('F3'), high: n('D5'), vel: 0.42, overlap: 0.25, holdCommon: true });
  const padB = padPart(B, { voices: 5, low: n('F3'), high: n('C5'), vel: 0.55, overlap: 0.25, holdCommon: true });
  const padA2 = padPart(A2, { voices: 5, low: n('D3'), high: n('C5'), vel: 0.62, overlap: 0.25, holdCommon: true });
  const padCoda = padPart(coda, { voices: 4, low: n('F3'), high: n('C5'), vel: 0.42, overlap: 0.3, holdCommon: true });
  const choirB = padPart(B, { voices: 4, low: n('A3'), high: n('C5'), vel: 0.5, overlap: 0.3, holdCommon: true });
  const choirA2 = padPart(A2, { voices: 4, low: n('D4'), high: n('A5'), vel: 0.62, overlap: 0.4, holdCommon: true });
  const hornsB = padPart(B, { voices: 2, low: n('F3'), high: n('D4'), vel: 0.42, overlap: 0.2, holdCommon: true });

  // --- Basses -----------------------------------------------------------------------------------
  const bassIntro = bassPart(intro, { low: n('D2'), pattern: 'R:4', vel: 0.55, gate: 1.02 });
  const pizzA = bassPart(A, { low: n('D2'), pattern: "R:1 r:.5 5:.5' 8:1 5:1'", vel: 0.62 });
  const bassB = bassPart(B, { low: n('E2'), pattern: 'R:4', vel: 0.6, gate: 1.02 });
  const bassA2 = bassPart(A2, { low: n('D2'), pattern: 'R:2 R:1.5 5:.5', vel: 0.72 });
  const bassCoda = bassPart(coda, { low: n('F2'), pattern: 'R:4', vel: 0.5, gate: 1.02 });
  const subAll = bassPart([...intro, ...A, ...B, ...A2, ...coda], { low: n('D1') + 12, pattern: 'R:4', vel: 0.5, gate: 1.02 });

  // --- Percussions ------------------------------------------------------------------------------
  const clk = clock({ bars: 32, beatsPerBar: BPB, vel: 0.32, sub: 2 });
  const clkTick = clk.tick.filter((e) => !(e.t >= barAt(21) && e.t < barAt(29)) || e.v > 0.2);
  const clkTock = clk.tock.filter((e) => !(e.t >= barAt(21) && e.t < barAt(29)) || e.v > 0.2);
  const taikoBig = rhythm('X.......x.......', { bars: 7, at: barAt(21), m: n('D2'), vel: 0.62 });
  const taikoMid = rhythm('........x.....o.', { bars: 7, at: barAt(21), m: n('A2'), vel: 0.5 });
  const taikoFill = mel('A2:.5 A2 A2:.25 A2 A2 A2 A2:1 A2:1', { at: barAt(28), vel: 0.55 }).map((e, k) => ({ ...e, v: 0.35 + 0.06 * k }));
  const timpRoll: NoteEv[] = [];
  for (let k = 0; k < 16; k++) timpRoll.push({ t: barAt(20) + 2 + k * 0.125, d: 0.125, m: n('A2'), v: 0.25 + 0.035 * k, gate: 1 });
  const timpHits = mel('D2:4 | r:4 | A2:4 | r:4 | D2:4 | r:4 | A2:2 A2:2 | D2:4 |', { at: barAt(21), vel: 0.7 });
  const cymSwell: NoteEv[] = [{ t: barAt(20), d: 4, m: 60, v: 0.6 }];
  const cymCrash: NoteEv[] = [{ t: barAt(21), d: 1, m: 60, v: 0.5 }, { t: barAt(29), d: 1, m: 60, v: 0.25 }];
  const bells: NoteEv[] = [
    { t: barAt(1), d: 4, m: n('D3'), v: 0.42 },
    { t: barAt(13), d: 4, m: n('F3'), v: 0.36 },
    { t: barAt(21), d: 4, m: n('D3'), v: 0.5 },
    { t: barAt(29), d: 4, m: n('Bb2'), v: 0.36 },
  ];
  const glockB = [barAt(13), barAt(15), barAt(17), barAt(19)].map((t) => {
    const e = themeB.find((x) => Math.abs(x.t - t) < 1e-6);
    return { t, d: 2, m: (e?.m ?? n('C5')) + 12, v: 0.32 } as NoteEv;
  });

  return [
    // Lignes mélodiques
    { name: 'célesta thème', inst: I.celesta, notes: celestaMel, gain: -5.5, pan: 0.1, rev: 0.32, dly: 0.12, eq: LEAD_EQ },
    { name: 'boîte à musique', inst: I.musicBox, notes: [...musicBoxA, ...coda1.map((e) => ({ ...e, m: e.m + 12 }))], gain: -2, pan: -0.25, rev: 0.4, dly: 0.2, eq: BELL_EQ },
    { name: 'flûte', inst: I.flute, notes: fluteA, gain: -9, pan: -0.15, rev: 0.35, eq: LEAD_EQ },
    { name: 'violons thème', inst: I.stringsLead, notes: [...themeB, ...themeA2.map((e) => ({ ...e, m: e.m + 12, v: e.v * 0.85 }))], gain: -3.5, pan: -0.2, spread: 0.05, rev: 0.38, eq: LEAD_EQ, chorus: { mix: 0.25, depthMs: 2, rate: 0.3 } },
    { name: 'cors thème', inst: I.horns, notes: [...themeA2, ...hornsB], gain: -0.5, pan: 0.25, rev: 0.42, eq: [{ type: 'highpass', f: 120 }, { type: 'lowpass', f: 4500 }] },
    { name: 'engrenages', inst: I.celesta, notes: [...gearsIntro, ...gearsA2.map((e) => ({ ...e, v: e.v * 0.6 })), ...gearsCoda], gain: -15, pan: 0.35, spread: 0.1, rev: 0.3, dly: 0.25, eq: BELL_EQ },
    { name: 'glockenspiel', inst: I.glock, notes: glockB, gain: -9, pan: 0.3, rev: 0.4, eq: BELL_EQ },
    // Harpe
    { name: 'harpe', inst: I.harp, notes: [...harpA, ...harpB, ...harpA2, ...harpGliss], gain: -7, pan: -0.35, spread: 0.15, rev: 0.32, eq: [{ type: 'highpass', f: 90 }] },
    // Nappes
    { name: 'nappe cordes', inst: I.stringsPad, notes: [...padIntro, ...padA, ...padB, ...padA2, ...padCoda], gain: -10, spread: 0.3, rev: 0.4, eq: PAD_EQ, chorus: { mix: 0.35, depthMs: 3, rate: 0.25 }, width: 1.2 },
    { name: 'chœur', inst: I.choir('u'), notes: choirB, gain: -9.5, spread: 0.4, rev: 0.5, eq: PAD_EQ, chorus: { mix: 0.3 } },
    { name: 'chœur tutti', inst: I.choir('a'), notes: choirA2, gain: -13.5, spread: 0.4, rev: 0.5, eq: PAD_EQ, chorus: { mix: 0.3 } },
    // Basses
    { name: 'contrebasses', inst: I.lowStrings, notes: [...bassIntro, ...bassB, ...bassA2, ...bassCoda], gain: -7.5, pan: 0.05, rev: 0.22, eq: BASS_EQ },
    { name: 'pizzicati', inst: I.pizz, notes: pizzA, gain: 5, pan: 0.15, rev: 0.25, eq: BASS_EQ },
    { name: 'sub', inst: I.subBass, notes: subAll.map((e) => ({ ...e, m: e.m - 12 })), gain: -19, eq: [{ type: 'lowpass', f: 140 }] },
    // Percussions
    { name: 'tic', inst: I.tick, notes: clkTick, gain: -7, pan: 0.3, rev: 0.25, humanize: 0.001 },
    { name: 'tac', inst: I.tock, notes: clkTock, gain: -7, pan: -0.3, rev: 0.25, humanize: 0.001 },
    { name: 'ō-daiko', inst: I.taikoBig, notes: [...taikoBig, ...ramp(taikoFill, barAt(28), barAt(29), 0.8, 1.2)], gain: -8, rev: 0.3, eq: PERC_EQ },
    { name: 'taiko', inst: I.taikoMid, notes: taikoMid, gain: -9, pan: 0.2, rev: 0.3, eq: PERC_EQ },
    { name: 'timbales', inst: I.timpani, notes: [...timpRoll, ...timpHits], gain: -10, pan: -0.1, rev: 0.35, eq: PERC_EQ },
    { name: 'cymbales', inst: I.cymbal, notes: cymCrash, gain: -8, pan: 0.2, rev: 0.35 },
    { name: 'montée', inst: I.swell, notes: cymSwell, gain: -12, pan: -0.2, rev: 0.3 },
    { name: 'cloche', inst: I.bell, notes: double(bells, 12, 0.3), gain: -5, pan: -0.1, rev: 0.45, eq: BELL_EQ },
  ];
}

export const mainTheme: SongDef = {
  id: 'mainTheme',
  title: "L'Horloge des Sphères",
  description: 'Thème principal — ré dorien, célesta, harpe, cordes, chœur, cors, taikos.',
  bpm: 88,
  beatsPerBar: BPB,
  bars: 32,
  loop: true,
  tail: 7,
  seed: 1201,
  reverb: { rt60: 3.2, damping: 7000, preDelay: 0.025, size: 1.2, lowCut: 180 },
  delay: { l: 0.75, r: 1, feedback: 0.3, lowpass: 3800 },
  stems: [{ name: 'main', minIntensity: 0, tracks }],
  master: { lufs: -16, eq: MASTER_EQ, comp: GLUE },
};
