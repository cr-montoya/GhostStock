import type { Analysis, ReviewedProduct } from "@ghoststock/contracts";
import { copy } from "@/copy/es";

interface ReviewStepProps {
  analysis: Analysis;
  photoUrl: string;
  saving: boolean;
  saveError: unknown;
  onSave: (products: ReviewedProduct[]) => void;
  onRestart: () => void;
}

/** Minimal candidate list; the full review and save step arrives with task 7. */
export function ReviewStep({ analysis }: ReviewStepProps) {
  return (
    <section aria-labelledby="review-title">
      <h2 id="review-title" className="text-2xl font-medium md:text-3xl">
        {copy.review.title}
      </h2>
      <ul className="mt-6 flex flex-col gap-2">
        {analysis.candidates.map((candidate) => (
          <li key={candidate.candidateId} className="glass rounded-lg p-4">
            {candidate.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
