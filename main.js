/* ============================================================
   Shared page script: footer year, scroll reveal, hover video,
   black-hole cursor
   ============================================================ */

document.querySelectorAll('[data-year]').forEach(el => {
  el.textContent = new Date().getFullYear();
});

/* ── Scroll reveal ──────────────────────────────────────── */
(() => {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.06 });
  items.forEach(el => observer.observe(el));
})();

/* ── Hover-to-play preview videos ───────────────────────── */
document.querySelectorAll('video[data-hover-play]').forEach(video => {
  const card = video.closest('a, article') || video;
  card.addEventListener('mouseenter', () => video.play().catch(() => {}));
  card.addEventListener('mouseleave', () => video.pause());
});

/* ── YouTube facade: load the real player only on click ─── */
document.querySelectorAll('[data-yt]').forEach(box => {
  box.querySelector('.yt-play').addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${box.dataset.yt}?autoplay=1&rel=0`;
    iframe.title = box.dataset.ytTitle || 'YouTube video';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    box.replaceChildren(iframe);
  });
});

/* ── Black-hole cursor ──────────────────────────────────── */
(() => {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!finePointer || reduceMotion) return;

  const root = document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.className = 'bh-canvas';
  const core = document.createElement('div');
  core.className = 'bh-core';
  const label = document.createElement('span');
  label.className = 'bh-label';
  core.append(label);
  [canvas, core].forEach(el => el.setAttribute('aria-hidden', 'true'));
  document.body.append(canvas, core);
  root.classList.add('bh-active');

  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const mouse = { x: -100, y: -100, seen: false };
  const hole = { x: -100, y: -100, r: 6, targetR: 6, spin: 1, targetSpin: 1 };
  const particles = [];
  const MAX = 160;

  /* States: what the hole is over decides its size and label */
  const STATES = [
    { sel: '.yt-play',                             r: 30, spin: 2.6, text: 'Play' },
    { sel: '.work-card, .hero-feature',            r: 30, spin: 2.2, text: 'View' },
    { sel: 'video[controls]',                      r: 5,  spin: 1,   text: '' },
    { sel: 'a, button, [role="button"], summary',  r: 16, spin: 2.6, text: '' },
  ];
  let current = null;

  const setState = target => {
    const state = target ? STATES.find(s => target.closest(s.sel)) : null;
    const el = state ? target.closest(state.sel) : null;
    if (el === current) return;
    current = el;
    hole.targetR = state ? state.r : 6;
    hole.targetSpin = state ? state.spin : 1;
    label.textContent = state ? state.text : '';
    core.classList.toggle('is-hover', !!state && state.r > 6);
    core.classList.toggle('has-label', !!(state && state.text));
  };

  /* Magnetic pull: interactive elements lean toward the hole */
  const magnets = [...document.querySelectorAll('[data-magnet]')];
  const PULL_RANGE = 90;
  const pullMagnets = () => {
    for (const el of magnets) {
      // Measure the element's resting position, not its pulled one
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - (el._tx || 0);
      const cy = r.top + r.height / 2 - (el._ty || 0);
      const dx = hole.x - cx;
      const dy = hole.y - cy;
      const reach = PULL_RANGE + Math.max(r.width, r.height) / 2;
      const d = Math.hypot(dx, dy);
      if (d < reach) {
        const f = (1 - d / reach) * 0.28;
        el._tx = dx * f;
        el._ty = dy * f;
        el.style.transform = `translate(${el._tx}px, ${el._ty}px)`;
        el.classList.add('is-pulled');
      } else if (el.classList.contains('is-pulled')) {
        el._tx = el._ty = 0;
        el.style.transform = '';
        el.classList.remove('is-pulled');
      }
    }
  };

  const spawn = burst => {
    const base = hole.r * 1.5;
    particles.push({
      angle: Math.random() * Math.PI * 2,
      dist: burst ? hole.r + Math.random() * 10 : base + 14 + Math.random() * 46,
      speed: 0.035 + Math.random() * 0.04,
      fall: burst ? -(1.4 + Math.random() * 2.4) : 0.1 + Math.random() * 0.26,
      size: 0.6 + Math.random() * 1.6,
      warm: Math.random() < 0.25,
      life: 1,
    });
  };

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!mouse.seen) {
      hole.x = mouse.x;
      hole.y = mouse.y;
      mouse.seen = true;
    }
    root.classList.add('bh-visible');
  }, { passive: true });

  document.addEventListener('mouseover', e => {
    // Pointer events don't reach us inside iframes: hand back the native cursor
    if (e.target.tagName === 'IFRAME') root.classList.remove('bh-visible');
    setState(e.target);
  });
  document.addEventListener('mouseleave', () => root.classList.remove('bh-visible'));

  // Click: shockwave + matter ejected outward
  window.addEventListener('mousedown', () => {
    core.classList.add('is-down');
    const wave = document.createElement('div');
    wave.className = 'bh-wave';
    wave.style.left = hole.x + 'px';
    wave.style.top = hole.y + 'px';
    document.body.append(wave);
    wave.addEventListener('animationend', () => wave.remove());
    for (let i = 0; i < 30; i++) spawn(true);
  });
  window.addEventListener('mouseup', () => core.classList.remove('is-down'));

  const ACCENT = '194, 255, 77';
  const WARM = '255, 176, 92';
  let last = performance.now();
  let running = true;

  const frame = now => {
    const dt = Math.min((now - last) / 16.67, 3);
    last = now;

    // Slight lag makes the hole feel massive
    const follow = Math.min(0.3 * dt, 1);
    hole.x += (mouse.x - hole.x) * follow;
    hole.y += (mouse.y - hole.y) * follow;
    hole.r += (hole.targetR - hole.r) * Math.min(0.16 * dt, 1);
    hole.spin += (hole.targetSpin - hole.spin) * Math.min(0.1 * dt, 1);
    core.style.transform = `translate3d(${hole.x}px, ${hole.y}px, 0) translate(-50%, -50%)`;
    core.style.setProperty('--r', hole.r.toFixed(2) + 'px');

    pullMagnets();

    const spawnRate = 0.9 * hole.spin;
    for (let s = 0; s < Math.ceil(spawnRate); s++) {
      if (particles.length < MAX && Math.random() < spawnRate / Math.ceil(spawnRate)) spawn(false);
    }

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const orbit = p.speed * hole.spin * (40 / Math.max(p.dist, 8));
      p.angle += orbit * dt;
      p.dist -= p.fall * dt;
      if (p.fall < 0) p.life -= 0.022 * dt;
      if (p.dist < hole.r * 0.95 || p.life <= 0 || p.dist > 180) {
        particles.splice(i, 1);
        continue;
      }
      const x = hole.x + Math.cos(p.angle) * p.dist;
      const y = hole.y + Math.sin(p.angle) * p.dist * 0.42;
      const nearness = 1 - Math.min((p.dist - hole.r) / 70, 1);
      const alpha = Math.min(0.12 + nearness * 0.88, 1) * p.life;
      const tx = -Math.sin(p.angle) * orbit * p.dist * 2.2;
      const ty = Math.cos(p.angle) * orbit * p.dist * 0.42 * 2.2;
      ctx.strokeStyle = `rgba(${p.warm ? WARM : ACCENT}, ${alpha})`;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(x - tx, y - ty);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    if (document.hidden) running = false;
    else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });
})();
