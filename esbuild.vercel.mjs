import { build } from "esbuild";
import fs from "fs";

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

// Copy EJS email templates next to the bundle so ejs.renderFile can read them
// at runtime on Vercel (the bundle is a single file; there is no filesystem
// access to src/). Committed with api/index.js like the rest of the bundle.
fs.mkdirSync("api/templates", { recursive: true });
for (const file of fs.readdirSync("src/templates")) {
  if (file.endsWith(".ejs")) {
    fs.copyFileSync(`src/templates/${file}`, `api/templates/${file}`);
  }
}