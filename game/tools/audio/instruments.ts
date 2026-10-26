/**
 * Bibliothèque d'instruments : chaque instrument rend une note (mono) à partir de sa fréquence,
 * de sa durée tenue et de sa vélocité. Les ensembles (cordes, chœurs, cuivres) superposent
 * plusieurs voix légèrement désaccordées ; la largeur stéréo est donnée par la piste (pan, chorus).
 */
import { SR, TAU, clamp, type Rng, secs } from './dsp/core';
import { osc, freqCurve, addPartial, sine } from './dsp/osc';
import { adsr, expDecay, applyEnv } from './dsp/env';
import { Biquad, modLowpass, onePoleLP, onePoleHP, SVF, dcBlock } from './dsp/filters';
import { white, pink, brown } from './dsp/noise';
import { karplus } from './dsp/ks';
import { fmVoice } from './dsp/fm';
import { saturate } from './dsp/effects';

export interface VoiceParams {
  /** Fréquence (Hz). */
  f: number;
  /** Hauteur MIDI (pour les instruments à échelle de timbre). */
  m: number;
  /** Durée tenue (s). */
  dur: number;
  /** Vélocité 0..1. */
  vel: number;
  rng: Rng;
}

export interface Instrument {
  name: string;
  /** Secondes rendues après la fin de la note (relâchement, résonance). */
  tail: number;
  render(p: VoiceParams): Float32Array;
}

const len = (dur: number, tail: number): number => Math.max(16, secs(dur + tail));

/** Petite rafale de bruit filtrée (attaques, marteaux, souffles). */
function burst(n: number, rng: Rng, decay: number, type: 'bandpass' | 'highpass' | 'lowpass', f: number, q = 0.8): Float32Array {
  const x = white(n, rng);
  applyEnv(x, expDecay(n, decay, 0.0005));
  return new Biquad(type, f, q).run(x);
}

function addInto(dst: Float32Array, src: Float32Array, g = 1, at = 0): void {
  const end = Math.min(dst.length, at + src.length);
  for (let i = at; i < end; i++) dst[i] += src[i - at] * g;
}

/** Fondu de sortie sur les derniers ms (anti-clic). */
function fadeTail(x: Float32Array, ms = 30): Float32Array {
  const k = Math.min(x.length, Math.round((ms / 1000) * SR));
  for (let i = 0; i < k; i++) x[x.length - 1 - i] *= i / k;
  return x;
}

/** Applique un relâchement exponentiel après la fin de note (pour les sons à décroissance libre). */
function damper(x: Float32Array, at: number, t60: number): Float32Array {
  const start = Math.round(at * SR);
  const dec = Math.exp(-6.9 / Math.max(1, t60 * SR));
  let g = 1;
  for (let i = start; i < x.length; i++) {
    g *= dec;
    x[i] *= g;
  }
  return fadeTail(x, 20);
}

// ---------------------------------------------------------------------------------------------
// Claviers à percussion métallique : célesta, boîte à musique, glockenspiel, cloches, marimba.
// ---------------------------------------------------------------------------------------------

export const celesta: Instrument = {
  name: 'célesta',
  tail: 1.4,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const t60 = clamp(3.4 * Math.pow(440 / f, 0.45), 0.7, 5);
    const body = fmVoice(f, n, [{ ratio: 1, index: 0.35 + 1.2 * vel, indexDecay: 0.05, indexSustain: 0.06 }]);
    applyEnv(body, expDecay(n, t60, 0.0008));
    addPartial(body, f * 4.0, 0.16 * vel, t60 * 0.22, { phase: rng.next() });
    addPartial(body, f * 10.2, 0.04 * vel, 0.07, { phase: rng.next() });
    addInto(body, burst(secs(0.01), rng, 0.004, 'highpass', 2500), 0.05 * vel);
    return damper(body, dur + 0.25, 0.7);
  },
};

export const musicBox: Instrument = {
  name: 'boîte à musique',
  tail: 2.2,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const out = new Float32Array(n);
    const t60 = clamp(4.2 * Math.pow(330 / f, 0.55), 0.9, 4.5);
    const detune = 1 + rng.bi() * 0.0012; // lames légèrement imparfaites
    addPartial(out, f * detune, 0.8, t60, { phase: rng.next() });
    addPartial(out, f * detune * 1.0017, 0.22, t60 * 0.7, { phase: rng.next() });
    addPartial(out, f * 6.27, 0.2 * vel, t60 * 0.12, { phase: rng.next() });
    addPartial(out, f * 17.55, 0.05 * vel, 0.05, { phase: rng.next() });
    addInto(out, burst(secs(0.006), rng, 0.002, 'bandpass', 6000, 1.5), 0.06);
    for (let i = 0; i < n; i++) out[i] *= vel;
    return fadeTail(out, 300);
  },
};

