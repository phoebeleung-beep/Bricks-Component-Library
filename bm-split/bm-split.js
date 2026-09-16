/*!
 * BM · Split Panels  v2.0
 * Side-by-side panels: the one you point at widens, the others give up room.
 * Works with 2, 3 or 4 panels, and with any content inside them.
 *
 * Markup — three classes, nothing else:
 *   .bm-split                     the section
 *     .bm-split__row              the row the panels sit in
 *       .bm-split__panel × 2-4    any content
 *
 * Root options (custom attributes):
 *   data-bm-split-open="none"     "none" = all panels equal at rest (default in the
 *                                 supplied JSON); or a number, 1-based, to leave one open
 *   data-bm-split-trigger="hover | click"   default: hover
 *
 * State classes: bm-is-ready, bm-is-active, bm-is-idle
 * Element API:   el.bmSplit.open(n) / .reset() / .destroy()
 * Init after AJAX / popups: BMSplit.init(scopeElement)
 */
(() => {
  'use strict';

  const ROOT = '.bm-split';
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function setup(root) {
    if (root.bmSplit) return root.bmSplit;

    // Only this section's own panels, so a nested split stays separate
    const own = (sel) => [...root.querySelectorAll(sel)].filter((el) => el.closest(ROOT) === root);

    const panels = own('.bm-split__panel');
    if (!panels.length) return null;
    const row = own('.bm-split__row')[0] || panels[0].parentNode;

    const ac = new AbortController();
    const on = (el, type, fn, opts = {}) => el.addEventListener(type, fn, { ...opts, signal: ac.signal });

    const clickOnly = root.dataset.bmSplitTrigger === 'click';
    const raw = String(root.dataset.bmSplitOpen ?? '1').trim();
    const rest = raw === 'none' ? -1 : Math.min(Math.max(parseInt(raw, 10) || 1, 1), panels.length) - 1;

    let current = null;    // not -1: that is a real value meaning "all equal"
    let pressedOn = null;  // which panel was open when the press started

    root.classList.add('bm-is-ready');

    function apply(i) {
      if (i === current) return;
      current = i;
      panels.forEach((panel, n) => panel.classList.toggle('bm-is-active', n === i));
      root.classList.toggle('bm-is-idle', i === -1);
    }

    const reset = () => apply(rest);

    panels.forEach((panel, i) => {
      if (!panel.matches('a, button') && !panel.querySelector('a, button') && !panel.hasAttribute('tabindex')) {
        panel.tabIndex = 0;
      }

      if (!clickOnly) {
        on(panel, 'pointerenter', (e) => {
          if (e.pointerType === 'touch') return;   // touch gets a tap instead
          apply(i);
        });
      }

      // Note what was open before the press: tapping a link focuses it, which
      // would otherwise open the panel before the click handler even runs.
      on(panel, 'pointerdown', () => { pressedOn = current; }, { capture: true, passive: true });

      on(panel, 'click', (e) => {
        if (!clickOnly && finePointer.matches && e.pointerType !== 'touch') return;
        const wasOpen = (pressedOn === null ? current : pressedOn) === i;
        pressedOn = null;
        if (wasOpen) return;               // already open: let links do their job
        apply(i);
        if (e.target.closest('a, button')) e.preventDefault();   // first tap just opens
      });

      on(panel, 'focusin', () => apply(i));
      on(panel, 'keydown', (e) => {
        if (e.target !== panel) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(i); }
        const map = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + 1, ArrowUp: i - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        panels[(map[e.key] + panels.length) % panels.length].focus();
      });
    });

    if (!clickOnly) {
      on(row, 'pointerleave', (e) => {
        if (e.pointerType === 'touch') return;
        reset();
      });
    }
    // Tapping outside closes, so a tapped panel doesn't stay stuck open
    on(document, 'pointerdown', (e) => { if (!root.contains(e.target)) reset(); }, { passive: true });

    reset();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('bm-is-animated')));

    root.bmSplit = {
      open: (n) => apply(Math.min(Math.max(n, 1), panels.length) - 1),
      reset,
      get index() { return current + 1; },
      destroy() {
        ac.abort();
        panels.forEach((p) => p.classList.remove('bm-is-active'));
        root.classList.remove('bm-is-ready', 'bm-is-animated', 'bm-is-idle');
        delete root.bmSplit;
      },
    };
    return root.bmSplit;
  }

  const init = (scope = document) => {
    const roots = scope.matches && scope.matches(ROOT) ? [scope] : scope.querySelectorAll(ROOT);
    roots.forEach(setup);
  };

  window.BMSplit = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
