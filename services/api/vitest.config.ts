import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests, typecheck (tsconfig paths) and the esbuild Lambda bundle (which honours those
  // paths) all read the contracts source, so no contracts build is needed first.
  resolve: {
    alias: { "@ghoststock/contracts": fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url)) },
  },
  test: {
    include: ["test/**/*.test.ts"],
    env: { POWERTOOLS_DEV: "true", POWERTOOLS_LOG_LEVEL: "SILENT", POWERTOOLS_METRICS_DISABLED: "true" },
  },
});
