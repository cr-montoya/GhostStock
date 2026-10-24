# ADR 0013: Manual teardown that keeps the pipeline

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** `.kiro/specs/03-infra-pipeline/`

## Context

After the hackathon the app should stop costing money, but the pipeline should stay
ready to bring it back. Deleting stacks by hand is error prone, and a teardown step
inside the pipeline would run on every execution.

## Options considered

1. **A standalone CodeBuild project `GhostStock-Teardown` in the pipeline stack**,
   started only by a person: deletes `Prod-GhostStockAppStack` and waits.
2. **A pipeline stage with manual approval**: rejected, every run would stop at it and
   one wrong click destroys production.
3. **Delete everything, pipeline included**: rejected, redeploying needs the manual
   first deploy again.

## Decision

The pipeline stack defines `GhostStock-Teardown`, never wired into the pipeline. Its
role may only delete and describe the app stack and pass the CDK bootstrap
CloudFormation execution role. Buckets empty themselves on delete
(`autoDeleteObjects`), and the table, functions, API, distribution and budget go with
the stack. A V2 pipeline with no executions has no cost. Starting the pipeline
redeploys the app.

## Consequences

- **Positive:** one command to stop paying, one command to come back.
- **Negative:** the pipeline artifacts bucket and logs remain (cents per month).
- **Follow-up:** resources added outside CloudFormation (for example a manual inline
  IAM policy) must be removed before teardown or the stack deletion fails.
