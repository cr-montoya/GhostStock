import type { InfraConfig } from "@ghoststock/contracts";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AccessLogFormat } from "aws-cdk-lib/aws-apigateway";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { ApiFunction } from "./constructs/api-function.js";
import { Frontend } from "./constructs/frontend.js";
import { MediaBucket } from "./constructs/media-bucket.js";
import { suppressAppStackFindings } from "./nag.js";
import { HANDLERS_DIR, WEB_DIST_DIR } from "./paths.js";

/** Local build outputs packaged as assets; tests point them at fixtures. */
export interface AppAssetPaths {
  readonly handlersDir: string;
  readonly webDistDir: string;
}

export interface GhostStockAppStackProps extends StackProps {
  readonly config: InfraConfig;
  readonly assets?: AppAssetPaths;
}

// Every runtime resource in one stack so OAC policies, buckets and the distribution
// never reference each other across stacks (ADR 0008).
export class GhostStockAppStack extends Stack {
  readonly baseUrl: CfnOutput;

  constructor(scope: Construct, id: string, props: GhostStockAppStackProps) {
    super(scope, id, props);
    const { config } = props;
    const assets = props.assets ?? { handlersDir: HANDLERS_DIR, webDistDir: WEB_DIST_DIR };

    const media = new MediaBucket(this, "Media").bucket;

    const table = new dynamodb.TableV2(this, "Table", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      encryption: dynamodb.TableEncryptionV2.awsManagedKey(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const uploads = new ApiFunction(this, "Uploads", {
      name: "uploads",
      handlersDir: assets.handlersDir,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: { MEDIA_BUCKET: media.bucketName },
    }).fn;

    const analyses = new ApiFunction(this, "Analyses", {
      name: "analyses",
      handlersDir: assets.handlersDir,
      memorySize: 1024,
      // Under the 30 s HTTP API integration limit.
      timeout: Duration.seconds(28),
      // No reserved concurrency: new accounts have a 10 execution quota and Lambda must
      // keep 10 unreserved, so any reservation fails the deploy. Stage throttling and the
      // budget bound Bedrock spend; reserve 5 again once the quota is raised.
      environment: { MEDIA_BUCKET: media.bucketName, BEDROCK_MODEL_ID: config.bedrockModelId },
    }).fn;

    const inventory = new ApiFunction(this, "Inventory", {
      name: "inventory",
      handlersDir: assets.handlersDir,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        MEDIA_BUCKET: media.bucketName,
        TABLE_NAME: table.tableName,
        LOW_STOCK_DEFAULT: String(config.lowStockDefault),
      },
    }).fn;

    // IAM exactly as the security.md table; no grant* helpers, which add extra actions.
    const tmpObjects = media.arnForObjects("tmp/*");
    // ListBucket makes S3 answer a missing key with 404 instead of 403 (IMAGE_NOT_FOUND).
    const listTmp = new iam.PolicyStatement({
      actions: ["s3:ListBucket"],
      resources: [media.bucketArn],
      conditions: { StringLike: { "s3:prefix": "tmp/*" } },
    });

    uploads.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["s3:PutObject"], resources: [tmpObjects] }),
    );

    const foundationModelId = config.bedrockModelId.replace(/^us\./, "");
    const inferenceProfileArn = `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${config.bedrockModelId}`;
    analyses.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["s3:GetObject"], resources: [tmpObjects] }),
    );
    analyses.addToRolePolicy(listTmp);
    analyses.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["bedrock:InvokeModel"], resources: [inferenceProfileArn] }),
    );
    // The profile routes to the model in any US region, but only through the profile:
    // direct calls to the foundation model stay denied.
    analyses.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [`arn:aws:bedrock:*::foundation-model/${foundationModelId}`],
        conditions: { StringEquals: { "bedrock:InferenceProfileArn": inferenceProfileArn } },
      }),
    );

    inventory.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:BatchWriteItem",
        ],
        resources: [table.tableArn],
      }),
    );
    inventory.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["s3:GetObject"], resources: [tmpObjects] }),
    );
    inventory.addToRolePolicy(listTmp);
    inventory.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [media.arnForObjects("media/products/*")],
      }),
    );

    const inventoryIntegration = new HttpLambdaIntegration("InventoryIntegration", inventory);
    // No CORS: the browser only reaches the API through the distribution (ADR 0006).
    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "ghoststock",
      createDefaultStage: false,
      // Unknown paths get the JSON NOT_FOUND envelope from inventory.
      defaultIntegration: inventoryIntegration,
    });
    const route = (
      path: string,
      methods: apigwv2.HttpMethod[],
      integration: apigwv2.HttpRouteIntegration,
    ) => httpApi.addRoutes({ path, methods, integration });
    const { GET, POST, PUT, DELETE } = apigwv2.HttpMethod;
    route("/api/uploads", [POST], new HttpLambdaIntegration("UploadsIntegration", uploads));
    route("/api/analyses", [POST], new HttpLambdaIntegration("AnalysesIntegration", analyses));
    route("/api/products", [GET, POST], inventoryIntegration);
    route("/api/products/{id}", [GET, PUT, DELETE], inventoryIntegration);
    route("/api/settings", [GET, PUT], inventoryIntegration);

    const accessLogs = new logs.LogGroup(this, "ApiAccessLogs", {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    new apigwv2.HttpStage(this, "DefaultStage", {
      httpApi,
      stageName: "$default",
      autoDeploy: true,
      throttle: { burstLimit: 10, rateLimit: 5 },
      accessLogSettings: {
        destination: new apigwv2.LogGroupLogDestination(accessLogs),
        format: AccessLogFormat.custom(
          JSON.stringify({
            requestId: "$context.requestId",
            ip: "$context.identity.sourceIp",
            requestTime: "$context.requestTime",
            method: "$context.httpMethod",
            routeKey: "$context.routeKey",
            status: "$context.status",
            responseLength: "$context.responseLength",
            latency: "$context.integrationLatency",
            integrationError: "$context.integrationErrorMessage",
          }),
        ),
      },
    });

    const frontend = new Frontend(this, "Frontend", {
      mediaBucket: media,
      httpApi,
      webDistDir: assets.webDistDir,
    });

    if (config.budgetEmail) {
      const subscribers = [{ subscriptionType: "EMAIL", address: config.budgetEmail }];
      new budgets.CfnBudget(this, "Budget", {
        budget: {
          budgetName: "ghoststock-monthly",
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: config.budgetUsd, unit: "USD" },
        },
        notificationsWithSubscribers: [80, 100].map((threshold) => ({
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold,
            thresholdType: "PERCENTAGE",
          },
          subscribers,
        })),
      });
    }

    this.baseUrl = new CfnOutput(this, "BaseUrl", {
      value: `https://${frontend.distribution.distributionDomainName}`,
    });

    suppressAppStackFindings(this, {
      httpApi,
      distribution: frontend.distribution,
      buckets: [media, frontend.webBucket],
      functions: [uploads, analyses, inventory],
    });
  }
}
