/**
 * Théorie : noms de notes ↔ MIDI, symboles d'accords, conduite des voix (voicings), gammes.
 */

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#4", "Bb3", "A4" → numéro MIDI (C4 = 60). */
export function noteToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]*)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`Note invalide : « ${name} »`);
  const letter = m[1].toUpperCase();
  let pc = PC[letter];
  for (const c of m[2]) pc += c === '#' ? 1 : -1;
  return (parseInt(m[3], 10) + 1) * 12 + pc;
}

/** Classe de hauteur depuis un nom sans octave ("F#", "Bb"). */
export function pitchClass(name: string): number {
  const m = /^([A-Ga-g])([#b]*)$/.exec(name.trim());
  if (!m) throw new Error(`Classe de hauteur invalide : « ${name} »`);
  let pc = PC[m[1].toUpperCase()];
  for (const c of m[2]) pc += c === '#' ? 1 : -1;
  return ((pc % 12) + 12) % 12;
}

const QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  M: [0, 4, 7],
  m: [0, 3, 7],
  '5': [0, 7],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '69': [0, 4, 7, 9, 14],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  m7b5: [0, 3, 6, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  '7sus4': [0, 5, 7, 10],
  m11: [0, 3, 7, 10, 14, 17],
  'maj7#11': [0, 4, 7, 11, 18],
  'add#11': [0, 4, 7, 18],
  mmaj7: [0, 3, 7, 11],
  '7b9': [0, 4, 7, 10, 13],
};

export interface Chord {
  symbol: string;
  root: number; // classe de hauteur
  bass: number; // classe de hauteur de la basse
  intervals: number[]; // demi-tons depuis la fondamentale
  pcs: number[]; // classes de hauteur (sans doublons)
}

/** "Dm", "G/D", "Fmaj7", "Asus4", "Bbadd9", "C#m7b5"… */
export function parseChord(symbol: string): Chord {
  const [main, slash] = symbol.trim().split('/');
  const m = /^([A-G][#b]?)(.*)$/.exec(main);
  if (!m) throw new Error(`Accord invalide : « ${symbol} »`);
  const root = pitchClass(m[1]);
  const q = m[2];
  const intervals = QUALITIES[q];
  if (!intervals) throw new Error(`Qualité d'accord inconnue « ${q} » dans « ${symbol} »`);
  const bass = slash ? pitchClass(slash) : root;
  const pcs = Array.from(new Set(intervals.map((i) => (root + i) % 12)));
  return { symbol, root, bass, intervals, pcs };
}

/** Note MIDI de classe pc la plus proche de `near` (≥ low si fourni). */
export function nearestPc(pc: number, near: number): number {
  const base = near - (((near % 12) - pc + 12) % 12);
  const up = base + 12;
  return near - base <= up - near ? base : up;
}

/** Note MIDI de classe pc dans l'octave commençant à `low`. */
export function pcAtOrAbove(pc: number, low: number): number {
  return low + ((pc - (low % 12) + 12) % 12);
}

/**
 * Voicing par conduite des voix : choisit `voices` notes de l'accord dans [low, high], couvrant les
 * notes essentielles, en minimisant le mouvement par rapport au voicing précédent.
 */
export function voiceChord(ch: Chord, prev: number[] | null, voices: number, low: number, highIn: number): number[] {
  const cands: number[] = [];
  let high = highIn;
  // Tessiture trop étroite pour le nombre de voix : on l'élargit vers l'aigu.
  for (;;) {
    cands.length = 0;
    for (let m = low; m <= high; m++) if (ch.pcs.includes(((m % 12) + 12) % 12)) cands.push(m);
    if (cands.length >= voices || high > highIn + 24) break;
    high += 3;
  }
  const third = ch.intervals.find((i) => i === 3 || i === 4);
  const essentials = new Set<number>([ch.root]);
  if (third !== undefined) essentials.add((ch.root + third) % 12);
  for (const i of ch.intervals) if (i === 10 || i === 11 || i === 2 || i === 14 || i === 5 || i === 9 || i === 18) essentials.add((ch.root + i) % 12);
  const center = (low + high) / 2;
  let best: number[] = [];
  let bestCost = Infinity;
  const combo: number[] = [];
  const evaluate = (): void => {
    const pcsUsed = new Set(combo.map((m) => m % 12));
    let cost = 0;
    for (const e of essentials) if (!pcsUsed.has(e)) cost += 6;
    // Doublures : pénalise les doublures de tierce.
    if (third !== undefined) {
      const tpc = (ch.root + third) % 12;
      const n3 = combo.filter((m) => m % 12 === tpc).length;
      if (n3 > 1) cost += 4;
    }
    for (let i = 1; i < combo.length; i++) {
      const gap = combo[i] - combo[i - 1];
      if (gap < 2) cost += 8;
      else if (gap < 3) cost += 1.5;
      if (gap > 9) cost += (gap - 9) * 0.8;
      // Intervalles serrés dans le grave : boueux.
      if (combo[i - 1] < 52 && gap < 5) cost += 3;
    }
    if (prev && prev.length) {
      const p = [...prev].sort((a, b) => a - b);
      for (let i = 0; i < combo.length; i++) {
        const j = Math.min(p.length - 1, Math.round((i * (p.length - 1)) / Math.max(1, combo.length - 1)));
        cost += Math.abs(combo[i] - p[j]) * 0.6;
      }
    } else {
      const mean = combo.reduce((a, b) => a + b, 0) / combo.length;
      cost += Math.abs(mean - center) * 0.3;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = [...combo];
    }
  };
  const rec = (start: number): void => {
    if (combo.length === voices) {
      evaluate();
      return;
    }
    for (let i = start; i < cands.length; i++) {
      combo.push(cands[i]);
      rec(i + 1);
      combo.pop();
    }
  };
  rec(0);
  if (!best.length) throw new Error(`Aucun voicing pour ${ch.symbol} dans [${low}, ${high}]`);
  return best;
}

/** Notes de l'accord empilées à partir de `from` (pour les arpèges), sur `count` notes. */
export function chordLadder(ch: Chord, from: number, count: number): number[] {
  const out: number[] = [];
  let m = from;
  while (out.length < count) {
    if (ch.pcs.includes(((m % 12) + 12) % 12)) out.push(m);
    m++;
  }
  return out;
}

/** Gamme (classes de hauteur) à partir d'une tonique et d'un mode. */
export const MODES: Record<string, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  pentaMinor: [0, 3, 5, 7, 10],
  pentaMajor: [0, 2, 4, 7, 9],
};

export function scaleNotes(tonic: string, mode: keyof typeof MODES, low: number, high: number): number[] {
  const t = pitchClass(tonic);
  const pcs = MODES[mode].map((i) => (t + i) % 12);
  const out: number[] = [];
  for (let m = low; m <= high; m++) if (pcs.includes(m % 12)) out.push(m);
  return out;
}
