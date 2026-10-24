import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import {
  CreateProductsRequestSchema,
  Ulid,
  UpdateProductRequestSchema,
  UpdateSettingsRequestSchema,
} from "@ghoststock/contracts";
import { createDocumentClient } from "../adapters/dynamo.js";
import { InventoryEnvSchema, envLoader } from "../lib/env.js";
import { AppError } from "../lib/errors.js";
import { json, noContent, parseJson, validate, withErrors, type HttpResult } from "../lib/http.js";
import {
  createProducts,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
  type ProductsDeps,
} from "../services/products.js";
import { getSettings, updateSettings, type SettingsDeps } from "../services/settings.js";

const env = envLoader(InventoryEnvSchema);
const db = createDocumentClient();
const s3 = new S3Client({});

const productsDeps = (): ProductsDeps => ({ db, table: env().TABLE_NAME, s3, bucket: env().MEDIA_BUCKET });
const settingsDeps = (): SettingsDeps => ({ db, table: env().TABLE_NAME, lowStockDefault: env().LOW_STOCK_DEFAULT });
const productId = (event: APIGatewayProxyEventV2) => validate(Ulid, event.pathParameters?.id);

/** /api/products, /api/products/{id} and /api/settings, dispatched on the route key. */
export const handler = withErrors(async (event): Promise<HttpResult> => {
  switch (event.routeKey) {
    case "GET /api/products":
      return json(200, await listProducts(productsDeps()));
    case "POST /api/products": {
      const request = parseJson(event, CreateProductsRequestSchema);
      return json(201, { products: await createProducts(productsDeps(), request) });
    }
    case "GET /api/products/{id}": {
      const id = productId(event);
      return json(200, await getProduct(productsDeps(), id));
    }
    case "PUT /api/products/{id}": {
      const id = productId(event);
      const patch = parseJson(event, UpdateProductRequestSchema);
      return json(200, await updateProduct(productsDeps(), id, patch));
    }
    case "DELETE /api/products/{id}": {
      const id = productId(event);
      await deleteProduct(productsDeps(), id);
      return noContent();
    }
    case "GET /api/settings":
      return json(200, await getSettings(settingsDeps()));
    case "PUT /api/settings": {
      const request = parseJson(event, UpdateSettingsRequestSchema);
      return json(200, await updateSettings(settingsDeps(), request));
    }
    default:
      // `$default` and any route this function does not own.
      throw new AppError("NOT_FOUND");
  }
});
