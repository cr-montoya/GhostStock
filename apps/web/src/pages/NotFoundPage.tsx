import { Link } from "react-router";
import { GhostEmptyState } from "@/components/brand/GhostEmptyState";
import { Button } from "@/components/ui/button";
import { copy } from "@/copy/es";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
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
    </main>
  );
}
