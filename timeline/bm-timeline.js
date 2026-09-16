/*!
 * BM · Timeline  v1.4
 * A year axis that swaps the image and text for the selected entry.
 *
 * Markup (classes):
 *   .bm-timeline                                   root section
 *     .bm-timeline__stage                          holds the ghost year + media + text
 *       .bm-timeline__ghost                        big background year (optional; filled by JS)
 *       .bm-timeline__media                        image stack
 *         .bm-timeline__visual × n                 Image element, or a Video element wrapper
 *       .bm-timeline__entries
 *         .bm-timeline__entry × n                  any content: heading, text, button…
 *     .bm-timeline__prev / .bm-timeline__next      arrows (optional; empty = CSS arrow, or add an Icon)
 *     .bm-timeline__axis                           the year rail
 *       .bm-timeline__point × n                    one per entry, in the same order
 *         .bm-timeline__year   e.g. 2021
 *         .bm-timeline__label  e.g. Eyes on Ukraine
 *
 * Root options (custom attributes) — full list in the guide:
 *   data-bm-timeline-effect="wipe | fade"        how the image changes (default: wipe)
 *   data-bm-timeline-start="2"                   entry shown on load (1-based)
 *   data-bm-timeline-loop                        arrows wrap around instead of stopping
 *   data-bm-timeline-label="Our history"         accessible name for the rail
 *   data-bm-timeline-media="left|right|center|overlay"   where the image sits
 *   data-bm-timeline-align="top|center|bottom"   where the text sits beside it
 *   data-bm-timeline-text="left|center|right"    sideways text alignment
 *   data-bm-timeline-arrows="text|media|edge"    what the arrows line up with
 *   data-bm-timeline-mobile="drag|arrows|both"   under 768px (default: drag)
 *
 * State classes: bm-is-ready, bm-is-animated, bm-is-active, bm-is-shown, bm-is-back, bm-is-disabled
 * Element API:   el.bmTimeline.goTo(n) / .next() / .prev() / .refresh() / .destroy()
 * Init after AJAX / popups: BMTimeline.init(scopeElement)
 */
