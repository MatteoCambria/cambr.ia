import { describe, expect, it } from 'vitest';
import { buildCombat, computeTraits, type BoardUnitSpec } from '../src/combat/setup';
import { CombatSim, mitigation } from '../src/combat/sim';
import { CHAMPIONS, COMBINED, SUMMONS, getChampion } from '../src/core/content';
import { COMBAT, STAR_HP_MULT } from '../src/config/balance';
import { Rng } from '../src/core/rng';
import type { UnitIdentity } from '../src/combat/unit';

function dummyIdent(over: Partial<UnitIdentity['base']> = {}): UnitIdentity {
  return {
    defId: 'dummy',
    name: 'Mannequin',
    kind: 'creature',
    star: 1,
    cost: 0,
    traits: [],
    items: [],
    look: { body: 'construct', head: 'bare', weapon: 'none', primary: '#888', secondary: '#444', accent: '#fff' },
    base: { hp: 1000, ad: 0, as: 0.2, armor: 0, mr: 0, range: 1, mana: [0, 0], ...over },
  };
}

function bareSim(seed = 1): CombatSim {
  return new CombatSim({ seed, stage: 3, summons: SUMMONS });
}

describe('formules de dégâts', () => {
  it('l’armure réduit les dégâts physiques selon 100 / (100 + armure)', () => {
    expect(mitigation(0)).toBe(1);
    expect(mitigation(100)).toBeCloseTo(0.5);
    expect(mitigation(-50)).toBeGreaterThan(1);
    const sim = bareSim();
    const a = sim.addUnit(dummyIdent({ ad: 100 }), 0, { col: 3, row: 4 }, []);
    const b = sim.addUnit(dummyIdent({ armor: 100, mr: 50 }), 1, { col: 3, row: 3 }, []);
    const r1 = sim.dealDamage({ src: a, tgt: b, amount: 100, type: 'physical' });
    expect(r1.dealt).toBeCloseTo(50);
    const r2 = sim.dealDamage({ src: a, tgt: b, amount: 150, type: 'magic' });
    expect(r2.dealt).toBeCloseTo(100);
    const r3 = sim.dealDamage({ src: a, tgt: b, amount: 70, type: 'true' });
    expect(r3.dealt).toBeCloseTo(70);
    expect(b.hp).toBeCloseTo(1000 - 220);
  });

  it('un coup critique multiplie les dégâts par les dégâts critiques', () => {
    const sim = bareSim();
    const a = sim.addUnit(dummyIdent({ critChance: 100 }), 0, { col: 3, row: 4 }, []);
    const b = sim.addUnit(dummyIdent(), 1, { col: 3, row: 3 }, []);
    const r = sim.dealDamage({ src: a, tgt: b, amount: 100, type: 'physical', isAttack: true, canCrit: true });
    expect(r.crit).toBe(true);
    expect(r.dealt).toBeCloseTo(100 * COMBAT.baseCritDamage);
  });

  it('les compétences ne sont critiques que si une règle l’autorise', () => {
    const sim = bareSim();
    const a = sim.addUnit(dummyIdent({ critChance: 100 }), 0, { col: 3, row: 4 }, []);
    const b = sim.addUnit(dummyIdent(), 1, { col: 3, row: 3 }, []);
    expect(sim.dealDamage({ src: a, tgt: b, amount: 100, type: 'magic', isAbility: true, canCrit: true }).crit).toBe(false);
    a.permMods.push({ stat: 'abilityCrit', value: 1 });
    a.invalidate();
    expect(sim.dealDamage({ src: a, tgt: b, amount: 100, type: 'magic', isAbility: true, canCrit: true }).crit).toBe(true);
  });

  it('la réduction de dégâts est plafonnée', () => {
    const sim = bareSim();
    const a = sim.addUnit(dummyIdent(), 0, { col: 3, row: 4 }, []);
    const b = sim.addUnit(dummyIdent(), 1, { col: 3, row: 3 }, [], [{ stat: 'damageReduction', value: 500 }]);
    const r = sim.dealDamage({ src: a, tgt: b, amount: 100, type: 'true' });
    expect(r.dealt).toBeCloseTo(100 * (1 - COMBAT.maxDamageReduction));
  });
});

