import { App, Stack } from "aws-cdk-lib";
import { Annotations, Match } from "aws-cdk-lib/assertions";
import * as s3 from "aws-cdk-lib/aws-s3";
import { describe, expect, it } from "vitest";
import { GhostStockAppStage } from "../lib/app-stage.js";
import { readConfig } from "../lib/config.js";
import { CDK_JSON_CONTEXT, FIXTURE_ASSETS, synth, TEST_CONNECTION_ARN } from "./helpers.js";

const nagErrors = (stack: Stack) =>
  Annotations.fromStack(stack).findError("*", Match.stringLikeRegexp("AwsSolutions-.*"));

describe("budget", () => {
  it("[03-infra-pipeline 8.1] creates no budget without budgetEmail, and warns", () => {
    const { appTemplate, pipelineStack } = synth();
    appTemplate.resourceCountIs("AWS::Budgets::Budget", 0);
    Annotations.fromStack(pipelineStack).hasWarning(
      "/GhostStockPipeline",
      Match.stringLikeRegexp("budgetEmail not set"),
    );
  });

  it("[03-infra-pipeline 8.1] monthly cost budget with 80% and 100% actual alerts", () => {
    const { appTemplate } = synth({ budgetEmail: "owner@example.com" });
    const subscribers = [{ SubscriptionType: "EMAIL", Address: "owner@example.com" }];
    appTemplate.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: {
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
        BudgetLimit: { Amount: 20, Unit: "USD" },
        BudgetName: "ghoststock-monthly",
      },
      NotificationsWithSubscribers: [80, 100].map((Threshold) => ({
        Notification: {
          NotificationType: "ACTUAL",
          ComparisonOperator: "GREATER_THAN",
          Threshold,
          ThresholdType: "PERCENTAGE",
        },
        Subscribers: subscribers,
      })),
    });
  });
});

describe("cdk-nag", () => {
  it("[03-infra-pipeline 9.1, 9.3] every stack synthesizes with zero unsuppressed findings", () => {
    for (const context of [{}, { enableTests: true, budgetEmail: "owner@example.com", connectionArn: TEST_CONNECTION_ARN }]) {
      const { pipelineStack, appStack } = synth(context);
      expect(nagErrors(pipelineStack)).toEqual([]);
      expect(nagErrors(appStack)).toEqual([]);
    }
  });

  it("[03-infra-pipeline 9.1] the Prod stage carries its own checks", () => {
    // CDK Pipelines synthesizes the stage while the pipeline is built, so the checks
    // must come from the stage itself. An unhardened bucket must be reported.
    const app = new App({ context: { ...CDK_JSON_CONTEXT, "aws:cdk:bundling-stacks": [] } });
    const stage = new GhostStockAppStage(app, "Prod", {
      config: readConfig(app.node),
      assets: FIXTURE_ASSETS,
    });
    new s3.Bucket(stage.appStack, "Unhardened");
    // With the recommended feature flags, error annotations fail synth outright.
    expect(() => Annotations.fromStack(stage.appStack)).toThrow(
      /AwsSolutions-S\d+[\s\S]*\/Unhardened\/Resource/,
    );
  });

  it("[03-infra-pipeline 9.2] every suppression carries a written reason", () => {
    const { appTemplate, pipeline } = synth();
    for (const template of [appTemplate, pipeline]) {
      const resources = Object.values(template.toJSON().Resources as Record<string, { Metadata?: { cdk_nag?: { rules_to_suppress: { reason: string }[] } } }>);
      const rules = resources.flatMap((r) => r.Metadata?.cdk_nag?.rules_to_suppress ?? []);
      expect(rules.length).toBeGreaterThan(0);
      for (const rule of rules) expect(rule.reason.length).toBeGreaterThan(20);
    }
  });
});
