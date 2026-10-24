import type { InfraConfig } from "@ghoststock/contracts";
import { Annotations, Stack, type StackProps } from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as pipelines from "aws-cdk-lib/pipelines";
import type { Construct } from "constructs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AppAssetPaths } from "./app-stack.js";
import { GhostStockAppStage } from "./app-stage.js";
import { suppressPipelineStackFindings } from "./nag.js";
import { REPO_ROOT } from "./paths.js";

// Syntactically valid but unusable: a pipeline deployed with it fails at its source
// stage and nothing else. Lets `cdk synth`, `cdk diff` and tests run without secrets.
export const PLACEHOLDER_CONNECTION_ARN =
  "arn:aws:codeconnections:us-east-1:000000000000:connection/00000000-0000-0000-0000-000000000000";

// Ubuntu 24.04 standard:8.0 lists Node.js 22 in the CodeBuild runtime table and
// supports `playwright install --with-deps`; the runtime is pinned in the buildspec.
export const BUILD_IMAGE = codebuild.LinuxBuildImage.STANDARD_8_0;
export const NODE_RUNTIME = "22";

// The CLI the pipeline installs matches the aws-cdk devDependency used locally.
export const CDK_CLI_VERSION: string = JSON.parse(
  readFileSync(join(REPO_ROOT, "infra/package.json"), "utf8"),
).devDependencies["aws-cdk"];
export const CDK_ASSETS_CLI_VERSION = "4.7.4";

const INSTALL =["corepack enable", "pnpm install --frozen-lockfile"];
const PLAYWRIGHT = "pnpm --filter @ghoststock/e2e exec playwright install --with-deps chromium";

export interface GhostStockPipelineStackProps extends StackProps {
  readonly config: InfraConfig;
  readonly assets?: AppAssetPaths;
}

export class GhostStockPipelineStack extends Stack {
  readonly pipeline: pipelines.CodePipeline;
  readonly prod: GhostStockAppStage;

  constructor(scope: Construct, id: string, props: GhostStockPipelineStackProps) {
    super(scope, id, props);
    const { config } = props;

    if (!config.connectionArn) {
      Annotations.of(this).addWarningV2(
        "ghoststock:placeholder-connection",
        "connectionArn not set: using a placeholder. Pass -c connectionArn=... before deploying (docs/deployment.md).",
      );
    }
    if (!config.budgetEmail) {
      Annotations.of(this).addWarningV2(
        "ghoststock:no-budget",
        "budgetEmail not set: no cost budget or alert will be created. Pass -c budgetEmail=... when deploying (docs/deployment.md).",
      );
    }
    const source = pipelines.CodePipelineSource.connection(config.repo, config.branch, {
      connectionArn: config.connectionArn ?? PLACEHOLDER_CONNECTION_ARN,
    });

    // Deploy-time values are persisted here and passed back as context, so every
    // self-mutation synthesizes the same pipeline without manual input (ADR 0008).
    const synth = new pipelines.ShellStep("Synth", {
      input: source,
      env: {
        CONNECTION_ARN: config.connectionArn ?? "",
        BUDGET_EMAIL: config.budgetEmail ?? "",
      },
      commands: [
        ...INSTALL,
        "pnpm build",
        'cd infra && pnpm exec cdk synth -c "connectionArn=$CONNECTION_ARN" -c "budgetEmail=$BUDGET_EMAIL"',
      ],
      primaryOutputDirectory: "infra/cdk.out",
    });

    this.pipeline = new pipelines.CodePipeline(this, "Pipeline", {
      pipelineName: "GhostStock",
      pipelineType: codepipeline.PipelineType.V2,
      selfMutation: true,
      // CDK Pipelines installs these with npm in its generated steps; pinned so a CLI
      // release cannot change the pipeline without a commit.
      cliVersion: CDK_CLI_VERSION,
      cdkAssetsCliVersion: CDK_ASSETS_CLI_VERSION,
      // Single account: no cross-account KMS key (saves its monthly cost).
      crossAccountKeys: false,
      synth,
      codeBuildDefaults: {
        buildEnvironment: { buildImage: BUILD_IMAGE },
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          phases: { install: { "runtime-versions": { nodejs: NODE_RUNTIME } } },
        }),
      },
    });

    this.prod = new GhostStockAppStage(this, "Prod", {
      env: { account: this.account, region: config.region },
      config,
      assets: props.assets,
    });

    // Every test step takes the source as input: the synth output only holds cdk.out.
    this.pipeline.addStage(
      this.prod,
      config.enableTests
        ? {
            pre: [
              new pipelines.ShellStep("Test", {
                input: source,
                commands: [
                  ...INSTALL,
                  "pnpm build",
                  "pnpm test",
                  PLAYWRIGHT,
                  "pnpm --filter @ghoststock/e2e exec playwright test --project=web-desktop",
                ],
              }),
            ],
            post: [
              new pipelines.ShellStep("Smoke", {
                input: source,
                envFromCfnOutputs: { BASE_URL: this.prod.baseUrl },
                commands: [
                  ...INSTALL,
                  "pnpm --filter @ghoststock/contracts build",
                  PLAYWRIGHT,
                  "pnpm --filter @ghoststock/e2e test:smoke",
                ],
              }),
            ],
          }
        : undefined,
    );

    // Suppressions target the generated CodePipeline resources, which exist only
    // after buildPipeline().
    this.pipeline.buildPipeline();
    suppressPipelineStackFindings(this, this.pipeline);
  }
}
