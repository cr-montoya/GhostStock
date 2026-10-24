import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { CopyObjectCommand, NoSuchKey, S3Client } from "@aws-sdk/client-s3";
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ApiErrorSchema,
  CreateProductsResponseSchema,
  ListProductsResponseSchema,
  MediaKeySchema,
  ProductSchema,
  SettingsSchema,
  createProductsRequestFixture,
  productsFixture,
  type Product,
} from "@ghoststock/contracts";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toItem } from "../src/adapters/dynamo.js";
import { handler } from "../src/handlers/inventory.js";
import { AppError } from "../src/lib/errors.js";
import {
  MAX_LIST_ITEMS,
  createProducts,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../src/services/products.js";
import { getSettings, updateSettings } from "../src/services/settings.js";
import { apiEvent, lambdaContext } from "./helpers.js";

const dbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);
const TABLE = "ghoststock-table-test";
const BUCKET = "ghoststock-media-test";
const NOW = new Date("2026-10-24T16:00:00.000Z");
const ID = "01JB5X7Q8M0000000000000101";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
const deps = () => ({
  db,
  table: TABLE,
  s3: new S3Client({ region: "us-east-1" }),
  bucket: BUCKET,
  now: () => NOW,
  sleep: async () => undefined,
});
const product = productsFixture[0] as Product;

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return (error as AppError).code;
  }
  throw new Error("expected an AppError");
}

const conditionFailed = () => Object.assign(new Error("The conditional request failed"), { name: "ConditionalCheckFailedException" });

beforeEach(() => {
  dbMock.reset();
  s3Mock.reset();
});

describe("createProducts [01-api 4.1, 4.2, 4.3]", () => {
  it("copies the photo once and writes every product with shared mediaKey and equal timestamps", async () => {
    s3Mock.on(CopyObjectCommand).resolves({});
    dbMock.on(BatchWriteCommand).resolves({});
    const products = await createProducts(deps(), createProductsRequestFixture);

    expect(s3Mock.commandCalls(CopyObjectCommand)).toHaveLength(1);
    const copy = s3Mock.commandCalls(CopyObjectCommand)[0]!.args[0].input;
    expect(copy.CopySource).toBe(`${BUCKET}/${createProductsRequestFixture.imageKey}`);
    expect(MediaKeySchema.safeParse(copy.Key).success).toBe(true);

    expect(products).toHaveLength(createProductsRequestFixture.products.length);
    for (const created of products) {
      ProductSchema.parse(created);
      expect(created.mediaKey).toBe(copy.Key);
      expect(created.createdAt).toBe(NOW.toISOString());
      expect(created.updatedAt).toBe(created.createdAt);
    }
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);

    const batch = dbMock.commandCalls(BatchWriteCommand);
    expect(batch).toHaveLength(1);
    const requests = batch[0]!.args[0].input.RequestItems?.[TABLE] ?? [];
    expect(requests).toHaveLength(products.length);
    expect(requests[0]?.PutRequest?.Item).toMatchObject({ PK: "WS#default", SK: `PRODUCT#${products[0]!.id}`, entity: "PRODUCT" });
  });

  it("keeps the photo extension in the media key", async () => {
    s3Mock.on(CopyObjectCommand).resolves({});
    dbMock.on(BatchWriteCommand).resolves({});
    const [created] = await createProducts(deps(), { ...createProductsRequestFixture, imageKey: "tmp/01JB5X7Q8M0000000000000900.webp" });
    expect(created?.mediaKey).toMatch(/^media\/products\/[0-9A-HJKMNP-TV-Z]{26}\.webp$/);
  });

  it("returns IMAGE_NOT_FOUND and writes nothing when the source image is gone", async () => {
    s3Mock.on(CopyObjectCommand).rejects(new NoSuchKey({ message: "missing", $metadata: { httpStatusCode: 404 } }));
    expect(await codeOf(createProducts(deps(), createProductsRequestFixture))).toBe("IMAGE_NOT_FOUND");
    expect(dbMock.calls()).toHaveLength(0);
  });

  it("returns STORAGE_ERROR when the copy fails for another reason", async () => {
    s3Mock.on(CopyObjectCommand).rejects(Object.assign(new Error("denied"), { name: "AccessDenied" }));
    expect(await codeOf(createProducts(deps(), createProductsRequestFixture))).toBe("STORAGE_ERROR");
    expect(dbMock.calls()).toHaveLength(0);
  });

  it("retries unprocessed items and succeeds", async () => {
    s3Mock.on(CopyObjectCommand).resolves({});
    dbMock
      .on(BatchWriteCommand)
      .resolvesOnce({ UnprocessedItems: { [TABLE]: [{ PutRequest: { Item: { PK: "x" } } }] } })
      .resolves({});
    const products = await createProducts(deps(), createProductsRequestFixture);
    expect(products.length).toBeGreaterThan(0);
    const calls = dbMock.commandCalls(BatchWriteCommand);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.args[0].input.RequestItems?.[TABLE]).toEqual([{ PutRequest: { Item: { PK: "x" } } }]);
  });

  it("returns STORAGE_ERROR when items stay unprocessed after 3 retries, then cleans up", async () => {
    s3Mock.on(CopyObjectCommand).resolves({});
    const leftover = { UnprocessedItems: { [TABLE]: [{ PutRequest: { Item: { PK: "x" } } }] } };
    dbMock.on(BatchWriteCommand).resolvesOnce(leftover).resolvesOnce(leftover).resolvesOnce(leftover).resolvesOnce(leftover).resolves({});
    expect(await codeOf(createProducts(deps(), createProductsRequestFixture))).toBe("STORAGE_ERROR");
    const calls = dbMock.commandCalls(BatchWriteCommand);
    expect(calls).toHaveLength(5);
    expect(calls[4]!.args[0].input.RequestItems?.[TABLE]?.every((r) => r.DeleteRequest !== undefined)).toBe(true);
  });

  it("returns STORAGE_ERROR when the batch write throws, even if cleanup also fails", async () => {
    s3Mock.on(CopyObjectCommand).resolves({});
    dbMock.on(BatchWriteCommand).rejects(new Error("ProvisionedThroughputExceeded"));
    expect(await codeOf(createProducts(deps(), createProductsRequestFixture))).toBe("STORAGE_ERROR");
  });
});