export const glock: Instrument = {
  name: 'glockenspiel',
  tail: 1.6,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const out = new Float32Array(n);
    const t60 = clamp(2.6 * Math.pow(880 / f, 0.4), 0.6, 3.5);
    addPartial(out, f, 0.8, t60, { phase: rng.next() });
    addPartial(out, f * 2.756, 0.24 * vel, t60 * 0.3, { phase: rng.next() });
    addPartial(out, f * 5.404, 0.12 * vel, t60 * 0.14, { phase: rng.next() });
    addPartial(out, f * 8.933, 0.05 * vel, t60 * 0.07, { phase: rng.next() });
    addInto(out, burst(secs(0.008), rng, 0.003, 'highpass', 4000), 0.08 * vel);
    for (let i = 0; i < n; i++) out[i] *= vel;
    return fadeTail(out, 200);
  },
};

/** Grande cloche (partiels de cloche d'église : hum, prime, tierce mineure, quinte, nominal…). */
export const bell: Instrument = {
  name: 'cloche',
  tail: 7,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const out = new Float32Array(n);
    const T = clamp(7 * Math.pow(220 / f, 0.5), 2, 10);
    const parts: Array<[number, number, number]> = [
      [0.5, 0.32, 1.0],
      [1.0, 0.75, 0.75],
      [1.183, 0.42, 0.6],
      [1.506, 0.28, 0.5],
      [2.0, 0.48, 0.45],
      [2.514, 0.2, 0.3],
      [2.662, 0.2, 0.28],
      [3.011, 0.14, 0.24],
      [4.166, 0.1, 0.16],
      [5.433, 0.07, 0.11],
      [6.796, 0.045, 0.08],
    ];
    for (const [r, a, k] of parts) {
      addPartial(out, f * r * (1 + rng.bi() * 0.0008), a * (r > 2 ? vel : 1), T * k, { phase: rng.next(), beatHz: rng.range(0.2, 1.1), attack: 0.002 });
    }
    addInto(out, burst(secs(0.012), rng, 0.005, 'bandpass', Math.min(f * 3, 8000), 1.2), 0.2 * vel);
    for (let i = 0; i < n; i++) out[i] *= vel * 0.6;
    return fadeTail(out, 400);
  },
};

/** Cloche FM légère (carillons, éclats) : porteuse 1, modulateur inharmonique 3,5. */
export const chime: Instrument = {
  name: 'carillon',
  tail: 3.5,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const t60 = clamp(4 * Math.pow(660 / f, 0.4), 1, 5);
    const x = fmVoice(f, n, [{ ratio: 3.5, detuneHz: rng.bi() * 0.4, index: 1.6 * vel + 0.3, indexDecay: 0.4, indexSustain: 0.1 }]);
    applyEnv(x, expDecay(n, t60, 0.001));
    addPartial(x, f * 2.01, 0.15, t60 * 0.5, { phase: rng.next() });
    for (let i = 0; i < n; i++) x[i] *= vel * 0.7;
    return fadeTail(x, 300);
  },
};

export const marimba: Instrument = {
  name: 'marimba',
  tail: 1.2,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const out = new Float32Array(n);
    const t60 = clamp(1.5 * Math.pow(440 / f, 0.35), 0.35, 2.4);
    addPartial(out, f, 0.85, t60, { phase: 0.25, attack: 0.0015 });
    addPartial(out, f * 3.93, 0.2 * vel, t60 * 0.18, { phase: rng.next() });
    addPartial(out, f * 9.98, 0.05 * vel, t60 * 0.06, { phase: rng.next() });
    const th = burst(secs(0.03), rng, 0.012, 'lowpass', Math.min(2 * f + 400, 4000), 0.7);
    addInto(out, th, 0.25 * vel);
    for (let i = 0; i < n; i++) out[i] *= vel;
    return fadeTail(out, 100);
  },
};

// ---------------------------------------------------------------------------------------------
// Cordes pincées (Karplus-Strong) : harpe, pizzicati, basse pincée, luth « nomade ».
// ---------------------------------------------------------------------------------------------

export const harp: Instrument = {
  name: 'harpe',
  tail: 2.6,
  render({ f, dur, vel, rng }) {
    const total = dur + this.tail;
    const x = karplus(f, total, rng, {
      t60: clamp(5.5 * Math.pow(220 / f, 0.5), 0.9, 7),
      brightness: 0.3 + 0.35 * vel,
      pickPos: 0.13,
      softness: 0.45,
      amp: 0.55 + 0.45 * vel,
      damp: dur + 1.4,
      dampT60: 0.6,
    });
    new Biquad('lowpass', 7000, 0.6).run(x);
    dcBlock(x);
    return fadeTail(x, 60);
  },
};

export const pizz: Instrument = {
  name: 'pizzicato',
  tail: 0.7,
  render({ f, dur, vel, rng }) {
    const total = dur + this.tail;
    const n = len(dur, this.tail);
    const out = new Float32Array(n);
    const players = 3;
    for (let p = 0; p < players; p++) {
      const det = 1 + (p - 1) * 0.0022 + rng.bi() * 0.0008;
      const x = karplus(f * det, total, rng, {
        t60: clamp(0.7 * Math.pow(330 / f, 0.4), 0.18, 1.1),
        brightness: 0.35 + 0.3 * vel,
        pickPos: 0.22,
        softness: 0.25,
        amp: vel,
        damp: Math.max(0.12, dur),
        dampT60: 0.15,
      });
      addInto(out, x, 1 / players, Math.round(rng.range(0, 0.008) * SR));
    }
    new Biquad('peak', 360, 1.4, 5).run(out);
    new Biquad('peak', 950, 1.2, 2.5).run(out);
    new Biquad('highpass', 80, 0.7).run(out);
    new Biquad('lowpass', 5200, 0.7).run(out);
    return fadeTail(out, 40);
  },
};

