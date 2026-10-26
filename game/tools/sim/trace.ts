/** Trace d'un profil d'IA manche par manche (or, niveau, PV, valeur du plateau). */
import { createGame, advanceCarousel, startCombatPhase, simulateCombats, resolveRound } from '../../src/game/game';
import type { CombatResult } from '../../src/combat/sim';
import { getChampion } from '../../src/core/content';
import { roundAt } from '../../src/config/rounds';

const profile = process.argv[2] ?? 'econome';
const seed = process.argv[3] ?? 'trace1';
const st = createGame({ playerCount: 8, prepTime: 0, difficulty: 'normal', seed, playerName: 'Bot' }, { allBots: true });
const target = st.players.find((p) => p.ai?.profile === profile) ?? st.players[1];
console.log(`Suivi de ${target.name} (${target.ai?.profile})`);
let guard = 0;
while (st.phase !== 'gameOver' && guard++ < 120 && target.alive) {
  if (st.phase === 'carousel') {
    advanceCarousel(st);
    continue;
  }
  const r = roundAt(st.roundIndex);
  const val = target.board.reduce((s, u) => s + getChampion(u.defId).cost * Math.pow(3, u.star - 1), 0);
  console.log(`${r.label.padEnd(4)} or ${String(target.gold).padStart(3)}  niv ${target.level}  PV ${String(target.hp).padStart(3)}  plateau ${target.board.length} (valeur ${val})  série ${target.streak}  ${target.board.map((u) => getChampion(u.defId).name.slice(0, 6) + u.star).join(' ')}`);
  startCombatPhase(st);
  resolveRound(st, simulateCombats(st, false) as CombatResult[], false);
}
console.log(`Place finale : ${target.placement}`);