describe("listProducts [01-api 5.1]", () => {
  const item = (id: string) => toItem({ ...product, id });

  it("queries the workspace partition newest first and returns count", async () => {
    dbMock.on(QueryCommand).resolves({ Items: [item("01JB5X7Q8M0000000000000102"), item(ID)] });
    const result = await listProducts(deps());
    ListProductsResponseSchema.parse(result);
    expect(result.count).toBe(2);
    expect(result.products[0]?.id).toBe("01JB5X7Q8M0000000000000102");
    const input = dbMock.commandCalls(QueryCommand)[0]!.args[0].input;
    expect(input).toMatchObject({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": "WS#default", ":prefix": "PRODUCT#" },
      ScanIndexForward: false,
    });
    expect(result.products[0]).not.toHaveProperty("PK");
    expect(result.products[0]).not.toHaveProperty("entity");
  });

  it("follows pagination", async () => {
    dbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: [item("01JB5X7Q8M0000000000000103")], LastEvaluatedKey: { PK: "WS#default", SK: "PRODUCT#3" } })
      .resolvesOnce({ Items: [item(ID)] });
    const result = await listProducts(deps());
    expect(result.count).toBe(2);
    const calls = dbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.args[0].input.ExclusiveStartKey).toEqual({ PK: "WS#default", SK: "PRODUCT#3" });
  });

  it("stops at 1 000 items", async () => {
    const page = (n: number) => Array.from({ length: n }, () => item(ID));
    dbMock
      .on(QueryCommand)
      .resolvesOnce({ Items: page(600), LastEvaluatedKey: { PK: "WS#default", SK: "PRODUCT#a" } })
      .resolvesOnce({ Items: page(400), LastEvaluatedKey: { PK: "WS#default", SK: "PRODUCT#b" } })
      .resolves({ Items: page(10) });
    const result = await listProducts(deps());
    expect(result.count).toBe(MAX_LIST_ITEMS);
    const limits = dbMock.commandCalls(QueryCommand).map((c) => c.args[0].input.Limit);
    expect(limits).toEqual([1000, 400]);
  });

  it("returns an empty list", async () => {
    dbMock.on(QueryCommand).resolves({ Items: [] });
    expect(await listProducts(deps())).toEqual({ products: [], count: 0 });
  });

  it("maps a query failure to STORAGE_ERROR", async () => {
    dbMock.on(QueryCommand).rejects(new Error("InternalServerError"));
    expect(await codeOf(listProducts(deps()))).toBe("STORAGE_ERROR");
  });
});

