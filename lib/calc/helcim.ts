/**
 * The interchange-plus cost model behind the Helcim Fee Calculator.
 *
 * Client-safe: no `@/models`, no I/O, no `Date.now()`. Pure functions over the
 * reference data in `lib/tools-data/helcim.ts`.
 *
 * ─── Why this is its own module and not three lines inside the widget ───────
 *
 * A flat-rate fee is one multiplication and one addition. An interchange-plus
 * bill is not. It is three separate charges stacked on the same sale, and every
 * one of them has both a percentage and a per-item component:
 *
 *   1. Interchange, which the card networks set and which differs by card type.
 *   2. Assessments, which the networks charge on top and which nobody publishes.
 *   3. The processor's markup, which for Helcim depends on your monthly volume.
 *
 * Getting that wrong is silent. Model a mixed card portfolio at one blended
 * interchange rate and a merchant taking mostly regulated debit is overcharged
 * by more than a point; drop the per-item components and a merchant with a $12
 * average ticket is undercharged by about 40 basis points. Neither one throws.
 *
 * ─── The failure modes this file is written to avoid ────────────────────────
 *
 * ROUNDING DIRECTION AND INTEGER CENTS. Every money figure is computed in
 * integer cents and rounded half up, which is the direction a processor rounds.
 * A merchant checking a monthly total against a Helcim statement is doing so
 * precisely because they suspect it is wrong, so a float artefact of a hundredth
 * of a cent in the twelfth decimal is not acceptable output.
 *
 * SPLITTING VOLUME ACROSS BANDS WITHOUT LOSING A CENT. The card mix is a set of
 * percentages, and percentages of an integer number of cents do not come out
 * integral. `allocateWholeUnits` distributes by the largest-remainder method, so
 * the parts always sum EXACTLY to the whole. Rounding each share independently
 * loses or invents up to four cents a month on volume and, far worse, up to four
 * transactions out of the transaction count, which then silently changes every
 * per-item fee.
 *
 * THE TIER LADDER IS NOT A BREAK-EVEN. Helcim's volume discount costs nothing to
 * take: there is no plan fee to recover, and the band applies automatically on
 * your three-month average. So there is no crossover volume where a cheaper tier
 * "starts paying for itself" in the sense the phrase usually means. The number
 * that matters is what CROSSING the published threshold is worth, computed by
 * holding the average ticket constant and repricing the same month one band
 * down. `helcimNextTierStep` returns exactly that, and returns null at the top
 * of the published ladder rather than extrapolating a rate Helcim never
 * published.
 *
 * SPLITTING THE TRANSACTION COUNT BY VOLUME SHARE ASSUMES ONE AVERAGE TICKET.
 * It does, and that is stated on the page. In reality debit tickets run smaller
 * than rewards-credit tickets, which pushes real per-item interchange up a
 * little relative to this model. Modelling a separate average ticket per band
 * would need five more inputs nobody has to hand.
 */

import {
  HELCIM_BAND_IDS,
  type HelcimBandId,
  type HelcimInterchangeBand,
  type HelcimMix,
  type HelcimRate,
  type HelcimVolumeTier,
} from "@/lib/tools-data/helcim";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Round half UP, which is the direction a processor rounds a fee. `Math.round`
 * rounds half away from zero, so the two agree on the positive amounts this
 * module deals in; writing it out is about intent, not about behaviour.
 */
export const roundHalfUp = (n: number): number =>
  Number.isFinite(n) ? Math.floor(n + 0.5) : 0;

const toCents = (dollars: number): number => roundHalfUp(Math.max(0, dollars) * 100);

/**
 * Split `total` whole units across `shares` so the parts sum EXACTLY to `total`.
 *
 * Largest-remainder method: floor every exact share, then hand the leftover
 * units out one at a time to the largest fractional remainders, ties broken by
 * position so the result is deterministic. Used for both the volume in cents and
 * the transaction count, and the exactness is the whole point. Rounding each
 * share on its own can lose four cents and four transactions off a five-band
 * split, and the missing transactions quietly shrink every per-item fee.
 */
