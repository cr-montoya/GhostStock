# Design Document: 01-api-bedrock

## Overview

Three Lambda functions, each a thin router over pure services. Contracts from
`@ghoststock/contracts`; AWS access through small adapters so services are unit
testable. ADRs: 0005 (single table), 0007 (Bedrock contract), 0010 (runtime
dependencies).

## Structure

```
services/api/
  src/
    handlers/
      uploads.ts        POST /api/uploads
      analyses.ts       POST /api/analyses
      inventory.ts      /api/products, /api/products/{id}, /api/settings (routeKey switch)
    services/
      uploads.ts        createUploadSlot()
      analyses.ts       analyzeImage()
      products.ts       createProducts(), listProducts(), getProduct(),
                        updateProduct(), deleteProduct()
      settings.ts       getSettings(), updateSettings()
    adapters/
      s3.ts             headImage(), getImageBytes(), copyToMedia(), presignPost()
      dynamo.ts         keys, toItem(), fromItem(), query/put/update/delete helpers
      bedrock.ts        converseWithTool() with retry and timeout
    bedrock/
      prompt.ts         SYSTEM_PROMPT, USER_PROMPT
      tool.ts           REPORT_PRODUCTS_TOOL built from ModelOutputJsonSchema
    lib/
      http.ts           parseJson(), json(), noContent(), withErrors() wrapper
      errors.ts         AppError(code, message, cause?)
      env.ts            zod-validated process.env
      observability.ts  Powertools logger and metrics
      ids.ts            ulid()
  test/                 Vitest unit tests
  package.json, tsconfig.json
```

## Request flow

```mermaid
sequenceDiagram
  participant W as Web
  participant U as uploads fn
  participant S as S3 media
  participant A as analyses fn
  participant B as Bedrock
  participant I as inventory fn
  participant D as DynamoDB
  W->>U: POST /api/uploads {contentType, sizeBytes}
  U-->>W: 201 {url, fields, imageKey, expiresAt}
  W->>S: POST url (fields + file)
  W->>A: POST /api/analyses {imageKey}
  A->>S: HeadObject + GetObject tmp/...
  A->>B: Converse (image + forced report_products)
  A-->>W: 200 Analysis (0..10 candidates)
  W->>I: POST /api/products {imageKey, products}
  I->>S: CopyObject tmp/ -> media/products/
  I->>D: BatchWriteItem
  I-->>W: 201 {products}
```

## Handler contract

```ts
export const handler = withErrors(async (event: APIGatewayProxyEventV2) => {
  const body = parseJson(event, CreateAnalysisRequestSchema); // 400 on failure
  const analysis = await analyzeImage(deps, body.imageKey);
  return json(200, analysis);
});
```

`withErrors` maps `AppError` to `ApiErrorSchema` with `ERROR_HTTP_STATUS`, logs once,
adds `requestId` (`event.requestContext.requestId`), and turns anything else into
`INTERNAL_ERROR`. Responses always set `content-type: application/json` and
`cache-control: no-store`. `parseJson` decodes the body when
`event.isBase64Encoded` is true before parsing.

`inventory.ts` dispatches on `event.routeKey`:
`GET /api/products`, `POST /api/products`, `GET /api/products/{id}`,
`PUT /api/products/{id}`, `DELETE /api/products/{id}`, `GET /api/settings`,
`PUT /api/settings`, and `$default` (any unknown path) which returns
`404 NOT_FOUND` in the standard envelope. Path `id` is validated with `Ulid`.

## Uploads

`createPresignedPost` (`@aws-sdk/s3-presigned-post`) with
`Key = tmp/${ulid()}.${ext}`, `Fields: { "Content-Type": contentType }`,
`Conditions: [["content-length-range", 1, MAX_UPLOAD_BYTES], ["eq", "$Content-Type",
contentType]]`, `Expires: 300`. Extension map: jpeg -> jpg, png -> png, webp -> webp.

