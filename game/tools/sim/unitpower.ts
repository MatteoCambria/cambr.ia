/**
 * Puissance relative des champions à coût égal.
 * Chaque match oppose deux équipes de même profil de coûts : chaque emplacement de l'équipe B
 * est un champion différent du même coût que l'emplacement correspondant de l'équipe A.
 * Le taux de victoire d'un champion mesure donc sa force par rapport à ses pairs de même coût
 * (50 % = dans la norme). Usage : npx tsx tools/sim/unitpower.ts [matchs=6000] [étoiles=2]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildCombat, type BoardUnitSpec } from '../../src/combat/setup';
import { CHAMPIONS, COMBINED, getChampion } from '../../src/core/content';
import { Rng } from '../../src/core/rng';

const M = Number(process.argv[2] ?? 6000);
const STAR = Number(process.argv[3] ?? 2);
const rng = new Rng('unitpower');
const PROFILES = [
  [1, 1, 2, 2, 3, 3],
  [1, 2, 2, 3, 3, 4],
  [2, 2, 3, 3, 4, 4, 5],
  [2, 3, 3, 4, 4, 5, 5],
  [1, 2, 3, 4, 5, 3, 2],
];
const byCost = (c: number) => CHAMPIONS.filter((x) => x.cost === c);

function place(ids: string[]): BoardUnitSpec[] {
  const used = new Set<string>();
  const out: BoardUnitSpec[] = [];
  for (const id of ids) {
    const pos = getChampion(id).position;
    const rows = pos === 'front' ? [0, 1] : pos === 'back' ? [3, 2] : [1, 2];
    let hex = { col: 0, row: 0 };
    for (let t = 0; t < 40; t++) {
      hex = { col: rng.int(7), row: rows[t < 20 ? 0 : 1] };
      if (!used.has(hex.col + ',' + hex.row)) break;
    }
    used.add(hex.col + ',' + hex.row);
    out.push({ defId: id, star: STAR, items: rng.chance(0.5) ? [rng.pick(COMBINED).id] : [], hex });
  }
  return out;
}

const stats = new Map<string, { w: number; n: number; dmg: number }>();
const t0 = Date.now();
for (let m = 0; m < M; m++) {
  const prof = rng.pick(PROFILES);
  const a: string[] = [];
  const b: string[] = [];
  for (const cost of prof) {
    const pool = byCost(cost).filter((c) => !a.includes(c.id) && !b.includes(c.id));
    rng.shuffle(pool);
    a.push(pool[0].id);
    b.push(pool[1].id);
  }
  const sim = buildCombat([{ units: place(a) }, { units: place(b) }], { seed: m, stage: 4 });
  const r = sim.run();
  for (const u of sim.units) {
    if (u.kind !== 'champion') continue;
    const s = stats.get(u.ident.defId) ?? { w: 0, n: 0, dmg: 0 };
    s.n++;
    if (r.winner === u.side) s.w++;
    else if (r.winner === -1) s.w += 0.5;
    s.dmg += u.combat.damageDealt;
    stats.set(u.ident.defId, s);
  }
}
const rows = CHAMPIONS.map((c) => {
  const s = stats.get(c.id) ?? { w: 0, n: 1, dmg: 0 };
  return { id: c.id, name: c.name, cost: c.cost, n: s.n, winRate: +((s.w / s.n) * 100).toFixed(1), avgDmg: Math.round(s.dmg / s.n) };
});
rows.sort((a, b) => a.cost - b.cost || b.winRate - a.winRate);
mkdirSync('reports', { recursive: true });
writeFileSync(`reports/unitpower-${STAR}star.json`, JSON.stringify(rows, null, 1));
console.log(`${M} matchs en ${((Date.now() - t0) / 1000).toFixed(0)} s (rang ${STAR}★)`);
for (const cost of [1, 2, 3, 4, 5]) {
  console.log(`\n— ${cost} or —`);
  for (const r of rows.filter((x) => x.cost === cost)) {
    const flag = r.winRate > 58 ? '  ▲ trop fort' : r.winRate < 42 ? '  ▼ trop faible' : '';
    console.log(`  ${r.name.padEnd(20)} ${String(r.winRate).padStart(5)} %  dégâts ${String(r.avgDmg).padStart(6)}  (n=${r.n})${flag}`);
  }
}
