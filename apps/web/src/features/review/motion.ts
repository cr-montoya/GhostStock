import type { Variants } from "motion/react";

/** Cards rise from the photo: staggered spring, blur to sharp, a brief ectoplasm glow. */
export const riseList: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  shown: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 260, damping: 24, filter: { duration: 0.45 } },
  },
};

/** The ectoplasm glow: an overlay that pulses once as the card lands. */
export const glowOnce: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: [0, 1, 0], transition: { duration: 0.6, delay: 0.15, ease: "easeOut" } },
};

/** Reduced motion: opacity only, at most 150 ms. */
export const riseListReduced: Variants = { hidden: {}, shown: {} };
export const riseItemReduced: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.15 } },
};
