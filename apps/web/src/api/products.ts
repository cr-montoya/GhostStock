import {
  CreateProductsResponseSchema,
  ListProductsResponseSchema,
  ProductResponseSchema,
  type CreateProductsRequest,
  type Product,
  type UpdateProductRequest,
} from "@ghoststock/contracts";
import { apiFetch } from "./client";

export async function listProducts(): Promise<Product[]> {
  const response = await apiFetch("/api/products", {}, ListProductsResponseSchema);
  return response.products;
}

export async function createProducts(request: CreateProductsRequest): Promise<Product[]> {
  const response = await apiFetch("/api/products", { method: "POST", body: request }, CreateProductsResponseSchema);
  return response.products;
}

export function updateProduct(id: string, request: UpdateProductRequest): Promise<Product> {
  return apiFetch(`/api/products/${encodeURIComponent(id)}`, { method: "PUT", body: request }, ProductResponseSchema);
}

export function deleteProduct(id: string): Promise<undefined> {
  return apiFetch(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}
