import { mountGlassText } from '@liquidglassjs/core';
// body.html is a saved live-DOM snapshot. If a re-capture ever bakes mounted
// state back in (data-lgf-mounted + filter style + <filter id="gtext-…"> holder),
// strip it before mounting — the guard below would otherwise skip the element,
// freezing the glass at capture-time geometry and leaving the Tuner's typeface
// section (reconfigureAllGlassText) with zero live instances to drive.
document.querySelectorAll('.lgf__text[data-lgf-mounted]').forEach((el) => {
  delete el.dataset.lgfMounted;
  el.style.filter = '';
  el.style.removeProperty('-webkit-filter');
});
document.querySelectorAll('filter[id^="gtext-"]').forEach((f) => f.closest('div')?.remove());
document.querySelectorAll('.lgf__text').forEach((el) => {
  if (el.dataset.lgfMounted) return;
  el.dataset.lgfMounted = '1';
  // Soften the ~100ms filter pop-in (item 5): dim now — only ever via JS, so the
  // no-JS fallback never dims — then ease to full opacity when the glass lands.
  el.classList.add('is-pending');
  const clear = () => el.classList.remove('is-pending');
  const safety = setTimeout(clear, 1500); // don't strand it dimmed if fonts.ready hangs
  mountGlassText({
    target: el,
    host: el.closest('.lgf') ?? el,
    onReady: () => {
      clearTimeout(safety);
      clear();
    },
  });
});