export const pluckBass: Instrument = {
  name: 'basse pincée',
  tail: 0.6,
  render({ f, dur, vel, rng }) {
    const total = dur + this.tail;
    const x = karplus(f, total, rng, { t60: 1.6, brightness: 0.2 + 0.25 * vel, pickPos: 0.18, softness: 0.5, amp: vel, damp: dur, dampT60: 0.12 });
    const n = x.length;
    const sub = sine(f, n);
    applyEnv(sub, adsr(dur, { a: 0.004, d: 0.3, s: 0.5, r: 0.12 }, this.tail));
    addInto(x, sub, 0.45 * vel);
    new Biquad('lowpass', 1800, 0.7).run(x);
    dcBlock(x);
    return fadeTail(x, 30);
  },
};

export const lute: Instrument = {
  name: 'luth des caravanes',
  tail: 1.2,
  render({ f, dur, vel, rng }) {
    const x = karplus(f, dur + this.tail, rng, { t60: 1.8, brightness: 0.55 + 0.3 * vel, pickPos: 0.09, softness: 0.1, amp: vel, buzz: 0.7, damp: dur + 0.4, dampT60: 0.3 });
    new Biquad('peak', 1800, 1.5, 4).run(x);
    new Biquad('highpass', 120, 0.7).run(x);
    dcBlock(x);
    return fadeTail(x, 40);
  },
};

// ---------------------------------------------------------------------------------------------
// Ensembles tenus : cordes, chœurs, cuivres, bois, orgue de barbarie, nappes.
// ---------------------------------------------------------------------------------------------

export interface StringsOptions {
  attack: number;
  release: number;
  /** Brillance (multiplicateur de coupure). */
  bright: number;
  /** Profondeur de vibrato (fraction). */
  vib: number;
  voices?: number;
  /** Niveau de sustain. */
  sustain?: number;
  decay?: number;
  name?: string;
  /** Bruit d'archet. */
  bow?: number;
}

export function strings(o: StringsOptions): Instrument {
  const voices = o.voices ?? 5;
  return {
    name: o.name ?? 'cordes',
    tail: o.release + 0.05,
    render({ f, dur, vel, rng }) {
      const n = len(dur, this.tail);
      const sum = new Float32Array(n);
      for (let v = 0; v < voices; v++) {
        const spread = voices > 1 ? (v / (voices - 1)) * 2 - 1 : 0;
        const cents = spread * 11 + rng.bi() * 2.5;
        const fc = freqCurve(n, f * Math.pow(2, cents / 1200), {
          vibRate: 4.6 + rng.next() * 1.0,
          vibDepth: o.vib,
          vibDelay: 0.3 + rng.next() * 0.2,
          vibPhase: rng.next(),
          driftDepth: 0.0011,
          driftRate: 0.17 + rng.next() * 0.2,
          drift: rng.next() * 6,
        });
        addInto(sum, osc('saw', fc, n, { phase: rng.next() }), 1 / Math.sqrt(voices));
      }
      // Coupure qui s'ouvre pendant l'attaque (l'archet « mord »).
      // Coupure proportionnelle à la hauteur, avec un plancher : les notes graves gardent leur mordant.
      const base = Math.min(Math.max(f * (2.5 + o.bright * (2 + 5 * vel)), 700 + 2600 * o.bright * (0.4 + 0.6 * vel)), 10000);
      const cut = new Float32Array(n);
      const na = Math.max(1, secs(o.attack * 1.5));
      for (let i = 0; i < n; i++) cut[i] = base * (0.45 + 0.55 * Math.min(1, i / na));
      const y = modLowpass(sum, cut, 0.65);
      if (o.bow) {
        const bn = pink(n, rng);
        const bp = new Biquad('bandpass', clamp(f * 6, 1500, 5000), 1.2).run(bn);
        addInto(y, bp, o.bow * vel);
      }
      applyEnv(y, adsr(dur, { a: o.attack, d: o.decay ?? 0.4, s: o.sustain ?? 0.85, r: o.release }, 0.05));
      for (let i = 0; i < n; i++) y[i] *= 0.55 * (0.5 + 0.5 * vel);
      return y;
    },
  };
}

