import { CATEGORY_LABELS, type Product } from "@ghoststock/contracts";
import { Link } from "react-router";
import { ProductPhoto } from "@/components/ProductPhoto";
import { copy } from "@/copy/es";

export function LowStockList({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{copy.dashboard.lowStockEmpty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {products.map((product) => (
        <li key={product.id}>
          <Link
            to={`/inventario?producto=${product.id}`}
            className="flex min-h-14 items-center gap-3 rounded-md border border-border border-l-2 border-l-ember bg-bg/40 py-2 pl-3 pr-4 transition-colors hover:bg-surface-raised"
          >
            <ProductPhoto src={product.mediaKey} alt="" className="size-10 shrink-0 rounded-sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{product.name}</span>
              <span className="block text-xs text-muted-foreground">{CATEGORY_LABELS[product.category]}</span>
            </span>
            <span className="shrink-0 font-mono text-sm tabular text-ember">
              {copy.dashboard.remaining(product.quantity)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
