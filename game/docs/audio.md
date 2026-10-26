# Bande-son d'Orrhéa — Tactiques des Sphères

Toute la musique et tous les effets sonores du jeu sont **synthétisés hors-ligne** par un petit
moteur DSP en TypeScript pur (`tools/audio/`), sans échantillon externe ni dépendance npm, puis
encodés en MP3 par `ffmpeg`. Le rendu est déterministe (générateurs pseudo-aléatoires à graine
fixe) : relancer `npm run audio` reproduit les mêmes fichiers.

- 11 morceaux / 17 fichiers musicaux (≈ 11 min de musique), 49 effets sonores ;
- taille totale ≈ 11,6 Mo (`public/audio/`), crête vraie de tous les MP3 décodés < −1 dBFS ;
- gestionnaire navigateur : `src/audio/AudioManager.ts` (singleton `audio`).

## Direction artistique

**« Horlogerie céleste »** : un orchestre synthétique (cordes, cors, chœurs à formants, harpe,
pizzicati) habillé d'instruments-mécanismes — célesta, boîte à musique, cloches, glockenspiel,
orgue de barbarie — et d'une **horloge intégrée au rythme** (tic aigu / tac boisé sur les temps,
croches fantômes dans les morceaux rapides). Le monde est une horlogerie cosmique dont le
Cœur-Horloge est arrêté : la musique *tourne* (ostinatos en engrenage, arpèges en cycles de 3
contre 8) autour de ce cœur.

- **Motif de l'Horloge** (leitmotiv original) : quinte – quarte – quinte – octave en rythme pointé
  (la–sol–la–ré en ré dorien). Il est exposé dans le thème principal, revient augmenté dans le
  menu, transposé dans les préparations, en mineur héroïque dans la manche décisive, en ré majeur
  dans la victoire et se « désagrège » dans la défaite.
- **Modes** : ré dorien (couleur principale, accord de sol majeur caractéristique), fa lydien
  (même collection de notes : si naturel sur la pédale de fa = émerveillement), la éolien/dorien
  pour les préparations, ré mineur harmonique (do♯) pour les cadences épiques, si♭ emprunté pour
  les envolées (♭VI–♭VII–I dans la victoire).
- **Combat** : percussions de type taiko et timbales, ostinato de cordes en 3-3-2, cuivres ; jamais
  saturé ni agressif dans les aigus pour rester écoutable longtemps.
- **Factions** (signatures de lancement de compétence) : Zénith = cuivres radieux en majeur,
  Sélène = chœur « ou » en mineur et carillons argentés, Rouage = engrenages / vapeur / cuivre,
  Sylve = flûte boisée, feuilles, grondement, Abysse = bulles, bourdon et chant de baleine,
  Braise = embrasement et crépitements, Nomade = vent, luth et clochettes de caravane,
  Astral = carillon inversé, scintillement désaccordé, onde de sub.
- Toutes les mélodies, harmonies et arrangements sont **originaux** (écrits note à note dans
  `tools/audio/music/*.ts`), aucune reprise d'une œuvre existante.

## Architecture

