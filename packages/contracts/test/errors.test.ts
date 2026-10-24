import { describe, expect, it } from "vitest";
import { ApiErrorSchema, ERROR_CODES, ERROR_HTTP_STATUS, ERROR_RETRYABLE } from "../src/schemas/errors.js";

describe("[00 6] error catalog", () => {
  it("[00 6.1] has exactly the agreed codes", () => {
    expect([...ERROR_CODES].sort()).toEqual(
      [
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
      ].sort(),
    );
  });

  it("[00 6.2] maps every code to a status and a retryable flag", () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(typeof ERROR_RETRYABLE[code]).toBe("boolean");
    }
    expect(Object.keys(ERROR_HTTP_STATUS)).toHaveLength(ERROR_CODES.length);
    expect(Object.keys(ERROR_RETRYABLE)).toHaveLength(ERROR_CODES.length);
  });

  it("[00 6.3] validates the error envelope", () => {
    const ok = ApiErrorSchema.safeParse({
      error: { code: "NOT_FOUND", message: "product not found", retryable: false, requestId: "abc" },
    });
    expect(ok.success).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { code: "TEAPOT", message: "", retryable: false, requestId: "" } }).success).toBe(false);
  });
});
