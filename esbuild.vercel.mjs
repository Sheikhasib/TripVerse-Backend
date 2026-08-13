import { build } from "esbuild";

await build({
  entryPoints: ["api/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  legalComments: "none",
  sourcemap: "inline",
  outfile: "api/index.js",
});