import { analysisFixture, emptyAnalysisFixture } from "@ghoststock/contracts";
import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/api/client";
import { initialInvocation, invocationReducer, type InvocationState, type Photo } from "./invocationReducer";

const photo = { previewUrl: "blob:x", name: "foto.jpg", contentType: "image/jpeg", width: 1, height: 1 } as Photo;
const imageKey = "tmp/01JB5X7Q8M0000000000000900.jpg";
const error = (code: ApiClientError["code"]) => new ApiClientError(code, { retryable: true });
const run = (state: InvocationState, ...actions: Parameters<typeof invocationReducer>[1][]) =>
  actions.reduce(invocationReducer, state);

describe("invocation state machine", () => {
  it("goes idle -> preview -> uploading -> analyzing -> review", () => {
    const state = run(
      initialInvocation,
      { type: "picked", photo },
      { type: "confirm" },
      { type: "uploaded", imageKey },
      { type: "analyzed", analysis: analysisFixture },
    );
    expect(state).toMatchObject({ step: "review", imageKey, analysis: analysisFixture });
  });

  it("[02 4.4] zero candidates lands on the zero state, and retry analyzes the same key", () => {
    const zero = run(initialInvocation, { type: "picked", photo }, { type: "confirm" }, { type: "uploaded", imageKey }, {
      type: "analyzed",
      analysis: emptyAnalysisFixture,
    });
    expect(zero).toMatchObject({ step: "zero", imageKey });
    expect(invocationReducer(zero, { type: "confirm" })).toMatchObject({ step: "analyzing", imageKey });
  });

  it("[02 4.3] retry after an upload failure uploads again", () => {
    const failed = run(initialInvocation, { type: "picked", photo }, { type: "confirm" }, { type: "failed", error: error("NETWORK") });
    expect(failed).toMatchObject({ step: "failed", imageKey: undefined });
    expect(invocationReducer(failed, { type: "confirm" })).toMatchObject({ step: "uploading" });
  });

  it("[02 4.3] retry after an analysis failure re-analyzes without uploading", () => {
    const failed = run(
      initialInvocation,
      { type: "picked", photo },
      { type: "confirm" },
      { type: "uploaded", imageKey },
      { type: "failed", error: error("MODEL_INVALID_OUTPUT") },
    );
    expect(invocationReducer(failed, { type: "confirm" })).toMatchObject({ step: "analyzing", imageKey });
  });

  it("an expired photo (IMAGE_NOT_FOUND) is uploaded again on retry", () => {
    const failed = run(
      initialInvocation,
      { type: "picked", photo },
      { type: "confirm" },
      { type: "uploaded", imageKey },
      { type: "failed", error: error("IMAGE_NOT_FOUND") },
    );
    expect(failed).toMatchObject({ step: "failed", imageKey: undefined });
    expect(invocationReducer(failed, { type: "confirm" })).toMatchObject({ step: "uploading" });
  });

  it("ignores actions that do not belong to the current step", () => {
    expect(invocationReducer(initialInvocation, { type: "uploaded", imageKey })).toBe(initialInvocation);
    expect(invocationReducer(initialInvocation, { type: "analyzed", analysis: analysisFixture })).toBe(initialInvocation);
    expect(invocationReducer(initialInvocation, { type: "failed", error: error("NETWORK") })).toBe(initialInvocation);
  });

  it("[02 3.2] an invalid pick stays idle with its error, and reset clears everything", () => {
    expect(invocationReducer(initialInvocation, { type: "invalid", error: "type" })).toEqual({ step: "idle", error: "type" });
    expect(run(initialInvocation, { type: "picked", photo }, { type: "reset" })).toEqual({ step: "idle" });
  });
});
