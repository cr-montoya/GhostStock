import { describe, expect, it } from "vitest";
import { ApiErrorSchema, Ulid } from "@ghoststock/contracts";
import { AnalysesEnvSchema, InventoryEnvSchema, UploadsEnvSchema, envLoader } from "../src/lib/env.js";
import { AppError } from "../src/lib/errors.js";
import { ulid } from "../src/lib/ids.js";
import { handler as analyses } from "../src/handlers/analyses.js";
import { handler as inventory } from "../src/handlers/inventory.js";
import { handler as uploads } from "../src/handlers/uploads.js";
import { apiEvent, lambdaContext } from "./helpers.js";

describe("ulid", () => {
  it("produces contract ulids that sort in creation order", () => {
    const ids = Array.from({ length: 50 }, () => ulid());
    for (const id of ids) expect(Ulid.safeParse(id).success).toBe(true);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("AppError", () => {
  it("defaults the message from the code and keeps the cause", () => {
    const cause = new Error("NoSuchKey");
    const error = new AppError("IMAGE_NOT_FOUND", undefined, cause);
    expect(error.message).toBe("Image not found or expired");
    expect(error.cause).toBe(cause);
  });
});

describe("envLoader", () => {
  it("parses and caches each function environment", () => {
    const source = { MEDIA_BUCKET: "media", TABLE_NAME: "table", LOW_STOCK_DEFAULT: "5" };
    const load = envLoader(InventoryEnvSchema, source);
    expect(load()).toEqual({ MEDIA_BUCKET: "media", TABLE_NAME: "table", LOW_STOCK_DEFAULT: 5 });
    source.TABLE_NAME = "changed";
    expect(load().TABLE_NAME).toBe("table");
    expect(envLoader(UploadsEnvSchema, { MEDIA_BUCKET: "m" })()).toEqual({ MEDIA_BUCKET: "m" });
  });

  it("names missing variables without values", () => {
    const load = envLoader(AnalysesEnvSchema, { MEDIA_BUCKET: "media-secret-name" });
    expect(load).toThrow("Invalid environment: BEDROCK_MODEL_ID");
    expect(load).not.toThrow(/media-secret-name/);
  });

  it("rejects a negative low stock default", () => {
    const load = envLoader(InventoryEnvSchema, { MEDIA_BUCKET: "m", TABLE_NAME: "t", LOW_STOCK_DEFAULT: "-1" });
    expect(load).toThrow("LOW_STOCK_DEFAULT");
  });
});

describe("handler entry points (task 1 stubs)", () => {
  it.each([
    ["uploads", uploads],
    ["analyses", analyses],
    ["inventory", inventory],
  ])("%s answers 500 INTERNAL_ERROR in the envelope", async (_name, handler) => {
    const res = await handler(apiEvent(), lambdaContext);
    expect(res.statusCode).toBe(500);
    const body = ApiErrorSchema.parse(JSON.parse(res.body as string));
    expect(body.error).toMatchObject({ code: "INTERNAL_ERROR", message: "Not implemented" });
  });
});
