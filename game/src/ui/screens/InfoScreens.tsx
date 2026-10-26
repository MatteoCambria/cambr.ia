import { useEffect, useMemo, useState } from 'react';
import { CHAMPIONS, COMBINED, COMPONENTS, TRAITS, combine, getTrait } from '../../core/content';
import { ROLE_LABELS, type Role } from '../../core/defs';
import { ECONOMY, POOL_COPIES, SHOP_ODDS, STAGE_DAMAGE, XP_TO_NEXT, COMBAT, BENCH_SIZE } from '../../config/balance';
import { resetAllData, storageAvailable } from '../../save/save';
import { ChampionPortrait, ItemIcon, Tip, TraitIcon, costColor, useController } from '../common';
import { ChampionSheet, ChampionTip, ItemTip } from '../info';
import { statText } from '../../core/statText';
import { MenuBackground } from './MenuScreens';
import { VolumeSliders } from '../game/GameScreen';

function PageFrame({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }): JSX.Element {
  const c = useController();
  return (
    <div className="screen">
      <MenuBackground />
      <div className="page panel filigree" style={{ height: 'calc(100% - 56px)' }}>
        <div className="page-head">
          <h2>{title}</h2>
          <div className="row">
            {right}
            <button className="btn ghost" onClick={() => c.go('menu')}>
              Retour
            </button>
          </div>
        </div>
        <div className="page-body">{children}</div>
      </div>
    </div>
  );
}

