---
inclusion: always
---

# Security

Every agent touching IAM, S3, API Gateway, Lambda, DynamoDB, CloudFront or Bedrock
follows this file. Violations block the merge (`security-reviewer`, AGENTS.md).

## Secrets and identifiers

- No secrets, credentials, account IDs, connection ARNs or emails committed anywhere:
  code, `cdk.json`, fixtures, logs, docs, frontend bundle.
- Deploy-time values (`connectionArn`, `budgetEmail`) are passed as `-c` context on the
  first `cdk deploy` and persisted as CodeBuild environment variables by the pipeline
  stack itself (spec 03). The account comes from the CLI credentials.
- `.env*` is git-ignored and never read by agents. The pre-commit gate scans secrets.

## IAM, least privilege

One role per function, exact actions, exact resources. No `*` resource without a
cdk-nag suppression and a written reason.

| Function | Allowed |
| --- | --- |
| uploads | `s3:PutObject` on `media-bucket/tmp/*` (needed to sign the presigned POST) |
| analyses | `s3:GetObject` on `media-bucket/tmp/*`; `bedrock:InvokeModel` on the configured inference profile and its foundation models |
| inventory | `dynamodb:GetItem, PutItem, UpdateItem, DeleteItem, Query, BatchWriteItem` on the table; `s3:GetObject` on `tmp/*`; `s3:PutObject` on `media/products/*` |

cdk-nag `AwsSolutions` runs at synth; findings are fixed or suppressed with a reason.

## S3

- Two buckets (web, media), Block Public Access on all four settings, SSE-S3,
  `enforceSSL`, no ACLs. Reads only through CloudFront OAC.
- Media key layout: `tmp/<ulid>.<ext>` (raw uploads, lifecycle delete after 1 day)
  and `media/products/<ulid>.<ext>` (saved product photos, kept).
- Presigned POST: exact key `tmp/<ulid>.<ext>` chosen by the server, `Content-Type`
  equal to the requested one (`image/jpeg | image/png | image/webp`),
  `content-length-range` 1 to 5 242 880, expiry 300 s.
- Media bucket CORS allows `POST` from any origin: the signed policy is the
  authorization, and a distribution-scoped origin would create a CloudFormation cycle
  (ADR 0006). No other method is allowed by CORS.
- Every `imageKey` received by the API must match
  `^tmp/[0-9A-HJKMNP-TV-Z]{26}\.(jpg|png|webp)$` (no traversal, no foreign keys).

## API Gateway and Lambda

- HTTP API, no auth (single-workspace demo). Stage throttling: burst 10, rate 5.
  Access logs enabled (JSON, 14 days).
- Every route validates input with zod before any AWS SDK call. Bodies over 64 KB are
  rejected (images never travel through the API).
- Runtime `nodejs22.x`, arm64. Timeouts: analyses 28 s (under the 30 s HTTP API
  limit), others 10 s. Memory: analyses 1024 MB, others 256 MB.
- Reserved concurrency 5 on analyses (caps Bedrock spend).
- Structured JSON logs (Powertools Logger). Never log image bytes, base64, presigned
  URLs or POST fields. Log `requestId`, `imageKey`, `modelId`, latency, error code.
- Log retention 14 days.

## DynamoDB

- On-demand, AWS-managed encryption, point-in-time recovery on.
- No Scan in application code. Expressions built with placeholders only.

## CloudFront

- HTTPS only (redirect), TLS 1.2 minimum, HTTP/2 and 3.
- Response headers policy: HSTS (1 year, includeSubDomains), `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  and CSP:
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:; font-src 'self';
  connect-src 'self' https://<media-bucket>.s3.<region>.amazonaws.com;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  ```
  `'unsafe-inline'` for styles only (Motion writes inline style attributes). Fonts are
  self-hosted (no third-party font CDN).
- `/api/*`: caching disabled, all viewer headers except Host forwarded.
- SPA routing via a CloudFront Function on the default behavior (rewrite extensionless
  paths to `/index.html`), never via distribution-wide error responses, which would
  swallow API 404s.

## Bedrock

- Output is untrusted: validated with zod, rendered as plain text only, never as HTML.
- One Converse call per analysis; retry only on throttling (2 retries, backoff).

## Cost guardrails

- AWS Budgets monthly cost budget of 20 USD with email alerts at 80% and 100%.
- Throttling + reserved concurrency + 5 MB upload cap bound Bedrock spend.

## Supply chain

- New runtime dependency in `services/api` or `infra`, or a new workspace, requires an
  ADR (commit-msg gate). `package-lock.json` committed.
- `npm audit --omit=dev` with no Critical or High before merge.