export const stringsPad = strings({ attack: 0.45, release: 1.1, bright: 0.7, vib: 0.0028, name: 'nappe de cordes', bow: 0.02, voices: 4 });
export const stringsLead = strings({ attack: 0.09, release: 0.5, bright: 0.85, vib: 0.0045, name: 'violons', voices: 5, bow: 0.04 });
export const celli = strings({ attack: 0.12, release: 0.5, bright: 0.6, vib: 0.0035, name: 'violoncelles', voices: 4, bow: 0.03 });
export const lowStrings = strings({ attack: 0.25, release: 0.7, bright: 0.35, vib: 0.002, name: 'contrebasses', voices: 4 });
export const spiccato = strings({ attack: 0.006, release: 0.09, bright: 0.9, vib: 0, name: 'spiccato', voices: 3, sustain: 0.3, decay: 0.09, bow: 0.12 });
export const tremolo: Instrument = {
  name: 'cordes trémolo',
  tail: 0.5,
  render(p) {
    const y = stringsLead.render({ ...p, vel: p.vel * 0.9 });
    // Trémolo d'archet ~ 12 Hz légèrement irrégulier.
    const rate = 11.5 + p.rng.next() * 2;
    for (let i = 0; i < y.length; i++) {
      const t = i / SR;
      y[i] *= 0.6 + 0.4 * Math.abs(Math.sin(Math.PI * rate * t + 0.3 * Math.sin(TAU * 0.7 * t)));
    }
    return y;
  },
};

type FormantSet = Array<[number, number, number]>; // [Hz, dB, largeur Hz]
const FORMANTS: Record<string, Record<string, FormantSet>> = {
  a: {
    bass: [[600, 0, 60], [1040, -7, 70], [2250, -9, 110], [2450, -9, 120], [2750, -20, 130]],
    tenor: [[650, 0, 80], [1080, -6, 90], [2650, -7, 120], [2900, -8, 130], [3250, -22, 140]],
    alto: [[800, 0, 80], [1150, -4, 90], [2800, -20, 120], [3500, -36, 130], [4950, -60, 140]],
    soprano: [[800, 0, 80], [1150, -6, 90], [2900, -32, 120], [3900, -20, 130], [4950, -50, 140]],
  },
  o: {
    bass: [[400, 0, 40], [750, -11, 80], [2400, -21, 100], [2600, -20, 120], [2900, -40, 120]],
    tenor: [[400, 0, 40], [800, -10, 80], [2600, -12, 100], [2800, -12, 120], [3000, -26, 120]],
    alto: [[450, 0, 70], [800, -9, 80], [2830, -16, 100], [3500, -28, 130], [4950, -55, 135]],
    soprano: [[450, 0, 70], [800, -11, 80], [2830, -22, 100], [3800, -22, 130], [4950, -50, 135]],
  },
  u: {
    bass: [[350, 0, 40], [600, -20, 80], [2400, -32, 100], [2675, -28, 120], [2950, -36, 120]],
    tenor: [[350, 0, 40], [600, -20, 60], [2700, -17, 100], [2900, -14, 120], [3300, -26, 120]],
    alto: [[325, 0, 50], [700, -12, 60], [2530, -30, 170], [3500, -40, 180], [4950, -64, 200]],
    soprano: [[325, 0, 50], [700, -16, 60], [2700, -35, 170], [3800, -40, 180], [4950, -60, 200]],
  },
};

export function choir(vowel: 'a' | 'o' | 'u', o: { attack?: number; release?: number; singers?: number } = {}): Instrument {
  const singers = o.singers ?? 4;
  const release = o.release ?? 1.0;
  return {
    name: `chœur « ${vowel} »`,
    tail: release + 0.05,
    render({ f, dur, vel, rng }) {
      const n = len(dur, this.tail);
      const src = new Float32Array(n);
      for (let s = 0; s < singers; s++) {
        const cents = (s / Math.max(1, singers - 1) - 0.5) * 16 + rng.bi() * 3;
        const fc = freqCurve(n, f * Math.pow(2, cents / 1200), {
          vibRate: 4.8 + rng.next() * 1.1,
          vibDepth: 0.0045 + rng.next() * 0.002,
          vibDelay: 0.25 + rng.next() * 0.3,
          vibPhase: rng.next(),
          glideFrom: 1 - 0.006 * rng.next(),
          glideTime: 0.12,
          driftDepth: 0.0015,
          driftRate: 0.3 + rng.next() * 0.3,
          drift: rng.next() * 6,
        });
        // Source glottale : dent de scie adoucie.
        const g = osc('saw', fc, n, { phase: rng.next() });
        onePoleLP(g, 2600);
        addInto(src, g, 1 / Math.sqrt(singers));
      }
      // Souffle.
      const br = white(n, rng);
      onePoleLP(br, 5000);
      addInto(src, br, 0.05);
      const reg = f < 175 ? 'bass' : f < 300 ? 'tenor' : f < 470 ? 'alto' : 'soprano';
      const set = FORMANTS[vowel][reg];
      const out = new Float32Array(n);
      for (const [F, db, bw] of set) {
        const bp = new Biquad('bandpass', F, F / bw).run(Float32Array.from(src));
        addInto(out, bp, Math.pow(10, db / 20));
      }
      applyEnv(out, adsr(dur, { a: o.attack ?? 0.35, d: 0.3, s: 0.9, r: release }, 0.05));
      for (let i = 0; i < n; i++) out[i] *= 1.6 * (0.45 + 0.55 * vel);
      return out;
    },
  };
}

