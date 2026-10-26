import { useEffect } from 'react';
import { controller } from '../../app/controller';
import { roundAt } from '../../config/rounds';
import { getChampion, getItem } from '../../core/content';
import { HUMAN_ID, carouselTurn } from '../../game/game';
import { BoardCanvas } from './BoardCanvas';
import { ItemsPanel, OpponentsPanel, ShopPanel, TopBar, TraitsPanel } from './panels';
import { ChampionPortrait, Icon, ItemIcon, Tip, costColor, useController } from '../common';
import { ChampionSheet, ChampionTip, ItemTip } from '../info';

export function GameScreen(): JSX.Element {
  const c = useController();
  useHotkeys();
  return (
    <div className={`game ${c.settings.reduceMotion ? 'reduce-motion' : ''}`}>
      <TopBar />
      <TraitsPanel />
      <div style={{ gridArea: 'board', position: 'relative', minHeight: 0, minWidth: 0 }}>
        <BoardCanvas />
        <BoardHud />
        {c.state?.phase === 'carousel' ? <Carousel /> : null}
        {c.banner ? (
          <div className={`banner ${c.banner.kind}`}>
            <h1>{c.banner.title}</h1>
            <p>{c.banner.subtitle}</p>
          </div>
        ) : null}
        <div className="toasts">
          {c.toasts.map((t) => (
            <div key={t.id} className={`toast t-${t.kind}`}>
              {t.text}
            </div>
          ))}
        </div>
      </div>
      <OpponentsPanel />
      <div className="bottombar">
        <ItemsPanel />
        <ShopPanel />
        <HelpPanel />
      </div>
      <Modals />
    </div>
  );
}

function BoardHud(): JSX.Element | null {
  const c = useController();
  const st = c.state;
  if (!st) return null;
  const r = roundAt(st.roundIndex);
  const live = c.live;
  return (
    <>
      <div className="board-hud">
        <div className="vs">
          {live ? (
            <>
              Contre <b style={{ color: '#ffb2a2' }}>{live.opponentName}</b>
              <small>{live.sim.overtime ? 'Embrasement !' : `${Math.floor(live.sim.time)} s`}</small>
            </>
          ) : c.scoutId !== null ? (
            <>
              Repérage : <b style={{ color: 'var(--cyan)' }}>{st.players[c.scoutId].name}</b> <small>dernier plateau observé</small>{' '}
              <button className="btn small ghost" onClick={() => c.scout(null)}>
                Fermer
              </button>
            </>
          ) : (
            <>
              {r.kind === 'pve' ? 'Rencontre neutre à venir' : r.kind === 'carousel' ? 'Carrousel' : 'Préparation'}
              <small>{r.label}</small>
            </>
          )}
        </div>
        {live ? (
          <div className="speed">
            {([1, 2, 3] as const).map((s) => (
              <button key={s} className={`btn small ${c.settings.combatSpeed === s ? 'gold' : 'ghost'}`} onClick={() => c.setSpeed(s)}>
                ×{s}
              </button>
            ))}
            <button className="btn small ghost" onClick={() => c.togglePause()}>
              <Icon k="pause" size={14} />
            </button>
          </div>
        ) : null}
      </div>
      {!live && st.phase === 'planning' ? (
        <button className="btn gold big ready-btn" onClick={() => c.ready()}>
          Combattre <span className="kbd">Espace</span>
        </button>
      ) : null}
      {!live && st.phase === 'planning' && c.me && c.me.board.length === 0 && c.scoutId === null ? (
        <div className="board-hint">Glissez vos champions de la réserve vers votre moitié du plateau ({c.me.level} au maximum)</div>
      ) : null}
    </>
  );
}