```
tools/audio/
  dsp/core.ts        constantes (44,1 kHz), tampons stéréo, PRNG mulberry32, pan à puissance constante
  dsp/osc.ts         oscillateurs anti-repliement polyBLEP (scie, carré/impulsion, triangle intégré),
                     courbes de fréquence (vibrato retardé, glissando, dérive), partiels amortis
  dsp/env.ts         ADSR, décroissances exponentielles, points d'enveloppe
  dsp/filters.ts     biquads RBJ (LP/HP/BP/peak/shelf/notch/allpass), SVF TPT modulable, un-pôle
  dsp/noise.ts       bruits blanc, rose (Kellet), brun
  dsp/ks.ts          Karplus-Strong étendu (accord fractionnaire, pincement, étouffoir, « sitar »)
  dsp/fm.ts          FM 2-3 opérateurs avec enveloppes d'indice
  dsp/effects.ts     Freeverb (Schroeder/Moorer, petites pièces des SFX), réverbération FDN 8 lignes
                     (Hadamard, modulée, salles de la musique),
                     délai ping-pong, chorus, compresseur à genou doux, limiteur à anticipation,
                     saturation, traitement circulaire (boucles)
  dsp/analysis.ts    crête, RMS, sonie BS.1770-4 (LUFS), crête vraie ×4, indicateur de couture
  dsp/wav.ts         écriture / lecture WAV (flottant 32 bits)
  seq/theory.ts      notes ↔ MIDI, symboles d'accords, voicing par conduite des voix, modes
  seq/sequencer.ts   notation des mélodies (vérifie chaque mesure), grilles d'accords, générateurs
                     de nappes / basses / arpèges / rythmes, transformations
  instruments.ts     célesta, boîte à musique, glockenspiel, cloches, carillon, marimba, harpe,
                     pizzicati, basse pincée, luth, cordes (nappe, violons, violoncelles, contrebasses,
                     spiccato, trémolo), chœurs à formants (a/o/ou), cors, cuivres, tuba, flûte,
                     orgue de barbarie, nappes, sub, taikos, timbales, grosse caisse, tambour sur
                     cadre, shaker, charleston, cymbales, montée, tam-tam, tic / tac, souffle
  engine.ts          moteur de rendu : pistes → stems → réverbération/délai → repli des boucles →
                     mastering (EQ, compression par stem, équilibrage des niveaux d'intensité,
                     limiteur lié sur toutes les combinaisons de stems)
  music/*.ts         compositions (common, mainTheme, menu, prep, combat, finale, event, ambience)
  sfx/kit.ts         briques de synthèse d'effets (souffles, impacts, clics, cloches FM, éclats…)
  sfx/library.ts     les 49 recettes de SFX (niveau, bus, variation, polyphonie, anti-spam)
  api.ts             renderSong / renderSfx / loopFile (utilisé par render.ts et les tests)
  render.ts          rendu parallèle, encodage MP3, vérification ffprobe/EBU R128, manifeste
```

### Boucles sans couture

1. Chaque stem est rendu sur *longueur de boucle + queue* (réverbération, relâchements) ; la queue
   est **repliée** (additionnée) sur le début : c'est exactement ce qu'on entend en régime de
   boucle. Les anacrouses (notes à t < 0) sont jouées en fin de boucle.
2. Les traitements non linéaires ou à mémoire du mastering (EQ, compresseur, limiteur) sont
   appliqués **circulairement** (amorcés par la fin de la boucle).
3. Les couches continues de l'ambiance (vent, bourdon) sont générées strictement périodiques
   (bruit bouclé par fondu à puissance constante, fréquences arrondies à un nombre entier de
   cycles par boucle).
4. Le fichier MP3 contient la boucle **suivie de ses 0,25 premières secondes** ; le manifeste donne
   `loopStart = 0,1 s` et `loopEnd = 0,1 s + durée`. Ainsi le point de bouclage tombe dans une zone
   de contenu identique quel que soit le délai d'encodeur MP3 retiré (ou non) par le navigateur.
   Vérifié sur les MP3 décodés par ffmpeg : aucun saut anormal au point de bouclage.

L'indicateur `couture` affiché par `render.ts` (saut au bouclage / 99,9e centile des écarts entre
échantillons consécutifs) est < 0,3 pour toutes les boucles (≤ 1 = aucune discontinuité anormale).

### Stems et intensité

