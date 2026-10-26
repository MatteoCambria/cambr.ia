import { useEffect, useRef, useState } from 'react';
import { controller } from '../../app/controller';
import { onFrame } from '../../app/loop';
import { buildCombat, computeTraits, type BoardUnitSpec } from '../../combat/setup';
import type { CombatSim } from '../../combat/sim';
import { COMBAT } from '../../config/balance';
import { CHAMPIONS, COMBINED, getChampion, getTrait } from '../../core/content';
import { BoardRenderer } from '../../render/boardRenderer';
import type { PlayerState } from '../../game/types';
import { ChampionPortrait, ItemIcon, Tip, TraitIcon, costColor, useController } from '../common';
import { ChampionTip, ItemTip } from '../info';

interface Unit extends BoardUnitSpec {
  id: number;
}

const PRESETS: { name: string; a: [string, number, number][]; b: [string, number, number][] }[] = [
  {
    name: 'Zénith contre Braise',
    a: [['aurel', 3, 0], ['valerian', 2, 0], ['seraphine', 3, 3], ['heliodore', 2, 3], ['liora', 1, 3], ['ysolde', 4, 0]],
    b: [['gorm', 3, 0], ['ignivar', 2, 0], ['cendrine', 3, 3], ['tison', 4, 3], ['vesna', 4, 0], ['phenea', 1, 3]],
  },
  {
    name: 'Assassins contre Gardiens',
    a: [['lunor', 2, 2], ['felis', 4, 2], ['mirelle', 0, 2], ['kesh', 6, 2], ['astree', 3, 0], ['ombral', 5, 2]],
    b: [['aurel', 2, 0], ['brindille', 4, 0], ['grumhald', 3, 0], ['isaure', 0, 3], ['pulsara', 6, 3], ['velane', 3, 3]],
  },
  {
    name: 'Invocateurs contre Arsenal',
    a: [['tic', 1, 3], ['octave', 3, 3], ['morvain', 5, 3], ['auguste', 3, 0], ['bertrade', 2, 0], ['neantis', 4, 3]],
    b: [['amara', 3, 3], ['isaure', 1, 3], ['gaspard', 5, 3], ['thalassor', 3, 0], ['aurel', 2, 0], ['pim', 6, 3]],
  },
];

let uid = 1;

