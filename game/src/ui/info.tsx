/**
 * Contenus d'information : info-bulles et fiche détaillée des champions, objets et synergies.
 */
import type { ReactNode } from 'react';
import { COMPONENTS, ITEMS, combine, findConsumable, findItem, getChampion, getTrait, CHAMPIONS } from '../core/content';
import { ROLE_LABELS } from '../core/defs';
import { STAR_AD_MULT, STAR_HP_MULT, sellValue } from '../config/balance';
import { fmt } from '../combat/values';
import { statText } from '../core/statText';
import { Desc, abilityDescOpts, apScaledKeys } from './text';
import { ChampionPortrait, Icon, ItemIcon, Stars, TraitIcon, costColor } from './common';
import type { CombatUnit } from '../combat/unit';

export function ItemTip({ id }: { id: string }): JSX.Element {
  const it = findItem(id);
  if (!it) {
    const c = findConsumable(id);
    return (
      <div>
        <h4>{c?.name ?? id}</h4>
        <div className="muted">Consommable</div>
        <div>{c?.desc}</div>
      </div>
    );
  }
  return (
    <div>
      <h4 style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <ItemIcon id={id} size={22} /> {it.name}
      </h4>
      <div style={{ color: 'var(--cyan)', fontSize: 13 }}>{it.stats.map(statText).join(' · ')}</div>
      {it.kind === 'combined' ? <div style={{ marginTop: 4 }}>{it.desc}</div> : <div className="muted" style={{ marginTop: 4 }}>Composant : combinez-en deux pour créer un objet.</div>}
      {it.recipe ? (
        <div className="muted" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          Recette : <ItemIcon id={it.recipe[0]} size={18} /> + <ItemIcon id={it.recipe[1]} size={18} />
        </div>
      ) : (
        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: '3px 8px', fontSize: 12 }}>
          {COMPONENTS.map((c) => {
            const res = combine(it.id, c.id)!;
            return (
              <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                + <ItemIcon id={c.id} size={14} /> = <ItemIcon id={res.id} size={16} />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TraitTip({ id, count }: { id: string; count: number }): JSX.Element {
  const t = getTrait(id);
  const members = CHAMPIONS.filter((c) => c.traits.includes(id));
  return (
    <div>
      <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TraitIcon id={id} size={20} /> {t.name} <span className="muted">({t.kind === 'origin' ? 'origine' : 'classe'})</span>
      </h4>
      <div style={{ marginBottom: 6 }}>{t.desc}</div>
      {t.levels.map((lvl, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 6, opacity: count >= t.thresholds[i] ? 1 : 0.55, fontSize: 13, marginBottom: 3 }}>
          <b style={{ color: count >= t.thresholds[i] ? 'var(--gold-bright)' : 'inherit' }}>{t.thresholds[i]}</b>
          <span>{lvl.desc}</span>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
        {members.map((c) => (
          <span key={c.id} className="mini-portrait" style={{ '--c': costColor(c.cost), width: 26, height: 26 } as React.CSSProperties}>
            <ChampionPortrait defId={c.id} />
          </span>
        ))}
      </div>
      <div className="muted" style={{ marginTop: 6 }}>Contre : {t.counter}</div>
    </div>
  );
}

export function ChampionTip({ defId, star = 1, items = [] }: { defId: string; star?: number; items?: readonly string[] }): JSX.Element {
  const c = getChampion(defId);
  return (
    <div style={{ minWidth: 240 }}>
      <h4>
        {c.name} <Stars n={star} /> <span className="muted">· {c.cost} or</span>
      </h4>
      <div className="muted">{c.title}</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '5px 0' }}>
        {c.traits.map((t) => (
          <span key={t} className="badge">
            <TraitIcon id={t} /> {getTrait(t).name}
          </span>
        ))}
        <span className="badge">{ROLE_LABELS[c.role]}</span>
      </div>
      <div style={{ fontSize: 13 }}>
        <b style={{ color: 'var(--gold)' }}>{c.ability.name}</b> — <Desc text={c.ability.desc} opts={abilityDescOpts(c.ability, star)} />
      </div>
      {c.passive?.desc ? (
        <div style={{ fontSize: 13, marginTop: 4 }}>
          <b style={{ color: 'var(--cyan)' }}>{c.passive.name}</b> — <Desc text={c.passive.desc} opts={{ values: c.passive.values, star, apKeys: apScaledKeys(c.passive.triggers ?? []) }} />
        </div>
      ) : null}
      {items.length ? (
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {items.map((i, k) => (
            <ItemIcon key={k} id={i} size={22} />
          ))}
        </div>
      ) : null}
      <div className="muted" style={{ marginTop: 4 }}>Clic : fiche détaillée</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

/** Fiche complète d'un champion ; si une unité de combat est fournie, affiche ses valeurs effectives. */
export function ChampionSheet({ defId, star, items, live, onSell }: { defId: string; star: number; items: readonly string[]; live?: CombatUnit | null; onSell?: () => void }): JSX.Element {
  const c = getChampion(defId);
  const s = c.stats;
  const hp = live ? Math.round(live.stats.maxHp) : Math.round(s.hp * STAR_HP_MULT[star]);
  const ad = live ? Math.round(live.stats.ad) : Math.round(s.ad * STAR_AD_MULT[star]);
  const ap = live ? Math.round(live.stats.ap) : 100;
  return (
    <div className="sheet">
      <div>
        <div className="sheet-portrait" style={{ '--c': costColor(c.cost) } as React.CSSProperties}>
          <ChampionPortrait defId={defId} />
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {c.traits.map((t) => (
            <span key={t} className="badge" style={{ justifyContent: 'flex-start' }}>
              <TraitIcon id={t} /> {getTrait(t).name}
              {c.countsAs?.[t] ? ` (compte ${c.countsAs[t]})` : ''}
            </span>
          ))}
          <span className="badge">{ROLE_LABELS[c.role]}</span>
          {c.secondaryRole ? <span className="badge">{ROLE_LABELS[c.secondaryRole]}</span> : null}
          <span className="badge">
            <Icon k="gold" size={16} /> {c.cost} or · revente {sellValue(c.cost, star)}
          </span>
        </div>
      </div>
      <div>
        <h2>
          {c.name} <Stars n={star} />
        </h2>
        <div className="title">{c.title}</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>{c.lore}</div>
        <div className="stat-grid">
          <Stat label="PV" value={hp} />
          <Stat label="PA" value={ad} />
          <Stat label="Puissance" value={ap} />
          <Stat label="Vit. d’attaque" value={fmt(Math.round((live ? live.stats.as : s.as) * 100) / 100)} />
          <Stat label="Armure" value={Math.round(live ? live.stats.armor : s.armor)} />
          <Stat label="Rés. magique" value={Math.round(live ? live.stats.mr : s.mr)} />
          <Stat label="Portée" value={live ? live.stats.range : s.range} />
          <Stat label="Mana" value={`${s.mana[0]} / ${s.mana[1]}`} />
          <Stat label="Critique" value={`${Math.round((live ? live.stats.critChance : (s.critChance ?? 25) / 100) * 100)} %`} />
        </div>
        {live ? (
          <div className="muted" style={{ fontSize: 13 }}>
            En combat : {Math.round(live.hp)} / {Math.round(live.stats.maxHp)} PV · bouclier {Math.round(live.shieldTotal)} · {Math.round(live.combat.damageDealt)} dégâts infligés
            {live.statuses.length ? ` · effets : ${[...new Set(live.statuses.map((x) => x.tag ?? x.kind))].join(', ')}` : ''}
          </div>
        ) : null}
        <div className="ability">
          <h4>
            {c.ability.name}
            <span className="mana">{c.stats.mana[1]} mana</span>
          </h4>
          <Desc text={c.ability.desc} opts={abilityDescOpts(c.ability, star, ap)} />
        </div>
        {c.passive?.desc ? (
          <div className="ability">
            <h4 style={{ color: 'var(--cyan)' }}>{c.passive.name} (passif)</h4>
            <Desc text={c.passive.desc} opts={{ values: c.passive.values, star, ap, apKeys: apScaledKeys(c.passive.triggers ?? []) }} />
          </div>
        ) : null}
        <div style={{ marginTop: 10, fontSize: 14 }}>
          <b style={{ color: 'var(--gold)' }}>Rôle : </b>
          {c.roleNote}
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="muted">Objets équipés :</span>
          {items.length ? items.map((i, k) => <ItemIcon key={k} id={i} size={26} />) : <span className="muted">aucun</span>}
          <span className="muted" style={{ marginLeft: 12 }}>Conseillés :</span>
          {(c.preferredItems ?? []).slice(0, 4).map((i) => (
            <ItemIcon key={i} id={i} size={22} />
          ))}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Les valeurs en violet sont multipliées par la Puissance (base 100). Rangs : 1★ / 2★ / 3★.
        </div>
        {onSell ? (
          <div style={{ marginTop: 10 }}>
            <button className="btn danger small" onClick={onSell}>
              Vendre pour {sellValue(c.cost, star)} or <span className="kbd">E</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function allItemsSorted(): typeof ITEMS {
  return ITEMS;
}
