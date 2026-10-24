# Implementation Plan: 00-contracts

Branch: `feat/00-contracts`. Builder: main session or `api-dev`. Evaluators:
`code-reviewer`, `qa-engineer`. One commit per task.

- [ ] 1. Scaffold the workspace
  - Create `packages/contracts/package.json`, `tsconfig.json`, `src/index.ts`,
    Vitest config; install `zod@4`, `typescript`, `vitest`; commit the lockfile.
  - Done when `pnpm --filter @ghoststock/contracts build` exits 0 on an empty barrel.
  - _Requirements: 11.1, 11.2_

- [ ] 2. Common primitives
  - `schemas/common.ts`: categories, labels, Ulid, IsoDateTime, content types,
    confidence, key schemas, `MAX_UPLOAD_BYTES`.
  - Tests: key schemas accept valid keys and reject traversal, prefixes, lowercase.
  - _Requirements: 7.1, 7.2, 7.3, 8.4_

- [ ] 3. Error catalog
  - `schemas/errors.ts` with codes, HTTP map, retryable map, `ApiErrorSchema`.
  - Tests: maps are total over `ERROR_CODES`.
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 4. Model output and analysis contracts
  - `schemas/analysis.ts` including `ModelOutputJsonSchema` via `z.toJSONSchema`.
  - Tests: forbidden keys rejected; empty `products` accepted; JSON schema has no
    `$schema` and no price, quantity, sku or barcode properties.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3_

- [ ] 5. Upload, product and settings contracts
  - `schemas/upload.ts`, `schemas/product.ts`, `schemas/settings.ts`.
  - Tests: bounds on quantity, price, SKU pattern, size limit (`too_big` on
    `sizeBytes`); `{}` update rejected; `{ quantity: 1 }` parses without adding
    `description`.
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1_

- [ ] 6. Infra config schema
  - `schemas/config.ts` with optional deploy-time values; `""` becomes undefined;
    `"false"` parses as false; `bedrockModelId` requires the `us.` profile prefix.
  - _Requirements: 10.1_

- [ ] 7. Domain helpers
  - `domain/stats.ts`, `domain/csv.ts`.
  - Tests: exact stats for `productsFixture`; CSV BOM, header, quoting, formula guard.
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 8. Fixtures and types
  - `fixtures/index.ts` (every payload and every error code), `types.ts`, barrel.
  - Tests: every fixture parses against its schema.
  - _Requirements: 9.1, 9.2_

- [ ] 9. Verify and document
  - `pnpm build`, `pnpm test`, `pnpm typecheck` in the workspace, all green.
  - Create `docs/api.md` with every endpoint and its example payloads taken from the
    fixtures; link it from `docs/README.md`.
  - _Requirements: 11.3_
