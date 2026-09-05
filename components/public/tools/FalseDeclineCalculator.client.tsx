"use client";

import * as React from "react";
import {
  DECLINE_CODE_GROUPS,
  FALSE_DECLINE_DEFAULTS,
} from "@/lib/tools-data/false-decline";
import { approvalPointLadder, falseDeclineCost, retryRecovery } from "@/lib/calc/false-decline";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ModeTabs,
  Pill,
  ResultRow,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * False declines: the cost, the approval rate it is worth, and which declines
 * the rules let you retry.
 *
 * The gap this exploits: every page ranking for the false decline query quotes
 * the same unsourced billion dollar industry figure and offers the merchant no
 * way to turn it into their own number. This one takes the merchant's own
 * volume and margin, and it does the thing none of them do, which is to put the
 * fraud the rules PREVENTED on the other side of the ledger and return a net
 * position. A page that only prints a scare number is not usable in the
 * argument the merchant actually has to have with whoever owns the rules.
 *
 * `Verdict` is deliberately absent. The bands score a blended monthly effective
 * PROCESSING rate and there is no processing rate on this page.
 *
 * Narrow imports only: `@/lib/tools-data/false-decline` and `@/lib/calc/*`,
 * never `@/lib/tools` and never the data barrel. One route serves every
 * calculator, so anything imported here ships to all of them.
 */
