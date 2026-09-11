import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const build = spawn(process.execPath, [resolve(appDir, "scripts/build.mjs")], {
  stdio: "inherit",
});

build.on("exit", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const vite = spawn(
    "npx",
    ["vite", "--config", resolve(appDir, "vite.config.ts")],
    { cwd: appDir, stdio: "inherit", shell: true },
  );
  // Start electron after a short delay for vite
  setTimeout(() => {
    const electron = spawn(
      "npx",
      ["electron", resolve(appDir, "dist/main/main.js")],
      {
        cwd: appDir,
        stdio: "inherit",
        shell: true,
        env: {
          ...process.env,
          VITE_DEV_SERVER_URL: "http://localhost:5173",
          APOS_REPO_ROOT: resolve(appDir, "..", ".."),
        },
      },
    );
    electron.on("exit", (c) => {
      vite.kill();
      process.exit(c ?? 0);
    });
  }, 2000);
});
