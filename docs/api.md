# GhostStock API

Living reference for the HTTP API. Every example below is generated from the
fixtures in `@ghoststock/contracts`, which are validated against their schemas by the
contracts test suite. Owner: spec `00-contracts` (changes go through a contracts PR).

- Base path: `/api` on the CloudFront domain (same origin as the web app, ADR 0006).
- Bodies are JSON (`content-type: application/json`), responses are `cache-control: no-store`.
- Every error uses the envelope `{ error: { code, message, retryable, requestId } }`.
  Messages are technical English; the web app maps `code` to Spanish copy.

| Method | Path | Request | Success | Errors |
| --- | --- | --- | --- | --- |
| POST | `/api/uploads` | `CreateUploadRequest` | 201 `CreateUploadResponse` | 400, 413, 415 |
| POST | `/api/analyses` | `CreateAnalysisRequest` | 200 `Analysis` | 400, 404 `IMAGE_NOT_FOUND`, 413, 415, 500, 502, 503 |
| GET | `/api/products` |  | 200 `ListProductsResponse` | 500 |
| POST | `/api/products` | `CreateProductsRequest` | 201 `CreateProductsResponse` | 400, 404 `IMAGE_NOT_FOUND`, 500 |
| GET | `/api/products/{id}` |  | 200 `Product` | 400, 404 `NOT_FOUND`, 500 `STORAGE_ERROR` |
| PUT | `/api/products/{id}` | `UpdateProductRequest` | 200 `Product` | 400, 404 `NOT_FOUND`, 500 |
| DELETE | `/api/products/{id}` |  | 204 | 400, 404 `NOT_FOUND`, 500 |
| GET | `/api/settings` |  | 200 `Settings` | 500 |
| PUT | `/api/settings` | `UpdateSettingsRequest` | 200 `Settings` | 400, 500 |
| any | unknown `/api/*` path |  |  | 404 `NOT_FOUND` |

## Upload flow

1. `POST /api/uploads` returns a presigned POST for `tmp/<ulid>.<ext>` (300 s,
   1 to 3750000 bytes, exact content type).
2. The browser posts `fields` plus the file (last form field) to `url`; S3 answers 204.
3. `POST /api/analyses` with the returned `imageKey`.

### POST /api/uploads

Request:
```json
{
  "contentType": "image/jpeg",
  "sizeBytes": 842113
}
```

Response `201`:
```json
{
  "url": "https://ghoststock-media-example.s3.us-east-1.amazonaws.com/",
  "fields": {
    "key": "tmp/01JB5X7Q8M0000000000000900.jpg",
    "Content-Type": "image/jpeg",
    "bucket": "ghoststock-media-example",
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": "EXAMPLE/20261024/us-east-1/s3/aws4_request",
    "X-Amz-Date": "20261024T150000Z",
    "Policy": "eyJleGFtcGxlIjp0cnVlfQ==",
    "X-Amz-Signature": "0000000000000000000000000000000000000000000000000000000000000000"
  },
  "imageKey": "tmp/01JB5X7Q8M0000000000000900.jpg",
  "expiresAt": "2026-10-24T15:05:00.000Z"
}
```

Errors: `415 UNSUPPORTED_MEDIA_TYPE` when `contentType` is not jpeg, png or webp;
`413 IMAGE_TOO_LARGE` when `sizeBytes` exceeds 3750000 (the Bedrock image limit).

```json
{
  "error": {
    "code": "IMAGE_TOO_LARGE",
    "message": "Image exceeds 3750000 bytes",
    "retryable": false,
    "requestId": "Example-Request-Id="
  }
}
```

### POST /api/analyses

Request:
```json
{
  "imageKey": "tmp/01JB5X7Q8M0000000000000900.jpg"
}
```

Response `200` with candidates:
```json
{
  "analysisId": "01JB5X7Q8M0000000000000001",
  "imageKey": "tmp/01JB5X7Q8M0000000000000900.jpg",
  "modelId": "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "latencyMs": 4870,
  "candidates": [
    {
      "candidateId": "01JB5X7Q8M0000000000000011",
      "name": "Café molido de origen Huila 500 g",
      "category": "alimentos",
      "description": "Bolsa de café tostado y molido, empaque kraft con válvula.",
      "brand": "Tostadora Andina",
      "confidence": "high"
    },
    {
      "candidateId": "01JB5X7Q8M0000000000000012",
      "name": "Panela redonda 1 kg",
      "category": "alimentos",
      "description": "Bloque de panela envuelto en papel.",
      "confidence": "medium",
      "notes": "El peso se infiere por el tamaño; no se ve la etiqueta."
    },
    {
      "candidateId": "01JB5X7Q8M0000000000000013",
      "name": "Jabón de barra para ropa",
      "category": "aseo",
      "description": "Barra azul de jabón para lavar a mano.",
      "confidence": "low",
      "notes": "Etiqueta parcialmente visible, podría ser jabón de cocina."
    }
  ]
}
```

Response `200` when nothing is recognizable (a state, not an error):
```json
{
  "analysisId": "01JB5X7Q8M0000000000000002",
  "imageKey": "tmp/01JB5X7Q8M0000000000000900.jpg",
  "modelId": "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "latencyMs": 3110,
  "candidates": []
}
```

Candidates never contain price, quantity, SKU or barcode (ADR 0007). Errors:

`404 IMAGE_NOT_FOUND`:
```json
{
  "error": {
    "code": "IMAGE_NOT_FOUND",
    "message": "Image not found or expired",
    "retryable": false,
    "requestId": "Example-Request-Id="
  }
}
```

