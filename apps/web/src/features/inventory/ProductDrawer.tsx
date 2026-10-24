import {
  CATEGORIES,
  CATEGORY_LABELS,
  UpdateProductRequestSchema,
  type Category,
  type Product,
  type UpdateProductRequest,
} from "@ghoststock/contracts";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field } from "@/components/Field";
import { ProductPhoto } from "@/components/ProductPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy/es";
import { parseInteger } from "@/features/review/reviewModel";
import { formatCop } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMediaQuery";

type FormState = {
  name: string;
  category: Category;
  description: string;
  brand: string;
  sku: string;
  quantity: string;
  unitPriceCop: string;
};

type FormField = keyof FormState;

function toForm(product: Product): FormState {
  return {
    name: product.name,
    category: product.category,
    description: product.description,
    brand: product.brand ?? "",
    sku: product.sku ?? "",
    quantity: String(product.quantity),
    unitPriceCop: String(product.unitPriceCop),
  };
}

/** Only changed fields go in the PUT; brand and SKU cannot be cleared through the contract. */
export function diffForm(product: Product, form: FormState):
  | { ok: true; changes: UpdateProductRequest | null }
  | { ok: false; errors: Partial<Record<FormField, string>> } {
  const errors: Partial<Record<FormField, string>> = {};
  const quantity = parseInteger(form.quantity);
  const unitPriceCop = parseInteger(form.unitPriceCop);
  if (form.name.trim() === "") errors.name = copy.review.fieldErrors.required;
  if (quantity === undefined) errors.quantity = copy.review.fieldErrors[form.quantity.trim() ? "invalid" : "required"];
  if (unitPriceCop === undefined) errors.unitPriceCop = copy.review.fieldErrors[form.unitPriceCop.trim() ? "invalid" : "required"];

  const candidate: Record<string, unknown> = {};
  if (form.name.trim() !== product.name) candidate.name = form.name.trim();
  if (form.category !== product.category) candidate.category = form.category;
  if (form.description.trim() !== product.description) candidate.description = form.description.trim();
  if (form.brand.trim() && form.brand.trim() !== product.brand) candidate.brand = form.brand.trim();
  if (form.sku.trim() && form.sku.trim() !== product.sku) candidate.sku = form.sku.trim();
  if (quantity !== undefined && quantity !== product.quantity) candidate.quantity = quantity;
  if (unitPriceCop !== undefined && unitPriceCop !== product.unitPriceCop) candidate.unitPriceCop = unitPriceCop;

  if (Object.keys(errors).length === 0 && Object.keys(candidate).length === 0) return { ok: true, changes: null };

  const parsed = UpdateProductRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as FormField | undefined;
      if (!field || errors[field]) continue;
      errors[field] =
        field === "sku"
          ? copy.review.fieldErrors.skuFormat
          : issue.code === "too_big"
            ? copy.review.fieldErrors[field === "quantity" || field === "unitPriceCop" ? "range" : "tooLong"]
            : copy.review.fieldErrors.invalid;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, changes: parsed.success ? parsed.data : null };
}

interface ProductDrawerProps {
  product: Product | undefined;
  lowStock: boolean;
  onClose: () => void;
  onSave: (product: Product, changes: UpdateProductRequest) => void;
  onDelete: (product: Product) => void;
}

export function ProductDrawer({ product, lowStock, onClose, onSave, onDelete }: ProductDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return (
    <Sheet open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={isDesktop ? "right" : "bottom"} className="overflow-y-auto">
        {product && (
          <ProductForm
            key={product.id}
            product={product}
            lowStock={lowStock}
            onCancel={onClose}
            onSave={(changes) => onSave(product, changes)}
            onDelete={() => onDelete(product)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProductForm({
  product,
  lowStock,
  onCancel,
  onSave,
  onDelete,
}: {
  product: Product;
  lowStock: boolean;
  onCancel: () => void;
  onSave: (changes: UpdateProductRequest) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(product));
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = diffForm(product, form);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    if (result.changes) onSave(result.changes);
    else onCancel();
  }

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col" noValidate>
      <SheetHeader>
        <SheetTitle>{copy.inventory.drawer.title}</SheetTitle>
        <SheetDescription>{copy.inventory.drawer.description}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-5">
        <div className="flex items-center gap-4 rounded-lg border border-border bg-bg/40 p-3">
          <ProductPhoto src={product.mediaKey} alt={product.name} className="size-16 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-medium">{product.name}</p>
            <p className="font-mono text-sm tabular text-muted-foreground">
              {formatCop(product.quantity * product.unitPriceCop)}
            </p>
            {lowStock && <p className="text-xs text-ember">{copy.common.lowStock}</p>}
          </div>
        </div>
        <Field label={copy.review.fields.name} error={errors.name}>
          {(props) => <Input {...props} value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} />}
        </Field>
        <Field label={copy.review.fields.category}>
          {(props) => (
            <Select value={form.category} onValueChange={(value) => set({ category: value as Category })}>
              <SelectTrigger {...props}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label={copy.review.fields.description} error={errors.description}>
          {(props) => (
            <Textarea {...props} rows={3} value={form.description} maxLength={500} onChange={(e) => set({ description: e.target.value })} />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.review.fields.quantity} error={errors.quantity}>
            {(props) => (
              <Input {...props} inputMode="numeric" className="font-mono tabular" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
            )}
          </Field>
          <Field label={copy.review.fields.unitPrice} error={errors.unitPriceCop}>
            {(props) => (
              <Input {...props} inputMode="numeric" className="font-mono tabular" value={form.unitPriceCop} onChange={(e) => set({ unitPriceCop: e.target.value })} />
            )}
          </Field>
          <Field label={copy.review.fields.brand} error={errors.brand}>
            {(props) => <Input {...props} value={form.brand} maxLength={80} onChange={(e) => set({ brand: e.target.value })} />}
          </Field>
          <Field label={copy.review.fields.sku} error={errors.sku}>
            {(props) => <Input {...props} className="font-mono" value={form.sku} onChange={(e) => set({ sku: e.target.value })} />}
          </Field>
        </div>
      </div>
      <SheetFooter className="sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" className="text-blood hover:bg-blood/10" onClick={onDelete}>
          <Trash2 aria-hidden="true" />
          {copy.inventory.delete}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onCancel}>
            {copy.common.cancel}
          </Button>
          <Button type="submit">{copy.inventory.drawer.save}</Button>
        </div>
      </SheetFooter>
    </form>
  );
}
