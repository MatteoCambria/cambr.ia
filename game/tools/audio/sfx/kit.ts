/**
 * Boîte à outils des effets sonores : briques de synthèse courtes (tons glissés, souffles,
 * impacts, clics d'horlogerie, cloches FM, scintillements, bulles, crépitements, cliquets) et
 * spatialisation (pièce courte, largeur stéréo).
 */
import { SR, TAU, Rng, secs, midiToFreq, makeStereo, type Stereo, clamp } from '../dsp/core';
import { addPartial, osc, type Wave } from '../dsp/osc';
import { breakpoints, expDecay, applyEnv } from '../dsp/env';
import { Biquad, modLowpass } from '../dsp/filters';
import { white, pink, brown } from '../dsp/noise';
import { hallReverb, freeverb, saturate } from '../dsp/effects';
import { fmVoice } from '../dsp/fm';
import type { Instrument } from '../instruments';

export const buf = (dur: number): Float32Array => new Float32Array(Math.max(1, secs(dur)));

/** Fondu de sortie en cosinus sur la fin du tampon (évite les clics de troncature). */
export function fadeOutEnd(x: Float32Array, sec: number): Float32Array {
  const k = Math.min(x.length, Math.max(1, secs(sec)));
  for (let i = 0; i < k; i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / k);
  return x;
}

/** Ajoute src dans dst à `at` secondes (tronqué à la longueur de dst). */
export function add(dst: Float32Array, src: Float32Array, at = 0, g = 1): Float32Array {
  const o = Math.round(at * SR);
  const end = Math.min(dst.length, o + src.length);
  for (let i = Math.max(0, o); i < end; i++) dst[i] += src[i - o] * g;
  return dst;
}

export function gain(x: Float32Array, g: number): Float32Array {
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
}

/** Enveloppe en points [t (s), valeur]. */
export function shape(x: Float32Array, pts: ReadonlyArray<readonly [number, number]>): Float32Array {
  return applyEnv(x, breakpoints(x.length, pts));
}

/** Note d'un instrument de la bibliothèque. */
export function note(inst: Instrument, midi: number, dur: number, vel: number, rng: Rng): Float32Array {
  return inst.render({ f: midiToFreq(midi), m: midi, dur, vel, rng });
}

/** Suite de notes [instant (s), midi, durée (s), vélocité]. */
export function notes(inst: Instrument, list: ReadonlyArray<readonly [number, number, number, number]>, rng: Rng, total?: number): Float32Array {
  const parts = list.map(([at, m, d, v], k) => ({ at, x: note(inst, m, d, v, rng.fork(k + 1)) }));
  const full = Math.max(...parts.map((p) => p.at + p.x.length / SR));
  const len = total ?? full;
  const out = buf(len);
  for (const p of parts) add(out, p.x, p.at);
  // Les résonances qui dépassent la durée voulue s'éteignent en douceur.
  if (len < full) fadeOutEnd(out, Math.min(0.15, len * 0.3));
  return out;
}

/** Ton glissé (exponentiel) de f0 à f1. */
export function glide(dur: number, f0: number, f1: number, wave: Wave = 'sine', curve = 1): Float32Array {
  const n = secs(dur);
  const fc = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.pow(i / Math.max(1, n - 1), curve);
    fc[i] = f0 * Math.pow(f1 / f0, p);
  }
  return osc(wave, fc, n);
}

export function noise(dur: number, rng: Rng, color: 'white' | 'pink' | 'brown' = 'white'): Float32Array {
  const n = secs(dur);
  return color === 'white' ? white(n, rng) : color === 'pink' ? pink(n, rng) : brown(n, rng);
}

/** Filtre balayé (exponentiel) de f0 à f1. */
export function sweepFilter(x: Float32Array, f0: number, f1: number, q: number, mode: 'lp' | 'bp' | 'hp' = 'bp', curve = 1): Float32Array {
  const n = x.length;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = f0 * Math.pow(f1 / f0, Math.pow(i / Math.max(1, n - 1), curve));
  return modLowpass(x, c, q, mode);
}

export function filt(x: Float32Array, type: 'lowpass' | 'highpass' | 'bandpass' | 'peak' | 'highshelf' | 'lowshelf', f: number, q = 0.707, g = 0): Float32Array {
  return new Biquad(type, f, q, g).run(x);
}

