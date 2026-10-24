import type { Analysis } from "@ghoststock/contracts";
import { motion, useReducedMotion } from "motion/react";
import { ImagePlus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toClientError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy/es";
import { CandidateCard } from "./CandidateCard";
import { riseList, riseListReduced } from "./motion";
import {
  canSave,
  draftFromCandidate,
  selectedDrafts,
  toReviewedProduct,
  type CandidateDraft,
} from "./reviewModel";
import type { ReviewedProduct } from "@ghoststock/contracts";

interface ReviewStepProps {
  analysis: Analysis;
  photoUrl: string;
  saving: boolean;
  saveError: unknown;
  onSave: (products: ReviewedProduct[]) => void;
  onRestart: () => void;
}

export function ReviewStep({ analysis, photoUrl, saving, saveError, onSave, onRestart }: ReviewStepProps) {
  const reduce = useReducedMotion();
  const [drafts, setDrafts] = useState<CandidateDraft[]>(() => analysis.candidates.map(draftFromCandidate));
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const selected = selectedDrafts(drafts);
  const ready = canSave(drafts);
  const pending = selected.filter((d) => !toReviewedProduct(d).ok).length;

  function update(candidateId: string, patch: Partial<CandidateDraft>) {
    setDrafts((list) => list.map((d) => (d.candidateId === candidateId ? { ...d, ...patch } : d)));
    setTouched((set) => new Set(set).add(candidateId));
  }

  function revealPending() {
    setShowAll(true);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("[data-review-list] [aria-invalid='true']")?.focus();
    });
  }

  function save() {
    const products = selected.map((d) => toReviewedProduct(d)).flatMap((r) => (r.ok ? [r.product] : []));
    if (products.length === selected.length && products.length > 0) onSave(products);
  }

  return (
    <section aria-labelledby="review-title">
      <div className="mb-6 flex flex-col gap-5 md:mb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-ectoplasm">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {copy.review.eyebrow(analysis.candidates.length)}
          </p>
          <h2 id="review-title" className="text-2xl font-medium md:text-3xl">
            {copy.review.title}
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">{copy.review.description}</p>
        </div>
        <Button variant="outline" onClick={onRestart} disabled={saving}>
          <ImagePlus aria-hidden="true" />
          {copy.common.otherPhoto}
        </Button>
      </div>

      <motion.div
        data-review-list
        className="flex flex-col gap-4"
        variants={reduce ? riseListReduced : riseList}
        initial="hidden"
        animate="shown"
      >
        {drafts.map((draft, index) => {
          const result = toReviewedProduct(draft);
          const visible = draft.selected && (showAll || touched.has(draft.candidateId));
          return (
            <CandidateCard
              key={draft.candidateId}
              draft={draft}
              index={index}
              total={drafts.length}
              photoUrl={photoUrl}
              errors={visible && !result.ok ? result.errors : undefined}
              disabled={saving}
              onChange={(patch) => update(draft.candidateId, patch)}
            />
          );
        })}
      </motion.div>

      <div className="sticky bottom-20 z-20 mt-6 md:bottom-6">
        <div className="glass flex flex-col gap-3 rounded-xl border-border-strong p-3 shadow-[0_24px_48px_-12px_var(--ink)] sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="text-sm" aria-live="polite">
            <p className="font-medium">{copy.review.selectedCount(selected.length, drafts.length)}</p>
            {saveError ? (
              <p role="alert" className="text-blood">
                {copy.review.saveFailed} {copy.errors[toClientError(saveError).code]}
              </p>
            ) : pending > 0 ? (
              <p className="text-ember">
                {copy.review.pending(pending)}{" "}
                <button type="button" className="min-h-6 underline underline-offset-4 hover:text-text" onClick={revealPending}>
                  {copy.review.showPending}
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">{selected.length > 0 ? copy.review.readyHint : copy.review.noneSelected}</p>
            )}
          </div>
          <Button size="lg" disabled={!ready || saving} onClick={save} className="sm:min-w-56">
            {saving ? copy.common.saving : saveError ? copy.review.retrySave : copy.review.save}
          </Button>
        </div>
      </div>
    </section>
  );
}
