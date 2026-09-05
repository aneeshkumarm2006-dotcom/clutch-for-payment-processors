"use client";

import * as React from "react";
import {
  CROSS_BORDER_FEES,
  FX_DEFAULTS,
  FX_MARKUP_BANDS,
  FX_REFERENCE_RATES,
  NETWORK_CROSS_BORDER_ASSESSMENTS,
} from "@/lib/tools-data/fx";
import {
  assessmentTotalPct,
  blendedMonth,
  crossBorderPayment,
  fromUsdPerUnit,
  fxForward,
  fxMarkup,
  toUsdPerUnit,
  type CrossBorderRates,
  type QuoteDirection,
} from "@/lib/calc/fx";
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
 * Cross border and FX markup, three modes on one page.
 *
 * The gap this exploits: every page ranking for "cross border fee" treats three
 * separate charges as one number. The network cross border assessment is a
 * geography charge and applies even when everything settles in dollars. The
 * processor international card fee is the processor's own add-on and on flat rate
 * pricing it REPLACES the assessment rather than sitting beside it. The currency
 * conversion markup is not a fee at all, it is a spread inside an exchange rate,
 * which is why nobody sees it.
 *
 * The third mode is the one no competitor has: it takes the rate a merchant was
 * actually given, against a published mid market reference rate, and derives the
 * markup that was hidden in it. That is the only way to compare a processor
 * quoting "3 to 4 percent conversion" against one quoting a rate.
 *
 * `Verdict` appears in the blended mode ONLY. The site's bands score a blended
 * monthly effective rate and are meaningless on a single payment.
 */
