import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { controller } from '../../app/controller';
import { ECONOMY, MAX_LEVEL, XP_TO_NEXT } from '../../config/balance';
import { SCHEDULE, roundAt } from '../../config/rounds';
import { computeTraits } from '../../combat/setup';
import { combine, findItem, getChampion, getTrait, isComponent } from '../../core/content';
import { computeIncome, interestFor, nextInterestThreshold } from '../../economy/economy';
import { HUMAN_ID } from '../../game/game';
import { previewEquip, findUnit } from '../../game/actions';
import { shopOdds } from '../../shop/shop';
import { ownedCopies } from '../../ai/evaluate';
import { ChampionPortrait, Icon, ItemIcon, Tip, TraitIcon, costColor, useController } from '../common';
import { ChampionTip, ItemTip, TraitTip } from '../info';
import { boardBus } from './boardBus';

// ── Barre supérieure ────────────────────────────────────────────────────────
export function TopBar(): JSX.Element | null {
  const c = useController();
  const st = c.state;
  if (!st) return null;
  const r = roundAt(st.roundIndex);
  const stageRounds = SCHEDULE.filter((x) => x.stage === r.stage);
  const me = st.players[HUMAN_ID];
  const phaseLabel = c.live ? 'Combat' : st.phase === 'carousel' ? 'Carrousel' : 'Préparation';
  const t = c.live ? null : c.timer;
  const resultFor = (idx: number) => {
    const rec = st.history.find((h) => h.round === idx);
    const res = rec?.results.find((x) => x.playerId === HUMAN_ID);
    return res ? (res.won ? 'win' : 'loss') : '';
  };
  return (
    <div className="topbar panel">
      <span className="stage-label">Étape {r.stage}</span>
      <div className="round-track">
        {stageRounds.map((x) => (
          <Tip key={x.index} content={<div>{x.label} · {x.kind === 'pvp' ? 'Combat contre un Archonte' : x.kind === 'pve' ? 'Rencontre neutre (butin)' : 'Carrousel'}</div>} placement="bottom">
            <div className={`round-pip ${x.index < st.roundIndex ? 'done ' + resultFor(x.index) : ''} ${x.index === st.roundIndex ? 'current' : ''}`}>
              {x.kind === 'carousel' ? <Icon k="dice" size={14} color={x.index === st.roundIndex ? '#20160a' : '#a8a293'} /> : x.kind === 'pve' ? <Icon k="skull-round" size={14} color={x.index === st.roundIndex ? '#20160a' : '#a8a293'} /> : x.round}
            </div>
          </Tip>
        ))}
      </div>
      <span className={`phase-chip ${c.live ? 'combat' : ''}`}>{phaseLabel} · {r.label}</span>
      {t !== null && t !== Infinity ? <span className={`timer ${t < 5.5 ? 'urgent' : ''}`}>{Math.max(0, Math.ceil(t))}</span> : null}
      <div className="spacer" />
      <Tip content={<div>Points de vie de votre Archonte. À 0, vous êtes éliminé.</div>} placement="bottom">
        <span className="hp-chip">
          <Icon k="hp" size={22} color="#ff8a76" /> {me.hp}
        </span>
      </Tip>
      <Tip content={<div>Série : {me.streak > 0 ? `${me.streak} victoire(s)` : me.streak < 0 ? `${-me.streak} défaite(s)` : 'aucune'} · bonus {ECONOMY.streakBonus(me.streak)} or par manche</div>} placement="bottom">
        <span className="hp-chip" style={{ fontSize: 15, color: me.streak > 0 ? '#ffb35c' : me.streak < 0 ? '#8fb8ff' : 'var(--text-dim)' }}>
          {me.streak > 0 ? '🔥' : me.streak < 0 ? '❄' : '·'} {Math.abs(me.streak)}
        </span>
      </Tip>
      <button className="btn small ghost" onClick={() => c.togglePause()} title="Menu (Échap)">
        <Icon k="settings" size={16} /> Menu
      </button>
    </div>
  );
}

