/* ==========================================================================
   Cambr.IA — interactions & narration au défilement
   Dépendances locales : GSAP 3.13 (+ ScrollTrigger, SplitText), Lenis 1.3
   Principe : le contenu reste lisible sans JS et en mouvement réduit ;
   les animations ne font qu'enrichir l'histoire.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotion = () => mqReduce.matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  if (!hasGsap) {
    root.classList.remove('motion-ok');
    root.classList.add('is-ready', 'is-loaded');
  }

  const fmt = new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const HEADER_OFFSET = () => -(parseInt(getComputedStyle(root).getPropertyValue('--header-h'), 10) || 72);

  /* ---------- Défilement fluide ---------- */
  let lenis = null;
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
  }
  if (hasGsap && window.Lenis && !reduceMotion()) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const scrollToTarget = (target) => {
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { offset: HEADER_OFFSET(), duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  };

  // Liens d'ancre internes : défilement fluide + focus pour les lecteurs d'écran.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    closeMenu(false);
    scrollToTarget(target);
    history.pushState(null, '', `#${id}`);
    const focusTarget = target.matches('section, header, div') ? target : null;
    if (focusTarget) {
      focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }
  });

  /* ---------- Menu mobile ---------- */
  const menu = $('[data-menu]');
  const menuToggle = $('[data-menu-toggle]');
  const menuLabel = $('[data-menu-label]');
  let lastFocus = null;

  function openMenu() {
    lastFocus = document.activeElement;
    menu.hidden = false;
    menuToggle.setAttribute('aria-expanded', 'true');
    menuLabel.textContent = 'Fermer le menu';
    document.body.classList.add('is-locked');
    if (lenis) lenis.stop();
    if (hasGsap && !reduceMotion()) {
      gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
      gsap.fromTo($$('li', menu), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'expo.out' });
    }
    $('a', menu)?.focus();
  }
  function closeMenu(restoreFocus = true) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuLabel.textContent = 'Ouvrir le menu';
    document.body.classList.remove('is-locked');
    if (lenis) lenis.start();
    if (restoreFocus && lastFocus) lastFocus.focus();
  }
  menuToggle?.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu && !menu.hidden) closeMenu();
    if (e.key === 'Tab' && menu && !menu.hidden) {
      // Piège de focus : menu + bouton de fermeture.
      const items = [menuToggle, ...$$('a', menu)];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 960) closeMenu(false); });

  /* ---------- En-tête : fond au défilement, masqué en descente ---------- */
  const header = $('[data-header]');
  let lastY = window.scrollY;
  const onScrollHeader = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    const menuOpen = menu && !menu.hidden;
    const focusInside = header.contains(document.activeElement);
    if (goingDown && y > 600 && !menuOpen && !focusInside) header.classList.add('is-hidden');
    else if (goingUp || y < 600) header.classList.remove('is-hidden');
    lastY = y;
    root.style.setProperty('--progress', (y / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)).toFixed(4));
  };
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  onScrollHeader();

  /* ---------- Halo qui suit le pointeur ---------- */
  if (mqFine.matches) {
    root.classList.add('has-pointer');
    let raf = 0;
    window.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--mx', `${e.clientX}px`);
        root.style.setProperty('--my', `${e.clientY}px`);
        raf = 0;
      });
    }, { passive: true });
  }

  /* ---------- Constellation neuronale (héros) ---------- */
  const neural = (() => {
    const canvas = $('[data-neural]');
    if (!canvas || !canvas.getContext) return null;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, points = [], links = [], running = false, visible = true, frame = 0;
    let rotY = 0, rotX = -0.25, targetTiltX = 0, targetTiltY = 0, tiltX = 0, tiltY = 0;
    let pulses = [];

    const build = () => {
      const small = window.innerWidth < 768;
      const n = small ? 260 : 520;
      points = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = golden * i;
        // Légère irrégularité pour un aspect organique.
        const j = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.06;
        points.push({ x: Math.cos(theta) * r * j, y: y * j, z: Math.sin(theta) * r * j, hot: Math.random() < 0.07 });
      }
      // Liens vers les voisins proches (calculés une fois, sur la sphère).
      links = [];
      const maxD = small ? 0.27 : 0.2;
      for (let i = 0; i < n; i++) {
        let count = 0;
        for (let k = i + 1; k < n && count < 3; k++) {
          const dx = points[i].x - points[k].x, dy = points[i].y - points[k].y, dz = points[i].z - points[k].z;
          if (dx * dx + dy * dy + dz * dz < maxD * maxD) { links.push([i, k]); count++; }
        }
      }
      pulses = [];
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const project = (p, cx, cy, R, sinY, cosY, sinX, cosX) => {
      // Rotation Y puis X, puis perspective.
      let x = p.x * cosY - p.z * sinY;
      let z = p.x * sinY + p.z * cosY;
      let y = p.y * cosX - z * sinX;
      z = p.y * sinX + z * cosX;
      const persp = 2.6 / (2.6 + z);
      return { x: cx + x * R * persp, y: cy + y * R * persp, z, s: persp };
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const wide = w >= 900;
      // Sur mobile, la sphère se décale en haut à droite pour laisser le texte respirer.
      const cx = wide ? w * 0.7 : w * 0.82;
      const cy = wide ? h * 0.46 : h * 0.2;
      const R = wide ? Math.min(w * 0.27, h * 0.42) : w * 0.55;
      tiltX += (targetTiltX - tiltX) * 0.05;
      tiltY += (targetTiltY - tiltY) * 0.05;
      const ry = rotY + tiltY, rx = rotX + tiltX;
      const sinY = Math.sin(ry), cosY = Math.cos(ry), sinX = Math.sin(rx), cosX = Math.cos(rx);
      const proj = points.map((p) => project(p, cx, cy, R, sinY, cosY, sinX, cosX));
      const fade = wide ? 1 : 0.5;

      ctx.lineWidth = 0.6;
      for (const [a, b] of links) {
        const pa = proj[a], pb = proj[b];
        const depth = (2 - (pa.z + pb.z)) / 4; // 0 (fond) → 1 (avant)
        ctx.strokeStyle = `rgba(233,185,73,${(0.03 + depth * 0.16) * fade})`;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      }
      for (let i = 0; i < proj.length; i++) {
        const p = proj[i];
        const depth = (1 - p.z) / 2;
        const hot = points[i].hot;
        const r = (hot ? 2.1 : 1.1) * p.s;
        ctx.fillStyle = hot ? `rgba(245,215,142,${(0.35 + depth * 0.65) * fade})` : `rgba(250,250,249,${(0.12 + depth * 0.55) * fade})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      // Impulsions qui voyagent le long des liens : l'IA « réfléchit ».
      if (running && Math.random() < 0.18 && links.length) pulses.push({ l: links[(Math.random() * links.length) | 0], t: 0 });
      pulses = pulses.filter((pl) => pl.t <= 1);
      for (const pl of pulses) {
        const pa = proj[pl.l[0]], pb = proj[pl.l[1]];
        const x = pa.x + (pb.x - pa.x) * pl.t, y = pa.y + (pb.y - pa.y) * pl.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
        g.addColorStop(0, `rgba(245,215,142,${0.9 * fade})`);
        g.addColorStop(1, 'rgba(245,215,142,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
        pl.t += 0.025;
      }
    };

    const loop = () => {
      if (!running) return;
      rotY += 0.0016;
      draw();
      frame = requestAnimationFrame(loop);
    };
    const start = () => { if (running || reduceMotion() || !visible || document.hidden) return; running = true; frame = requestAnimationFrame(loop); };
    const stop = () => { running = false; cancelAnimationFrame(frame); };

    build(); resize(); draw();
    start();

    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); resize(); draw(); }, 150); });
    if (mqFine.matches) {
      window.addEventListener('pointermove', (e) => {
        targetTiltY = (e.clientX / window.innerWidth - 0.5) * 0.6;
        targetTiltX = (e.clientY / window.innerHeight - 0.5) * 0.4;
      }, { passive: true });
    }
    mqReduce.addEventListener?.('change', () => (reduceMotion() ? stop() : start()));
    return { canvas, start, stop };
  })();

  /* ---------- Simulateur ---------- */
  const sim = (() => {
    const form = $('[data-sim]');
    if (!form) return null;
    const inputs = $$('input[type="range"]', form);
    const out = (k) => $(`[data-out="${k}"]`, form);
    const res = (k) => $(`[data-res="${k}"]`, form);
    const meter = $('[data-res-meter]', form);
    const state = { hours: 552, value: 22080, weeks: 15 };
    let last = null;

    const setFill = (input) => {
      const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
      input.style.setProperty('--fill', `${pct}%`);
    };

    const compute = () => {
      const v = Object.fromEntries(inputs.map((i) => [i.name, Number(i.value)]));
      out('people').textContent = v.people;
      out('hours').textContent = `${v.hours} h`;
      out('cost').textContent = `${v.cost} €`;
      out('share').textContent = `${v.share} %`;
      const hours = v.people * v.hours * 46 * (v.share / 100);
      const target = { hours, value: hours * v.cost, weeks: hours / 38 };
      last = { ...v, ...target };
      const render = () => {
        res('hours').textContent = fmt.format(state.hours);
        res('value').textContent = fmt.format(state.value);
        res('weeks').textContent = state.weeks < 10 ? fmt1.format(state.weeks) : fmt.format(state.weeks);
      };
      if (hasGsap && !reduceMotion()) gsap.to(state, { ...target, duration: 0.6, ease: 'power3.out', overwrite: true, onUpdate: render });
      else { Object.assign(state, target); render(); }
      // Échelle racine : la jauge reste lisible des petites aux grandes équipes.
      meter.style.setProperty('--meter', Math.min(1, Math.sqrt(hours / 12000)).toFixed(3));
    };

    inputs.forEach((i) => { setFill(i); i.addEventListener('input', () => { setFill(i); compute(); }); });
    compute();

    // Le bouton du simulateur pré-remplit le message de contact (modifiable).
    $('[data-sim-cta]')?.addEventListener('click', () => {
      const msg = $('#f-msg');
      if (msg && !msg.value.trim() && last) {
        msg.value = `D'après votre simulateur, nous pourrions récupérer environ ${fmt.format(last.hours)} heures par an (${last.people} personne${last.people > 1 ? 's' : ''}, ${last.hours} h de tâches répétitives par semaine). J'aimerais vérifier ce chiffre avec vous.`;
      }
    });
    return { get last() { return last; } };
  })();

  /* ---------- Démonstration de l'agent ---------- */
  const demo = (() => {
    const wrap = $('[data-demo]');
    if (!wrap) return null;
    const log = $('[data-demo-log]', wrap);
    const status = $('[data-demo-status]', wrap);
    const timerEl = $('[data-demo-timer]', wrap);
    const playBtn = $('[data-demo-play]', wrap);
    const playLabel = $('[data-demo-label]', wrap);
    const playIcon = $('[data-demo-icon] use', wrap);
    const approve = $('[data-demo-approve]', wrap);
    const steps = [
      { tag: 'reçu', text: 'Nouvel e-mail · Brasserie du Vieux Moulin' },
      { tag: 'analyse', text: 'Intention détectée : demande de devis (confiance 96 %)' },
      { tag: 'extrait', text: 'Carton 6 bouteilles · 2 000 / mois · Gosselies · dès novembre' },
      { tag: 'vérifie', text: 'Réf. CB-6 en stock · tarif dégressif palier 2 000 appliqué' },
      { tag: 'rédige', text: 'Devis DEV-2026-114 généré · 1 840,00 € HTVA / mois' },
      { tag: 'prépare', text: 'Réponse rédigée en français, devis joint en PDF' },
      { tag: 'attend', text: 'En attente de la validation de Sophie', cls: 'wait' },
    ];
    let running = false, played = false, timers = [], t0 = 0, rafId = 0;

    const clear = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(rafId); };
    const setStatus = (label, cls) => { status.textContent = label; status.className = `console__status mono ${cls || ''}`; };
    const setButton = (label, icon) => { playLabel.textContent = label; playIcon.setAttribute('href', icon); };

    const addLine = (step, instant) => new Promise((resolve) => {
      const li = document.createElement('li');
      li.className = 'log-line';
      const tag = document.createElement('span');
      tag.className = `log-line__tag${step.cls ? ` log-line__tag--${step.cls}` : ''}`;
      tag.textContent = step.tag;
      const txt = document.createElement('span');
      txt.className = 'log-line__text';
      li.append(tag, txt);
      log.append(li);
      if (instant) { txt.textContent = step.text; resolve(); return; }
      if (hasGsap) gsap.from(li, { opacity: 0, x: -10, duration: 0.3, ease: 'power2.out' });
      txt.classList.add('caret');
      let i = 0;
      const type = () => {
        i += 2;
        txt.textContent = step.text.slice(0, i);
        if (i < step.text.length) timers.push(setTimeout(type, 14));
        else { txt.classList.remove('caret'); resolve(); }
      };
      type();
    });

    const tick = () => {
      const s = (performance.now() - t0) / 1000;
      timerEl.textContent = `${fmt1.format(s)} s`;
      if (running) rafId = requestAnimationFrame(tick);
    };

    const run = async () => {
      clear();
      running = true; played = true;
      log.innerHTML = '';
      wrap.classList.remove('is-sent');
      approve.disabled = true;
      approve.querySelector('span').textContent = 'Valider et envoyer';
      setStatus('en cours', 'is-live');
      setButton('Démonstration en cours…', '#i-replay');
      playBtn.disabled = true;
      const instant = reduceMotion();
      t0 = performance.now();
      if (!instant) tick();
      for (const step of steps) {
        await addLine(step, instant);
        if (!instant) await new Promise((r) => timers.push(setTimeout(r, 380)));
      }
      running = false;
      timerEl.textContent = instant ? '14,2 s' : timerEl.textContent;
      setStatus('prêt', 'is-live');
      approve.disabled = false;
      playBtn.disabled = false;
      setButton('Rejouer la démonstration', '#i-replay');
    };

    playBtn.addEventListener('click', run);
    approve.addEventListener('click', () => {
      approve.disabled = true;
      wrap.classList.add('is-sent');
      approve.querySelector('span').textContent = 'Envoyé';
      setStatus('envoyé', 'is-done');
      addLine({ tag: 'envoyé', text: 'Validé par Sophie en un clic, au petit-déjeuner.', cls: 'ok' }, reduceMotion());
    });

    // Démarrage automatique une seule fois, quand la console devient bien visible.
    if (!reduceMotion()) {
      new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting && !played) { run(); obs.disconnect(); }
      }, { threshold: 0.55 }).observe($('.console', wrap));
    }
    return { run };
  })();

  /* ---------- Formulaire de contact ---------- */
  (() => {
    const form = $('[data-contact-form]');
    if (!form) return;
    const statusEl = $('[data-form-status]', form);
    const submit = $('[data-submit]', form);
    const submitLabel = $('[data-submit-label]', form);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    const rules = {
      name: (v) => (v.trim().length >= 2 ? '' : 'Indiquez votre nom pour que nous sachions qui recontacter.'),
      email: (v) => (!v.trim() ? 'Indiquez votre adresse e-mail.' : emailRe.test(v.trim()) ? '' : 'Cette adresse e-mail semble incomplète (exemple : prenom@entreprise.be).'),
      message: (v) => (v.trim().length >= 20 ? '' : `Encore ${20 - v.trim().length} caractère${20 - v.trim().length > 1 ? 's' : ''} : décrivez votre besoin en une ou deux phrases.`),
      consent: (_, el) => (el.checked ? '' : 'Votre accord est nécessaire pour que nous puissions vous répondre.'),
    };

    const validate = (el) => {
      const rule = rules[el.name];
      if (!rule) return true;
      const msg = rule(el.value, el);
      const field = el.closest('.field');
      const err = $(`#${el.getAttribute('aria-describedby')?.split(' ').find((id) => id.endsWith('-err'))}`);
      field?.classList.toggle('is-invalid', !!msg);
      field?.classList.toggle('is-valid', !msg && el.type !== 'checkbox');
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg;
      return !msg;
    };

    const fields = Object.keys(rules).map((n) => form.elements[n]).filter(Boolean);
    fields.forEach((el) => {
      el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox') validate(el); });
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') validate(el); });
      el.addEventListener('change', () => { if (el.type === 'checkbox') validate(el); });
    });

    const showSuccess = (viaMail) => {
      const box = document.createElement('div');
      box.className = 'form-success';
      box.setAttribute('tabindex', '-1');
      box.innerHTML = `
        <span class="form-success__icon"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></span>
        <h3>Merci, c'est bien noté.</h3>
        <p>${viaMail
          ? 'Votre messagerie vient de s\'ouvrir avec votre demande déjà rédigée : il ne reste qu\'à cliquer sur « Envoyer ». Nous répondons sous 24 h ouvrables.'
          : 'Votre demande est bien partie. Nous vous répondons sous 24 h ouvrables, en général bien avant.'}</p>
        <button type="button" class="btn btn--ghost btn--sm" data-reset>Envoyer une autre demande</button>`;
      form.replaceWith(box);
      box.focus();
      if (hasGsap && !reduceMotion()) gsap.from(box.children, { y: 20, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'expo.out' });
      $('[data-reset]', box).addEventListener('click', () => { form.reset(); fields.forEach((f) => { f.closest('.field')?.classList.remove('is-valid', 'is-invalid'); f.removeAttribute('aria-invalid'); }); box.replaceWith(form); setLoading(false); statusEl.textContent = ''; form.elements.name.focus(); });
    };

    const setLoading = (on) => {
      submit.classList.toggle('is-loading', on);
      submit.disabled = on;
      submit.setAttribute('aria-busy', on ? 'true' : 'false');
      submitLabel.textContent = on ? 'Envoi en cours…' : 'Envoyer ma demande';
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.textContent = ''; statusEl.className = 'form__status';
      const results = fields.map(validate);
      if (results.includes(false)) {
        const firstInvalid = fields[results.indexOf(false)];
        firstInvalid.focus();
        const n = results.filter((r) => !r).length;
        statusEl.textContent = `${n} champ${n > 1 ? 's demandent' : ' demande'} votre attention.`;
        statusEl.classList.add('is-error');
        return;
      }
      if (form.elements.website.value) { showSuccess(false); return; } // robot

      const data = new FormData(form);
      const needs = data.getAll('need');
      const endpoint = form.dataset.endpoint;
      setLoading(true);

      if (endpoint) {
        try {
          const r = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!r.ok) throw new Error(String(r.status));
          showSuccess(false);
        } catch (err) {
          setLoading(false);
          statusEl.innerHTML = 'L\'envoi n\'a pas abouti. Réessayez, ou écrivez-nous directement à <a href="mailto:contact@cambr-ia.be">contact@cambr-ia.be</a>.';
          statusEl.classList.add('is-error');
        }
        return;
      }

      // Sans serveur : on prépare un e-mail complet dans la messagerie du visiteur.
      const subject = `Demande d'appel découverte — ${data.get('company') || data.get('name')}`;
      const body = [
        `Nom : ${data.get('name')}`,
        data.get('company') ? `Entreprise : ${data.get('company')}` : '',
        `E-mail : ${data.get('email')}`,
        data.get('phone') ? `Téléphone : ${data.get('phone')}` : '',
        needs.length ? `Besoin : ${needs.join(', ')}` : '',
        '',
        data.get('message'),
      ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
      window.location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setTimeout(() => showSuccess(true), 600);
    });
  })();

  /* ---------- Survol 3D des cartes ---------- */
  if (mqFine.matches) {
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--cx', `${px * 100}%`);
        card.style.setProperty('--cy', `${py * 100}%`);
        if (!reduceMotion()) card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 5}deg) rotateY(${(px - 0.5) * 6}deg)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- Boutons magnétiques ---------- */
  if (hasGsap && mqFine.matches && !reduceMotion()) {
    $$('.magnetic').forEach((btn) => {
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  if (!hasGsap) return;

  /* ======================================================================
     Narration au défilement (GSAP)
     ====================================================================== */

  if (reduceMotion()) root.classList.add('is-ready', 'is-loaded');

  // Les découpages de texte (SplitText) attendent les polices pour mesurer juste.
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
  fontsReady.then(initMotion);

  function initMotion() {
    const mm = gsap.matchMedia();

    /* ---------- Mouvement complet ---------- */
    mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 1024px)' }, (ctx) => {
      const { motion, desktop } = ctx.conditions;

      if (!motion) {
        // Mouvement réduit : tout est affiché dans son état final, sans défilement piloté.
        root.classList.remove('motion-ok');
        root.classList.add('is-ready', 'is-loaded');
        $('[data-clock]').textContent = '22:10';
        return;
      }

      root.classList.add('motion-ok');

      /* --- Préchargement + entrée du héros --- */
      const intro = gsap.timeline({ paused: true });
      const title = $('[data-hero-title]');
      let split = null;
      if (window.SplitText && title) {
        split = SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'line' });
        intro.from(split.lines, { yPercent: 110, duration: 1.3, stagger: 0.12, ease: 'expo.out' }, 0);
        // Une fois entré, le titre retrouve son balisage d'origine (redimensionnement fiable).
        intro.eventCallback('onComplete', () => { split.revert(); split = null; });
      }
      intro.fromTo('[data-hero-fade]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'expo.out' }, 0.35)
           .from('[data-neural]', { opacity: 0, scale: 0.85, duration: 2, ease: 'expo.out' }, 0)
           .from('.site-header__inner', { y: -24, opacity: 0, duration: 0.9, ease: 'expo.out', clearProps: 'all' }, 0.2);

      let seen = false;
      try { seen = sessionStorage.getItem('cambria-intro') === '1'; } catch (e) { /* stockage indisponible */ }
      const loader = $('.loader');
      const finishLoad = () => { root.classList.add('is-loaded'); intro.play(); };
      if (seen || !loader) {
        finishLoad();
      } else {
        const counter = { v: 0 };
        const countEl = $('[data-loader-count]');
        gsap.timeline({ onComplete: finishLoad })
          .to(counter, { v: 100, duration: 1.1, ease: 'power2.inOut', onUpdate: () => { countEl.textContent = String(Math.round(counter.v)).padStart(2, '0'); } }, 0)
          .to('.loader__bar span', { scaleX: 1, duration: 1.1, ease: 'power2.inOut' }, 0)
          .to('.loader__inner', { yPercent: -40, opacity: 0, duration: 0.5, ease: 'power3.in' }, '+=0.1')
          .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'expo.inOut' }, '-=0.2');
        try { sessionStorage.setItem('cambria-intro', '1'); } catch (e) { /* stockage indisponible */ }
      }
      root.classList.add('is-ready');

      /* --- Sortie du héros : la constellation s'éloigne --- */
      gsap.to('[data-neural]', { scale: 1.25, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__content', { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '25% top', end: 'bottom top', scrub: true } });

      /* --- Révélations génériques --- */
      $$('[data-reveal]').forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });

      /* --- Chapitre 01 : la soirée défile --- */
      const clockEl = $('[data-clock]');
      const tasks = $$('[data-task]');
      const clock = { m: 18 * 60 + 30 };
      const renderClock = () => {
        const m = Math.round(clock.m);
        clockEl.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      };
      if (desktop) {
        root.classList.add('pin-problem');
        gsap.set('.problem', { '--ember-glow': 0.06 });
        gsap.from(['.problem__story', '.evening__clock'], { opacity: 0, y: 40, stagger: 0.12, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '[data-problem]', start: 'top 70%', once: true } });
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: '[data-problem]', start: 'top top', end: '+=260%', scrub: 1, pin: true, anticipatePin: 1 },
        });
        tl.to(clock, { m: 22 * 60 + 10, duration: 2.6, onUpdate: renderClock }, 0.1)
          .from(tasks, { opacity: 0, y: 80, rotateX: -35, transformOrigin: '50% 100%', stagger: 0.45, duration: 0.6, ease: 'power2.out' }, 0.15)
          .to('.problem', { '--ember-glow': 0.22, duration: 2.6 }, 0.1)
          .from('.evening__total', { opacity: 0, duration: 0.3 }, 2.5)
          // La chute : la soirée s'efface, la phrase prend tout l'écran.
          .to('.problem__grid', { opacity: 0.08, scale: 0.96, filter: 'blur(6px)', duration: 0.7, ease: 'power2.in' }, 3.1)
          .from('[data-punch] .punch', { opacity: 0, y: 50, scale: 0.96, duration: 0.7, ease: 'power2.out' }, 3.4)
          .to({}, { duration: 0.6 });
      } else {
        gsap.from(tasks, { opacity: 0, y: 40, stagger: 0.1, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: '.tasks', start: 'top 85%', once: true } });
        gsap.to(clock, { m: 22 * 60 + 10, duration: 2.4, ease: 'power2.inOut', onUpdate: renderClock, scrollTrigger: { trigger: '.evening', start: 'top 75%', once: true } });
        gsap.from('[data-punch] .punch', { opacity: 0, y: 40, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '[data-punch]', start: 'top 85%', once: true } });
      }

      /* --- Chapitre 02 : le manifeste s'allume mot à mot --- */
      const manifesto = $('[data-manifesto]');
      if (manifesto && window.SplitText) {
        const words = SplitText.create(manifesto, { type: 'words', wordsClass: 'word' });
        gsap.fromTo(words.words, { opacity: 0.14 }, {
          opacity: 1, stagger: 0.08, ease: 'none',
          scrollTrigger: { trigger: manifesto, start: 'top 80%', end: 'bottom 40%', scrub: true },
        });
      }

      /* --- Méthode : parcours horizontal sur grand écran --- */
      const track = $('[data-journey-track]');
      const bar = $('[data-journey-bar]');
      if (desktop && track) {
        root.classList.add('is-horizontal');
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const tween = gsap.to(track, {
          x: () => -distance(), ease: 'none',
          scrollTrigger: {
            trigger: '[data-journey-pin]', start: 'top top', end: () => `+=${distance()}`,
            scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
            onUpdate: (self) => bar.style.setProperty('--jp', self.progress.toFixed(3)),
          },
        });
        $$('.step', track).forEach((step) => {
          gsap.from($('.step__num', step), { xPercent: 40, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: step, containerAnimation: tween, start: 'left right', end: 'left 40%', scrub: true } });
          gsap.from([$('.step__icon', step), $('.step__title', step)], { y: 30, opacity: 0, stagger: 0.1, ease: 'power2.out', scrollTrigger: { trigger: step, containerAnimation: tween, start: 'left 85%', end: 'left 55%', scrub: true } });
        });
      } else if (track) {
        gsap.from($$('.step', track), { opacity: 0, y: 40, stagger: 0.12, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: track, start: 'top 85%', once: true } });
      }

      /* --- Chapitre 03 : la grille de services s'assemble --- */
      ScrollTrigger.batch('[data-bento] .card', {
        start: 'top 88%', once: true,
        onEnter: (batch) => gsap.from(batch, { opacity: 0, y: 60, scale: 0.96, stagger: 0.09, duration: 1.1, ease: 'expo.out', clearProps: 'transform' }),
      });
      gsap.from('[data-chat] > *', { opacity: 0, y: 16, scale: 0.96, transformOrigin: '50% 100%', stagger: 0.35, duration: 0.6, ease: 'back.out(1.6)', scrollTrigger: { trigger: '[data-chat]', start: 'top 85%', once: true } });
      gsap.from('.console', { opacity: 0, y: 60, rotateX: 12, transformPerspective: 1200, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '[data-demo]', start: 'top 80%', once: true } });

      /* --- Simulateur, engagements, FAQ --- */
      gsap.from('.sim__results', { opacity: 0, y: 50, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '[data-sim]', start: 'top 80%', once: true } });
      gsap.from('.range', { opacity: 0, x: -30, stagger: 0.08, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: '[data-sim]', start: 'top 80%', once: true } });
      gsap.from('.qa', { opacity: 0, y: 20, stagger: 0.06, duration: 0.8, ease: 'expo.out', scrollTrigger: { trigger: '.faq__list', start: 'top 85%', once: true } });

      /* --- Épilogue --- */
      const finale = $('[data-finale-title]');
      if (finale && window.SplitText) {
        const s = SplitText.create(finale, { type: 'lines', mask: 'lines' });
        gsap.from(s.lines, { yPercent: 115, stagger: 0.12, duration: 1.4, ease: 'expo.out', onComplete: () => s.revert(), scrollTrigger: { trigger: finale, start: 'top 85%', once: true } });
      }
      gsap.fromTo('.finale__halo', { scale: 0.6, opacity: 0.3 }, { scale: 1.1, opacity: 1, ease: 'none', scrollTrigger: { trigger: '.chapter--finale', start: 'top bottom', end: 'center center', scrub: true } });
      gsap.from('.form', { opacity: 0, y: 60, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.contact', start: 'top 85%', once: true } });
      gsap.fromTo('.footer__giant', { xPercent: -6 }, { xPercent: 2, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

      return () => {
        root.classList.remove('is-horizontal', 'pin-problem');
        split?.revert();
      };
    });

    /* ---------- Chapitre courant (créé après les pins pour des positions justes) : ambiance, repères, navigation ---------- */
    const moods = { gold: '233, 185, 73', ember: '251, 146, 60', teal: '94, 234, 212' };
    const chapterLinks = $$('[data-chapter-link]');
    const navLinks = $$('.nav__list a');
    const setMood = (mood) => {
      const [r, g, b] = moods[mood].split(',').map(Number);
      const cur = getComputedStyle(root).getPropertyValue('--mood').split(',').map(Number);
      const o = { r: cur[0], g: cur[1], b: cur[2] };
      gsap.to(o, { r, g, b, duration: reduceMotion() ? 0 : 0.8, ease: 'power2.out', overwrite: true,
        onUpdate: () => root.style.setProperty('--mood', `${o.r | 0}, ${o.g | 0}, ${o.b | 0}`) });
    };
    $$('[data-chapter]').forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec, start: 'top 55%', end: 'bottom 55%',
        onToggle: (self) => {
          if (!self.isActive) return;
          chapterLinks.forEach((a) => {
            if (a.dataset.chapterLink === sec.id) a.setAttribute('aria-current', 'step');
            else a.removeAttribute('aria-current');
          });
          setMood(sec.dataset.mood || 'gold');
        },
      });
    });
    ['chapitre-1', 'methode', 'services', 'simulateur', 'faq'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const link = navLinks.find((a) => a.getAttribute('href') === `#${id}`);
      ScrollTrigger.create({
        trigger: id === 'services' ? '#chapitre-3' : el, start: 'top 50%', end: 'bottom 50%',
        onToggle: (self) => {
          if (self.isActive) { navLinks.forEach((a) => a.removeAttribute('aria-current')); link?.setAttribute('aria-current', 'true'); }
          else link?.removeAttribute('aria-current');
        },
      });
    });

    // Le repère de chapitres s'efface quand il gênerait la lecture (parcours horizontal, pied de page).
    const rail = $('[data-chapters]');
    const railOff = new Set();
    const toggleRail = (key, on) => { on ? railOff.add(key) : railOff.delete(key); rail?.classList.toggle('is-off', railOff.size > 0); };
    ScrollTrigger.create({ trigger: '[data-journey]', start: 'top 60%', end: 'bottom 40%', onToggle: (self) => toggleRail('journey', self.isActive && root.classList.contains('is-horizontal')) });
    ScrollTrigger.create({ trigger: '.footer', start: 'top 80%', onToggle: (self) => toggleRail('footer', self.isActive) });

    ScrollTrigger.refresh();
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());

  // Arrivée directe sur une ancre (#contact, etc.) : on s'y place après la mise en page.
  if (location.hash && document.getElementById(location.hash.slice(1))) {
    window.addEventListener('load', () => setTimeout(() => scrollToTarget(document.getElementById(location.hash.slice(1))), 50));
  }
})();
