import { defineConfig } from "vitest/config";

// Synthesizing CDK stacks is slow; one generous timeout instead of per-test overrides.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], testTimeout: 60_000 },
});
