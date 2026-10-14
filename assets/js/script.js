
/* Shared interactions. Content stays visible without animation support. */
(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');
  const mobile = window.matchMedia('(max-width: 959px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function closeMenu(restoreFocus = false) {
    if (!toggle || !navigation) return;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    navigation.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    if (restoreFocus) toggle.focus();
  }
  if (toggle && navigation) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      navigation.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    });
    navigation.addEventListener('click', event => {
      if (event.target.closest('a')) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (event.key === 'Escape') closeMenu(true);
      if (event.key === 'Tab') {
        const controls = [toggle, ...navigation.querySelectorAll('a')];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    });
    document.addEventListener('click', event => {
      if (header && !header.contains(event.target)) closeMenu();
    });
    mobile.addEventListener('change', () => closeMenu());
  }
  let scrollPending = false;
  function updateHeader() {
    header?.classList.toggle('is-scrolled', window.scrollY > 24);
    scrollPending = false;
  }
  window.addEventListener('scroll', () => {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateHeader); }
  }, { passive: true });
  updateHeader();
  document.querySelectorAll('[data-year]').forEach(item => {
    item.textContent = String(new Date().getFullYear());
  });
  const catalog = document.querySelector('#product-catalog');
  if (catalog) {
    const cards = [...catalog.querySelectorAll('.product-card')];
    const search = document.querySelector('#product-search');
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const count = document.querySelector('#product-count');
    const empty = document.querySelector('.empty-state');
    let category = 'All';
    function filterProducts() {
      const query = (search?.value || '').trim().toLowerCase();
      let visible = 0;
      cards.forEach(card => {
        const match = (category === 'All' || card.dataset.category === category)
          && (card.dataset.search || '').includes(query);
        card.hidden = !match;
        if (match) visible++;
      });
      if (count) count.textContent = `${visible} product${visible === 1 ? '' : 's'}${category !== 'All' ? ` in ${category}` : ''}`;
      if (empty) empty.hidden = visible !== 0;
    }
    buttons.forEach(button => button.addEventListener('click', () => {
      category = button.dataset.filter;
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      filterProducts();
    }));
    search?.addEventListener('input', filterProducts);
    document.querySelector('#reset-filters')?.addEventListener('click', () => {
      category = 'All';
      if (search) search.value = '';
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.filter === 'All')));
      filterProducts(); search?.focus();
    });
    filterProducts();
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible'); observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('[data-process]').forEach(item => observer.observe(item));
    const sceneObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.querySelectorAll('.globe-routes path, .india-pulse').forEach(item => {
          item.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
        });
      });
    });
    document.querySelectorAll('.logistics-visual, .globe-visual').forEach(item => sceneObserver.observe(item));
  }
  // The drawn road and truck share an SVG centerline. Sample once by distance
  // so travel stays smooth, including the seam, with slower speeds in bends.
  const truck = document.querySelector('.cargo-truck');
  const route = document.querySelector('#truck-route');
  const motionToggle = document.querySelector('.scene-motion-toggle');
  if (truck && route) {
    const length = route.getTotalLength();
    const count = Math.ceil(length / 2);
    const step = length / count;
    const samples = Array.from({ length: count }, (_, index) => {
      const distance = index * step;
      const point = route.getPointAtLength(distance);
      const behind = route.getPointAtLength((distance - 2 + length) % length);
      const ahead = route.getPointAtLength((distance + 2) % length);
      return { x: point.x, y: point.y, angle: Math.atan2(ahead.y - behind.y, ahead.x - behind.x) };
    });
    const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
    samples.forEach((sample, index) => {
      const before = samples[(index - 5 + count) % count];
      const after = samples[(index + 5) % count];
      sample.speed = 25 / (1 + Math.abs(wrapAngle(after.angle - before.angle)) * 1.8);
    });
    let distance = 0;
    let lastTime = null;
    let animationFrame = null;
    let inView = !('IntersectionObserver' in window);
    let pausedByUser = false;
    function pose() {
      const position = distance / step;
      const index = Math.floor(position) % count;
      const fraction = position - Math.floor(position);
      const start = samples[index];
      const end = samples[(index + 1) % count];
      const x = start.x + (end.x - start.x) * fraction;
      const y = start.y + (end.y - start.y) * fraction;
      const angle = start.angle + wrapAngle(end.angle - start.angle) * fraction;
      truck.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,8px) rotateZ(${angle}rad)`;
    }
    function tick(time) {
      // Avoid jumping after a busy frame or a background tab resumes.
      const delta = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const index = Math.floor(distance / step) % count;
      const fraction = distance / step - index;
      const speed = samples[index].speed + (samples[(index + 1) % count].speed - samples[index].speed) * fraction;
      distance = (distance + speed * delta) % length;
      pose();
      animationFrame = requestAnimationFrame(tick);
    }
    function syncMotion() {
      const active = inView && !document.hidden && !reducedMotion.matches && !pausedByUser;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      lastTime = null;
      if (motionToggle) {
        motionToggle.disabled = reducedMotion.matches;
        motionToggle.textContent = reducedMotion.matches ? 'Motion reduced' : pausedByUser ? 'Resume motion' : 'Pause motion';
        motionToggle.setAttribute('aria-pressed', String(pausedByUser));
        motionToggle.setAttribute('aria-label', reducedMotion.matches ? 'Truck animation disabled by reduced motion preference' : pausedByUser ? 'Resume truck animation' : 'Pause truck animation');
      }
      if (active) animationFrame = requestAnimationFrame(tick);
    }
    pose();
    motionToggle?.addEventListener('click', () => {
      pausedByUser = !pausedByUser;
      syncMotion();
    });
    reducedMotion.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncMotion);
    if ('IntersectionObserver' in window) {
      const truckObserver = new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        syncMotion();
      });
      truckObserver.observe(document.querySelector('.scene-perspective'));
    }
    syncMotion();
  }
  const scene = document.querySelector('[data-parallax]');
  if (scene) {
    let frame = 0;
    scene.addEventListener('pointermove', event => {
      if (reducedMotion.matches || event.pointerType !== 'mouse') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = scene.getBoundingClientRect();
        const turn = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        scene.style.setProperty('--scene-turn', `${turn}deg`);
      });
    });
    scene.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame); scene.style.setProperty('--scene-turn', '0deg');
    });
  }
})();
