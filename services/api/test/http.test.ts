import { describe, expect, it } from "vitest";
import { ApiErrorSchema, CreateUploadRequestSchema, ERROR_CODES, ERROR_HTTP_STATUS, classifyUploadRequestError } from "@ghoststock/contracts";
import { z } from "zod";
import { AppError } from "../src/lib/errors.js";
import { MAX_BODY_BYTES, json, noContent, parseJson, validate, withErrors } from "../src/lib/http.js";
import { REQUEST_ID, apiEvent, lambdaContext } from "./helpers.js";

const Body = z.strictObject({ name: z.string().min(1) });

function expectError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error("expected an AppError");
}

describe("json and noContent", () => {
  it("sets json content type and no-store", () => {
    const res = json(201, { ok: true });
    expect(res.statusCode).toBe(201);
    expect(res.headers).toMatchObject({ "content-type": "application/json", "cache-control": "no-store" });
    expect(JSON.parse(res.body as string)).toEqual({ ok: true });
  });

  it("returns 204 without body", () => {
    const res = noContent();
    expect(res.statusCode).toBe(204);
    expect(res.body).toBeUndefined();
    expect(res.headers).toMatchObject({ "cache-control": "no-store" });
  });
});

describe("parseJson [01-api 7.1, 7.2]", () => {
  it("parses a valid body", () => {
    expect(parseJson(apiEvent({ body: '{"name":"Café"}' }), Body)).toEqual({ name: "Café" });
  });

  it("decodes a base64 body", () => {
    const body = Buffer.from('{"name":"Panela"}').toString("base64");
    expect(parseJson(apiEvent({ body, isBase64Encoded: true }), Body)).toEqual({ name: "Panela" });
  });

  it("rejects a missing body", () => {
    expectError(() => parseJson(apiEvent({ body: undefined }), Body), "VALIDATION_ERROR");
  });

  it("rejects a body that is not JSON", () => {
    expectError(() => parseJson(apiEvent({ body: "name=x" }), Body), "VALIDATION_ERROR");
  });

  it("rejects a body over 64 KB before parsing", () => {
    const body = JSON.stringify({ name: "x".repeat(MAX_BODY_BYTES) });
    const error = expectError(() => parseJson(apiEvent({ body }), Body), "VALIDATION_ERROR");
    expect(error.message).toContain(String(MAX_BODY_BYTES));
  });

  it("measures the decoded size of a base64 body", () => {
    const body = Buffer.from(JSON.stringify({ name: "x".repeat(MAX_BODY_BYTES) })).toString("base64");
    expectError(() => parseJson(apiEvent({ body, isBase64Encoded: true }), Body), "VALIDATION_ERROR");
  });

  it("rejects a schema failure without echoing the value", () => {
    const error = expectError(() => parseJson(apiEvent({ body: '{"name":"","secret":"s3cr3t"}' }), Body), "VALIDATION_ERROR");
    expect(error.message).not.toContain("s3cr3t");
  });

  it("uses the classifier for uploads: 415 and 413", () => {
    const type = apiEvent({ body: '{"contentType":"image/gif","sizeBytes":10}' });
    expectError(() => parseJson(type, CreateUploadRequestSchema, classifyUploadRequestError), "UNSUPPORTED_MEDIA_TYPE");
    const size = apiEvent({ body: '{"contentType":"image/png","sizeBytes":3750001}' });
    expectError(() => parseJson(size, CreateUploadRequestSchema, classifyUploadRequestError), "IMAGE_TOO_LARGE");
  });

  it("validate checks non-body inputs", () => {
    expect(validate(z.string().min(2), "ok")).toBe("ok");
    expectError(() => validate(z.string().min(2), "x"), "VALIDATION_ERROR");
  });
});

describe("withErrors [01-api 7.3, 7.4, 8.1]", () => {
  it("passes a successful result through", async () => {
    const handler = withErrors(async () => json(200, { ok: true }));
    const res = await handler(apiEvent(), lambdaContext);
    expect(res.statusCode).toBe(200);
  });

  it.each(ERROR_CODES)("maps AppError %s to its status and the envelope", async (code) => {
    const handler = withErrors(async () => {
      throw new AppError(code);
    });
    const res = await handler(apiEvent(), lambdaContext);
    expect(res.statusCode).toBe(ERROR_HTTP_STATUS[code]);
    expect(res.headers).toMatchObject({ "content-type": "application/json", "cache-control": "no-store" });
    const body = ApiErrorSchema.parse(JSON.parse(res.body as string));
    expect(body.error.code).toBe(code);
    expect(body.error.requestId).toBe(REQUEST_ID);
  });

  it("turns an unexpected exception into INTERNAL_ERROR without leaking details", async () => {
    const handler = withErrors(async () => {
      throw new Error("AccessDenied arn:aws:iam::123456789012:role/secret at handler.ts:10");
    });
    const res = await handler(apiEvent(), lambdaContext);
    expect(res.statusCode).toBe(500);
    const raw = res.body as string;
    expect(raw).not.toMatch(/arn:aws|123456789012|handler\.ts|stack/i);
    expect(ApiErrorSchema.parse(JSON.parse(raw)).error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Unexpected error",
      retryable: false,
      requestId: REQUEST_ID,
    });
  });

  it("handles a non-Error throw", async () => {
    const handler = withErrors(async () => {
      throw "boom";
    });
    const res = await handler(apiEvent(), lambdaContext);
    expect(res.statusCode).toBe(500);
  });

  it("returns the 400 envelope for a parse failure inside the handler", async () => {
    const handler = withErrors(async (event) => json(200, parseJson(event, Body)));
    const res = await handler(apiEvent({ body: "{" }), lambdaContext);
    expect(res.statusCode).toBe(400);
    expect(ApiErrorSchema.parse(JSON.parse(res.body as string)).error.code).toBe("VALIDATION_ERROR");
  });
});
