import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
  type ImageFormat,
} from "@aws-sdk/client-bedrock-runtime";
import { SYSTEM_PROMPT, USER_PROMPT } from "../bedrock/prompt.js";
import { REPORT_PRODUCTS_TOOL, REPORT_PRODUCTS_TOOL_NAME } from "../bedrock/tool.js";
import { AppError } from "../lib/errors.js";

/** One deadline across every attempt and backoff, under the 28 s Lambda timeout. */
export const CONVERSE_DEADLINE_MS = 25_000;
/** Backoff before retry 1 and retry 2; only throttling is retried (ai-integration.md). */
export const RETRY_DELAYS_MS = [400, 1200] as const;

const RETRYABLE = new Set(["ThrottlingException", "ServiceUnavailableException"]);
const UNAVAILABLE = new Set(["AccessDeniedException", "ResourceNotFoundException"]);
// ValidationException messages, checked in this order (design "Analyses" step 4):
// a model that cannot take images is configuration, not the photo;
const MODEL_REJECTS_IMAGES = /(doesn't|does not|isn't|not) support(ed)? (the )?image/i;
// a problem with the photo itself: the user should try another one;
const IMAGE_PROBLEM = /image|\bformat\b|dimension|decode|(could not|unable to) process/i;
// a model id, access or invocation problem. Not bare "model": Amazon Nova prefixes every
// error with "The model returned the following errors".
const MODEL_PROBLEM = /access|model identifier|model id|on-demand throughput|not supported|(doesn't|does not|isn't) support/i;

/** Retries are ours only: the SDK must not add its own on top (req 3.5). */
export function createBedrockClient(): BedrockRuntimeClient {
  // The US cross-region inference profiles are invoked from us-east-1 (ai-integration.md).
  return new BedrockRuntimeClient({ region: "us-east-1", maxAttempts: 1 });
}

export interface ConverseDeps {
  client: BedrockRuntimeClient;
  modelId: string;
  deadlineMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface ConverseImage {
  format: ImageFormat;
  bytes: Uint8Array;
}

export interface ConverseResult {
  output: ConverseCommandOutput;
  attempts: number;
}

/**
 * Calls Converse once with the image and the forced `report_products` tool, retrying
 * only throttling (2 retries, 400 ms then 1200 ms) while the deadline allows. Every
 * failure becomes an `AppError`: throttling, model timeout and the deadline are
 * `MODEL_THROTTLED`; access or model id problems are `MODEL_UNAVAILABLE`.
 */
export async function converseWithTool(deps: ConverseDeps, image: ConverseImage): Promise<ConverseResult> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadlineMs = deps.deadlineMs ?? CONVERSE_DEADLINE_MS;
  if (deadlineMs <= 0) throw new AppError("MODEL_THROTTLED", "No time left for the model call");
  const startedAt = now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AppError("MODEL_THROTTLED", "Model call exceeded the deadline"));
    }, deadlineMs);
  });
  deadline.catch(() => undefined);

  const command = new ConverseCommand({
    modelId: deps.modelId,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [
      {
        role: "user",
        content: [{ image: { format: image.format, source: { bytes: image.bytes } } }, { text: USER_PROMPT }],
      },
    ],
    toolConfig: { tools: [REPORT_PRODUCTS_TOOL], toolChoice: { tool: { name: REPORT_PRODUCTS_TOOL_NAME } } },
    inferenceConfig: { maxTokens: 2000, temperature: 0 },
  });

  try {
    for (let attempt = 1; ; attempt++) {
      try {
        const output = await Promise.race([deps.client.send(command, { abortSignal: controller.signal }), deadline]);
        return { output, attempts: attempt };
      } catch (error) {
        if (error instanceof AppError) throw error;
        const name = error instanceof Error ? error.name : "";
        const delay = RETRY_DELAYS_MS[attempt - 1];
        if (RETRYABLE.has(name) && delay !== undefined && now() - startedAt + delay < deadlineMs) {
          await Promise.race([sleep(delay), deadline]);
          continue;
        }
        throw mapBedrockError(error);
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Maps a Bedrock SDK exception to the contract error code (ai-integration.md, req 3.4).
 * ValidationException: a model that rejects images, then the photo, then the model id
 * or access; anything else is INTERNAL_ERROR.
 * Any other one is INTERNAL_ERROR; its Bedrock message is logged, never image bytes.
 */
export function mapBedrockError(error: unknown): AppError {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (RETRYABLE.has(name) || name === "ModelTimeoutException" || name === "AbortError") {
    return new AppError("MODEL_THROTTLED", undefined, error);
  }
  if (UNAVAILABLE.has(name)) return new AppError("MODEL_UNAVAILABLE", undefined, error);
  if (name === "ValidationException") {
    if (MODEL_REJECTS_IMAGES.test(message)) return new AppError("MODEL_UNAVAILABLE", undefined, error);
    if (IMAGE_PROBLEM.test(message)) {
      return new AppError("UNSUPPORTED_MEDIA_TYPE", "Image could not be processed", error);
    }
    if (MODEL_PROBLEM.test(message)) return new AppError("MODEL_UNAVAILABLE", undefined, error);
  }
  return new AppError("INTERNAL_ERROR", undefined, error);
}
