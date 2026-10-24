import type { InfraConfig } from "@ghoststock/contracts";
import { Aspects, Stage, type CfnOutput, type StageProps } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import type { Construct } from "constructs";
import { GhostStockAppStack, type AppAssetPaths } from "./app-stack.js";

export interface GhostStockAppStageProps extends StageProps {
  readonly config: InfraConfig;
  readonly assets?: AppAssetPaths;
}

export class GhostStockAppStage extends Stage {
  readonly appStack: GhostStockAppStack;
  /** Used by the pipeline smoke step as BASE_URL. */
  readonly baseUrl: CfnOutput;

  constructor(scope: Construct, id: string, props: GhostStockAppStageProps) {
    super(scope, id, props);
    this.appStack = new GhostStockAppStack(this, "GhostStockAppStack", {
      config: props.config,
      assets: props.assets,
    });
    this.baseUrl = this.appStack.baseUrl;
    // CDK Pipelines synthesizes the stage inside buildPipeline(), before any aspect
    // added to the App exists, so the stage carries its own cdk-nag checks.
    Aspects.of(this).add(new AwsSolutionsChecks({ verbose: true }));
  }
}
