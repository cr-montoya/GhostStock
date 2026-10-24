# ADR 0002: TypeScript-only monorepo, CDK included

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** `.kiro/specs/00-contracts/`, `.kiro/specs/03-infra-pipeline/`

## Context

The frontend (React) and the backend (Lambda) are TypeScript. The infrastructure could
be CDK in Python or TypeScript. The hackathon window is one day and three agents
build in parallel against shared contracts.

## Options considered

1. **CDK in TypeScript, npm workspaces**: one language, one toolchain, one test runner.
2. **CDK in Python**: rejected because it adds a second toolchain to CodeBuild and to
   every agent's context, and the infra cannot import the shared zod contracts
   (for example to validate `cdk.json` environment config at synth time).

## Decision

Single npm-workspaces monorepo, strict TypeScript everywhere: `apps/web`,
`services/api`, `packages/contracts`, `infra` (CDK v2). Lambdas use `NodejsFunction`
with esbuild as a local devDependency, so bundling needs no Docker. Vitest across
workspaces; infra tests use `aws-cdk-lib/assertions`.

## Consequences

- **Positive:** one `npm ci`, one synth step, shared types end to end, simpler pipeline.
- **Negative:** esbuild must be installed wherever `cdk synth` runs (local and CodeBuild).
- **Follow-up:** pin Node.js 22 in `.nvmrc` and in the CodeBuild image.

## Well-Architected notes

Operational excellence and reliability: fewer moving parts in the build path.
