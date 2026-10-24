# Requirements Document: 00-contracts

## Introduction

`packages/contracts` is the single source of truth for every shape that crosses a
boundary between the web app, the API, the model and the infrastructure. It also
hosts the small pure domain helpers both sides must compute identically (stats, low
stock, CSV). It blocks specs 01, 02 and 03. Decisions: ADR 0005, ADR 0007.

## Glossary

- **Candidate**: a product proposed by Bedrock for one photo. Never has price,
  quantity or SKU.
- **Reviewed product**: a candidate after the user completed and confirmed it.
- **Product**: a reviewed product persisted in the inventory.
- **imageKey**: S3 key of a raw upload, `tmp/<ulid>.<ext>`.
- **mediaKey**: S3 key of a saved product photo, `media/products/<ulid>.<ext>`.

## Requirements

### Requirement 1: Model output schema

**User Story:** As the product owner, I want the model output schema to make
fabrication of prices, quantities and SKUs impossible, so that every number in the
inventory comes from a person.

#### Acceptance Criteria

1. THE contracts package SHALL export `ModelOutputSchema` as a strict object with a
   `products` array of 0 to 10 items.
2. THE `ModelProductSchema` SHALL contain only `name` (1 to 120 chars), `category`
   (category enum), `description` (0 to 500 chars), `brand` (optional, 1 to 80 chars),
   `confidence` (`high | medium | low`) and `notes` (optional, up to 300 chars).
3. IF a model product contains any additional key (for example `price`, `quantity`,
   `sku` or `barcode`), THEN `ModelOutputSchema` SHALL reject it.
4. THE contracts package SHALL export `ModelOutputJsonSchema`, generated with
   `z.toJSONSchema` from `ModelOutputSchema`, without the `$schema` key, for use as the
   Bedrock tool input schema.

### Requirement 2: Upload contracts

**User Story:** As the web app, I want to request a constrained upload slot, so that
the browser sends the photo straight to S3.

#### Acceptance Criteria

1. THE contracts package SHALL export `CreateUploadRequestSchema` with `contentType`
   (`image/jpeg | image/png | image/webp`) and `sizeBytes` (integer 1 to 3 750 000).
2. THE contracts package SHALL export `CreateUploadResponseSchema` with `url`,
   `fields` (string record), `imageKey` and `expiresAt` (ISO 8601).
3. WHEN `sizeBytes` exceeds 3 750 000 (the Bedrock Converse per-image limit), THE
   request schema SHALL fail with a `too_big` issue on `sizeBytes`, which the API maps
   to `IMAGE_TOO_LARGE`; an issue on `contentType` maps to `UNSUPPORTED_MEDIA_TYPE`.

### Requirement 3: Analysis contracts

**User Story:** As the web app, I want a typed analysis result that can honestly be
empty, so that zero detections renders as a state and not as an error.

#### Acceptance Criteria

1. THE contracts package SHALL export `CreateAnalysisRequestSchema` with `imageKey`.
2. THE contracts package SHALL export `AnalysisSchema` with `analysisId` (ULID),
   `imageKey`, `candidates` (0 to 10 `ProductCandidate`), `modelId` and `latencyMs`.
3. THE `ProductCandidateSchema` SHALL equal `ModelProductSchema` plus `candidateId`
   (ULID).

### Requirement 4: Product contracts

**User Story:** As the user, I want my quantities, prices and SKUs validated the same
way everywhere, so that the inventory stays consistent.

#### Acceptance Criteria

1. THE contracts package SHALL export `ProductFieldsSchema` with `name`, `category`,
   `description`, `brand` (optional), `sku` (optional, 1 to 64 chars of
   `[A-Za-z0-9._-]`), `quantity` (integer 0 to 1 000 000) and `unitPriceCop`
   (integer 0 to 1 000 000 000).
2. THE `ReviewedProductSchema` SHALL equal `ProductFieldsSchema` plus optional
   read-only provenance `aiConfidence` and `aiNotes`.
3. THE `ProductSchema` SHALL equal `ReviewedProductSchema` plus `id` (ULID),
   `mediaKey` (mediaKey format or `null`), `createdAt` and `updatedAt` (ISO 8601).
4. THE contracts package SHALL export `CreateProductsRequestSchema` (`imageKey`,
   `products` 1 to 10 reviewed products), `CreateProductsResponseSchema`
   (`products`), `ListProductsResponseSchema` (`products`, `count`),
   `UpdateProductRequestSchema` (partial `ProductFieldsSchema`, at least one field)
   and `ProductResponseSchema`.
