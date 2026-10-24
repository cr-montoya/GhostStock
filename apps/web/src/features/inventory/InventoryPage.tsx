import { CATEGORIES, CATEGORY_LABELS, isLowStock, type Category, type Product } from "@ghoststock/contracts";
import { Download, ScanSearch, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { toClientError } from "@/api/client";
import { useDeleteProduct, useProducts, useSettings, useUpdateProduct } from "@/api/queries";
import { ErrorState } from "@/components/ErrorState";
import { GhostEmptyState } from "@/components/brand/GhostEmptyState";
import { PageHeader } from "@/components/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/copy/es";
import { cn } from "@/lib/utils";
import { exportCsv } from "./exportCsv";
import { filterProducts } from "./filterProducts";
import { InventoryCards, InventoryTable } from "./InventoryList";
import { ProductDrawer } from "./ProductDrawer";

export function InventoryPage() {
  const products = useProducts();
  const settings = useSettings();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<ReadonlySet<Category>>(new Set());
  const [toDelete, setToDelete] = useState<Product | undefined>();

  const list = products.data ?? [];
  const threshold = settings.data?.lowStockThreshold;
  const filtered = useMemo(() => filterProducts(list, query, categories), [list, query, categories]);
  const present = useMemo(() => CATEGORIES.filter((c) => list.some((p) => p.category === c)), [list]);
  const editingId = params.get("producto");
  const editing = list.find((p) => p.id === editingId);
  const low = (product: Product) => threshold !== undefined && isLowStock(product, threshold);

  function openEditor(product: Product) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("producto", product.id);
      return next;
    });
  }

  function closeEditor() {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("producto");
      return next;
    });
  }

  function toggleCategory(category: Category) {
    setCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function save(product: Product, changes: Parameters<typeof updateProduct.mutate>[0]["changes"]) {
    closeEditor();
    updateProduct.mutate(
      { id: product.id, changes },
      {
        onSuccess: () => toast.success(copy.inventory.updated),
        onError: (error) =>
          toast.error(copy.inventory.updateFailed, {
            description: copy.errors[toClientError(error).code],
            action: { label: copy.common.retry, onClick: () => save(product, changes) },
          }),
      },
    );
  }

  function confirmDelete(product: Product) {
    deleteProduct.mutate(product.id, {
      onSuccess: () => {
        setToDelete(undefined);
        toast.success(copy.inventory.deleted(product.name));
      },
      onError: (error) => {
        toast.error(copy.inventory.deleteFailed, { description: copy.errors[toClientError(error).code] });
      },
    });
  }

  const header = (
    <PageHeader
      eyebrow={copy.inventory.eyebrow}
      title={copy.inventory.title}
      description={copy.inventory.description}
      actions={
        list.length > 0 && (
          <Button variant="outline" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
            <Download aria-hidden="true" />
            {copy.inventory.export}
          </Button>
        )
      }
    />
  );

  if (products.isPending || settings.isPending) {
    return (
      <>
        {header}
        <div aria-busy="true" aria-label={copy.common.loading} className="glass rounded-xl p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border py-3 last:border-0">
              <Skeleton className="size-10 rounded-sm" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 md:block" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (products.isError || settings.isError) {
    return (
      <>
        {header}
        <ErrorState
          title={copy.inventory.errorTitle}
          error={products.error ?? settings.error}
          onRetry={() => {
            void products.refetch();
            void settings.refetch();
          }}
        />
      </>
    );
  }

  if (list.length === 0) {
    return (
      <>
        {header}
        <GhostEmptyState
          title={copy.dashboard.empty.title}
          body={copy.inventory.emptyBody}
          action={
            <Button asChild size="lg">
              <Link to="/invocar">
                <ScanSearch aria-hidden="true" />
                {copy.cta.invoke}
              </Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="mb-5 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.inventory.searchPlaceholder}
            aria-label={copy.inventory.searchLabel}
            className="pl-9"
          />
        </div>
        <div role="group" aria-label={copy.inventory.categoriesLabel} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <Chip pressed={categories.size === 0} onClick={() => setCategories(new Set())}>
            {copy.categories.all}
          </Chip>
          {present.map((category) => (
            <Chip key={category} pressed={categories.has(category)} onClick={() => toggleCategory(category)}>
              {CATEGORY_LABELS[category]}
            </Chip>
          ))}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {copy.inventory.count(filtered.length, list.length)}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center rounded-xl px-6 py-12 text-center">
          <p className="font-display text-lg">{copy.inventory.noMatches}</p>
          <Button
            variant="link"
            onClick={() => {
              setQuery("");
              setCategories(new Set());
            }}
          >
            <X aria-hidden="true" />
            {copy.inventory.clearFilters}
          </Button>
        </div>
      ) : (
        <>
          <InventoryTable products={filtered} isLow={low} onEdit={openEditor} onDelete={setToDelete} />
          <InventoryCards products={filtered} isLow={low} onEdit={openEditor} onDelete={setToDelete} />
        </>
      )}

      <ProductDrawer
        product={editing}
        lowStock={editing ? low(editing) : false}
        onClose={closeEditor}
        onSave={save}
        onDelete={(product) => {
          closeEditor();
          setToDelete(product);
        }}
      />

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(open) => !open && !deleteProduct.isPending && setToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.inventory.confirmDelete.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.inventory.confirmDelete.body(toDelete?.name ?? "")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProduct.isPending}>{copy.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteProduct.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (toDelete) confirmDelete(toDelete);
              }}
            >
              {deleteProduct.isPending ? copy.inventory.deleting : copy.inventory.confirmDelete.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors duration-150",
        pressed
          ? "border-violet-soft/50 bg-violet/20 text-text shadow-[0_0_20px_-8px_var(--violet-glow)]"
          : "border-border bg-surface/60 text-muted-foreground hover:border-border-strong hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
