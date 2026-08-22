// npm-check-updates config — controls `pnpm ncu`.
//
// Because package.json is `"type": "module"`, this file MUST be `.ncurc.cjs`
// (CommonJS). A `.ncurc.js` would be loaded as ESM and `module.exports` would
// throw.
module.exports = {
  // Skip versions younger than 7 days. Buys time for the ecosystem to catch
  // regressions / supply-chain compromises before we pull them in.
  // Defense-in-depth alongside pnpm's `minimumReleaseAge` in pnpm-workspace.yaml.
  cooldown: "7d",

  // Respect each package's `latest` dist-tag instead of just picking the
  // numerically-highest published version. ('latest' is ncu's default, but
  // worth being explicit about the intent.)
  //
  // typescript is held at its current major. TypeScript 7 (the Go compiler) ships
  // no programmatic compiler API, and dependency-cruiser needs one to parse TS:
  // with 7 installed it still exits 0 but silently cruises JS only (68 modules
  // dropped to 35), so `pnpm check` passes while checking nothing in .ts. Lift
  // this once TypeScript 7.1 ships its public API AND a dependency-cruiser
  // release declares support for it — see its release notes for 18.1.0.
  target: (name) => (name === "typescript" ? "minor" : "latest"),
};
