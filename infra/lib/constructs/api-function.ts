import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { join } from "node:path";
import { API_TSCONFIG, LOCK_FILE, REPO_ROOT } from "../paths.js";

export interface ApiFunctionProps {
  /** Handler file name without extension, under `handlersDir`. */
  readonly name: "uploads" | "analyses" | "inventory";
  readonly handlersDir: string;
  readonly memorySize: number;
  readonly timeout: Duration;
  readonly reservedConcurrentExecutions?: number;
  readonly environment: Record<string, string>;
}

// NodejsFunction with the project defaults from infra-cdk.md and security.md.
export class ApiFunction extends Construct {
  readonly fn: NodejsFunction;

  constructor(scope: Construct, id: string, props: ApiFunctionProps) {
    super(scope, id);
    const logGroup = new logs.LogGroup(this, "Logs", {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.fn = new NodejsFunction(this, "Function", {
      entry: join(props.handlersDir, `${props.name}.ts`),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: props.memorySize,
      timeout: props.timeout,
      reservedConcurrentExecutions: props.reservedConcurrentExecutions,
      logGroup,
      projectRoot: REPO_ROOT,
      depsLockFilePath: LOCK_FILE,
      environment: {
        POWERTOOLS_SERVICE_NAME: props.name,
        POWERTOOLS_METRICS_NAMESPACE: "GhostStock",
        POWERTOOLS_LOG_LEVEL: "INFO",
        NODE_OPTIONS: "--enable-source-maps",
        ...props.environment,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: "node22",
        // Its `paths` maps @ghoststock/contracts to source, so bundling needs no prior build.
        tsconfig: API_TSCONFIG,
        format: OutputFormat.ESM,
        mainFields: ["module", "main"],
        // Bundle our pinned SDK clients (s3-presigned-post is not in the runtime).
        externalModules: [],
        // Lets CommonJS dependencies call require() inside the ESM bundle.
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });
  }
}
