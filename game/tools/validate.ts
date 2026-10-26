import { validateContent } from '../src/core/validate';
import { CHAMPIONS, TRAITS, ITEMS, COMBINED } from '../src/core/content';

const r = validateContent();
console.log(`Champions : ${CHAMPIONS.length} · Synergies : ${TRAITS.length} · Objets : ${ITEMS.length} (dont ${COMBINED.length} combinés)`);
for (const w of r.warnings) console.log('  avertissement :', w);
for (const e of r.errors) console.log('  ERREUR :', e);
console.log(r.errors.length ? `${r.errors.length} erreur(s)` : 'Contenu valide.');
process.exit(r.errors.length ? 1 : 0);
