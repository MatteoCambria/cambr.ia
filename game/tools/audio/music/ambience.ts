/**
 * « Le Souffle de l'Orrery » — ambiance de l'univers (45 s, boucle) jouable sous les menus.
 * Couches continues strictement périodiques (vent filtré, sifflement, bourdon ré-la) générées
 * sur exactement une période de boucle ; événements repliés : grande horloge lointaine,
 * carillons à vent en ré dorien pentatonique, cloche grave, nappe de verre (ré mineur 9 → fa
 * lydien), passages de sphères (souffle + bourdonnement en glissando).
 */
import type { SongDef, TrackDef } from '../engine';
import * as I from '../instruments';
import type { Instrument } from '../instruments';
import { SR, TAU, Rng, makeStereo, secs, type Stereo } from '../dsp/core';
import { pink, white } from '../dsp/noise';
import { modLowpass } from '../dsp/filters';
import { circular } from '../dsp/effects';
import { applyEnv } from '../dsp/env';
import type { NoteEv } from '../seq/sequencer';
import { noteToMidi as n } from '../seq/theory';
import { PAD_EQ, BELL_EQ } from './common';

const BPB = 4;
const BARS = 12;
const BPM = 64;

/** Bruit rendu périodique sur L échantillons par fondu enchaîné à puissance constante. */
function loopNoise(L: number, rng: Rng, kind: 'pink' | 'white'): Float32Array {
  const X = Math.min(secs(3), Math.floor(L / 4));
  const raw = kind === 'pink' ? pink(L + X, rng) : white(L + X, rng);
  const out = raw.slice(0, L);
  for (let i = 0; i < X; i++) {
    const a = (i / X) * (Math.PI / 2);
    out[i] = raw[i] * Math.sin(a) + raw[L + i] * Math.cos(a);
  }
  return out;
}

/** LFO périodique (somme de sinus à nombre entier de cycles par boucle), valeur dans ~[-1, 1]. */
function lfo(L: number, cycles: number[], phases: number[], weights: number[]): Float32Array {
  const out = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    let v = 0;
    for (let k = 0; k < cycles.length; k++) v += weights[k] * Math.sin((TAU * cycles[k] * i) / L + phases[k]);
    out[i] = v;
  }
  return out;
}

function continuous(L: number, rng: Rng): Stereo {
  const out = makeStereo(L);
  const gust = lfo(L, [3, 5, 8], [0.3, 1.9, 4.1], [0.5, 0.35, 0.15]);
  for (const [ch, salt] of [[out.l, 'L'], [out.r, 'R']] as const) {
    const r = rng.fork(salt);
    const ph = salt === 'L' ? 0 : 0.7;
    // Vent grave : bruit rose, passe-bas balayé.
    const low = loopNoise(L, r.fork('low'), 'pink');
    const cutLow = lfo(L, [2, 3], [ph, 2.2 + ph], [0.6, 0.4]);
    for (let i = 0; i < L; i++) cutLow[i] = 380 * Math.pow(2, 0.9 * cutLow[i]);
    const lowS: Stereo = { l: low, r: new Float32Array(L) };
    const lowF = circular(lowS, (x) => {
      const c2 = new Float32Array(x.l.length);
      for (let i = 0; i < c2.length; i++) c2[i] = cutLow[i % L];
      return { l: modLowpass(x.l, c2, 0.8), r: x.r };
    }).l;
    // Sifflement : bruit blanc, passe-bande résonant lentement glissant.
    const hi = loopNoise(L, r.fork('hi'), 'white');
    const cutHi = lfo(L, [1, 4], [1.1 + ph, 0.4], [0.7, 0.3]);
    for (let i = 0; i < L; i++) cutHi[i] = 1100 * Math.pow(2, 0.6 * cutHi[i]);
    const hiF = circular({ l: hi, r: new Float32Array(L) }, (x) => {
      const c2 = new Float32Array(x.l.length);
      for (let i = 0; i < c2.length; i++) c2[i] = cutHi[i % L];
      return { l: modLowpass(x.l, c2, 7, 'bp'), r: x.r };
    }).l;
    for (let i = 0; i < L; i++) {
      const g = 0.55 + 0.45 * gust[i];
      ch[i] = lowF[i] * 0.55 * g + hiF[i] * 0.05 * (0.4 + 0.6 * Math.max(0, gust[i] + 0.3));
    }
  }
  // Bourdon ré-la : fréquences arrondies à un nombre entier de cycles par boucle (périodique).
  const drone: Array<[number, number, number]> = [
    [n('D2'), 0.05, 0],
    [n('A2'), 0.03, 0.4],
    [n('D3'), 0.016, 1.3],
    [n('A3'), 0.008, 2.1],
  ];
  const breathe = lfo(L, [2, 3], [0, 1], [0.6, 0.4]);
  for (const [m, amp, phase] of drone) {
    const f = 440 * Math.pow(2, (m - 69) / 12);
    const k = Math.round((f * L) / SR);
    const k2 = k + Math.max(1, Math.round((0.18 * L) / SR)); // battement lent ≈ 0,18 Hz
    for (let i = 0; i < L; i++) {
      const v = amp * (0.75 + 0.25 * breathe[i]) * (Math.sin((TAU * k * i) / L + phase) * 0.7 + Math.sin((TAU * k2 * i) / L + phase * 2) * 0.3);
      out.l[i] += v;
      out.r[i] += v * 0.96;
    }
  }
  // (Le passe-haut du mastering, appliqué circulairement, retire l'infra-grave.)
  return out;
}

