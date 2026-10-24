import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";

interface KpiCardProps {
  label: string;
  value: number;
  format: (value: number) => string;
  icon: LucideIcon;
  highlight?: boolean;
}

export function KpiCard({ label, value, format, icon: Icon, highlight = false }: KpiCardProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "glass group relative overflow-hidden rounded-lg p-4 md:p-5",
        highlight && "border-violet-soft/30 shadow-[var(--shadow-soft),0_0_48px_-16px_var(--violet-glow)]",
      )}
    >
      {highlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-violet/25 blur-3xl"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-sans text-xs font-medium uppercase tracking-[0.14em] text-text/70">{label}</h2>
        <Icon className={cn("size-4", highlight ? "text-violet-soft" : "text-muted-foreground")} aria-hidden="true" />
      </div>
      <p className="mt-3 truncate font-display text-xl tabular md:text-2xl">
        <CountUp value={value} format={format} />
      </p>
    </section>
  );
}
