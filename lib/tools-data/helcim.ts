/**
 * Helcim volume tiers and the published US interchange bands the Helcim Fee
 * Calculator prices against.
 *
 * Generated reference data for the `/tools/*` calculators. The maintenance
 * contract is in `lib/tools-data/index.ts`: every figure here was read from a
 * primary source on the date recorded beside it, and a checked date must never
 * be moved without re-reading the source.
 *
 * ONE MODULE PER TOOL, ON PURPOSE. `/tools/[tool]` is a single route serving
 * every calculator, so anything a client widget imports lands in the chunk that
 * EVERY tool page loads. Splitting these is what keeps the 290 row MCC table off
 * the Stripe fee calculator. Do not merge them back into one file, and do not
 * import from `lib/tools-data/index.ts` inside a `"use client"` module.
 *
 * ─── Why interchange is a BAND and never a point value ───────────────────────
 *
 * Visa and Mastercard publish interchange as downloadable rate tables, not as a
 * feed, and the rate that applies to a given sale depends on the card product,
 * the merchant category code, the channel, how the transaction authorized and
 * how much data was passed. There are several hundred programs across the two
 * networks. No calculator can know which one a merchant's next sale will land
 * in, and any tool that returns a single precise interchange figure for an
 * unknown merchant is presenting a guess as a fact.
 *
 * So every row below carries a `low`, a `high` and a `defaultRate`, and the
 * default is a NAMED, quoted program from a network rate sheet rather than an
 * average of anything. The widget renders it as an editable input, labelled as
 * an estimate, so a merchant with a statement in front of them can replace it.
 *
 * ─── What is sourced and what is an editorial starting point ────────────────
 *
 * Sourced: every percentage and per-item amount in `HELCIM_INTERCHANGE_ASSUMPTIONS`,
 * and every volume threshold and markup in `HELCIM_VOLUME_TIERS`.
 *
 * Sourced but coarse: the credit versus debit split in `HELCIM_DEFAULTS.mix`.
 * The Federal Reserve Payments Study released July 2026 reports 2024 US
 * general-purpose credit card payments of $6.170 trillion against non-prepaid
 * debit card payments of $4.342 trillion, which is 58.7 percent credit and 41.3
 * percent debit by value. The default mix rounds to 59 and 41.
 *
 * NOT sourced, and labelled as such on the page: how that 41 percent splits
 * between regulated and non-regulated debit, and how the 59 percent splits
 * between plain consumer credit, rewards credit and commercial cards. Those are
 * a starting point for a merchant who has not read their own statement, nothing
 * more, and every one of them is an editable input.
 */

// ---------------------------------------------------------------------------
// Volume tiers
// ---------------------------------------------------------------------------

/** A percentage-plus-per-item price. Percent is a whole number, so 0.4 means 0.4%. */
export interface HelcimRate {
  /** Percentage of the transaction amount. */
  rate: number;
  /** Dollars per transaction. */
  fixed: number;
}

export interface HelcimVolumeTier {
  id: string;
  label: string;
  /** Inclusive lower bound of monthly card volume, in dollars. */
  minVolume: number;
  /** Exclusive upper bound, or null for the top published band. */
  maxVolume: number | null;
  /** Helcim's MARKUP over interchange for card-present sales. Not a total price. */
  inPerson: HelcimRate;
  /** Helcim's MARKUP over interchange for keyed, online and invoice sales. */
  online: HelcimRate;
  source: string;
}

const HELCIM_PRICING_SOURCE =
  "Helcim published US pricing table, helcim.com/pricing, read 5 September 2026";

/**
 * The published ladder. Helcim applies the band automatically on the average of
 * the last three months of processing volume, so unlike a plan upgrade there is
 * nothing to buy and nothing to ask for.
 *
 * There is no sixth band. Above $5,000,000 a month Helcim's own FAQ says to
 * contact sales for custom pricing, so this tool stops where the published
 * schedule stops rather than extrapolating a rate nobody published.
 */
