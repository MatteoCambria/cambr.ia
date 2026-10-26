# Conception et architecture

## 1. Intention

Orrhéa est un auto-battler tactique jouable seul contre l'ordinateur. Les décisions du joueur se
prennent entre les combats : quoi recruter, quand dépenser ou économiser, comment placer ses
unités, quelles synergies viser, à qui confier les objets. Les combats sont automatiques et
lisibles : chaque effet visible correspond à une règle déterministe du moteur.

Le périmètre est volontairement **solo** : pas de réseau, de compte, de classement en ligne ni de
synchronisation. Les adversaires sont des IA qui jouent avec exactement les mêmes règles que le
joueur et sans information cachée.

## 2. Univers

Orrhéa est un immense planétaire céleste — l'Orrery — dont les huit Sphères tournent autour du
Cœur-Horloge. À chaque Convergence, quand les orbites s'alignent, des Archontes rivaux réunissent
des champions de toutes les Sphères ; le dernier debout gagne le droit de remonter l'Horloge pour
un nouveau cycle.

Les huit Sphères donnent les **origines** des champions :

| Sphère | Thème | Identité de jeu |
|---|---|---|
| Zénith | ordre solaire de chevaliers | boucliers de début de combat |
| Sélène | cour lunaire | vol de vie, soins périodiques de l'allié le plus blessé |
| Rouage | fonderie d'horlogers | automate assemblé au début du combat, vitesse d'attaque |
| Sylve | forêt ancienne | croissance : PV max gagnés toutes les 3 s |
| Abysse | profondeurs marines | exécution des ennemis sous un seuil de PV |
| Braise | forges volcaniques | brûlures en % des PV max, Blessure, colère à chaque allié tombé |
| Nomade | caravanes des sables | synergie économique : or et composants supplémentaires |
| Astral | voyageurs entre les étoiles | renaissance sous forme d'étoile à la première mort |

Les dix **classes** (Gardien, Briseur, Duelliste, Assassin, Tireur, Arcaniste, Invocateur, Oracle,
Alchimiste, Artilleur) recoupent les origines : chaque champion porte au moins une origine et une
classe, ce qui crée des compositions hybrides. Détail des paliers : [synergies.md](synergies.md).

## 3. Règles

Toutes les valeurs sont centralisées dans `src/config/balance.ts` et `src/config/rounds.ts`.

**Partie.** 4 à 8 Archontes (le joueur + 3 à 7 IA), 100 PV chacun. Un Archonte à 0 PV ou moins est
éliminé ; sa place finale dépend de l'ordre d'élimination (en cas d'éliminations simultanées, le
plus bas total de PV est classé derrière).

**Calendrier.** Étape 1 : carrousel, puis trois rencontres neutres (créatures). Chaque étape
suivante : trois combats contre des Archontes, un carrousel, deux combats, une rencontre neutre.
Les appariements évitent de rencontrer les mêmes adversaires d'affilée ; avec un nombre impair de
survivants, un joueur affronte la copie (« reflet ») du plateau d'un autre.

**Combat perdu.** Le perdant subit les dégâts de l'étape (0, 2, 4, 6, 8, 10, 13, 16, 20 selon
l'étape) plus 1 à 5 points par unité adverse survivante, selon son rang et son coût. Un match nul
inflige aux deux camps les dégâts de l'étape, sans dégâts de survivants, et interrompt les séries.

**Économie.** 2 or au départ ; revenu de base de 5 or par manche, réduit au début (0, 2, 2, 3 puis
4 or pour les cinq premières manches). À partir de l'étape 2 s'ajoutent les intérêts (1 or par
tranche de 10 or possédés, 5 au plus) et le bonus de série de victoires ou de défaites (+1 à +3) ;
chaque victoire contre un Archonte rapporte 1 or. Actualiser la boutique coûte 2 or, 4 XP coûtent 4 or, et
chaque manche donne 2 XP.

**Niveaux.** Du niveau 1 au niveau 10 ; le niveau fixe le nombre d'unités déployables et les
probabilités de la boutique (de 100 % de champions à 1 or au niveau 1, à 25 % de champions à 5 or
au niveau 10). Seuils d'XP : 2, 2, 6, 10, 20, 36, 48, 72, 84.

**Pool partagé.** Chaque champion existe en nombre limité (29 exemplaires à 1 or, 22, 18, 12, 10 à
5 or), partagé par tous les joueurs. Acheter retire un exemplaire du pool, vendre ou être éliminé
le rend. Les boutiques sont tirées dans ce pool : un champion très disputé devient rare.

