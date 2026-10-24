import { z } from "zod";

// CDK context arrives as JSON values from cdk.json or as strings from `-c` and CodeBuild
// environment variables, so empty strings mean "not set" and booleans may be strings.
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

// An absent enableTests means false on purpose: test gates are opt-in (spec 03 req 3.1).
const booleanish = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false" || value === undefined) return false;
  return value;
}, z.boolean());

export const InfraConfigSchema = z.object({
  region: z.string().min(1),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  branch: z.string().min(1),
  bedrockModelId: z.string().regex(/^us\.[a-z0-9.-]+:\d+$/),
  lowStockDefault: z.preprocess(blankToUndefined, z.coerce.number().int().min(0)),
  enableTests: booleanish,
  budgetUsd: z.preprocess(blankToUndefined, z.coerce.number().positive()),
  connectionArn: z.preprocess(blankToUndefined, z.string().startsWith("arn:aws:codeconnections:").optional()),
  budgetEmail: z.preprocess(blankToUndefined, z.email().optional()),
});
