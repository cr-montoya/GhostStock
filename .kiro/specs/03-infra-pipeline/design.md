# Design Document: 03-infra-pipeline

## Overview

Two stacks. `GhostStockPipelineStack` (deployed once by hand) builds and deploys stage
`Prod`, which holds a single `GhostStockAppStack` with every runtime resource. One app
stack avoids cross-stack cycles between buckets, OAC policies and the distribution
(ADR 0008).

## Structure

```
infra/
  bin/ghoststock.ts          new App, buildGhostStockApp(app), synth
  lib/
    app.ts                   buildGhostStockApp: config, PipelineStack, cdk-nag
                             aspect on the pipeline stack (shared with tests)
    config.ts                readConfig(node): InfraConfig (InfraConfigSchema)
    paths.ts                 repo root, handlers dir, web dist, lockfile, api tsconfig
    pipeline-stack.ts        GhostStockPipelineStack
    app-stage.ts             GhostStockAppStage (exposes baseUrl CfnOutput)
    app-stack.ts             GhostStockAppStack
    constructs/
      media-bucket.ts        MediaBucket (lifecycle, CORS POST)
      api-function.ts        ApiFunction (NodejsFunction defaults + LogGroup)
      frontend.ts            Frontend (web bucket, distribution, spa function,
                             headers policy, BucketDeployment)
    functions/spa-rewrite.js CloudFront Function source
    nag.ts                   suppressions with reasons, in one place
  test/*.test.ts             Vitest + assertions
  test/fixtures/             stand-in handlers and web dist for tests
  cdk.json, package.json, tsconfig.json, vitest.config.ts
```

## Pipeline

```mermaid
flowchart LR
  GH[GitHub main] --> SRC[Source: CodeConnections]
  SRC --> SY[Synth: pnpm install, pnpm build, cdk synth]
  SY --> UP[UpdatePipeline: self-mutation]
  UP --> AS[Assets: publish Lambda zips and web assets]
  AS --> PRE{enableTests?}
  PRE -- yes --> T1[Pre: unit + Playwright web-desktop]
  PRE -- no --> DEP
  T1 --> DEP[Deploy Prod/GhostStockAppStack]
  DEP --> POST{enableTests?}
  POST -- yes --> T2[Post: Playwright smoke on BaseUrl]
```

```ts
// Local `cdk synth`, `cdk diff` and the tests run without deploy-time context, so a
// missing connectionArn uses a placeholder and adds a warning annotation (a pipeline
// deployed with it fails at its source stage; nothing else is affected).
const source = pipelines.CodePipelineSource.connection(cfg.repo, cfg.branch, {
  connectionArn: cfg.connectionArn ?? PLACEHOLDER_CONNECTION_ARN,
});
const synth = new pipelines.ShellStep("Synth", {
  input: source,
  // The placeholder is never persisted: an empty value means "not set" on the next run.
  env: { CONNECTION_ARN: cfg.connectionArn ?? "", BUDGET_EMAIL: cfg.budgetEmail ?? "" },
  commands: [
    "corepack enable",
    "pnpm install --frozen-lockfile",
    "pnpm build",
    'cd infra && pnpm exec cdk synth -c "connectionArn=$CONNECTION_ARN" -c "budgetEmail=$BUDGET_EMAIL"',
  ],
  primaryOutputDirectory: "infra/cdk.out",
});
const pipeline = new pipelines.CodePipeline(this, "Pipeline", {
  pipelineName: "GhostStock",
  pipelineType: PipelineType.V2,
  selfMutation: true,
  crossAccountKeys: false, // single account, no KMS key cost
  synth,
  codeBuildDefaults: {
    buildEnvironment: { buildImage: LinuxBuildImage.STANDARD_8_0 },
    partialBuildSpec: BuildSpec.fromObject({
      phases: { install: { "runtime-versions": { nodejs: "22" } } },
    }),
  },
});
const prod = new GhostStockAppStage(this, "Prod", { env, config: cfg });
pipeline.addStage(prod, cfg.enableTests ? {
  pre: [new pipelines.ShellStep("Test", { input: source, commands: [
    "corepack enable", "pnpm install --frozen-lockfile", "pnpm build", "pnpm test",
    "pnpm --filter @ghoststock/e2e exec playwright install --with-deps chromium",
    "pnpm --filter @ghoststock/e2e exec playwright test --project=web-desktop",
  ]})],
  post: [new pipelines.ShellStep("Smoke", {
    input: source,
    envFromCfnOutputs: { BASE_URL: prod.baseUrl },
    commands: ["corepack enable", "pnpm install --frozen-lockfile",
               "pnpm --filter @ghoststock/contracts build",
               "pnpm --filter @ghoststock/e2e exec playwright install --with-deps chromium",
               "pnpm --filter @ghoststock/e2e test:smoke"],
  })],
} : undefined);
```

