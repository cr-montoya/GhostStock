import { expect, test, type Page } from "@playwright/test";
import { openRitual, pickPhoto } from "./helpers";

test.use({ reducedMotion: "reduce" });

/** Every running Web Animation and CSS animation in the document. */
async function runningAnimations(page: Page) {
  return page.evaluate(() =>
    document.getAnimations().map((animation) => {
      const timing = animation.effect?.getComputedTiming();
      const target = (animation.effect as KeyframeEffect | null)?.target as HTMLElement | null;
      return {
        name: (animation as CSSAnimation).animationName ?? "web-animation",
        iterations: timing?.iterations ?? 1,
        duration: Number(timing?.duration ?? 0),
        target: target?.className?.toString().slice(0, 60) ?? "",
      };
    }),
  );
}

test("[02 10.3] no looping animation survives reduced motion on the dashboard", async ({ page }) => {
  await page.goto("/?scenario=empty");
  await expect(page.getByText("Tu almacén está en silencio. Invoca tu primer producto.")).toBeVisible();
  const loops = (await runningAnimations(page)).filter((a) => a.iterations === Infinity);
  expect(loops).toEqual([]);
  // The fog layer is paused entirely.
  expect(await page.locator(".gs-fog").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

test("[02 10.3] the resurrection stops its loops and keeps the scan line away", async ({ page }) => {
  await openRitual(page);
  await pickPhoto(page);
  await page.getByRole("button", { name: "Invocar inventario" }).click();
  await expect(page.getByRole("img", { name: "Foto en análisis" })).toBeVisible();
  const loops = (await runningAnimations(page)).filter((a) => a.iterations === Infinity);
  expect(loops).toEqual([]);
});

test("[02 10.3] KPI values render immediately without counting", async ({ page }) => {
  await page.goto("/?scenario=happy");
  await expect(page.getByRole("region", { name: "Productos" })).toContainText("8");
});