export function FalseDeclineCalculator() {
  const D = FALSE_DECLINE_DEFAULTS;
  const [mode, setMode] = React.useState<"cost" | "uplift" | "retry">("cost");

  const [attempts, setAttempts] = React.useState(String(D.monthlyAttempts));
  const [approval, setApproval] = React.useState(String(D.approvalRatePct));
  const [aov, setAov] = React.useState(String(D.averageOrderValue));
  const [margin, setMargin] = React.useState(String(D.grossMarginPct));
  const [falseShare, setFalseShare] = React.useState(String(D.falseDeclineSharePct));
  const [recovery, setRecovery] = React.useState(String(D.retryRecoverySharePct));
  const [walkAway, setWalkAway] = React.useState(String(D.walkAwaySharePct));
  const [ltv, setLtv] = React.useState(String(D.lifetimeGrossProfit));
  const [fraudShare, setFraudShare] = React.useState(String(D.fraudDeclineSharePct));
  const [cbFee, setCbFee] = React.useState(String(D.chargebackFee));
  const [softShare, setSoftShare] = React.useState(String(D.softDeclineSharePct));
  const [retrySuccess, setRetrySuccess] = React.useState(String(D.retrySuccessRatePct));

  const shared = {
    monthlyAttempts: num(attempts),
    approvalRatePct: num(approval),
    averageOrderValue: num(aov),
    grossMarginPct: num(margin),
  };

  const result = falseDeclineCost({
    ...shared,
    falseDeclineSharePct: num(falseShare),
    retryRecoverySharePct: num(recovery),
    walkAwaySharePct: num(walkAway),
    lifetimeGrossProfit: num(ltv),
    fraudDeclineSharePct: num(fraudShare),
    chargebackFee: num(cbFee),
  });

  const retries = retryRecovery({
    ...shared,
    softDeclineSharePct: num(softShare),
    retrySuccessRatePct: num(retrySuccess),
  });

  const ladder = approvalPointLadder(shared, [0.25, 0.5, 1, 2]);

  const orders = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  const rulesPay = result.netPositionMonthly >= 0;

  const volumeFields = (
    <>
      <FieldGrid>
        <Field
          id="fd-attempts"
          label="Order attempts a month"
          value={attempts}
          onChange={setAttempts}
          hint="Authorization attempts, approved and declined."
        />
        <Field
          id="fd-approval"
          label="Approval rate"
          suffix="%"
          value={approval}
          onChange={setApproval}
          hint="Approved divided by attempted, from your gateway."
        />
      </FieldGrid>
      <FieldGrid>
        <Field id="fd-aov" label="Average order value" prefix="$" value={aov} onChange={setAov} />
        <Field
          id="fd-margin"
          label="Gross margin"
          suffix="%"
          value={margin}
          onChange={setMargin}
          hint="A refused order costs you the margin, not the sale price."
        />
      </FieldGrid>
    </>
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "cost" | "uplift" | "retry")}
            options={[
              { value: "cost", label: "What do they cost?" },
              { value: "uplift", label: "What is a point worth?" },
              { value: "retry", label: "What can I retry?" },
            ]}
          />

          {mode === "cost" && (
            <div className="space-y-4">
              {volumeFields}
              <FieldGrid>
                <Field
                  id="fd-falseshare"
                  label="Declines that were good customers"
                  suffix="%"
                  value={falseShare}
                  onChange={setFalseShare}
                  hint="Share of your declines, not of your orders."
                />
                <Field
                  id="fd-recovery"
                  label="Of those, share who retry and succeed"
                  suffix="%"
                  value={recovery}
                  onChange={setRecovery}
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="fd-walk"
                  label="Of those, share who never come back"
                  suffix="%"
                  value={walkAway}
                  onChange={setWalkAway}
                />
                <Field
                  id="fd-ltv"
                  label="Future gross profit per lost customer"
                  prefix="$"
                  value={ltv}
                  onChange={setLtv}
                  hint="Beyond this order, so nothing is counted twice."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="fd-fraudshare"
                  label="Declines that were genuine fraud"
                  suffix="%"
                  value={fraudShare}
                  onChange={setFraudShare}
                  hint="What the rules actually stopped."
                />
                <Field
                  id="fd-cbfee"
                  label="Your dispute fee"
                  prefix="$"
                  value={cbFee}
                  onChange={setCbFee}
                />
              </FieldGrid>
            </div>
          )}

          {mode === "uplift" && (
            <div className="space-y-4">
              {volumeFields}
              <Callout>
                Approval rate is linear in orders, so a quarter of a point is a real figure rather than a
                rounding error. At {orders(num(attempts))} attempts a month, one point is{" "}
                <strong className="text-foreground">{orders(result.ordersPerApprovalPoint)} orders</strong>.
              </Callout>
            </div>
          )}

          {mode === "retry" && (
            <div className="space-y-4">
              {volumeFields}
              <FieldGrid>
                <Field
                  id="fd-softshare"
                  label="Declines that are soft"
                  suffix="%"
                  value={softShare}
                  onChange={setSoftShare}
                  hint="The ones the network rules let you reattempt."
                />
                <Field
                  id="fd-retrysuccess"
                  label="Retry success rate"
                  suffix="%"
                  value={retrySuccess}
                  onChange={setRetrySuccess}
                />
              </FieldGrid>
            </div>
          )}
        </div>
      }
      results={
        mode === "cost" ? (
          <div>
            <Headline
              label="False declines cost you"
              value={money0(result.totalDamageAnnual)}
              sub={`A year, in gross profit and lost customers. ${money(result.totalDamageMonthly)} a month.`}
            />

            <div className="mt-5">
              <ResultRow
                label="Declines a month"
                value={orders(result.declinesPerMonth)}
                note={`${orders(result.falseDeclinesPerMonth)} of them good customers`}
              />
              <ResultRow label="Orders lost for good" value={orders(result.lostOrders)} />
              <ResultRow
                label="Revenue lost"
                value={money(result.lostRevenueMonthly)}
                note={`${money0(result.lostRevenueAnnual)} a year`}
              />
              <ResultRow
                label="Gross profit lost"
                value={money(result.lostGrossProfitMonthly)}
                note="The part that hits the P and L"
              />
              <ResultRow
                label="Lifetime value walked out"
                value={money(result.lostLifetimeValueMonthly)}
                note={`${orders(result.walkAwayCustomers)} customers a month`}
              />
              <ResultRow label="Total damage a month" value={money(result.totalDamageMonthly)} emphasis />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Against the fraud it prevented</p>
              <div className="mt-2">
                <ResultRow
                  label="Fraudulent orders blocked"
                  value={orders(result.blockedFraudOrders)}
                  note={`Saving ${money(result.savedPerBlockedFraudOrder)} each in goods and dispute fees`}
                />
                <ResultRow
                  label="Fraud loss prevented"
                  value={money(result.fraudPreventedMonthly)}
                  note={`${money0(result.fraudPreventedAnnual)} a year`}
                />
                <ResultRow
                  label="Net position a month"
                  value={money(result.netPositionMonthly)}
                  emphasis
                />
              </div>
            </div>

            {result.walkAwayClamped && (
              <Callout tone="warn">
                The share who retry successfully and the share who never come back describe the same
                customers, and yours add up to more than all of them. The walk-away share has been capped at{" "}
                {pct(result.effectiveWalkAwaySharePct, 1)} so the two do not overlap.
              </Callout>
            )}

            <Callout tone={rulesPay ? "good" : "warn"}>
              {rulesPay ? (
                <>
                  Your rules are ahead by{" "}
                  <strong className="text-foreground">{money0(result.netPositionAnnual)}</strong> a year. They
                  stop paying for themselves once more than{" "}
                  <strong className="text-foreground">
                    {result.breakEvenFalseSharePct === null
                      ? "any"
                      : pct(result.breakEvenFalseSharePct, 1)}
                  </strong>{" "}
                  of your declines are good customers.
                </>
              ) : (
                <>
                  Your rules are behind by{" "}
                  <strong className="text-foreground">{money0(Math.abs(result.netPositionAnnual))}</strong> a
                  year: the good customers they refuse cost more than the fraud they catch. They would break
                  even if only{" "}
                  <strong className="text-foreground">
                    {result.breakEvenFalseSharePct === null
                      ? "none"
                      : pct(result.breakEvenFalseSharePct, 1)}
                  </strong>{" "}
                  of your declines were good customers, against the {pct(num(falseShare), 1)} you entered.
                </>
              )}
            </Callout>

            <Caveat>
              Fraud losses are visible: they arrive as chargebacks with a fee attached. False declines are not,
              because a customer who was refused and left never appears in any report you already run. That
              asymmetry, not the arithmetic, is why this is usually mispriced.
            </Caveat>
          </div>
        ) : mode === "uplift" ? (
          <div>
            <Headline
              label="One point of approval rate"
              value={money0(result.grossProfitPerApprovalPointAnnual)}
              sub={`A year in gross profit, on ${money0(result.revenuePerApprovalPointAnnual)} of extra revenue.`}
            />

            <div className="mt-5">
              <ResultRow
                label="Extra orders a month"
                value={orders(result.ordersPerApprovalPoint)}
                note="One percentage point of your attempts"
              />
              <ResultRow label="Extra revenue a month" value={money(result.revenuePerApprovalPointMonthly)} />
              <ResultRow
                label="Extra gross profit a month"
                value={money(result.grossProfitPerApprovalPointMonthly)}
                emphasis
              />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">What each uplift is worth</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Uplift", "Orders a month", "Revenue a year", "Gross profit a year"]}
                  rows={ladder.map((row) => [
                    <span key={row.points}>+{row.points} pts</span>,
                    orders(row.extraOrders),
                    money0(row.extraRevenueAnnual),
                    money0(row.extraGrossProfitAnnual),
                  ])}
                />
              </div>
            </div>

            <div className="mt-6">
              <ResultRow
                label="Headroom in your false declines"
                value={`${result.headroomPoints.toFixed(2)} pts`}
                note={`Approving every good customer would take you to ${pct(result.potentialApprovalRatePct, 2)}`}
              />
              <ResultRow
                label="Your loss, restated in points"
                value={`${result.damageInApprovalPoints.toFixed(2)} pts`}
                note="Total damage divided by what one point earns you"
              />
            </div>

            <Callout>
              This is the number to take into the room. A project that lifts approval by one point on{" "}
              {orders(num(attempts))} attempts a month is worth{" "}
              <strong className="text-foreground">{money0(result.grossProfitPerApprovalPointAnnual)}</strong> a
              year in gross profit. Most merchants have never seen that figure, which is why approval rate work
              loses budget arguments to projects with smaller numbers attached.
            </Callout>

            <Caveat>
              Linear in orders by construction: it assumes the orders you recover look like your average order.
              If your declines skew toward larger tickets, which they usually do, this understates the answer.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Recoverable by retrying"
              value={money0(retries.recoveredRevenueAnnual)}
              sub={`A year, from ${orders(retries.recoveredOrders)} recovered orders a month.`}
            />

            <div className="mt-5">
              <ResultRow label="Declines a month" value={orders(retries.declinesPerMonth)} />
              <ResultRow
                label="Soft, the rules permit a retry"
                value={orders(retries.retryableDeclines)}
                note="Up to 15 attempts in 30 days under Visa's rules"
              />
              <ResultRow
                label="Hard, retrying is a rules breach"
                value={orders(retries.hardDeclines)}
                note="Category 1 codes permit zero reattempts"
              />
              <ResultRow label="Orders recovered" value={orders(retries.recoveredOrders)} />
              <ResultRow
                label="Gross profit recovered"
                value={money(retries.recoveredGrossProfitMonthly)}
                emphasis
                note={`${money0(retries.recoveredGrossProfitAnnual)} a year`}
              />
              <ResultRow
                label="Approval rate after retries"
                value={pct(retries.newApprovalRatePct, 2)}
                note={`Up ${retries.approvalPointsGained.toFixed(2)} points`}
              />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Decline groups and what you may do</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Group", "Retry", "Good customers?", "Default share"]}
                  align={["left", "left", "left", "right"]}
                  maxHeight="340px"
                  rows={DECLINE_CODE_GROUPS.map((g) => [
                    <span key={g.id}>
                      <span className="text-foreground">{g.label}</span>
                      <span className="block text-micro text-muted-foreground">{g.exampleCodes}</span>
                    </span>,
                    <Pill
                      key={`${g.id}-r`}
                      tone={g.retry === "never" ? "bad" : g.retry === "fix-first" ? "warn" : "good"}
                    >
                      {g.retry === "never" ? "Never" : g.retry === "fix-first" ? "Fix first" : "Yes, timed"}
                    </Pill>,
                    <Pill
                      key={`${g.id}-f`}
                      tone={
                        g.falseDeclineRisk === "high"
                          ? "bad"
                          : g.falseDeclineRisk === "medium"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {g.falseDeclineRisk === "high"
                        ? "Often"
                        : g.falseDeclineRisk === "medium"
                          ? "Sometimes"
                          : "Rarely"}
                    </Pill>,
                    <span key={`${g.id}-s`} className="text-muted-foreground">
                      {pct(g.typicalSharePct, 0)}
                    </span>,
                  ])}
                />
              </div>
            </div>

            <Callout tone="warn">
              The default share column is an editorial placeholder, not a measured distribution. Nobody
              publishes the decline mix across US merchants, so export your own decline codes from your gateway
              and replace the soft-decline share above with what you find. The retry rules beside each group
              are not placeholders: they come from Visa&rsquo;s published response code categories.
            </Callout>

            <Caveat>
              Retrying a Category 1 decline even once is a rules breach, and reattempting anything more than 15
              times in 30 days is too. Stripe recommends stopping at eight, on the grounds that a burst of
              retries reads as fraud to an issuer and pushes your legitimate declines up. This figure overlaps
              with the false decline loss in the first tab. Do not add the two together.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default FalseDeclineCalculator;
