# Design: 03-infra-pipeline

## Package structure

```
infra/
├── bin/
│   └── ghoststock.ts             # CDK app entry point
├── lib/
│   ├── pipeline-stack.ts         # GhostStockPipelineStack (self-mutating)
│   ├── app-stage.ts              # GhostStockAppStage (one stage, one region)
│   ├── stacks/
│   │   ├── storage-stack.ts      # S3 buckets (upload + SPA)
│   │   ├── api-stack.ts          # API Gateway + Lambda functions
│   │   ├── data-stack.ts         # DynamoDB table
│   │   ├── cdn-stack.ts          # CloudFront distribution + response headers policy
│   │   └── monitoring-stack.ts   # Budget alarm, SNS topic
│   └── constructs/
│       ├── secure-bucket.ts      # Reusable S3 construct with Block Public Access
│       └── ghost-function.ts     # Reusable NodejsFunction construct with common config
├── test/
│   ├── pipeline.test.ts
│   ├── storage.test.ts
│   ├── api.test.ts
│   ├── data.test.ts
│   └── cdn.test.ts
├── cdk.json
├── package.json
└── tsconfig.json
```

## CDK app entry (`bin/ghoststock.ts`)

```typescript
const app = new cdk.App();
new GhostStockPipelineStack(app, "GhostStockPipeline", {
  env: { account: app.node.tryGetContext("account"), region: app.node.tryGetContext("region") },
});
```

Context keys in `cdk.json`:
- `account` — AWS account ID
- `region` — deployment region (e.g., `us-east-1`)
- `connectionArn` — CodeConnections ARN for GitHub
- `repoOwner` — GitHub org/username
- `repoName` — repository name
- `branch` — `main`
- `alarmEmail` — billing alarm email

## Pipeline stack (`lib/pipeline-stack.ts`)

```typescript
const pipeline = new pipelines.CodePipeline(this, "Pipeline", {
  selfMutation: true,
  synth: new pipelines.ShellStep("Synth", {
    input: pipelines.CodePipelineSource.connection(
      `${repoOwner}/${repoName}`, branch, { connectionArn }
    ),
    commands: ["npm ci", "npx cdk synth"],
  }),
  codeBuildDefaults: {
    buildEnvironment: { buildImage: LinuxBuildImage.STANDARD_7_0 }, // Node 22
  },
});

pipeline.addStage(new GhostStockAppStage(this, "Prod", { env }));
```

## Application stage (`lib/app-stage.ts`)

```typescript
export class GhostStockAppStage extends cdk.Stage {
  constructor(scope, id, props) {
    super(scope, id, props);
    const storage    = new StorageStack(this, "Storage");
    const data       = new DataStack(this, "Data");
    const api        = new ApiStack(this, "Api", { uploadBucket: storage.uploadBucket, table: data.table });
    const cdn        = new CdnStack(this, "Cdn",  { spaBucket: storage.spaBucket, httpApi: api.httpApi });
    const monitoring = new MonitoringStack(this, "Monitoring", { alarmEmail });
  }
}
```

## Storage stack

- `SecureBucket` construct: `blockPublicAccess: BlockPublicAccess.BLOCK_ALL`,
  `encryption: BucketEncryption.S3_MANAGED`, `enforceSSL: true`.
- Upload bucket: `removalPolicy: RemovalPolicy.DESTROY` (demo),
  lifecycle rule `Expiration.after(Duration.days(1))` on prefix `uploads/`.
- SPA bucket: no versioning needed; deployment via `BucketDeployment` pointing to
  `apps/web/dist`.

## Data stack

```typescript
const table = new dynamodb.Table(this, "Items", {
  tableName:           "GhostStockItems",
  partitionKey:        { name: "PK", type: AttributeType.STRING },
  billingMode:         BillingMode.PAY_PER_REQUEST,
  encryption:          TableEncryption.AWS_MANAGED,
  pointInTimeRecovery: true,
  removalPolicy:       RemovalPolicy.DESTROY, // demo
});
table.addGlobalSecondaryIndex({
  indexName:      "CategoryCreatedAtIndex",
  partitionKey:   { name: "category",  type: AttributeType.STRING },
  sortKey:        { name: "createdAt", type: AttributeType.STRING },
  projectionType: ProjectionType.ALL,
});
```

