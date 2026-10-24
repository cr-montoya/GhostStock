import { listProductsResponseFixture, settingsFixture } from "@ghoststock/contracts";
import { expect, test } from "@playwright/test";

const getJson = (path: string) =>
  `fetch(${JSON.stringify(path)}).then(async (r) => ({ status: r.status, body: await r.json() }))`;

test("[02 11.1] dev serves /api through MSW from contract fixtures", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "GhostStock" })).toBeVisible();
  const products = await page.evaluate(getJson("/api/products"));
  expect(products).toEqual({ status: 200, body: JSON.parse(JSON.stringify(listProductsResponseFixture)) });
  const settings = await page.evaluate(getJson("/api/settings"));
  expect(settings).toEqual({ status: 200, body: JSON.parse(JSON.stringify(settingsFixture)) });
});

test("[02 11.1] ?scenario=empty is selected and survives navigation", async ({ page }) => {
  await page.goto("/?scenario=empty");
  await expect(page.getByRole("heading", { level: 1, name: "GhostStock" })).toBeVisible();
  expect(await page.evaluate(getJson("/api/products"))).toEqual({ status: 200, body: { products: [], count: 0 } });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "GhostStock" })).toBeVisible();
  expect(await page.evaluate(getJson("/api/products"))).toEqual({ status: 200, body: { products: [], count: 0 } });
});
