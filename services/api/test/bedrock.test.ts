import {
  AccessDeniedException,
  BedrockRuntimeClient,
  ConverseCommand,
  InternalServerException,
  ModelTimeoutException,
  ResourceNotFoundException,
  ServiceUnavailableException,
  ThrottlingException,
  ValidationException,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { ModelOutputJsonSchema } from "@ghoststock/contracts";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, describe, expect, it } from "vitest";
import { CONVERSE_DEADLINE_MS, converseWithTool, createBedrockClient, mapBedrockError } from "../src/adapters/bedrock.js";
import { SYSTEM_PROMPT, USER_PROMPT } from "../src/bedrock/prompt.js";
import { REPORT_PRODUCTS_TOOL } from "../src/bedrock/tool.js";
import { AppError } from "../src/lib/errors.js";

const bedrock = mockClient(BedrockRuntimeClient);
const client = new BedrockRuntimeClient({ region: "us-east-1" });
const MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const image = { format: "jpeg" as const, bytes: new Uint8Array([0xff, 0xd8, 0xff]) };
const meta = { $metadata: {} };
const ok: ConverseCommandOutput = {
  $metadata: {},
  stopReason: "tool_use",
  output: {
    message: { role: "assistant", content: [{ toolUse: { toolUseId: "t1", name: "report_products", input: { products: [] } } }] },
  },
  usage: undefined,
  metrics: undefined,
};

/** Fake clock: sleeping advances time instantly and records each delay. */
function fakeTime() {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return (error as AppError).code;
  }
  throw new Error("expected an AppError");
}

afterEach(() => bedrock.reset());

describe("prompt and tool [ADR 0007]", () => {
  it("forces a tool whose schema is the contract schema, with no price, quantity or sku", () => {
    expect(REPORT_PRODUCTS_TOOL.toolSpec?.inputSchema).toEqual({ json: ModelOutputJsonSchema });
    expect(JSON.stringify(ModelOutputJsonSchema)).not.toMatch(/price|quantity|sku|barcode/i);
  });

  it("keeps the prompt rules", () => {
    expect(SYSTEM_PROMPT).toMatch(/Never output prices, quantities, SKUs, barcodes/);
    expect(SYSTEM_PROMPT).toMatch(/empty list/);
    expect(SYSTEM_PROMPT).toMatch(/Spanish/);
    expect(USER_PROMPT).toContain("report_products");
  });
});

