import { S3Client } from "@aws-sdk/client-s3";
import { ApiErrorSchema, CreateUploadResponseSchema, IMAGE_CONTENT_TYPES, ImageKeySchema, MAX_UPLOAD_BYTES } from "@ghoststock/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUploadSlot } from "../src/services/uploads.js";
import { handler } from "../src/handlers/uploads.js";
import { apiEvent, lambdaContext } from "./helpers.js";

const BUCKET = "ghoststock-media-test";
const s3 = new S3Client({ region: "us-east-1", credentials: { accessKeyId: "TESTKEYID", secretAccessKey: "test-secret" } });

function policyOf(fields: Record<string, string>) {
  return JSON.parse(Buffer.from(fields.Policy as string, "base64").toString("utf8")) as {
    expiration: string;
    conditions: unknown[];
  };
}

describe("createUploadSlot [01-api 1.1]", () => {
  it.each(IMAGE_CONTENT_TYPES)("signs a constrained POST for %s", async (contentType) => {
    const now = new Date("2026-10-24T15:00:00.000Z");
    const slot = await createUploadSlot({ s3, bucket: BUCKET, now: () => now }, { contentType, sizeBytes: 842_113 });

    CreateUploadResponseSchema.parse(slot);
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[contentType];
    expect(slot.imageKey).toMatch(new RegExp(String.raw`^tmp/[0-9A-HJKMNP-TV-Z]{26}\.${ext}$`));
    expect(ImageKeySchema.safeParse(slot.imageKey).success).toBe(true);
    expect(slot.expiresAt).toBe("2026-10-24T15:05:00.000Z");
    expect(new URL(slot.url).protocol).toBe("https:");
    expect(slot.url).toContain(BUCKET);
    expect(slot.fields).toMatchObject({ key: slot.imageKey, "Content-Type": contentType, bucket: BUCKET });

    const policy = policyOf(slot.fields);
    expect(policy.conditions).toEqual(
      expect.arrayContaining([
        ["content-length-range", 1, MAX_UPLOAD_BYTES],
        ["eq", "$Content-Type", contentType],
        { key: slot.imageKey },
        { bucket: BUCKET },
      ]),
    );
    // No wildcard key, so the client cannot write anywhere else.
    expect(JSON.stringify(policy.conditions)).not.toContain("starts-with");
  });

  it("expires the policy 300 s after signing", async () => {
    const before = Date.now();
    const slot = await createUploadSlot({ s3, bucket: BUCKET }, { contentType: "image/png", sizeBytes: 10 });
    const expiration = Date.parse(policyOf(slot.fields).expiration);
    expect(expiration - before).toBeGreaterThanOrEqual(299_000);
    expect(expiration - before).toBeLessThanOrEqual(301_000);
  });

  it("issues a fresh key per slot", async () => {
    const a = await createUploadSlot({ s3, bucket: BUCKET }, { contentType: "image/png", sizeBytes: 10 });
    const b = await createUploadSlot({ s3, bucket: BUCKET }, { contentType: "image/png", sizeBytes: 10 });
    expect(a.imageKey).not.toBe(b.imageKey);
  });
});

