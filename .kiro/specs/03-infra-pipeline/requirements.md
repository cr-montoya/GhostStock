# Requirements: 03-infra-pipeline

## Overview

AWS CDK v2 TypeScript stack defining all cloud resources and a self-mutating CDK
Pipeline that deploys every merge to `main`. No manual console changes are acceptable
as a solution; manual one-time steps are documented in `docs/deployment.md`.

## Requirements

### EARS-1 — Self-mutating CDK Pipeline
THE SYSTEM SHALL define a self-mutating CDK Pipeline (CodePipeline + CodeBuild) that
triggers on every push to `main` of the connected GitHub repository, updates itself
first (UpdatePipeline stage), then deploys the application stage.

### EARS-2 — GitHub source connection
THE SYSTEM SHALL use a CodeConnections (formerly CodeStar Connections) connection ARN
(supplied via `cdk.json` context) to connect to the GitHub repository.
The one-time connection authorization step SHALL be documented in `docs/deployment.md`.

### EARS-3 — Application stage resources
THE SYSTEM SHALL provision in a single application stage:
S3 upload bucket, S3 SPA bucket, CloudFront distribution (HTTPS only, OAC,
security headers), API Gateway HTTP API, Lambda functions (analyze, items-write,
items-read, presign, export), DynamoDB table with GSI, Bedrock model access grant.

### EARS-4 — CloudFront configuration
THE SYSTEM SHALL configure CloudFront with:
HTTPS-only (HTTP → HTTPS redirect), minimum TLS 1.2, OAC for the SPA bucket,
a response headers policy including HSTS, X-Content-Type-Options, X-Frame-Options
DENY, Referrer-Policy, and a restrictive CSP with actual bucket and API domain values.

### EARS-5 — Lambda configuration
THE SYSTEM SHALL deploy each Lambda with:
`nodejs22.x` runtime, `NodejsFunction` with esbuild bundler (no Docker),
per-function IAM roles scoped to exact actions and resources as specified in
`security.md`, memory and timeout values per `security.md`, X-Ray tracing active
for `analyzeHandler`.

### EARS-6 — DynamoDB table
THE SYSTEM SHALL create the `GhostStockItems` table with:
on-demand billing, encryption at rest (AWS-managed key), point-in-time recovery
enabled, and the `CategoryCreatedAtIndex` GSI (PK = `category`, SK = `createdAt`).

### EARS-7 — S3 bucket security
THE SYSTEM SHALL configure both S3 buckets with Block Public Access on all four
settings. The upload bucket SHALL have a lifecycle rule deleting objects under
`uploads/` after 1 day. The SPA bucket SHALL use OAC, not OAI or public ACLs.

### EARS-8 — API Gateway throttling
THE SYSTEM SHALL configure default route throttling on the HTTP API at
10 req/s burst, 5 req/s steady state.

### EARS-9 — CORS configuration
THE SYSTEM SHALL configure CORS on the HTTP API to allow the CloudFront distribution
domain only (no wildcard) in production.

### EARS-10 — Environment variable injection
THE SYSTEM SHALL inject `TABLE_NAME`, `UPLOAD_BUCKET`, and `BEDROCK_MODEL_ID`
into each Lambda's environment via CDK, never hard-coded.

### EARS-11 — cdk-nag compliance
THE SYSTEM SHALL run the `AwsSolutions` cdk-nag rule pack at synth time. All findings
SHALL be fixed or suppressed with `NagSuppressions.addResourceSuppressions` and a
written reason string.

### EARS-12 — Budget alarm
THE SYSTEM SHALL create a CloudWatch billing alarm at $20 USD that sends a
notification to an SNS topic with an owner email subscriber (email supplied via
`cdk.json` context).

### EARS-13 — CDK synth and assertion tests
THE SYSTEM SHALL include CDK assertion tests that verify key resource properties
(Lambda runtimes, DynamoDB encryption, S3 block public access, CloudFront HTTPS,
cdk-nag passing) and pass on every `npm test` run.

### EARS-14 — No cdk deploy without explicit approval
THE infra-dev agent SHALL NOT run `cdk deploy` or `cdk destroy` against an account
without the owner's explicit go-ahead in the session. `cdk synth` and `cdk diff`
are always permitted.

### EARS-15 — Deployment documentation
THE SYSTEM SHALL maintain `docs/deployment.md` with step-by-step instructions for:
CDK bootstrap, CodeConnections authorization, Bedrock model access enablement,
and first pipeline run.
