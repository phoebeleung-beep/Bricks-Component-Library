/*!
 * BM · Zoom Gallery  v2.0
 * A full-screen image that scales down into a photo grid as you scroll.
 *
 * Markup (classes):
 *   .bm-zoom                        root section; its height sets the scroll length (e.g. 300vh)
 *     .bm-zoom__stage               sticky, full viewport height
 *       .bm-zoom__grid              tiles, laid out by the CSS
 *         .bm-zoom__tile × 7        Image elements; .bm-zoom__tile--hero is the one that fills the screen
 *       .bm-zoom__text              optional overlay: heading, paragraph, button… (children fade in order)
 *
 * Root options (custom attributes):
 *   data-bm-zoom-text="start | end"   text over the full-screen image (start) or over the finished grid (end)
 *   data-bm-zoom-from="0.1"           scroll progress where the zoom begins (0–1)
 *   data-bm-zoom-to="0.8"             scroll progress where the zoom ends (0–1)
 *
 * Re-measure after layout changes: element.bmZoom.refresh()
 * Init after AJAX / popups: BMZoomGallery.init(scopeElement)
 */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, min = 0, max = 1) => Math.min(Math.max(v, min), max);
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const num = (v, fallback) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  };

  function setup(root) {
    if (root.bmZoom) return root.bmZoom;

    const stage = root.querySelector('.bm-zoom__stage');
    const grid = root.querySelector('.bm-zoom__grid');
    if (!stage || !grid) return null;

    const tiles = [...grid.querySelectorAll('.bm-zoom__tile')];
    const hero = grid.querySelector('.bm-zoom__tile--hero') || tiles[Math.floor(tiles.length / 2)];
    if (!hero) return null;

    root.classList.add('is-ready');

    let m = null;
    let ticking = false;

    function measure() {
      const stageW = stage.clientWidth;
      const stageH = stage.clientHeight;
      // Hero centre in grid coordinates (offset* ignores transforms)
      const ox = hero.offsetLeft + hero.offsetWidth / 2;
      const oy = hero.offsetTop + hero.offsetHeight / 2;
      const from = clamp(num(root.dataset.bmZoomFrom, 0.1));
      const to = Math.max(clamp(num(root.dataset.bmZoomTo, 0.8)), from + 0.01);

      m = {
        ox,
        oy,
        dx: stageW / 2 - (grid.offsetLeft + ox),
        dy: stageH / 2 - (grid.offsetTop + oy),
        scale: Math.max(stageW / hero.offsetWidth, stageH / hero.offsetHeight) * 1.02,
        from,
        to,
        textAtEnd: root.dataset.bmZoomText === 'end',
      };

      grid.style.transformOrigin = `${ox}px ${oy}px`;
      render();
    }

    function render() {
      ticking = false;
      if (!m) return;

      let p = 1;
      if (!reduceMotion.matches) {
        const rect = root.getBoundingClientRect();
        const track = rect.height - stage.clientHeight;
        p = track > 0 ? clamp(-rect.top / track) : 1;
      }

      const z = ease(clamp((p - m.from) / (m.to - m.from)));
      const k = 1 - z;
      const s = m.scale + (1 - m.scale) * z;
      grid.style.transform = `translate3d(${(m.dx * k).toFixed(2)}px, ${(m.dy * k).toFixed(2)}px, 0) scale(${s.toFixed(4)})`;

      let text;
      if (reduceMotion.matches) text = 1;
      else if (m.textAtEnd) text = clamp((p - (m.to - 0.02)) / 0.15);
      else text = 1 - clamp((p - m.from) / ((m.to - m.from) * 0.4));

      root.style.setProperty('--bm-zoom-text', text.toFixed(3));
      root.classList.toggle('is-text-hidden', text < 0.3); // matches when the last child has fully faded
      root.style.setProperty('--bm-zoom-progress', z.toFixed(3));
    }

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(render);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    const resizer = new ResizeObserver(measure);
    resizer.observe(stage);
    resizer.observe(grid);
    reduceMotion.addEventListener('change', measure);

    measure();

    root.bmZoom = {
      refresh: measure,
      destroy() {
        window.removeEventListener('scroll', onScroll);
        resizer.disconnect();
        reduceMotion.removeEventListener('change', measure);
        grid.style.transform = '';
        root.classList.remove('is-ready', 'is-text-hidden');
        delete root.bmZoom;
      },
    };
    return root.bmZoom;
  }

  const init = (scope = document) => {
    const roots = scope.matches && scope.matches('.bm-zoom') ? [scope] : scope.querySelectorAll('.bm-zoom');
    roots.forEach(setup);
  };

  window.BMZoomGallery = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();
