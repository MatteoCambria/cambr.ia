# Cambr.IA — site vitrine

Site narratif et immersif de **Cambr.IA**, agence d'agents IA et d'automatisation pour les PME belges.

Il est 100 % statique et fonctionne hors ligne : polices et bibliothèques sont incluses dans le dépôt, sans étape de build.

## Lancer en local

```bash
python3 -m http.server 4173
# puis ouvrir http://localhost:4173
```

N'importe quel serveur statique convient (`npx serve`, l'extension Live Server de VS Code…).
Ouvrir `index.html` directement fonctionne aussi, mais un serveur local reproduit mieux la mise en ligne.

## Structure

```
index.html                 Page principale : prologue, 4 chapitres, épilogue
mentions-legales.html      Mentions légales et politique de confidentialité (à compléter)
assets/css/style.css       Jetons du design system et styles
assets/js/main.js          Narration au défilement, simulateur, démo d'agent, formulaire
assets/vendor/             GSAP 3.13 (ScrollTrigger, SplitText), Lenis 1.3
assets/fonts/              Space Grotesk, DM Sans, JetBrains Mono (woff2, licence OFL)
assets/img/                Favicon et image de partage (Open Graph)
design-system/cambr-ia/    Design system généré avec le skill UI/UX Pro Max (MASTER + surcharge de la page d'accueil)
```

## Avant la mise en ligne

- [ ] Vérifier l'adresse **contact@cambr-ia.be**, utilisée dans `index.html` (formulaire, contact, pied de page) et dans `mentions-legales.html`.
- [ ] Compléter les mentions légales : responsable, numéro BCE, TVA, siège et hébergeur (repérés par `[à compléter]`).
- [ ] Relire les textes : l'histoire de Sophie est volontairement présentée comme inventée, et la démo comme simulée.
- [ ] (Optionnel) Brancher un vrai service d'envoi de formulaire, voir ci-dessous.

## Formulaire de contact

Sans configuration, le formulaire valide les champs puis ouvre la messagerie du visiteur avec un e-mail déjà rédigé (`mailto:`).
Pour un envoi direct (Formspree, Getform, Basin, une fonction serverless…), renseignez l'URL du service dans l'attribut `data-endpoint` du formulaire :

```html
<form class="form" data-contact-form data-endpoint="https://formspree.io/f/xxxxxxx" …>
```

Le script envoie alors les données en `POST` (`FormData`) et affiche la confirmation. En cas d'échec, il propose l'e-mail en secours.

## Licences des ressources incluses

- GSAP 3.13 : licence standard sans frais de GreenSock (https://gsap.com/standard-license)
- Lenis : MIT
- Polices : SIL Open Font License 1.1
- Icônes : Lucide (ISC)
