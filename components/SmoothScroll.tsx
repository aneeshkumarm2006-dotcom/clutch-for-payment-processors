"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Site-wide smooth (inertia) scrolling powered by Lenis.
 *
 * Mounts once at the root and drives an eased scroll on wheel/touch/keyboard.
 * Anchor-link jumps (#id) still resolve correctly because Lenis hooks the
 * native scroll. Users who prefer reduced motion get the default browser
 * scroll instead — we simply don't start Lenis for them.
 */
export default function SmoothScroll() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
