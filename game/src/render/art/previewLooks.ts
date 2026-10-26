/**
 * Jeu de combinaisons de démonstration (planche de prévisualisation uniquement).
 * Couvre toutes les valeurs de BodyShape, HeadShape, WeaponShape et Extra.
 */
import type { Look } from '../../core/defs';

export interface DemoLook {
  name: string;
  look: Look;
}

const F = {
  zenith: { primary: '#e7c26b', secondary: '#f3ead6', accent: '#ffb347', skin: '#f3d2b0' },
  selene: { primary: '#a9badf', secondary: '#6a5aa8', accent: '#b9d8ff', skin: '#efe2f4' },
  rouage: { primary: '#b8743a', secondary: '#6b4a2a', accent: '#ffcf5a', skin: '#e8b98f' },
  sylve: { primary: '#5f8f3e', secondary: '#7a5634', accent: '#b6e86a', skin: '#dcb68c' },
  abysse: { primary: '#1f6f78', secondary: '#1d2c4a', accent: '#5ff2e0', skin: '#9fd4d0' },
  braise: { primary: '#3e2c30', secondary: '#8a3a1e', accent: '#ff8a2a', skin: '#c9a08a' },
  nomade: { primary: '#d9b77e', secondary: '#2fa59a', accent: '#ff6f5a', skin: '#c98f62' },
  astral: { primary: '#43307a', secondary: '#17122e', accent: '#d8c8ff', skin: '#bcb0ea' },
} as const;

type FK = keyof typeof F;

function L(name: string, f: FK, body: Look['body'], head: Look['head'], weapon: Look['weapon'], extras: Look['extras'] = [], over: Partial<Look> = {}): DemoLook {
  return { name, look: { body, head, weapon, ...F[f], extras, ...over } };
}

