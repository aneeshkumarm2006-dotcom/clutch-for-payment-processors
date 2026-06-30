"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Search, SlidersHorizontal } from "lucide-react";
import { COMPARE_MAX, useCompare } from "@/components/public/compare/CompareContext";
import { CompareTable } from "@/components/public/compare/CompareTable";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ProcessorCardData, ProcessorDetailData } from "@/lib/serialize";

/**
 * CompareView (PRD §9.4) — the client shell around the CompareTable. The URL's
 * `?ids=` (slugs) is the source of truth for which columns show; add/remove just
 * navigate to a new `?ids=`, and the server re-fetches the column data. It also
 * mirrors the current selection into the shared compare store so the floating
 * CompareBar stays in sync.
 */
export function CompareView({ processors }: { processors: ProcessorDetailData[] }) {
  const router = useRouter();
  const { setAll } = useCompare();

  const slugs = React.useMemo(() => processors.map((p) => p.slug), [processors]);

  // Mirror the page's columns into the shared store (keeps the floating bar honest).
  React.useEffect(() => {
    setAll(processors.map((p) => ({ slug: p.slug, name: p.name, logo: p.logo })));
  }, [processors, setAll]);

  const navigate = React.useCallback(
    (next: string[]) => {
      const unique = Array.from(new Set(next)).slice(0, COMPARE_MAX);
      router.push(unique.length ? `/compare?ids=${unique.join(",")}` : "/compare");
    },
    [router],
  );

  const add = (slug: string) => navigate([...slugs, slug]);
  const remove = (slug: string) => navigate(slugs.filter((s) => s !== slug));

  const isFull = processors.length >= COMPARE_MAX;
  const enough = processors.length >= 2;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-muted-foreground">
          {processors.length === 0
            ? "Add processors to start comparing."
            : `Comparing ${processors.length} of ${COMPARE_MAX}.`}
        </p>
        <ComparePicker onAdd={add} onRemove={remove} selectedSlugs={slugs} isFull={isFull} />
      </div>

      {enough ? (
        <CompareTable processors={processors} onRemove={remove} />
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <SlidersHorizontal className="mx-auto size-8 text-ink-300" aria-hidden />
          <h2 className="mt-4 text-h4 text-foreground">
            {processors.length === 1 ? "Add one more processor" : "Pick processors to compare"}
          </h2>
          <p className="mx-auto mt-2 max-w-prose text-small text-muted-foreground">
            Compare 2–4 processors side by side — pricing, payment methods, integrations, features,
            and company facts. Use the picker above, or “Add to compare” from any processor card.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Searchable add-a-column picker. Queries the public `GET /api/processors?q=`.
 * Each result is a toggle: a check marks processors already in the comparison
 * (active); clicking adds an inactive one or removes an active one. The popover
 * stays open so several can be toggled in one pass.
 */
function ComparePicker({
  onAdd,
  onRemove,
  selectedSlugs,
  isFull,
}: {
  onAdd: (slug: string) => void;
  onRemove: (slug: string) => void;
  selectedSlugs: string[];
  isFull?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ProcessorCardData[]>([]);
  const [loading, setLoading] = React.useState(false);

  const selected = React.useMemo(() => new Set(selectedSlugs), [selectedSlugs]);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "8" });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/processors?${params.toString()}`);
        const data = (await res.json()) as { items?: ProcessorCardData[] };
        if (active) setResults(data.items ?? []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="size-4" />
          Add processor
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="relative border-b border-border p-2">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search processors…"
            aria-label="Search processors to compare"
            className="pl-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {loading ? (
            <p className="flex items-center justify-center gap-2 py-6 text-small text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-small text-muted-foreground">No processors found.</p>
          ) : (
            results.map((p) => {
              const active = selected.has(p.slug);
              const blockAdd = !active && isFull;
              return (
                <button
                  key={p.slug}
                  type="button"
                  disabled={blockAdd}
                  aria-pressed={active}
                  title={blockAdd ? `Remove a processor first (max ${COMPARE_MAX})` : undefined}
                  onClick={() => (active ? onRemove(p.slug) : onAdd(p.slug))}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded px-2 py-2 text-left",
                    blockAdd
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-ink-100 dark:hover:bg-ink-800",
                    active && !blockAdd && "bg-ink-50 dark:bg-ink-900",
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded border bg-ink-0">
                    {p.logo ? (
                      <Image
                        src={p.logo}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 object-contain p-1"
                        unoptimized
                      />
                    ) : (
                      <span className="text-small font-semibold text-ink-400">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-small text-foreground">{p.name}</span>
                  {active && (
                    <Check className="size-4 shrink-0 text-accent" aria-hidden />
                  )}
                  <span className="sr-only">{active ? "In comparison" : "Not in comparison"}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default CompareView;
