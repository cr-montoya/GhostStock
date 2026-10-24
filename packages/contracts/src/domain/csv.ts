import { CATEGORY_LABELS } from "../schemas/common.js";
import type { Product } from "../types.js";

export const CSV_HEADER = [
  "nombre",
  "categoria",
  "descripcion",
  "marca",
  "sku",
  "cantidad",
  "precio_unitario_cop",
  "valor_total_cop",
  "creado_en",
] as const;

const BOM = "﻿";
const EOL = "\r\n";

/** Quotes a text cell (RFC 4180) and neutralizes spreadsheet formula injection. */
function textCell(value: string | undefined): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** UTF-8 CSV with BOM and CRLF, ready for Excel in Spanish. */
export function productsToCsv(products: readonly Product[]): string {
  const rows = products.map((product) =>
    [
      textCell(product.name),
      textCell(CATEGORY_LABELS[product.category]),
      textCell(product.description),
      textCell(product.brand),
      textCell(product.sku),
      String(product.quantity),
      String(product.unitPriceCop),
      String(product.quantity * product.unitPriceCop),
      textCell(product.createdAt),
    ].join(","),
  );
  return BOM + [CSV_HEADER.join(","), ...rows].join(EOL) + EOL;
}