**Rangs.** Trois exemplaires identiques (plateau et réserve confondus) fusionnent en 2★ ; trois
2★ en 3★. PV ×1,8 puis ×3,24 ; PA ×1,5 puis ×2,25 ; les compétences ont des valeurs par rang.
La fusion conserve la position et les objets.

**Objets.** 8 composants ; deux composants sur un même champion forment l'un des 36 objets
combinés (table complète dans [objets.md](objets.md)). 3 objets au plus par champion. Les objets
viennent des rencontres neutres, du carrousel et de certaines synergies ; la vente rend les objets.

**Carrousel.** Des champions portant chacun un composant sont proposés ; les joueurs choisissent à
tour de rôle, les moins bien classés en premier.

**Temps.** Chaque manche de préparation dure 30, 45 ou 60 s, ou sans limite (choisi au lancement).

## 4. Moteur de combat (`src/combat/`)

- **Déterministe** : pas fixe de 1/30 s, générateur pseudo-aléatoire à graine (sfc32), ordre de
  traitement stable par identifiant, file d'événements différés triée par (temps, numéro de
  séquence). Même graine et même état initial donnent le même combat, quelle que soit la vitesse
  d'affichage — c'est vérifié par un test.
- **Plateau** : grille hexagonale 7 colonnes × 8 rangées (4 par camp), coordonnées décalées.
- **Déplacement** : recherche en largeur du premier pas vers une case à portée de la cible ; si la
  cible est inaccessible pendant 1 s, l'unité choisit l'ennemi atteignable le plus proche.
- **Ciblage selon le rôle** : mêlée → ennemi le plus proche ; unités à distance → cibles
  affaiblies à portée ; infiltrés → ligne arrière et cibles blessées ; persistance sur la cible
  courante ; la provocation impose la cible.
- **Attaques** : temps de préparation proportionnel à l'intervalle d'attaque, projectiles avec
  vitesse propre, critiques (25 % de base, ×1,4), armure et résistance magique en
  100 / (100 + résistance), réduction de dégâts plafonnée à 80 %.
- **Mana** : gagné en attaquant et en subissant des dégâts (plafonné par coup) ; la compétence se
  lance à mana plein.
- **Statuts** : étourdissement, immobilisation, désarmement, silence, provocation, brûlure, poison,
  saignement, modificateurs de statistiques, intouchable, invulnérable, immunité aux contrôles,
  renvoi, lien, stase — avec règles de cumul (rafraîchir, cumuler, garder le maximum) et une
  fenêtre de résistance après un étourdissement pour empêcher le contrôle permanent.
- **Fin** : un camp n'a plus d'unité, ou limite de temps. À 30 s commence l'Embrasement : +20 % de
  dégâts infligés par seconde et soins réduits de moitié ; à 48 s le combat est déclaré nul.

### Langage des compétences (`src/combat/dsl.ts`)

Compétences, passifs, synergies, objets, invocations et créatures sont décrits par des **données**,
interprétées par un seul moteur (`actions.ts`). Aucun champion n'a de code spécifique.

- **Actions** : dégâts, soin, bouclier, statut, purification, mana, projectile, rebond, délai,
  répétition, déplacement (bond, charge, téléportation, repli), attraction/répulsion, invocation,
  zone persistante, attaques renforcées, transformation, exécution, lien, retour dans le temps,
  compteurs, conditions, or, protection contre la mort, renaissance, relance.
- **Zones** : cible, soi, cercle, ligne, tout un camp, N plus proches, N au hasard, alliés
  adjacents, rangée, plus haute statistique, sélecteur.
- **Sélecteurs** : cible courante, plus proche, plus lointain, PV les plus bas, menace la plus
  forte, centre du plus gros groupe, ligne arrière, mana la plus haute, allié le plus blessé, etc.
