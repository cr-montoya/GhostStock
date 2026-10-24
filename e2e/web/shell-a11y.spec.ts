import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ready = async (page: import("@playwright/test").Page, path = "/") => {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
};

test("[02 2.1] skip link is the first Tab stop and moves focus to main", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard path is a desktop concern");
  await ready(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: /saltar/i });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenido")).toBeFocused();
});

test("[02 2.1] keyboard Tab reaches every nav link with a visible focus ring", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard path is a desktop concern");
  await ready(page);
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return {
        text: el.textContent?.trim() ?? "",
        inNav: !!el.closest("nav"),
        ring: cs.outlineStyle !== "none" && cs.outlineWidth !== "0px" ? "outline" : cs.boxShadow !== "none" ? "shadow" : "none",
      };
    });
    if (info.inNav) {
      expect(info.ring, `focus ring on ${info.text}`).not.toBe("none");
      seen.push(info.text);
    }
  }
  expect(seen).toEqual(expect.arrayContaining(["Almacén", "Invocar", "Inventario", "Ajustes"]));
  await expect(nav).toBeVisible();
});

test("[02 2.2] palette keyboard flow: arrows + Enter open a product, Escape returns focus", async ({ page, isMobile }) => {
  test.skip(isMobile, "hardware keyboard flow");
  await ready(page);
  const trigger = page.getByRole("button", { name: /paleta|buscar|comando/i }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const palette = page.getByRole("dialog", { name: "Paleta de comandos" });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Control+k");
  await palette.getByRole("combobox").fill("BEB-COL");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(palette.getByRole("option", { selected: true })).toContainText("Gaseosa de cola");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/inventario\?producto=/);
  await expect(palette).toBeHidden();
});

test("[02 2.2] palette shows the Spanish empty state for no match", async ({ page }) => {
  await ready(page);
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Paleta de comandos" });
  await palette.getByRole("combobox").fill("zzzqqq");
  await expect(palette.getByRole("option")).toHaveCount(0);
  await expect(palette).not.toContainText(/no results/i);
});

test("[02 2.2] palette still navigates screens when the products API fails", async ({ page }) => {
  await ready(page, "/?scenario=network-error");
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Paleta de comandos" });
  await palette.getByRole("combobox").fill("invent");
  await palette.getByRole("option", { name: "Inventario" }).click();
  await expect(page).toHaveURL("/inventario");
});

for (const path of ["/", "/inventario", "/no-existe"]) {
  test(`[02 11.3] axe: no serious/critical violations on ${path}`, async ({ page }) => {
    await ready(page, path);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}

test("[02 11.3] axe: palette open has no serious/critical violations", async ({ page }) => {
  await ready(page);
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog", { name: "Paleta de comandos" }).getByRole("combobox").fill("caf");
  await page.waitForTimeout(300);
  const { violations } = await new AxeBuilder({ page }).include("[role=dialog]").analyze();
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("[02 11.3] page transition is opacity only and <=150ms", async ({ page }) => {
    // Warm the route chunk so the measurement is the animation, not the lazy import.
    await ready(page, "/ajustes");
    await ready(page);
    const samples = await page.evaluate(async () => {
      const out: { t: number; transform: string; opacity: string }[] = [];
      const start = performance.now();
      const link = [...document.querySelectorAll<HTMLElement>('a[href="/ajustes"]')].find((a) => a.offsetParent);
      link?.click();
      while (performance.now() - start < 900) {
        const wrap = document.querySelector("main > div") as HTMLElement | null;
        if (wrap) {
          const cs = getComputedStyle(wrap);
          out.push({ t: performance.now() - start, transform: cs.transform, opacity: cs.opacity });
        }
        await new Promise(requestAnimationFrame);
      }
      return out;
    });
    expect(samples.filter((s) => s.transform !== "none" && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(s.transform))).toEqual([]);
    // exit (<=150) + enter (<=150): the whole fade window spans at most ~2 x 150ms plus frame slack.
    const fading = samples.filter((s) => s.opacity !== "1");
    expect(fading.length).toBeGreaterThan(0);
    expect(fading.at(-1)!.t - fading[0]!.t).toBeLessThanOrEqual(360);
  });
});

test("[02 2.1] tab bar targets are at least 44px", async ({ page, isMobile }) => {
  test.skip(!isMobile, "tab bar is phone only");
  await ready(page);
  const links = page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link");
  await expect(links).toHaveCount(4);
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  const search = page.getByRole("button", { name: /paleta|buscar|comando/i }).first();
  const sb = await search.boundingBox();
  expect(sb!.height).toBeGreaterThanOrEqual(44);
});

test("[02 2.1] breakpoint: 767px shows tab bar, 768px shows sidebar", async ({ page, isMobile }) => {
  test.skip(isMobile, "viewport resize test");
  for (const [w, sidebar] of [[767, false], [768, true]] as const) {
    await page.setViewportSize({ width: w, height: 800 });
    await ready(page);
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav).toHaveCount(1);
    const box = (await nav.boundingBox())!;
    if (sidebar) expect(box.x).toBeLessThan(40);
    else expect(box.y + box.height).toBeGreaterThan(798);
  }
});
