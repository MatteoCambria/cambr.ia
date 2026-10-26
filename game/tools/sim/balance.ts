/**
 * Analyse d'équilibrage par parties entièrement simulées (8 IA).
 * Usage : npx tsx tools/sim/balance.ts [parties=80] [difficulté=normal] [étiquette]
 * Exporte reports/balance-<étiquette>.json et des CSV (champions, synergies, objets).
 *
 * Indicateur principal : place moyenne des joueurs dont le plateau final contient
 * le champion / la synergie / l'objet (4,5 = neutre sur 8 joueurs ; plus bas = plus fort).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { runHeadlessGame } from '../../src/game/game';
import { computeTraits } from '../../src/combat/setup';
import { CHAMPIONS, COMBINED, TRAITS, getChampion } from '../../src/core/content';
import type { Difficulty } from '../../src/game/types';

const N = Number(process.argv[2] ?? 80);
const diff = (process.argv[3] ?? 'normal') as Difficulty;
const label = process.argv[4] ?? diff;

interface Acc {
  n: number;
  placeSum: number;
  top4: number;
  wins: number;
  stars: number;
}
const acc = () => ({ n: 0, placeSum: 0, top4: 0, wins: 0, stars: 0 });
const champ = new Map<string, Acc>();
const champDamage = new Map<string, { dmg: number; rounds: number }>();
const trait = new Map<string, Acc>();
const traitLvl = new Map<string, Acc>();
const item = new Map<string, Acc>();
const profile = new Map<string, Acc>();
const durations: number[] = [];
let draws = 0;
let combats = 0;
let rounds = 0;
const finalLevels: number[] = [];

const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const st = runHeadlessGame({ playerCount: 8, prepTime: 0, difficulty: diff, seed: `bal-${label}-${g}`, playerName: 'Bot' });
  rounds += st.roundIndex + 1;
  for (const rec of st.history) {
    for (const r of rec.results) {
      if (rec.kind !== 'pvp') continue;
      combats++;
      durations.push(r.duration);
      if (r.draw) draws++;
    }
  }
  for (const p of st.players) {
    const place = p.placement ?? 8;
    const add = (m: Map<string, Acc>, k: string, star = 0) => {
      const a = m.get(k) ?? acc();
      a.n++;
      a.placeSum += place;
      if (place <= 4) a.top4++;
      if (place === 1) a.wins++;
      a.stars += star;
      m.set(k, a);
    };
    add(profile, p.ai?.profile ?? 'humain');
    const board = p.snapshot?.board ?? [];
    finalLevels.push(p.snapshot?.level ?? p.level);
    const seen = new Set<string>();
    for (const u of board) {
      if (!seen.has(u.defId)) add(champ, u.defId, u.star);
      seen.add(u.defId);
      for (const it of u.items) add(item, it);
    }
    for (const t of computeTraits(board)) {
      if (t.level <= 0) continue;
      add(trait, t.id);
      add(traitLvl, `${t.id}:${t.thresholds[t.level - 1]}`);
    }
    for (const [id, d] of Object.entries(p.stats.championDamage)) {
      const cd = champDamage.get(id) ?? { dmg: 0, rounds: 0 };
      cd.dmg += d;
      cd.rounds += p.stats.championRounds[id] ?? 0;
      champDamage.set(id, cd);
    }
  }
  if ((g + 1) % 10 === 0) console.log(`${g + 1}/${N} parties (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

const fmt = (a: Acc) => ({ n: a.n, avgPlace: +(a.placeSum / a.n).toFixed(2), top4: +((a.top4 / a.n) * 100).toFixed(1), win: +((a.wins / a.n) * 100).toFixed(1), avgStar: +(a.stars / a.n).toFixed(2) });
const totalBoards = N * 8;
const champRows = CHAMPIONS.map((c) => {
  const a = champ.get(c.id) ?? acc();
  const d = champDamage.get(c.id) ?? { dmg: 0, rounds: 0 };
  return { id: c.id, name: c.name, cost: c.cost, pickRate: +((a.n / totalBoards) * 100).toFixed(1), ...fmt(a.n ? a : { ...a, n: 1, placeSum: NaN }), dmgPerRound: d.rounds ? Math.round(d.dmg / d.rounds) : 0 };
}).sort((x, y) => x.avgPlace - y.avgPlace);
const traitRows = TRAITS.map((t) => ({ id: t.id, name: t.name, ...fmt(trait.get(t.id) ?? { ...acc(), n: 1, placeSum: NaN }), rate: +(((trait.get(t.id)?.n ?? 0) / totalBoards) * 100).toFixed(1) })).sort((a, b) => a.avgPlace - b.avgPlace);
const traitLvlRows = [...traitLvl.entries()].map(([k, a]) => ({ key: k, ...fmt(a) })).sort((a, b) => a.avgPlace - b.avgPlace);
const itemRows = COMBINED.map((i) => ({ id: i.id, name: i.name, ...fmt(item.get(i.id) ?? { ...acc(), n: 1, placeSum: NaN }), count: item.get(i.id)?.n ?? 0 })).sort((a, b) => a.avgPlace - b.avgPlace);
const profileRows = [...profile.entries()].map(([k, a]) => ({ profile: k, ...fmt(a) })).sort((a, b) => a.avgPlace - b.avgPlace);
durations.sort((a, b) => a - b);
const summary = {
  games: N,
  difficulty: diff,
  avgRounds: +(rounds / N).toFixed(1),
  pvpCombats: combats,
  drawRate: +((draws / Math.max(1, combats)) * 100).toFixed(2),
  combatDuration: { mean: +(durations.reduce((s, x) => s + x, 0) / durations.length).toFixed(1), p50: +durations[Math.floor(durations.length * 0.5)].toFixed(1), p90: +durations[Math.floor(durations.length * 0.9)].toFixed(1) },
  avgFinalLevel: +(finalLevels.reduce((s, x) => s + x, 0) / finalLevels.length).toFixed(2),
  seconds: Math.round((Date.now() - t0) / 1000),
};

mkdirSync('reports', { recursive: true });
writeFileSync(`reports/balance-${label}.json`, JSON.stringify({ summary, champions: champRows, traits: traitRows, traitLevels: traitLvlRows, items: itemRows, profiles: profileRows }, null, 1));
const csv = (rows: Record<string, unknown>[]) => [Object.keys(rows[0]).join(';'), ...rows.map((r) => Object.values(r).join(';'))].join('\n');
writeFileSync(`reports/balance-${label}-champions.csv`, csv(champRows));
writeFileSync(`reports/balance-${label}-synergies.csv`, csv(traitRows));
writeFileSync(`reports/balance-${label}-objets.csv`, csv(itemRows));

console.log('\n=== Résumé ===', summary);
console.log('\nProfils :', profileRows.map((r) => `${r.profile} ${r.avgPlace}`).join(' · '));
console.log('\nSynergies (place moyenne, présence %) :');
for (const r of traitRows) console.log(`  ${r.name.padEnd(12)} ${String(r.avgPlace).padEnd(5)} ${r.rate}%`);
console.log('\nChampions les plus forts :');
for (const r of champRows.slice(0, 10)) console.log(`  ${r.name.padEnd(20)} ${r.cost}or place ${r.avgPlace} choix ${r.pickRate}%`);
console.log('Champions les plus faibles (n ≥ 15) :');
for (const r of champRows.filter((r) => r.n >= 15).slice(-10)) console.log(`  ${r.name.padEnd(20)} ${r.cost}or place ${r.avgPlace} choix ${r.pickRate}%`);
console.log('Jamais ou presque joués :', champRows.filter((r) => r.n < 5).map((r) => getChampion(r.id).name).join(', ') || 'aucun');