- **Déclencheurs** : début de combat, intervalle, attaque, n-ième attaque, dégâts de compétence,
  dégâts infligés ou subis, dégâts atténués, élimination, mort d'un allié ou d'un ennemi, lancement
  (le sien ou celui d'un allié), bouclier brisé, PV sous un seuil, coup critique, coup mortel
  (sur soi ou un allié), fin du combat — avec délai interne, déclenchement unique et condition.
- **Valeurs** : nommées et définies par rang (`{dmg}` → 240/360/900), mises à l'échelle par la
  Puissance quand l'effet s'y prête. Les descriptions affichées sont générées à partir de ces
  mêmes valeurs : le texte ne peut pas mentir sur les chiffres.
- **Garde-fous** : profondeur de déclenchements en chaîne limitée à 6, budget de 4 000 actions par
  pas de simulation, durée maximale.

## 5. Adversaires (`src/ai/`)

Chaque IA combine un **profil** (stratégie) et une **difficulté** (qualité d'exécution).

| Profil | Stratégie |
|---|---|
| Agressif | monte de niveau tôt et dépense pour gagner les premières manches |
| Économe | maximise les intérêts, puis investit massivement en milieu de partie |
| Défensif | ligne de front solide, objets défensifs, préserve ses PV |
| Spécialiste | vise le palier maximal d'une synergie fétiche |
| Flexible | suit la boutique et change de voie si la sienne est disputée |
| Chasseur de légendes | sacrifie le début de partie pour un niveau élevé et des champions rares |

Les profils s'appuient sur 15 archétypes de compositions (synergies visées, carrys, tanks, objets),
utilisés comme intentions et complétés par ce que la boutique propose.

| Difficulté | Ce qui change |
|---|---|
| Facile | évaluation bruitée, oublis fréquents (XP, actualisations, objets), plan de niveau peu suivi, placement approximatif, plateau parfois incohérent |
| Normal | évaluation correcte, peu d'oublis, placement par règles tactiques, objets attribués au bon porteur, actualisations de stabilisation |
| Difficile | évaluation précise, aucune erreur d'exécution, placement et choix du plateau testés par simulation contre les plateaux adverses observés, gestion de l'or adaptée à la force estimée de son plateau |

**Équité.** Les statistiques des unités sont identiques pour tous, quelle que soit la difficulté.
L'IA agit uniquement par les mêmes fonctions que le joueur (`src/game/actions.ts`), avec les mêmes
coûts et limites. Pour les autres joueurs, elle ne lit que la vue publique
(`src/game/snapshot.ts` : plateau du dernier combat, PV, niveau, série) — jamais la boutique, le
générateur aléatoire ou les décisions en cours d'autrui. Un test le vérifie.

## 6. Architecture

```
            ┌────────────┐   actions (achat, vente, placement…)   ┌──────────────┐
  UI React ─┤ controller ├───────────────────────────────────────►│ game (règles)│◄── IA
  Canvas   ◄┤  (app/)    │◄── état + événements de combat ───────┤ combat (sim) │
            └────────────┘                                        └──────────────┘
                 │  sauvegarde                                         ▲
                 ▼                                                     │ données
            save/ (localStorage versionné)            champions/ traits/ items/ creatures/ config/
```

- **Règles sans interface** : `game/`, `combat/`, `shop/`, `economy/`, `progression/`, `ai/` ne
  dépendent ni du DOM ni de React. Les simulations et les tests les exécutent sous Node.
- **Contrôleur** (`app/controller.ts`) : seul point d'entrée de l'interface ; il applique les
  actions, fait avancer les phases, joue le combat du joueur image par image et diffuse l'état.
- **Rendu** : une seule boucle `requestAnimationFrame` ; le plateau est dessiné en Canvas 2D
  (couche de cases mise en cache, figurines, effets), l'interface DOM est en React et rafraîchie
  environ 8 fois par seconde pendant un combat.
- **Sauvegarde** : paramètres, carrière et partie en cours dans `localStorage`, avec version,
  somme de contrôle et validation structurelle ; une sauvegarde invalide est ignorée sans erreur ;
  le jeu fonctionne aussi sans stockage disponible. La partie est enregistrée à chaque phase de
  préparation ; quitter pendant un combat reprend au début de ce combat.
- **Audio** : musiques et effets générés hors ligne par un synthétiseur écrit pour le projet
  (`tools/audio/`), lus par un gestionnaire Web Audio avec fondus, couches d'intensité et quatre
  volumes séparés. Voir [audio.md](audio.md).
- **Graphismes** : figurines, portraits, icônes et décors dessinés par code à partir de
  descriptions déclaratives (`look` de chaque champion). Voir [art.md](art.md).

## 7. Ajouter du contenu

- **Champion** : ajouter une entrée dans `src/champions/data/<origine>.ts` (statistiques par
  gabarit, compétence en données, apparence, textes). `npm run validate` vérifie références et
  valeurs ; `npm test` vérifie que la compétence se lance sans erreur ; `npm run sim:units` mesure
  sa puissance face aux champions de même coût ; `npm run docs` met à jour les catalogues.
- **Synergie** : `src/traits/data.ts` (paliers, effets sur porteurs, équipe ou meneur, effets
  économiques). Mesure : `npm run sim:traits`.
- **Objet** : `src/items/data.ts` ; la recette doit être unique (vérifié).
- **Règle chiffrée** : `src/config/balance.ts`, jamais ailleurs.
