import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests and typecheck read the contracts source, so no prior build is needed; the
  // Lambda bundle (esbuild in spec 03) resolves the built package as usual.
  resolve: {
    alias: { "@ghoststock/contracts": fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url)) },
  },
  test: {
    include: ["test/**/*.test.ts"],
    env: { POWERTOOLS_DEV: "true", POWERTOOLS_LOG_LEVEL: "SILENT", POWERTOOLS_METRICS_DISABLED: "true" },
  },
});
