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


  /* Background circuit mind. Drawn on one canvas behind everything. */
  (function mind() {
    const cv = document.createElement('canvas');
    cv.className = 'mind';
    cv.setAttribute('aria-hidden', 'true');
    document.body.prepend(cv);
    const ctx = cv.getContext('2d');
    const base = document.createElement('canvas');
    const bctx = base.getContext('2d');
    let W = 0, H = 0, dpr = 1, nodes = [], edges = [], pulses = [], col = {}, raf = 0, last = 0, lastFire = 0, running = false;
    const rnd = (a, b) => a + Math.random() * (b - a);

    const readColors = () => {
      const cs = getComputedStyle(root);
      const dark = root.getAttribute('data-theme') === 'dark' ||
        (root.getAttribute('data-theme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
      col = {
        trace: cs.getPropertyValue('--trace').trim() || '#C9D6F1',
        ink: cs.getPropertyValue('--brain-ink').trim() || '#001C54',
        sig: cs.getPropertyValue('--signal').trim() || '#045CFC',
        traceA: dark ? 0.9 : 0.75, nodeA: dark ? 0.55 : 0.22
      };
    };

    // Nodes on a loose grid; traces run straight then bend 45 degrees, like the logo.
    const build = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      for (const c of [cv, base]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const gap = W < 700 ? 74 : 96;
      const cols = Math.ceil(W / gap) + 1, rows = Math.ceil(H / gap) + 1;
      const grid = [];
      nodes = []; edges = []; pulses = [];
      for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.42) { grid[r][c] = null; continue; }
          const n = { x: c * gap + rnd(-gap * .22, gap * .22), y: r * gap + rnd(-gap * .22, gap * .22), r: rnd(1.6, 3.2), links: [], glow: 0 };
          grid[r][c] = n; nodes.push(n);
        }
      }
      const link = (a, b) => {
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.min(Math.abs(dx), Math.abs(dy));
        const mid = Math.abs(dx) > Math.abs(dy)
          ? { x: b.x - Math.sign(dx) * d, y: a.y }
          : { x: a.x, y: b.y - Math.sign(dy) * d };
        const pts = [a, mid, b];
        let len = 0; const seg = [];
        for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y); seg.push(l); len += l; }
        const e = { a, b, pts, seg, len };
        edges.push(e); a.links.push(e); b.links.push(e);
      };
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const n = grid[r][c]; if (!n) continue;
        if (Math.random() < 0.7) link(n, grid[r][c + 1] || grid[r][c + 2]);
        if (Math.random() < 0.55) link(n, grid[r + 1] && (grid[r + 1][c] || grid[r + 1][c + 1]));
      }
      paintBase();
    };

    const paintBase = () => {
      readColors();
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, W, H);
      bctx.lineWidth = 1.25; bctx.lineCap = 'round'; bctx.lineJoin = 'round';
      bctx.strokeStyle = col.trace; bctx.globalAlpha = col.traceA;
      bctx.beginPath();
      for (const e of edges) { bctx.moveTo(e.pts[0].x, e.pts[0].y); bctx.lineTo(e.pts[1].x, e.pts[1].y); bctx.lineTo(e.pts[2].x, e.pts[2].y); }
      bctx.stroke();
      bctx.globalAlpha = col.nodeA; bctx.fillStyle = col.ink;
      for (const n of nodes) { if (!n.links.length) continue; bctx.beginPath(); bctx.arc(n.x, n.y, n.r, 0, 7); bctx.fill(); }
      bctx.globalAlpha = 1;
      if (still()) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(base, 0, 0); }
    };

    const pointAt = (e, t) => {
      let d = t * e.len;
      for (let i = 0; i < e.seg.length; i++) {
        if (d <= e.seg[i] || i === e.seg.length - 1) {
          const p = e.pts[i], q = e.pts[i + 1], k = e.seg[i] ? Math.min(1, d / e.seg[i]) : 1;
          return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
        }
        d -= e.seg[i];
      }
      return e.pts[e.pts.length - 1];
    };
    const fire = (from, depth) => {
      if (!from || !from.links.length || pulses.length > 90) return;
      const e = from.links[(Math.random() * from.links.length) | 0];
      pulses.push({ e, dir: e.a === from ? 1 : -1, t: 0, speed: rnd(90, 170), depth });
      from.glow = 1;
    };

    const frame = now => {
      raf = 0;
      // About 30 frames a second is plenty for drifting signals and halves the cost.
      if (last && now - last < 31) { if (running) raf = requestAnimationFrame(frame); return; }
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      if (now - lastFire > 520 && nodes.length) { lastFire = now; fire(nodes[(Math.random() * nodes.length) | 0], 0); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = col.sig; ctx.strokeStyle = col.sig; ctx.lineCap = 'round';
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += (p.speed * dt) / p.e.len;
        const head = Math.min(1, p.t), tail = Math.max(0, head - 70 / p.e.len);
        const h = pointAt(p.e, p.dir > 0 ? head : 1 - head);
        const tl = pointAt(p.e, p.dir > 0 ? tail : 1 - tail);
        const m = pointAt(p.e, p.dir > 0 ? (head + tail) / 2 : 1 - (head + tail) / 2);
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(m.x, m.y); ctx.stroke();
        ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(h.x, h.y); ctx.stroke();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(h.x, h.y, 2.4, 0, 7); ctx.fill();
        if (p.t >= 1) {
          const to = p.dir > 0 ? p.e.b : p.e.a;
          to.glow = 1;
          pulses.splice(i, 1);
          if (p.depth < 4 && Math.random() < 0.62) fire(to, p.depth + 1);
          if (p.depth < 2 && Math.random() < 0.25) fire(to, p.depth + 1);
        }
      }
      for (const n of nodes) {
        if (n.glow <= 0.01) continue;
        ctx.globalAlpha = n.glow * 0.5;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 7 * n.glow, 0, 7); ctx.fill();
        ctx.globalAlpha = n.glow; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 0.8, 0, 7); ctx.fill();
        n.glow *= Math.pow(0.12, dt);
      }
      ctx.globalAlpha = 1;
      if (running) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (running || still()) return; running = true; last = 0; raf = requestAnimationFrame(frame); };
    const stop = () => { running = false; cancelAnimationFrame(raf); raf = 0; };

    build();
    requestAnimationFrame(() => cv.classList.add('on'));
    start();

    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(innerWidth - W) > 40 || Math.abs(innerHeight - H) > 140) build(); }, 200); });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    new MutationObserver(paintBase).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintBase);
    reduce.addEventListener('change', () => { if (still()) { stop(); paintBase(); } else start(); });
    // The network answers the pointer: the nearest node sends out a signal.
    addEventListener('pointermove', e => {
      if (still() || e.pointerType === 'touch') return;
      const now = performance.now();
      if (now - (mind.t || 0) < 140) return; mind.t = now;
      let best = null, bd = 150 * 150;
      for (const n of nodes) { const d = (n.x - e.clientX) ** 2 + (n.y - e.clientY) ** 2; if (d < bd) { bd = d; best = n; } }
      if (best) fire(best, 1);
    }, { passive: true });
    addEventListener('pointerdown', e => {
      if (still()) return;
      let best = null, bd = 220 * 220;
      for (const n of nodes) { const d = (n.x - e.clientX) ** 2 + (n.y - e.clientY) ** 2; if (d < bd) { bd = d; best = n; } }
      if (best) { fire(best, 0); fire(best, 0); fire(best, 0); }
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
