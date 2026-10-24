import { analysisFixture } from "@ghoststock/contracts";
import { describe, expect, it } from "vitest";
import { canSave, draftFromCandidate, parseInteger, toReviewedProduct, type CandidateDraft } from "./reviewModel";

const drafts = () => analysisFixture.candidates.map(draftFromCandidate);
const complete = (d: CandidateDraft): CandidateDraft => ({ ...d, quantity: "12", unitPriceCop: "18.900" });

describe("review model", () => {
  it("[02 5.5] never prefills quantity, price or SKU", () => {
    for (const draft of drafts()) {
      expect(draft).toMatchObject({ quantity: "", unitPriceCop: "", sku: "", selected: true, discarded: false });
    }
  });

  it("parses integers with es-CO thousands separators", () => {
    expect(parseInteger("18.900")).toBe(18_900);
    expect(parseInteger("1 200")).toBe(1_200);
    expect(parseInteger("12,5")).toBeUndefined();
    expect(parseInteger("18.90")).toBeUndefined();
    expect(parseInteger("1.2.3")).toBeUndefined();
    expect(parseInteger("1 250 000")).toBe(1_250_000);
    expect(parseInteger("-3")).toBeUndefined();
    expect(parseInteger("abc")).toBeUndefined();
    expect(parseInteger("")).toBeUndefined();
  });

  it("[02 5.4] blocks save until every selected draft has name, category, quantity and price", () => {
    const list = drafts();
    expect(canSave(list)).toBe(false);
    const [first, ...rest] = list as [CandidateDraft, ...CandidateDraft[]];
    expect(canSave([complete(first), ...rest])).toBe(false);
    expect(canSave([complete(first), ...rest.map((d) => ({ ...d, selected: false }))])).toBe(true);
    expect(canSave(list.map((d) => ({ ...d, selected: false })))).toBe(false);
  });

  it("[02 5.3] ignores discarded drafts", () => {
    const [first, ...rest] = drafts() as [CandidateDraft, ...CandidateDraft[]];
    expect(canSave([complete(first), ...rest.map((d) => ({ ...d, discarded: true, selected: false }))])).toBe(true);
  });

  it("[02 5.4] reports field errors for invalid drafts", () => {
    const [first] = drafts() as [CandidateDraft];
    const result = toReviewedProduct({ ...first, name: " ", quantity: "", unitPriceCop: "abc", sku: "con espacio" });
    expect(result).toEqual({
      ok: false,
      errors: { name: "required", quantity: "required", unitPriceCop: "invalid", sku: "skuFormat" },
    });
  });

  it("builds a contract ReviewedProduct with the AI confidence and notes", () => {
    const second = drafts()[1] as CandidateDraft;
    const result = toReviewedProduct({ ...complete(second), sku: "PAN-1KG" });
    expect(result).toEqual({
      ok: true,
      product: {
        name: "Panela redonda 1 kg",
        category: "alimentos",
        description: "Bloque de panela envuelto en papel.",
        sku: "PAN-1KG",
        quantity: 12,
        unitPriceCop: 18_900,
        aiConfidence: "medium",
        aiNotes: "El peso se infiere por el tamaño; no se ve la etiqueta.",
      },
    });
  });
});
