"use client";

import * as React from "react";
import type { RateCard } from "@/lib/tools-rates";
import {
  ADYEN_DEFAULTS,
  ADYEN_INTERCHANGE_PROFILES,
  ADYEN_PAYMENT_METHODS,
} from "@/lib/tools-data/adyen";
import {
  adyenFlatRateCrossover,
  adyenMonthlyCost,
  adyenPaymentCost,
  flatRateCost,
  flatRateMonthlyCost,
  type AdyenFeeRates,
} from "@/lib/calc/adyen";
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
  SelectField,
  Verdict,
  bps,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * The Adyen Fee Calculator: interchange++ split into its three parts.
 *
 * The gap this exploits. Every page ranking for "adyen fees" quotes the same two
 * numbers off Adyen's price list, the $0.13 processing fee and the 0.60%
 * acquirer fee, and then stops. Those two numbers are between a fifth and a
 * quarter of what an Adyen payment actually costs, because the other three
 * quarters are interchange and scheme fees that Adyen passes through at cost and
 * therefore does not publish. A calculator that prices only Adyen's own line
 * makes Adyen look about four times cheaper than it is, and a calculator that
 * quotes a blended "Adyen is about 2.9%" makes it look like a flat rate
 * processor, which it is not.
 *
 * So the widget's job is the SPLIT: which dollars are the issuer's, which are
 * the card network's, and which are Adyen's. Only the last of the three is
 * negotiable, and it is the only one a merchant can act on.
 *
 * Two modes because there are two questions. One payment answers "what did that
 * cost", which is the query people type. A month of volume answers "should I be
 * on this", which is the decision, and it is the only place the effective-rate
 * verdict bands apply: they score a merchant's blended monthly rate, and judging
 * a single payment against them scores the fixed fee rather than the deal.
 *
 * The card comes in as a prop from `ToolWidget`, per the rule in that file: a
 * `"use client"` module here must never import `@/lib/tools`, `@/lib/rate-cards`
 * or the `@/lib/tools-data` barrel, because one route serves every calculator.
 */
