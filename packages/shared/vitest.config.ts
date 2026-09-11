import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    // node:sqlite is more reliable in forks than worker_threads on CI
    pool: "forks",
    fileParallelism: false,
  },
});