export function horn(o: { attack?: number; release?: number; bright?: number; voices?: number; name?: string } = {}): Instrument {
  const voices = o.voices ?? 3;
  const release = o.release ?? 0.35;
  const attack = o.attack ?? 0.07;
  const bright = o.bright ?? 1;
  return {
    name: o.name ?? 'cors',
    tail: release + 0.05,
    render({ f, dur, vel, rng }) {
      const n = len(dur, this.tail);
      const sum = new Float32Array(n);
      for (let v = 0; v < voices; v++) {
        const cents = (voices > 1 ? (v / (voices - 1)) * 2 - 1 : 0) * 6 + rng.bi() * 1.5;
        const fc = freqCurve(n, f * Math.pow(2, cents / 1200), {
          glideFrom: 0.985,
          glideTime: 0.06,
          vibRate: 4.6 + rng.next() * 0.6,
          vibDepth: 0.0025,
          vibDelay: 0.45,
          vibPhase: rng.next(),
          driftDepth: 0.0008,
          drift: rng.next() * 6,
        });
        addInto(sum, osc('saw', fc, n, { phase: rng.next() }), 0.75 / voices);
        addInto(sum, osc('square', fc, n, { phase: rng.next() }), 0.25 / voices);
      }
      // Enveloppe de brillance : le cuivre s'ouvre avec l'attaque, plus brillant en fortissimo.
      const na = Math.max(1, secs(attack));
      const cut = new Float32Array(n);
      const top = Math.min(f * (2 + bright * (2.5 + 6 * vel * vel)), 7000);
      const ng = secs(dur);
      for (let i = 0; i < n; i++) {
        const a = Math.min(1, i / na);
        const settle = i < na ? a : 0.78 + 0.22 * Math.exp(-(i - na) / (0.25 * SR));
        const rel = i > ng ? Math.exp(-(i - ng) / (0.12 * SR)) : 1;
        cut[i] = f * 1.2 + (top - f * 1.2) * settle * rel;
      }
      const y = modLowpass(sum, cut, 0.9);
      applyEnv(y, adsr(dur, { a: attack, d: 0.25, s: 0.82, r: release }, 0.05));
      for (let i = 0; i < n; i++) y[i] *= 0.7 * (0.4 + 0.6 * vel);
      return y;
    },
  };
}

export const horns = horn();
export const brassStab = horn({ attack: 0.012, release: 0.22, bright: 1.4, name: 'cuivres staccato' });
export const tuba = horn({ attack: 0.05, release: 0.25, bright: 0.6, voices: 2, name: 'tuba' });

export const flute: Instrument = {
  name: 'flûte',
  tail: 0.25,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const fc = freqCurve(n, f, { vibRate: 5.1, vibDepth: 0.0045, vibDelay: 0.28, vibPhase: rng.next(), glideFrom: 0.994, glideTime: 0.05, driftDepth: 0.0007, drift: rng.next() * 6 });
    const y = osc('sine', fc, n, { phase: 0 });
    const fc2 = new Float32Array(n);
    for (let i = 0; i < n; i++) fc2[i] = fc[i] * 2;
    addInto(y, osc('sine', fc2, n, { phase: 0.1 }), 0.13);
    addInto(y, osc('tri', fc, n), 0.05);
    // Souffle accordé + souffle large.
    const nz = white(n, rng);
    const sv = new SVF(f, 4);
    const breath = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      sv.lp(nz[i]);
      breath[i] = sv.bp;
    }
    addInto(y, breath, 0.18);
    const hiss = onePoleHP(white(n, rng), 4000);
    addInto(y, hiss, 0.012);
    // Chuintement d'attaque.
    addInto(y, burst(secs(0.05), rng, 0.03, 'bandpass', Math.min(f * 3, 9000), 1.5), 0.12 * vel);
    applyEnv(y, adsr(dur, { a: 0.07, d: 0.15, s: 0.85, r: 0.18 }, 0.07));
    for (let i = 0; i < n; i++) y[i] *= 0.55 * (0.5 + 0.5 * vel);
    return y;
  },
};

/** Orgue de barbarie (manège) : tuyaux harmoniques + anche, trémolo mécanique. */
export const barrelOrgan: Instrument = {
  name: 'orgue de barbarie',
  tail: 0.12,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const y = new Float32Array(n);
    const amps = [1, 0.55, 0.32, 0.22, 0.1, 0.07];
    let ph = rng.next();
    let ph2 = rng.next();
    const dt = f / SR;
    const dt2 = (f * 2 + 0.7) / SR; // rang « voix céleste » à l'octave, légèrement désaccordé
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k < amps.length; k++) if (f * (k + 1) < SR * 0.45) s += amps[k] * Math.sin(TAU * (k + 1) * ph);
      s += 0.3 * Math.sin(TAU * ph2) + 0.1 * Math.sin(TAU * 2 * ph2);
      y[i] = s * 0.35;
      ph += dt;
      if (ph >= 1) ph -= 1;
      ph2 += dt2;
      if (ph2 >= 1) ph2 -= 1;
    }
    const reed = osc('pulse', f, n, { pw: 0.22 });
    onePoleLP(reed, 2200);
    addInto(y, reed, 0.12);
    for (let i = 0; i < n; i++) y[i] *= 1 - 0.13 * (0.5 + 0.5 * Math.sin(TAU * 6.3 * (i / SR)));
    addInto(y, burst(secs(0.03), rng, 0.012, 'bandpass', Math.min(f * 4, 8000), 1), 0.06);
    applyEnv(y, adsr(dur, { a: 0.018, d: 0.05, s: 0.95, r: 0.08 }, 0.04));
    for (let i = 0; i < n; i++) y[i] *= 0.6 * (0.6 + 0.4 * vel);
    return y;
  },
};

