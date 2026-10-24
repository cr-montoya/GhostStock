import { MAX_UPLOAD_BYTES } from "@ghoststock/contracts";
import { expect, test } from "@playwright/test";
import { createUpload, expectApiError, fixtureImage, postToS3, requireDeployedStack } from "./helpers.js";

requireDeployedStack();

test("[01-api 1.1] issues a presigned POST for a tmp key", async ({ request }) => {
  const slot = await createUpload(request, "image/png", 1234);
  expect(slot.imageKey).toMatch(/^tmp\/[0-9A-HJKMNP-TV-Z]{26}\.png$/);
  expect(slot.fields.key).toBe(slot.imageKey);
  expect(slot.fields["Content-Type"]).toBe("image/png");
  const expiresIn = Date.parse(slot.expiresAt) - Date.now();
  expect(expiresIn).toBeGreaterThan(240_000);
  expect(expiresIn).toBeLessThanOrEqual(305_000);
});

test("[01-api 1.1] S3 accepts the fixture photo through the presigned POST", async ({ request }) => {
  const file = fixtureImage("pantry.jpg");
  const slot = await createUpload(request, "image/jpeg", file.byteLength);
  const response = await postToS3(request, slot, file, "image/jpeg");
  expect(response.status()).toBe(204);
});

test("[01-api 1.1] S3 rejects a content type other than the signed one", async ({ request }) => {
  const file = fixtureImage("pantry.jpg");
  const slot = await createUpload(request, "image/jpeg", file.byteLength);
  const tampered = { ...slot, fields: { ...slot.fields, "Content-Type": "text/html" } };
  const response = await postToS3(request, tampered, file, "text/html");
  expect(response.status()).toBe(403);
});

test("[01-api 1.2] rejects a disallowed content type with 415", async ({ request }) => {
  const response = await request.post("/api/uploads", { data: { contentType: "image/gif", sizeBytes: 10 } });
  await expectApiError(response, 415, "UNSUPPORTED_MEDIA_TYPE");
});

test("[01-api 1.3] rejects an image over 3 750 000 bytes with 413", async ({ request }) => {
  const response = await request.post("/api/uploads", { data: { contentType: "image/jpeg", sizeBytes: MAX_UPLOAD_BYTES + 1 } });
  await expectApiError(response, 413, "IMAGE_TOO_LARGE");
});

test("[01-api 7.1, 7.2] rejects invalid bodies with 400", async ({ request }) => {
  await expectApiError(await request.post("/api/uploads", { data: { contentType: "image/png" } }), 400, "VALIDATION_ERROR");
  const notJson = await request.post("/api/uploads", { data: "not json", headers: { "content-type": "application/json" } });
  await expectApiError(notJson, 400, "VALIDATION_ERROR");
});