describe('boucliers, soins et mort', () => {
  it('le bouclier absorbe avant les PV et déclenche shieldBroken', () => {
    const sim = bareSim();
    const a = sim.addUnit(dummyIdent(), 0, { col: 3, row: 4 }, []);
    const b = sim.addUnit(dummyIdent(), 1, { col: 3, row: 3 }, []);
    sim.shield(null, b, 100, 5, false);
    sim.dealDamage({ src: a, tgt: b, amount: 60, type: 'true' });
    expect(b.hp).toBe(1000);
    expect(b.shieldTotal).toBeCloseTo(40);
    sim.dealDamage({ src: a, tgt: b, amount: 60, type: 'true' });
    expect(b.shieldTotal).toBe(0);
    expect(b.hp).toBeCloseTo(980);
  });

  it('les soins ne dépassent jamais les PV max et la Blessure les réduit', () => {
    const sim = bareSim();
    const b = sim.addUnit(dummyIdent(), 1, { col: 3, row: 3 }, []);
    b.hp = 900;
    expect(sim.heal(null, b, 500)).toBeCloseTo(100);
    expect(b.hp).toBe(1000);
    b.hp = 500;
    b.permMods.push({ stat: 'healReceived', value: -50 });
    b.invalidate();
    expect(sim.heal(null, b, 100)).toBeCloseTo(50);
  });

  it('une unité morte ne lance pas sa compétence et n’agit plus', () => {
    const sim = bareSim();
    const caster = sim.addUnit(
      { ...dummyIdent({ mana: [100, 100], range: 4 }), ability: getChampion('heliodore').ability },
      0,
      { col: 3, row: 6 },
      [],
    );
    const enemy = sim.addUnit(dummyIdent({ ad: 0 }), 1, { col: 3, row: 1 }, []);
    sim.step(); // commence l'incantation
    expect(caster.state).toBe('casting');
    sim.dealDamage({ src: enemy, tgt: caster, amount: 5000, type: 'true' });
    expect(caster.alive).toBe(false);
    const before = enemy.hp;
    for (let i = 0; i < 60; i++) sim.step();
    expect(enemy.hp).toBe(before);
    expect(sim.done).toBe(true);
    expect(sim.winner).toBe(1);
  });
});

describe('contrôles', () => {
  it('un étourdissement empêche d’attaquer, et la fenêtre de grâce réduit le suivant', () => {
    const sim = bareSim();
    const a = sim.addUnit(dummyIdent({ ad: 50, as: 2 }), 0, { col: 3, row: 4 }, []);
    const b = sim.addUnit(dummyIdent(), 1, { col: 3, row: 3 }, []);
    const ctx = { casterId: b.id, targetId: a.id, anchor: null, star: 1, values: undefined, eventAmount: 0, killed: false, source: 'ability' as const, label: '' };
    sim.applyStatus(b, a, { kind: 'stun', duration: 1 }, ctx);
    for (let i = 0; i < 25; i++) sim.step();
    expect(b.hp).toBe(1000);
    for (let i = 0; i < 10; i++) sim.step();
    sim.applyStatus(b, a, { kind: 'stun', duration: 1 }, ctx);
    const st = a.statuses.find((s) => s.kind === 'stun')!;
    expect(st.remaining).toBeCloseTo(1 - COMBAT.stunGraceReduction);
  });

  it('l’immunité aux contrôles bloque les étourdissements', () => {
    const sim = bareSim();
    const a = sim.addUnit(dummyIdent(), 0, { col: 3, row: 4 }, []);
    const b = sim.addUnit(dummyIdent(), 1, { col: 3, row: 3 }, []);
    const ctx = { casterId: b.id, targetId: a.id, anchor: null, star: 1, values: undefined, eventAmount: 0, killed: false, source: 'ability' as const, label: '' };
    sim.applyStatus(a, a, { kind: 'ccImmune', duration: 5 }, ctx);
    sim.applyStatus(b, a, { kind: 'stun', duration: 2 }, ctx);
    expect(a.isStunned).toBe(false);
  });
});

function team(ids: string[], star = 1, items: string[][] = []): BoardUnitSpec[] {
  return ids.map((id, i) => {
    const def = getChampion(id);
    const row = def.position === 'front' ? 0 : 3;
    return { defId: id, star, items: items[i] ?? [], hex: { col: i % 7, row: def.position === 'flex' ? 1 : row } };
  });
}

