import { productsToCsv, type Product } from "@ghoststock/contracts";
import { downloadText, isoDate } from "@/lib/format";

export function csvFileName(date = new Date()): string {
  return `ghoststock-inventario-${isoDate(date)}.csv`;
}

/** Downloads the currently filtered list as CSV (spec 02, 8.5). */
export function exportCsv(products: readonly Product[]) {
  downloadText(csvFileName(), productsToCsv(products));
}
