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
import { mountGlassButton } from '@liquidglassjs/core';
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

document.querySelectorAll('[data-agent-copy]').forEach((btn) => {
  const label = btn.querySelector('.agent-label');
  // Glass first: mountGlassButton moves the existing children into a crisp label layer
  // and puts a refracting pane behind them, so the glyphs stay sharp.
  mountGlassButton(btn, {
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
    radius: 999,
  });
  let reset = 0;
  btn.addEventListener('click', async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(brief());
    } catch {
      ok = false; // clipboard blocked: insecure context, or permission denied
    }
    if (label) label.textContent = ok ? 'Copied ✓' : 'Copy failed';
    btn.classList.toggle('is-copied', ok);
    clearTimeout(reset);
    reset = window.setTimeout(() => {
      if (label) label.textContent = LABEL;
      btn.classList.remove('is-copied');
    }, 1400);
  });
});
