import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Concentric violet rings: breathe on hover, spin slowly while a file is dragged over. */
export function SummoningCircle({ active, dragging }: { active: boolean; dragging: boolean }) {
  const reduce = useReducedMotion();
  const breathe = !reduce && (active || dragging);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
      <motion.svg
        viewBox="0 0 400 400"
        className={cn(
          "size-[min(92%,520px)] transition-opacity duration-300 motion-reduce:duration-150",
          active || dragging ? "opacity-100" : "opacity-80",
        )}
        animate={reduce ? undefined : dragging ? { rotate: 360 } : { rotate: 0 }}
        transition={dragging ? { duration: 24, ease: "linear", repeat: Infinity } : { duration: 0.45 }}
      >
        <defs>
          <radialGradient id="gs-circle-core" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="var(--violet)" stopOpacity="0.35" />
            <stop offset="0.6" stopColor="var(--violet)" stopOpacity="0.08" />
            <stop offset="1" stopColor="var(--violet)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="190" fill="url(#gs-circle-core)" />
        {[
          { r: 186, width: 1, dash: "2 10", opacity: 0.55 },
          { r: 160, width: 1.5, dash: undefined, opacity: 0.35 },
          { r: 132, width: 1, dash: "28 8 4 8", opacity: 0.5 },
          { r: 104, width: 1, dash: undefined, opacity: 0.25 },
        ].map((ring, index) => (
          <motion.circle
            key={ring.r}
            cx="200"
            cy="200"
            r={ring.r}
            fill="none"
            stroke="var(--violet-soft)"
            strokeWidth={ring.width}
            strokeDasharray={ring.dash}
            strokeOpacity={ring.opacity}
            style={{ transformOrigin: "200px 200px" }}
            animate={breathe ? { scale: [1, 1.025, 1], strokeOpacity: [ring.opacity, ring.opacity + 0.3, ring.opacity] } : undefined}
            transition={breathe ? { duration: 2.4, delay: index * 0.18, repeat: Infinity, ease: "easeInOut" } : undefined}
          />
        ))}
        {/* Six runes on the outer ring */}
        {Array.from({ length: 6 }, (_, i) => {
          const angle = (i * Math.PI) / 3 - Math.PI / 2;
          return (
            <circle
              key={i}
              cx={200 + Math.cos(angle) * 160}
              cy={200 + Math.sin(angle) * 160}
              r="3.5"
              fill="var(--violet-soft)"
              opacity="0.8"
            />
          );
        })}
        <polygon
          points={Array.from({ length: 6 }, (_, i) => {
            const angle = (i * Math.PI) / 3 - Math.PI / 2;
            return `${200 + Math.cos(angle) * 132},${200 + Math.sin(angle) * 132}`;
          }).join(" ")}
          fill="none"
          stroke="var(--violet-soft)"
          strokeOpacity="0.18"
        />
      </motion.svg>
    </div>
  );
}
