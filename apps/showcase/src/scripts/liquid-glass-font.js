import { mountGlassText, glassTween } from '@liquidglassjs/core';
import { presetDefaults } from '../lib/glass-presets';
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
  // Mount from the shared preset, not from the library defaults. The tuner reads the
  // same preset for what it displays, so without this the panel would open on numbers
  // the glass was never mounted with — and the typeface's resting strength is the one
  // value this page deliberately departs on, for the hover below.
  const glass = mountGlassText({
    target: el,
    host: el.closest('.lgf') ?? el,
    ...presetDefaults('text'),
    onReady: () => {
      clearTimeout(safety);
      clear();
    },
  });
  // Deepen the refraction on hover. `strength` is one of the params that only sets a
  // filter attribute, so this is a tween of an attribute rather than sixty
  // displacement maps a second — see glassTween.
  const REST = glass.getOptions().strength; // whatever it mounted at
  const HOVER = 12.5;
  const tween = glassTween(glass, { duration: 320 });
  // The tuner's "strength on hover" checkbox flips this attribute; honour it live so
  // unticking mid-hover eases back rather than stranding the glass deepened.
  const on = () => document.documentElement.dataset.lgfHover !== 'off';
  let over = false;
  const settle = () => tween.to({ strength: over && on() ? HOVER : REST });
  const hot = () => {
    over = true;
    settle();
  };
  const cold = () => {
    over = false;
    settle();
  };
  el.addEventListener('pointerenter', hot);
  el.addEventListener('pointerleave', cold);
  // keyboard and touch reach it too — the stage text is focusable (contenteditable)
  el.addEventListener('focus', hot);
  el.addEventListener('blur', cold);
  document.addEventListener('lgf-hover-change', settle);
});
