import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Providers } from "@/app/providers";
import { router } from "@/app/router";
import "@/styles/globals.css";

async function enableMocks() {
  // Dynamic import inside a DEV guard: Vite drops the whole branch from the production build.
  if (!import.meta.env.DEV) return;
  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledFrame: "bypass", quiet: true });
}

void enableMocks().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </StrictMode>,
  );
});