// ── Synergies ──────────────────────────────────────────────────────────────
export function TraitsPanel(): JSX.Element | null {
  const c = useController();
  const me = c.me;
  if (!me) return null;
  const traits = computeTraits(me.board);
  // synergies qui progresseraient avec une unité de la boutique ou de la réserve
  const potential = new Set<string>();
  const onBoard = new Set(me.board.map((b) => b.defId));
  for (const id of [...me.shop.filter(Boolean), ...me.bench.filter(Boolean).map((u) => u!.defId)] as string[]) {
    if (onBoard.has(id)) continue;
    for (const t of getChampion(id).traits) potential.add(t);
  }
  return (
    <div className="traits panel">
      <div className="panel-title">
        Synergies <span style={{ color: 'var(--text-dim)', letterSpacing: 0 }}>{traits.filter((t) => t.level > 0).length} actives</span>
      </div>
      <div className="trait-list scroll">
        {traits.length === 0 ? <div className="muted" style={{ padding: 10, fontSize: 14, color: 'var(--text-dim)' }}>Placez des champions sur le plateau pour activer des synergies.</div> : null}
        {traits.map((t) => {
          const def = getTrait(t.id);
          const next = t.thresholds.find((th) => th > t.count);
          const lvlClass = t.level === 0 ? 'inactive' : t.level >= t.thresholds.length && t.thresholds.length >= 3 ? 'active l3' : t.level >= 2 ? 'active l2' : 'active';
          return (
            <Tip key={t.id} content={<TraitTip id={t.id} count={t.count} />} placement="right">
              <div className={`trait ${lvlClass}`}>
                <div className="trait-hex">
                  <TraitIcon id={t.id} size={20} />
                </div>
                <div>
                  <div className="trait-name">{def.name}</div>
                  <div className="trait-steps">
                    {t.thresholds.map((th, i) => (
                      <span key={th}>{i + 1 <= t.level ? <b>{th}</b> : th}{i < t.thresholds.length - 1 ? ' ›' : ''}</span>
                    ))}
                  </div>
                  {t.level === 0 && next ? <div className="trait-hint">encore {next - t.count}</div> : null}
                  {potential.has(t.id) && next ? <div className="trait-hint">↑ disponible en boutique ou réserve</div> : null}
                </div>
                <div className="trait-count">{t.count}</div>
              </div>
            </Tip>
          );
        })}
      </div>
    </div>
  );
}

// ── Adversaires ────────────────────────────────────────────────────────────
export function OpponentsPanel(): JSX.Element | null {
  const c = useController();
  const st = c.state;
  if (!st) return null;
  const players = st.players.slice().sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0) || b.hp - a.hp);
  const current = c.live?.opponentId;
  return (
    <div className="opps panel">
      <div className="panel-title">
        Archontes <span style={{ color: 'var(--text-dim)', letterSpacing: 0 }}>{st.players.filter((p) => p.alive).length} en lice</span>
      </div>
      <div className="opp-list scroll">
        {players.map((p) => {
          const snap = p.snapshot;
          const tip = (
            <div style={{ minWidth: 220 }}>
              <h4>
                {p.name} <span className="muted">{p.title}</span>
              </h4>
              {p.ai ? <div className="muted">Style observé : {styleGuess(p.snapshot?.traits ?? [])}</div> : null}
              {snap ? (
                <>
                  <div style={{ fontSize: 13 }}>Niveau {snap.level} · {snap.gold} or · {snap.board.length} unités</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, margin: '4px 0' }}>
                    {snap.traits.filter((t) => t.level > 0).map((t) => (
                      <span key={t.id} className="badge">
                        <TraitIcon id={t.id} size={14} /> {t.count} {getTrait(t.id).name}
                      </span>
                    ))}
                  </div>
                  <div className="muted">Clic : afficher son dernier plateau</div>
                </>
              ) : (
                <div className="muted">Pas encore observé en combat.</div>
              )}
              {!p.alive ? <div className="muted">Éliminé ({p.placement}e)</div> : null}
            </div>
          );
          return (
            <Tip key={p.id} content={tip} placement="left">
              <div
                className={`opp ${p.id === HUMAN_ID ? 'me' : ''} ${!p.alive ? 'dead' : ''} ${current === p.id ? 'current' : ''}`}
                onClick={() => p.id !== HUMAN_ID && p.alive && p.snapshot && !c.live && c.scout(p.id)}
                style={c.scoutId === p.id ? { borderColor: 'var(--cyan)' } : undefined}
              >
                <div className="opp-av" style={{ background: p.color }}>{p.name[0]}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="opp-name">{p.id === HUMAN_ID ? `${p.name} (vous)` : p.name}</div>
                  <div className="opp-meta">
                    <span>{p.alive ? `${p.hp} PV` : `${p.placement}e`}</span>
                    {snap ? <span>niv. {snap.level}</span> : null}
                    {p.streak >= 2 ? <span style={{ color: '#ffb35c' }}>🔥{p.streak}</span> : p.streak <= -2 ? <span style={{ color: '#8fb8ff' }}>❄{-p.streak}</span> : null}
                  </div>
                  <div className="hpbar">
                    <i style={{ width: `${Math.max(0, p.hp)}%` }} />
                  </div>
                </div>
              </div>
            </Tip>
          );
        })}
      </div>
    </div>
  );
}

