# Requirements Document: 01-api-bedrock

## Introduction

The GhostStock API: three Lambda functions behind an API Gateway HTTP API, reached by
the browser through CloudFront at `/api/*`. It issues upload slots, analyzes photos
with Amazon Bedrock and manages the inventory in DynamoDB. Every shape comes from
`@ghoststock/contracts`. Rules: `ai-integration.md`, `security.md`. Decisions:
ADR 0005, ADR 0007, ADR 0010.

## Requirements

### Requirement 1: Upload slots

**User Story:** As the web app, I want a short-lived, constrained upload slot, so that
the photo goes straight from the browser to S3 without passing through the API.

#### Acceptance Criteria

1. WHEN `POST /api/uploads` receives a valid `CreateUploadRequest`, THE uploads
   function SHALL return `201` with a presigned POST for key `tmp/<ulid>.<ext>`,
   `Content-Type` fixed to the requested type, `content-length-range` 1 to
   3 750 000 and expiry 300 s.
2. IF `contentType` is not allowed, THEN THE API SHALL return `415
   UNSUPPORTED_MEDIA_TYPE`.
3. IF `sizeBytes` exceeds 3 750 000, THEN THE API SHALL return `413 IMAGE_TOO_LARGE`.

### Requirement 2: Photo analysis

**User Story:** As the user, I want my photo analyzed into product candidates, so that
I do not type my inventory by hand.

#### Acceptance Criteria

1. WHEN `POST /api/analyses` receives a valid `imageKey`, THE analyses function SHALL
   read the object metadata, then its bytes, call Bedrock Converse once with the image
   and the `report_products` tool forced, and return `200` with an `Analysis`.
2. IF the object does not exist, THEN THE API SHALL return `404 IMAGE_NOT_FOUND`.
3. IF the stored object is larger than 3 750 000 bytes or its content type is not
   allowed, THEN THE API SHALL return `413 IMAGE_TOO_LARGE` or
   `415 UNSUPPORTED_MEDIA_TYPE` without calling Bedrock.
4. THE analyses function SHALL assign a ULID `candidateId` to each candidate and
   report `modelId` and `latencyMs`.

### Requirement 3: Honest outcomes

**User Story:** As the product owner, I want every analysis outcome to be truthful,
so that the app never shows invented products.

#### Acceptance Criteria

1. WHEN the model reports zero products, THE API SHALL return `200` with
   `candidates: []`.
2. IF the response has no `report_products` tool call, a `stopReason` other than
   `tool_use`, or the tool input fails `ModelOutputSchema`, THEN THE API SHALL return
   `502 MODEL_INVALID_OUTPUT` and SHALL NOT return partial candidates.
3. WHEN Bedrock throws `ThrottlingException` or `ServiceUnavailableException`, THE
   analyses function SHALL retry at most 2 times (400 ms, 1200 ms) while time remains
   in the 25 s deadline, and then return `503 MODEL_THROTTLED`; a
   `ModelTimeoutException` or the deadline itself SHALL return `503 MODEL_THROTTLED`
   without further retries.
4. IF Bedrock throws `AccessDeniedException`, `ResourceNotFoundException` or a
   `ValidationException` about the model or access, THEN THE API SHALL return
   `503 MODEL_UNAVAILABLE`; IF it throws a `ValidationException` about the image
   (cannot process, format, dimensions, decode), THEN THE API SHALL return
   `415 UNSUPPORTED_MEDIA_TYPE`; any other `ValidationException` SHALL return
   `500 INTERNAL_ERROR`, logging the Bedrock message and never image bytes.
5. THE analyses function SHALL issue at most one successful Converse call per request,
   configure the Bedrock client with `maxAttempts: 1` (retries are ours only), and
   enforce one overall 25 s deadline across all attempts, so the response is always the
   JSON envelope and never a Lambda timeout.

### Requirement 4: Save reviewed products

**User Story:** As the user, I want to save the products I reviewed with their photo,
so that they appear in my inventory.

#### Acceptance Criteria

1. WHEN `POST /api/products` receives a valid `CreateProductsRequest`, THE inventory
   function SHALL copy the image once from `tmp/` to `media/products/<ulid>.<ext>`,
   write every product with a new ULID, the shared `mediaKey`, and equal `createdAt`
   and `updatedAt`, and return `201` with the created products.
2. IF the source image no longer exists, THEN THE API SHALL return `404
   IMAGE_NOT_FOUND` and write nothing.
3. IF the copy or the write fails, THEN THE API SHALL return `500 STORAGE_ERROR`
   and SHALL NOT report success for any product.

### Requirement 5: Read, update and delete products

**User Story:** As the user, I want to browse, correct and remove products.

#### Acceptance Criteria

1. WHEN `GET /api/products` is called, THE API SHALL return every product of the
   workspace with one DynamoDB Query on `PK = WS#default` (following pagination up to
   1 000 items), newest first, plus `count`.
2. WHEN `GET /api/products/{id}` is called for an existing product, THE API SHALL
   return it; otherwise `404 NOT_FOUND`.
3. WHEN `PUT /api/products/{id}` receives a valid partial update, THE API SHALL update
   only those fields and `updatedAt` with a condition that the item exists, and return
   the full product; otherwise `404 NOT_FOUND`.
4. WHEN `DELETE /api/products/{id}` is called for an existing product, THE API SHALL
   delete it and return `204`; otherwise `404 NOT_FOUND`.

### Requirement 6: Settings

**User Story:** As the user, I want to configure the low-stock threshold.

#### Acceptance Criteria

1. WHEN `GET /api/settings` is called and no settings item exists, THE API SHALL
   return `lowStockThreshold` from the `LOW_STOCK_DEFAULT` environment variable.
2. WHEN `PUT /api/settings` receives a valid body, THE API SHALL store it and return
   the stored settings.

### Requirement 7: Validation and error envelope

**User Story:** As the web app, I want every failure in one predictable shape.

#### Acceptance Criteria

1. EVERY handler SHALL validate path, query and body with the contract schemas before
   any AWS SDK call and return `400 VALIDATION_ERROR` on failure.
2. IF a request body is larger than 64 KB or is not JSON, THEN THE API SHALL return
   `400 VALIDATION_ERROR`.
3. EVERY error response SHALL match `ApiErrorSchema`, use the status from
   `ERROR_HTTP_STATUS` and include the API Gateway `requestId`.
4. IF an unexpected exception occurs, THEN THE API SHALL return `500 INTERNAL_ERROR`
   without leaking stack traces or AWS identifiers.

### Requirement 8: Observability and privacy

**User Story:** As the operator, I want useful logs and metrics without leaking data.

#### Acceptance Criteria

1. EVERY function SHALL log structured JSON with Powertools Logger including
   `requestId`, route, status and error code.
2. THE analyses function SHALL emit metrics `AnalysisLatencyMs`, `CandidateCount`
   and `AnalysisFailed` (by error code) with Powertools Metrics (EMF).
3. NO function SHALL log image bytes, base64, presigned URLs, POST fields or raw model
   text.

### Requirement 9: Tests

**User Story:** As the reviewer, I want each criterion proven against real behavior.

#### Acceptance Criteria

1. EVERY pure service SHALL have Vitest unit tests with `aws-sdk-client-mock`,
   covering each error path of Requirements 2, 3, 4 and 5.
2. THE `e2e/api` Playwright project SHALL exercise every endpoint against `BASE_URL`,
   validating every response with the contract schemas, and clean up what it creates.
3. THE analysis Playwright test SHALL be tagged `@bedrock` and use a fixture photo
   from `e2e/fixtures/images/`.
