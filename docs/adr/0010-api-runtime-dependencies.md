# ADR 0010: API runtime dependencies

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** `.kiro/specs/01-api-bedrock/`

## Context

The supply-chain rule requires every runtime dependency of `services/api` to be
justified. The Lambda bundle should stay small and use official packages only.

## Options considered

1. **Modular AWS SDK v3 clients, Powertools for logging and metrics, `ulid`**.
2. **Hand-rolled logging and EMF**: rejected, more code to get wrong.
3. **A web framework (Express, Hono) inside Lambda**: rejected, three small routers do
   not need one.

## Decision

Runtime: `@ghoststock/contracts`, `@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`,
`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-bedrock-runtime`
(official AWS), `@aws-lambda-powertools/logger` and `@aws-lambda-powertools/metrics`
(official AWS), `ulid` (time-sortable ids used as sort keys). All bundled by esbuild.

## Consequences

- **Positive:** official, maintained packages; structured logs and metrics for free.
- **Negative:** Powertools adds a few hundred KB to the bundle.
- **Follow-up:** any new runtime dependency needs its own ADR.

## Well-Architected notes

Security: minimal, official supply chain. Operational excellence: consistent
observability.