`prep`/`prep2` : `base` (intensité ≥ 0) + `layer` (≥ 1). `combat`/`combat2` : `base` (≥ 0),
`drive` (≥ 1), `perc` (≥ 2). Les stems d'un morceau ont exactement la même durée et le même tempo.
Le mastering **résout le gain de chaque stem** pour que chaque niveau cumulé atteigne une sonie
cible (préparation −18,5 / −16,5 LUFS ; combat −17,5 / −16 / −15 LUFS), comprime chaque stem avec
son propre détecteur (un stem joué seul ne « pompe » jamais au rythme d'un stem muet) puis applique
un **limiteur lié** calculé sur l'enveloppe de crête de *toutes* les combinaisons cumulées : aucune
combinaison ne dépasse −1,5 dBTP.

### Niveaux

Sonie intégrée (BS.1770) des pistes principales entre −15 et −17 LUFS (menu et défaite plus
calmes, manche décisive et victoire plus présentes), ambiance à −24 LUFS (gain conseillé 0,8 :
elle se glisse sous les menus). Effets normalisés sur leur sonie maximale (fenêtre 200 ms) selon
leur importance : survol −28, clics −22, attaques/impacts −19/−20, sorts −16, critiques et
explosions −12/−14, fanfares −12 LUFS ; plafond de crête vraie −1,5 dBFS. Encodage : 128 kb/s
(morceaux), 112 kb/s (stems, ambiance), SFX 96 kb/s mono / 128 kb/s stéréo.

## Pistes musicales

| Cue | Morceau (id) | Titre | Tonalité | Tempo | Durée | Boucle | Fichiers / stems (intensité min.) | Sonie (LUFS) | Taille |
|---|---|---|---|---|---|---|---|---|---|
| `mainTheme` | `mainTheme` | L'Horloge des Sphères | ré dorien | 88 bpm, 32 mes. 4/4 | 87.27 s | oui | `mainTheme` | -16.0 | 1369 Ko |
| `menu` | `menu` | Salle des Cartes Célestes | fa lydien / ré dorien | 72 bpm, 16 mes. 4/4 | 53.33 s | oui | `menu` | -17.0 | 838 Ko |
| `prep` | `prep` | L'Atelier des Rouages | la dorien | 96 bpm, 20 mes. 4/4 | 50.00 s | oui | `prep_base` (0), `prep_layer` (1) | -18.5 / -16.5 | 1376 Ko |
| `prep` | `prep2` | Cartographie des Orbites | fa lydien / ré dorien (ternaire) | 100 bpm, 20 mes. 4/4 | 48.00 s | oui | `prep2_base` (0), `prep2_layer` (1) | -18.5 / -16.5 | 1321 Ko |
| `combat` | `combat` | La Convergence | ré mineur | 128 bpm, 24 mes. 4/4 | 45.00 s | oui | `combat_base` (0), `combat_drive` (1), `combat_perc` (2) | -17.6 / -16.1 / -15.1 | 1859 Ko |
| `combat` | `combat2` | Éclipse des Rouages | la mineur (touches phrygiennes) | 132 bpm, 24 mes. 4/4 | 43.64 s | oui | `combat2_base` (0), `combat2_drive` (1), `combat2_perc` (2) | -17.7 / -16.1 / -15.2 | 1803 Ko |
| `decisive` | `decisive` | Le Cœur-Horloge s'éveille | ré mineur | 108 bpm, 24 mes. 4/4 | 53.33 s | oui | `decisive` | -15.0 | 838 Ko |
| `victory` | `victory` | Aube sur les Sphères | ré majeur | 104 bpm, 6 mes. 4/4 | 17.96 s | non | `victory` | -15.0 | 282 Ko |
| `defeat` | `defeat` | Le Ressort s'épuise | ré mineur | 72 → 50 bpm, 4 mes. 4/4 | 18.77 s | non | `defeat` | -17.0 | 294 Ko |
| `event` | `event` | Le Manège des Échos | fa lydien (valse 3/4) | 144 bpm, 32 mes. 3/4 | 40.00 s | oui | `event` | -16.0 | 630 Ko |
| `ambience` | `ambience` | Le Souffle de l'Orrery | ré (bourdon), pentatonique dorienne | 64 bpm, 12 mes. 4/4 | 45.00 s | oui | `ambience` | -24.0 | 620 Ko |

Sonie : par niveau d'intensité cumulé pour les morceaux à stems. La défaite est écrite à 72 bpm
avec un ritardando jusqu'à 50 bpm (la boîte à musique ralentit comme un ressort qui se détend,
le tic-tac s'arrête et la dernière note baisse d'un tiers de ton).

