import { computeInventoryStats, productsFixture, settingsFixture } from "@ghoststock/contracts";
import { expect, test } from "@playwright/test";

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("es-CO");
const stats = computeInventoryStats(productsFixture, settingsFixture.lowStockThreshold);

test("[02 7.1] KPI cards equal computeInventoryStats of the fixture", async ({ page }) => {
  await page.goto("/?scenario=happy");
  const kpi = (name: string) => page.getByRole("region", { name });
  await expect(kpi("Productos")).toContainText(int.format(stats.productCount));
  await expect(kpi("Unidades")).toContainText(int.format(stats.unitCount));
  await expect(kpi("Valor del inventario")).toContainText(cop.format(stats.inventoryValueCop));
  await expect(kpi("Categorías")).toContainText(int.format(stats.categoryCount));
});

test("[02 7.2] charts, low stock in ember and recent products with photos", async ({ page }) => {
  await page.goto("/?scenario=happy");
  const byValue = page.getByRole("figure", { name: "Valor por categoría" });
  for (const entry of stats.byCategory) {
    await expect(byValue).toContainText(`${entry.label}: ${cop.format(entry.valueCop)}`);
  }
  await expect(page.getByRole("figure", { name: "Distribución" })).toContainText(stats.byCategory[0]!.label);

  const low = page.getByRole("region", { name: "Stock bajo" });
  for (const product of stats.lowStock) await expect(low).toContainText(product.name);
  await expect(low.getByText("Agotado")).toBeVisible();
  await expect(low.getByText("Quedan 3")).toBeVisible();

  const recent = page.getByRole("region", { name: "Resurrecciones recientes" });
  await expect(recent.getByRole("img", { name: productsFixture[0]!.name })).toBeVisible();
});

test("[02 7.3] the empty inventory shows the ghost and the CTA", async ({ page }) => {
  await page.goto("/?scenario=empty");
  await expect(page.getByText("Tu almacén está en silencio. Invoca tu primer producto.")).toBeVisible();
  await page.getByRole("link", { name: "Invocar inventario" }).click();
  await expect(page).toHaveURL("/invocar");
});

test("[02 10.1] a failed load shows the error with retry", async ({ page }) => {
  await page.goto("/?scenario=products-error");
  await expect(page.getByRole("alert")).toContainText("No pudimos abrir el almacén");
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
});