`502 MODEL_INVALID_OUTPUT`:
```json
{
  "error": {
    "code": "MODEL_INVALID_OUTPUT",
    "message": "Model output failed validation",
    "retryable": true,
    "requestId": "Example-Request-Id="
  }
}
```

`503 MODEL_THROTTLED`:
```json
{
  "error": {
    "code": "MODEL_THROTTLED",
    "message": "Model throttled after retries",
    "retryable": true,
    "requestId": "Example-Request-Id="
  }
}
```

`503 MODEL_UNAVAILABLE`:
```json
{
  "error": {
    "code": "MODEL_UNAVAILABLE",
    "message": "Model access denied or model not found",
    "retryable": false,
    "requestId": "Example-Request-Id="
  }
}
```

Bedrock `ValidationException` mapping: about the model or access gives `503 MODEL_UNAVAILABLE`;
about the image (format, dimensions, decode) gives `415 UNSUPPORTED_MEDIA_TYPE` with message
`Image could not be processed`; anything else gives `500 INTERNAL_ERROR`. An S3 failure other
than a missing key gives `500 STORAGE_ERROR`.

## Products

### POST /api/products

Copies the photo to `media/products/` once and creates every product with it.

Request:
```json
{
  "imageKey": "tmp/01JB5X7Q8M0000000000000900.jpg",
  "products": [
    {
      "name": "Café molido de origen Huila 500 g",
      "category": "alimentos",
      "description": "Bolsa de café tostado y molido, empaque kraft con válvula.",
      "brand": "Tostadora Andina",
      "sku": "CAF-HUI-500",
      "quantity": 24,
      "unitPriceCop": 18900,
      "aiConfidence": "high"
    },
    {
      "name": "Panela redonda 1 kg",
      "category": "alimentos",
      "description": "Bloque de panela envuelto en papel.",
      "quantity": 40,
      "unitPriceCop": 4200,
      "aiConfidence": "medium",
      "aiNotes": "El peso se infiere por el tamaño; no se ve la etiqueta."
    }
  ]
}
```

Response `201`:
```json
{
  "products": [
    {
      "id": "01JB5X7Q8M0000000000000108",
      "createdAt": "2026-10-24T15:08:00.000Z",
      "updatedAt": "2026-10-24T15:08:00.000Z",
      "name": "Café molido de origen Huila 500 g",
      "category": "alimentos",
      "description": "Bolsa de café tostado y molido.",
      "brand": "Tostadora Andina",
      "sku": "CAF-HUI-500",
      "quantity": 24,
      "unitPriceCop": 18900,
      "mediaKey": "media/products/01JB5X7Q8M0000000000000901.jpg"
    },
    {
      "id": "01JB5X7Q8M0000000000000107",
      "createdAt": "2026-10-24T15:07:00.000Z",
      "updatedAt": "2026-10-24T15:07:00.000Z",
      "name": "Panela redonda 1 kg",
      "category": "alimentos",
      "description": "Bloque de panela envuelto en papel.",
      "quantity": 40,
      "unitPriceCop": 4200,
      "mediaKey": "media/products/01JB5X7Q8M0000000000000901.jpg"
    }
  ]
}
```

### GET /api/products

Newest first, one Query, up to 1 000 products. Response `200` (truncated to 2 products here):
```json
{
  "products": [
    {
      "id": "01JB5X7Q8M0000000000000108",
      "createdAt": "2026-10-24T15:08:00.000Z",
      "updatedAt": "2026-10-24T15:08:00.000Z",
      "name": "Café molido de origen Huila 500 g",
      "category": "alimentos",
      "description": "Bolsa de café tostado y molido.",
      "brand": "Tostadora Andina",
      "sku": "CAF-HUI-500",
      "quantity": 24,
      "unitPriceCop": 18900,
      "mediaKey": "media/products/01JB5X7Q8M0000000000000901.jpg"
    },
    {
      "id": "01JB5X7Q8M0000000000000107",
      "createdAt": "2026-10-24T15:07:00.000Z",
      "updatedAt": "2026-10-24T15:07:00.000Z",
      "name": "Panela redonda 1 kg",
      "category": "alimentos",
      "description": "Bloque de panela envuelto en papel.",
      "quantity": 40,
      "unitPriceCop": 4200,
      "mediaKey": "media/products/01JB5X7Q8M0000000000000901.jpg"
    }
  ],
  "count": 8
}
```

### PUT /api/products/{id}

Partial update of user-owned fields; at least one field. Request:
```json
{
  "quantity": 30,
  "unitPriceCop": 19500
}
```

Response `200`: the full `Product`. Unknown id:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "retryable": false,
    "requestId": "Example-Request-Id="
  }
}
```

### DELETE /api/products/{id}

Response `204` with no body. The shared photo is kept.

## Settings

### GET and PUT /api/settings

```json
{
  "lowStockThreshold": 5
}
```

When nothing is stored, `GET` returns the `lowStockDefault` from the deployment config.

## Error catalog

| Code | HTTP | Retryable |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | no |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | no |
| `IMAGE_TOO_LARGE` | 413 | no |
| `IMAGE_NOT_FOUND` | 404 | no |
| `NOT_FOUND` | 404 | no |
| `MODEL_UNAVAILABLE` | 503 | no |
| `MODEL_THROTTLED` | 503 | yes |
| `MODEL_INVALID_OUTPUT` | 502 | yes |
| `STORAGE_ERROR` | 500 | yes |
| `INTERNAL_ERROR` | 500 | no |

## Client-side helpers

Dashboard stats (`computeInventoryStats`) and CSV export (`productsToCsv`, UTF-8 BOM,
CRLF, Spanish header, formula-injection guard) run in the browser from `GET /api/products`.