/** Nappe synthétique chaude (dents de scie désaccordées + triangle grave, filtre respirant). */
export const warmPad: Instrument = {
  name: 'nappe chaude',
  tail: 2.2,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const y = new Float32Array(n);
    for (const c of [-9, 0, 9]) {
      const fc = freqCurve(n, f * Math.pow(2, (c + rng.bi() * 2) / 1200), { driftDepth: 0.0012, driftRate: 0.2, drift: rng.next() * 6 });
      addInto(y, osc('saw', fc, n, { phase: rng.next() }), 0.33);
    }
    addInto(y, osc('tri', f / 2, n), 0.3);
    const cut = new Float32Array(n);
    const lfo = rng.next() * TAU;
    for (let i = 0; i < n; i++) cut[i] = Math.min(900 + 900 * vel + 350 * Math.sin(TAU * 0.11 * (i / SR) + lfo), f * 8 + 300);
    const z = modLowpass(y, cut, 0.7);
    applyEnv(z, adsr(dur, { a: 1.2, d: 1, s: 0.85, r: 2.1 }, 0.05));
    for (let i = 0; i < n; i++) z[i] *= 0.5 * (0.5 + 0.5 * vel);
    return z;
  },
};

/** Nappe de verre (partiels sinusoïdaux + FM légère) : émerveillement, menus. */
export const glassPad: Instrument = {
  name: 'nappe de verre',
  tail: 2.5,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const y = fmVoice(f, n, [{ ratio: 2, index: 0.6, indexDecay: 3, indexSustain: 0.25 }]);
    const s2 = sine(f * 3.002, n, rng.next());
    addInto(y, s2, 0.12);
    const s3 = sine(f * 0.5, n, rng.next());
    addInto(y, s3, 0.25);
    for (let i = 0; i < n; i++) y[i] *= 1 + 0.08 * Math.sin(TAU * 0.4 * (i / SR) + 1);
    applyEnv(y, adsr(dur, { a: 1.4, d: 1, s: 0.8, r: 2.4 }, 0.05));
    for (let i = 0; i < n; i++) y[i] *= 0.35 * (0.5 + 0.5 * vel);
    return y;
  },
};

export const subBass: Instrument = {
  name: 'sub-basse',
  tail: 0.25,
  render({ f, dur, vel }) {
    const n = len(dur, this.tail);
    const y = sine(f, n);
    addInto(y, sine(f * 2, n, 0.25), 0.18);
    addInto(y, sine(f * 3, n, 0.1), 0.05);
    saturate(y, 1.3);
    applyEnv(y, adsr(dur, { a: 0.02, d: 0.15, s: 0.9, r: 0.2 }, 0.05));
    for (let i = 0; i < n; i++) y[i] *= 0.8 * vel;
    return y;
  },
};

// ---------------------------------------------------------------------------------------------
// Percussions : taiko, timbales, grosse caisse, tambour sur cadre, cymbales, gong, tic-tac.
// ---------------------------------------------------------------------------------------------

export function taiko(o: { decay?: number; air?: number; name?: string } = {}): Instrument {
  return {
    name: o.name ?? 'taiko',
    tail: 1.4,
    render({ f, vel, rng }) {
      const n = secs(1.5);
      const T = o.decay ?? 0.9;
      const fc = new Float32Array(n);
      for (let i = 0; i < n; i++) fc[i] = f * (1 + 0.55 * Math.exp(-i / (0.016 * SR)));
      const y = osc('sine', fc, n);
      applyEnv(y, expDecay(n, T, 0.0015));
      const modes: Array<[number, number, number]> = [
        [1.59, 0.62, 0.42],
        [2.14, 0.5, 0.32],
        [2.3, 0.4, 0.28],
        [2.65, 0.3, 0.2],
        [2.92, 0.24, 0.16],
        [3.16, 0.18, 0.13],
        [3.5, 0.14, 0.1],
        [4.1, 0.1, 0.08],
        [4.9, 0.08, 0.06],
        [5.7, 0.06, 0.05],
      ];
      for (const [r, a, t] of modes) addPartial(y, f * r * (1 + rng.bi() * 0.01), a * vel, t * T, { phase: rng.next() });
      // Frappe de baguette : claquement de peau + bois.
      addInto(y, burst(secs(0.05), rng, 0.01, 'bandpass', 700, 0.8), 0.55 * vel);
      addInto(y, burst(secs(0.03), rng, 0.005, 'bandpass', 2400, 1.1), 0.3 * vel);
      addInto(y, burst(secs(0.012), rng, 0.0025, 'highpass', 1800, 0.7), 0.18 * vel);
      const air = brown(secs(0.25), rng);
      applyEnv(air, expDecay(air.length, 0.1));
      new Biquad('bandpass', 160, 0.8).run(air);
      addInto(y, air, (o.air ?? 0.8) * vel * 0.8);
      new Biquad('highpass', 45, 0.7).run(y);
      for (let i = 0; i < n; i++) y[i] *= Math.pow(vel, 1.2);
      saturate(y, 1.6);
      return fadeTail(y, 80);
    },
  };
}

