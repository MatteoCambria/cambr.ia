/**
 * Valeur propre des synergies : la même équipe affronte les mêmes adversaires, une fois avec
 * les effets de la synergie et une fois sans. L'écart de taux de victoire mesure ce que la
 * synergie apporte, indépendamment des rôles des champions qui la portent.
 * Usage : npx tsx tools/sim/traitpower.ts [matchs par palier=300]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildCombat, computeTraits, type BoardUnitSpec } from '../../src/combat/setup';
import { CHAMPIONS, COMBINED, TRAITS, getChampion } from '../../src/core/content';
import { Rng } from '../../src/core/rng';

const M = Number(process.argv[2] ?? 300);
const TEAM = 7;
const rng = new Rng('traitpower');

function place(ids: string[]): BoardUnitSpec[] {
  const used = new Set<string>();
  return ids.map((id) => {
    const pos = getChampion(id).position;
    const rows = pos === 'front' ? [0, 1] : pos === 'back' ? [3, 2] : [1, 2];
    let hex = { col: 0, row: 0 };
    for (let t = 0; t < 40; t++) {
      hex = { col: rng.int(7), row: rows[t < 20 ? 0 : 1] };
      if (!used.has(hex.col + ',' + hex.row)) break;
    }
    used.add(hex.col + ',' + hex.row);
    return { defId: id, star: 2, items: rng.chance(0.4) ? [rng.pick(COMBINED).id] : [], hex };
  });
}

const score = (w: 0 | 1 | -1, side: 0 | 1) => (w === side ? 1 : w === -1 ? 0.5 : 0);
const rows: { trait: string; count: number; withTrait: number; without: number; delta: number }[] = [];
const t0 = Date.now();
for (const t of TRAITS) {
  const members = CHAMPIONS.filter((c) => c.traits.includes(t.id) && c.cost <= 4);
  for (let li = 0; li < Math.min(2, t.thresholds.length); li++) {
    const need = t.thresholds[li];
    if (members.length < need) continue;
    let w1 = 0;
    let w0 = 0;
    let n = 0;
    for (let m = 0; m < M; m++) {
      const a = rng.shuffle(members.slice()).slice(0, need).map((c) => c.id);
      while (a.length < TEAM) a.push(rng.pick(CHAMPIONS.filter((x) => x.cost <= 4 && !a.includes(x.id) && !x.traits.includes(t.id))).id);
      const st = computeTraits(a.map((defId) => ({ defId }))).find((x) => x.id === t.id);
      if (!st || st.level !== li + 1) continue;
      const b: string[] = [];
      for (const id of a) {
        const cost = getChampion(id).cost;
        const same = CHAMPIONS.filter((x) => x.cost === cost && !a.includes(x.id) && !b.includes(x.id));
        b.push(rng.pick(same.length ? same : CHAMPIONS.filter((x) => !a.includes(x.id) && !b.includes(x.id))).id);
      }
      const pa = place(a);
      const pb = place(b);
      const seed = m * 31 + li * 7 + t.id.length;
      w1 += score(buildCombat([{ units: pa }, { units: pb }], { seed, stage: 4 }).run().winner, 0);
      w0 += score(buildCombat([{ units: pa }, { units: pb }], { seed, stage: 4, disabledTraits: [[t.id], []] }).run().winner, 0);
      n++;
    }
    const withTrait = +((w1 / n) * 100).toFixed(1);
    const without = +((w0 / n) * 100).toFixed(1);
    rows.push({ trait: t.name, count: need, withTrait, without, delta: +(withTrait - without).toFixed(1) });
  }
}
mkdirSync('reports', { recursive: true });
writeFileSync('reports/traitpower.json', JSON.stringify(rows, null, 1));
console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s — écart = gain de taux de victoire apporté par la synergie`);
for (const r of rows.sort((a, b) => b.delta - a.delta)) {
  const flag = r.delta > 30 ? '  ▲ très fort' : r.delta < 6 ? '  ▼ faible' : '';
  console.log(`  ${(r.trait + ' (' + r.count + ')').padEnd(18)} ${String(r.delta).padStart(5)} pts  (${r.without} → ${r.withTrait} %)${flag}`);
}
