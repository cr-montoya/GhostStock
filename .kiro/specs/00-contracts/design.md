# Design Document: 00-contracts

## Overview

A pure TypeScript ESM package, `@ghoststock/contracts`, with zod 4 schemas, inferred
types, fixtures and a few pure helpers. No I/O, no AWS SDK, no React. Related ADRs:
0005 (data model), 0007 (honest AI contract).

## Structure

```
packages/contracts/
  src/
    schemas/
      common.ts      Ulid, IsoDateTime, Category, CATEGORY_LABELS, ImageContentType,
                     ImageKeySchema, MediaKeySchema, Confidence
      upload.ts      CreateUploadRequestSchema, CreateUploadResponseSchema
      analysis.ts    ModelProductSchema, ModelOutputSchema, ModelOutputJsonSchema,
                     ProductCandidateSchema, CreateAnalysisRequestSchema, AnalysisSchema
      product.ts     ProductFieldsSchema, ReviewedProductSchema, ProductSchema,
                     CreateProductsRequest/ResponseSchema, ListProductsResponseSchema,
                     UpdateProductRequestSchema, ProductResponseSchema
      settings.ts    SettingsSchema, UpdateSettingsRequestSchema
      errors.ts      ERROR_CODES, ErrorCode, ERROR_HTTP_STATUS, ERROR_RETRYABLE,
                     ApiErrorSchema
      config.ts      InfraConfigSchema
    domain/
      stats.ts       computeInventoryStats, isLowStock
      csv.ts         productsToCsv
    fixtures/
      index.ts       every fixture, named <thing>Fixture
    types.ts         z.infer exports for every schema
    index.ts         barrel
  test/              *.test.ts (Vitest)
  package.json, tsconfig.json
```

## Schemas (normative excerpt)

```ts
// common.ts
export const CATEGORIES = [
  "alimentos", "bebidas", "aseo", "belleza", "hogar", "ferreteria",
  "electronica", "papeleria", "ropa", "juguetes", "mascotas", "otros",
] as const;
export const Category = z.enum(CATEGORIES);
export const CATEGORY_LABELS: Record<z.infer<typeof Category>, string> = {
  alimentos: "Alimentos", bebidas: "Bebidas", aseo: "Aseo", belleza: "Belleza",
  hogar: "Hogar", ferreteria: "Ferretería", electronica: "Electrónica",
  papeleria: "Papelería", ropa: "Ropa", juguetes: "Juguetes", mascotas: "Mascotas",
  otros: "Otros",
};
export const Ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
export const IsoDateTime = z.iso.datetime();
export const ImageContentType = z.enum(["image/jpeg", "image/png", "image/webp"]);
export const Confidence = z.enum(["high", "medium", "low"]);
export const ImageKeySchema = z.string().regex(/^tmp\/[0-9A-HJKMNP-TV-Z]{26}\.(jpg|png|webp)$/);
export const MediaKeySchema = z.string().regex(/^media\/products\/[0-9A-HJKMNP-TV-Z]{26}\.(jpg|png|webp)$/);
export const MAX_UPLOAD_BYTES = 3_750_000;

// analysis.ts
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
const { $schema, ...modelOutputJson } = z.toJSONSchema(ModelOutputSchema);
export const ModelOutputJsonSchema = modelOutputJson;
export const ProductCandidateSchema = ModelProductSchema.extend({ candidateId: Ulid });
export const CreateAnalysisRequestSchema = z.strictObject({ imageKey: ImageKeySchema });
export const AnalysisSchema = z.object({
  analysisId: Ulid,
  imageKey: ImageKeySchema,
  candidates: z.array(ProductCandidateSchema).max(10),
  modelId: z.string().min(1),
  latencyMs: z.number().int().nonnegative(),
});

// product.ts
// Base without defaults: zod 4 applies .default() even inside .partial(), which
// would silently reset description on every PUT. Defaults live on the create path.
const ProductFieldsBase = z.strictObject({
  name: z.string().trim().min(1).max(120),
  category: Category,
  description: z.string().trim().max(500),
  brand: z.string().trim().min(1).max(80).optional(),
  sku: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).optional(),
  quantity: z.number().int().min(0).max(MAX_QUANTITY), // 100_000
  unitPriceCop: z.number().int().min(0).max(MAX_UNIT_PRICE_COP), // 50_000_000,
});
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
export const UpdateProductRequestSchema = ProductFieldsBase.partial()
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });

// config.ts: empty strings from CodeBuild env become undefined before validation
const optionalText = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), s.optional());
export const InfraConfigSchema = z.object({
  region: z.string().min(1),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  branch: z.string().min(1),
  bedrockModelId: z.string().regex(/^us\.[a-z0-9.-]+:\d+$/),
  lowStockDefault: z.coerce.number().int().min(0),
  enableTests: z.coerce.boolean(),
  budgetUsd: z.coerce.number().positive(),
  connectionArn: optionalText(z.string().startsWith("arn:aws:codeconnections:")),
  budgetEmail: optionalText(z.email()),
});
```

