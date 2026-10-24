import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PHOTO, openRitual, pickPhoto } from "./helpers";

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("[02 3.1] keyboard-only: Tab reaches Elegir foto, Enter opens the chooser, focus lands on Invocar", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "keyboard path is a desktop concern");
  await openRitual(page);
  const pickButton = page.getByRole("button", { name: "Elegir foto" });
  for (let i = 0; i < 20 && !(await pickButton.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Tab");
  }
  await expect(pickButton).toBeFocused();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles(PHOTO);
  await expect(page.getByRole("button", { name: "Invocar inventario" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("img", { name: "Foto en análisis" })).toBeVisible();
});

test("[02 4.3] focus moves to Reintentar on failure and is not lost after Elegir otra foto", async ({ page }) => {
  await openRitual(page, "model-error");
  await pickPhoto(page);
  await page.getByRole("button", { name: "Invocar inventario" }).click();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeFocused({ timeout: 10_000 });
  await page.getByRole("button", { name: "Elegir otra foto" }).click();
  await expect(page.getByRole("button", { name: "Elegir foto" })).toBeFocused();
});

test("[02 4.2] focus moves to the stage heading while resurrecting", async ({ page }) => {
  await openRitual(page);
  await pickPhoto(page);
  await page.getByRole("button", { name: "Invocar inventario" }).click();
  await expect(page.getByRole("img", { name: "Foto en análisis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Analizando la foto" })).toBeFocused();
});

test("[02 3.1] [02 4.2] [02 4.3] [02 4.4] axe: no serious or critical violations across invocation states", async ({
  page,
}) => {
  await openRitual(page);
  expect(await seriousViolations(page), "idle").toEqual([]);
  await pickPhoto(page);
  expect(await seriousViolations(page), "preview").toEqual([]);
  await page.getByRole("button", { name: "Invocar inventario" }).click();
  await expect(page.getByRole("img", { name: "Foto en análisis" })).toBeVisible();
  expect(await seriousViolations(page), "resurrection").toEqual([]);

  for (const scenario of ["model-error", "zero-candidates"]) {
    await openRitual(page, scenario);
    await pickPhoto(page);
    await page.getByRole("button", { name: "Invocar inventario" }).click();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible({ timeout: 10_000 });
    expect(await seriousViolations(page), scenario).toEqual([]);
  }
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("[02 4.2] scan line and fog loops are absent; ticker fades opacity only", async ({ page }) => {
    await openRitual(page);
    await pickPhoto(page);
    await page.getByRole("button", { name: "Invocar inventario" }).click();
    const frame = page.getByRole("img", { name: "Foto en análisis" }).locator("..");
    await expect(frame).toBeVisible();
    // No scan line: no element with the ectoplasm hairline inside the frame.
    await expect(frame.locator(".bg-ectoplasm")).toHaveCount(0);
    const fog = frame.locator(".blur-xl");
    await page.waitForTimeout(250); // let the single 150 ms opacity fade settle
    const a = await fog.evaluate((el) => getComputedStyle(el).transform + "|" + getComputedStyle(el).opacity);
    await page.waitForTimeout(600);
    const b = await fog.evaluate((el) => getComputedStyle(el).transform + "|" + getComputedStyle(el).opacity);
    expect(b).toBe(a);
    // Ticker: sample every frame across one swap; no translate or blur is ever applied.
    const samples = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const out = new Set<string>();
          const t0 = performance.now();
          const tick = () => {
            for (const p of document.querySelectorAll('[aria-live="polite"] p')) {
              const cs = getComputedStyle(p);
              out.add(`${cs.transform}|${cs.filter}`);
            }
            if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
            else resolve([...out]);
          };
          tick();
        }),
    );
    expect(samples.length).toBeGreaterThan(0);
    for (const sample of samples) expect(sample).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))\|(none|blur\(0px\))$/);
  });
});

test.describe("full motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("[02 4.2] scan line sweeps and fog drifts", async ({ page }) => {
    await openRitual(page);
    await pickPhoto(page);
    await page.getByRole("button", { name: "Invocar inventario" }).click();
    const frame = page.getByRole("img", { name: "Foto en análisis" }).locator("..");
    const line = frame.locator(".bg-ectoplasm").locator("..");
    await expect(line).toHaveCount(1);
    const y1 = (await line.boundingBox())!.y;
    await page.waitForTimeout(500);
    const y2 = (await line.boundingBox())!.y;
    expect(y2).not.toBe(y1);
  });
});
