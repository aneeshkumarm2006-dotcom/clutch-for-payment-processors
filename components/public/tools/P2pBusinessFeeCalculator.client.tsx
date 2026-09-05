"use client";

import * as React from "react";
import { P2P_DEFAULTS, P2P_INSTANT_TRANSFER, P2P_SERVICES } from "@/lib/tools-data/p2p";
import {
  compareMonthly,
  comparePayout,
  comparePerPayment,
  feeCrossover,
  type P2pOption,
} from "@/lib/calc/p2p";
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
  Verdict,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Venmo, Cash App and Zelle, priced side by side against a card rate.
 *
 * The gap this exploits: nearly every page ranking for "venmo business fees" or
 * "cash app business fees" is a consumer finance blog that treats the three as
 * one product, prices the percentage and stops. Two consequences, both visible
 * here. First, the fixed component is dropped, so a 120 payment month is
 * understated by $17.85 on Cash App alone. Second, Zelle comes out cheapest,
 * which is only true if you price nothing but the fee: it has no purchase
 * protection, no dispute mechanism, no Form 1099-K, and no guarantee your bank
 * offers it on a business account at all. The dispute column is therefore part
 * of the result, not a footnote under it.
 *
 * `Verdict` scores the CHEAPEST OPTION THAT COMES WITH A DISPUTE RIGHT, not the
 * cheapest row. Scoring Zelle's zero percent as "Excellent" would be the exact
 * error this page exists to correct, and the bands are calibrated on a blended
 * monthly effective rate, which is what monthly mode produces.
 *
 * Data is imported from the narrow module, never the `@/lib/tools-data` barrel:
 * `/tools/[tool]` is one route serving every calculator, so a barrel import
 * ships every tool's dataset to every tool page.
 */

const OPTIONS: P2pOption[] = P2P_SERVICES.map((s) => ({
  id: s.id,
  label: s.label,
  kind: s.kind,
  seller: s.seller,
  payout: P2P_INSTANT_TRANSFER.find((i) => i.serviceId === s.id)?.fee ?? null,
  buyerDisputeRight: s.buyerDisputeRight,
  disputeFee: s.disputeFee,
}));

const shortLabel = (id: string, label: string): string =>
  id === "card-standard" ? "Card, 2.9% + $0.30" : label;

const disputePill = (id: string, has: boolean) =>
  has ? (
    <Pill key={`${id}-d`} tone="good">
      Buyer can dispute
    </Pill>
  ) : (
    <Pill key={`${id}-d`} tone="bad">
      No dispute route
    </Pill>
  );