function styleGuess(traits: { id: string; count: number; level: number }[]): string {
  const main = traits.filter((t) => t.level > 0).sort((a, b) => b.count - a.count)[0];
  return main ? `${getTrait(main.id).name} (${main.count})` : 'indéterminé';
}

// ── Boutique, or et niveau ─────────────────────────────────────────────────
export function ShopPanel(): JSX.Element | null {
  const c = useController();
  const st = c.state;
  const me = c.me;
  if (!st || !me) return null;
  const odds = shopOdds(me.level);
  const income = computeIncome(st.roundIndex + 1, me);
  const nextInt = nextInterestThreshold(me.gold);
  const dragUnit = c.drag?.source.kind === 'unit';
  const sellActive = dragUnit && c.drag?.over?.kind === 'sell';
  let sellValueText = '';
  if (dragUnit && c.drag?.source.kind === 'unit') {
    const f = findUnit(me, c.drag.source.uid);
    if (f) sellValueText = `Vendre ${getChampion(f.unit.defId).name} pour ${sellValueOf(f.unit.defId, f.unit.star)} or`;
  }
  const xpNeed = XP_TO_NEXT[me.level];
  return (
    <div className={`shop-panel panel sell-zone ${sellActive ? 'active' : ''}`} data-sell-zone="1" style={{ position: 'relative' }}>
      {dragUnit ? <div className="sell-overlay">{sellValueText || 'Déposez ici pour vendre'}</div> : null}
      <div className="shop-side">
        <div className="level-line">
          <span>Niveau {me.level}</span>
          <span style={{ color: 'var(--text-dim)' }}>{me.level >= MAX_LEVEL ? 'max' : `${me.xp}/${xpNeed} XP`}</span>
        </div>
        <div className="xp-bar">
          <i style={{ width: me.level >= MAX_LEVEL ? '100%' : `${(me.xp / xpNeed) * 100}%` }} />
        </div>
        <Tip content={<div>Achète {ECONOMY.xpBuyAmount} XP pour {ECONOMY.xpBuyCost} or. Chaque niveau permet de déployer une unité de plus et améliore les probabilités de la boutique.</div>}>
          <button className="btn" style={{ width: '100%' }} disabled={me.level >= MAX_LEVEL || me.gold < ECONOMY.xpBuyCost} onClick={() => c.buyXp()}>
            <Icon k="xp" size={16} /> XP ({ECONOMY.xpBuyCost}) <span className="kbd">F</span>
          </button>
        </Tip>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
          {me.board.length}/{me.level} déployées
        </div>
      </div>
      <div className="shop-cards">
        {me.shop.map((id, i) => (id ? <ShopCard key={i} id={id} slot={i} /> : <div key={i} className="card empty" />))}
      </div>
      <div className="shop-side">
        <Tip content={<IncomeTip gold={me.gold} income={income} next={nextInt} />}>
          <div className="gold-big">
            <Icon k="gold" size={26} /> {me.gold}
          </div>
        </Tip>
        <div className="income-hint">
          +{income.total} prochaine manche (intérêts {interestFor(me.gold)})
        </div>
        <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
          <Tip content={<div>Actualise la boutique pour {ECONOMY.rerollCost} or.</div>}>
            <button className="btn" disabled={me.gold < ECONOMY.rerollCost} onClick={() => c.reroll()}>
              <Icon k="reroll" size={16} /> {ECONOMY.rerollCost} <span className="kbd">D</span>
            </button>
          </Tip>
          <Tip content={<div>{me.shopLocked ? 'Boutique verrouillée : elle sera conservée à la prochaine manche.' : 'Verrouiller la boutique pour la conserver à la prochaine manche.'}</div>}>
            <button className={`btn ${me.shopLocked ? 'gold' : ''}`} onClick={() => c.toggleLock()}>
              <Icon k={me.shopLocked ? 'lock' : 'unlock'} size={16} color={me.shopLocked ? '#20160a' : '#ffe3a1'} /> <span className="kbd">L</span>
            </button>
          </Tip>
        </div>
        <Tip content={<div>Probabilités d’apparition par coût au niveau {me.level}. Les exemplaires déjà recrutés par les Archontes ne sont plus disponibles dans le pool partagé.</div>}>
          <div className="odds">
            {odds.map((o, i) => (
              <span key={i} style={{ color: costColor(i + 1), opacity: o ? 1 : 0.35 }}>
                {o}%
              </span>
            ))}
          </div>
        </Tip>
      </div>
    </div>
  );
}

