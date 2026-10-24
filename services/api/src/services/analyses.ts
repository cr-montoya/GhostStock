import type { BedrockRuntimeClient, ConverseCommandOutput, ImageFormat } from "@aws-sdk/client-bedrock-runtime";
import type { S3Client } from "@aws-sdk/client-s3";
import {
  AnalysisSchema,
  ImageContentType,
  MAX_UPLOAD_BYTES,
  ModelOutputSchema,
  type Analysis,
  type ModelOutput,
} from "@ghoststock/contracts";
import { CONVERSE_DEADLINE_MS, converseWithTool, type ConverseDeps } from "../adapters/bedrock.js";
import { getImageBytes, headImage } from "../adapters/s3.js";
import { REPORT_PRODUCTS_TOOL_NAME } from "../bedrock/tool.js";
import { AppError } from "../lib/errors.js";
import { ulid } from "../lib/ids.js";

export interface AnalysesDeps {
  s3: S3Client;
  bucket: string;
  bedrock: BedrockRuntimeClient;
  modelId: string;
  converse?: Partial<Pick<ConverseDeps, "deadlineMs" | "now" | "sleep">>;
  clock?: () => number;
}

export interface AnalysisResult {
  analysis: Analysis;
  attempts: number;
}

const FORMATS: Record<ImageContentType, ImageFormat> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Checks the stored object, sends its bytes to Bedrock once and returns validated
 * candidates. Size and type are rejected before Bedrock is called; empty output is a
 * valid empty analysis; anything else the model returns that is not a valid
 * `report_products` call is `MODEL_INVALID_OUTPUT`, with no partial salvage.
 */
export async function analyzeImage(deps: AnalysesDeps, imageKey: string): Promise<AnalysisResult> {
  const clock = deps.clock ?? Date.now;
  // One budget for the whole request: S3 time is taken from the Converse deadline, so
  // the envelope always beats the Lambda timeout (req 3.5).
  const budgetMs = deps.converse?.deadlineMs ?? CONVERSE_DEADLINE_MS;
  const requestStart = clock();

  const head = await headImage(deps.s3, deps.bucket, imageKey);
  if (head.contentLength > MAX_UPLOAD_BYTES) throw new AppError("IMAGE_TOO_LARGE");
  const contentType = ImageContentType.safeParse(head.contentType);
  if (!contentType.success) throw new AppError("UNSUPPORTED_MEDIA_TYPE");

  const bytes = await getImageBytes(deps.s3, deps.bucket, imageKey);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new AppError("IMAGE_TOO_LARGE");

  const startedAt = clock();
  const { output, attempts } = await converseWithTool(
    { client: deps.bedrock, modelId: deps.modelId, ...deps.converse, deadlineMs: budgetMs - (startedAt - requestStart) },
    { format: FORMATS[contentType.data], bytes },
  );
  const latencyMs = Math.max(0, Math.round(clock() - startedAt));
  const products = readToolOutput(output).products;

  const analysis = AnalysisSchema.parse({
    analysisId: ulid(),
    imageKey,
    modelId: deps.modelId,
    latencyMs,
    candidates: products.map((product) => ({ ...product, candidateId: ulid() })),
  });
  return { analysis, attempts };
}

/** Extracts and validates the forced tool call; the model output is untrusted. */
export function readToolOutput(output: ConverseCommandOutput): ModelOutput {
  if (output.stopReason !== "tool_use") {
    throw new AppError("MODEL_INVALID_OUTPUT", `Unexpected stop reason: ${String(output.stopReason)}`);
  }
  const toolUse = output.output?.message?.content?.find((block) => block.toolUse?.name === REPORT_PRODUCTS_TOOL_NAME)?.toolUse;
  if (!toolUse) throw new AppError("MODEL_INVALID_OUTPUT", "Model did not call report_products");
  const parsed = ModelOutputSchema.safeParse(toolUse.input);
  if (!parsed.success) throw new AppError("MODEL_INVALID_OUTPUT", undefined, parsed.error);
  return parsed.data;
}
