import { useEffect, useRef, useState } from 'react';
import { controller, labelDifficulty } from '../../app/controller';
import { onFrame } from '../../app/loop';
import { drawArenaBackground } from '../../render/arenaArt';
import { drawUnit } from '../../render/sprites';
import { CHAMPIONS, getChampion, getTrait } from '../../core/content';
import { DIFFICULTIES, PROFILES } from '../../ai/profiles';
import { roundAt } from '../../config/rounds';
import { PREP_TIME_OPTIONS } from '../../config/balance';
import { hasSavedGame, storageAvailable } from '../../save/save';
import { computeTraits } from '../../combat/setup';
import { HUMAN_ID } from '../../game/game';
import type { Difficulty } from '../../game/types';
import { ChampionPortrait, TraitIcon, costColor, useController } from '../common';

const PARADE = ['solenne', 'chronaxe', 'neantis', 'phenea', 'ophelune', 'vorhn', 'abyssandre', 'myrrhine', 'orrheon'];

/** Fond animé : ciel d'Orrhéa et défilé de quelques Échos légendaires. */
export function MenuBackground(): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const off = onFrame((_dt, now) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      try {
        drawArenaBackground(ctx, w, h, now, 'prep');
        const n = PARADE.length;
        const size = Math.min(70, h / 9);
        for (let i = 0; i < n; i++) {
          const def = getChampion(PARADE[i]);
          const x = (w / (n + 1)) * (i + 1);
          const y = h - size * 0.9 + Math.sin(now * 0.8 + i) * 3;
          drawUnit(ctx, def.look, { x, y, size, facing: i < n / 2 ? 1 : -1, time: now + i * 0.6, anim: 'idle', animT: 0, team: 0, star: 3, alpha: 0.9 });
        }
        const g = ctx.createLinearGradient(0, h * 0.55, 0, h);
        g.addColorStop(0, 'rgba(5,6,15,0)');
        g.addColorStop(1, 'rgba(5,6,15,0.55)');
        ctx.fillStyle = g;
        ctx.fillRect(0, h * 0.55, w, h * 0.45);
      } catch (e) {
        ctx.fillStyle = '#05060f';
        ctx.fillRect(0, 0, w, h);
        void e;
      }
    });
    return () => {
      off();
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <div className="menu-bg">
      <canvas ref={ref} />
    </div>
  );
}

export function MainMenu(): JSX.Element {
  const c = useController();
  const [canContinue, setCanContinue] = useState(false);
  useEffect(() => setCanContinue(hasSavedGame()), []);
  const p = c.profile;
  return (
    <div className="screen">
      <MenuBackground />
      <div className="menu">
        <div className="logo">ORRHÉA</div>
        <div className="subtitle">Tactiques des Sphères</div>
        <div className="menu-buttons">
          <button className="btn gold big" onClick={() => c.go('setup')}>
            Jouer
          </button>
          {canContinue ? (
            <button className="btn big" onClick={() => c.continueGame()}>
              Continuer la partie
            </button>
          ) : null}
          <button className="btn" onClick={() => c.go('training')}>
            Mode entraînement
          </button>
          <button className="btn" onClick={() => c.go('encyclopedia')}>
            Encyclopédie
          </button>
          <button className="btn" onClick={() => c.go('rules')}>
            Règles du jeu
          </button>
          <button className="btn" onClick={() => c.go('settings')}>
            Paramètres
          </button>
          <button className="btn ghost" onClick={() => c.go('credits')}>
            Crédits
          </button>
        </div>
        {p.games > 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 8 }}>
            {p.games} partie{p.games > 1 ? 's' : ''} · {p.wins} victoire{p.wins > 1 ? 's' : ''} · {Math.round((p.top4 / p.games) * 100)} % de top 4 · meilleure place : {p.bestPlacement}e
          </div>
        ) : null}
      </div>
      <div className="menu-foot">
        Jeu solo contre l’ordinateur · aucune connexion requise{!storageAvailable() ? ' · sauvegarde indisponible dans ce navigateur' : ''}
      </div>
    </div>
  );
}

