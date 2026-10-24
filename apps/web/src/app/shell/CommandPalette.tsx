import { CATEGORY_LABELS } from "@ghoststock/contracts";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useProducts } from "@/api/queries";
import { ProductPhoto } from "@/components/ProductPhoto";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { copy } from "@/copy/es";
import { NAV_ITEMS } from "./nav";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Global Ctrl+K / Cmd+K palette: jump to screens or find a product. */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { data: products } = useProducts();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  function go(path: string) {
    onOpenChange(false);
    void navigate(path);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.command.title}
      description={copy.command.description}
    >
      <CommandInput placeholder={copy.command.placeholder} aria-label={copy.command.placeholder} />
      <CommandList>
        <CommandEmpty>{copy.command.empty}</CommandEmpty>
        <CommandGroup heading={copy.command.screens}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <CommandItem key={to} value={`pantalla ${label}`} onSelect={() => go(to)}>
              <Icon className="text-violet-soft" aria-hidden="true" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        {products && products.length > 0 && (
          <CommandGroup heading={copy.command.products}>
            {products.map((product) => (
              <CommandItem
                key={product.id}
                value={product.id}
                keywords={[
                  product.name,
                  product.brand ?? "",
                  product.sku ?? "",
                  CATEGORY_LABELS[product.category],
                ]}
                onSelect={() => go(`/inventario?producto=${product.id}`)}
              >
                <ProductPhoto src={product.mediaKey} alt="" className="size-8 shrink-0 rounded-sm" />
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[product.category]}
                  {product.sku && <span className="ml-2 font-mono">{product.sku}</span>}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
