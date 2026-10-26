# Objets

8 composants et 36 objets combinés, générés depuis `src/items/data.ts` par `npm run docs`.

Deux composants posés sur le même champion fusionnent automatiquement. Un champion porte au plus 3 objets.

## Composants

| Composant | Statistiques |
|---|---|
| Lame d’éther | +12 % de PA |
| Arc d’if courbe | +12 % vitesse d’attaque |
| Baguette d’onyx | +12 Puissance |
| Larme d’azur | +15 mana de départ |
| Cotte de mailles | +20 armure |
| Cape de brume | +20 résistance magique |
| Ceinture du colosse | +150 PV |
| Gantelet d’affût | +15 % chances de critique |

## Table des recettes

| | Lame d’éther | Arc d’if courbe | Baguette d’onyx | Larme d’azur | Cotte de mailles | Cape de brume | Ceinture du colosse | Gantelet d’affût |
|---|---|---|---|---|---|---|---|---|
| **Lame d’éther** | Fendeur d’astres | Lame des marées | Faux du crépuscule | Épée runique | Rancune d’acier | Briselame | Fend-montagne | Croc d’abysse |
| **Arc d’if courbe** | Lame des marées | Arc du vent rapide | Bâton des courants | Carillon d’éther | Cuirasse du titan | Fléau des colosses | Arbalète de siège | Longue-vue d’affût |
| **Baguette d’onyx** | Faux du crépuscule | Bâton des courants | Grimoire d’Orrhéa | Calice de la marée | Couronne de braise | Masque de l’éclipse | Talisman de régénération | Gemme du savant |
| **Larme d’azur** | Épée runique | Carillon d’éther | Calice de la marée | Sablier d’azur | Sceau du recueillement | Couronne lunaire | Égide du cierge | Lunettes d’horloger |
| **Cotte de mailles** | Rancune d’acier | Cuirasse du titan | Couronne de braise | Sceau du recueillement | Bastion de laiton | Pierre-garde | Cuirasse de lave | Cotte d’épines |
| **Cape de brume** | Briselame | Fléau des colosses | Masque de l’éclipse | Couronne lunaire | Pierre-garde | Linceul des marées | Écaille de dragon | Pendule d’argent |
| **Ceinture du colosse** | Fend-montagne | Arbalète de siège | Talisman de régénération | Égide du cierge | Cuirasse de lave | Écaille de dragon | Cœur de géant | Trophée du chasseur |
| **Gantelet d’affût** | Croc d’abysse | Longue-vue d’affût | Gemme du savant | Lunettes d’horloger | Cotte d’épines | Pendule d’argent | Trophée du chasseur | Œil du chasseur |

## Objets combinés