5. IF `UpdateProductRequestSchema` receives an empty object, THEN it SHALL fail.

### Requirement 5: Settings contract

**User Story:** As the user, I want to set the low-stock threshold, so that the
dashboard warns me at the level that matters to my shop.

#### Acceptance Criteria

1. THE contracts package SHALL export `SettingsSchema` with `lowStockThreshold`
   (integer 0 to 100 000) and `UpdateSettingsRequestSchema` with the same field.

### Requirement 6: Error catalog

**User Story:** As both the API and the web app, I want one closed list of error codes,
so that every failure maps to exactly one Spanish message.

#### Acceptance Criteria

1. THE contracts package SHALL export `ERROR_CODES` with exactly:
   `VALIDATION_ERROR`, `UNSUPPORTED_MEDIA_TYPE`, `IMAGE_TOO_LARGE`, `IMAGE_NOT_FOUND`,
   `NOT_FOUND`, `MODEL_UNAVAILABLE`, `MODEL_THROTTLED`, `MODEL_INVALID_OUTPUT`,
   `STORAGE_ERROR`, `INTERNAL_ERROR`.
2. THE contracts package SHALL export `ERROR_HTTP_STATUS` mapping each code to its
   status and `ERROR_RETRYABLE` mapping each code to a boolean.
3. THE `ApiErrorSchema` SHALL be `{ error: { code, message, retryable, requestId } }`.

### Requirement 7: Key formats

**User Story:** As the security reviewer, I want S3 keys validated by pattern, so that
no request can point the API at an arbitrary object.

#### Acceptance Criteria

1. THE `ImageKeySchema` SHALL accept only `^tmp/[0-9A-HJKMNP-TV-Z]{26}\.(jpg|png|webp)$`.
2. THE `MediaKeySchema` SHALL accept only
   `^media/products/[0-9A-HJKMNP-TV-Z]{26}\.(jpg|png|webp)$`.
3. IF a key contains `..`, a leading slash or another prefix, THEN both schemas SHALL
   reject it.

### Requirement 8: Shared domain helpers

**User Story:** As the dashboard and the tests, I want stats and CSV computed by one
implementation, so that numbers never disagree.

#### Acceptance Criteria

1. THE contracts package SHALL export `computeInventoryStats(products, threshold)`
   returning `productCount`, `unitCount`, `inventoryValueCop`, `categoryCount`,
   `byCategory` (count, units and value per category, sorted by value) and `lowStock`
   (products with `quantity <= threshold`, ascending by quantity).
2. THE contracts package SHALL export `productsToCsv(products)` returning a UTF-8
   string with BOM, header `nombre,categoria,descripcion,marca,sku,cantidad,
   precio_unitario_cop,valor_total_cop,creado_en`, RFC 4180 quoting, and one row per
   product.
3. IF a CSV cell starts with `=`, `+`, `-` or `@`, THEN `productsToCsv` SHALL prefix it
   with `'` to prevent formula injection.
4. THE contracts package SHALL export `CATEGORY_LABELS` mapping each category slug to
   its Spanish label.

### Requirement 9: Fixtures

**User Story:** As any workspace, I want valid examples of every payload, so that MSW,
unit tests, Playwright and docs share the same data.

#### Acceptance Criteria

1. THE contracts package SHALL export fixtures for every request, response and error
   code, including an analysis with 3 candidates, an analysis with 0 candidates and an
   inventory of at least 8 products with at least 2 under the default threshold.
2. WHEN the test suite runs, EVERY fixture SHALL parse against its schema.

### Requirement 10: Infrastructure config schema

**User Story:** As the infra lane, I want CDK context validated at synth time, so that
a typo fails fast instead of deploying something wrong.

#### Acceptance Criteria

1. THE contracts package SHALL export `InfraConfigSchema` with `region`, `repo`
   (`owner/name`), `branch`, `bedrockModelId`, `lowStockDefault`, `enableTests`,
   `budgetUsd`, and optional `connectionArn` and `budgetEmail`.

### Requirement 11: Package hygiene

**User Story:** As every consumer, I want a tiny, strict, dependency-light package.

#### Acceptance Criteria

1. THE package SHALL have `zod` (v4) as its only runtime dependency and no dependency
   on any other workspace.
2. THE package SHALL compile with `strict: true`, emit ESM plus declarations to
   `dist/`, and contain no `any`.
3. WHEN `pnpm --filter @ghoststock/contracts build` and
   `pnpm --filter @ghoststock/contracts test` run, THEY SHALL exit 0.