Structure des morceaux principaux :

- **mainTheme** — Introduction (engrenages de célesta, tic-tac) → A : thème au célesta, harpe,
  pizzicati → B (fa lydien) : violons, chœur « ou », harpe en doubles croches → A' tutti : cors et
  violons à l'octave, chœur « a », taikos, timbales → coda à la boîte à musique qui ramène au début.
- **menu** — le motif augmenté à la flûte puis à la boîte à musique, nappe de verre, harpe.
- **prep** — pizzicati en engrenage (base) ; flûte, marimba, violoncelles, shaker (couche).
- **prep2** — harpe en triolets, nappe chaude, basse pincée (base) ; boîte à musique, pizzicati,
  chœur « o » (couche).
- **combat / combat2** — ostinato 3-3-2 ou basse syncopée + pulsation (base) ; cors, violons,
  chœur, cuivres staccato (drive) ; taikos, shime, timbales, cymbales (perc).
- **decisive** — le motif de l'Horloge en mineur au chœur et aux cors, violons en envolée, engrenages
  de célesta qui s'emballent, tam-tam.
- **event** — valse du carrousel : orgue de barbarie, boîte à musique, oum-pa-pa de tuba et
  pizzicati.
- **ambience** — vent, sifflement, bourdon ré-la, grande horloge lointaine, carillons à vent,
  passages de sphères.

## Effets sonores

Bus « ui » : `uiClick`, `uiHover`, `uiOpen`, `uiClose`, `uiError`, `timerTick`, `gold`, `buy`,
`sell`, `reroll`, `lock` ; tous les autres passent par le bus « sfx ». La variation de hauteur
aléatoire, la limite de voix et l'anti-répétition sont appliquées au moment de la lecture.