export const HELCIM_VOLUME_TIERS: HelcimVolumeTier[] = [
  {
    id: "t1",
    label: "Under $50K a month",
    minVolume: 0,
    maxVolume: 50000,
    inPerson: { rate: 0.4, fixed: 0.08 },
    online: { rate: 0.5, fixed: 0.25 },
    source: HELCIM_PRICING_SOURCE,
  },
  {
    id: "t2",
    label: "$50K to $100K a month",
    minVolume: 50000,
    maxVolume: 100000,
    inPerson: { rate: 0.35, fixed: 0.07 },
    online: { rate: 0.45, fixed: 0.2 },
    source: HELCIM_PRICING_SOURCE,
  },
  {
    id: "t3",
    label: "$100K to $500K a month",
    minVolume: 100000,
    maxVolume: 500000,
    inPerson: { rate: 0.25, fixed: 0.07 },
    online: { rate: 0.35, fixed: 0.2 },
    source: HELCIM_PRICING_SOURCE,
  },
  {
    id: "t4",
    label: "$500K to $1M a month",
    minVolume: 500000,
    maxVolume: 1000000,
    inPerson: { rate: 0.2, fixed: 0.06 },
    online: { rate: 0.25, fixed: 0.15 },
    source: HELCIM_PRICING_SOURCE,
  },
  {
    id: "t5",
    label: "$1M to $5M a month",
    minVolume: 1000000,
    maxVolume: null,
    inPerson: { rate: 0.15, fixed: 0.06 },
    online: { rate: 0.15, fixed: 0.15 },
    source: HELCIM_PRICING_SOURCE,
  },
];

// ---------------------------------------------------------------------------
// Interchange bands
// ---------------------------------------------------------------------------

/**
 * The five bands, as a union rather than a bare string, so a lookup keyed by
 * band id is total and the calculator never has to defend against a missing
 * row under `noUncheckedIndexedAccess`.
 */
export type HelcimBandId =
  | "regulatedDebit"
  | "exemptDebit"
  | "consumerCredit"
  | "rewardsCredit"
  | "commercial";

/** Iteration order for every table and every allocation. Keep it stable. */
export const HELCIM_BAND_IDS: HelcimBandId[] = [
  "regulatedDebit",
  "exemptDebit",
  "consumerCredit",
  "rewardsCredit",
  "commercial",
];

export interface HelcimInterchangeBand {
  id: HelcimBandId;
  label: string;
  /** Short description of which cards land here, for the widget hint text. */
  note: string;
  /** Card-present interchange. `low` and `high` bound the published programs. */
  cardPresent: HelcimRate & { low: number; high: number; program: string };
  /** Card-not-present, keyed and online interchange. */
  cardNotPresent: HelcimRate & { low: number; high: number; program: string };
  source: string;
}

const VISA_SOURCE =
  "Visa USA Interchange Reimbursement Fees, Visa Supplemental Requirements, rates effective 18 April 2026, usa.visa.com, checked 5 September 2026";
const MASTERCARD_SOURCE =
  "Mastercard 2026 to 2027 US Region Interchange Programs and Rates, effective 17 April 2026, mastercard.com, checked 5 September 2026";

/**
 * Five bands, because five is what a merchant can actually estimate off a
 * statement. The names match the way the networks split their own tables:
 * regulated versus exempt debit is the Durbin line, and consumer credit splits
 * into a plain product and a rewards product before it splits into commercial.
 *
 * `rate` and `fixed` are the DEFAULT, and `program` names the exact rate sheet
 * row the default was taken from. `low` and `high` are the percentage bounds
 * across the published programs for that card type in that channel, so the page
 * can show a range rather than pretending to a precision the networks do not
 * publish.
 */
