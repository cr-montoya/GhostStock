import { AnalysisSchema } from "@ghoststock/contracts";
import { expect } from "@playwright/test";
import { expectApiError, setupApiSpec, test, uploadBytes, uploadFixture } from "./helpers.js";

setupApiSpec();

// Uploaded photos live under tmp/ and are deleted by the 1 day lifecycle rule; these
// tests create nothing else.

test("[01-api 2.1, 2.4] analyzes the pantry photo into product candidates", { tag: "@bedrock" }, async ({ api, request }) => {
  test.setTimeout(60_000);
  const imageKey = await uploadFixture(api, request, "pantry.jpg");
  const response = await api.post("/api/analyses", { data: { imageKey }, timeout: 35_000 });
  expect(response.status()).toBe(200);
  const raw = (await response.json()) as { candidates?: Record<string, unknown>[] };
  // ADR 0007: the model never supplies price, quantity or SKU (checked on the raw body).
  for (const candidate of raw.candidates ?? []) {
    expect(candidate).not.toHaveProperty("unitPriceCop");
    expect(candidate).not.toHaveProperty("quantity");
    expect(candidate).not.toHaveProperty("sku");
  }
  const analysis = AnalysisSchema.parse(raw);
  expect(analysis.imageKey).toBe(imageKey);
  expect(analysis.modelId.length).toBeGreaterThan(0);
  expect(analysis.candidates.length).toBeGreaterThan(0);
});

test("[01-api 3.1] answers 200 with zero candidates for a photo without products", { tag: "@bedrock" }, async ({ api, request }) => {
  test.setTimeout(60_000);
  const imageKey = await uploadFixture(api, request, "no-products.jpg");
  const response = await api.post("/api/analyses", { data: { imageKey }, timeout: 35_000 });
  expect(response.status()).toBe(200);
  // The schema is the hard contract; zero detections is the expected model outcome and
  // is reported as a soft failure (still fails the run) if the model sees something.
  const analysis = AnalysisSchema.parse(await response.json());
  expect.soft(analysis.candidates).toEqual([]);
});

test("[01-api 3.4] answers 415 for bytes the model cannot read as an image", { tag: "@bedrock" }, async ({ api, request }) => {
  test.setTimeout(60_000);
  const imageKey = await uploadBytes(api, request, Buffer.from("this is not a jpeg ".repeat(50)));
  const response = await api.post("/api/analyses", { data: { imageKey }, timeout: 35_000 });
  await expectApiError(response, 415, "UNSUPPORTED_MEDIA_TYPE");
});

test("[01-api 2.2] answers 404 IMAGE_NOT_FOUND for a key that was never uploaded", async ({ api }) => {
  const response = await api.post("/api/analyses", { data: { imageKey: "tmp/01JB5X7Q8M0000000000000999.jpg" } });
  await expectApiError(response, 404, "IMAGE_NOT_FOUND");
});

test("[01-api 7.1] rejects foreign or malformed keys with 400", async ({ api }) => {
  for (const imageKey of ["media/products/01JB5X7Q8M0000000000000999.jpg", "tmp/../x.jpg", "tmp/abc.gif"]) {
    await expectApiError(await api.post("/api/analyses", { data: { imageKey } }), 400, "VALIDATION_ERROR");
  }
});
