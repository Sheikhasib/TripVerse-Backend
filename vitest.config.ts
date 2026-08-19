import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["tests/setup.ts"],
    // One shared/live DB — suites must never run in parallel or their unique
    // keys and cleanup would interleave. ~10 small files, sequential is cheap.
    fileParallelism: false,
    pool: "forks",
    isolate: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});