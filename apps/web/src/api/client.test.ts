import { SettingsSchema, apiErrorFixtures, settingsFixture } from "@ghoststock/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, apiFetch } from "./client";

function respond(body: BodyInit | null, init: ResponseInit) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, init)));
}

async function failure(promise: Promise<unknown>): Promise<ApiClientError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiClientError);
  return error as ApiClientError;
}

describe("apiFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses success bodies with the given schema", async () => {
    respond(JSON.stringify(settingsFixture), { status: 200 });
    await expect(apiFetch("/api/settings", {}, SettingsSchema)).resolves.toEqual(settingsFixture);
  });

  it("[02 11.5] accepts 204 without a body", async () => {
    respond(null, { status: 204 });
    await expect(apiFetch("/api/products/x", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("maps a valid error envelope to its code", async () => {
    respond(JSON.stringify(apiErrorFixtures.MODEL_THROTTLED), { status: 503 });
    const error = await failure(apiFetch("/api/analyses", { method: "POST", body: {} }, SettingsSchema));
    expect(error).toMatchObject({ code: "MODEL_THROTTLED", retryable: true, status: 503 });
  });

  it("[02 11.5] treats a bare HTTP API 429 as a retryable UNEXPECTED error", async () => {
    respond(JSON.stringify({ message: "Too Many Requests" }), { status: 429 });
    const error = await failure(apiFetch("/api/analyses", { method: "POST", body: {} }, SettingsSchema));
    expect(error).toMatchObject({ code: "UNEXPECTED", retryable: true, status: 429 });
  });

  it("[02 11.5] treats an empty CloudFront 5xx as UNEXPECTED", async () => {
    respond("", { status: 502 });
    const error = await failure(apiFetch("/api/products", {}, SettingsSchema));
    expect(error).toMatchObject({ code: "UNEXPECTED", retryable: true });
  });

  it("turns a failed fetch into NETWORK", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const error = await failure(apiFetch("/api/products", {}, SettingsSchema));
    expect(error).toMatchObject({ code: "NETWORK", retryable: true });
  });

  it("rejects a success body that breaks the contract", async () => {
    respond(JSON.stringify({ lowStockThreshold: -1 }), { status: 200 });
    const error = await failure(apiFetch("/api/settings", {}, SettingsSchema));
    expect(error.code).toBe("UNEXPECTED");
  });
});
