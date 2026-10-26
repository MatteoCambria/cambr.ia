/**
 * Événements visuels émis par la simulation. Le rendu et l'audio les consomment ;
 * ils n'ont aucune influence sur le résultat (la simulation peut tourner sans eux).
 */
import type { Vec2 } from '../board/hex';
import type { DmgType, StatusKind } from './dsl';

export type CombatEvent =
  | { t: number; e: 'start' }
  | { t: number; e: 'attack'; src: number; tgt: number; ranged: boolean }
  | { t: number; e: 'hit'; src: number | null; tgt: number; amount: number; absorbed: number; dmgType: DmgType; crit: boolean; kind: 'attack' | 'ability' | 'dot' | 'other' }
  | { t: number; e: 'heal'; src: number | null; tgt: number; amount: number }
  | { t: number; e: 'shield'; src: number | null; tgt: number; amount: number }
  | { t: number; e: 'shieldBreak'; tgt: number }
  | { t: number; e: 'cast'; src: number; tgt: number | null; name: string; vfx?: string; dur: number }
  | { t: number; e: 'castFx'; src: number; tgt: number | null; vfx?: string }
  | { t: number; e: 'proj'; id: number; vfx: string; src: number }
  | { t: number; e: 'vfx'; vfx: string; at: Vec2; to?: Vec2; radius?: number; src?: number; tgt?: number; dur?: number }
  | { t: number; e: 'status'; tgt: number; kind: StatusKind; tag?: string; dur: number }
  | { t: number; e: 'immune'; tgt: number }
  | { t: number; e: 'death'; tgt: number; src: number | null }
  | { t: number; e: 'revive'; tgt: number }
  | { t: number; e: 'summon'; tgt: number; src: number }
  | { t: number; e: 'dash'; tgt: number; kind: 'dash' | 'leap' | 'blink' | 'knock' }
  | { t: number; e: 'text'; tgt: number; text: string; color?: string }
  | { t: number; e: 'gold'; side: 0 | 1; amount: number; tgt: number }
  | { t: number; e: 'mana'; tgt: number; amount: number }
  | { t: number; e: 'overtime' }
  | { t: number; e: 'end'; winner: 0 | 1 | -1 };
