import { describe, expect, it } from "vitest";
import { InfraConfigSchema } from "../src/schemas/config.js";

const base = {
  region: "us-east-1",
  repo: "cr-montoya/GhostStock",
  branch: "main",
  bedrockModelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  lowStockDefault: 5,
  enableTests: false,
  budgetUsd: 20,
};

describe("[00 10] infra config", () => {
  it("[00 10.1] accepts committed context without deploy-time values", () => {
    const parsed = InfraConfigSchema.parse(base);
    expect(parsed.connectionArn).toBeUndefined();
    expect(parsed.budgetEmail).toBeUndefined();
  });

  it("[00 10.1] treats empty strings from CodeBuild as not set", () => {
    const parsed = InfraConfigSchema.parse({ ...base, connectionArn: "", budgetEmail: "" });
    expect(parsed.connectionArn).toBeUndefined();
    expect(parsed.budgetEmail).toBeUndefined();
  });

  it("[00 10.1] parses string context from -c flags", () => {
    const parsed = InfraConfigSchema.parse({ ...base, lowStockDefault: "7", enableTests: "false", budgetUsd: "20" });
    expect(parsed).toMatchObject({ lowStockDefault: 7, enableTests: false, budgetUsd: 20 });
    expect(InfraConfigSchema.parse({ ...base, enableTests: "true" }).enableTests).toBe(true);
  });

  it("[00 10.1] fails on blank numeric context instead of turning it into 0", () => {
    expect(InfraConfigSchema.safeParse({ ...base, lowStockDefault: "" }).success).toBe(false);
    expect(InfraConfigSchema.safeParse({ ...base, budgetUsd: "" }).success).toBe(false);
  });

  it("[00 10.1] requires an inference profile id with the us. prefix", () => {
    expect(InfraConfigSchema.safeParse({ ...base, bedrockModelId: "anthropic.claude-sonnet-4-5-20250929-v1:0" }).success).toBe(false);
  });

  it("[00 10.1] rejects a malformed email or connection", () => {
    expect(InfraConfigSchema.safeParse({ ...base, budgetEmail: "nope" }).success).toBe(false);
    expect(InfraConfigSchema.safeParse({ ...base, connectionArn: "arn:aws:s3:::x" }).success).toBe(false);
  });
});