Build image: `aws/codebuild/standard:8.0` (Ubuntu 24.04). The CodeBuild "Available
runtimes" table lists Node.js 22 for it, and Ubuntu supports `playwright install
--with-deps`; `runtime-versions: nodejs: 22` pins the runtime in every project's
buildspec. The Test step calls `playwright test --project=web-desktop` directly
because the e2e `test:web` script already selects both web projects. Every step starts with `corepack enable` (bundled with Node.js 22) so the exact pnpm
version from the root `packageManager` field is used; npm is never invoked.
`connectionArn` is used only by the pipeline stack; the app stage never reads it.
Every ShellStep gets `input: source` explicitly: the synth output only contains
`infra/cdk.out`, and the test steps need the whole repository. `pnpm build` runs
before tests because contracts export `dist/` and `BucketDeployment` needs
`apps/web/dist`.

## App stack

| Resource | Key settings |
| --- | --- |
| Media bucket | BPA all, SSE-S3, enforceSSL, `ObjectOwnership.BUCKET_OWNER_ENFORCED`, lifecycle `tmp/` 1 day, abort multipart 1 day, CORS `[{ allowedMethods: [POST], allowedOrigins: ["*"], allowedHeaders: ["*"], maxAge: 3000 }]`, `RemovalPolicy.DESTROY` + `autoDeleteObjects` (demo) |
| Web bucket | same hardening, no CORS, no lifecycle, DESTROY + autoDelete |
| Table | `TableV2`, `PK` / `SK` strings, on demand, `TableEncryptionV2.awsManagedKey()` (KMS `aws/dynamodb`), PITR on, DESTROY (demo) |
| uploads fn | 256 MB, 10 s, env `MEDIA_BUCKET` |
| analyses fn | 1024 MB, 28 s, reserved concurrency 5, env `MEDIA_BUCKET`, `BEDROCK_MODEL_ID` |
| inventory fn | 256 MB, 10 s, env `MEDIA_BUCKET`, `TABLE_NAME`, `LOW_STOCK_DEFAULT` |
| HTTP API | routes per `architecture.md` plus `$default` to inventory, `HttpLambdaIntegration`, default stage throttle 10/5, access log group JSON 14 days |
| Distribution | see below |
| Budget | `CfnBudget` COST MONTHLY `budgetUsd`, ACTUAL 80% and 100% to `budgetEmail`, only if provided |

`ApiFunction` defaults: `runtime NODEJS_22_X`, `architecture ARM_64`,
`bundling { minify: true, sourceMap: true, target: "node22", tsconfig:
"services/api/tsconfig.json", format: OutputFormat.ESM, mainFields: ["module",
"main"], externalModules: [], banner: "import { createRequire } from 'module'; const
require = createRequire(import.meta.url);" }`, `projectRoot` repo root,
`depsLockFilePath` root `pnpm-lock.yaml`, explicit `LogGroup` (14 days, DESTROY), env
`POWERTOOLS_SERVICE_NAME` (function name), `POWERTOOLS_METRICS_NAMESPACE` (`GhostStock`),
`POWERTOOLS_LOG_LEVEL` (`INFO`), `NODE_OPTIONS=--enable-source-maps`.
`externalModules: []` bundles our pinned SDK clients (including
`@aws-sdk/s3-presigned-post`, which the runtime does not ship) instead of relying on
the runtime's SDK; the banner lets CommonJS dependencies `require` inside the ESM
bundle. The api tsconfig maps `@ghoststock/contracts` to its source, so bundling needs
no contracts build. CDK runs `pnpm exec esbuild` from `projectRoot`, so `esbuild` is a
root devDependency (its install script allowed in `pnpm-workspace.yaml`).

IAM per function (explicit `PolicyStatement`s, no broad grants):
- uploads: `s3:PutObject` on `${mediaBucket.bucketArn}/tmp/*`.
- analyses: `s3:GetObject` on `.../tmp/*`; `s3:ListBucket` on the bucket ARN with
  `StringLike s3:prefix tmp/*`; `bedrock:InvokeModel` on
  `arn:aws:bedrock:${region}:${account}:inference-profile/${modelId}` and
  `arn:aws:bedrock:*::foundation-model/${modelId without the "us." prefix}`.
- inventory: DynamoDB actions from `security.md` on the table ARN; `s3:GetObject` on
  `.../tmp/*`; `s3:ListBucket` with the same `tmp/*` prefix condition; `s3:PutObject`
  on `.../media/products/*`.

`s3:ListBucket` makes S3 return 404 (not 403) for a missing key, which is how
`IMAGE_NOT_FOUND` is detected.

## Distribution (ADR 0006)

```ts
const apiDomain = Fn.select(2, Fn.split("/", httpApi.apiEndpoint));
new cloudfront.Distribution(this, "Distribution", {
  defaultRootObject: "index.html",
  defaultBehavior: {
    origin: S3BucketOrigin.withOriginAccessControl(webBucket),
    viewerProtocolPolicy: REDIRECT_TO_HTTPS,
    functionAssociations: [{ function: spaRewrite, eventType: VIEWER_REQUEST }],
    responseHeadersPolicy: headers,
  },
  additionalBehaviors: {
    "/api/*": { origin: new HttpOrigin(apiDomain), allowedMethods: ALLOW_ALL,
                cachePolicy: CACHING_DISABLED,
                originRequestPolicy: ALL_VIEWER_EXCEPT_HOST_HEADER,
                viewerProtocolPolicy: HTTPS_ONLY, responseHeadersPolicy: headers },
    "/media/*": { origin: S3BucketOrigin.withOriginAccessControl(mediaBucket),
                  cachePolicy: CACHING_OPTIMIZED, viewerProtocolPolicy: REDIRECT_TO_HTTPS,
                  responseHeadersPolicy: headers },
  },
  httpVersion: HTTP2_AND_3,
});
```

No `minimumProtocolVersion`: with the default `*.cloudfront.net` certificate CloudFront
fixes the viewer security policy and CDK ignores the prop (synth warning). TLS 1.2
minimum is set together with a custom domain certificate (requirement 6.4).

Only keys under `media/` are reachable because CloudFront forwards the path as the
key; `tmp/` objects are never addressable through the distribution.
`spa-rewrite.js`: if the URI has no file extension and does not start with `/api/` or
`/media/`, set it to `/index.html`.

## cdk-nag suppressions (each with reason in `nag.ts`)

cdk-nag `2.38.x` (`AwsSolutionsChecks` aspect, `NagSuppressions` with `appliesTo`
regexes). cdk-nag 3 moved to CDK validation plugins whose acknowledgements must match
each finding id exactly, including generated logical ids, so 2.x is pinned. The aspect
is added to the pipeline stack (`lib/app.ts`) and inside `GhostStockAppStage`: CDK
Pipelines synthesizes the stage during `buildPipeline()`, before any aspect added to
the App would exist, so an App-level aspect never checks the app stack.

- `AwsSolutions-S1` bucket access logs (web, media, pipeline artifacts): demo cost.
- `AwsSolutions-CFR1`, `CFR2`, `CFR3` geo restriction, WAF, distribution logs: public
  demo, throttling and budget used instead.
- `AwsSolutions-CFR4` the default certificate fixes the TLS policy (see above).
- `AwsSolutions-APIG4` no authorizer: single-workspace demo by product decision.
- `AwsSolutions-IAM4` `AWSLambdaBasicExecutionRole` on our functions and the
  BucketDeployment helper (logs only).
- `AwsSolutions-IAM5` narrowed with `appliesTo`: our `tmp/*` and `media/products/*`
  object ARNs and the `foundation-model/*` region wildcard; BucketDeployment's S3
  wildcards and `cloudfront:CreateInvalidation` on `*`; CDK Pipelines roles (artifacts
  bucket, CodeBuild logs and reports, bootstrap roles).
- `AwsSolutions-CB4` CodeBuild without a KMS key (single account, no
  `crossAccountKeys`).
- `AwsSolutions-L1` our functions (runtime pinned to 22 by this spec) and CDK helper
  Lambdas.

## Tests

Vitest with `Template.fromStack`, context `aws:cdk:bundling-stacks: []` to skip
esbuild in tests, and asset paths (`AppAssetPaths`) pointed at `test/fixtures` so tests
need neither the api handlers nor a web build. Assertions: bucket hardening and lifecycle and CORS; table keys and
PITR; each function runtime, architecture, timeout, memory, concurrency, env; each
role policy matches the IAM table exactly, including the `s3:ListBucket` prefix
condition; `ApiFunction` bundling has `externalModules: []` and the ESM banner;
missing `connectionArn` synthesizes with a warning; HTTP API routes, throttling, no CORS;
distribution behaviors, OAC, function association, no custom error responses; CSP
contains the media bucket domain; `BucketDeployment` with invalidation; budget only
when email given; pipeline `selfMutation`, synth env vars, test steps only when
`enableTests`, each with the source as input; config validation errors; `Annotations` has no cdk-nag errors;
the Prod stage reports an unhardened bucket (proves its aspect runs); every
suppression has a reason; the SPA rewrite function source is run in a VM.
