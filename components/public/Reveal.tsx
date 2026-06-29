"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Scroll-reveal primitives (DESIGN §5.4): opacity 0→1 + translateY(8px), 300ms,
 * entrance easing, `once: true`. `RevealGroup` staggers its `RevealItem`
 * children 50ms apart. All three honor `prefers-reduced-motion` by rendering a
 * plain element with no transform — the content is always present (no
 * JS-gated visibility), so it's safe for SEO and no-motion users.
 */
const EASE = [0.16, 1, 0.3, 1] as const;

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

const groupVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const VIEWPORT = { once: true, margin: "-40px" } as const;

/** Reveal a single block as it scrolls into view. */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={itemVariants}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers its `RevealItem` children into view. */
export function RevealGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={groupVariants}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
    >
      {children}
    </motion.div>
  );
}

/** A single staggered child of `RevealGroup`. */
export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