Request validation mapping (the only place zod issues are not all `400`): an issue on
`contentType` -> `415 UNSUPPORTED_MEDIA_TYPE`; a `too_big` issue on `sizeBytes` ->
`413 IMAGE_TOO_LARGE`; anything else -> `400 VALIDATION_ERROR`.

## Analyses

1. `HeadObject`: `NotFound` -> `IMAGE_NOT_FOUND`; `ContentLength > MAX_UPLOAD_BYTES`
   -> `IMAGE_TOO_LARGE`; `ContentType` not allowed -> `UNSUPPORTED_MEDIA_TYPE`.
2. `GetObject` -> `Body.transformToByteArray()`.
3. `converseWithTool` with `toolChoice: { tool: { name: "report_products" } }`,
   `temperature: 0`, `maxTokens: 2000`. The client is created with `maxAttempts: 1`;
   one `AbortController` deadline of 25 s spans every attempt and backoff, so the
   handler always answers with the envelope before the 28 s Lambda timeout.
4. Retry policy and error mapping exactly as `ai-integration.md`.
5. `ModelOutputSchema.safeParse(toolUse.input)`; map to `ProductCandidate` with
   `candidateId: ulid()`.
6. Emit metrics, log summary, return `Analysis`.

## DynamoDB (ADR 0005)

| Entity | PK | SK | Attributes |
| --- | --- | --- | --- |
| Product | `WS#default` | `PRODUCT#<ulid>` | `entity: "PRODUCT"` + every `Product` field |
| Settings | `WS#default` | `SETTINGS` | `entity: "SETTINGS"`, `lowStockThreshold`, `updatedAt` |

- List: `Query PK = :ws AND begins_with(SK, "PRODUCT#")`, `ScanIndexForward: false`
  (ULIDs sort by time), follow `LastEvaluatedKey` up to 1 000 items.
- Create: `BatchWriteItem` (max 10 items, retry unprocessed items up to 3 times; any
  leftover -> `STORAGE_ERROR`).
- Update: `UpdateItem` with `ConditionExpression attribute_exists(PK)`, expression
  built from the validated partial with placeholders, `ReturnValues: ALL_NEW`.
- Delete: `DeleteItem` with the same condition. `ConditionalCheckFailedException` ->
  `NOT_FOUND`.
- `fromItem` strips `PK`, `SK`, `entity` and parses with `ProductSchema`.
- The shared photo is not deleted with a product (other products may use it).

## Environment

Validated with zod at cold start (`lib/env.ts`):

| Name | Functions |
| --- | --- |
| `MEDIA_BUCKET` | all |
| `TABLE_NAME` | inventory |
| `BEDROCK_MODEL_ID` | analyses |
| `LOW_STOCK_DEFAULT` | inventory |
| `POWERTOOLS_SERVICE_NAME`, `POWERTOOLS_METRICS_NAMESPACE` (`GhostStock`), `LOG_LEVEL` | all |

## Dependencies (ADR 0010)

Runtime: `@ghoststock/contracts`, `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`,
`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`,
`@aws-sdk/client-bedrock-runtime`, `@aws-lambda-powertools/logger`,
`@aws-lambda-powertools/metrics`, `ulid`. Dev: `@types/aws-lambda`,
`aws-sdk-client-mock`, `vitest`, `typescript`. Bundled by CDK `NodejsFunction`
(esbuild); this package has `build` = `tsc --noEmit` only.

## Testing

- Vitest unit tests per service with `aws-sdk-client-mock`: presign conditions,
  every analysis outcome (empty, invalid tool input, wrong stop reason, throttled
  then success, throttled exhausted, access denied, not found, too large, wrong
  type), create with missing image, create with partial batch failure, update and
  delete not found, settings default.
- `withErrors` tests: envelope shape, status mapping, no stack in body.
- Playwright `e2e/api/*.spec.ts` (project `api`, needs `BASE_URL`): uploads (valid,
  415, 413), real S3 POST of the fixture photo, analysis `@bedrock`, products CRUD
  round trip with cleanup, settings round trip, validation errors. Every body parsed
  with the contract schemas.