export function CrossBorderFeeCalculator() {
  const [mode, setMode] = React.useState<"payment" | "blended" | "markup">(FX_DEFAULTS.mode);

  // Shared pricing inputs, used by the payment and blended modes.
  const [processorSlug, setProcessorSlug] = React.useState(FX_DEFAULTS.processorSlug);
  const [basePct, setBasePct] = React.useState(String(FX_DEFAULTS.basePct));
  const [baseFixed, setBaseFixed] = React.useState(String(FX_DEFAULTS.baseFixed));
  const [internationalPct, setInternationalPct] = React.useState(String(FX_DEFAULTS.internationalPct));
  const [fxMarkupPct, setFxMarkupPct] = React.useState(String(FX_DEFAULTS.fxMarkupPct));
  const [passThroughNetwork, setPassThroughNetwork] = React.useState(FX_DEFAULTS.passThroughNetwork);
  const [networkId, setNetworkId] = React.useState(FX_DEFAULTS.networkId);

  // Payment mode.
  const [amount, setAmount] = React.useState(String(FX_DEFAULTS.amount));
  const [foreignCard, setForeignCard] = React.useState(FX_DEFAULTS.foreignCard);
  const [currencyConverted, setCurrencyConverted] = React.useState(FX_DEFAULTS.currencyConverted);

  // Blended mode.
  const [monthlyVolume, setMonthlyVolume] = React.useState(String(FX_DEFAULTS.monthlyVolume));
  const [averageTicket, setAverageTicket] = React.useState(String(FX_DEFAULTS.averageTicket));
  const [foreignSharePct, setForeignSharePct] = React.useState(String(FX_DEFAULTS.foreignSharePct));
  const [convertedSharePct, setConvertedSharePct] = React.useState(String(FX_DEFAULTS.convertedSharePct));

  // Markup mode.
  const [currencyCode, setCurrencyCode] = React.useState(FX_DEFAULTS.currencyCode);
  const [foreignAmount, setForeignAmount] = React.useState(String(FX_DEFAULTS.foreignAmount));
  const [midRate, setMidRate] = React.useState(String(FX_DEFAULTS.midRate));
  const [receivedRate, setReceivedRate] = React.useState(String(FX_DEFAULTS.receivedRate));
  const [quoteDirection, setQuoteDirection] = React.useState<QuoteDirection>(FX_DEFAULTS.quoteDirection);
  const [statedMarkupPct, setStatedMarkupPct] = React.useState(String(FX_DEFAULTS.statedMarkupPct));
  const [transactionsPerYear, setTransactionsPerYear] = React.useState(String(FX_DEFAULTS.transactionsPerYear));

  const profile = CROSS_BORDER_FEES.find((p) => p.processorSlug === processorSlug);
  const network =
    NETWORK_CROSS_BORDER_ASSESSMENTS.find((n) => n.id === networkId) ?? NETWORK_CROSS_BORDER_ASSESSMENTS[0];
  const networkPct = network ? assessmentTotalPct(network) : 0;
  const networkFixed = network ? network.incrementalFixed : 0;

  const rates: CrossBorderRates = {
    basePct: Math.max(0, num(basePct)),
    baseFixed: Math.max(0, num(baseFixed)),
    internationalPct: Math.max(0, num(internationalPct)),
    fxMarkupPct: Math.max(0, num(fxMarkupPct)),
    networkPct,
    networkFixed,
  };

  const onProcessorChange = (slug: string) => {
    setProcessorSlug(slug);
    const next = CROSS_BORDER_FEES.find((p) => p.processorSlug === slug);
    if (!next) return;
    setBasePct(String(next.basePct));
    setBaseFixed(String(next.baseFixed));
    setInternationalPct(String(next.internationalPct));
    setFxMarkupPct(String(next.fxMarkupLowPct ?? 0));
    setPassThroughNetwork(next.passesNetworkFeesThrough);
  };

  /**
   * Changing the currency rewrites the rate fields together, because a rate and
   * its direction are one fact. Leaving a euro rate in the box under a yen
   * direction is the exact inversion this tool exists to catch.
   */
  const onCurrencyChange = (code: string) => {
    setCurrencyCode(code);
    const ref = FX_REFERENCE_RATES.find((r) => r.code === code);
    if (!ref) return;
    setQuoteDirection(ref.publishedAs);
    setMidRate(String(ref.published));
    const mid = toUsdPerUnit(ref.published, ref.publishedAs);
    const received = mid * (1 - Math.max(0, num(statedMarkupPct)) / 100);
    setReceivedRate(fromUsdPerUnit(received, ref.publishedAs).toFixed(4));
  };

  const payment = crossBorderPayment({
    amount: Math.max(0, num(amount)),
    foreignCard,
    currencyConverted,
    passThroughNetwork,
    rates,
  });

  const blended = blendedMonth({
    monthlyVolume: Math.max(0, num(monthlyVolume)),
    averageTicket: Math.max(0, num(averageTicket)),
    foreignSharePct: Math.max(0, num(foreignSharePct)),
    convertedSharePct: Math.max(0, num(convertedSharePct)),
    passThroughNetwork,
    rates,
  });

  const markup = fxMarkup({
    foreignAmount: Math.max(0, num(foreignAmount)),
    midRate: num(midRate),
    receivedRate: num(receivedRate),
    direction: quoteDirection,
  });

  const band =
    FX_MARKUP_BANDS.find((b) => markup.markupPct < b.maxPct) ??
    FX_MARKUP_BANDS[FX_MARKUP_BANDS.length - 1];

  const forwardRows = [0.5, 1, 1.5, 2, 3, 4].map((m) => ({
    markup: m,
    result: fxForward({
      midRate: num(midRate),
      direction: quoteDirection,
      markupPct: m,
      foreignAmount: Math.max(0, num(foreignAmount)),
      transactionsPerYear: Math.max(0, num(transactionsPerYear)),
    }),
  }));

  const rateDp = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : "N/A");
  const unitLabel = quoteDirection === "usd-per-unit" ? `USD per 1 ${currencyCode}` : `${currencyCode} per 1 USD`;

  const processorOptions = CROSS_BORDER_FEES.map((p) => ({ value: p.processorSlug, label: p.name }));
  const networkOptions = NETWORK_CROSS_BORDER_ASSESSMENTS.map((n) => ({
    value: n.id,
    label: `${n.label} (${assessmentTotalPct(n).toFixed(2)}%)`,
  }));
  const currencyOptions = FX_REFERENCE_RATES.map((r) => ({ value: r.code, label: `${r.label} (${r.code})` }));

  const pricingControls = (
    <div className="space-y-4">
      <SelectField
        id="xb-processor"
        label="Processor"
        value={processorSlug}
        onChange={onProcessorChange}
        options={processorOptions}
        hint={profile ? profile.internationalPublished : undefined}
      />
      <FieldGrid>
        <Field id="xb-base-pct" label="Base card rate" suffix="%" value={basePct} onChange={setBasePct} />
        <Field id="xb-base-fixed" label="Fixed fee per payment" prefix="$" value={baseFixed} onChange={setBaseFixed} />
      </FieldGrid>
      <FieldGrid>
        <Field
          id="xb-intl-pct"
          label="International card add-on"
          suffix="%"
          value={internationalPct}
          onChange={setInternationalPct}
          hint="Charged by the processor itself. Zero on interchange plus pricing."
        />
        <Field
          id="xb-fx-pct"
          label="Currency conversion markup"
          suffix="%"
          value={fxMarkupPct}
          onChange={setFxMarkupPct}
          hint={
            profile && profile.fxMarkupLowPct !== null && profile.fxMarkupHighPct !== null
              ? `Published: ${profile.fxMarkupPublished}`
              : "Not published by this processor. Derive it in the third tab."
          }
        />
      </FieldGrid>
      <CheckboxRow
        checked={passThroughNetwork}
        onChange={() => setPassThroughNetwork(!passThroughNetwork)}
        label="My pricing passes network fees through (interchange plus)"
        hint="On flat rate pricing leave this off: the add-on above already contains the assessment."
      />
      {passThroughNetwork && (
        <SelectField
          id="xb-network"
          label="Network cross border assessment"
          value={networkId}
          onChange={setNetworkId}
          options={networkOptions}
          hint={network ? `Plus ${money(network.incrementalFixed)} per item above the domestic equivalent.` : undefined}
        />
      )}
    </div>
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "payment" | "blended" | "markup")}
            options={[
              { value: "payment", label: "One foreign payment" },
              { value: "blended", label: "My blended rate" },
              { value: "markup", label: "What markup was I charged?" },
            ]}
          />

          {mode === "payment" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="xb-amount" label="Sale amount" prefix="$" value={amount} onChange={setAmount} />
                <div className="space-y-2.5 pt-6">
                  <CheckboxRow
                    checked={foreignCard}
                    onChange={() => setForeignCard(!foreignCard)}
                    label="Card issued outside the US"
                    hint="A geography test. It has nothing to do with currency."
                  />
                  <CheckboxRow
                    checked={currencyConverted}
                    onChange={() => setCurrencyConverted(!currencyConverted)}
                    label="The sale had to be converted"
                    hint="A currency test. It has nothing to do with where the card came from."
                  />
                </div>
              </FieldGrid>
              {pricingControls}
            </div>
          )}

          {mode === "blended" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="xb-volume"
                  label="Monthly card volume"
                  prefix="$"
                  value={monthlyVolume}
                  onChange={setMonthlyVolume}
                />
                <Field id="xb-ticket" label="Average ticket" prefix="$" value={averageTicket} onChange={setAverageTicket} />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="xb-foreign-share"
                  label="Share on foreign-issued cards"
                  suffix="%"
                  value={foreignSharePct}
                  onChange={setForeignSharePct}
                />
                <Field
                  id="xb-converted-share"
                  label="Share that gets converted"
                  suffix="%"
                  value={convertedSharePct}
                  onChange={setConvertedSharePct}
                  hint="Independent of the share above, and usually smaller."
                />
              </FieldGrid>
              {pricingControls}
            </div>
          )}

          {mode === "markup" && (
            <div className="space-y-4">
              <FieldGrid>
                <SelectField
                  id="xb-currency"
                  label="Currency you were paid in"
                  value={currencyCode}
                  onChange={onCurrencyChange}
                  options={currencyOptions}
                />
                <Field
                  id="xb-foreign-amount"
                  label={`Sale amount in ${currencyCode}`}
                  value={foreignAmount}
                  onChange={setForeignAmount}
                />
              </FieldGrid>
              <SelectField
                id="xb-direction"
                label="How the rate is quoted"
                value={quoteDirection}
                onChange={(v) => setQuoteDirection(v as QuoteDirection)}
                options={[
                  { value: "usd-per-unit", label: `US dollars per 1 ${currencyCode}` },
                  { value: "unit-per-usd", label: `${currencyCode} per 1 US dollar` },
                ]}
                hint="Get this wrong and the answer inverts. The Federal Reserve prints the euro one way and the yen the other."
              />
              <FieldGrid>
                <Field
                  id="xb-mid"
                  label="Mid market reference rate"
                  value={midRate}
                  onChange={setMidRate}
                  hint="Federal Reserve H.10, week to 28 August 2026."
                />
                <Field
                  id="xb-received"
                  label="Rate you were actually given"
                  value={receivedRate}
                  onChange={setReceivedRate}
                  hint="Divide the dollars you received by the foreign amount."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="xb-txns"
                  label="Converted payments a year"
                  value={transactionsPerYear}
                  onChange={setTransactionsPerYear}
                />
                <Field
                  id="xb-stated"
                  label="A markup to model"
                  suffix="%"
                  value={statedMarkupPct}
                  onChange={setStatedMarkupPct}
                  hint="Used to seed the rate field when you change currency."
                />
              </FieldGrid>
            </div>
          )}
        </div>
      }
      results={
        mode === "payment" ? (
          <div>
            <Headline
              label="All-in rate on this payment"
              value={pct(payment.effectiveRatePct)}
              sub={`${money(payment.total)} on a ${money(payment.amount)} sale. You net ${money(payment.net)}.`}
            />
            <div className="mt-5">
              <ResultRow label="Base card fee" value={money(payment.baseFee)} note={`${pct(rates.basePct)} plus ${money(rates.baseFixed)}`} />
              {passThroughNetwork ? (
                <ResultRow
                  label="Network cross border assessment"
                  value={money(payment.networkAssessment)}
                  note={network ? network.label : undefined}
                />
              ) : (
                <ResultRow
                  label="Processor international add-on"
                  value={money(payment.internationalFee)}
                  note={foreignCard ? "Charged because the card was issued abroad" : "Not charged: domestic card"}
                />
              )}
              <ResultRow
                label="Currency conversion markup"
                value={money(payment.conversionCost)}
                note={currencyConverted ? "Priced into the exchange rate, not shown as a line" : "Not charged: no conversion"}
              />
              <ResultRow label="Total cost of this payment" value={money(payment.total)} emphasis />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Against the same sale on a US card</p>
              <div className="mt-2">
                <ResultRow label="Domestic cost" value={money(payment.domesticTotal)} note={pct(payment.domesticEffectiveRatePct)} />
                <ResultRow
                  label="Cost of it being international"
                  value={money(payment.crossBorderPremium)}
                  note={`${pct(payment.crossBorderPremiumPct)} of the sale`}
                  emphasis
                />
              </div>
            </div>

            <Callout tone={payment.crossBorderPremiumPct >= 2 ? "warn" : "neutral"}>
              The cross border and conversion charges add{" "}
              <strong className="text-foreground">{money(payment.crossBorderPremium)}</strong> to this sale, which is{" "}
              {pct(payment.premiumAsShareOfDomesticFeePct, 0)} of the entire domestic processing fee. Only one of the
              two is a line item on your statement.
            </Callout>

            <Caveat>
              Where the card was issued and which currency the sale settled in are separate tests, so the two boxes are
              separate. A US card charged in euros converts without being cross border. A UK card charged in dollars is
              cross border without converting.
            </Caveat>
          </div>
        ) : mode === "blended" ? (
          <div>
            <Headline
              label="Blended monthly effective rate"
              value={pct(blended.blendedRatePct)}
              sub={`${money0(blended.totalMonthlyCost)} on ${money0(Math.max(0, num(monthlyVolume)))} of volume across about ${Math.round(blended.transactions).toLocaleString("en-US")} payments.`}
            />
            <div className="mt-5">
              <ResultRow label="Base rate on all volume" value={money0(blended.percentageCost + blended.fixedCost)} note={pct(blended.baselineRatePct)} />
              {passThroughNetwork ? (
                <ResultRow label="Network cross border assessment" value={money0(blended.networkCost)} note={money0(blended.foreignVolume) + " of foreign volume"} />
              ) : (
                <ResultRow label="International card add-on" value={money0(blended.internationalCost)} note={money0(blended.foreignVolume) + " of foreign volume"} />
              )}
              <ResultRow label="Currency conversion markup" value={money0(blended.conversionCost)} note={money0(blended.convertedVolume) + " converted"} />
              <ResultRow label="Total monthly cost" value={money0(blended.totalMonthlyCost)} emphasis />
            </div>

            <Verdict effectiveRate={blended.blendedRatePct} />

            <Callout tone={blended.ratePremiumPct >= 0.25 ? "warn" : "neutral"}>
              Your international mix adds{" "}
              <strong className="text-foreground">{Math.round(blended.ratePremiumPct * 100)} basis points</strong> to
              the blended rate, taking it from {pct(blended.baselineRatePct)} to {pct(blended.blendedRatePct)}. That is{" "}
              {money0(blended.crossBorderCostMonthly)} a month and{" "}
              <strong className="text-foreground">{money0(blended.crossBorderCostAnnual)} a year</strong>. The band
              above scores the blended rate, so read it as a verdict on the mix rather than on the deal you negotiated.
            </Callout>

            <Caveat>
              Transaction count is volume divided by average ticket and is not rounded to a whole payment, so the fixed
              fee line is an estimate on a monthly aggregate rather than a bill.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Markup hidden in the rate you were given"
              value={pct(markup.markupPct)}
              sub={`${money(markup.spreadCost)} of a ${money(markup.midValue)} sale did not reach you.`}
            />
            <div className="mt-3">
              <Pill tone={markup.markupPct < 1.25 ? "good" : markup.markupPct < 3.5 ? "warn" : "bad"}>
                {band ? band.label : "Unscored"}
              </Pill>
            </div>
            <div className="mt-5">
              <ResultRow label="Value at the reference rate" value={money(markup.midValue)} note={`${rateDp(markup.midUsdPerUnit)} USD per 1 ${currencyCode}`} />
              <ResultRow label="What you actually received" value={money(markup.receivedValue)} note={`${rateDp(markup.receivedUsdPerUnit)} USD per 1 ${currencyCode}`} />
              <ResultRow label="Taken by the spread" value={money(markup.spreadCost)} emphasis />
              <ResultRow label="Measured against mid market" value={pct(markup.markupPct)} note="The share of the sale you did not get" />
              <ResultRow label="Measured against your rate" value={pct(markup.rateSpreadPct)} note="What was added to the rate you were quoted" />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">What a stated markup would cost you</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Markup", `Rate you get (${unitLabel})`, "Per payment", "Per year"]}
                  align={["left", "right", "right", "right"]}
                  rows={forwardRows.map((r) => [
                    <span key={`m-${r.markup}`} className="text-foreground">
                      {pct(r.markup, 1)}
                    </span>,
                    rateDp(r.result.receivedQuoted),
                    money(r.result.costPerTransaction),
                    money0(r.result.costPerYear),
                  ])}
                />
              </div>
            </div>

            <Callout tone={markup.markupPct >= 3.5 ? "warn" : "neutral"}>
              {band ? band.note : ""} On {Math.round(Math.max(0, num(transactionsPerYear))).toLocaleString("en-US")}{" "}
              converted payments a year this rate costs{" "}
              <strong className="text-foreground">
                {money0(markup.spreadCost * Math.max(0, num(transactionsPerYear)))}
              </strong>{" "}
              a year against the reference rate.
            </Callout>

            <Caveat>
              {markup.favorable
                ? "The rate you were given is better than the reference rate, which almost always means the reference is from a different day rather than that you beat the market."
                : "The reference rate is a published weekly figure, not a live tick, so a fraction of a percent of any result is timing rather than markup. A markup worth arguing about is a point or more."}
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default CrossBorderFeeCalculator;
