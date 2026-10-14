(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const typedTitle = document.getElementById('typedTitle');
  const typingCursor = document.getElementById('typingCursor');
  const titleWords = ['Controle suas ', 'finanças', ' sem complicação'];
  const fullTitle = titleWords.join('');

  function renderTyped(count) {
    if (!typedTitle) return;
    const text = fullTitle.slice(0, count);
    const greenStart = titleWords[0].length;
    const greenEnd = greenStart + titleWords[1].length;
    if (count <= greenStart) {
      typedTitle.textContent = text;
      return;
    }
    const before = text.slice(0, greenStart);
    const accented = text.slice(greenStart, Math.min(count, greenEnd));
    const after = text.slice(greenEnd);
    typedTitle.innerHTML = `${before}<span class="accent">${accented}</span>${after}`;
  }

  if (typedTitle) {
    if (reduceMotion) {
      renderTyped(fullTitle.length);
      typingCursor?.classList.add('finished');
    } else {
      typedTitle.textContent = '';
      let index = 0;
      const type = () => {
        renderTyped(index++);
        if (index <= fullTitle.length) window.setTimeout(type, 42);
        else typingCursor?.classList.add('finished');
      };
      type();
    }
  }

  window.addEventListener('load', () => window.lucide?.createIcons({ attrs: { 'stroke-width': 1.9 } }), { once: true });

  const header = document.getElementById('siteHeader');
  const progress = document.getElementById('progressBar');
  function updateScrollUI() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = max > 0 ? `${(window.scrollY / max) * 100}%` : '0%';
    header?.classList.toggle('scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', updateScrollUI, { passive: true });
  updateScrollUI();

  const menuToggle = document.getElementById('menuToggle');
  const drawer = document.getElementById('mobileDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const drawerClose = document.getElementById('drawerClose');
  function toggleDrawer(open) {
    if (!menuToggle || !drawer || !backdrop) return;
    drawer.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    document.body.classList.toggle('drawer-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    menuToggle.setAttribute('aria-expanded', String(open));
    if (open) drawerClose?.focus();
    else menuToggle.focus();
  }
  menuToggle?.addEventListener('click', () => toggleDrawer(true));
  drawerClose?.addEventListener('click', () => toggleDrawer(false));
  backdrop?.addEventListener('click', () => toggleDrawer(false));
  drawer?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => toggleDrawer(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer?.classList.contains('open')) toggleDrawer(false);
  });

  const revealItems = document.querySelectorAll('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('visible'));
  } else {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12 });
    revealItems.forEach((item) => observer.observe(item));
  }

  const stage = document.getElementById('deviceStage');
  const tilt = document.getElementById('deviceTilt');
  if (!reduceMotion && stage && tilt && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    stage.addEventListener('pointermove', (event) => {
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      tilt.style.transform = `rotateY(${-11 + x * 11}deg) rotateX(${4 - y * 9}deg)`;
    });
    stage.addEventListener('pointerleave', () => { tilt.style.transform = 'rotateY(-11deg) rotateX(4deg)'; });
  }

  document.querySelectorAll('.faq-question').forEach((button) => button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    document.querySelectorAll('.faq-question').forEach((item) => item.setAttribute('aria-expanded', 'false'));
    button.setAttribute('aria-expanded', String(!expanded));
  }));

  function setupCarousel(trackId, previousId, nextId, dotSelector) {
    const track = document.getElementById(trackId);
    const previous = document.getElementById(previousId);
    const next = document.getElementById(nextId);
    if (!track || !previous || !next) return;
    const slides = Array.from(track.children);
    if (!slides.length) return;
    let current = 0;
    const dots = dotSelector ? Array.from(document.querySelectorAll(dotSelector)) : [];
    function updateDots() {
      dots.forEach((dot, index) => {
        const selected = index === current;
        dot.classList.toggle('active', selected);
        dot.setAttribute('aria-current', String(selected));
      });
    }
    function go(index) {
      current = (index + slides.length) % slides.length;
      slides[current].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', inline: 'start', block: 'nearest' });
      updateDots();
    }
    previous.addEventListener('click', () => go(current - 1));
    next.addEventListener('click', () => go(current + 1));
    dots.forEach((dot, index) => dot.addEventListener('click', () => go(index)));
    track.addEventListener('scroll', () => {
      const nearest = slides.reduce((best, slide, index) => (
        Math.abs(slide.getBoundingClientRect().left - track.getBoundingClientRect().left)
          < Math.abs(slides[best].getBoundingClientRect().left - track.getBoundingClientRect().left) ? index : best
      ), current);
      if (nearest !== current) {
        current = nearest;
        updateDots();
      }
    }, { passive: true });
  }

  setupCarousel('previewCarousel', 'previewPrev', 'previewNext');
  setupCarousel('testimonialsTrack', 'testimonialPrev', 'testimonialNext', '.dot-button');
})();
