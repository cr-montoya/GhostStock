import {
  AccessDeniedException,
  BedrockRuntimeClient,
  ConverseCommand,
  ThrottlingException,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { GetObjectCommand, HeadObjectCommand, NotFound, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { AnalysisSchema, ApiErrorSchema, MAX_UPLOAD_BYTES, Ulid } from "@ghoststock/contracts";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../src/handlers/analyses.js";
import { AppError } from "../src/lib/errors.js";
import { logger, metrics } from "../src/lib/observability.js";
import { analyzeImage, readToolOutput } from "../src/services/analyses.js";
import { apiEvent, lambdaContext } from "./helpers.js";

const s3Mock = mockClient(S3Client);
const bedrockMock = mockClient(BedrockRuntimeClient);
const BUCKET = "ghoststock-media-test";
const MODEL_ID = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const IMAGE_KEY = "tmp/01JB5X7Q8M0000000000000900.jpg";
const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

const deps = () => ({
  s3: new S3Client({ region: "us-east-1" }),
  bucket: BUCKET,
  bedrock: new BedrockRuntimeClient({ region: "us-east-1" }),
  modelId: MODEL_ID,
  converse: { sleep: async () => undefined },
});

const product = {
  name: "Café molido 500 g",
  category: "alimentos",
  description: "Bolsa de café tostado.",
  brand: "Tostadora Andina",
  confidence: "high",
};

function converseOutput(input: unknown, overrides: Partial<ConverseCommandOutput> = {}): ConverseCommandOutput {
  return {
    $metadata: {},
    stopReason: "tool_use",
    output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "t1", name: "report_products", input: input as never } }] } },
    usage: undefined,
    metrics: undefined,
    ...overrides,
  };
}

function storedImage(contentType = "image/jpeg", length = BYTES.byteLength, bytes = BYTES) {
  s3Mock.on(HeadObjectCommand).resolves({ ContentLength: length, ContentType: contentType });
  s3Mock.on(GetObjectCommand).resolves({ Body: { transformToByteArray: async () => bytes } as never });
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

beforeEach(() => {
  s3Mock.reset();
  bedrockMock.reset();
});

describe("analyzeImage [01-api 2.1, 2.4, 3.1]", () => {
  it("returns validated candidates with server ulids, model id and latency", async () => {
    storedImage();
    bedrockMock.on(ConverseCommand).resolves(converseOutput({ products: [product, { ...product, name: "Panela 1 kg", brand: undefined }] }));
    const { analysis } = await analyzeImage(deps(), IMAGE_KEY);

    AnalysisSchema.parse(analysis);
    expect(analysis.imageKey).toBe(IMAGE_KEY);
    expect(analysis.modelId).toBe(MODEL_ID);
    expect(Number.isInteger(analysis.latencyMs)).toBe(true);
    expect(analysis.candidates).toHaveLength(2);
    expect(analysis.candidates[0]).toMatchObject(product);
    const ids = [analysis.analysisId, ...analysis.candidates.map((c) => c.candidateId)];
    for (const id of ids) expect(Ulid.safeParse(id).success).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("reads metadata, then bytes, then calls Converse once with those bytes", async () => {
    storedImage("image/webp");
    bedrockMock.on(ConverseCommand).resolves(converseOutput({ products: [] }));
    await analyzeImage(deps(), "tmp/01JB5X7Q8M0000000000000900.webp");
    expect(s3Mock.commandCalls(HeadObjectCommand)[0]!.args[0].input).toEqual({ Bucket: BUCKET, Key: "tmp/01JB5X7Q8M0000000000000900.webp" });
    expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(1);
    const calls = bedrockMock.commandCalls(ConverseCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args[0].input.messages?.[0]?.content?.[0]).toEqual({ image: { format: "webp", source: { bytes: BYTES } } });
  });

  it("returns 200-shaped empty analysis when the model reports zero products", async () => {
    storedImage();
    bedrockMock.on(ConverseCommand).resolves(converseOutput({ products: [] }));
    const { analysis } = await analyzeImage(deps(), IMAGE_KEY);
    expect(analysis.candidates).toEqual([]);
  });

  it("measures latency across the Bedrock call", async () => {
    storedImage();
    bedrockMock.on(ConverseCommand).resolves(converseOutput({ products: [] }));
    let t = 1000;
    const clock = () => (t += 2500);
    const { analysis } = await analyzeImage({ ...deps(), clock }, IMAGE_KEY);
    expect(analysis.latencyMs).toBe(2500);
  });
});

describe("analyzeImage stored object checks [01-api 2.2, 2.3]", () => {
  it("maps a missing object to IMAGE_NOT_FOUND without calling Bedrock", async () => {
    s3Mock.on(HeadObjectCommand).rejects(new NotFound({ message: "Not Found", $metadata: { httpStatusCode: 404 } }));
    expect(await codeOf(analyzeImage(deps(), IMAGE_KEY))).toBe("IMAGE_NOT_FOUND");
    expect(bedrockMock.commandCalls(ConverseCommand)).toHaveLength(0);
  });

  it("maps an object that disappears before GetObject to IMAGE_NOT_FOUND", async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 10, ContentType: "image/jpeg" });
    s3Mock.on(GetObjectCommand).rejects(Object.assign(new Error("gone"), { name: "NoSuchKey" }));
    expect(await codeOf(analyzeImage(deps(), IMAGE_KEY))).toBe("IMAGE_NOT_FOUND");
  });

  it("maps any other S3 failure to STORAGE_ERROR", async () => {
    s3Mock.on(HeadObjectCommand).rejects(
      new S3ServiceException({ name: "Forbidden", $fault: "client", message: "Forbidden", $metadata: { httpStatusCode: 403 } }),
    );
    expect(await codeOf(analyzeImage(deps(), IMAGE_KEY))).toBe("STORAGE_ERROR");
  });

  it("rejects an object over 3 750 000 bytes without reading it or calling Bedrock", async () => {
    storedImage("image/jpeg", MAX_UPLOAD_BYTES + 1);
    expect(await codeOf(analyzeImage(deps(), IMAGE_KEY))).toBe("IMAGE_TOO_LARGE");
    expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(0);
    expect(bedrockMock.commandCalls(ConverseCommand)).toHaveLength(0);
  });

  it.each([["image/gif"], ["text/html"], [undefined]])("rejects stored content type %s without calling Bedrock", async (type) => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 10, ContentType: type });
    expect(await codeOf(analyzeImage(deps(), IMAGE_KEY))).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(bedrockMock.commandCalls(ConverseCommand)).toHaveLength(0);
  });

  it("rejects bytes over the limit even when the metadata understated them", async () => {
    storedImage("image/jpeg", 10, new Uint8Array(MAX_UPLOAD_BYTES + 1));
    expect(await codeOf(analyzeImage(deps(), IMAGE_KEY))).toBe("IMAGE_TOO_LARGE");
    expect(bedrockMock.commandCalls(ConverseCommand)).toHaveLength(0);
  });
});

