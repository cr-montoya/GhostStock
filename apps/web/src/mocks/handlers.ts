import {
  CreateProductsRequestSchema,
  SettingsSchema,
  UpdateProductRequestSchema,
  analysisFixture,
  apiErrorFixtures,
  emptyAnalysisFixture,
  productsFixture,
  settingsFixture,
  uploadResponseFixture,
  type ErrorCode,
  type Product,
  type Settings,
} from "@ghoststock/contracts";
import { delay, http, HttpResponse } from "msw";
import { currentScenario } from "./scenarios";

/** In-memory store so edits, deletes and saves persist while the page lives. */
const db: { products: Product[] | null; settings: Settings } = { products: null, settings: { ...settingsFixture } };

function products(): Product[] {
  db.products ??= currentScenario() === "empty" ? [] : structuredClone(productsFixture);
  return db.products;
}

function apiError(code: ErrorCode, status: number) {
  return HttpResponse.json(apiErrorFixtures[code], { status });
}

let idCounter = 200;
function nextUlid(): string {
  idCounter += 1;
  return `01JB5X7Q8M${String(idCounter).padStart(16, "0")}`;
}

const ANALYSIS_LATENCY_MS = 2500;

export const handlers = [
  http.post("/api/uploads", async () => {
    if (currentScenario() === "network-error") return HttpResponse.error();
    await delay(300);
    return HttpResponse.json(uploadResponseFixture, { status: 201 });
  }),

  // The presigned POST goes straight to S3; any amazonaws.com POST succeeds with 204.
  http.post(/^https:\/\/[^/]+\.amazonaws\.com\/?.*$/, async () => {
    await delay(400);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/analyses", async () => {
    const scenario = currentScenario();
    await delay(ANALYSIS_LATENCY_MS);
    switch (scenario) {
      case "zero-candidates":
        return HttpResponse.json(emptyAnalysisFixture);
      case "model-error":
        return apiError("MODEL_INVALID_OUTPUT", 502);
      case "throttled":
        // HTTP API stage throttling answers with a bare body, not our envelope.
        return HttpResponse.json({ message: "Too Many Requests" }, { status: 429 });
      default:
        return HttpResponse.json(analysisFixture);
    }
  }),

  http.get("/api/products", async () => {
    await delay(500);
    if (currentScenario() === "products-error") return apiError("INTERNAL_ERROR", 500);
    return HttpResponse.json({ products: products(), count: products().length });
  }),

  http.post("/api/products", async ({ request }) => {
    const parsed = CreateProductsRequestSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION_ERROR", 400);
    await delay(600);
    if (currentScenario() === "save-error") return apiError("STORAGE_ERROR", 500);
    const now = new Date().toISOString();
    const mediaKey = `media/products/${nextUlid()}.jpg`;
    const created: Product[] = parsed.data.products.map((item) => ({
      ...item,
      id: nextUlid(),
      mediaKey,
      createdAt: now,
      updatedAt: now,
    }));
    db.products = [...created.slice().reverse(), ...products()];
    return HttpResponse.json({ products: created }, { status: 201 });
  }),

  http.put("/api/products/:id", async ({ params, request }) => {
    const parsed = UpdateProductRequestSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION_ERROR", 400);
    await delay(400);
    if (currentScenario() === "mutation-error") return apiError("STORAGE_ERROR", 500);
    const list = products();
    const index = list.findIndex((p) => p.id === params.id);
    if (index < 0) return apiError("NOT_FOUND", 404);
    const updated: Product = { ...(list[index] as Product), ...parsed.data, updatedAt: new Date().toISOString() };
    list[index] = updated;
    return HttpResponse.json(updated);
  }),

  http.delete("/api/products/:id", async ({ params }) => {
    await delay(300);
    if (currentScenario() === "mutation-error") return apiError("STORAGE_ERROR", 500);
    const list = products();
    const index = list.findIndex((p) => p.id === params.id);
    if (index < 0) return apiError("NOT_FOUND", 404);
    list.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/api/settings", async () => {
    await delay(200);
    return HttpResponse.json(db.settings);
  }),

  http.put("/api/settings", async ({ request }) => {
    const parsed = SettingsSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION_ERROR", 400);
    await delay(300);
    if (currentScenario() === "mutation-error") return apiError("STORAGE_ERROR", 500);
    db.settings = parsed.data;
    return HttpResponse.json(db.settings);
  }),
];
