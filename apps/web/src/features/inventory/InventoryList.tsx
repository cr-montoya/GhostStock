import { CATEGORY_LABELS, type Product } from "@ghoststock/contracts";
import { Pencil, Trash2 } from "lucide-react";
import { ProductPhoto } from "@/components/ProductPhoto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy/es";
import { formatCop, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ListProps {
  products: Product[];
  isLow: (product: Product) => boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

function LowBadge() {
  return <Badge variant="ember">{copy.common.lowStock}</Badge>;
}

/** Desktop: a table with a sticky header (768 px and up). */
export function InventoryTable({ products, isLow, onEdit, onDelete }: ListProps) {
  const cols = copy.inventory.columns;
  return (
    <div className="glass hidden overflow-hidden rounded-xl md:block">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{copy.inventory.title}</caption>
        <thead className="sticky top-0 z-10 bg-surface-raised/95 backdrop-blur">
          <tr className="text-left text-xs uppercase tracking-[0.12em] text-text/70">
            <th scope="col" className="px-4 py-3 font-medium">{cols.product}</th>
            <th scope="col" className="px-4 py-3 font-medium">{cols.category}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{cols.quantity}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{cols.unitPrice}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">{cols.total}</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              <span className="sr-only">{cols.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const low = isLow(product);
            return (
              <tr key={product.id} className="group border-t border-border transition-colors duration-150 hover:bg-surface-raised/70">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <div className="flex items-center gap-3">
                    <ProductPhoto src={product.mediaKey} alt="" className="size-10 shrink-0 rounded-sm" />
                    <div className="min-w-0">
                      <p className="max-w-[22rem] truncate font-medium text-text">{product.name}</p>
                      <p className="max-w-[22rem] truncate text-sm text-muted-foreground">
                        {[product.brand, product.sku].filter(Boolean).join(" · ") || product.description}
                      </p>
                    </div>
                  </div>
                </th>
                <td className="px-4 py-3 text-muted-foreground">{CATEGORY_LABELS[product.category]}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {low && <LowBadge />}
                    <span className={cn("font-mono tabular", low && "text-ember")}>{formatNumber(product.quantity)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular">{formatCop(product.unitPriceCop)}</td>
                <td className="px-4 py-3 text-right font-mono tabular text-violet-soft">
                  {formatCop(product.quantity * product.unitPriceCop)}
                </td>
                <td className="px-2 py-3 text-right">
                  <div className="flex justify-end gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" aria-label={copy.inventory.editProduct(product.name)} onClick={() => onEdit(product)}>
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:text-blood"
                      aria-label={copy.inventory.deleteProduct(product.name)}
                      onClick={() => onDelete(product)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Phones: one card per product, photo on top. */
export function InventoryCards({ products, isLow, onEdit, onDelete }: ListProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:hidden">
      {products.map((product) => {
        const low = isLow(product);
        return (
          <li key={product.id}>
            <article aria-label={product.name} className="glass overflow-hidden rounded-xl">
              <div className="relative">
                <ProductPhoto src={product.mediaKey} alt={product.name} className="aspect-[16/10] w-full rounded-none border-0 border-b" />
                {low && (
                  <div className="absolute left-3 top-3">
                    <LowBadge />
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-text/70">{CATEGORY_LABELS[product.category]}</p>
                <h3 className="mt-1 font-sans text-base font-medium leading-snug">{product.name}</h3>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{copy.inventory.columns.quantity}</dt>
                    <dd className={cn("font-mono tabular", low && "text-ember")}>{formatNumber(product.quantity)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{copy.inventory.columns.unitPrice}</dt>
                    <dd className="font-mono tabular">{formatCop(product.unitPriceCop)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{copy.inventory.columns.total}</dt>
                    <dd className="font-mono tabular text-violet-soft">{formatCop(product.quantity * product.unitPriceCop)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => onEdit(product)} aria-label={copy.inventory.editProduct(product.name)}>
                    <Pencil aria-hidden="true" />
                    {copy.inventory.edit}
                  </Button>
                  <Button variant="ghost" size="icon" className="hover:text-blood" aria-label={copy.inventory.deleteProduct(product.name)} onClick={() => onDelete(product)}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
