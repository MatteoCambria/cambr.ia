/**
 * Génère les catalogues de contenu (champions, synergies, objets, créatures) à partir des
 * données du jeu : la documentation ne peut pas diverger de ce que le moteur exécute.
 * Usage : npx tsx tools/docs.ts  →  docs/champions.md, docs/synergies.md, docs/objets.md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { CHAMPIONS, COMBINED, COMPONENTS, CONSUMABLES, CREATURES, SUMMONS, TRAITS, getItem, getTrait, championsWithTrait } from '../src/core/content';
import { ROLE_LABELS, type ChampionDef } from '../src/core/defs';
import { STAR_AD_MULT, STAR_HP_MULT } from '../src/config/balance';
import { PVE_ENCOUNTERS } from '../src/config/rounds';
import type { ValueMap } from '../src/combat/dsl';
import { fmt } from '../src/combat/values';
import { statText } from '../src/core/statText';
import { apScaledKeys } from '../src/ui/text';

const POSITION: Record<string, string> = { front: 'Ligne avant', back: 'Ligne arrière', flex: 'Polyvalent' };

/** Remplace les {clés} par leurs valeurs (1★/2★/3★) ; ✦ = multiplié par la Puissance. */
function fill(text: string, values: ValueMap | undefined, apKeys = new Set<string>()): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = values?.[k];
    if (v === undefined) return `{${k}}`;
    const s = typeof v === 'number' ? fmt(v) : v.map((n) => fmt(n)).join('/');
    return `**${s}**${apKeys.has(k) ? '✦' : ''}`;
  });
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const traitNames = (c: ChampionDef) => c.traits.map((t) => getTrait(t).name + (c.countsAs?.[t] ? ` (compte ×${c.countsAs[t]})` : '')).join(', ');
const anchor = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/ /g, '-');

function champions(): string {
  const out: string[] = [];
  out.push('# Champions', '');
  out.push(`${CHAMPIONS.length} champions, générés depuis \`src/champions/data/\` par \`npm run docs\`.`, '');
  out.push('Les valeurs `a/b/c` sont celles des rangs 1★/2★/3★. ✦ : valeur multipliée par la Puissance (100 = base).');
  out.push('PV et PA augmentent avec le rang (×' + STAR_HP_MULT.slice(1).join(' / ×') + ' pour les PV, ×' + STAR_AD_MULT.slice(1).join(' / ×') + ' pour les PA).', '');
  out.push('## Vue d’ensemble', '');
  out.push('| Coût | Champion | Synergies | Rôle | Position | Compétence |', '|---|---|---|---|---|---|');
  for (const c of [...CHAMPIONS].sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))) {
    out.push(`| ${c.cost} | [${c.name}](#${anchor(c.name)}) | ${traitNames(c)} | ${ROLE_LABELS[c.role]}${c.secondaryRole ? ' / ' + ROLE_LABELS[c.secondaryRole] : ''} | ${POSITION[c.position]} | ${cell(c.ability.name)} |`);
  }
  for (let cost = 1; cost <= 5; cost++) {
    out.push('', `## Coût ${cost}`, '');
    for (const c of CHAMPIONS.filter((x) => x.cost === cost).sort((a, b) => a.name.localeCompare(b.name))) {
      const s = c.stats;
      const hp = STAR_HP_MULT.slice(1).map((m) => Math.round(s.hp * m)).join('/');
      const ad = STAR_AD_MULT.slice(1).map((m) => Math.round(s.ad * m)).join('/');
      out.push(`### ${c.name}`, '');
      out.push(`*${c.title}* — coût ${c.cost} · ${traitNames(c)} · ${ROLE_LABELS[c.role]}${c.secondaryRole ? ' / ' + ROLE_LABELS[c.secondaryRole] : ''} · ${POSITION[c.position]}`, '');
      out.push(
        `PV ${hp} · PA ${ad} · vitesse d’attaque ${fmt(s.as)} · armure ${s.armor} · RM ${s.mr} · portée ${s.range} · mana ${s.mana[0]}/${s.mana[1]}` +
          (s.critChance ? ` · critique ${s.critChance} %` : ''),
        '',
      );
      out.push(`**${c.ability.name}** — ${fill(c.ability.desc, c.ability.values, apScaledKeys(c.ability.actions))}`, '');
      if (c.passive?.desc) out.push(`*Passif${c.passive.name ? ' — ' + c.passive.name : ''}* : ${fill(c.passive.desc, c.passive.values, apScaledKeys(c.passive.triggers ?? []))}`, '');
      out.push(`Rôle : ${c.roleNote}`, '');
      if (c.preferredItems?.length) out.push(`Objets conseillés : ${c.preferredItems.slice(0, 4).map((i) => getItem(i).name).join(', ')}`, '');
      out.push(`> ${c.lore}`, '');
    }
  }
  return out.join('\n');
}

