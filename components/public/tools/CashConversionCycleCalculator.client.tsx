"use client";

import * as React from "react";
import {
  CASH_CYCLE_DEFAULTS,
  cashCycle,
  countbackDso,
  settlementImpact,
  type BalanceConvention,
} from "@/lib/calc/cash-cycle";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ModeTabs,
  ResultRow,
  SelectField,
  money,
  money0,
  num,
} from "@/components/public/tools/ToolKit";

/**
 * Cash conversion cycle, countback DSO and the settlement half, three modes.
 *
 * The gaps this exploits, all checkable against the pages currently ranking:
 *
 *   1. Almost every ranking calculator prints ONE cash conversion cycle without
 *      saying which balance it used. Both conventions are computed here on every
 *      keystroke and the gap between them is shown, because on realistic inputs
 *      it is three days of cycle.
 *   2. None of them offers a countback DSO, which is the only version of the
 *      number that means anything for a business whose sales are not flat.
 *   3. All of them stop at days. Days are not a decision. Every figure here is
 *      also translated into dollars at the visitor's own volume, with the annual
 *      carry at a borrowing rate they supply.
 *   4. None of them knows that settlement time is inside DSO, which is the part
 *      this site is actually qualified to own.
 *
 * No `@/lib/tools`, no `@/lib/tools-data` barrel, and no props: `/tools/[tool]`
 * is one route with one client manifest, so anything imported here ships to
 * every calculator on the site.
 */

const D = CASH_CYCLE_DEFAULTS;

const days1 = (n: number): string => (Number.isFinite(n) ? `${n.toFixed(1)} days` : "N/A");
const days2 = (n: number): string => (Number.isFinite(n) ? `${n.toFixed(2)} days` : "N/A");

