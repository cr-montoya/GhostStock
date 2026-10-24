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
    boxShadow: [
      "0 0 0px 0px var(--ectoplasm-glow)",
      "0 0 48px 2px var(--ectoplasm-glow)",
      "0 0 0px 0px var(--ectoplasm-glow)",
    ],
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 24,
      boxShadow: { duration: 0.6, ease: "easeOut" },
      filter: { duration: 0.45 },
    },
  },
};

/** Reduced motion: opacity only, at most 150 ms. */
export const riseListReduced: Variants = { hidden: {}, shown: {} };
export const riseItemReduced: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.15 } },
};
