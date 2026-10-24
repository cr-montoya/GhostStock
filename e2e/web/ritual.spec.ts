import { expect, test } from "@playwright/test";
import { countRequests, openRitual, photoBuffer, pickPhoto } from "./helpers";

test("[02 3.1] the ritual offers file picking, and a camera button only on phones", async ({ page, isMobile }) => {
  await openRitual(page);
  await expect(page.getByRole("button", { name: "Elegir foto" })).toBeVisible();
  const camera = page.getByRole("button", { name: "Tomar foto" });
  if (isMobile) {
    await expect(camera).toBeVisible();
    await expect(page.getByLabel("Cámara")).toHaveAttribute("capture", "environment");
  } else {
    await expect(camera).toBeHidden();
  }
});

test("[02 3.1] dropping a photo on the circle shows the preview", async ({ page }) => {
  await openRitual(page);
  const data = photoBuffer().toString("base64");
  const dataTransfer = await page.evaluateHandle(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], "pantry.jpg", { type: "image/jpeg" }));
    return transfer;
  }, data);
  // Events bubble from the button to the circle, whose title changes while dragging.
  const zone = page.getByRole("button", { name: "Elegir foto" });
  await zone.dispatchEvent("dragenter", { dataTransfer });
  await zone.dispatchEvent("drop", { dataTransfer });
  await expect(page.getByRole("img", { name: "Foto elegida para invocar" })).toBeVisible();
});

test("[02 3.2] a non-image file shows an inline error and uploads nothing", async ({ page }) => {
  const uploads = countRequests(page, "POST", "/api/uploads");
  await openRitual(page);
  await page
    .getByLabel("Archivo de foto")
    .setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
  await expect(page.getByRole("alert")).toHaveText("Ese archivo no es una foto válida. Usa JPG, PNG o WebP.");
  await expect(page.getByRole("img", { name: "Foto elegida para invocar" })).toHaveCount(0);
  expect(uploads.count).toBe(0);
});

test("[02 3.2] an original over 25 MB shows the size error and uploads nothing", async ({ page }) => {
  const uploads = countRequests(page, "POST", "/api/uploads");
  await openRitual(page);
  await page.getByLabel("Archivo de foto").setInputFiles({
    name: "enorme.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert")).toHaveText("La foto pesa más de 25 MB. Elige una más liviana.");
  expect(uploads.count).toBe(0);
});

test("[02 3.3] a large PNG is downscaled and re-encoded as JPEG before upload", async ({ page }) => {
  await openRitual(page);
  const png = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 3200;
    canvas.height = 2000;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 3200, 2000);
    gradient.addColorStop(0, "rgb(120, 80, 40)");
    gradient.addColorStop(1, "rgb(30, 60, 160)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 3200, 2000);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
  const uploadRequest = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/uploads"));
  await page
    .getByLabel("Archivo de foto")
    .setInputFiles({ name: "grande.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  const preview = page.getByRole("img", { name: "Foto elegida para invocar" });
  await expect(preview).toBeVisible();
  const natural = await preview.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight }));
  expect(natural).toEqual({ w: 1568, h: 980 });
  await page.getByRole("button", { name: "Invocar inventario" }).click();
  const body = (await uploadRequest).postDataJSON() as { contentType: string; sizeBytes: number };
  expect(body.contentType).toBe("image/jpeg");
  expect(body.sizeBytes).toBeLessThanOrEqual(3_750_000);
});

test("[02 3.3] choosing another photo returns to the ritual", async ({ page }) => {
  await openRitual(page);
  await pickPhoto(page);
  await page.getByRole("button", { name: "Elegir otra foto" }).click();
  await expect(page.getByRole("button", { name: "Elegir foto" })).toBeFocused();
});
