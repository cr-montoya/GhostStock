import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { copy } from "@/copy/es";
import { cn } from "@/lib/utils";

const TICK_MS = 1800;

/** Rotating status copy, announced politely to screen readers. */
export function StatusTicker({ messages }: { messages: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    setIndex(0);
    if (messages.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % messages.length), TICK_MS);
    return () => window.clearInterval(timer);
  }, [messages]);

  const message = messages[index] ?? "";
  return (
    <div role="status" aria-live="polite" className="relative h-8 w-full overflow-hidden text-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={message}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: reduce ? 0.15 : 0.35 }}
          className="font-display text-lg italic text-text"
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** A spectral line sweeping the frame top to bottom, on loop (stopped under reduced motion). */
export function ScanLine() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"
      initial={{ y: "-100%" }}
      animate={{ y: ["-30%", "520%"] }}
      transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.2 }}
    >
      <div className="h-full bg-gradient-to-b from-transparent via-ectoplasm/10 to-ectoplasm/25" />
      <div className="h-px bg-ectoplasm shadow-[0_0_16px_2px_var(--ectoplasm-glow)]" />
    </motion.div>
  );
}

/** Fog rising from the bottom edge of the frame. */
export function Fog() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[-10%] bottom-0 z-10 h-1/2 bg-[radial-gradient(60%_80%_at_50%_100%,color-mix(in_oklab,var(--violet-soft)_55%,transparent),transparent_70%)] mix-blend-screen blur-xl"
      initial={{ opacity: 0.4 }}
      animate={reduce ? { opacity: 0.6 } : { opacity: [0.4, 0.8, 0.4], y: [12, -8, 12] }}
      transition={reduce ? { duration: 0.15 } : { duration: 4, ease: "easeInOut", repeat: Infinity }}
    />
  );
}

interface PhotoFrameProps {
  src: string;
  alt: string;
  scanning?: boolean;
  dimmed?: boolean;
  children?: ReactNode;
  className?: string;
}

/** The analyzed photo in a dark, glowing frame; full frame, never cropped. */
export function PhotoFrame({ src, alt, scanning = false, dimmed = false, children, className }: PhotoFrameProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-border-strong bg-bg p-2 shadow-[0_0_80px_-24px_var(--violet-glow),inset_0_0_40px_var(--ink)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-lg">
        <img
          src={src}
          alt={alt}
          className={cn(
            "mx-auto max-h-[52dvh] w-full object-contain transition-[filter,opacity] duration-500 motion-reduce:duration-150",
            scanning && "brightness-75 saturate-50",
            dimmed && "opacity-40 grayscale",
          )}
        />
        {scanning && (
          <>
            <ScanLine />
            <Fog />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(transparent_50%,color-mix(in_oklab,var(--bg)_25%,transparent)_50%)] bg-[length:100%_4px] opacity-40" />
          </>
        )}
        {children}
      </div>
    </div>
  );
}

export function ResurrectionStage({
  src,
  phase,
  headingRef,
}: {
  src: string;
  phase: "uploading" | "analyzing";
  headingRef?: (element: HTMLElement | null) => void;
}) {
  const messages = phase === "uploading" ? copy.resurrection.uploading : copy.resurrection.analyzing;
  return (
    <section aria-labelledby="resurrection-title" className="flex flex-col items-center gap-6">
      <h2 id="resurrection-title" ref={headingRef} tabIndex={-1} className="sr-only">
        {copy.resurrection.title}
      </h2>
      <PhotoFrame src={src} alt={copy.resurrection.photoAlt} scanning />
      <StatusTicker key={phase} messages={messages} />
      <div aria-hidden="true" className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-violet-soft motion-reduce:animate-none"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </section>
  );
}
