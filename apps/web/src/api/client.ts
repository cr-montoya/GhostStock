import { ApiErrorSchema, type ErrorCode } from "@ghoststock/contracts";
import type { z } from "zod";

export type ClientErrorCode = ErrorCode | "NETWORK" | "UNEXPECTED";

export class ApiClientError extends Error {
  readonly code: ClientErrorCode;
  readonly retryable: boolean;
  readonly status: number | undefined;
  readonly requestId: string | undefined;

  constructor(
    code: ClientErrorCode,
    options: { retryable: boolean; status?: number; requestId?: string; message?: string },
  ) {
    super(options.message ?? code);
    this.name = "ApiClientError";
    this.code = code;
    this.retryable = options.retryable;
    this.status = options.status;
    this.requestId = options.requestId;
  }
}

/** Normalizes any thrown value into an ApiClientError. */
export function toClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;
  return new ApiClientError("UNEXPECTED", { retryable: true });
}

/**
 * Same-origin JSON fetch. Success bodies are parsed with `schema`; error bodies with
 * `ApiErrorSchema`. Anything that is not a valid envelope (HTTP API 429, CloudFront
 * 5xx, empty body) becomes a retryable UNEXPECTED error; 204 resolves to undefined.
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  init: { method?: string; body?: unknown },
  schema: S,
): Promise<z.infer<S>>;
export async function apiFetch(path: string, init: { method?: string; body?: unknown }): Promise<undefined>;
export async function apiFetch(
  path: string,
  init: { method?: string; body?: unknown },
  schema?: z.ZodType,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? { accept: "application/json" } : { "content-type": "application/json", accept: "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiClientError("NETWORK", { retryable: true });
  }

  if (response.status === 204) return undefined;

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) {
      const { code, retryable, requestId, message } = parsed.data.error;
      throw new ApiClientError(code, { retryable, requestId, message, status: response.status });
    }
    throw new ApiClientError("UNEXPECTED", { retryable: true, status: response.status });
  }

  if (!schema) return undefined;
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiClientError("UNEXPECTED", { retryable: true, status: response.status });
  return parsed.data;
}
