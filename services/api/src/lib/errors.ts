import type { ErrorCode } from "@ghoststock/contracts";

/** Technical English defaults; the web app maps `code` to Spanish copy (docs/api.md). */
export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Request body failed validation",
  UNSUPPORTED_MEDIA_TYPE: "Content type must be image/jpeg, image/png or image/webp",
  IMAGE_TOO_LARGE: "Image exceeds 3750000 bytes",
  IMAGE_NOT_FOUND: "Image not found or expired",
  NOT_FOUND: "Resource not found",
  MODEL_UNAVAILABLE: "Model access denied or model not found",
  MODEL_THROTTLED: "Model throttled after retries",
  MODEL_INVALID_OUTPUT: "Model output failed validation",
  STORAGE_ERROR: "Storage operation failed",
  INTERNAL_ERROR: "Unexpected error",
};

/**
 * An expected failure with a contract error code. `message` reaches the client, so it
 * must never carry AWS identifiers, keys, URLs or model text; `cause` is for logs only.
 */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string, cause?: unknown) {
    super(message ?? DEFAULT_ERROR_MESSAGES[code], cause === undefined ? undefined : { cause });
    this.name = "AppError";
    this.code = code;
  }
}
