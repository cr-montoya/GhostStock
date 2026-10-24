import type { z } from "zod";
import type {
  AnalysisSchema,
  CreateAnalysisRequestSchema,
  ModelOutputSchema,
  ModelProductSchema,
  ProductCandidateSchema,
} from "./schemas/analysis.js";
import type { InfraConfigSchema } from "./schemas/config.js";
import type { ApiErrorSchema } from "./schemas/errors.js";
import type {
  CreateProductsRequestSchema,
  CreateProductsResponseSchema,
  ListProductsResponseSchema,
  ProductFieldsSchema,
  ProductSchema,
  ReviewedProductSchema,
  UpdateProductRequestSchema,
} from "./schemas/product.js";
import type { SettingsSchema, UpdateSettingsRequestSchema } from "./schemas/settings.js";
import type { CreateUploadRequestSchema, CreateUploadResponseSchema } from "./schemas/upload.js";

export type ModelProduct = z.infer<typeof ModelProductSchema>;
export type ModelOutput = z.infer<typeof ModelOutputSchema>;
export type ProductCandidate = z.infer<typeof ProductCandidateSchema>;
export type CreateAnalysisRequest = z.infer<typeof CreateAnalysisRequestSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;

export type CreateUploadRequest = z.infer<typeof CreateUploadRequestSchema>;
export type CreateUploadResponse = z.infer<typeof CreateUploadResponseSchema>;

export type ProductFields = z.infer<typeof ProductFieldsSchema>;
export type ProductFieldsInput = z.input<typeof ProductFieldsSchema>;
export type ReviewedProduct = z.infer<typeof ReviewedProductSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type CreateProductsRequest = z.infer<typeof CreateProductsRequestSchema>;
export type CreateProductsResponse = z.infer<typeof CreateProductsResponseSchema>;
export type ListProductsResponse = z.infer<typeof ListProductsResponseSchema>;
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

export type Settings = z.infer<typeof SettingsSchema>;
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type InfraConfig = z.infer<typeof InfraConfigSchema>;
