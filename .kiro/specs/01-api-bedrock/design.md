# Design: 01-api-bedrock

## Package structure

```
services/api/
├── src/
│   ├── handlers/
│   │   ├── presign.ts          # GET /api/upload-url
│   │   ├── analyze.ts          # POST /api/analyze
│   │   ├── items-write.ts      # POST, PUT, DELETE /api/items
│   │   ├── items-read.ts       # GET /api/items, GET /api/items/:id
│   │   └── export.ts           # GET /api/items/export
│   ├── bedrock/
│   │   ├── client.ts           # BedrockRuntimeClient singleton
│   │   ├── tools.ts            # tool definition built from productCandidatesJsonSchema
│   │   ├── prompt.ts           # prompt text constant
│   │   └── analyze.ts          # callBedrock() pure function
│   ├── dynamo/
│   │   ├── client.ts           # DynamoDBDocumentClient singleton
│   │   └── items.ts            # putItem, getItem, queryItems, updateItem, deleteItem
│   ├── s3/
│   │   ├── client.ts           # S3Client singleton
│   │   └── presign.ts          # createPresignedPost(), getImageMetadata()
│   ├── csv/
│   │   └── export.ts           # itemsToCsv() pure function
│   └── lib/
│       ├── ulid.ts             # generateUlid() wrapper
│       ├── errors.ts           # AppError class, toApiError()
│       └── response.ts         # ok(), err() API Gateway response helpers
├── package.json
└── tsconfig.json
```

## Handler contracts

### `GET /api/upload-url`
Request: none  
Response 200: `{ url: string; fields: Record<string, string>; key: string }`  
Errors: `INTERNAL_ERROR`

### `POST /api/analyze`
Request body: `AnalyzeRequest` (`{ photoKey: string }`)  
Response 200: `AnalyzeResponse` (`{ candidates: ProductCandidate[] }`)  
Errors: `VALIDATION_ERROR`, `IMAGE_TOO_LARGE`, `UNSUPPORTED_TYPE`, `NO_CANDIDATES`,
`ANALYSIS_FAILED`, `THROTTLED`, `INTERNAL_ERROR`

### `POST /api/items`
Request body: `SaveItemsRequest`  
Response 201: `SaveItemsResponse`  
Errors: `VALIDATION_ERROR`, `INTERNAL_ERROR`

### `GET /api/items`
Query: `?category=<ProductCategory>&sort=createdAt|name&order=asc|desc`  
Response 200: `ListItemsResponse`  
Errors: `VALIDATION_ERROR`, `INTERNAL_ERROR`

### `GET /api/items/export`
Query: `?category=<ProductCategory>`  
Response 200: CSV, `Content-Type: text/csv; charset=utf-8`,
`Content-Disposition: attachment; filename="inventario.csv"`

### `GET /api/items/:id`
Response 200: `InventoryItem`  
Errors: `NOT_FOUND`, `INTERNAL_ERROR`

### `PUT /api/items/:id`
Request body: partial `ProductCandidate`  
Response 200: `InventoryItem`  
Errors: `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`

### `DELETE /api/items/:id`
Response 204: empty  
Errors: `NOT_FOUND`, `INTERNAL_ERROR`

## Bedrock integration

```typescript
// bedrock/analyze.ts
export async function callBedrock(
  client: BedrockRuntimeClient,
  imageBytes: Uint8Array,
  mediaType: "image/jpeg" | "image/png" | "image/webp"
): Promise<ProductCandidates | AppError>
```

1. Build the Converse request: image block + text prompt + tool config.
2. Send. On `ThrottlingException`, retry ≤ 2 times (500 ms, 1000 ms back-off).
3. Check `stopReason === "tool_use"`. If not → return `ANALYSIS_FAILED`.
4. Extract the `toolUse` block. Parse `input` with `ProductCandidatesSchema.safeParse`.
5. If parse fails → return `ANALYSIS_FAILED`.
6. If `candidates.length === 0` → return `NO_CANDIDATES`.
7. Return `{ candidates }`.

## DynamoDB table design

Table name: `GhostStockItems` (injected via `TABLE_NAME` env var).

| Attribute | Type | Role |
| --- | --- | --- |
| `PK` | String | `ITEM#<ulid>` |
| `category` | String | GSI partition key |
| `createdAt` | String | GSI sort key (ISO-8601 sorts lexicographically) |
| `name` | String | for name-sort (sort in memory for v1) |

GSI: `CategoryCreatedAtIndex` — PK = `category`, SK = `createdAt`.

## Environment variables

| Name | Injected by | Used by |
| --- | --- | --- |
| `TABLE_NAME` | CDK | dynamo/items.ts |
| `UPLOAD_BUCKET` | CDK | s3/presign.ts |
| `BEDROCK_MODEL_ID` | CDK | bedrock/client.ts |
| `AWS_REGION` | Lambda runtime | all AWS clients |

## Error handling pattern

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(public code: ErrorCode, message: string) { super(message); }
}

// handlers use:
const result = await callBedrock(...)
if (result instanceof AppError) return err(result);
return ok(result);
```

## CSV format

Header row (Spanish): `id,nombre,descripcion,categoria,precio_estimado,moneda,cantidad,sku,codigo_barras,foto,creado_en`

Values are comma-separated; text fields quoted with `"` if they contain commas or
newlines; encoding UTF-8 with BOM (`\uFEFF`) for Excel compatibility.

## Package configuration

```json
{
  "name": "@ghoststock/api",
  "dependencies": {
    "@ghoststock/contracts": "*",
    "@aws-sdk/client-bedrock-runtime": "3.x",
    "@aws-sdk/client-dynamodb": "3.x",
    "@aws-sdk/lib-dynamodb": "3.x",
    "@aws-sdk/client-s3": "3.x",
    "@aws-sdk/s3-presigned-post": "3.x",
    "ulid": "2.3.0"
  },
  "devDependencies": {
    "aws-sdk-client-mock": "4.x",
    "vitest": "2.1.8",
    "typescript": "5.6.3",
    "@types/aws-lambda": "8.10.x"
  }
}
```
