# Page d'accueil — surcharges du MASTER

> Ces règles **priment** sur `../MASTER.md` pour `index.html` (et les pages qui partagent sa feuille de style).
> Elles viennent de recherches complémentaires avec le skill UI/UX Pro Max (`--domain style`, `typography`, `color`, `gsap`, `landing`).

## Pourquoi des écarts avec le MASTER

Le MASTER a été généré avec `"AI agency dark immersive futuristic premium" --variance 6 --motion 9 --density 3`.
Il a proposé :

- **Style** Liquid Glass : pensé pour l'interface des plateformes Apple, pas pour un site narratif.
- **Palette** « Premium black + gold », mais en mode clair.
- **Typographies** Cormorant / Montserrat : un registre luxe et mode, trop éloigné d'une agence technique.

Les choix retenus :

| Sujet | MASTER | Retenu ici | Source |
|---|---|---|---|
| Structure | Scroll-Triggered Storytelling | **Inchangée** : prologue → constat → déclic → solution → impact → épilogue | `--domain landing` |
| Style | Liquid Glass | **Parallax Storytelling** + **Dark Mode (OLED)** + touches d'**Aurora UI** | `--domain style "dark immersive aurora cinematic"` |
| Palette | Noir + or, fond clair | Même famille noir + or, **déclinée en sombre** (voir ci-dessous) | `--domain color "AI agency dark premium gold"` |
| Typo | Cormorant / Montserrat | **Space Grotesk** (titres) + **DM Sans** (texte) + **JetBrains Mono** (étiquettes) | `--domain typography` : « Tech Startup » + trio mono de « SaaS Mobile Boutique » |
| Motion | Complexe (pin, scrub, SplitText) | Inchangé, avec **au plus 2 sections épinglées** | `--domain gsap` (Do/Don't) |

## Palette sombre (jetons CSS)

| Rôle | Valeur | Contraste sur le fond |
|---|---|---|
| `--color-background` | `#0C0A09` | — |
| `--color-card` | `#1C1917` (primary du MASTER) | — |
| `--color-foreground` | `#FAFAF9` | 18,9:1 |
| `--color-muted-foreground` | `#A8A29E` | 7,8:1 |
| `--color-accent` | `#E9B949` (or éclairci depuis `#CA8A04` pour le sombre) | 10,8:1 |
| `--color-on-accent` | `#0C0A09` | 10,8:1 sur l'or |
| `--color-ember` | `#FB923C` : chapitre 01 (le problème) | 8,7:1 |
| `--color-teal` | `#5EEAD4` : chapitre 02 (le déclic) | 13,4:1 |

`--color-subtle` (`#908984`, 5,7:1 sur le fond et 5:1 sur les cartes) sert au texte secondaire : mentions, placeholders, repère de chapitres. Il a été éclairci depuis `#78716C` (4,1:1, insuffisant).

**Stratégie de couleur par chapitre** (pattern *storytelling*) : la variable `--mood` passe de l'or (prologue) à l'ambre (problème), puis au turquoise (déclic) et de nouveau à l'or (solution, impact, épilogue). Elle teinte la barre de progression, les étiquettes de chapitre et le halo du pointeur.

## Règles de mouvement

- Lenis assure le défilement fluide. GSAP ScrollTrigger pilote les scènes. SplitText découpe uniquement les titres courts, puis est annulé une fois l'animation terminée.
- **Pins** : chapitre 01 (l'horloge de la soirée) et la méthode (parcours horizontal). Les deux sont réservés aux écrans ≥ 1024 px. En dessous, les sections s'empilent avec de simples révélations.
- `prefers-reduced-motion: reduce` : pas de Lenis, pas de pin, pas de scrub ni de découpage du texte. Tout est rendu dans son état final, la constellation est fixe et la démo s'affiche d'un coup.
- Sans JavaScript, tout le contenu reste visible : les états masqués dépendent des classes `.js.motion-ok`, et un filet de sécurité de 4 s ré-affiche tout.
- La constellation (canvas) se met en pause hors écran et quand l'onglet est masqué.

## Accessibilité (rappels appliqués)

- Lien d'évitement, focus visible (anneau or), cibles d'au moins 44 px.
- Formulaire : libellés visibles, erreurs sous chaque champ (`role="alert"`), focus sur le premier champ invalide, résumé du nombre d'erreurs.
- Menu mobile : `aria-expanded`, piège de focus, fermeture avec Échap, retour du focus sur le bouton.
- Icônes SVG (Lucide) en `aria-hidden`, aucun emoji utilisé comme icône.