Upload and settings schemas follow the requirements literally. `enableTests` must
treat the string `"false"` as false (custom preprocess, not plain `z.coerce.boolean`,
which turns any non-empty string into true).

## Error catalog

| Code | HTTP | Retryable | Raised when |
| --- | --- | --- | --- |
| `VALIDATION_ERROR` | 400 | no | body, path or query fails zod |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | no | content type not allowed |
| `IMAGE_TOO_LARGE` | 413 | no | declared or stored size over 3.75 MB |
| `IMAGE_NOT_FOUND` | 404 | no | `imageKey` missing or expired in S3 |
| `NOT_FOUND` | 404 | no | product id does not exist |
| `MODEL_UNAVAILABLE` | 503 | no | model access denied or not found |
| `MODEL_THROTTLED` | 503 | yes | Bedrock throttling after retries |
| `MODEL_INVALID_OUTPUT` | 502 | yes | no tool call or zod failure |
| `STORAGE_ERROR` | 500 | yes | DynamoDB or S3 failure |
| `INTERNAL_ERROR` | 500 | no | anything unexpected |

Messages in the API body are English and technical; the web maps codes to Spanish
copy. Zero candidates is **not** an error.

## Domain helpers

- `isLowStock(p, threshold) = p.quantity <= threshold`.
- `computeInventoryStats`: integer math only (COP has no decimals);
  `inventoryValueCop = sum(quantity * unitPriceCop)`.
- `productsToCsv`: BOM `﻿`, CRLF line endings, quote every text cell, double
  inner quotes, formula-injection guard, `valor_total_cop = quantity * unitPriceCop`,
  `categoria` uses `CATEGORY_LABELS`.

## Fixtures

`uploadRequestFixture`, `uploadResponseFixture`, `analysisRequestFixture`,
`analysisFixture` (3 candidates: high, medium, low confidence),
`emptyAnalysisFixture`, `reviewedProductsFixture`, `productsFixture` (8 products,
5 categories, 2 low stock, 1 without photo), `settingsFixture`,
`apiErrorFixtures` (one per code). Text in natural Colombian Spanish; no real brands
required, no personal data.

## Package configuration

- `name: @ghoststock/contracts`, `type: module`, `exports` with `types` and `import`
  pointing at `dist/`, `sideEffects: false`.
- Scripts: `build` (`tsc -p tsconfig.build.json`, src only), `test` (`vitest run`), `typecheck`.
- Dependencies: `zod` 4.x. Dev: `typescript`, `vitest`. Versions pinned exactly by
  the lockfile at scaffold time.
- `tsconfig`: `strict`, `target ES2022`, `module/moduleResolution NodeNext`,
  `declaration`, `outDir dist`, `rootDir src`.

## Testing

Vitest unit tests (this package has no UI or network, ADR 0009):
- every fixture parses; every error fixture code is in `ERROR_CODES`;
- `ModelOutputSchema` rejects `price`, `quantity`, `sku`, `barcode`;
- `ModelOutputJsonSchema` has no `$schema` and no forbidden property names;
- key schemas reject traversal, wrong prefix, lowercase ULIDs;
- stats math on `productsFixture` (exact expected numbers);
- CSV: BOM, header, quoting, formula guard, row count.

## Additional exports (reconciled after implementation)

- `IMAGE_CONTENT_TYPES`, `IMAGE_EXTENSIONS` (content type to key extension),
  `ErrorCodeSchema`, `MAX_QUANTITY`, `MAX_UNIT_PRICE_COP`.
- `classifyUploadRequestError(zodError)`: the single place that maps upload request
  issues to `UNSUPPORTED_MEDIA_TYPE`, `IMAGE_TOO_LARGE` or `VALIDATION_ERROR`; the API
  uses it so the mapping is not duplicated.
- `CSV_HEADER`; the formula guard also applies to cells with leading whitespace.
- `CreateUploadResponseSchema.url` uses `z.httpUrl()` (no `javascript:` or other
  schemes).
- Fixtures: `fixtureId(n)`, `createProductsRequestFixture`,
  `createProductsResponseFixture`, `listProductsResponseFixture`,
  `updateProductRequestFixture`, `productResponseFixture`,
  `updateSettingsRequestFixture`.
- Infra config: blank numeric context fails validation instead of becoming 0; an
  absent `enableTests` is `false` on purpose (test gates are opt-in).
- `exports` adds `default` next to `import` for tools that resolve without conditions.