function sellValueOf(defId: string, star: number): number {
  const cost = getChampion(defId).cost;
  return star === 1 ? cost : Math.max(cost, cost * Math.pow(3, star - 1) - 1);
}

function IncomeTip({ gold, income, next }: { gold: number; income: { base: number; interest: number; streak: number; total: number }; next: { gold: number; interest: number } | null }): JSX.Element {
  return (
    <div>
      <h4>Économie</h4>
      <div className="kv" style={{ minWidth: 220 }}>
        <span>Revenu de base</span>
        <span>+{income.base}</span>
        <span>Intérêts (1 par 10 or, max {ECONOMY.interestMax})</span>
        <span>+{income.interest}</span>
        <span>Série</span>
        <span>+{income.streak}</span>
        <span>Victoire contre un Archonte</span>
        <span>+{ECONOMY.pvpWinGold}</span>
      </div>
      <div className="muted" style={{ marginTop: 6 }}>
        {next ? `Encore ${next.gold - gold} or pour ${next.interest} d’intérêt.` : 'Intérêts maximaux atteints.'} Économiser rapporte, dépenser renforce l’équipe maintenant : à vous d’arbitrer.
      </div>
    </div>
  );
}

function ShopCard({ id, slot }: { id: string; slot: number }): JSX.Element {
  const c = controller;
  const me = c.me!;
  const def = getChampion(id);
  const owned = ownedCopies(me, id);
  const canAfford = me.gold >= def.cost;
  const wouldUpgrade = owned % 3 === 2;
  return (
    <Tip content={<ChampionTip defId={id} />}>
      <div className={`card ${canAfford ? '' : 'cant'} ${wouldUpgrade ? 'owned' : ''}`} style={{ '--c': costColor(def.cost) } as React.CSSProperties} onClick={() => c.buy(slot)} role="button" aria-label={`Recruter ${def.name} (${def.cost} or)`}>
        <div className="card-art">
          <ChampionPortrait defId={id} />
          <div className="card-traits">
            {def.traits.map((t) => (
              <span key={t} className="card-trait">
                <TraitIcon id={t} size={14} /> {getTrait(t).name}
              </span>
            ))}
          </div>
          {owned ? <span className="card-pairs">{owned % 3 === 2 ? '★ fusion' : `${owned} possédé${owned > 1 ? 's' : ''}`}</span> : null}
        </div>
        <div className="card-foot">
          <span className="card-name">{def.name}</span>
          <span className="card-cost">
            <Icon k="gold" size={14} /> {def.cost}
          </span>
        </div>
      </div>
    </Tip>
  );
}