describe("readToolOutput honest outcomes [01-api 3.2]", () => {
  it.each([
    ["stop reason end_turn", converseOutput({ products: [] }, { stopReason: "end_turn" })],
    ["stop reason max_tokens", converseOutput({ products: [] }, { stopReason: "max_tokens" })],
    ["no tool call", converseOutput(undefined, { output: { message: { role: "assistant", content: [{ text: "Veo café" }] } } })],
    [
      "wrong tool name",
      converseOutput(undefined, {
        output: { message: { role: "assistant", content: [{ toolUse: { toolUseId: "t", name: "other", input: { products: [] } } }] } },
      }),
    ],
    ["missing products", converseOutput({})],
    ["price field", converseOutput({ products: [{ ...product, unitPriceCop: 12000 }] })],
    ["quantity field", converseOutput({ products: [{ ...product, quantity: 3 }] })],
    ["bad category", converseOutput({ products: [{ ...product, category: "armas" }] })],
    ["eleven products", converseOutput({ products: Array.from({ length: 11 }, () => product) })],
    ["one valid and one invalid", converseOutput({ products: [product, { ...product, name: "" }] })],
    ["no output", converseOutput(undefined, { output: undefined })],
  ])("rejects %s as MODEL_INVALID_OUTPUT", (_name, output) => {
    try {
      readToolOutput(output);
      throw new Error("expected MODEL_INVALID_OUTPUT");
    } catch (error) {
      expect((error as AppError).code).toBe("MODEL_INVALID_OUTPUT");
    }
  });

  it("returns no partial candidates when one product is invalid", async () => {
    storedImage();
    bedrockMock.on(ConverseCommand).resolves(converseOutput({ products: [product, { ...product, confidence: "certain" }] }));
    expect(await codeOf(analyzeImage(deps(), IMAGE_KEY))).toBe("MODEL_INVALID_OUTPUT");
  });

  it("finds the tool call after a text block", () => {
    const output = converseOutput(undefined, {
      output: {
        message: {
          role: "assistant",
          content: [{ text: "Listo." }, { toolUse: { toolUseId: "t", name: "report_products", input: { products: [product] } } }],
        },
      },
    });
    expect(readToolOutput(output).products).toHaveLength(1);
  });
});

