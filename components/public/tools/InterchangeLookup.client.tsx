"use client";

import * as React from "react";
import type { InterchangeRate } from "@/lib/tools-data/interchange";
// The narrow module, never the `@/lib/tools-data` barrel. Only the defaults
// object is imported: the 196 rows arrive as props from `ToolWidget` so they
// ride this page's payload rather than every calculator's.
import { INTERCHANGE_DEFAULTS } from "@/lib/tools-data/interchange";
import { filterRates, formatProgramRate, interchangeCost } from "@/lib/calc/interchange";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  MiniTable,
  Pill,
  SelectField,
  money,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Interchange fee lookup.
 *
 * Modelled on `MccLookup.client.tsx`, and for the same reason: the DATASET is
 * the product. The arithmetic here is one multiplication and an addition, done
 * in `lib/calc/interchange.ts`. What nobody else publishes is a current,
 * filterable, priceable US interchange table, because the networks ship PDFs and
 * every page that has tried to retype them is years out of date.
 *
 * The 196 rows arrive as PROPS from the server component rather than being
 * imported here. `/tools/[tool]` is one route with one client manifest, so an
 * import would ship the whole table to every calculator on the site. As props
 * they ride only this page's payload, and they are server rendered either way,
 * which is what puts real dollar figures into the raw HTML.
 *
 * NO VERDICT BAND on this page. The bands score a merchant's blended monthly
 * effective rate. Interchange on one transaction is not that number, is not
 * negotiable, and is not the merchant's whole cost, so scoring it would be
 * meaningless at best.
 */
