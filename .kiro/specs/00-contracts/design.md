# Design: 00-contracts

## Package structure

```
packages/contracts/
├── src/
│   ├── schemas/
│   │   ├── product.ts        # ProductCandidateSchema, ProductCandidatesSchema, PRODUCT_CATEGORIES
│   │   ├── item.ts           # InventoryItemSchema
│   │   ├── api.ts            # request/response schemas, ApiErrorSchema, ErrorCode
│   │   └── bedrock.ts        # productCandidatesJsonSchema (JSON Schema for Bedrock tool)
│   ├── types/
│   │   └── index.ts          # TypeScript type exports inferred from schemas
│   ├── fixtures/
│   │   └── index.ts          # sampleCandidate, sampleItem
│   └── index.ts              # barrel: re-exports everything
├── package.json
└── tsconfig.json
```

## Schema details

### `schemas/product.ts`

```typescript
export const PRODUCT_CATEGORIES = [
  "electronica", "ropa", "alimentos", "hogar", "herramientas",
  "juguetes", "libros", "deportes", "belleza", "otros",
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const ProductCandidateSchema = z.object({
  name:           z.string().min(1).max(120),
  description:    z.string().min(1).max(500),
  category:       z.enum(PRODUCT_CATEGORIES),
  estimatedPrice: z.number().nonneg(),
  currency:       z.literal("COP"),
  quantity:       z.number().int().nonneg(),
  skuHint:        z.string().max(50).optional(),
  barcode:        z.string().max(50).optional(),
});

export const ProductCandidatesSchema = z.object({
  candidates: z.array(ProductCandidateSchema).min(1).max(5),
});
```

### `schemas/item.ts`

```typescript
export const InventoryItemSchema = ProductCandidateSchema.extend({
  id:        z.string().ulid(),
  photoKey:  z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

`z.string().ulid()` requires zod ≥ 3.22. Pin accordingly.

### `schemas/api.ts`

```typescript
export enum ErrorCode {
  NO_CANDIDATES    = "NO_CANDIDATES",
  ANALYSIS_FAILED  = "ANALYSIS_FAILED",
  IMAGE_TOO_LARGE  = "IMAGE_TOO_LARGE",
  UNSUPPORTED_TYPE = "UNSUPPORTED_TYPE",
  THROTTLED        = "THROTTLED",
  NOT_FOUND        = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INTERNAL_ERROR   = "INTERNAL_ERROR",
}

export const ApiErrorSchema = z.object({
  code:    z.nativeEnum(ErrorCode),
  message: z.string(),
});

export const AnalyzeRequestSchema  = z.object({ photoKey: z.string().min(1) });
export const AnalyzeResponseSchema = z.object({ candidates: z.array(ProductCandidateSchema) });

export const SaveItemsRequestSchema  = z.object({
  items:    z.array(ProductCandidateSchema).min(1).max(5),
  photoKey: z.string().min(1),
});
export const SaveItemsResponseSchema = z.object({ saved: z.array(InventoryItemSchema) });

export const ListItemsResponseSchema = z.object({
  items: z.array(InventoryItemSchema),
  total: z.number().int().nonneg(),
});

export const ExportQuerySchema = z.object({
  category: z.enum(PRODUCT_CATEGORIES).optional(),
});
```

### `schemas/bedrock.ts`

`productCandidatesJsonSchema` is derived from `ProductCandidatesSchema` using
`zod-to-json-schema` (dev dependency). The export is a plain JS object (not a zod
schema) so `services/api` can pass it directly to the Bedrock tool definition.

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";
export const productCandidatesJsonSchema = zodToJsonSchema(
  ProductCandidatesSchema,
  { name: "ProductCandidates", $refStrategy: "none" }
);
```

## Package configuration

`package.json`:
```json
{
  "name": "@ghoststock/contracts",
  "version": "0.0.1",
  "type": "module",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "scripts": {
    "build": "tsc",
    "test":  "vitest run"
  },
  "dependencies":    { "zod": "3.23.8" },
  "devDependencies": { "zod-to-json-schema": "3.23.1", "vitest": "2.1.8", "typescript": "5.6.3" }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "declaration": true, "outDir": "dist", "rootDir": "src"
  },
  "include": ["src"]
}
```

## Test plan

`src/__tests__/schemas.test.ts` — round-trip: parse fixture → serialize → re-parse.
`src/__tests__/bedrock.test.ts` — `productCandidatesJsonSchema` has the expected
`properties.candidates` array shape and required fields.
`src/__tests__/fixtures.test.ts` — `sampleCandidate` and `sampleItem` parse without
errors against their respective schemas.