function synergies(): string {
  const out: string[] = [];
  const origins = TRAITS.filter((t) => t.kind === 'origin');
  const classes = TRAITS.filter((t) => t.kind === 'class');
  out.push('# Synergies', '');
  out.push(`${TRAITS.length} synergies (${origins.length} origines, ${classes.length} classes), générées depuis \`src/traits/data.ts\` par \`npm run docs\`.`, '');
  out.push('Une synergie est comptée une fois par champion **différent** présent sur le plateau (les exemplaires en double ne comptent pas).', '');
  out.push('| Synergie | Type | Paliers | Champions |', '|---|---|---|---|');
  for (const t of TRAITS) {
    out.push(`| [${t.name}](#${anchor(t.name)}) | ${t.kind === 'origin' ? 'Origine' : 'Classe'} | ${t.thresholds.join(' / ')} | ${championsWithTrait(t.id).length} |`);
  }
  for (const [title, list] of [
    ['Origines', origins],
    ['Classes', classes],
  ] as const) {
    out.push('', `## ${title}`, '');
    for (const t of list) {
      out.push(`### ${t.name}`, '');
      out.push(t.desc, '');
      t.levels.forEach((l, i) => out.push(`- **(${t.thresholds[i]})** ${fill(l.desc, l.values)}`));
      const members = championsWithTrait(t.id).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
      out.push('', `Champions : ${members.map((c) => `${c.name} (${c.cost})`).join(', ')}`, '');
      out.push(`Comment la contrer : ${t.counter}`, '');
      out.push(`> ${t.lore}`, '');
    }
  }
  return out.join('\n');
}

function items(): string {
  const out: string[] = [];
  out.push('# Objets', '');
  out.push(`${COMPONENTS.length} composants et ${COMBINED.length} objets combinés, générés depuis \`src/items/data.ts\` par \`npm run docs\`.`, '');
  out.push('Deux composants posés sur le même champion fusionnent automatiquement. Un champion porte au plus 3 objets.', '');
  out.push('## Composants', '', '| Composant | Statistiques |', '|---|---|');
  for (const c of COMPONENTS) out.push(`| ${c.name} | ${c.stats.map(statText).join(', ')} |`);
  out.push('', '## Table des recettes', '');
  out.push('| | ' + COMPONENTS.map((c) => c.name).join(' | ') + ' |');
  out.push('|---|' + COMPONENTS.map(() => '---').join('|') + '|');
  for (const a of COMPONENTS) {
    const row = COMPONENTS.map((b) => COMBINED.find((x) => x.recipe && ((x.recipe[0] === a.id && x.recipe[1] === b.id) || (x.recipe[0] === b.id && x.recipe[1] === a.id)))?.name ?? '—');
    out.push(`| **${a.name}** | ${row.join(' | ')} |`);
  }
  out.push('', '## Objets combinés', '', '| Objet | Recette | Statistiques | Effet |', '|---|---|---|---|');
  for (const it of COMBINED) {
    const recipe = it.recipe ? `${getItem(it.recipe[0]).name} + ${getItem(it.recipe[1]).name}` : '—';
    out.push(`| ${it.name}${it.unique ? ' *(unique)*' : ''} | ${recipe} | ${it.stats.map(statText).join(', ') || '—'} | ${cell(fill(it.desc, it.passive?.values))} |`);
  }
  out.push('', '## Consommables', '', '| Objet | Effet |', '|---|---|');
  for (const c of CONSUMABLES) out.push(`| ${c.name} | ${cell(c.desc)} |`);
  out.push('', '## Invocations', '', '| Invocation | PV | PA | Portée | Description |', '|---|---|---|---|---|');
  for (const s of Object.values(SUMMONS)) out.push(`| ${s.name} | ${s.stats.hp} | ${s.stats.ad} | ${s.stats.range} | ${cell(s.desc)} |`);
  out.push('', '## Créatures des rencontres neutres', '', '| Créature | PV | PA | Armure / RM | Portée |', '|---|---|---|---|---|');
  for (const c of Object.values(CREATURES)) out.push(`| ${c.name} | ${c.stats.hp} | ${c.stats.ad} | ${c.stats.armor} / ${c.stats.mr} | ${c.stats.range} |`);
  out.push('', `Rencontres : ${Object.values(PVE_ENCOUNTERS).map((e) => e.name).join(', ')}.`, '');
  return out.join('\n');
}

mkdirSync('docs', { recursive: true });
writeFileSync('docs/champions.md', champions() + '\n');
writeFileSync('docs/synergies.md', synergies() + '\n');
writeFileSync('docs/objets.md', items() + '\n');
console.log(`docs/champions.md (${CHAMPIONS.length}), docs/synergies.md (${TRAITS.length}), docs/objets.md (${COMPONENTS.length + COMBINED.length})`);
