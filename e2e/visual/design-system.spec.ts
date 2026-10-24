import { expect, test } from "@playwright/test";
import { VIEWPORTS } from "./viewports";

for (const [name, use] of Object.entries(VIEWPORTS)) {
  test.describe(name, () => {
    test.use({ ...use, reducedMotion: "reduce" });

    test("[02 1.3] design system showcase", async ({ page }) => {
      await page.goto("/_tokens");
      await expect(page.getByRole("heading", { level: 1, name: "Tokens del almacén" })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`tokens-${name}.png`, { fullPage: true });
    });

    test("[02 1.3] not found page", async ({ page }) => {
      await page.goto("/no-existe");
      await expect(page.getByRole("heading", { level: 1, name: "Este pasillo no existe" })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`not-found-${name}.png`, { fullPage: true });
    });
  });
}