describe("get, update and delete [01-api 5.2, 5.3, 5.4]", () => {
  it("gets an existing product", async () => {
    dbMock.on(GetCommand).resolves({ Item: toItem(product) });
    expect(await getProduct(deps(), product.id)).toEqual(product);
    expect(dbMock.commandCalls(GetCommand)[0]!.args[0].input.Key).toEqual({ PK: "WS#default", SK: `PRODUCT#${product.id}` });
  });

  it("returns NOT_FOUND for a missing product", async () => {
    dbMock.on(GetCommand).resolves({});
    expect(await codeOf(getProduct(deps(), ID))).toBe("NOT_FOUND");
  });

  it("updates only the given fields plus updatedAt, with placeholders and an existence condition", async () => {
    const updated = { ...product, quantity: 30, updatedAt: NOW.toISOString() };
    dbMock.on(UpdateCommand).resolves({ Attributes: toItem(updated) });
    expect(await updateProduct(deps(), product.id, { quantity: 30 })).toEqual(updated);
    const input = dbMock.commandCalls(UpdateCommand)[0]!.args[0].input;
    expect(input.ConditionExpression).toBe("attribute_exists(PK)");
    expect(input.ReturnValues).toBe("ALL_NEW");
    expect(input.UpdateExpression).toBe("SET #updatedAt = :updatedAt, #f0 = :v0");
    expect(input.ExpressionAttributeNames).toEqual({ "#updatedAt": "updatedAt", "#f0": "quantity" });
    expect(input.ExpressionAttributeValues).toEqual({ ":updatedAt": NOW.toISOString(), ":v0": 30 });
  });

  it("returns NOT_FOUND when updating a missing product", async () => {
    dbMock.on(UpdateCommand).rejects(conditionFailed());
    expect(await codeOf(updateProduct(deps(), ID, { quantity: 1 }))).toBe("NOT_FOUND");
  });

  it("deletes an existing product with an existence condition", async () => {
    dbMock.on(DeleteCommand).resolves({});
    await deleteProduct(deps(), ID);
    expect(dbMock.commandCalls(DeleteCommand)[0]!.args[0].input).toMatchObject({
      Key: { PK: "WS#default", SK: `PRODUCT#${ID}` },
      ConditionExpression: "attribute_exists(PK)",
    });
    expect(s3Mock.calls()).toHaveLength(0);
  });

  it("returns NOT_FOUND when deleting a missing product", async () => {
    dbMock.on(DeleteCommand).rejects(conditionFailed());
    expect(await codeOf(deleteProduct(deps(), ID))).toBe("NOT_FOUND");
  });

  it("maps other write failures to STORAGE_ERROR", async () => {
    dbMock.on(UpdateCommand).rejects(new Error("boom"));
    dbMock.on(DeleteCommand).rejects(new Error("boom"));
    expect(await codeOf(updateProduct(deps(), ID, { quantity: 1 }))).toBe("STORAGE_ERROR");
    expect(await codeOf(deleteProduct(deps(), ID))).toBe("STORAGE_ERROR");
  });
});

describe("settings [01-api 6.1, 6.2]", () => {
  const settingsDeps = () => ({ db, table: TABLE, lowStockDefault: 5, now: () => NOW });

  it("returns LOW_STOCK_DEFAULT when nothing is stored", async () => {
    dbMock.on(GetCommand).resolves({});
    expect(await getSettings(settingsDeps())).toEqual({ lowStockThreshold: 5 });
    expect(dbMock.commandCalls(GetCommand)[0]!.args[0].input.Key).toEqual({ PK: "WS#default", SK: "SETTINGS" });
  });

  it("returns the stored value", async () => {
    dbMock.on(GetCommand).resolves({ Item: { PK: "WS#default", SK: "SETTINGS", entity: "SETTINGS", lowStockThreshold: 12 } });
    expect(await getSettings(settingsDeps())).toEqual({ lowStockThreshold: 12 });
  });

  it("stores and returns the new settings", async () => {
    dbMock.on(PutCommand).resolves({});
    expect(await updateSettings(settingsDeps(), { lowStockThreshold: 8 })).toEqual({ lowStockThreshold: 8 });
    expect(dbMock.commandCalls(PutCommand)[0]!.args[0].input.Item).toEqual({
      PK: "WS#default",
      SK: "SETTINGS",
      entity: "SETTINGS",
      lowStockThreshold: 8,
      updatedAt: NOW.toISOString(),
    });
  });

  it("maps failures to STORAGE_ERROR", async () => {
    dbMock.on(GetCommand).rejects(new Error("boom"));
    expect(await codeOf(getSettings(settingsDeps()))).toBe("STORAGE_ERROR");
  });
});

