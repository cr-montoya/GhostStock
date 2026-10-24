import { defineConfig, devices } from "@playwright/test";

// Projects for every lane (ADR 0009). `api` and `smoke` target a deployed stack through
// BASE_URL; web and visual run against the Vite dev server with MSW.
const baseUrl = process.env.BASE_URL;
const localUrl = "http://localhost:5173";
// Optional installed browser (e.g. PW_CHANNEL=chrome) instead of the downloaded Chromium.
const channel = process.env.PW_CHANNEL;

export default defineConfig({
  fullyParallel: true,
  // Full flows include the 2.5 s mock analysis; leave room on loaded machines.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled" } },
  use: { trace: "retain-on-failure", locale: "es-CO", timezoneId: "America/Bogota", ...(channel ? { channel } : {}) },
  projects: [
    { name: "web-desktop", testDir: "web", use: { baseURL: localUrl, viewport: { width: 1440, height: 900 } } },
    { name: "web-mobile", testDir: "web", use: { ...devices["Pixel 7"], baseURL: localUrl } },
    // Visual specs switch between 1440x900 and Pixel 7 per describe block (see visual/viewports.ts).
    { name: "visual", testDir: "visual", use: { baseURL: localUrl, viewport: { width: 1440, height: 900 } } },
    { name: "api", testDir: "api", use: { baseURL: baseUrl } },
    { name: "smoke", testDir: "smoke", use: { baseURL: baseUrl } },
  ],
  webServer: baseUrl
    ? undefined
    : {
        command: "pnpm --filter @ghoststock/web dev",
        url: localUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
