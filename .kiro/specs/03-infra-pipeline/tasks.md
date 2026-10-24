# Tasks: 03-infra-pipeline

## Implementation tasks

- [ ] 1. Scaffold `infra` workspace
  - [ ] 1.1 Create `infra/package.json` with dependencies from design.md
  - [ ] 1.2 Create `infra/tsconfig.json` (strict, CommonJS for CDK compatibility)
  - [ ] 1.3 Create `infra/cdk.json` with `app: "npx ts-node bin/ghoststock.ts"` and context keys: `account`, `region`, `connectionArn`, `repoOwner`, `repoName`, `branch`, `alarmEmail` (placeholder values, never real secrets)
  - [ ] 1.4 Add `infra` to the root workspaces array

- [ ] 2. Reusable constructs
  - [ ] 2.1 `lib/constructs/secure-bucket.ts` — `SecureBucket` with Block Public Access, S3-managed encryption, enforce SSL
  - [ ] 2.2 `lib/constructs/ghost-function.ts` — `GhostFunction` with Node 22, esbuild bundler, log retention, environment pass-through

- [ ] 3. Storage stack (`lib/stacks/storage-stack.ts`)
  - [ ] 3.1 Upload bucket using `SecureBucket` with lifecycle rule (1-day expiry on `uploads/`)
  - [ ] 3.2 SPA bucket using `SecureBucket`
  - [ ] 3.3 Expose both buckets as stack outputs

- [ ] 4. Data stack (`lib/stacks/data-stack.ts`)
  - [ ] 4.1 DynamoDB table with on-demand billing, AWS-managed encryption, PITR
  - [ ] 4.2 `CategoryCreatedAtIndex` GSI
  - [ ] 4.3 Expose table as stack output

- [ ] 5. API stack (`lib/stacks/api-stack.ts`)
  - [ ] 5.1 Create all five Lambda functions using `GhostFunction` with correct handler entry points
  - [ ] 5.2 Inject `TABLE_NAME`, `UPLOAD_BUCKET`, `BEDROCK_MODEL_ID` environment variables
  - [ ] 5.3 Apply per-function IAM grants per design.md (scoped policies, not broad grants)
  - [ ] 5.4 Set `analyzeHandler` tracing to `ACTIVE` and reserved concurrency to 5
  - [ ] 5.5 Create HTTP API with all 8 routes from design.md
  - [ ] 5.6 Apply throttling: burst 10, rate 5
  - [ ] 5.7 Configure CORS to allow CloudFront distribution domain only

- [ ] 6. CDN stack (`lib/stacks/cdn-stack.ts`)
  - [ ] 6.1 Build `ResponseHeadersPolicy` with all security headers from security.md; CSP uses actual resource domain values
  - [ ] 6.2 Create CloudFront distribution with OAC for SPA bucket, `/api/*` behavior for HTTP API, HTTPS-only, TLS 1.2 minimum
  - [ ] 6.3 Deploy SPA build artifact (`apps/web/dist`) to SPA bucket via `BucketDeployment` and invalidate distribution

- [ ] 7. Monitoring stack (`lib/stacks/monitoring-stack.ts`)
  - [ ] 7.1 SNS topic with email subscription from `alarmEmail` context
  - [ ] 7.2 CloudWatch billing alarm at $20 USD on `AWS/Billing` `EstimatedCharges`

- [ ] 8. App stage and pipeline stack
  - [ ] 8.1 `lib/app-stage.ts` — instantiate all five stacks with correct dependency order
  - [ ] 8.2 `lib/pipeline-stack.ts` — self-mutating pipeline with CodeConnections source, `npm ci && npx cdk synth` synth step, `Prod` stage
  - [ ] 8.3 `bin/ghoststock.ts` — CDK app entry point with `AwsSolutionsChecks` aspect

- [ ] 9. cdk-nag suppressions
  - [ ] 9.1 Add `NagSuppressions.addResourceSuppressions` for all expected findings with written reason strings (demo removal policy, billing metric in us-east-1, etc.)

- [ ] 10. Assertion tests
  - [ ] 10.1 `test/storage.test.ts` — S3 Block Public Access on both buckets, lifecycle rule on upload bucket
  - [ ] 10.2 `test/data.test.ts` — DynamoDB encryption, PITR, GSI presence
  - [ ] 10.3 `test/api.test.ts` — Lambda runtime `nodejs22.x`, environment variable keys present, throttling settings
  - [ ] 10.4 `test/cdn.test.ts` — HTTPS-only viewer protocol, minimum TLS version, OAC present
  - [ ] 10.5 `test/pipeline.test.ts` — pipeline stack synthesizes without error

- [ ] 11. Deployment documentation
  - [ ] 11.1 Create `docs/deployment.md` with step-by-step instructions: bootstrap, CodeConnections authorization, Bedrock model access, first pipeline run

- [ ] 12. Build and verify
  - [ ] 12.1 `npm run build` in `infra` exits 0 with no TypeScript errors
  - [ ] 12.2 `npx cdk synth` exits 0 with no cdk-nag errors (unsuppressed findings)
  - [ ] 12.3 `npm test` in `infra` exits 0 with all assertion tests passing
