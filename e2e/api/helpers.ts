import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ApiErrorSchema,
  CreateUploadResponseSchema,
  type CreateUploadResponse,
  type ErrorCode,
  type ImageContentType,
} from "@ghoststock/contracts";
import { test as base, expect, type APIRequestContext, type APIResponse } from "@playwright/test";

type RequestOptions = NonNullable<Parameters<APIRequestContext["fetch"]>[1]>;

/**
 * Calls to the deployed API. The stage is throttled (burst 10, rate 5, security.md), so a
 * `429` from API Gateway is retried with backoff; it is not a contract response. Every
 * other status is returned as is.
 */
export interface Api {
  get(path: string, options?: RequestOptions): Promise<APIResponse>;
  post(path: string, options?: RequestOptions): Promise<APIResponse>;
  put(path: string, options?: RequestOptions): Promise<APIResponse>;
  delete(path: string, options?: RequestOptions): Promise<APIResponse>;
}

const THROTTLE_BACKOFF_MS = [500, 1000, 2000, 4000] as const;

function apiFor(request: APIRequestContext): Api {
  const send = async (method: string, path: string, options: RequestOptions = {}) => {
    for (let attempt = 0; ; attempt++) {
      const response = await request.fetch(path, { ...options, method });
      const backoff = THROTTLE_BACKOFF_MS[attempt];
      if (response.status() !== 429 || backoff === undefined) return response;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  };
  return {
    get: (path, options) => send("GET", path, options),
    post: (path, options) => send("POST", path, options),
    put: (path, options) => send("PUT", path, options),
    delete: (path, options) => send("DELETE", path, options),
  };
}

export const test = base.extend<{ api: Api }>({
  api: async ({ request }, use) => {
    await use(apiFor(request));
  },
});

/**
 * The api project targets a deployed stack; without BASE_URL there is nothing to test.
 * Tests in a file run in order; run the project with --workers=1 so the whole suite is
 * serial and stays under the stage throttling, which is never relaxed for tests.
 */
export function setupApiSpec() {
  test.skip(!process.env.BASE_URL, "BASE_URL of a deployed stack is required (project api)");
  test.describe.configure({ mode: "default" });
}

export function fixtureImage(name: string): Buffer {
  return readFileSync(fileURLToPath(new URL(`../fixtures/images/${name}`, import.meta.url)));
}

/** Asserts the standard error envelope, its status and code, and returns it. */
export async function expectApiError(response: APIResponse, status: number, code: ErrorCode) {
  expect(response.status()).toBe(status);
  expect(response.headers()["content-type"]).toContain("application/json");
  const body = ApiErrorSchema.parse(await response.json());
  expect(body.error.code).toBe(code);
  expect(body.error.requestId.length).toBeGreaterThan(0);
  return body;
}

export async function createUpload(api: Api, contentType: ImageContentType, sizeBytes: number): Promise<CreateUploadResponse> {
  const response = await api.post("/api/uploads", { data: { contentType, sizeBytes } });
  expect(response.status()).toBe(201);
  expect(response.headers()["cache-control"]).toContain("no-store");
  return CreateUploadResponseSchema.parse(await response.json());
}

/** Posts the presigned form straight to S3 (fields first, file last), as the browser does. */
export async function postToS3(request: APIRequestContext, slot: CreateUploadResponse, file: Buffer, contentType: string) {
  return request.post(slot.url, {
    multipart: { ...slot.fields, file: { name: "photo", mimeType: contentType, buffer: file } },
  });
}

/** Uploads bytes as a jpeg through a fresh slot and returns the `tmp/` key. */
export async function uploadBytes(api: Api, request: APIRequestContext, file: Buffer): Promise<string> {
  const slot = await createUpload(api, "image/jpeg", file.byteLength);
  const s3 = await postToS3(request, slot, file, "image/jpeg");
  expect(s3.status()).toBe(204);
  return slot.imageKey;
}

/** Uploads a fixture photo and returns its `tmp/` key. */
export async function uploadFixture(api: Api, request: APIRequestContext, name: string): Promise<string> {
  return uploadBytes(api, request, fixtureImage(name));
}
