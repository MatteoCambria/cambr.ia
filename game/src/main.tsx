import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import '@fontsource/alegreya-sans/800.css';
import './ui/styles.css';
import { App } from './ui/App';
import { controller } from './app/controller';

window.addEventListener('error', (e) => console.error('[orrhea] erreur non gérée :', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[orrhea] promesse rejetée :', e.reason));

// Accès de diagnostic en développement uniquement (tests automatisés dans le navigateur)
if (import.meta.env.DEV) (window as unknown as { __orrhea: unknown }).__orrhea = { controller };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
