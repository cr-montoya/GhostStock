import { readFileSync } from "node:fs";
import { productsFixture, productsToCsv } from "@ghoststock/contracts";
import { expect, test, type Page } from "@playwright/test";

const rows = (page: Page, isMobile: boolean) =>
  isMobile ? page.getByRole("listitem").filter({ has: page.getByRole("article") }) : page.getByRole("row").filter({ has: page.getByRole("rowheader") });

async function open(page: Page, scenario = "happy") {
  await page.goto(`/inventario?scenario=${scenario}`);
  await expect(page.getByRole("heading", { level: 1, name: "Todo lo que guardas" })).toBeVisible();
}

test("[02 8.1] lists every product with value and low-stock badge, table on desktop and cards on phones", async ({ page, isMobile }) => {
  await open(page);
  await expect(rows(page, isMobile)).toHaveCount(productsFixture.length);
  if (isMobile) {
    await expect(page.getByRole("table")).toBeHidden();
    const card = page.getByRole("article", { name: "Gaseosa de cola 1.5 L" });
    await expect(card).toContainText("Stock bajo");
    await expect(card).toContainText("$ 19.500");
  } else {
    const row = page.getByRole("row", { name: /Gaseosa de cola 1.5 L/ });
    await expect(row).toContainText("Bebidas");
    await expect(row).toContainText("Stock bajo");
    await expect(row).toContainText("$ 6.500");
    await expect(row).toContainText("$ 19.500");
  }
});

test("[02 8.2] search and category chips filter on the client without API calls", async ({ page, isMobile }) => {
  await open(page);
  let calls = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) calls += 1;
  });
  const search = page.getByRole("searchbox", { name: "Buscar productos" });
  await search.fill("cafe");
  await expect(rows(page, isMobile)).toHaveCount(1);
  await search.fill("PAP-CUA");
  await expect(rows(page, isMobile)).toHaveCount(1);
  await search.fill("Tostadora");
  await expect(rows(page, isMobile)).toHaveCount(1);
  await search.fill("botella");
  await expect(rows(page, isMobile)).toHaveCount(2);
  await search.fill("");
  await page.getByRole("button", { name: "Papelería" }).click();
  await expect(page.getByRole("button", { name: "Papelería" })).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page, isMobile)).toHaveCount(2);
  await page.getByRole("button", { name: "Bebidas" }).click();
  await expect(rows(page, isMobile)).toHaveCount(4);
  await page.getByRole("button", { name: "Todas" }).click();
  await expect(rows(page, isMobile)).toHaveCount(productsFixture.length);
  expect(calls).toBe(0);
});

test("[02 8.3] editing in the drawer updates the list", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Editar Panela redonda 1 kg" }).click();
  const drawer = page.getByRole("dialog", { name: "Editar producto" });
  await drawer.getByLabel("Cantidad").fill("2");
  const put = page.waitForRequest((r) => r.method() === "PUT");
  await drawer.getByRole("button", { name: "Guardar cambios" }).click();
  expect((await put).postDataJSON()).toEqual({ quantity: 2 });
  await expect(drawer).toBeHidden();
  await expect(page.getByText("Producto actualizado.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar Panela redonda 1 kg" }).locator("xpath=ancestor::*[self::tr or self::article][1]")).toContainText("Stock bajo");
});

test("[02 8.3] a failed edit rolls back and tells the user", async ({ page }) => {
  await open(page, "mutation-error");
  await page.getByRole("button", { name: "Editar Panela redonda 1 kg" }).click();
  const drawer = page.getByRole("dialog", { name: "Editar producto" });
  await drawer.getByLabel("Nombre").fill("Panela cuadrada");
  await drawer.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("No pudimos guardar los cambios. Volvimos a los valores anteriores.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar Panela redonda 1 kg" })).toBeVisible();
  await expect(page.getByText("Panela cuadrada")).toHaveCount(0);
});

test("[02 8.4] deleting asks for confirmation, then removes the product", async ({ page, isMobile }) => {
  await open(page);
  await page.getByRole("button", { name: "Eliminar Agua sin gas 600 ml" }).click();
  const confirm = page.getByRole("alertdialog", { name: "¿Eliminar este producto?" });
  await expect(confirm).toContainText("Agua sin gas 600 ml desaparecerá del inventario.");
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(rows(page, isMobile)).toHaveCount(productsFixture.length);
  await page.getByRole("button", { name: "Eliminar Agua sin gas 600 ml" }).click();
  const del = page.waitForRequest((r) => r.method() === "DELETE");
  await page.getByRole("alertdialog").getByRole("button", { name: "Sí, eliminar" }).click();
  expect(new URL((await del).url()).pathname).toBe(`/api/products/${productsFixture[3]!.id}`);
  await expect(rows(page, isMobile)).toHaveCount(productsFixture.length - 1);
});

test("[02 8.5] Exportar CSV downloads the filtered list built with productsToCsv", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Bebidas" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^ghoststock-inventario-\d{4}-\d{2}-\d{2}\.csv$/);
  const content = readFileSync((await file.path())!, "utf8");
  expect(content).toBe(productsToCsv(productsFixture.filter((p) => p.category === "bebidas")));
});

test("[02 10.1] empty and error states", async ({ page }) => {
  await open(page, "empty");
  await expect(page.getByText("Tu almacén está en silencio. Invoca tu primer producto.")).toBeVisible();
  await open(page, "products-error");
  await expect(page.getByRole("alert")).toContainText("No pudimos cargar el inventario");
});
