import { describe, expect, it } from "vitest";
import { computeInventoryStats, isLowStock } from "../src/domain/stats.js";
import { CSV_HEADER, productsToCsv } from "../src/domain/csv.js";
import { productsFixture, settingsFixture } from "../src/fixtures/index.js";
import type { Product } from "../src/types.js";

describe("[00 8.1] inventory stats", () => {
  const stats = computeInventoryStats(productsFixture, settingsFixture.lowStockThreshold);

  it("computes the totals", () => {
    expect(stats).toMatchObject({
      productCount: 8,
      unitCount: 280,
      inventoryValueCop: 1_101_000,
      categoryCount: 5,
    });
  });

  it("orders categories by value", () => {
    expect(stats.byCategory.map((c) => [c.category, c.productCount, c.unitCount, c.valueCop])).toEqual([
      ["alimentos", 2, 64, 621_600],
      ["papeleria", 2, 120, 144_000],
      ["bebidas", 2, 63, 139_500],
      ["ferreteria", 1, 15, 127_500],
      ["aseo", 1, 18, 68_400],
    ]);
    expect(stats.byCategory[0]?.label).toBe("Alimentos");
  });

  it("lists low stock lowest first, threshold inclusive", () => {
    expect(stats.lowStock.map((p) => p.quantity)).toEqual([0, 3]);
    expect(isLowStock({ quantity: 5 }, 5)).toBe(true);
    expect(isLowStock({ quantity: 6 }, 5)).toBe(false);
  });

  it("handles an empty inventory", () => {
    expect(computeInventoryStats([], 5)).toEqual({
      productCount: 0,
      unitCount: 0,
      inventoryValueCop: 0,
      categoryCount: 0,
      byCategory: [],
      lowStock: [],
    });
  });
});

describe("[00 8.2] csv export", () => {
  const csv = productsToCsv(productsFixture);
  const lines = csv.slice(1).split("\r\n");

  it("starts with a BOM and the Spanish header", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe(CSV_HEADER.join(","));
  });

  it("writes one CRLF-terminated row per product", () => {
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(lines.filter(Boolean)).toHaveLength(productsFixture.length + 1);
  });

  it("writes labels, numbers and the total value", () => {
    expect(lines[1]).toBe(
      '"Café molido de origen Huila 500 g","Alimentos","Bolsa de café tostado y molido.","Tostadora Andina","CAF-HUI-500",24,18900,453600,"2026-10-24T15:08:00.000Z"',
    );
  });

  it("quotes commas, quotes and newlines", () => {
    const tricky = { ...productsFixture[0], name: 'Caja "grande", azul\nx2' } as Product;
    const row = productsToCsv([tricky]).split("\r\n")[1];
    expect(row?.startsWith('"Caja ""grande"", azul\nx2"')).toBe(true);
  });
});

describe("[00 8.3] csv formula injection", () => {
  it.each(["=SUM(A1)", "+57300", "-1", "@cmd", "  =1+1"])("neutralizes %s", (name) => {
    const row = productsToCsv([{ ...productsFixture[0], name } as Product]).split("\r\n")[1];
    expect(row?.startsWith(`"'${name}"`)).toBe(true);
  });
});
