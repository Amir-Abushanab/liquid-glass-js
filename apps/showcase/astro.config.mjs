import { fileURLToPath } from 'node:url';
import { defineConfig, passthroughImageService } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Astro showcase for @liquidglassjs/core. It consumes the library by package
// name; core's `exports` map points at raw src in the workspace (dev), so edits
// hot-reload with no alias and no build step. https://astro.build/config
//
// This one app also hosts the component registry docs (React islands under
// /components), so it carries the React integration + Tailwind v4.
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
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  },
  // The showcase ships no optimized images, so skip sharp entirely (see
  // allowBuilds in ../../pnpm-workspace.yaml).
  image: { service: passthroughImageService() },
});
