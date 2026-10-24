import { expect, test, type Page } from "@playwright/test";
import { openRitual, summonCandidates } from "./helpers";

const card = (page: Page, n: number) => page.getByRole("article", { name: `Producto ${n} de 3` });

async function fill(page: Page, n: number, quantity: string, price: string) {
  await card(page, n).getByLabel("Cantidad").fill(quantity);
  await card(page, n).getByLabel("Precio unitario (COP)").fill(price);
}

test("[02 5.1] [02 5.2] candidates rise with the heading, photo, fields and confidence", async ({ page }) => {
  await openRitual(page);
  await summonCandidates(page);
  await expect(page.getByRole("article")).toHaveCount(3);
  const first = card(page, 1);
  await expect(first.getByRole("img", { name: /Foto analizada/ })).toBeVisible();
  await expect(first.getByLabel("Nombre")).toHaveValue("Café molido de origen Huila 500 g");
  await expect(first.getByLabel("Categoría")).toContainText("Alimentos");
  await expect(first.getByLabel("Descripción")).toHaveValue("Bolsa de café tostado y molido, empaque kraft con válvula.");
  await expect(first.getByLabel("Marca")).toHaveValue("Tostadora Andina");
  await expect(first.getByText("Confianza alta")).toBeVisible();
  await expect(card(page, 2).getByText("Confianza media")).toBeVisible();
  await expect(card(page, 3).getByText("Confianza baja")).toBeVisible();
  await expect(card(page, 3).getByText("Etiqueta parcialmente visible, podría ser jabón de cocina.")).toBeVisible();
});

test("[02 5.5] quantity, price and SKU are never prefilled", async ({ page }) => {
  await openRitual(page);
  await summonCandidates(page);
  for (const n of [1, 2, 3]) {
    await expect(card(page, n).getByLabel("Cantidad")).toHaveValue("");
    await expect(card(page, n).getByLabel("Precio unitario (COP)")).toHaveValue("");
    await expect(card(page, n).getByLabel("SKU")).toHaveValue("");
  }
});

test("[02 5.4] save stays disabled until every selected card is valid, and shows errors", async ({ page }) => {
  await openRitual(page);
  await summonCandidates(page);
  const save = page.getByRole("button", { name: "Guardar seleccionados" });
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "Ver pendientes" }).click();
  await expect(card(page, 1).getByText("Este campo es obligatorio.").first()).toBeVisible();
  await expect(card(page, 1).getByLabel("Cantidad")).toBeFocused();
  await fill(page, 1, "24", "18.900");
  await fill(page, 2, "40", "4200");
  await expect(save).toBeDisabled();
  await card(page, 3).getByLabel("Cantidad").fill("2,5");
  await expect(card(page, 3).getByText("Escribe un número entero, sin decimales.")).toBeVisible();
  await card(page, 3).getByRole("checkbox", { name: "Incluir al guardar" }).click();
  await expect(save).toBeEnabled();
});

test("[02 5.3] discard and restore a candidate", async ({ page }) => {
  await openRitual(page);
  await summonCandidates(page);
  await card(page, 2).getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("2 de 3 seleccionados")).toBeVisible();
  await expect(card(page, 2).getByLabel("Cantidad")).toHaveCount(0);
  await expect(card(page, 2).getByRole("button", { name: "Restaurar" })).toBeFocused();
  await card(page, 2).getByRole("button", { name: "Restaurar" }).click();
  await expect(card(page, 2).getByRole("button", { name: "Descartar" })).toBeFocused();
  await expect(card(page, 2).getByLabel("Cantidad")).toBeVisible();
  await expect(page.getByText("3 de 3 seleccionados")).toBeVisible();
});

test("[02 6.1] [02 6.2] saving sends only selected products, toasts and lands on the dashboard", async ({ page }) => {
  await openRitual(page);
  await summonCandidates(page);
  await fill(page, 1, "24", "18900");
  await card(page, 1).getByLabel("SKU").fill("CAF-HUI-500");
  await card(page, 2).getByRole("checkbox", { name: "Incluir al guardar" }).click();
  await card(page, 3).getByRole("button", { name: "Descartar" }).click();
  const request = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/products"));
  const save = page.getByRole("button", { name: "Guardar seleccionados" });
  await save.click();
  await expect(page.getByRole("button", { name: "Guardando..." })).toBeDisabled();
  const body = (await request).postDataJSON() as { imageKey: string; products: { name: string; sku?: string }[] };
  expect(body.imageKey).toMatch(/^tmp\//);
  expect(body.products).toHaveLength(1);
  expect(body.products[0]).toMatchObject({ name: "Café molido de origen Huila 500 g", sku: "CAF-HUI-500", quantity: 24 });
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Tu almacén ha despertado.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeVisible();
});

test("[02 6.3] a failed save keeps every edit and offers a retry", async ({ page }) => {
  await openRitual(page, "save-error");
  await summonCandidates(page);
  await fill(page, 1, "24", "18900");
  await fill(page, 2, "40", "4200");
  await fill(page, 3, "6", "3800");
  await page.getByRole("button", { name: "Guardar seleccionados" }).click();
  await expect(page.getByRole("alert")).toContainText("No se guardó nada.");
  await expect(page).toHaveURL(/\/invocar/);
  await expect(card(page, 1).getByLabel("Cantidad")).toHaveValue("24");
  await expect(card(page, 3).getByLabel("Precio unitario (COP)")).toHaveValue("3800");
  await expect(page.getByRole("button", { name: "Reintentar guardado" })).toBeEnabled();
});

test("[02 6.2] after saving, the dashboard starts at the top without horizontal overflow", async ({ page }) => {
  await openRitual(page);
  await summonCandidates(page);
  await fill(page, 1, "24", "18900");
  for (const n of [2, 3]) await card(page, n).getByRole("checkbox", { name: "Incluir al guardar" }).click();
  await page.getByRole("button", { name: "Guardar seleccionados" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("[02 5.3] deselecting and reselecting a card keeps its edits", async ({ page }) => {
  await openRitual(page);
  await summonCandidates(page);
  await fill(page, 1, "24", "18.900");
  const include = card(page, 1).getByRole("checkbox", { name: "Incluir al guardar" });
  await include.click();
  await expect(include).not.toBeChecked();
  await expect(page.getByText("2 de 3 seleccionados")).toBeVisible();
  await include.click();
  await expect(card(page, 1).getByLabel("Cantidad")).toHaveValue("24");
  await expect(card(page, 1).getByLabel("Precio unitario (COP)")).toHaveValue("18.900");
});
