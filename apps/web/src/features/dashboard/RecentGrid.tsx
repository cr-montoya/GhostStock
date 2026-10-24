import type { Product } from "@ghoststock/contracts";
import { Link } from "react-router";
import { ProductPhoto } from "@/components/ProductPhoto";
import { formatCop } from "@/lib/format";

/** The latest resurrections, newest first, with their photos. */
export function RecentGrid({ products }: { products: Product[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {products.map((product) => (
        <li key={product.id}>
          <Link
            to={`/inventario?producto=${product.id}`}
            className="group block rounded-lg border border-border bg-bg/40 p-2 transition-[border-color,box-shadow] duration-150 hover:border-violet-soft/40 hover:shadow-[0_0_32px_-12px_var(--violet-glow)]"
          >
            <ProductPhoto src={product.mediaKey} alt={product.name} className="aspect-square w-full rounded-md" />
            <p className="mt-2 truncate px-1 text-sm font-medium">{product.name}</p>
            <p className="px-1 pb-1 font-mono text-xs tabular text-muted-foreground">{formatCop(product.unitPriceCop)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
