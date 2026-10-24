import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "motion/react";
import { useEffect } from "react";

interface CountUpProps {
  value: number;
  format: (value: number) => string;
  className?: string;
}

/** Counts from 0 to `value` in 900 ms; renders the final value at once under reduced motion. */
export function CountUp({ value, format, className }: CountUpProps) {
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(reduce ? value : 0);
  const text = useTransform(motionValue, (latest) => format(Math.round(latest)));

  useEffect(() => {
    if (reduce) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, reduce, motionValue]);

  return (
    <>
      <motion.span aria-hidden="true" className={className}>
        {text}
      </motion.span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
