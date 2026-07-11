# @liquidglassjs registry (shadcn-compatible)

Ownable liquid-glass shell components, distributed the shadcn way: `shadcn add`
copies the source into **your** `components/`, so you own and restyle it. The
refraction engine stays a versioned npm dependency (`@liquidglassjs/react` →
`@liquidglassjs/core`) — you never fork the hard part.

## Install a component

```sh
# once this registry is deployed, point shadcn at the built item JSON:
npx shadcn@latest add https://<your-host>/r/glass-card.json
```

`glass-card` pulls in `glass-surface` automatically (a `registryDependency`), and
both declare `@liquidglassjs/react` + `@liquidglassjs/core` as npm `dependencies`,
so the CLI installs the engine for you.

**Prerequisites:** a shadcn-initialized project — `components.json`, Tailwind, and
the `cn` helper at `@/lib/utils` (the shells import it). Import the glass chrome
CSS once in your app: `import "@liquidglassjs/core/css"` (the shells already do).

## Components

| Item | Source | Notes |
|---|---|---|
| `glass-surface` | `registry/liquid-glass/glass-surface.tsx` | Base restyleable surface over `<LiquidGlass>`. |
| `glass-card` | `registry/liquid-glass/glass-card.tsx` | Card chrome on top of `glass-surface`. |

## Build

`registry.json` + the sources under `registry/` are the source of truth. The
installable items in `public/r/*.json` are generated:

```sh
pnpm --filter registry build   # node build.mjs → public/r/*.json
```

The generator is dependency-free; if you later adopt the `shadcn` CLI, `shadcn
build` produces the same `public/r/*.json` from `registry.json`.
