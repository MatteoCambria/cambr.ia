/**
 * Séquenceur : événements de notes (en temps musical), notation compacte des mélodies, grilles
 * d'accords, générateurs de parties (nappes à conduite des voix, basses, arpèges, rythmes).
 *
 * Notation des mélodies (`mel`) :
 *   "A4:1.5 G4:.5 A4 D5 | B4:2 r:1 [D4,F4,A4]:1 |"
 *   - note = nom + octave (C4 = do central), `r` = silence, `[a,b,c]` = accord ;
 *   - `:durée` en temps (noire = 1), fractions acceptées (`:2/3`) ; la durée persiste ;
 *   - suffixes : `>` accent, `_` doux, `'` staccato, `~` lié (léger chevauchement) ;
 *   - `|` barre de mesure : vérifie que la mesure est complète (détecte les fautes de saisie).
 */
import { noteToMidi, parseChord, voiceChord, chordLadder, pcAtOrAbove, type Chord } from './theory';

export interface NoteEv {
  /** Début (temps, noire = 1). */
  t: number;
  /** Durée notée (temps). */
  d: number;
  /** Hauteur MIDI (fractionnaire autorisée). */
  m: number;
  /** Vélocité 0..1. */
  v: number;
  /** Panoramique propre à la note (-1..1). */
  pan?: number;
  /** Fraction de la durée réellement tenue (articulation). */
  gate?: number;
}

export interface MelOptions {
  at?: number;
  beatsPerBar?: number;
  vel?: number;
  transpose?: number;
  gate?: number;
}

function parseDur(s: string): number {
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    return parseFloat(a) / parseFloat(b);
  }
  return parseFloat(s);
}

/** Analyse une mélodie en notation compacte. */
export function mel(src: string, o: MelOptions = {}): NoteEv[] {
  const out: NoteEv[] = [];
  let t = o.at ?? 0;
  let dur = 1;
  let barStart = t;
  let bar = 1;
  const bpb = o.beatsPerBar ?? 4;
  const vel = o.vel ?? 0.8;
  const tr = o.transpose ?? 0;
  const baseGate = o.gate ?? 0.92;
  const tokens = src.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok === '|') {
      const len = t - barStart;
      if (Math.abs(len - bpb) > 1e-6) throw new Error(`Mesure ${bar} incomplète (${len} temps au lieu de ${bpb}) dans « ${src.slice(0, 60)}… »`);
      barStart = t;
      bar++;
      continue;
    }
    const m = /^(\[[^\]]+\]|[A-Ga-g][#b]*-?\d+|r)(?::([\d./]+))?([>_'~]*)$/.exec(tok);
    if (!m) throw new Error(`Jeton de mélodie invalide : « ${tok} »`);
    if (m[2]) dur = parseDur(m[2]);
    const mods = m[3] ?? '';
    let v = vel;
    let gate = baseGate;
    if (mods.includes('>')) v = Math.min(1, v + 0.18);
    if (mods.includes('_')) v = Math.max(0.05, v - 0.22);
    if (mods.includes("'")) gate = 0.45;
    if (mods.includes('~')) gate = 1.04;
    if (m[1] !== 'r') {
      const names = m[1].startsWith('[') ? m[1].slice(1, -1).split(',') : [m[1]];
      for (const nm of names) out.push({ t, d: dur, m: noteToMidi(nm) + tr, v, gate });
    }
    t += dur;
  }
  return out;
}

/** Durée totale (temps) d'une mélodie, utile pour enchaîner. */
export function melLength(evs: readonly NoteEv[]): number {
  return evs.reduce((m, e) => Math.max(m, e.t + e.d), 0);
}

export interface ChordSpan {
  t: number;
  d: number;
  chord: Chord;
}

/**
 * Grille d'accords : "Dm | G/D | Bb C | A:3 A7:1" — les accords sans durée se partagent la mesure.
 */
export function prog(src: string, beatsPerBar = 4, at = 0): ChordSpan[] {
  const bars = src.split('|').map((b) => b.trim()).filter(Boolean);
  const out: ChordSpan[] = [];
  let t = at;
  for (const b of bars) {
    const items = b.split(/\s+/).filter(Boolean);
    const specified = items.map((it) => {
      const [sym, d] = it.split(':');
      return { sym, d: d ? parseDur(d) : NaN };
    });
    const fixed = specified.filter((x) => !Number.isNaN(x.d)).reduce((a, x) => a + x.d, 0);
    const free = specified.filter((x) => Number.isNaN(x.d)).length;
    const each = free ? (beatsPerBar - fixed) / free : 0;
    let sum = 0;
    for (const x of specified) {
      const d = Number.isNaN(x.d) ? each : x.d;
      out.push({ t, d, chord: parseChord(x.sym) });
      t += d;
      sum += d;
    }
    if (Math.abs(sum - beatsPerBar) > 1e-6) throw new Error(`Mesure d'accords « ${b} » : ${sum} temps au lieu de ${beatsPerBar}`);
  }
  return out;
}

