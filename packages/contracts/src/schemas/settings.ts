import { z } from "zod";

export const SettingsSchema = z.strictObject({
  lowStockThreshold: z.number().int().min(0).max(100_000),
});

export const UpdateSettingsRequestSchema = SettingsSchema;
