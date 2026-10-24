import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PHOTO, openRitual, pickPhoto } from "./helpers";

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), label).toEqual([]);
}

const SCREENS = [
  { path: "/?scenario=happy", heading: "Tu almacén" },
  { path: "/?scenario=empty", heading: "Tu almacén" },
  { path: "/inventario?scenario=happy", heading: "Todo lo que guardas" },
  { path: "/ajustes?scenario=happy", heading: "Ajustes del almacén" },
  { path: "/no-existe", heading: "Este pasillo no existe" },
];

for (const screen of SCREENS) {
  test(`[02 10.4] no serious axe violations on ${screen.path}`, async ({ page }) => {
    await page.goto(screen.path);
    await expect(page.getByRole("heading", { level: 1, name: screen.heading })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoSeriousViolations(page, screen.path);
  });
}

test("[02 10.4] no serious axe violations across the invocation flow", async ({ page }) => {
  await openRitual(page);
  await expectNoSeriousViolations(page, "ritual");
  await pickPhoto(page);
  await expectNoSeriousViolations(page, "preview");
  await page.getByRole("button", { name: "Invocar inventario" }).click();
  await expect(page.getByRole("img", { name: "Foto en análisis" })).toBeVisible();
  await expectNoSeriousViolations(page, "resurrection");
  await expect(page.getByRole("heading", { name: "Los productos han vuelto a la vida." })).toBeVisible({ timeout: 10_000 });
  await expectNoSeriousViolations(page, "review");
});

test("[02 10.4] no serious axe violations in the edit drawer and delete dialog", async ({ page }) => {
  await page.goto("/inventario?scenario=happy");
  await page.getByRole("button", { name: "Editar Panela redonda 1 kg" }).click();
  await expect(page.getByRole("dialog", { name: "Editar producto" })).toBeVisible();
  await expectNoSeriousViolations(page, "drawer");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Eliminar Panela redonda 1 kg" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expectNoSeriousViolations(page, "delete dialog");
});

test("[02 10.4] the whole upload, review and save path works by keyboard", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard path is checked on the desktop layout");
  await openRitual(page);
  // Reach "Elegir foto" by Tab; the native chooser is replaced by setInputFiles.
  const pick = page.getByRole("button", { name: "Elegir foto" });
  for (let i = 0; i < 20 && !(await pick.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(pick).toBeFocused();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles(PHOTO);
  const invoke = page.getByRole("button", { name: "Invocar inventario" });
  await expect(invoke).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Los productos han vuelto a la vida." })).toBeVisible({ timeout: 10_000 });

  // Fill card 1 by keyboard and deselect the others.
  const first = page.getByRole("article", { name: "Producto 1 de 3" });
  await first.getByLabel("Cantidad").focus();
  await page.keyboard.type("24");
  await page.keyboard.press("Tab");
  await page.keyboard.type("18900");
  for (const n of [2, 3]) {
    await page.getByRole("article", { name: `Producto ${n} de 3` }).getByRole("checkbox").focus();
    await page.keyboard.press("Space");
  }
  const save = page.getByRole("button", { name: "Guardar seleccionados" });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Tu almacén ha despertado.")).toBeVisible();
});
