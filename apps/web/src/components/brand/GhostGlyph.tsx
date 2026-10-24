import { cn } from "@/lib/utils";

/** The GhostStock ghost: a soft sheet with a scalloped hem. Decorative by default. */
export function GhostGlyph({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-6", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id="gs-ghost-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--text)" />
          <stop offset="1" stopColor="var(--violet-soft)" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d="M24 5C14.6 5 9 11.7 9 20.6V41l4.4-3.2 3.6 3.2 3.5-3.2 3.5 3.2 3.5-3.2 3.5 3.2 3.6-3.2L39 41V20.6C39 11.7 33.4 5 24 5Z"
        fill="url(#gs-ghost-fill)"
      />
      <ellipse cx="19" cy="21" rx="2.4" ry="3.2" fill="var(--bg)" />
      <ellipse cx="29" cy="21" rx="2.4" ry="3.2" fill="var(--bg)" />
    </svg>
  );
}
