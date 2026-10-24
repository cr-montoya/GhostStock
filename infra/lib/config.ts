import { InfraConfigSchema, type InfraConfig } from "@ghoststock/contracts";
import type { Node } from "constructs";

const KEYS = [
  "region",
  "repo",
  "branch",
  "bedrockModelId",
  "lowStockDefault",
  "enableTests",
  "budgetUsd",
  "connectionArn",
  "budgetEmail",
] as const satisfies readonly (keyof InfraConfig)[];

// Reads every deploy setting from CDK context (cdk.json or `-c`) and validates it with
// the shared contract, so a bad value stops synth before any resource is defined.
export function readConfig(node: Node): InfraConfig {
  const raw = Object.fromEntries(KEYS.map((key) => [key, node.tryGetContext(key)]));
  const parsed = InfraConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid GhostStock infra context:\n${details}\nSee docs/deployment.md.`);
  }
  return parsed.data;
}
