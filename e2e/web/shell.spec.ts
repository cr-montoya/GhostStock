import { expect, test } from "@playwright/test";

test("[02 11.1] app shell boots with mocks and shows the brand", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "GhostStock" })).toBeVisible();
  await expect(page.getByText("Trae tu inventario de vuelta de la muerte.")).toBeVisible();
});

test("[02 11.1] unknown routes show the 404 page in Spanish", async ({ page }) => {
  await page.goto("/no-existe");
  await expect(page.getByRole("heading", { name: "Este pasillo no existe" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver al almacén" })).toBeVisible();
});
