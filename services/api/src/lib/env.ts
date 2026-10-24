import { z } from "zod";

const Base = z.object({
  MEDIA_BUCKET: z.string().min(1),
});

export const UploadsEnvSchema = Base;

export const AnalysesEnvSchema = Base.extend({
  BEDROCK_MODEL_ID: z.string().min(1),
});

export const InventoryEnvSchema = Base.extend({
  TABLE_NAME: z.string().min(1),
  LOW_STOCK_DEFAULT: z.coerce.number().int().min(0).max(100_000),
});

export type UploadsEnv = z.infer<typeof UploadsEnvSchema>;
export type AnalysesEnv = z.infer<typeof AnalysesEnvSchema>;
export type InventoryEnv = z.infer<typeof InventoryEnvSchema>;

/**
 * Parses the function environment once and caches it. Called from inside the handler
 * so a misconfigured function answers `500 INTERNAL_ERROR` in the envelope instead of
 * failing at init. The error names the missing variables, never their values.
 */
export function envLoader<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv = process.env) {
  let cached: z.infer<T> | undefined;
  return (): z.infer<T> => {
    if (cached !== undefined) return cached;
    const parsed = schema.safeParse(source);
    if (!parsed.success) {
      const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(", ");
      throw new Error(`Invalid environment: ${names}`);
    }
    cached = parsed.data;
    return parsed.data;
  };
}
