import { z } from "zod";
import { Category, Confidence, ImageKeySchema, Ulid } from "./common.js";

/**
 * What the model may report for one product. Strict on purpose: there is no field for
 * price, quantity, SKU or barcode, so the model cannot supply them (ADR 0007).
 */
export const ModelProductSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  category: Category,
  description: z.string().trim().max(500),
  brand: z.string().trim().min(1).max(80).optional(),
  confidence: Confidence,
  notes: z.string().trim().max(300).optional(),
});

export const ModelOutputSchema = z.strictObject({
  products: z.array(ModelProductSchema).max(10),
});

const { $schema: _schemaUri, ...modelOutputJson } = z.toJSONSchema(ModelOutputSchema);

/** Tool input schema for Bedrock `report_products`, generated from `ModelOutputSchema`. */
export const ModelOutputJsonSchema: Record<string, unknown> = modelOutputJson;

export const ProductCandidateSchema = ModelProductSchema.extend({ candidateId: Ulid });

export const CreateAnalysisRequestSchema = z.strictObject({ imageKey: ImageKeySchema });

export const AnalysisSchema = z.object({
  analysisId: Ulid,
  imageKey: ImageKeySchema,
  candidates: z.array(ProductCandidateSchema).max(10),
  modelId: z.string().min(1),
  latencyMs: z.number().int().nonnegative(),
});
