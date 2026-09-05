"use client";

import * as React from "react";
import {
  TRADE_TERMS,
  TRADE_TERM_BASIS_OPTIONS,
  TRADE_TERM_DEFAULTS,
  findTradeTerm,
} from "@/lib/tools-data/trade-terms";
import {
  annualizedDiscountCost,
  cardPaymentComparison,
  earlyPaymentDecision,
  sellerDiscountProgram,
} from "@/lib/calc/early-payment";
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
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Early payment discount to APR, in three directions.
 *
 * The gap this exploits: every ranking "2/10 net 30 calculator" prints ONE
 * number, the nominal (d / (1 - d)) x (365 / days) figure, and calls it the APR.
 * It is not an APR, it is a simple annualization, and the compounded effective
 * annual rate on the same terms is seven points higher. Both are printed here,
 * labelled, side by side.
 *
 * The other two gaps are structural. Nothing on the first page of that query
 * runs the arithmetic from the SELLER's side, where the denominator is the day
 * customers actually pay rather than the day the terms say. And nothing connects
 * it to the card fee, which is this site's subject: paying a supplier by card to
 * capture a 2 percent discount at a 2.9 percent card fee loses money on the fee
 * line alone, and only rewards and statement float can rescue it.
 *
 * No `Verdict` here on purpose. The verdict bands score a merchant's blended
 * monthly effective processing rate and mean nothing against an annualized cost
 * of trade credit.
 */
