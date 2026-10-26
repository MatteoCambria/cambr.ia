/**
 * Mise en forme des descriptions : les valeurs {clé} sont remplacées par les nombres
 * réellement utilisés par le moteur, par rang d'étoile, avec mise à l'échelle par la
 * Puissance (PA) lorsque l'effet en dépend.
 */
import type { ReactNode } from 'react';
import type { AbilityDef, ValueMap } from '../combat/dsl';
import { fmt } from '../combat/values';

/** Clés de valeurs multipliées par la Puissance (champ `base` sans noAp). */
export function apScaledKeys(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const n of node) apScaledKeys(n, out);
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const o = node as Record<string, unknown>;
  if (typeof o.base === 'string' && !o.noAp) out.add(o.base);
  for (const [k, v] of Object.entries(o)) if (k !== 'values' && v && typeof v === 'object') apScaledKeys(v, out);
  return out;
}

export interface DescOpts {
  values?: ValueMap;
  star?: number; // rang courant (mis en avant)
  ap?: number; // Puissance actuelle (100 = base)
  apKeys?: Set<string>;
}

export function Desc({ text, opts }: { text: string; opts: DescOpts }): JSX.Element {
  const parts: ReactNode[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<ValueSpan key={i++} k={m[1]} opts={opts} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className="desc">{parts}</span>;
}

function ValueSpan({ k, opts }: { k: string; opts: DescOpts }): JSX.Element {
  const v = opts.values?.[k];
  const scaled = opts.apKeys?.has(k) ?? false;
  if (v === undefined) return <span className="val missing">?</span>;
  const scale = (n: number) => (scaled && opts.ap ? (n * opts.ap) / 100 : n);
  if (typeof v === 'number') return <span className={'val' + (scaled ? ' ap' : '')}>{fmt(Math.round(scale(v) * 100) / 100)}</span>;
  return (
    <span className={'val' + (scaled ? ' ap' : '')} title={scaled ? 'Valeur multipliée par la Puissance' : undefined}>
      {v.map((n, idx) => (
        <span key={idx} className={opts.star === idx + 1 ? 'cur' : opts.star ? 'dim' : ''}>
          {idx > 0 ? '/' : ''}
          {fmt(Math.round(scale(n)))}
        </span>
      ))}
    </span>
  );
}

export function abilityDescOpts(ab: AbilityDef, star?: number, ap?: number): DescOpts {
  return { values: ab.values, star, ap, apKeys: apScaledKeys(ab.actions) };
}

export const COST_COLORS: Record<number, string> = { 1: '#9aa3b5', 2: '#5fbf74', 3: '#4f8fe8', 4: '#b06cf0', 5: '#f0c040' };

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}
