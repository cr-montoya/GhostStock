/// <reference types="vitest/config" />
import { createReadStream } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const require = createRequire(import.meta.url);

// Serves the MSW worker in dev only, so nothing from MSW is ever copied into dist.
function mswWorker(): Plugin {
  return {
    name: "ghoststock:msw-worker",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/mockServiceWorker.js", (_req, res) => {
        res.setHeader("Content-Type", "text/javascript");
        createReadStream(require.resolve("msw/mockServiceWorker.js")).pipe(res);
      });
    },
  };
}

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), mswWorker()],
  resolve: {
    alias: {
      "@": src("./src"),
      // Source import keeps dev and build independent of the contracts build order.
      "@ghoststock/contracts": src("../../packages/contracts/src/index.ts"),
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  build: { sourcemap: false },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
