/* The ASI Society motion layer. Loaded with defer on every page. */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const still = () => reduce.matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!still()) root.classList.add('motion');

  /* Theme switch as a circular reveal from the button. The page's own
     handler still does the switching; this only wraps it in a transition. */
  const themeBtn = document.getElementById('theme');
  if (themeBtn && document.startViewTransition) {
    let passThrough = false;
    themeBtn.addEventListener('click', e => {
      if (passThrough || still()) return;
      e.stopImmediatePropagation();
      const r = themeBtn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.style.setProperty('--vt-x', x + 'px');
      root.style.setProperty('--vt-y', y + 'px');
      root.style.setProperty('--vt-r', far + 'px');
      root.classList.add('vt-theme');
      const t = document.startViewTransition(() => { passThrough = true; themeBtn.click(); passThrough = false; });
      t.finished.finally(() => root.classList.remove('vt-theme'));
    }, true);
  }

  /* Tab indicator. */
  const links = document.querySelector('.nav__links');
  if (links) {
    const ind = document.createElement('span');
    ind.className = 'nav__ind';
    ind.setAttribute('aria-hidden', 'true');
    links.prepend(ind);
    links.classList.add('has-ind');
    const moveTo = a => {
      if (!a) { ind.style.setProperty('--o', 0); return; }
      ind.style.setProperty('--x', a.offsetLeft + 'px');
      ind.style.setProperty('--w', a.offsetWidth + 'px');
      ind.style.setProperty('--o', 1);
    };
    const home = () => moveTo(links.querySelector('a[aria-current]'));
    links.addEventListener('pointerover', e => { const a = e.target.closest('a'); if (a) moveTo(a); });
    links.addEventListener('focusin', e => { const a = e.target.closest('a'); if (a) moveTo(a); });
    links.addEventListener('pointerleave', home);
    links.addEventListener('focusout', () => setTimeout(() => { if (!links.contains(document.activeElement)) home(); }, 0));
    // The home page marks its current section as you scroll, so follow that too.
    new MutationObserver(() => { if (!links.matches(':hover')) home(); }).observe(links, { attributes: true, subtree: true, attributeFilter: ['aria-current'] });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(home);
    addEventListener('resize', home);
  }


  /* Background: a slowly drifting neural constellation over a soft aurora.
     Nodes connect when they come close, signals travel along the links,
     and the network leans toward the pointer. */
  (function mind() {
    const aur = document.createElement('div');
    aur.className = 'aurora'; aur.setAttribute('aria-hidden', 'true');
    aur.innerHTML = '<span></span><span></span><span></span>';
    const cv = document.createElement('canvas');
    cv.className = 'mind'; cv.setAttribute('aria-hidden', 'true');
    document.body.prepend(cv); document.body.prepend(aur);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, nodes = [], pulses = [], col = {}, raf = 0, last = 0, lastFire = 0, running = false;
    const LINK = () => (W < 700 ? 110 : 150);
    const ptr = { x: -9999, y: -9999, on: false };
    const rnd = (a, b) => a + Math.random() * (b - a);

    const readColors = () => {
      const cs = getComputedStyle(root);
      const dark = root.getAttribute('data-theme') === 'dark' ||
        (root.getAttribute('data-theme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
      col = {
        ink: cs.getPropertyValue(dark ? '--ink' : '--brain-ink').trim() || '#001C54',
        sig: cs.getPropertyValue('--signal').trim() || '#045CFC',
        link: dark ? 0.32 : 0.2, node: dark ? 0.75 : 0.5
      };
    };
    const build = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const n = Math.max(28, Math.min(95, Math.round((W * H) / 15000)));
      nodes = []; pulses = [];
      for (let i = 0; i < n; i++) {
        const z = rnd(0.35, 1);
        const ang = rnd(0, Math.PI * 2), sp = rnd(4, 11) * z;
        nodes.push({ x: rnd(0, W), y: rnd(0, H), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, z, r: 0.9 + z * 1.9, glow: 0, nb: [] });
      }
      readColors();
    };

    const fire = (from, depth) => {
      if (!from || pulses.length > 40) return;
      const nb = from.nb; if (!nb.length) return;
      const to = nb[(Math.random() * nb.length) | 0];
      pulses.push({ a: from, b: to, t: 0, speed: rnd(0.9, 1.6), depth });
      from.glow = 1;
    };

    const draw = dt => {
      const L = LINK(), L2 = L * L;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // Move: drift, wrap at the edges, lean gently toward the pointer.
      for (const n of nodes) {
        if (ptr.on) {
          const dx = ptr.x - n.x, dy = ptr.y - n.y, d2 = dx * dx + dy * dy;
          if (d2 < 220 * 220 && d2 > 400) { const f = 14 * n.z / Math.sqrt(d2); n.x += dx * f * dt * 0.08; n.y += dy * f * dt * 0.08; }
        }
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
        n.nb.length = 0;
      }
      // Links: thin lines that fade in as nodes approach each other.
      ctx.lineWidth = 1; ctx.strokeStyle = col.ink;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > L2) continue;
          a.nb.push(b); b.nb.push(a);
          const k = 1 - Math.sqrt(d2) / L;
          ctx.globalAlpha = k * k * col.link * Math.min(a.z, b.z) * 1.6;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // Lines reach out to the pointer, as if the network is paying attention.
      if (ptr.on) {
        ctx.strokeStyle = col.sig;
        for (const n of nodes) {
          const dx = n.x - ptr.x, dy = n.y - ptr.y, d = Math.hypot(dx, dy);
          if (d > 180) continue;
          ctx.globalAlpha = (1 - d / 180) * 0.45;
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(ptr.x, ptr.y); ctx.stroke();
        }
      }
      // Signals travelling between connected nodes.
      ctx.fillStyle = col.sig; ctx.strokeStyle = col.sig;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y, d = Math.hypot(dx, dy);
        if (d > L * 1.15) { pulses.splice(i, 1); continue; }
        p.t += (p.speed * 120 * dt) / Math.max(40, d);
        const t = Math.min(1, p.t), tt = Math.max(0, t - 0.35);
        const hx = p.a.x + dx * t, hy = p.a.y + dy * t;
        ctx.lineWidth = 1.6; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.moveTo(p.a.x + dx * tt, p.a.y + dy * tt); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(hx, hy, 2.1, 0, 7); ctx.fill();
        if (p.t >= 1) {
          p.b.glow = 1; pulses.splice(i, 1);
          if (p.depth < 5 && Math.random() < 0.7) fire(p.b, p.depth + 1);
        }
      }
      // Nodes, with a soft halo when a signal passes through.
      for (const n of nodes) {
        ctx.fillStyle = col.ink; ctx.globalAlpha = col.node * n.z;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
        if (n.glow > 0.02) {
          ctx.fillStyle = col.sig;
          ctx.globalAlpha = n.glow * 0.22; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 10 * n.glow, 0, 7); ctx.fill();
          ctx.globalAlpha = n.glow; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 0.6, 0, 7); ctx.fill();
          n.glow *= Math.pow(0.08, dt);
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = now => {
      raf = 0;
      if (last && now - last < 31) { if (running) raf = requestAnimationFrame(frame); return; }
      const dt = Math.min(0.06, (now - (last || now)) / 1000); last = now;
      if (now - lastFire > 900 && nodes.length) { lastFire = now; fire(nodes[(Math.random() * nodes.length) | 0], 0); }
      draw(dt);
      if (running) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (running || still()) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; cancelAnimationFrame(raf); raf = 0; };

    build();
    if (still()) draw(0); else start();
    requestAnimationFrame(() => { cv.classList.add('on'); aur.classList.add('on'); });

    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(innerWidth - W) > 40 || Math.abs(innerHeight - H) > 140) { build(); if (still()) draw(0); } }, 200); });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    const recolor = () => { readColors(); if (still()) draw(0); };
    new MutationObserver(recolor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);
    reduce.addEventListener('change', () => { if (still()) { stop(); draw(0); } else start(); });
    addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { ptr.on = false; });
    addEventListener('blur', () => { ptr.on = false; });
    addEventListener('pointerdown', e => {
      if (still()) return;
      let best = null, bd = 240 * 240;
      for (const n of nodes) { const d = (n.x - e.clientX) ** 2 + (n.y - e.clientY) ** 2; if (d < bd) { bd = d; best = n; } }
      if (best) { best.glow = 1; fire(best, 0); fire(best, 0); fire(best, 0); }
    }, { passive: true });
  })();

  if (still()) return;

  /* Reading progress trace. */
  const trace = document.createElement('div');
  trace.className = 'trace';
  trace.setAttribute('aria-hidden', 'true');
  document.body.append(trace);
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      trace.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
      drawPaths();
    });
  };

  /* Word-by-word headlines. */
  document.querySelectorAll('[data-split]').forEach(el => {
    const label = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', label);
    let i = 0;
    const wrap = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            const s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
            w.append(s); frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrap(n);
      });
    };
    wrap(el);
    el.classList.add('split');
  });

  /* Reveals, staggered within each group. */
  const groups = [
    '.section__head', '.a-hero .lede', '.a-hero .hero__cta',
    '.rows .row', '.bus li', '.principles li', '.creed', '.work article', '.path li',
    '.around section', '.layer__head', '.facts li', '.founder2 .prose', '.founder__links',
    '.areas details', '.stats li', '.story__inner > *', '.purpose__copy > :not(h1)', '.close .sheet', '.join .sheet',
    '.founder__grid > div', '.why > *', '.portrait', '.purpose__art'
  ];
  const targets = [];
  groups.forEach(sel => document.querySelectorAll(sel).forEach(el => {
    if (el.closest('.rv') || el.classList.contains('rv')) return;
    const sibs = el.parentElement ? [...el.parentElement.children].filter(c => c.matches(sel)) : [el];
    el.style.setProperty('--i', Math.max(0, sibs.indexOf(el)) % 8);
    el.classList.add('rv');
    targets.push(el);
  }));
  const count = el => {
    const m = /^(\D*)(\d[\d,]*)(.*)$/s.exec(el.dataset.final);
    if (!m) return;
    const end = parseInt(m[2].replace(/,/g, ''), 10), t0 = performance.now(), dur = 1200;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = m[1] + Math.round(end * e).toLocaleString('en') + m[3];
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  document.querySelectorAll('[data-count]').forEach(el => { el.dataset.final = el.textContent; });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      en.target.querySelectorAll('[data-count]').forEach(count);
      if (en.target.matches('[data-count]')) count(en.target);
      io.unobserve(en.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(t => io.observe(t));
    document.querySelectorAll('[data-count]').forEach(el => { if (!el.closest('.rv')) io.observe(el); });
  } else {
    targets.forEach(t => t.classList.add('in'));
  }

  /* Timelines draw as you read. */
  const paths = [...document.querySelectorAll('.path')];
  function drawPaths() {
    const line = innerHeight * 0.62;
    paths.forEach(p => {
      const r = p.getBoundingClientRect();
      const k = Math.max(0, Math.min(1, (line - r.top) / r.height));
      p.style.setProperty('--draw', k.toFixed(3));
      p.querySelectorAll('li').forEach(li => li.classList.toggle('lit', li.getBoundingClientRect().top + 12 < line));
    });
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* Portrait tilt, for mouse and trackpad only. */
  if (finePointer) {
    document.querySelectorAll('.tilt').forEach(card => {
      const glare = document.createElement('span'); glare.className = 'glare'; card.append(glare);
      let raf = 0;
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.classList.add('is-tilting');
          card.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 9}deg)`;
          card.style.setProperty('--gx', px * 100 + '%');
          card.style.setProperty('--gy', py * 100 + '%');
        });
      });
      card.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); card.classList.remove('is-tilting'); card.style.transform = ''; });
    });
  }
})();
