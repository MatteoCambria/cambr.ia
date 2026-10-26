import { runHeadlessGame, integrityErrors } from '../../src/game/game';
import { checkPoolIntegrity } from '../../src/shop/pool';
import { getChampion } from '../../src/core/content';
import { computeTraits } from '../../src/combat/setup';

const N = Number(process.argv[2] ?? 3);
const diff = (process.argv[3] ?? 'normal') as 'facile' | 'normal' | 'difficile';
for (let g = 0; g < N; g++) {
  const t0 = Date.now();
  const st = runHeadlessGame({ playerCount: 8, prepTime: 0, difficulty: diff, seed: 'smoke' + g, playerName: 'Bot' });
  const errs = [...integrityErrors(st), ...checkPoolIntegrity(st)];
  console.log(`partie ${g}: ${st.roundIndex} manches, phase=${st.phase}, vainqueur=${st.winnerId}, ${Date.now() - t0} ms, erreurs=${errs.length}`);
  if (errs.length) console.log(errs.slice(0, 5));
  for (const p of st.players.slice().sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0))) {
    const traits = computeTraits(p.board).filter((t) => t.level > 0).map((t) => `${t.id}${t.count}`).join(' ');
    console.log(`  #${p.placement} ${p.name.padEnd(15)} ${p.ai?.profile?.padEnd(11)} lvl${p.level} hp${p.hp} or${p.gold} | ${p.board.map((u) => getChampion(u.defId).name + '★'.repeat(u.star)).join(', ')} | ${traits}`);
  }
}
