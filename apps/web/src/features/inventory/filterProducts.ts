import type { Category, Product } from "@ghoststock/contracts";

/** Lowercase and strip accents so "cafe" finds "Café". */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Client-side filter by name, description, brand and SKU, and by category (spec 02, 8.2). */
export function filterProducts(products: readonly Product[], query: string, categories: ReadonlySet<Category>): Product[] {
  const needle = normalize(query);
  return products.filter((product) => {
    if (categories.size > 0 && !categories.has(product.category)) return false;
    if (!needle) return true;
    return [product.name, product.description, product.brand ?? "", product.sku ?? ""].some((field) =>
      normalize(field).includes(needle),
    );
  });
}