export function TrainingScreen(): JSX.Element {
  const c = useController();
  const [sideA, setSideA] = useState<Unit[]>([]);
  const [sideB, setSideB] = useState<Unit[]>([]);
  const [pick, setPick] = useState<string>('aurel');
  const [star, setStar] = useState<1 | 2 | 3>(2);
  const [items, setItems] = useState<string[]>([]);
  const [seed, setSeed] = useState(1);
  const [stage, setStage] = useState(4);
  const [sim, setSim] = useState<CombatSim | null>(null);
  const [, force] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rRef = useRef<BoardRenderer | null>(null);
  const simRef = useRef<CombatSim | null>(null);
  const acc = useRef(0);
  const stateRef = useRef({ sideA, sideB });
  stateRef.current = { sideA, sideB };
  simRef.current = sim;

  useEffect(() => {
    const r = new BoardRenderer(canvasRef.current!);
    rRef.current = r;
    const ro = new ResizeObserver(() => r.resize(wrapRef.current!.clientWidth, wrapRef.current!.clientHeight));
    ro.observe(wrapRef.current!);
    r.resize(wrapRef.current!.clientWidth, wrapRef.current!.clientHeight);
    let lastUi = 0;
    const off = onFrame((dt, now) => {
      const s = simRef.current;
      if (s && !s.done) {
        acc.current += dt * controller.settings.combatSpeed;
        let n = 0;
        while (acc.current >= COMBAT.dt && !s.done && n++ < 12) {
          s.step();
          acc.current -= COMBAT.dt;
        }
        if (now - lastUi > 0.25 || s.done) {
          lastUi = now;
          force((x) => x + 1);
        }
      }
      const { sideA: a, sideB: b } = stateRef.current;
      const me = fakePlayer(a);
      r.render({
        time: now,
        dt,
        me: s ? null : me,
        live: s ? { sim: s, alpha: s.done ? 0 : Math.min(1, acc.current / COMBAT.dt) } : null,
        locked: !!s,
        drag: null,
        hoverUid: null,
        selectedUid: null,
        hoverCombatId: null,
        pointer: null,
        showNumbers: controller.settings.showDamageNumbers,
        reduceMotion: controller.settings.reduceMotion,
        mood: s ? 'combat' : 'prep',
        ghostBoard: s ? null : b.map((u) => ({ defId: u.defId, star: u.star, items: [...u.items], col: u.hex.col, row: u.hex.row })),
      });
    });
    return () => {
      off();
      ro.disconnect();
    };
  }, []);

  const onClick = (e: React.MouseEvent) => {
    if (sim) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const p = rRef.current!.pick(e.clientX - rect.left, e.clientY - rect.top);
    if (!p || p.kind === 'bench') return;
    if (p.kind === 'board') {
      const ex = sideA.find((u) => u.hex.col === p.col && u.hex.row === p.row);
      if (ex) setSideA(sideA.filter((u) => u !== ex));
      else if (sideA.length < 10) setSideA([...sideA, { id: uid++, defId: pick, star, items: [...items], hex: { col: p.col, row: p.row } }]);
    } else {
      const local = { col: 6 - p.hex.col, row: 3 - p.hex.row };
      const ex = sideB.find((u) => u.hex.col === local.col && u.hex.row === local.row);
      if (ex) setSideB(sideB.filter((u) => u !== ex));
      else if (sideB.length < 10) setSideB([...sideB, { id: uid++, defId: pick, star, items: [...items], hex: local }]);
    }
  };

  const run = (s = seed) => {
    acc.current = 0;
    setSim(buildCombat([{ units: sideA }, { units: sideB }], { seed: s, stage, recordEvents: true }));
  };

  const loadPreset = (i: number) => {
    const p = PRESETS[i];
    const mk = (l: [string, number, number][]) => l.map(([defId, col, row]) => ({ id: uid++, defId, star: 2 as const, items: [], hex: { col, row } }));
    setSim(null);
    setSideA(mk(p.a));
    setSideB(mk(p.b));
  };

  const res = sim?.done ? sim.result() : null;
  const traitsA = computeTraits(sideA).filter((t) => t.level > 0);
  const traitsB = computeTraits(sideB).filter((t) => t.level > 0);

  return (
    <div className="screen" style={{ padding: 8, display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: 8, background: 'var(--bg-0)' }}>
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="panel-title">
          Champions <button className="btn small ghost" onClick={() => c.go('menu')}>Menu</button>
        </div>
        <div style={{ padding: 8 }}>
          <div className="seg" style={{ marginBottom: 6 }}>
            {([1, 2, 3] as const).map((s) => (
              <button key={s} className={star === s ? 'on' : ''} onClick={() => setStar(s)}>
                {'★'.repeat(s)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', minHeight: 30 }}>
            Objets :{' '}
            {items.map((it, i) => (
              <span key={i} onClick={() => setItems(items.filter((_, k) => k !== i))} style={{ cursor: 'pointer' }}>
                <ItemIcon id={it} size={24} />
              </span>
            ))}
            {items.length === 0 ? <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>aucun (choisir ci-dessous)</span> : null}
          </div>
        </div>
        <div className="scroll" style={{ overflow: 'auto', padding: '0 8px 8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {CHAMPIONS.slice()
            .sort((a, b) => a.cost - b.cost)
            .map((ch) => (
              <Tip key={ch.id} content={<ChampionTip defId={ch.id} star={star} />}>
                <div className="mini-portrait" style={{ '--c': costColor(ch.cost), width: '100%', height: 54, outline: pick === ch.id ? '2px solid var(--gold-bright)' : 'none' } as React.CSSProperties} onClick={() => setPick(ch.id)}>
                  <ChampionPortrait defId={ch.id} />
                </div>
              </Tip>
            ))}
          <div style={{ gridColumn: '1 / -1', marginTop: 6, color: 'var(--gold)', fontWeight: 800, fontSize: 13 }}>Objets</div>
          {COMBINED.map((it) => (
            <Tip key={it.id} content={<ItemTip id={it.id} />}>
              <div className="item-slot filled" onClick={() => items.length < 3 && setItems([...items, it.id])}>
                <ItemIcon id={it.id} size={26} />
              </div>
            </Tip>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', minHeight: 0 }}>
        <div ref={wrapRef} className="board-wrap" style={{ position: 'absolute', inset: 0 }}>
          <canvas ref={canvasRef} onClick={onClick} />
        </div>
        <div className="board-hud">
          <div className="vs">
            Entraînement <small>clic sur une case : placer « {getChampion(pick).name} » ({'★'.repeat(star)}) ou retirer</small>
          </div>
        </div>
      </div>
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, minHeight: 0, overflow: 'auto' }}>
        <div className="panel-title" style={{ padding: 0, border: 'none' }}>Combat d’essai</div>
        <div className="row">
          <label style={{ fontSize: 14 }}>
            Graine <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 1)} style={{ width: 80, background: 'rgba(0,0,0,0.4)', color: 'var(--text)', border: '1px solid var(--panel-border)', borderRadius: 6, padding: 4 }} />
          </label>
          <label style={{ fontSize: 14 }}>
            Étape <input type="number" min={1} max={8} value={stage} onChange={(e) => setStage(Math.max(1, Math.min(8, Number(e.target.value) || 4)))} style={{ width: 50, background: 'rgba(0,0,0,0.4)', color: 'var(--text)', border: '1px solid var(--panel-border)', borderRadius: 6, padding: 4 }} />
          </label>
        </div>
        <div className="row">
          <button className="btn gold" disabled={!sideA.length || !sideB.length} onClick={() => run()}>
            Lancer
          </button>
          <button className="btn" disabled={!sim} onClick={() => run(seed)}>
            Rejouer
          </button>
          <button className="btn" onClick={() => (setSeed(seed + 1), run(seed + 1))} disabled={!sideA.length || !sideB.length}>
            Graine suivante
          </button>
        </div>
        <div className="row">
          {([1, 2, 3] as const).map((s) => (
            <button key={s} className={`btn small ${c.settings.combatSpeed === s ? 'gold' : 'ghost'}`} onClick={() => c.setSpeed(s)}>
              ×{s}
            </button>
          ))}
          <button className="btn small ghost" onClick={() => setSim(null)} disabled={!sim}>
            Revenir au placement
          </button>
        </div>
        <div className="row">
          {PRESETS.map((p, i) => (
            <button key={i} className="btn small" onClick={() => loadPreset(i)}>
              {p.name}
            </button>
          ))}
          <button className="btn small ghost" onClick={() => (setSideA([]), setSideB([]), setSim(null))}>
            Vider
          </button>
        </div>
        <TraitLine label="Bas" traits={traitsA} />
        <TraitLine label="Haut" traits={traitsB} />
        {sim ? (
          <div style={{ fontSize: 13 }}>
            <b style={{ color: res ? (res.winner === 0 ? 'var(--success)' : res.winner === 1 ? 'var(--danger)' : 'var(--text)') : 'var(--gold)' }}>
              {res ? (res.winner === 0 ? 'Victoire de l’équipe du bas' : res.winner === 1 ? 'Victoire de l’équipe du haut' : 'Match nul') : 'Combat en cours…'}
            </b>{' '}
            · {sim.time.toFixed(1)} s
            <table style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)' }}>
                  <th style={{ textAlign: 'left' }}>Unité</th>
                  <th>Dégâts</th>
                  <th>Subis</th>
                  <th>Soins</th>
                </tr>
              </thead>
              <tbody>
                {sim.units
                  .slice()
                  .sort((a, b) => b.combat.damageDealt - a.combat.damageDealt)
                  .map((u) => (
                    <tr key={u.id} style={{ color: u.side === 0 ? '#bfe8c0' : '#ffc4b8', opacity: u.alive ? 1 : 0.6 }}>
                      <td>{u.name}</td>
                      <td style={{ textAlign: 'right' }}>{Math.round(u.combat.damageDealt)}</td>
                      <td style={{ textAlign: 'right' }}>{Math.round(u.combat.damageTaken)}</td>
                      <td style={{ textAlign: 'right' }}>{Math.round(u.combat.healing + u.combat.shielding)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Composez deux équipes (jusqu’à 10 unités chacune), puis lancez. Le même placement et la même graine donnent exactement le même combat.</div>
        )}
      </div>
    </div>
  );
}

function TraitLine({ label, traits }: { label: string; traits: { id: string; count: number }[] }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', fontSize: 13 }}>
      <b>{label} :</b>
      {traits.length ? traits.map((t) => (
        <span key={t.id} className="badge">
          <TraitIcon id={t.id} size={14} /> {t.count} {getTrait(t.id).name}
        </span>
      )) : <span style={{ color: 'var(--text-dim)' }}>aucune synergie</span>}
    </div>
  );
}

function fakePlayer(units: Unit[]): PlayerState {
  return {
    id: 0,
    name: 'Entraînement',
    title: '',
    isHuman: true,
    color: '#fff',
    hp: 100,
    gold: 0,
    level: 10,
    xp: 0,
    board: units.map((u) => ({ uid: 't' + u.id, defId: u.defId, star: u.star as 1 | 2 | 3, items: [...u.items], col: u.hex.col, row: u.hex.row })),
    bench: Array.from({ length: 9 }, () => null),
    items: [],
    shop: [],
    shopLocked: false,
    shopRng: [1, 2, 3, 4],
    streak: 0,
    alive: true,
    placement: null,
    eliminatedRound: null,
    stats: { goldEarned: 0, goldSpent: 0, interestEarned: 0, rerolls: 0, xpBought: 0, unitsBought: 0, unitsSold: 0, starUps2: 0, starUps3: 0, wins: 0, losses: 0, draws: 0, damageDealt: 0, damageTaken: 0, bestStreak: 0, itemsCrafted: 0, championDamage: {}, championRounds: {}, hpHistory: [] },
    nomadeWins: 0,
    recentOpponents: [],
    snapshot: null,
    lastIncome: null,
  };
}