| Id | Bus | Durée (MP3) | Canaux | Var. hauteur | Voix max | Anti-spam | Description |
|---|---|---|---|---|---|---|---|
| `uiClick` | ui | 0.078 s | mono | ±25 ct | 3 | 30 ms | Clic d'horlogerie net (échappement). |
| `uiHover` | ui | 0.104 s | mono | ±40 ct | 2 | 45 ms | Tintement très léger de verre. |
| `uiOpen` | ui | 0.888 s | mono | ±0 ct | 2 | 80 ms | Deux notes de célesta montantes et un souffle ascendant. |
| `uiClose` | ui | 0.758 s | mono | ±0 ct | 2 | 80 ms | Deux notes descendantes et un souffle qui retombe. |
| `uiError` | ui | 0.287 s | mono | ±0 ct | 1 | 200 ms | Double « bonk » grave en seconde mineure. |
| `timerTick` | ui | 0.078 s | mono | ±0 ct | 2 | 90 ms | Tic du compte à rebours. |
| `gold` | ui | 0.314 s | mono | ±70 ct | 4 | 45 ms | Tintement de pièce d'or (cloche FM). |
| `buy` | ui | 1.045 s | mono | ±0 ct | 2 | 60 ms | Arpège majeur pincé + pièce. |
| `sell` | ui | 1.019 s | mono | ±0 ct | 2 | 60 ms | Deux notes descendantes, pièces qui tombent. |
| `reroll` | ui | 0.940 s | mono | ±30 ct | 2 | 120 ms | Engrenages qui tournent (cliquet accélérant) et souffle de cartes. |
| `levelUp` | sfx | 1.855 s | stéréo | ±0 ct | 1 | 400 ms | Arpège ascendant célesta + harpe, cloche et scintillement. |
| `starUp2` | sfx | 1.306 s | mono | ±0 ct | 2 | 250 ms | Accord de carillon brillant égrené, montée scintillante. |
| `starUp3` | sfx | 2.429 s | stéréo | ±0 ct | 1 | 400 ms | Cloche, chœur en ré majeur, cascade de scintillements, coup grave. |
| `traitActivate` | sfx | 1.149 s | mono | ±0 ct | 2 | 150 ms | Verrouillage magique : clic, cloche FM, nappe montante, scintillement. |
| `itemEquip` | sfx | 0.601 s | mono | ±60 ct | 3 | 60 ms | Cliquetis métallique et petit éclat. |
| `itemCombine` | sfx | 1.123 s | mono | ±0 ct | 2 | 200 ms | Forge : deux coups d'enclume puis fusion magique ascendante. |
| `lock` | ui | 0.183 s | mono | ±0 ct | 2 | 80 ms | Loquet : « clac » grave puis « tic » aigu. |
| `attackMelee` | sfx | 0.235 s | mono | ±120 ct | 6 (groupe attack) | 25 ms | Fendant : souffle rapide et léger « shing ». |
| `attackRanged` | sfx | 0.209 s | mono | ±120 ct | 6 (groupe attack) | 25 ms | Corde qui claque et trait qui file. |
| `attackMagic` | sfx | 0.314 s | mono | ±100 ct | 6 (groupe attack) | 25 ms | Éclair arcanique : ton FM qui plonge, étincelles. |
| `impactPhysical` | sfx | 0.209 s | mono | ±140 ct | 6 (groupe impact) | 25 ms | Coup sourd : sinus qui chute, bruit étouffé, craquement. |
| `impactMagic` | sfx | 0.261 s | mono | ±120 ct | 6 (groupe impact) | 25 ms | Impact cristallin : cloche FM brève, souffle aigu, coup léger. |
| `impactTrue` | sfx | 0.261 s | mono | ±100 ct | 6 (groupe impact) | 25 ms | Percée pure : ton aigu modulé en anneau, éclat blanc. |
| `crit` | sfx | 0.575 s | mono | ±80 ct | 3 (groupe impact) | 60 ms | Coup critique : double impact lourd, anneau métallique, sub. |
| `heal` | sfx | 1.280 s | mono | ±40 ct | 4 | 80 ms | Arpège de verre montant (fa lydien), souffle lumineux. |
| `shield` | sfx | 1.097 s | mono | ±40 ct | 4 | 80 ms | Bourdon de verre qui enfle et tinte (bouclier). |
| `shieldBreak` | sfx | 0.679 s | mono | ±60 ct | 3 | 60 ms | Verre qui vole en éclats, coup sourd. |
| `stun` | sfx | 1.019 s | mono | ±50 ct | 3 | 80 ms | Étoiles qui tournoient : sifflets vibrés, carillon. |
| `explosion` | sfx | 1.019 s | stéréo | ±80 ct | 3 | 60 ms | Explosion : souffle filtré qui se referme, sub, crépitements. |
| `summon` | sfx | 1.489 s | mono | ±40 ct | 2 | 120 ms | Tourbillon montant, chœur qui enfle, cloche. |
| `death` | sfx | 1.045 s | mono | ±60 ct | 4 | 50 ms | Ton qui retombe et se dissipe. |
| `revive` | sfx | 1.750 s | mono | ±0 ct | 2 | 150 ms | Montée inversée puis accord lumineux de ré majeur. |
| `execute` | sfx | 1.385 s | mono | ±40 ct | 2 | 120 ms | Exécution : tranchant lourd, boum grave, gong bref. |
| `castZenith` | sfx | 1.097 s | mono | ±30 ct | 3 (groupe cast) | 100 ms | Zénith (chevaliers solaires) : accord de cuivres radieux, rayon aigu, éclats dorés. |
| `castSelene` | sfx | 1.776 s | mono | ±30 ct | 3 (groupe cast) | 100 ms | Sélène (mystiques lunaires) : chœur « ou » en mi mineur, carillons argentés descendants. |
| `castRouage` | sfx | 0.862 s | mono | ±40 ct | 3 (groupe cast) | 100 ms | Rouage (ingénieurs horlogers) : engrenages, jet de vapeur, choc de cuivre, ressort. |
| `castSylve` | sfx | 0.993 s | mono | ±40 ct | 3 (groupe cast) | 100 ms | Sylve (forêt ancienne) : appel de flûte boisée, bruissement de feuilles, grondement de bête. |
| `castAbysse` | sfx | 1.593 s | mono | ±40 ct | 3 (groupe cast) | 100 ms | Abysse (culte des profondeurs) : bulles, bourdon grave ondulant, chant de baleine. |
| `castBraise` | sfx | 1.149 s | mono | ±40 ct | 3 (groupe cast) | 100 ms | Braise (revenants de feu) : embrasement soufflé, ton saturé qui monte, crépitements. |
| `castNomade` | sfx | 1.228 s | mono | ±40 ct | 3 (groupe cast) | 100 ms | Nomade (caravanes célestes) : rafale de vent, luth pincé, clochettes de caravane. |
| `castAstral` | sfx | 1.855 s | mono | ±30 ct | 3 (groupe cast) | 100 ms | Astral (entités du vide) : carillon inversé, scintillement désaccordé, onde de sub. |
| `roundStart` | sfx | 1.907 s | mono | ±0 ct | 1 | 400 ms | Deux tics d'horloge puis la cloche de la Convergence. |
| `combatStart` | sfx | 1.280 s | stéréo | ±0 ct | 1 | 400 ms | Coup de taiko, accord de cuivres en ré mineur, cymbale. |
| `roundWin` | sfx | 1.254 s | mono | ±0 ct | 1 | 400 ms | Motif bref et lumineux en ré majeur (célesta + harpe). |
| `roundLoss` | sfx | 1.750 s | mono | ±0 ct | 1 | 400 ms | Motif descendant en ré mineur, boîte à musique et violoncelle. |
| `overtime` | sfx | 2.273 s | mono | ±0 ct | 1 | 600 ms | Tic-tac qui s’emballe, montée tendue, coup de gong. |
| `eliminated` | sfx | 3.030 s | stéréo | ±0 ct | 1 | 1000 ms | Élimination : gong grave, chœur sombre, roulement de timbales qui descend. |
| `carouselPick` | sfx | 1.019 s | mono | ±30 ct | 2 | 150 ms | Deux notes de boîte à musique et un souffle doux (manège). |
| `victoryFanfare` | sfx | 3.422 s | stéréo | ±0 ct | 1 | 2000 ms | Fanfare : motif de l'Horloge aux cuivres puis accord de ré majeur. |

