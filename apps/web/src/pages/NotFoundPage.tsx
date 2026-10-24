import { Link } from "react-router";
import { GhostEmptyState } from "@/components/brand/GhostEmptyState";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy/es";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col justify-center py-6 md:min-h-[70dvh]">
      <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.2em] text-violet-soft">{copy.notFound.eyebrow}</p>
      <GhostEmptyState
        headingLevel={1}
        title={copy.notFound.title}
        body={copy.notFound.body}
        action={
          <Button asChild size="lg">
            <Link to="/">{copy.notFound.back}</Link>
          </Button>
        }
      />
    </div>
  );
}
