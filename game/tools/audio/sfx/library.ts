/**
 * Bibliothèque des effets sonores d'Orrhéa (49 SFX). Chaque effet est une petite « recette »
 * de synthèse ; le niveau final est normalisé par render.ts (sonie max sur 200 ms → `level`),
 * avec plafond de crête vraie. Les variations de hauteur sont appliquées à l'exécution
 * (`pitchVar`, en cents), de même que la polyphonie (`maxVoices`, `group`) et l'anti-répétition
 * (`throttleMs`).
 */
import type { Rng, Stereo } from '../dsp/core';
import * as I from '../instruments';
import { noteToMidi as n } from '../seq/theory';
import {
  buf, add, gain, shape, fadeOutEnd, note, notes, glide, noise, sweepFilter, filt, whoosh, thump, click, fmBell, metal,
  sparkle, bubbles, crackle, ratchet, reverse, stereoize, room, roomMono, drive, addPartial, expDecay, applyEnv, osc, midiToFreq,
} from './kit';

export const SFX_IDS = [
  'uiClick', 'uiHover', 'uiOpen', 'uiClose', 'uiError', 'timerTick', 'gold',
  'buy', 'sell', 'reroll', 'levelUp', 'starUp2', 'starUp3', 'traitActivate', 'itemEquip', 'itemCombine', 'lock',
  'attackMelee', 'attackRanged', 'attackMagic', 'impactPhysical', 'impactMagic', 'impactTrue', 'crit', 'heal', 'shield',
  'shieldBreak', 'stun', 'explosion', 'summon', 'death', 'revive', 'execute',
  'castZenith', 'castSelene', 'castRouage', 'castSylve', 'castAbysse', 'castBraise', 'castNomade', 'castAstral',
  'roundStart', 'combatStart', 'roundWin', 'roundLoss', 'overtime', 'eliminated', 'carouselPick', 'victoryFanfare',
] as const;
export type SfxIdT = (typeof SFX_IDS)[number];

export interface SfxDef {
  id: SfxIdT;
  bus: 'ui' | 'sfx';
  stereo: boolean;
  /** Sonie maximale visée sur une fenêtre de 200 ms (LUFS). */
  level: number;
  /** Variation aléatoire de hauteur à l'exécution (± cents). */
  pitchVar: number;
  maxVoices: number;
  throttleMs: number;
  group?: string;
  description: string;
  render(rng: Rng): Float32Array | Stereo;
}

type Def = Omit<SfxDef, 'id'>;
const UI = (d: Omit<Def, 'bus'>): Def => ({ ...d, bus: 'ui' });
const FX = (d: Omit<Def, 'bus'>): Def => ({ ...d, bus: 'sfx' });

/** Mixage de couches sur `len` secondes ; ce qui dépasse s'éteint par un fondu (pas de clic). */
const mix = (len: number, parts: Array<[Float32Array, number, number?]>): Float32Array => {
  const out = buf(len);
  let over = false;
  for (const [x, at, g] of parts) {
    add(out, x, at, g ?? 1);
    if (at + x.length / 44100 > len + 1e-6) over = true;
  }
  if (over) fadeOutEnd(out, Math.min(0.15, len * 0.3));
  return out;
};