export function progLength(spans: readonly ChordSpan[]): number {
  return spans.reduce((m, s) => Math.max(m, s.t + s.d), 0);
}

/** Accord actif au temps t. */
export function chordAt(spans: readonly ChordSpan[], t: number): Chord {
  for (const s of spans) if (t >= s.t - 1e-9 && t < s.t + s.d - 1e-9) return s.chord;
  return spans[spans.length - 1].chord;
}

// ---------------------------------------------------------------------------------------------
// Générateurs de parties
// ---------------------------------------------------------------------------------------------

export interface PadOptions {
  voices: number;
  low: number;
  high: number;
  vel?: number;
  /** Chevauchement en temps (legato). */
  overlap?: number;
  /** Retient les notes communes entre accords successifs (les prolonge). */
  holdCommon?: boolean;
  /** Re-frappe : sous-division (temps) ; 0 = tenue. */
  restrike?: number;
}

export function padPart(spans: readonly ChordSpan[], o: PadOptions): NoteEv[] {
  const out: NoteEv[] = [];
  let prev: number[] | null = null;
  const vel = o.vel ?? 0.6;
  const ov = o.overlap ?? 0.15;
  let open: NoteEv[] = [];
  for (const s of spans) {
    const v = voiceChord(s.chord, prev, o.voices, o.low, o.high);
    if (o.restrike && o.restrike > 0) {
      for (let x = 0; x < s.d - 1e-9; x += o.restrike) {
        for (const m of v) out.push({ t: s.t + x, d: Math.min(o.restrike, s.d - x) + ov, m, v: vel * (x === 0 ? 1 : 0.85), gate: 1 });
      }
    } else if (o.holdCommon) {
      const next: NoteEv[] = [];
      for (const m of v) {
        const held = open.find((e) => e.m === m);
        if (held) {
          held.d = s.t + s.d + ov - held.t;
          next.push(held);
        } else {
          const e: NoteEv = { t: s.t, d: s.d + ov, m, v: vel, gate: 1 };
          out.push(e);
          next.push(e);
        }
      }
      open = next;
    } else {
      for (const m of v) out.push({ t: s.t, d: s.d + ov, m, v: vel, gate: 1 });
    }
    prev = v;
  }
  return out;
}

export interface BassOptions {
  /** Note la plus grave autorisée pour la fondamentale (MIDI). */
  low: number;
  /** Motif : "R:2 5:1 8:1" (R = basse de l'accord, 5 = quinte, 8 = octave, 3 = tierce, r = silence). */
  pattern?: string;
  vel?: number;
  gate?: number;
}

