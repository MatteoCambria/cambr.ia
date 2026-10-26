# Orrhéa — direction artistique et rendu procédural

Tout le visuel des personnages, des icônes et du décor de l'arène est **dessiné en Canvas 2D** (tracés
vectoriels, dégradés, lueurs pré-rendues). Aucune image, aucune police externe, aucune dépendance.

## 1. Principes de direction artistique

**Monde** : Orrhéa, horlogerie céleste. Huit Sphères gravitent autour d'un Cœur-Horloge arrêté.
Ciel indigo profond, constellations, filigranes dorés, laiton, cristaux lumineux.

**Figurines chibi premium**
- Tête grosse (≈ 37 % de la hauteur), silhouette lisible de loin, vue de 3/4 tournée vers +x.
- Contour fin **indigo très sombre** (`INK = #140b22`, jamais noir pur), épaisseur constante à l'écran
  (≈ 1,2 à 2 px selon la taille).
- Éclairage par le haut : dégradés clair → base → sombre ; les ombres tirent vers l'indigo
  (`darken` mélange vers `#120a2a`), les lumières vers l'ivoire chaud (`lighten` vers `#fff6e0`).
- Reflets spéculaires discrets sur le métal, liserés dorés (`trim` = or teinté par l'accent).
- Chaque figurine repose sur un **socle de figurine** elliptique (aplati à 0,55, proche de l'inclinaison
  `TILT = 0.66` du plateau) : bleu-or pour l'équipe 0, rouge-cuivre pour l'équipe 1, graduations
  d'horloger, ombre portée douce.
- 2★ : losanges argentés sur le socle ; 3★ : losanges dorés, double filet doré et halo doré.
- **La lisibilité prime** : les détails fins (rivets, gravures, reflets) sont automatiquement
  supprimés quand la figurine est petite à l'écran (niveau de détail `lod`).

**Couleurs** : `primary` = masse principale (armure, robe, fourrure), `secondary` = cheveux,
pantalons, cape, ventre ; `accent` = yeux lumineux, gemmes, lueurs, magie. Les factions
(indicatif) : Zénith or/ivoire, Sélène argent/violet, Rouage cuivre/laiton, Sylve verts/bruns,
Abysse sarcelle/bioluminescence, Braise charbon/orange, Nomade sable/turquoise, Astral violet/étoiles.

**Icônes** : « gravure dorée / glyphe lumineux » — silhouettes pleines en métal dégradé, contour
encré, biseau (reflet en haut, ombre en bas), détails gravés en creux, incrustations lumineuses,
léger halo. Pensées pour 16–48 px.

**Arène** : ciel indigo (nébuleuses, voie lactée, constellations), Cœur-Horloge géant arrêté
(11 h 58) autour de la plateforme, trois anneaux d'orrery en pointillés mobiles où gravitent les huit
Sphères, plateforme de pierre octogonale (cadran de laiton incrusté, dallage gravé, rivets),
quai de la réserve à engrenages. Humeurs : `prep` (bleu calme), `combat` (voile violet, runes
violettes), `final` (voile rouge pulsant, runes rouges, braises).

## 2. Structure du code

```
src/render/
  sprites.ts        API drawUnit (socle, ombre, figurine, flash, dissolution, silhouette)
  portraits.ts      portraitCanvas / portraitDataUrl (buste cadré, cache)
  icons.ts          drawIcon / iconDataUrl / ICON_KEYS / isIconKey (bitmaps en cache)
  arenaArt.ts       drawArenaBackground / drawHexTile (couche statique en cache + animations)
  spritePreview.ts  planche de vérification (sprite-preview.html)
  art/
    math.ts         utilitaires (kf = images clés lissées, rng, bruit…)
    color.ts        couleurs, palette dérivée d'un Look (Pal, mise en cache par Look)
    paths.ts        tracés (ellipse, étoile, engrenage, croissant, taper = forme effilée, limb…)
    paint.ts        état de rendu RS + primitives (fo = remplissage+contour, dégradés en cache, lueurs)
    rig.ts          gabarits des 12 BodyShape (proportions, épaules, hanches, échelle d'arme)
    weaponSpec.ts   style d'attaque, prise, pose de repos de chaque arme ; intégration aux créatures
    pose.ts         calcul de la pose pour chaque animation (idle, walk, attack, cast, hit, …)
    figure.ts       orchestrateur : couches de la figurine humanoïde, prises à deux mains, arc
    bodies.ts       jambes / robe / queue de naga / volute spectrale, torses, bras, mains, épaulières
    heads.ts        les 20 HeadShape (humanoïde, bête, oiseau), yeux, étoiles d'étourdissement
    weapons.ts      les 26 WeaponShape
    extras.ts       les 16 Extra (couches back / body / front) et particules
    creatures.ts    quadrupède et oiseau
    glyphBuilder.ts mini-langage des icônes (fill/line/cut/hole/gem/shade)
    glyphs.ts       définitions des 117 icônes
    previewLooks.ts 66 combinaisons de démonstration (planche uniquement)
```

### Repère local d'une figurine
- Pieds en (0, 0), y vers le bas, la figurine regarde vers **+x** (le miroir `facing = -1` est
  appliqué par `drawUnit`).
- Une figurine standard mesure **100 unités** ; `drawUnit` met à l'échelle
  `k = 1,7 × size / 100 × look.scale × opts.scale`.
- Bras : angle mesuré depuis la verticale descendante (0 = pendant, π/2 = tendu vers l'avant,
  π = levé). Arme : rotation canvas (0 = pointe vers le haut, π/2 = vers l'avant).

### Ordre des couches (humanoïde)
1. extras `back` (aura, soleil, lune, ailes, engrenages, cristaux, cape, écharpe flottante, sac, queue,
   particules arrière) ;
2. jambes (ou robe, queue de serpent, volute) — non inclinées ;
3. buste incliné autour des hanches : bras lointain (+ seconde dague / main d'appui), torse,
   extras `body` (chaînes, écharpe, feuilles, épaulière lointaine) ;
4. traînée de coup, **tête** (+ étoiles d'étourdissement), arc tenu ;
5. bras proche + arme (+ main lointaine sur une arme à deux mains), extras `front`.

Les armes longues pointées vers le haut (bâton, lance, bannière, faux…) et les armes posées sur
l'épaule passent **derrière la tête** ; leurs ornements dépassent au-dessus.

## 3. Animations

| anim      | piloté par | rendu |
|-----------|------------|-------|
| `idle`    | `time`     | respiration, léger balancement, clignement, lévitation (volants), flammes |
| `walk`    | `time`     | foulée, rebond, inclinaison, balancement des bras, cape/écharpe au vent |
| `attack`  | `animT`    | élan (0 → ~0,25), **impact ≈ 0,35–0,4**, retour. Style selon l'arme : taille/arc (épée, marteau, faux…), estoc (lance, harpon, foret, bannière), double estoc (dagues), griffes, tension/décoche (arc), recul + flash de bouche (fusil, arbalète, canon), pointe de bâton / objet magique, lancer (chakram, fiole : l'arme disparaît pendant le vol), coup de bouclier, coup de fouet, coup de poing |
| `cast`    | `animT`    | arme brandie en avant, lueur accent, cercle runique au sol |
| `hit`     | `animT`    | recul, plissement des yeux (le flash blanc vient de `flash`) |
| `stunned` | `time`     | vacillement, yeux en spirale, étoiles qui tournent |
| `death`   | `animT`    | affaissement (0 → 0,4), dissolution trouée + éclats lumineux, fondu |
| `leap`    | `animT`    | accroupi, étirement, **arc vertical ajouté par drawUnit** (≈ 0,5 × size), ombre qui rétrécit |

`aimX/aimY` orientent la visée (angle vertical borné à ±0,75 rad). Les créatures mordent / bondissent,
les montures tirent avec recul, les oiseaux battent des ailes.

## 4. Intégration (moteur)

```ts
drawArenaBackground(ctx, cssW, cssH, time, mood);         // 1 drawImage + animations
drawHexTile(ctx, 0, 0, r, { owner, highlight, parity });   // bitmap en cache par état
drawUnit(ctx, look, { x, y, size: hexR, facing, time, anim, animT, team, star, ... });
drawIcon(ctx, 'burn', x, y, 18, '#ff8a3a');
portraitDataUrl(look, 96 * devicePixelRatio)               // <img width=96 height=96>
```
- **(x, y) = position au sol** (centre de l'hexagone). Pour `leap`, ne pas ajouter d'arc vertical :
  drawUnit le fait.
- `facing` : 1 = vers la droite. Choisissez-le selon la cible ; la visée verticale vient de `aimX/aimY`.
- `flash` (0..1) : décroissance rapide conseillée (~0,15 s). `alpha < 1`, `flash`, `death` et
  `silhouetteOnly` passent par un canvas hors-écran partagé (pas de superpositions translucides).
- Le décor lit `computeLayout`/`TILT` de `layout.ts` pour placer la plateforme sous le plateau et
  le quai sous la réserve : il suit automatiquement une modification de la mise en page.
  `clearArenaCaches()` libère les caches si besoin.
- `drawIcon` dessine dans un carré `size × size` centré ; bitmaps mis en cache par
  (clé, taille en pixels appareil, couleur). `iconDataUrl`/`portraitDataUrl` ont une taille naturelle
  égale à `size` : pour un écran HiDPI, demandez `size × devicePixelRatio` et fixez la taille CSS.
- Tous les `Look` sont valides : une arme sans sens pour une créature est **intégrée**
  (objet magique en lévitation, arme à feu/bannière/bouclier montés sur le dos ou en barde,
  lance/harpon/foret en corne frontale, griffes renforcées) ou **ignorée** proprement
  (voir `creatureMount` dans `art/weaponSpec.ts`).

## 5. Performance

Mesuré dans Chromium sans tête de ce dépôt (rastérisation **logicielle** SwiftShader, donc
pessimiste par rapport à un vrai GPU) via `sprite-preview.html?only=none&bench=1` :
- une figurine de taille 90 (≈ 150 px de haut) : ~0,25 à 1 ms selon le mode de rendu ;
- 20 figurines seules : ~3 à 23 ms par image selon que le canvas est accéléré ou non ;
- décor (prep / combat / final) : ~7 / 12 / 12 ms ; 65 cases : ~11 ms ;
- arène complète 1600×1000 (décor + 65 cases + 27 unités) : ~50 ms à 1× en logiciel.
`opacité < 1` sur **toutes** les unités ajoute ~50 % (hors-écran) : réservez-la aux fantômes.
Aucun `ctx.filter`, aucun `shadowBlur` par image (seulement lors de la mise en cache des icônes) ;
dégradés mis en cache par palette, lueurs et ombres pré-rendues, décor statique en un seul bitmap
(plafonné à ~4,2 Mpx).

## 6. Ajouter une forme

1. **Le type** vit dans `src/core/defs.ts` (à faire évoluer par l'équipe moteur).
2. **Corps** : ajoutez un gabarit dans `art/rig.ts` (`H({...})`), puis un torse dans `drawTorso`
   et, si besoin, un type de jambes dans `drawLegs` (`art/bodies.ts`). Les créatures non humanoïdes
   utilisent `kind: 'quad' | 'bird'` et un dessin dédié dans `art/creatures.ts`.
3. **Tête** : ajoutez les cas dans `behind` / `base` / `over` de `art/heads.ts`. Utilisez la géométrie
   `HG` (yeux, sommet) pour que la coiffe s'adapte aussi aux têtes de bêtes et d'oiseaux.
4. **Arme** : une entrée dans `WEAPONS` (`art/weaponSpec.ts` : style, prise, pose de repos, `tip`),
   un `case` dans `drawWeapon` (`art/weapons.ts`, repère : main à l'origine, arme vers -y), et sa
   règle d'intégration aux créatures dans `creatureMount`.
5. **Extra** : une fonction dans `art/extras.ts` appelée dans la bonne couche de `drawExtras`
   (`back` / `body` / `front`), positionnée via les ancrages `Anchors`.
6. **Icône** : une entrée dans `GLYPHS` (`art/glyphs.ts`), boîte 100 × 100 :
   `g.fill(svgPath)`, `g.line(path, épaisseur)`, `g.cut(...)` (gravure), `g.hole(...)` (creux),
   `g.gem(...)` (incrustation lumineuse), `g.tf(angle, cx, cy, échelle, dx, dy)` pour transformer.
   Le type `IconKey` s'enrichit automatiquement.
7. **Vérifier** : ajoutez une combinaison dans `art/previewLooks.ts`, lancez
   `npx vite --port 5199` puis ouvrez `/sprite-preview.html` :
   - `?only=grid|zoom|strip|arena|portraits|icons` (sections),
   - `?zoom=0,5,12` (grandes figurines), `?strip=3,8&stripbig=1` (décomposition des animations),
   - `?anim=attack&at=0.37&t=1.3` (fige l'animation et le temps), `?mood=final`, `?bench=1`.
   Règles d'or : contour INK, détails sautés sous `detail(rs)`, dégradés via `lin`/`rad`
   avec une **clé unique**, pas de texte dans les sprites, pas de filtre.

## 7. Limites connues
- Vue de 3/4 unique (miroir horizontal) : pas de vue de dos/face dédiée.
- Les bras sont des capsules sans coude ; les poses extrêmes restent stylisées.
- `walk`, `idle` et `stunned` suivent `time` (pas `animT`).
- Les créatures (quadrupède, oiseau) n'ont pas de prise d'arme : intégration ou abandon de l'arme.
- Le décor suppose la mise en page de `layout.ts` (plateau 7×8 incliné, réserve dessous).