export const taikoBig = taiko({ decay: 0.85, air: 1, name: 'ō-daiko' });
export const taikoMid = taiko({ decay: 0.55, air: 0.6, name: 'nagadō-daiko' });
export const taikoHigh: Instrument = {
  name: 'shime-daiko',
  tail: 0.3,
  render({ f, vel, rng }) {
    const n = secs(0.35);
    const y = new Float32Array(n);
    addPartial(y, f, 0.6, 0.14, { phase: 0.25 });
    addPartial(y, f * 1.59, 0.3, 0.08, { phase: rng.next() });
    addPartial(y, f * 2.14, 0.2, 0.06, { phase: rng.next() });
    addInto(y, burst(secs(0.03), rng, 0.006, 'bandpass', 2500, 1), 0.5);
    for (let i = 0; i < n; i++) y[i] *= vel;
    return fadeTail(y, 20);
  },
};

export const timpani: Instrument = {
  name: 'timbales',
  tail: 3,
  render({ f, vel, rng }) {
    const n = secs(3);
    const y = new Float32Array(n);
    const T = 2.6;
    const modes: Array<[number, number, number]> = [
      [1, 1, 1],
      [1.5, 0.7, 0.8],
      [1.98, 0.5, 0.65],
      [2.44, 0.35, 0.5],
      [2.9, 0.22, 0.4],
      [3.36, 0.12, 0.3],
    ];
    for (const [r, a, k] of modes) addPartial(y, f * r * (1 + 0.004 * rng.bi()), a * (r > 1 ? 0.5 + 0.5 * vel : 1), T * k, { phase: rng.next(), attack: 0.002 });
    addPartial(y, f * 0.85, 0.5, 0.15, { phase: 0.25 });
    addInto(y, burst(secs(0.03), rng, 0.01, 'lowpass', 1500, 0.7), 0.35 * vel);
    for (let i = 0; i < n; i++) y[i] *= 0.8 * Math.pow(vel, 1.1);
    return fadeTail(y, 200);
  },
};

export const kick: Instrument = {
  name: 'grosse caisse',
  tail: 0.6,
  render({ vel, rng }) {
    const n = secs(0.6);
    const fc = new Float32Array(n);
    for (let i = 0; i < n; i++) fc[i] = 46 + 110 * Math.exp(-i / (0.035 * SR));
    const y = osc('sine', fc, n);
    applyEnv(y, expDecay(n, 0.5, 0.001));
    addInto(y, burst(secs(0.01), rng, 0.003, 'bandpass', 3000, 0.7), 0.15);
    for (let i = 0; i < n; i++) y[i] *= vel;
    saturate(y, 1.4);
    return fadeTail(y, 40);
  },
};

export const frameDrum: Instrument = {
  name: 'tambour sur cadre',
  tail: 0.4,
  render({ f, vel, rng }) {
    const n = secs(0.45);
    const fc = new Float32Array(n);
    for (let i = 0; i < n; i++) fc[i] = f * (1 + 0.25 * Math.exp(-i / (0.02 * SR)));
    const y = osc('sine', fc, n);
    applyEnv(y, expDecay(n, 0.28, 0.001));
    addInto(y, burst(secs(0.2), rng, 0.12, 'bandpass', 1300, 0.9), 0.45);
    addInto(y, burst(secs(0.15), rng, 0.08, 'highpass', 3500, 0.7), 0.15);
    for (let i = 0; i < n; i++) y[i] *= vel * 0.8;
    return fadeTail(y, 30);
  },
};

export const shaker: Instrument = {
  name: 'shaker',
  tail: 0.12,
  render({ vel, rng, dur }) {
    const n = secs(Math.min(0.14, dur + 0.08));
    const x = white(n, rng);
    const na = secs(0.008);
    const dec = Math.exp(-1 / (0.035 * SR));
    let g = 0;
    for (let i = 0; i < n; i++) {
      g = i < na ? i / na : g * dec;
      x[i] *= g;
    }
    new Biquad('bandpass', 6500, 1.1).run(x);
    for (let i = 0; i < n; i++) x[i] *= vel * 0.9;
    return fadeTail(x, 10);
  },
};

export const hat: Instrument = {
  name: 'charleston',
  tail: 0.1,
  render({ vel, rng, dur }) {
    const n = secs(Math.min(0.4, 0.05 + dur * 0.5));
    const x = white(n, rng);
    applyEnv(x, expDecay(n, Math.min(0.35, 0.04 + dur * 0.3), 0.0005));
    new Biquad('highpass', 7000, 0.8).run(x);
    new Biquad('peak', 10000, 1.5, 4).run(x);
    for (let i = 0; i < n; i++) x[i] *= vel * 0.6;
    return fadeTail(x, 8);
  },
};

