/**
 * Boucle d'animation unique (requestAnimationFrame). Le contrôleur avance son état,
 * puis les rendus enregistrés dessinent. La simulation de combat reste à pas fixe.
 */
import { controller } from './controller';

type FrameFn = (dt: number, now: number) => void;
const renderers = new Set<FrameFn>();
let running = false;
let last = 0;

export function onFrame(fn: FrameFn): () => void {
  renderers.add(fn);
  return () => renderers.delete(fn);
}

export function startLoop(): void {
  if (running) return;
  running = true;
  last = performance.now();
  const tick = (t: number) => {
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
    last = t;
    try {
      controller.update(dt);
      for (const fn of renderers) fn(dt, controller.now);
    } catch (e) {
      // une erreur de rendu ne doit jamais bloquer la boucle ni les calculs
      console.error('[boucle] erreur pendant une image', e);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