| Objet | Recette | Statistiques | Effet |
|---|---|---|---|
| Fendeur d’astres | Lame d’éther + Lame d’éther | +24 % de PA, +12 % de dégâts infligés | Les dégâts infligés augmentent de 12 %. |
| Arc du vent rapide | Arc d’if courbe + Arc d’if courbe | +24 % vitesse d’attaque | Chaque attaque confère +5 % de vitesse d’attaque (cumulable 8 fois). |
| Grimoire d’Orrhéa | Baguette d’onyx + Baguette d’onyx | +54 Puissance | +30 Puissance supplémentaire. |
| Sablier d’azur | Larme d’azur + Larme d’azur | +30 mana de départ | Après avoir lancé sa compétence, récupère 20 mana. |
| Bastion de laiton | Cotte de mailles + Cotte de mailles | +40 armure | Réduit de 18 % les dégâts subis pendant les 8 premières secondes. |
| Linceul des marées | Cape de brume + Cape de brume | +40 résistance magique | Au début du combat, les alliés adjacents gagnent 25 résistance magique. |
| Cœur de géant | Ceinture du colosse + Ceinture du colosse | +300 PV | Régénère 1,5 % de ses PV max chaque seconde. |
| Œil du chasseur | Gantelet d’affût + Gantelet d’affût | +30 % chances de critique, +10 % dégâts critiques | Les coups critiques infligent Blessure (−33 % de soins reçus) pendant 3 s. |
| Lame des marées | Lame d’éther + Arc d’if courbe | +12 % de PA, +12 % vitesse d’attaque | Les attaques infligent Brèche : −20 % d’armure pendant 3 s. |
| Faux du crépuscule | Lame d’éther + Baguette d’onyx | +12 % de PA, +12 Puissance, 20 % d’omnivampirisme | 20 % d’omnivampirisme : se soigne d’une partie de tous les dégâts infligés. |
| Épée runique | Lame d’éther + Larme d’azur | +12 % de PA, +15 mana de départ, +5 mana par attaque | Chaque attaque rend 5 mana supplémentaires. |
| Rancune d’acier | Lame d’éther + Cotte de mailles | +12 % de PA, +20 armure | Chaque fois qu’il subit des dégâts : +2 % de PA et +2 armure (20 fois max). |
| Briselame | Lame d’éther + Cape de brume | +12 % de PA, +20 résistance magique, 15 % d’omnivampirisme | 15 % d’omnivampirisme. Sous 40 % de PV, reçoit un bouclier de 25 % de ses PV max pendant 5 s (1 fois). |
| Fend-montagne | Lame d’éther + Ceinture du colosse | +12 % de PA, +150 PV | Sous 60 % de PV : +30 % de PA et un bouclier de 25 % de ses PV max pendant 4 s (1 fois). |
| Croc d’abysse | Lame d’éther + Gantelet d’affût | +12 % de PA, +15 % chances de critique, Compétences critiques, +20 % dégâts critiques | Les compétences peuvent être critiques. +20 % de dégâts critiques. |
| Bâton des courants | Arc d’if courbe + Baguette d’onyx | +12 % vitesse d’attaque, +12 Puissance | Après avoir lancé sa compétence, gagne 40 % de vitesse d’attaque pendant 5 s. |
| Carillon d’éther | Arc d’if courbe + Larme d’azur | +12 % vitesse d’attaque, +15 mana de départ | Toutes les 3 attaques, un arc électrique frappe la cible et rebondit sur 3 ennemis (70 dégâts magiques). |
| Cuirasse du titan | Arc d’if courbe + Cotte de mailles | +12 % vitesse d’attaque, +20 armure | En attaquant ou en subissant des dégâts : +2 % de PA et +2 Puissance (25 fois max). |
| Fléau des colosses | Arc d’if courbe + Cape de brume | +12 % vitesse d’attaque, +20 résistance magique | Les attaques infligent en plus 4 % des PV actuels de la cible en dégâts magiques. |
| Arbalète de siège | Arc d’if courbe + Ceinture du colosse | +12 % vitesse d’attaque, +150 PV | Les attaques touchent aussi les ennemis adjacents à la cible (35 % des dégâts). |
| Longue-vue d’affût | Arc d’if courbe + Gantelet d’affût | +12 % vitesse d’attaque, +15 % chances de critique, +1 portée, +8 % de dégâts infligés | +1 portée d’attaque et +8 % de dégâts. |
| Calice de la marée | Baguette d’onyx + Larme d’azur | +12 Puissance, +15 mana de départ | Toutes les 5 s, gagne 15 Puissance (cumulable). |
| Couronne de braise | Baguette d’onyx + Cotte de mailles | +12 Puissance, +20 armure | Les dégâts des compétences brûlent la cible (1 % de ses PV max par seconde pendant 4 s) et infligent Blessure (−33 %). |
| Masque de l’éclipse | Baguette d’onyx + Cape de brume | +12 Puissance, +20 résistance magique | Les ennemis à 2 hexagones ou moins perdent 25 % de résistance magique. |
| Talisman de régénération | Baguette d’onyx + Ceinture du colosse | +12 Puissance, +150 PV | Après chaque compétence, rend 12 % de ses PV max. |
| Gemme du savant | Baguette d’onyx + Gantelet d’affût | +12 Puissance, +15 % chances de critique, Compétences critiques, +15 % dégâts critiques | Les compétences peuvent être critiques. +15 % de dégâts critiques. |
| Sceau du recueillement | Larme d’azur + Cotte de mailles | +15 mana de départ, +20 armure | Sous 50 % de PV : bouclier de 25 % de ses PV max et +30 armure et RM pendant 5 s (1 fois). |
| Couronne lunaire | Larme d’azur + Cape de brume | +15 mana de départ, +20 résistance magique, +2,5 mana par seconde | Régénère 2,5 mana par seconde. |
| Égide du cierge | Larme d’azur + Ceinture du colosse | +15 mana de départ, +150 PV | Toutes les 5 s, soigne les alliés adjacents de 12 % de leurs PV manquants. |
| Lunettes d’horloger | Larme d’azur + Gantelet d’affût | +15 mana de départ, +15 % chances de critique, +10 % de dégâts infligés, 10 % d’omnivampirisme | +10 % de dégâts et 10 % d’omnivampirisme. |
| Pierre-garde | Cotte de mailles + Cape de brume | +20 armure, +20 résistance magique | Chaque fois qu’il subit des dégâts : +3 armure et RM (15 fois max). |
| Cuirasse de lave | Cotte de mailles + Ceinture du colosse | +20 armure, +150 PV | Toutes les 2 s, brûle les ennemis adjacents (1 % de leurs PV max par seconde pendant 3 s, Blessure −33 %). |
| Cotte d’épines | Cotte de mailles + Gantelet d’affût | +20 armure, +15 % chances de critique | Renvoie 20 % des dégâts subis à l’attaquant sous forme de dégâts magiques. |
| Écaille de dragon | Cape de brume + Ceinture du colosse | +20 résistance magique, +150 PV, −10 % de dégâts subis | Réduit de 10 % tous les dégâts subis. |
| Pendule d’argent | Cape de brume + Gantelet d’affût | +20 résistance magique, +15 % chances de critique | Immunisé aux contrôles pendant les 14 premières secondes du combat. |
| Trophée du chasseur | Ceinture du colosse + Gantelet d’affût | +150 PV, +15 % chances de critique | Après chaque élimination : rend 25 % de ses PV max et gagne 15 % de vitesse d’attaque (cumulable). |

