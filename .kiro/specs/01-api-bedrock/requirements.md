# Requirements: 01-api-bedrock

## Overview

Lambda-based HTTP API backed by API Gateway, Amazon Bedrock (Claude 3 Sonnet via
Converse), DynamoDB, and S3. Implements the analyze → save → CRUD → export flow.
All schemas come from `@ghoststock/contracts`.

## Requirements

### EARS-1 — Presigned POST for image upload
WHEN the client requests an upload URL,
THE SYSTEM SHALL return a presigned POST URL and fields for the S3 upload bucket,
constraining Content-Type to `image/jpeg | image/png | image/webp`,
`content-length-range` to 1–5 242 880 bytes, key prefix `uploads/<ulid>`,
and expiry to 300 seconds.

### EARS-2 — Image analysis with Bedrock
WHEN `POST /api/analyze` receives `{ photoKey }`,
THE SYSTEM SHALL call Bedrock Converse with the image block (fetched from S3),
forced tool use (`toolChoice: { any: {} }`), and the `productCandidatesJsonSchema`
tool definition, then validate the response against `ProductCandidatesSchema` and
return `{ candidates }`.

### EARS-3 — No fabrication
WHEN Bedrock returns zero candidates, a malformed tool call, a validation failure,
or a non-tool-use stop reason,
THE SYSTEM SHALL return an explicit `NO_CANDIDATES` or `ANALYSIS_FAILED` error
and SHALL NOT return invented product data.

### EARS-4 — Bedrock throttling retry
WHEN Bedrock returns `ThrottlingException`,
THE SYSTEM SHALL retry up to 2 times with exponential back-off (base 500 ms)
and return `THROTTLED` after exhausting retries.

### EARS-5 — Image validation
WHEN the image exceeds 5 MB or has an unsupported MIME type,
THE SYSTEM SHALL return `IMAGE_TOO_LARGE` or `UNSUPPORTED_TYPE` before calling
Bedrock.

### EARS-6 — Save items
WHEN `POST /api/items` receives `{ items, photoKey }` (1–5 validated candidates),
THE SYSTEM SHALL persist each as an `InventoryItem` in DynamoDB with a ULID id,
set `createdAt` and `updatedAt` to the current UTC ISO-8601 timestamp, and return
`{ saved: InventoryItem[] }`.

### EARS-7 — List items
WHEN `GET /api/items` is called with optional `?category=` and `?sort=createdAt|name`,
THE SYSTEM SHALL return `{ items: InventoryItem[], total: number }` using a GSI
query (not a full Scan).

### EARS-8 — Get item
WHEN `GET /api/items/:id` is called,
THE SYSTEM SHALL return the matching `InventoryItem` or a `NOT_FOUND` error.

### EARS-9 — Update item
WHEN `PUT /api/items/:id` receives a partial `ProductCandidate` payload,
THE SYSTEM SHALL update only the provided fields, set `updatedAt`, and return the
full updated `InventoryItem`.

### EARS-10 — Delete item
WHEN `DELETE /api/items/:id` is called,
THE SYSTEM SHALL remove the item from DynamoDB and return HTTP 204.

### EARS-11 — CSV export
WHEN `GET /api/items/export` is called with optional `?category=`,
THE SYSTEM SHALL return a UTF-8 CSV with a Spanish header row and one row per item,
columns: id, nombre, descripcion, categoria, precio\_estimado, moneda, cantidad,
sku, codigo\_barras, foto, creado\_en.

### EARS-12 — Input validation
ALL handlers SHALL validate their inputs with zod schemas from `@ghoststock/contracts`
and return `VALIDATION_ERROR` (HTTP 400) on failure before any AWS SDK call.

### EARS-13 — Structured logs, no sensitive data
ALL handlers SHALL emit structured JSON logs and SHALL NOT log image bytes,
base64 strings, presigned URLs, or fields named password/token/secret/key.

### EARS-14 — Thin handlers
EACH Lambda handler SHALL delegate business logic to pure functions testable without
AWS SDK calls, using `aws-sdk-client-mock` for unit tests.