export function P2pBusinessFeeCalculator() {
  const [mode, setMode] = React.useState<"monthly" | "payment" | "payout">("monthly");

  const [volume, setVolume] = React.useState(String(P2P_DEFAULTS.monthlyVolume));
  const [transactions, setTransactions] = React.useState(String(P2P_DEFAULTS.transactions));
  const [instant, setInstant] = React.useState(P2P_DEFAULTS.instantPayout);
  const [payouts, setPayouts] = React.useState(String(P2P_DEFAULTS.payoutsPerMonth));

  const [payment, setPayment] = React.useState(String(P2P_DEFAULTS.singlePayment));
  const [payoutAmount, setPayoutAmount] = React.useState(String(P2P_DEFAULTS.payoutAmount));

  const monthly = compareMonthly(OPTIONS, {
    monthlyVolume: Math.max(0, num(volume)),
    transactions: Math.max(0, num(transactions)),
    instantPayout: instant,
    payoutsPerMonth: Math.max(1, num(payouts)),
  });

  const perPayment = comparePerPayment(OPTIONS, Math.max(0, num(payment)));
  const payoutRows = comparePayout(OPTIONS, Math.max(0, num(payoutAmount)));

  // The cheapest row that actually gives the buyer a way to dispute. This is the
  // answer the page is for: free with no recourse is not the same product.
  const withRecourse = monthly.filter((r) => r.buyerDisputeRight);
  const bestWithRecourse = withRecourse.reduce(
    (a, b) => (b.totalHigh < a.totalHigh ? b : a),
    withRecourse[0] ?? monthly[0]!,
  );

  const card = monthly.find((r) => r.id === "card-standard");
  const zelle = monthly.find((r) => r.id === "zelle");
  const savingVsCard = card ? card.totalHigh - bestWithRecourse.totalHigh : 0;
  const zelleSaving = zelle ? bestWithRecourse.totalHigh - zelle.totalHigh : 0;

  // Where the Venmo business profile stops being beaten by the personal profile
  // goods and services rate. Computed rather than typed, so it cannot go stale.
  const venmoBiz = P2P_SERVICES.find((s) => s.id === "venmo-business");
  const venmoGs = P2P_SERVICES.find((s) => s.id === "venmo-personal-gs");
  const cashApp = P2P_SERVICES.find((s) => s.id === "cashapp-business");
  const bizCrossover = venmoBiz && venmoGs ? feeCrossover(venmoBiz.seller, venmoGs.seller) : null;
  const cashCrossover = cashApp && venmoGs ? feeCrossover(cashApp.seller, venmoGs.seller) : null;

  const venmoCapped = payoutRows.find((r) => r.id === "venmo-business")?.cappedAtHigh ?? false;

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "monthly" | "payment" | "payout")}
            options={[
              { value: "monthly", label: "A month of sales" },
              { value: "payment", label: "One payment" },
              { value: "payout", label: "Cashing out" },
            ]}
          />

          {mode === "monthly" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="p2p-vol"
                  label="Monthly sales through the app"
                  prefix="$"
                  value={volume}
                  onChange={setVolume}
                />
                <Field
                  id="p2p-txn"
                  label="Payments a month"
                  value={transactions}
                  onChange={setTransactions}
                  inputMode="numeric"
                  hint="The count matters: two of these charge a fixed fee per payment."
                />
              </FieldGrid>
              <CheckboxRow
                checked={instant}
                onChange={() => setInstant((v) => !v)}
                label="I move the balance out instantly rather than waiting"
                hint="Standard transfers are free and take 1 to 3 business days. Instant costs a percentage of what you move."
              />
              {instant && (
                <Field
                  id="p2p-payouts"
                  label="Instant transfers a month"
                  value={payouts}
                  onChange={setPayouts}
                  inputMode="numeric"
                  hint="More, smaller withdrawals cost more, because the fee has a minimum."
                />
              )}
            </div>
          )}

          {mode === "payment" && (
            <div className="space-y-4">
              <Field
                id="p2p-single"
                label="Payment amount"
                prefix="$"
                value={payment}
                onChange={setPayment}
                hint="What one customer sends you."
              />
              <Callout>
                {bizCrossover && cashCrossover ? (
                  <>
                    Below {money(bizCrossover)} a Venmo personal profile goods and services payment at 2.99% costs
                    less than a business profile at 1.9% plus $0.10, because the fixed fee dominates a tiny ticket.
                    Above it the business profile wins, and the gap keeps widening. Cash App&rsquo;s 2.6% plus $0.15
                    passes the same 2.99% rate at {money(cashCrossover)}.
                  </>
                ) : (
                  <>The fixed fee on each payment is what decides small tickets, not the headline percentage.</>
                )}
              </Callout>
            </div>
          )}

          {mode === "payout" && (
            <div className="space-y-4">
              <Field
                id="p2p-payout"
                label="Amount you are moving out"
                prefix="$"
                value={payoutAmount}
                onChange={setPayoutAmount}
                hint="One instant transfer or instant deposit."
              />
              <Callout tone={venmoCapped ? "good" : "neutral"}>
                Venmo caps its instant transfer fee at $25.00, so the fee stops rising above{" "}
                {money(25 / 0.0175)}. Cash App publishes a band rather than a rate, 0.5% to 2.5%, and says the
                actual figure is disclosed at the time of the transaction, so both ends are shown below.
              </Callout>
            </div>
          )}

          <p className="text-micro text-muted-foreground">
            Rates are each provider&rsquo;s own published US figures. Nothing here leaves your browser and no
            email address is asked for.
          </p>
        </div>
      }
      results={
        mode === "monthly" ? (
          <div>
            <Headline
              label={`Cheapest option that lets your buyer dispute: ${shortLabel(bestWithRecourse.id, bestWithRecourse.label)}`}
              value={money(bestWithRecourse.totalHigh)}
              sub={`${pct(bestWithRecourse.effectiveRateHigh)} of ${money0(Math.max(0, num(volume)))}, or ${money0(bestWithRecourse.annualTotalHigh)} a year. Average ticket ${money(bestWithRecourse.averageTicket)}.`}
            />

            <div className="mt-5">
              <MiniTable
                columns={["Service", "Per payment", "A month", "Recourse"]}
                align={["left", "right", "right", "left"]}
                rows={monthly.map((r) => [
                  <span key={r.id}>
                    <span className="text-foreground">{shortLabel(r.id, r.label)}</span>
                    <span className="block text-micro text-muted-foreground">
                      {pct(r.effectiveRateHigh)} effective
                      {r.effectiveRateLow !== r.effectiveRateHigh ? ` (from ${pct(r.effectiveRateLow)})` : ""}
                    </span>
                  </span>,
                  money(r.feePerPayment),
                  <span key={`${r.id}-m`}>
                    {money(r.totalHigh)}
                    {r.totalLow !== r.totalHigh && (
                      <span className="block text-micro text-muted-foreground">from {money(r.totalLow)}</span>
                    )}
                  </span>,
                  disputePill(r.id, r.buyerDisputeRight),
                ])}
              />
            </div>

            <div className="mt-5">
              <ResultRow
                label="Seller fee on those payments"
                value={money(bestWithRecourse.sellerFeeMonthly)}
                note={`${Math.round(Math.max(0, num(transactions)))} payments at ${money(bestWithRecourse.feePerPayment)} each`}
              />
              {instant && (
                <ResultRow
                  label="Instant transfer fees"
                  value={
                    bestWithRecourse.payoutFeeLow === bestWithRecourse.payoutFeeHigh
                      ? money(bestWithRecourse.payoutFeeHigh)
                      : `${money(bestWithRecourse.payoutFeeLow)} to ${money(bestWithRecourse.payoutFeeHigh)}`
                  }
                  note={`${Math.round(Math.max(1, num(payouts)))} withdrawals a month`}
                />
              )}
              <ResultRow label="Total cost of acceptance" value={money(bestWithRecourse.totalHigh)} emphasis />
              <ResultRow label="You keep" value={money(bestWithRecourse.netLow)} />
              <ResultRow
                label="Against standard card processing"
                value={savingVsCard >= 0 ? `${money(savingVsCard)} cheaper` : `${money(-savingVsCard)} more`}
                note="2.9% plus $0.30, the published US flat rate"
              />
            </div>

            <Verdict effectiveRate={bestWithRecourse.effectiveRateHigh} />

            <Callout tone="warn">
              Zelle would cost {money(zelle?.totalHigh ?? 0)} on the same month, saving{" "}
              <strong className="text-foreground">{money(zelleSaving)}</strong> against{" "}
              {shortLabel(bestWithRecourse.id, bestWithRecourse.label)}. It is not the same product. Zelle states
              that it does not offer purchase protection and that payments cannot be reversed, it reports nothing
              to the IRS, and whether you can use it on a business account is decided by your bank, not by Zelle.
            </Callout>

            <Caveat>
              Seller fees are applied per payment and rounded to the cent the way each provider rounds them, then
              multiplied by your payment count. Pricing a month as one percentage of total volume understates the
              bill by the fixed fee times every payment after the first, which on these inputs is{" "}
              {money(Math.max(0, (Math.max(0, num(transactions)) - 1) * 0.15))} on Cash App alone.
            </Caveat>
          </div>
        ) : mode === "payment" ? (
          <div>
            <Headline
              label={`What one ${money(Math.max(0, num(payment)))} payment costs`}
              value={money(perPayment.find((r) => r.id === "venmo-business")?.fee ?? 0)}
              sub="On a Venmo business profile. Every option is priced below."
            />

            <div className="mt-5">
              <MiniTable
                columns={["Service", "Fee", "You net", "Effective"]}
                rows={perPayment.map((r) => [
                  <span key={r.id}>
                    <span className="text-foreground">{shortLabel(r.id, r.label)}</span>
                    {!r.buyerDisputeRight && (
                      <span className="block text-micro text-muted-foreground">No dispute route either way</span>
                    )}
                  </span>,
                  money(r.fee),
                  money(r.net),
                  pct(r.effectiveRate),
                ])}
              />
            </div>

            <Callout>
              The effective rate on a single payment is almost never the headline rate, because two of these
              charge a fixed fee that does not scale. On this payment Venmo&rsquo;s business profile works out at{" "}
              {pct(perPayment.find((r) => r.id === "venmo-business")?.effectiveRate ?? 0)} against a headline
              1.9%, and Cash App at {pct(perPayment.find((r) => r.id === "cashapp-business")?.effectiveRate ?? 0)}{" "}
              against a headline 2.6%.
            </Callout>

            <Caveat>
              A single payment is not scored against the effective rate bands. Those bands describe a merchant&rsquo;s
              blended monthly rate, and judging one small payment against them would label a perfectly ordinary fee
              as high when what is really happening is the fixed fee.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label={`Cost to move ${money(Math.max(0, num(payoutAmount)))} out instantly`}
              value={money(payoutRows.find((r) => r.id === "venmo-business")?.feeHigh ?? 0)}
              sub="On Venmo. Standard transfers on all of these are free and take 1 to 3 business days."
            />

            <div className="mt-5">
              <MiniTable
                columns={["Service", "Instant fee", "Lands in your account"]}
                rows={payoutRows.map((r) => [
                  <span key={r.id}>
                    <span className="text-foreground">{shortLabel(r.id, r.label)}</span>
                    {r.cappedAtHigh && (
                      <span className="block text-micro text-muted-foreground">Published cap applied</span>
                    )}
                    {r.flooredAtLow && (
                      <span className="block text-micro text-muted-foreground">Published minimum applied</span>
                    )}
                  </span>,
                  r.applicable
                    ? r.feeLow === r.feeHigh
                      ? money(r.feeHigh)
                      : `${money(r.feeLow)} to ${money(r.feeHigh)}`
                    : "No payout step",
                  r.applicable ? (r.netLow === r.netHigh ? money(r.netLow) : `${money(r.netLow)} to ${money(r.netHigh)}`) : money(r.amount),
                ])}
              />
            </div>

            <Callout tone="warn">
              Taken twice a week, a {money(payoutRows.find((r) => r.id === "venmo-business")?.feeHigh ?? 0)} Venmo
              instant transfer is{" "}
              <strong className="text-foreground">
                {money0((payoutRows.find((r) => r.id === "venmo-business")?.feeHigh ?? 0) * 104)}
              </strong>{" "}
              a year, on money you had already paid a seller fee to receive. Waiting one to three business days
              costs nothing.
            </Callout>

            <Caveat>
              Zelle has no payout step at all, because there is no balance: the money lands in the bank account
              directly, usually within minutes. That is a genuine advantage, and it is the one Zelle advantage
              that does not come with a catch attached.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default P2pBusinessFeeCalculator;
