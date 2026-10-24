import { RotateCcw, TriangleAlert } from "lucide-react";
import { toClientError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy/es";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title: string;
  error: unknown;
  onRetry: () => void;
  className?: string;
}

/** Inline error with the Spanish message for its code and a retry action. */
export function ErrorState({ title, error, onRetry, className }: ErrorStateProps) {
  const { code } = toClientError(error);
  return (
    <section role="alert" className={cn("glass flex flex-col items-center rounded-xl px-6 py-12 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full border border-blood/30 bg-blood/10">
        <TriangleAlert className="size-5 text-blood" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{copy.errors[code]}</p>
      <Button variant="outline" className="mt-6" onClick={onRetry}>
        <RotateCcw aria-hidden="true" />
        {copy.common.retry}
      </Button>
    </section>
  );
}
