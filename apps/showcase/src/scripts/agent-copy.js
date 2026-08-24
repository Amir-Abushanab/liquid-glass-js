/**
 * "Copy for your agent" — hands the whole library to a coding agent in one click.
 *
 * The payload is three parts: a task line, a minimal working snippet, and
 * @liquidglassjs's own skill doc as reference. The doc is the exact
 * `packages/core/skills/liquid-glass/SKILL.md` that the published agent skill ships,
 * inlined at build time with `?raw` — so the button and the skill can't drift, and
 * there is no runtime fetch to fail. Its YAML frontmatter is tooling metadata that
 * reads as noise to an agent consuming the doc as prose, so it is stripped.
 *
 * The button itself is a real glass control (mountGlassButton), not a picture of one:
 * on a site about refraction, a flat button asking you to go tell an agent about
 * refraction would be a poor advert.
 */
import { glassTween, mountGlassButton } from '@liquidglassjs/core';
import skillDoc from '../../../../packages/core/skills/liquid-glass/SKILL.md?raw';
import { presetDefaults } from '../lib/glass-presets';

const TASK = `Add Apple-style liquid glass to my site — real refraction on live DOM, not a blur.

1. Install for my framework: \`pnpm add @liquidglassjs/core\` (vanilla/Astro),
   \`@liquidglassjs/react\`, or \`@liquidglassjs/element\` for a <liquid-glass> custom element.
   Import the stylesheet once: \`import '@liquidglassjs/core/css'\`.
2. Pick the component that matches what I'm building — the reference below opens with a
   table for that. Mount it client-side only; every renderer touches document/canvas/SVG.
3. Give the glass something to refract. A surface handed no \`refract\` target, \`source\` or
   \`backdrop\` falls back to a frosted blur, which is a plain blur() outside Chromium.

Use the reference below — @liquidglassjs's own agent skill doc — to choose the entry point,
get the params right, and avoid the engine pitfalls it lists. They are all measured; please
don't re-derive them.`;

/** Strip a leading `---\n…\n---` YAML frontmatter block. */
const stripFrontmatter = (md) => md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, '');

/** A minimal snippet carrying this site's own tuned surface values, so the agent starts
 *  from something that has actually been looked at rather than the bare defaults. */
function snippet() {
  const v = presetDefaults('surface', [
    'strength',
    'chroma',
    'blur',
    'dome',
    'depth',
    'edge',
    'glow',
  ]);
  const props = Object.entries(v)
    .map(([k, n]) => `  ${k}={${n}}`)
    .join('\n');
  return `import { LiquidGlass } from '@liquidglassjs/react';
import '@liquidglassjs/core/css';

<LiquidGlass
${props}
  radius={20}
  // hand it the page's own background so it takes the SVG path, which refracts
  // in every browser — without this it falls back to a frosted blur
  backdrop="radial-gradient(70% 80% at 30% 20%, #12d3ff, transparent 60%), #0b0913"
  className="p-6"
>
  Content over refracting glass.
</LiquidGlass>`;
}

const brief = () =>
  [
    TASK,
    '--- A WORKING SNIPPET ---',
    snippet(),
    '--- REFERENCE: the @liquidglassjs agent skill ---',
    stripFrontmatter(skillDoc).trim(),
  ].join('\n\n');

const LABEL = 'Copy for your agent';
/** How long "Copied" stays up. Long enough to read it, notice the button changed
 *  shape, and get back to the editor before it reverts. */
const HOLD_MS = 2600;

const tick = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'agent-tick');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 6 9 17l-5-5');
  svg.appendChild(path);
  return svg;
};

// The shared button preset is tuned for a pane with nothing behind it but the scene,
// where a 40px displacement reads as a deep bend. The marks sit *inside* this pane and
// are 16px tall, so that same number is wider than the artwork and shreds them. At rest
// the bend is gentle enough to keep every logo recognisable; hovering leans on it, which
// is the whole demonstration — the marks visibly become something the glass is moving
// rather than something printed on it.
const REST = { strength: 14, chroma: 0.5 };
const HOVER = { strength: 20, chroma: 0.9 };

document.querySelectorAll('[data-agent-copy]').forEach((btn) => {
  const label = btn.querySelector('.agent-label');
  const icons = btn.querySelector('.agent-icons');
  const api = mountGlassButton(btn, {
    ...presetDefaults('button', [
      'strength',
      'chroma',
      'blur',
      'dome',
      'depth',
      'edge',
      'glow',
      'spec',
    ]),
    ...REST,
    radius: 999,
  });

  // glassTween is the library's own answer to this: strength and chroma both land on a
  // filter attribute, so easing them per frame costs a setAttribute rather than a map
  // rebuild, and re-entering mid-flight retargets from where it is instead of snapping.
  const tween = glassTween(api, { duration: 260 });
  btn.addEventListener('pointerenter', () => tween.to(HOVER));
  btn.addEventListener('pointerleave', () => tween.to(REST));

  // Put the marks INSIDE the refracted pane, so the glass bends them the way it bends
  // anything else behind it — a button on this site should be made of the thing the
  // site is about, not sit on top of it. The label stays in the crisp layer, which is
  // also the honest demo: refracted art, readable text.
  //
  // The pane is `inset: 0`, so laying it out with the button's own padding and gap puts
  // the marks exactly where they were. A hidden clone holds their place in the label so
  // the text still starts after them and the button keeps its width.
  const pane = btn.querySelector('.gm-btn__bg');
  let spacer = null;
  if (pane && icons && label) {
    spacer = icons.cloneNode(true);
    spacer.classList.add('agent-icons--spacer');
    label.parentElement?.insertBefore(spacer, label);
    pane.appendChild(icons);
  }

  // Both states are built from the same two persistent nodes, so `aria-live` on the
  // label announces the change instead of being replaced by a new silent element.
  // The marks' spacer goes with the resting state and not the copied one, which is
  // what makes the button visibly shed its width when it morphs.
  const state = (leading, text) => {
    const f = document.createDocumentFragment();
    if (label) label.textContent = text;
    if (leading) f.append(leading);
    if (label) f.append(label);
    return f;
  };

  let reset = 0;
  btn.addEventListener('click', async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(brief());
    } catch {
      ok = false; // clipboard blocked: insecure context, or permission denied
    }
    clearTimeout(reset);
    // The pane's marks fade before the width tween starts, so the glass isn't
    // carrying four logos through a shape it no longer has room for.
    btn.classList.toggle('is-copied', ok);
    // setContent is the same morph the content-morph demo runs: the width tweens with
    // an overshoot and the refraction gets a kick that peaks mid-travel, so the button
    // reshapes as glass rather than swapping text inside a fixed pill.
    api.setContent(state(ok ? tick() : null, ok ? 'Copied' : 'Copy failed'));
    reset = window.setTimeout(() => {
      btn.classList.remove('is-copied');
      api.setContent(state(spacer, LABEL));
    }, HOLD_MS);
  });
});
