# Équilibrage

Toutes les valeurs de règles vivent dans `src/config/balance.ts` ; les valeurs des champions,
synergies et objets dans leurs fichiers de données. L'équilibrage a été mené par itérations :
mesurer, corriger les écarts, mesurer à nouveau. Les chiffres ci-dessous sont ceux de la version
livrée ; les fichiers bruts sont dans `reports/`.

## 1. Méthodes de mesure

| Outil | Question posée | Principe |
|---|---|---|
| `sim:units` | Un champion est-il à sa place parmi ceux de même coût ? | Duels miroirs : l'équipe B reprend le profil de coûts de l'équipe A, chaque emplacement étant remplacé par un autre champion du même coût. 50 % = dans la norme. Mesuré à 2★ pour les coûts 1 à 3 et à 1★ pour les coûts 4 et 5 (les rangs réellement joués). |
| `sim:traits` | Que rapporte une synergie en elle-même ? | La même équipe affronte les mêmes adversaires, avec puis sans les effets de la synergie : l'écart de taux de victoire isole la synergie de la qualité des champions qui la portent. |
| `sim:balance` | Comment tout cela se comporte-t-il en partie réelle ? | Parties complètes à 8 IA ; place moyenne (4,5 = neutre) par profil, synergie, champion et objet présents sur le plateau final ; durée des combats, matchs nuls, longueur des parties. |
| `sim:difficulty` | Les difficultés sont-elles distinctes ? | Lobbies mixtes Facile / Normal / Difficile, sièges permutés à chaque partie. |

Cibles retenues :

- champions : entre 42 % et 58 % face à leurs pairs de même coût ;
- synergies : écart propre comparable aux autres synergies de même taille de palier
  (un palier à 4 champions pèse naturellement plus qu'un palier à 2) ;
- parties : place moyenne de chaque profil d'IA dans ±0,5 du neutre ; combats de 20 à 35 s en
  moyenne, avec moins de 1 % de matchs nuls.

**À lire avec prudence.** La place moyenne par champion en partie complète est biaisée : les
champions à 5 or apparaissent surtout sur les plateaux de fin de partie, donc chez les joueurs qui
ont survécu. Elle sert à repérer les anomalies (champion jamais joué, place aberrante) ; la
puissance relative se lit dans les duels miroirs.

## 2. Champions à coût égal (`reports/unitpower-*.json`)

6 000 combats par rang mesuré.

| Coût | Rang mesuré | Plus faible | Plus fort | Écart-type (pts) |
|---|---|---|---|---|
| 1 or | 2★ | Coralie 44,4 % | Aurel 56,8 % | 4,6 |
| 2 or | 2★ | Vesna 43,7 % | Yselle 55,8 % | 4,6 |
| 3 or | 2★ | Cendrine 44,3 % | Grumhald 57,6 % | 4,2 |
| 4 or | 1★ | Morvain 44,3 % | Célestin 57,7 % | 4,2 |
| 5 or | 1★ | Maître Orrhéon 44,8 % | Ophélune 57,7 % | 4,3 |

Les 60 champions sont dans la plage cible ; écart-type global : 4,4 points.

## 3. Valeur propre des synergies (`reports/traitpower.json`)

Gain de taux de victoire apporté par le palier (300 combats avec et 300 sans, équipes de 7 à 2★).

| Synergie | Palier à 2 | Palier à 4 |
|---|---|---|
| Zénith | +11 pts | +33,3 pts |
| Sélène | +14,8 pts | +31,5 pts |
| Rouage | +16,4 pts | +34,4 pts |
| Sylve | +11 pts | +27,4 pts |
| Abysse | +6,6 pts | +26 pts |
| Braise | +7,2 pts | +34,7 pts |
| Nomade | −1 pts | +8,3 pts |
| Astral | +12,8 pts | +35 pts |
| Gardien | +19 pts | +40,4 pts |
| Briseur | +21,5 pts | +38,7 pts |
| Duelliste | +11,5 pts | +31,3 pts |
| Assassin | +17,2 pts | +38,3 pts |
| Tireur | +18 pts | +30,4 pts |
| Arcaniste | +16,3 pts | +35,7 pts |
| Invocateur | +14,5 pts | — |
| Oracle | +13,6 pts | +27,7 pts |
| Alchimiste | +11,9 pts | +35 pts |
| Artilleur | +4,7 pts | +37,7 pts |

Médianes : 13,6 pts pour un palier à 2, 34,4 pts pour un palier à 4.

Lecture :
- **Nomade** est volontairement faible en combat : c'est une synergie économique (or après
  chaque combat contre un Archonte, composants au fil des victoires) que cette mesure ne voit pas.
