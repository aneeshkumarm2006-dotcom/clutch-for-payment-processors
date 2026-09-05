"use client";

import * as React from "react";
import type { RateCard } from "@/lib/tools-rates";
import {
  HELCIM_BAND_IDS,
  HELCIM_DEFAULTS,
  HELCIM_INTERCHANGE_ASSUMPTIONS,
  HELCIM_VOLUME_TIERS,
  type HelcimBandId,
  type HelcimMix,
} from "@/lib/tools-data/helcim";
import {
  helcimDefaultInterchange,
  helcimMonthlyCost,
  helcimSinglePayment,
  helcimTierForVolume,
  tierRate,
  type HelcimChannel,
  type HelcimInput,
  type HelcimInterchangeRates,
} from "@/lib/calc/helcim";
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
  bps,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * The Helcim Fee Calculator.
 *
 * Helcim does not have a rate. It has a MARGIN, and the price is interchange
 * plus assessments plus that margin, with the margin stepping down automatically
 * as monthly volume rises. `BrandFeeCalculator` cannot express any of that: it
 * multiplies one published percentage by an amount, which is the right model for
 * Stripe and exactly the wrong model here. Feeding Helcim's 0.40% into a
 * flat-rate widget understates a real bill by roughly two percentage points.
 *
 * Three things this widget does that the pages ranking for "helcim fee
 * calculator" do not:
 *
 *   1. It shows the interchange assumption AS AN INPUT. The networks publish
 *      interchange as rate tables rather than a feed, so no calculator can know
 *      which of several hundred programs a merchant's next sale lands in. Every
 *      band here defaults to a named, quoted program off a 2026 rate sheet and
 *      every one of them is editable. A tool that hides this is hiding the
 *      single largest term in its own answer.
 *   2. It prices the whole volume ladder, not just the band the merchant is in,
 *      so the answer to "is it worth pushing volume onto one account" is a
 *      dollar figure rather than a shrug.
 *   3. It separates Helcim's take from the network cost. On the default month
 *      Helcim keeps about a quarter of the bill. The rest is not negotiable with
 *      any processor, which is the fact that decides whether switching is worth
 *      the afternoon.
 *
 * The rate card arrives as a PROP from `ToolWidget`, a Server Component.
 * `/tools/[tool]` is one route with one client manifest, so importing the
 * `lib/rate-cards` barrel here would ship all ten processors' cards to every
 * calculator page. Same rule for `lib/tools-data`: the narrow module only.
 *
 * The verdict band scores the blended monthly effective rate and nothing else.
 * It is not shown on a single payment, where a perfectly normal price scores
 * badly purely because of the per-item fees.
 */

type Mode = "month" | "single" | "tiers";

type MixState = Record<HelcimBandId, string>;
type IcState = Record<HelcimBandId, { rate: string; fixed: string }>;

const bandLabel = (id: HelcimBandId): string =>
  HELCIM_INTERCHANGE_ASSUMPTIONS.find((b) => b.id === id)?.label ?? id;

const bandNote = (id: HelcimBandId): string =>
  HELCIM_INTERCHANGE_ASSUMPTIONS.find((b) => b.id === id)?.note ?? "";

const seedMix = (mix: HelcimMix): MixState => {
  const out = {} as MixState;
  for (const id of HELCIM_BAND_IDS) out[id] = String(mix[id]);
  return out;
};

const seedIc = (channel: HelcimChannel): IcState => {
  const defaults = helcimDefaultInterchange(HELCIM_INTERCHANGE_ASSUMPTIONS, channel);
  const out = {} as IcState;
  for (const id of HELCIM_BAND_IDS) {
    out[id] = { rate: String(defaults[id].rate), fixed: defaults[id].fixed.toFixed(2) };
  }
  return out;
};

