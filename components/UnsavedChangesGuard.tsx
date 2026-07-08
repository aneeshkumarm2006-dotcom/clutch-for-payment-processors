"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Module-level mirror of the active editor's dirty state so callers rendered
// OUTSIDE this component's tree (e.g. a shell "Log out" button) can check for
// unsaved work before navigating away. Only one editor form is ever mounted at
// a time, so a single flag is enough.
let editorHasUnsavedChanges = false;

/** True while a mounted editor holds edits that haven't been saved. Safe to call anywhere. */
export function hasUnsavedChanges() {
  return editorHasUnsavedChanges;
}

export type UnsavedChangesGuardHandle = {
  /**
   * Run `proceed` immediately when the form is clean; otherwise pop the confirm
   * dialog and only run it if the author chooses to leave. Use for programmatic
   * navigations (buttons) that don't go through the anchor click interceptor.
   */
  confirmNavigation: (proceed: () => void) => void;
};

type Props = {
  /** True when the form holds edits that haven't been saved/published yet. */
  enabled: boolean;
};

/**
 * Warns authors before they abandon unsaved edits. The blog editors only persist
 * text on an explicit Save/Publish, so a stray sidebar click, a Cancel, a refresh
 * or a tab close would otherwise silently drop their work.
 *
 * Covers every exit route:
 *  - hard navigation (refresh, close tab, URL bar, external links) → the native
 *    `beforeunload` prompt;
 *  - in-app <Link>/anchor clicks (sidebar, logo, …) → a capture-phase click
 *    interceptor that shows the in-app confirm dialog before the router runs;
 *  - programmatic navigations (Cancel, …) → the `confirmNavigation` handle.
 */
export const UnsavedChangesGuard = React.forwardRef<UnsavedChangesGuardHandle, Props>(
  function UnsavedChangesGuard({ enabled }, ref) {
    const router = useRouter();
    // Holds the navigation to run if the author confirms. Non-null = dialog open.
    const [pending, setPending] = React.useState<(() => void) | null>(null);
    const enabledRef = React.useRef(enabled);
    enabledRef.current = enabled;

    // Mirror to the module flag for out-of-tree callers; always clear on unmount.
    React.useEffect(() => {
      editorHasUnsavedChanges = enabled;
      return () => {
        editorHasUnsavedChanges = false;
      };
    }, [enabled]);

    const confirmNavigation = React.useCallback((proceed: () => void) => {
      if (!enabledRef.current) {
        proceed();
        return;
      }
      setPending(() => proceed);
    }, []);

    React.useImperativeHandle(ref, () => ({ confirmNavigation }), [confirmNavigation]);

    // Native prompt for full-page unloads (refresh, close, external links, URL bar).
    React.useEffect(() => {
      if (!enabled) return;
      const onBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [enabled]);

    // Intercept in-app anchor navigations (Next.js <Link> renders a plain <a>)
    // before the router handles them, so we can confirm first.
    React.useEffect(() => {
      if (!enabled) return;
      const onClick = (e: MouseEvent) => {
        // Let modified clicks (new tab/window) and non-primary buttons through.
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
          return;
        const anchor = (e.target as HTMLElement | null)?.closest("a");
        if (!anchor) return;
        // Links the author is editing inside the rich-text body aren't navigations.
        if (anchor.isContentEditable) return;
        const href = anchor.getAttribute("href");
        if (!href) return;
        if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
        let url: URL;
        try {
          url = new URL(href, window.location.href);
        } catch {
          return;
        }
        if (url.origin !== window.location.origin) return; // external → beforeunload covers it
        // Same page (a hash jump or a re-click) isn't leaving the editor.
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        // Capture phase + stopPropagation runs us before Next's own click handler.
        e.preventDefault();
        e.stopPropagation();
        const target = url.pathname + url.search + url.hash;
        setPending(() => () => router.push(target));
      };
      document.addEventListener("click", onClick, true);
      return () => document.removeEventListener("click", onClick, true);
    }, [enabled, router]);

    const leave = () => {
      const proceed = pending;
      setPending(null);
      proceed?.();
    };
    const stay = () => setPending(null);

    return (
      <Dialog open={pending !== null} onOpenChange={(open) => !open && stay()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You&rsquo;ve made changes that haven&rsquo;t been saved yet. If you leave now,
              they&rsquo;ll be lost. Save or publish first to keep them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={stay} autoFocus>
              Stay on this page
            </Button>
            <Button type="button" variant="destructive" onClick={leave}>
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  },
);

export default UnsavedChangesGuard;
