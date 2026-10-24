import { CATEGORY_LABELS } from "@ghoststock/contracts";
import { useEffect, useRef } from "react";
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
  // The palette has no Radix trigger, so remember who had focus and give it back on close.
  const returnFocus = useRef<HTMLElement | null>(null);

  // Track focus while closed; the dialog moves focus into itself as soon as it opens.
  useEffect(() => {
    if (open) return;
    function onFocusIn(event: FocusEvent) {
      returnFocus.current = event.target instanceof HTMLElement ? event.target : null;
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // AltGr arrives as Ctrl+Alt on Windows; autofill keydowns may carry no key.
      if (event.key?.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey) {
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
      onCloseAutoFocus={(event) => {
        const target = returnFocus.current;
        if (target?.isConnected) {
          event.preventDefault();
          target.focus();
        }
      }}
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
                <span className="hidden shrink-0 text-xs text-text/70 md:inline">
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