/** Souffle : bruit rose filtré passe-bande balayé, enveloppe en cloche (pic à `peakAt`). */
export function whoosh(dur: number, f0: number, f1: number, rng: Rng, q = 1.4, peakAt = 0.6): Float32Array {
  const x = sweepFilter(noise(dur, rng, 'pink'), f0, f1, q, 'bp');
  const n = x.length;
  const pk = Math.max(1, Math.round(n * peakAt));
  for (let i = 0; i < n; i++) {
    const e = i < pk ? Math.sin((Math.PI / 2) * (i / pk)) : Math.cos((Math.PI / 2) * ((i - pk) / Math.max(1, n - pk)));
    x[i] *= e * e * 2.2;
  }
  return x;
}

/** Impact sourd : sinus glissant de f0 à f1 avec décroissance. */
export function thump(f0: number, f1: number, dur: number, t60 = dur): Float32Array {
  const n = secs(dur);
  const fc = new Float32Array(n);
  for (let i = 0; i < n; i++) fc[i] = f1 + (f0 - f1) * Math.exp(-i / (0.03 * SR));
  const y = osc('sine', fc, n);
  applyEnv(y, expDecay(n, t60, 0.001));
  return y;
}

/** Clic résonant (horlogerie) : partiels très amortis + micro-impulsion. */
export function click(freqs: number[], t60: number, rng: Rng, amp = 1): Float32Array {
  const y = buf(t60 * 1.6 + 0.01);
  freqs.forEach((f, k) => addPartial(y, f, amp / (k + 1.3), t60 * (1 - k * 0.15), { phase: rng.next() }));
  const b = noise(0.004, rng);
  applyEnv(b, expDecay(b.length, 0.002));
  add(y, filt(b, 'highpass', 4000), 0, amp * 0.6);
  return y;
}

/** Cloche FM courte. */
export function fmBell(f: number, dur: number, ratio: number, index: number, idxDecay: number, t60: number): Float32Array {
  const n = secs(dur);
  const y = fmVoice(f, n, [{ ratio, index, indexDecay: idxDecay, indexSustain: 0.05 }]);
  applyEnv(y, expDecay(n, t60, 0.0008));
  return y;
}

/** Partiels inharmoniques métalliques (clang). */
export function metal(f: number, dur: number, rng: Rng, ratios = [1, 2.41, 3.93, 5.62, 7.3], t60 = 0.3): Float32Array {
  const y = buf(dur);
  ratios.forEach((r, k) => addPartial(y, f * r * (1 + rng.bi() * 0.004), 0.8 / (k + 1), t60 * (1 - k * 0.12), { phase: rng.next(), beatHz: rng.range(3, 9) }));
  return y;
}

/** Scintillement : petits « tintements » aigus aléatoires répartis sur `dur`. */
export function sparkle(dur: number, count: number, fLo: number, fHi: number, rng: Rng, rising = false): Float32Array {
  const y = buf(dur + 0.3);
  for (let k = 0; k < count; k++) {
    const p = rising ? k / Math.max(1, count - 1) : rng.next();
    const at = p * dur;
    const f = rising ? fLo * Math.pow(fHi / fLo, p) * (1 + rng.bi() * 0.05) : fLo * Math.pow(fHi / fLo, rng.next());
    const ping = buf(0.25);
    addPartial(ping, f, 0.5, rng.range(0.08, 0.2), { phase: rng.next(), attack: 0.001 });
    addPartial(ping, f * 2.76, 0.12, 0.05, { phase: rng.next() });
    add(y, ping, at, rng.range(0.4, 1));
  }
  return y;
}

/** Bulles : gazouillis montants (fréquence qui monte vite, amorti). */
export function bubbles(dur: number, count: number, fLo: number, fHi: number, rng: Rng): Float32Array {
  const y = buf(dur + 0.2);
  for (let k = 0; k < count; k++) {
    const at = rng.next() * dur;
    const f = fLo * Math.pow(fHi / fLo, rng.next());
    const bl = rng.range(0.03, 0.08);
    const n = secs(bl);
    const fc = new Float32Array(n);
    for (let i = 0; i < n; i++) fc[i] = f * (1 + 1.2 * (i / n) * (i / n));
    const b = osc('sine', fc, n);
    applyEnv(b, expDecay(n, bl, 0.002));
    add(y, b, at, rng.range(0.3, 0.8));
  }
  return y;
}

