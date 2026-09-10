/*!
 * P · Accordion Media  v1.0
 * Accordion that swaps a stacked image when an item opens.
 *
 * Markup (classes):
 *   .p-acc                      root   (options below)
 *     .p-acc__img  × n          images, matched to items by order
 *     .p-acc__item × n
 *       .p-acc__trigger         contains the heading (.p-acc__title) + .p-acc__icon
 *       .p-acc__panel > .p-acc__panel-inner > content
 *
 * Root options (custom attributes):
 *   data-p-acc-effect="wipe | curtain | fade"   default: wipe
 *   data-p-acc-open="2"                         item open on load (1-based), default: 1
 *   data-p-acc-toggle                           allow closing the open item
 *
 * Timing lives in CSS: --p-acc-duration, --p-acc-ease, --p-acc-accent
 * Re-init after AJAX / popups: PAccordionMedia.init(scopeElement)
 */
(() => {
  'use strict';

  const EFFECTS = ['wipe', 'curtain', 'fade'];
  let uid = 0;

  const toMs = (value, fallback) => {
    const v = String(value || '').trim();
    const n = parseFloat(v);
    if (Number.isNaN(n)) return fallback;
    return v.endsWith('ms') ? n : n * 1000;
  };

  function setup(root) {
    if (root.pAcc) return root.pAcc;

    const items = [...root.querySelectorAll('.p-acc__item')];
    const imgs = [...root.querySelectorAll('.p-acc__img')];
    if (!items.length) return null;

    const effect = EFFECTS.includes(root.dataset.pAccEffect) ? root.dataset.pAccEffect : 'wipe';
    const canClose = root.hasAttribute('data-p-acc-toggle');
    const duration = () => toMs(getComputedStyle(root).getPropertyValue('--p-acc-duration'), 900);

    let current = -1;
    let z = 1;
    let timer = 0;
    let curtain = null;

    root.classList.add('is-ready', `p-acc--${effect}`);

    if (effect === 'curtain' && imgs[0]) {
      curtain = document.createElement('div');
      curtain.className = 'p-acc__curtain';
      curtain.setAttribute('aria-hidden', 'true');
      imgs[0].parentNode.appendChild(curtain);
    }

    // Turn each heading into an accessible button (heading > button pattern)
    const buttons = [];
    const panels = [];

    items.forEach((item, i) => {
      const trigger = item.querySelector('.p-acc__trigger') || item;
      const panel = item.querySelector('.p-acc__panel');
      const heading = trigger.querySelector('.p-acc__title') || trigger.querySelector('h1,h2,h3,h4,h5,h6');

      let btn;
      if (heading) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'p-acc__btn';
        while (heading.firstChild) btn.appendChild(heading.firstChild);
        heading.appendChild(btn);
      } else {
        btn = trigger;
        btn.setAttribute('role', 'button');
        btn.tabIndex = 0;
        btn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
        });
      }

      btn.id = btn.id || `p-acc-btn-${++uid}`;
      btn.setAttribute('aria-expanded', 'false');

      if (panel) {
        panel.id = panel.id || `p-acc-panel-${uid}`;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', btn.id);
        btn.setAttribute('aria-controls', panel.id);
      }

      btn.addEventListener('click', () => open(i));
      btn.addEventListener('keydown', (e) => {
        const map = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        buttons[(map[e.key] + items.length) % items.length].focus();
      });

      buttons.push(btn);
      panels.push(panel);
    });

    function setItem(i, isOpen) {
      items[i].classList.toggle('is-open', isOpen);
      buttons[i].setAttribute('aria-expanded', String(isOpen));
      if (panels[i]) panels[i].inert = !isOpen;
    }

    function showImage(i) {
      const img = imgs[i];
      if (!img || img.classList.contains('is-active')) return;

      clearTimeout(timer);

      // The outgoing image stays visible underneath while the new one comes in
      imgs.forEach((el) => {
        if (el.classList.contains('is-active')) el.classList.replace('is-active', 'is-shown');
      });

      img.classList.remove('is-shown');
      void img.offsetWidth; // restart from the hidden state

      z += 2;
      img.style.zIndex = z;

      if (curtain) {
        curtain.classList.remove('is-running');
        curtain.style.zIndex = z - 1;
        void curtain.offsetWidth;
        curtain.classList.add('is-running');
      }

      img.classList.add('is-active');

      // Once the new image has fully covered the frame, reset everything below it
      timer = setTimeout(() => {
        imgs.forEach((el) => {
          if (el === img) return;
          el.classList.remove('is-shown');
          el.style.zIndex = '';
        });
        if (curtain) {
          curtain.classList.remove('is-running');
          curtain.style.zIndex = '';
        }
        z = 1;
        img.style.zIndex = z;
      }, duration() * 1.6);
    }

    function open(i) {
      if (i === current) {
        if (canClose) { setItem(i, false); current = -1; }
        return;
      }
      if (current > -1) setItem(current, false);
      setItem(i, true);
      showImage(i);
      current = i;
    }

    items.forEach((_, i) => setItem(i, false));

    const start = Math.min(Math.max(parseInt(root.dataset.pAccOpen, 10) || 1, 1), items.length) - 1;
    open(start);

    // Enable transitions only after the first paint, so the initial state doesn't animate
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-animated')));

    root.pAcc = {
      open: (n) => open(n - 1),
      get index() { return current + 1; },
    };
    return root.pAcc;
  }

  const init = (scope = document) => {
    const roots = scope.matches && scope.matches('.p-acc') ? [scope] : scope.querySelectorAll('.p-acc');
    roots.forEach(setup);
  };

  window.PAccordionMedia = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
