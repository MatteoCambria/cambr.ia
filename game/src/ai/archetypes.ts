/**
 * Archétypes de compositions connus de l'IA. Ce ne sont pas des listes figées :
 * l'IA s'en sert comme intentions (synergies visées, carrys, objets) et complète
 * avec ce que la boutique lui propose.
 */
export interface Archetype {
  id: string;
  name: string;
  traits: string[]; // par priorité
  carries: string[];
  tanks: string[];
  /** Coûts dominants : les compositions « reroll » cherchent des 3★ bon marché. */
  reroll?: boolean;
}

export const ARCHETYPES: readonly Archetype[] = [
  { id: 'zenith_garde', name: 'Lumière du Zénith', traits: ['zenith', 'gardien', 'arcaniste'], carries: ['seraphine', 'heliodore', 'solenne'], tanks: ['aurel', 'valerian', 'ysolde'] },
  { id: 'selene_oracle', name: 'Marée lunaire', traits: ['selene', 'oracle', 'arcaniste'], carries: ['melisande', 'lunor', 'ophelune'], tanks: ['astree', 'oriel'] },
  { id: 'rouage_fonderie', name: 'Fonderie', traits: ['rouage', 'invocateur', 'tireur'], carries: ['isaure', 'chronaxe', 'octave'], tanks: ['auguste', 'bertrade', 'orrheon'] },
  { id: 'sylve_foret', name: 'Forêt-monde', traits: ['sylve', 'gardien', 'briseur'], carries: ['aldaia', 'ronceval', 'vorhn'], tanks: ['grumhald', 'brindille', 'rugor'] },
  { id: 'abysse_gouffre', name: 'Gouffre', traits: ['abysse', 'alchimiste', 'duelliste'], carries: ['nerea', 'calyx', 'abyssandre'], tanks: ['thalassor', 'hargo'] },
  { id: 'braise_brasier', name: 'Brasier', traits: ['braise', 'artilleur', 'briseur'], carries: ['cendrine', 'phenea', 'tison'], tanks: ['ignivar', 'gorm'] },
  { id: 'nomade_caravane', name: 'Caravane', traits: ['nomade', 'tireur', 'duelliste'], carries: ['amara', 'pim', 'sirocco'], tanks: ['barnabe', 'kesh'] },
  { id: 'astral_vide', name: 'Vide stellaire', traits: ['astral', 'arcaniste', 'gardien'], carries: ['neantis', 'pulsara', 'iota'], tanks: ['nebulos', 'celestin', 'orrheon'] },
  { id: 'ombres', name: 'Ombres portées', traits: ['assassin', 'selene', 'sylve'], carries: ['lunor', 'felis', 'ombral'], tanks: ['grumhald', 'astree'] },
  { id: 'arsenal', name: 'Arsenal', traits: ['tireur', 'artilleur', 'gardien'], carries: ['amara', 'pulsara', 'isaure'], tanks: ['aurel', 'thalassor', 'valerian'] },
  { id: 'duel', name: 'Fièvre du duel', traits: ['duelliste', 'briseur', 'braise'], carries: ['sirocco', 'abyssandre', 'vesna'], tanks: ['celestin', 'gorm', 'hargo'] },
  { id: 'arcanes', name: 'Haute arcane', traits: ['arcaniste', 'oracle', 'gardien'], carries: ['heliodore', 'aldaia', 'phenea'], tanks: ['astree', 'nebulos'] },
  { id: 'reroll_aube', name: 'Écuyers éternels (reroll)', traits: ['zenith', 'duelliste', 'gardien'], carries: ['cassian', 'seraphine'], tanks: ['aurel'], reroll: true },
  { id: 'reroll_foret', name: 'Ronces (reroll)', traits: ['sylve', 'tireur', 'gardien'], carries: ['ronceval', 'rugor'], tanks: ['brindille'], reroll: true },
  { id: 'reroll_abysse', name: 'Écume (reroll)', traits: ['abysse', 'duelliste', 'arcaniste'], carries: ['murene', 'coralie', 'hargo'], tanks: ['hargo'], reroll: true },
];

export function archetypeFor(traits: string[]): Archetype | undefined {
  return ARCHETYPES.find((a) => a.traits[0] === traits[0] && a.traits[1] === traits[1]);
}
