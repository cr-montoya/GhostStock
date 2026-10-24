# Tasks: 00-contracts

## Implementation tasks

- [ ] 1. Scaffold `packages/contracts` workspace
  - [ ] 1.1 Create `packages/contracts/package.json` with name `@ghoststock/contracts`, dependencies `zod@3.23.8`, devDependencies `zod-to-json-schema@3.23.1`, `vitest@2.1.8`, `typescript@5.6.3`
  - [ ] 1.2 Create `packages/contracts/tsconfig.json` with strict mode, NodeNext module, declaration output to `dist/`
  - [ ] 1.3 Add `packages/contracts` to the root `package.json` workspaces array (create root `package.json` if it does not exist)

- [ ] 2. Write product schemas (`src/schemas/product.ts`)
  - [ ] 2.1 Export `PRODUCT_CATEGORIES` const tuple (10 categories)
  - [ ] 2.2 Export `ProductCategory` type
  - [ ] 2.3 Export `ProductCandidateSchema` zod object
  - [ ] 2.4 Export `ProductCandidatesSchema` zod object (1–5 candidates)

- [ ] 3. Write inventory item schema (`src/schemas/item.ts`)
  - [ ] 3.1 Export `InventoryItemSchema` extending `ProductCandidateSchema` with id, photoKey, createdAt, updatedAt

- [ ] 4. Write API schemas (`src/schemas/api.ts`)
  - [ ] 4.1 Export `ErrorCode` enum (8 codes)
  - [ ] 4.2 Export `ApiErrorSchema`
  - [ ] 4.3 Export all request/response schemas (Analyze, SaveItems, ListItems, ExportQuery)

- [ ] 5. Write Bedrock JSON Schema export (`src/schemas/bedrock.ts`)
  - [ ] 5.1 Export `productCandidatesJsonSchema` derived from `ProductCandidatesSchema` via `zod-to-json-schema`

- [ ] 6. Write TypeScript type exports (`src/types/index.ts`)
  - [ ] 6.1 Export inferred types: `ProductCandidate`, `ProductCandidates`, `InventoryItem`, `AnalyzeRequest`, `AnalyzeResponse`, `SaveItemsRequest`, `SaveItemsResponse`, `ListItemsResponse`, `ExportQuery`, `ApiError`

- [ ] 7. Write shared fixtures (`src/fixtures/index.ts`)
  - [ ] 7.1 Export `sampleCandidate: ProductCandidate` — valid, all required fields
  - [ ] 7.2 Export `sampleItem: InventoryItem` — valid, all required fields including id, photoKey, timestamps

- [ ] 8. Write barrel export (`src/index.ts`)
  - [ ] 8.1 Re-export everything from all schema, type, and fixture modules

- [ ] 9. Write tests
  - [ ] 9.1 `src/__tests__/schemas.test.ts` — parse/serialize round-trip for all schemas
  - [ ] 9.2 `src/__tests__/bedrock.test.ts` — validate `productCandidatesJsonSchema` shape
  - [ ] 9.3 `src/__tests__/fixtures.test.ts` — `sampleCandidate` and `sampleItem` parse cleanly

- [ ] 10. Build and verify
  - [ ] 10.1 `npm run build` in `packages/contracts` exits 0 with no TypeScript errors
  - [ ] 10.2 `npm test` in `packages/contracts` exits 0 with all tests passing
