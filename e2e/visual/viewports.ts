import { devices, expect, type Page } from "@playwright/test";

const { defaultBrowserType: _browser, ...pixel7 } = devices["Pixel 7"];

/** The two viewports every visual baseline is captured at. */
export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: pixel7,
} as const;

/**
 * Full-page captures stitch tiles and leave bands across the fixed glow, fog and
 * grain. Grow the viewport to the document height instead, then capture the viewport.
 */
export async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const width = page.viewportSize()?.width ?? 1440;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height });
  await expect(page).toHaveScreenshot(name);
}
