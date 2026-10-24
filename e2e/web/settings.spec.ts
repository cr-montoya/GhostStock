import { expect, test } from "@playwright/test";

test("[02 9.1] the saved threshold drives the dashboard and the inventory", async ({ page }) => {
  await page.goto("/ajustes?scenario=happy");
  const field = page.getByLabel("Umbral de stock bajo");
  await expect(field).toHaveValue("5");
  await field.fill("20");
  await expect(page.getByText("4 productos quedarían en stock bajo con este umbral.")).toBeVisible();
  const put = page.waitForRequest((r) => r.method() === "PUT" && r.url().endsWith("/api/settings"));
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  expect((await put).postDataJSON()).toEqual({ lowStockThreshold: 20 });
  await expect(page.getByText("Ajustes guardados.")).toBeVisible();

  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Almacén" }).click();
  await expect(page.getByText("Productos con 20 unidades o menos.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Stock bajo" })).toContainText("Bombillo LED 9 W");

  await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Inventario" }).click();
  await expect(page.getByText("Stock bajo").first()).toBeVisible();
});

test("[02 9.1] rejects an invalid threshold", async ({ page }) => {
  await page.goto("/ajustes?scenario=happy");
  await page.getByLabel("Umbral de stock bajo").fill("-1");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Escribe un número entero entre 0 y 100.000.")).toBeVisible();
});

test("[02 10.1] a failed save tells the user", async ({ page }) => {
  await page.goto("/ajustes?scenario=mutation-error");
  await page.getByLabel("Umbral de stock bajo").fill("9");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("No pudimos guardar los ajustes.")).toBeVisible();
});
