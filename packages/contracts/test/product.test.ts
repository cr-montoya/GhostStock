import { describe, expect, it } from "vitest";
import {
  CreateProductsRequestSchema,
  MAX_QUANTITY,
  MAX_UNIT_PRICE_COP,
  ProductFieldsSchema,
  ProductSchema,
  ReviewedProductSchema,
  UpdateProductRequestSchema,
} from "../src/schemas/product.js";
import { SettingsSchema } from "../src/schemas/settings.js";
import {
  classifyUploadRequestError,
  CreateUploadRequestSchema,
  CreateUploadResponseSchema,
} from "../src/schemas/upload.js";
import { MAX_UPLOAD_BYTES } from "../src/schemas/common.js";

const fields = {
  name: "Arroz blanco 1 kg",
  category: "alimentos",
  quantity: 12,
  unitPriceCop: 4500,
};

describe("[00 2] upload contracts", () => {
  it("[00 2.1] accepts an allowed type within the size limit", () => {
    expect(CreateUploadRequestSchema.safeParse({ contentType: "image/webp", sizeBytes: MAX_UPLOAD_BYTES }).success).toBe(true);
  });

  it("[00 2.3] classifies oversize as IMAGE_TOO_LARGE", () => {
    const result = CreateUploadRequestSchema.safeParse({ contentType: "image/jpeg", sizeBytes: MAX_UPLOAD_BYTES + 1 });
    expect(result.success).toBe(false);
    if (!result.success) expect(classifyUploadRequestError(result.error)).toBe("IMAGE_TOO_LARGE");
  });

  it("[00 2.3] classifies a bad type as UNSUPPORTED_MEDIA_TYPE", () => {
    const result = CreateUploadRequestSchema.safeParse({ contentType: "image/gif", sizeBytes: 100 });
    if (!result.success) expect(classifyUploadRequestError(result.error)).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(result.success).toBe(false);
  });

  it("[00 2.3] classifies anything else as VALIDATION_ERROR", () => {
    const result = CreateUploadRequestSchema.safeParse({ contentType: "image/png", sizeBytes: 0 });
    if (!result.success) expect(classifyUploadRequestError(result.error)).toBe("VALIDATION_ERROR");
    expect(result.success).toBe(false);
  });
});

describe("[00 2.2] upload response", () => {
  const response = {
    url: "https://bucket.s3.us-east-1.amazonaws.com/",
    fields: { key: "tmp/01JAZ3K9V2Q8W6X4Y7T5R1M0NP.jpg" },
    imageKey: "tmp/01JAZ3K9V2Q8W6X4Y7T5R1M0NP.jpg",
    expiresAt: "2026-10-24T15:05:00.000Z",
  };

  it("accepts a presigned POST response", () => {
    expect(CreateUploadResponseSchema.safeParse(response).success).toBe(true);
  });

  it.each([
    { expiresAt: "mañana" },
    { fields: { key: 1 } },
    { url: "javascript:alert(1)" },
  ])("rejects %o", (override) => {
    expect(CreateUploadResponseSchema.safeParse({ ...response, ...override }).success).toBe(false);
  });
});

describe("[00 4.2] reviewed product", () => {
  it("accepts read-only AI provenance", () => {
    const parsed = ReviewedProductSchema.parse({ ...fields, aiConfidence: "low", aiNotes: "  etiqueta borrosa  " });
    expect(parsed.aiNotes).toBe("etiqueta borrosa");
  });

  it("rejects unknown keys", () => {
    expect(ReviewedProductSchema.safeParse({ ...fields, barcode: "7700000000000" }).success).toBe(false);
  });

  it("keeps the inventory value exact at the bounds", () => {
    expect(1_000 * MAX_QUANTITY * MAX_UNIT_PRICE_COP).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });
});

describe("[00 4] product contracts", () => {
  it("[00 4.1] defaults description on create", () => {
    expect(ProductFieldsSchema.parse(fields).description).toBe("");
  });

  it.each([
    { quantity: -1 },
    { quantity: 1.5 },
    { unitPriceCop: -10 },
    { unitPriceCop: 99.9 },
    { sku: "con espacio" },
    { name: "" },
  ])("[00 4.1] rejects %o", (override) => {
    expect(ProductFieldsSchema.safeParse({ ...fields, ...override }).success).toBe(false);
  });

  it("[00 4.3] a product has id, mediaKey and timestamps", () => {
    const parsed = ProductSchema.safeParse({
      ...fields,
      description: "",
      id: "01JAZ3K9V2Q8W6X4Y7T5R1M0NP",
      mediaKey: null,
      createdAt: "2026-10-24T15:00:00.000Z",
      updatedAt: "2026-10-24T15:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("[00 4.4] create needs 1 to 10 products", () => {
    const imageKey = "tmp/01JAZ3K9V2Q8W6X4Y7T5R1M0NP.jpg";
    expect(CreateProductsRequestSchema.safeParse({ imageKey, products: [] }).success).toBe(false);
    expect(CreateProductsRequestSchema.safeParse({ imageKey, products: [fields] }).success).toBe(true);
  });

  it("[00 4.5] rejects an empty update", () => {
    expect(UpdateProductRequestSchema.safeParse({}).success).toBe(false);
  });

  it("[00 4.4] a partial update does not add a default description", () => {
    const parsed = UpdateProductRequestSchema.parse({ quantity: 1 });
    expect(parsed).toEqual({ quantity: 1 });
    expect("description" in parsed).toBe(false);
  });
});

describe("[00 5] settings", () => {
  it("[00 5.1] bounds the threshold", () => {
    expect(SettingsSchema.safeParse({ lowStockThreshold: 5 }).success).toBe(true);
    expect(SettingsSchema.safeParse({ lowStockThreshold: -1 }).success).toBe(false);
  });
});
