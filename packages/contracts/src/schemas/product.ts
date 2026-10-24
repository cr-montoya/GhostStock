import { z } from "zod";
import { Category, Confidence, ImageKeySchema, IsoDateTime, MediaKeySchema, Ulid } from "./common.js";

// Bounds keep 1 000 products x quantity x price under Number.MAX_SAFE_INTEGER, so
// inventory value stays exact in plain number math.
export const MAX_QUANTITY = 100_000;
export const MAX_UNIT_PRICE_COP = 50_000_000;

// No defaults here: zod 4 applies .default() even inside .partial(), which would reset
// description on every update. Defaults live only on the create path.
const ProductFieldsBase = z.strictObject({
  name: z.string().trim().min(1).max(120),
  category: Category,
  description: z.string().trim().max(500),
  brand: z.string().trim().min(1).max(80).optional(),
  sku: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,64}$/)
    .optional(),
  quantity: z.number().int().min(0).max(MAX_QUANTITY),
  unitPriceCop: z.number().int().min(0).max(MAX_UNIT_PRICE_COP),
});

/** Fields the user owns. Quantity, unit price and SKU never come from the model. */
export const ProductFieldsSchema = ProductFieldsBase.extend({
  description: ProductFieldsBase.shape.description.default(""),
});

export const ReviewedProductSchema = ProductFieldsSchema.extend({
  aiConfidence: Confidence.optional(),
  aiNotes: z.string().trim().max(300).optional(),
});

export const ProductSchema = ReviewedProductSchema.extend({
  id: Ulid,
  mediaKey: MediaKeySchema.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const CreateProductsRequestSchema = z.strictObject({
  imageKey: ImageKeySchema,
  products: z.array(ReviewedProductSchema).min(1).max(10),
});

export const CreateProductsResponseSchema = z.object({
  products: z.array(ProductSchema),
});

export const ListProductsResponseSchema = z.object({
  products: z.array(ProductSchema),
  count: z.number().int().nonnegative(),
});

export const UpdateProductRequestSchema = ProductFieldsBase.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "empty update" },
);

export const ProductResponseSchema = ProductSchema;
