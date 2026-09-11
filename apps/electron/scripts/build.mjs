import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "dist");
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [resolve(root, "src/main/main.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: resolve(out, "main/main.js"),
  external: ["electron", "bun:sqlite", "node:sqlite"],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

await build({
  entryPoints: [resolve(root, "src/preload/preload.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: resolve(out, "preload/preload.js"),
  external: ["electron"],
});

console.log("esbuild main+preload →", out);
