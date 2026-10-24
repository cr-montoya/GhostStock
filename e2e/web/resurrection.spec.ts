import { expect, test } from "@playwright/test";
import { countRequests, openRitual, pickPhoto } from "./helpers";

test("[02 4.1] [02 4.2] confirming uploads, posts to S3, analyzes and announces the status", async ({ page }) => {
  const uploads = countRequests(page, "POST", "/api/uploads");
  const analyses = countRequests(page, "POST", "/api/analyses");
  const s3 = { count: 0 };
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).hostname.endsWith(".amazonaws.com")) s3.count += 1;
  });
  await openRitual(page);
  await pickPhoto(page);
  await page.getByRole("button", { name: "Invocar inventario" }).click();

  const status = page.getByRole("status").filter({ hasText: /Invocando|Identificando|Leyendo|Despertando|Preparando/ });
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(page.getByRole("img", { name: "Foto en análisis" })).toBeVisible();
  // The copy rotates every 1.8 s while the 2.5 s mock analysis runs.
  await expect(status).toContainText("Identificando productos...", { timeout: 4_000 });

  await expect(page.getByRole("heading", { name: "Los productos han vuelto a la vida." })).toBeVisible({
    timeout: 10_000,
  });
  expect([uploads.count, s3.count, analyses.count]).toEqual([1, 1, 1]);
});

const FAILURES = [
  ["model-error", "La IA respondió algo que no pudimos entender. Reintenta el análisis."],
  ["throttled", "El servidor no respondió como esperábamos. Intenta de nuevo."],
  ["network-error", "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo."],
] as const;

for (const [scenario, message] of FAILURES) {
  test(`[02 4.3] ${scenario} keeps the photo and offers retry and another photo`, async ({ page }) => {
    await openRitual(page, scenario);
    await pickPhoto(page);
    await page.getByRole("button", { name: "Invocar inventario" }).click();
    await expect(page.getByRole("alert")).toContainText(message, { timeout: 10_000 });
    await expect(page.getByRole("img", { name: "Foto elegida para invocar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await page.getByRole("button", { name: "Elegir otra foto" }).click();
    await expect(page.getByRole("button", { name: "Elegir foto" })).toBeFocused();
  });
}

test("[02 4.3] retry after a model error analyzes again without re-uploading", async ({ page }) => {
  const uploads = countRequests(page, "POST", "/api/uploads");
  const analyses = countRequests(page, "POST", "/api/analyses");
  await openRitual(page, "model-error");
  await pickPhoto(page);
  await page.getByRole("button", { name: "Invocar inventario" }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("img", { name: "Foto en análisis" })).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  expect(uploads.count).toBe(1);
  expect(analyses.count).toBe(2);
});

test("[02 4.4] zero candidates shows the zero-detections state, never an error", async ({ page }) => {
  await openRitual(page, "zero-candidates");
  await pickPhoto(page);
  await page.getByRole("button", { name: "Invocar inventario" }).click();
  await expect(
    page.getByText("No logramos ver productos en esta foto. Prueba con más luz o más cerca."),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Elegir otra foto" })).toBeVisible();
});
