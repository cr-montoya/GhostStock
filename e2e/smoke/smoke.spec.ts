import {
  ApiErrorSchema,
  CreateUploadResponseSchema,
  ListProductsResponseSchema,
  SettingsSchema,
} from "@ghoststock/contracts";
import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

// Smoke checks for a deployed stack (spec 03, Requirement 10.2). Read-only: no Bedrock
// call and no product is created. An upload slot only signs a POST; nothing is stored.
test.skip(!process.env.BASE_URL, "BASE_URL of a deployed stack is required (project smoke)");

const BACKOFF_MS = [500, 1000, 2000, 4000] as const;

/** The stage throttles at burst 10, rate 5: a 429 from API Gateway is retried, not judged. */
async function send(request: APIRequestContext, method: "GET" | "POST", path: string, data?: unknown): Promise<APIResponse> {
  for (let attempt = 0; ; attempt++) {
    const response = await request.fetch(path, { method, data });
    const backoff = BACKOFF_MS[attempt];
    if (response.status() !== 429 || backoff === undefined) return response;
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }
}

test("[03 10.2] the dashboard renders in Spanish", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es-CO");
  await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeVisible();
  await expect(page.getByText("Trae tu inventario de vuelta de la muerte.").first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).first()).toBeVisible();
});

test("[03 10.2] SPA routes are served by index.html", async ({ request }) => {
  const response = await send(request, "GET", "/inventario");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(await response.text()).toContain('<div id="root">');
});

test("[03 10.2] GET /api/products returns a contract-valid body", async ({ request }) => {
  const response = await send(request, "GET", "/api/products");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  const body = ListProductsResponseSchema.parse(await response.json());
  expect(body.count).toBe(body.products.length);
});

test("[03 10.2] GET /api/settings returns a contract-valid body", async ({ request }) => {
  const response = await send(request, "GET", "/api/settings");
  expect(response.status()).toBe(200);
  SettingsSchema.parse(await response.json());
});

test("[03 10.2] an upload slot can be obtained and its S3 host is allowed by the CSP", async ({ request }) => {
  const response = await send(request, "POST", "/api/uploads", { contentType: "image/jpeg", sizeBytes: 1024 });
  expect(response.status()).toBe(201);
  const slot = CreateUploadResponseSchema.parse(await response.json());
  expect(slot.imageKey).toMatch(/^tmp\/[0-9A-HJKMNP-TV-Z]{26}\.jpg$/);
  expect(slot.fields.key).toBe(slot.imageKey);

  const page = await send(request, "GET", "/");
  const csp = page.headers()["content-security-policy"] ?? "";
  const connectSrc = /connect-src([^;]*)/.exec(csp)?.[1] ?? "";
  expect(connectSrc).toContain(new URL(slot.url).origin);
});

test("[03 10.2] security headers are present", async ({ request }) => {
  const response = await send(request, "GET", "/");
  const headers = response.headers();
  expect(headers["strict-transport-security"]).toMatch(/max-age=31536000/);
  expect(headers["strict-transport-security"]).toMatch(/includeSubDomains/i);
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  const csp = headers["content-security-policy"] ?? "";
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]) {
    expect(csp).toContain(directive);
  }
});

test("[03 10.2] an unknown /api path returns the JSON NOT_FOUND envelope, not index.html", async ({ request }) => {
  const response = await send(request, "GET", "/api/no-existe");
  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/json");
  const text = await response.text();
  expect(text.toLowerCase()).not.toContain("<!doctype html");
  const body = ApiErrorSchema.parse(JSON.parse(text));
  expect(body.error.code).toBe("NOT_FOUND");
});
