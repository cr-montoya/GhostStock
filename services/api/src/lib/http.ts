import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from "aws-lambda";
import { ERROR_HTTP_STATUS, ERROR_RETRYABLE, type ApiError, type ErrorCode } from "@ghoststock/contracts";
import type { z } from "zod";
import { AppError, DEFAULT_ERROR_MESSAGES } from "./errors.js";
import { logger } from "./observability.js";

export type HttpResult = APIGatewayProxyStructuredResultV2;
export type RouteHandler = (event: APIGatewayProxyEventV2, context: Context) => Promise<HttpResult>;

/** Images never travel through the API, so any body over 64 KB is rejected (security.md). */
export const MAX_BODY_BYTES = 64 * 1024;

const BASE_HEADERS = { "cache-control": "no-store" } as const;

export function json(statusCode: number, body: unknown): HttpResult {
  return {
    statusCode,
    headers: { ...BASE_HEADERS, "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function noContent(): HttpResult {
  return { statusCode: 204, headers: { ...BASE_HEADERS } };
}

/**
 * Decodes, size-checks and parses the JSON body, then validates it with `schema`.
 * Every failure is an `AppError`: `VALIDATION_ERROR` unless `classify` maps the zod
 * error to a more specific code (uploads: 413 and 415).
 */
export function parseJson<T extends z.ZodType>(
  event: APIGatewayProxyEventV2,
  schema: T,
  classify?: (error: z.ZodError) => ErrorCode,
): z.infer<T> {
  const raw = event.body ?? "";
  const bytes = event.isBase64Encoded ? Buffer.from(raw, "base64") : Buffer.from(raw, "utf8");
  if (bytes.byteLength > MAX_BODY_BYTES) {
    throw new AppError("VALIDATION_ERROR", `Request body exceeds ${MAX_BODY_BYTES} bytes`);
  }
  let data: unknown;
  try {
    data = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body is not valid JSON");
  }
  return validate(schema, data, classify);
}

/** Validates a non-body input (path or query parameter) with a contract schema. */
export function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
  classify?: (error: z.ZodError) => ErrorCode,
): z.infer<T> {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;
  const code = classify?.(parsed.error) ?? "VALIDATION_ERROR";
  throw new AppError(code, code === "VALIDATION_ERROR" ? describeIssues(parsed.error) : undefined);
}

// Paths and zod messages only: never echo the received values back.
function describeIssues(error: z.ZodError): string {
  const parts = error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
  return `${DEFAULT_ERROR_MESSAGES.VALIDATION_ERROR}: ${parts.join("; ")}`;
}

export function errorBody(code: ErrorCode, message: string, requestId: string): ApiError {
  return { error: { code, message, retryable: ERROR_RETRYABLE[code], requestId } };
}

/**
 * Wraps a route handler: maps `AppError` to the `ApiErrorSchema` envelope with the
 * status from `ERROR_HTTP_STATUS`, turns anything else into `INTERNAL_ERROR` without
 * leaking details, and logs exactly one summary line per request.
 */
export function withErrors(fn: RouteHandler) {
  return async (event: APIGatewayProxyEventV2, context: Context): Promise<HttpResult> => {
    const requestId = event.requestContext?.requestId ?? "unknown";
    const route = event.routeKey ?? "unknown";
    logger.appendKeys({ requestId, route });
    try {
      const result = await fn(event, context);
      logger.info("request completed", { status: result.statusCode });
      return result;
    } catch (error) {
      const appError = error instanceof AppError ? error : undefined;
      const code: ErrorCode = appError?.code ?? "INTERNAL_ERROR";
      const status = ERROR_HTTP_STATUS[code];
      const message = appError?.message ?? DEFAULT_ERROR_MESSAGES.INTERNAL_ERROR;
      const details = { status, errorCode: code, ...describeCause(appError ? appError.cause : error) };
      if (status >= 500) logger.error("request failed", details);
      else logger.warn("request rejected", details);
      return json(status, errorBody(code, message, requestId));
    } finally {
      logger.removeKeys(["requestId", "route"]);
    }
  };
}

// Error class and message only; AWS SDK messages carry no image data or presigned URLs.
function describeCause(cause: unknown): Record<string, string> {
  if (cause instanceof Error) return { causeName: cause.name, causeMessage: cause.message };
  return {};
}
