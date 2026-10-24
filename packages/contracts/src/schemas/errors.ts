import { z } from "zod";

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNSUPPORTED_MEDIA_TYPE",
  "IMAGE_TOO_LARGE",
  "IMAGE_NOT_FOUND",
  "NOT_FOUND",
  "MODEL_UNAVAILABLE",
  "MODEL_THROTTLED",
  "MODEL_INVALID_OUTPUT",
  "STORAGE_ERROR",
  "INTERNAL_ERROR",
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  IMAGE_TOO_LARGE: 413,
  IMAGE_NOT_FOUND: 404,
  NOT_FOUND: 404,
  MODEL_UNAVAILABLE: 503,
  MODEL_THROTTLED: 503,
  MODEL_INVALID_OUTPUT: 502,
  STORAGE_ERROR: 500,
  INTERNAL_ERROR: 500,
};

export const ERROR_RETRYABLE: Record<ErrorCode, boolean> = {
  VALIDATION_ERROR: false,
  UNSUPPORTED_MEDIA_TYPE: false,
  IMAGE_TOO_LARGE: false,
  IMAGE_NOT_FOUND: false,
  NOT_FOUND: false,
  MODEL_UNAVAILABLE: false,
  MODEL_THROTTLED: true,
  MODEL_INVALID_OUTPUT: true,
  STORAGE_ERROR: true,
  INTERNAL_ERROR: false,
};

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
    requestId: z.string(),
  }),
});
