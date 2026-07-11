import { defineConfig, passthroughImageService } from 'astro/config';

// Astro showcase for @liquidglassjs/core. It consumes the library by package
// name; core's `exports` map points at raw src in the workspace (dev), so edits
// hot-reload with no alias and no build step. https://astro.build/config
//
// Deploy base: GitHub project Pages serves at a sub-path
// (amir-abushanab.github.io/liquid-glass/), so the CI deploy sets
// SHOWCASE_BASE=/liquid-glass. Local dev/build stay at root (var unset) so the
// dev URL is unchanged. Preview the Pages build locally with:
//   SHOWCASE_BASE=/liquid-glass pnpm --filter showcase build && pnpm --filter showcase preview
const base = process.env.SHOWCASE_BASE || undefined;

export default defineConfig({
  site: 'https://amir-abushanab.github.io',
  base,
  // The showcase ships no optimized images, so skip sharp entirely (see
  // allowBuilds in ../../pnpm-workspace.yaml).
  image: { service: passthroughImageService() },
});
