import { CATEGORIES, CATEGORY_LABELS, type Category } from "@ghoststock/contracts";
import { motion, useReducedMotion } from "motion/react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { copy } from "@/copy/es";
import { cn } from "@/lib/utils";
import { ConfidenceChip } from "./ConfidenceChip";
import { riseItem, riseItemReduced } from "./motion";
import type { CandidateDraft, FieldErrors } from "./reviewModel";

interface CandidateCardProps {
  draft: CandidateDraft;
  index: number;
  total: number;
  photoUrl: string;
  errors: FieldErrors | undefined;
  disabled: boolean;
  onChange: (patch: Partial<CandidateDraft>) => void;
}

export function CandidateCard({ draft, index, total, photoUrl, errors, disabled, onChange }: CandidateCardProps) {
  const reduce = useReducedMotion();
  const headingId = `candidate-${draft.candidateId}`;
  const label = copy.review.cardLabel(index + 1, total);
  const err = (field: keyof FieldErrors) => (errors?.[field] ? copy.review.fieldErrors[errors[field]] : undefined);

  if (draft.discarded) {
    return (
      <motion.article
        key="discarded"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0.15 : 0.25 }}
        aria-labelledby={headingId}
        className="flex items-center gap-4 rounded-lg border border-dashed border-border-strong bg-surface/40 p-4"
      >
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="font-sans text-xs uppercase tracking-[0.14em] text-text/70">
            {label}
          </h3>
          <p className="truncate text-sm text-muted-foreground line-through">{draft.name}</p>
        </div>
        <Button variant="outline" size="sm" className="h-11" onClick={() => onChange({ discarded: false, selected: true })}>
          <RotateCcw aria-hidden="true" />
          {copy.review.restore}
        </Button>
      </motion.article>
    );
  }

  return (
    <motion.article
      key="active"
      variants={reduce ? riseItemReduced : riseItem}
      aria-labelledby={headingId}
      className={cn(
        "glass relative overflow-hidden rounded-xl transition-[border-color,opacity] duration-150",
        draft.selected ? "border-violet-soft/25" : "opacity-70",
      )}
    >
      <div className="grid gap-0 md:grid-cols-[260px_1fr]">
        <div className="relative border-b border-border bg-bg md:border-b-0 md:border-r md:p-3">
          <img
            src={photoUrl}
            alt={copy.review.photoAlt(draft.name)}
            className="h-44 w-full object-contain md:sticky md:top-6 md:h-auto md:rounded-lg md:border md:border-border"
          />
          <span className="absolute left-3 top-3 rounded-full md:left-5 md:top-5 border border-border-strong bg-bg/80 px-2.5 py-1 font-mono text-xs tabular text-muted-foreground backdrop-blur">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id={headingId} className="font-sans text-xs uppercase tracking-[0.14em] text-text/70">
              {label}
            </h3>
            <ConfidenceChip confidence={draft.confidence} />
          </div>

          {draft.notes && (
            <p className="rounded-md border border-border bg-bg/40 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-text/80">{copy.review.notes}: </span>
              {draft.notes}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={copy.review.fields.name} error={err("name")} className="sm:col-span-2">
              {(props) => (
                <Input {...props} value={draft.name} disabled={disabled} maxLength={120} onChange={(e) => onChange({ name: e.target.value })} />
              )}
            </Field>
            <Field label={copy.review.fields.category} error={err("category")}>
              {(props) => (
                <Select value={draft.category} disabled={disabled} onValueChange={(value) => onChange({ category: value as Category })}>
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
            <Field label={copy.review.fields.brand} error={err("brand")}>
              {(props) => (
                <Input {...props} value={draft.brand} disabled={disabled} maxLength={80} placeholder={copy.review.optional} onChange={(e) => onChange({ brand: e.target.value })} />
              )}
            </Field>
            <Field label={copy.review.fields.description} error={err("description")} className="sm:col-span-2">
              {(props) => (
                <Textarea {...props} rows={2} value={draft.description} disabled={disabled} maxLength={500} onChange={(e) => onChange({ description: e.target.value })} />
              )}
            </Field>
          </div>

          <div className="rounded-lg border border-violet-soft/20 bg-violet/5 p-3 md:p-4">
            <p className="mb-3 text-xs text-violet-soft">{copy.review.onlyYouKnow}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label={copy.review.fields.quantity} error={err("quantity")}>
                {(props) => (
                  <Input {...props} inputMode="numeric" autoComplete="off" value={draft.quantity} disabled={disabled} className="font-mono tabular" onChange={(e) => onChange({ quantity: e.target.value })} />
                )}
              </Field>
              <Field label={copy.review.fields.unitPrice} error={err("unitPriceCop")}>
                {(props) => (
                  <Input {...props} inputMode="numeric" autoComplete="off" value={draft.unitPriceCop} disabled={disabled} className="font-mono tabular" onChange={(e) => onChange({ unitPriceCop: e.target.value })} />
                )}
              </Field>
              <Field label={copy.review.fields.sku} error={err("sku")} className="col-span-2 sm:col-span-1">
                {(props) => (
                  <Input {...props} autoComplete="off" value={draft.sku} disabled={disabled} placeholder={copy.review.optional} className="font-mono" onChange={(e) => onChange({ sku: e.target.value })} />
                )}
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={draft.selected} disabled={disabled} onCheckedChange={(checked) => onChange({ selected: checked === true })} />
              {copy.review.select}
            </label>
            <Button variant="ghost" size="sm" className="h-11 text-muted-foreground hover:text-blood" disabled={disabled} onClick={() => onChange({ discarded: true, selected: false })}>
              <Trash2 aria-hidden="true" />
              {copy.review.discard}
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
