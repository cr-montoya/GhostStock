# Deployment

How to take GhostStock from a clean AWS account to a running pipeline. After the first
deploy, every merge to `main` builds, updates the pipeline and deploys by itself
([ADR 0008](adr/0008-one-app-stack-and-self-mutating-pipeline.md)).

Spec: [`.kiro/specs/03-infra-pipeline/`](../.kiro/specs/03-infra-pipeline/requirements.md).
Infra code: [`infra/`](../infra/).

> Agents never run `cdk deploy`, `cdk bootstrap` or `cdk destroy`. The owner runs the
> commands below, or gives an explicit go-ahead in the session (AGENTS.md hard rule 6).

## What gets deployed

| Stack | Deployed by | Holds |
| --- | --- | --- |
| `GhostStockPipeline` | the owner, once, by hand | CodePipeline `GhostStock` (V2), its CodeBuild projects and artifacts bucket |
| `Prod-GhostStockAppStack` | the pipeline, on every merge to `main` | buckets, table, functions, HTTP API, CloudFront, budget |

Region `us-east-1`. The account comes from your CLI credentials.

## Prerequisites

- Node.js 22 (`.nvmrc`) and pnpm through corepack:
  ```sh
  corepack enable
  pnpm install --frozen-lockfile
  ```
- AWS CLI v2 signed in to the target account with administrator rights, region
  `us-east-1`. Check with `aws sts get-caller-identity`.
- The infra PR merged into `main`: the pipeline builds from `main`, never from a local
  branch.
- Lambda concurrency quota of at least 15. The analyses function reserves 5, and Lambda
  keeps 10 unreserved, so an account limited to 10 fails the first Prod deploy with
  "decreases account's UnreservedConcurrentExecution below its minimum value". Check:
  ```sh
  aws lambda get-account-settings --region us-east-1 --query AccountLimit.ConcurrentExecutions
  ```
  If it prints less than 15, request an increase in Service Quotas (Lambda, Concurrent
  executions) before deploying.

## 1. Bedrock model access

The analyses function calls the US cross-region inference profile set in
`infra/cdk.json` (`bedrockModelId`, default Claude Sonnet 4.5).

1. Open the Amazon Bedrock console in `us-east-1`, go to **Model access**.
2. Enable **Anthropic Claude Sonnet 4.5** (and **Claude Haiku 4.5**, the fallback in
   `.kiro/steering/ai-integration.md`). Anthropic models ask for a one-time use case
   form; access is usually granted within minutes.
3. Verify:
   ```sh
   aws bedrock list-inference-profiles --region us-east-1 \
     --query "inferenceProfileSummaries[?inferenceProfileId=='us.anthropic.claude-sonnet-4-5-20250929-v1:0'].status"
   ```

Without access the app still deploys; analyses return the model error state.

## 2. CDK bootstrap (once per account and region)

```sh
cd infra
pnpm exec cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

Skip it if the `CDKToolkit` stack already exists in `us-east-1`.

## 3. GitHub connection (CodeConnections)

1. Create the connection (it starts as `PENDING`):
   ```sh
   aws codeconnections create-connection --provider-type GitHub \
     --connection-name ghoststock-github --region us-east-1
   ```
   Keep the returned `ConnectionArn`. Do not commit it.
2. Authorize it: console **Developer Tools > Settings > Connections**, select
   `ghoststock-github`, **Update pending connection**, install or pick the AWS
   Connector for GitHub app with access to `cr-montoya/GhostStock`.
3. Verify the status is `AVAILABLE`:
   ```sh
   aws codeconnections get-connection --connection-arn <CONNECTION_ARN> \
     --region us-east-1 --query Connection.ConnectionStatus
   ```

## 4. First deploy (owner only)

From the repository root, on an up to date `main`:

```sh
git checkout main && git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
cd infra
pnpm exec cdk deploy GhostStockPipeline \
  -c connectionArn=<CONNECTION_ARN> \
  -c budgetEmail=<ALERT_EMAIL>
