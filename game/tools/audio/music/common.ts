/**
 * Réglages partagés par les compositions : égalisations types, compression de bus, horloge
 * (tic-tac intégré au rythme), utilitaires de mesure.
 */
import type { EqBand, CompressorOptions } from '../dsp/effects';
import type { NoteEv } from '../seq/sequencer';

/** Nappes : retire le grave inutile et adoucit les aigus agressifs. */
export const PAD_EQ: EqBand[] = [
  { type: 'highpass', f: 110, q: 0.7 },
  { type: 'peak', f: 2900, q: 1, g: -2 },
  { type: 'highshelf', f: 8000, g: -2 },
];

export const LEAD_EQ: EqBand[] = [
  { type: 'highpass', f: 160, q: 0.7 },
  { type: 'peak', f: 3200, q: 1.2, g: -1.5 },
];

export const BASS_EQ: EqBand[] = [
  { type: 'highpass', f: 32, q: 0.7 },
  { type: 'lowpass', f: 2200, q: 0.7 },
];

export const BELL_EQ: EqBand[] = [
  { type: 'highpass', f: 220, q: 0.7 },
  { type: 'highshelf', f: 9000, g: -1.5 },
];

export const PERC_EQ: EqBand[] = [
  { type: 'highpass', f: 50, q: 0.7 },
  { type: 'peak', f: 250, q: 1, g: -1.5 },
];

export const MASTER_EQ: EqBand[] = [
  { type: 'highpass', f: 30, q: 0.7 },
  { type: 'peak', f: 380, q: 0.8, g: -1.2 },
  { type: 'highshelf', f: 5000, g: 3 },
];

export const GLUE: CompressorOptions = { thresholdDb: -20, ratio: 1.7, kneeDb: 10, attackMs: 30, releaseMs: 280, rmsMs: 40 };
export const GLUE_HARD: CompressorOptions = { thresholdDb: -18, ratio: 2.2, kneeDb: 8, attackMs: 18, releaseMs: 200, rmsMs: 25 };

/**
 * Horloge d'Orrhéa : tic sur les temps impairs, tac sur les temps pairs ; option de croches
 * fantômes. Hauteur de référence : C5 (72).
 */
export function clock(o: {
  bars: number;
  beatsPerBar: number;
  at?: number;
  vel?: number;
  sub?: number; // subdivisions par temps (1 = noires, 2 = croches)
  pitch?: number;
}): { tick: NoteEv[]; tock: NoteEv[] } {
  const tick: NoteEv[] = [];
  const tock: NoteEv[] = [];
  const sub = o.sub ?? 1;
  const vel = o.vel ?? 0.4;
  const m = o.pitch ?? 72;
  const at = o.at ?? 0;
  const steps = o.bars * o.beatsPerBar * sub;
  for (let i = 0; i < steps; i++) {
    const t = at + i / sub;
    const beat = Math.floor(i / sub);
    const onBeat = i % sub === 0;
    const v = onBeat ? vel : vel * 0.45;
    const e: NoteEv = { t, d: 1 / sub, m: m + (onBeat ? 0 : 5), v, gate: 1 };
    if (beat % 2 === 0) tick.push(e);
    else tock.push(e);
  }
  return { tick, tock };
}

/** Temps (en noires) du début de la mesure n (1 = première). */
export const barAt = (n: number, beatsPerBar = 4): number => (n - 1) * beatsPerBar;
