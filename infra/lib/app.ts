import { Aspects, type App } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import type { AppAssetPaths } from "./app-stack.js";
import { readConfig } from "./config.js";
import { GhostStockPipelineStack } from "./pipeline-stack.js";

// Shared by bin/ghoststock.ts and the tests, so both synthesize the same tree.
export function buildGhostStockApp(app: App, assets?: AppAssetPaths): GhostStockPipelineStack {
  const config = readConfig(app.node);
  const pipelineStack = new GhostStockPipelineStack(app, "GhostStockPipeline", {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: config.region },
    config,
    assets,
  });
  // The Prod stage carries its own checks (app-stage.ts); this covers the pipeline.
  Aspects.of(pipelineStack).add(new AwsSolutionsChecks({ verbose: true }));
  return pipelineStack;
}
