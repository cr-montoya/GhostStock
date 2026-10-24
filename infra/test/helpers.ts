import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGhostStockApp } from "../lib/app.js";
import type { GhostStockAppStack } from "../lib/app-stack.js";
import type { GhostStockPipelineStack } from "../lib/pipeline-stack.js";

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_ASSETS = {
  handlersDir: join(here, "fixtures/handlers"),
  webDistDir: join(here, "fixtures/web-dist"),
};
export const TEST_ACCOUNT = "123456789012";
export const TEST_CONNECTION_ARN =
  "arn:aws:codeconnections:us-east-1:123456789012:connection/11111111-2222-3333-4444-555555555555";

/** Context committed in infra/cdk.json, so tests see what synth sees. */
export const CDK_JSON_CONTEXT: Record<string, unknown> = JSON.parse(
  readFileSync(join(here, "../cdk.json"), "utf8"),
).context;

export interface Synthesized {
  app: App;
  pipelineStack: GhostStockPipelineStack;
  appStack: GhostStockAppStack;
  pipeline: Template;
  appTemplate: Template;
}

const cache = new Map<string, Synthesized>();

export function synth(context: Record<string, unknown> = {}): Synthesized {
  const key = JSON.stringify(context);
  const hit = cache.get(key);
  if (hit) return hit;
  process.env.CDK_DEFAULT_ACCOUNT = TEST_ACCOUNT;
  const app = new App({
    // Skip esbuild bundling for every stack (spec 03 req 10.1).
    context: { ...CDK_JSON_CONTEXT, "aws:cdk:bundling-stacks": [], ...context },
  });
  const pipelineStack = buildGhostStockApp(app, FIXTURE_ASSETS);
  const appStack = pipelineStack.prod.appStack;
  const result: Synthesized = {
    app,
    pipelineStack,
    appStack,
    pipeline: Template.fromStack(pipelineStack),
    appTemplate: Template.fromStack(appStack),
  };
  cache.set(key, result);
  return result;
}