export const DEMO_LOOKS: DemoLook[] = [
  L('Paladin solaire', 'zenith', 'knight', 'helm', 'sword', ['cape']),
  L('Gardien du Zénith', 'zenith', 'heavy', 'helm', 'shield', ['pauldrons', 'sun'], { primary: '#d9b25c' }),
  L('Prêtresse d’aube', 'zenith', 'robe', 'halo', 'staff', ['sun', 'aura'], { primary: '#f1e6cc', secondary: '#e7c26b' }),
  L('Archère solaire', 'zenith', 'slim', 'ponytail', 'bow', ['scarf'], { secondary: '#c9893a' }),
  L('Roi-Soleil', 'zenith', 'giant', 'crown', 'greatsword', ['cape', 'pauldrons']),
  L('Phénix d’or', 'zenith', 'bird', 'crown', 'none', ['wings', 'sun'], { primary: '#f0c35a', secondary: '#fff1c8' }),
  L('Lancier d’aurore', 'zenith', 'knight', 'visor', 'lance', ['pauldrons']),
  L('Écuyer', 'zenith', 'small', 'bare', 'banner', [], { secondary: '#b5762f' }),
  L('Mystique lunaire', 'selene', 'robe', 'hood', 'orb', ['moon', 'stars']),
  L('Lame sélénite', 'selene', 'slim', 'mask', 'daggers', ['cape']),
  L('Oracle voilée', 'selene', 'floating', 'veil', 'tome', ['moon']),
  L('Faucheuse pâle', 'selene', 'knight', 'horns', 'scythe', ['chains']),
  L('Loup de lune', 'selene', 'quadruped', 'beast', 'none', ['moon'], { primary: '#9aa6c8', secondary: '#e6ecff' }),
  L('Naga argentée', 'selene', 'serpent', 'crown', 'chakram', [], { secondary: '#7f8fc4' }),
  L('Petite sorcière', 'selene', 'small', 'hat', 'fan', ['stars'], { primary: '#6a5aa8', secondary: '#a9badf' }),
  L('Chouette sélénite', 'selene', 'bird', 'halo', 'orb', ['wings']),
  L('Automate canonnier', 'rouage', 'construct', 'visor', 'cannon', ['gears']),
  L('Gnome mécano', 'rouage', 'small', 'goggles', 'wrench', ['backpack', 'gears']),
  L('Forgeron d’airain', 'rouage', 'heavy', 'goggles', 'hammer', ['pauldrons']),
  L('Foreuse vivante', 'rouage', 'construct', 'orb', 'drill', ['gears', 'crystals'], { accent: '#5fe0d0' }),
  L('Fusilier', 'rouage', 'slim', 'tricorn', 'gun', ['scarf']),
  L('Bête-canon', 'rouage', 'quadruped', 'helm', 'cannon', ['gears']),
  L('Alchimiste', 'rouage', 'robe', 'goggles', 'flask', ['backpack'], { accent: '#7dff8a' }),
  L('Titan de laiton', 'rouage', 'giant', 'visor', 'hammer', ['gears', 'pauldrons']),
  L('Garou des bois', 'sylve', 'beast', 'beast', 'claws', ['tail', 'leaves'], { primary: '#7a5a3c', secondary: '#c9b08a' }),
  L('Druide', 'sylve', 'robe', 'antlers', 'staff', ['leaves']),
  L('Cerf ancien', 'sylve', 'quadruped', 'antlers', 'none', ['leaves'], { primary: '#9a6e45', secondary: '#e8d4b0' }),
  L('Colosse sylvain', 'sylve', 'giant', 'antlers', 'hammer', ['leaves'], { skin: '#8c7a5a' }),
  L('Rôdeuse', 'sylve', 'slim', 'ponytail', 'bow', ['cape', 'leaves']),
  L('Lucioline', 'sylve', 'small', 'bare', 'lantern', ['leaves'], { accent: '#e8ff7a' }),
  L('Faucon des cimes', 'sylve', 'bird', 'bare', 'claws', ['tail'], { primary: '#8a6a44', secondary: '#efe2c8', accent: '#ffcf5a' }),
  L('Sanglier', 'sylve', 'quadruped', 'horns', 'claws', ['tail'], { primary: '#6b4a32', secondary: '#a88a6a' }),
  L('Naga des abysses', 'abysse', 'serpent', 'fins', 'harpoon', ['bubbles']),
  L('Prêtre abyssal', 'abysse', 'robe', 'tentacles', 'censer', ['bubbles']),
  L('Feu follet', 'abysse', 'floating', 'hood', 'lantern', ['bubbles', 'aura']),
  L('Dompteuse', 'abysse', 'slim', 'fins', 'whip', ['bubbles']),
  L('Pilleur des fonds', 'abysse', 'heavy', 'helm', 'harpoon', ['chains']),
  L('Squale-loup', 'abysse', 'quadruped', 'fins', 'none', ['bubbles']),
  L('Titan kraken', 'abysse', 'giant', 'tentacles', 'none', ['chains']),
  L('Héron masqué', 'abysse', 'bird', 'mask', 'orb', ['bubbles'], { primary: '#2b8a8e', secondary: '#bfeee6' }),
  L('Chevalier revenant', 'braise', 'knight', 'skull', 'greatsword', ['embers']),
  L('Feu errant', 'braise', 'floating', 'flame', 'orb', ['embers']),
  L('Faucheur de braise', 'braise', 'robe', 'skull', 'scythe', ['embers', 'chains']),
  L('Démon cornu', 'braise', 'beast', 'horns', 'claws', ['embers', 'tail'], { primary: '#8a3a1e', secondary: '#3e2c30', skin: '#b5523a' }),
  L('Chien de feu', 'braise', 'quadruped', 'flame', 'none', ['embers'], { primary: '#4a3034' }),
  L('Fournaise', 'braise', 'construct', 'flame', 'cannon', ['embers']),
  L('Diablotin', 'braise', 'small', 'mask', 'flask', ['embers'], { primary: '#8a3a1e' }),
  L('Phénix cendré', 'braise', 'bird', 'flame', 'none', ['wings', 'embers'], { primary: '#c2502a', secondary: '#ffb36a' }),
  L('Lame du désert', 'nomade', 'slim', 'veil', 'daggers', ['scarf']),
  L('Danseuse des vents', 'nomade', 'robe', 'veil', 'fan', ['scarf'], { primary: '#2fa59a', secondary: '#d9b77e' }),
  L('Marchand armé', 'nomade', 'heavy', 'tricorn', 'crossbow', ['backpack', 'scarf']),
  L('Gamin des caravanes', 'nomade', 'small', 'hat', 'chakram', ['scarf']),
  L('Bête de bât', 'nomade', 'quadruped', 'bare', 'banner', ['backpack', 'cape'], { primary: '#c9a46a', secondary: '#2fa59a' }),
  L('Cavalier des dunes', 'nomade', 'knight', 'tricorn', 'lance', ['scarf', 'cape']),
  L('Charmeuse', 'nomade', 'serpent', 'veil', 'whip', ['scarf']),
  L('Albatros messager', 'nomade', 'bird', 'tricorn', 'crossbow', ['scarf'], { primary: '#e8dcc0', secondary: '#2fa59a' }),
  L('Entité du vide', 'astral', 'floating', 'orb', 'none', ['stars', 'aura']),
  L('Archiviste du vide', 'astral', 'robe', 'hood', 'tome', ['stars']),
  L('Colosse astral', 'astral', 'giant', 'halo', 'staff', ['stars', 'crystals']),
  L('Chasseur stellaire', 'astral', 'slim', 'visor', 'gun', ['stars']),
  L('Serpent cosmique', 'astral', 'serpent', 'halo', 'orb', ['stars', 'moon']),
  L('Bête du vide', 'astral', 'quadruped', 'orb', 'none', ['stars', 'crystals']),
  L('Séraphin', 'astral', 'knight', 'helm', 'chakram', ['wings', 'stars'], { primary: '#cfc6ff', secondary: '#43307a' }),
  L('Sentinelle', 'astral', 'construct', 'orb', 'staff', ['crystals', 'aura']),
  L('Thuriféraire', 'zenith', 'small', 'crown', 'censer', ['sun']),
  L('Bouclier-bête', 'abysse', 'quadruped', 'veil', 'shield', ['pauldrons']),
];