export function AdyenFeeCalculator({ card }: { card: RateCard }) {
  const [mode, setMode] = React.useState<"payment" | "monthly">("payment");

  const [methodId, setMethodId] = React.useState(ADYEN_DEFAULTS.methodId);
  const [profileId, setProfileId] = React.useState(ADYEN_DEFAULTS.interchangeProfileId);
  const [amount, setAmount] = React.useState(String(ADYEN_DEFAULTS.amount));
  const [monthlyVolume, setMonthlyVolume] = React.useState(String(ADYEN_DEFAULTS.monthlyVolume));
  const [averageTicket, setAverageTicket] = React.useState(String(ADYEN_DEFAULTS.averageTicket));
  const [markup, setMarkup] = React.useState(String(ADYEN_DEFAULTS.markupPct));
  const [schemePct, setSchemePct] = React.useState(String(ADYEN_DEFAULTS.schemePct));
  const [schemeFixed, setSchemeFixed] = React.useState(String(ADYEN_DEFAULTS.schemeFixed));
  const [minimumInvoice, setMinimumInvoice] = React.useState(String(ADYEN_DEFAULTS.minimumInvoice));
  const [flatPct, setFlatPct] = React.useState(String(ADYEN_DEFAULTS.flatRatePct));
  const [flatFixed, setFlatFixed] = React.useState(String(ADYEN_DEFAULTS.flatRateFixed));

  const method = ADYEN_PAYMENT_METHODS.find((m) => m.id === methodId) ?? ADYEN_PAYMENT_METHODS[0];
  const profile =
    ADYEN_INTERCHANGE_PROFILES.find((p) => p.id === profileId) ?? ADYEN_INTERCHANGE_PROFILES[0];
  const isIpp = method?.pricing === "interchange-plus-plus";

  // Adyen's fixed processing fee is read off the rate card rather than retyped,
  // so the page and the card can never disagree about what $0.13 is. The Visa
  // channel is the one to read: its `fixed` is the processing fee alone, because
  // Visa has no per transaction method fee of its own to be tangled up in it.
  const processingFixed =
    card.channels.find((c) => c.id === "visa")?.rates.standard?.fixed ?? ADYEN_DEFAULTS.processingFixed;

  const rates: AdyenFeeRates = {
    interchangePlusPlus: Boolean(isIpp),
    interchangePct: profile?.ratePct ?? 0,
    interchangeFixed: profile?.fixed ?? 0,
    schemePct: Math.max(0, num(schemePct)),
    schemeFixed: Math.max(0, num(schemeFixed)),
    markupPct: Math.max(0, num(markup)),
    processingFixed,
    methodPct: method?.methodPct ?? 0,
    methodFixed: method?.methodFixed ?? 0,
  };

  const flatRatePct = Math.max(0, num(flatPct));
  const flatRateFixed = Math.max(0, num(flatFixed));

  const one = adyenPaymentCost(Math.max(0, num(amount)), rates);
  const oneFlat = flatRateCost(Math.max(0, num(amount)), flatRatePct, flatRateFixed);

  const monthly = adyenMonthlyCost({
    monthlyVolume: Math.max(0, num(monthlyVolume)),
    averageTicket: Math.max(0, num(averageTicket)),
    minimumInvoice: Math.max(0, num(minimumInvoice)),
    rates,
  });
  const monthlyFlat = flatRateMonthlyCost(
    Math.max(0, num(monthlyVolume)),
    monthly.transactions,
    flatRatePct,
    flatRateFixed,
  );

  const crossover = adyenFlatRateCrossover(
    one.combinedPct,
    one.combinedFixed,
    flatRatePct,
    flatRateFixed,
  );

  const crossoverLine = (() => {
    const flatLabel = `${pct(flatRatePct, 2)} plus ${money(flatRateFixed)}`;
    switch (crossover.kind) {
      case "identical":
        return `At these settings Adyen and a ${flatLabel} flat rate cost exactly the same on every ticket size.`;
      case "adyen-cheaper-everywhere":
        return `There is no crossover. Adyen is cheaper than ${flatLabel} at every ticket size on this card, because it is lower on the percentage and lower on the fixed fee at the same time.`;
      case "flat-cheaper-everywhere":
        return `There is no crossover. A ${flatLabel} flat rate is cheaper than Adyen at every ticket size on this card, on both the percentage and the fixed fee.`;
      case "adyen-cheaper-above":
        return `Adyen and a ${flatLabel} flat rate meet at ${money(crossover.ticket ?? 0)}. Adyen is cheaper ABOVE that ticket size, because its percentage is lower and the advantage grows with the amount.`;
      case "adyen-cheaper-below":
      default:
        return `Adyen and a ${flatLabel} flat rate meet at ${money(crossover.ticket ?? 0)}. Adyen is cheaper BELOW that ticket size, because its fixed cost is smaller but its percentage is higher, so the flat rate wins as the amount grows.`;
    }
  })();

  const methodOptions = ADYEN_PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }));
  const profileOptions = ADYEN_INTERCHANGE_PROFILES.map((p) => ({ value: p.id, label: p.label }));

  const flatFields = (
    <FieldGrid>
      <Field
        id="adf-flatpct"
        label="Compare against a flat rate of"
        suffix="%"
        value={flatPct}
        onChange={setFlatPct}
        hint="2.9% is the published US online card rate at the flat-rate processors."
      />
      <Field
        id="adf-flatfixed"
        label="Plus a fixed fee of"
        prefix="$"
        value={flatFixed}
        onChange={setFlatFixed}
      />
    </FieldGrid>
  );

  const schemeFields = isIpp ? (
    <FieldGrid>
      <Field
        id="adf-schemepct"
        label="Scheme fee, percentage"
        suffix="%"
        value={schemePct}
        onChange={setSchemePct}
        hint="The Visa credit assessment is 0.14%. Read yours off the scheme fee line on your Adyen invoice."
      />
      <Field
        id="adf-schemefixed"
        label="Scheme fee, per authorization"
        prefix="$"
        value={schemeFixed}
        onChange={setSchemeFixed}
        hint="Visa's authorization processing fee is $0.0195 on a US credit card."
      />
    </FieldGrid>
  ) : null;

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "payment" | "monthly")}
            options={[
              { value: "payment", label: "One payment" },
              { value: "monthly", label: "A month of volume" },
            ]}
          />

          <SelectField
            id="adf-method"
            label="Payment method"
            value={methodId}
            onChange={setMethodId}
            options={methodOptions}
            hint={method?.published}
          />

          {isIpp && (
            <SelectField
              id="adf-profile"
              label="Card the customer paid with"
              value={profileId}
              onChange={setProfileId}
              options={profileOptions}
              hint="Visa US interchange, effective 18 April 2026. This is the issuer's fee, not Adyen's."
            />
          )}

          {mode === "payment" ? (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="adf-amount" label="Payment amount" prefix="$" value={amount} onChange={setAmount} />
                {isIpp && (
                  <Field
                    id="adf-markup"
                    label="Adyen acquirer fee"
                    suffix="%"
                    value={markup}
                    onChange={setMarkup}
                    hint="Adyen publishes 0.60% as the starting point and lowers it with monthly card volume."
                  />
                )}
              </FieldGrid>
              {schemeFields}
              {flatFields}
            </div>
          ) : (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="adf-volume"
                  label="Monthly card volume"
                  prefix="$"
                  value={monthlyVolume}
                  onChange={setMonthlyVolume}
                />
                <Field
                  id="adf-ticket"
                  label="Average ticket"
                  prefix="$"
                  value={averageTicket}
                  onChange={setAverageTicket}
                />
              </FieldGrid>
              <FieldGrid>
                {isIpp && (
                  <Field
                    id="adf-markup-monthly"
                    label="Adyen acquirer fee"
                    suffix="%"
                    value={markup}
                    onChange={setMarkup}
                    hint="0.60% is Adyen's published floor."
                  />
                )}
                <Field
                  id="adf-minimum"
                  label="Minimum monthly invoice"
                  prefix="$"
                  value={minimumInvoice}
                  onChange={setMinimumInvoice}
                  hint="Adyen confirms it has one and does not publish the amount. Use the figure in your own contract."
                />
              </FieldGrid>
              {schemeFields}
              {flatFields}
            </div>
          )}
        </div>
      }
      results={
        mode === "payment" ? (
          <div>
            <Headline
              label={`Adyen cost on a ${money(one.amount)} payment`}
              value={money(one.total)}
              sub={`An effective rate of ${pct(one.effectiveRatePct)}. You net ${money(one.net)}.`}
            />

            <div className="mt-5">
              {isIpp ? (
                <>
                  <ResultRow
                    label="Interchange"
                    value={money(one.interchange)}
                    note={`${pct(rates.interchangePct)} plus ${money(rates.interchangeFixed)}, to the card issuer`}
                  />
                  <ResultRow
                    label="Card scheme fees"
                    value={money(one.schemeFee)}
                    note={`${pct(rates.schemePct)} plus ${money(rates.schemeFixed)}, to Visa or Mastercard`}
                  />
                  <ResultRow
                    label="Adyen acquirer fee"
                    value={money(one.markup)}
                    note={`${pct(rates.markupPct)}, which is ${bps(rates.markupPct)}`}
                  />
                </>
              ) : (
                <ResultRow
                  label="Adyen payment method fee"
                  value={money(one.methodFee)}
                  note={`${pct(rates.methodPct)} plus ${money(rates.methodFixed)}, all in and not split`}
                />
              )}
              <ResultRow
                label="Adyen processing fee"
                value={money(one.processingFee)}
                note="Charged on every transaction, and again on a refund request"
              />
              <ResultRow label="Total cost of this payment" value={money(one.total)} emphasis />
            </div>

            {isIpp && (
              <div className="mt-6">
                <p className="text-label uppercase text-muted-foreground">Who actually gets the money</p>
                <div className="mt-2">
                  <MiniTable
                    columns={["Goes to", "Amount", "Share"]}
                    align={["left", "right", "right"]}
                    rows={[
                      [
                        <span key="pt">
                          <span className="text-foreground">The issuer and the card network</span>
                          <span className="block text-micro text-muted-foreground">
                            Pass-through. Not negotiable with anyone.
                          </span>
                        </span>,
                        money(one.passThrough),
                        <Pill key="pt-p" tone="neutral">
                          {pct(100 - one.adyenSharePct, 1)}
                        </Pill>,
                      ],
                      [
                        <span key="ad">
                          <span className="text-foreground">Adyen</span>
                          <span className="block text-micro text-muted-foreground">
                            The acquirer fee and the processing fee. The only part you can negotiate.
                          </span>
                        </span>,
                        money(one.adyenTake),
                        <Pill key="ad-p" tone="good">
                          {pct(one.adyenSharePct, 1)}
                        </Pill>,
                      ],
                    ]}
                  />
                </div>
              </div>
            )}

            <div className="mt-5">
              <ResultRow
                label={`The same payment at ${pct(flatRatePct, 2)} plus ${money(flatRateFixed)}`}
                value={money(oneFlat)}
                note={
                  oneFlat > one.total
                    ? `Adyen is ${money(oneFlat - one.total)} cheaper here`
                    : oneFlat < one.total
                      ? `The flat rate is ${money(one.total - oneFlat)} cheaper here`
                      : "Line ball"
                }
                emphasis
              />
            </div>

            <Callout tone={crossover.kind === "flat-cheaper-everywhere" ? "warn" : "neutral"}>
              {crossoverLine}
            </Callout>

            <Caveat>
              Adyen bills monthly in aggregate, so the sub-cent components above are real rather than a
              rounding artifact: 2,941 authorizations at $0.0195 is $57.35, not nothing. Only the total is
              rounded, half up, to the cent.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label={`Adyen cost on ${money0(Math.max(0, num(monthlyVolume)))} a month`}
              value={money(monthly.total)}
              sub={`An effective rate of ${pct(monthly.effectiveRatePct)} across ${monthly.transactions.toLocaleString("en-US")} payments.`}
            />

            <div className="mt-5">
              {isIpp ? (
                <>
                  <ResultRow label="Interchange" value={money(monthly.interchange)} note="To the card issuers" />
                  <ResultRow label="Card scheme fees" value={money(monthly.schemeFee)} note="To Visa or Mastercard" />
                  <ResultRow
                    label="Adyen acquirer fee"
                    value={money(monthly.markup)}
                    note={`${pct(rates.markupPct)} of volume`}
                  />
                </>
              ) : (
                <ResultRow label="Adyen payment method fee" value={money(monthly.methodFee)} note="All in, not split" />
              )}
              <ResultRow
                label="Adyen processing fees"
                value={money(monthly.processingFee)}
                note={`${monthly.transactions.toLocaleString("en-US")} payments at ${money(rates.processingFixed)}`}
              />
              <ResultRow label="Fees generated this month" value={money(monthly.costBeforeMinimum)} />
              <ResultRow
                label="Minimum invoice top-up"
                value={money(monthly.minimumTopUp)}
                note={monthly.minimumBinds ? "The floor is binding" : "The floor is not binding"}
              />
              <ResultRow label="What Adyen invoices" value={money(monthly.total)} emphasis />
            </div>

            <Verdict effectiveRate={monthly.effectiveRatePct} />

            <Callout tone={monthly.minimumBinds ? "warn" : "good"}>
              {monthly.minimumBinds
                ? `Your volume generates only ${money(monthly.costBeforeMinimum)} of fees, so the ${money(Math.max(0, num(minimumInvoice)))} minimum invoice is doing the pricing. Your real rate is ${pct(monthly.effectiveRateBeforeMinimumPct)}; you are paying ${pct(monthly.effectiveRatePct)}. At this average ticket the floor stops costing you anything above ${money0(monthly.volumeToClearMinimum ?? 0)} a month.`
                : `The minimum invoice is not binding: your fees clear it comfortably. At this average ticket the floor would only start to matter below ${money0(monthly.volumeToClearMinimum ?? 0)} of monthly volume.`}
            </Callout>

            <Callout tone={monthlyFlat > monthly.total ? "good" : "warn"}>
              {monthlyFlat > monthly.total ? (
                <>
                  The same month at {pct(flatRatePct, 2)} plus {money(flatRateFixed)} costs{" "}
                  <strong className="text-foreground">{money(monthlyFlat)}</strong>, so Adyen saves{" "}
                  {money(monthlyFlat - monthly.total)} a month and{" "}
                  {money0((monthlyFlat - monthly.total) * 12)} a year on this card mix.
                </>
              ) : (
                <>
                  The same month at {pct(flatRatePct, 2)} plus {money(flatRateFixed)} costs{" "}
                  <strong className="text-foreground">{money(monthlyFlat)}</strong>, which is{" "}
                  {money(monthly.total - monthlyFlat)} a month less than Adyen on this card mix. Interchange++
                  only pays when your cards are cheap enough for the pass-through to beat the flat rate.
                </>
              )}
            </Callout>

            <Caveat>
              Percentage fees are charged on the volume you entered and fixed fees on a whole number of
              payments, so the transaction count is rounded to the nearest payment. One card profile is
              applied to the whole month; a real basket mixes debit, plain credit and premium rewards cards,
              and the blended answer sits between the profiles above.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default AdyenFeeCalculator;
