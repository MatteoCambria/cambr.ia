# Limites connues et feuille de route

## Périmètre

Orrhéa est un jeu **solo contre l'ordinateur**, par choix de conception définitif. Il ne contient
ni ne prévoit de fonctionnalité réseau, de compte, de classement en ligne, de lobby ou de mode
spectateur. Tout s'exécute dans le navigateur, hors ligne.

## Limites connues

**Plateformes**
- Vérifié uniquement dans Chromium (sans interface, via Playwright). Firefox, Safari et Edge
  n'ont pas été testés ; le jeu n'utilise que des API standard.
- Conçu pour un écran de bureau à partir de 1024×768 (vérifié à 1024×768, 1280×720, 1366×768,
  1600×900 et 1920×1080 ; sous 1180 px de large, le panneau des raccourcis est masqué). Les
  écrans plus petits et les téléphones ne sont pas pris en charge, et les interactions tactiles
  n'ont pas été testées.
- Performances mesurées seulement en rendu logiciel sans carte graphique (≈ 30 images/s en
  1600×900, conditions défavorables). Aucune mesure sur du matériel réel.

**Accessibilité**
- Les actions de boutique, d'XP, de verrouillage, de combat et de pause ont des raccourcis
  clavier, mais le placement sur le plateau demande une souris (le raccourci `W` déplace l'unité
  survolée entre plateau et réserve).
- Le plateau est dessiné en Canvas : les lecteurs d'écran n'en perçoivent pas le contenu
  (les panneaux, fiches et menus sont en HTML).
- Une option réduit les animations (flashs, tremblements) ; il n'existe pas encore de palette
  adaptée aux daltonismes ni d'option de taille de texte.

**Contenu et présentation**
- Interface et textes en français uniquement.
- Graphismes entièrement procéduraux, en une seule vue de 3/4 ; voir [art.md](art.md).
- Musique et effets produits par un synthétiseur écrit pour le projet : les timbres d'orchestre
  restent synthétiques ; voir [audio.md](audio.md). La première lecture d'un morceau peut
  démarrer avec quelques centaines de millisecondes de retard (décodage).
- Pas de revue des combats passés : l'écran de fin résume la partie (bilan, courbe des PV,
  classement, meilleures unités, composition finale) sans permettre de rejouer un combat.

**Équilibrage**
- Mesuré par simulation entre IA (voir [equilibrage.md](equilibrage.md)). Des stratégies
  humaines peuvent révéler des combinaisons plus fortes que ce que les IA exploitent.
- La place moyenne par champion dans les parties complètes est biaisée (les champions à 5 or
  apparaissent surtout sur les plateaux de fin de partie, donc chez les survivants) ; la
  puissance à coût égal se lit dans les duels miroirs, pas dans ce classement.

**Sauvegarde**
- Une seule partie en cours, dans le stockage local du navigateur : effacer les données du site
  la supprime. Pas d'export ni d'import de sauvegarde.
- Quitter pendant un combat reprend la manche au début de ce combat.

**IA**
- Les adversaires reposent sur des heuristiques et, en Difficile, sur un nombre limité de
  simulations de placement : ils ne planifient pas sur plusieurs manches et n'anticipent pas
  le contenu du pool de façon fine.

## Feuille de route (solo)

Par ordre de priorité proposé :

1. **Accessibilité** — placement entièrement au clavier, palettes pour daltonismes, taille de
   texte réglable, annonce des événements de combat pour les lecteurs d'écran.
2. **Revue de combat** — rejouer le dernier combat (la simulation est déterministe : la graine
   et les plateaux suffisent), avec graphiques de dégâts par unité.
3. **Modes solo supplémentaires** — défi à graine du jour (local, sans classement en ligne),
   scénarios d'entraînement à objectifs, partie rapide à 4 joueurs.
4. **Contenu** — une neuvième origine et deux classes, objets spéciaux de synergie, nouvelles
   rencontres neutres ; chaque ajout passe par les mesures de `sim:units` et `sim:traits`.
5. **Adversaires** — difficulté « Expert » avec planification sur plusieurs manches et lecture
   du pool public ; personnalités plus marquées (préférences d'objets, styles de placement).
6. **Plateformes** — validation Firefox et Safari, mise en page tablette avec glisser tactile,
   rendu WebGL facultatif pour les configurations modestes.
7. **Présentation** — traduction anglaise, vues de face et de dos des figurines, banque
   d'instruments échantillonnés facultative pour la musique.
8. **Sauvegarde** — export et import de fichier, plusieurs emplacements.
