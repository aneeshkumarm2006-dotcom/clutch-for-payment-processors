"use client";

import { useEffect } from "react";

/**
 * Fires a single best-effort "view" beacon for a published post on mount, so the
 * read counter reflects real reads (not ISR cache misses). Renders nothing.
 */
export function ViewPing({ id }: { id: string }) {
  useEffect(() => {
    const url = `/api/blog/${id}/view`;
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(url);
      } else {
        void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
      }
    } catch {
      /* never let analytics break the page */
    }
  }, [id]);

  return null;
}

export default ViewPing;