export function allocateWholeUnits(total: number, shares: number[]): number[] {
  const n = shares.length;
  const zeros = new Array<number>(n).fill(0);
  const whole = Math.max(0, Math.floor(total));
  const sum = shares.reduce((a, b) => a + Math.max(0, b), 0);
  if (!Number.isFinite(whole) || whole <= 0 || sum <= 0) return zeros;

  const exact = shares.map((s) => (whole * Math.max(0, s)) / sum);
  const out = exact.map((v) => Math.floor(v));
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  let left = whole - out.reduce((a, b) => a + b, 0);
  let k = 0;
  while (left > 0 && order.length > 0) {
    const slot = order[k % order.length];
    if (!slot) break;
    out[slot.i] = (out[slot.i] ?? 0) + 1;
    left -= 1;
    k += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HelcimChannel = "inPerson" | "online";

/** Interchange the calculator should apply, one rate per band. Editable by the user. */
export type HelcimInterchangeRates = Record<HelcimBandId, HelcimRate>;

export interface HelcimInput {
  /** Monthly card volume in dollars. Helcim bands you on your three-month average. */
  monthlyVolume: number;
  monthlyTransactions: number;
  channel: HelcimChannel;
  /** Share of VOLUME per band, in percent. Need not sum to 100; it is normalised. */
  mix: HelcimMix;
  interchange: HelcimInterchangeRates;
  /** Card network assessment as a percentage of settled volume. */
  assessmentRate: number;
  /** Card network per-authorization fee, in dollars. */
  assessmentFixed: number;
  tiers: HelcimVolumeTier[];
}

export interface HelcimCost {
  interchange: number;
  assessments: number;
  markup: number;
  total: number;
  /** Total cost as a percentage of volume. This is the figure the verdict bands score. */
  effectiveRatePct: number;
  /** Interchange alone as a percentage of volume, per-item components included. */
  interchangeRatePct: number;
  /** Helcim's own take as a percentage of volume, per-item component included. */
  markupRatePct: number;
  perTransaction: number;
}

export interface HelcimBandLine {
  id: HelcimBandId;
  /** Volume apportioned to this band, in dollars. */
  volume: number;
  transactions: number;
  rate: HelcimRate;
  interchange: number;
  /** Interchange on this band as a percentage of the band's volume. */
  ratePct: number;
}

export interface HelcimLadderRow {
  tier: HelcimVolumeTier;
  markup: number;
  total: number;
  effectiveRatePct: number;
  /** Positive means this tier is cheaper than the one the merchant is in today. */
  monthlySavingVsCurrent: number;
  current: boolean;
}

export interface HelcimTierStep {
  tier: HelcimVolumeTier;
  thresholdVolume: number;
  extraVolumeNeeded: number;
  transactionsAtThreshold: number;
  markupAtThresholdNow: number;
  markupAtThresholdNext: number;
  monthlySaving: number;
  annualSaving: number;
  /** The saving expressed against the threshold volume, in basis points. */
  savingBps: number;
}

export interface HelcimResult extends HelcimCost {
  tier: HelcimVolumeTier;
  averageTicket: number;
  bands: HelcimBandLine[];
  ladder: HelcimLadderRow[];
  nextTier: HelcimTierStep | null;
}

// ---------------------------------------------------------------------------
// Rate helpers
// ---------------------------------------------------------------------------

const EMPTY_RATE: HelcimRate = { rate: 0, fixed: 0 };

/** The published markup for a tier in a channel. Never a total price. */
export const tierRate = (tier: HelcimVolumeTier, channel: HelcimChannel): HelcimRate =>
  channel === "inPerson" ? tier.inPerson : tier.online;

/**
 * Which published band a monthly volume lands in.
 *
 * Bands are half-open, `minVolume` inclusive and `maxVolume` exclusive, so a
 * merchant on exactly $50,000 gets the better rate. Helcim publishes the
 * boundaries as "$0 - $50K" and "$50K - $100K" without saying which side the
 * boundary falls on; resolving the ambiguity in the merchant's favour is the
 * only choice that cannot overstate what they will be charged.
 */
export function helcimTierForVolume(
  volume: number,
  tiers: HelcimVolumeTier[],
): HelcimVolumeTier {
  const first = tiers[0];
  const last = tiers[tiers.length - 1];
  const fallback: HelcimVolumeTier = first ?? {
    id: "none",
    label: "Unpriced",
    minVolume: 0,
    maxVolume: null,
    inPerson: EMPTY_RATE,
    online: EMPTY_RATE,
    source: "",
  };
  const v = Math.max(0, volume);
  const found = tiers.find((t) => v >= t.minVolume && (t.maxVolume === null || v < t.maxVolume));
  return found ?? last ?? fallback;
}

/** Build the default interchange table for a channel out of the published bands. */
export function helcimDefaultInterchange(
  bands: HelcimInterchangeBand[],
  channel: HelcimChannel,
): HelcimInterchangeRates {
  const out = {} as HelcimInterchangeRates;
  for (const id of HELCIM_BAND_IDS) {
    const band = bands.find((b) => b.id === id);
    const side = band ? (channel === "inPerson" ? band.cardPresent : band.cardNotPresent) : null;
    out[id] = side ? { rate: side.rate, fixed: side.fixed } : EMPTY_RATE;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The cost model
// ---------------------------------------------------------------------------

/**
 * Interchange on a month of volume, split across the five bands.
 *
 * Volume cents and transaction counts are apportioned with
 * `allocateWholeUnits`, so both sum exactly to the totals the merchant entered.
 */
function interchangeCents(
  volumeCents: number,
  transactions: number,
  mix: HelcimMix,
  rates: HelcimInterchangeRates,
): { total: number; lines: HelcimBandLine[] } {
  const shares = HELCIM_BAND_IDS.map((id) => Math.max(0, mix[id]));
  const volParts = allocateWholeUnits(volumeCents, shares);
  const txnParts = allocateWholeUnits(transactions, shares);

  let total = 0;
  const lines: HelcimBandLine[] = [];

  HELCIM_BAND_IDS.forEach((id, i) => {
    const vol = volParts[i] ?? 0;
    const txn = txnParts[i] ?? 0;
    const rate = rates[id];
    const cents = roundHalfUp((vol * rate.rate) / 100) + txn * toCents(rate.fixed);
    total += cents;
    lines.push({
      id,
      volume: vol / 100,
      transactions: txn,
      rate,
      interchange: cents / 100,
      ratePct: vol > 0 ? (cents / vol) * 100 : 0,
    });
  });

  return { total, lines };
}

const percentPlusPerItemCents = (
  volumeCents: number,
  transactions: number,
  rate: HelcimRate,
): number => roundHalfUp((volumeCents * rate.rate) / 100) + transactions * toCents(rate.fixed);

/**
 * The three charges on a month of Helcim volume, priced at a given tier.
 *
 * Exported because the tier ladder reprices the same month at every band, and
 * repricing has to use the identical code path or the comparison is worthless.
 */
export function helcimCostAtTier(
  input: HelcimInput,
  tier: HelcimVolumeTier,
  overrideVolume?: number,
  overrideTransactions?: number,
): HelcimCost {
  const volume = Math.max(0, overrideVolume ?? input.monthlyVolume);
  const txns = Math.max(0, Math.round(overrideTransactions ?? input.monthlyTransactions));
  const volumeCents = toCents(volume);

  const ic = interchangeCents(volumeCents, txns, input.mix, input.interchange);
  const assessCents = percentPlusPerItemCents(volumeCents, txns, {
    rate: Math.max(0, input.assessmentRate),
    fixed: Math.max(0, input.assessmentFixed),
  });
  const markupCents = percentPlusPerItemCents(volumeCents, txns, tierRate(tier, input.channel));
  const totalCents = ic.total + assessCents + markupCents;

  return {
    interchange: ic.total / 100,
    assessments: assessCents / 100,
    markup: markupCents / 100,
    total: totalCents / 100,
    effectiveRatePct: volumeCents > 0 ? (totalCents / volumeCents) * 100 : 0,
    interchangeRatePct: volumeCents > 0 ? (ic.total / volumeCents) * 100 : 0,
    markupRatePct: volumeCents > 0 ? (markupCents / volumeCents) * 100 : 0,
    perTransaction: txns > 0 ? totalCents / txns / 100 : 0,
  };
}

/**
 * What crossing into the next published band is worth.
 *
 * The comparison holds the AVERAGE TICKET constant and reprices the threshold
 * month twice, once at today's markup and once at the next band's, because the
 * only thing that changes at a threshold is the markup: interchange and
 * assessments are the same charges on the same cards either way. Returns null on
 * the top published band, where Helcim quotes custom pricing rather than
 * publishing a rate, and null when the merchant is already past every threshold.
 */
export function helcimNextTierStep(input: HelcimInput, current: HelcimVolumeTier): HelcimTierStep | null {
  const idx = input.tiers.findIndex((t) => t.id === current.id);
  const next = idx >= 0 ? input.tiers[idx + 1] : undefined;
  if (!next) return null;

  const volume = Math.max(0, input.monthlyVolume);
  const txns = Math.max(0, Math.round(input.monthlyTransactions));
  const ticket = txns > 0 ? volume / txns : 0;
  const threshold = next.minVolume;
  const txnsAtThreshold = ticket > 0 ? Math.max(1, Math.round(threshold / ticket)) : txns;

  const thresholdCents = toCents(threshold);
  const nowCents = percentPlusPerItemCents(thresholdCents, txnsAtThreshold, tierRate(current, input.channel));
  const nextCents = percentPlusPerItemCents(thresholdCents, txnsAtThreshold, tierRate(next, input.channel));
  const savingCents = nowCents - nextCents;

  return {
    tier: next,
    thresholdVolume: threshold,
    extraVolumeNeeded: Math.max(0, threshold - volume),
    transactionsAtThreshold: txnsAtThreshold,
    markupAtThresholdNow: nowCents / 100,
    markupAtThresholdNext: nextCents / 100,
    monthlySaving: savingCents / 100,
    annualSaving: (savingCents * 12) / 100,
    savingBps: thresholdCents > 0 ? (savingCents / thresholdCents) * 10000 : 0,
  };
}

/**
 * The whole answer: this month's cost, the same month repriced at every
 * published band, and what the next threshold is worth.
 */
export function helcimMonthlyCost(input: HelcimInput): HelcimResult {
  const tier = helcimTierForVolume(input.monthlyVolume, input.tiers);
  const cost = helcimCostAtTier(input, tier);

  const volumeCents = toCents(Math.max(0, input.monthlyVolume));
  const txns = Math.max(0, Math.round(input.monthlyTransactions));
  const bands = interchangeCents(volumeCents, txns, input.mix, input.interchange).lines;

  const ladder: HelcimLadderRow[] = input.tiers.map((t) => {
    const c = helcimCostAtTier(input, t);
    return {
      tier: t,
      markup: c.markup,
      total: c.total,
      effectiveRatePct: c.effectiveRatePct,
      monthlySavingVsCurrent: roundHalfUp((cost.total - c.total) * 100) / 100,
      current: t.id === tier.id,
    };
  });

  return {
    ...cost,
    tier,
    averageTicket: txns > 0 ? Math.max(0, input.monthlyVolume) / txns : 0,
    bands,
    ladder,
    nextTier: helcimNextTierStep(input, tier),
  };
}

// ---------------------------------------------------------------------------
// A single payment
// ---------------------------------------------------------------------------

export interface HelcimSingleResult {
  amount: number;
  interchange: number;
  assessments: number;
  markup: number;
  total: number;
  net: number;
  effectiveRatePct: number;
}

/**
 * One payment on one card type, priced at a given tier.
 *
 * Deliberately NOT scored against the verdict bands. Those bands describe a
 * merchant's blended monthly rate; judging a single small payment against them
 * labels perfectly normal pricing as high, which is a property of the per-item
 * fees rather than of the deal.
 */
export function helcimSinglePayment(
  input: HelcimInput,
  bandId: HelcimBandId,
  amount: number,
  tier: HelcimVolumeTier,
): HelcimSingleResult {
  const amountCents = toCents(amount);
  const ic = percentPlusPerItemCents(amountCents, 1, input.interchange[bandId]);
  const assess = percentPlusPerItemCents(amountCents, 1, {
    rate: Math.max(0, input.assessmentRate),
    fixed: Math.max(0, input.assessmentFixed),
  });
  const markup = percentPlusPerItemCents(amountCents, 1, tierRate(tier, input.channel));
  const totalCents = ic + assess + markup;

  return {
    amount: amountCents / 100,
    interchange: ic / 100,
    assessments: assess / 100,
    markup: markup / 100,
    total: totalCents / 100,
    net: (amountCents - totalCents) / 100,
    effectiveRatePct: amountCents > 0 ? (totalCents / amountCents) * 100 : 0,
  };
}
