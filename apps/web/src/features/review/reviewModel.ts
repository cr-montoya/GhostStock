import {
  ReviewedProductSchema,
  type Category,
  type ProductCandidate,
  type ReviewedProduct,
} from "@ghoststock/contracts";

/** Editable draft of one candidate. Numbers stay as typed text until validation. */
export interface CandidateDraft {
  candidateId: string;
  name: string;
  category: Category;
  description: string;
  brand: string;
  sku: string;
  quantity: string;
  unitPriceCop: string;
  confidence: ProductCandidate["confidence"];
  notes: string | undefined;
  selected: boolean;
  discarded: boolean;
}

export type DraftField = "name" | "category" | "description" | "brand" | "sku" | "quantity" | "unitPriceCop";
export type FieldErrors = Partial<Record<DraftField, FieldError>>;
export type FieldError = "required" | "invalid" | "tooLong" | "skuFormat" | "range";

/** Quantity, price and SKU are never prefilled: they are what only the user knows. */
export function draftFromCandidate(candidate: ProductCandidate): CandidateDraft {
  return {
    candidateId: candidate.candidateId,
    name: candidate.name,
    category: candidate.category,
    description: candidate.description,
    brand: candidate.brand ?? "",
    sku: "",
    quantity: "",
    unitPriceCop: "",
    confidence: candidate.confidence,
    notes: candidate.notes,
    selected: true,
    discarded: false,
  };
}

/** Digits with optional es-CO thousands dots or spaces ("18.900"); a decimal comma is rejected. */
export function parseInteger(text: string): number | undefined {
  const trimmed = text.trim();
  // Plain digits, or thousands groups of exactly three ("18.900", "1 250 000").
  if (!/^\d+$/.test(trimmed) && !/^\d{1,3}(?:[.\s]\d{3})+$/.test(trimmed)) return undefined;
  return Number(trimmed.replace(/[.\s]/g, ""));
}

const blankToUndefined = (value: string) => (value.trim() === "" ? undefined : value.trim());

export function toReviewedProduct(draft: CandidateDraft):
  | { ok: true; product: ReviewedProduct }
  | { ok: false; errors: FieldErrors } {
  const quantity = parseInteger(draft.quantity);
  const unitPriceCop = parseInteger(draft.unitPriceCop);
  const parsed = ReviewedProductSchema.safeParse({
    name: draft.name,
    category: draft.category,
    description: draft.description,
    brand: blankToUndefined(draft.brand),
    sku: blankToUndefined(draft.sku),
    quantity,
    unitPriceCop,
    aiConfidence: draft.confidence,
    aiNotes: draft.notes,
  });
  if (parsed.success) return { ok: true, product: parsed.data };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as DraftField;
    if (errors[field]) continue;
    const raw = field in draft ? String(draft[field as keyof CandidateDraft] ?? "") : "";
    if (raw.trim() === "") errors[field] = "required";
    else if (field === "sku") errors[field] = "skuFormat";
    else if (issue.code === "too_big" && (field === "quantity" || field === "unitPriceCop")) errors[field] = "range";
    else if (issue.code === "too_big") errors[field] = "tooLong";
    else if (field === "quantity" || field === "unitPriceCop") errors[field] = "invalid";
    else errors[field] = "required";
  }
  return { ok: false, errors };
}

export function selectedDrafts(drafts: readonly CandidateDraft[]) {
  return drafts.filter((d) => d.selected && !d.discarded);
}

/** Save is allowed only when something is selected and every selected draft is valid. */
export function canSave(drafts: readonly CandidateDraft[]): boolean {
  const selected = selectedDrafts(drafts);
  return selected.length > 0 && selected.every((d) => toReviewedProduct(d).ok);
}