describe("POST /api/uploads handler [01-api 1.1, 1.2, 1.3, 7.1]", () => {
  beforeEach(() => {
    vi.stubEnv("MEDIA_BUCKET", BUCKET);
    vi.stubEnv("AWS_REGION", "us-east-1");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "TESTKEYID");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  const post = (body: unknown) =>
    handler(apiEvent({ routeKey: "POST /api/uploads", body: JSON.stringify(body) }), lambdaContext);
  const errorCode = (res: Awaited<ReturnType<typeof post>>) => ApiErrorSchema.parse(JSON.parse(res.body as string)).error.code;

  it("returns 201 with a valid slot", async () => {
    const res = await post({ contentType: "image/jpeg", sizeBytes: 842_113 });
    expect(res.statusCode).toBe(201);
    CreateUploadResponseSchema.parse(JSON.parse(res.body as string));
  });

  it("accepts exactly 3 750 000 bytes", async () => {
    expect((await post({ contentType: "image/webp", sizeBytes: MAX_UPLOAD_BYTES })).statusCode).toBe(201);
  });

  it("returns 415 UNSUPPORTED_MEDIA_TYPE for a disallowed type", async () => {
    const res = await post({ contentType: "image/gif", sizeBytes: 10 });
    expect(res.statusCode).toBe(415);
    expect(errorCode(res)).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("returns 413 IMAGE_TOO_LARGE above 3 750 000 bytes", async () => {
    const res = await post({ contentType: "image/png", sizeBytes: MAX_UPLOAD_BYTES + 1 });
    expect(res.statusCode).toBe(413);
    expect(errorCode(res)).toBe("IMAGE_TOO_LARGE");
  });

  it.each([
    ["zero size", { contentType: "image/png", sizeBytes: 0 }],
    ["fractional size", { contentType: "image/png", sizeBytes: 1.5 }],
    ["missing size", { contentType: "image/png" }],
    ["extra key", { contentType: "image/png", sizeBytes: 1, key: "media/products/x.png" }],
  ])("returns 400 VALIDATION_ERROR for %s", async (_name, body) => {
    const res = await post(body);
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["both type and size invalid", { contentType: "image/gif", sizeBytes: MAX_UPLOAD_BYTES + 1 }],
    ["image/jpg", { contentType: "image/jpg", sizeBytes: 10 }],
    ["upper case", { contentType: "IMAGE/PNG", sizeBytes: 10 }],
    ["svg", { contentType: "image/svg+xml", sizeBytes: 10 }],
    ["empty type", { contentType: "", sizeBytes: 10 }],
    ["missing type", { sizeBytes: 10 }],
  ])("returns 415 for %s (content type wins)", async (_name, body) => {
    const res = await post(body);
    expect(res.statusCode).toBe(415);
    expect(errorCode(res)).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("returns 413 for a very large size", async () => {
    expect(errorCode(await post({ contentType: "image/png", sizeBytes: 1e12 }))).toBe("IMAGE_TOO_LARGE");
  });

  it.each([
    ["negative size", { contentType: "image/png", sizeBytes: -1 }],
    ["string size", { contentType: "image/png", sizeBytes: "100" }],
  ])("returns 400 for %s", async (_name, body) => {
    expect(errorCode(await post(body))).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["not json", "not json"],
    ["no body", undefined],
  ])("returns 400 for %s", async (_name, body) => {
    const res = await handler(apiEvent({ routeKey: "POST /api/uploads", body }), lambdaContext);
    expect(res.statusCode).toBe(400);
  });

  it("expiresAt matches the signed policy expiration", async () => {
    const slot = await createUploadSlot({ s3, bucket: BUCKET }, { contentType: "image/png", sizeBytes: 10 });
    expect(Math.abs(Date.parse(slot.expiresAt) - Date.parse(policyOf(slot.fields).expiration))).toBeLessThanOrEqual(1000);
  });
});

describe("POST /api/uploads configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("validates the body before reading configuration, then fails closed without leaking it", async () => {
    vi.resetModules();
    vi.stubEnv("MEDIA_BUCKET", "");
    const fresh = (await import("../src/handlers/uploads.js")).handler;
    const send = (body: unknown) =>
      fresh(apiEvent({ routeKey: "POST /api/uploads", body: JSON.stringify(body) }), lambdaContext);

    expect((await send({ contentType: "image/gif", sizeBytes: 1 })).statusCode).toBe(415);
    const res = await send({ contentType: "image/png", sizeBytes: 1 });
    expect(res.statusCode).toBe(500);
    const body = ApiErrorSchema.parse(JSON.parse(res.body as string));
    expect(body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "Unexpected error" });
    expect(res.body).not.toContain("MEDIA_BUCKET");
  });
});
