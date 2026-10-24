# Requirements: 00-contracts

## Overview

`packages/contracts` is the single source of truth for every data shape shared between
the API and the web app. Nothing in `services/api` or `apps/web` redefines a type or
schema that belongs here.

## Requirements

### EARS-1 — Product candidate schema
WHEN Bedrock returns product data,
THE SYSTEM SHALL validate it against `ProductCandidateSchema` which enforces:
name (≤ 120 chars), description (≤ 500 chars), category (enum), estimatedPrice
(non-negative number), currency ("COP" literal), quantity (non-negative integer),
skuHint (≤ 50 chars, optional), barcode (≤ 50 chars, optional).

### EARS-2 — Product candidates envelope
THE SYSTEM SHALL wrap candidates in `ProductCandidatesSchema` which enforces an array
of 1–5 `ProductCandidateSchema` items.

### EARS-3 — Saved item schema
WHEN a product candidate is saved,
THE SYSTEM SHALL store it as an `InventoryItemSchema` which extends
`ProductCandidateSchema` with: id (ULID string), photoKey (S3 key string),
createdAt (ISO-8601 string), updatedAt (ISO-8601 string).

### EARS-4 — API request/response schemas
THE SYSTEM SHALL export typed request and response schemas for every API endpoint:
- `AnalyzeRequestSchema` — `{ photoKey: string }`
- `AnalyzeResponseSchema` — `{ candidates: ProductCandidate[] }` or error
- `SaveItemsRequestSchema` — `{ items: ProductCandidate[]; photoKey: string }`
- `SaveItemsResponseSchema` — `{ saved: InventoryItem[] }`
- `ListItemsResponseSchema` — `{ items: InventoryItem[]; total: number }`
- `ExportQuerySchema` — optional category filter
- `ApiErrorSchema` — `{ code: ErrorCode; message: string }`

### EARS-5 — Error code enum
THE SYSTEM SHALL export an `ErrorCode` enum covering:
`NO_CANDIDATES`, `ANALYSIS_FAILED`, `IMAGE_TOO_LARGE`, `UNSUPPORTED_TYPE`,
`THROTTLED`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

### EARS-6 — Product category enum
THE SYSTEM SHALL export a `PRODUCT_CATEGORIES` tuple and `ProductCategory` type
covering at minimum: `"electronica"`, `"ropa"`, `"alimentos"`, `"hogar"`,
`"herramientas"`, `"juguetes"`, `"libros"`, `"deportes"`, `"belleza"`, `"otros"`.

### EARS-7 — Shared fixtures
THE SYSTEM SHALL export at least one valid `InventoryItem` fixture and one valid
`ProductCandidate` fixture for use in tests and MSW handlers across workspaces.

### EARS-8 — JSON Schema export
THE SYSTEM SHALL export a `productCandidatesJsonSchema` object (plain JSON Schema,
derived from `ProductCandidatesSchema`) for use as the Bedrock tool input schema.

### EARS-9 — No runtime dependencies on app packages
THE `packages/contracts` package SHALL have zero dependencies on `apps/web` or
`services/api`. Its only runtime dependency is `zod`.

### EARS-10 — TypeScript strict mode
ALL files in `packages/contracts` SHALL compile under `"strict": true` with zero
errors and zero `any` types.