export function EarlyPaymentDiscountCalculator() {
  const [mode, setMode] = React.useState<"buyer" | "seller" | "card">("buyer");

  const [termId, setTermId] = React.useState(TRADE_TERM_DEFAULTS.termId);
  const [discountPct, setDiscountPct] = React.useState(String(TRADE_TERM_DEFAULTS.discountPct));
  const [discountDays, setDiscountDays] = React.useState(String(TRADE_TERM_DEFAULTS.discountDays));
  const [netDays, setNetDays] = React.useState(String(TRADE_TERM_DEFAULTS.netDays));
  const [basis, setBasis] = React.useState(String(TRADE_TERM_DEFAULTS.basisDays));

  const [invoice, setInvoice] = React.useState(String(TRADE_TERM_DEFAULTS.invoiceAmount));
  const [coc, setCoc] = React.useState(String(TRADE_TERM_DEFAULTS.costOfCapitalPct));

  const [sales, setSales] = React.useState(String(TRADE_TERM_DEFAULTS.annualCreditSales));
  const [payDays, setPayDays] = React.useState(String(TRADE_TERM_DEFAULTS.currentPaymentDays));
  const [takeUp, setTakeUp] = React.useState(String(TRADE_TERM_DEFAULTS.takeUpPct));

  const [cardFee, setCardFee] = React.useState(String(TRADE_TERM_DEFAULTS.cardFeePct));
  const [rewards, setRewards] = React.useState(String(TRADE_TERM_DEFAULTS.rewardsPct));
  const [grace, setGrace] = React.useState(String(TRADE_TERM_DEFAULTS.cardGraceDays));

  const preset = termId === "custom" ? undefined : findTradeTerm(termId);
  const terms = {
    discountPct: preset ? preset.discountPct : Math.max(0, num(discountPct)),
    discountDays: preset ? preset.discountDays : Math.max(0, num(discountDays)),
    netDays: preset ? preset.netDays : Math.max(0, num(netDays)),
  };
  const basisDays = num(basis) === 360 ? 360 : 365;

  const cost = annualizedDiscountCost(terms, basisDays);
  const buyer = earlyPaymentDecision({
    ...terms,
    invoiceAmount: Math.max(0, num(invoice)),
    costOfCapitalPct: Math.max(0, num(coc)),
    basisDays,
  });
  const seller = sellerDiscountProgram({
    annualCreditSales: Math.max(0, num(sales)),
    discountPct: terms.discountPct,
    discountDays: terms.discountDays,
    currentPaymentDays: Math.max(0, num(payDays)),
    takeUpPct: Math.max(0, num(takeUp)),
    costOfCapitalPct: Math.max(0, num(coc)),
    basisDays,
  });
  const card = cardPaymentComparison({
    ...terms,
    invoiceAmount: Math.max(0, num(invoice)),
    cardFeePct: Math.max(0, num(cardFee)),
    rewardsPct: Math.max(0, num(rewards)),
    cardGraceDays: Math.max(0, num(grace)),
    costOfCapitalPct: Math.max(0, num(coc)),
    basisDays,
  });

  const termLabel = preset ? preset.label : `${terms.discountPct}/${terms.discountDays} net ${terms.netDays}`;

  const termOptions = [
    ...TRADE_TERMS.map((t) => ({ value: t.id, label: t.label })),
    { value: "custom", label: "Enter my own terms" },
  ];

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "buyer" | "seller" | "card")}
            options={[
              { value: "buyer", label: "Should I take it?" },
              { value: "seller", label: "Should I offer it?" },
              { value: "card", label: "Pay by card?" },
            ]}
          />

          <FieldGrid>
            <SelectField
              id="epd-term"
              label="Terms on the invoice"
              value={termId}
              onChange={setTermId}
              options={termOptions}
              hint="2/10 net 30 means 2 percent off if you pay by day 10, all of it by day 30."
            />
            <SelectField
              id="epd-basis"
              label="Day count basis"
              value={basis}
              onChange={setBasis}
              options={TRADE_TERM_BASIS_OPTIONS}
              hint="Published figures differ. 365 is the common one; 360 is what several textbooks use."
            />
          </FieldGrid>

          {termId === "custom" && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="epd-disc" label="Discount" suffix="%" value={discountPct} onChange={setDiscountPct} />
              <Field id="epd-discdays" label="Discount by day" suffix="d" value={discountDays} onChange={setDiscountDays} />
              <Field id="epd-netdays" label="Net due day" suffix="d" value={netDays} onChange={setNetDays} />
            </div>
          )}

          {mode === "buyer" && (
            <FieldGrid>
              <Field id="epd-invoice" label="Invoice amount" prefix="$" value={invoice} onChange={setInvoice} />
              <Field
                id="epd-coc"
                label="Your cost of capital"
                suffix="%"
                value={coc}
                onChange={setCoc}
                hint="Your line of credit rate, or what the cash would otherwise earn. Opens on the 6.75% bank prime rate."
              />
            </FieldGrid>
          )}

          {mode === "seller" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="epd-sales" label="Annual sales on credit terms" prefix="$" value={sales} onChange={setSales} />
                <Field
                  id="epd-paydays"
                  label="Day customers actually pay"
                  suffix="d"
                  value={payDays}
                  onChange={setPayDays}
                  hint="Your real average, not the day your terms say. This is the input the whole answer turns on."
                />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="epd-takeup"
                  label="Share expected to take it"
                  suffix="%"
                  value={takeUp}
                  onChange={setTakeUp}
                  hint="Scales the size of the answer. It cannot change the sign."
                />
                <Field id="epd-sellercoc" label="Your cost of capital" suffix="%" value={coc} onChange={setCoc} />
              </FieldGrid>
            </div>
          )}

          {mode === "card" && (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="epd-cardinv" label="Invoice amount" prefix="$" value={invoice} onChange={setInvoice} />
                <Field
                  id="epd-cardfee"
                  label="Card fee to pay the bill"
                  suffix="%"
                  value={cardFee}
                  onChange={setCardFee}
                  hint="What a bill pay service or the supplier charges to put the payment on a card."
                />
              </FieldGrid>
              <FieldGrid>
                <Field id="epd-rewards" label="Card rewards rate" suffix="%" value={rewards} onChange={setRewards} />
                <Field
                  id="epd-grace"
                  label="Days until the card statement is due"
                  suffix="d"
                  value={grace}
                  onChange={setGrace}
                  hint="Counted from the charge. This is the float the card buys you."
                />
              </FieldGrid>
              <Field id="epd-cardcoc" label="Your cost of capital" suffix="%" value={coc} onChange={setCoc} />
            </div>
          )}
        </div>
      }
      results={
        mode === "buyer" ? (
          <div>
            <Headline
              label={`Cost of skipping ${termLabel}`}
              value={cost.free ? "No discount" : pct(cost.nominalAnnualPct)}
              sub={
                cost.free
                  ? `${termLabel} carries no discount, so the ${terms.netDays} days of credit are free. Take all of them.`
                  : `Nominal, on a ${cost.basisDays} day year. Compounded, the effective annual rate is ${pct(cost.effectiveAnnualPct)}.`
              }
            />

            <div className="mt-5">
              <ResultRow
                label="Cost over one credit period"
                value={pct(cost.periodRatePct)}
                note={cost.free ? "No discount offered" : `${cost.creditPeriodDays} days, ${cost.periodsPerYear.toFixed(2)} times a year`}
              />
              <ResultRow label="Nominal annualized cost" value={pct(cost.nominalAnnualPct)} note="The figure most calculators print" />
              <ResultRow label="Effective annual rate" value={pct(cost.effectiveAnnualPct)} note="Compounded, if the terms repeat" emphasis />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">On this invoice</p>
              <div className="mt-2">
                <ResultRow label="Pay in full on the net date" value={money(buyer.amountDueNet)} note={`Day ${terms.netDays}`} />
                <ResultRow label="Pay early and take the discount" value={money(buyer.amountDueEarly)} note={`Day ${terms.discountDays}`} />
                <ResultRow label="Discount captured" value={money(buyer.discount)} />
                <ResultRow
                  label={`Cost of funding it at ${pct(Math.max(0, num(coc)))}`}
                  value={money(buyer.fundingCost)}
                  note={`Simple interest on ${money(buyer.amountDueEarly)} for ${cost.creditPeriodDays} days`}
                />
                <ResultRow label="Net gain from paying early" value={money(buyer.netGain)} emphasis />
              </div>
            </div>

            <Callout tone={buyer.worthTaking ? "good" : "warn"}>
              {cost.free ? (
                <>
                  There is nothing to take. {termLabel} offers no discount, so paying before day {terms.netDays} buys
                  you nothing and costs you the use of your own cash. Pay on the due date.
                </>
              ) : buyer.worthTaking ? (
                <>
                  Take it. Borrowing at {pct(Math.max(0, num(coc)))} to capture {termLabel} nets{" "}
                  <strong className="text-foreground">{money(buyer.netGain)}</strong> on this invoice. You would have
                  to be borrowing above <strong className="text-foreground">{pct(buyer.breakEvenRatePct)}</strong> for
                  skipping it to be the better trade, which is above every SBA 7(a) ceiling.
                </>
              ) : (
                <>
                  At {pct(Math.max(0, num(coc)))} your money costs more than the discount is worth. The break-even
                  borrowing rate on {termLabel} is <strong className="text-foreground">{pct(buyer.breakEvenRatePct)}</strong>.
                  Pay on the net date.
                </>
              )}
            </Callout>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Common terms, annualized</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Terms", "Credit days", "Nominal", "Effective"]}
                  align={["left", "right", "right", "right"]}
                  maxHeight="260px"
                  rows={TRADE_TERMS.map((t) => [
                    <span key={t.id}>
                      <span className="text-foreground">{t.label}</span>
                      {t.id === termId && (
                        <Pill key={`${t.id}-p`} tone="neutral">
                          selected
                        </Pill>
                      )}
                    </span>,
                    t.discountPct > 0 ? String(t.creditPeriodDays) : "n/a",
                    t.discountPct > 0 ? pct(t.nominalAnnualPct) : "Free",
                    t.discountPct > 0 ? pct(t.effectiveAnnualPct) : "Free",
                  ])}
                />
              </div>
            </div>

            <Caveat>
              Nominal and effective answer different questions. Nominal is right for a single invoice funded with
              simple interest, and it is exactly the borrowing rate at which the decision flips. Effective is right
              when the same supplier bills you every month and you skip the discount every time.
            </Caveat>
          </div>
        ) : mode === "seller" ? (
          <div>
            <Headline
              label="Break-even cost of capital"
              value={cost.free ? "No discount" : pct(seller.breakEvenRatePct)}
              sub={
                cost.free
                  ? "You are not offering a discount, so there is nothing to price."
                  : `Your money has to be worth more than this for offering ${terms.discountPct}/${terms.discountDays} to pay. Yours is ${pct(Math.max(0, num(coc)))}.`
              }
            />

            <div className="mt-5">
              <ResultRow label="Discount handed over, per year" value={money0(seller.discountGiven)} note={`${Math.round(seller.takeUpFraction * 100)}% of credit sales taking it`} />
              <ResultRow label="Days sales outstanding now" value={`${seller.currentDso.toFixed(0)} days`} />
              <ResultRow label="Days sales outstanding after" value={`${seller.newDso.toFixed(1)} days`} note={`Down ${seller.dsoReductionDays.toFixed(1)} days`} />
              <ResultRow label="Cash released, one off" value={money0(seller.cashReleased)} note="Computed on sales net of the discount" />
              <ResultRow label={`Annual value of that cash at ${pct(Math.max(0, num(coc)))}`} value={money0(seller.financingSaved)} />
              <ResultRow label="Net, per year" value={money0(seller.netAnnual)} emphasis />
            </div>

            <Callout tone={seller.worthOffering ? "good" : "warn"}>
              {cost.free ? (
                <>Pick a term with a discount in it to price the offer.</>
              ) : seller.worthOffering ? (
                <>
                  Worth offering. Your cost of capital of {pct(Math.max(0, num(coc)))} is above the{" "}
                  <strong className="text-foreground">{pct(seller.breakEvenRatePct)}</strong> break-even, so the cash
                  arriving {(Math.max(0, num(payDays)) - terms.discountDays).toFixed(0)} days sooner is worth more than
                  the discount costs.
                </>
              ) : (
                <>
                  It costs you <strong className="text-foreground">{money0(Math.abs(seller.netAnnual))} a year</strong>.
                  Your customers pay at day {Math.max(0, num(payDays)).toFixed(0)}, so the discount buys{" "}
                  {(Math.max(0, num(payDays)) - terms.discountDays).toFixed(0)} days of acceleration and needs your
                  money to be worth <strong className="text-foreground">{pct(seller.breakEvenRatePct)}</strong> a year
                  to pay for itself.
                </>
              )}
            </Callout>

            <Caveat>
              Changing the take-up share moves the size of the answer and never its sign: it multiplies the discount
              given and the cash released by the same factor, so it divides straight out of the break-even. If you
              came looking for the take-up rate that makes an early payment discount work, there is not one. The rate
              your money is worth is the whole decision.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Card route against paying cash on the due date"
              value={money(card.netAdvantage)}
              sub={
                card.worthPayingByCard
                  ? `Better by ${money(card.netAdvantage)} on this invoice, once the ${pct(Math.max(0, num(rewards)))} rewards and the float are counted.`
                  : `Worse by ${money(Math.abs(card.netAdvantage))} on this invoice. The card fee is larger than the discount.`
              }
            />

            <div className="mt-5">
              <ResultRow label="Discount captured" value={money(card.discountSaved)} note={`${terms.discountPct}% off on day ${terms.discountDays}`} />
              <ResultRow label="Charged to the card" value={money(card.amountCharged)} />
              <ResultRow label={`Card fee at ${pct(Math.max(0, num(cardFee)))}`} value={`-${money(card.cardFee)}`} />
              <ResultRow label={`Rewards at ${pct(Math.max(0, num(rewards)))}`} value={money(card.rewardsEarned)} />
              <ResultRow
                label="Float on the statement"
                value={money(card.floatValue)}
                note={`${card.floatDays} days later than day ${terms.netDays}`}
              />
              <ResultRow label="Net against paying cash" value={money(card.netAdvantage)} emphasis />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Where it flips</p>
              <div className="mt-2">
                <ResultRow
                  label="Rewards rate needed to break even"
                  value={pct(card.breakEvenRewardsPct)}
                  note={`At a ${pct(Math.max(0, num(cardFee)))} card fee`}
                />
                <ResultRow
                  label="Highest card fee worth paying"
                  value={pct(card.breakEvenCardFeePct)}
                  note={`At a ${pct(Math.max(0, num(rewards)))} rewards rate`}
                />
                <ResultRow label="Total leaving the card" value={money(card.totalOutlay)} />
              </div>
            </div>

            <Callout tone={card.worthPayingByCard ? "good" : "warn"}>
              The fee is charged on the discounted amount, so a {pct(Math.max(0, num(cardFee)))} card fee costs{" "}
              {money(card.cardFee)} to capture a {money(card.discountSaved)} discount. The discount alone does not
              cover it whenever the fee exceeds {pct(cost.periodRatePct)}, which is the discount restated on the
              amount you actually pay. Rewards and float are what decide it.
            </Callout>

            <Caveat>
              This compares paying by card on the discount date against paying from your bank account on the net date.
              It does not model interest if you carry the card balance past the statement due date, which would swamp
              every figure above. Card rewards on business bill payments are set by your issuer and some categories
              are excluded.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default EarlyPaymentDiscountCalculator;