describe("POST /api/analyses handler [01-api 2.1, 3.1 to 3.4, 7.1, 8.2, 8.3]", () => {
  beforeEach(() => {
    vi.stubEnv("MEDIA_BUCKET", BUCKET);
    vi.stubEnv("BEDROCK_MODEL_ID", MODEL_ID);
    vi.stubEnv("AWS_REGION", "us-east-1");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "TESTKEYID");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const post = (body: unknown) =>
    handler(apiEvent({ routeKey: "POST /api/analyses", body: JSON.stringify(body) }), lambdaContext);
  const errorOf = (res: Awaited<ReturnType<typeof post>>) => ApiErrorSchema.parse(JSON.parse(res.body as string)).error;

  it("returns 200 with an Analysis and emits latency and count metrics", async () => {
    const addMetric = vi.spyOn(metrics, "addMetric");
    const info = vi.spyOn(logger, "info");
    storedImage();
    bedrockMock.on(ConverseCommand).resolves(converseOutput({ products: [product] }));
    const res = await post({ imageKey: IMAGE_KEY });
    expect(res.statusCode).toBe(200);
    const analysis = AnalysisSchema.parse(JSON.parse(res.body as string));
    expect(addMetric).toHaveBeenCalledWith("AnalysisLatencyMs", "Milliseconds", analysis.latencyMs);
    expect(addMetric).toHaveBeenCalledWith("CandidateCount", "Count", 1);
    const summary = info.mock.calls.find(([message]) => message === "analysis completed");
    expect(summary?.[1]).toMatchObject({ imageKey: IMAGE_KEY, modelId: MODEL_ID, candidateCount: 1, attempts: 1 });
  });

  it("returns 200 with candidates [] for zero products", async () => {
    storedImage();
    bedrockMock.on(ConverseCommand).resolves(converseOutput({ products: [] }));
    const res = await post({ imageKey: IMAGE_KEY });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string).candidates).toEqual([]);
  });

  it.each([
    ["foreign prefix", { imageKey: "media/products/01JB5X7Q8M0000000000000900.jpg" }],
    ["traversal", { imageKey: "tmp/../media/01JB5X7Q8M0000000000000900.jpg" }],
    ["bad extension", { imageKey: "tmp/01JB5X7Q8M0000000000000900.gif" }],
    ["extra key", { imageKey: IMAGE_KEY, modelId: "x" }],
  ])("returns 400 for %s before any AWS call", async (_name, body) => {
    const res = await post(body);
    expect(res.statusCode).toBe(400);
    expect(errorOf(res).code).toBe("VALIDATION_ERROR");
    expect(s3Mock.calls()).toHaveLength(0);
    expect(bedrockMock.calls()).toHaveLength(0);
  });

  it("returns 404 IMAGE_NOT_FOUND for a missing image", async () => {
    s3Mock.on(HeadObjectCommand).rejects(new NotFound({ message: "Not Found", $metadata: {} }));
    const res = await post({ imageKey: IMAGE_KEY });
    expect(res.statusCode).toBe(404);
    expect(errorOf(res).code).toBe("IMAGE_NOT_FOUND");
  });

  it("returns 502 MODEL_INVALID_OUTPUT and counts the failure by code", async () => {
    const addDimension = vi.spyOn(Metrics.prototype, "addDimension");
    const addMetric = vi.spyOn(Metrics.prototype, "addMetric");
    storedImage();
    bedrockMock.on(ConverseCommand).resolves(converseOutput({ products: [{ ...product, sku: "ABC-1" }] }));
    const res = await post({ imageKey: IMAGE_KEY });
    expect(res.statusCode).toBe(502);
    expect(errorOf(res)).toMatchObject({ code: "MODEL_INVALID_OUTPUT", retryable: true });
    expect(res.body).not.toContain("candidates");
    expect(addDimension).toHaveBeenCalledWith("errorCode", "MODEL_INVALID_OUTPUT");
    expect(addMetric).toHaveBeenCalledWith("AnalysisFailed", "Count", 1);
  });

  it("returns 503 MODEL_THROTTLED retryable after retries", async () => {
    storedImage();
    bedrockMock.on(ConverseCommand).rejects(new ThrottlingException({ message: "slow", $metadata: {} }));
    const res = await post({ imageKey: IMAGE_KEY });
    expect(res.statusCode).toBe(503);
    expect(errorOf(res)).toMatchObject({ code: "MODEL_THROTTLED", retryable: true });
    expect(bedrockMock.commandCalls(ConverseCommand)).toHaveLength(3);
  }, 10_000);

  it("returns 503 MODEL_UNAVAILABLE not retryable and logs the model id", async () => {
    const warn = vi.spyOn(logger, "warn");
    storedImage();
    bedrockMock.on(ConverseCommand).rejects(new AccessDeniedException({ message: "denied", $metadata: {} }));
    const res = await post({ imageKey: IMAGE_KEY });
    expect(res.statusCode).toBe(503);
    expect(errorOf(res)).toMatchObject({ code: "MODEL_UNAVAILABLE", retryable: false });
    expect(warn).toHaveBeenCalledWith("analysis failed", { imageKey: IMAGE_KEY, modelId: MODEL_ID, errorCode: "MODEL_UNAVAILABLE" });
  });

  it("never logs image bytes or model text", async () => {
    const spies = (["info", "warn", "error", "debug"] as const).map((level) => vi.spyOn(logger, level));
    storedImage();
    bedrockMock.on(ConverseCommand).resolves(converseOutput({ products: [{ ...product, notes: "SECRET-MODEL-TEXT", price: 1 }] }));
    await post({ imageKey: IMAGE_KEY });
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain("SECRET-MODEL-TEXT");
    expect(logged).not.toContain(Buffer.from(BYTES).toString("base64"));
    expect(logged).not.toMatch(/255,216/);
  });
});
