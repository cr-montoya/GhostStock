# Security

All agents read this file before writing any code that touches IAM, S3, API Gateway,
Lambda, DynamoDB, CloudFront, or Bedrock. Violations block the merge (see gate matrix
in AGENTS.md).

## Secrets

- No secrets, credentials, API keys, or account IDs in source code, config files,
  test fixtures, logs, or the frontend bundle.
- Environment variables are injected by CDK at deploy time via `environment` on
  `NodejsFunction`. Never hard-coded, never committed.
- `.env*` files are git-ignored and must never be read by agents.
- The pre-commit hook runs a secret scan on every staged file.

## IAM — least privilege

- Every Lambda function gets its own IAM role with only the actions it needs on
  exactly the resources it owns (by ARN or ARN pattern, never `*` resource without a
  written suppression comment).
- Required actions by function:
  | Function | Actions |
  | --- | --- |
  | `analyzeHandler` | `bedrock:InvokeModel`, `s3:GetObject` on the upload bucket (scoped to `uploads/*`) |
  | `itemsWriteHandler` | `dynamodb:PutItem`, `dynamodb:UpdateItem`, `dynamodb:DeleteItem` on the items table |
  | `itemsReadHandler` | `dynamodb:GetItem`, `dynamodb:Query`, `dynamodb:Scan` on the items table and its GSIs |
  | `uploadPresignHandler` | `s3:PutObject` on the upload bucket (scoped to `uploads/*`) |
- `cdk-nag` (`AwsSolutions` rule pack) runs at synth time. All findings are fixed or
  suppressed with `NagSuppressions.addResourceSuppressions` and a written reason.

## S3

- Upload bucket: Block Public Access enabled on all four settings. No bucket policy
  that allows public reads.
- Object access: CloudFront OAC for the SPA bucket; presigned URLs for upload reads
  (short expiry, scoped key prefix `uploads/<ulid>`).
- Presigned POST constraints:
  - `Content-Type`: one of `image/jpeg`, `image/png`, `image/webp`.
  - `content-length-range`: 1 byte to 5 242 880 bytes (5 MB).
  - Expiry: 300 seconds.
  - Key prefix: `uploads/` only.
- Lifecycle rule: delete objects under `uploads/` after 1 day (they are only needed
  for the Bedrock call).

## API Gateway

- HTTP API (not REST API). No API key auth for the demo (single-user, no PII).
- Throttling: default route throttling 10 req/s burst, 5 req/s steady.
- Payload limit: 10 MB (API Gateway default); the Lambda rejects images > 5 MB before
  calling Bedrock.
- All routes validate input with zod before any AWS SDK call.
- CORS: allow origin set to the CloudFront distribution domain only (no wildcard in
  production). Local dev may use `http://localhost:5173`.

## Lambda

- Runtime: `nodejs22.x`. No deprecated runtimes.
- Memory: 256 MB for handlers (512 MB for `analyzeHandler` which fetches image
  metadata). Timeout: 30 s (analyze), 10 s (CRUD), 5 s (presign).
- Reserved concurrency on `analyzeHandler`: 5 (prevents runaway Bedrock spend).
- Structured JSON logs via `console.log(JSON.stringify({...}))`. Never log:
  image bytes, base64 strings, presigned URLs, full request bodies containing images,
  or any field whose name contains `password`, `token`, `secret`, or `key`.
- X-Ray tracing: `Active` for `analyzeHandler`; `PassThrough` for others.

## DynamoDB

- Encryption at rest: AWS-managed key (default). No unencrypted tables.
- Point-in-time recovery: enabled.
- No `Scan` with no filter expression in production code (use GSI queries).
- All attribute names and values come through zod-validated objects; no raw string
  concatenation into DynamoDB expressions.

## CloudFront

- HTTPS only. HTTP → HTTPS redirect. Minimum TLS 1.2.
- Response headers policy: `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Content-Security-Policy` (see below).
- CSP for the SPA:
  ```
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://<upload-bucket>.s3.<region>.amazonaws.com;
  connect-src 'self' https://<api-domain>;
  frame-ancestors 'none';
  ```
  The CDK construct fills in the actual bucket and API domain at synth time.

## Bedrock

- Bedrock output is untrusted. It is validated with the zod schema from
  `packages/contracts` before any use.
- Never render raw Bedrock text output as HTML. All candidates are rendered as
  plain text (React's default escaping is sufficient; no `dangerouslySetInnerHTML`).
- Budget alarm: CloudWatch billing alarm at $20 USD notifies the owner's email.
  Defined in the CDK stack.

## Supply chain

- All new runtime dependencies require an ADR entry explaining why they were added and
  confirming the package is the canonical, actively maintained one (no typosquatting).
- `package-lock.json` is committed and must be up to date.
- `npm audit` must report no Critical or High vulnerabilities before merge.
