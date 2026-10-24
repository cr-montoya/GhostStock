import { AnalysisSchema } from "@ghoststock/contracts";
import { expect, test } from "@playwright/test";
import { expectApiError, requireDeployedStack, uploadFixture } from "./helpers.js";

requireDeployedStack();

// Uploaded photos live under tmp/ and are deleted by the 1 day lifecycle rule; these
// tests create nothing else.

test("[01-api 2.1, 2.4] analyzes the pantry photo into product candidates", { tag: "@bedrock" }, async ({ request }) => {
  test.setTimeout(60_000);
  const imageKey = await uploadFixture(request, "pantry.jpg");
  const response = await request.post("/api/analyses", { data: { imageKey }, timeout: 35_000 });
  expect(response.status()).toBe(200);
  const analysis = AnalysisSchema.parse(await response.json());
  expect(analysis.imageKey).toBe(imageKey);
  expect(analysis.modelId.length).toBeGreaterThan(0);
  expect(analysis.candidates.length).toBeGreaterThan(0);
  for (const candidate of analysis.candidates) {
    // ADR 0007: the model never supplies price, quantity or SKU.
    expect(candidate).not.toHaveProperty("unitPriceCop");
    expect(candidate).not.toHaveProperty("quantity");
    expect(candidate).not.toHaveProperty("sku");
  }
});

test("[01-api 3.1] answers 200 with a valid analysis for a photo without products", { tag: "@bedrock" }, async ({ request }) => {
  test.setTimeout(60_000);
  const imageKey = await uploadFixture(request, "no-products.jpg");
  const response = await request.post("/api/analyses", { data: { imageKey }, timeout: 35_000 });
  expect(response.status()).toBe(200);
  // Zero detections is the expected outcome; the schema check is the hard contract.
  const analysis = AnalysisSchema.parse(await response.json());
  expect.soft(analysis.candidates).toEqual([]);
});

test("[01-api 2.2] answers 404 IMAGE_NOT_FOUND for a key that was never uploaded", async ({ request }) => {
  const response = await request.post("/api/analyses", { data: { imageKey: "tmp/01JB5X7Q8M0000000000000999.jpg" } });
  await expectApiError(response, 404, "IMAGE_NOT_FOUND");
});

test("[01-api 7.1] rejects foreign or malformed keys with 400", async ({ request }) => {
  for (const imageKey of ["media/products/01JB5X7Q8M0000000000000999.jpg", "tmp/../x.jpg", "tmp/abc.gif"]) {
    await expectApiError(await request.post("/api/analyses", { data: { imageKey } }), 400, "VALIDATION_ERROR");
  }
});