export function HelcimFeeCalculator({ card }: { card: RateCard }) {
  const [mode, setMode] = React.useState<Mode>("month");
  const [channel, setChannel] = React.useState<HelcimChannel>(HELCIM_DEFAULTS.channel);
  const [volume, setVolume] = React.useState(String(HELCIM_DEFAULTS.monthlyVolume));
  const [count, setCount] = React.useState(String(HELCIM_DEFAULTS.monthlyTransactions));
  const [amount, setAmount] = React.useState("100");
  const [singleBand, setSingleBand] = React.useState<HelcimBandId>("rewardsCredit");
  const [mix, setMix] = React.useState<MixState>(() => seedMix(HELCIM_DEFAULTS.mix));
  const [customIc, setCustomIc] = React.useState(false);
  const [ic, setIc] = React.useState<IcState>(() => seedIc(HELCIM_DEFAULTS.channel));
  const [assessRate, setAssessRate] = React.useState(String(HELCIM_DEFAULTS.assessmentRate));
  const [assessFixed, setAssessFixed] = React.useState(HELCIM_DEFAULTS.assessmentFixed.toFixed(2));

  /**
   * Turning the override ON reseeds from the current channel's published
   * defaults, so the first thing a merchant sees is the real starting point
   * rather than whatever the last channel left behind. Changing channel while
   * the override is on deliberately leaves the numbers alone: they are the
   * merchant's own figures at that point, not ours to overwrite.
   */
  const toggleCustomIc = () => {
    setCustomIc((prev) => {
      if (!prev) setIc(seedIc(channel));
      return !prev;
    });
  };

  const interchange = React.useMemo<HelcimInterchangeRates>(() => {
    if (!customIc) return helcimDefaultInterchange(HELCIM_INTERCHANGE_ASSUMPTIONS, channel);
    const out = {} as HelcimInterchangeRates;
    for (const id of HELCIM_BAND_IDS) {
      out[id] = { rate: Math.max(0, num(ic[id].rate)), fixed: Math.max(0, num(ic[id].fixed)) };
    }
    return out;
  }, [customIc, channel, ic]);

  const mixNumbers = React.useMemo<HelcimMix>(() => {
    const out = {} as HelcimMix;
    for (const id of HELCIM_BAND_IDS) out[id] = Math.max(0, num(mix[id]));
    return out;
  }, [mix]);

  const mixTotal = HELCIM_BAND_IDS.reduce((sum, id) => sum + mixNumbers[id], 0);

  const input: HelcimInput = {
    monthlyVolume: Math.max(0, num(volume)),
    monthlyTransactions: Math.max(0, num(count)),
    channel,
    mix: mixNumbers,
    interchange,
    assessmentRate: Math.max(0, num(assessRate)),
    assessmentFixed: Math.max(0, num(assessFixed)),
    tiers: HELCIM_VOLUME_TIERS,
  };

  const result = helcimMonthlyCost(input);
  const singleTier = helcimTierForVolume(input.monthlyVolume, HELCIM_VOLUME_TIERS);
  const single = helcimSinglePayment(input, singleBand, Math.max(0, num(amount)), singleTier);
  const markupShare = result.total > 0 ? (result.markup / result.total) * 100 : 0;
  const markup = tierRate(result.tier, channel);
  const channelLabel =
    card.channels.find((c) => c.id === channel)?.label ??
    (channel === "inPerson" ? "In person" : "Keyed and online");

  const channelField = (
    <SelectField
      id="hlc-channel"
      label="How the card is taken"
      value={channel}
      onChange={(v) => setChannel(v === "online" ? "online" : "inPerson")}
      options={card.channels.map((c) => ({ value: c.id, label: c.label }))}
      hint="Helcim publishes a lower margin for card present than for keyed and online."
    />
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[
              { value: "month", label: "What a month costs" },
              { value: "single", label: "What one payment costs" },
              { value: "tiers", label: "Volume tiers" },
            ]}
          />

          {mode === "single" ? (
            <div className="space-y-4">
              <FieldGrid>
                <Field id="hlc-amount" label="Payment amount" prefix="$" value={amount} onChange={setAmount} />
                <SelectField
                  id="hlc-band"
                  label="Card type"
                  value={singleBand}
                  onChange={(v) => setSingleBand(v as HelcimBandId)}
                  options={HELCIM_BAND_IDS.map((id) => ({ value: id, label: bandLabel(id) }))}
                />
              </FieldGrid>
              {channelField}
              <Field
                id="hlc-vol-single"
                label="Your monthly card volume"
                prefix="$"
                value={volume}
                onChange={setVolume}
                hint="Only used to pick which volume band your margin comes from."
              />
              <p className="text-micro text-muted-foreground">{bandNote(singleBand)}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <FieldGrid>
                <Field
                  id="hlc-volume"
                  label="Monthly card volume"
                  prefix="$"
                  value={volume}
                  onChange={setVolume}
                  hint="Helcim bands you on the average of your last three months."
                />
                <Field
                  id="hlc-count"
                  label="Transactions a month"
                  value={count}
                  onChange={setCount}
                  hint={`Average ticket ${money(result.averageTicket)}.`}
                />
              </FieldGrid>
              {channelField}

              {mode === "month" && (
                <div className="space-y-3">
                  <div>
                    <p className="text-label uppercase text-muted-foreground">Card mix, as a share of volume</p>
                    <p className="mt-1 text-micro text-muted-foreground">
                      Off your statement if you have it. The defaults split 41 percent debit to 59 percent credit,
                      which is the US value share the Federal Reserve Payments Study reported for 2024.
                    </p>
                  </div>
                  <FieldGrid>
                    {HELCIM_BAND_IDS.map((id) => (
                      <Field
                        key={id}
                        id={`hlc-mix-${id}`}
                        label={bandLabel(id)}
                        suffix="%"
                        value={mix[id]}
                        onChange={(v) => setMix((prev) => ({ ...prev, [id]: v }))}
                      />
                    ))}
                  </FieldGrid>
                  {Math.abs(mixTotal - 100) > 0.5 && (
                    <p className="text-micro text-muted-foreground">
                      Your mix adds up to {pct(mixTotal, 1)}. The shares are normalized to your total, so the answer
                      is still consistent, but it is easier to read if they sum to 100.
                    </p>
                  )}

                  <CheckboxRow
                    checked={customIc}
                    onChange={toggleCustomIc}
                    label="Use my own interchange figures"
                    hint="The defaults are named programs off the April 2026 Visa and Mastercard US rate sheets. They are an estimate, not your rate."
                  />

                  {customIc && (
                    <div className="space-y-4 rounded border border-border-strong bg-muted px-4 py-4">
                      {HELCIM_BAND_IDS.map((id) => (
                        <FieldGrid key={id}>
                          <Field
                            id={`hlc-ic-rate-${id}`}
                            label={`${bandLabel(id)} rate`}
                            suffix="%"
                            value={ic[id].rate}
                            onChange={(v) =>
                              setIc((prev) => ({ ...prev, [id]: { ...prev[id], rate: v } }))
                            }
                          />
                          <Field
                            id={`hlc-ic-fixed-${id}`}
                            label={`${bandLabel(id)} per item`}
                            prefix="$"
                            value={ic[id].fixed}
                            onChange={(v) =>
                              setIc((prev) => ({ ...prev, [id]: { ...prev[id], fixed: v } }))
                            }
                          />
                        </FieldGrid>
                      ))}
                      <FieldGrid>
                        <Field
                          id="hlc-assess-rate"
                          label="Assessments"
                          suffix="%"
                          value={assessRate}
                          onChange={setAssessRate}
                          hint="Of settled volume."
                        />
                        <Field
                          id="hlc-assess-fixed"
                          label="Per authorization"
                          prefix="$"
                          value={assessFixed}
                          onChange={setAssessFixed}
                        />
                      </FieldGrid>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      }
      results={
        mode === "single" ? (
          <div>
            <Headline
              label={`Fee on this ${bandLabel(singleBand).toLowerCase()} payment`}
              value={money(single.total)}
              sub={`${pct(single.effectiveRatePct)} of the sale. You net ${money(single.net)}.`}
            />
            <div className="mt-5">
              <ResultRow
                label="Interchange"
                value={money(single.interchange)}
                note={`${pct(interchange[singleBand].rate)} + ${money(interchange[singleBand].fixed)}, set by the card network`}
              />
              <ResultRow
                label="Assessments"
                value={money(single.assessments)}
                note={`${pct(input.assessmentRate)} + ${money(input.assessmentFixed)}, also the network`}
              />
              <ResultRow
                label={`Helcim margin (${result.tier.label})`}
                value={money(single.markup)}
                note={`${pct(markup.rate)} + ${money(markup.fixed)} on ${channelLabel.toLowerCase()}`}
              />
              <ResultRow label="Total fee" value={money(single.total)} emphasis />
            </div>

            <Callout>
              Helcim keeps <strong className="text-foreground">{money(single.markup)}</strong> of this fee. The other{" "}
              {money(single.interchange + single.assessments)} goes to the card networks and the issuing bank, and no
              processor can discount it. Switching processors moves the first number and never the second.
            </Callout>

            <Caveat>
              No verdict band on a single payment. The bands score a merchant&rsquo;s blended monthly rate, and judging
              one small sale against them marks perfectly normal pricing as high, which is a property of the per-item
              fees rather than of the deal.
            </Caveat>
          </div>
        ) : mode === "tiers" ? (
          <div>
            <Headline
              label="Your volume band"
              value={result.tier.label}
              sub={`Helcim margin ${pct(markup.rate)} + ${money(markup.fixed)} on ${channelLabel.toLowerCase()}.`}
            />

            <div className="mt-5">
              <MiniTable
                columns={["Band", "Margin", "Month total", "Rate"]}
                align={["left", "right", "right", "right"]}
                rows={result.ladder.map((row) => [
                  <span key={row.tier.id}>
                    <span className="text-foreground">{row.tier.label}</span>
                    {row.current && (
                      <span className="ml-2 align-middle">
                        <Pill tone="good">You</Pill>
                      </span>
                    )}
                  </span>,
                  <span key={`${row.tier.id}-m`}>{money0(row.markup)}</span>,
                  <span key={`${row.tier.id}-t`}>{money0(row.total)}</span>,
                  <span key={`${row.tier.id}-r`}>{pct(row.effectiveRatePct)}</span>,
                ])}
              />
            </div>

            {result.nextTier ? (
              <Callout tone="neutral">
                The next band starts at {money0(result.nextTier.thresholdVolume)} a month, which is{" "}
                {money0(result.nextTier.extraVolumeNeeded)} more than you run now. At that volume and the same{" "}
                {money(result.averageTicket)} ticket, the margin falls from{" "}
                {money(result.nextTier.markupAtThresholdNow)} to {money(result.nextTier.markupAtThresholdNext)} a month.
                That is <strong className="text-foreground">{money(result.nextTier.monthlySaving)} a month</strong>,{" "}
                {money0(result.nextTier.annualSaving)} a year, or {bps(result.nextTier.savingBps / 100)} off your
                effective rate.
              </Callout>
            ) : (
              <Callout tone="neutral">
                You are in the top published band. Above {money0(1000000)} a month Helcim stops publishing a rate and
                quotes custom pricing, so this calculator stops there rather than extrapolating a number nobody
                published.
              </Callout>
            )}

            <Caveat>
              The band is automatic and costs nothing to reach, so there is no break-even to clear the way there is on a
              paid plan. Interchange and assessments are identical in every row above: the only thing that changes down
              the ladder is Helcim&rsquo;s own margin.
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label="Total processing cost this month"
              value={money(result.total)}
              sub={`${pct(result.effectiveRatePct)} effective, ${money(result.perTransaction)} per sale on a ${money(result.averageTicket)} average ticket.`}
            />

            <div className="mt-5">
              <ResultRow
                label="Interchange, estimated"
                value={money(result.interchange)}
                note={`${pct(result.interchangeRatePct)} of volume, set by the card networks`}
              />
              <ResultRow
                label="Assessments"
                value={money(result.assessments)}
                note={`${pct(input.assessmentRate)} of volume + ${money(input.assessmentFixed)} an authorization`}
              />
              <ResultRow
                label="Helcim margin"
                value={money(result.markup)}
                note={`${pct(markup.rate)} + ${money(markup.fixed)}, which is ${bps(result.markupRatePct)} of volume`}
              />
              <ResultRow label="Total" value={money(result.total)} emphasis />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Where the interchange goes</p>
              <div className="mt-2">
                <MiniTable
                  columns={["Card type", "Volume", "Interchange", "Rate"]}
                  align={["left", "right", "right", "right"]}
                  rows={result.bands.map((b) => [
                    <span key={b.id} className="text-foreground">
                      {bandLabel(b.id)}
                    </span>,
                    <span key={`${b.id}-v`}>{money0(b.volume)}</span>,
                    <span key={`${b.id}-i`}>{money0(b.interchange)}</span>,
                    <span key={`${b.id}-r`}>{pct(b.ratePct)}</span>,
                  ])}
                />
              </div>
            </div>

            <Verdict effectiveRate={result.effectiveRatePct} />

            <Callout tone={markupShare < 35 ? "good" : "neutral"}>
              Helcim keeps <strong className="text-foreground">{money(result.markup)}</strong> of this bill,{" "}
              {pct(markupShare, 0)} of it. The other {money(result.interchange + result.assessments)} is card network
              cost that follows you to any processor. That is the number to look at before you switch: the most any
              move can save you is the margin, not the total.
            </Callout>

            <Caveat>
              Interchange is an estimate, not your rate. {card.processorName}&rsquo;s margin above is published and
              checked {card.checked}; the interchange underneath it is a band, because Visa and Mastercard publish
              several hundred programs as rate tables and no calculator can know which one your next sale lands in.
              Tick the box to put your own statement figures in.
            </Caveat>
          </div>
        )
      }
    />
  );
}

export default HelcimFeeCalculator;
