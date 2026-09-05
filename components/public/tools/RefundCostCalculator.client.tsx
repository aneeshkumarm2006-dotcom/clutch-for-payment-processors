"use client";

import * as React from "react";
import {
  REFUND_CUSTOM_ID,
  REFUND_DEFAULTS,
  REFUND_FEE_POLICIES,
  REFUND_SENSITIVITY_LADDER,
} from "@/lib/tools-data/refunds";
import { refundCost, refundRateLadder, singleRefund } from "@/lib/calc/refund";
import {
  CalcShell,
  Callout,
  Caveat,
  CheckboxRow,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ModeTabs,
  Pill,
  ResultRow,
  SelectField,
  Verdict,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * What refunds cost, in fees and in effective rate.
 *
 * The gap this exploits: every page ranking for the refund fee query answers
 * one processor, in a sentence, and stops. None of them prices the consequence,
 * which is that a merchant pays processing on volume that produced no revenue,
 * so the rate on the money actually kept is higher than the rate on the
 * statement. On the defaults here that is 4.01 percent against a 2.9 percent
 * headline.
 *
 * The processor select sets policy FLAGS, not rates. Whether the percentage and
 * the fixed fee come back is a published policy with a quote and a date behind
 * it in `lib/tools-data/refunds.ts`; the rate a given merchant pays is theirs to
 * type in. Keeping the two apart is what lets an unverified row (Adyen) render
 * as unverified instead of quietly pricing something nobody checked.
 *
 * Narrow imports only: `@/lib/tools-data/refunds`, never the barrel, and never
 * `@/lib/tools`. One route serves every calculator, so anything imported here
 * ships to all of them.
 */
export function RefundCostCalculator() {
  const [mode, setMode] = React.useState<"year" | "one">("year");

  const [slug, setSlug] = React.useState(REFUND_DEFAULTS.processorSlug);
  const [volume, setVolume] = React.useState(String(REFUND_DEFAULTS.monthlyVolume));
  const [transactions, setTransactions] = React.useState(String(REFUND_DEFAULTS.monthlyTransactions));
  const [returnRate, setReturnRate] = React.useState(String(REFUND_DEFAULTS.returnRatePct));
  const [rate, setRate] = React.useState(String(REFUND_DEFAULTS.ratePct));
  const [fixed, setFixed] = React.useState(String(REFUND_DEFAULTS.fixedFee));
  const [restocking, setRestocking] = React.useState(String(REFUND_DEFAULTS.restockingPerReturn));
  const [returnShipping, setReturnShipping] = React.useState(String(REFUND_DEFAULTS.returnShippingPerReturn));

  const [orderValue, setOrderValue] = React.useState(String(REFUND_DEFAULTS.orderValue));
  const [refundAmount, setRefundAmount] = React.useState(String(REFUND_DEFAULTS.refundAmount));

  // Custom processor: the user owns the three switches.
  const [customPercent, setCustomPercent] = React.useState(false);
  const [customFixed, setCustomFixed] = React.useState(false);
  const [customRefundFee, setCustomRefundFee] = React.useState("0");

  const profile = REFUND_FEE_POLICIES.find((p) => p.slug === slug);
  const policy = profile
    ? { percentReturned: profile.percentReturned, fixedReturned: profile.fixedReturned, refundFee: profile.refundFee }
    : { percentReturned: customPercent, fixedReturned: customFixed, refundFee: Math.max(0, num(customRefundFee)) };

  const shared = {
    ratePct: num(rate),
    fixedFee: num(fixed),
    policy,
  };

  const year = refundCost({
    monthlyVolume: num(volume),
    monthlyTransactions: num(transactions),
    returnRatePct: num(returnRate),
    restockingPerReturn: num(restocking),
    returnShippingPerReturn: num(returnShipping),
    ...shared,
  });

  const ladder = refundRateLadder(
    {
      monthlyVolume: num(volume),
      monthlyTransactions: num(transactions),
      returnRatePct: num(returnRate),
      restockingPerReturn: 0,
      returnShippingPerReturn: 0,
      ...shared,
    },
    REFUND_SENSITIVITY_LADDER,
  );

  const one = singleRefund({
    orderValue: num(orderValue),
    refundAmount: num(refundAmount),
    ...shared,
  });

  const nothingComesBack = !policy.percentReturned && !policy.fixedReturned;
  const unverified = profile?.status === "unverified";

  const policyPills = (
    <div className="mt-3 flex flex-wrap gap-2">
      <Pill tone={policy.percentReturned ? "good" : "bad"}>
        Percentage {policy.percentReturned ? "returned" : "kept by the processor"}
      </Pill>
      <Pill tone={policy.fixedReturned ? "good" : "bad"}>
        Fixed fee {policy.fixedReturned ? "returned" : "kept by the processor"}
      </Pill>
      <Pill tone={policy.refundFee > 0 ? "warn" : "good"}>
        {policy.refundFee > 0 ? `${money(policy.refundFee)} to issue the refund` : "No fee to issue the refund"}
      </Pill>
      {unverified && <Pill tone="neutral">Unverified</Pill>}
    </div>
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "year" | "one")}
            options={[
              { value: "year", label: "A year of refunds" },
              { value: "one", label: "One refund" },
            ]}
          />

          <div>
            <SelectField
              id="rfc-processor"
              label="Processor"
              value={slug}
              onChange={setSlug}
              hint="Sets whether the fee comes back. It does not set your rate: enter that below."
              options={[
                ...REFUND_FEE_POLICIES.map((p) => ({
                  value: p.slug,
                  label: p.status === "unverified" ? `${p.name} (policy not published)` : p.name,
                })),
                { value: REFUND_CUSTOM_ID, label: "Another processor, I will set the policy" },
              ]}
            />
            {policyPills}
          </div>

          {!profile && (
            <div className="space-y-3 rounded border border-border-strong bg-muted px-4 py-3">
              <CheckboxRow
                checked={customPercent}
                onChange={() => setCustomPercent((v) => !v)}
                label="My processor returns the percentage on a refund"
                hint="Prorated on the amount you hand back."
              />
              <CheckboxRow
                checked={customFixed}
                onChange={() => setCustomFixed((v) => !v)}
                label="My processor returns the fixed per-transaction fee"
                hint="Modelled on full refunds only. A flat fee has no natural proration."
              />
              <Field
                id="rfc-customfee"
                label="Fee to issue a refund"
                prefix="$"
                value={customRefundFee}
                onChange={setCustomRefundFee}
              />
            </div>
          )}

          <FieldGrid>
            <Field id="rfc-rate" label="Your rate" suffix="%" value={rate} onChange={setRate} />
            <Field id="rfc-fixed" label="Fixed fee per transaction" prefix="$" value={fixed} onChange={setFixed} />
          </FieldGrid>

          {mode === "year" ? (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="rfc-volume"
                  label="Monthly card volume"
                  prefix="$"
                  value={volume}
                  onChange={setVolume}
                  hint="Gross sales, before refunds."
                />
                <Field
                  id="rfc-txns"
                  label="Orders per month"
                  value={transactions}
                  onChange={setTransactions}
                  hint="Average order value is derived from these two."
                />
              </FieldGrid>
              <Field
                id="rfc-returnrate"
                label="Return rate"
                suffix="%"
                value={returnRate}
                onChange={setReturnRate}
                hint="Share of orders refunded. US online retail averaged 19.3% in 2025."
              />
              <FieldGrid>
                <Field
                  id="rfc-restock"
                  label="Restocking cost per return"
                  prefix="$"
                  value={restocking}
                  onChange={setRestocking}
                  hint="Inspect, repack, put back on the shelf. Leave at zero if you do not track it."
                />
                <Field
                  id="rfc-shipping"
                  label="Return shipping per return"
                  prefix="$"
                  value={returnShipping}
                  onChange={setReturnShipping}
                  hint="What you pay, not what the customer pays."
                />
              </FieldGrid>
            </div>
          ) : (
            <FieldGrid>
              <Field id="rfc-order" label="Original order value" prefix="$" value={orderValue} onChange={setOrderValue} />
              <Field
                id="rfc-refund"
                label="Amount refunded"
                prefix="$"
                value={refundAmount}
                onChange={setRefundAmount}
                hint="Lower it for a partial refund."
              />
            </FieldGrid>
          )}
        </div>
      }
      results={
        mode === "year" ? (
          <div>
            <Headline
              label="Effective rate on the revenue you keep"
              value={pct(year.trueEffectiveRate)}
              sub={`Your statement looks like ${pct(year.nominalEffectiveRate)}. The gap is ${pct(year.rateGapPoints)} of margin that refunded orders took with them.`}
            />

            <div className="mt-5">
              <ResultRow label="Average order value" value={money(year.averageOrderValue)} note="Volume divided by orders" />
              <ResultRow label="Fee on one order" value={money(year.feePerOrder)} />
              <ResultRow
                label="Refunded orders a month"
                value={year.refundedOrdersPerMonth.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                note={`${money0(year.refundedVolumeMonthly)} of sales handed back`}
              />
              <ResultRow
                label="Fee left behind by one refund"
                value={money(year.retainedFeePerRefund)}
                note={nothingComesBack ? "The whole original fee, plus any refund fee" : "After what your processor returns"}
              />
              <ResultRow label="Fees on refunded orders, a month" value={money(year.feeOnRefundedMonthly)} />
              <ResultRow label="Fees on refunded orders, a year" value={money(year.feeOnRefundedAnnual)} emphasis />
              {year.handlingCostAnnual > 0 && (
                <ResultRow
                  label="Restocking and return shipping, a year"
                  value={money(year.handlingCostAnnual)}
                  note="Not a processing fee, so it stays out of the rate above"
                />
              )}
              {year.handlingCostAnnual > 0 && (
                <ResultRow label="Total cost of refunds, a year" value={money(year.totalRefundCostAnnual)} emphasis />
              )}
            </div>

            <Verdict effectiveRate={year.trueEffectiveRate} />
            {/* The bands score a blended monthly effective rate against pricing
                models. On this page part of the excess is the return rate rather
                than the deal, so the band is qualified rather than left to
                imply the wrong fix. */}
            <p className="mt-2 text-micro text-muted-foreground">
              That band scores the blended rate, {pct(year.trueEffectiveRate)}. Of it, {pct(year.nominalEffectiveRate)}{" "}
              is your pricing and {pct(year.rateGapPoints)} is your return rate, and only the first of those is a
              conversation with a processor.
            </p>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">What your rate becomes as returns rise</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Return rate", "Real rate", "Fees on refunds a year"]}
                  align={["left", "right", "right"]}
                  rows={ladder.map((row) => [
                    <span key={row.returnRatePct} className="text-foreground">
                      {pct(row.returnRatePct, 0)}
                    </span>,
                    pct(row.trueEffectiveRate),
                    money0(row.feeOnRefundedAnnual),
                  ])}
                />
              </div>
            </div>

            {nothingComesBack && year.annualSavingIfPercentReturned > 0 && (
              <Callout tone="warn">
                Your processor keeps the percentage on every refunded order. If it returned that portion, the same year
                of refunds would cost {money(year.feeOnRefundedAnnualIfPercentReturned)} instead of{" "}
                {money(year.feeOnRefundedAnnual)}, a difference of{" "}
                <strong className="text-foreground">{money(year.annualSavingIfPercentReturned)}</strong>. That is not a
                negotiation you can win, so the lever is the return rate itself.
              </Callout>
            )}

            {unverified && (
              <Callout tone="warn">
                {profile?.name} does not publish how it treats fees on a refund, so this row is marked unverified and is
                priced on the industry default of nothing coming back. Check your own agreement before acting on the
                figure above.
              </Callout>
            )}

            {profile && profile.quote && (
              <Caveat>
                {profile.name}: &ldquo;{profile.quote}&rdquo; Source: {profile.source}.
              </Caveat>
            )}

            <Caveat>
              Volume is held flat across the year, and the model prices the average order and multiplies rather than
              pricing every order separately, so a real statement will differ by rounding on a mixed basket. Chargebacks,
              which cost far more than refunds, are not included here.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label={one.isPartial ? "Cost of this partial refund" : "Cost of this refund"}
              value={money(one.feeRetained)}
              sub={
                one.effectiveRateOnKept === null
                  ? `You returned ${money(one.refundAmount)} and kept none of the sale, so this fee bought nothing.`
                  : `You kept ${money(one.revenueKept)} of the sale and paid ${money(one.feeRetained)} to do it, an effective ${pct(one.effectiveRateOnKept)}.`
              }
            />

            <div className="mt-5">
              <ResultRow label="Fee on the original sale" value={money(one.originalFee)} />
              <ResultRow
                label="Percentage portion"
                value={money(one.percentPortion)}
                note={policy.percentReturned ? `${money(one.percentReturnedAmount)} returned` : "Not returned"}
              />
              <ResultRow
                label="Fixed portion"
                value={money(one.fixedPortion)}
                note={
                  policy.fixedReturned
                    ? one.isPartial
                      ? "Not returned on a partial refund"
                      : `${money(one.fixedReturnedAmount)} returned`
                    : "Not returned"
                }
              />
              {policy.refundFee > 0 && <ResultRow label="Fee to issue the refund" value={money(one.refundFeeCharged)} />}
              <ResultRow label="Fee you are left carrying" value={money(one.feeRetained)} emphasis />
              <ResultRow
                label="As a share of what you refunded"
                value={pct(one.costAsPctOfRefund)}
                note={`On ${money(one.refundAmount)} handed back`}
              />
              {one.effectiveRateOnKept !== null && (
                <ResultRow
                  label="As a rate on the revenue you kept"
                  value={pct(one.effectiveRateOnKept)}
                  note="This is what a partial refund really costs"
                  emphasis
                />
              )}
            </div>

            <Callout tone={one.isPartial ? "warn" : "neutral"}>
              {one.isPartial ? (
                <>
                  A partial refund is where the fixed fee does the damage. You still paid it once, in full, on the whole
                  order, and here you are keeping only {money(one.revenueKept)} to carry it. Refund enough of an order
                  and the fee on the sliver you keep passes any rate you could have negotiated.
                </>
              ) : (
                <>
                  Reversing the payment before it settles is the only free version of this. A void or a cancelled
                  authorization costs nothing on most processors, while the same reversal a day later costs the whole{" "}
                  {money(one.feeRetained)}. If a lot of your refunds happen within hours of checkout, authorize and
                  capture separately.
                </>
              )}
            </Callout>

            {profile && profile.quote && (
              <Caveat>
                {profile.name}: &ldquo;{profile.quote}&rdquo; Source: {profile.source}.
              </Caveat>
            )}

            <Caveat>
              Money is computed in integer cents and the percentage is rounded to the cent per transaction, which is how
              a processor prices it. Sales tax, marketplace commissions and shipping you already paid out are not
              modelled.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default RefundCostCalculator;
