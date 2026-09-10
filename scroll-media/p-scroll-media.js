/*!
 * P · Scroll Media  v1.0
 * Sticky media that changes as each content step scrolls past.
 *
 * Markup (classes):
 *   .p-scroll                         root (options below)
 *     .p-scroll__frame                sticky box that holds the media
 *       .p-scroll__visual × n         Image element, or Video element wrapper
 *     .p-scroll__steps                column of steps (progress nav is added here)
 *       .p-scroll__step × n           matched to visuals by order
 *
 * Root options (custom attributes):
 *   data-p-scroll-effect="wipe | curtain | fade"   default: wipe
 *   data-p-scroll-line="50"                        trigger line, % from top of viewport
 *   data-p-scroll-no-nav                           hide the progress lines
 *
 * Timing and colour live in CSS: --p-scroll-duration, --p-scroll-ease, --p-scroll-accent
 * Re-init after AJAX / popups: PScrollMedia.init(scopeElement)
 */
(() => {
  'use strict';

  const EFFECTS = ['wipe', 'curtain', 'fade'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const toMs = (value, fallback) => {
    const v = String(value || '').trim();
    const n = parseFloat(v);
    if (Number.isNaN(n)) return fallback;
    return v.endsWith('ms') ? n : n * 1000;
  };

  const videoOf = (el) => (el.matches('video') ? el : el.querySelector('video'));

  function setup(root) {
    if (root.pScroll) return root.pScroll;

    const steps = [...root.querySelectorAll('.p-scroll__step')];
    const visuals = [...root.querySelectorAll('.p-scroll__visual')];
    if (!steps.length) return null;

    const effect = EFFECTS.includes(root.dataset.pScrollEffect) ? root.dataset.pScrollEffect : 'wipe';
    const line = Math.min(Math.max(parseFloat(root.dataset.pScrollLine) || 50, 1), 99);
    const duration = () => toMs(getComputedStyle(root).getPropertyValue('--p-scroll-duration'), 1000);

    let current = -1;
    let z = 1;
    let timer = 0;
    let curtain = null;

    root.classList.add('is-ready', `p-scroll--${effect}`);

    // Videos: only the active one plays
    visuals.forEach((v) => {
      const video = videoOf(v);
      if (!video) return;
      video.muted = true;
      video.playsInline = true;
      video.removeAttribute('autoplay');
      video.pause();
    });

    if (effect === 'curtain' && visuals[0]) {
      curtain = document.createElement('div');
      curtain.className = 'p-scroll__curtain';
      curtain.setAttribute('aria-hidden', 'true');
      visuals[0].parentNode.appendChild(curtain);
    }

    // Progress lines
    const dots = [];
    if (!root.hasAttribute('data-p-scroll-no-nav')) {
      const nav = document.createElement('nav');
      nav.className = 'p-scroll__nav';
      nav.setAttribute('aria-label', 'Section progress');
      const list = document.createElement('div');
      list.className = 'p-scroll__nav-list';

      steps.forEach((step, i) => {
        const title = step.querySelector('.p-scroll__title, h1, h2, h3, h4, h5, h6');
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'p-scroll__dot';
        dot.setAttribute('aria-label', title ? title.textContent.trim() : `Step ${i + 1}`);
        dot.addEventListener('click', () => {
          step.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
        });
        list.appendChild(dot);
        dots.push(dot);
      });

      nav.appendChild(list);
      (root.querySelector('.p-scroll__steps') || steps[0].parentNode).appendChild(nav);
    }

    function showVisual(i) {
      const next = visuals[i];
      if (!next || next.classList.contains('is-active')) return;

      clearTimeout(timer);

      visuals.forEach((el) => {
        if (el.classList.contains('is-active')) el.classList.replace('is-active', 'is-shown');
      });

      next.classList.remove('is-shown');
      void next.offsetWidth; // restart from the hidden state

      z += 2;
      next.style.zIndex = z;

      if (curtain) {
        curtain.classList.remove('is-running');
        curtain.style.zIndex = z - 1;
        void curtain.offsetWidth;
        curtain.classList.add('is-running');
      }

      next.classList.add('is-active');

      const video = videoOf(next);
      if (video) {
        const playing = video.play();
        if (playing && playing.catch) playing.catch(() => {});
      }

      // Once the new visual covers the frame, reset everything underneath
      timer = setTimeout(() => {
        visuals.forEach((el) => {
          if (el === next) return;
          el.classList.remove('is-shown');
          el.style.zIndex = '';
          const v = videoOf(el);
          if (v) v.pause();
        });
        if (curtain) {
          curtain.classList.remove('is-running');
          curtain.style.zIndex = '';
        }
        z = 1;
        next.style.zIndex = z;
      }, duration() * 1.6);
    }

    function activate(i) {
      if (i === current || i < 0) return;
      root.classList.toggle('is-dir-up', current > -1 && i < current);
      steps.forEach((step, n) => step.classList.toggle('is-active', n === i));
      dots.forEach((dot, n) => dot.setAttribute('aria-current', String(n === i)));
      showVisual(i);
      current = i;
    }

    activate(0);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) activate(steps.indexOf(entry.target));
        });
      },
      { rootMargin: `-${line}% 0px -${99 - line}% 0px`, threshold: 0 }
    );
    steps.forEach((step) => observer.observe(step));

    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-animated')));

    root.pScroll = {
      go: (n) => steps[n - 1] && steps[n - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }),
      get index() { return current + 1; },
      destroy: () => observer.disconnect(),
    };
    return root.pScroll;
  }

  const init = (scope = document) => {
    const roots = scope.matches && scope.matches('.p-scroll') ? [scope] : scope.querySelectorAll('.p-scroll');
    roots.forEach(setup);
  };

  window.PScrollMedia = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
