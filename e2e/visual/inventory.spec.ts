import { expect, test } from "@playwright/test";
import { VIEWPORTS, capture } from "./viewports";

for (const [name, use] of Object.entries(VIEWPORTS)) {
  test.describe(name, () => {
    test.use({ ...use, reducedMotion: "reduce" });

    test("[02 11.4] inventory list", async ({ page }) => {
      await page.goto("/inventario?scenario=happy");
      await expect(page.getByRole("button", { name: "Editar Panela redonda 1 kg" })).toBeVisible();
      await capture(page, `inventory-${name}.png`);
    });

    test("[02 11.4] inventory filtered with no matches", async ({ page }) => {
      await page.goto("/inventario?scenario=happy");
      await page.getByRole("searchbox", { name: "Buscar productos" }).fill("calabaza");
      await expect(page.getByText("Ningún producto coincide con tu búsqueda.")).toBeVisible();
      await capture(page, `inventory-no-matches-${name}.png`);
    });

    test("[02 11.4] edit drawer", async ({ page }) => {
      await page.goto("/inventario?scenario=happy");
      await page.getByRole("button", { name: "Editar Gaseosa de cola 1.5 L" }).click();
      await expect(page.getByRole("dialog", { name: "Editar producto" })).toBeVisible();
      await capture(page, `inventory-drawer-${name}.png`);
    });

    test("[02 11.4] delete confirmation", async ({ page }) => {
      await page.goto("/inventario?scenario=happy");
      await page.getByRole("button", { name: "Eliminar Agua sin gas 600 ml" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await capture(page, `inventory-delete-${name}.png`);
    });

    test("[02 11.4] settings", async ({ page }) => {
      await page.goto("/ajustes?scenario=happy");
      await expect(page.getByLabel("Umbral de stock bajo")).toHaveValue("5");
      await expect(page.getByText(/quedarían en stock bajo/)).toBeVisible();
      await capture(page, `settings-${name}.png`);
    });
  });
}
