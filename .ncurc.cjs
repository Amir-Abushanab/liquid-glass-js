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
  target: "latest",
};
