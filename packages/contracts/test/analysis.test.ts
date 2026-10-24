import { describe, expect, it } from "vitest";
import {
  AnalysisSchema,
  CreateAnalysisRequestSchema,
  ModelOutputJsonSchema,
  ModelOutputSchema,
  ProductCandidateSchema,
} from "../src/schemas/analysis.js";

const product = {
  name: "Gaseosa de cola 400 ml",
  category: "bebidas",
  description: "Botella plástica de gaseosa sabor cola",
  confidence: "high",
};

describe("[00 1] model output", () => {
  it("[00 1.1] accepts an empty product list", () => {
    expect(ModelOutputSchema.safeParse({ products: [] }).success).toBe(true);
  });

  it("[00 1.1] caps the list at 10 products", () => {
    const products = Array.from({ length: 11 }, () => product);
    expect(ModelOutputSchema.safeParse({ products }).success).toBe(false);
  });

  it("[00 1.2] accepts optional brand and notes", () => {
    const parsed = ModelOutputSchema.safeParse({
      products: [{ ...product, brand: "Marca visible", notes: "etiqueta parcialmente visible" }],
    });
    expect(parsed.success).toBe(true);
  });

  it.each(["price", "quantity", "sku", "barcode", "unitPriceCop"])(
    "[00 1.3] rejects a model product carrying %s",
    (field) => {
      const parsed = ModelOutputSchema.safeParse({ products: [{ ...product, [field]: 1000 }] });
      expect(parsed.success).toBe(false);
    },
  );

  it("[00 1.4] exposes a JSON schema without $schema or numeric product fields", () => {
    expect(ModelOutputJsonSchema).not.toHaveProperty("$schema");
    const json = JSON.stringify(ModelOutputJsonSchema);
    for (const forbidden of ["price", "quantity", "sku", "barcode"]) {
      expect(json).not.toContain(`"${forbidden}"`);
    }
    expect(json).toContain('"additionalProperties":false');
    expect(json).toContain('"confidence"');
  });
});

describe("[00 3] analysis contracts", () => {
  it("[00 3.1] requires a raw upload key", () => {
    expect(CreateAnalysisRequestSchema.safeParse({ imageKey: "tmp/01JAZ3K9V2Q8W6X4Y7T5R1M0NP.jpg" }).success).toBe(true);
    expect(CreateAnalysisRequestSchema.safeParse({ imageKey: "media/products/01JAZ3K9V2Q8W6X4Y7T5R1M0NP.jpg" }).success).toBe(false);
  });

  it("[00 3.2] accepts an analysis with zero candidates", () => {
    const parsed = AnalysisSchema.safeParse({
      analysisId: "01JAZ3K9V2Q8W6X4Y7T5R1M0NP",
      imageKey: "tmp/01JAZ3K9V2Q8W6X4Y7T5R1M0NQ.jpg",
      candidates: [],
      modelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      latencyMs: 4200,
    });
    expect(parsed.success).toBe(true);
  });

  it("[00 3.3] a candidate is a model product plus candidateId", () => {
    expect(ProductCandidateSchema.safeParse({ ...product, candidateId: "01JAZ3K9V2Q8W6X4Y7T5R1M0NP" }).success).toBe(true);
    expect(ProductCandidateSchema.safeParse(product).success).toBe(false);
  });
});
