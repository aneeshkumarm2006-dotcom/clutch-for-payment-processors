"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildStructuredData, type EngineContext, type EngineEntity } from "@/lib/engine";
import { contentTypes, type ContentTypeKey } from "@/config/content-engine";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

/**
 * Per-page structured-data panel: live JSON-LD preview, per-type toggles, a raw
 * custom JSON-LD box, and validation warnings.
 *
 * ── Why there is no preview API endpoint ──
 * This component imports `buildStructuredData` — the SAME pure function the public
 * page calls — and runs it in the browser on the current form values. The preview
 * is therefore not an approximation of the output; it IS the output, produced by
 * the identical code path. A preview that runs different code from production is a
 * preview of nothing: it will agree right up until the moment it matters.
 *
 * That's only possible because `lib/engine` has no server-only dependencies. If
 * someone adds a `mongoose` import there, this component breaks — which is exactly
 * the tripwire we want.
 *
 * The caller supplies `toEntity`, which merges the live form values over the SAVED
 * document. The merge matters: a draft has no `ratingAverage` or `_id`, so without
 * the saved values underneath, the preview would show a Product with no
 * aggregateRating and the editor would think they'd broken something.
 */
export function StructuredDataPanel({
  contentType,
  name = "structuredData",
  toEntity,
  ctx,
}: {
  contentType: ContentTypeKey;
  name?: string;
  /** Build an EngineEntity from the current form values merged over the saved doc. */
  toEntity: (values: Record<string, unknown>) => EngineEntity<unknown>;
  ctx: EngineContext;
}) {
  const { control, getValues, setValue } = useFormContext();

  // Re-derive on every edit. `useWatch` with no name subscribes to the whole form,
  // which is what we want — a change to any field can change the schema.
  const watched = useWatch({ control });

  const { nodes, warnings } = React.useMemo(() => {
    try {
      return buildStructuredData(contentType, toEntity(getValues()), ctx);
    } catch (err) {
      return {
        nodes: [],
        warnings: [
          {
            scope: "engine",
            severity: "error" as const,
            message: err instanceof Error ? err.message : "Could not build structured data.",
          },
        ],
      };
    }
    // `watched` is the dependency that makes this live; it's intentionally unused
    // in the body (we read fresh values via getValues to avoid stale snapshots).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched, contentType, ctx, getValues, toEntity]);

  const disabled: string[] = (useWatch({ control, name: `${name}.disabledTypes` }) as string[]) ?? [];
  const availableTypes = contentTypes[contentType].schema.map((r) => ({
    type: r.type,
    label: r.label ?? r.type,
  }));

  const toggleType = (type: string, on: boolean) => {
    const next = on ? disabled.filter((t) => t !== type) : [...new Set([...disabled, type])];
    setValue(`${name}.disabledTypes`, next, { shouldDirty: true });
  };

  const errors = warnings.filter((w) => w.severity === "error");
  const notices = warnings.filter((w) => w.severity === "warn");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h4">Structured data</h2>
        <p className="mt-0.5 text-small text-muted-foreground">
          Generated automatically from this page&rsquo;s content. Everything below is optional —
          leave it alone and the defaults apply.
        </p>
      </div>

      {/* Type toggles */}
      <div className="space-y-2">
        <Label>Schema types</Label>
        <div className="space-y-2">
          {availableTypes.map(({ type, label }) => {
            const on = !disabled.includes(type);
            const emitted = nodes.some((n) => n["@type"] === type);
            return (
              <div
                key={type}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Switch
                    checked={on}
                    onCheckedChange={(v) => toggleType(type, v)}
                    aria-label={`Emit ${type}`}
                  />
                  <span className="text-label text-foreground">{label}</span>
                </div>
                {on && !emitted ? (
                  <span className="text-micro text-muted-foreground">
                    Nothing to emit yet
                  </span>
                ) : on ? (
                  <Badge variant="neutral" className="text-micro">
                    Active
                  </Badge>
                ) : (
                  <span className="text-micro text-muted-foreground">Off</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Validation */}
      {(errors.length > 0 || notices.length > 0) && (
        <div className="space-y-2">
          {errors.map((w, i) => (
            <p
              key={`e${i}`}
              className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-small text-destructive"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{w.message}</span>
            </p>
          ))}
          {notices.map((w, i) => (
            <p
              key={`w${i}`}
              className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-small text-warning"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{w.message}</span>
            </p>
          ))}
        </div>
      )}

      {errors.length === 0 && notices.length === 0 && nodes.length > 0 && (
        <p className="flex items-center gap-2 text-small text-muted-foreground">
          <CircleCheck className="size-4 text-success" />
          {nodes.length} valid {nodes.length === 1 ? "node" : "nodes"} — no issues.
        </p>
      )}

      {/* Custom JSON-LD */}
      <FormField
        control={control}
        name={`${name}.customJsonLd`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Custom JSON-LD (advanced)</FormLabel>
            <FormDescription>
              Added alongside the generated schema. Must be valid JSON — an invalid blob blocks
              saving rather than shipping a broken tag.
            </FormDescription>
            <FormControl>
              <Textarea
                rows={5}
                spellCheck={false}
                placeholder={'{ "@context": "https://schema.org", "@type": "HowTo", … }'}
                className="font-mono text-micro"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Live preview */}
      <div>
        <Label>Preview</Label>
        <p className="mb-2 mt-0.5 text-micro text-muted-foreground">
          Exactly what will be rendered into the page&rsquo;s &lt;head&gt;.
        </p>
        <pre
          className={cn(
            "max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3",
            "text-micro leading-relaxed text-ink-700 dark:text-ink-300",
          )}
        >
          <code>
            {nodes.length
              ? JSON.stringify(nodes.length === 1 ? nodes[0] : nodes, null, 2)
              : "// No structured data for this page yet."}
          </code>
        </pre>
      </div>
    </div>
  );
}

export default StructuredDataPanel;
