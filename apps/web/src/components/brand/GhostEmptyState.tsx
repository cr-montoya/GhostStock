import { motion, useReducedMotion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GhostGlyph } from "./GhostGlyph";

interface GhostEmptyStateProps {
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
  headingLevel?: 1 | 2;
}

/** A ghost drifting over empty shelves, with one clear call to action. */
export function GhostEmptyState({ title, body, action, className, headingLevel = 2 }: GhostEmptyStateProps) {
  const reduce = useReducedMotion();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section
      className={cn(
        "glass relative flex flex-col items-center overflow-hidden rounded-xl px-6 py-12 text-center",
        className,
      )}
    >
      <div className="relative mb-6 h-40 w-64" aria-hidden="true">
        <Shelves />
        <motion.div
          className="absolute left-1/2 top-[88px] -ml-7 h-2 w-14 rounded-full bg-violet/40 blur-[5px]"
          animate={reduce ? undefined : { scaleX: [1, 0.8, 1], opacity: [0.7, 0.4, 0.7] }}
          transition={reduce ? undefined : { duration: 6, ease: "easeInOut", repeat: Infinity }}
        />
        <motion.div
          className="absolute left-1/2 top-0 -ml-10 drop-shadow-[0_0_28px_var(--violet-glow)]"
          animate={reduce ? undefined : { y: [0, -10, 0], rotate: [-2, 2, -2] }}
          transition={reduce ? undefined : { duration: 6, ease: "easeInOut", repeat: Infinity }}
        >
          <GhostGlyph className="size-20" />
        </motion.div>
      </div>
      <Heading className="text-xl text-balance">{title}</Heading>
      {body && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}

function Shelves() {
  const shelfId = useId();
  return (
    <svg viewBox="0 0 256 160" className="absolute inset-0 size-full">
      <defs>
        <linearGradient id={shelfId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--violet-soft)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--violet-soft)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--violet-soft)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[96, 128, 156].map((y) => (
        <rect key={y} x="8" y={y} width="240" height="2" rx="1" fill={`url(#${shelfId})`} />
      ))}
      <rect x="40" y="108" width="14" height="20" rx="2" fill="var(--violet-soft)" opacity="0.12" />
      <rect x="196" y="138" width="22" height="18" rx="2" fill="var(--violet-soft)" opacity="0.1" />
      <rect x="62" y="114" width="10" height="14" rx="2" fill="var(--violet-soft)" opacity="0.08" />
    </svg>
  );
}
