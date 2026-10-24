import type {
  Analysis,
  ApiError,
  CreateAnalysisRequest,
  CreateProductsRequest,
  CreateProductsResponse,
  CreateUploadRequest,
  CreateUploadResponse,
  ListProductsResponse,
  Product,
  ReviewedProduct,
  Settings,
  UpdateProductRequest,
} from "../types.js";
import { ERROR_CODES, ERROR_RETRYABLE, type ErrorCode } from "../schemas/errors.js";

/** Deterministic, valid ULIDs for fixtures: `01JB5X7Q8M` + 16 digits. */
export function fixtureId(n: number): string {
  return `01JB5X7Q8M${String(n).padStart(16, "0")}`;
}

const imageKey = `tmp/${fixtureId(900)}.jpg`;
const mediaKey = `media/products/${fixtureId(901)}.jpg`;
const at = (minute: number) => `2026-10-24T15:${String(minute).padStart(2, "0")}:00.000Z`;

export const uploadRequestFixture: CreateUploadRequest = {
  contentType: "image/jpeg",
  sizeBytes: 842_113,
};

export const uploadResponseFixture: CreateUploadResponse = {
  url: "https://ghoststock-media-example.s3.us-east-1.amazonaws.com/",
  fields: {
    key: imageKey,
    "Content-Type": "image/jpeg",
    bucket: "ghoststock-media-example",
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": "EXAMPLE/20261024/us-east-1/s3/aws4_request",
    "X-Amz-Date": "20261024T150000Z",
    Policy: "eyJleGFtcGxlIjp0cnVlfQ==",
    "X-Amz-Signature": "0000000000000000000000000000000000000000000000000000000000000000",
  },
  imageKey,
  expiresAt: "2026-10-24T15:05:00.000Z",
};

export const analysisRequestFixture: CreateAnalysisRequest = { imageKey };

export const analysisFixture: Analysis = {
  analysisId: fixtureId(1),
  imageKey,
  modelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  latencyMs: 4870,
  candidates: [
    {
      candidateId: fixtureId(11),
      name: "Café molido de origen Huila 500 g",
      category: "alimentos",
      description: "Bolsa de café tostado y molido, empaque kraft con válvula.",
      brand: "Tostadora Andina",
      confidence: "high",
    },
    {
      candidateId: fixtureId(12),
      name: "Panela redonda 1 kg",
      category: "alimentos",
      description: "Bloque de panela envuelto en papel.",
      confidence: "medium",
      notes: "El peso se infiere por el tamaño; no se ve la etiqueta.",
    },
    {
      candidateId: fixtureId(13),
      name: "Jabón de barra para ropa",
      category: "aseo",
      description: "Barra azul de jabón para lavar a mano.",
      confidence: "low",
      notes: "Etiqueta parcialmente visible, podría ser jabón de cocina.",
    },
  ],
};

export const emptyAnalysisFixture: Analysis = {
  analysisId: fixtureId(2),
  imageKey,
  modelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  latencyMs: 3110,
  candidates: [],
};

export const reviewedProductsFixture: ReviewedProduct[] = [
  {
    name: "Café molido de origen Huila 500 g",
    category: "alimentos",
    description: "Bolsa de café tostado y molido, empaque kraft con válvula.",
    brand: "Tostadora Andina",
    sku: "CAF-HUI-500",
    quantity: 24,
    unitPriceCop: 18_900,
    aiConfidence: "high",
  },
  {
    name: "Panela redonda 1 kg",
    category: "alimentos",
    description: "Bloque de panela envuelto en papel.",
    quantity: 40,
    unitPriceCop: 4_200,
    aiConfidence: "medium",
    aiNotes: "El peso se infiere por el tamaño; no se ve la etiqueta.",
  },
];

export const createProductsRequestFixture: CreateProductsRequest = {
  imageKey,
  products: reviewedProductsFixture,
};

const product = (
  n: number,
  fields: Omit<Product, "id" | "createdAt" | "updatedAt" | "mediaKey"> & { mediaKey?: string | null },
): Product => ({
  id: fixtureId(100 + n),
  createdAt: at(n),
  updatedAt: at(n),
  ...fields,
  mediaKey: fields.mediaKey === undefined ? mediaKey : fields.mediaKey,
});

/** 8 products, 5 categories, 2 at or under the default threshold (5), 1 without photo. */
export const productsFixture: Product[] = [
  product(8, { name: "Café molido de origen Huila 500 g", category: "alimentos", description: "Bolsa de café tostado y molido.", brand: "Tostadora Andina", sku: "CAF-HUI-500", quantity: 24, unitPriceCop: 18_900 }),
  product(7, { name: "Panela redonda 1 kg", category: "alimentos", description: "Bloque de panela envuelto en papel.", quantity: 40, unitPriceCop: 4_200 }),
  product(6, { name: "Gaseosa de cola 1.5 L", category: "bebidas", description: "Botella plástica retornable.", sku: "BEB-COL-150", quantity: 3, unitPriceCop: 6_500 }),
  product(5, { name: "Agua sin gas 600 ml", category: "bebidas", description: "Botella de agua natural.", quantity: 60, unitPriceCop: 2_000 }),
  product(4, { name: "Jabón de barra para ropa", category: "aseo", description: "Barra azul para lavar a mano.", quantity: 18, unitPriceCop: 3_800 }),
  product(3, { name: "Cuaderno cuadriculado 100 hojas", category: "papeleria", description: "Cuaderno argollado tamaño carta.", sku: "PAP-CUA-100", quantity: 0, unitPriceCop: 7_900 }),
  product(2, { name: "Bombillo LED 9 W", category: "ferreteria", description: "Luz blanca, rosca E27.", quantity: 15, unitPriceCop: 8_500, mediaKey: null }),
  product(1, { name: "Esfero de tinta negra", category: "papeleria", description: "Punta media.", quantity: 120, unitPriceCop: 1_200 }),
];

export const createProductsResponseFixture: CreateProductsResponse = {
  products: productsFixture.slice(0, 2),
};

export const listProductsResponseFixture: ListProductsResponse = {
  products: productsFixture,
  count: productsFixture.length,
};

export const updateProductRequestFixture: UpdateProductRequest = { quantity: 30, unitPriceCop: 19_500 };

export const settingsFixture: Settings = { lowStockThreshold: 5 };

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Request body failed validation",
  UNSUPPORTED_MEDIA_TYPE: "Content type must be image/jpeg, image/png or image/webp",
  IMAGE_TOO_LARGE: "Image exceeds 3750000 bytes",
  IMAGE_NOT_FOUND: "Image not found or expired",
  NOT_FOUND: "Resource not found",
  MODEL_UNAVAILABLE: "Model access denied or model not found",
  MODEL_THROTTLED: "Model throttled after retries",
  MODEL_INVALID_OUTPUT: "Model output failed validation",
  STORAGE_ERROR: "Storage operation failed",
  INTERNAL_ERROR: "Unexpected error",
};

/** One example error envelope per code. */
export const apiErrorFixtures = Object.fromEntries(
  ERROR_CODES.map((code) => [
    code,
    {
      error: {
        code,
        message: ERROR_MESSAGES[code],
        retryable: ERROR_RETRYABLE[code],
        requestId: "Example-Request-Id=",
      },
    },
  ]),
) as Record<ErrorCode, ApiError>;