function Carousel(): JSX.Element | null {
  const c = useController();
  const st = c.state!;
  const car = st.carousel;
  if (!car) return null;
  const turn = carouselTurn(st);
  const mine = turn === HUMAN_ID;
  return (
    <div className="carousel">
      <h2>Carrousel des Échos</h2>
      <div className="order">
        Ordre (PV les plus bas d’abord) :
        {car.order.map((pid, i) => (
          <span key={pid} className={i === car.cursor ? 'on' : ''}>
            {st.players[pid].name}
            {i < car.order.length - 1 ? ' ›' : ''}
          </span>
        ))}
      </div>
      <div style={{ color: mine ? 'var(--gold-bright)' : 'var(--text-dim)', fontWeight: 800 }}>{mine ? `À vous de choisir (${Math.ceil(c.timer)} s)` : 'Les autres Archontes choisissent…'}</div>
      <div className="carousel-grid">
        {car.offers.map((o, i) => {
          const def = getChampion(o.defId);
          return (
            <div key={i} className={`offer ${o.takenBy !== null ? 'taken' : ''}`}>
              <Tip content={<div><ChampionTip defId={o.defId} /><div style={{ marginTop: 8 }}><ItemTip id={o.item} /></div></div>}>
                <div className="card" style={{ '--c': costColor(def.cost), minHeight: 170 } as React.CSSProperties} onClick={() => mine && c.pickCarousel(i)}>
                  <div className="card-art">
                    <ChampionPortrait defId={o.defId} />
                  </div>
                  <div className="offer-item">
                    <ItemIcon id={o.item} size={28} />
                  </div>
                  <div className="card-foot">
                    <span className="card-name">{def.name}</span>
                    <span className="card-cost">
                      <Icon k="gold" size={14} /> {def.cost}
                    </span>
                  </div>
                </div>
              </Tip>
              {o.takenBy !== null ? <div className="offer-by">{st.players[o.takenBy].name}</div> : null}
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ color: 'var(--text-dim)', fontSize: 14 }}>Chaque champion porte un objet ({getItem(car.offers[0]?.item ?? 'lame').kind === 'component' ? 'composant' : 'objet'}). Choisissez selon votre composition.</div>
    </div>
  );
}

function HelpPanel(): JSX.Element {
  return (
    <div className="panel" style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Raccourcis</div>
      <div><span className="kbd">D</span> actualiser · <span className="kbd">F</span> XP · <span className="kbd">L</span> verrou</div>
      <div><span className="kbd">E</span> vendre · <span className="kbd">W</span> plateau ⇄ réserve</div>
      <div><span className="kbd">1</span>–<span className="kbd">5</span> recruter · <span className="kbd">Espace</span> combattre</div>
      <div><span className="kbd">Échap</span> menu · clic droit : fiche</div>
    </div>
  );
}

function Modals(): JSX.Element | null {
  const c = useController();
  const m = c.modal;
  if (!m) return null;
  if (m.kind === 'pause') return <PauseMenu />;
  if (m.kind === 'unit') {
    const live = m.combatId !== undefined && c.live ? c.live.sim.unit(m.combatId) : null;
    const canSell = !!m.uid && !!c.me && (c.state?.phase === 'planning' || !!c.me.bench.find((b) => b?.uid === m.uid));
    return (
      <div className="modal-back" onClick={() => c.closeModal()}>
        <div className="modal panel filigree" onClick={(e) => e.stopPropagation()}>
          <ChampionSheet defId={m.defId} star={m.star} items={m.items} live={live} onSell={canSell ? () => (c.sell(m.uid!), c.closeModal()) : undefined} />
        </div>
      </div>
    );
  }
  return null;
}

function PauseMenu(): JSX.Element {
  const c = useController();
  return (
    <div className="modal-back" onClick={() => c.togglePause()}>
      <div className="modal panel filigree" style={{ width: 420, padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: 'var(--gold-bright)', marginBottom: 14, textAlign: 'center' }}>Pause</h2>
        <div className="menu-buttons">
          <button className="btn gold" onClick={() => c.togglePause()}>
            Reprendre
          </button>
          <VolumeSliders />
          <button className="btn" onClick={() => c.quitToMenu(true)}>
            Sauvegarder et quitter
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm('Abandonner la partie ? Elle comptera comme une défaite.')) {
                c.modal = null;
                c.abandon();
              }
            }}
          >
            Abandonner
          </button>
        </div>
        {c.live ? <div className="muted" style={{ marginTop: 10, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center' }}>Le combat est en pause. Quitter pendant un combat reprendra la manche au début du combat.</div> : null}
      </div>
    </div>
  );
}

export function VolumeSliders(): JSX.Element {
  const c = useController();
  const s = c.settings;
  const row = (label: string, key: 'master' | 'music' | 'sfx' | 'ui') => (
    <label className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => c.updateSettings({ [key]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 2px' }}>
      {row('Volume général', 'master')}
      {row('Musique', 'music')}
      {row('Effets', 'sfx')}
      {row('Interface', 'ui')}
      <label className="row" style={{ fontSize: 14 }}>
        <input type="checkbox" checked={s.muted} onChange={(e) => c.updateSettings({ muted: e.target.checked })} /> Couper le son
      </label>
    </div>
  );
}

function useHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = controller;
      if (c.screen !== 'game' || !c.state) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        if (c.modal && c.modal.kind !== 'pause') c.closeModal();
        else if (c.scoutId !== null) c.scout(null);
        else c.togglePause();
        e.preventDefault();
        return;
      }
      if (c.modal) return;
      if (k === 'd') c.reroll();
      else if (k === 'f') c.buyXp();
      else if (k === 'l') c.toggleLock();
      else if (k === ' ') {
        e.preventDefault();
        c.ready();
      } else if (k === 'e' && c.hoverUid) c.sell(c.hoverUid);
      else if (k === 'w' && c.hoverUid) c.quickMove(c.hoverUid);
      else if (['1', '2', '3', '4', '5'].includes(k)) c.buy(Number(k) - 1);
      else if (k === '+' || k === '=') c.setSpeed(Math.min(3, c.settings.combatSpeed + 1) as 1 | 2 | 3);
      else if (k === '-') c.setSpeed(Math.max(1, c.settings.combatSpeed - 1) as 1 | 2 | 3);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
