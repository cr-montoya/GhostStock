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

// Dev only: saved product photos (`/media/products/*`) resolve to a fixture photo.
function devMedia(): Plugin {
  const photo = fileURLToPath(new URL("../../e2e/fixtures/images/pantry.jpg", import.meta.url));
  return {
    name: "ghoststock:dev-media",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/media/products/", (_req, res) => {
        res.setHeader("Content-Type", "image/jpeg");
        createReadStream(photo).pipe(res);
      });
    },
  };
}

// Each worktree runs its own dev server: WEB_PORT picks the port (default 5173).
const port = Number(process.env.WEB_PORT ?? 5173);

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), mswWorker(), devMedia()],
  resolve: {
    alias: {
      "@": src("./src"),
      // Source import keeps dev and build independent of the contracts build order.
      "@ghoststock/contracts": src("../../packages/contracts/src/index.ts"),
    },
  },
  server: { port, strictPort: true },
  preview: { port, strictPort: true },
  build: { sourcemap: false },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