const DEFS: Record<SfxIdT, Def> = {
  // ------------------------------------------------------------------------------- Interface
  uiClick: UI({
    stereo: false, level: -22, pitchVar: 25, maxVoices: 3, throttleMs: 30,
    description: "Clic d'horlogerie net (échappement).",
    render: (r) => mix(0.08, [[click([2900, 4400, 6600], 0.022, r), 0], [gain(thump(1300, 900, 0.03, 0.02), 0.25), 0]]),
  }),
  uiHover: UI({
    stereo: false, level: -28, pitchVar: 40, maxVoices: 2, throttleMs: 45,
    description: 'Tintement très léger de verre.',
    render: (r) => {
      const y = buf(0.09);
      addPartial(y, 2350, 0.6, 0.06, { phase: r.next(), attack: 0.002 });
      addPartial(y, 5120, 0.12, 0.025, { phase: r.next() });
      return y;
    },
  }),
  uiOpen: UI({
    stereo: false, level: -22, pitchVar: 0, maxVoices: 2, throttleMs: 80,
    description: 'Deux notes de célesta montantes et un souffle ascendant.',
    render: (r) => roomMono(mix(0.4, [[note(I.celesta, n('A5'), 0.1, 0.55, r), 0], [note(I.celesta, n('E6'), 0.15, 0.6, r), 0.06], [whoosh(0.22, 700, 3200, r, 1.2, 0.7), 0, 0.35]]), 0.7, 0.18),
  }),
  uiClose: UI({
    stereo: false, level: -23, pitchVar: 0, maxVoices: 2, throttleMs: 80,
    description: 'Deux notes descendantes et un souffle qui retombe.',
    render: (r) => roomMono(mix(0.38, [[note(I.celesta, n('E6'), 0.1, 0.55, r), 0], [note(I.celesta, n('A5'), 0.15, 0.5, r), 0.06], [whoosh(0.2, 3000, 700, r, 1.2, 0.3), 0, 0.3]]), 0.6, 0.15),
  }),
  uiError: UI({
    stereo: false, level: -20, pitchVar: 0, maxVoices: 1, throttleMs: 200,
    description: 'Double « bonk » grave en seconde mineure.',
    render: () => {
      const tone = (f: number): Float32Array => {
        const x = osc('tri', f, Math.round(0.11 * 44100));
        add(x, osc('square', f, x.length), 0, 0.25);
        filt(x, 'lowpass', 1400, 0.7);
        return shape(x, [[0, 0], [0.005, 1], [0.07, 0.6], [0.11, 0]]);
      };
      return mix(0.3, [[tone(220), 0], [tone(207.6), 0], [tone(196), 0.13], [tone(185), 0.13]]);
    },
  }),
  timerTick: UI({
    stereo: false, level: -23, pitchVar: 0, maxVoices: 2, throttleMs: 90,
    description: 'Tic du compte à rebours.',
    render: (r) => mix(0.1, [[note(I.tick, n('E5'), 0.05, 0.9, r), 0], [gain(thump(800, 600, 0.04, 0.03), 0.15), 0]]),
  }),
  gold: UI({
    stereo: false, level: -20, pitchVar: 70, maxVoices: 4, throttleMs: 45,
    description: "Tintement de pièce d'or (cloche FM).",
    render: (r) => {
      const s = noise(0.03, r);
      applyEnv(s, expDecay(s.length, 0.02));
      return mix(0.4, [[fmBell(2093, 0.35, 1.41, 2.2, 0.03, 0.25), 0], [fmBell(2637, 0.3, 1.41, 1.6, 0.03, 0.2), 0.035, 0.5], [filt(s, 'highpass', 6000), 0, 0.2]]);
    },
  }),

  // ---------------------------------------------------------------------- Boutique / progression
  buy: UI({
    stereo: false, level: -18, pitchVar: 0, maxVoices: 2, throttleMs: 60,
    description: 'Arpège majeur pincé + pièce.',
    render: (r) => {
      const arp = notes(I.harp, [[0, n('D5'), 0.15, 0.7], [0.05, n('F#5'), 0.15, 0.7], [0.1, n('A5'), 0.3, 0.75]], r, 0.7);
      const cel = notes(I.celesta, [[0.1, n('D6'), 0.2, 0.45]], r, 0.7);
      return roomMono(mix(0.7, [[arp, 0], [cel, 0, 0.6], [fmBell(2637, 0.3, 1.41, 1.8, 0.03, 0.2), 0.02, 0.4]]), 0.8, 0.15);
    },
  }),
  sell: UI({
    stereo: false, level: -19, pitchVar: 0, maxVoices: 2, throttleMs: 60,
    description: 'Deux notes descendantes, pièces qui tombent.',
    render: (r) => {
      const d = notes(I.celesta, [[0, n('A5'), 0.12, 0.6], [0.08, n('D5'), 0.25, 0.55]], r, 0.6);
      const coins = mix(0.5, [[fmBell(2349, 0.25, 1.41, 1.6, 0.02, 0.15), 0.12, 0.4], [fmBell(1975, 0.25, 1.41, 1.6, 0.02, 0.15), 0.19, 0.3]]);
      return roomMono(mix(0.6, [[d, 0], [coins, 0], [whoosh(0.25, 2500, 600, r, 1, 0.3), 0, 0.2]]), 0.7, 0.15);
    },
  }),
  reroll: UI({
    stereo: false, level: -18, pitchVar: 30, maxVoices: 2, throttleMs: 120,
    description: "Engrenages qui tournent (cliquet accélérant) et souffle de cartes.",
    render: (r) => {
      const gears = ratchet(0.36, 0.045, 0.014, 2600, r);
      const sw = whoosh(0.4, 500, 2800, r, 1.1, 0.75);
      const end = note(I.chime, n('A6'), 0.1, 0.35, r);
      return roomMono(mix(0.7, [[gears, 0, 0.8], [sw, 0, 0.5], [end, 0.38, 0.5]]), 0.6, 0.12);
    },
  }),
  levelUp: FX({
    stereo: true, level: -14, pitchVar: 0, maxVoices: 1, throttleMs: 400,
    description: 'Arpège ascendant célesta + harpe, cloche et scintillement.',
    render: (r) => {
      const seq = [n('D5'), n('A5'), n('D6'), n('E6'), n('F#6'), n('A6')];
      const cel = notes(I.celesta, seq.map((m, k) => [k * 0.06, m, 0.3, 0.6 + k * 0.05] as const), r, 1.6);
      const hp = notes(I.harp, seq.map((m, k) => [k * 0.06, m - 12, 0.3, 0.6] as const), r, 1.6);
      const bell = note(I.bell, n('D5'), 0.5, 0.45, r);
      const sp = sparkle(0.6, 14, 3000, 9000, r, true);
      const choir = notes(I.choir('a'), [[0.2, n('D4'), 0.6, 0.5], [0.2, n('F#4'), 0.6, 0.45], [0.2, n('A4'), 0.6, 0.45]], r, 1.6);
      const x = mix(1.6, [[cel, 0], [hp, 0, 0.7], [bell, 0.34, 0.5], [sp, 0.3, 0.25], [choir, 0, 0.35]]);
      return room(stereoize(x, 0, 0), 1.6, 0.3, 0.9);
    },
  }),
  starUp2: FX({
    stereo: false, level: -15, pitchVar: 0, maxVoices: 2, throttleMs: 250,
    description: 'Accord de carillon brillant égrené, montée scintillante.',
    render: (r) => {
      const strum = notes(I.glock, [[0, n('C6'), 0.3, 0.7], [0.04, n('E6'), 0.3, 0.7], [0.08, n('G6'), 0.4, 0.75]], r, 1.1);
      const cel = notes(I.celesta, [[0, n('C5'), 0.3, 0.6], [0.04, n('G5'), 0.3, 0.6], [0.08, n('E6'), 0.4, 0.6]], r, 1.1);
      return roomMono(mix(1.1, [[strum, 0], [cel, 0, 0.7], [sparkle(0.35, 8, 3500, 8000, r, true), 0.05, 0.3]]), 1.2, 0.22, 0.8);
    },
  }),
  starUp3: FX({
    stereo: true, level: -12, pitchVar: 0, maxVoices: 1, throttleMs: 400,
    description: 'Cloche, chœur en ré majeur, cascade de scintillements, coup grave.',
    render: (r) => {
      const bell = note(I.bell, n('D4'), 1, 0.6, r);
      const choir = notes(I.choir('a'), [[0, n('D4'), 0.9, 0.6], [0, n('A4'), 0.9, 0.55], [0, n('F#5'), 0.9, 0.5]], r, 2);
      const casc = sparkle(0.9, 24, 2500, 10000, r, true);
      const strum = notes(I.glock, [[0, n('D6'), 0.3, 0.7], [0.05, n('F#6'), 0.3, 0.7], [0.1, n('A6'), 0.4, 0.7], [0.15, n('D7'), 0.5, 0.7]], r, 2);
      const boom = thump(110, 45, 0.6, 0.5);
      const x = mix(2, [[bell, 0, 0.6], [choir, 0, 0.5], [casc, 0.05, 0.3], [strum, 0, 0.6], [boom, 0, 0.5]]);
      return room(stereoize(x, 0, 0), 2, 0.3, 1);
    },
  }),
  traitActivate: FX({
    stereo: false, level: -17, pitchVar: 0, maxVoices: 2, throttleMs: 150,
    description: 'Verrouillage magique : clic, cloche FM, nappe montante, scintillement.',
    render: (r) => {
      const pad = notes(I.glassPad, [[0, n('A4'), 0.35, 0.8], [0, n('E5'), 0.35, 0.7]], r, 1);
      shape(pad, [[0, 0], [0.15, 1], [0.5, 0.6], [1, 0]]);
      return roomMono(mix(1, [[click([2200, 3300], 0.03, r), 0, 0.6], [fmBell(880, 0.8, 3.5, 1.4, 0.15, 0.6), 0.02, 0.45], [pad, 0, 1.2], [sparkle(0.3, 6, 3000, 7000, r, true), 0.1, 0.25]]), 1, 0.2);
    },
  }),
  itemEquip: FX({
    stereo: false, level: -18, pitchVar: 60, maxVoices: 3, throttleMs: 60,
    description: 'Cliquetis métallique et petit éclat.',
    render: (r) => {
      const s = noise(0.02, r);
      applyEnv(s, expDecay(s.length, 0.012));
      return roomMono(mix(0.45, [[metal(520, 0.35, r, [1, 2.41, 3.93, 5.62], 0.15), 0], [filt(s, 'bandpass', 3500, 1), 0, 0.5], [note(I.glock, n('E6'), 0.1, 0.35, r), 0.04, 0.4]]), 0.5, 0.12);
    },
  }),
  itemCombine: FX({
    stereo: false, level: -16, pitchVar: 0, maxVoices: 2, throttleMs: 200,
    description: "Forge : deux coups d'enclume puis fusion magique ascendante.",
    render: (r) => {
      const hit = (f: number): Float32Array => mix(0.4, [[metal(f, 0.4, r, [1, 2.76, 4.1, 5.4, 6.8], 0.25), 0], [thump(180, 90, 0.1, 0.08), 0, 0.5]]);
      const fusion = fmBell(440, 0.6, 2, 3, 0.4, 0.5);
      const rise = glide(0.5, 440, 1320, 'sine', 0.8);
      shape(rise, [[0, 0], [0.3, 0.5], [0.5, 0]]);
      return roomMono(mix(1.2, [[hit(700), 0], [hit(760), 0.13], [fusion, 0.3, 0.4], [rise, 0.28, 0.25], [sparkle(0.5, 12, 2500, 9000, r, true), 0.32, 0.3]]), 1.1, 0.2);
    },
  }),
  lock: UI({
    stereo: false, level: -21, pitchVar: 0, maxVoices: 2, throttleMs: 80,
    description: 'Loquet : « clac » grave puis « tic » aigu.',
    render: (r) => mix(0.3, [[click([1200, 1900, 3100], 0.04, r), 0], [click([3400, 5200], 0.02, r), 0.07, 0.6], [metal(1800, 0.2, r, [1, 2.4], 0.08), 0.07, 0.15]]),
  }),

  // ------------------------------------------------------------------------------------ Combat
  attackMelee: FX({
    stereo: false, level: -20, pitchVar: 120, maxVoices: 6, throttleMs: 25, group: 'attack',
    description: 'Fendant : souffle rapide et léger « shing ».',
    render: (r) => {
      const sh = noise(0.08, r);
      applyEnv(sh, expDecay(sh.length, 0.06));
      return mix(0.25, [[whoosh(0.18, 500, 2600, r, 1.6, 0.55), 0], [filt(sh, 'highpass', 5000), 0.06, 0.25], [metal(3200, 0.12, r, [1, 1.7], 0.07), 0.07, 0.08]]);
    },
  }),
  attackRanged: FX({
    stereo: false, level: -20, pitchVar: 120, maxVoices: 6, throttleMs: 25, group: 'attack',
    description: 'Corde qui claque et trait qui file.',
    render: (r) => {
      const twang = note(I.pluckBass, n('A2'), 0.06, 0.8, r);
      return mix(0.3, [[filt(twang, 'highpass', 90), 0, 0.6], [whoosh(0.13, 1500, 4200, r, 2, 0.4), 0.02, 0.8]]);
    },
  }),
  attackMagic: FX({
    stereo: false, level: -20, pitchVar: 100, maxVoices: 6, throttleMs: 25, group: 'attack',
    description: 'Éclair arcanique : ton FM qui plonge, étincelles.',
    render: (r) => {
      const n0 = Math.round(0.26 * 44100);
      const fc = new Float32Array(n0);
      for (let i = 0; i < n0; i++) fc[i] = 1300 * Math.pow(500 / 1300, i / n0);
      const z = fmVoiceCurve(fc, 2.5, 3, 0.12);
      shape(z, [[0, 0], [0.01, 1], [0.12, 0.5], [0.26, 0]]);
      return mix(0.32, [[z, 0, 0.6], [sparkle(0.15, 6, 3000, 8000, r), 0, 0.3]]);
    },
  }),
  impactPhysical: FX({
    stereo: false, level: -19, pitchVar: 140, maxVoices: 6, throttleMs: 25, group: 'impact',
    description: 'Coup sourd : sinus qui chute, bruit étouffé, craquement.',
    render: (r) => {
      const nb = noise(0.05, r);
      applyEnv(nb, expDecay(nb.length, 0.04));
      const cr = noise(0.02, r);
      applyEnv(cr, expDecay(cr.length, 0.015));
      return drive(mix(0.28, [[thump(150, 55, 0.25, 0.16), 0], [filt(nb, 'lowpass', 1200), 0, 0.6], [filt(cr, 'bandpass', 1800, 1.2), 0, 0.4]]), 1.5);
    },
  }),
  impactMagic: FX({
    stereo: false, level: -19, pitchVar: 120, maxVoices: 6, throttleMs: 25, group: 'impact',
    description: 'Impact cristallin : cloche FM brève, souffle aigu, coup léger.',
    render: (r) => {
      const hs = noise(0.04, r);
      applyEnv(hs, expDecay(hs.length, 0.03));
      return mix(0.38, [[fmBell(1320, 0.35, 2.7, 2.2, 0.05, 0.22), 0, 0.6], [filt(hs, 'highpass', 3000), 0, 0.4], [thump(220, 110, 0.12, 0.08), 0, 0.35]]);
    },
  }),
  impactTrue: FX({
    stereo: false, level: -19, pitchVar: 100, maxVoices: 6, throttleMs: 25, group: 'impact',
    description: 'Percée pure : ton aigu modulé en anneau, éclat blanc.',
    render: (r) => {
      const a = glide(0.3, 2100, 1700, 'sine', 0.5);
      const b = glide(0.3, 3150, 2550, 'sine', 0.5);
      for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.7 + a[i] * b[i] * 0.6;
      applyEnv(a, expDecay(a.length, 0.22, 0.001));
      const hs = noise(0.03, r);
      applyEnv(hs, expDecay(hs.length, 0.02));
      return mix(0.32, [[a, 0, 0.6], [filt(hs, 'highpass', 6000), 0, 0.4], [thump(300, 150, 0.08, 0.05), 0, 0.3]]);
    },
  }),
  crit: FX({
    stereo: false, level: -14, pitchVar: 80, maxVoices: 3, throttleMs: 60, group: 'impact',
    description: 'Coup critique : double impact lourd, anneau métallique, sub.',
    render: (r) => {
      const nb = noise(0.06, r);
      applyEnv(nb, expDecay(nb.length, 0.05));
      const body = drive(mix(0.35, [[thump(170, 50, 0.35, 0.25), 0], [filt(nb, 'lowpass', 2000), 0, 0.7], [thump(120, 45, 0.3, 0.2), 0.03, 0.6]]), 2);
      return roomMono(mix(0.6, [[body, 0], [metal(830, 0.5, r, [1, 2.3, 3.7, 5.1], 0.35), 0.01, 0.35], [sparkle(0.12, 5, 4000, 9000, r), 0.01, 0.25]]), 0.6, 0.12);
    },
  }),
  heal: FX({
    stereo: false, level: -20, pitchVar: 40, maxVoices: 4, throttleMs: 80,
    description: 'Arpège de verre montant (fa lydien), souffle lumineux.',
    render: (r) => {
      const arp = notes(I.celesta, [[0, n('F5'), 0.25, 0.5], [0.07, n('A5'), 0.25, 0.5], [0.14, n('C6'), 0.25, 0.55], [0.21, n('E6'), 0.4, 0.55], [0.28, n('B6'), 0.4, 0.4]], r, 1);
      const air = noise(0.8, r, 'pink');
      filt(air, 'highpass', 3000);
      shape(air, [[0, 0], [0.3, 0.25], [0.8, 0]]);
      const pad = notes(I.glassPad, [[0, n('F4'), 0.4, 0.6], [0, n('C5'), 0.4, 0.5]], r, 1);
      shape(pad, [[0, 0], [0.12, 1], [0.6, 0.4], [1, 0]]);
      return roomMono(mix(1, [[arp, 0], [air, 0, 0.3], [pad, 0, 1]]), 1, 0.22);
    },
  }),
  shield: FX({
    stereo: false, level: -19, pitchVar: 40, maxVoices: 4, throttleMs: 80,
    description: 'Bourdon de verre qui enfle et tinte (bouclier).',
    render: (r) => {
      const hum = fmVoiceCurve(new Float32Array(Math.round(0.6 * 44100)).fill(440), 2.01, 1.2, 0.5);
      add(hum, osc('sine', 659.3, hum.length), 0, 0.4);
      shape(hum, [[0, 0], [0.08, 1], [0.35, 0.6], [0.6, 0]]);
      return roomMono(mix(0.75, [[hum, 0, 0.5], [note(I.bell, n('A6'), 0.2, 0.4, r), 0.05, 0.4], [sparkle(0.3, 5, 4000, 8000, r), 0.05, 0.2]]), 0.8, 0.2);
    },
  }),
  shieldBreak: FX({
    stereo: false, level: -16, pitchVar: 60, maxVoices: 3, throttleMs: 60,
    description: 'Verre qui vole en éclats, coup sourd.',
    render: (r) => {
      const shards = buf(0.8);
      for (let k = 0; k < 28; k++) {
        const p = Math.pow(r.next(), 1.6);
        const ping = buf(0.2);
        addPartial(ping, r.range(2000, 9000), 0.5, r.range(0.03, 0.12), { phase: r.next() });
        add(shards, ping, p * 0.35, r.range(0.3, 1) * (1 - p * 0.6));
      }
      const burst = noise(0.12, r);
      applyEnv(burst, expDecay(burst.length, 0.08));
      return roomMono(mix(0.9, [[shards, 0, 0.6], [filt(burst, 'highpass', 2500), 0, 0.5], [thump(180, 70, 0.2, 0.15), 0, 0.6]]), 0.7, 0.15);
    },
  }),
  stun: FX({
    stereo: false, level: -19, pitchVar: 50, maxVoices: 3, throttleMs: 80,
    description: 'Étoiles qui tournoient : sifflets vibrés, carillon.',
    render: (r) => {
      const bird = (f: number, d: number): Float32Array => {
        const len = Math.round(d * 44100);
        const fc = new Float32Array(len);
        for (let i = 0; i < len; i++) fc[i] = f * (1 + 0.06 * Math.sin((2 * Math.PI * 9 * i) / 44100));
        const x = osc('sine', fc, len);
        return shape(x, [[0, 0], [0.02, 1], [d * 0.7, 0.6], [d, 0]]);
      };
      return roomMono(mix(0.8, [[bird(2400, 0.22), 0, 0.4], [bird(2000, 0.22), 0.15, 0.4], [bird(2700, 0.25), 0.3, 0.35], [note(I.chime, n('E6'), 0.2, 0.3, r), 0, 0.5]]), 0.6, 0.18);
    },
  }),
  explosion: FX({
    stereo: true, level: -12, pitchVar: 80, maxVoices: 3, throttleMs: 60,
    description: 'Explosion : souffle filtré qui se referme, sub, crépitements.',
    render: (r) => {
      const blastL = sweepFilter(noise(1.2, r, 'pink'), 6000, 250, 0.7, 'lp', 0.5);
      const blastR = sweepFilter(noise(1.2, r, 'pink'), 6000, 250, 0.7, 'lp', 0.5);
      for (const b of [blastL, blastR]) applyEnv(b, expDecay(b.length, 0.9, 0.003));
      const sub = drive(thump(85, 32, 1.2, 0.9), 1.5);
      const cr = crackle(0.8, 40, r);
      const L = mix(1.4, [[blastL, 0, 1], [sub, 0, 0.9], [cr, 0.05, 0.3]]);
      const R = mix(1.4, [[blastR, 0, 1], [sub, 0, 0.9], [cr, 0.07, 0.3]]);
      return room({ l: L, r: R }, 1.4, 0.3, 1);
    },
  }),
  summon: FX({
    stereo: false, level: -16, pitchVar: 40, maxVoices: 2, throttleMs: 120,
    description: 'Tourbillon montant, chœur qui enfle, cloche.',
    render: (r) => {
      const swirl = whoosh(0.7, 300, 3200, r, 2, 0.9);
      const choir = notes(I.choir('o'), [[0.1, n('D4'), 0.6, 0.6], [0.1, n('A4'), 0.6, 0.55]], r, 1.3);
      shape(choir, [[0, 0], [0.6, 1], [1.3, 0]]);
      return roomMono(mix(1.3, [[swirl, 0, 0.7], [choir, 0, 0.8], [note(I.chime, n('D6'), 0.3, 0.5, r), 0.65, 0.5]]), 1.2, 0.25);
    },
  }),
  death: FX({
    stereo: false, level: -18, pitchVar: 60, maxVoices: 4, throttleMs: 50,
    description: 'Ton qui retombe et se dissipe.',
    render: (r) => {
      const fall = glide(0.7, 520, 110, 'tri', 0.7);
      filt(fall, 'lowpass', 2000);
      shape(fall, [[0, 0], [0.02, 1], [0.4, 0.5], [0.7, 0]]);
      const dust = noise(0.9, r, 'pink');
      filt(dust, 'lowpass', 1500);
      shape(dust, [[0, 0], [0.1, 0.4], [0.9, 0]]);
      return roomMono(mix(1, [[fall, 0, 0.6], [dust, 0, 0.35], [thump(120, 50, 0.2, 0.15), 0, 0.4]]), 0.9, 0.18);
    },
  }),
  revive: FX({
    stereo: false, level: -15, pitchVar: 0, maxVoices: 2, throttleMs: 150,
    description: 'Montée inversée puis accord lumineux de ré majeur.',
    render: (r) => {
      const sw = reverse(whoosh(0.5, 400, 3000, r, 1.5, 0.3));
      const chord = notes(I.celesta, [[0, n('D5'), 0.5, 0.6], [0.03, n('F#5'), 0.5, 0.6], [0.06, n('A5'), 0.5, 0.6], [0.09, n('D6'), 0.6, 0.65]], r, 1);
      const glass = notes(I.glassPad, [[0, n('D4'), 0.5, 0.7], [0, n('A4'), 0.5, 0.6]], r, 1);
      shape(glass, [[0, 0], [0.1, 1], [1, 0]]);
      return roomMono(mix(1.4, [[sw, 0, 0.6], [chord, 0.48], [glass, 0.48, 0.8], [note(I.bell, n('D5'), 0.4, 0.35, r), 0.5, 0.35]]), 1.2, 0.22);
    },
  }),
  execute: FX({
    stereo: false, level: -13, pitchVar: 40, maxVoices: 2, throttleMs: 120,
    description: 'Exécution : tranchant lourd, boum grave, gong bref.',
    render: (r) => {
      const slash = whoosh(0.16, 800, 4000, r, 1.6, 0.5);
      const boom = drive(thump(110, 38, 0.8, 0.6), 1.8);
      const gong = note(I.gong, n('A2'), 0.3, 0.6, r);
      shape(gong, [[0, 1], [0.6, 0.5], [1.4, 0]]);
      return roomMono(mix(1.4, [[slash, 0, 0.8], [boom, 0.1, 0.9], [gong, 0.1, 0.6], [metal(640, 0.6, r, [1, 2.3, 3.6], 0.4), 0.1, 0.25]]), 1, 0.2);
    },
  }),

  // ----------------------------------------------------------------- Signatures de faction
  castZenith: FX({
    stereo: false, level: -16, pitchVar: 30, maxVoices: 3, throttleMs: 100, group: 'cast',
    description: 'Zénith (chevaliers solaires) : accord de cuivres radieux, rayon aigu, éclats dorés.',
    render: (r) => {
      const brass = notes(I.brassStab, [[0, n('D4'), 0.35, 0.8], [0, n('F#4'), 0.35, 0.75], [0, n('A4'), 0.35, 0.75], [0, n('D5'), 0.35, 0.7]], r, 1);
      const ray = osc('sine', midiToFreq(n('A6')), Math.round(0.9 * 44100));
      add(ray, osc('sine', midiToFreq(n('E7')), ray.length), 0, 0.3);
      shape(ray, [[0, 0], [0.3, 0.4], [0.9, 0]]);
      return roomMono(mix(1.1, [[brass, 0], [ray, 0.05, 0.25], [sparkle(0.6, 14, 3000, 9000, r, true), 0.05, 0.3]]), 1.1, 0.22);
    },
  }),
  castSelene: FX({
    stereo: false, level: -16, pitchVar: 30, maxVoices: 3, throttleMs: 100, group: 'cast',
    description: 'Sélène (mystiques lunaires) : chœur « ou » en mi mineur, carillons argentés descendants.',
    render: (r) => {
      const choir = notes(I.choir('u', { attack: 0.12 }), [[0, n('E4'), 0.6, 0.6], [0, n('G4'), 0.6, 0.55], [0, n('B4'), 0.6, 0.55], [0, n('F#5'), 0.6, 0.4]], r, 1.3);
      const ch = notes(I.chime, [[0.05, n('B6'), 0.2, 0.4], [0.17, n('G6'), 0.2, 0.38], [0.29, n('E6'), 0.3, 0.36]], r, 1.3);
      return roomMono(mix(1.3, [[choir, 0, 0.9], [ch, 0, 0.6], [sparkle(0.6, 8, 4000, 8000, r), 0.1, 0.15]]), 1.6, 0.3, 0.9);
    },
  }),
  castRouage: FX({
    stereo: false, level: -16, pitchVar: 40, maxVoices: 3, throttleMs: 100, group: 'cast',
    description: 'Rouage (ingénieurs horlogers) : engrenages, jet de vapeur, choc de cuivre, ressort.',
    render: (r) => {
      const gears = ratchet(0.35, 0.03, 0.02, 1800, r);
      const steam = noise(0.5, r);
      filt(steam, 'highpass', 3500);
      shape(steam, [[0, 0], [0.04, 0.6], [0.5, 0]]);
      const len = Math.round(0.45 * 44100);
      const fc = new Float32Array(len);
      for (let i = 0; i < len; i++) fc[i] = 330 * (1 + 0.25 * Math.exp(-i / (0.15 * 44100)) * Math.sin((2 * Math.PI * 14 * i) / 44100));
      const spring = osc('tri', fc, len);
      applyEnv(spring, expDecay(len, 0.4, 0.002));
      return roomMono(mix(0.95, [[gears, 0, 0.7], [steam, 0.12, 0.25], [metal(410, 0.5, r, [1, 2.2, 3.4, 4.9], 0.3), 0.12, 0.45], [spring, 0.14, 0.35]]), 0.7, 0.15);
    },
  }),
  castSylve: FX({
    stereo: false, level: -16, pitchVar: 40, maxVoices: 3, throttleMs: 100, group: 'cast',
    description: 'Sylve (forêt ancienne) : appel de flûte boisée, bruissement de feuilles, grondement de bête.',
    render: (r) => {
      const fl = notes(I.flute, [[0, n('D5'), 0.18, 0.7], [0.16, n('A5'), 0.35, 0.75]], r, 1);
      const leaves = noise(0.8, r, 'pink');
      filt(leaves, 'bandpass', 4500, 0.8);
      for (let i = 0; i < leaves.length; i++) leaves[i] *= Math.max(0, Math.sin(i * 0.0021) * Math.sin(i * 0.00071 + 1)) * 1.4;
      shape(leaves, [[0, 0], [0.1, 1], [0.8, 0]]);
      const growl = osc('saw', 68, Math.round(0.5 * 44100));
      for (let i = 0; i < growl.length; i++) growl[i] *= 0.6 + 0.4 * Math.sin((2 * Math.PI * 23 * i) / 44100);
      filt(growl, 'lowpass', 400);
      shape(growl, [[0, 0], [0.08, 1], [0.5, 0]]);
      return roomMono(mix(1, [[fl, 0, 0.8], [leaves, 0, 0.3], [growl, 0.05, 0.5]]), 1, 0.2);
    },
  }),
  castAbysse: FX({
    stereo: false, level: -16, pitchVar: 40, maxVoices: 3, throttleMs: 100, group: 'cast',
    description: 'Abysse (culte des profondeurs) : bulles, bourdon grave ondulant, chant de baleine.',
    render: (r) => {
      const deep = osc('sine', 46, Math.round(1 * 44100));
      for (let i = 0; i < deep.length; i++) deep[i] *= 0.7 + 0.3 * Math.sin((2 * Math.PI * 3 * i) / 44100);
      shape(deep, [[0, 0], [0.2, 1], [1, 0]]);
      const len = Math.round(0.9 * 44100);
      const fc = new Float32Array(len);
      for (let i = 0; i < len; i++) fc[i] = 320 * Math.pow(0.55, i / len) * (1 + 0.012 * Math.sin((2 * Math.PI * 5 * i) / 44100));
      const whale = osc('tri', fc, len);
      filt(whale, 'bandpass', 500, 0.8);
      shape(whale, [[0, 0], [0.15, 1], [0.9, 0]]);
      return roomMono(mix(1.1, [[bubbles(0.6, 14, 400, 1600, r), 0, 0.5], [drive(deep, 1.3), 0, 0.7], [whale, 0.05, 0.6]]), 1.6, 0.3, 1.1);
    },
  }),
  castBraise: FX({
    stereo: false, level: -16, pitchVar: 40, maxVoices: 3, throttleMs: 100, group: 'cast',
    description: 'Braise (revenants de feu) : embrasement soufflé, ton saturé qui monte, crépitements.',
    render: (r) => {
      const fire = whoosh(0.7, 300, 2200, r, 0.9, 0.4);
      const tone = drive(glide(0.6, 110, 230, 'saw', 0.7), 3);
      filt(tone, 'lowpass', 1800);
      shape(tone, [[0, 0], [0.1, 0.8], [0.6, 0]]);
      return roomMono(mix(1, [[fire, 0, 0.9], [tone, 0, 0.35], [crackle(0.8, 60, r), 0.05, 0.4]]), 0.8, 0.15);
    },
  }),
  castNomade: FX({
    stereo: false, level: -16, pitchVar: 40, maxVoices: 3, throttleMs: 100, group: 'cast',
    description: 'Nomade (caravanes célestes) : rafale de vent, luth pincé, clochettes de caravane.',
    render: (r) => {
      const wind = whoosh(0.9, 400, 1400, r, 2.5, 0.5);
      const lute = notes(I.lute, [[0, n('D4'), 0.12, 0.8], [0.08, n('A4'), 0.12, 0.75], [0.16, n('D5'), 0.3, 0.8]], r, 1);
      const bells = notes(I.chime, [[0.2, n('A6'), 0.15, 0.35], [0.26, n('D7'), 0.15, 0.3], [0.33, n('E7'), 0.15, 0.28]], r, 1);
      return roomMono(mix(1.1, [[wind, 0, 0.6], [lute, 0, 0.8], [bells, 0, 0.5]]), 0.9, 0.2);
    },
  }),
  castAstral: FX({
    stereo: false, level: -16, pitchVar: 30, maxVoices: 3, throttleMs: 100, group: 'cast',
    description: 'Astral (entités du vide) : carillon inversé, scintillement désaccordé, onde de sub.',
    render: (r) => {
      const rev = reverse(note(I.chime, n('E6'), 0.6, 0.6, r)).slice(-Math.round(0.7 * 44100));
      const shim = fmVoiceCurve(new Float32Array(Math.round(0.9 * 44100)).fill(midiToFreq(n('B5'))), 1.4142, 2, 0.4);
      add(shim, fmVoiceCurve(new Float32Array(Math.round(0.9 * 44100)).fill(midiToFreq(n('B5')) * 1.006), 1.4142, 2, 0.4), 0, 0.8);
      shape(shim, [[0, 0], [0.7, 0.8], [0.95, 0]]);
      const sub = osc('sine', 41, Math.round(1.1 * 44100));
      shape(sub, [[0, 0], [0.6, 1], [1.1, 0]]);
      return roomMono(mix(1.2, [[rev, 0, 0.6], [shim, 0, 0.3], [sub, 0, 0.6], [note(I.glock, n('B6'), 0.2, 0.4, r), 0.7, 0.4]]), 1.8, 0.3, 1.2);
    },
  }),

  // ------------------------------------------------------------------------------- Déroulé
  roundStart: FX({
    stereo: false, level: -15, pitchVar: 0, maxVoices: 1, throttleMs: 400,
    description: "Deux tics d'horloge puis la cloche de la Convergence.",
    render: (r) => {
      const t1 = note(I.tick, n('C5'), 0.05, 0.9, r);
      const t2 = note(I.tock, n('C5'), 0.05, 0.9, r);
      const bell = note(I.bell, n('D4'), 1, 0.7, r);
      shape(bell, [[0, 1], [1, 0.6], [1.6, 0]]);
      return roomMono(mix(1.8, [[t1, 0, 0.7], [t2, 0.2, 0.7], [bell, 0.4, 0.8], [note(I.chime, n('A5'), 0.3, 0.3, r), 0.42, 0.3]]), 1.4, 0.2);
    },
  }),
  combatStart: FX({
    stereo: true, level: -13, pitchVar: 0, maxVoices: 1, throttleMs: 400,
    description: 'Coup de taiko, accord de cuivres en ré mineur, cymbale.',
    render: (r) => {
      const taiko = note(I.taikoBig, n('A1'), 0.5, 1, r);
      const brass = notes(I.brassStab, [[0, n('D3'), 0.4, 0.85], [0, n('A3'), 0.4, 0.85], [0, n('D4'), 0.4, 0.85], [0, n('F4'), 0.4, 0.8], [0, n('A4'), 0.4, 0.75]], r, 1.4);
      const cym = note(I.cymbal, 60, 0.5, 0.6, r);
      shape(cym, [[0, 1], [0.6, 0.3], [1.4, 0]]);
      const x = mix(1.5, [[taiko, 0, 0.9], [brass, 0.01, 0.7], [cym, 0.01, 0.35]]);
      return room(stereoize(x, 0, 0), 1.3, 0.28, 1);
    },
  }),
  roundWin: FX({
    stereo: false, level: -15, pitchVar: 0, maxVoices: 1, throttleMs: 400,
    description: 'Motif bref et lumineux en ré majeur (célesta + harpe).',
    render: (r) => {
      const m: Array<readonly [number, number, number, number]> = [[0, n('A4'), 0.1, 0.6], [0.09, n('D5'), 0.1, 0.65], [0.18, n('F#5'), 0.1, 0.7], [0.27, n('A5'), 0.5, 0.8]];
      return roomMono(mix(1.2, [[notes(I.celesta, m, r, 1.2), 0], [notes(I.harp, m.map(([a, b, c, d]) => [a, b - 12, c, d * 0.8] as const), r, 1.2), 0, 0.7], [note(I.chime, n('D6'), 0.3, 0.4, r), 0.27, 0.4]]), 1.1, 0.2);
    },
  }),
  roundLoss: FX({
    stereo: false, level: -16, pitchVar: 0, maxVoices: 1, throttleMs: 400,
    description: 'Motif descendant en ré mineur, boîte à musique et violoncelle.',
    render: (r) => {
      const box = notes(I.musicBox, [[0, n('A5'), 0.15, 0.6], [0.16, n('F5'), 0.15, 0.55], [0.32, n('D5'), 0.5, 0.55]], r, 1.3);
      const cel = notes(I.celli, [[0, n('D3'), 0.8, 0.45]], r, 1.3);
      return roomMono(mix(1.3, [[box, 0], [cel, 0, 0.6]]), 1.2, 0.22);
    },
  }),
  overtime: FX({
    stereo: false, level: -14, pitchVar: 0, maxVoices: 1, throttleMs: 600,
    description: 'Tic-tac qui s’emballe, montée tendue, coup de gong.',
    render: (r) => {
      const ticks = buf(1.4);
      let t = 0;
      let k = 0;
      while (t < 1.0) {
        add(ticks, note(k % 2 ? I.tock : I.tick, n('D5'), 0.04, 0.7 + 0.03 * k, r.fork(k)), t, 0.8);
        t += 0.16 * Math.pow(0.86, k);
        k++;
      }
      const rise = drive(glide(1.05, 110, 440, 'saw', 1.2), 1.5);
      filt(rise, 'lowpass', 2500);
      shape(rise, [[0, 0], [1, 0.6], [1.05, 0]]);
      const g = note(I.gong, n('D2'), 0.4, 0.8, r);
      shape(g, [[0, 1], [0.5, 0.6], [1.2, 0]]);
      return roomMono(mix(2.4, [[ticks, 0, 0.7], [rise, 0, 0.3], [g, 1.05, 0.8]]), 1.2, 0.2);
    },
  }),
  eliminated: FX({
    stereo: true, level: -12, pitchVar: 0, maxVoices: 1, throttleMs: 1000,
    description: 'Élimination : gong grave, chœur sombre, roulement de timbales qui descend.',
    render: (r) => {
      const g = note(I.gong, n('A1'), 1.5, 0.9, r);
      shape(g, [[0, 1], [1.5, 0.6], [2.8, 0]]);
      const choir = notes(I.choir('u'), [[0.1, n('D3'), 1.6, 0.6], [0.1, n('A3'), 1.6, 0.55], [0.1, n('F4'), 1.6, 0.45]], r, 2.8);
      const roll = buf(1.2);
      for (let k = 0; k < 14; k++) add(roll, note(I.timpani, n('D2') - Math.floor(k / 5), 0.1, 0.7 - k * 0.03, r.fork(k + 40)), k * 0.07, 0.5);
      const x = mix(3, [[g, 0, 0.8], [choir, 0, 0.6], [roll, 0, 0.5]]);
      return room(stereoize(x, 0, 0), 2, 0.3, 1.1);
    },
  }),
  carouselPick: FX({
    stereo: false, level: -18, pitchVar: 30, maxVoices: 2, throttleMs: 150,
    description: 'Deux notes de boîte à musique et un souffle doux (manège).',
    render: (r) => roomMono(mix(0.9, [[notes(I.musicBox, [[0, n('C6'), 0.15, 0.7], [0.09, n('F6'), 0.4, 0.7]], r, 0.9), 0], [whoosh(0.3, 800, 2400, r, 1.2, 0.5), 0, 0.25]]), 0.9, 0.2),
  }),
  victoryFanfare: FX({
    stereo: true, level: -12, pitchVar: 0, maxVoices: 1, throttleMs: 2000,
    description: "Fanfare : motif de l'Horloge aux cuivres puis accord de ré majeur.",
    render: (r) => {
      const motif: Array<readonly [number, number, number, number]> = [
        [0, n('A4'), 0.2, 0.8], [0.24, n('G4'), 0.08, 0.7], [0.32, n('A4'), 0.16, 0.75], [0.48, n('D5'), 0.25, 0.85],
      ];
      const chordAt = 0.78;
      const chord: Array<readonly [number, number, number, number]> = [
        [chordAt, n('D4'), 1.4, 0.85], [chordAt, n('F#4'), 1.4, 0.8], [chordAt, n('A4'), 1.4, 0.8], [chordAt, n('D5'), 1.4, 0.85], [chordAt, n('F#5'), 1.4, 0.75],
      ];
      const horns = notes(I.horns, [...motif, ...chord], r, 3);
      const strings = notes(I.stringsLead, [...motif.map(([a, b, c, d]) => [a, b + 12, c, d * 0.8] as const), [chordAt, n('A5'), 1.4, 0.7], [chordAt, n('D6'), 1.4, 0.7]], r, 3);
      const timp = notes(I.timpani, [[0, n('D2'), 0.2, 0.7], [0.48, n('A1'), 0.2, 0.7], [chordAt, n('D2'), 0.5, 0.95]], r, 3);
      const cym = note(I.cymbal, 60, 0.5, 0.6, r);
      const x = mix(3, [[horns, 0, 0.8], [strings, 0, 0.5], [timp, 0, 0.7], [cym, chordAt, 0.3], [sparkle(0.8, 16, 3000, 9000, r, true), chordAt, 0.25]]);
      return room(stereoize(x, 0, 0), 1.8, 0.28, 1.1);
    },
  }),
};

/** Porteuse sinusoïdale modulée en FM, fréquence suivie (courbe). */
function fmVoiceCurve(fc: Float32Array, ratio: number, index: number, idxDecay: number): Float32Array {
  const len = fc.length;
  const out = new Float32Array(len);
  let pc = 0;
  let pm = 0;
  let idx = index;
  const d = Math.exp(-1 / Math.max(1, idxDecay * 44100));
  for (let i = 0; i < len; i++) {
    const mod = Math.sin(2 * Math.PI * pm) * (idx + 0.1);
    out[i] = Math.sin(2 * Math.PI * pc + mod);
    pc += fc[i] / 44100;
    pm += (fc[i] * ratio) / 44100;
    if (pc > 1) pc -= 1;
    if (pm > 1) pm -= 1;
    idx *= d;
  }
  return out;
}

export const SFX: SfxDef[] = SFX_IDS.map((id) => ({ id, ...DEFS[id] }));

export function getSfx(id: string): SfxDef {
  const s = SFX.find((x) => x.id === id);
  if (!s) throw new Error(`SFX inconnu : ${id}`);
  return s;
}