## Manifeste (`public/audio/manifest.json`)

```jsonc
{
  "version": 1, "generator": "tools/audio/render.ts", "sampleRate": 44100, "loopPadding": 0.25,
  "music": [{
    "id": "combat", "cue": "combat", "variation": 1, "title": "La Convergence",
    "description": "Combat — ré mineur, ostinato 3-3-2, cors ; stems base + drive + perc.",
    "file": "music/combat_base.mp3", "duration": 45, "loop": true,
    "loopStart": 0.1, "loopEnd": 45.1, "bpm": 128, "beatsPerBar": 4, "bars": 24,
    "gain": 1, "lufs": -15.11, "intensityLufs": [-17.61, -16.1, -15.11],
    "stems": [{ "id": "combat_base", "role": "base", "file": "music/combat_base.mp3",
                "minIntensity": 0, "duration": 45, "fileDuration": 45.2963, "bytes": 634513,
                "lufs": -18, "truePeakDb": -2.1 } /* , drive, perc */]
  } /* , … */],
  "sfx": [{ "id": "crit", "file": "sfx/crit.mp3", "duration": 0.3657, "bytes": 4702, "bus": "sfx",
            "channels": 1, "gain": 1, "pitchVar": 80, "maxVoices": 3, "throttleMs": 60,
            "group": "impact", "loudness": -14.68, "peakDb": -1.9,
            "description": "Coup critique : double impact lourd, anneau métallique, sub." } /* , … */]
}
```

