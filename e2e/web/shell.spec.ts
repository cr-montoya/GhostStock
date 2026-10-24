import { expect, test } from "@playwright/test";

const SCREENS = [
  { label: "Invocar", path: "/invocar", heading: "El ritual" },
  { label: "Inventario", path: "/inventario", heading: "Todo lo que guardas" },
  { label: "Ajustes", path: "/ajustes", heading: "Ajustes del almacén" },
  { label: "Almacén", path: "/", heading: "Tu almacén" },
];

test("[02 2.1] navigation reaches every screen with the right bar for the viewport", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toHaveCount(1);
  // Tab bar sits at the bottom on phones; the sidebar on the left on desktop.
  const box = await nav.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error("navigation not laid out");
  if (isMobile) expect(box.y + box.height).toBeGreaterThan(viewport.height - 2);
  else expect(box.x).toBeLessThan(40);

  for (const screen of SCREENS) {
    await nav.getByRole("link", { name: screen.label }).click();
    await expect(page).toHaveURL(screen.path);
    await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
    await expect(nav.getByRole("link", { name: screen.label })).toHaveAttribute("aria-current", "page");
  }
});

test("[02 2.2] Ctrl+K opens the palette, finds products by name, brand, SKU and category", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeVisible();
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Paleta de comandos" });
  await expect(palette).toBeVisible();
  const search = palette.getByRole("combobox");

  for (const [query, expected] of [
    ["panela", "Panela redonda 1 kg"],
    ["Tostadora", "Café molido de origen Huila 500 g"],
    ["BEB-COL", "Gaseosa de cola 1.5 L"],
    ["Ferretería", "Bombillo LED 9 W"],
  ] as const) {
    await search.fill(query);
    await expect(palette.getByRole("option", { name: new RegExp(expected) })).toBeVisible();
  }

  await search.fill("ajustes");
  await palette.getByRole("option", { name: "Ajustes" }).click();
  await expect(page).toHaveURL("/ajustes");
  await expect(palette).toBeHidden();
});

test("[02 2.2] Meta+K also toggles the palette", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeVisible();
  await page.keyboard.press("Meta+k");
  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeHidden();
});

test("[02 10.2] unknown routes show the 404 page in Spanish", async ({ page }) => {
  await page.goto("/no-existe");
  await expect(page.getByRole("heading", { level: 1, name: "Este pasillo no existe" })).toBeVisible();
  await page.getByRole("link", { name: "Volver al almacén" }).click();
  await expect(page).toHaveURL("/");
});
