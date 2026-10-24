import { listProductsResponseFixture, settingsFixture } from "@ghoststock/contracts";
import { expect, test } from "@playwright/test";

const getJson = (path: string) =>
  `fetch(${JSON.stringify(path)}).then(async (r) => ({ status: r.status, body: await r.json() }))`;

test("[02 11.1] dev serves /api through MSW from contract fixtures", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeVisible();
  const products = await page.evaluate(getJson("/api/products"));
  expect(products).toEqual({ status: 200, body: JSON.parse(JSON.stringify(listProductsResponseFixture)) });
  const settings = await page.evaluate(getJson("/api/settings"));
  expect(settings).toEqual({ status: 200, body: JSON.parse(JSON.stringify(settingsFixture)) });
});

test("[02 11.1] ?scenario=empty is selected and survives navigation", async ({ page }) => {
  await page.goto("/?scenario=empty");
  await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeVisible();
  expect(await page.evaluate(getJson("/api/products"))).toEqual({ status: 200, body: { products: [], count: 0 } });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeVisible();
  expect(await page.evaluate(getJson("/api/products"))).toEqual({ status: 200, body: { products: [], count: 0 } });
});

const postJson = (path: string, body: unknown) =>
  `fetch(${JSON.stringify(path)}, { method: "POST", headers: { "content-type": "application/json" }, body: ${JSON.stringify(
    JSON.stringify(body),
  )} }).then(async (r) => ({ status: r.status, body: await r.json() }))`;

const analysisCases = [
  ["happy", 200, (body: { candidates?: unknown[] }) => expect(body.candidates).toHaveLength(3)],
  ["zero-candidates", 200, (body: { candidates?: unknown[] }) => expect(body.candidates).toEqual([])],
  ["model-error", 502, (body: { error?: { code: string } }) => expect(body.error?.code).toBe("MODEL_INVALID_OUTPUT")],
  ["throttled", 429, (body: { error?: unknown }) => expect(body.error).toBeUndefined()],
] as const;

for (const [scenario, status, check] of analysisCases) {
  test(`[02 11.1] scenario ${scenario} drives POST /api/analyses`, async ({ page }) => {
    await page.goto(`/?scenario=${scenario}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const result: { status: number; body: unknown } = await page.evaluate(postJson("/api/analyses", { imageKey: "tmp/01JB5X7Q8M0000000000000900.jpg" }));
    expect(result.status).toBe(status);
    check(result.body as never);
  });
}