// ── Réserve d'objets ───────────────────────────────────────────────────────
export function ItemsPanel(): JSX.Element | null {
  const c = useController();
  const me = c.me;
  const [preview, setPreview] = useState<{ x: number; y: number; text: string; ok: boolean } | null>(null);
  const dragging = useRef(false);
  useEffect(() => () => void (dragging.current = false), []);
  if (!me) return null;
  const slots = Array.from({ length: 10 }, (_, i) => me.items[i] ?? null);

  const startDrag = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    dragging.current = true;
    c.drag = { source: { kind: 'item', index }, x: e.clientX, y: e.clientY, over: null };
    c.notify();
    const move = (ev: PointerEvent) => {
      if (!c.drag) return;
      c.drag.x = ev.clientX;
      c.drag.y = ev.clientY;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const slotEl = el?.closest('[data-item-slot]') as HTMLElement | null;
      const itemId = me.items[index];
      if (slotEl && Number(slotEl.dataset.itemSlot) !== index && me.items[Number(slotEl.dataset.itemSlot)]) {
        const j = Number(slotEl.dataset.itemSlot);
        const other = me.items[j];
        const res = isComponent(itemId) && isComponent(other) ? combine(itemId, other) : undefined;
        c.drag.over = { kind: 'itemSlot', index: j };
        setPreview({ x: ev.clientX, y: ev.clientY, text: res ? `Assembler : ${res.name}` : 'Combinaison impossible', ok: !!res });
        return;
      }
      const uid = boardBus.picker?.unitAt(ev.clientX, ev.clientY) ?? null;
      if (uid) {
        c.drag.over = { kind: 'unit', uid };
        const f = findUnit(me, uid);
        if (f) {
          const pv = previewEquip(f.unit, itemId);
          const name = getChampion(f.unit.defId).name;
          setPreview({
            x: ev.clientX,
            y: ev.clientY,
            text: pv.kind === 'invalid' ? pv.reason ?? 'Impossible' : pv.kind === 'combine' ? `${name} : assembler ${pv.result!.name}` : `Équiper ${name}${pv.result ? ` de ${pv.result.name}` : ''}`,
            ok: pv.kind !== 'invalid',
          });
        }
      } else {
        c.drag.over = null;
        setPreview(null);
        c.notify();
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragging.current = false;
      const over = c.drag?.over;
      c.drag = null;
      setPreview(null);
      if (over?.kind === 'unit') c.equip(index, over.uid);
      else if (over?.kind === 'itemSlot') c.combineItems(index, over.index);
      else c.notify();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="items-panel panel">
      <div className="panel-title">
        Objets <span style={{ color: 'var(--text-dim)', letterSpacing: 0, textTransform: 'none', fontFamily: 'var(--font-body)' }}>{me.items.length}</span>
      </div>
      <div className="item-grid">
        {slots.map((id, i) =>
          id ? (
            <Tip key={i} content={<ItemTip id={id} />}>
              <div className={`item-slot filled ${c.drag?.over?.kind === 'itemSlot' && c.drag.over.index === i ? 'over' : ''}`} data-item-slot={i} onPointerDown={(e) => startDrag(e, i)}>
                <ItemIcon id={id} size={30} />
              </div>
            </Tip>
          ) : (
            <div key={i} className="item-slot" />
          ),
        )}
      </div>
      {me.items.length > 10 ? <div className="muted" style={{ padding: '0 10px 6px', fontSize: 12, color: 'var(--text-dim)' }}>+{me.items.length - 10} objet(s) en attente</div> : null}
      {c.drag?.source.kind === 'item'
        ? createPortal(
            <>
              <div style={{ position: 'fixed', left: c.drag.x - 18, top: c.drag.y - 18, zIndex: 999, pointerEvents: 'none', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))' }}>
                <ItemIcon id={me.items[c.drag.source.index]} size={36} />
              </div>
              <div className="tip" style={{ left: (preview?.x ?? c.drag.x) + 22, top: (preview?.y ?? c.drag.y) + 14, borderColor: preview ? (preview.ok ? 'var(--cyan)' : 'var(--danger)') : undefined }}>
                {preview ? preview.text : findItem(me.items[c.drag.source.index])?.name}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
