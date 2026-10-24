# ADR 0008: One AppStack and a self-mutating CDK Pipeline

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** `.kiro/specs/03-infra-pipeline/`

## Context

The first draft split resources into five stacks. OAC bucket policies reference the
distribution while the distribution references the buckets, which creates cross-stack
cycles; the web assets were deployed from a stack that did not own the distribution,
and the synth step never built the web app. The pipeline also needs a connection ARN
and an alert email that must not be committed.

## Options considered

1. **Pipeline stack plus one stage with a single AppStack**, deploy-time values
   persisted by the pipeline as CodeBuild environment variables.
2. **Several stacks with SSM parameter handoffs**: rejected, complexity without a
   benefit at this size.
3. **Values in `cdk.json`**: rejected, account identifiers and emails in a public repo.

## Decision

`GhostStockPipelineStack` (CodePipeline, `selfMutation: true`, CodeConnections GitHub
source) deploys stage `Prod` with `GhostStockAppStack`. Synth runs `npm ci`,
`npm run build`, `cdk synth` in `infra`. `connectionArn` and `budgetEmail` are passed
with `-c` on the first manual deploy, stored as synth step environment variables and
passed back as `-c` on every self-mutation. `enableTests` adds a pre step (unit and
Playwright web tests) and a post step (Playwright smoke on `BaseUrl`). Infra
dependencies: `aws-cdk-lib`, `constructs`, `cdk-nag`; dev `aws-cdk`, `esbuild`.

## Consequences

- **Positive:** no cycles, one deploy unit, reproducible pipeline without secrets in
  git, tests switchable by a reviewed PR.
- **Negative:** one stack to roll back as a whole; acceptable for an MVP.
- **Follow-up:** add a `Staging` stage before `Prod` when there is a second environment.

## Well-Architected notes

Operational excellence: everything as code, deploys from `main` only. Security: no
committed identifiers, cdk-nag at synth.
