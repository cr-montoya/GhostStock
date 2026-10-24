import { MetricUnit } from "@aws-lambda-powertools/metrics";
import { S3Client } from "@aws-sdk/client-s3";
import { CreateAnalysisRequestSchema } from "@ghoststock/contracts";
import { createBedrockClient } from "../adapters/bedrock.js";
import { AnalysesEnvSchema, envLoader } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { json, parseJson, withErrors } from "../lib/http.js";
import { logger, metrics } from "../lib/observability.js";
import { analyzeImage } from "../services/analyses.js";

const env = envLoader(AnalysesEnvSchema);
const s3 = new S3Client({});
const bedrock = createBedrockClient();

/** POST /api/analyses */
export const handler = withErrors(async (event) => {
  const { imageKey } = parseJson(event, CreateAnalysisRequestSchema);
  const { MEDIA_BUCKET, BEDROCK_MODEL_ID } = env();
  try {
    const { analysis, attempts } = await analyzeImage(
      { s3, bucket: MEDIA_BUCKET, bedrock, modelId: BEDROCK_MODEL_ID },
      imageKey,
    );
    metrics.addMetric("AnalysisLatencyMs", MetricUnit.Milliseconds, analysis.latencyMs);
    metrics.addMetric("CandidateCount", MetricUnit.Count, analysis.candidates.length);
    metrics.publishStoredMetrics();
    // Ids, key, model and counts only: never bytes, base64 or model text (req 8.3).
    logger.info("analysis completed", {
      analysisId: analysis.analysisId,
      imageKey,
      modelId: BEDROCK_MODEL_ID,
      latencyMs: analysis.latencyMs,
      candidateCount: analysis.candidates.length,
      attempts,
    });
    return json(200, analysis);
  } catch (error) {
    const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
    const failed = metrics.singleMetric();
    failed.addDimension("errorCode", code);
    failed.addMetric("AnalysisFailed", MetricUnit.Count, 1);
    logger.warn("analysis failed", { imageKey, modelId: BEDROCK_MODEL_ID, errorCode: code });
    throw error;
  }
});
