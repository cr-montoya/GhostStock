import type { S3Client } from "@aws-sdk/client-s3";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import {
  ProductSchema,
  type CreateProductsRequest,
  type ListProductsResponse,
  type Product,
  type UpdateProductRequest,
} from "@ghoststock/contracts";
import { copyToMedia, mediaKeyFor } from "../adapters/s3.js";
import {
  PRODUCT_SK_PREFIX,
  WORKSPACE_PK,
  fromItem,
  isConditionFailure,
  productSk,
  storageError,
  toItem,
} from "../adapters/dynamo.js";
import { AppError } from "../lib/errors.js";
import { ulid } from "../lib/ids.js";
import { logger } from "../lib/observability.js";

export const MAX_LIST_ITEMS = 1000;
/** Backoff before each retry of unprocessed batch items (3 retries). */
export const UNPROCESSED_RETRY_DELAYS_MS = [100, 200, 400] as const;

export interface ProductsDeps {
  db: DynamoDBDocumentClient;
  table: string;
  s3: S3Client;
  bucket: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Copies the photo once, then writes every product with a new ULID, the shared
 * `mediaKey` and equal timestamps. Either all products are written or the request
 * fails with `STORAGE_ERROR` (after a best-effort cleanup of what was written).
 */
export async function createProducts(deps: ProductsDeps, request: CreateProductsRequest): Promise<Product[]> {
  const mediaKey = mediaKeyFor(request.imageKey, ulid());
  const timestamp = (deps.now ?? (() => new Date()))().toISOString();
  const products = request.products.map((reviewed) =>
    ProductSchema.parse({ ...reviewed, id: ulid(), mediaKey, createdAt: timestamp, updatedAt: timestamp }),
  );
  await copyToMedia(deps.s3, deps.bucket, request.imageKey, mediaKey);

  try {
    await batchWrite(deps, products.map((product) => ({ PutRequest: { Item: toItem(product) } })));
  } catch (error) {
    await batchWrite(
      deps,
      products.map((product) => ({ DeleteRequest: { Key: { PK: WORKSPACE_PK, SK: productSk(product.id) } } })),
    ).catch((cleanupError: unknown) => {
      logger.error("product cleanup failed", { productIds: products.map((p) => p.id), causeName: errorName(cleanupError) });
    });
    throw storageError(error);
  }
  return products;
}

type WriteRequest = { PutRequest: { Item: Record<string, unknown> } } | { DeleteRequest: { Key: Record<string, unknown> } };

/** One BatchWriteItem (max 10 items), retrying unprocessed items up to 3 times. */
async function batchWrite(deps: ProductsDeps, requests: WriteRequest[]): Promise<void> {
  const sleep = deps.sleep ?? defaultSleep;
  let pending = requests;
  for (let attempt = 0; pending.length > 0; attempt++) {
    if (attempt > 0) {
      const delay = UNPROCESSED_RETRY_DELAYS_MS[attempt - 1];
      if (delay === undefined) throw new AppError("STORAGE_ERROR", "Unprocessed items after retries");
      await sleep(delay);
    }
    const result = await deps.db.send(new BatchWriteCommand({ RequestItems: { [deps.table]: pending } }));
    pending = (result.UnprocessedItems?.[deps.table] ?? []) as WriteRequest[];
  }
}

/** One Query on the workspace partition, newest first, following pages up to 1 000 items. */
export async function listProducts(deps: ProductsDeps): Promise<ListProductsResponse> {
  const products: Product[] = [];
  let startKey: Record<string, unknown> | undefined;
  try {
    do {
      const page = await deps.db.send(
        new QueryCommand({
          TableName: deps.table,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
          ExpressionAttributeValues: { ":pk": WORKSPACE_PK, ":prefix": PRODUCT_SK_PREFIX },
          ScanIndexForward: false,
          Limit: MAX_LIST_ITEMS - products.length,
          ExclusiveStartKey: startKey,
        }),
      );
      for (const item of page.Items ?? []) products.push(fromItem(item));
      startKey = page.LastEvaluatedKey;
    } while (startKey && products.length < MAX_LIST_ITEMS);
  } catch (error) {
    throw storageError(error);
  }
  return { products, count: products.length };
}

export async function getProduct(deps: ProductsDeps, id: string): Promise<Product> {
  try {
    const item = (await deps.db.send(new GetCommand({ TableName: deps.table, Key: { PK: WORKSPACE_PK, SK: productSk(id) } }))).Item;
    if (!item) throw new AppError("NOT_FOUND");
    return fromItem(item);
  } catch (error) {
    throw storageError(error);
  }
}

/** Updates only the given fields plus `updatedAt`, on an existing item, and returns it whole. */
export async function updateProduct(deps: ProductsDeps, id: string, patch: UpdateProductRequest): Promise<Product> {
  const fields = Object.entries(patch).filter(([, value]) => value !== undefined);
  const names: Record<string, string> = { "#updatedAt": "updatedAt" };
  const values: Record<string, unknown> = { ":updatedAt": (deps.now ?? (() => new Date()))().toISOString() };
  const sets = ["#updatedAt = :updatedAt"];
  fields.forEach(([field, value], index) => {
    names[`#f${index}`] = field;
    values[`:v${index}`] = value;
    sets.push(`#f${index} = :v${index}`);
  });

  try {
    const result = await deps.db.send(
      new UpdateCommand({
        TableName: deps.table,
        Key: { PK: WORKSPACE_PK, SK: productSk(id) },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );
    return fromItem(result.Attributes ?? {});
  } catch (error) {
    if (isConditionFailure(error)) throw new AppError("NOT_FOUND", undefined, error);
    throw storageError(error);
  }
}

/** Deletes an existing product; the shared photo stays (other products may use it). */
export async function deleteProduct(deps: ProductsDeps, id: string): Promise<void> {
  try {
    await deps.db.send(
      new DeleteCommand({
        TableName: deps.table,
        Key: { PK: WORKSPACE_PK, SK: productSk(id) },
        ConditionExpression: "attribute_exists(PK)",
      }),
    );
  } catch (error) {
    if (isConditionFailure(error)) throw new AppError("NOT_FOUND", undefined, error);
    throw storageError(error);
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
