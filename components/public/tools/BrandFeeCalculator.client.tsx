"use client";

import * as React from "react";
import {
  channelRate,
  defaultChannelId,
  defaultPlanId,
  findChannel,
  getRateCard,
  type RateCardKey,
} from "@/lib/tools-rates";
import {
  CalcShell,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  ModeTabs,
  ResultRow,
  SelectField,
  Verdict,
  money,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * The brand fee calculator, shared by `/tools/stripe-fee-calculator`,
 * `/tools/paypal-fee-calculator` and `/tools/square-fee-calculator`.
 *
 * One component, three tools: the only difference between them is the rate card
 * in `lib/tools.ts`. That matters for correctness as well as size. The calculators
 * currently ranking for these terms are wrong in checkable ways (one prices Square
 * at its pre-2026 in-person rate, another carries a PayPal rate inside a Square
 * calculator), and the reason is that each of them is a separately maintained
 * copy of the same arithmetic. Here there is one implementation and one place
 * where a rate can be wrong.
 *
 * Add-ons are additive percentages on top of the channel rate, which is how all
 * three processors describe them: Stripe's keyed, international and currency
 * conversion surcharges stack, and PayPal's international fee stacks on whichever
 * domestic rate applied.
 */
export function BrandFeeCalculator({ cardKey }: { cardKey: RateCardKey }) {
  const card = getRateCard(cardKey);

  const [mode, setMode] = React.useState<"single" | "monthly">("single");
  const [plan, setPlan] = React.useState(() => defaultPlanId(card));
  const [channel, setChannel] = React.useState(() => defaultChannelId(card));
  const [amount, setAmount] = React.useState("100");
  const [volume, setVolume] = React.useState("25000");
  const [count, setCount] = React.useState("400");
  const [addOns, setAddOns] = React.useState<string[]>([]);

  const activeChannel = findChannel(card, channel);
  const base = channelRate(card, activeChannel, plan);
  const addOnRate = card.addOns
    .filter((a) => addOns.includes(a.id))
    .reduce((sum, a) => sum + a.rate, 0);
  const rate = base.rate + addOnRate;
  const fixed = base.fixed;
  const monthlyPlanFee = card.plans.find((p) => p.id === plan)?.monthly ?? 0;

  const toggleAddOn = (id: string) =>
    setAddOns((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // --- single payment -------------------------------------------------------
  const sale = Math.max(0, num(amount));
  const singleFee = sale > 0 ? (sale * rate) / 100 + fixed : 0;
  const singleNet = sale - singleFee;
  const singleEffective = sale > 0 ? (singleFee / sale) * 100 : 0;

  // --- month ----------------------------------------------------------------
  const monthVolume = Math.max(0, num(volume));
  const monthCount = Math.max(0, num(count));
  const percentCost = (monthVolume * rate) / 100;
  const perItemCost = monthCount * fixed;
  const monthTotal = percentCost + perItemCost + monthlyPlanFee;
  const monthEffective = monthVolume > 0 ? (monthTotal / monthVolume) * 100 : 0;
  const avgTicket = monthCount > 0 ? monthVolume / monthCount : 0;

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "single" | "monthly")}
            options={[
              { value: "single", label: "One payment" },
              { value: "monthly", label: "A month of volume" },
            ]}
          />

          <FieldGrid>
            {card.plans.length > 1 && (
              <SelectField
                id="bfc-plan"
                label="Plan"
                value={plan}
                onChange={setPlan}
                options={card.plans.map((p) => ({
                  value: p.id,
                  label: p.monthly > 0 ? `${p.label} (${money(p.monthly)}/mo)` : p.label,
                }))}
              />
            )}
            <SelectField
              id="bfc-channel"
              label="How the payment was taken"
              value={channel}
              onChange={setChannel}
              options={card.channels.map((c) => ({ value: c.id, label: c.label }))}
              hint={activeChannel?.note}
              className={card.plans.length > 1 ? undefined : "sm:col-span-2"}
            />

            {mode === "single" ? (
              <Field
                id="bfc-amount"
                label="Payment amount"
                prefix="$"
                value={amount}
                onChange={setAmount}
                className="sm:col-span-2"
              />
            ) : (
              <>
                <Field
                  id="bfc-volume"
                  label="Monthly card volume"
                  prefix="$"
                  value={volume}
                  onChange={setVolume}
                />
                <Field
                  id="bfc-count"
                  label="Transactions per month"
                  value={count}
                  onChange={setCount}
                  hint={avgTicket > 0 ? `Average ticket ${money(avgTicket)}` : undefined}
                />
              </>
            )}
          </FieldGrid>

          {card.addOns.length > 0 && (
            <fieldset>
              <legend className="text-label uppercase text-muted-foreground">
                Add-ons that stack on the rate
              </legend>
              <div className="mt-2.5 space-y-2">
                {card.addOns.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={addOns.includes(a.id)}
                      onChange={() => toggleAddOn(a.id)}
                      className="mt-0.5 size-4 shrink-0 rounded border-border-strong accent-[var(--accent)]"
                    />
                    <span className="text-small text-foreground">
                      {a.label}{" "}
                      <span className="text-muted-foreground">
                        (+{a.rate}%{a.note ? `. ${a.note}` : ""})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      }
      results={
        mode === "single" ? (
          <div>
            <Headline
              label={`${card.processorName} takes`}
              value={money(singleFee)}
              sub={`You keep ${money(singleNet)} of a ${money(sale)} payment.`}
            />
            <div className="mt-5">
              <ResultRow label="Rate applied" value={`${pct(rate)} + ${money(fixed)}`} />
              <ResultRow label={`Percentage of ${money(sale)}`} value={money((sale * rate) / 100)} />
              <ResultRow label="Fixed fee" value={money(fixed)} />
              <ResultRow label="Effective rate on this payment" value={pct(singleEffective)} emphasis />
            </div>
            {/* No verdict band here on purpose. The bands score a merchant's
                BLENDED monthly rate. Judging one payment against them would call
                a perfectly standard rate on a small ticket "high", which is a
                property of the fixed fee, not of the deal. Switch to the monthly
                mode and the band means something. */}
            <Caveat>
              Rates checked against {card.processorName}&rsquo;s published US schedule on {card.checked}.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Monthly cost"
              value={money(monthTotal)}
              sub={`${money(monthTotal * 12)} a year at this volume.`}
            />
            <div className="mt-5">
              <ResultRow label={`Percentage (${pct(rate)})`} value={money(percentCost)} />
              <ResultRow
                label={`Per transaction (${money(fixed)} x ${Math.round(monthCount)})`}
                value={money(perItemCost)}
              />
              {monthlyPlanFee > 0 && (
                <ResultRow label="Plan fee" value={money(monthlyPlanFee)} note="Per location" />
              )}
              <ResultRow label="Effective rate" value={pct(monthEffective)} emphasis />
            </div>
            <Verdict effectiveRate={monthEffective} />
            <Caveat>
              Rates checked against {card.processorName}&rsquo;s published US schedule on {card.checked}.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default BrandFeeCalculator;
