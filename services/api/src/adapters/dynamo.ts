import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ProductSchema, type Product } from "@ghoststock/contracts";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

// Single table, one workspace (ADR 0005).
export const WORKSPACE_PK = "WS#default";
export const PRODUCT_SK_PREFIX = "PRODUCT#";
export const SETTINGS_SK = "SETTINGS";

export const productSk = (id: string) => `${PRODUCT_SK_PREFIX}${id}`;

export function createDocumentClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export function toItem(product: Product): Record<string, unknown> {
  return { PK: WORKSPACE_PK, SK: productSk(product.id), entity: "PRODUCT", ...product };
}

/** Strips the table keys and validates the rest, so a malformed item never reaches a client. */
export function fromItem(item: Record<string, unknown>): Product {
  const { PK: _pk, SK: _sk, entity: _entity, ...product } = item;
  return ProductSchema.parse(product);
}

export function isConditionFailure(error: unknown): boolean {
  return error instanceof Error && error.name === "ConditionalCheckFailedException";
}

/**
 * Any DynamoDB failure the caller did not expect is `STORAGE_ERROR` (retryable). A
 * stored item that fails its schema is `INTERNAL_ERROR`: retrying cannot fix bad data.
 */
export function storageError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return new AppError("INTERNAL_ERROR", undefined, error);
  return new AppError("STORAGE_ERROR", undefined, error);
}
