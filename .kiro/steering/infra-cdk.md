---
inclusion: fileMatch
fileMatchPattern: "infra/**"
---

# Infrastructure and pipeline (AWS CDK v2, TypeScript)

Security rules: #[[file:.kiro/steering/security.md]]
Decision records: ADR 0006 (single origin), ADR 0008 (one AppStack + pipeline).

## Shape

- `infra/bin/ghoststock.ts` creates only `GhostStockPipelineStack`. The pipeline
  deploys stage `Prod` containing a single `GhostStockAppStack`.
- Region `us-east-1`. Account from CLI credentials (`CDK_DEFAULT_ACCOUNT`).
- L2 constructs first; a few local constructs for readability: `MediaBucket`,
  `ApiFunction` (wraps `NodejsFunction`), `Frontend` (web bucket, distribution,
  deployment).

## Context (`infra/cdk.json`)

Committed (non-sensitive): `region`, `repo` (`cr-montoya/GhostStock`), `branch`
(`main`), `bedrockModelId`, `lowStockDefault` (5), `enableTests` (false),
`budgetUsd` (20).
Never committed: `connectionArn`, `budgetEmail`. Passed with `-c` on the first deploy
and persisted by the pipeline as CodeBuild environment variables. Context is
validated at synth time with `InfraConfigSchema` from `@ghoststock/contracts`.

## Lambdas

- `NodejsFunction`, `nodejs22.x`, arm64, esbuild as a local devDependency (no Docker),
  minify, source maps, `projectRoot` = repo root, `depsLockFilePath` = root
  `pnpm-lock.yaml`, entries in `services/api/src/handlers/*.ts`.
- Explicit `LogGroup` per function with 14 day retention (not the deprecated
  `logRetention` prop).

## Pipeline rules

- `pipelines.CodePipeline`, `selfMutation: true`, source
  `CodePipelineSource.connection(repo, branch, { connectionArn })`.
- Synth: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm build` (contracts, api, web), then `cd infra && pnpm exec cdk
  synth`; `primaryOutputDirectory: "infra/cdk.out"`. The web build must exist before
  synth because `BucketDeployment` packages `apps/web/dist`.
- CodeBuild image must provide Node.js 22.
- `enableTests` adds a pre step (unit tests + Playwright web e2e) and a post step
  (Playwright smoke against the deployed CloudFront URL).

## Commands

- Always allowed: `pnpm exec cdk synth`, `pnpm exec cdk diff`, tests.
- `cdk deploy` and `cdk destroy` only with the owner's explicit go-ahead in session.
