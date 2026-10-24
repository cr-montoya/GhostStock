import { expect, test } from "@playwright/test";
import { VIEWPORTS, capture } from "./viewports";

for (const [name, use] of Object.entries(VIEWPORTS)) {
  test.describe(name, () => {
    test.use({ ...use, reducedMotion: "reduce" });

    test("[02 11.4] dashboard with data", async ({ page }) => {
      await page.goto("/?scenario=happy");
      await expect(page.getByRole("region", { name: "Valor del inventario" })).toContainText("$");
      await expect(page.getByRole("region", { name: "Resurrecciones recientes" }).getByRole("img").first()).toBeVisible();
      await capture(page, `dashboard-${name}.png`);
    });

    test("[02 11.4] dashboard empty", async ({ page }) => {
      await page.goto("/?scenario=empty");
      await expect(page.getByText("Tu almacén está en silencio. Invoca tu primer producto.")).toBeVisible();
      await capture(page, `dashboard-empty-${name}.png`);
    });

    test("[02 11.4] dashboard loading", async ({ page }) => {
      // A frozen clock keeps the mock request pending, so the skeleton stays on screen.
      await page.clock.install();
      await page.goto("/?scenario=happy");
      await expect(page.getByLabel("Cargando...")).toBeVisible();
      await capture(page, `dashboard-loading-${name}.png`);
    });

    test("[02 11.4] dashboard error", async ({ page }) => {
      await page.goto("/?scenario=products-error");
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
      await capture(page, `dashboard-error-${name}.png`);
    });
  });
}
