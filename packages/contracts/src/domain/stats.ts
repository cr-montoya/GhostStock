import { CATEGORY_LABELS, type Category } from "../schemas/common.js";
import type { Product } from "../types.js";

export interface CategoryStats {
  category: Category;
  label: string;
  productCount: number;
  unitCount: number;
  valueCop: number;
}

export interface InventoryStats {
  productCount: number;
  unitCount: number;
  inventoryValueCop: number;
  categoryCount: number;
  /** Sorted by value, highest first. */
  byCategory: CategoryStats[];
  /** Products at or under the threshold, lowest quantity first. */
  lowStock: Product[];
}

type StockLike = Pick<Product, "quantity">;

export function isLowStock(product: StockLike, threshold: number): boolean {
  return product.quantity <= threshold;
}

/** COP has no decimals, so all math stays in integers. */
export function computeInventoryStats(products: readonly Product[], threshold: number): InventoryStats {
  const categories = new Map<Category, CategoryStats>();
  let unitCount = 0;
  let inventoryValueCop = 0;

  for (const product of products) {
    const value = product.quantity * product.unitPriceCop;
    unitCount += product.quantity;
    inventoryValueCop += value;

    const entry = categories.get(product.category) ?? {
      category: product.category,
      label: CATEGORY_LABELS[product.category],
      productCount: 0,
      unitCount: 0,
      valueCop: 0,
    };
    entry.productCount += 1;
    entry.unitCount += product.quantity;
    entry.valueCop += value;
    categories.set(product.category, entry);
  }

  const byCategory = [...categories.values()].sort(
    (a, b) => b.valueCop - a.valueCop || a.label.localeCompare(b.label, "es"),
  );
  const lowStock = products
    .filter((product) => isLowStock(product, threshold))
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name, "es"));

  return {
    productCount: products.length,
    unitCount,
    inventoryValueCop,
    categoryCount: categories.size,
    byCategory,
    lowStock,
  };
}
