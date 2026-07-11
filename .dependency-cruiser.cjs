// dependency-cruiser config — controls `pnpm depcruise` (runs against packages + apps).
// Must be `.cjs` (CommonJS) because package.json is `"type": "module"`.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports make the graph hard to reason about and break tree-shaking.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Import points at something that cannot be resolved — likely a typo or missing dep.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-undeclared-dependencies',
      severity: 'error',
      comment: "Runtime imports must be declared in the owning package's package.json.",
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'core-is-the-base-layer',
      severity: 'error',
      comment:
        '@liquidglassjs/core must not import the apps or the qr/react/element packages — they depend on IT, never the reverse. (This guards the qr color-extraction decoupling.)',
      from: { path: '^packages/core/' },
      to: { path: '^(?:apps/|packages/(?:qr|react|element)/)' },
    },
    {
      name: 'satellites-only-depend-on-core',
      severity: 'error',
      comment:
        'qr / react / element may depend on @liquidglassjs/core only — not the apps, and not each other.',
      from: { path: '^packages/(qr|react|element)/' },
      to: { path: '^(?:apps/|packages/)', pathNot: ['^packages/core/', '^packages/$1/'] },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled', 'npm-no-pkg'],
    },
    // Never cruise build output (bundled dist chunks are legitimately circular),
    // nor the registry — its shell templates import consumer-side aliases
    // (`@/lib/utils`, `@/components/…`) that only resolve in the destination app.
    exclude: { path: '(?:^|/)dist/|^apps/registry/' },
    includeOnly: ['^(?:apps|packages)/'],
    moduleSystems: ['es6'],
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js'],
    },
  },
};
