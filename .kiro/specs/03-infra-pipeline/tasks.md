# Implementation Plan: 03-infra-pipeline

Branch: `feat/03-<slug>` per slice, worktree `../GhostStock-infra`. Builder:
`infra-dev`. Evaluators: `code-reviewer`, `security-reviewer`. Requires 00 merged;
synth also needs the handler stubs from 01 task 1 and the web scaffold from 02 task 1
(critical path, see `docs/sdd-workflow.md`). `cdk deploy` only with the owner's
go-ahead.

- [x] 1. Scaffold the infra workspace
  - `package.json` (aws-cdk-lib, constructs, cdk-nag, aws-cdk, tsx, vitest; esbuild
    as a root devDependency),
    `cdk.json` with non-sensitive context, `bin/ghoststock.ts`, `lib/config.ts`.
  - Commit carries `ADR-EXEMPT: infra dependencies recorded in ADR 0008`.
  - Tests: invalid config fails synth with a clear message.
  - _Requirements: 1.1, 1.2_

- [x] 2. Pipeline stack
  - `pipeline-stack.ts`, `app-stage.ts`; pick and pin the Node.js 22 CodeBuild image.
  - Tests: selfMutation, source, synth commands and env, primary output, no test
    steps by default, pre and post steps when `enableTests`.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

- [x] 3. Storage and data
  - `MediaBucket`, web bucket, table.
  - Tests: hardening, lifecycle, CORS, keys, PITR.
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Functions and HTTP API
  - `ApiFunction`, three functions, explicit IAM, HTTP API routes, throttling, access
    logs.
  - Tests: per-function settings and exact policies; routes; no CORS.
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. Frontend and distribution
  - `Frontend` construct: web bucket deployment, spa rewrite function, headers
    policy with CSP, behaviors `/api/*` and `/media/*`, `BaseUrl` output.
  - Tests: behaviors, OAC, function association, headers, invalidation, no error
    responses.
  - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2_

- [x] 6. Budget and cdk-nag
  - `CfnBudget` when email is present; `nag.ts` suppressions with reasons.
  - Tests: budget conditional; zero unsuppressed nag errors.
  - _Requirements: 8.1, 8.2, 9.1, 9.2, 9.3_

- [x] 7. Deployment documentation
  - `docs/deployment.md` and `docs/architecture.md` per Requirement 11.
  - _Requirements: 11.1, 11.2_

- [x] 8. First deployment (owner go-ahead required)
  - Owner runs bootstrap, connection authorization and
    `pnpm exec cdk deploy GhostStockPipeline -c connectionArn=... -c budgetEmail=...`.
  - Done when the pipeline is green and `BaseUrl` serves the app.
  - _Requirements: 2.1, 2.4, 7.2_

- [x] 9. Smoke tests and enable gates
  - `e2e/smoke/*.spec.ts` per Requirement 10.2; green against `BaseUrl`.
  - When the MVP works end to end: PR setting `enableTests: true`; verify the
    pipeline mutates and adds both steps. Left at `false` by the owner's decision for
    the demo; turning it on is a one-line `cdk.json` change (docs/deployment.md).
  - _Requirements: 3.2, 10.2_

- [x] 10. Verify and sync
  - `pnpm --filter @ghoststock/infra test`, `pnpm exec cdk synth`, `spec-sync`.
  - _Requirements: 10.1, 10.3_

- [x] 11. Manual teardown (ADR 0013)
  - `GhostStock-Teardown` CodeBuild project in the pipeline stack, outside the
    pipeline, role limited to deleting the app stack; `TeardownProject` output;
    `docs/deployment.md` step 8.
  - Tests: project exists, is not a pipeline action, least-privilege role.
  - _Requirements: 10.3, 11.1_