export function SetupScreen(): JSX.Element {
  const c = useController();
  const s = c.settings;
  const [difficulty, setDifficulty] = useState<Difficulty>(s.difficulty);
  const [opponents, setOpponents] = useState(s.opponents);
  const [prep, setPrep] = useState(s.prepTime);
  const [seed, setSeed] = useState('');
  const [name, setName] = useState(s.playerName);
  return (
    <div className="screen">
      <MenuBackground />
      <div className="page panel filigree">
        <div className="page-head">
          <h2>Nouvelle partie</h2>
          <button className="btn ghost" onClick={() => c.go('menu')}>
            Retour
          </button>
        </div>
        <div className="page-body">
          <div className="setup-grid">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
              <button key={d} className={`choice ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                <h3>{DIFFICULTIES[d].label}</h3>
                <p>{DIFFICULTIES[d].desc}</p>
              </button>
            ))}
          </div>
          <div className="field">
            <label>Adversaires : {opponents} Archontes contrôlés par l’ordinateur</label>
            <input type="range" min={3} max={7} value={opponents} onChange={(e) => setOpponents(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Temps de préparation par manche</label>
            <div className="seg">
              {PREP_TIME_OPTIONS.map((t) => (
                <button key={t} className={prep === t ? 'on' : ''} onClick={() => setPrep(t)}>
                  {t === 0 ? 'Illimité' : `${t} s`}
                </button>
              ))}
            </div>
          </div>
          <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Nom de votre Archonte</label>
              <input type="text" value={name} maxLength={18} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Graine (facultative, pour rejouer exactement la même partie)</label>
              <input type="text" value={seed} placeholder="aléatoire" maxLength={24} onChange={(e) => setSeed(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
            <button className="btn gold big" onClick={() => c.newGame({ difficulty, opponents, prepTime: prep, seed, playerName: name.trim() || 'Archonte' })}>
              Lancer la Convergence
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EndScreen(): JSX.Element | null {
  const c = useController();
  const st = c.endState;
  if (!st) return null;
  const me = st.players[HUMAN_ID];
  const place = me.placement ?? st.players.length;
  const won = place === 1;
  const champDmg = Object.entries(me.stats.championDamage).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxDmg = champDmg[0]?.[1] ?? 1;
  const standings = st.players.slice().sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
  const finalTraits = computeTraits(me.snapshot?.board ?? me.board).filter((t) => t.level > 0);
  const hp = me.stats.hpHistory;
  return (
    <div className="screen">
      <MenuBackground />
      <div className="end panel filigree">
        <div className="page-head">
          <div className="row" style={{ gap: 18 }}>
            <div className="place-big">{place}<span style={{ fontSize: 40 }}>{place === 1 ? 're' : 'e'}</span></div>
            <div>
              <h2 style={{ color: won ? 'var(--gold-bright)' : 'var(--text)' }}>{won ? 'Victoire : le Cœur-Horloge vous reconnaît' : place <= 4 ? 'Belle résistance' : 'Défaite'}</h2>
              <div style={{ color: 'var(--text-dim)' }}>
                {labelDifficulty(st.settings.difficulty)} · {st.players.length - 1} adversaires · graine « {st.settings.seed} » · {st.history.length} manches
              </div>
            </div>
          </div>
          <div className="row">
            <button className="btn gold big" onClick={() => c.restart()}>
              Rejouer
            </button>
            <button className="btn" onClick={() => c.go('menu')}>
              Menu
            </button>
          </div>
        </div>
        <div className="end-grid">
          <div className="panel" style={{ padding: 14 }}>
            <h3 style={{ color: 'var(--gold)', marginBottom: 10 }}>Bilan</h3>
            <div className="kv">
              <span>Victoires / défaites</span>
              <span>{me.stats.wins} / {me.stats.losses}{me.stats.draws ? ` / ${me.stats.draws} nul(s)` : ''}</span>
              <span>Meilleure série</span>
              <span>{me.stats.bestStreak}</span>
              <span>Dégâts infligés aux Archontes</span>
              <span>{me.stats.damageDealt}</span>
              <span>Dégâts subis</span>
              <span>{me.stats.damageTaken}</span>
              <span>Or gagné (dont intérêts)</span>
              <span>{me.stats.goldEarned} ({me.stats.interestEarned})</span>
              <span>Or dépensé</span>
              <span>{me.stats.goldSpent}</span>
              <span>Actualisations</span>
              <span>{me.stats.rerolls}</span>
              <span>Champions recrutés / vendus</span>
              <span>{me.stats.unitsBought} / {me.stats.unitsSold}</span>
              <span>Améliorations 2★ / 3★</span>
              <span>{me.stats.starUps2} / {me.stats.starUps3}</span>
              <span>Objets assemblés</span>
              <span>{me.stats.itemsCrafted}</span>
              <span>Niveau final</span>
              <span>{me.level}</span>
            </div>
            <h3 style={{ color: 'var(--gold)', margin: '14px 0 8px' }}>Évolution des PV</h3>
            <HpChart values={hp} />
          </div>
          <div className="panel" style={{ padding: 14 }}>
            <h3 style={{ color: 'var(--gold)', marginBottom: 10 }}>Classement final</h3>
            <div className="standings">
              {standings.map((p) => (
                <div key={p.id} className={`standing ${p.id === HUMAN_ID ? 'me' : ''}`}>
                  <b style={{ color: p.placement === 1 ? 'var(--gold-bright)' : 'var(--text)' }}>{p.placement}e</b>
                  <span>
                    {p.name} <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{p.title}{p.ai && p.id !== HUMAN_ID ? ` · ${PROFILES[p.ai.profile].label}` : ''}</span>
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{p.alive ? `${p.hp} PV` : `éliminé en ${p.eliminatedRound !== null ? roundAt(p.eliminatedRound).label : '?'}`}</span>
                </div>
              ))}
            </div>
            <h3 style={{ color: 'var(--gold)', margin: '14px 0 8px' }}>Vos meilleurs Échos (dégâts cumulés)</h3>
            <div className="bars">
              {champDmg.map(([id, d]) => (
                <div key={id} className="bar-row">
                  <span>{getChampion(id).name}</span>
                  <div className="b" style={{ width: `${(d / maxDmg) * 100}%` }} />
                  <span style={{ textAlign: 'right' }}>{Math.round(d)}</span>
                </div>
              ))}
            </div>
            <h3 style={{ color: 'var(--gold)', margin: '14px 0 8px' }}>Composition finale</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(me.snapshot?.board ?? me.board).map((u, i) => (
                <span key={i} className="mini-portrait" style={{ '--c': costColor(getChampion(u.defId).cost), width: 44, height: 44 } as React.CSSProperties} title={`${getChampion(u.defId).name} ${'★'.repeat(u.star)}`}>
                  <ChampionPortrait defId={u.defId} />
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {finalTraits.map((t) => (
                <span key={t.id} className="badge">
                  <TraitIcon id={t.id} size={14} /> {t.count} {getTrait(t.id).name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HpChart({ values }: { values: number[] }): JSX.Element {
  const w = 460;
  const h = 110;
  const n = Math.max(2, values.length);
  const pts = values.map((v, i) => `${(i / (n - 1)) * w},${h - (Math.max(0, v) / 100) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8 }} role="img" aria-label="Évolution des points de vie">
      <polyline points={pts} fill="none" stroke="#ffd36b" strokeWidth="2.5" />
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="rgba(255,255,255,0.08)" />
    </svg>
  );
}

export function championCount(): number {
  return CHAMPIONS.length;
}

export { controller };