export function InterchangeLookup({
  rows,
  networks,
  categories,
}: {
  rows: InterchangeRate[];
  networks: string[];
  categories: string[];
}) {
  const [query, setQuery] = React.useState(INTERCHANGE_DEFAULTS.query);
  const [network, setNetwork] = React.useState(INTERCHANGE_DEFAULTS.network);
  const [category, setCategory] = React.useState(INTERCHANGE_DEFAULTS.category);
  const [channel, setChannel] = React.useState(INTERCHANGE_DEFAULTS.channel);
  const [amount, setAmount] = React.useState(String(INTERCHANGE_DEFAULTS.amount));

  const ticket = num(amount);

  const results = React.useMemo(
    () => filterRates(rows, { query, network, category, channel }),
    [rows, query, network, category, channel],
  );

  const shown = results.slice(0, INTERCHANGE_DEFAULTS.maxRows);

  const priced = React.useMemo(
    () => shown.map((r) => ({ row: r, cost: interchangeCost(ticket, r) })),
    [shown, ticket],
  );

  /**
   * The cheapest and dearest visible program on this ticket.
   *
   * Computed over the VISIBLE rows, not the whole table, so it answers the
   * question the current filter is asking rather than an unrelated one.
   */
  const spread = React.useMemo(() => {
    if (ticket <= 0) return null;
    type Priced = (typeof priced)[number];
    let low: Priced | null = null;
    let high: Priced | null = null;
    for (const p of priced) {
      if (low === null || p.cost.cents < low.cost.cents) low = p;
      if (high === null || p.cost.cents > high.cost.cents) high = p;
    }
    return low !== null && high !== null ? { low, high } : null;
  }, [priced, ticket]);

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <Field
            id="ilk-amount"
            label="Transaction amount"
            prefix="$"
            value={amount}
            onChange={setAmount}
            hint="Every program below is priced on this amount."
          />
          <Field
            id="ilk-q"
            label="Search programs"
            value={query}
            onChange={setQuery}
            inputMode="decimal"
            hint="By program name, card product, or a merchant category code such as 6513."
          />
          <FieldPair>
            <SelectField
              id="ilk-network"
              label="Network"
              value={network}
              onChange={setNetwork}
              options={[
                { value: "all", label: `Visa and Mastercard (${rows.length} programs)` },
                ...networks.map((n) => ({
                  value: n,
                  label: `${n} (${rows.filter((r) => r.network === n).length})`,
                })),
              ]}
            />
            <SelectField
              id="ilk-channel"
              label="Acceptance channel"
              value={channel}
              onChange={setChannel}
              options={[
                { value: "all", label: "Any channel" },
                { value: "Card present", label: "Card present" },
                { value: "Card not present", label: "Card not present" },
              ]}
            />
          </FieldPair>
          <SelectField
            id="ilk-category"
            label="Merchant category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />

          <Callout>
            Interchange is not your processing cost. It is the part your acquirer pays the card issuer and passes
            through to you at cost on interchange plus pricing, or absorbs into a flat rate. On top of it sit the
            network assessments and your processor&rsquo;s markup.
          </Callout>

          <p className="text-micro text-muted-foreground">
            Rows show the rate for the card product named in the Card column. Premium consumer cards cost more on the
            same program, and the premium rate is in the notes under each program name.
          </p>
        </div>
      }
      results={
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-label uppercase text-muted-foreground">
              {results.length} {results.length === 1 ? "program" : "programs"} on {money(ticket)}
            </p>
            {results.length > shown.length && (
              <p className="text-micro text-muted-foreground">Showing the first {shown.length}. Narrow the search.</p>
            )}
          </div>

          {spread && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-border-strong bg-muted px-4 py-3">
                <p className="text-label uppercase text-muted-foreground">Cheapest shown</p>
                <p className="mt-1 text-h3 tabular-nums tracking-tighter2 text-foreground">
                  {money(spread.low.cost.fee)}
                </p>
                <p className="mt-1 text-micro text-muted-foreground">
                  {spread.low.row.network} {spread.low.row.programName}, {pct(spread.low.cost.effectivePct)} of the
                  sale
                </p>
              </div>
              <div className="rounded border border-border-strong bg-muted px-4 py-3">
                <p className="text-label uppercase text-muted-foreground">Dearest shown</p>
                <p className="mt-1 text-h3 tabular-nums tracking-tighter2 text-foreground">
                  {money(spread.high.cost.fee)}
                </p>
                <p className="mt-1 text-micro text-muted-foreground">
                  {spread.high.row.network} {spread.high.row.programName}, {pct(spread.high.cost.effectivePct)} of the
                  sale
                </p>
              </div>
            </div>
          )}

          <div className="mt-3">
            <MiniTable
              columns={["Program", "Card and channel", "Published rate", `Fee on ${money(ticket)}`, "Effective"]}
              align={["left", "left", "left", "right", "right"]}
              maxHeight="520px"
              empty="No published program matches that search. Try a broader term, a different network, or clear the category filter."
              rows={priced.map(({ row, cost }) => [
                <span key={`${row.id}-p`} className="block">
                  <span className="text-foreground">{row.programName}</span>
                  <span className="mt-0.5 block text-micro text-muted-foreground">
                    <Pill tone="neutral">{row.network}</Pill> {row.category}
                  </span>
                </span>,
                <span key={`${row.id}-c`} className="block text-muted-foreground">
                  {row.cardType}
                  <span className="mt-0.5 block text-micro">{row.channel}</span>
                </span>,
                <span key={`${row.id}-r`} className="whitespace-nowrap text-foreground tabular-nums">
                  {formatProgramRate(row)}
                </span>,
                <span key={`${row.id}-f`}>
                  {money(cost.fee)}
                  {cost.capped && (
                    <span className="mt-0.5 block text-micro text-muted-foreground">at the cap</span>
                  )}
                  {cost.floored && (
                    <span className="mt-0.5 block text-micro text-muted-foreground">at the minimum</span>
                  )}
                </span>,
                pct(cost.effectivePct),
              ])}
            />
          </div>

          <Caveat>
            Rates are read from the Visa USA Interchange Reimbursement Fees sheet effective 18 April 2026 and the
            Mastercard 2026 to 2027 U.S. Region Interchange Programs and Rates effective 17 April 2026. Both networks
            revise in April and October, so re-check the current sheet before acting on any figure that matters. Which
            program a given sale qualifies for is decided by your merchant category code, how the card was accepted,
            what data your terminal sent and when you settled, not by you.
          </Caveat>
        </div>
      }
    />
  );
}

/** Two controls side by side inside the control column. Plain layout, no new primitive. */
function FieldPair({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export default InterchangeLookup;