## API stack

`GhostFunction` construct (extends `NodejsFunction`):
- `runtime: Runtime.NODEJS_22_X`
- `bundling: { minify: true, sourceMap: false, externalModules: [] }` — esbuild,
  no Docker required.
- `tracing: Tracing.PASS_THROUGH` (overridden to `ACTIVE` for analyzeHandler).
- `logRetention: RetentionDays.ONE_WEEK`.
- Environment: `TABLE_NAME`, `UPLOAD_BUCKET`, `BEDROCK_MODEL_ID` injected from props.

Per-function IAM (added in the stack, not the construct):

| Function | Grant method |
| --- | --- |
| `analyzeHandler` | `table.grantReadData(fn)` scoped out; manual `fn.addToRolePolicy` for `bedrock:InvokeModel` + `s3:GetObject` scoped to `uploads/*` |
| `itemsWriteHandler` | `table.grantWriteData(fn)` |
| `itemsReadHandler` | `table.grantReadData(fn)` |
| `presignHandler` | manual policy for `s3:PutObject` scoped to `uploads/*` |
| `exportHandler` | `table.grantReadData(fn)` |

HTTP API routes (Lambda proxy integration):

```
POST   /api/upload-url    → presignHandler
POST   /api/analyze       → analyzeHandler
POST   /api/items         → itemsWriteHandler
GET    /api/items         → itemsReadHandler
GET    /api/items/export  → exportHandler
GET    /api/items/{id}    → itemsReadHandler
PUT    /api/items/{id}    → itemsWriteHandler
DELETE /api/items/{id}    → itemsWriteHandler
```

Throttling: `defaultRouteSettings: { throttlingBurstLimit: 10, throttlingRateLimit: 5 }`.

## CDN stack

```typescript
const distribution = new cloudfront.Distribution(this, "Cdn", {
  defaultBehavior: {
    origin: S3BucketOrigin.withOriginAccessControl(spaBucket),
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
  additionalBehaviors: {
    "/api/*": { origin: new HttpOrigin(httpApi.url), ... },
  },
  minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
  httpVersion: HttpVersion.HTTP2_AND_3,
  responseHeadersPolicy: buildSecurityHeadersPolicy(this, { uploadBucketDomain, apiDomain }),
});
```

`buildSecurityHeadersPolicy` constructs a `ResponseHeadersPolicy` with all headers
from `security.md` (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
CSP). The CSP string is built from the actual bucket and API domain values.

## Monitoring stack

```typescript
const topic = new sns.Topic(this, "BillingAlarm");
topic.addSubscription(new subscriptions.EmailSubscription(alarmEmail));
new cloudwatch.CfnAlarm(this, "BudgetAlarm", {
  alarmName: "GhostStock-Monthly-Budget",
  namespace: "AWS/Billing", metricName: "EstimatedCharges",
  dimensions: [{ name: "Currency", value: "USD" }],
  statistic: "Maximum", period: 86400, comparisonOperator: "GreaterThanThreshold",
  threshold: 20, evaluationPeriods: 1,
  alarmActions: [topic.topicArn],
});
```

## cdk-nag

`Aspects.of(app).add(new AwsSolutionsChecks())` in `bin/ghoststock.ts`.
Suppressions are added in each stack with `NagSuppressions.addResourceSuppressions`
and a comment explaining the reason (e.g., demo removal policy, billing metric requiring
us-east-1).

## Package configuration

```json
{
  "name": "@ghoststock/infra",
  "scripts": {
    "build": "tsc",
    "test":  "vitest run",
    "synth": "cdk synth",
    "diff":  "cdk diff"
  },
  "dependencies": {
    "aws-cdk-lib": "2.x",
    "constructs": "10.x",
    "cdk-nag": "2.x"
  },
  "devDependencies": {
    "aws-cdk": "2.x",
    "vitest": "2.1.8",
    "typescript": "5.6.3"
  }
}
```
