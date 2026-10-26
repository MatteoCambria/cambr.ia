/**
 * Vérifications dans un vrai navigateur (Chromium piloté par Playwright).
 *
 * Usage :
 *   npm run build && npm run preview          # dans un premier terminal
 *   node tools/qa/browser.mjs [url] [--quick]  # url par défaut : http://localhost:4174/?qa
 *
 * Playwright n'est pas une dépendance du jeu : installez-le à part si nécessaire
 * (`npm i -D playwright && npx playwright install chromium`).
 * Le paramètre `?qa` expose le contrôleur (window.__orrhea) pour piloter et inspecter la partie.
 *
 * Sorties : reports/qa/*.png et reports/qa/summary.json. Code de sortie 1 en cas d'échec.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const URL_ = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:4174/?qa';
const OUT = 'reports/qa/';
mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${name}${detail ? '  — ' + detail : ''}`);
};
const wait = (page, ms) => page.waitForTimeout(ms);

async function open(browser, w = 1600, h = 900) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${w}×${h}] console.error : ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${w}×${h}] exception : ${e.message}`));
  await page.goto(URL_, { waitUntil: 'networkidle' });
  return page;
}

const state = (page) =>
  page.evaluate(() => {
    const c = window.__orrhea.controller;
    const me = c.me;
    return {
      screen: c.screen,
      phase: c.state?.phase ?? null,
      round: c.state?.roundIndex ?? null,
      modal: c.modal?.kind ?? null,
      live: !!c.live,
      gold: me?.gold ?? null,
      hp: me?.hp ?? null,
      board: me ? me.board.map((u) => `${u.defId}@${u.col},${u.row}`) : [],
      bench: me ? me.bench.map((u) => u && u.defId) : [],
      items: me ? [...me.items] : [],
      settings: { ...c.settings },
    };
  });

async function startGame(page, { unlimited = true } = {}) {
  await page.click('text=Jouer');
  if (unlimited) await page.click('text=Illimité');
  await page.click('text=Lancer la Convergence');
  await wait(page, 500);
}

async function passCarousel(page) {
  await wait(page, 3200);
  const offers = await page.$$('.offer:not(.taken) .card');
  if (offers.length) await offers[0].click();
  await wait(page, 2400);
}

// ── 1. Navigation et paramètres ────────────────────────────────────────────
async function navigation(browser) {
  const page = await open(browser);
  check('menu principal affiché', await page.isVisible('text=Jouer'));
  await page.screenshot({ path: OUT + '01-menu.png' });
  for (const [btn, shot] of [
    ['Encyclopédie', '02-encyclopedie'],
    ['Règles du jeu', '03-regles'],
    ['Paramètres', '04-parametres'],
    ['Crédits', '05-credits'],
  ]) {
    await page.click(`text=${btn}`);
    await wait(page, 300);
    const s = await state(page);
    check(`écran ${btn}`, s.screen !== 'menu', s.screen);
    await page.screenshot({ path: OUT + shot + '.png' });
    await page.click('button:has-text("Retour")');
    await wait(page, 200);
    check(`retour au menu depuis ${btn}`, (await state(page)).screen === 'menu');
  }
  await page.click('text=Mode entraînement');
  await wait(page, 400);
  await page.click('text=Assassins contre Gardiens');
  await page.click('button:has-text("Lancer")');
  await wait(page, 3500);
  check('mode entraînement : combat lancé', (await state(page)).screen === 'training');
  await page.screenshot({ path: OUT + '06-entrainement.png' });
  await page.click('button:has-text("Menu")');
  await wait(page, 200);

  // paramètre persistant après rechargement
  await page.click('text=Paramètres');
  const before = (await state(page)).settings.showDamageNumbers;
  await page.click('text=Afficher les nombres de dégâts et de soins');
  await page.reload({ waitUntil: 'networkidle' });
  const after = (await state(page)).settings.showDamageNumbers;
  check('paramètre conservé après rechargement', after === !before, `${before} → ${after}`);
  await page.evaluate(() => window.__orrhea.controller.updateSettings({ showDamageNumbers: true }));
  await page.close();
}

// ── 2. Première partie : guide, interactions, raccourcis ──────────────────
async function interactions(browser) {
  const page = await open(browser);
  await startGame(page);
  check('guide « Premiers pas » à la première partie', await page.isVisible('.first-steps'));
  const t0 = await page.evaluate(() => window.__orrhea.controller.timer);
  await wait(page, 1200);
  const t1 = await page.evaluate(() => window.__orrhea.controller.timer);
  check('chrono arrêté pendant le guide', t0 === t1);
  await page.screenshot({ path: OUT + '10-premiers-pas.png' });
  await page.keyboard.press('Escape');
  await wait(page, 200);
  check('guide fermé par Échap', !(await page.isVisible('.first-steps')));

  await passCarousel(page);
  check('carrousel : champion obtenu', (await state(page)).bench.some(Boolean));
  await page.evaluate(() => {
    const c = window.__orrhea.controller;
    c.me.gold = 20;
    c.notify();
  });
  await wait(page, 200);
  const cards = await page.$$('.shop-cards .card:not(.empty)');
  await cards[0].click();
  await wait(page, 250);
  let s = await state(page);
  check('achat par clic', s.bench.filter(Boolean).length >= 2, JSON.stringify(s.bench.filter(Boolean)));

  const benchIdx = s.bench.findIndex(Boolean);
  const from = await page.evaluate((i) => window.__orrhea.boardBus.debug.benchCenter(i), benchIdx);
  const to = await page.evaluate(() => window.__orrhea.boardBus.debug.hexCenter(3, 0));
  await page.mouse.move(from.x, from.y - 20);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y - 40, { steps: 5 });
  await page.mouse.move(to.x, to.y - 10, { steps: 12 });
  await page.screenshot({ path: OUT + '11-glisser.png' });
  await page.mouse.up();
  await wait(page, 250);
  s = await state(page);
  check('glisser réserve → plateau', s.board.some((b) => b.endsWith('@3,0')), JSON.stringify(s.board));

  const hov = to;
  await page.mouse.move(hov.x, hov.y - 30);
  await wait(page, 300);
  check('info-bulle au survol', !!(await page.$('.tip')));
  await page.mouse.click(hov.x, hov.y - 30);
  await wait(page, 300);
  check('clic : fiche du champion', (await state(page)).modal === 'unit');
  await page.screenshot({ path: OUT + '12-fiche.png' });
  await page.keyboard.press('Escape');
  await wait(page, 200);
  check('Échap ferme la fiche', !(await state(page)).modal);

  const h2 = await page.evaluate(() => window.__orrhea.boardBus.debug.hexCenter(5, 2));
  await page.mouse.move(hov.x, hov.y - 30);
  await page.mouse.down();
  await page.mouse.move(h2.x, h2.y - 10, { steps: 10 });
  await page.mouse.up();
  await wait(page, 200);
  s = await state(page);
  check('déplacement sur le plateau', s.board.some((b) => b.endsWith('@5,2')), JSON.stringify(s.board));

  const nItems = s.items.length;
  const slot = await page.$('.item-slot.filled');
  if (slot && nItems) {
    const bb = await slot.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    await page.mouse.move(h2.x, h2.y - 30, { steps: 12 });
    await page.screenshot({ path: OUT + '13-objet.png' });
    await page.mouse.up();
    await wait(page, 250);
    check('objet glissé sur un champion', (await state(page)).items.length === nItems - 1);
  } else check('objet glissé sur un champion', false, 'aucun objet disponible');

  const shop = await (await page.$('.shop-panel')).boundingBox();
  const g0 = (await state(page)).gold;
  await page.mouse.move(h2.x, h2.y - 30);
  await page.mouse.down();
  await page.mouse.move(shop.x + shop.width / 2, shop.y + shop.height / 2, { steps: 12 });
  await page.mouse.up();
  await wait(page, 250);
  s = await state(page);
  check('vente par dépôt sur la boutique', s.board.length === 0 && s.gold > g0, `or ${g0} → ${s.gold}`);

  const g1 = s.gold;
  await page.keyboard.press('d');
  await wait(page, 150);
  check('raccourci D (actualiser, 2 or)', (await state(page)).gold === g1 - 2);
  await page.keyboard.press('f');
  await wait(page, 150);
  check('raccourci F (XP, 4 or)', (await state(page)).gold === g1 - 6);
  await page.keyboard.press('1');
  await wait(page, 150);
  check('raccourci 1 (recruter)', (await state(page)).bench.filter(Boolean).length >= 1);
  await page.keyboard.press('Escape');
  await wait(page, 200);
  check('Échap : menu pause', (await state(page)).modal === 'pause');
  await page.screenshot({ path: OUT + '14-pause.png' });

  // sauvegarde et reprise
  const roundBefore = (await state(page)).round;
  await page.click('text=Sauvegarder et quitter');
  await wait(page, 300);
  check('retour au menu après sauvegarde', (await state(page)).screen === 'menu');
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('text=Continuer la partie');
  await wait(page, 500);
  s = await state(page);
  check('reprise de la partie sauvegardée', s.screen === 'game' && s.round === roundBefore, `manche ${roundBefore} → ${s.round}`);
  await page.close();
}

// ── 3. Résolutions ─────────────────────────────────────────────────────────
async function resolutions(browser) {
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    const page = await open(browser, w, h);
    await page.evaluate(() => window.__orrhea.controller.updateSettings({ tutorialSeen: true }));
    await startGame(page);
    await passCarousel(page);
    await page.evaluate(() => {
      const c = window.__orrhea.controller;
      const me = c.me;
      me.level = 8;
      me.gold = 150;
      for (let r = 0; r < 5; r++) {
        c.reroll();
        for (let i = 0; i < 5; i++) c.buy(i);
      }
      for (const u of me.bench.filter(Boolean)) c.quickMove(u.uid);
      me.items.push('fendeur', 'coeur_geant', 'sablier');
      c.notify();
    });
    await wait(page, 400);
    await page.screenshot({ path: OUT + `20-preparation-${w}x${h}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || document.documentElement.scrollHeight > window.innerHeight);
    check(`${w}×${h} : pas de défilement de la page`, !overflow);
    await page.keyboard.press(' ');
    await wait(page, 3500);
    check(`${w}×${h} : combat en cours`, (await state(page)).live);
    await page.screenshot({ path: OUT + `21-combat-${w}x${h}.png` });
    await page.close();
  }
}

// ── 4. Partie complète ─────────────────────────────────────────────────────
async function fullGame(browser) {
  const page = await open(browser);
  await page.evaluate(() => window.__orrhea.controller.updateSettings({ tutorialSeen: true }));
  await startGame(page);
  await page.evaluate(() => window.__orrhea.controller.setSpeed(3));
  const t0 = Date.now();
  let combats = 0;
  for (let step = 0; step < 600; step++) {
    const s = await state(page);
    if (s.screen === 'end') break;
    if (s.phase === 'carousel') {
      const offers = await page.$$('.offer:not(.taken) .card');
      if (offers.length) await offers[0].click({ timeout: 2000 }).catch(() => {});
      await wait(page, 300);
      continue;
    }
    if (s.phase === 'planning' && !s.live) {
      // stratégie simple : acheter, monter de niveau, déployer, équiper, combattre
      await page.evaluate(() => {
        const c = window.__orrhea.controller;
        const me = c.me;
        for (let i = 0; i < 5; i++) if (me.gold >= 3 || me.bench.filter(Boolean).length < 6) c.buy(i);
        if (me.gold >= 14 && me.level < 8) c.buyXp();
        for (const u of me.bench.filter(Boolean)) if (me.board.length < me.level) c.quickMove(u.uid);
        for (let k = 0; k < 6 && me.items.length && me.board.length; k++) c.equip(0, me.board[k % me.board.length].uid);
        const bench = me.bench.filter(Boolean);
        if (bench.length > 6) c.sell(bench[0].uid);
      });
      if (s.round === 12) await page.screenshot({ path: OUT + '30-partie-preparation.png' });
      await page.keyboard.press(' ');
      combats++;
      await wait(page, 1200);
      if (s.round === 12) await page.screenshot({ path: OUT + '31-partie-combat.png' });
      continue;
    }
    await wait(page, 400);
  }
  await wait(page, 1500);
  await page.screenshot({ path: OUT + '39-fin.png' });
  const end = await page.evaluate(() => {
    const c = window.__orrhea.controller;
    const st = c.endState ?? c.state;
    return { screen: c.screen, rounds: st?.roundIndex, placement: st?.players[0].placement };
  });
  check('partie complète jusqu’à l’écran de fin', end.screen === 'end', `${end.rounds} manches, place ${end.placement}, ${combats} préparations, ${Math.round((Date.now() - t0) / 1000)} s`);
  const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null));
  if (heap !== null) check('mémoire JS en fin de partie', heap < 300, `${heap} Mo`);
  await page.close();
}

const browser = await chromium.launch();
try {
  await navigation(browser);
  await interactions(browser);
  await resolutions(browser);
  if (!QUICK) await fullGame(browser);
} catch (e) {
  check('exécution du scénario', false, String(e?.message ?? e).split('\n')[0]);
} finally {
  await browser.close();
}
check('aucune erreur JavaScript ni console', errors.length === 0, errors.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r.ok).length;
writeFileSync(OUT + 'summary.json', JSON.stringify({ url: URL_, date: new Date().toISOString(), passed: results.length - failed, failed, results, errors }, null, 1));
console.log(`\n${results.length - failed}/${results.length} vérifications réussies — captures dans ${OUT}`);
process.exit(failed ? 1 : 0);