/** Crépitements (feu) : impulsions filtrées aléatoires. */
export function crackle(dur: number, density: number, rng: Rng): Float32Array {
  const y = buf(dur + 0.05);
  const count = Math.round(dur * density);
  for (let k = 0; k < count; k++) {
    const at = rng.next() * dur;
    const c = noise(rng.range(0.002, 0.008), rng);
    applyEnv(c, expDecay(c.length, 0.003));
    add(y, filt(c, 'bandpass', rng.range(1500, 6000), 1.2), at, rng.range(0.3, 1));
  }
  return y;
}

/** Cliquet / engrenage : série de clics, intervalle variant de i0 à i1 (s). */
export function ratchet(dur: number, i0: number, i1: number, f: number, rng: Rng, amp = 1): Float32Array {
  const y = buf(dur + 0.05);
  let t = 0;
  let k = 0;
  while (t < dur) {
    const p = t / dur;
    add(y, click([f * (1 + rng.bi() * 0.03), f * 1.53, f * 2.37], 0.012, rng), t, amp * (0.6 + 0.4 * rng.next()));
    t += i0 + (i1 - i0) * p;
    k++;
    if (k > 400) break;
  }
  return y;
}

/** Tonalité « soufflée » (vent, flûte de pan) : bruit filtré résonant à fréquence f. */
export function breathTone(dur: number, f: number, rng: Rng, q = 12): Float32Array {
  return modLowpass(noise(dur, rng, 'white'), f, q, 'bp');
}

/** Inverse un signal (pour les montées « à l'envers »). */
export function reverse(x: Float32Array): Float32Array {
  return Float32Array.from(x).reverse();
}

/** Mono → stéréo avec pan et léger effet de largeur (retard de Haas sur un canal). */
export function stereoize(x: Float32Array, pan = 0, widthMs = 0): Stereo {
  const p = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  const gl = Math.cos(p) * Math.SQRT2;
  const gr = Math.sin(p) * Math.SQRT2;
  const d = Math.round((widthMs / 1000) * SR);
  const out = makeStereo(x.length + d);
  for (let i = 0; i < x.length; i++) {
    out.l[i] += x[i] * gl;
    out.r[i + d] += x[i] * gr;
  }
  return out;
}

/** Ajoute une pièce courte (FDN) : renvoie un tampon stéréo sec + humide, queue incluse. */
export function room(x: Float32Array | Stereo, rt60: number, mix: number, size = 0.6, damping = 6500): Stereo {
  const s = x instanceof Float32Array ? { l: Float32Array.from(x), r: Float32Array.from(x) } : x;
  const tail = secs(Math.min(2.5, rt60 * 0.9));
  const n = s.l.length + tail;
  const ext = makeStereo(n);
  ext.l.set(s.l);
  ext.r.set(s.r);
  // Petites pièces : Freeverb (Schroeder/Moorer) ; salles plus longues : réseau FDN.
  let wet: Stereo;
  if (rt60 <= 0.8) {
    // Gain des peignes pour un retard moyen de ≈ 30 ms : g = 10^(-3·0,03/rt60).
    const g = Math.pow(10, (-3 * 0.03) / Math.max(0.2, rt60));
    wet = freeverb(ext, { room: Math.min(1, Math.max(0, (g - 0.7) / 0.28)), damp: 0.45, width: 0.8 });
    for (let i = 0; i < n; i++) {
      wet.l[i] *= 1.6;
      wet.r[i] *= 1.6;
    }
  } else {
    wet = hallReverb(ext, { rt60, size, damping, preDelay: 0.008, lowCut: 250, highCut: 10000, mod: 3 });
  }
  for (let i = 0; i < n; i++) {
    ext.l[i] += wet.l[i] * mix;
    ext.r[i] += wet.r[i] * mix;
  }
  return ext;
}

/** Version mono d'une pièce courte (moyenne des deux canaux). */
export function roomMono(x: Float32Array, rt60: number, mix: number, size = 0.6): Float32Array {
  const s = room(x, rt60, mix, size);
  const out = new Float32Array(s.l.length);
  for (let i = 0; i < out.length; i++) out[i] = 0.5 * (s.l[i] + s.r[i]);
  return out;
}

export function drive(x: Float32Array, amount: number): Float32Array {
  return saturate(x, amount);
}

export { TAU, SR, Rng, midiToFreq, osc, addPartial, applyEnv, expDecay };