export const HELCIM_INTERCHANGE_ASSUMPTIONS: HelcimInterchangeBand[] = [
  {
    id: "regulatedDebit",
    label: "Regulated debit",
    note: "Debit issued by a bank with $10 billion or more in assets, capped by the Durbin Amendment. The cheapest card you will ever accept.",
    cardPresent: {
      rate: 0.05,
      fixed: 0.22,
      low: 0.05,
      high: 0.05,
      program: "Regulated POS Debit with Fraud Adjustment, 0.05% + $0.22",
    },
    cardNotPresent: {
      rate: 0.05,
      fixed: 0.22,
      low: 0.05,
      high: 0.05,
      program: "Regulated POS Debit with Fraud Adjustment, 0.05% + $0.22",
    },
    source: `${VISA_SOURCE}. Regulated Visa Check Card is 0.05% + $0.21, with an additional $0.01 to issuers certifying compliance with the interim fraud prevention standards. ${MASTERCARD_SOURCE}: Regulated POS Debit 0.05% + $0.21, with Fraud Adjustment 0.05% + $0.22. The Federal Reserve's own Regulation II data, published 19 December 2025 for calendar year 2024, puts the realised average on covered dual-message transactions at $0.22, or 0.45% of value`,
  },
  {
    id: "exemptDebit",
    label: "Non-regulated debit",
    note: "Debit issued by a bank under the $10 billion Durbin threshold, so the cap does not apply. Costs several times what regulated debit costs.",
    cardPresent: {
      rate: 0.8,
      fixed: 0.15,
      low: 0.7,
      high: 1.19,
      program: "Visa CPS/Retail, Debit, 0.80% + $0.15",
    },
    cardNotPresent: {
      rate: 1.65,
      fixed: 0.15,
      low: 0.65,
      high: 1.65,
      program: "Visa CPS/e-Commerce Basic, Debit, 1.65% + $0.15, matching Mastercard Merit I consumer debit at 1.65% + $0.15",
    },
    source: `${VISA_SOURCE}. Card present low is Mastercard Merit III Tier 1 debit at 0.70% + $0.15 and high is Visa and Mastercard restaurant debit at 1.19% + $0.10. Card-not-present low is Visa CPS/Retail 2 Card Not Present Debit at 0.65% + $0.15 with a $2.00 cap. ${MASTERCARD_SOURCE}. The Federal Reserve's Regulation II data for calendar year 2024, published 19 December 2025, puts the realised average on exempt dual-message transactions at $0.61, or 1.41% of value`,
  },
  {
    id: "consumerCredit",
    label: "Consumer credit, no rewards",
    note: "A plain credit card with no points, miles or cash back attached. Visa calls this All Other Products and Mastercard calls it Core.",
    cardPresent: {
      rate: 1.51,
      fixed: 0.1,
      low: 1.18,
      high: 1.65,
      program: "Visa Retail Credit Performance Threshold III, All Other Products, 1.51% + $0.10",
    },
    cardNotPresent: {
      rate: 1.89,
      fixed: 0.1,
      low: 1.53,
      high: 1.95,
      program: "Visa Product 1, All Other Products, 1.89% + $0.10",
    },
    source: `${VISA_SOURCE}. Card present low is Visa Supermarket Credit Tier 0, All Other Products at 1.18% + $0.05 and high is Mastercard Merit III Base, Core at 1.65% + $0.10. Card-not-present low is Visa Recurring, All Other Products at 1.53% + $0.05 and high is Mastercard Merit I, Core at 1.95% + $0.10. ${MASTERCARD_SOURCE}`,
  },
  {
    id: "rewardsCredit",
    label: "Rewards and premium credit",
    note: "Visa Signature and Infinite, Mastercard World and World Elite. The cards your customers carry because of the points, and the reason a rewards-heavy mix costs more.",
    cardPresent: {
      rate: 2.1,
      fixed: 0.1,
      low: 1.65,
      high: 2.3,
      program: "Visa Retail Credit Performance Threshold III, Visa Signature Preferred, 2.10% + $0.10",
    },
    cardNotPresent: {
      rate: 2.2,
      fixed: 0.1,
      low: 2.04,
      high: 2.6,
      program: "Mastercard Merit I, World, 2.20% + $0.10",
    },
    source: `${VISA_SOURCE}. Card present low is Visa Signature Traditional at 1.65% + $0.10 and high is Visa Infinite Spend Qualified at 2.30% + $0.10, which matches Mastercard Merit III Base, World Elite. Card-not-present low is Visa Product 1, Rewards at 2.04% + $0.10 and high is Mastercard Merit I, World Elite at 2.60% + $0.10. ${MASTERCARD_SOURCE}`,
  },
  {
    id: "commercial",
    label: "Commercial and corporate",
    note: "Business, corporate, purchasing and fleet cards. The most expensive band, and the one that quietly wrecks the effective rate of a B2B seller.",
    cardPresent: {
      rate: 2.5,
      fixed: 0.1,
      low: 1.9,
      high: 3.0,
      program: "Visa Commercial Card Present, 2.50% + $0.10",
    },
    cardNotPresent: {
      rate: 2.7,
      fixed: 0.1,
      low: 2.2,
      high: 3.3,
      program: "Visa Commercial Card Not Present, 2.70% + $0.10",
    },
    source: `${VISA_SOURCE}: Visa Commercial Card Present 2.50% + $0.10, Visa Commercial Card Not Present 2.70% + $0.10, Non-Qualified 2.95% + $0.10. ${MASTERCARD_SOURCE}: Small Business Credit Data Rate II runs 1.90% to 2.25% + $0.10 across Levels 1 to 5, Data Rate I runs 2.65% to 3.00% + $0.10, and Standard runs 2.95% to 3.30% + $0.10`,
  },
];