describe("converseWithTool [01-api 3.3, 3.4, 3.5]", () => {
  it("sends one Converse call with the image, the forced tool and temperature 0", async () => {
    bedrock.on(ConverseCommand).resolves(ok);
    const result = await converseWithTool({ client, modelId: MODEL_ID, ...fakeTime() }, image);
    expect(result.attempts).toBe(1);
    const calls = bedrock.commandCalls(ConverseCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0]!.args[0].input;
    expect(input.modelId).toBe(MODEL_ID);
    expect(input.system).toEqual([{ text: SYSTEM_PROMPT }]);
    expect(input.messages?.[0]?.content?.[0]).toEqual({ image: { format: "jpeg", source: { bytes: image.bytes } } });
    expect(input.messages?.[0]?.content?.[1]).toEqual({ text: USER_PROMPT });
    expect(input.toolConfig?.toolChoice).toEqual({ tool: { name: "report_products" } });
    expect(input.toolConfig?.tools).toEqual([REPORT_PRODUCTS_TOOL]);
    expect(input.inferenceConfig).toEqual({ maxTokens: 2000, temperature: 0 });
  });

  it("creates the client with maxAttempts 1", async () => {
    expect(await createBedrockClient().config.maxAttempts()).toBe(1);
  });

  it.each([
    ["ThrottlingException", () => new ThrottlingException({ message: "slow down", ...meta })],
    ["ServiceUnavailableException", () => new ServiceUnavailableException({ message: "busy", ...meta })],
  ])("retries %s with 400 then 1200 ms and succeeds", async (_name, make) => {
    const time = fakeTime();
    bedrock.on(ConverseCommand).rejectsOnce(make()).rejectsOnce(make()).resolves(ok);
    const result = await converseWithTool({ client, modelId: MODEL_ID, ...time }, image);
    expect(result.attempts).toBe(3);
    expect(time.sleeps).toEqual([400, 1200]);
  });

  it("returns MODEL_THROTTLED after 2 retries (3 calls in total)", async () => {
    const time = fakeTime();
    bedrock.on(ConverseCommand).rejects(new ThrottlingException({ message: "slow down", ...meta }));
    expect(await codeOf(converseWithTool({ client, modelId: MODEL_ID, ...time }, image))).toBe("MODEL_THROTTLED");
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(3);
    expect(time.sleeps).toEqual([400, 1200]);
  });

  it("does not retry when the backoff would cross the deadline", async () => {
    const time = fakeTime();
    bedrock.on(ConverseCommand).rejects(new ThrottlingException({ message: "slow down", ...meta }));
    const deps = { client, modelId: MODEL_ID, deadlineMs: 1000, ...time };
    expect(await codeOf(converseWithTool(deps, image))).toBe("MODEL_THROTTLED");
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(2);
    expect(time.sleeps).toEqual([400]);
  });

  it("returns MODEL_THROTTLED after 2 retries of ServiceUnavailableException", async () => {
    const time = fakeTime();
    bedrock.on(ConverseCommand).rejects(new ServiceUnavailableException({ message: "busy", ...meta }));
    expect(await codeOf(converseWithTool({ client, modelId: MODEL_ID, ...time }, image))).toBe("MODEL_THROTTLED");
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(3);
    expect(time.sleeps).toEqual([400, 1200]);
  });

  it("answers MODEL_THROTTLED when the deadline fires during a backoff, without another call", async () => {
    bedrock.on(ConverseCommand).rejects(new ThrottlingException({ message: "slow down", ...meta }));
    const started = Date.now();
    const sleep = () => new Promise<void>(() => undefined);
    const code = await codeOf(converseWithTool({ client, modelId: MODEL_ID, deadlineMs: 500, sleep }, image));
    expect(code).toBe("MODEL_THROTTLED");
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("aborts the in-flight SDK call at the deadline", async () => {
    bedrock.on(ConverseCommand).callsFake(() => new Promise(() => undefined));
    await codeOf(converseWithTool({ client, modelId: MODEL_ID, deadlineMs: 30 }, image));
    const options = (bedrock.commandCalls(ConverseCommand)[0]!.args as unknown[])[1] as { abortSignal?: AbortSignal } | undefined;
    expect(options?.abortSignal?.aborted).toBe(true);
  });

  it("does not call Bedrock when no time is left", async () => {
    expect(await codeOf(converseWithTool({ client, modelId: MODEL_ID, deadlineMs: 0 }, image))).toBe("MODEL_THROTTLED");
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(0);
  });

  it("calls Bedrock in us-east-1", async () => {
    expect(await createBedrockClient().config.region()).toBe("us-east-1");
  });

  it("does not retry ModelTimeoutException", async () => {
    bedrock.on(ConverseCommand).rejects(new ModelTimeoutException({ message: "timeout", ...meta }));
    expect(await codeOf(converseWithTool({ client, modelId: MODEL_ID, ...fakeTime() }, image))).toBe("MODEL_THROTTLED");
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(1);
  });

  it("answers MODEL_THROTTLED when a call hangs past the deadline", async () => {
    bedrock.on(ConverseCommand).callsFake(() => new Promise(() => undefined));
    const started = Date.now();
    const code = await codeOf(converseWithTool({ client, modelId: MODEL_ID, deadlineMs: 50 }, image));
    expect(code).toBe("MODEL_THROTTLED");
    expect(Date.now() - started).toBeLessThan(2000);
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(1);
  });

  it("uses a 25 s deadline by default", () => {
    expect(CONVERSE_DEADLINE_MS).toBe(25_000);
  });

  it.each([
    ["AccessDeniedException", () => new AccessDeniedException({ message: "no access to model", ...meta })],
    ["ResourceNotFoundException", () => new ResourceNotFoundException({ message: "model not found", ...meta })],
    [
      "ValidationException about the model",
      () => new ValidationException({ message: "The provided model identifier is invalid.", ...meta }),
    ],
  ])("maps %s to MODEL_UNAVAILABLE without retry", async (_name, make) => {
    bedrock.on(ConverseCommand).rejects(make());
    expect(await codeOf(converseWithTool({ client, modelId: MODEL_ID, ...fakeTime() }, image))).toBe("MODEL_UNAVAILABLE");
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(1);
  });
});

describe("mapBedrockError", () => {
  it.each([
    ["The provided model identifier is invalid.", "MODEL_UNAVAILABLE"],
    ["You don't have access to the model with the specified model ID.", "MODEL_UNAVAILABLE"],
    ["Could not process image", "UNSUPPORTED_MEDIA_TYPE"],
    ["The provided image does not match the specified format", "UNSUPPORTED_MEDIA_TYPE"],
    ["Image exceeds max dimensions", "UNSUPPORTED_MEDIA_TYPE"],
    ["Unable to decode the provided bytes", "UNSUPPORTED_MEDIA_TYPE"],
    ["The model returned the following errors: Unable to process the provided image", "UNSUPPORTED_MEDIA_TYPE"],
    ["The model returned the following errors: invalid image format", "UNSUPPORTED_MEDIA_TYPE"],
    ["Malformed input request: toolConfig is invalid", "INTERNAL_ERROR"],
  ])("maps ValidationException %j to %s", (message, code) => {
    const error = new ValidationException({ message, ...meta });
    const mapped = mapBedrockError(error);
    expect(mapped.code).toBe(code);
    expect(mapped.cause).toBe(error);
  });

  it("answers 415 through converseWithTool for an image the model cannot process, without retry", async () => {
    bedrock.on(ConverseCommand).rejects(new ValidationException({ message: "Could not process image", ...meta }));
    expect(await codeOf(converseWithTool({ client, modelId: MODEL_ID, ...fakeTime() }, image))).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(bedrock.commandCalls(ConverseCommand)).toHaveLength(1);
  });


  it("keeps the cause and maps unknown failures to INTERNAL_ERROR", () => {
    const cause = new InternalServerException({ message: "boom", ...meta });
    const mapped = mapBedrockError(cause);
    expect(mapped.code).toBe("INTERNAL_ERROR");
    expect(mapped.cause).toBe(cause);
    expect(mapBedrockError(new ValidationException({ message: "bad request shape", ...meta })).code).toBe("INTERNAL_ERROR");
    expect(mapBedrockError("x").code).toBe("INTERNAL_ERROR");
  });

  it("maps an abort to MODEL_THROTTLED", () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    expect(mapBedrockError(abort).code).toBe("MODEL_THROTTLED");
  });
});
