// Copy the repo-root LICENSE into the package being packed.
//
// Wired as each package's `prepack` (`node ../../scripts/sync-license.mjs`), so
// `pnpm pack`, `npm publish`, and `changeset publish` all ship an MIT LICENSE in
// every tarball from a single source of truth (the root file). The generated
// copies are gitignored (see .gitignore) — this script is the only thing that
// writes them. Runs with cwd = the package dir (npm sets it during prepack).
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(repoRoot, 'LICENSE');
const dest = join(process.cwd(), 'LICENSE');

if (!existsSync(src)) {
  console.error(`[sync-license] root LICENSE not found at ${src}`);
  process.exit(1);
}

// No-op when invoked from the repo root itself (dest === src).
if (src !== dest) {
  copyFileSync(src, dest);
  console.log(`[sync-license] LICENSE -> ${dest}`);
}