export function bassPart(spans: readonly ChordSpan[], o: BassOptions): NoteEv[] {
  const out: NoteEv[] = [];
  const pat = (o.pattern ?? 'R:4').split(/\s+/).filter(Boolean).map((p) => {
    const m = /^([R358r]|7|b7|9|4|6)(?::([\d./]+))?([>_']*)$/.exec(p);
    if (!m) throw new Error(`Motif de basse invalide : ${p}`);
    return { deg: m[1], d: m[2] ? parseDur(m[2]) : 1, mods: m[3] ?? '' };
  });
  const vel = o.vel ?? 0.75;
  for (const s of spans) {
    const bass = pcAtOrAbove(s.chord.bass, o.low);
    const root = pcAtOrAbove(s.chord.root, o.low);
    let x = 0;
    let k = 0;
    while (x < s.d - 1e-9) {
      const p = pat[k % pat.length];
      const d = Math.min(p.d, s.d - x);
      if (p.deg !== 'r') {
        let m = bass;
        const third = s.chord.intervals.find((i) => i === 3 || i === 4) ?? 4;
        if (p.deg === '5') m = root + 7;
        else if (p.deg === '8') m = bass + 12;
        else if (p.deg === '3') m = root + third;
        else if (p.deg === '7' || p.deg === 'b7') m = root + 10;
        else if (p.deg === '9') m = root + 14;
        else if (p.deg === '4') m = root + 5;
        else if (p.deg === '6') m = root + 9;
        let v = vel;
        if (p.mods.includes('>')) v = Math.min(1, v + 0.15);
        if (p.mods.includes('_')) v *= 0.7;
        out.push({ t: s.t + x, d, m, v, gate: p.mods.includes("'") ? 0.4 : o.gate ?? 0.9 });
      }
      x += p.d;
      k++;
    }
  }
  return out;
}

export interface ArpOptions {
  /** Indices dans l'échelle des notes de l'accord empilées depuis `from`. */
  pattern: number[];
  /** Pas en temps (0.5 = croches). */
  step: number;
  /** Note de départ de l'échelle (MIDI). */
  from: number;
  vel?: number;
  /** Accents : vélocité par position dans la mesure (multiplicateur), longueur = pas par mesure. */
  accents?: number[];
  beatsPerBar?: number;
  gate?: number;
  /** Le motif repart de zéro à chaque accord (sinon il continue : effet « engrenages »). */
  resetOnChord?: boolean;
  /** Durée tenue de chaque note (temps) ; défaut = step. */
  hold?: number;
}

export function arpPart(spans: readonly ChordSpan[], o: ArpOptions): NoteEv[] {
  const out: NoteEv[] = [];
  const vel = o.vel ?? 0.6;
  const bpb = o.beatsPerBar ?? 4;
  const maxIdx = Math.max(...o.pattern) + 1;
  let k = 0;
  for (const s of spans) {
    if (o.resetOnChord) k = 0;
    const ladder = chordLadder(s.chord, o.from, maxIdx + 6);
    for (let x = 0; x < s.d - 1e-9; x += o.step) {
      const idx = o.pattern[k % o.pattern.length];
      k++;
      if (idx < 0) continue;
      const tt = s.t + x;
      const pos = Math.round(((tt % bpb) + bpb) % bpb / o.step);
      const acc = o.accents ? o.accents[pos % o.accents.length] : 1;
      out.push({ t: tt, d: o.hold ?? o.step, m: ladder[idx], v: Math.min(1, vel * acc), gate: o.gate ?? 0.9 });
    }
  }
  return out;
}

/**
 * Rythme : une chaîne par mesure ("x..x..x.x..x..x."), X = accent, x = normal, o = note fantôme,
 * . = silence. `steps` pas par mesure.
 */
export function rhythm(pattern: string, o: { bars: number; at?: number; m: number; vel?: number; beatsPerBar?: number; gate?: number; startBar?: number }): NoteEv[] {
  const bpb = o.beatsPerBar ?? 4;
  const p = pattern.replace(/\s+/g, '');
  const step = bpb / p.length;
  const vel = o.vel ?? 0.8;
  const out: NoteEv[] = [];
  const at = o.at ?? 0;
  for (let b = 0; b < o.bars; b++) {
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === '.' || c === '-') continue;
      const v = c === 'X' ? Math.min(1, vel * 1.25) : c === 'o' ? vel * 0.45 : vel;
      out.push({ t: at + ((o.startBar ?? 0) + b) * bpb + i * step, d: step, m: o.m, v, gate: o.gate ?? 1 });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Transformations
// ---------------------------------------------------------------------------------------------

export function shift(evs: readonly NoteEv[], beats: number): NoteEv[] {
  return evs.map((e) => ({ ...e, t: e.t + beats }));
}

export function transpose(evs: readonly NoteEv[], semis: number): NoteEv[] {
  return evs.map((e) => ({ ...e, m: e.m + semis }));
}

export function velocity(evs: readonly NoteEv[], k: number): NoteEv[] {
  return evs.map((e) => ({ ...e, v: Math.min(1, e.v * k) }));
}

/** Répète un motif `times` fois avec une période `period` (temps). */
export function repeat(evs: readonly NoteEv[], period: number, times: number): NoteEv[] {
  const out: NoteEv[] = [];
  for (let i = 0; i < times; i++) out.push(...shift(evs, i * period));
  return out;
}

/** Conserve les événements dont le début est dans [a, b). */
export function window(evs: readonly NoteEv[], a: number, b: number): NoteEv[] {
  return evs.filter((e) => e.t >= a - 1e-9 && e.t < b - 1e-9);
}

/** Crescendo/decrescendo linéaire de vélocité entre deux temps. */
export function ramp(evs: readonly NoteEv[], a: number, b: number, va: number, vb: number): NoteEv[] {
  return evs.map((e) => {
    if (e.t < a || e.t > b) return e;
    const k = va + ((vb - va) * (e.t - a)) / Math.max(1e-9, b - a);
    return { ...e, v: Math.min(1, e.v * k) };
  });
}

/** Double une ligne à l'octave (ou autre intervalle). */
export function double(evs: readonly NoteEv[], semis: number, velK = 0.8): NoteEv[] {
  return [...evs, ...evs.map((e) => ({ ...e, m: e.m + semis, v: e.v * velK }))];
}
