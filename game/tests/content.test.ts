import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/core/validate';
import { CHAMPIONS, COMBINED, TRAITS } from '../src/core/content';

describe('contenu déclaratif', () => {
  it('est valide (descriptions, valeurs, références, recettes)', () => {
    const r = validateContent();
    expect(r.errors).toEqual([]);
  });
  it('respecte les quantités minimales', () => {
    expect(CHAMPIONS.length).toBeGreaterThanOrEqual(60);
    expect(TRAITS.length).toBeGreaterThanOrEqual(12);
    expect(COMBINED.length).toBeGreaterThanOrEqual(25);
  });
  it('propose des champions de 1 à 5 or', () => {
    for (const cost of [1, 2, 3, 4, 5]) expect(CHAMPIONS.some((c) => c.cost === cost)).toBe(true);
  });
  it('a des compétences mécaniquement différentes (pas de doublon de structure)', () => {
    const shapes = new Set(CHAMPIONS.map((c) => JSON.stringify(c.ability.actions)));
    expect(shapes.size).toBe(CHAMPIONS.length);
  });
});
