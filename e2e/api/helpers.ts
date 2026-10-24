import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ApiErrorSchema,
  CreateUploadResponseSchema,
  type CreateUploadResponse,
  type ErrorCode,
  type ImageContentType,
} from "@ghoststock/contracts";
import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

/** The api project targets a deployed stack; without BASE_URL there is nothing to test. */
export function requireDeployedStack() {
  test.skip(!process.env.BASE_URL, "BASE_URL of a deployed stack is required (project api)");
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

export async function createUpload(
  request: APIRequestContext,
  contentType: ImageContentType,
  sizeBytes: number,
): Promise<CreateUploadResponse> {
  const response = await request.post("/api/uploads", { data: { contentType, sizeBytes } });
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

/** Uploads a fixture photo and returns its `tmp/` key. */
export async function uploadFixture(request: APIRequestContext, name: string): Promise<string> {
  const file = fixtureImage(name);
  const slot = await createUpload(request, "image/jpeg", file.byteLength);
  const s3 = await postToS3(request, slot, file, "image/jpeg");
  expect(s3.status()).toBe(204);
  return slot.imageKey;
}
