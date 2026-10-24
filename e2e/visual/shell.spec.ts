import { expect, test } from "@playwright/test";
import { VIEWPORTS, capture } from "./viewports";

for (const [name, use] of Object.entries(VIEWPORTS)) {
  test.describe(name, () => {
    test.use({ ...use, reducedMotion: "reduce" });

    test("[02 2.2] command palette with product results", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Tu almacén" })).toBeVisible();
      await page.keyboard.press("Control+k");
      const palette = page.getByRole("dialog", { name: "Paleta de comandos" });
      await palette.getByRole("combobox").fill("caf");
      await expect(palette.getByRole("option", { name: /Café molido/ })).toBeVisible();
      await capture(page, `palette-${name}.png`);
    });
  });
}
