# Synergies

18 synergies (8 origines, 10 classes), générées depuis `src/traits/data.ts` par `npm run docs`.

Une synergie est comptée une fois par champion **différent** présent sur le plateau (les exemplaires en double ne comptent pas).

| Synergie | Type | Paliers | Champions |
|---|---|---|---|
| [Zénith](#zenith) | Origine | 2 / 4 / 6 | 8 |
| [Sélène](#selene) | Origine | 2 / 4 / 6 | 7 |
| [Rouage](#rouage) | Origine | 2 / 4 / 6 | 9 |
| [Sylve](#sylve) | Origine | 2 / 4 / 6 | 8 |
| [Abysse](#abysse) | Origine | 2 / 4 / 6 | 7 |
| [Braise](#braise) | Origine | 2 / 4 / 6 | 7 |
| [Nomade](#nomade) | Origine | 2 / 4 / 6 | 7 |
| [Astral](#astral) | Origine | 2 / 4 / 6 | 8 |
| [Gardien](#gardien) | Classe | 2 / 4 / 6 | 8 |
| [Briseur](#briseur) | Classe | 2 / 4 / 6 | 8 |
| [Duelliste](#duelliste) | Classe | 2 / 4 / 6 | 7 |
| [Assassin](#assassin) | Classe | 2 / 4 | 5 |
| [Tireur](#tireur) | Classe | 2 / 4 / 6 | 6 |
| [Arcaniste](#arcaniste) | Classe | 2 / 4 / 6 | 7 |
| [Invocateur](#invocateur) | Classe | 2 / 4 | 5 |
| [Oracle](#oracle) | Classe | 2 / 4 | 7 |
| [Alchimiste](#alchimiste) | Classe | 2 / 4 | 5 |
| [Artilleur](#artilleur) | Classe | 2 / 4 | 4 |

## Origines

### Zénith

Au début du combat, les champions du Zénith reçoivent un bouclier proportionnel à leurs PV max.

- **(2)** Bouclier de 25 % des PV max pendant 8 s.
- **(4)** Bouclier de 40 % des PV max. Quand un bouclier d’un champion du Zénith se brise, il libère un éclat de 160 dégâts magiques autour de lui.
- **(6)** Bouclier de 55 % des PV max et éclat de 280 dégâts. Tous les autres alliés reçoivent un bouclier de 20 % de leurs PV max.

Champions : Aurel (1), Liora (1), Cassian (2), Séraphine (2), Dame Ysolde (3), Héliodore (3), Valérian (4), Solenne (5)

Comment la contrer : Les dégâts bruts et les exécutions contournent les boucliers ; attendre leur expiration (8 s) avant de s’engager.

> Les chevaliers de la Sphère solaire jurent de tenir la ligne tant que l'aube n'est pas levée.

### Sélène

Les champions de Sélène se soignent en infligeant des dégâts ; la marée lunaire soigne régulièrement l’allié le plus blessé.

- **(2)** 10 % d’omnivampirisme pour les champions de Sélène. Toutes les 3 s, l’allié le plus blessé récupère 70 PV.
- **(4)** 18 % d’omnivampirisme. Toutes les 3 s, l’allié le plus blessé récupère 140 PV.
- **(6)** 30 % d’omnivampirisme. Toutes les 2 s, les deux alliés les plus blessés récupèrent 180 PV.

Champions : Mirelle (1), Ilvane (2), Oriel (2), Astrée (3), Lunor (4), Mélisande (4), Ophélune (5)

Comment la contrer : Les Blessures (réduction des soins) et les dégâts concentrés en rafale empêchent la marée de compenser.

> Sur la Sphère lunaire, chaque blessure est un reflet que la marée finit par effacer.

### Rouage

Au début du combat, le champion Rouage le plus en retrait assemble un automate à ses côtés. Les Rouages gagnent de la vitesse d’attaque.

- **(2)** Automate (650 PV). Les Rouages gagnent 10 % de vitesse d’attaque.
- **(4)** Sentinelle (≈1 100 PV) qui provoque les ennemis adjacents toutes les 4 s. Les Rouages gagnent 15 % de vitesse d’attaque.
- **(6)** Colosse (≈2 600 PV) qui provoque et frappe le sol toutes les 3 s. Les Rouages gagnent 30 % de vitesse d’attaque.

Champions : Bertrade (1), Tic (1), Clémence (2), Gaspard Vis-de-Fer (2), Auguste (3), Isaure (3), Octave (4), Chronaxe (5), Maître Orrhéon (5)

Comment la contrer : Les dégâts de zone détruisent l’automate et les Rouages fragiles d’un même geste ; viser le Rouage le plus en retrait.

> La Fonderie n’a jamais cessé de produire, même lorsque le Cœur-Horloge s’est figé.

### Sylve

Toutes les 3 secondes, les champions de la Sylve grandissent : ils gagnent des PV max (et se soignent d’autant).

- **(2)** +5,5 % PV max toutes les 3 s (8 fois max).
- **(4)** +7 % PV max toutes les 3 s (8 fois max).
- **(6)** +10 % PV max, +5 % PA et +5 Puissance toutes les 3 s (8 fois max).

Champions : Brindille (1), Rugor (1), Ronceval (2), Yselle (2), Félis (3), Grumhald (3), Aldaïa (4), Vorhn (5)

Comment la contrer : Une composition qui gagne vite (assassins, rafales) prive la Sylve du temps de croissance ; les dégâts en % des PV restent efficaces.

> La forêt-monde pousse sur la Sphère verte depuis avant le premier tic-tac.

### Abysse

Les dégâts infligés par les champions de l’Abysse noient (exécutent) les ennemis sous un seuil de PV.

- **(2)** Exécute les ennemis sous 12 % de PV.
- **(4)** Exécute les ennemis sous 20 % de PV.
- **(6)** Exécute sous 25 % de PV, et tous les alliés exécutent sous 12 %.

Champions : Coralie (1), Murène (1), Hargo (2), Calyx (3), Néréa (4), Thalassor (4), Abyssandre (5)

Comment la contrer : Les boucliers et les gros soins éloignent les unités du seuil ; les Gardiens et Briseurs résistent mieux.

> Ceux qui sombrent dans la Sphère des marées noires n’en remontent jamais.

### Braise

Les attaques des champions de Braise brûlent la cible (dégâts en % des PV max, Blessure). Chaque allié tombé attise leur colère.

- **(2)** Brûlure : 1 % des PV max par seconde pendant 3 s (Blessure −33 %). +5 % de dégâts à chaque allié tombé.
- **(4)** Brûlure : 1,2 % des PV max par seconde. +10 % de dégâts à chaque allié tombé.
- **(6)** Brûlure : 2,5 % des PV max par seconde. +15 % de dégâts à chaque allié tombé.

Champions : Tison (1), Gorm (2), Vesna (2), Cendrine (3), Ignivar (4), Morvain (4), Phénéa (5)

Comment la contrer : Les compositions à forte armure de PV peinent face aux brûlures ; privilégier la protection magique et tuer les Braises avant que les alliés ne tombent.

> Les Cendrés ont brûlé une première fois. Ils ne craignent plus le feu, seulement l’oubli.

### Nomade

Synergie économique : or supplémentaire après chaque combat contre un Archonte, et des composants d’objets au fil des victoires. Les Nomades démarrent le combat portés par le vent.

- **(2)** +1 or après chaque combat contre un Archonte. Les Nomades gagnent 15 % de vitesse d’attaque et 25 % de vitesse de déplacement pendant 6 s.
- **(4)** +2 or après chaque combat contre un Archonte et un composant toutes les 3 victoires. 22 % de vitesse d’attaque pendant 6 s.
- **(6)** +3 or après chaque combat contre un Archonte et un composant toutes les 2 victoires. 32 % de vitesse d’attaque pendant 6 s.

Champions : Pim (1), Kesh (2), Taliya (2), Barnabé (3), Sirocco (3), Amara (4), Myrrhine (5)

Comment la contrer : Les Nomades sont faibles au combat : les punir tôt (forte pression en début de partie) les empêche de capitaliser.

> Les caravanes célestes relient toutes les Sphères. Tout s’y vend, même le vent.

### Astral

Les entités astrales refusent la mort : la première fois qu’elles devraient tomber, elles renaissent sous forme d’étoile.

- **(2)** Le premier champion Astral qui devrait mourir renaît avec 30 % de ses PV (1 fois par combat).
- **(4)** Chaque champion Astral renaît une fois avec 30 % de ses PV.
- **(6)** Chaque champion Astral renaît une fois avec 45 % de ses PV et gagne 30 Puissance.

Champions : Iota (1), Nébulos (1), Ombral (3), Vélane (3), Célestin (4), Pulsara (4), Maître Orrhéon (5), Néantis (5)

Comment la contrer : Les exécutions et les dégâts répartis (plusieurs cibles) obligent chaque Astral à mourir deux fois ; concentrer sur un seul est inefficace.

> Venus d’au-delà du cadran, les Astraux ne connaissent ni l’heure ni la fin.


## Classes

### Gardien

Les Gardiens gagnent de l’armure et de la résistance magique, et en confèrent aux alliés placés à côté d’eux au début du combat.

- **(2)** Gardiens : +30 armure et RM. Alliés adjacents au début du combat : +15.
- **(4)** Gardiens : +42 armure et RM. Alliés adjacents : +22.
- **(6)** Gardiens : +70 armure et RM. Alliés adjacents : +35.

Champions : Aurel (1), Brindille (1), Nébulos (1), Astrée (3), Grumhald (3), Thalassor (4), Valérian (4), Maître Orrhéon (5)

Comment la contrer : Les dégâts bruts, la Brèche et la Corrosion annulent leurs résistances ; contourner par des assassins.

> Un Gardien ne recule pas : il choisit où se tenir, et protège ceux qui l’entourent.

### Briseur

Toute l’équipe gagne des PV max ; les Briseurs en gagnent beaucoup plus.

- **(2)** Équipe : +100 PV. Briseurs : +20 % PV max.
- **(4)** Équipe : +120 PV. Briseurs : +25 % PV max.
- **(6)** Équipe : +200 PV. Briseurs : +50 % PV max.

Champions : Rugor (1), Gorm (2), Hargo (2), Auguste (3), Dame Ysolde (3), Célestin (4), Ignivar (4), Vorhn (5)

Comment la contrer : Les dégâts en pourcentage des PV (brûlure, Singularité) et les exécutions punissent les grosses réserves de PV.

> Les Briseurs encaissent pour que les autres puissent frapper.

### Duelliste

Chaque attaque d’un Duelliste lui confère de la vitesse d’attaque, cumulable 10 fois.

- **(2)** +6 % de vitesse d’attaque par attaque (10 fois).
- **(4)** +8 % de vitesse d’attaque par attaque (10 fois).
- **(6)** +11 % de vitesse d’attaque par attaque (10 fois) et 12 % d’omnivampirisme.

Champions : Murène (1), Cassian (2), Oriel (2), Vesna (2), Sirocco (3), Célestin (4), Abyssandre (5)

Comment la contrer : Les étourdissements et le désarmement coupent la montée en puissance ; les dégâts de zone tuent avant les cumuls.

> Le duel est une conversation : chaque échange accélère la suivante.

### Assassin

Au début du combat, les Assassins bondissent sur la ligne arrière ennemie. Leurs compétences peuvent être critiques.

- **(2)** +10 % de chances de coup critique et +15 % de dégâts critiques.
- **(4)** +16 % de chances de coup critique et +20 % de dégâts critiques.

Champions : Mirelle (1), Kesh (2), Félis (3), Ombral (3), Lunor (4)

Comment la contrer : Placer ses unités fragiles au centre, entourées d’alliés, et des Gardiens près d’elles ; les contrôles à l’atterrissage les neutralisent.

> La ligne de front n’est qu’un décor. Le vrai combat se joue derrière.

### Tireur

Les Tireurs infligent davantage de dégâts pour chaque hexagone qui les sépare de leur cible.

- **(2)** +7 % de dégâts par hexagone de distance.
- **(4)** +10 % de dégâts par hexagone de distance.
- **(6)** +15 % de dégâts par hexagone de distance.

Champions : Pim (1), Ronceval (2), Séraphine (2), Isaure (3), Amara (4), Pulsara (4)

Comment la contrer : Les assassins, les harpons et les attirances réduisent la distance ; placer ses tanks près de leur ligne.

> La distance est une arme ; les Tireurs la cultivent.

### Arcaniste

Toute l’équipe gagne de la Puissance ; les Arcanistes en gagnent bien davantage.

- **(2)** Équipe : +10 Puissance. Arcanistes : +20.
- **(4)** Équipe : +20 Puissance. Arcanistes : +45.
- **(6)** Équipe : +30 Puissance. Arcanistes : +80.

Champions : Coralie (1), Iota (1), Héliodore (3), Aldaïa (4), Mélisande (4), Chronaxe (5), Phénéa (5)

Comment la contrer : La résistance magique, le silence et les interruptions de mana neutralisent les Arcanistes.

> L’Observatoire enseigne que toute étoile est une équation qu’on peut réécrire.

### Invocateur

Les invocations des Invocateurs sont plus puissantes, et les Invocateurs commencent le combat avec du mana.

- **(2)** Invocations +20 % (PV et dégâts). +10 mana de départ.
- **(4)** Invocations +55 %. +30 mana de départ.

Champions : Tic (1), Morvain (4), Octave (4), Myrrhine (5), Néantis (5)

Comment la contrer : Les dégâts de zone et les exécutions dispersent les invocations ; frapper directement l’Invocateur.

> Invoquer, c’est convaincre le monde de prêter un corps à une idée.

### Oracle

Toute l’équipe régénère du mana ; les soins et boucliers des Oracles sont renforcés.

- **(2)** Équipe : +1 mana par seconde. Oracles : soins et boucliers +20 %.
- **(4)** Équipe : +2 mana par seconde. Oracles : soins et boucliers +35 %.

Champions : Liora (1), Clémence (2), Ilvane (2), Taliya (2), Vélane (3), Ophélune (5), Solenne (5)

Comment la contrer : Les Blessures et le silence ; tuer les Oracles en premier avec des assassins.

> Les Oracles entendent le battement du Cœur-Horloge, et le donnent aux autres.

### Alchimiste

Les dégâts des compétences des Alchimistes corrodent la cible : armure et résistance magique réduites.

- **(2)** Les Alchimistes gagnent 15 Puissance. Corrosion : −35 % d’armure et de RM pendant 4 s.
- **(4)** Les Alchimistes gagnent 35 Puissance. Corrosion : −50 % d’armure et de RM pendant 4 s, et Blessure (−33 % de soins).

Champions : Bertrade (1), Yselle (2), Barnabé (3), Calyx (3), Néréa (4)

Comment la contrer : Les boucliers absorbent les dégâts avant la corrosion ; les contrôles empêchent les Alchimistes de lancer leurs compétences.

> Tout se dissout, il suffit de trouver le bon solvant.

### Artilleur

Toutes les 2 attaques, l’Artilleur tire un obus qui touche les ennemis autour de sa cible.

- **(2)** Toutes les 2 attaques, obus : 110 % de la PA en dégâts physiques aux ennemis adjacents à la cible.
- **(4)** Toutes les 2 attaques, obus : 150 % de la PA. Les Artilleurs gagnent 15 % de vitesse d’attaque.

Champions : Tison (1), Gaspard Vis-de-Fer (2), Cendrine (3), Amara (4)

Comment la contrer : Espacer ses unités ; les assassins et harpons atteignent facilement les Artilleurs immobiles.

> Les Artilleurs considèrent que les ennemis regroupés sont une invitation.

