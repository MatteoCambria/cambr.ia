import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { controller } from '../app/controller';
import { iconDataUrl, type IconKey } from '../render/icons';
import { portraitDataUrl } from '../render/portraits';
import { findConsumable, findItem, getChampion, getTrait } from '../core/content';
import type { Look } from '../core/defs';
import { COST_COLORS } from './text';

/** Abonne le composant aux changements du contrôleur. */
export function useController(): typeof controller {
  useSyncExternalStore(controller.subscribe, controller.getVersion);
  return controller;
}

export function Icon({ k, size = 20, color = '#ffe3a1', className }: { k: IconKey | string; size?: number; color?: string; className?: string }): JSX.Element {
  const src = safeIcon(k as IconKey, Math.round(size * 2), color);
  return <img className={className} src={src} width={size} height={size} alt="" draggable={false} />;
}

function safeIcon(k: IconKey, size: number, color: string): string {
  try {
    return iconDataUrl(k, size, color);
  } catch {
    return '';
  }
}

export function Portrait({ look, size = 96, className, frame = false }: { look: Look; size?: number; className?: string; frame?: boolean }): JSX.Element {
  let src = '';
  try {
    src = portraitDataUrl(look, size * 2, { frame });
  } catch {
    src = '';
  }
  return <img className={className} src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}

export function ChampionPortrait({ defId, className }: { defId: string; className?: string }): JSX.Element {
  return <Portrait look={getChampion(defId).look} size={128} className={className} />;
}

export function costColor(cost: number): string {
  return COST_COLORS[cost] ?? '#888';
}

export function TraitIcon({ id, size = 18 }: { id: string; size?: number }): JSX.Element {
  const t = getTrait(id);
  return <Icon k={t.icon} size={size} color={t.color} />;
}

export function ItemIcon({ id, size = 28 }: { id: string; size?: number }): JSX.Element {
  const it = findItem(id);
  const c = it ? null : findConsumable(id);
  return <Icon k={(it?.icon ?? c?.icon ?? 'key') as IconKey} size={size} color={it?.color ?? c?.color ?? '#fff'} />;
}

/** Info-bulle positionnée près de l'élément survolé (rendue dans un portail). */
export function Tip({ content, children, className, placement = 'top', as = 'div' }: { content: ReactNode; children: ReactNode; className?: string; placement?: 'top' | 'right' | 'left' | 'bottom'; as?: 'div' | 'span' }): JSX.Element {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLElement | null>(null);
  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      className={className}
      onPointerEnter={() => ref.current && setRect(ref.current.getBoundingClientRect())}
      onPointerLeave={() => setRect(null)}
    >
      {children}
      {rect && content ? <FloatingTip rect={rect} placement={placement}>{content}</FloatingTip> : null}
    </Tag>
  );
}

function FloatingTip({ rect, placement, children }: { rect: DOMRect; placement: string; children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = rect.left + rect.width / 2 - w / 2;
    let top = rect.top - h - 8;
    if (placement === 'right') {
      left = rect.right + 8;
      top = rect.top + rect.height / 2 - h / 2;
    } else if (placement === 'left') {
      left = rect.left - w - 8;
      top = rect.top + rect.height / 2 - h / 2;
    } else if (placement === 'bottom' || top < 6) {
      top = rect.bottom + 8;
    }
    left = Math.max(6, Math.min(window.innerWidth - w - 6, left));
    top = Math.max(6, Math.min(window.innerHeight - h - 6, top));
    setPos({ left, top });
  }, [rect, placement]);
  return createPortal(
    <div ref={ref} className="tip" style={{ left: pos.left, top: pos.top }}>
      {children}
    </div>,
    document.body,
  );
}

/** Info-bulle libre positionnée en coordonnées écran (survol du canvas). */
export function FloatAt({ x, y, children }: { x: number; y: number; children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setPos({ left: Math.max(6, Math.min(window.innerWidth - w - 6, x + 18)), top: Math.max(6, Math.min(window.innerHeight - h - 6, y - h - 12)) });
  }, [x, y]);
  return createPortal(
    <div ref={ref} className="tip" style={{ left: pos.left, top: pos.top }}>
      {children}
    </div>,
    document.body,
  );
}

export function Stars({ n }: { n: number }): JSX.Element {
  return <span className="star-row">{'★'.repeat(n)}</span>;
}

/**
 * Bouton d'action irréversible avec confirmation dans la page (les boîtes de dialogue
 * natives sont bloquées dans certains cadres d'affichage).
 */
export function ConfirmButton({ label, question, confirmLabel, onConfirm }: { label: string; question: string; confirmLabel: string; onConfirm: () => void }): JSX.Element {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button className="btn danger" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <div className="confirm-box" role="alertdialog" aria-label={question}>
      <p>{question}</p>
      <div className="row">
        <button className="btn danger" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
        <button className="btn ghost" onClick={() => setAsking(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}
