import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/** Fraunces headline with a small-caps eyebrow; the theme lives here, not in buttons. */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-violet-soft">
          <span aria-hidden="true" className="h-px w-6 bg-violet-soft/60" />
          {eyebrow}
        </p>
        <h1 className="text-2xl font-medium text-glow md:text-3xl">{title}</h1>
        {description && <p className="mt-3 text-base text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