function metalCluster(n: number, base: number): Float32Array {
  const y = new Float32Array(n);
  const ratios = [1, 1.52, 1.6, 1.8, 2.23, 3.21];
  for (const r of ratios) addInto(y, osc('square', base * r, n), 1 / ratios.length);
  return y;
}

export const cymbal: Instrument = {
  name: 'cymbale',
  tail: 3,
  render({ vel, rng }) {
    const n = secs(3.2);
    const y = white(n, rng);
    addInto(y, metalCluster(n, 420), 0.5);
    new Biquad('highpass', 3200, 0.7).run(y);
    new Biquad('peak', 7500, 0.8, 3).run(y);
    applyEnv(y, expDecay(n, 2.6, 0.002));
    for (let i = 0; i < n; i++) y[i] *= vel * 0.35;
    return fadeTail(y, 200);
  },
};

/** Cymbale inversée : montée sur toute la durée de la note (transitions). */
export const swell: Instrument = {
  name: 'montée de cymbale',
  tail: 0.15,
  render({ vel, rng, dur }) {
    const n = len(dur, this.tail);
    const y = white(n, rng);
    addInto(y, metalCluster(n, 380), 0.4);
    new Biquad('highpass', 2500, 0.7).run(y);
    const nd = secs(dur);
    for (let i = 0; i < n; i++) {
      const x = Math.min(1, i / nd);
      const g = i < nd ? Math.pow(x, 2.6) : Math.exp(-(i - nd) / (0.03 * SR));
      y[i] *= g * vel * 0.3;
    }
    return fadeTail(y, 20);
  },
};

export const gong: Instrument = {
  name: 'tam-tam',
  tail: 7,
  render({ f, vel, rng }) {
    const n = secs(7.5);
    const y = new Float32Array(n);
    for (let k = 0; k < 36; k++) {
      const r = 1 + k * 0.37 + rng.range(-0.12, 0.12) + 0.01 * k * k;
      const a = 0.7 / Math.pow(k + 1, 0.55);
      const att = k < 4 ? 0.003 : rng.range(0.05, 0.45); // « éclosion » des aigus
      addPartial(y, f * r, a, rng.range(2.5, 6.5) * (k < 6 ? 1.2 : 0.8), { phase: rng.next(), attack: att, beatHz: rng.range(0.3, 2) });
    }
    addPartial(y, f * 0.5, 0.6, 0.6, { phase: 0.25 });
    addInto(y, burst(secs(0.08), rng, 0.03, 'lowpass', 600, 0.7), 0.5);
    for (let i = 0; i < n; i++) y[i] *= vel * 0.22;
    return fadeTail(y, 500);
  },
};

/** Tic d'horlogerie (aigu, sec). La hauteur de note décale les résonances (C5 = référence). */
export const tick: Instrument = {
  name: 'tic',
  tail: 0.08,
  render({ f, vel, rng }) {
    const k = f / 523.25;
    const n = secs(0.09);
    const y = new Float32Array(n);
    addPartial(y, 3150 * k, 0.5, 0.03, { phase: 0.25 });
    addPartial(y, 4870 * k, 0.35, 0.022, { phase: rng.next() });
    addPartial(y, 7240 * k, 0.22, 0.015, { phase: rng.next() });
    addInto(y, burst(secs(0.004), rng, 0.0015, 'highpass', 5000), 0.5);
    for (let i = 0; i < n; i++) y[i] *= vel;
    return fadeTail(y, 5);
  },
};

/** Tac (plus grave, boisé). */
export const tock: Instrument = {
  name: 'tac',
  tail: 0.1,
  render({ f, vel, rng }) {
    const k = f / 523.25;
    const n = secs(0.11);
    const y = new Float32Array(n);
    addPartial(y, 1250 * k, 0.5, 0.05, { phase: 0.25 });
    addPartial(y, 2010 * k, 0.32, 0.035, { phase: rng.next() });
    addPartial(y, 3350 * k, 0.18, 0.025, { phase: rng.next() });
    addPartial(y, 520 * k, 0.3, 0.03, { phase: 0.25 });
    addInto(y, burst(secs(0.004), rng, 0.0015, 'bandpass', 2500, 0.8), 0.4);
    for (let i = 0; i < n; i++) y[i] *= vel;
    return fadeTail(y, 5);
  },
};

/** Souffle filtré montant (transitions musicales). La hauteur fixe la fréquence finale. */
export const riser: Instrument = {
  name: 'souffle montant',
  tail: 0.3,
  render({ f, dur, vel, rng }) {
    const n = len(dur, this.tail);
    const x = pink(n, rng);
    const nd = secs(dur);
    const cut = new Float32Array(n);
    for (let i = 0; i < n; i++) cut[i] = 250 * Math.pow(f / 250, Math.min(1, i / nd));
    const y = modLowpass(x, cut, 2.5, 'bp');
    for (let i = 0; i < n; i++) {
      const p = Math.min(1, i / nd);
      y[i] *= (i < nd ? p * p : Math.exp(-(i - nd) / (0.08 * SR))) * vel * 0.8;
    }
    return fadeTail(y, 30);
  },
};