(() => {
  'use strict';

  const ROOT = '.bm-timeline';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  let uid = 0;

  const toMs = (value, fallback) => {
    const v = String(value || '').trim();
    const n = parseFloat(v);
    if (Number.isNaN(n)) return fallback;
    return v.endsWith('ms') ? n : n * 1000;
  };

  const videoOf = (el) => (el.matches('video') ? el : el.querySelector('video'));

  function setup(root) {
    if (root.bmTimeline) return root.bmTimeline;

    // Only this timeline's own parts, so a nested one stays separate
    const own = (sel) => [...root.querySelectorAll(sel)].filter((el) => el.closest(ROOT) === root);

    const points = own('.bm-timeline__point');
    const entries = own('.bm-timeline__entry');
    const visuals = own('.bm-timeline__visual');
    const axis = own('.bm-timeline__axis')[0];
    const ghost = own('.bm-timeline__ghost')[0];
    const prevBtns = own('.bm-timeline__prev');
    const nextBtns = own('.bm-timeline__next');
    if (!points.length) return null;

    const count = points.length;
    const loop = root.hasAttribute('data-bm-timeline-loop');
    const effect = root.dataset.bmTimelineEffect === 'fade' ? 'fade' : 'wipe';
    const duration = () => toMs(getComputedStyle(root).getPropertyValue('--bm-timeline-duration'), 800);

    const ac = new AbortController();
    const on = (el, type, fn, opts = {}) => el.addEventListener(type, fn, { ...opts, signal: ac.signal });

    let current = -1;
    let z = 1;
    let timer = 0;

    root.classList.add('bm-is-ready', `bm-timeline--${effect}`);

    /* ---------- videos: only the visible one plays ---------- */
    visuals.forEach((v) => {
      const video = videoOf(v);
      if (!video) return;
      video.muted = true;
      video.playsInline = true;
      video.removeAttribute('autoplay');
      video.pause();
    });

    /* ---------- axis becomes a tab list ---------- */
    const group = `bm-timeline-${++uid}`;
    if (axis) {
      axis.setAttribute('role', 'tablist');
      axis.setAttribute('aria-label', root.dataset.bmTimelineLabel || 'Timeline');
    }

    const buttons = points.map((point, i) => {
      let btn = point.querySelector('button');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bm-timeline__point-btn';
        while (point.firstChild) btn.appendChild(point.firstChild);
        point.appendChild(btn);
      }
      btn.id = `${group}-tab-${i + 1}`;
      btn.setAttribute('role', 'tab');

      const entry = entries[i];
      if (entry) {
        entry.id = entry.id || `${group}-panel-${i + 1}`;
        entry.setAttribute('role', 'tabpanel');
        entry.setAttribute('aria-labelledby', btn.id);
        btn.setAttribute('aria-controls', entry.id);
      }

      on(btn, 'click', () => goTo(i));
      on(btn, 'keydown', (e) => {
        const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: count - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        const n = (map[e.key] + count) % count;
        buttons[n].focus();
        goTo(n);
      });
      return btn;
    });

    /* ---------- media ---------- */
    function showVisual(i) {
      const next = visuals[i];
      if (!next || next.classList.contains('bm-is-active')) return;

      clearTimeout(timer);

      visuals.forEach((el) => {
        if (el.classList.contains('bm-is-active')) el.classList.replace('bm-is-active', 'bm-is-shown');
      });

      next.classList.remove('bm-is-shown');
      void next.offsetWidth; // restart from the hidden state

      z += 2;
      next.style.zIndex = z;
      next.classList.add('bm-is-active');

      const video = videoOf(next);
      if (video) {
        const playing = video.play();
        if (playing && playing.catch) playing.catch(() => {});
      }

      // Once the new visual covers the frame, reset everything underneath
      timer = setTimeout(() => {
        visuals.forEach((el) => {
          if (el === next) return;
          el.classList.remove('bm-is-shown');
          el.style.zIndex = '';
          const v = videoOf(el);
          if (v) v.pause();
        });
        z = 1;
        next.style.zIndex = z;
      }, duration() * 1.6);
    }

    /* ---------- axis: keep the active year in view ---------- */
    let axisBusy = 0;     // we are scrolling the axis ourselves, so ignore its scroll events
    let axisTimer = 0;

    function centreAxis(i) {
      if (!axis || current === -1) return;
      const point = points[i];
      const max = axis.scrollWidth - axis.clientWidth;
      if (max <= 1) return;
      const target = clamp(point.offsetLeft + point.offsetWidth / 2 - axis.clientWidth / 2, 0, max);
      if (Math.abs(axis.scrollLeft - target) < 2) return;
      axisBusy++;
      clearTimeout(axisTimer);
      axisTimer = setTimeout(() => { axisBusy = 0; }, reduceMotion.matches ? 60 : 700);
      axis.scrollTo({ left: target, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    // Which year is nearest the middle of the axis
    function nearestPoint() {
      const mid = axis.scrollLeft + axis.clientWidth / 2;
      let best = 0;
      let dist = Infinity;
      points.forEach((point, i) => {
        const d = Math.abs(point.offsetLeft + point.offsetWidth / 2 - mid);
        if (d < dist) { dist = d; best = i; }
      });
      return best;
    }

    /* ---------- dragging the rail selects a year ---------- */
    if (axis) {
      let settle = 0;
      on(axis, 'scroll', () => {
        if (axisBusy) return;                   // our own scroll, not the person's
        clearTimeout(settle);
        settle = setTimeout(() => {
          if (axis.scrollWidth - axis.clientWidth <= 1) return;
          goTo(nearestPoint());
        }, 120);
      }, { passive: true });

      // Mouse drag (touch already scrolls natively)
      let drag = null;
      let dragged = false;
      on(axis, 'pointerdown', (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        if (axis.scrollWidth - axis.clientWidth <= 1) return;
        drag = { id: e.pointerId, startX: e.clientX, startLeft: axis.scrollLeft, moved: false };
      });
      on(axis, 'pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.startX;
        if (!drag.moved) {
          if (Math.abs(dx) < 6) return;
          drag.moved = true;
          axisBusy = 0;
          axis.setPointerCapture(e.pointerId);
          root.classList.add('bm-is-dragging');
        }
        axis.scrollLeft = drag.startLeft - dx;
      });
      const endDrag = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const moved = drag.moved;
        drag = null;
        if (!moved) return;
        dragged = true;
        setTimeout(() => { dragged = false; }, 0);
        root.classList.remove('bm-is-dragging');
      };
      on(axis, 'pointerup', endDrag);
      on(axis, 'pointercancel', endDrag);
      // A drag that ends on a year must not count as tapping that year
      on(axis, 'click', (e) => {
        if (!dragged) return;
        e.preventDefault();
        e.stopPropagation();
      }, { capture: true });
      on(axis, 'dragstart', (e) => e.preventDefault());
    }

    function setDisabled(el, disabled) {
      el.classList.toggle('bm-is-disabled', disabled);
      el.setAttribute('aria-disabled', String(disabled));
    }

    function goTo(i, back) {
      const n = loop ? (i + count) % count : clamp(i, 0, count - 1);
      if (n === current) return;

      // Direction comes from the step asked for, not the index, so looping from the
      // last entry to the first still wipes forwards.
      const goingBack = back === undefined ? current > -1 && i < current : back;
      root.classList.toggle('bm-is-back', Boolean(goingBack));

      points.forEach((point, k) => point.classList.toggle('bm-is-active', k === n));
      buttons.forEach((btn, k) => {
        btn.setAttribute('aria-selected', String(k === n));
        btn.tabIndex = k === n ? 0 : -1;
      });
      entries.forEach((entry, k) => {
        const on_ = k === n;
        entry.classList.toggle('bm-is-active', on_);
        entry.hidden = false;
        entry.inert = !on_;
      });

      showVisual(n);
      if (ghost) {
        const year = points[n].querySelector('.bm-timeline__year');
        ghost.textContent = year ? year.textContent.trim() : '';
      }

      prevBtns.forEach((b) => setDisabled(b, !loop && n === 0));
      nextBtns.forEach((b) => setDisabled(b, !loop && n === count - 1));

      centreAxis(n);
      current = n;
    }

    const next = () => goTo(current + 1, false);
    const prev = () => goTo(current - 1, true);

    /* ---------- arrows ---------- */
    function makeButton(el, label, action) {
      if (el.tagName !== 'BUTTON') {
        el.setAttribute('role', 'button');
        if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
        on(el, 'keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            action();
          }
        });
      }
      if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', label);
      on(el, 'click', action);
    }
    prevBtns.forEach((b) => makeButton(b, 'Previous entry', prev));
    nextBtns.forEach((b) => makeButton(b, 'Next entry', next));

    /* ---------- swipe on the stage (touch only; the axis scrolls natively) ---------- */
    const stage = own('.bm-timeline__stage')[0];
    if (stage) {
      let start = null;
      on(stage, 'touchstart', (e) => {
        if (e.touches.length !== 1) return;
        start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }, { passive: true });
      on(stage, 'touchend', (e) => {
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        start = null;
        if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        if (dx < 0) next();
        else prev();
      }, { passive: true });
    }

    /* ---------- start ---------- */
    const startAt = clamp(parseInt(root.dataset.bmTimelineStart, 10) || 1, 1, count) - 1;
    goTo(startAt);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add('bm-is-animated');
      centreAxis(current);
    }));

    root.bmTimeline = {
      goTo: (n) => goTo(n - 1),
      next,
      prev,
      refresh: () => centreAxis(current),
      get index() { return current + 1; },
      destroy() {
        ac.abort();
        clearTimeout(timer);
        clearTimeout(axisTimer);
        root.classList.remove('bm-is-ready', 'bm-is-animated', 'bm-is-back', 'bm-is-dragging', `bm-timeline--${effect}`);
        delete root.bmTimeline;
      },
    };
    return root.bmTimeline;
  }

  const init = (scope = document) => {
    const roots = scope.matches && scope.matches(ROOT) ? [scope] : scope.querySelectorAll(ROOT);
    roots.forEach(setup);
  };

  window.BMTimeline = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
