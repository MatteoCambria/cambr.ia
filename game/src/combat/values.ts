import type { V, ValueMap } from './dsl';

/** Résout une valeur déclarative pour un rang d'étoile donné. */
export function val(v: V | undefined, star: number, values?: ValueMap): number {
  if (v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const neg = v.startsWith('-');
    const key = neg ? v.slice(1) : v;
    const ref = values?.[key];
    if (ref === undefined) throw new Error(`Valeur nommée inconnue : « ${key} »`);
    const n = typeof ref === 'number' ? ref : ref[Math.min(2, Math.max(0, star - 1))];
    return neg ? -n : n;
  }
  return v[Math.min(2, Math.max(0, star - 1))];
}

/** Texte d'une valeur pour toutes les étoiles : « 180/270/400 ». */
export function valText(v: V | undefined, values?: ValueMap, star?: number): string {
  if (v === undefined) return '0';
  if (typeof v === 'number') return fmt(v);
  if (typeof v === 'string') {
    const ref = values?.[v.startsWith('-') ? v.slice(1) : v];
    if (ref === undefined) return `?${v}?`;
    if (typeof ref === 'number') return fmt(ref);
    if (star) return fmt(ref[star - 1]);
    return ref.map(fmt).join('/');
  }
  if (star) return fmt(v[star - 1]);
  return v.map(fmt).join('/');
}

export function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const r = Math.round(n * 100) / 100;
  return String(r).replace('.', ',');
}