// ---------------------------------------------------------------------------
// Widget defaults
// ---------------------------------------------------------------------------

/**
 * Share of monthly card VOLUME landing in each interchange band. The five keys
 * match the `id` of each `HelcimInterchangeBand` and must sum to 100.
 */
export type HelcimMix = Record<HelcimBandId, number>;

export interface HelcimDefaults {
  monthlyVolume: number;
  monthlyTransactions: number;
  channel: "inPerson" | "online";
  mix: HelcimMix;
  /** Card network assessment, as a percentage of settled volume. */
  assessmentRate: number;
  /** Card network per-authorization fee, in dollars. */
  assessmentFixed: number;
}

/**
 * The default state the widget renders on the server, so the raw HTML already
 * carries computed dollar figures.
 *
 * $30,000 a month across 500 transactions is a $60 average ticket, which puts
 * the default squarely inside Helcim's entry band and roughly where a single
 * location sits. The card mix is described above: the 41 to 59 debit-to-credit
 * split by value is from the Federal Reserve Payments Study; the split inside
 * each half is an editable starting point.
 *
 * Assessments default to 0.13% plus $0.02 per authorization. The card networks
 * do not publish assessments the way they publish interchange, so this comes off
 * a published acquirer pass-through schedule instead: the Reference Guide for
 * Card Brand Pass Through Fees (Fiserv, Spring 2023 edition), posted by the
 * North Carolina Office of the State Controller as Appendix G in April 2025.
 * That schedule gives a Visa acquirer service fee of 0.13% on debit and 0.14% on
 * credit, a Mastercard acquirer brand volume fee of 0.13% with a further 0.01%
 * on sales of $1,000 or more, a Visa acquirer processing fee of $0.0195 on
 * credit and $0.0155 on debit, and a Mastercard network access and brand usage
 * fee of $0.0195. The realistic band is therefore 0.13% to 0.14% of volume plus
 * about two cents an authorization, and the field is editable because that
 * schedule is dated.
 */
export const HELCIM_DEFAULTS: HelcimDefaults = {
  monthlyVolume: 30000,
  monthlyTransactions: 500,
  channel: "inPerson",
  mix: {
    regulatedDebit: 25,
    exemptDebit: 16,
    consumerCredit: 24,
    rewardsCredit: 30,
    commercial: 5,
  },
  assessmentRate: 0.13,
  assessmentFixed: 0.02,
};
