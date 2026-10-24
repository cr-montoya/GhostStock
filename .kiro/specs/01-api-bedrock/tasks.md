# Tasks: 01-api-bedrock

## Implementation tasks

- [ ] 1. Scaffold `services/api` workspace
  - [ ] 1.1 Create `services/api/package.json` with all dependencies from design.md
  - [ ] 1.2 Create `services/api/tsconfig.json` (strict, NodeNext, no emit — esbuild bundles)
  - [ ] 1.3 Add `services/api` to the root workspaces array

- [ ] 2. Shared library modules
  - [ ] 2.1 `src/lib/errors.ts` — `AppError` class and `toApiError()` helper
  - [ ] 2.2 `src/lib/response.ts` — `ok()`, `err()`, `noContent()` API Gateway response helpers
  - [ ] 2.3 `src/lib/ulid.ts` — `generateUlid()` wrapper around the `ulid` package

- [ ] 3. AWS client singletons
  - [ ] 3.1 `src/s3/client.ts` — `S3Client` singleton (region from env)
  - [ ] 3.2 `src/dynamo/client.ts` — `DynamoDBDocumentClient` singleton
  - [ ] 3.3 `src/bedrock/client.ts` — `BedrockRuntimeClient` singleton

- [ ] 4. S3 presign module (`src/s3/presign.ts`)
  - [ ] 4.1 `createPresignedPost()` — returns URL, fields, and key; enforces Content-Type and content-length-range constraints
  - [ ] 4.2 `getImageMetadata()` — HeadObject to check size and Content-Type before Bedrock call

- [ ] 5. Bedrock module
  - [ ] 5.1 `src/bedrock/prompt.ts` — prompt constant
  - [ ] 5.2 `src/bedrock/tools.ts` — tool definition from `productCandidatesJsonSchema`
  - [ ] 5.3 `src/bedrock/analyze.ts` — `callBedrock()` pure function with retry logic, tool-use parsing, zod validation, and explicit error returns

- [ ] 6. DynamoDB module (`src/dynamo/items.ts`)
  - [ ] 6.1 `putItem()` — writes a new `InventoryItem`
  - [ ] 6.2 `getItem()` — gets by `ITEM#<id>`; returns `NOT_FOUND` AppError if missing
  - [ ] 6.3 `queryItems()` — uses `CategoryCreatedAtIndex` GSI when category provided; falls back to GSI scan of all categories
  - [ ] 6.4 `updateItem()` — updates only provided fields, sets `updatedAt`
  - [ ] 6.5 `deleteItem()` — deletes by `ITEM#<id>`; returns `NOT_FOUND` if missing

- [ ] 7. CSV module (`src/csv/export.ts`)
  - [ ] 7.1 `itemsToCsv()` pure function — Spanish header row, UTF-8 BOM, proper quoting

- [ ] 8. Lambda handlers
  - [ ] 8.1 `src/handlers/presign.ts` — `GET /api/upload-url`
  - [ ] 8.2 `src/handlers/analyze.ts` — `POST /api/analyze` with image validation before Bedrock
  - [ ] 8.3 `src/handlers/items-write.ts` — `POST /api/items`, `PUT /api/items/:id`, `DELETE /api/items/:id`
  - [ ] 8.4 `src/handlers/items-read.ts` — `GET /api/items`, `GET /api/items/:id`
  - [ ] 8.5 `src/handlers/export.ts` — `GET /api/items/export`

- [ ] 9. Unit tests
  - [ ] 9.1 `src/bedrock/__tests__/analyze.test.ts` — happy path, zero candidates, malformed tool use, throttle retry, validation failure; mock with `aws-sdk-client-mock`
  - [ ] 9.2 `src/dynamo/__tests__/items.test.ts` — all five operations; mock with `aws-sdk-client-mock`
  - [ ] 9.3 `src/s3/__tests__/presign.test.ts` — presigned post fields, content-type enforcement
  - [ ] 9.4 `src/csv/__tests__/export.test.ts` — header row, BOM, quoting, empty list

- [ ] 10. Build and verify
  - [ ] 10.1 `npm run build` (tsc --noEmit) exits 0 with no TypeScript errors
  - [ ] 10.2 `npm test` exits 0 with all tests passing
