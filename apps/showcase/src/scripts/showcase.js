import { mountGlassLens } from '@liquidglassjs/core';
import { reconfigureAllGlassText, GLASS_TEXT_DEFAULTS } from '@liquidglassjs/core';
import { cubicBezier } from '@liquidglassjs/core';
const cfgSections = [];
const LENS_PARAMS = [
  { k: 'strength', min: 0, max: 40, step: 0.5 },
  { k: 'chroma', min: 0, max: 1.5, step: 0.02 },
  { k: 'blur', min: 0, max: 4, step: 0.05 },
  { k: 'dome', min: 0, max: 30, step: 0.5 },
  { k: 'depth', min: 0, max: 30, step: 0.5 },
  { k: 'radius', min: 0, max: 80, step: 1 },
  { k: 'edge', min: 0, max: 2, step: 0.05 },
  { k: 'glow', min: 0, max: 2, step: 0.05 },
  { k: 'shade', min: 0, max: 1, step: 0.05 },
];
// Render-paths tuner: the params `mountGlass` (the unified surface) accepts. Each of the
// three cards honors a different subset — see the per-focus `dead` sets below.
const RENDER_PARAMS = [
  { k: 'strength', min: 0, max: 40, step: 0.5 },
  { k: 'chroma', min: 0, max: 1.5, step: 0.02 },
  { k: 'blur', min: 0, max: 4, step: 0.05 },
  { k: 'dome', min: 0, max: 30, step: 0.5 },
  { k: 'depth', min: 0, max: 30, step: 0.5 },
  { k: 'edge', min: 0, max: 2, step: 0.05 },
  { k: 'glow', min: 0, max: 2, step: 0.05 },
];
const RIPPLE_PARAMS = [
  { k: 'strength', min: 0, max: 60, step: 1 },
  { k: 'chroma', min: 0, max: 1.5, step: 0.02 },
  { k: 'spec', min: 0, max: 1.5, step: 0.02 },
  { k: 'blur', min: 0, max: 3, step: 0.05 },
  { k: 'maxFrac', min: 0.2, max: 1.5, step: 0.02 },
  { k: 'duration', min: 300, max: 2500, step: 50 },
];
const QR_PARAMS = [
  { k: 'scaleX', min: 0, max: 0.25, step: 5e-3 },
  { k: 'scaleY', min: 0, max: 0.25, step: 5e-3 },
  { k: 'chromaAmount', label: 'chroma', min: 0, max: 3, step: 0.05 },
  { k: 'eyeRefractionScale', label: 'eyeScale', min: 0, max: 0.5, step: 0.01 },
  { k: 'lensDepth', label: 'depth', min: 0, max: 80, step: 1 },
  { k: 'lensDuration', label: 'duration', min: 1e3, max: 12e3, step: 250 },
  { k: 'colorSplash', label: 'splash', min: 100, max: 1e3, step: 10 },
  { k: 'ringStart', label: 'ringIn', min: 0, max: 1, step: 0.02 },
  { k: 'ringEnd', label: 'ringOut', min: 0, max: 1, step: 0.02 },
];
const CFG_ICONS = {
  segmented:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="4.5" width="13" height="7" rx="3.3"/><line x1="8" y1="4.7" x2="8" y2="11.3"/></svg>',
  slider:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><line x1="2" y1="8" x2="14" y2="8"/><circle cx="6" cy="8" r="2.4" fill="currentColor" stroke="none"/></svg>',
  switch:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="5" width="13" height="6" rx="3"/><circle cx="11" cy="8" r="2" fill="currentColor" stroke="none"/></svg>',
  lens: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6.8" cy="6.8" r="4.3"/><line x1="10.2" y1="10.2" x2="14" y2="14"/></svg>',
  ripple:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="4" opacity="0.85"/><circle cx="8" cy="8" r="6.3" opacity="0.4"/></svg>',
  qr: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1"/><rect x="10" y="1.5" width="4.5" height="4.5" rx="1"/><rect x="1.5" y="10" width="4.5" height="4.5" rx="1"/><rect x="10.5" y="10.5" width="3" height="3" fill="currentColor" stroke="none"/></svg>',
  font: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.4 13 L8 3 L12.6 13"/><line x1="5.3" y1="9.6" x2="10.7" y2="9.6"/></svg>',
  button:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="5" width="13" height="6" rx="3"/><line x1="5.2" y1="8" x2="10.8" y2="8"/></svg>',
  dropdown:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="2" width="11" height="3.6" rx="1.8"/><rect x="2.5" y="8" width="11" height="6" rx="2" opacity="0.55"/></svg>',
  shape:
    '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M8 1c.7 4 3 6.3 7 7-4 .7-6.3 3-7 7-.7-4-3-6.3-7-7 4-.7 6.3-3 7-7z"/></svg>',
  emoji:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none"/><line x1="8" y1="1.5" x2="8" y2="3.6"/><line x1="8" y1="12.4" x2="8" y2="14.5"/><line x1="1.5" y1="8" x2="3.6" y2="8"/><line x1="12.4" y1="8" x2="14.5" y2="8"/><line x1="3.5" y1="3.5" x2="5" y2="5"/><line x1="11" y1="11" x2="12.5" y2="12.5"/><line x1="12.5" y1="3.5" x2="11" y2="5"/><line x1="5" y1="11" x2="3.5" y2="12.5"/></svg>',
  paths:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="3" width="8" height="5.5" rx="1.4"/><rect x="4" y="5.2" width="8" height="5.5" rx="1.4" opacity="0.6"/><rect x="6.5" y="7.4" width="8" height="5.5" rx="1.4" opacity="0.35"/></svg>',
};
const FONT_PARAMS = [
  { k: 'strength', min: 0, max: 20, step: 0.5 },
  // refraction reach, px
  { k: 'chroma', min: 0, max: 1, step: 0.02 },
  // per-channel split
  { k: 'blur', min: 0, max: 2, step: 0.05 },
  // fill pre-blur (frost)
  { k: 'bevel', min: 0.5, max: 10, step: 0.1 },
  // rim width (glyph-coverage blur)
  { k: 'dome', min: 0, max: 12, step: 0.5 },
  // interior meniscus swell
  { k: 'edge', min: 0, max: 1.5, step: 0.05 },
  // rim glint
  { k: 'glow', min: 0, max: 1, step: 0.05 },
  // soft wide sheen
  { k: 'shade', min: 0, max: 1, step: 0.05 },
  // dark occlusion rim
];
if (document.querySelector('.lgf')) {
  cfgSections.push({
    id: 'font',
    label: 'Glass typeface',
    icon: CFG_ICONS.font,
    params: FONT_PARAMS,
    opts: { ...GLASS_TEXT_DEFAULTS },
    apply: (patch) => reconfigureAllGlassText(patch),
  });
}
const SEG_OPTS = {
  radius: 999,
  depth: 10,
  dome: 12,
  edge: 0.8,
  glow: 0.28,
  strength: 1,
  chroma: 0.22,
  blur: 0,
  shade: 0,
};
const segLenses = [];
document.querySelectorAll('[data-seg]').forEach((seg) => {
  const labels = seg.querySelector('.seg__labels');
  const opts = Array.from(seg.querySelectorAll('.seg__opt'));
  if (!labels || !opts.length) return;
  const n = opts.length;
  const geom = () => {
    const r = seg.getBoundingClientRect();
    return { pillW: (r.width - 8) / n, pillH: r.height - 8 };
  };
  let g = geom();
  const lens = mountGlassLens({
    target: labels,
    host: seg,
    lensW: g.pillW,
    lensH: g.pillH,
    ...SEG_OPTS,
  });
  segLenses.push(lens);
  let lensX = 0,
    tweenRaf = 0;
  const segEase = cubicBezier(0.34, 1.35, 0.5, 1);
  const moveLensTo = (targetX) => {
    cancelAnimationFrame(tweenRaf);
    const from = lensX,
      t0 = performance.now(),
      dur = 300;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      lensX = from + (targetX - from) * segEase(k);
      lens.setPos(lensX, 0);
      if (k < 1) tweenRaf = requestAnimationFrame(step);
      else {
        lensX = targetX;
        lens.setPos(lensX, 0);
      }
    };
    tweenRaf = requestAnimationFrame(step);
  };
  const setActive = (i, animate = true) => {
    seg.style.setProperty('--i', String(i));
    opts.forEach((b, j) => b.setAttribute('aria-selected', String(i === j)));
    g = geom();
    const targetX = i * g.pillW;
    if (animate) moveLensTo(targetX);
    else {
      lensX = targetX;
      lens.setPos(lensX, 0);
    }
  };
  opts.forEach((o, i) => o.addEventListener('click', () => setActive(i)));
  setActive(parseInt(seg.style.getPropertyValue('--i'), 10) || 0, false);
  new ResizeObserver(() => {
    g = geom();
    lens.setSize(g.pillW, g.pillH);
    setActive(parseInt(seg.style.getPropertyValue('--i'), 10) || 0, false);
  }).observe(seg);
});
if (segLenses.length) {
  cfgSections.push({
    id: 'segmented',
    label: 'Segmented',
    icon: CFG_ICONS.segmented,
    params: LENS_PARAMS,
    opts: { ...SEG_OPTS },
    apply: (patch) => segLenses.forEach((l) => l.reconfigure(patch)),
  });
}
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Item 3: pause the background-position animations on filtered elements when
// they scroll offscreen. The typeface stage and its .lgf__text run one shared
// lgf-drift timeline, so they must pause/resume together — gate them via the
// SAME observed element (the stage) with a descendant selector, never two
// observers. The hero .lgf (its lgf-flow aligns with nothing) is gated on its own.
const animGated = [
  ...document.querySelectorAll('.lgfstage'),
  ...[...document.querySelectorAll('.lgf')].filter((el) => !el.closest('.lgfstage')),
];
if (animGated.length && 'IntersectionObserver' in window) {
  const animIO = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => e.target.classList.toggle('is-anim-off', !e.isIntersecting)),
    { rootMargin: '100px' },
  );
  animGated.forEach((el) => animIO.observe(el));
}
// Render-path emoji comparison: one particle field feeds all three cards at once.
// Press-and-hold the button and the same emojis rise through the SVG card (bent by
// feDisplacementMap), the WebGL card (re-sampled by the shader) and the Frost card
// (blurred by backdrop-filter), so you can compare how each path treats them. The
// particles render once to an offscreen canvas that's blitted into each card's source.
const pathGlSrc = document.getElementById('pathglsrc');
const pathGlCtx = pathGlSrc?.getContext('2d');
if (pathGlSrc && pathGlCtx) {
  const gdpr = Math.min(window.devicePixelRatio || 1, 2);
  const pfx = ['svg', 'frost']
    .map((k) => document.querySelector(`[data-pathfx="${k}"]`))
    .filter(Boolean)
    .map((c) => ({ c, x: c.getContext('2d') }));
  const pathBtn = document.querySelector('[data-pathspawn]');
  const sizeC = (c) => {
    const r = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(r.width * gdpr));
    c.height = Math.max(1, Math.round(r.height * gdpr));
  };
  const sizeAll = () => {
    sizeC(pathGlSrc);
    pfx.forEach(({ c }) => sizeC(c));
  };
  sizeAll();
  new ResizeObserver(sizeAll).observe(pathGlSrc);
  let glVis = true,
    glRaf = 0;

  // The WebGL card's backdrop: a from-scratch Nyan Cat (a code recreation, no asset). An
  // animated canvas is exactly the case SVG-over-canvas can't cache (hence it being the
  // WebGL path); the WebGL glass refracts it, and "Press and hold" emojis rise over the top.
  const nyanStars = Array.from({ length: 22 }, (_, i) => ({
    x: ((i * 61) % 100) / 100,
    y: ((i * 37) % 100) / 100,
    tw: i % 4,
  }));
  const drawGl = () => {
    const w = pathGlSrc.width,
      h = pathGlSrc.height,
      ctx = pathGlCtx,
      t = performance.now() * 0.001;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1a1147';
    ctx.fillRect(0, 0, w, h); // deep space
    ctx.fillStyle = 'rgba(190,180,255,0.85)'; // twinkling scrolling stars
    const wrap = w + 40;
    for (const s of nyanStars) {
      const sx = ((((s.x * wrap - t * 70) % wrap) + wrap) % wrap) - 20,
        sy = s.y * h;
      const r = h * (0.013 + 0.009 * (0.5 + 0.5 * Math.sin(t * 4 + s.tw)));
      ctx.fillRect(sx - r, sy - r * 0.32, r * 2, r * 0.64);
      ctx.fillRect(sx - r * 0.32, sy - r, r * 0.64, r * 2);
    }
    const bob = Math.sin(t * 5.5) * h * 0.045,
      midY = h * 0.52 + bob,
      catX = w * 0.64;
    // rainbow trail: 6 stripes + scrolling shade columns for the "flow"
    const cols = ['#ff2244', '#ff9922', '#ffee33', '#3ad633', '#33aaff', '#9a55ff'];
    const bandH = h * 0.34,
      sh = bandH / 6,
      top = midY - bandH / 2;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = cols[i];
      ctx.fillRect(0, top + i * sh, catX, sh + 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    const cseg = Math.max(10, Math.round(w * 0.032));
    for (let x = -cseg * 2; x < catX; x += cseg * 2)
      ctx.fillRect(x - ((t * 130) % (cseg * 2)), top, cseg, bandH);
    // pop-tart body
    const bw = w * 0.19,
      bh = h * 0.36,
      bx = catX - bw * 0.3,
      by = midY - bh / 2;
    ctx.fillStyle = '#f7c99e';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ff9dc6';
    ctx.fillRect(bx + bw * 0.11, by + bh * 0.12, bw * 0.78, bh * 0.76);
    const spr = ['#ff3b6b', '#33c6ff', '#ffe14d', '#4dff88'];
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = spr[i % 4];
      ctx.fillRect(
        bx + bw * 0.16 + (((i * 53) % 100) / 100) * bw * 0.64,
        by + bh * 0.2 + (((i * 71) % 100) / 100) * bh * 0.56,
        bw * 0.05,
        bw * 0.05,
      );
    }
    ctx.fillStyle = '#8f8f8f';
    for (let i = 0; i < 4; i++)
      ctx.fillRect(bx + bw * (0.12 + i * 0.24), by + bh - 1, bw * 0.11, bh * 0.16);
    // head
    const hw = h * 0.27,
      hh = h * 0.25,
      hx = catX + bw * 0.5,
      hy = midY - hh / 2;
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath();
    ctx.moveTo(hx + hw * 0.06, hy + 2);
    ctx.lineTo(hx + hw * 0.02, hy - hh * 0.24);
    ctx.lineTo(hx + hw * 0.34, hy + 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + hw * 0.66, hy + 2);
    ctx.lineTo(hx + hw * 0.98, hy - hh * 0.24);
    ctx.lineTo(hx + hw * 0.94, hy + 2);
    ctx.fill();
    ctx.fillRect(hx, hy, hw, hh);
    ctx.fillStyle = '#333';
    ctx.fillRect(hx + hw * 0.22, hy + hh * 0.34, hw * 0.12, hh * 0.2);
    ctx.fillRect(hx + hw * 0.64, hy + hh * 0.34, hw * 0.12, hh * 0.2);
    ctx.fillStyle = '#ff90b3';
    ctx.beginPath();
    ctx.arc(hx + hw * 0.2, hy + hh * 0.64, hw * 0.09, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx + hw * 0.8, hy + hh * 0.64, hw * 0.09, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(1, h * 0.007);
    ctx.beginPath();
    ctx.arc(hx + hw * 0.5, hy + hh * 0.56, hw * 0.15, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
  };

  // emoji particle field rendered to an offscreen canvas (~a card's size)
  const pr = pathGlSrc.getBoundingClientRect();
  const LW = Math.max(120, Math.round(pr.width)),
    LH = Math.max(80, Math.round(pr.height));
  const off = document.createElement('canvas');
  off.width = Math.round(LW * gdpr);
  off.height = Math.round(LH * gdpr);
  const octx = off.getContext('2d');
  const SET = [
    ['🎉', 3, true],
    ['🎊', 2, true],
    ['🥳', 2, true],
    ['🤩', 1, true],
    ['😍', 1, true],
    ['✨', 3, false],
    ['⭐', 2, false],
    ['🌟', 2, false],
    ['💫', 1, true],
    ['💥', 1, false],
    ['⚡', 1, true],
    ['🔥', 2, false],
    ['🚀', 2, true],
    ['🌈', 2, false],
    ['🦄', 1, true],
    ['💜', 2, false],
    ['❤️', 1, false],
    ['🧡', 1, false],
    ['💛', 1, false],
    ['💚', 1, false],
    ['💙', 1, false],
    ['🩷', 1, false],
    ['🩵', 1, false],
    ['💖', 2, false],
    ['💕', 1, false],
    ['🙌', 1, true],
    ['👏', 1, true],
    ['👍', 1, true],
    ['🫶', 1, false],
    ['🦋', 1, true],
    ['🌸', 1, false],
    ['🌺', 1, true],
    ['🌼', 1, false],
    ['🍀', 1, false],
    ['💎', 1, false],
    ['🫧', 1, false],
    ['💧', 1, false],
    ['🍭', 1, true],
    ['🎈', 1, true],
    ['👾', 1, false],
    ['🇵🇸', 20, false],
    ['✊', 2, false],
    ['💪', 2, true],
    ['🐉', 2, true],
    ['🐲', 1, false],
    ['🦁', 1, false],
    ['🐯', 1, false],
    ['🦊', 1, false],
    ['🐸', 1, false],
    ['🐙', 1, false],
    ['🦖', 1, true],
    ['🐬', 1, true],
    ['🦅', 1, true],
    ['🐝', 1, true],
    ['🦕', 1, true],
  ];
  const bag = SET.flatMap(([e, w, f]) => Array.from({ length: w }, () => ({ e, f })));
  const cache = new Map();
  const raster = (e) => {
    let c = cache.get(e);
    if (c) return c;
    const px = Math.ceil(56 * gdpr),
      sz = Math.ceil(px * 1.4);
    c = document.createElement('canvas');
    c.width = c.height = sz;
    const x = c.getContext('2d');
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = `${px}px "Apple Color Emoji","Segoe UI Emoji",serif`;
    x.fillText(e, sz / 2, sz / 2);
    cache.set(e, c);
    return c;
  };
  const parts = [];
  const drawParticles = (dt) => {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, off.width, off.height);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        parts.splice(i, 1);
        continue;
      }
      p.x += p.xv * dt;
      p.y += p.yv * dt;
      p.yv += 0.03 * dt;
      p.xv *= Math.pow(0.99, dt);
      p.rot += p.rotv * dt;
      const t = p.life / p.maxLife,
        pop = Math.min(1, p.life / 6);
      const opacity = t < 0.12 ? t / 0.12 : t > 0.6 ? Math.max(0, (1 - t) / 0.4) : 1;
      const s = p.size * pop * gdpr,
        dir = p.flip ? -1 : 1;
      octx.setTransform(
        Math.cos(p.rot) * dir,
        Math.sin(p.rot) * dir,
        -Math.sin(p.rot),
        Math.cos(p.rot),
        p.x * gdpr,
        p.y * gdpr,
      );
      octx.globalAlpha = opacity;
      octx.drawImage(raster(p.e), -s / 2, -s / 2, s, s);
    }
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.globalAlpha = 1;
  };
  const spawn = (count) => {
    for (let i = 0; i < count; i++) {
      const pick = bag[Math.floor(Math.random() * bag.length)];
      parts.push({
        x: LW / 2 + (Math.random() - 0.5) * LW * 0.72,
        y: LH + 8,
        xv: (Math.random() - 0.5) * 2.2,
        yv: -(2.6 + Math.random() * 2.4),
        rot: (Math.random() - 0.5) * 0.5,
        rotv: (Math.random() - 0.5) * 0.09,
        size: 22 + Math.random() * 22,
        life: 0,
        maxLife: 80 + Math.random() * 46,
        flip: pick.f && Math.random() < 0.5,
        e: pick.e,
      });
    }
  };

  // one loop: Nyan backdrop (always) + emoji field blitted through all three paths (when active)
  let lastT = 0,
    wasActive = false;
  const loop = (now = performance.now()) => {
    glRaf = 0;
    if (!glVis) {
      lastT = 0;
      return;
    } // off-screen: stop; the observer restarts it on entry
    const dt = lastT ? Math.min((now - lastT) / 16.6667, 3) : 1;
    lastT = now;
    if (!reduce) drawGl();
    const active = parts.length > 0;
    if (active) {
      drawParticles(dt);
      pathGlCtx.drawImage(off, 0, 0, pathGlSrc.width, pathGlSrc.height);
      for (const { c, x } of pfx) {
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, c.width, c.height);
        x.drawImage(off, 0, 0, c.width, c.height);
      }
      wasActive = true;
    } else if (wasActive) {
      for (const { c, x } of pfx) {
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, c.width, c.height);
      }
      wasActive = false;
    }
    glRaf = requestAnimationFrame(loop);
  };
  drawGl();
  new IntersectionObserver((es) => {
    glVis = es[0].isIntersecting;
    if (glVis && !glRaf) glRaf = requestAnimationFrame(loop);
  }).observe(pathGlSrc);
  glRaf = requestAnimationFrame(loop); // kick once; self-gates on glVis (off-screen → stops)

  // hold-to-spew: an opening pop, then a building fountain while the button is held
  let holding = false,
    holdStart = 0,
    lastEmit = 0,
    holdRaf = 0;
  const holdLoop = (now) => {
    if (!holding) {
      holdRaf = 0;
      return;
    }
    const held = now - holdStart,
      cadence = Math.max(45, 110 - held / 18);
    if (now - lastEmit >= cadence && parts.length < 220) {
      lastEmit = now;
      spawn(reduce ? 1 : Math.min(5, 3 + Math.floor(held / 800)));
    }
    holdRaf = requestAnimationFrame(holdLoop);
  };
  const startHold = () => {
    if (holding) return;
    holding = true;
    holdStart = performance.now();
    lastEmit = 0;
    spawn(reduce ? 4 : 8);
    if (!holdRaf) holdRaf = requestAnimationFrame(holdLoop);
  };
  const endHold = () => {
    holding = false;
  };
  if (pathBtn) {
    pathBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      startHold();
    });
    window.addEventListener('pointerup', endHold);
    pathBtn.addEventListener('pointercancel', endHold);
    pathBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) startHold();
      }
    });
    pathBtn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') endHold();
    });
  }
}
const isld = document.querySelector('[data-islider]');
const isldTrack = document.getElementById('isldtrack');
const isldThumb = isld?.querySelector('.isld__thumb');
if (isld && isldTrack && isldThumb) {
  const TW = 48,
    TH = 44,
    TOP = 6,
    MARGIN = 4,
    S = 1.14;
  const LW = Math.round(TW * S),
    LH = Math.round(TH * S);
  let value = 0.5,
    dragging = false;
  const lens = mountGlassLens({
    target: isldTrack,
    host: isld,
    lensW: LW,
    lensH: LH,
    radius: 18,
    depth: 8,
    dome: 12,
    edge: 0.9,
    glow: 0.3,
    strength: 9,
    chroma: 0.28,
    blur: 0,
    active: false,
    // gentle — value stays readable
  });
  const place = () => {
    const r = isld.getBoundingClientRect();
    const x = MARGIN + value * (r.width - TW - 2 * MARGIN);
    isldThumb.style.setProperty('--x', `${x}px`);
    lens.setPos(x + (TW - LW) / 2, TOP + (TH - LH) / 2);
  };
  const fromX = (clientX) => {
    const r = isld.getBoundingClientRect();
    value = Math.max(
      0,
      Math.min(1, (clientX - r.left - MARGIN - TW / 2) / (r.width - TW - 2 * MARGIN)),
    );
    place();
  };
  const glass = () => {
    isld.classList.toggle('is-glass', dragging);
    lens.setActive(dragging);
  };
  isld.addEventListener('pointerdown', (e) => {
    dragging = true;
    isld.setPointerCapture(e.pointerId);
    glass();
    fromX(e.clientX);
  });
  isld.addEventListener('pointermove', (e) => {
    if (dragging) fromX(e.clientX);
  });
  isld.addEventListener('pointerup', () => {
    dragging = false;
    glass();
  });
  place();
  new ResizeObserver(place).observe(isld);
}
const isw = document.querySelector('[data-iswitch]');
const iswTrack = document.getElementById('iswtrack');
const iswThumb = isw?.querySelector('.isw__thumb');
if (isw && iswTrack && iswThumb) {
  const TRAVEL = 56,
    TW = 40,
    TH = 28,
    TOP = 4,
    LEFT = 4,
    S = 1.16;
  const LW = Math.round(TW * S),
    LH = Math.round(TH * S);
  let checked = false,
    p = 0,
    dragging = false,
    snapping = false,
    moved = false,
    startX = 0,
    startP = 0;
  const lens = mountGlassLens({
    target: iswTrack,
    host: isw,
    lensW: LW,
    lensH: LH,
    radius: 14,
    depth: 5,
    dome: 8,
    edge: 0.9,
    glow: 0.32,
    strength: 15,
    chroma: 0.5,
    blur: 0,
    active: false,
    // stronger — it's just a moving highlight
  });
  const apply = () => {
    isw.style.setProperty('--p', String(p));
    lens.setPos(LEFT + p * TRAVEL + (TW - LW) / 2, TOP + (TH - LH) / 2);
  };
  const glass = () => {
    const on = dragging || snapping;
    isw.classList.toggle('is-glass', on);
    lens.setActive(on);
  };
  const ease = cubicBezier(0.22, 1.15, 0.36, 1.06);
  let snapRaf = 0;
  const snapTo = (target) => {
    cancelAnimationFrame(snapRaf);
    snapping = true;
    glass();
    const from = p,
      t0 = performance.now(),
      dur = 320;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      p = from + (target - from) * (reduce ? k : ease(k));
      apply();
      if (k < 1) snapRaf = requestAnimationFrame(step);
      else {
        p = target;
        apply();
        snapping = false;
        glass();
      }
    };
    snapRaf = requestAnimationFrame(step);
  };
  isw.addEventListener('pointerdown', (e) => {
    cancelAnimationFrame(snapRaf);
    dragging = true;
    moved = false;
    startX = e.clientX;
    startP = checked ? 1 : 0;
    isw.setPointerCapture(e.pointerId);
    glass();
  });
  isw.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) > 3) moved = true;
    let np = startP + (e.clientX - startX) / TRAVEL;
    np = Math.max(0, Math.min(1, np));
    p = np;
    apply();
  });
  isw.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    checked = moved ? p >= 0.5 : !checked;
    isw.setAttribute('aria-checked', String(checked));
    snapTo(checked ? 1 : 0);
  });
  apply();
}
const lstage = document.querySelector('[data-lens]');
const lcard = document.getElementById('lenscard');
const lensEl = lstage?.querySelector('.lens-stage__lens');
if (lstage && lcard && lensEl) {
  const LW = 150,
    LH = 150;
  const LENS_OPTS = {
    radius: 60,
    depth: 6,
    dome: 10,
    edge: 0.9,
    glow: 0.32,
    strength: 18,
    chroma: 0.14,
    blur: 0,
    shade: 0,
  };
  // glint (item 6): a warm specular tint on the draggable lens
  const lens = mountGlassLens({
    target: lcard,
    host: lstage,
    lensW: LW,
    lensH: LH,
    glint: '#ffd9a0',
    ...LENS_OPTS,
  });
  cfgSections.push({
    id: 'lens',
    label: 'Lens',
    icon: CFG_ICONS.lens,
    params: LENS_PARAMS,
    opts: { ...LENS_OPTS },
    apply: (patch) => lens.reconfigure(patch),
  });
  // The lens drifts on its own — DVD-style, bouncing off the stage edges — and
  // snaps to the cursor while the pointer is over the stage, no press needed.
  let lx = 30,
    ly = 65,
    vx = 0.6,
    vy = 0.4,
    hovering = false,
    mx = lx,
    my = ly,
    plx = NaN,
    ply = NaN,
    maxX = 0,
    maxY = 0;
  const place = () => {
    lensEl.style.transform = `translate(${lx}px, ${ly}px)`;
    lens.setPos(lx, ly);
  };
  const measure = () => {
    const r = lstage.getBoundingClientRect();
    maxX = Math.max(0, r.width - LW);
    maxY = Math.max(0, r.height - LH);
  };
  measure();
  addEventListener('resize', measure);
  lstage.addEventListener('pointermove', (e) => {
    hovering = true;
    const r = lstage.getBoundingClientRect();
    mx = Math.max(0, Math.min(maxX, e.clientX - r.left - LW / 2));
    my = Math.max(0, Math.min(maxY, e.clientY - r.top - LH / 2));
  });
  lstage.addEventListener('pointerleave', () => {
    hovering = false;
  });
  const tick = () => {
    if (hovering) {
      // stick to the cursor with a touch of lag — a magnetic "grab"
      lx += (mx - lx) * 0.15;
      ly += (my - ly) * 0.15;
      if (Math.abs(mx - lx) < 0.1) lx = mx;
      if (Math.abs(my - ly) < 0.1) ly = my;
    } else if (!reduce) {
      lx += vx;
      ly += vy;
      if (lx <= 0) {
        lx = 0;
        vx = Math.abs(vx);
      } else if (lx >= maxX) {
        lx = maxX;
        vx = -Math.abs(vx);
      }
      if (ly <= 0) {
        ly = 0;
        vy = Math.abs(vy);
      } else if (ly >= maxY) {
        ly = maxY;
        vy = -Math.abs(vy);
      }
    }
    if (lx !== plx || ly !== ply) {
      place();
      plx = lx;
      ply = ly;
    }
    requestAnimationFrame(tick);
  };
  place();
  tick();
}
import { mountSvgRipple } from '@liquidglassjs/core';
const svgBtn = document.querySelector('[data-wbtn-svg]');
const svgBg = svgBtn?.querySelector('.wbtn__svgbg');
if (svgBtn && svgBg) {
  const ripple = mountSvgRipple({
    target: svgBg,
    host: svgBtn,
    maxFrac: 0.85,
    strength: 24,
    chroma: 0.4,
    spec: 0.7,
    blur: 0.4,
  });
  svgBtn.addEventListener('pointerdown', (e) => {
    const r = svgBtn.getBoundingClientRect();
    ripple.press((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  cfgSections.push({
    id: 'ripple',
    label: 'Ripple button',
    icon: CFG_ICONS.ripple,
    params: RIPPLE_PARAMS,
    opts: ripple.getOptions(),
    apply: (patch) => ripple.reconfigure(patch),
  });
}
const rpToggle = document.getElementById('rp-toggle');
const rpLegend = document.querySelector('.rp-legend');
if (rpToggle) {
  let overlay = null;
  let badges = [];
  let rpRaf = 0;
  const collect = () => {
    const items = [];
    document.querySelectorAll('[data-glass]').forEach((el) => {
      items.push({ el, path: el.dataset.render || 'frost' });
    });
    document.querySelectorAll('[data-glasslens]').forEach((el) => {
      items.push({ el, path: 'svg' });
    });
    document.querySelectorAll('.ps-qr__qr').forEach((el) => {
      items.push({ el, path: 'webgl' });
    });
    return items;
  };
  const tick = () => {
    const vw = window.innerWidth,
      vh = window.innerHeight;
    badges.forEach(({ b, el }) => {
      const r = el.getBoundingClientRect();
      const on = r.width > 0 && r.bottom > 0 && r.top < vh;
      b.style.display = on ? '' : 'none';
      if (!on) return;
      b.style.left = `${Math.min(Math.max(r.left, 2), vw - b.offsetWidth - 2)}px`;
      b.style.top = `${Math.min(Math.max(r.top - 15, 2), vh - 20)}px`;
    });
    rpRaf = requestAnimationFrame(tick);
  };
  const start = () => {
    overlay = document.createElement('div');
    overlay.className = 'rp-overlay';
    document.body.appendChild(overlay);
    badges = collect().map(({ el, path }) => {
      const b = document.createElement('div');
      const cls = ['webgl', 'svg', 'frost'].includes(path) ? path : 'unknown';
      b.className = `rp-badge rp-badge--${cls}`;
      b.textContent = path.toUpperCase();
      overlay.appendChild(b);
      return { b, el };
    });
    rpLegend?.removeAttribute('hidden');
    tick();
  };
  const stop = () => {
    cancelAnimationFrame(rpRaf);
    overlay?.remove();
    overlay = null;
    badges = [];
    rpLegend?.setAttribute('hidden', '');
  };
  rpToggle.addEventListener('change', () => (rpToggle.checked ? start() : stop()));
  // on by default so the SVG/WebGL/Frost badges show from the first paint
  rpToggle.checked = true;
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
import { mountGlassQR } from '@liquidglassjs/qr';
const qrMount = document.getElementById('glassqr');
if (qrMount) {
  let qr = null;
  const mountQR = () => {
    qr = mountGlassQR(qrMount, {
      value: 'https://principlestash.com',
      size: 300,
      errorCorrectionLevel: 'Q',
    });
    const c = qrMount.querySelector('.ps-qr__qr');
    c?.addEventListener('webglcontextlost', (e) => e.preventDefault());
    c?.addEventListener('webglcontextrestored', () => {
      qr?.();
      mountQR();
    });
  };
  mountQR();
  cfgSections.push({
    id: 'qr',
    label: 'Glass QR',
    icon: CFG_ICONS.qr,
    params: QR_PARAMS,
    opts: {
      scaleX: 0.08,
      scaleY: 0.08,
      chromaAmount: 1,
      eyeRefractionScale: 0.16,
      lensDepth: 30,
      lensDuration: 6e3,
      colorSplash: 300,
      ringStart: 0.15,
      ringEnd: 0.9,
    },
    apply: (patch) => qr?.reconfigure(patch),
  });
}
import { mountGlassButton, mountGlassDropdown, GLASS_SURFACE_DEFAULTS } from '@liquidglassjs/core';
const MORPH_PARAMS = [
  { k: 'strength', min: 0, max: 40, step: 0.5 },
  { k: 'chroma', min: 0, max: 1.5, step: 0.02 },
  { k: 'blur', min: 0, max: 3, step: 0.05 },
  { k: 'dome', min: 0, max: 24, step: 0.5 },
  { k: 'depth', min: 0, max: 24, step: 0.5 },
  { k: 'edge', min: 0, max: 2, step: 0.05 },
  { k: 'glow', min: 0, max: 2, step: 0.05 },
  { k: 'spec', min: 0, max: 1.5, step: 0.02 },
];
const gmBtnEl = document.querySelector('[data-gm-btn]');
if (gmBtnEl) {
  const btn = mountGlassButton(gmBtnEl, {
    ...GLASS_SURFACE_DEFAULTS,
    strength: 18,
    dome: 13,
    chroma: 0.42,
    pulse: 0.55,
  });
  // A label node: an inline-flex row of an optional icon/spinner + text, with
  // optional font family/size/weight overrides so the morph varies type + size.
  const svg = (inner, cls = 'gm-ic') =>
    `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICON = {
    play: svg('<path d="M5 3.4l7.5 4.6-7.5 4.6z" fill="currentColor" stroke="none"/>'),
    pause: svg(
      '<rect x="4.3" y="3.4" width="2.6" height="9.2" rx="0.7" fill="currentColor" stroke="none"/><rect x="9.1" y="3.4" width="2.6" height="9.2" rx="0.7" fill="currentColor" stroke="none"/>',
    ),
    search: svg('<circle cx="7" cy="7" r="4"/><path d="M10.1 10.1 14 14"/>'),
    download: svg('<path d="M8 2.4v6.7m0 0 2.8-2.8M8 9.1 5.2 6.3M3 12.6h10"/>'),
    check: svg('<path d="M3.3 8.4l3 3 6.4-6.7"/>'),
    cart: svg(
      '<path d="M1.8 2.4h1.7l1.4 7.4h6.2l1.3-5.2H4.7"/><circle cx="6.1" cy="13" r="1.05" fill="currentColor" stroke="none"/><circle cx="11" cy="13" r="1.05" fill="currentColor" stroke="none"/>',
    ),
  };
  const SPINNER = svg(
    '<circle cx="8" cy="8" r="5.6" stroke-opacity="0.32"/><path d="M13.6 8A5.6 5.6 0 0 0 8 2.4" stroke-linecap="round"/>',
    'gm-spin',
  );
  const label = (html, opts = {}) => {
    const s = document.createElement('span');
    s.className = 'gm-c';
    if (opts.font) s.style.fontFamily = `var(--font-${opts.font})`;
    if (opts.size) s.style.fontSize = opts.size;
    if (opts.weight) s.style.fontWeight = String(opts.weight);
    s.innerHTML = html;
    return s;
  };

  // Variety chips: icons, an animated spinner, an emoji, a big weight, a mono size.
  const PRESETS = [
    { name: 'Play', make: () => label(`${ICON.play}<span>Play</span>`) },
    { name: 'Pause', make: () => label(`${ICON.pause}<span>Pause</span>`) },
    { name: 'Loading', make: () => label(`${SPINNER}<span>Loading</span>`) },
    { name: 'Search', make: () => label(`${ICON.search}<span>Search</span>`) },
    { name: 'Add to cart', make: () => label(`${ICON.cart}<span>Add to cart</span>`) },
    { name: 'Emoji', make: () => label(`<span>🎉 Ship it</span>`) },
    { name: 'Big', make: () => label(`<span>GO</span>`, { size: '1.5rem', weight: 800 }) },
    { name: 'Mono', make: () => label(`<span>v2.4.1</span>`, { font: 'mono', size: '0.85rem' }) },
  ];
  const presetsWrap = document.querySelector('[data-gm-presets]');
  PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.className = 'gm-preset';
    b.type = 'button';
    b.textContent = p.name;
    b.addEventListener('click', () => btn.setContent(p.make()));
    presetsWrap?.appendChild(b);
  });

  // Self-click: a realistic async action — Download → spinner → Saved, and the
  // spinner state auto-advances so you see it spin without holding a click.
  const FLOW = {
    idle: { make: () => label(`${ICON.download}<span>Download</span>`), next: 'loading' },
    loading: { make: () => label(`${SPINNER}<span>Downloading</span>`), auto: 'done', delay: 1500 },
    done: { make: () => label(`${ICON.check}<span>Saved</span>`), next: 'idle' },
  };
  let flowState = 'idle';
  let flowTimer = 0;
  const go = (s, immediate = false) => {
    clearTimeout(flowTimer);
    flowState = s;
    btn.setContent(FLOW[s].make(), immediate);
    if (FLOW[s].auto) flowTimer = setTimeout(() => go(FLOW[s].auto), FLOW[s].delay);
  };
  gmBtnEl.addEventListener('click', () => {
    const s = FLOW[flowState];
    if (!s || s.auto) return; // ignore clicks mid-spinner
    go(s.next);
  });
  go('idle', true); // set the initial Download label without a load-time morph

  cfgSections.push({
    id: 'button',
    label: 'Content morph',
    icon: CFG_ICONS.button,
    params: MORPH_PARAMS,
    opts: btn.getOptions(),
    apply: (patch) => btn.reconfigure(patch),
  });
}
const gmDdEl = document.querySelector('[data-gm-dd]');
if (gmDdEl) {
  const trigger = gmDdEl.querySelector('[data-gm-trigger]');
  const menu = gmDdEl.querySelector('[data-gm-menu]');
  if (trigger && menu) {
    const dd = mountGlassDropdown({
      trigger,
      menu,
      ...GLASS_SURFACE_DEFAULTS,
      strength: 22,
      dome: 15,
      chroma: 0.45,
      blur: 0.5,
    });
    menu
      .querySelectorAll('.gm-dd__item')
      .forEach((it) => it.addEventListener('click', () => dd.close()));
    cfgSections.push({
      id: 'dropdown',
      label: 'Dropdown',
      icon: CFG_ICONS.dropdown,
      params: MORPH_PARAMS,
      opts: dd.getOptions(),
      apply: (patch) => dd.reconfigure(patch),
    });
  }
}
import { mountGlassShape, GLASS_SHAPE_DEFAULTS } from '@liquidglassjs/core';
const gshapeStage = document.querySelector('.gshape-stage');
if (gshapeStage) {
  // Decouple the bob animation from the filtered marks: wrap each mark in a
  // .gshape-bob span and animate THAT, not the mark. A filter:url() element that
  // is itself transform-animated gets its glass re-rasterized every frame — a
  // shimmer/flicker on fine, high-contrast artwork like the React logo's thin
  // orbit strokes. Moving a plain wrapper instead keeps each mark perfectly still,
  // so its filter is built once and cached ("free at rest") and only a cheap
  // compositor transform moves it. The data-gshape/-orb/-draw/-glasslens hooks
  // stay on the marks, so every query below still matches.
  gshapeStage.querySelectorAll('.gshape-mark').forEach((mark) => {
    const bob = document.createElement('span');
    bob.className = 'gshape-bob';
    mark.replaceWith(bob);
    bob.appendChild(mark);
  });
  const gdpr = Math.min(window.devicePixelRatio || 1, 2);
  const prep = (canvas, size = 150) => {
    canvas.width = size * gdpr;
    canvas.height = size * gdpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(gdpr, 0, 0, gdpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    return { ctx, size };
  };
  // a doge-style meme on a rounded card — the whole image becomes a glass panel
  const drawMeme = (canvas) => {
    const { ctx, size } = prep(canvas);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(1, 1, size - 2, size - 2, 22);
    else ctx.rect(1, 1, size - 2, size - 2);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#ff6ec4');
    g.addColorStop(0.5, '#7b6bff');
    g.addColorStop(1, '#4ad9ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const phrases = [
      ['such glass', '#e9ff2f', 32, 40, -9, 16],
      ['very svg', '#37ffd0', 100, 72, 7, 16],
      ['wow', '#ff5db1', 44, 116, -4, 19],
      ['so refract', '#ffffff', 104, 32, 11, 13],
      ['much dome', '#ffe14d', 66, 92, 3, 14],
    ];
    for (const [t, c, x, y, rot, fs] of phrases) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.font = `italic bold ${fs}px "Comic Sans MS","Comic Sans",cursive`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.strokeText(t, 0, 0);
      ctx.fillStyle = c;
      ctx.fillText(t, 0, 0);
      ctx.restore();
    }
  };
  const shapeOpts = {
    ...GLASS_SHAPE_DEFAULTS,
    strength: 11,
    bevel: 3.2,
    dome: 5,
    edge: 1,
    glow: 0.4,
  };
  const shapes = [];
  // inline SVG marks (droplet + sparkle): the SVG itself is the source
  gshapeStage.querySelectorAll('[data-gshape]').forEach((el) => {
    shapes.push(mountGlassShape({ target: el, host: gshapeStage, source: el, ...shapeOpts }));
  });
  // the meme canvas: draw once, then use it as the source (a static glass panel)
  const memeCanvas = gshapeStage.querySelector('[data-gshape-draw="meme"]');
  if (memeCanvas) {
    drawMeme(memeCanvas);
    shapes.push(
      mountGlassShape({
        target: memeCanvas,
        host: gshapeStage,
        source: memeCanvas,
        ...shapeOpts,
        dome: 8,
      }),
    );
  }
  // the emoji orb: a fixed circular glass LENS over a live canvas whose emojis
  // orbit + wobble amongst themselves. The lens map stays static, so only the
  // canvas redraws each frame and the filter just re-refracts it — no per-frame
  // map regeneration. Gated offscreen and disabled for reduced motion.
  const orbCanvas = gshapeStage.querySelector('[data-gshape-orb]');
  if (orbCanvas) {
    const octx = prep(orbCanvas).ctx;
    const orbEmojis = [
      { e: '🌊', a0: 0.0, rad: 7, s: 50 },
      { e: '🎉', a0: 0.4, rad: 38, s: 38 },
      { e: '💎', a0: 1.9, rad: 40, s: 36 },
      { e: '🔥', a0: 3.1, rad: 36, s: 40 },
      { e: '✨', a0: 4.4, rad: 42, s: 34 },
      { e: '💧', a0: 5.4, rad: 33, s: 30 },
      { e: '🫧', a0: 2.6, rad: 44, s: 30 },
      { e: '🌈', a0: 1.1, rad: 28, s: 32 },
    ];
    const drawOrb = (t) => {
      octx.clearRect(0, 0, 150, 150);
      const body = octx.createRadialGradient(75, 66, 8, 75, 80, 74);
      body.addColorStop(0, 'rgba(255,255,255,0.18)');
      body.addColorStop(0.65, 'rgba(170,195,255,0.08)');
      body.addColorStop(1, 'rgba(170,195,255,0)');
      octx.fillStyle = body;
      octx.beginPath();
      octx.arc(75, 75, 72, 0, Math.PI * 2);
      octx.fill();
      for (const o of orbEmojis) {
        const ang = o.a0 + t * 0.00016;
        const r = o.rad + Math.sin(t * 0.0011 + o.a0 * 2) * 5;
        octx.font = `${o.s}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
        octx.fillText(o.e, 75 + Math.cos(ang) * r, 75 + Math.sin(ang) * r);
      }
    };
    drawOrb(0);
    mountGlassLens({
      target: orbCanvas,
      host: gshapeStage,
      lensW: 150,
      lensH: 150,
      radius: 75,
      dome: 16,
      depth: 10,
      strength: 15,
      chroma: 0.3,
      edge: 0.9,
      glow: 0.35,
      blur: 0.4,
      shade: 0,
    });
    if (!reduce) {
      let orbVisible = true,
        orbRaf = 0;
      const loop = (now) => {
        orbRaf = 0;
        if (!orbVisible) return; // off-screen: stop (the observer restarts it on entry)
        drawOrb(now);
        orbRaf = requestAnimationFrame(loop);
      };
      new IntersectionObserver(
        (es) => {
          orbVisible = es[0].isIntersecting;
          if (orbVisible && !orbRaf) orbRaf = requestAnimationFrame(loop);
        },
        { rootMargin: '120px' },
      ).observe(orbCanvas);
      orbRaf = requestAnimationFrame(loop); // kick once; self-gates on orbVisible (off-screen → stops)
    }
  }
  if (shapes.length) {
    cfgSections.push({
      id: 'shape',
      label: 'Glass mark',
      icon: CFG_ICONS.shape,
      params: FONT_PARAMS,
      opts: shapes[0].getOptions(),
      apply: (patch) => shapes.forEach((s) => s.reconfigure(patch)),
    });
  }
}
// Performance: part live test, part trade-off explainer. A glass surface is an SVG filter
// over the content behind it, and the browser CACHES that filter while the content holds
// still — so glass is free at rest and only costs a filter pass when the content changes.
// The catch the test makes visible: a <canvas> / <video> source is treated as volatile, so
// the browser re-filters it EVERY frame even when it's static — which is exactly why the
// library ships a WebGL path for those. Toggle Source (DOM vs Canvas) and Animate to walk
// the whole cost matrix live; the fps meter and the narrator line react in real time.
const perfEl = document.querySelector('[data-perf]');
if (perfEl) {
  const scene = perfEl.querySelector('[data-perf-scene]');
  const fpsEl = perfEl.querySelector('[data-perf-fps]');
  const subEl = perfEl.querySelector('[data-perf-sub]');
  const ctxEl = perfEl.querySelector('[data-perf-ctx]');
  const animChk = perfEl.querySelector('[data-perf-animate]');
  const glassChk = perfEl.querySelector('[data-perf-glass]');
  const countRange = perfEl.querySelector('[data-perf-count]');
  const countN = perfEl.querySelector('[data-perf-count-n]');
  const srcBtns = perfEl.querySelectorAll('[data-perf-source] [data-src]');

  const pdpr = Math.min(window.devicePixelRatio || 1, 2);
  const CW = 158,
    CH = 100;
  const cards = [];
  let source = 'dom',
    animate = false,
    glassOn = true,
    visible = false,
    peakFps = 0;

  // identical lens config regardless of source — only the target type differs
  const LENS = {
    lensW: CW,
    lensH: CH,
    radius: 16,
    dome: 8,
    depth: 7,
    strength: 10,
    chroma: 0.32,
    edge: 0.85,
    glow: 0.32,
    blur: 1.5,
    shade: 0,
  };

  // canvas source: paint a faux-UI once (static) or per frame (animate)
  const paintCanvas = (c, t) => {
    const ctx = c.ctx,
      a = t * 0.001 + c.phase;
    const g = ctx.createLinearGradient(0, 0, CW, CH);
    g.addColorStop(0, `hsl(${(c.hue + Math.sin(a) * 20) % 360} 70% 58%)`);
    g.addColorStop(1, `hsl(${(c.hue + 56 + Math.sin(a) * 20) % 360} 68% 48%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(26, 28, 12, 0, 6.2832);
    ctx.fill();
    ctx.fillRect(48, 22, 82, 7);
    ctx.globalAlpha = 0.6;
    ctx.fillRect(48, 36, 56, 6);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) ctx.fillRect(18, 60 + i * 12, CW - 36 - (i === 2 ? 46 : 0), 6);
    ctx.globalAlpha = 1;
  };

  const makeCard = (i) => {
    const el = document.createElement('div');
    el.className = 'perfcard';
    const hue = (i * 47) % 360;
    let target,
      ctx = null;
    if (source === 'canvas') {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(CW * pdpr);
      canvas.height = Math.round(CH * pdpr);
      canvas.style.width = CW + 'px';
      canvas.style.height = CH + 'px';
      ctx = canvas.getContext('2d');
      ctx.setTransform(pdpr, 0, 0, pdpr, 0, 0);
      el.appendChild(canvas);
      target = canvas;
    } else {
      const content = document.createElement('div');
      content.className = 'perfcard__content';
      content.style.background = `linear-gradient(120deg, hsl(${hue} 70% 58%), hsl(${(hue + 50) % 360} 68% 48%), hsl(${(hue + 100) % 360} 66% 56%))`;
      content.style.backgroundSize = '200% 200%';
      content.innerHTML =
        '<i class="perfcard__avatar"></i>' +
        '<i class="perfcard__line perfcard__line--title"></i>' +
        '<i class="perfcard__line perfcard__line--sub"></i>' +
        '<i class="perfcard__line"></i>' +
        '<i class="perfcard__line perfcard__line--short"></i>';
      el.appendChild(content);
      target = content;
    }
    const lens = mountGlassLens({ target, host: el, ...LENS, active: glassOn });
    lens.setPos(0, 0);
    const card = { el, target, ctx, lens, hue, phase: (i * 1.7) % 6.28 };
    if (ctx) paintCanvas(card, 0);
    return card;
  };

  // per-frame change to the backdrop → forces a repaint → the filter re-runs
  const churn = (c, now) => {
    if (c.ctx) paintCanvas(c, now);
    else
      c.target.style.backgroundPosition =
        ((Math.sin(now * 0.001 + c.phase) * 0.5 + 0.5) * 100).toFixed(1) + '% 50%';
  };

  const clearCards = () => {
    for (const c of cards) {
      if (c.lens) {
        try {
          c.lens.dispose();
        } catch {}
      }
      c.el.remove();
    }
    cards.length = 0;
  };
  const setCount = (n) => {
    while (cards.length < n) {
      const c = makeCard(cards.length);
      scene.appendChild(c.el);
      cards.push(c);
    }
    while (cards.length > n) {
      const c = cards.pop();
      if (c.lens) {
        try {
          c.lens.dispose();
        } catch {}
      }
      c.el.remove();
    }
  };
  const rebuild = () => {
    const n = cards.length || +(countRange && countRange.value) || 8;
    clearCards();
    setCount(n);
  };

  // Qualitative narrator — the big meter shows the live number, so the sentence stays
  // steady (no jittering fps in the text) and only claims a drop when one really happened.
  const narrate = (n, fps) => {
    const cardLabel = n + (n === 1 ? ' card' : ' cards');
    const dropped = peakFps && fps < peakFps * 0.85; // meaningfully below the free ceiling
    if (!glassOn)
      return (
        'Glass off. ' +
        cardLabel +
        (animate ? ' repainting every frame' : '') +
        ', no filter. This is your baseline: the cards alone are free.'
      );
    if (source === 'dom') {
      if (!animate)
        return (
          cardLabel +
          ' over static DOM. The filter is cached, so it composites essentially free and holds fps however many you stack.'
        );
      return dropped
        ? cardLabel +
            ' over DOM that repaints every frame. The filter re-runs each time and the frame rate drops; the cost shows up only while the content moves.'
        : cardLabel +
            ' over DOM repainting every frame. The filter re-runs each time, yet your GPU still holds its refresh rate. Add more cards to find where it bends.';
    }
    if (!animate)
      return dropped
        ? cardLabel +
            " over a STATIC canvas, yet the frame rate has dropped. The browser can't cache a canvas-backed filter, so it re-runs every frame even though nothing moved. This is the case the WebGL path exists for."
        : cardLabel +
            " over a static canvas. A canvas can't be filter-cached, so the filter re-runs every frame regardless. Your GPU holds refresh at this count; stack more and it drops fast.";
    return dropped
      ? cardLabel +
          ' over an animating canvas, re-filtered and repainted every frame, so the frame rate drops.'
      : cardLabel +
          ' over an animating canvas, re-filtered every frame and still holding refresh at this count.';
  };

  let last = 0,
    winStart = 0,
    frames = 0,
    rafId = 0;
  const loop = (now) => {
    rafId = 0;
    if (!visible) return; // off-screen: don't re-arm — the loop fully stops (no heartbeat)
    if (last && now - last > 400) {
      winStart = 0;
      last = 0;
    } // stall / tab-switch guard
    last = now;
    if (animate) for (const c of cards) churn(c, now);
    frames++;
    if (!winStart) {
      winStart = now;
      frames = 0;
    } else {
      const dt = now - winStart;
      if (dt >= 500 && frames > 4) {
        const fps = Math.round((frames * 1000) / dt);
        if (fps > peakFps) peakFps = fps; // the free ceiling (first seen at DOM-static / glass-off)
        if (fpsEl) fpsEl.textContent = fps;
        if (subEl) subEl.textContent = narrate(cards.length, fps);
        winStart = now;
        frames = 0;
      }
    }
    rafId = requestAnimationFrame(loop);
  };
  new IntersectionObserver(
    (es) => {
      visible = es[0].isIntersecting;
      if (visible && !rafId) {
        winStart = 0;
        last = 0;
        rafId = requestAnimationFrame(loop);
      } // restart on entry
    },
    { rootMargin: '80px' },
  ).observe(perfEl);
  rafId = requestAnimationFrame(loop); // kick once; the loop self-gates on `visible` (off-screen → stops)

  const setSource = (s) => {
    if (s === source) return;
    source = s;
    for (const b of srcBtns) b.setAttribute('aria-selected', String(b.dataset.src === s));
    perfEl.classList.toggle('is-canvas', s === 'canvas');
    rebuild();
    winStart = 0;
  };
  for (const b of srcBtns) b.addEventListener('click', () => setSource(b.dataset.src));
  if (animChk)
    animChk.addEventListener('change', () => {
      animate = animChk.checked;
      perfEl.classList.toggle('is-animating', animate);
      winStart = 0;
    });
  if (glassChk)
    glassChk.addEventListener('change', () => {
      glassOn = glassChk.checked;
      for (const c of cards) if (c.lens) c.lens.setActive(glassOn);
      winStart = 0;
    });
  if (countRange)
    countRange.addEventListener('input', () => {
      const n = +countRange.value;
      if (countN) countN.textContent = n;
      setCount(n);
      winStart = 0;
    });

  if (ctxEl)
    ctxEl.textContent =
      'Cards are ' +
      CW +
      '×' +
      CH +
      " glass surfaces with an identical filter throughout; only the backdrop's source and motion change. Static live DOM caches the filter, while a canvas or video source is re-filtered every frame regardless.";
  setCount(+(countRange && countRange.value) || 8);
}

function buildTuner(sections) {
  if (!sections.length) return;
  const STORE = 'ps-glass-cfg';
  const defaults = new Map(sections.map((s) => [s.id, { ...s.opts }]));
  const fmt = (v) => (Number.isInteger(v) ? String(v) : parseFloat(v.toFixed(2)).toString());
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(STORE) || '{}');
  } catch {
    saved = {};
  }
  if (saved.sections) {
    sections.forEach((s) => {
      const sv = saved.sections[s.id];
      if (sv) {
        Object.assign(s.opts, sv);
        s.apply({ ...s.opts });
      }
    });
  }
  let pos = saved.pos ?? null;
  let active =
    saved.active != null && sections[saved.active] ? sections[saved.active] : sections[0];
  const save = () => {
    const data = {
      sections: Object.fromEntries(sections.map((s) => [s.id, s.opts])),
      pos,
      active: sections.indexOf(active),
    };
    try {
      sessionStorage.setItem(STORE, JSON.stringify(data));
    } catch {}
  };
  const panel = document.createElement('div');
  panel.className = 'cfg';
  panel.innerHTML = `<div class="cfg__bar"><span class="cfg__title">Glass Tuner</span><button class="cfg__min" type="button" aria-label="Collapse">–</button></div><div class="cfg__body"><div class="cfg__seclabel">Section</div><div class="cfg__tabs" role="tablist"></div><div class="cfg__name"></div><div class="cfg__rows"></div><div class="cfg__foot"><button class="cfg__btn cfg__reset" type="button">Reset</button><button class="cfg__btn cfg__resetall" type="button">Reset all</button><button class="cfg__btn cfg__copy" type="button">Copy</button></div></div>`;
  document.body.appendChild(panel);
  const tabsEl = panel.querySelector('.cfg__tabs');
  const nameEl = panel.querySelector('.cfg__name');
  const rows = panel.querySelector('.cfg__rows');
  const sectionJSON = () =>
    '{ ' + active.params.map((p) => `${p.k}: ${fmt(active.opts[p.k])}`).join(', ') + ' }';
  const tabs = sections.map((s) => {
    const t = document.createElement('button');
    t.className = 'cfg__tab';
    t.type = 'button';
    t.title = s.label;
    t.innerHTML = s.icon;
    t.addEventListener('click', () => {
      active = s;
      sync();
    });
    tabsEl.appendChild(t);
    return { s, t };
  });
  function renderRows() {
    rows.innerHTML = '';
    // Sections with `focuses` (Render paths) get a path selector; params a focused path
    // can't honor gray out — the SVG/WebGL/Frost tradeoff made visible.
    const focus = active.focuses ? active.focuses[active.focus || 0] : null;
    const dead = focus ? focus.dead : [];
    if (active.focuses) {
      const seg = document.createElement('div');
      seg.className = 'cfg__focus';
      active.focuses.forEach((f, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cfg__focusbtn';
        b.textContent = f.label;
        b.setAttribute('aria-selected', String(i === (active.focus || 0)));
        b.disabled = !f.el;
        b.addEventListener('click', () => {
          active.focus = i;
          renderRows();
        });
        seg.appendChild(b);
      });
      rows.appendChild(seg);
    }
    active.params.forEach((p) => {
      const isDead = dead.includes(p.k);
      const row = document.createElement('label');
      row.className = 'cfg__row' + (isDead ? ' is-dead' : '');
      row.innerHTML = `<span class="cfg__k" title="${p.k}">${p.label ?? p.k}</span><input type="range" min="${p.min}" max="${p.max}" step="${p.step}"><span class="cfg__v"></span>`;
      const input = row.querySelector('input');
      const val = row.querySelector('.cfg__v');
      const v = active.opts[p.k];
      input.value = String(Math.min(Math.max(v, p.min), p.max));
      val.textContent = fmt(v);
      if (isDead) {
        input.disabled = true;
      } else {
        input.addEventListener('input', () => {
          const nv = parseFloat(input.value);
          active.opts[p.k] = nv;
          active.apply({ [p.k]: nv });
          val.textContent = fmt(nv);
          save();
        });
      }
      rows.appendChild(row);
    });
  }
  function sync() {
    tabs.forEach(({ s, t }) => t.setAttribute('aria-selected', String(s === active)));
    nameEl.textContent = active.label;
    renderRows();
    save();
  }
  panel
    .querySelector('.cfg__min')
    .addEventListener('click', () => panel.classList.toggle('is-min'));
  panel.querySelector('.cfg__reset').addEventListener('click', () => {
    const d = defaults.get(active.id);
    Object.assign(active.opts, d);
    active.apply({ ...d });
    sync();
  });
  panel.querySelector('.cfg__resetall').addEventListener('click', () => {
    sections.forEach((s) => {
      const d = defaults.get(s.id);
      Object.assign(s.opts, d);
      s.apply({ ...d });
    });
    sync();
  });
  const copyBtn = panel.querySelector('.cfg__copy');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(sectionJSON());
      copyBtn.textContent = 'Copied';
    } catch {
      copyBtn.textContent = 'Copy failed';
    }
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  });
  if (pos) {
    panel.style.left = `${pos.left}px`;
    panel.style.top = `${pos.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }
  const bar = panel.querySelector('.cfg__bar');
  let drag = false,
    sx = 0,
    sy = 0,
    ox = 0,
    oy = 0;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.cfg__min')) return;
    drag = true;
    const r = panel.getBoundingClientRect();
    ox = r.left;
    oy = r.top;
    sx = e.clientX;
    sy = e.clientY;
    panel.style.left = `${r.left}px`;
    panel.style.top = `${r.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const nx = Math.max(
      6,
      Math.min(window.innerWidth - panel.offsetWidth - 6, ox + e.clientX - sx),
    );
    const ny = Math.max(
      6,
      Math.min(window.innerHeight - panel.offsetHeight - 6, oy + e.clientY - sy),
    );
    panel.style.left = `${nx}px`;
    panel.style.top = `${ny}px`;
    pos = { left: nx, top: ny };
  });
  bar.addEventListener('pointerup', () => {
    if (drag) {
      drag = false;
      save();
    }
  });
  sync();
}
// Render paths → tuner: the three cards are the unified mountGlass surface in svg / webgl /
// frost mode. One shared param set drives all three via reconfigure(); each honors what its
// path supports, and the focus toggle grays out the rest (frost = blur only, webgl bakes
// edge/glow). Handles are the `el.__glass` stashed by liquid-glass.js, read lazily at apply
// time so mount timing doesn't matter.
(() => {
  const pick = (m) => document.querySelector(`.pathstage [data-glass][data-mode="${m}"]`);
  const els = { svg: pick('auto'), webgl: pick('webgl'), frost: pick('frost') };
  if (!els.svg && !els.webgl && !els.frost) return;
  const base = els.svg || els.webgl || els.frost;
  const rd = (k, d) => {
    const v = parseFloat(base.dataset[k]);
    return Number.isNaN(v) ? d : v;
  };
  cfgSections.push({
    id: 'paths',
    label: 'Render paths',
    icon: CFG_ICONS.paths,
    params: RENDER_PARAMS,
    opts: {
      strength: rd('strength', 16),
      chroma: rd('chroma', 0.3),
      blur: rd('blur', 2),
      dome: rd('dome', 14),
      depth: rd('depth', 20),
      edge: rd('edge', 0.8),
      glow: rd('glow', 0.2),
    },
    focus: 0,
    focuses: [
      { id: 'svg', label: 'SVG', el: els.svg, dead: [] },
      { id: 'webgl', label: 'WebGL', el: els.webgl, dead: ['edge', 'glow'] },
      {
        id: 'frost',
        label: 'Frost',
        el: els.frost,
        dead: ['strength', 'chroma', 'dome', 'depth', 'edge', 'glow'],
      },
    ],
    apply(patch) {
      for (const f of this.focuses) {
        const g = f.el && f.el.__glass;
        if (g) g.reconfigure(patch);
      }
    },
  });
})();
// Order the tuner tabs to match the on-page section order (top to bottom).
const TUNER_ORDER = [
  'paths',
  'shape',
  'lens',
  'font',
  'segmented',
  'ripple',
  'button',
  'dropdown',
  'qr',
];
cfgSections.sort((a, b) => {
  const ia = TUNER_ORDER.indexOf(a.id),
    ib = TUNER_ORDER.indexOf(b.id);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});
buildTuner(cfgSections); // ── Glass typeface: font switcher + editable stage text ──
// The engine rasterizes the element's computed font, so flipping font-family is
// the whole trick: the glyph-width change trips mountGlassText's ResizeObserver,
// which re-measures (re-reading the computed font) and rebuilds the map.
const lgfDemo = document.querySelector('.lgfdemo');
const lgfFontBtns = document.querySelectorAll('.lgf-fonts__opt');
lgfFontBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (lgfDemo) {
      const f = btn.dataset.lgfFont;
      if (f === 'mono') delete lgfDemo.dataset.font;
      else lgfDemo.dataset.font = f;
    }
    lgfFontBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
});
// Keep the editable glass text a single plain-text line: the map draws one
// baseline (fillText), so Enter/rich paste would desync canvas raster from DOM.
// contenteditable="plaintext-only" covers modern engines; the input normalize
// covers engines that treat the value as "true" (Firefox < 136).
document.querySelectorAll('.lgf__text[contenteditable]').forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur();
    }
  });
  el.addEventListener('input', () => {
    if (el.children.length || /[\r\n]/.test(el.textContent || '')) {
      el.textContent = (el.textContent || '').replace(/\s+/g, ' ');
    }
  });
  el.addEventListener('blur', () => {
    if (!(el.textContent || '').trim()) el.textContent = 'Refraction'; // don't strand an empty demo
  });
});
