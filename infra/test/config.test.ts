import { App } from "aws-cdk-lib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readConfig } from "../lib/config.js";
import { CDK_JSON_CONTEXT, TEST_CONNECTION_ARN } from "./helpers.js";

const configFor = (context: Record<string, unknown>) =>
  readConfig(new App({ context: { ...CDK_JSON_CONTEXT, ...context } }).node);

describe("config", () => {
  it("[03-infra-pipeline 1.1] reads committed context with defaults", () => {
    expect(configFor({})).toEqual({
      region: "us-east-1",
      repo: "cr-montoya/GhostStock",
      branch: "main",
      bedrockModelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      lowStockDefault: 5,
      enableTests: false,
      budgetUsd: 20,
    });
  });

  it("[03-infra-pipeline 1.1] accepts deploy-time values passed as -c strings", () => {
    const config = configFor({
      connectionArn: TEST_CONNECTION_ARN,
      budgetEmail: "owner@example.com",
      enableTests: "true",
    });
    expect(config.connectionArn).toBe(TEST_CONNECTION_ARN);
    expect(config.budgetEmail).toBe("owner@example.com");
    expect(config.enableTests).toBe(true);
  });

  it("[03-infra-pipeline 1.1] treats empty -c values from CodeBuild as not set", () => {
    const config = configFor({ connectionArn: "", budgetEmail: "" });
    expect(config.connectionArn).toBeUndefined();
    expect(config.budgetEmail).toBeUndefined();
  });

  it("[03-infra-pipeline 1.1] fails synth with a clear message on invalid values", () => {
    expect(() => configFor({ bedrockModelId: "claude", budgetEmail: "nope" })).toThrow(
      /Invalid GhostStock infra context:[\s\S]*bedrockModelId[\s\S]*budgetEmail/,
    );
    expect(() => configFor({ connectionArn: "arn:aws:s3:::bucket" })).toThrow(/connectionArn/);
  });

  it("[03-infra-pipeline 1.2] cdk.json holds no connection ARN, email or account id", () => {
    const raw = readFileSync(join(import.meta.dirname, "../cdk.json"), "utf8");
    expect(raw).not.toMatch(/connectionArn|budgetEmail|codeconnections|@|\b\d{12}\b/);
  });
});
