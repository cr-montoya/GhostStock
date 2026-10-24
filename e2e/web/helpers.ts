import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

export const PHOTO = fileURLToPath(new URL("../fixtures/images/pantry.jpg", import.meta.url));
export const EMPTY_PHOTO = fileURLToPath(new URL("../fixtures/images/no-products.jpg", import.meta.url));
export const photoBuffer = () => readFileSync(PHOTO);

/** Opens /invocar in a scenario and waits for the ritual. */
export async function openRitual(page: Page, scenario = "happy") {
  await page.goto(`/invocar?scenario=${scenario}`);
  await expect(page.getByRole("heading", { level: 1, name: "El ritual" })).toBeVisible();
}

/** Picks the fixture photo through the hidden file input. */
export async function pickPhoto(page: Page, path = PHOTO) {
  await page.getByLabel("Archivo de foto").setInputFiles(path);
  await expect(page.getByRole("img", { name: "Foto elegida para invocar" })).toBeVisible();
}

/** Picks, confirms and waits for the review heading. */
export async function summonCandidates(page: Page) {
  await pickPhoto(page);
  await page.getByRole("button", { name: "Invocar inventario" }).click();
  await expect(page.getByRole("heading", { name: "Los productos han vuelto a la vida." })).toBeVisible({ timeout: 15_000 });
}

/** Counts requests to an API path made by the page (MSW-served requests included). */
export function countRequests(page: Page, method: string, path: string) {
  const counter = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === method && new URL(request.url()).pathname === path) counter.count += 1;
  });
  return counter;
}
