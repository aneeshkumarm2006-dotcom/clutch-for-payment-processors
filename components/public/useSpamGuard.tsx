"use client";

import * as React from "react";

/**
 * useSpamGuard — the client half of the spam protection, shared by every public
 * form (contact, get-a-quote / get-matched, get-listed, write-a-review).
 *
 * Two jobs:
 *
 * 1. THE BROWSER PROOF. Stamps the moment the form rendered and sends it back
 *    with the payload. A direct POST from a script never loaded the form, so it
 *    has no stamp at all. The server weights a MISSING stamp below the
 *    quarantine line on purpose — right after a deploy a browser can be holding
 *    a stale cached bundle, and that visitor must not have their enquiry
 *    bounced — while a submission under ~3 seconds is a separate, stronger
 *    signal.
 *
 * 2. CLOUDFLARE TURNSTILE, but only if it is configured. The site key comes
 *    from `/api/spam/config`, never from page markup: this repo renders pages
 *    out of the database and golden-file tests some of them, so an env var
 *    costs nothing where a markup change would cost a migration. No key ⇒ no
 *    widget, no script tag, no behaviour change at all.
 *
 * Appearance is `interaction-only`, so a real visitor sees nothing unless
 * Cloudflare actually wants a challenge.
 */

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      appearance?: "always" | "execute" | "interaction-only";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Load the Turnstile script once per page, no matter how many forms mount. */
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    // Resolve on error too: a blocked script must not wedge the form. The
    // server refuses token-less posts once the secret is set, so failing here
    // shows a clear error rather than a silent hang.
    script.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(script);
  });
}

export interface SpamGuard {
  /** Spread into the JSON body of the submission. */
  fields: () => Record<string, unknown>;
  /**
   * Call after a FAILED submit. Turnstile tokens are single-use, so reusing one
   * on a retry always fails verification — the widget has to be reset first.
   */
  reset: () => void;
  /** Render where the challenge should appear; renders nothing when unconfigured. */
  Widget: () => React.ReactElement | null;
}

export function useSpamGuard(): SpamGuard {
  // A ref, not state: the render stamp must not change across re-renders as the
  // visitor types, or a slow, careful human starts to look like a fast one.
  const renderedAtRef = React.useRef<number>(Date.now());

  const [siteKey, setSiteKey] = React.useState<string | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);

  // Ask the server whether Turnstile is switched on.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/spam/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { turnstileSiteKey?: string | null };
        if (!cancelled && data.turnstileSiteKey) setSiteKey(data.turnstileSiteKey);
      } catch {
        // Unreachable config endpoint just means no widget. The server decides
        // whether a token is actually required.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mount the widget once a key arrives.
  React.useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    (async () => {
      await loadTurnstileScript();
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        appearance: "interaction-only",
        callback: (t) => setToken(t),
        // Tokens expire after a few minutes. A visitor who leaves the tab open
        // and comes back must get a fresh one rather than a rejected stale one.
        "expired-callback": () => {
          setToken(null);
          if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
        },
        "error-callback": () => setToken(null),
      });
    })();

    return () => {
      cancelled = true;
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  const fields = React.useCallback(
    () => ({
      formRenderedAt: renderedAtRef.current,
      ...(token ? { turnstileToken: token } : {}),
    }),
    [token],
  );

  const reset = React.useCallback(() => {
    setToken(null);
    if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
  }, []);

  const Widget = React.useCallback(() => {
    if (!siteKey) return null;
    return <div ref={containerRef} className="cf-turnstile" />;
  }, [siteKey]);

  return { fields, reset, Widget };
}
