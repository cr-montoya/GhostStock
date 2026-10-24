import type { Confidence } from "@ghoststock/contracts";
import { Badge } from "@/components/ui/badge";
import { copy } from "@/copy/es";

const VARIANT = { high: "ectoplasm", medium: "violet", low: "ember" } as const;

export function ConfidenceChip({ confidence }: { confidence: Confidence }) {
  return (
    <Badge variant={VARIANT[confidence]}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
      {copy.confidence[confidence]}
    </Badge>
  );
}
