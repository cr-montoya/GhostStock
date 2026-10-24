import { describe, expect, it } from "vitest";
import * as contracts from "../src/index.js";

const {
  AnalysisSchema,
  ApiErrorSchema,
  CreateAnalysisRequestSchema,
  CreateProductsRequestSchema,
  CreateProductsResponseSchema,
  CreateUploadRequestSchema,
  CreateUploadResponseSchema,
  ERROR_CODES,
  ListProductsResponseSchema,
  ReviewedProductSchema,
  SettingsSchema,
  UpdateProductRequestSchema,
} = contracts;

describe("[00 9] fixtures", () => {
  it.each([
    ["uploadRequestFixture", CreateUploadRequestSchema, contracts.uploadRequestFixture],
    ["uploadResponseFixture", CreateUploadResponseSchema, contracts.uploadResponseFixture],
    ["analysisRequestFixture", CreateAnalysisRequestSchema, contracts.analysisRequestFixture],
    ["analysisFixture", AnalysisSchema, contracts.analysisFixture],
    ["emptyAnalysisFixture", AnalysisSchema, contracts.emptyAnalysisFixture],
    ["createProductsRequestFixture", CreateProductsRequestSchema, contracts.createProductsRequestFixture],
    ["createProductsResponseFixture", CreateProductsResponseSchema, contracts.createProductsResponseFixture],
    ["listProductsResponseFixture", ListProductsResponseSchema, contracts.listProductsResponseFixture],
    ["updateProductRequestFixture", UpdateProductRequestSchema, contracts.updateProductRequestFixture],
    ["settingsFixture", SettingsSchema, contracts.settingsFixture],
  ] as const)("[00 9.2] %s parses", (_name, schema, fixture) => {
    const result = schema.safeParse(fixture);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("[00 9.2] reviewed products parse", () => {
    for (const product of contracts.reviewedProductsFixture) {
      expect(ReviewedProductSchema.safeParse(product).success).toBe(true);
    }
  });

  it("[00 9.1] has one valid error fixture per code", () => {
    for (const code of ERROR_CODES) {
      const fixture = contracts.apiErrorFixtures[code];
      expect(ApiErrorSchema.parse(fixture).error.code).toBe(code);
    }
  });

  it("[00 9.1] covers the required inventory shape", () => {
    const { productsFixture, analysisFixture, emptyAnalysisFixture } = contracts;
    expect(productsFixture.length).toBeGreaterThanOrEqual(8);
    expect(new Set(productsFixture.map((p) => p.category)).size).toBeGreaterThanOrEqual(5);
    expect(productsFixture.filter((p) => p.quantity <= 5).length).toBeGreaterThanOrEqual(2);
    expect(productsFixture.some((p) => p.mediaKey === null)).toBe(true);
    expect(analysisFixture.candidates.map((c) => c.confidence)).toEqual(["high", "medium", "low"]);
    expect(emptyAnalysisFixture.candidates).toHaveLength(0);
  });
});