`lufs`/`truePeakDb` des stems et `peakDb` des SFX sont **mesurés sur les MP3 décodés** (filtre
`ebur128` et `volumedetect` de ffmpeg). `gain` est le gain de lecture conseillé (linéaire).

## Intégration dans le jeu

```ts
import { audio } from './audio/AudioManager';

// Au démarrage (sans attendre) : manifeste + décodage des SFX et de la musique d'accueil.
void audio.preload();

// Au premier geste utilisateur (clic, touche) — politique d'autoplay des navigateurs :
window.addEventListener('pointerdown', () => void audio.unlock(), { once: true });

// Écran titre
audio.playMusic('mainTheme');
audio.playAmbience(true);          // ambiance sous les menus (bus musique)

// Options (gains linéaires 0..1 ; valeurs par défaut identiques à src/save/save.ts)
audio.setVolumes({ master: 0.8, music: 0.6, sfx: 0.75, ui: 0.7 });
audio.setMuted(false);
const v = audio.getVolumes();      // à sauvegarder par le jeu si souhaité

// Boucle de partie
audio.playMusic('prep');            // alterne prep / prep2 à chaque nouvelle phase
audio.setIntensity(0);              // 1 = ajoute la couche (fin de timer, achats importants)
audio.playSfx('roundStart');
audio.playMusic('combat', { fade: 0.8 });   // alterne combat / combat2
audio.playSfx('combatStart');
audio.setIntensity(1);              // quand le combat s'engage vraiment
audio.setIntensity(2);              // moments critiques : dernières unités, ulti, retournement
audio.playSfx('impactPhysical', { pan: unitX / boardWidth * 2 - 1, volume: 0.8 });
audio.playSfx('castSelene');
audio.playMusic('decisive');        // manche finale / survie en jeu
audio.playMusic('victory');         // ou 'defeat' (jingles non bouclés)
audio.playMusic('event');           // carrousel
audio.stopMusic(1.5);
```

Comportement :

- `playMusic` fait un **fondu enchaîné à puissance constante** (1,2 s par défaut) et ne relance pas
  un cue déjà en cours. Les stems démarrent au même instant d'horloge (`start(when)` identique) et
  bouclent sur les mêmes points : ils restent synchrones ; `setIntensity` ne fait que fondre leurs
  gains (montée ≈ 1 s, descente ≈ 2 s). L'intensité est conservée d'un morceau à l'autre.
