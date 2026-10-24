import { AnalysisSchema, type Analysis } from "@ghoststock/contracts";
import { apiFetch } from "./client";

export function createAnalysis(imageKey: string): Promise<Analysis> {
  return apiFetch("/api/analyses", { method: "POST", body: { imageKey } }, AnalysisSchema);
}
