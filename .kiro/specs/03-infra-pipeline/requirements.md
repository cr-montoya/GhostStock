# Requirements Document: 03-infra-pipeline

## Introduction

All GhostStock cloud resources and the self-mutating CDK Pipeline that deploys every
merge to `main`, in AWS CDK v2 TypeScript. Rules: `infra-cdk.md`, `security.md`.
Decisions: ADR 0006 (single origin), ADR 0008 (one AppStack + pipeline). Owns
`infra/**`, `e2e/smoke/**`, `docs/deployment.md`, `docs/architecture.md`.

## Requirements

### Requirement 1: Configuration

**User Story:** As the operator, I want deploy settings validated and secrets kept out
of git.

#### Acceptance Criteria

1. THE CDK app SHALL read context `region`, `repo`, `branch`, `bedrockModelId`,
   `lowStockDefault`, `enableTests`, `budgetUsd`, `connectionArn` and `budgetEmail`
   and validate them with `InfraConfigSchema`; synth SHALL fail with a clear message
   on invalid values.
2. `infra/cdk.json` SHALL NOT contain `connectionArn`, `budgetEmail` or an account id.

### Requirement 2: Self-mutating pipeline

**User Story:** As the team, I want every merge to `main` to build, update the pipeline
and deploy, so that `main` is always what runs.

#### Acceptance Criteria

1. THE pipeline stack SHALL define `pipelines.CodePipeline` with `selfMutation: true`
   and a CodeConnections GitHub source on `repo` and `branch`.
2. THE synth step SHALL run `pnpm install --frozen-lockfile`, `pnpm build` and `pnpm exec cdk synth` in `infra`
   with `primaryOutputDirectory` `infra/cdk.out`, on a CodeBuild image with Node.js 22.
3. THE pipeline SHALL persist `connectionArn` and `budgetEmail` as synth step
   environment variables and pass them back as `-c` context, so later self-mutations
   synthesize the same pipeline without manual input.
4. THE pipeline SHALL deploy stage `Prod` containing `GhostStockAppStack`.

### Requirement 3: Optional test stages

**User Story:** As the owner, I want automated test gates that I can switch on once
the MVP works.

#### Acceptance Criteria

1. WHILE `enableTests` is `false`, THE pipeline SHALL have no test steps.
2. WHEN `enableTests` is `true`, THE `Prod` stage SHALL have a pre step running unit
   tests and the Playwright `web-desktop` project (Chromium) and a post step running
   the Playwright `smoke` project with `BASE_URL` from the stack output.
3. IF any test step fails, THEN THE pipeline SHALL stop before or after deploy
   accordingly and report the failure.

### Requirement 4: Storage

**User Story:** As the security reviewer, I want private, encrypted storage with the
right lifecycle.

#### Acceptance Criteria

1. THE app stack SHALL create a web bucket and a media bucket with Block Public Access
   (all four), SSE-S3, `enforceSSL`, and object ownership enforced.
2. THE media bucket SHALL expire `tmp/` objects after 1 day, abort incomplete uploads
   after 1 day, and allow CORS `POST` from any origin only.
3. THE app stack SHALL create the DynamoDB table with string `PK` and `SK`,
   on-demand billing, AWS-managed encryption and point-in-time recovery.

### Requirement 5: Functions and API

**User Story:** As the API lane, I want my handlers deployed with least privilege.

#### Acceptance Criteria

1. THE app stack SHALL create `uploads`, `analyses` and `inventory` functions with
   `NodejsFunction` (Node.js 22, arm64, esbuild without Docker) from
   `services/api/src/handlers/*.ts`, with the memory, timeout, reserved concurrency,
   environment and explicit 14 day log groups from `security.md`.
2. EACH function role SHALL contain only the actions and resources in the
   `security.md` IAM table; Bedrock access SHALL cover the configured inference
   profile ARN and the matching foundation model ARNs.
3. THE app stack SHALL create an HTTP API with the routes of `architecture.md` plus a
   `$default` route to the inventory function (JSON `NOT_FOUND` envelope), default
   stage throttling (burst 10, rate 5), JSON access logs (14 days), and no
   CORS configuration.

### Requirement 6: CloudFront single origin

**User Story:** As the user, I want one secure address for the app, the API and the
photos.

#### Acceptance Criteria

1. THE app stack SHALL create one distribution with: default behavior to the web
   bucket through OAC with a CloudFront Function rewriting extensionless paths to
   `/index.html`; `/api/*` to the HTTP API with caching disabled, all methods, and all
   viewer headers except Host; `/media/*` to the media bucket through OAC with caching
   optimized.
2. THE distribution SHALL redirect HTTP to HTTPS, enable HTTP/2 and 3, and attach the
   response headers policy from `security.md`, with the media bucket host, in both the regional and the global S3 form, in `connect-src`.
3. THE distribution SHALL NOT use distribution-wide custom error responses.
4. WHERE a custom domain certificate is configured, THE distribution SHALL require TLS
   1.2 or later. (The default `*.cloudfront.net` certificate fixes the viewer TLS
   policy, so this applies only with a custom domain.)

### Requirement 7: Frontend publishing

**User Story:** As the team, I want the web app published and the cache invalidated on
every deploy.

#### Acceptance Criteria

1. THE app stack SHALL deploy `apps/web/dist` to the web bucket with
   `BucketDeployment`, passing the distribution and `distributionPaths: ["/*"]`.
2. THE app stack SHALL output `BaseUrl` (`https://<distribution domain>`).

### Requirement 8: Cost guardrail

**User Story:** As the owner, I want to know before the demo costs surprise me.

#### Acceptance Criteria

1. WHERE `budgetEmail` is provided, THE app stack SHALL create a monthly AWS Budgets
   cost budget of `budgetUsd` with email notifications at 80% and 100% of actual cost.

### Requirement 9: Compliance checks

**User Story:** As the reviewer, I want automated well-architected checks at synth.

#### Acceptance Criteria

1. THE CDK app SHALL apply cdk-nag `AwsSolutionsChecks` to every stack.
2. EVERY remaining finding SHALL be suppressed at resource level with a written reason.
3. THE infra tests SHALL fail if any unsuppressed cdk-nag error exists.

### Requirement 10: Tests and safety

**User Story:** As the reviewer, I want infrastructure behavior proven before deploy.

#### Acceptance Criteria

1. THE infra workspace SHALL have Vitest tests with `aws-cdk-lib/assertions` for
   Requirements 2 to 9, with asset bundling skipped in tests.
2. THE `e2e/smoke` Playwright project SHALL verify, against `BASE_URL`: the dashboard
   renders in Spanish, `/api/products` and `/api/settings` return contract-valid
   bodies, an upload slot can be obtained, security headers are present, and an
   unknown `/api` path returns the JSON `NOT_FOUND` envelope (not `index.html`).
3. NO agent SHALL run `cdk deploy` or `cdk destroy` without the owner's explicit
   go-ahead in the session.

### Requirement 11: Living documentation

**User Story:** As anyone deploying GhostStock, I want a reproducible first deployment.

#### Acceptance Criteria

1. `docs/deployment.md` SHALL describe, step by step: prerequisites, Bedrock model
   access, `cdk bootstrap`, creating and authorizing the CodeConnections GitHub
   connection, the first `cdk deploy` with context, finding `BaseUrl`, turning on
   `enableTests`, and teardown.
2. `docs/architecture.md` SHALL contain the runtime and pipeline diagrams (Mermaid)
   and the AWS service responsibilities, consistent with the deployed stack.
