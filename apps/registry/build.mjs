// Generates public/r/<name>.json from registry.json + the source files under
// registry/. Mirrors what `shadcn build` does — inlines each file's content
// (JSON.stringify handles the escaping) into an installable registry-item.json.
// Zero dependencies, so the registry needs no toolchain to (re)build.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(readFileSync(join(root, "registry.json"), "utf8"));
const outDir = join(root, "public", "r");
mkdirSync(outDir, { recursive: true });

for (const item of registry.items) {
  const files = item.files.map((f) => ({
    path: f.target ?? f.path,
    content: readFileSync(join(root, f.path), "utf8"),
    type: f.type,
  }));
  const out = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    ...(item.dependencies ? { dependencies: item.dependencies } : {}),
    ...(item.registryDependencies
      ? { registryDependencies: item.registryDependencies }
      : {}),
    files,
  };
  writeFileSync(join(outDir, `${item.name}.json`), JSON.stringify(out, null, 2) + "\n");
  console.log(`✓ public/r/${item.name}.json`);
}
console.log(`Built ${registry.items.length} registry item(s).`);
