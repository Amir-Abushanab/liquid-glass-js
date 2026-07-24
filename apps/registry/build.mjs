// Generates public/r/<name>.json from registry.json + the component sources it
// points at — they live in apps/showcase (the one copy the demos also render).
// Mirrors what `shadcn build` does — inlines each file's content
// (JSON.stringify handles the escaping) into an installable registry-item.json.
// Zero dependencies, so the registry needs no toolchain to (re)build.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(join(root, 'registry.json'), 'utf8'));
// Emit into the showcase's public dir when REGISTRY_OUT_DIR is set (the showcase
// hosts the registry JSON), else this app's own public/r.
const outDir = process.env.REGISTRY_OUT_DIR
  ? resolve(process.env.REGISTRY_OUT_DIR)
  : join(root, 'public', 'r');
mkdirSync(outDir, { recursive: true });

for (const item of registry.items) {
  const files = item.files.map((f) => ({
    path: f.target ?? f.path,
    content: readFileSync(join(root, f.path), 'utf8'),
    type: f.type,
  }));
  const out = {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    ...(item.dependencies ? { dependencies: item.dependencies } : {}),
    ...(item.registryDependencies ? { registryDependencies: item.registryDependencies } : {}),
    files,
  };
  writeFileSync(join(outDir, `${item.name}.json`), JSON.stringify(out, null, 2) + '\n');
  console.log(`✓ public/r/${item.name}.json`);
}
console.log(`Built ${registry.items.length} registry item(s).`);
