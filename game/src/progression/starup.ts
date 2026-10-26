/**
 * Amélioration des rangs : 3 exemplaires identiques fusionnent en un exemplaire de rang supérieur,
 * qu'ils soient sur le plateau ou dans la réserve. Les objets sont conservés.
 */
import { COPIES_TO_UPGRADE, MAX_ITEMS_PER_UNIT, MAX_STAR } from '../config/balance';
import type { BoardSlot, OwnedUnit, PlayerState } from '../game/types';

export interface MergeEvent {
  defId: string;
  star: 2 | 3;
  uid: string;
}

type Loc = { kind: 'board'; slot: BoardSlot } | { kind: 'bench'; index: number; unit: OwnedUnit };

function locations(p: PlayerState, defId: string, star: number): Loc[] {
  const out: Loc[] = [];
  for (const s of p.board) if (s.defId === defId && s.star === star) out.push({ kind: 'board', slot: s });
  p.bench.forEach((u, i) => {
    if (u && u.defId === defId && u.star === star) out.push({ kind: 'bench', index: i, unit: u });
  });
  return out;
}

export function mergeUnits(p: PlayerState): MergeEvent[] {
  const events: MergeEvent[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let star = 1; star < MAX_STAR; star++) {
      const ids = new Set<string>();
      for (const s of p.board) if (s.star === star) ids.add(s.defId);
      for (const u of p.bench) if (u && u.star === star) ids.add(u.defId);
      for (const id of [...ids].sort()) {
        const locs = locations(p, id, star);
        if (locs.length < COPIES_TO_UPGRADE) continue;
        const chosen = locs.slice(0, COPIES_TO_UPGRADE); // plateau d'abord, puis réserve de gauche à droite
        const keeper = chosen[0];
        const keepUnit = keeper.kind === 'board' ? keeper.slot : keeper.unit;
        const allItems: string[] = [];
        for (const l of chosen) allItems.push(...(l.kind === 'board' ? l.slot.items : l.unit.items));
        for (const l of chosen.slice(1)) {
          if (l.kind === 'board') p.board.splice(p.board.indexOf(l.slot), 1);
          else p.bench[l.index] = null;
        }
        keepUnit.star = (star + 1) as 2 | 3;
        keepUnit.items = allItems.slice(0, MAX_ITEMS_PER_UNIT);
        p.items.push(...allItems.slice(MAX_ITEMS_PER_UNIT));
        events.push({ defId: id, star: keepUnit.star as 2 | 3, uid: keepUnit.uid });
        if (keepUnit.star === 2) p.stats.starUps2++;
        else p.stats.starUps3++;
        changed = true;
      }
    }
  }
  return events;
}

/** Un achat de ce champion déclencherait-il une fusion (utile si la réserve est pleine) ? */
export function purchaseWouldMerge(p: PlayerState, defId: string): boolean {
  return locations(p, defId, 1).length >= COPIES_TO_UPGRADE - 1;
}
