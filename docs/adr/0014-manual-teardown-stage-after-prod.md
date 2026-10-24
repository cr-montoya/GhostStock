# ADR 0014: Manual teardown stage after Prod

- **Status:** accepted, supersedes 0013
- **Date:** 2026-10-24
- **Spec:** `.kiro/specs/03-infra-pipeline/`

## Context

ADR 0013 added a standalone CodeBuild project to delete the app. The owner prefers the
teardown to live in the pipeline itself, as a manual step after Prod, so the whole
lifecycle (deploy and destroy) is visible in one place.

## Options considered

1. **A `Teardown` wave after Prod: manual approval, then a CodeBuild step** that
   deletes `Prod-GhostStockAppStack` and waits.
2. **Keep the standalone project (ADR 0013)**: rejected by the owner, it lives outside
   the pipeline view.

## Decision

Every pipeline run deploys Prod and then waits at `Teardown/ApproveTeardown`. Nobody
has to act: an unanswered approval simply expires after 7 days and the next run
supersedes it. Approving runs `DestroyApp`, whose role may only delete and describe
the app stack and pass the CDK bootstrap CloudFormation execution role. Buckets empty
themselves (`autoDeleteObjects`). The pipeline stays, and a V2 pipeline with no runs
has no cost; starting it again redeploys the app.

## Consequences

- **Positive:** deploy and destroy in one place, protected by an explicit approval.
- **Negative:** each run shows as in progress until the approval is answered or
  expires; an approval is one click away from deleting production, so approve only
  on purpose.
- **Follow-up:** resources added outside CloudFormation must be removed first, or
  the stack deletion fails.