/** Passage d'une sphère : souffle en cloche + bourdonnement qui glisse (effet Doppler). */
const spherePass: Instrument = {
  name: 'passage de sphère',
  tail: 0.5,
  render({ f, dur, vel, rng }) {
    const nS = secs(dur + 0.5);
    const x = pink(nS, rng);
    const cut = new Float32Array(nS);
    const env = new Float32Array(nS);
    for (let i = 0; i < nS; i++) {
      const p = Math.min(1, i / secs(dur));
      env[i] = Math.pow(Math.sin(Math.PI * p), 2);
      cut[i] = 300 + 1400 * Math.sin(Math.PI * p);
    }
    const y = modLowpass(x, cut, 2, 'bp');
    applyEnv(y, env);
    let ph = 0;
    for (let i = 0; i < nS; i++) {
      const p = Math.min(1, i / secs(dur));
      const ff = f * (1.04 - 0.08 * p);
      ph += ff / SR;
      y[i] = y[i] * 0.8 + 0.25 * env[i] * (Math.sin(TAU * ph) + 0.3 * Math.sin(TAU * 2.01 * ph));
      y[i] *= vel;
    }
    return y;
  },
};

function tracks(): TrackDef[] {
  const rng = new Rng(9091);
  const beats = BARS * BPB;
  const tick: NoteEv[] = [];
  const tock: NoteEv[] = [];
  for (let b = 0; b < beats; b++) (b % 2 === 0 ? tick : tock).push({ t: b, d: 1, m: n('C4'), v: 0.36 });
  // Carillons à vent : grappes aléatoires (graine fixe) en ré dorien pentatonique.
  const penta = ['D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'A5', 'G5'].map(n);
  const chimes: NoteEv[] = [];
  const clusterTimes = [1.5, 6, 11.5, 17, 21.5, 26, 31.5, 36.5, 42];
  for (const ct of clusterTimes) {
    const k = rng.int(3, 6);
    let t = ct + rng.range(-0.6, 0.6);
    for (let i = 0; i < k; i++) {
      chimes.push({ t, d: 2, m: rng.pick(penta), v: rng.range(0.18, 0.42), pan: rng.range(-0.8, 0.8) });
      t += rng.range(0.12, 0.5);
    }
  }
  const glass: NoteEv[] = [
    ...['D3', 'A3', 'E4', 'F4'].map((x) => ({ t: 0, d: 24.5, m: n(x), v: 0.32 })),
    ...['F3', 'C4', 'E4', 'B4'].map((x) => ({ t: 24, d: 24.5, m: n(x), v: 0.3 })),
  ];
  const bells: NoteEv[] = [{ t: 0.5, d: 4, m: n('D2'), v: 0.35 }, { t: 24.5, d: 4, m: n('F2'), v: 0.3 }];
  const passes: NoteEv[] = [{ t: 9, d: 6, m: n('A2'), v: 0.5, pan: -0.5 }, { t: 33, d: 7, m: n('D3'), v: 0.45, pan: 0.5 }];
  return [
    { name: 'grande horloge (tic)', inst: I.tick, notes: tick, gain: -17, pan: 0.15, rev: 0.7, humanize: 0.001 },
    { name: 'grande horloge (tac)', inst: I.tock, notes: tock, gain: -17, pan: -0.15, rev: 0.7, humanize: 0.001 },
    { name: 'carillons à vent', inst: I.chime, notes: chimes, gain: -12, rev: 0.6, eq: BELL_EQ },
    { name: 'nappe de verre', inst: I.glassPad, notes: glass, gain: -9, spread: 0.5, rev: 0.6, eq: PAD_EQ, chorus: { mix: 0.45, rate: 0.12 } },
    { name: 'cloche lointaine', inst: I.bell, notes: bells, gain: -14, rev: 0.7, eq: BELL_EQ },
    { name: 'passages', inst: spherePass, notes: passes, gain: -12, rev: 0.5 },
  ];
}

export const ambience: SongDef = {
  id: 'ambience',
  title: "Le Souffle de l'Orrery",
  description: 'Ambiance — vent, bourdon, carillons lointains, grande horloge (boucle 45 s).',
  bpm: BPM,
  beatsPerBar: BPB,
  bars: BARS,
  loop: true,
  tail: 8,
  seed: 8807,
  reverb: { rt60: 5, damping: 5000, preDelay: 0.05, size: 1.6, lowCut: 200 },
  stems: [{ name: 'main', minIntensity: 0, tracks }],
  continuous,
  master: { lufs: -24, eq: [{ type: 'highpass', f: 30, q: 0.7 }] },
  gain: 0.8,
};
