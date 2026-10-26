/**
 * Mesure de la difficulté : lobbies mixtes, chaque siège a sa propre difficulté.
 * Les unités ont les mêmes statistiques pour tous : seule la qualité des décisions change.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createGame, advanceCarousel, startCombatPhase, simulateCombats, resolveRound } from '../../src/game/game';
import type { CombatResult } from '../../src/combat/sim';
import type { Difficulty } from '../../src/game/types';

const N = Number(process.argv[2] ?? 20);
const seats: Difficulty[] = ['facile', 'facile', 'normal', 'normal', 'normal', 'difficile', 'difficile', 'difficile'];
const place: Record<Difficulty, number[]> = { facile: [], normal: [], difficile: [] };
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const st = createGame({ playerCount: 8, prepTime: 0, difficulty: 'normal', seed: 'diff' + g, playerName: 'Bot' }, { allBots: true });
  // rotation des sièges pour éviter tout biais de position
  st.players.forEach((p, i) => (p.ai!.difficulty = seats[(i + g) % 8]));
  let guard = 0;
  while (st.phase !== 'gameOver' && guard++ < 120) {
    if (st.phase === 'carousel') advanceCarousel(st);
    else {
      startCombatPhase(st);
      resolveRound(st, simulateCombats(st, false) as CombatResult[], false);
    }
  }
  for (const p of st.players) place[p.ai!.difficulty!].push(p.placement ?? 8);
}
const out: { difficulty: Difficulty; n: number; avgPlace: number; top4: number; wins: number }[] = [];
for (const d of ['facile', 'normal', 'difficile'] as Difficulty[]) {
  const a = place[d];
  const avg = a.reduce((s, x) => s + x, 0) / a.length;
  const top4 = a.filter((x) => x <= 4).length / a.length;
  const wins = a.filter((x) => x === 1).length / a.length;
  out.push({ difficulty: d, n: a.length, avgPlace: +avg.toFixed(2), top4: +(top4 * 100).toFixed(1), wins: +(wins * 100).toFixed(1) });
  console.log(`${d.padEnd(10)} place moyenne ${avg.toFixed(2)}  top4 ${(top4 * 100).toFixed(0)} %  victoires ${(wins * 100).toFixed(0)} %  (n=${a.length})`);
}
mkdirSync('reports', { recursive: true });
writeFileSync('reports/difficulty.json', JSON.stringify({ games: N, seats, results: out }, null, 1));
console.log(`${N} parties en ${((Date.now() - t0) / 1000).toFixed(1)} s — reports/difficulty.json`);
