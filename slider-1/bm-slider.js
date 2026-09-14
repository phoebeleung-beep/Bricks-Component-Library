/*!
 * BM · Slider  v1.1
 * Horizontal slider for any content: native scroll + snap, arrows, progress bar, mouse drag.
 *
 * Markup (classes):
 *   .bm-slider                              root section
 *     .bm-slider__track                     the scrolling row
 *       .bm-slider__slide × n               any content: text, images, buttons…
 *     .bm-slider__prev / .bm-slider__next   arrows (optional; empty = CSS arrow, or put an Icon inside)
 *     .bm-slider__progress                  progress bar (optional); .bm-slider__thumb is added if missing
 *
 * Root options (custom attributes):
 *   data-bm-slider-per-view="3.2, 2.2, 1.15"   slides visible on desktop, tablet (≤991px), mobile (≤767px)
 *   data-bm-slider-label="Common scenarios"    accessible name (default: the section's H1/H2)
 *
 * State classes: bm-is-ready, bm-is-dragging, bm-is-seeking, bm-is-static, bm-is-disabled
 * Element API:   el.bmSlider.next() / .prev() / .goTo(n) / .refresh() / .destroy()
 * Init after AJAX / popups: BMSlider.init(scopeElement)
 */
(() => {
  'use strict';

  const ROOT = '.bm-slider';
  const BREAKPOINTS = ['desktop', 'tablet', 'mobile'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const behavior = () => (reduceMotion.matches ? 'auto' : 'smooth');
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  let uid = 0;

  function setup(root) {
    if (root.bmSlider) return root.bmSlider;

    // Only elements that belong to this slider (safe if another slider is nested inside)
    const own = (sel) => [...root.querySelectorAll(sel)].filter((el) => el.closest(ROOT) === root);

    const track = own('.bm-slider__track')[0];
    if (!track) return null;

    const slides = () => [...track.children].filter((el) => el.classList.contains('bm-slider__slide'));
    const prevBtns = own('.bm-slider__prev');
    const nextBtns = own('.bm-slider__next');
    const bars = own('.bm-slider__progress');

    const ac = new AbortController();
    const on = (el, type, fn, opts = {}) => el.addEventListener(type, fn, { ...opts, signal: ac.signal });

    let ticking = false;
    let pending = null; // where an arrow click is heading, so fast clicks keep moving forward
    let settleTimer = 0;
    let seekTimer = 0;

    root.classList.add('bm-is-ready');

    /* ---------- options + accessibility ---------- */
    function readOptions() {
      const values = String(root.dataset.bmSliderPerView || '')
        .split(',')
        .map((v) => parseFloat(v));
      BREAKPOINTS.forEach((bp, i) => {
        if (values[i] > 0) root.style.setProperty(`--bm-slider-per-view-${bp}`, values[i]);
        else root.style.removeProperty(`--bm-slider-per-view-${bp}`);
      });
    }

    const heading = own('h1, h2').find((h) => !track.contains(h));
    track.id = track.id || `bm-slider-track-${++uid}`;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-roledescription', 'carousel');
    track.setAttribute('aria-label', root.dataset.bmSliderLabel || (heading ? heading.textContent.trim() : 'Slides'));
    if (!track.hasAttribute('tabindex')) track.tabIndex = 0;

    function labelSlides() {
      const all = slides();
      all.forEach((slide, i) => {
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', `${i + 1} of ${all.length}`);
      });
    }

    /* ---------- positions ---------- */
    const maxScroll = () => Math.max(track.scrollWidth - track.clientWidth, 0);

    function snaps() {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const max = maxScroll();
      const all = slides();
      const list = all.map((s) => Math.round(clamp(s.offsetLeft - pad, 0, max)));
      list.push(Math.round(max));
      const sorted = [...new Set(list)].sort((a, b) => a - b);

      // Drop points too close to the previous one: a 20px step reads as "the arrow
      // did nothing". Always keep the end so the last slide can be reached.
      const step = all[0] ? all[0].getBoundingClientRect().width : 0;
      const minGap = Math.max(40, step * 0.25);
      const out = [];
      sorted.forEach((s, i) => {
        const last = out[out.length - 1];
        if (last === undefined || s - last >= minGap) out.push(s);
        else if (i === sorted.length - 1) out[out.length - 1] = s; // end wins over a near-identical point
      });
      return out;
    }

    const nearest = (x) => snaps().reduce((best, s) => (Math.abs(s - x) < Math.abs(best - x) ? s : best), 0);

    function scrollToX(x) {
      pending = x;
      // Mandatory snapping can cancel or hijack a smooth scroll, which looks like a
      // dead arrow. Switch it off while we move, then back on once we land.
      root.classList.add('bm-is-seeking');
      track.scrollTo({ left: x, behavior: behavior() });
      settleSoon();
    }

    function next() {
      const from = pending ?? track.scrollLeft;
      const max = maxScroll();
      const target = snaps().find((s) => s > from + 2);
      if (target !== undefined) scrollToX(target);
      else if (from < max - 2) scrollToX(max);
    }

    function prev() {
      const from = pending ?? track.scrollLeft;
      const target = snaps().reverse().find((s) => s < from - 2);
      if (target !== undefined) scrollToX(target);
    }

    function goTo(n) {
      const slide = slides()[n - 1];
      if (!slide) return;
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      scrollToX(clamp(slide.offsetLeft - pad, 0, maxScroll()));
    }

    // Once movement stops: drop the pending target and switch snapping back on
    function settleSoon() {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 140);
      clearTimeout(seekTimer);
      // Fallback in case the scroll never completes (interrupted, or no scroll fired)
      seekTimer = setTimeout(settle, 900);
    }

    function settle() {
      clearTimeout(settleTimer);
      clearTimeout(seekTimer);
      pending = null;
      root.classList.remove('bm-is-seeking');
      if (!dragging) root.classList.remove('bm-is-dragging');
    }

    /* ---------- UI state ---------- */
    function setDisabled(el, disabled) {
      el.classList.toggle('bm-is-disabled', disabled);
      el.setAttribute('aria-disabled', String(disabled));
    }

    function update() {
      ticking = false;
      const max = maxScroll();
      const isStatic = max <= 1;
      const x = track.scrollLeft;
      const progress = isStatic ? 0 : clamp(x / max, 0, 1);
      const thumb = track.scrollWidth ? clamp(track.clientWidth / track.scrollWidth, 0.1, 1) : 1;

      root.classList.toggle('bm-is-static', isStatic);
      root.style.setProperty('--bm-slider-progress', progress.toFixed(4));
      root.style.setProperty('--bm-slider-thumb', thumb.toFixed(4));
      prevBtns.forEach((b) => setDisabled(b, isStatic || x <= 2));
      nextBtns.forEach((b) => setDisabled(b, isStatic || x >= max - 2));
      bars.forEach((bar) => bar.setAttribute('aria-valuenow', String(Math.round(progress * 100))));
    }

    const requestUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    on(track, 'scroll', () => {
      requestUpdate();
      if (pending !== null && Math.abs(track.scrollLeft - pending) < 2) settle();
      else settleSoon();
    }, { passive: true });

    // The moment the person scrolls themselves, our target is out of date.
    // Leaving it in place is what made an arrow press do nothing.
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((type) =>
      on(track, type, () => { pending = null; }, { passive: true })
    );

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
      el.setAttribute('aria-controls', track.id);
      on(el, 'click', action);
    }
    prevBtns.forEach((b) => makeButton(b, 'Previous slide', prev));
    nextBtns.forEach((b) => makeButton(b, 'Next slide', next));

    /* ---------- keyboard on the track ---------- */
    on(track, 'keydown', (e) => {
      if (e.target !== track) return;
      const keys = { ArrowRight: next, ArrowLeft: prev, Home: () => scrollToX(0), End: () => scrollToX(maxScroll()) };
      if (!keys[e.key]) return;
      e.preventDefault();
      keys[e.key]();
    });

    /* ---------- mouse drag (touch uses native scrolling) ---------- */
    let dragging = false;
    let drag = null;
    let suppressClick = false;

    on(track, 'pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || maxScroll() <= 1) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      drag = { id: e.pointerId, startX: e.clientX, startLeft: track.scrollLeft, lastX: e.clientX, lastT: e.timeStamp, v: 0, moved: false };
    });

    on(track, 'pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.startX;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        dragging = true;
        pending = null;
        track.setPointerCapture(e.pointerId);
        root.classList.add('bm-is-dragging');
        const sel = window.getSelection && window.getSelection();
        if (sel) sel.removeAllRanges();
      }
      const dt = e.timeStamp - drag.lastT || 16;
      drag.v = (e.clientX - drag.lastX) / dt;
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
      track.scrollLeft = drag.startLeft - dx;
    });

    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = drag.moved;
      const velocity = drag.v;
      drag = null;
      if (!moved) return;
      dragging = false;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      // Flick: carry on in the drag direction, then land on the nearest slide
      scrollToX(nearest(track.scrollLeft - velocity * 180));
    }
    on(track, 'pointerup', endDrag);
    on(track, 'pointercancel', endDrag);
    on(track, 'click', (e) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
    }, { capture: true });
    on(track, 'dragstart', (e) => e.preventDefault());

    /* ---------- progress bar: click or drag to scrub ---------- */
    bars.forEach((bar) => {
      if (!bar.querySelector('.bm-slider__thumb')) {
        const thumb = document.createElement('div');
        thumb.className = 'bm-slider__thumb';
        bar.appendChild(thumb);
      }
      bar.setAttribute('role', 'scrollbar');
      bar.setAttribute('aria-controls', track.id);
      bar.setAttribute('aria-orientation', 'horizontal');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');

      const seek = (e) => {
        const rect = bar.getBoundingClientRect();
        const thumb = parseFloat(root.style.getPropertyValue('--bm-slider-thumb')) || 0;
        const usable = rect.width * (1 - thumb) || 1;
        const ratio = clamp((e.clientX - rect.left - (rect.width * thumb) / 2) / usable, 0, 1);
        track.scrollLeft = ratio * maxScroll();
      };

      on(bar, 'pointerdown', (e) => {
        if (e.button !== 0 || maxScroll() <= 1) return;
        e.preventDefault();
        bar.setPointerCapture(e.pointerId);
        dragging = true;
        pending = null;
        root.classList.add('bm-is-dragging');
        seek(e);
        const move = (ev) => seek(ev);
        const up = () => {
          bar.removeEventListener('pointermove', move);
          bar.removeEventListener('pointerup', up);
          bar.removeEventListener('pointercancel', up);
          dragging = false;
          scrollToX(nearest(track.scrollLeft));
        };
        bar.addEventListener('pointermove', move);
        bar.addEventListener('pointerup', up);
        bar.addEventListener('pointercancel', up);
      });
    });

    /* ---------- sizing ---------- */
    const resizer = new ResizeObserver(requestUpdate);
    resizer.observe(track);
    // Lazy-loaded images change the slide positions after init
    on(track, 'load', requestUpdate, { capture: true });

    function refresh() {
      readOptions();
      labelSlides();
      update();
    }
    refresh();

    root.bmSlider = {
      next,
      prev,
      goTo,
      refresh,
      destroy() {
        ac.abort();
        resizer.disconnect();
        clearTimeout(settleTimer);
        clearTimeout(seekTimer);
        root.classList.remove('bm-is-ready', 'bm-is-dragging', 'bm-is-seeking', 'bm-is-static');
        delete root.bmSlider;
      },
    };
    return root.bmSlider;
  }

  const init = (scope = document) => {
    const roots = scope.matches && scope.matches(ROOT) ? [scope] : scope.querySelectorAll(ROOT);
    roots.forEach(setup);
  };

  window.BMSlider = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
