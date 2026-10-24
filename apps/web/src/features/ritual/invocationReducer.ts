import type { Analysis } from "@ghoststock/contracts";
import type { ApiClientError } from "@/api/client";
import type { ProcessedImage } from "./resizeImage";

export type Photo = ProcessedImage & { previewUrl: string; name: string };

/** States of the /invocar flow (design.md, flow state machine). */
export type InvocationState =
  | { step: "idle"; error?: "type" | "original-size" | "processed-size" | "unreadable" }
  | { step: "preview"; photo: Photo }
  | { step: "uploading"; photo: Photo; imageKey?: string }
  | { step: "analyzing"; photo: Photo; imageKey: string }
  | { step: "failed"; photo: Photo; imageKey?: string; error: ApiClientError }
  | { step: "zero"; photo: Photo; imageKey: string }
  | { step: "review"; photo: Photo; imageKey: string; analysis: Analysis };

export type InvocationAction =
  | { type: "invalid"; error: "type" | "original-size" | "processed-size" | "unreadable" }
  | { type: "picked"; photo: Photo }
  | { type: "confirm" }
  | { type: "uploaded"; imageKey: string }
  | { type: "analyzed"; analysis: Analysis }
  | { type: "failed"; error: ApiClientError }
  | { type: "reset" };

export const initialInvocation: InvocationState = { step: "idle" };

export function invocationReducer(state: InvocationState, action: InvocationAction): InvocationState {
  switch (action.type) {
    case "invalid":
      return { step: "idle", error: action.error };
    case "picked":
      return { step: "preview", photo: action.photo };
    case "confirm":
      if (state.step === "preview") return { step: "uploading", photo: state.photo };
      if (state.step === "zero") return { step: "analyzing", photo: state.photo, imageKey: state.imageKey };
      if (state.step === "failed") {
        // Retry: skip the upload when S3 already has the photo.
        return state.imageKey
          ? { step: "analyzing", photo: state.photo, imageKey: state.imageKey }
          : { step: "uploading", photo: state.photo };
      }
      return state;
    case "uploaded":
      return state.step === "uploading" ? { step: "analyzing", photo: state.photo, imageKey: action.imageKey } : state;
    case "analyzed":
      if (state.step !== "analyzing") return state;
      return action.analysis.candidates.length === 0
        ? { step: "zero", photo: state.photo, imageKey: state.imageKey }
        : { step: "review", photo: state.photo, imageKey: state.imageKey, analysis: action.analysis };
    case "failed":
      if (state.step === "uploading" || state.step === "analyzing") {
        return {
          step: "failed",
          photo: state.photo,
          // An expired photo must be uploaded again.
          imageKey:
            state.step === "analyzing" && action.error.code !== "IMAGE_NOT_FOUND" ? state.imageKey : undefined,
          error: action.error,
        };
      }
      return state;
    case "reset":
      return { step: "idle" };
  }
}
