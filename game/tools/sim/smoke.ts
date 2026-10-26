import { buildCombat, type BoardUnitSpec } from '../../src/combat/setup';
import { CHAMPIONS, COMBINED } from '../../src/core/content';
import { Rng } from '../../src/core/rng';

const rng = new Rng(42);
function randomTeam(n: number, star: number): BoardUnitSpec[] {
  const pool = CHAMPIONS.slice();
  rng.shuffle(pool);
  const units: BoardUnitSpec[] = [];
  const used = new Set<string>();
  for (const c of pool.slice(0, n)) {
    let hex;
    do {
      const front = c.position === 'front';
      hex = { col: rng.int(7), row: front ? rng.int(2) : 2 + rng.int(2) };
    } while (used.has(hex.col + ',' + hex.row));
    used.add(hex.col + ',' + hex.row);
    const items = rng.chance(0.5) ? [rng.pick(COMBINED).id] : [];
    units.push({ defId: c.id, star, items, hex });
  }
  return units;
}
let total = 0, draws = 0, maxDur = 0, errors = 0;
const t0 = Date.now();
const N = Number(process.argv[2] ?? 300);
for (let i = 0; i < N; i++) {
  const a = randomTeam(7, 1 + (i % 3 === 0 ? 1 : 0));
  const b = randomTeam(7, 1 + (i % 3 === 1 ? 1 : 0));
  try {
    const sim = buildCombat([{ units: a }, { units: b }], { seed: i, stage: 2 + (i % 5) });
    const r = sim.run();
    total += r.duration;
    if (r.winner === -1) draws++;
    maxDur = Math.max(maxDur, r.duration);
    if (sim.warnings.length) console.log('warn', i, sim.warnings.slice(0, 3));
  } catch (e) {
    errors++;
    if (errors < 5) console.error('ERR', i, e);
  }
}
console.log({ N, avgDur: (total / N).toFixed(2), draws, maxDur: maxDur.toFixed(2), errors, ms: Date.now() - t0 });
