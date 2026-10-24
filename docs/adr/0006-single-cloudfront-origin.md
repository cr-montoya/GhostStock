# ADR 0006: Single CloudFront origin for web, API and media

- **Status:** accepted
- **Date:** 2026-10-24
- **Spec:** `.kiro/specs/03-infra-pipeline/`

## Context

The browser needs the SPA, the API and product photos. Separate domains mean CORS on
the API, an API URL baked into the build or fetched at runtime, and public or
presigned image URLs. The first draft also deleted uploads after one day without a
place for saved photos.

## Options considered

1. **One distribution: default to the web bucket, `/api/*` to the HTTP API,
   `/media/*` to the media bucket, all private behind OAC**.
2. **API Gateway domain plus CORS, presigned GETs for photos**: rejected, more config,
   expiring image URLs, larger attack surface.

## Decision

One CloudFront distribution is the only public entry point. SPA routing uses a
CloudFront Function, not distribution-wide error responses, so API 404s stay JSON.
Uploads go from the browser straight to S3 with a presigned POST under `tmp/`
(lifecycle 1 day); saving copies the photo to `media/products/`, served at
`/media/*`. The media bucket allows CORS `POST` from any origin because the signed
POST policy is the authorization and a distribution-scoped origin would create a
CloudFormation cycle (bucket to distribution to bucket).

## Consequences

- **Positive:** no API CORS, no runtime config, stable image URLs, one set of
  security headers.
- **Negative:** CORS `*` for POST on the media bucket (mitigated by the signed policy,
  exact key, size and type conditions, and 300 s expiry).
- **Follow-up:** a custom domain would only change the distribution aliases.

## Well-Architected notes

Security: private buckets, OAC, single hardened edge. Performance: cached media at the
edge.
