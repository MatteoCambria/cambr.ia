/** Registre des morceaux : association des cues de jeu aux morceaux (et variations). */
import type { SongDef } from '../engine';
import { mainTheme } from './mainTheme';
import { menu } from './menu';
import { prep, prep2 } from './prep';
import { combat, combat2 } from './combat';
import { decisive, victory, defeat } from './finale';
import { event } from './event';
import { ambience } from './ambience';

export type MusicCueId = 'mainTheme' | 'menu' | 'prep' | 'combat' | 'decisive' | 'victory' | 'defeat' | 'event' | 'ambience';

export interface CueDef {
  cue: MusicCueId;
  /** Variations (le gestionnaire audio alterne entre elles). */
  songs: SongDef[];
}

export const CUES: CueDef[] = [
  { cue: 'mainTheme', songs: [mainTheme] },
  { cue: 'menu', songs: [menu] },
  { cue: 'prep', songs: [prep, prep2] },
  { cue: 'combat', songs: [combat, combat2] },
  { cue: 'decisive', songs: [decisive] },
  { cue: 'victory', songs: [victory] },
  { cue: 'defeat', songs: [defeat] },
  { cue: 'event', songs: [event] },
  { cue: 'ambience', songs: [ambience] },
];

export const SONGS: SongDef[] = CUES.flatMap((c) => c.songs);

export function getSong(id: string): SongDef {
  const s = SONGS.find((x) => x.id === id);
  if (!s) throw new Error(`Morceau inconnu : ${id}`);
  return s;
}

export function cueOf(songId: string): MusicCueId {
  const c = CUES.find((x) => x.songs.some((s) => s.id === songId));
  if (!c) throw new Error(`Morceau sans cue : ${songId}`);
  return c.cue;
}
