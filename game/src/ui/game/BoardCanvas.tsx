import { useEffect, useRef, useState } from 'react';
import { controller, type DragState } from '../../app/controller';
import { onFrame } from '../../app/loop';
import { COMBAT } from '../../config/balance';
import { BoardRenderer } from '../../render/boardRenderer';
import { boardBus } from './boardBus';
import { ChampionTip } from '../info';
import { FloatAt } from '../common';
import { getChampion } from '../../core/content';

interface HoverInfo {
  x: number;
  y: number;
  uid?: string;
  combatId?: number;
}

export function BoardCanvas(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const pending = useRef<{ uid: string; x: number; y: number; id: number } | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const hoverRef = useRef<HoverInfo | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const r = new BoardRenderer(canvas);
    rendererRef.current = r;
    const ro = new ResizeObserver(() => r.resize(wrap.clientWidth, wrap.clientHeight));
    ro.observe(wrap);
    r.resize(wrap.clientWidth, wrap.clientHeight);
    boardBus.picker = {
      unitAt(cx, cy) {
        const rect = canvas.getBoundingClientRect();
        const d = r.pickUnit(cx - rect.left, cy - rect.top);
        return d?.uid ?? null;
      },
    };
    const off = onFrame((dt, now) => {
      const c = controller;
      const st = c.state;
      const live = c.live;
      const alive = st ? st.players.filter((p) => p.alive).length : 8;
      const scout = c.scoutId !== null && st && !live ? st.players[c.scoutId]?.snapshot?.board ?? null : null;
      r.render({
        time: now,
        dt,
        me: c.me,
        live: live ? { sim: live.sim, alpha: live.sim.done ? 0 : Math.min(1, live.acc / COMBAT.dt) } : null,
        locked: !!live,
        drag: c.drag,
        hoverUid: hoverRef.current?.uid ?? null,
        selectedUid: c.selectedUid,
        hoverCombatId: hoverRef.current?.combatId ?? null,
        pointer: pointer.current,
        showNumbers: c.settings.showDamageNumbers,
        reduceMotion: c.settings.reduceMotion,
        mood: alive <= 2 ? 'final' : live ? 'combat' : 'prep',
        ghostBoard: scout,
      });
    });
    return () => {
      off();
      ro.disconnect();
      boardBus.picker = null;
    };
  }, []);

  const local = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const computeOver = (e: React.PointerEvent, x: number, y: number): DragState['over'] => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el?.closest('[data-sell-zone]')) return { kind: 'sell' };
    const p = rendererRef.current!.pick(x, y);
    if (!p || p.kind === 'enemyHalf') return null;
    return p;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const { x, y } = local(e);
    const r = rendererRef.current!;
    const d = r.pickUnit(x, y);
    if (e.button === 2) return;
    if (d?.uid) {
      pending.current = { uid: d.uid, x, y, id: e.pointerId };
      (e.target as Element).setPointerCapture(e.pointerId);
    } else if (d?.combatId !== undefined && controller.live) {
      const u = controller.live.sim.unit(d.combatId);
      if (u && u.kind === 'champion') controller.openLive(d.combatId);
    } else {
      controller.selectedUid = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y } = local(e);
    pointer.current = { x, y };
    const c = controller;
    const pend = pending.current;
    if (pend && !c.drag && Math.hypot(x - pend.x, y - pend.y) > 6) {
      c.drag = { source: { kind: 'unit', uid: pend.uid }, x, y, over: computeOver(e, x, y) };
      c.notify();
    }
    if (c.drag && c.drag.source.kind === 'unit') {
      c.drag.x = x;
      c.drag.y = y;
      const over = computeOver(e, x, y);
      if (JSON.stringify(over) !== JSON.stringify(c.drag.over)) {
        c.drag.over = over;
        c.notify();
      }
      return;
    }
    const d = rendererRef.current!.pickUnit(x, y);
    const next: HoverInfo | null = d ? { x: e.clientX, y: e.clientY, uid: d.uid, combatId: d.combatId } : null;
    const prev = hoverRef.current;
    if (!next || !prev || next.uid !== prev.uid || next.combatId !== prev.combatId) {
      hoverRef.current = next;
      c.hoverUid = next?.uid ?? null;
      setHover(next);
    } else if (next && (Math.abs(next.x - prev.x) > 24 || Math.abs(next.y - prev.y) > 24)) {
      hoverRef.current = next;
      setHover(next);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const c = controller;
    const pend = pending.current;
    pending.current = null;
    if (c.drag && c.drag.source.kind === 'unit') {
      const uid = c.drag.source.uid;
      const over = c.drag.over;
      c.drag = null;
      if (over?.kind === 'board') c.move(uid, { zone: 'board', col: over.col, row: over.row });
      else if (over?.kind === 'bench') c.move(uid, { zone: 'bench', index: over.index });
      else if (over?.kind === 'sell') c.sell(uid);
      else c.notify();
      return;
    }
    if (pend) {
      const { x, y } = local(e);
      if (Math.hypot(x - pend.x, y - pend.y) <= 6) controller.openUnit(pend.uid);
    }
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const d = rendererRef.current?.pickUnit(e.clientX - rect.left, e.clientY - rect.top);
    if (d?.uid) controller.openUnit(d.uid);
    else if (d?.combatId !== undefined) controller.openLive(d.combatId);
  };

  const onLeave = () => {
    pointer.current = null;
    if (!controller.drag) {
      hoverRef.current = null;
      controller.hoverUid = null;
      setHover(null);
    }
  };

  return (
    <div ref={wrapRef} className="board-wrap">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pending.current = null;
          controller.drag = null;
          controller.notify();
        }}
        onPointerLeave={onLeave}
        onContextMenu={onContext}
        aria-label="Plateau de jeu"
      />
      {hover && !controller.drag ? <HoverCard info={hover} /> : null}
    </div>
  );
}

function HoverCard({ info }: { info: HoverInfo }): JSX.Element | null {
  const c = controller;
  if (info.uid && c.me) {
    const u = c.me.board.find((s) => s.uid === info.uid) ?? c.me.bench.find((b) => b?.uid === info.uid);
    if (!u) return null;
    return (
      <FloatAt x={info.x} y={info.y}>
        <ChampionTip defId={u.defId} star={u.star} items={u.items} />
      </FloatAt>
    );
  }
  if (info.combatId !== undefined && c.live) {
    const u = c.live.sim.unit(info.combatId);
    if (!u) return null;
    return (
      <FloatAt x={info.x} y={info.y}>
        <div style={{ minWidth: 200 }}>
          <h4>
            {u.name} {u.kind === 'champion' ? '★'.repeat(u.ident.star) : ''}
          </h4>
          <div className="muted">{u.side === 0 ? 'Votre équipe' : 'Adversaire'}{u.kind === 'summon' ? ' · invocation' : u.kind === 'creature' ? ' · créature' : ''}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {Math.round(u.hp)} / {Math.round(u.stats.maxHp)} PV
            {u.shieldTotal > 0 ? ` · bouclier ${Math.round(u.shieldTotal)}` : ''}
            {u.hasAbility ? ` · mana ${Math.round(u.mana)}/${u.stats.maxMana}` : ''}
          </div>
          <div style={{ fontSize: 13 }}>Dégâts infligés : {Math.round(u.combat.damageDealt)}</div>
          {u.kind === 'champion' ? <div className="muted">{getChampion(u.ident.defId).ability.name} · clic : fiche</div> : null}
        </div>
      </FloatAt>
    );
  }
  return null;
}