- **Artilleur (2)** apporte peu isolément, mais les compositions Artilleur se classent au-dessus
  de la moyenne en partie complète ; il est laissé en l'état et à surveiller.
- **Invocateur** n'a pas de mesure à 4 : moins de quatre Invocateurs coûtent 4 or ou moins, ce que
  l'outil exige pour composer ses équipes.

## 4. Parties complètes (`reports/balance-final*.json` et `.csv`)

300 parties à 8 IA en difficulté Normal, soit 44 137 combats entre Archontes.

| Indicateur | Valeur |
|---|---|
| Longueur moyenne d'une partie | 34,7 manches |
| Durée des combats | moyenne 27,4 s, médiane 26,7 s, 90 % sous 37,5 s |
| Matchs nuls | 0,22 % des combats |
| Niveau moyen en fin de partie | 8,1 |
| Champions jamais joués | aucun |

**Profils d'IA** (place moyenne ; 4,5 = neutre)

| Profil | Place moyenne | Top 4 | Victoires |
|---|---|---|---|
| Agressif | 4,17 | 55,8 % | 13,3 % |
| Chasseur de légendes | 4,20 | 55,6 % | 14,7 % |
| Flexible | 4,33 | 54,6 % | 14,6 % |
| Spécialiste | 4,66 | 45,1 % | 13,9 % |
| Défensif | 4,72 | 46,0 % | 7,5 % |
| Économe | 4,99 | 40,2 % | 9,6 % |

Toutes les stratégies restent viables ; l'Économe est la plus exigeante (il dépend d'un
investissement réussi en milieu de partie) et se situe à la limite de la cible de ±0,5.

**Synergies** (place moyenne des plateaux finaux où elles sont actives) : de 3,40 (Invocateur,
présent sur 8,6 % des plateaux) à 4,65 (Oracle). Avant la dernière passe, l'écart allait de 3,11 à
4,74. Gardien et Briseur, les synergies de ligne de front, sont présentes sur plus de la moitié
des plateaux, sans être dominantes (4,35 et 4,10).

