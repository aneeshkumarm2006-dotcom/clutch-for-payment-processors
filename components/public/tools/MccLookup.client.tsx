"use client";

import * as React from "react";
import type { MccEntry } from "@/lib/tools-data/mcc";
import { CalcShell, Caveat, Field, MiniTable, Pill, SelectField } from "@/components/public/tools/ToolKit";

/**
 * Merchant category code lookup.
 *
 * Deliberately does no arithmetic. It is a filtered view over a fixed dataset,
 * and the dataset IS the product: the page ranking first for this query is a
 * bare search box with under 200 words around it, so the win is a correct list
 * plus an explanation of why the code matters.
 *
 * The high-risk flag is a market observation about how US acquirers underwrite,
 * not a card network classification. No network publishes a "high risk MCC"
 * list, and acquirers disagree with each other, so the column is labelled as
 * what it is.
 *
 * The dataset arrives as PROPS from the server component rather than being
 * imported here. `/tools/[tool]` is one route with one client manifest, so an
 * import would ship all 290 rows to every calculator on the site. As props they
 * ride only this page's payload, and they are server rendered either way.
 */
export function MccLookup({ codes, groups }: { codes: MccEntry[]; groups: string[] }) {
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState("all");
  const [highRiskOnly, setHighRiskOnly] = React.useState(false);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return codes.filter((c) => {
      if (group !== "all" && c.group !== group) return false;
      if (highRiskOnly && !c.highRisk) return false;
      if (!q) return true;
      return c.code.includes(q) || c.description.toLowerCase().includes(q) || c.group.toLowerCase().includes(q);
    });
  }, [codes, query, group, highRiskOnly]);

  const shown = results.slice(0, 120);

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <Field
            id="mcc-q"
            label="Search"
            value={query}
            onChange={setQuery}
            inputMode="numeric"
            hint="By four digit code, by description, or by category."
          />
          <SelectField
            id="mcc-group"
            label="Category"
            value={group}
            onChange={setGroup}
            options={[
              { value: "all", label: `All categories (${codes.length} codes)` },
              ...groups.map((g) => ({ value: g, label: g })),
            ]}
          />
          <div className="rounded border bg-muted px-4 py-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={highRiskOnly}
                onChange={() => setHighRiskOnly((v) => !v)}
                className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--accent)]"
              />
              <span className="text-small text-foreground">
                Only codes acquirers commonly treat as high risk
                <span className="block text-micro text-muted-foreground">
                  A market observation, not a card network classification.
                </span>
              </span>
            </label>
          </div>
          <p className="text-micro text-muted-foreground">
            Your MCC is assigned by your acquirer, not chosen by you. It decides which interchange programs your
            transactions qualify for, so a wrong one costs money on every sale.
          </p>
        </div>
      }
      results={
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-label uppercase text-muted-foreground">
              {results.length} {results.length === 1 ? "code" : "codes"}
            </p>
            {results.length > shown.length && (
              <p className="text-micro text-muted-foreground">Showing the first {shown.length}. Narrow the search.</p>
            )}
          </div>

          <div className="mt-3">
            <MiniTable
              columns={["Code", "Description", "Category", ""]}
              align={["left", "left", "left", "right"]}
              maxHeight="460px"
              empty="No codes match that search. Try a broader term, or a partial code such as 59."
              rows={shown.map((c) => [
                <span key={c.code} className="font-mono tabular-nums">
                  {c.code}
                </span>,
                c.description,
                <span key={`${c.code}-g`} className="text-muted-foreground">
                  {c.group}
                </span>,
                c.highRisk ? (
                  <Pill key={`${c.code}-r`} tone="warn">
                    High risk
                  </Pill>
                ) : (
                  ""
                ),
              ])}
            />
          </div>

          <Caveat>
            Codes and descriptions follow the published US merchant category code lists. If your statement shows a
            code that does not match what you actually sell, ask your acquirer to reassign it: they own the
            assignment, and a mismatch can push your transactions into worse interchange programs or trip fraud
            monitoring.
          </Caveat>
        </div>
      }
    />
  );
}

export default MccLookup;
