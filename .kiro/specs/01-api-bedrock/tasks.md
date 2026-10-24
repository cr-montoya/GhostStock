# Implementation Plan: 01-api-bedrock

Branch: `feat/01-<slug>` per slice, worktree `../GhostStock-api`. Builder: `api-dev`.
Evaluators: `qa-engineer`, `code-reviewer`, `security-reviewer`. Requires 00 merged.
The commit that creates `services/api/package.json` carries
`ADR-EXEMPT: dependencies recorded in ADR 0010`.

- [x] 1. Scaffold the workspace (critical path, merge first)
  - `package.json`, `tsconfig.json`, Vitest config, dependencies from ADR 0010.
  - Handler files `uploads.ts`, `analyses.ts`, `inventory.ts` wired through
    `withErrors`, returning `500 INTERNAL_ERROR` ("not implemented") until their task
    lands, so spec 03 can synth and deploy early.
  - `lib/env.ts`, `lib/errors.ts`, `lib/http.ts` (`withErrors`, `parseJson`, `json`),
    `lib/observability.ts`, `lib/ids.ts` with unit tests.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1_

- [x] 2. Uploads
  - `adapters/s3.ts` `presignPost`, `services/uploads.ts`, `handlers/uploads.ts`.
  - Unit tests: conditions, key format, 415, 413.
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Bedrock adapter
  - `bedrock/prompt.ts`, `bedrock/tool.ts`, `adapters/bedrock.ts` with retry policy,
    25 s abort and error mapping.
  - Unit tests: every exception class maps to the right code; retry counts.
  - _Requirements: 3.3, 3.4, 3.5_

- [x] 4. Analyses
  - `services/analyses.ts`, `handlers/analyses.ts`, metrics.
  - Unit tests: empty result, invalid output, wrong stop reason, missing image, too
    large, wrong type, happy path with candidate ids.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 8.2, 8.3_

- [x] 5. Products
  - `adapters/dynamo.ts`, `services/products.ts`; copy then batch write; list, get,
    update, delete.
  - Unit tests: create happy path, missing image, partial batch failure, pagination,
    newest first, update and delete not found.
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_

- [x] 6. Settings and inventory router
  - `services/settings.ts`, `handlers/inventory.ts` routeKey switch.
  - Unit tests: default from env, stored value, unknown route.
  - _Requirements: 6.1, 6.2_

- [ ] 7. Playwright API tests
  - `e2e/api/*.spec.ts` per Requirement 9, using the fixture photos committed by
    02 task 1 in `e2e/fixtures/images/` (read only from this lane).
  - Done when they pass against the first deployed stack (`BASE_URL`):
    `BASE_URL=https://<distribution> pnpm --filter @ghoststock/e2e test:api`. `@bedrock`
    tests call the real model. Specs run in order per file and retry only API Gateway
    `429` (stage throttling). Created products are deleted; their photo under
    `media/products/` is kept by design, and `tmp/` uploads expire after 1 day.
  - _Requirements: 9.2, 9.3_

- [ ] 8. Verify and sync
  - `pnpm --filter @ghoststock/api test`, typecheck, `pnpm audit --prod`.
  - `spec-sync`: tick tasks, reconcile design. `docs/api.md` belongs to the contracts
    lane: if behavior moved, open a small 00-contracts PR instead of editing it here.
  - _Requirements: 9.1_