- Les jingles `victory` / `defeat` se terminent seuls ; relancer `playMusic` ensuite (ex. menu).
- La variation de hauteur aléatoire est **déjà appliquée** par le gestionnaire (`pitchVar` du
  manifeste, ±25 à ±140 cents selon l'effet) ; un `detune` aléatoire ajouté côté jeu s'y cumule.
- `playSfx` : ignoré tant que `ready` est faux ; anti-répétition par effet (`throttleMs`, réglable
  par appel), limites de voix par effet, par groupe (attaques 8, impacts 8, sorts 4) et globale
  (32, la voix la plus ancienne est coupée en 60 ms) ; `detune` en cents s'ajoute à la variation
  aléatoire du manifeste ; `pan` −1..1 ; `volume` 0..4.
- Robustesse : pas de Web Audio, manifeste ou fichier manquant, décodage refusé → `console.warn`
  préfixé `[audio]` et silence ; aucune méthode publique ne lève d'exception. À l'import, rien
  n'est créé (compatible tests Node / SSR). Le contexte est suspendu quand l'onglet est masqué.
- Mémoire : les SFX sont décodés au préchargement ; la musique est décodée à la demande (titre,
  menu et ambiance au préchargement, le morceau suivant probable est pré-décodé : prep → combat,
  combat → prep, decisive → victory/defeat), cache LRU de ≈ 200 Mo de PCM, octets MP3 conservés
  pour redécoder sans retélécharger. Les chemins sont relatifs (`audio/…`, base Vite `./`).
- Sécurité : écrêteur doux (WaveShaper) en sortie, linéaire jusqu'à −2 dBFS, contre l'empilement
  d'effets.

## Régénérer

```bash
npm run audio                                  # tout (≈ 1 min sur 4 cœurs)
npx tsx tools/audio/render.ts --only=combat,uiClick   # morceaux, cues ou SFX précis ; "music" / "sfx"
npx tsx tools/audio/render.ts --jobs=2 --keep-wav=/tmp/wav --no-verify
```

Le script affiche pour chaque fichier : durée, taille, sonie et crête vraie (rendu et MP3 décodé),
indicateur de couture des boucles, puis la taille totale. `ffmpeg`/`ffprobe` (libmp3lame) doivent
être disponibles. Les WAV intermédiaires sont écrits dans le dossier temporaire du système puis
supprimés.

Pour modifier une musique : éditer `tools/audio/music/<morceau>.ts` (mélodies en notation compacte
`"A4:1.5 G4:.5 A4:1 D5 |"`, grilles `"Dm | G/D | Bb C | A"`), puis
`npx tsx tools/audio/render.ts --only=<id>`. Une mesure incomplète lève une erreur explicite.

## Tests

```bash
npx vitest run tests/audio.test.ts tests/audio-manager.test.ts
```

- `tests/audio.test.ts` : primitives DSP (filtre, polyBLEP, accord de Karplus-Strong, sonomètre
  BS.1770 calibré, limiteur), les 49 SFX rendus (non-silence, crête vraie ≤ −1,5 dBFS, durée,
  niveau, bus), un extrait de 3 s de chaque morceau et de chaque stem (non-silence, absence
  d'écrêtage sur toutes les combinaisons d'intensité, stems de même longueur), une boucle courte
  rendue en entier (couture < 1), cohérence des identifiants, présence et taille des fichiers du
  manifeste, durées imposées, taille totale < 14 Mo.
- `tests/audio-manager.test.ts` : le gestionnaire contre une fausse Web Audio API — stems démarrés
  au même instant et bouclés sur les mêmes points, intensité, alternance des variations, non-relance
  d'un cue en cours, routage ui/sfx, anti-spam et polyphonie, ambiance indépendante, robustesse sans
  `window` et avec fichiers introuvables.

## Limites connues

- Synthèse 100 % algorithmique : cordes, cuivres et chœurs restent typés « orchestre synthétique »
  (c'est la direction voulue), ils ne remplacent pas un enregistrement réel.
- Le bouclage repose sur `loopStart`/`loopEnd` de `AudioBufferSourceNode` ; un navigateur qui
  ne retirerait pas le délai d'encodeur MP3 décale le contenu de ≈ 25 ms, absorbé par l'amorce de
  0,25 s (aucune coupure), mais le tout premier départ contient alors 25 ms de silence.
- Au premier lancement d'un cue non pré-décodé, le décodage peut retarder le départ de quelques
  centaines de millisecondes (le fondu enchaîné démarre quand le décodage est fini).
- La mémoire décodée de toute la musique (≈ 300 Mo de PCM à 48 kHz) dépasse le budget du cache :
  sur un appareil très contraint, réduire `MUSIC_CACHE_BUDGET` dans `AudioManager.ts`.
- Les volumes ne sont pas persistés par le gestionnaire (au jeu de les sauvegarder avec
  `getVolumes()`).
