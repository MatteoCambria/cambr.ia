/**
 * Définitions des icônes (boîte 100 × 100). Style : gravure dorée / glyphe lumineux,
 * silhouettes pleines et simples pour rester lisibles de 16 à 48 px.
 */
import type { GB } from './glyphBuilder';
import { C, E, P, R, Rrev, TP, arcP, crescentP, gearP, spark, spiralPts, star, sunburst } from './glyphBuilder';

export type GlyphDef = (g: GB) => void;

// ---------------------------------------------------------------------------
// Formes réutilisables

const HEATER = 'M50 6 L86 17 L86 45 C86 70 68 85 50 94 C32 85 14 70 14 45 L14 17 Z';
const HEART = 'M50 90 C22 70 6 54 6 34 C6 18 18 8 31 8 C40 8 46 13 50 21 C54 13 60 8 69 8 C82 8 94 18 94 34 C94 54 78 70 50 90 Z';
const FLAME =
  'M50 4 C57 19 72 28 74 47 C76 68 64 87 50 92 C36 87 24 72 26 54 C27 42 34 35 37 25 C42 33 45 39 49 42 C51 30 45 16 50 4 Z';
const FLAME_IN = 'M50 46 C56 56 64 63 62 75 C60 83 54 87 50 87 C46 87 40 83 38 75 C37 66 46 60 50 46 Z';
const DROP = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy - 44 * s} C${cx + 10 * s} ${cy - 22 * s} ${cx + 30 * s} ${cy - 6 * s} ${cx + 30 * s} ${cy + 12 * s} ` +
  `C${cx + 30 * s} ${cy + 30 * s} ${cx + 16 * s} ${cy + 42 * s} ${cx} ${cy + 42 * s} C${cx - 16 * s} ${cy + 42 * s} ${cx - 30 * s} ${cy + 30 * s} ${cx - 30 * s} ${cy + 12 * s} ` +
  `C${cx - 30 * s} ${cy - 6 * s} ${cx - 10 * s} ${cy - 22 * s} ${cx} ${cy - 44 * s} Z`;

function sword(g: GB): void {
  g.fill('M50 4 L57 15 L57 62 L43 62 L43 15 Z');
  g.fill(R(29, 61, 42, 8, 3));
  g.fill(R(45, 68, 10, 17, 3));
  g.fill(C(50, 90, 6));
  g.cut('M50 15 L50 56', 0.9);
}

function swordWide(g: GB, sep = false): void {
  g.fill('M50 2 L60 14 L60 62 L40 62 L40 14 Z', sep);
  g.fill(R(24, 60, 52, 11, 4));
  g.fill(R(43.5, 70, 13, 17, 3));
  g.fill(C(50, 92, 7));
  g.cut('M50 14 L50 56', 0.9);
}

function skull(g: GB): void {
  g.fill('M50 8 C74 8 86 26 86 46 C86 60 79 66 74 70 L74 82 Q74 90 66 90 L34 90 Q26 90 26 82 L26 70 C21 66 14 60 14 46 C14 26 26 8 50 8 Z');
  g.hole(E(36, 48, 10, 11));
  g.hole(E(64, 48, 10, 11));
  g.hole(P(50, 58, 44, 69, 56, 69));
  g.cut('M42 78 L42 89 M50 78 L50 89 M58 78 L58 89', 0.9);
}

function crown(g: GB): void {
  g.fill('M12 76 L15 30 L33 52 L50 20 L67 52 L85 30 L88 76 Z');
  g.fill(R(10, 72, 80, 16, 4));
  g.fill(C(15, 27, 6));
  g.fill(C(50, 17, 7));
  g.fill(C(85, 27, 6));
  g.gem(C(50, 80, 5));
  g.gem(C(28, 80, 4));
  g.gem(C(72, 80, 4));
}

function arrowUp(g: GB, x: number, y: number, s: number): void {
  g.reset();
  g.fill(P(x, y, x + 16 * s, y + 18 * s, x + 6 * s, y + 18 * s, x + 6 * s, y + 34 * s, x - 6 * s, y + 34 * s, x - 6 * s, y + 18 * s, x - 16 * s, y + 18 * s), true);
}

function ring(cx: number, cy: number, ro: number, ri: number): string {
  return C(cx, cy, ro) + ' ' + C(cx, cy, ri, true);
}

// ---------------------------------------------------------------------------

export const GLYPHS = {
  // --- Synergies : origines ---
  zenith: (g) => {
    g.fill(sunburst(50, 50, 16, 22, 47, 34));
    g.fill(C(50, 50, 22));
    g.cut(C(50, 50, 14));
    g.gem(C(50, 50, 8));
  },
  selene: (g) => {
    g.fill(crescentP(46, 54, 38, 18, -14, 32));
    g.fill(spark(76, 22, 15), true);
    g.cut(arcP(46, 54, 30, 110, 200), 0.8);
  },
  rouage: (g) => {
    g.fill(gearP(50, 50, 10, 46, 36, 13));
    g.cut(C(50, 50, 24));
    g.cut('M50 26 L50 37 M50 63 L50 74 M26 50 L37 50 M63 50 L74 50', 0.8);
  },
  sylve: (g) => {
    g.fill('M45 56 L55 56 L57 78 Q64 86 76 90 L24 90 Q36 86 43 78 Z');
    g.fill(C(50, 36, 26));
    g.fill(C(28, 50, 17));
    g.fill(C(72, 50, 17));
    g.cut('M50 62 L50 86 M50 44 Q50 54 50 62 M36 46 Q44 52 50 56 M64 46 Q56 52 50 56', 0.9);
  },
  abysse: (g) => {
    g.fill(TP([26, 94, 30, 76, 40, 60, 54, 48, 68, 42, 78, 31, 76, 17, 64, 12, 54, 18, 55, 29, 64, 30], [11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]));
    g.hole(C(36, 70, 3.2));
    g.hole(C(46, 56, 3));
    g.hole(C(59, 47, 2.6));
    g.hole(C(70, 39, 2.2));
  },
  braise: (g) => {
    g.fill('M50 4 C57 17 70 24 71 40 C72 52 64 60 50 62 C36 60 28 52 29 40 C30 32 35 26 38 18 C42 26 44 30 48 33 C50 23 46 14 50 4 Z');
    g.fill('M16 58 L84 58 Q82 82 50 84 Q18 82 16 58 Z');
    g.fill(P(38, 82, 62, 82, 68, 94, 32, 94));
    g.gem('M50 30 C54 38 60 42 59 50 C58 56 54 58 50 58 C46 58 42 56 41 50 C40 44 47 40 50 30 Z');
    g.cut('M22 66 Q50 72 78 66', 0.9);
  },
  nomade: (g) => {
    g.line('M8 34 L58 34 C72 34 76 18 64 14 C56 12 51 20 57 26', 9);
    g.line('M16 54 L78 54 C92 54 94 72 81 74 C72 75 69 65 76 62', 9);
    g.line('M8 74 L50 74', 9);
  },
  astral: (g) => {
    g.line(E(50, 52, 44, 15, -20), 6);
    g.fill(spark(50, 50, 42, 0.2), true);
    g.gem(C(50, 50, 7));
    g.fill(C(84, 20, 5), true);
  },
  // --- Synergies : classes ---
  gardien: (g) => {
    g.fill(HEATER);
    g.cut('M50 20 L50 80 M28 42 L72 42');
    g.gem(C(50, 42, 7));
  },
  briseur: (g) => {
    g.fill('M22 50 Q22 34 36 34 L70 34 Q82 34 82 46 L82 64 Q82 86 60 88 L42 88 Q22 86 22 68 Z');
    g.fill(R(10, 48, 22, 14, 6), true);
    g.cut('M40 34 L40 50 M52 34 L52 50 M64 34 L64 50 M28 62 Q42 60 52 64', 0.9);
    g.fill(P(30, 26, 22, 6, 38, 22), true);
    g.fill(P(52, 24, 50, 2, 62, 22), true);
    g.fill(P(74, 26, 80, 6, 86, 28), true);
  },
  duelliste: (g) => {
    g.fill('M50 4 L54 12 L54 60 L46 60 L46 12 Z');
    g.line('M32 70 C24 56 40 50 50 58 C60 66 74 60 68 70', 5);
    g.fill(R(28, 58, 44, 7, 3));
    g.fill(R(45.5, 64, 9, 18, 3));
    g.fill(C(50, 88, 6.5));
  },
  assassin: (g) => {
    g.fill('M50 6 C72 10 86 30 86 54 L86 92 L14 92 L14 54 C14 30 28 10 50 6 Z');
    g.hole(E(50, 54, 21, 25));
    g.gem('M32 52 Q40 46 46 54 Q38 56 32 52 Z');
    g.gem('M54 54 Q60 46 68 52 Q62 56 54 54 Z');
    g.cut('M50 8 Q46 22 50 30', 0.8);
  },
  tireur: (g) => {
    g.fill(ring(50, 50, 34, 25));
    g.fill(R(46, 4, 8, 26, 3));
    g.fill(R(46, 70, 8, 26, 3));
    g.fill(R(4, 46, 26, 8, 3));
    g.fill(R(70, 46, 26, 8, 3));
    g.fill(C(50, 50, 7), true);
  },
  arcaniste: (g) => {
    g.fill(ring(50, 50, 45, 37));
    g.fill(star(50, 50, 6, 32, 17), true);
    g.hole(C(50, 50, 6));
    g.fill(C(50, 7, 5), true);
    g.fill(C(87, 71, 5), true);
    g.fill(C(13, 71, 5), true);
  },
  invocateur: (g) => {
    g.line(E(50, 80, 36, 11), 7);
    g.fill('M50 10 C66 20 68 40 61 53 C56 61 54 68 50 76 C46 68 44 61 39 53 C32 40 34 20 50 10 Z', true);
    g.hole(E(44, 40, 3.5, 5));
    g.hole(E(56, 40, 3.5, 5));
    g.fill(spark(20, 30, 9), true);
    g.fill(spark(82, 24, 8), true);
  },
  oracle: (g) => {
    g.fill('M34 68 L66 68 L72 80 L28 80 Z');
    g.fill('M22 80 L78 80 L84 92 L16 92 Z', true);
    g.fill(C(50, 40, 32), true);
    g.gem(E(38, 28, 9, 5.5, -35));
    g.cut(arcP(50, 40, 22, 20, 110), 0.8);
  },
  alchimiste: (g) => {
    g.fill('M42 6 L58 6 L58 13 L56 13 L56 34 C74 40 84 54 82 68 C80 84 66 94 50 94 C34 94 20 84 18 68 C16 54 26 40 44 34 L44 13 L42 13 Z');
    g.gem('M23 64 C34 58 44 70 56 64 C66 59 74 62 78 64 C79 80 66 89 50 89 C34 89 22 80 23 64 Z');
    g.hole(C(44, 76, 3));
    g.hole(C(58, 72, 2.4));
    g.cut('M44 18 L56 18', 0.8);
  },
  artilleur: (g) => {
    g.tf(-28, 48, 46);
    g.fill(R(10, 36, 66, 22, 9));
    g.fill(R(72, 32, 12, 30, 4));
    g.fill(C(12, 47, 9));
    g.reset();
    g.fill(C(40, 70, 18), true);
    g.hole(C(40, 70, 5));
    g.cut('M40 56 L40 84 M26 70 L54 70 M30 60 L50 80 M50 60 L30 80', 0.7);
    g.fill(C(84, 84, 9), true);
  },

  // --- Composants d'objets ---
  sword: (g) => {
    g.tf(45);
    sword(g);
    g.reset();
  },
  bow: (g) => {
    g.line('M32 6 C76 18 76 82 32 94', 9);
    g.line('M32 6 L32 94', 2.6);
    g.line('M12 50 L80 50', 4.5);
    g.fill(P(94, 50, 78, 41, 78, 59), true);
    g.fill(P(10, 50, 4, 42, 18, 46), true);
    g.fill(P(10, 50, 4, 58, 18, 54), true);
  },
  wand: (g) => {
    g.line('M18 84 L64 38', 9);
    g.fill(star(71, 29, 5, 25, 11), true);
    g.gem(C(71, 30, 5));
    g.cut('M28 74 L34 68', 1.2);
  },
  tear: (g) => {
    g.fill(DROP(50, 50, 1));
    g.gem(E(39, 64, 7, 12, 25));
    g.cut(arcP(50, 62, 22, 20, 80), 0.8);
  },
  mail: (g) => {
    g.fill('M30 10 L42 16 Q50 21 58 16 L70 10 L90 24 L80 42 L74 38 L74 86 Q50 95 26 86 L26 38 L20 42 L10 24 Z');
    g.cut('M50 22 L50 88 M30 44 Q40 50 50 44 Q60 50 70 44 M30 58 Q40 64 50 58 Q60 64 70 58 M30 72 Q40 78 50 72 Q60 78 70 72', 0.8);
  },
  cloak: (g) => {
    g.fill('M50 6 C65 6 73 18 73 31 L88 88 Q50 97 12 88 L27 31 C27 18 35 6 50 6 Z');
    g.hole(E(50, 31, 12, 14));
    g.gem(C(50, 52, 5.5));
    g.cut('M38 58 L30 86 M62 58 L70 86 M50 60 L50 90', 0.8);
  },
  belt: (g) => {
    g.fill('M4 40 Q50 52 96 40 L96 60 Q50 72 4 60 Z');
    g.fill(R(34, 32, 32, 38, 6) + ' ' + Rrev(42, 40, 16, 22), true);
    g.line('M44 51 L64 51', 4);
    g.cut('M14 50 L22 52 M78 52 L86 50', 1);
  },
  gauntlet: (g) => {
    g.fill(R(29, 44, 44, 38, 9));
    g.fill(R(30, 16, 10, 38, 5));
    g.fill(R(41, 9, 10, 42, 5));
    g.fill(R(52, 11, 10, 40, 5));
    g.fill(R(63, 19, 9, 34, 4.5));
    g.tf(-38, 24, 62);
    g.fill(R(18, 44, 11, 28, 5.5));
    g.reset();
    g.fill(R(25, 78, 52, 16, 5), true);
    g.cut('M32 46 Q50 50 70 46', 0.9);
  },

  // --- Motifs d'objets combinés ---
  crown: (g) => crown(g),
  skull: (g) => skull(g),
  flame: (g) => {
    g.fill(FLAME);
    g.gem(FLAME_IN);
  },
  snowflake: (g) => {
    for (const a of [0, 60, 120]) {
      g.tf(a);
      g.line('M50 6 L50 94', 8);
      g.line('M50 24 L40 14 M50 24 L60 14 M50 76 L40 86 M50 76 L60 86', 6);
    }
    g.reset();
    g.fill(star(50, 50, 6, 13, 9, -90), true);
  },
  eye: (g) => {
    g.fill('M4 50 Q50 2 96 50 Q50 98 4 50 Z');
    g.hole(C(50, 50, 21));
    g.gem(C(50, 50, 16));
    g.hole(C(50, 50, 7));
    g.fill(C(43, 43, 3.2), true);
  },
  hourglass: (g) => {
    g.fill('M28 16 L72 16 C72 34 56 42 56 50 C56 58 72 66 72 84 L28 84 C28 66 44 58 44 50 C44 42 28 34 28 16 Z');
    g.fill(R(16, 6, 68, 11, 4), true);
    g.fill(R(16, 83, 68, 11, 4), true);
    g.gem('M36 26 L64 26 C62 34 52 40 50 44 C48 40 38 34 36 26 Z');
    g.gem('M50 62 L66 82 L34 82 Z');
  },
  gear: (g) => {
    g.fill(gearP(50, 50, 8, 46, 34));
    g.hole(C(50, 50, 9));
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 4) * (2 * i + 1);
      g.hole(C(50 + Math.cos(a) * 21, 50 + Math.sin(a) * 21, 6));
    }
  },
  leaf: (g) => {
    g.fill('M14 84 C12 44 40 14 90 10 C88 56 58 86 14 84 Z');
    g.line('M6 94 L26 74', 6);
    g.cut('M18 80 C40 60 60 38 84 16 M40 60 L34 42 M40 60 L58 64 M58 42 L54 26 M58 42 L74 44', 0.85);
  },
  wave: (g) => {
    g.fill('M4 72 C18 72 22 40 44 36 C62 33 74 48 66 59 C60 66 50 60 54 52 C46 54 46 68 60 70 C76 72 86 58 96 58 L96 94 L4 94 Z');
    g.cut('M8 84 Q30 74 50 84 Q70 94 92 82', 0.9);
    g.gem(C(28, 46, 4));
    g.gem(C(80, 46, 3.4));
  },
  moon: (g) => {
    g.fill(crescentP(48, 52, 42, 20, -14, 36));
    g.hole(C(24, 60, 4));
    g.hole(C(32, 78, 3));
  },
  sun: (g) => {
    g.fill(sunburst(50, 50, 12, 28, 46, 46));
    g.fill(C(50, 50, 26));
    g.gem(C(50, 50, 15));
  },
  star: (g) => {
    g.fill(star(50, 54, 5, 48, 20));
    g.gem(star(50, 54, 5, 18, 8));
  },
  shield: (g) => {
    g.fill(C(50, 50, 44));
    g.cut(C(50, 50, 34));
    g.gem(C(50, 50, 11));
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.hole(C(50 + Math.cos(a) * 39, 50 + Math.sin(a) * 39, 2.4));
    }
  },
  heart: (g) => {
    g.fill(HEART);
    g.gem(E(30, 28, 9, 5.5, -35));
  },
  bolt: (g) => {
    g.fill(P(60, 2, 20, 54, 46, 54, 34, 98, 82, 40, 55, 40, 68, 2));
  },
  fang: (g) => {
    g.fill('M6 12 Q50 34 94 12 L94 30 Q50 50 6 30 Z');
    g.fill('M20 28 Q26 64 34 84 Q40 58 42 36 Z', true);
    g.fill('M80 28 Q74 64 66 84 Q60 58 58 36 Z', true);
    g.fill(P(44, 39, 50, 54, 56, 39), true);
  },
  feather: (g) => {
    g.fill('M80 10 C94 18 90 46 70 62 C56 73 40 77 28 82 C30 66 38 52 48 40 C58 28 70 16 80 10 Z');
    g.line('M14 94 L76 20', 4.5);
    g.cut('M60 42 L76 38 M52 52 L70 54 M44 62 L60 68 M58 36 L62 24 M50 46 L48 34', 0.8);
  },
  chalice: (g) => {
    g.fill('M18 10 L82 10 C82 38 67 52 55 55 L55 72 L72 82 L72 92 L28 92 L28 82 L45 72 L45 55 C33 52 18 38 18 10 Z');
    g.gem(E(50, 18, 28, 6));
    g.gem(C(50, 64, 4.5));
    g.cut('M24 24 Q50 30 76 24', 0.8);
  },
  ring: (g) => {
    g.fill(E(50, 62, 32, 30));
    g.hole(E(50, 62, 21, 19));
    g.fill(R(38, 30, 24, 10, 3), true);
    g.fill(P(50, 4, 66, 20, 50, 36, 34, 20), true);
    g.gem(P(50, 10, 60, 20, 50, 30, 40, 20));
  },
  mask: (g) => {
    g.fill('M12 18 Q50 4 88 18 C90 54 76 84 50 92 C24 84 10 54 12 18 Z');
    g.hole('M22 42 Q34 32 46 43 Q34 50 22 42 Z');
    g.hole('M54 43 Q66 32 78 42 Q66 50 54 43 Z');
    g.hole('M36 68 Q50 76 64 68 Q50 84 36 68 Z');
    g.cut('M30 54 L28 62 M70 54 L72 62 M50 24 L50 34', 0.9);
  },
  hammer: (g) => {
    g.fill(R(44, 36, 12, 58, 5));
    g.fill(R(10, 10, 80, 32, 7), true);
    g.cut('M28 12 L28 40 M72 12 L72 40', 0.9);
    g.gem(C(50, 26, 5));
  },
  lantern: (g) => {
    g.line('M38 16 Q50 0 62 16', 5);
    g.fill(P(30, 24, 70, 24, 62, 13, 38, 13));
    g.fill(R(26, 22, 48, 54, 9));
    g.gem(R(34, 30, 32, 38, 7));
    g.fill(P(28, 74, 72, 74, 62, 88, 38, 88), true);
    g.cut('M50 30 L50 68', 1);
  },
  scales: (g) => {
    g.fill(R(46, 14, 8, 72, 3));
    g.fill(R(10, 20, 80, 7, 3.5));
    g.fill('M28 94 L72 94 L64 84 L36 84 Z');
    g.line('M20 26 L8 56 M20 26 L32 56 M80 26 L68 56 M80 26 L92 56', 2.6);
    g.fill('M4 56 Q20 74 36 56 Z', true);
    g.fill('M64 56 Q80 74 96 56 Z', true);
    g.fill(C(50, 12, 7), true);
  },
  key: (g) => {
    g.tf(-40, 50, 50);
    g.fill(C(24, 50, 19) + ' ' + C(24, 50, 8, true));
    g.fill(R(38, 45, 56, 10, 3));
    g.fill(R(74, 54, 8, 16, 2));
    g.fill(R(86, 54, 6, 12, 2));
    g.reset();
  },
  book: (g) => {
    g.fill(R(16, 8, 66, 84, 7));
    g.fill(R(78, 14, 9, 72, 2), true);
    g.shade(R(16, 8, 14, 84, 5), 0.3);
    g.gem(P(56, 30, 67, 48, 56, 66, 45, 48));
    g.cut('M34 20 L72 20 M34 80 L72 80', 0.9);
  },
  orb: (g) => {
    g.fill(C(50, 50, 30));
    g.gem(E(40, 40, 10, 6.5, -35));
    g.line(E(50, 54, 46, 13, -18), 6, true);
  },
  thorn: (g) => {
    g.fill(TP([10, 94, 30, 70, 48, 54, 66, 34, 88, 8], [8, 7, 6.5, 5.5, 3]));
    g.fill(P(25, 77, 10, 58, 35, 66));
    g.fill(P(36, 66, 56, 78, 46, 57));
    g.fill(P(47, 56, 36, 34, 57, 46));
    g.fill(P(56, 46, 80, 54, 65, 37));
    g.fill(P(67, 33, 58, 12, 77, 22));
  },
  spiral: (g) => {
    const pts = spiralPts(50, 50, 2, 3.05, 2.1, 0, 30);
    const w = pts.filter((_, i) => i % 2 === 0).map((_, i) => 2.5 + (i / 31) * 7);
    g.fill(TP(pts, w));
  },
  anchor: (g) => {
    g.fill(C(50, 13, 10) + ' ' + C(50, 13, 4.5, true));
    g.fill(R(45, 20, 10, 64, 4));
    g.fill(R(26, 30, 48, 9, 4));
    g.line('M14 58 Q18 88 50 90 Q82 88 86 58', 9);
    g.fill(P(6, 64, 14, 46, 24, 62), true);
    g.fill(P(94, 64, 86, 46, 76, 62), true);
  },
  compass: (g) => {
    g.fill(ring(50, 50, 46, 38));
    g.tf(45);
    g.fill(star(50, 50, 4, 26, 7), true);
    g.reset();
    g.fill(star(50, 50, 4, 40, 9), true);
    g.gem(C(50, 50, 6));
    g.cut('M50 12 L50 50', 0.8);
  },
  mirror: (g) => {
    g.fill(R(44, 68, 12, 28, 5));
    g.fill(E(50, 38, 32, 35), true);
    g.gem(E(50, 38, 23, 26));
    g.cut('M36 30 L46 20 M38 42 L56 24', 1);
  },
  chain: (g) => {
    g.line(E(26, 74, 18, 11, -45), 8);
    g.line(E(50, 50, 18, 11, 45), 8, true);
    g.line(E(74, 26, 18, 11, -45), 8, true);
  },
  helm: (g) => {
    g.fill('M14 42 C14 18 31 6 50 6 C69 6 86 18 86 42 L86 84 Q50 97 14 84 Z');
    g.hole(R(22, 40, 56, 9, 3));
    g.hole(R(45.5, 40, 9, 36, 3));
    g.cut('M50 8 L50 34', 1);
    g.hole(C(30, 66, 2.6));
    g.hole(C(70, 66, 2.6));
  },
  axe: (g) => {
    g.fill(R(40, 6, 11, 90, 4));
    g.fill('M48 10 C84 0 100 32 94 66 C80 54 64 54 48 60 Z', true);
    g.fill(P(43, 20, 14, 30, 43, 42), true);
    g.cut('M58 14 C80 10 92 34 89 56', 0.9);
  },
  dagger: (g) => {
    g.fill('M50 4 L60 18 L58 58 L42 58 L40 18 Z');
    g.fill(R(26, 57, 48, 8, 3.5));
    g.fill(R(45, 64, 10, 20, 3));
    g.fill(C(50, 90, 6.5));
    g.cut('M50 16 L50 52', 0.9);
  },
  horn: (g) => {
    g.line('M14 28 C34 6 70 16 80 44', 3.5);
    g.fill(TP([8, 30, 28, 32, 48, 42, 62, 56, 70, 70], [3.5, 6, 10, 14, 19]));
    g.fill(E(74, 76, 13, 22, -35), true);
    g.hole(E(76, 78, 7, 13, -35));
    g.cut('M30 25 L28 40 M46 32 L40 50 M58 44 L50 62', 1.1);
    g.fill(R(2, 26, 9, 9, 2), true);
  },
  scroll: (g) => {
    g.fill(R(20, 16, 60, 68, 2));
    g.fill(R(10, 8, 80, 16, 8), true);
    g.fill(R(10, 76, 80, 16, 8), true);
    g.cut('M30 36 L70 36 M30 48 L70 48 M30 60 L60 60', 0.9);
  },
  bell: (g) => {
    g.line('M43 12 Q50 0 57 12', 5);
    g.fill('M50 10 C68 10 74 26 74 42 L76 64 L90 78 L10 78 L24 64 L26 42 C26 26 32 10 50 10 Z');
    g.fill(C(50, 86, 8), true);
    g.cut('M26 62 Q50 68 74 62', 1);
    g.gem(E(38, 34, 5, 10, 15));
  },
  prism: (g) => {
    g.line('M4 60 L34 52', 5);
    g.fill(P(50, 8, 90, 82, 10, 82));
    g.cut('M50 8 L56 82 M30 46 L56 82', 0.8);
    g.line('M70 50 L96 38 M72 56 L96 56 M70 62 L96 74', 4.5);
  },
  droplet: (g) => {
    g.line(E(50, 86, 34, 8), 4.5);
    g.fill(DROP(50, 46, 0.86), true);
    g.gem(E(41, 56, 6, 11, 25));
  },
  web: (g) => {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.line(`M50 50 L${50 + Math.cos(a) * 46} ${50 + Math.sin(a) * 46}`, 3.6);
    }
    for (const r of [14, 27, 40]) {
      const pts: number[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        pts.push(50 + Math.cos(a) * r, 50 + Math.sin(a) * r);
      }
      g.line(P(...pts), 3.6);
    }
  },
  vortex: (g) => {
    for (let i = 0; i < 3; i++) {
      const a0 = (i * Math.PI * 2) / 3;
      const pts = spiralPts(50, 50, 6, 9, 0.62, a0, 12);
      const w = pts.filter((_, k) => k % 2 === 0).map((_, k) => 2 + k * 0.75);
      g.fill(TP(pts, w));
    }
    g.hole(C(50, 50, 5));
  },
  claw: (g) => {
    for (let i = 0; i < 3; i++) {
      const x = 22 + i * 24;
      g.fill(TP([x, 6, x + 8, 34, x + 6, 66, x - 6, 94], [0.5, 6, 5, 0.5]));
    }
  },
  wing: (g) => {
    g.fill('M92 16 C70 14 40 20 20 40 C10 50 7 66 9 82 C20 72 30 72 38 77 C42 68 50 66 58 70 C62 60 70 58 77 62 C82 48 88 36 92 16 Z');
    g.cut('M86 22 C64 26 42 36 28 52 M80 34 C64 40 52 48 42 62 M76 46 C68 52 62 58 58 66', 0.85);
  },
  crystal: (g) => {
    g.fill(P(30, 30, 40, 44, 40, 82, 28, 92, 16, 80, 18, 42));
    g.fill(P(70, 30, 82, 42, 84, 80, 72, 92, 60, 82, 60, 44));
    g.fill(P(50, 4, 64, 22, 64, 76, 50, 92, 36, 76, 36, 22), true);
    g.cut('M50 6 L50 90', 0.8);
    g.gem(P(50, 10, 60, 24, 50, 36, 40, 24));
  },
  sprout: (g) => {
    g.fill('M20 94 Q50 76 80 94 Z');
    g.line('M50 90 Q50 68 50 48', 7);
    g.fill('M50 52 C30 54 12 40 10 20 C32 18 48 30 50 52 Z');
    g.fill('M50 46 C66 44 84 30 88 12 C66 10 52 22 50 46 Z');
    g.cut('M46 46 C36 40 26 32 18 24 M54 40 C64 34 74 26 82 18', 0.8);
  },
  coin: (g) => {
    g.fill(C(50, 50, 44));
    g.cut(C(50, 50, 34));
    g.hole(star(50, 50, 4, 20, 6));
    g.gem(E(32, 30, 7, 4, -40));
  },

  // --- Statuts ---
  stun: (g) => {
    g.line(E(50, 64, 42, 16), 6);
    g.fill(star(22, 60, 5, 15, 6.5), true);
    g.fill(star(52, 76, 5, 17, 7.5), true);
    g.fill(star(80, 58, 5, 14, 6), true);
    g.fill(TP(spiralPts(50, 26, 1, 3.4, 1.4, 0, 16), [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6]), true);
  },
  root: (g) => {
    g.fill(TP([50, 4, 50, 22, 50, 40], [9, 9, 8.5]));
    g.fill(TP([50, 38, 34, 58, 16, 92], [7, 5, 1.5]));
    g.fill(TP([50, 40, 52, 66, 44, 96], [7, 5, 1.5]));
    g.fill(TP([50, 38, 68, 58, 88, 88], [7, 5, 1.5]));
    g.fill(R(8, 34, 84, 9, 4), true);
  },
  disarm: (g) => {
    g.tf(28, 50, 30, 1, 12, -4);
    g.fill('M50 2 L61 15 L61 44 L55.5 50 L50 42 L44.5 50 L39 44 L39 15 Z');
    g.reset();
    g.fill('M39 58 L44.5 52 L50 59 L55.5 52 L61 58 L61 67 L39 67 Z');
    g.fill(R(22, 65, 56, 10, 4));
    g.fill(R(43.5, 74, 13, 14, 3));
    g.fill(C(50, 92, 6.5));
    g.fill(spark(26, 44, 10), true);
  },
  silence: (g) => {
    g.fill('M14 20 Q14 10 24 10 L76 10 Q86 10 86 20 L86 58 Q86 68 76 68 L46 68 L26 88 L30 68 L24 68 Q14 68 14 58 Z');
    g.cut('M28 60 L72 18', 2.4);
  },
  taunt: (g) => {
    g.fill(star(50, 50, 12, 47, 33));
    g.hole(R(44, 20, 12, 38, 5));
    g.hole(C(50, 70, 7));
  },
  burn: (g) => {
    g.fill('M50 4 C58 18 70 24 72 40 C80 34 82 26 80 18 C92 30 94 52 86 66 C80 80 66 92 50 92 C34 92 20 80 14 66 C6 52 8 30 20 18 C18 26 20 34 28 40 C30 24 42 18 50 4 Z');
    g.gem('M50 44 C56 54 66 60 64 72 C62 82 56 86 50 86 C44 86 38 82 36 72 C35 63 46 58 50 44 Z');
  },
  poison: (g) => {
    g.fill(DROP(42, 52, 0.9));
    g.hole(C(34, 62, 5));
    g.hole(C(50, 62, 5));
    g.cut('M34 76 Q42 72 50 76', 1);
    g.fill(C(80, 26, 9), true);
    g.fill(C(84, 52, 6.5), true);
    g.fill(C(78, 72, 5), true);
  },
  bleed: (g) => {
    g.fill(DROP(36, 54, 0.95));
    g.fill(DROP(76, 30, 0.45), true);
    g.fill(DROP(78, 74, 0.38), true);
    g.gem(E(28, 62, 5, 9, 25));
  },
  slow: (g) => {
    g.fill('M6 86 Q8 74 22 74 L80 74 Q92 74 94 62 L96 58 Q98 82 82 86 Z');
    g.line('M84 64 L80 40 M90 62 L92 40', 4);
    g.fill(C(44, 48, 30), true);
    g.cut((p) => {
      const pts = spiralPts(44, 48, 1, 3.6, 1.15, Math.PI, 24);
      p.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
    }, 1.1);
  },
  sunder: (g) => {
    g.tf(-6, 50, 50, 1, -6, 0);
    g.fill('M50 6 L14 17 L14 45 C14 70 32 85 50 94 L46 72 L55 57 L44 41 L54 24 Z');
    g.tf(6, 50, 50, 1, 6, 0);
    g.fill('M50 6 L86 17 L86 45 C86 70 68 85 50 94 L46 72 L55 57 L44 41 L54 24 Z');
    g.reset();
  },
  shred: (g) => {
    g.line(arcP(50, 50, 36, -70, 10), 10);
    g.line(arcP(50, 50, 36, 40, 120), 10);
    g.line(arcP(50, 50, 36, 150, 250), 10);
    g.fill(P(88, 22, 98, 20, 92, 30), true);
    g.fill(P(16, 80, 6, 90, 12, 76), true);
    g.fill(P(74, 92, 82, 98, 70, 98), true);
    g.cut('M36 34 L64 66 M44 30 L70 58', 1.2);
  },
  mark: (g) => {
    g.line('M10 32 L10 10 L32 10 M68 10 L90 10 L90 32 M90 68 L90 90 L68 90 M32 90 L10 90 L10 68', 7);
    g.fill(P(50, 24, 76, 50, 50, 76, 24, 50), true);
    g.hole(C(50, 50, 8));
  },
  untargetable: (g) => {
    g.fill('M4 50 Q50 8 96 50 Q50 92 4 50 Z');
    g.hole(C(50, 50, 15));
    g.line('M14 88 L86 12', 9, true);
  },
  invulnerable: (g) => {
    g.fill(HEATER);
    g.gem(star(50, 46, 5, 22, 9.5));
    g.cut('M22 22 Q50 12 78 22', 0.9);
  },
  ccImmune: (g) => {
    g.line(E(28, 70, 20, 12, -45), 8);
    g.line(E(72, 30, 20, 12, -45), 8, true);
    g.fill(spark(50, 50, 18, 0.18), true);
  },
  buffAd: (g) => {
    g.tf(45, 50, 50, 0.78, -8, 6);
    sword(g);
    arrowUp(g, 80, 4, 0.95);
  },
  buffAs: (g) => {
    g.fill(P(8, 18, 34, 18, 60, 50, 34, 82, 8, 82, 34, 50));
    g.fill(P(42, 18, 68, 18, 94, 50, 68, 82, 42, 82, 68, 50), true);
  },
  buffAp: (g) => {
    g.fill(spark(40, 58, 38, 0.22));
    g.gem(C(40, 58, 6));
    arrowUp(g, 80, 4, 0.95);
  },
  buffArmor: (g) => {
    g.tf(0, 50, 50, 0.8, -8, 8);
    g.fill(HEATER);
    g.cut('M50 22 L50 80 M28 42 L72 42');
    arrowUp(g, 80, 4, 0.95);
  },
  heal: (g) => {
    g.fill(R(37, 8, 26, 84, 8) + ' ' + R(8, 37, 84, 26, 8));
    g.gem(R(44, 16, 12, 22, 5));
  },
  wound: (g) => {
    g.tf(-8, 50, 50, 1, -5, 2);
    g.fill('M50 90 C22 70 6 54 6 34 C6 18 18 8 31 8 C40 8 46 13 50 21 L44 38 L54 52 L46 68 Z');
    g.tf(8, 50, 50, 1, 5, 2);
    g.fill('M50 90 C78 70 94 54 94 34 C94 18 82 8 69 8 C60 8 54 13 50 21 L44 38 L54 52 L46 68 Z');
    g.reset();
  },
  link: (g) => {
    g.line(C(34, 50, 24), 9);
    g.line(C(66, 50, 24), 9, true);
    g.line(arcP(34, 50, 24, -50, 20), 9, true);
  },
  reflect: (g) => {
    g.fill(C(34, 50, 30));
    g.cut(C(34, 50, 21));
    g.gem(E(26, 40, 7, 4, -40));
    g.line('M96 10 L58 44 M58 56 L90 86', 6, true);
    g.fill(P(96, 92, 78, 90, 92, 74), true);
  },
  stasis: (g) => {
    g.fill(P(50, 4, 88, 26, 88, 74, 50, 96, 12, 74, 12, 26));
    g.hole('M36 28 L64 28 C64 40 54 44 54 50 C54 56 64 60 64 72 L36 72 C36 60 46 56 46 50 C46 44 36 40 36 28 Z');
    g.gem('M41 64 L59 64 L59 69 L41 69 Z');
    g.cut('M50 6 L50 20 M50 80 L50 94', 0.9);
  },

  // --- Interface ---
  gold: (g) => {
    g.fill(E(40, 82, 32, 11));
    g.fill(E(40, 72, 32, 11), true);
    g.fill(E(40, 62, 32, 11), true);
    g.fill(C(70, 44, 24), true);
    g.cut(C(70, 44, 17));
    g.hole(star(70, 44, 4, 10, 3));
  },
  xp: (g) => {
    g.fill(spark(44, 54, 42, 0.24));
    g.gem(C(44, 54, 7));
    g.fill(R(74, 6, 9, 30, 3) + ' ' + R(63.5, 16.5, 30, 9, 3), true);
  },
  hp: (g) => {
    g.fill(HEART);
    g.hole(R(44, 28, 12, 40, 3) + ' ' + R(30, 42, 40, 12, 3));
  },
  level: (g) => {
    g.fill(P(50, 4, 90, 27, 90, 73, 50, 96, 10, 73, 10, 27));
    g.hole(P(50, 24, 72, 46, 62, 46, 50, 34, 38, 46, 28, 46));
    g.hole(P(50, 48, 72, 70, 62, 70, 50, 58, 38, 70, 28, 70));
  },
  reroll: (g) => {
    g.line(arcP(50, 50, 32, 200, 330), 10);
    g.fill(P(86, 34, 84, 62, 62, 46), true);
    g.line(arcP(50, 50, 32, 20, 150), 10, true);
    g.fill(P(14, 66, 16, 38, 38, 54), true);
  },
  lock: (g) => {
    g.line('M32 46 L32 30 C32 8 68 8 68 30 L68 46', 9);
    g.fill(R(18, 42, 64, 52, 9), true);
    g.hole(C(50, 62, 7));
    g.hole(R(46.5, 62, 7, 18, 2));
  },
  unlock: (g) => {
    g.line('M32 46 L32 28 C32 4 68 4 68 26 L68 30', 9);
    g.fill(R(18, 42, 64, 52, 9), true);
    g.hole(C(50, 62, 7));
    g.hole(R(46.5, 62, 7, 18, 2));
  },
  sell: (g) => {
    g.fill('M54 6 L88 6 Q94 6 94 12 L94 46 L50 92 Q46 96 42 92 L8 58 Q4 54 8 50 Z');
    g.hole(C(76, 24, 7));
    g.cut(C(48, 54, 14));
    g.hole(star(48, 54, 4, 8, 2.6));
  },
  speed: (g) => {
    g.fill(P(6, 18, 50, 50, 6, 82));
    g.fill(P(46, 18, 90, 50, 46, 82), true);
    g.fill(R(88, 18, 8, 64, 3), true);
  },
  pause: (g) => {
    g.fill(R(20, 14, 22, 72, 6));
    g.fill(R(58, 14, 22, 72, 6));
  },
  play: (g) => {
    g.fill('M26 10 Q20 10 20 18 L20 82 Q20 90 28 86 L86 54 Q92 50 86 46 L28 14 Q26 13 26 10 Z');
  },
  settings: (g) => {
    g.fill(gearP(50, 50, 8, 46, 33, 15));
    g.cut(C(50, 50, 24), 0.9);
  },
  'book-open': (g) => {
    g.fill('M50 22 C38 12 22 12 6 16 L6 82 C22 78 38 78 50 88 Z');
    g.fill('M50 22 C62 12 78 12 94 16 L94 82 C78 78 62 78 50 88 Z', true);
    g.cut('M16 32 Q30 28 42 34 M16 46 Q30 42 42 48 M16 60 Q30 56 42 62 M58 34 Q70 28 84 32 M58 48 Q70 42 84 46 M58 62 Q70 56 84 60', 0.85);
  },
  trophy: (g) => {
    g.line('M28 18 C8 16 8 46 30 46 M72 18 C92 16 92 46 70 46', 6);
    g.fill('M24 8 L76 8 L76 30 C76 50 64 60 50 60 C36 60 24 50 24 30 Z', true);
    g.fill(R(44, 58, 12, 16, 3));
    g.fill(R(28, 72, 44, 8, 3));
    g.fill(R(22, 80, 56, 12, 4));
    g.gem(star(50, 30, 5, 13, 5.5));
  },
  swords: (g) => {
    g.tf(45, 50, 50, 1.02);
    swordWide(g);
    g.tf(-45, 50, 50, 1.02);
    swordWide(g, true);
    g.reset();
  },
  'skull-round': (g) => {
    g.fill(ring(50, 50, 47, 39));
    g.tf(0, 50, 50, 0.66, 0, 1);
    skull(g);
    g.reset();
  },
  'crown-round': (g) => {
    g.fill(ring(50, 50, 47, 39));
    g.tf(0, 50, 50, 0.62, 0, 2);
    crown(g);
    g.reset();
  },
  dice: (g) => {
    g.fill(P(50, 6, 90, 27, 50, 48, 10, 27));
    g.fill(P(10, 27, 50, 48, 50, 96, 10, 74), true);
    g.fill(P(90, 27, 90, 74, 50, 96, 50, 48), true);
    g.shade(P(10, 27, 50, 48, 50, 96, 10, 74), 0.22);
    g.shade(P(90, 27, 90, 74, 50, 96, 50, 48), 0.4);
    g.hole(E(50, 27, 7, 4));
    g.hole(C(24, 50, 4.5));
    g.hole(C(36, 72, 4.5));
    g.hole(C(64, 52, 4.5));
    g.hole(C(76, 60, 4.5));
    g.hole(C(70, 76, 4.5));
  },
  info: (g) => {
    g.fill(C(50, 50, 45));
    g.hole(C(50, 27, 7.5));
    g.hole(R(42.5, 41, 15, 38, 4));
  },
  close: (g) => {
    g.tf(45);
    g.fill(R(40, 4, 20, 92, 7) + ' ' + R(4, 40, 92, 20, 7));
    g.reset();
  },
} satisfies Record<string, GlyphDef>;

export type GlyphKey = keyof typeof GLYPHS;
