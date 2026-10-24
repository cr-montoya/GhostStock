import { copy } from "@/copy/es";
import { cn } from "@/lib/utils";
import { GhostGlyph } from "./GhostGlyph";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 place-items-center rounded-[10px] border border-border-strong bg-surface-raised shadow-[0_0_24px_-4px_var(--violet-glow)]">
        <GhostGlyph className="size-6" />
      </span>
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Ghost<span className="text-violet-soft">Stock</span>
          <span className="sr-only">: {copy.brand.tagline}</span>
        </span>
      )}
    </span>
  );
}