export function Encyclopedia(): JSX.Element {
  const [tab, setTab] = useState<'champions' | 'synergies' | 'objets'>('champions');
  return (
    <PageFrame
      title="Encyclopédie"
      right={
        <div className="tabs">
          {(['champions', 'synergies', 'objets'] as const).map((t) => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'champions' ? `Champions (${CHAMPIONS.length})` : t === 'synergies' ? `Synergies (${TRAITS.length})` : `Objets (${COMPONENTS.length + COMBINED.length})`}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'champions' ? <ChampionsTab /> : tab === 'synergies' ? <TraitsTab /> : <ItemsTab />}
    </PageFrame>
  );
}

function ChampionsTab(): JSX.Element {
  const [cost, setCost] = useState<number | null>(null);
  const [trait, setTrait] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [star, setStar] = useState(1);
  const roles = useMemo(() => [...new Set(CHAMPIONS.map((c) => c.role))], []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const list = CHAMPIONS.filter((c) => (cost === null || c.cost === cost) && (trait === null || c.traits.includes(trait)) && (role === null || c.role === role)).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  return (
    <>
      <div className="filters">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`chip ${cost === n ? 'on' : ''}`} onClick={() => setCost(cost === n ? null : n)} style={{ borderColor: costColor(n) }}>
            {n} or
          </button>
        ))}
        <span style={{ width: 10 }} />
        {TRAITS.map((t) => (
          <button key={t.id} className={`chip ${trait === t.id ? 'on' : ''}`} onClick={() => setTrait(trait === t.id ? null : t.id)}>
            <TraitIcon id={t.id} size={14} /> {t.name}
          </button>
        ))}
      </div>
      <div className="filters">
        {roles.map((r) => (
          <button key={r} className={`chip ${role === r ? 'on' : ''}`} onClick={() => setRole(role === r ? null : r)}>
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
      <div className="champ-grid">
        {list.map((c) => (
          <Tip key={c.id} content={<ChampionTip defId={c.id} />}>
            <div className="card" style={{ '--c': costColor(c.cost), minHeight: 150 } as React.CSSProperties} onClick={() => (setOpen(c.id), setStar(1))}>
              <div className="card-art">
                <ChampionPortrait defId={c.id} />
                <div className="card-traits">
                  {c.traits.map((t) => (
                    <span key={t} className="card-trait">
                      <TraitIcon id={t} size={14} /> {getTrait(t).name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="card-foot">
                <span className="card-name">{c.name}</span>
                <span className="card-cost">{c.cost}</span>
              </div>
            </div>
          </Tip>
        ))}
      </div>
      {open ? (
        <div className="modal-back" onClick={() => setOpen(null)}>
          <div className="modal panel filigree" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ padding: '12px 18px 0', justifyContent: 'flex-end' }}>
              <div className="seg">
                {[1, 2, 3].map((s) => (
                  <button key={s} className={star === s ? 'on' : ''} onClick={() => setStar(s)}>
                    {'★'.repeat(s)}
                  </button>
                ))}
              </div>
            </div>
            <ChampionSheet defId={open} star={star} items={[]} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function TraitsTab(): JSX.Element {
  return (
    <div className="trait-cards">
      {TRAITS.map((t) => {
        const members = CHAMPIONS.filter((c) => c.traits.includes(t.id)).sort((a, b) => a.cost - b.cost);
        return (
          <div key={t.id} className="panel trait-card">
            <h3>
              <TraitIcon id={t.id} size={28} /> {t.name}
              <span style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>{t.kind === 'origin' ? 'Origine' : 'Classe'}</span>
            </h3>
            <div style={{ fontSize: 14, margin: '6px 0' }}>{t.desc}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>{t.lore}</div>
            {t.levels.map((l, i) => (
              <div key={i} className="lvl">
                <b>{t.thresholds[i]}</b>
                <span>{l.desc}</span>
              </div>
            ))}
            <div style={{ fontSize: 13, marginTop: 8 }}>
              <b style={{ color: 'var(--danger)' }}>Contre : </b>
              {t.counter}
            </div>
            <div className="members">
              {members.map((c) => (
                <Tip key={c.id} content={<ChampionTip defId={c.id} />}>
                  <span className="mini-portrait" style={{ '--c': costColor(c.cost) } as React.CSSProperties}>
                    <ChampionPortrait defId={c.id} />
                  </span>
                </Tip>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemsTab(): JSX.Element {
  return (
    <>
      <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>
        Deux composants identiques ou différents se combinent en un objet. Glissez un composant sur un champion qui porte déjà un composant pour les assembler (le résultat est toujours affiché avant). Un champion porte au plus 3 objets.
      </p>
      <table className="recipe-table">
        <thead>
          <tr>
            <th />
            {COMPONENTS.map((c) => (
              <th key={c.id}>
                <Tip content={<ItemTip id={c.id} />} as="span">
                  <ItemIcon id={c.id} size={34} />
                </Tip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPONENTS.map((a) => (
            <tr key={a.id}>
              <th>
                <Tip content={<ItemTip id={a.id} />} as="span">
                  <ItemIcon id={a.id} size={34} />
                </Tip>
              </th>
              {COMPONENTS.map((b) => {
                const r = combine(a.id, b.id)!;
                return (
                  <td key={b.id}>
                    <Tip content={<ItemTip id={r.id} />} as="span" className="recipe-cell">
                      <ItemIcon id={r.id} size={36} />
                    </Tip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="item-list">
        {[...COMPONENTS, ...COMBINED].map((it) => (
          <div key={it.id} className="item-row">
            <ItemIcon id={it.id} size={40} />
            <div>
              <h4>{it.name}</h4>
              <div className="stats">{it.stats.map(statText).join(' · ')}</div>
              <p>{it.kind === 'combined' ? it.desc : 'Composant de base.'}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function RulesScreen(): JSX.Element {
  return (
    <PageFrame title="Règles du jeu">
      <div className="prose" style={{ maxWidth: 860 }}>
        <p>
          <b>Orrhéa — Tactiques des Sphères</b> est un jeu tactique en solo : vous affrontez jusqu’à 7 Archontes contrôlés par l’ordinateur. Chacun commence avec {100} points de vie. Le dernier Archonte debout remporte la Convergence.
        </p>
        <h3>Déroulement d’une manche</h3>
        <ul>
          <li><b>Préparation</b> : recrutez des champions dans la boutique, placez-les sur votre moitié du plateau (4 rangées × 7 cases), équipez des objets.</li>
          <li><b>Combat automatique</b> : vos champions affrontent ceux d’un adversaire tiré au sort (ou des créatures neutres). Vous n’intervenez plus : tout se joue dans la préparation.</li>
          <li><b>Résultat</b> : le perdant subit des dégâts : {STAGE_DAMAGE.slice(2, 7).join(', ')}… selon l’étape, plus 1 à 5 par unité adverse survivante (selon son rang et son coût).</li>
        </ul>
        <p>Chaque étape compte des combats contre les Archontes, un <b>carrousel</b> (les joueurs aux PV les plus bas choisissent en premier un champion portant un objet) et une <b>rencontre neutre</b> qui rapporte du butin.</p>
        <h3>Économie</h3>
        <ul>
          <li>Revenu de base : {ECONOMY.baseIncome} or par manche (moins pendant les cinq premières manches).</li>
          <li>Intérêts : 1 or par tranche de {ECONOMY.interestPer} or possédés, jusqu’à {ECONOMY.interestMax}.</li>
          <li>Séries de victoires ou de défaites : +1 à +3 or par manche. Une victoire contre un Archonte rapporte +{ECONOMY.pvpWinGold} or.</li>
          <li>Actualiser la boutique : {ECONOMY.rerollCost} or. Acheter {ECONOMY.xpBuyAmount} XP : {ECONOMY.xpBuyCost} or. Vous gagnez aussi {ECONOMY.passiveXpPerRound} XP par manche.</li>
          <li>Revente : un champion 1★ rapporte son coût ; un 2★ ou 3★ rapporte presque la valeur de ses exemplaires.</li>
        </ul>
        <h3>Niveaux et boutique</h3>
        <p>Votre niveau fixe le nombre de champions déployables et les probabilités de la boutique. XP requise par niveau : {XP_TO_NEXT.slice(1, 10).join(', ')}.</p>
        <table style={{ borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ padding: '2px 10px', textAlign: 'left' }}>Niveau</th>
              {[1, 2, 3, 4, 5].map((c) => (
                <th key={c} style={{ padding: '2px 10px', color: costColor(c) }}>{c} or</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(SHOP_ODDS).map(([lvl, o]) => (
              <tr key={lvl}>
                <td style={{ padding: '2px 10px' }}>{lvl}</td>
                {o.map((p, i) => (
                  <td key={i} style={{ padding: '2px 10px', textAlign: 'center', opacity: p ? 1 : 0.35 }}>{p} %</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 8 }}>
          Le <b>pool est partagé</b> entre tous les Archontes : il existe {Object.values(POOL_COPIES).join(' / ')} exemplaires de chaque champion à 1 / 2 / 3 / 4 / 5 or. Si un adversaire collectionne le même champion que vous, il devient plus rare dans votre boutique.
        </p>
        <h3>Améliorer ses champions</h3>
        <p>Trois exemplaires identiques fusionnent automatiquement en une version 2★ (PV ×1,8, PA ×1,5, compétence renforcée) ; trois 2★ donnent un 3★. La fusion fonctionne entre le plateau et la réserve ({BENCH_SIZE} places), et conserve les objets.</p>
        <h3>Synergies</h3>
        <p>Chaque champion appartient à une origine (sa Sphère) et à une ou plusieurs classes. Déployer plusieurs champions <i>différents</i> d’une même synergie active des bonus par paliers. Un même champion ne compte qu’une fois (sauf règle explicite, comme Myrrhine pour les Nomades).</p>
        <h3>Combat</h3>
        <ul>
          <li>Les champions choisissent leurs cibles selon leur rôle (les assassins visent la ligne arrière, les unités à distance achèvent les cibles affaiblies à portée), se déplacent case par case et attaquent automatiquement.</li>
          <li>Chaque attaque et chaque coup reçu remplissent la jauge de mana ; jauge pleine, le champion lance sa compétence.</li>
          <li><b>PA</b> (puissance d’attaque) : dégâts des attaques et des compétences physiques. <b>Puissance</b> (base 100) : multiplie les valeurs de base des compétences (affichées en violet).</li>
          <li>Armure et résistance magique réduisent les dégâts physiques et magiques : dégâts × 100 / (100 + résistance). Les dégâts bruts les ignorent.</li>
          <li>Après {COMBAT.overtimeStart} s, l’<b>Embrasement</b> augmente les dégâts et réduit les soins ; à {COMBAT.hardLimit} s, le combat est déclaré nul.</li>
          <li>Après un étourdissement, une courte fenêtre réduit la durée du suivant : aucun contrôle ne peut être permanent.</li>
        </ul>
        <h3>Objets</h3>
        <p>8 composants se combinent en 36 objets (voir l’Encyclopédie). Glissez un objet de votre réserve sur un champion. Les objets ne se retirent qu’en vendant le champion (ils reviennent dans la réserve) ou avec une Clé de démontage.</p>
        <h3>Adversaires</h3>
        <p>Les Archontes suivent les mêmes règles que vous (or, niveaux, pool, limites). Ils n’ont accès qu’aux informations publiques : les plateaux observés lors des combats précédents, jamais votre boutique ni vos décisions en cours. La difficulté modifie la qualité de leurs décisions, pas la force de leurs unités.</p>
      </div>
    </PageFrame>
  );
}

export function SettingsScreen(): JSX.Element {
  const c = useController();
  const s = c.settings;
  return (
    <PageFrame title="Paramètres">
      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section>
          <h3 style={{ color: 'var(--gold)', marginBottom: 8 }}>Audio</h3>
          <VolumeSliders />
        </section>
        <section>
          <h3 style={{ color: 'var(--gold)', marginBottom: 8 }}>Affichage</h3>
          <label className="row" style={{ marginBottom: 6 }}>
            <input type="checkbox" checked={s.showDamageNumbers} onChange={(e) => c.updateSettings({ showDamageNumbers: e.target.checked })} /> Afficher les nombres de dégâts et de soins
          </label>
          <label className="row" style={{ marginBottom: 6 }}>
            <input type="checkbox" checked={s.reduceMotion} onChange={(e) => c.updateSettings({ reduceMotion: e.target.checked })} /> Réduire les animations (flashs, tremblements)
          </label>
          <div className="row">
            Vitesse de combat par défaut
            <div className="seg">
              {([1, 2, 3] as const).map((v) => (
                <button key={v} className={s.combatSpeed === v ? 'on' : ''} onClick={() => c.updateSettings({ combatSpeed: v })}>
                  ×{v}
                </button>
              ))}
            </div>
          </div>
        </section>
        <section>
          <h3 style={{ color: 'var(--gold)', marginBottom: 8 }}>Données</h3>
          <p style={{ color: 'var(--text-dim)', margin: '0 0 8px' }}>
            {storageAvailable() ? 'Les paramètres, statistiques et la partie en cours sont enregistrés localement dans ce navigateur.' : 'Le stockage local est indisponible : rien ne sera conservé après fermeture.'}
          </p>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm('Effacer paramètres, statistiques et partie en cours ?')) {
                resetAllData();
                location.reload();
              }
            }}
          >
            Réinitialiser toutes les données
          </button>
        </section>
      </div>
    </PageFrame>
  );
}

export function CreditsScreen(): JSX.Element {
  return (
    <PageFrame title="Crédits">
      <div className="prose" style={{ maxWidth: 760 }}>
        <p>
          <b>Orrhéa — Tactiques des Sphères</b> est une création originale : univers, personnages, synergies, objets, illustrations procédurales, musique et effets sonores ont été conçus et produits pour ce projet.
        </p>
        <p>Le jeu s’inspire des grands principes de conception du genre « auto-battler » (recrutement, synergies, économie, positionnement), sans reprendre aucun nom, personnage, visuel, texte ou son d’une œuvre existante.</p>
        <h3>Technique</h3>
        <ul>
          <li>Moteur de combat déterministe et données déclaratives en TypeScript.</li>
          <li>Interface en React, rendu du plateau en Canvas 2D (personnages dessinés de façon procédurale).</li>
          <li>Bande-son et bruitages synthétisés hors ligne par un synthétiseur DSP écrit pour le jeu.</li>
          <li>Polices : Cinzel et Alegreya Sans (SIL Open Font License).</li>
          <li>Bibliothèque d’interface : React (licence MIT).</li>
        </ul>
        <h3>Conception, développement, art technique, musique et tests</h3>
        <p>Réalisé avec Claude Code (Anthropic), pour Cambr.IA.</p>
      </div>
    </PageFrame>
  );
}
