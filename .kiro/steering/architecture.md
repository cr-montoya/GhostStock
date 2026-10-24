# Architecture

## Repository layout

npm workspaces monorepo, TypeScript everywhere (ADR 0002).

```
apps/web/            React 18 + Vite + Tailwind CSS + shadcn/ui + Motion
services/api/        AWS Lambda handlers + Bedrock + DynamoDB + S3
packages/contracts/  zod schemas, TypeScript types, shared fixtures
infra/               AWS CDK v2, self-mutating CDK Pipeline
```

Node.js 22 (pinned in `.nvmrc` and in the CodeBuild image).
One `npm ci` installs everything; one `npx cdk synth` validates infra.

## Runtime architecture

```
Browser
  └─ CloudFront (HTTPS, security headers)
       ├─ /             → S3 origin (React SPA)
       └─ /api/*        → API Gateway (HTTP API)
                              └─ Lambda functions (Node.js 22, esbuild bundle)
                                   ├─ POST /api/analyze   → Bedrock (Claude 3 Sonnet)
                                   ├─ POST /api/items      → DynamoDB
                                   ├─ GET  /api/items      → DynamoDB
                                   ├─ GET  /api/items/:id  → DynamoDB
                                   ├─ PUT  /api/items/:id  → DynamoDB
                                   ├─ DELETE /api/items/:id→ DynamoDB
                                   └─ GET  /api/items/export → DynamoDB → CSV
                              └─ S3 (photo uploads via presigned POST)
```

## Key design decisions

- **Contracts first.** `packages/contracts` owns every zod schema and TypeScript type
  shared between the API and the web app. Neither side redefines a shape locally.
- **Thin Lambda handlers.** Business logic lives in pure functions tested with Vitest
  and `aws-sdk-client-mock`. Handlers only parse, validate, call, and serialize.
- **Bedrock via Converse API.** Structured output uses forced tool use (tool_choice =
  "any"). The response is validated with the zod schema from contracts; invalid or
  empty is an explicit error state, never a fabricated success.
- **Single-table DynamoDB.** PK = `ITEM#<ulid>`. GSIs for category and createdAt
  queries (dashboard sorting, stats).
- **Presigned POST for uploads.** The browser uploads directly to S3; the Lambda never
  touches image bytes in transit. Presigned POST constrains content-type and
  content-length-range.
- **CDK Pipeline (self-mutating).** `infra/` defines the pipeline; merging to `main`
  deploys automatically.

## Spec lanes

| Spec | Workspace path | Unblocked by |
| --- | --- | --- |
| `00-contracts` | `packages/contracts/` | — |
| `01-api-bedrock` | `services/api/` | `00-contracts` merged |
| `02-web` | `apps/web/` | `00-contracts` merged |
| `03-infra-pipeline` | `infra/` | `00-contracts` merged |

Specs 01, 02 and 03 run in parallel worktrees after contracts merge.

## Test strategy

| Layer | Runner | Approach |
| --- | --- | --- |
| `packages/contracts` | Vitest | schema round-trip, fixture validation |
| `services/api` | Vitest | unit tests with `aws-sdk-client-mock`; handler integration tests with `@aws-sdk/client-lambda` against a local emulator if available |
| `apps/web` | Vitest + Testing Library | component logic, critical flows; MSW handlers from contract examples |
| `infra` | Vitest + `aws-cdk-lib/assertions` | snapshot + fine-grained assertions |
