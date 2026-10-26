/**
 * Validation statique du contenu déclaratif. Utilisée par les tests et par `npm run validate`.
 * Vérifie que chaque description correspond aux valeurs utilisées par le moteur.
 */
import { CHAMPIONS, COMBINED, COMPONENTS, CREATURES, ITEMS, SUMMONS, TRAITS, combine } from './content';
import type { ValueMap } from '../combat/dsl';
import { POOL_COPIES } from '../config/balance';

const V_FIELDS = new Set([
  'base', 'ad', 'ap', 'armor', 'mr', 'casterHp', 'targetHp', 'targetMissingHp', 'targetCurrentHp', 'event',
  'value', 'duration', 'count', 'bounces', 'times', 'attacks', 'threshold', 'share', 'hpPct', 'reviveHpPct',
  'level', 'pct', 'p', 'add', 'amount',
]);

function collectRefs(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const n of node) collectRefs(n, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (typeof v === 'string' && V_FIELDS.has(k)) out.add(v.startsWith('-') ? v.slice(1) : v);
    else if (v && typeof v === 'object' && k !== 'values') collectRefs(v, out);
  }
}

function placeholders(desc: string): string[] {
  return [...desc.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

export function validateContent(): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const traitIds = new Set(TRAITS.map((t) => t.id));
  const itemIds = new Set(ITEMS.map((i) => i.id));

  const checkValues = (where: string, desc: string, values: ValueMap | undefined, body: unknown) => {
    const refs = new Set<string>();
    collectRefs(body, refs);
    for (const r of refs) if (!values || !(r in values)) errors.push(`${where} : valeur « ${r} » utilisée par le moteur mais non définie`);
    for (const p of placeholders(desc)) if (!values || !(p in values)) errors.push(`${where} : la description cite {${p}} sans valeur`);
    if (values)
      for (const [k, v] of Object.entries(values)) {
        if (!refs.has(k) && !placeholders(desc).includes(k)) warnings.push(`${where} : valeur « ${k} » inutilisée`);
        if (Array.isArray(v) && v.length !== 3) errors.push(`${where} : « ${k} » doit avoir 3 valeurs (une par rang)`);
      }
  };

  for (const c of CHAMPIONS) {
    if (ids.has(c.id)) errors.push(`Identifiant en double : ${c.id}`);
    ids.add(c.id);
    if (![1, 2, 3, 4, 5].includes(c.cost)) errors.push(`${c.id} : coût invalide`);
    for (const t of c.traits) if (!traitIds.has(t)) errors.push(`${c.id} : synergie inconnue ${t}`);
    if (c.stats.hp <= 0 || c.stats.as <= 0 || c.stats.range < 1) errors.push(`${c.id} : statistiques invalides`);
    if (c.stats.mana[0] > c.stats.mana[1]) errors.push(`${c.id} : mana de départ > maximum`);
    if (c.stats.range >= 2 && !c.attack?.projectile) warnings.push(`${c.id} : attaque à distance sans projectile défini`);
    checkValues(`${c.id}.compétence`, c.ability.desc, c.ability.values, c.ability.actions);
    if (c.passive) {
      const pv = c.passive.values;
      checkValues(`${c.id}.passif`, c.passive.desc ?? '', pv, { t: c.passive.triggers, s: c.passive.stats, c: c.passive.conditional, g: c.passive.guard, sp: c.passive.splash });
    }
    for (const it of c.preferredItems ?? []) if (!itemIds.has(it)) errors.push(`${c.id} : objet conseillé inconnu ${it}`);
    collectSummons(c.ability.actions, (s) => {
      if (!SUMMONS[s]) errors.push(`${c.id} : invocation inconnue ${s}`);
    });
    if (!c.lore || !c.roleNote || !c.title) errors.push(`${c.id} : textes manquants`);
  }

  // répartition du roster
  for (const cost of [1, 2, 3, 4, 5]) {
    const n = CHAMPIONS.filter((c) => c.cost === cost).length;
    if (n < 6) errors.push(`Trop peu de champions à ${cost} or (${n})`);
    if (!POOL_COPIES[cost]) errors.push(`Pas de taille de pool pour le coût ${cost}`);
  }

  for (const t of TRAITS) {
    if (t.levels.length !== t.thresholds.length) errors.push(`${t.id} : paliers et effets désalignés`);
    const members = CHAMPIONS.filter((c) => c.traits.includes(t.id));
    const maxCount = members.reduce((s, c) => s + (c.countsAs?.[t.id] ?? 1), 0);
    const top = t.thresholds[t.thresholds.length - 1];
    if (maxCount < top) errors.push(`${t.id} : palier ${top} inatteignable (${maxCount} membres)`);
    t.levels.forEach((lvl, i) => {
      for (const part of [lvl.holders, lvl.team, lvl.leader]) {
        if (!part) continue;
        collectSummons(part.triggers ?? [], (s) => {
          if (!SUMMONS[s]) errors.push(`${t.id}[${i}] : invocation inconnue ${s}`);
        });
        const refs = new Set<string>();
        collectRefs(part, refs);
        for (const r of refs) if (!lvl.values || !(r in lvl.values)) errors.push(`${t.id}[${i}] : valeur « ${r} » non définie`);
      }
    });
  }

  // objets
  const compIds = COMPONENTS.map((c) => c.id);
  for (let i = 0; i < compIds.length; i++)
    for (let j = i; j < compIds.length; j++) if (!combine(compIds[i], compIds[j])) errors.push(`Aucune recette pour ${compIds[i]} + ${compIds[j]}`);
  const seenItems = new Set<string>();
  for (const it of ITEMS) {
    if (seenItems.has(it.id)) errors.push(`Objet en double : ${it.id}`);
    seenItems.add(it.id);
    if (it.recipe) for (const r of it.recipe) if (!compIds.includes(r)) errors.push(`${it.id} : composant inconnu ${r}`);
    if (it.passive) {
      const refs = new Set<string>();
      collectRefs(it.passive, refs);
      for (const r of refs) if (!it.passive.values || !(r in it.passive.values)) errors.push(`${it.id} : valeur « ${r} » non définie`);
    }
  }
  if (COMBINED.length < 25) errors.push('Moins de 25 objets combinés');

  for (const s of Object.values(SUMMONS)) {
    const refs = new Set<string>();
    collectRefs(s.passive ?? {}, refs);
    for (const r of refs) if (!s.values || !(r in s.values)) errors.push(`${s.id} : valeur « ${r} » non définie`);
  }
  for (const c of Object.values(CREATURES)) if (c.stats.hp <= 0) errors.push(`${c.id} : PV invalides`);

  return { errors, warnings };
}

function collectSummons(node: unknown, cb: (id: string) => void): void {
  if (Array.isArray(node)) {
    for (const n of node) collectSummons(n, cb);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if (o.do === 'summon' && typeof o.unit === 'string') cb(o.unit);
  for (const v of Object.values(o)) if (v && typeof v === 'object') collectSummons(v, cb);
}
