# Qualité : tests, simulations et vérifications

Tout ce qui est décrit ici a été exécuté ; les résultats chiffrés proviennent des fichiers de
`reports/` produits par les commandes indiquées.

## 1. Tests automatisés (`npm test`)

136 tests Vitest, répartis en 7 fichiers, tous au vert à la livraison.

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `combat.test.ts` | 36 | formules (armure, critiques, plafonds), boucliers, soins et Blessure, mort, contrôles et fenêtre de résistance, immunités ; déterminisme à graine identique ; fin de tous les combats avant la limite ; chaque compétence des 60 champions se lance sans erreur ; chaque objet combiné s'équipe et agit ; règles des synergies (comptage des champions distincts, Myrrhine comptée double, automate du Rouage, protection du Gardien selon le placement, bonus du Tireur selon la distance) |
| `game.test.ts` | 31 | intérêts, séries, revenu détaillé, valeur de revente ; probabilités de la boutique (échantillon statistique) ; conservation du pool lors des achats, ventes et actualisations ; refus d'achat sans or ou sans place ; verrouillage ; niveaux ; fusions 2★ et 3★ entre plateau et réserve (position et objets conservés) ; limite de déploiement ; cases interdites ; combinaisons d'objets, refus d'un 4e objet, objets rendus à la vente ; partie simulée complète avec vainqueur et classements uniques ; parties reproductibles ; carrousel ; **absence d'accès des IA aux informations cachées** ; chaque champion peut apparaître en boutique |
| `save.test.ts` | 6 | aller-retour d'une partie, sauvegarde altérée rejetée (somme de contrôle), données corrompues ou d'une autre version ignorées sans erreur, validation des références, bornage des paramètres, fonctionnement sans stockage disponible |
| `content.test.ts` | 4 | validité du contenu (descriptions, valeurs, références, recettes), quantités minimales, coûts 1 à 5, compétences mécaniquement distinctes |
| `audio.test.ts` | 18 | primitives DSP, rendus des effets et extraits musicaux, manifeste et fichiers générés |
| `audio-manager.test.ts` | 6 | gestionnaire audio sur une Web Audio API simulée : fondus, couches, volumes |
| `audio-browser.test.ts` | 4 | intégration audio côté navigateur |

Compléments : `npm run typecheck` (TypeScript strict, aucun `any` implicite) et
`npm run validate` (cohérence du contenu, aussi exécutée par les tests).

## 2. Simulations

Toutes les simulations sont déterministes (graine fixe) et s'exécutent sans interface.

| Commande | Volume | Résultat |
|---|---|---|
| `sim:smoke` | 300 combats d'équipes aléatoires | 0 erreur, 0 match nul, durée moyenne 18,9 s, maximum 39 s |
| `sim:units` | 6 000 combats à 2★ et 6 000 à 1★ | 60 champions entre 43,5 % et 57,6 % face aux champions de même coût, au rang pertinent |
| `sim:traits` | 300 combats × 2 configurations × 35 paliers | gain propre de chaque palier ; voir [equilibrage.md](equilibrage.md) |
| `sim:balance` | 300 parties complètes à 8 IA (Normal), 40 en Difficile | ≈ 44 000 combats ; voir [equilibrage.md](equilibrage.md) |
| `sim:difficulty` | 32 lobbies mixtes (3 Facile, 2 Normal, 3 Difficile) | gradient de difficulté ; voir [equilibrage.md](equilibrage.md) |
| `sim:game` | 1 partie complète | déroulé lisible manche par manche |

Exports : `reports/balance-*.json` et `.csv` (champions, synergies, objets), `reports/unitpower-*.json`,
`reports/traitpower.json`.

## 3. Vérifications dans le navigateur (`npm run qa:browser`)

Le script `tools/qa/browser.mjs` pilote Chromium sur la version optimisée (`npm run preview`) et
vérifie, avec captures d'écran dans `reports/qa/` :

- **Navigation** : menu, encyclopédie, règles, paramètres, crédits, retour au menu, mode
  entraînement (combat de démonstration lancé) ; un paramètre modifié survit à un rechargement.
- **Première partie** : guide « Premiers pas » affiché, chrono arrêté pendant sa lecture,
  fermeture par Échap ; carrousel ; achat par clic ; glisser de la réserve au plateau ;
  info-bulle au survol ; fiche au clic, fermée par Échap ; déplacement sur le plateau ; objet
  glissé sur un champion ; vente par dépôt sur la boutique ; raccourcis `D`, `F`, `1` ; menu pause.
- **Sauvegarde** : « Sauvegarder et quitter », rechargement de la page, « Continuer la partie »
  reprend la même manche.
- **Résolutions** : 1280×720 et 1920×1080, plateau complet au niveau 8, préparation et combat,
  sans défilement de page.
- **Partie complète** : de la première manche à l'écran de fin, à vitesse ×3, avec une stratégie
  simple (acheter, monter de niveau, déployer, équiper).
- **Erreurs** : aucune exception JavaScript ni message d'erreur dans la console sur l'ensemble.

Dernière exécution : voir [§ 5](#5-dernière-exécution).

Mesures complémentaires réalisées pendant le développement (scripts ponctuels) : ≈ 30 images/s
en 1600×900 en rendu logiciel sans carte graphique, mémoire JavaScript stable (≈ 37 Mo) au fil
de trois parties complètes enchaînées.

## 4. Défauts trouvés et corrigés pendant les vérifications

| Constat | Correction |
|---|---|
| Plateau vide au premier affichage (conteneur de hauteur nulle) | conteneur positionné en absolu sur toute la zone |
| Bannière de manche coupée sur plusieurs lignes au-dessus du carrousel | largeur au contenu, fond en dégradé, position relevée |
| Bouton « Combattre » chevauchant la réserve | repositionné ; message d'aide quand le plateau est vide |
| Icônes de synergie étirées dans les cartes de boutique | sélecteur CSS restreint |
| Fenêtre de l'encyclopédie impossible à fermer | fond plein écran cliquable et touche Échap |
| Aperçu invisible pendant le glisser d'un objet | aperçu rendu hors du panneau flouté (portail) |
| Portée et cases adjacentes affichées en glissant hors du plateau | masquées hors du plateau |
| Notifications de synergie écrasées en colonne étroite | conflit de nom de classe CSS avec les lignes de synergie ; classes préfixées |
| Têtes des figurines coupées en haut du plateau | marge haute dans le calcul de mise en page |
| IA gardant une seule unité en début de partie | règle « compléter le plateau » prioritaire sur l'épargne |
| IA déployant des doublons | pénalité de doublon dans l'évaluation d'équipe |
| Double variation de hauteur sur les effets sonores | variation appliquée une seule fois, par le gestionnaire audio |
| Libellés « combat JcJ » ambigus dans un jeu solo | remplacés par « combat contre un Archonte » |
| Règles : revenu réduit annoncé « pendant l'étape 1 » alors qu'il couvre les cinq premières manches | texte corrigé |

## 5. Dernière exécution

_Complété à la livraison._