describe("inventory router [01-api 4 to 7]", () => {
  beforeEach(() => {
    vi.stubEnv("MEDIA_BUCKET", BUCKET);
    vi.stubEnv("TABLE_NAME", TABLE);
    vi.stubEnv("LOW_STOCK_DEFAULT", "5");
    vi.stubEnv("AWS_REGION", "us-east-1");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "TESTKEYID");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  const call = (routeKey: string, init: { id?: string; body?: unknown } = {}) =>
    handler(
      apiEvent({
        routeKey,
        pathParameters: init.id === undefined ? undefined : { id: init.id },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      lambdaContext,
    );
  const errorCode = (res: Awaited<ReturnType<typeof call>>) => ApiErrorSchema.parse(JSON.parse(res.body as string)).error.code;

  it("GET /api/products returns the list", async () => {
    dbMock.on(QueryCommand).resolves({ Items: [toItem(product)] });
    const res = await call("GET /api/products");
    expect(res.statusCode).toBe(200);
    expect(ListProductsResponseSchema.parse(JSON.parse(res.body as string)).count).toBe(1);
  });

  it("POST /api/products returns 201 with the created products", async () => {
    s3Mock.on(CopyObjectCommand).resolves({});
    dbMock.on(BatchWriteCommand).resolves({});
    const res = await call("POST /api/products", { body: createProductsRequestFixture });
    expect(res.statusCode).toBe(201);
    CreateProductsResponseSchema.parse(JSON.parse(res.body as string));
  });

  it("POST /api/products rejects model-only or unknown fields before any AWS call", async () => {
    const body = { ...createProductsRequestFixture, products: [{ ...createProductsRequestFixture.products[0], id: ID }] };
    const res = await call("POST /api/products", { body });
    expect(res.statusCode).toBe(400);
    expect(s3Mock.calls()).toHaveLength(0);
    expect(dbMock.calls()).toHaveLength(0);
  });

  it("GET, PUT and DELETE /api/products/{id} round trip", async () => {
    dbMock.on(GetCommand).resolves({ Item: toItem(product) });
    dbMock.on(UpdateCommand).resolves({ Attributes: toItem({ ...product, quantity: 3 }) });
    dbMock.on(DeleteCommand).resolves({});
    expect((await call("GET /api/products/{id}", { id: product.id })).statusCode).toBe(200);
    const put = await call("PUT /api/products/{id}", { id: product.id, body: { quantity: 3 } });
    expect(put.statusCode).toBe(200);
    expect(ProductSchema.parse(JSON.parse(put.body as string)).quantity).toBe(3);
    const del = await call("DELETE /api/products/{id}", { id: product.id });
    expect(del.statusCode).toBe(204);
    expect(del.body).toBeUndefined();
  });

  it.each(["GET /api/products/{id}", "PUT /api/products/{id}", "DELETE /api/products/{id}"])(
    "%s returns 400 for an id that is not a ulid, before any AWS call",
    async (routeKey) => {
      const res = await call(routeKey, { id: "../settings", body: { quantity: 1 } });
      expect(res.statusCode).toBe(400);
      expect(dbMock.calls()).toHaveLength(0);
    },
  );

  it("PUT /api/products/{id} returns 400 for an empty update", async () => {
    expect(errorCode(await call("PUT /api/products/{id}", { id: ID, body: {} }))).toBe("VALIDATION_ERROR");
  });

  it("returns 404 NOT_FOUND for missing products", async () => {
    dbMock.on(GetCommand).resolves({});
    dbMock.on(DeleteCommand).rejects(conditionFailed());
    const get = await call("GET /api/products/{id}", { id: ID });
    expect(get.statusCode).toBe(404);
    expect(errorCode(get)).toBe("NOT_FOUND");
    expect((await call("DELETE /api/products/{id}", { id: ID })).statusCode).toBe(404);
  });

  it("GET and PUT /api/settings", async () => {
    dbMock.on(GetCommand).resolves({});
    dbMock.on(PutCommand).resolves({});
    const get = await call("GET /api/settings");
    expect(SettingsSchema.parse(JSON.parse(get.body as string))).toEqual({ lowStockThreshold: 5 });
    const put = await call("PUT /api/settings", { body: { lowStockThreshold: 9 } });
    expect(put.statusCode).toBe(200);
    expect(JSON.parse(put.body as string)).toEqual({ lowStockThreshold: 9 });
    expect((await call("PUT /api/settings", { body: { lowStockThreshold: -1 } })).statusCode).toBe(400);
  });

  it.each(["$default", "GET /api/unknown", "PATCH /api/products/{id}"])("returns 404 NOT_FOUND for route %s", async (routeKey) => {
    const res = await call(routeKey);
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe("NOT_FOUND");
    expect(dbMock.calls()).toHaveLength(0);
  });

  it("returns 500 STORAGE_ERROR in the envelope when DynamoDB fails", async () => {
    dbMock.on(QueryCommand).rejects(new Error("arn:aws:dynamodb:us-east-1:123456789012:table/x"));
    const res = await call("GET /api/products");
    expect(res.statusCode).toBe(500);
    expect(errorCode(res)).toBe("STORAGE_ERROR");
    expect(res.body).not.toContain("123456789012");
  });
});
