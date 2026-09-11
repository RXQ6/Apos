import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "..", "dist", "db");
mkdirSync(outDir, { recursive: true });
copyFileSync(join(root, "..", "src", "db", "schema.sql"), join(outDir, "schema.sql"));
console.log("copied schema.sql → dist/db");