## Consommables

| Objet | Effet |
|---|---|
| Clé de démontage | Utilisée sur un champion, retire tous ses objets et les replace dans la réserve d’objets. |

## Invocations

| Invocation | PV | PA | Portée | Description |
|---|---|---|---|---|
| Tourelle de poche | 380 | 34 | 3 | Tourelle immobile qui tire sur l’ennemi le plus proche. |
| Golem d’engrenages | 1150 | 60 | 1 | Automate massif qui provoque les ennemis adjacents toutes les 4 s. |
| Revenant de cendres | 620 | 55 | 1 | Guerrier de cendres dont les attaques brûlent. |
| Mirage | 320 | 10 | 1 | Leurre fragile qui provoque les ennemis adjacents. |
| Cavalier spectral | 720 | 68 | 1 | Cavalier fantôme rapide qui fonce sur l’ennemi le plus proche. |
| Éclat du vide | 380 | 42 | 2 | Fragment d’étoile morte qui tire à courte distance. |
| Automate | 650 | 48 | 1 | Automate de laiton assemblé par la Fonderie. |
| Sentinelle | 1100 | 65 | 1 | Sentinelle blindée qui provoque les ennemis adjacents toutes les 4 s. |
| Colosse de la Fonderie | 2600 | 95 | 1 | Colosse qui provoque les ennemis proches et frappe le sol toutes les 3 s. |

## Créatures des rencontres neutres

| Créature | PV | PA | Armure / RM | Portée |
|---|---|---|---|---|
| Luciole d’éther | 260 | 22 | 5 / 5 | 1 |
| Golem de quartz | 650 | 35 | 25 / 10 | 1 |
| Chimère des brumes | 780 | 48 | 25 / 25 | 1 |
| Gardien de cristal | 1100 | 58 | 45 / 45 | 1 |
| Éclat de cristal | 650 | 55 | 15 / 15 | 3 |
| Loup d’ombre-étoile | 1250 | 85 | 35 / 30 | 1 |
| Hydre des marées noires | 3400 | 120 | 60 / 60 | 2 |
| Drake d’Orrhéa | 5200 | 160 | 70 / 70 | 2 |
| Spectre du Cœur-Horloge | 8000 | 210 | 80 / 80 | 2 |

Rencontres : Essaim de lucioles, Golems de quartz, Chimères des brumes, Gardiens de cristal, Meute d’ombre-étoile, Hydre des marées noires, Drake d’Orrhéa, Spectre du Cœur-Horloge.