```

- `pnpm build` must run first: `BucketDeployment` packages `apps/web/dist`, and
  `cdk synth` fails if it is missing.
- `connectionArn` and `budgetEmail` are stored as plaintext environment variables of
  the pipeline's synth step and passed back as `-c` on every later run, so they never
  live in git (neither is a secret). `budgetEmail` is optional; without it no budget is
  created and synth prints a warning.
- Any later manual `cdk deploy GhostStockPipeline` must pass both `-c` values again:
  without them the stored values are overwritten with empty ones, the Source stage
  breaks and the budget is removed on the next run.
- Without `connectionArn`, synth uses a placeholder and prints a warning; a pipeline
  deployed that way fails at its Source stage.
- The command deploys only the pipeline. The pipeline then runs on its own: Source,
  Build (synth), UpdatePipeline, Assets, Prod. The first run takes about 10 to 15
  minutes, mostly CloudFront.

Watch it:
```sh
aws codepipeline get-pipeline-state --name GhostStock --region us-east-1 \
  --query "stageStates[].{stage:stageName,status:latestExecution.status}"
```

## 5. Find the app URL (`BaseUrl`)

```sh
aws cloudformation describe-stacks --stack-name Prod-GhostStockAppStack --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='BaseUrl'].OutputValue" --output text
```

Open it in a browser: the SPA, the API (`/api/*`) and product photos (`/media/*`) all
live on that one domain ([ADR 0006](adr/0006-single-cloudfront-origin.md)).

## 6. Turn on the test gates (`enableTests`)

When the MVP works end to end, open a PR that sets `"enableTests": true` in
`infra/cdk.json` (the commit needs an ADR or an `ADR-EXEMPT:` line, since `cdk.json`
is the feature-flag contract). After the merge the pipeline mutates itself and adds:

- **Test** before Prod: `pnpm test` plus Playwright `web-desktop` (Chromium).
- **Smoke** after Prod: Playwright `smoke` project with `BASE_URL` from the stack
  output.

A failing Test step stops the deploy; a failing Smoke step marks the run failed after
the deploy.

## 7. Day to day

- Merge to `main` and the pipeline does the rest. Changes to `infra/` update the
  pipeline itself first (self-mutation).
- `cd infra && pnpm exec cdk synth` and `pnpm exec cdk diff` are always safe locally.
- Infra tests: `pnpm --filter @ghoststock/infra test` (bundling skipped).
- Smoke against the deployed stack, any time (read-only: no Bedrock call, no product
  created): `BASE_URL=<BaseUrl> pnpm --filter @ghoststock/e2e test:smoke` (the output already includes `https://`)
  (build `@ghoststock/contracts` first; add `PW_CHANNEL=chrome` to use an installed
  Chrome instead of `playwright install chromium`).

## 8. Teardown (owner only)

### Stop paying, keep the pipeline ([ADR 0013](adr/0013-manual-teardown-keeps-the-pipeline.md))

```sh
aws codebuild start-build --project-name GhostStock-Teardown --region us-east-1
```

Deletes `Prod-GhostStockAppStack` (both buckets are emptied automatically through
`autoDeleteObjects`) and keeps the pipeline, which costs nothing while idle. The project
is never part of a pipeline run. To bring the app back, start the pipeline:

```sh
aws codepipeline start-pipeline-execution --name GhostStock --region us-east-1
```

Remove any IAM policy added by hand to a stack role before tearing down, or the role
deletion fails.

### Delete everything

Destroy the pipeline first, so a merge in between cannot redeploy the app. `cdk
destroy` synthesizes the app, so build first:

```sh
pnpm install --frozen-lockfile
pnpm build
cd infra
pnpm exec cdk destroy GhostStockPipeline -c connectionArn=<CONNECTION_ARN>
aws cloudformation delete-stack --stack-name Prod-GhostStockAppStack --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name Prod-GhostStockAppStack --region us-east-1
```

Buckets, table and log groups of the app stack are deleted with it (demo settings).
Left behind on purpose, delete them by hand if you want a clean account: the pipeline
artifacts bucket (retained by CDK Pipelines), CodeBuild log groups, the log group of
the `autoDeleteObjects` helper Lambda, the CodeConnections connection and the
`CDKToolkit` stack.
