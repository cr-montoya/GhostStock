import { z } from "zod";
import { ImageContentType, ImageKeySchema, IsoDateTime, MAX_UPLOAD_BYTES } from "./common.js";
import type { ErrorCode } from "./errors.js";

export const CreateUploadRequestSchema = z.strictObject({
  contentType: ImageContentType,
  sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
});

export const CreateUploadResponseSchema = z.object({
  url: z.url(),
  fields: z.record(z.string(), z.string()),
  imageKey: ImageKeySchema,
  expiresAt: IsoDateTime,
});

/**
 * Maps a failed `CreateUploadRequestSchema` parse to its error code: a bad content
 * type is 415, an oversize image is 413, anything else is a plain validation error.
 */
export function classifyUploadRequestError(error: z.ZodError): ErrorCode {
  const issues = error.issues;
  if (issues.some((i) => i.path[0] === "contentType")) return "UNSUPPORTED_MEDIA_TYPE";
  if (issues.some((i) => i.path[0] === "sizeBytes" && i.code === "too_big")) {
    return "IMAGE_TOO_LARGE";
  }
  return "VALIDATION_ERROR";
}