**Objets** : les 36 objets combinés sont tous utilisés (270 à 703 plateaux finaux chacun) et se situent
entre 3,70 (Cœur de géant) et 4,43 (Pendule d'argent) de place moyenne.

**Évolution au fil des passes**

| Passe | Parties | Manches | Nuls | Combat moyen | Synergies (meilleure → moins bonne) |
|---|---|---|---|---|---|
| Première mesure | 80 | 34,8 | 1,54 % | 26,6 s | 2,75 → 5,63 |
| Passe 1 | 100 | 34,4 | 0,99 % | 25,9 s | 2,93 → 5,36 |
| Passe 2 | 100 | 34,4 | 1,07 % | 25,7 s | 2,93 → 4,97 |
| Passe 3 | 100 | 35,3 | 0,23 % | 26,0 s | 2,89 → 5,03 |
| Passe 4 | 100 | 34,4 | 0,29 % | 27,7 s | 3,23 → 5,24 |
| Version livrée | 300 | 34,7 | 0,22 % | 27,4 s | 3,40 → 4,65 |

## 5. Difficultés

32 lobbies mixtes de 8 IA (2 sièges Facile, 3 Normal, 3 Difficile, sièges permutés à chaque
partie, profils tirés au hasard). Les unités ont exactement les mêmes statistiques pour tous ;
seule la qualité des décisions diffère (`reports/difficulty.json`).

| Difficulté | Place moyenne | Top 4 | Victoires | Sièges mesurés |
|---|---|---|---|---|
| Facile | 6,75 | 9 % | 0 % | 64 |
| Normal | 4,13 | 55 % | 15 % | 96 |
| Difficile | 3,38 | 72 % | 19 % | 96 |

Le gradient est net entre Facile et Normal, plus resserré entre Normal et Difficile : le Difficile
gagne surtout par la régularité (placement testé par simulation, gestion de l'or selon la force
estimée de son plateau) plutôt que par des écrasements.

40 parties entièrement en Difficile (5 816 combats) gardent les mêmes caractéristiques qu'en
Normal : 34,3 manches, combats de 27,8 s en moyenne, 0,26 % de matchs nuls. Sur ce petit
échantillon, l'Agressif ressort devant (3,44) et le Spécialiste derrière (4,86) ; avec 26 à 105
sièges par profil, ces écarts restent dans le bruit de mesure.

## 6. Historique des décisions

Les corrections ont toujours été motivées par une mesure, puis vérifiées par une nouvelle mesure.

**Règles de combat**
- Embrasement : la hausse des dégâts passe de +12 % à +20 % par seconde après 30 s. Les combats
  entre tanks s'éternisaient : les matchs nuls passent de 1,5 % des combats (première mesure) à 0,2 %.

**Synergies**
- Gardien et Briseur, présents sur plus de la moitié des plateaux et très forts isolément :
  Gardien 55/90 → 42/70 d'armure et RM (alliés adjacents 30/50 → 22/35), Briseur équipe
  +175/+250 → +120/+200 PV et porteurs +40/65 % → +25/50 % PV max.
- Assassin, meilleure place moyenne lors des premières passes : critiques +15/+30 % → +10/+20 % (dégâts
  critiques +20/+45 → +15/+25), puis palier 4 ramené à +16 % / +20 %.
- Astral (renaissance) : 40/60 % → 30/45 % des PV, Puissance au palier 4 : 40 → 30.
- Oracle : régénération d'équipe 2,5 → 2 mana/s, soins renforcés +45 → +35 %.
- Rouage : sentinelle ≈ 1 300 → 1 100 PV, vitesse d'attaque 18 → 15 %.
- Renforcés car en retrait : Sylve (croissance du premier palier 4 → 5,5 % des PV max), Abysse (exécution 10/17 →
  12/20 %), Duelliste (4/7 → 6/8 % de vitesse par attaque), Tireur (5 → 6 puis 7/10/15 % par
  hexagone), Nomade (vitesse de départ plus longue et plus forte), Artilleur (obus du palier 2 :
  90 → 110 % de la PA), Alchimiste (+15/+35 Puissance, corrosion 30 → 35 % au palier 2).
- Braise : brûlure du premier palier 1,5 → 1,2 % des PV max par seconde.
- Invocateur, meilleure place moyenne et palier 2 le plus fort isolément : invocations +30/70 %
  → +20/55 %, mana de départ +15/35 → +10/30.

**Champions** (dernière passe, d'après `sim:units`)
- Affaiblis : Nébulos (bouclier et ralentissement), Ignivar (aura 1,6 → 1,3 % des PV max),
  Célestin (dégâts et PV), Brindille (réduction de dégâts, PV et armure), Myrrhine (vitesse
  d'attaque conférée), Néréa (dégâts du tourbillon, après le renfort de l'Alchimiste).
- Renforcés : Tison, Sirocco, Aldaïa, Ophélune.
- Les effets d'équipe (Ophélune, Myrrhine) se sont révélés très sensibles : un premier ajustement
  les a fait basculer d'un extrême à l'autre ; la valeur finale est intermédiaire.

**Adversaires**
- Règle « compléter le plateau » : en début de partie, l'IA n'épargnait pas au point de jouer
  avec une seule unité ; acheter pour occuper une place libre passe avant l'épargne.
- Pénalité de doublon dans l'évaluation du plateau (deux exemplaires du même champion
  n'apportent qu'une fois la synergie).
- Chasseur de légendes : passage au niveau 7 avant le niveau 8 et seuil de stabilisation relevé
  (42 → 50 PV) ; il finissait nettement dernier des profils.
- Économe : seuil de stabilisation relevé (35 → 40 PV).
- Facile / Normal : bruit d'évaluation, oublis et discipline réglés pour que l'écart entre les
  difficultés vienne des décisions, sans toucher aux statistiques des unités.