describe('simulation complète', () => {
  it('est déterministe à graine et état identiques', () => {
    const a = team(['aurel', 'seraphine', 'heliodore', 'gorm', 'calyx']);
    const b = team(['rugor', 'pim', 'tison', 'oriel', 'coralie']);
    const run = () => {
      const sim = buildCombat([{ units: a }, { units: b }], { seed: 77, stage: 3, recordEvents: true });
      const r = sim.run();
      return { r, events: sim.events.length, hp: sim.units.map((u) => Math.round(u.hp * 1000)) };
    };
    const x = run();
    const y = run();
    expect(y).toEqual(x);
  });

  it('tous les combats se terminent avant la limite dure, avec un résultat défini', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 150; i++) {
      const pick = () => rng.shuffle(CHAMPIONS.map((c) => c.id)).slice(0, 2 + rng.int(7));
      const sim = buildCombat([{ units: team(pick(), 1 + rng.int(3)) }, { units: team(pick(), 1 + rng.int(3)) }], { seed: i, stage: 1 + rng.int(7) });
      const r = sim.run();
      expect([0, 1, -1]).toContain(r.winner);
      expect(r.duration).toBeLessThanOrEqual(COMBAT.hardLimit + COMBAT.dt * 2);
      expect(r.aborted).toBe(false);
      for (const u of sim.units) {
        expect(u.hp).toBeLessThanOrEqual(u.stats.maxHp + 1e-6);
        if (!u.alive) expect(u.hp).toBe(0);
      }
    }
  });

  it('chaque champion lance sa compétence sans erreur', () => {
    for (const c of CHAMPIONS) {
      for (const star of [1, 3]) {
        const sim = buildCombat(
          [
            { units: [{ defId: c.id, star, items: ['sablier'], hex: { col: 3, row: 2 } }, { defId: 'aurel', star: 1, items: [], hex: { col: 2, row: 0 } }] },
            {
              units: [],
              creatures: [
                { defId: 'golem_quartz', hex: { col: 3, row: 0 }, level: 3 },
                { defId: 'golem_quartz', hex: { col: 2, row: 1 }, level: 3 },
                { defId: 'golem_quartz', hex: { col: 4, row: 1 }, level: 3 },
              ],
            },
          ],
          { seed: 5, stage: 4 },
        );
        sim.run();
        const unit = sim.units.find((u) => u.ident.defId === c.id)!;
        expect(sim.warnings, c.id).toEqual([]);
        expect(unit.combat.casts, `${c.id} ${star}★ doit lancer sa compétence`).toBeGreaterThan(0);
      }
    }
  });

  it('les rangs augmentent les PV selon la configuration', () => {
    const def = getChampion('aurel');
    for (const star of [1, 2, 3]) {
      const sim = buildCombat([{ units: [{ defId: 'aurel', star, items: [], hex: { col: 0, row: 0 } }] }, { units: [] }], { seed: 1, stage: 1 });
      expect(sim.units[0].baseHp).toBeCloseTo(def.stats.hp * STAR_HP_MULT[star]);
    }
  });

  it('chaque objet combiné s’équipe et fonctionne en combat', () => {
    for (const it of COMBINED) {
      const sim = buildCombat(
        [
          { units: [{ defId: 'pulsara', star: 2, items: [it.id], hex: { col: 3, row: 3 } }, { defId: 'grumhald', star: 2, items: [it.id], hex: { col: 3, row: 0 } }] },
          { units: team(['gorm', 'murene', 'iota']) },
        ],
        { seed: 3, stage: 3 },
      );
      const r = sim.run();
      expect(sim.warnings, it.id).toEqual([]);
      expect([0, 1, -1]).toContain(r.winner);
    }
  });
});

describe('synergies', () => {
  it('un champion n’est compté qu’une fois, Myrrhine compte double pour les Nomades', () => {
    const t = computeTraits([{ defId: 'pim' }, { defId: 'pim' }, { defId: 'kesh' }]);
    expect(t.find((x) => x.id === 'nomade')!.count).toBe(2);
    const t2 = computeTraits([{ defId: 'myrrhine' }, { defId: 'pim' }, { defId: 'kesh' }]);
    const nomade = t2.find((x) => x.id === 'nomade')!;
    expect(nomade.count).toBe(4);
    expect(nomade.level).toBe(2);
  });

  it('le Rouage invoque un automate au début du combat', () => {
    const sim = buildCombat([{ units: team(['tic', 'bertrade']) }, { units: team(['aurel']) }], { seed: 2, stage: 2 });
    sim.step();
    expect(sim.units.some((u) => u.ident.defId === 'rouage_automaton')).toBe(true);
  });

  it('le Gardien protège les alliés adjacents au début du combat (positionnement)', () => {
    const near = buildCombat([{ units: [{ defId: 'aurel', star: 1, items: [], hex: { col: 3, row: 0 } }, { defId: 'brindille', star: 1, items: [], hex: { col: 0, row: 0 } }, { defId: 'pim', star: 1, items: [], hex: { col: 3, row: 1 } }] }, { units: [] }], { seed: 1, stage: 2 });
    const far = buildCombat([{ units: [{ defId: 'aurel', star: 1, items: [], hex: { col: 3, row: 0 } }, { defId: 'brindille', star: 1, items: [], hex: { col: 0, row: 0 } }, { defId: 'pim', star: 1, items: [], hex: { col: 6, row: 3 } }] }, { units: [] }], { seed: 1, stage: 2 });
    near.step();
    far.step();
    const pimNear = near.units.find((u) => u.ident.defId === 'pim')!;
    const pimFar = far.units.find((u) => u.ident.defId === 'pim')!;
    expect(pimNear.stats.armor).toBeGreaterThan(pimFar.stats.armor);
  });

  it('le Tireur inflige plus de dégâts de loin (positionnement)', () => {
    const mk = (row: number) => {
      const sim = buildCombat([{ units: [{ defId: 'seraphine', star: 1, items: [], hex: { col: 3, row } }, { defId: 'pim', star: 1, items: [], hex: { col: 0, row: 3 } }] }, { units: [] }], { seed: 1, stage: 2 });
      const s = sim.units[0];
      const dummy = sim.addUnit(dummyIdent(), 1, { col: 3, row: 3 }, []);
      return sim.dealDamage({ src: s, tgt: dummy, amount: 100, type: 'true' }).dealt;
    };
    expect(mk(3)).toBeGreaterThan(mk(0));
  });
});
