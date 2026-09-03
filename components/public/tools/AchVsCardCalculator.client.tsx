"use client";

import * as React from "react";
import {
  CalcShell,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  ResultRow,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * ACH against card, behind `/tools/ach-vs-credit-card-fee-calculator`.
 *
 * The one thing this has to get right, and the one thing every comparison gets
 * wrong, is the CAP. Modelling ACH as a flat percentage is fine at $50 and
 * badly wrong at $10,000, which is exactly the size where the decision matters.
 * Real US ACH pricing is percent, plus a fixed fee, with a minimum and a cap:
 * Stripe and PayPal are 0.8% capped at $5.00, Square is 1% with a $1 minimum and
 * a $10 cap on paid plans, Helcim is 0.5% plus 25 cents capped at $6.00. All four
 * shapes fit the four inputs below.
 *
 * The crossover ticket is solved directly rather than searched: while the ACH fee
 * is capped, card cost keeps climbing, so the crossing point is where the card
 * fee equals whichever ACH branch applies.
 */

const achFee = (amount: number, rate: number, fixed: number, min: number, cap: number) => {
  const raw = (amount * rate) / 100 + fixed;
  const withMin = min > 0 ? Math.max(raw, min) : raw;
  return cap > 0 ? Math.min(withMin, cap) : withMin;
};

export function AchVsCardCalculator() {
  const [amount, setAmount] = React.useState("10000");
  const [perMonth, setPerMonth] = React.useState("12");

  const [cardRate, setCardRate] = React.useState("2.9");
  const [cardFixed, setCardFixed] = React.useState("0.30");

  const [achRate, setAchRate] = React.useState("0.8");
  const [achFixed, setAchFixed] = React.useState("0");
  const [achMin, setAchMin] = React.useState("0");
  const [achCap, setAchCap] = React.useState("5");

  const value = Math.max(0, num(amount));
  const count = Math.max(0, num(perMonth));

  const cr = num(cardRate);
  const cf = num(cardFixed);
  const ar = num(achRate);
  const af = num(achFixed);
  const amin = Math.max(0, num(achMin));
  const acap = Math.max(0, num(achCap));

  const cardCost = (value * cr) / 100 + cf;
  const achCost = achFee(value, ar, af, amin, acap);
  const saving = cardCost - achCost;
  const capped = acap > 0 && (value * ar) / 100 + af > acap;

  const cardEffective = value > 0 ? (cardCost / value) * 100 : 0;
  const achEffective = value > 0 ? (achCost / value) * 100 : 0;

  /**
   * Crossover: the payment size above which ACH is cheaper.
   *
   * Solved by bisection rather than algebra, because the ACH fee is piecewise
   * (percentage, then a minimum floor, then a cap) and a closed-form solution
   * has to know which piece it is in before it can solve. An earlier version
   * solved only the capped branch and reported a crossover of $162 on defaults
   * where ACH is in fact cheaper from the first cent, which is exactly the kind
   * of confidently wrong number this whole section of the site exists to avoid.
   *
   * The difference (card cost minus ACH cost) is non-decreasing whenever the card
   * rate is at or above the ACH rate, which is every real-world case, so there is
   * at most one crossing and bisection finds it. When there is no crossing, say
   * so: "ACH is cheaper at any amount" is a real answer, not a failure.
   */
  const crossover = React.useMemo(() => {
    const diff = (a: number) => (a * cr) / 100 + cf - achFee(a, ar, af, amin, acap);
    const lo = 0.01;
    const hi = 1_000_000;
    if (diff(lo) >= 0) return { kind: "ach-always" as const };
    if (diff(hi) <= 0) return { kind: "card-always" as const };
    let low = lo;
    let high = hi;
    for (let i = 0; i < 60; i += 1) {
      const mid = (low + high) / 2;
      if (diff(mid) < 0) low = mid;
      else high = mid;
    }
    return { kind: "value" as const, value: high };
  }, [cr, cf, ar, af, amin, acap]);

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">The payment</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field id="ach-amount" label="Invoice or payment amount" prefix="$" value={amount} onChange={setAmount} />
                <Field
                  id="ach-count"
                  label="Payments like this per month"
                  value={perMonth}
                  onChange={setPerMonth}
                  hint="Used for the monthly and annual figures."
                />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">Card pricing</p>
            <div className="mt-2.5">
              <FieldGrid>
                <Field id="ach-card-rate" label="Rate" suffix="%" value={cardRate} onChange={setCardRate} />
                <Field id="ach-card-fixed" label="Per transaction" prefix="$" value={cardFixed} onChange={setCardFixed} />
              </FieldGrid>
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">ACH pricing</p>
            <div className="mt-2.5 space-y-4">
              <FieldGrid>
                <Field id="ach-rate" label="Rate" suffix="%" value={achRate} onChange={setAchRate} />
                <Field id="ach-fixed" label="Per transaction" prefix="$" value={achFixed} onChange={setAchFixed} />
              </FieldGrid>
              <FieldGrid>
                <Field
                  id="ach-min"
                  label="Minimum fee"
                  prefix="$"
                  value={achMin}
                  onChange={setAchMin}
                  hint="Square charges $1. Stripe and PayPal charge none."
                />
                <Field
                  id="ach-cap"
                  label="Fee cap"
                  prefix="$"
                  value={achCap}
                  onChange={setAchCap}
                  hint="The number that decides everything. Zero means uncapped."
                />
              </FieldGrid>
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label={saving >= 0 ? "ACH saves you" : "The card is cheaper by"}
            value={money(Math.abs(saving))}
            sub={
              count > 0
                ? `${money(Math.abs(saving) * count)} a month, ${money0(Math.abs(saving) * count * 12)} a year across ${Math.round(count)} payments.`
                : undefined
            }
          />

          <div className="mt-5">
            <ResultRow
              label="Card"
              value={money(cardCost)}
              note={`${pct(cardEffective)} of the payment`}
              emphasis={saving < 0}
            />
            <ResultRow
              label="ACH"
              value={money(achCost)}
              note={
                capped
                  ? `Capped at ${money(acap)}. Uncapped it would be ${money((value * ar) / 100 + af)}.`
                  : `${pct(achEffective)} of the payment`
              }
              emphasis={saving >= 0}
            />
          </div>

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">Crossover</p>
            <div className="mt-2">
              {crossover.kind === "value" ? (
                <ResultRow
                  label="ACH becomes cheaper above"
                  value={money(crossover.value)}
                  note={
                    value >= crossover.value
                      ? "Your payment is above this, so ACH wins."
                      : "Your payment is below this, so the card is fine."
                  }
                  emphasis
                />
              ) : (
                <ResultRow
                  label={
                    crossover.kind === "ach-always"
                      ? "ACH is cheaper at every amount"
                      : "The card is cheaper at every amount"
                  }
                  value="No crossover"
                  note={
                    crossover.kind === "ach-always"
                      ? "With these two fee structures there is no payment size where the card wins."
                      : "Check the ACH rate you entered. This is unusual."
                  }
                  emphasis
                />
              )}
            </div>
          </div>

          <p className="mt-5 rounded border border-border-strong bg-muted px-4 py-3 text-small text-muted-foreground">
            {saving > 20
              ? "At this size the gap is large enough to be worth the friction. Offer ACH as the default on invoices and keep the card as the alternative."
              : saving > 0
                ? "ACH is cheaper, but not by enough to force it. Offer both and let the customer choose."
                : "Stay with the card. Below the crossover the saving is pennies and ACH costs you a slower settlement and a bank detail your customer has to look up."}
          </p>

          <Caveat>
            Fees only. ACH settles in one to three business days rather than same day, and returned
            payments carry their own fee, so factor both in before switching a whole channel.
          </Caveat>
        </div>
      }
    />
  );
}

export default AchVsCardCalculator;
