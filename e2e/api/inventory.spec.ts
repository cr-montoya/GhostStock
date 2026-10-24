import {
  CreateProductsResponseSchema,
  ListProductsResponseSchema,
  ProductSchema,
  SettingsSchema,
  type Settings,
} from "@ghoststock/contracts";
import { expect } from "@playwright/test";
import { expectApiError, setupApiSpec, test, uploadFixture, type Api } from "./helpers.js";

setupApiSpec();

const UNKNOWN_ID = "01JB5X7Q8M0000000000000999";
// DynamoDB reads are eventually consistent, so reads right after a write are polled.
const CONSISTENCY = { timeout: 5_000 } as const;

const listProducts = async (api: Api) => ListProductsResponseSchema.parse(await (await api.get("/api/products")).json());

test.describe("products round trip", () => {
  const created: string[] = [];

  // Products are deleted here; their saved photo under media/products/ is kept by design
  // (other products may share it) and is not removable through the API.
  test.afterAll(async ({ request }) => {
    for (const id of created) await request.delete(`/api/products/${id}`);
  });

  test("[01-api 4.1, 5.1 to 5.4] create, list, get, update and delete", async ({ api, request }) => {
    const imageKey = await uploadFixture(api, request, "stationery.jpg");
    const name = `Cuaderno e2e ${Date.now()}`;
    const createResponse = await api.post("/api/products", {
      data: {
        imageKey,
        products: [
          { name, category: "papeleria", description: "Prueba e2e", quantity: 3, unitPriceCop: 4500, aiConfidence: "high" },
          { name: `${name} b`, category: "papeleria", quantity: 1, unitPriceCop: 1200 },
        ],
      },
    });
    expect(createResponse.status()).toBe(201);
    const raw = (await createResponse.json()) as { products?: { id?: string }[] };
    // Record ids before parsing so a schema failure cannot leak products.
    created.push(...(raw.products ?? []).flatMap((p) => (p.id ? [p.id] : [])));
    const { products } = CreateProductsResponseSchema.parse(raw);
    expect(products).toHaveLength(2);
    expect(products[0]!.mediaKey).toMatch(/^media\/products\/[0-9A-HJKMNP-TV-Z]{26}\.jpg$/);
    expect(products[1]!.mediaKey).toBe(products[0]!.mediaKey);
    expect(products[0]!.createdAt).toBe(products[0]!.updatedAt);
    const id = products[0]!.id;

    await expect(async () => {
      const list = await listProducts(api);
      expect(list.count).toBe(list.products.length);
      expect(list.products.map((p) => p.id)).toEqual(expect.arrayContaining(created));
      const ids = list.products.map((p) => p.id);
      expect(ids).toEqual([...ids].sort().reverse());
    }).toPass(CONSISTENCY);

    await expect(async () => {
      const get = await api.get(`/api/products/${id}`);
      expect(get.status()).toBe(200);
      expect(ProductSchema.parse(await get.json()).name).toBe(name);
    }).toPass(CONSISTENCY);

    const put = await api.put(`/api/products/${id}`, { data: { quantity: 7 } });
    expect(put.status()).toBe(200);
    const updated = ProductSchema.parse(await put.json());
    expect(updated.quantity).toBe(7);
    expect(updated.name).toBe(name);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(updated.createdAt));

    for (const productId of [...created]) {
      const del = await api.delete(`/api/products/${productId}`);
      expect(del.status()).toBe(204);
      created.splice(created.indexOf(productId), 1);
    }
    await expect(async () => {
      await expectApiError(await api.get(`/api/products/${id}`), 404, "NOT_FOUND");
    }).toPass(CONSISTENCY);
  });
});

test("[01-api 4.2] creating from a key that was never uploaded answers 404 and writes nothing", async ({ api }) => {
  const name = `No existe e2e ${Date.now()}`;
  const response = await api.post("/api/products", {
    data: {
      imageKey: "tmp/01JB5X7Q8M0000000000000999.jpg",
      products: [{ name, category: "otros", quantity: 1, unitPriceCop: 1 }],
    },
  });
  await expectApiError(response, 404, "IMAGE_NOT_FOUND");
  expect((await listProducts(api)).products.some((p) => p.name === name)).toBe(false);
});

test("[01-api 5.2 to 5.4] missing products answer 404 NOT_FOUND", async ({ api }) => {
  await expectApiError(await api.get(`/api/products/${UNKNOWN_ID}`), 404, "NOT_FOUND");
  await expectApiError(await api.put(`/api/products/${UNKNOWN_ID}`, { data: { quantity: 1 } }), 404, "NOT_FOUND");
  await expectApiError(await api.delete(`/api/products/${UNKNOWN_ID}`), 404, "NOT_FOUND");
});

test("[01-api 7.1] validation errors answer 400 VALIDATION_ERROR", async ({ api }) => {
  await expectApiError(await api.get("/api/products/not-a-ulid"), 400, "VALIDATION_ERROR");
  await expectApiError(await api.put(`/api/products/${UNKNOWN_ID}`, { data: {} }), 400, "VALIDATION_ERROR");
  await expectApiError(await api.put(`/api/products/${UNKNOWN_ID}`, { data: { mediaKey: "x" } }), 400, "VALIDATION_ERROR");
  await expectApiError(
    await api.post("/api/products", { data: { imageKey: "tmp/x.jpg", products: [] } }),
    400,
    "VALIDATION_ERROR",
  );
  await expectApiError(await api.put("/api/settings", { data: { lowStockThreshold: -1 } }), 400, "VALIDATION_ERROR");
});

test("[01-api 7.3] unknown api paths answer 404 NOT_FOUND in the envelope", async ({ api }) => {
  await expectApiError(await api.get("/api/no-existe"), 404, "NOT_FOUND");
});

test.describe("settings round trip", () => {
  let original: Settings | undefined;

  // Restores the previous value; on a stack that never stored settings this writes the
  // default once (6.1's default cannot be observed on a shared stack).
  test.afterAll(async ({ request }) => {
    if (original) await request.put("/api/settings", { data: original });
  });

  test("[01-api 6.1, 6.2] reads and stores the low stock threshold", async ({ api }) => {
    const get = await api.get("/api/settings");
    expect(get.status()).toBe(200);
    original = SettingsSchema.parse(await get.json());
    const next = { lowStockThreshold: original.lowStockThreshold === 7 ? 8 : 7 };
    const put = await api.put("/api/settings", { data: next });
    expect(put.status()).toBe(200);
    expect(SettingsSchema.parse(await put.json())).toEqual(next);
    await expect(async () => {
      expect(SettingsSchema.parse(await (await api.get("/api/settings")).json())).toEqual(next);
    }).toPass(CONSISTENCY);
  });
});
