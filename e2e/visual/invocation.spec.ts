import { expect, test } from "@playwright/test";
import { openRitual, pickPhoto, summonCandidates } from "../web/helpers";
import { VIEWPORTS, capture } from "./viewports";

for (const [name, use] of Object.entries(VIEWPORTS)) {
  test.describe(name, () => {
    test.use({ ...use, reducedMotion: "reduce" });

    test("[02 11.4] ritual idle", async ({ page }) => {
      await openRitual(page);
      await capture(page, `ritual-idle-${name}.png`);
    });

    test("[02 11.4] ritual invalid file", async ({ page }) => {
      await openRitual(page);
      await page
        .getByLabel("Archivo de foto")
        .setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
      await expect(page.getByRole("alert")).toBeVisible();
      await capture(page, `ritual-invalid-${name}.png`);
    });

    test("[02 11.4] ritual preview", async ({ page }) => {
      await openRitual(page);
      await pickPhoto(page);
      await capture(page, `ritual-preview-${name}.png`);
    });

    test("[02 11.4] resurrection in progress", async ({ page }) => {
      // A frozen clock holds the mock analysis and the status ticker on their first frame.
      await page.clock.install();
      await openRitual(page);
      await pickPhoto(page);
      await page.getByRole("button", { name: "Invocar inventario" }).click();
      await expect(page.getByRole("img", { name: "Foto en análisis" })).toBeVisible();
      await capture(page, `resurrection-${name}.png`);
    });

    for (const scenario of ["model-error", "zero-candidates"] as const) {
      test(`[02 11.4] resurrection ${scenario}`, async ({ page }) => {
        await openRitual(page, scenario);
        await pickPhoto(page);
        await page.getByRole("button", { name: "Invocar inventario" }).click();
        await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible({ timeout: 10_000 });
        await capture(page, `resurrection-${scenario}-${name}.png`);
      });
    }
  });
}

for (const [name, use] of Object.entries(VIEWPORTS)) {
  test.describe(`${name} review`, () => {
    test.use({ ...use, reducedMotion: "reduce" });

    test("[02 11.4] review candidates with pending fields", async ({ page }) => {
      await openRitual(page);
      await summonCandidates(page);
      await page.getByRole("button", { name: "Ver pendientes" }).click();
      await page.getByRole("article", { name: "Producto 1 de 3" }).getByLabel("Cantidad").fill("24");
      await page.getByRole("article", { name: "Producto 3 de 3" }).getByRole("button", { name: "Descartar" }).click();
      await page.getByRole("article", { name: "Producto 3 de 3" }).getByRole("button", { name: "Restaurar" }).waitFor();
      await capture(page, `review-${name}.png`);
    });
  });
}