export function CashConversionCycleCalculator() {
  const [mode, setMode] = React.useState<"cycle" | "seasonal" | "settlement">("cycle");

  // Cycle.
  const [convention, setConvention] = React.useState<BalanceConvention>(D.convention);
  const [creditSales, setCreditSales] = React.useState(String(D.creditSales));
  const [cogs, setCogs] = React.useState(String(D.cogs));
  const [arOpening, setArOpening] = React.useState(String(D.arOpening));
  const [arEnding, setArEnding] = React.useState(String(D.arEnding));
  const [invOpening, setInvOpening] = React.useState(String(D.invOpening));
  const [invEnding, setInvEnding] = React.useState(String(D.invEnding));
  const [apOpening, setApOpening] = React.useState(String(D.apOpening));
  const [apEnding, setApEnding] = React.useState(String(D.apEnding));
  const [daysInPeriod, setDaysInPeriod] = React.useState(String(D.daysInPeriod));
  const [borrowingRate, setBorrowingRate] = React.useState(String(D.borrowingRatePct));
  const [improvementDays, setImprovementDays] = React.useState(String(D.improvementDays));

  // Countback.
  const [cbReceivables, setCbReceivables] = React.useState(String(D.countbackReceivables));
  const [m1Sales, setM1Sales] = React.useState(String(D.month1Sales));
  const [m1Days, setM1Days] = React.useState(String(D.month1Days));
  const [m2Sales, setM2Sales] = React.useState(String(D.month2Sales));
  const [m2Days, setM2Days] = React.useState(String(D.month2Days));
  const [m3Sales, setM3Sales] = React.useState(String(D.month3Sales));
  const [m3Days, setM3Days] = React.useState(String(D.month3Days));

  // Settlement.
  const [annualRevenue, setAnnualRevenue] = React.useState(String(D.annualRevenue));
  const [cardShare, setCardShare] = React.useState(String(D.cardSharePct));
  const [settleDays, setSettleDays] = React.useState(String(D.settlementDays));
  const [settleFast, setSettleFast] = React.useState(String(D.improvedSettlementDays));
  const [invoiceDays, setInvoiceDays] = React.useState(String(D.invoiceCollectionDays));
  const [reservePct, setReservePct] = React.useState(String(D.reservePct));
  const [reserveHold, setReserveHold] = React.useState(String(D.reserveHoldDays));

  const periodDays = Math.max(1, num(daysInPeriod));
  const ratePct = Math.max(0, num(borrowingRate));

  const cycle = cashCycle({
    creditSales: num(creditSales),
    cogs: num(cogs),
    receivables: { opening: num(arOpening), ending: num(arEnding) },
    inventory: { opening: num(invOpening), ending: num(invEnding) },
    payables: { opening: num(apOpening), ending: num(apEnding) },
    daysInPeriod: periodDays,
    convention,
    borrowingRatePct: ratePct,
    improvementDays: Math.max(0, num(improvementDays)),
  });

  const countback = countbackDso({
    receivables: num(cbReceivables),
    months: [
      { creditSales: num(m1Sales), days: num(m1Days) },
      { creditSales: num(m2Sales), days: num(m2Days) },
      { creditSales: num(m3Sales), days: num(m3Days) },
    ],
  });

  const settlement = settlementImpact({
    annualRevenue: num(annualRevenue),
    cardSharePct: num(cardShare),
    settlementDays: num(settleDays),
    improvedSettlementDays: num(settleFast),
    invoiceCollectionDays: num(invoiceDays),
    reservePct: num(reservePct),
    reserveHoldDays: num(reserveHold),
    borrowingRatePct: ratePct,
    daysInPeriod: periodDays,
    // The measured DSO comes from the balance sheet the visitor already typed on
    // the first tab, so the collections gap is live rather than a second input
    // they have to keep in step by hand.
    measuredDsoDays: cycle.chosen.dso,
  });

  const improved = Math.max(0, num(improvementDays));

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "cycle" | "seasonal" | "settlement")}
            options={[
              { value: "cycle", label: "Cycle" },
              { value: "seasonal", label: "Seasonal DSO" },
              { value: "settlement", label: "Settlement" },
            ]}
          />

          {mode === "cycle" && (
            <div className="space-y-4">
              <SelectField
                id="ccc-convention"
                label="Balance convention"
                value={convention}
                onChange={(v) => setConvention(v as BalanceConvention)}
                options={[
                  { value: "average", label: "Average balance (opening + closing) / 2" },
                  { value: "ending", label: "Ending balance only" },
                ]}
                hint="Both are computed either way. This picks which one the headline uses."
              />
              <FieldGrid>
                <Field
                  id="ccc-sales"
                  label="Credit sales for the period"
                  prefix="$"
                  value={creditSales}
                  onChange={setCreditSales}
                  hint="Sales made on terms, not total revenue."
                />
                <Field id="ccc-cogs" label="Cost of goods sold" prefix="$" value={cogs} onChange={setCogs} />
              </FieldGrid>
              <FieldGrid>
                <Field id="ccc-ar-open" label="Receivables, opening" prefix="$" value={arOpening} onChange={setArOpening} />
                <Field id="ccc-ar-end" label="Receivables, closing" prefix="$" value={arEnding} onChange={setArEnding} />
              </FieldGrid>
              <FieldGrid>
                <Field id="ccc-inv-open" label="Inventory, opening" prefix="$" value={invOpening} onChange={setInvOpening} />
                <Field id="ccc-inv-end" label="Inventory, closing" prefix="$" value={invEnding} onChange={setInvEnding} />
              </FieldGrid>
              <FieldGrid>
                <Field id="ccc-ap-open" label="Payables, opening" prefix="$" value={apOpening} onChange={setApOpening} />
                <Field id="ccc-ap-end" label="Payables, closing" prefix="$" value={apEnding} onChange={setApEnding} />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="ccc-days"
                  label="Days in period"
                  value={daysInPeriod}
                  onChange={setDaysInPeriod}
                  hint="365 for a year, 91 or 92 for a quarter."
                />
                <Field
                  id="ccc-rate"
                  label="Your borrowing rate"
                  suffix="%"
                  value={borrowingRate}
                  onChange={setBorrowingRate}
                  hint="What the money the cycle ties up costs you per year."
                />
              </FieldGrid>
              <Field
                id="ccc-improve"
                label="Days of improvement to model"
                suffix="days"
                value={improvementDays}
                onChange={setImprovementDays}
                hint="Applied to each component in turn in the table on the right."
              />
            </div>
          )}

          {mode === "seasonal" && (
            <div className="space-y-4">
              <Field
                id="ccc-cb-ar"
                label="Receivables balance to explain"
                prefix="$"
                value={cbReceivables}
                onChange={setCbReceivables}
                hint="Usually the closing balance on the same date as the ratio above."
              />
              <FieldGrid>
                <Field id="ccc-m1-sales" label="Most recent month, credit sales" prefix="$" value={m1Sales} onChange={setM1Sales} />
                <Field id="ccc-m1-days" label="Days in that month" value={m1Days} onChange={setM1Days} />
              </FieldGrid>
              <FieldGrid>
                <Field id="ccc-m2-sales" label="One month back, credit sales" prefix="$" value={m2Sales} onChange={setM2Sales} />
                <Field id="ccc-m2-days" label="Days in that month" value={m2Days} onChange={setM2Days} />
              </FieldGrid>
              <FieldGrid>
                <Field id="ccc-m3-sales" label="Two months back, credit sales" prefix="$" value={m3Sales} onChange={setM3Sales} />
                <Field id="ccc-m3-days" label="Days in that month" value={m3Days} onChange={setM3Days} />
              </FieldGrid>
              <p className="text-micro text-muted-foreground">
                Countback retires the balance against the months that actually built it, newest first, instead of
                spreading it over an average sales rate. Feed it your real month-by-month numbers, oldest last.
              </p>
            </div>
          )}

          {mode === "settlement" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="ccc-rev" label="Annual revenue" prefix="$" value={annualRevenue} onChange={setAnnualRevenue} />
                <Field
                  id="ccc-cardshare"
                  label="Share taken by card"
                  suffix="%"
                  value={cardShare}
                  onChange={setCardShare}
                  hint="The rest is invoiced on terms."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="ccc-settle"
                  label="Payout time today"
                  suffix="days"
                  value={settleDays}
                  onChange={setSettleDays}
                  hint="Sale to money in your bank account."
                />
                <Field
                  id="ccc-settle-fast"
                  label="Payout time you could get"
                  suffix="days"
                  value={settleFast}
                  onChange={setSettleFast}
                />
              </FieldGrid>
              <Field
                id="ccc-terms"
                label="Days to collect an invoice"
                suffix="days"
                value={invoiceDays}
                onChange={setInvoiceDays}
                hint="Your terms plus however late customers actually pay."
              />
              <FieldGrid>
                <Field
                  id="ccc-reserve"
                  label="Rolling reserve"
                  suffix="%"
                  value={reservePct}
                  onChange={setReservePct}
                  hint="Percent of card volume withheld. Zero if you have none."
                />
                <Field id="ccc-reserve-hold" label="Reserve held for" suffix="days" value={reserveHold} onChange={setReserveHold} />
              </FieldGrid>
              <p className="text-micro text-muted-foreground">
                Until the payout lands, that sale is just a promise from your processor, no different from an invoice
                sitting with a customer. Its payout clock is part of your DSO whether you count it or not.
              </p>
            </div>
          )}
        </div>
      }
      results={
        mode === "cycle" ? (
          <div>
            <Headline
              label="Cash conversion cycle"
              value={days1(cycle.chosen.ccc)}
              sub={`${cycle.chosen.dso.toFixed(1)} + ${cycle.chosen.dio.toFixed(1)} - ${cycle.chosen.dpo.toFixed(1)}, on the ${
                convention === "ending" ? "ending" : "average"
              } balance convention.`}
            />

            <div className="mt-5">
              <ResultRow label="Days sales outstanding" value={days1(cycle.chosen.dso)} note={`Receivables ${money0(cycle.chosen.receivablesBalance)}`} />
              <ResultRow label="Days inventory outstanding" value={days1(cycle.chosen.dio)} note={`Inventory ${money0(cycle.chosen.inventoryBalance)}`} />
              <ResultRow label="Days payable outstanding" value={days1(cycle.chosen.dpo)} note="On cost of goods sold" />
              <ResultRow
                label="Days payable outstanding"
                value={days1(cycle.chosen.dpoOnPurchases)}
                note={`On purchases of ${money0(cycle.purchases)}, the stricter denominator`}
              />
              <ResultRow label="Cash conversion cycle" value={days1(cycle.chosen.ccc)} emphasis />
              <ResultRow
                label="Working capital in the cycle"
                value={money0(cycle.chosen.workingCapitalInvested)}
                note="Receivables plus inventory less payables"
              />
              <ResultRow
                label="Cost to fund it for a year"
                value={money(cycle.annualFinancingCost)}
                note={`At ${ratePct.toFixed(2)}%, or ${money(cycle.dailyFinancingCost)} a day`}
              />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">
                What {improved.toFixed(0)} days is worth
              </p>
              <div className="mt-2">
                <MiniTable
                  columns={["Improvement", "Cash released", "Financing saved"]}
                  rows={[
                    [`Collect ${improved.toFixed(0)} days sooner`, money0(cycle.improvement.dsoCash), money(cycle.improvement.dsoFinancing)],
                    [`Hold ${improved.toFixed(0)} days less stock`, money0(cycle.improvement.dioCash), money(cycle.improvement.dioFinancing)],
                    [`Pay ${improved.toFixed(0)} days later`, money0(cycle.improvement.dpoCash), money(cycle.improvement.dpoFinancing)],
                    ["All three together", money0(cycle.improvement.totalCash), money(cycle.improvement.totalFinancing)],
                  ]}
                />
              </div>
              <p className="mt-2 text-micro text-muted-foreground">
                A day of DSO is worth a day of credit sales, {money(cycle.salesPerDay)}. A day of inventory or payables
                is worth a day of cost of goods sold, {money(cycle.cogsPerDay)}. Valuing all three at revenue overstates
                the last two by your gross margin.
              </p>
            </div>

            <Callout tone={Math.abs(cycle.conventionGapDays) >= 1 ? "warn" : "neutral"}>
              The convention moves the answer. On these figures the average balance gives{" "}
              <strong className="text-foreground">{days2(cycle.average.ccc)}</strong> and the ending balance gives{" "}
              <strong className="text-foreground">{days2(cycle.ending.ccc)}</strong>, a spread of{" "}
              {days2(Math.abs(cycle.conventionGapDays))}. Neither is wrong. Pick one, write down which, and never
              compare a number computed one way against a number computed the other.
            </Callout>

            <Caveat>
              DSO, DIO, DPO and the cash conversion cycle are analyst ratios, not accounting measures. No US accounting
              standard defines them, which is why two people can compute different figures from the same statements and
              both be right. If your sales are seasonal, the Seasonal DSO tab is the number to trust.
            </Caveat>
          </div>
        ) : mode === "seasonal" ? (
          <div>
            <Headline
              label="Countback DSO"
              value={days1(countback.countbackDso)}
              sub={`${money0(countback.windowSales)} of credit sales across the ${countback.windowDays.toFixed(0)} days supplied.`}
            />

            <div className="mt-5">
              <ResultRow label="Countback DSO" value={days1(countback.countbackDso)} emphasis />
              <ResultRow
                label="Simple formula, same window"
                value={days1(countback.simpleDso)}
                note="Receivables divided by average daily sales"
              />
              <ResultRow
                label="Difference"
                value={days1(countback.gapDays)}
                note={countback.gapDays >= 0 ? "The simple formula flatters you" : "The simple formula overstates your DSO"}
              />
              <ResultRow label="Worth, at this window's sales rate" value={money0(Math.abs(countback.gapCash))} />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">How the balance was retired</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Month", "Credit sales", "Retired", "Days counted"]}
                  rows={countback.months.map((m, i) => [
                    i === 0 ? "Most recent" : i === 1 ? "One month back" : "Two months back",
                    money0(m.creditSales),
                    money0(m.consumed),
                    m.daysCounted.toFixed(1),
                  ])}
                />
              </div>
            </div>

            {countback.exhausted ? (
              <Callout tone="warn">
                The receivables balance outran every month you entered, leaving {money0(countback.unexplained)}{" "}
                unexplained. The figure above extrapolates that tail at the average daily sales rate of the window, so
                it is an estimate rather than a countback. Add more months of sales history.
              </Callout>
            ) : (
              <Callout tone={Math.abs(countback.gapDays) >= 5 ? "warn" : "neutral"}>
                {countback.gapDays >= 0
                  ? "Sales fell into the period end, so the simple formula divided a balance built by big months by a smaller average and reported a shorter DSO than you actually have."
                  : "Sales rose into the period end, so the simple formula divided a mostly recent balance by a larger average and reported a longer DSO than you actually have."}{" "}
                The countback method never averages. It retires the balance against the months that created it.
              </Callout>
            )}

            <Caveat>
              Countback is only as good as the sales history you feed it, and it needs enough months to absorb the whole
              balance. Three months covers most businesses; a long dated receivable will exhaust the window and say so.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Cash released by a faster payout"
              value={money(settlement.cashReleased)}
              sub={`Moving ${num(settleDays).toFixed(0)} day settlement to ${num(settleFast).toFixed(
                0,
              )} days on ${money0(settlement.cardRevenue)} of card volume.`}
            />

            <div className="mt-5">
              <ResultRow label="Card revenue per day" value={money(settlement.cardRevenuePerDay)} />
              <ResultRow
                label="Card money in flight today"
                value={money(settlement.settlementFloat)}
                note="Sitting between the sale and the payout"
              />
              <ResultRow
                label="Held in rolling reserve"
                value={money(settlement.reserveBalance)}
                note={`${settlement.reserveDragDays.toFixed(1)} days of card revenue at steady state`}
              />
              <ResultRow label="Cash released, once" value={money(settlement.cashReleased)} emphasis />
              <ResultRow
                label="Annual financing saved"
                value={money(settlement.annualFinancingSaving)}
                note={`At ${ratePct.toFixed(2)}%`}
              />
              <ResultRow
                label="DSO your terms and payouts imply"
                value={days1(settlement.blendedDso)}
                note={`Falls to ${settlement.improvedBlendedDso.toFixed(1)} on the faster payout`}
              />
            </div>

            {settlement.collectionsGapDays !== null && settlement.collectionsGapCash !== null && (
              <Callout tone={settlement.collectionsGapDays > 10 ? "warn" : "neutral"}>
                Your balance sheet says {days1(cycle.chosen.dso)} of DSO. Your terms and your payout schedule only
                explain {days1(settlement.blendedDso)} of it. The remaining{" "}
                <strong className="text-foreground">{days1(settlement.collectionsGapDays)}</strong>, worth about{" "}
                {money0(Math.abs(settlement.collectionsGapCash))}, is collections performance: invoices sitting past
                terms, disputes, and work delivered but not yet billed. That is usually the cheapest part of the cycle
                to fix, because it needs no supplier concession and no new processor.
              </Callout>
            )}

            <Caveat>
              Payout days here are calendar days from the sale to cleared funds. Most US processors quote business days,
              which is longer in practice because weekends and Federal Reserve holidays do not settle. A reserve is the
              bigger lever than a payout schedule: at ten percent held 180 days a reserve holds eighteen days of card
              revenue, against the two or three days a faster payout returns.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default CashConversionCycleCalculator;
