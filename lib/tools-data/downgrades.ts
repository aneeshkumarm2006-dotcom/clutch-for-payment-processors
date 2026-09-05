/**
 * Interchange downgrades: what triggers them and what the fall costs
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
 * ─── Why every delta is a pair of published rows, never a market estimate ────
 *
 * A downgrade has no price of its own. It is the difference between two rows on
 * a network rate sheet: the program the transaction was eligible for, and the
 * program it actually cleared in. So every `deltaPct` and `deltaCents` below is
 * arithmetic on two rows that are quoted verbatim in `fromProgram` and
 * `toProgram`, from the schedules named in `source`. Nothing here is an industry
 * average, a survey figure, or a number an ISO put in a sales deck. If a rate
 * sheet moves, change the two quoted rows and recompute the delta; do not adjust
 * the delta on its own, because then the page can no longer show its working.
 *
 * ─── The two rate sheets ────────────────────────────────────────────────────
 *
 * VISA. "Visa USA Interchange Reimbursement Fees, Visa Supplemental
 * Requirements", rates effective 18 April 2026, downloaded from usa.visa.com on
 * 5 September 2026. Two things about this edition matter and are easy to miss:
 *
 *   1. Visa consumer credit no longer has EIRF and Standard rows. The whole
 *      fallback is one line, "Non-Qualified Consumer Credit", at 3.15% + $0.10,
 *      identical across all six card product columns and identical in the card
 *      present and card not present tables. EIRF and Standard survive only on
 *      exempt consumer debit, where they are 1.75% + $0.20 and 1.90% + $0.25.
 *   2. Section E, Corporate and Purchasing, no longer carries a general
 *      Commercial Level II row. The only Level II line left is
 *      "Commercial Level II, Fuel" at 2.20% + $0.10. That is the Commercial
 *      Enhanced Data Program transition: Level 3 was replaced by Commercial
 *      Product 3 in October 2025 and Level 2 retired in April 2026 outside
 *      fleet and fuel. The observation is ours, straight off the sheet; the
 *      dates come from processor documentation cited on the row.
 *
 * MASTERCARD. "Mastercard 2026 to 2027 U.S. Region Interchange Programs and
 * Rates", effective 17 April 2026. mastercard.com returns HTTP 403 to this
 * machine, so it was read from the Internet Archive capture dated 16 June 2026,
 * which is therefore the honest `checked` date for those rows.
 *
 * ─── One corroboration worth keeping ────────────────────────────────────────
 *
 * Visa labels its small business data levels "Business Product 1 / 2 / 3" and
 * does not say in the rate sheet that the number is the data level. Mastercard
 * labels the same ladder "Data Rate I / II / III" and does. At the base tier the
 * two sheets agree to the cent: Visa Business Product 1 is 2.65% + $0.10 and
 * Mastercard Data Rate I is 2.65% + $0.10; Visa Business Product 2 is
 * 1.90% + $0.10 and Mastercard Data Rate II is 1.90% + $0.10. That agreement is
 * why the Visa Product numbering is read as the data level here. It is an
 * inference, it is flagged as one on the page, and the quoted rows stand on
 * their own if the inference is ever shown to be wrong.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Which pool of volume a cause can touch.
 *
 * `all` reasons are qualification failures that hit any card: a stale batch does
 * not care what was in the terminal. `commercial` reasons can only touch the
 * share of volume running on corporate, purchasing, fleet and small business
 * cards, because consumer cards have no enhanced data programs to miss.
 *
 * The distinction is load bearing in `lib/calc/downgrade.ts`: a commercial
 * reason is capped at the merchant's commercial share before anything else
 * happens to it.
 */
export type DowngradeBasis = "all" | "commercial";

export interface DowngradeReason {
  id: string;
  label: string;
  basis: DowngradeBasis;
  /** What has to go wrong for this to fire, in the merchant's own terms. */
  trigger: string;
  /** The program the transaction was eligible for, quoted with its rate. */
  fromProgram: string;
  /** The program it actually clears in, quoted with its rate. */
  toProgram: string;
  /** Percentage points of the transaction amount, `toProgram` minus `fromProgram`. */
  deltaPct: number;
  /** Cents per transaction, `toProgram` minus `fromProgram`. Usually zero. */
  deltaCents: number;
  /** What actually fixes it. Not "call your processor". */
  fix: string;
  /** How the delta differs on the other network or the other card type. */
  rangeNote: string;
  /** Share of the reason's pool affected, used as the widget's starting value. */
  defaultSharePct: number;
  /** Whether the widget starts with this cause selected. */
  defaultOn: boolean;
  source: string;
}

/** One rung of the enhanced data ladder, per network, for one commercial card family. */
export interface EnhancedDataRung {
  /** "level1" | "level2" | "level3" */
  id: string;
  label: string;
  /** Visa program name and rate. `null` where Visa has retired the program. */
  visaProgram: string | null;
  visaPct: number | null;
  visaCents: number | null;
  /** Mastercard program name and rate. `null` where Mastercard publishes no such row. */
  mcProgram: string | null;
  mcPct: number | null;
  mcCents: number | null;
}

export interface EnhancedDataLadder {
  id: string;
  label: string;
  /** Which cards this ladder describes, and where the rows were read from. */
  note: string;
  rungs: EnhancedDataRung[];
  source: string;
}

export interface DowngradeDefaults {
  monthlyVolume: number;
  monthlyTransactions: number;
  commercialSharePct: number;
  /** Mode 2 starting state. */
  ladderId: string;
  currentLevel: string;
  targetLevel: string;
}

// ---------------------------------------------------------------------------
// Defaults
//
// Real numbers, not placeholders. The widget server-renders this state, so these
// values are what a crawler and an answer engine read, and they are the same
// figures the page's worked example is written against. A B2B distributor is the
// right default because the enhanced data rows are the headline of the page and
// they are dead volume on a consumer card book.
// ---------------------------------------------------------------------------

export const DOWNGRADE_DEFAULTS: DowngradeDefaults = {
  monthlyVolume: 250000,
  monthlyTransactions: 1000,
  commercialSharePct: 45,
  ladderId: "corporate",
  currentLevel: "level1",
  targetLevel: "level3",
};

// ---------------------------------------------------------------------------
// The causes
// ---------------------------------------------------------------------------

const VISA_SOURCE =
  "Visa USA Interchange Reimbursement Fees, Visa Supplemental Requirements, rates effective 18 April 2026, usa.visa.com, checked 5 September 2026";

const MC_SOURCE =
  "Mastercard 2026 to 2027 U.S. Region Interchange Programs and Rates, effective 17 April 2026, read from the Internet Archive capture of mastercard.com dated 16 June 2026 because the live file returns HTTP 403 to this machine, checked 5 September 2026";

const TIMING_SOURCE =
  "Settlement windows from Payrix interchange data requirements documentation (Visa: no more than 24 hours between authorization and capture; Mastercard: cleared within three business days, no more than two days between authorization and capture) and Nuvei Paya merchant support, both checked 5 September 2026. These are processor documentation, not a network publication";

export const DOWNGRADE_REASONS: DowngradeReason[] = [
  {
    id: "commercial-no-enhanced-data",
    label: "Corporate or purchasing card sent with Level 1 data only",
    basis: "commercial",
    trigger:
      "A Visa corporate, purchasing or fleet card cleared with nothing but the amount, the card number and the merchant details. No tax amount, no customer code, no line items. This is the single most expensive fixable thing on a B2B card book, and it is invisible on a flat rate statement.",
    fromProgram: "Visa Commercial Product 3, Purchasing and Corporate T&E, 1.75% + $0.10",
    toProgram: "Visa Commercial Card Not Present, 2.70% + $0.10",
    deltaPct: 0.95,
    deltaCents: 0,
    fix: "Send full Level 3 data on every commercial authorization: line item description, product code, quantity, unit of measure, unit price and line total, plus freight, duty, the Level 2 sales tax amount and a customer or purchase order reference. Visa requires the line items to sum to the authorization amount, so a rounding difference between the cart and the auth fails the whole submission.",
    rangeNote:
      "On Mastercard the same failure is Data Rate III at 1.90% + $0.10 against Data Rate I at 2.70% + $0.10 on Large Market Credit, a delta of 0.80 points. If the sale also misses the card not present requirements it falls past Commercial Card Not Present to Visa Non-Qualified at 2.95% + $0.10, which is 1.20 points below Commercial Product 3.",
    defaultSharePct: 100,
    defaultOn: true,
    source: `${VISA_SOURCE}. Mastercard comparison from ${MC_SOURCE}`,
  },
  {
    id: "late-batch",
    label: "Batch settled more than 48 hours after the authorization",
    basis: "all",
    trigger:
      "The sale was authorized, then the batch sat unclosed. Visa moves a card not present sale to EIRF at two days and to Standard at three or more. Mastercard requires clearing inside three business days. The usual cause is one terminal that never auto-closes, or a gateway account where automatic settlement was switched off during a migration and nobody switched it back on.",
    fromProgram: "Mastercard Merit III Base, Core consumer credit, 1.65% + $0.10",
    toProgram: "Mastercard Standard, consumer credit, 3.15% + $0.10",
    deltaPct: 1.5,
    deltaCents: 0,
    fix: "Set automatic batch close at a fixed time on every terminal and every gateway account, then check the settlement report for a week. A till that is powered off before its close time downgrades everything it took that day, and nothing on the terminal tells you.",
    rangeNote:
      "On Visa exempt consumer debit the same failure is smaller: a card not present sale falls from CPS/e-Commerce Basic at 1.65% + $0.15 to EIRF at 1.75% + $0.20 after two days, then to Standard at 1.90% + $0.25 after three. On Visa consumer credit there is no EIRF step left at all, only Non-Qualified Consumer Credit at 3.15% + $0.10.",
    defaultSharePct: 5,
    defaultOn: true,
    source: `${MC_SOURCE}. ${TIMING_SOURCE}`,
  },
  {
    id: "keyed-card-present",
    label: "Card keyed at the counter instead of dipped or tapped",
    basis: "all",
    trigger:
      "The card number was typed into a card present terminal. Key entry has its own, more expensive program on both networks, and it only holds that program when the address and ZIP are keyed with it. Staff key a card when the reader fails, so this shows up on a statement as a rate rather than as a hardware fault.",
    fromProgram: "Visa CPS/Retail, Debit, exempt consumer debit card present, 0.80% + $0.15",
    toProgram: "Visa CPS/Retail Key Entry, Debit, 1.65% + $0.15",
    deltaPct: 0.85,
    deltaCents: 0,
    fix: "Replace or reseat the chip reader and pull the keyed share by terminal, not for the store as a whole. One failing reader will carry almost all of it. Where keying is unavoidable, key the full billing address and ZIP so the sale at least holds the key entry program instead of falling further.",
    rangeNote:
      "This is the cost of keying at all. A keyed sale that also comes back with no ZIP match falls again, to Visa Non-Qualified Consumer Credit at 3.15% + $0.10 or Mastercard Standard at 3.15% + $0.10 on a credit card.",
    defaultSharePct: 8,
    defaultOn: true,
    source: VISA_SOURCE,
  },
  {
    id: "cnp-no-avs",
    label: "Card not present sale sent without AVS, or with no ZIP match",
    basis: "all",
    trigger:
      "The authorization carried no address verification request, or the response came back with no ZIP match. Most gateways send the billing ZIP only if the integration populates the field, so an ecommerce build that made ZIP optional at checkout is quietly downgrading every order that skipped it.",
    fromProgram: "Visa CPS/e-Commerce Basic, Debit, 1.65% + $0.15",
    toProgram: "Visa Electronic Interchange Reimbursement Fee (EIRF), Debit, 1.75% + $0.20",
    deltaPct: 0.1,
    deltaCents: 5,
    fix: "Make the billing ZIP a required checkout field and confirm the gateway is passing it in the authorization rather than storing it. Then read the AVS response codes: a field that is sent but never matched is a different bug from a field that is never sent.",
    rangeNote:
      "On consumer credit the fall is far steeper than on debit. Visa's only remaining fallback row is Non-Qualified Consumer Credit at 3.15% + $0.10 and Mastercard's is Standard at 3.15% + $0.10, against qualifying programs that start at 1.65% + $0.10, so the same failure can cost 1.50 points instead of 0.10.",
    defaultSharePct: 0,
    defaultOn: false,
    source: VISA_SOURCE,
  },
  {
    id: "auth-settle-mismatch",
    label: "Settled amount does not match the authorized amount",
    basis: "all",
    trigger:
      "The amount cleared differs from the amount authorized, outside the tip variance allowed to restaurants and a small number of other categories. Partial shipments, shipping added after checkout, and post authorization price adjustments all do this, and a subscription that prorates mid cycle does it every renewal.",
    fromProgram: "Mastercard Merit III Base, Core consumer credit, 1.65% + $0.10",
    toProgram: "Mastercard Standard, consumer credit, 3.15% + $0.10",
    deltaPct: 1.5,
    deltaCents: 0,
    fix: "Authorize the final amount, or use incremental authorization and authorization reversal instead of clearing a different figure. Ship complete or authorize per shipment. For restaurants, confirm the terminal is coded to a category that is allowed the tip variance, because a miscoded MCC turns every tipped sale into a mismatch.",
    rangeNote:
      "Both networks also charge a separate integrity or misuse fee on authorizations that are never cleared or are cleared for a different amount. Those are network fees on your statement, not interchange, so they are not modelled here and they sit on top of this figure.",
    defaultSharePct: 0,
    defaultOn: false,
    source: `${MC_SOURCE}. Amount matching rule from Nuvei Paya merchant support documentation, checked 5 September 2026`,
  },
  {
    id: "business-no-level2",
    label: "Small business card sent without Level 2 data",
    basis: "commercial",
    trigger:
      "A small business card cleared without a valid sales tax amount and a customer or order code. Level 2 is two fields. It is the cheapest thing on this list to fix and the one most often left unset because the gateway accepts the transaction happily without it.",
    fromProgram: "Mastercard Data Rate II, Business Core small business credit, 1.90% + $0.10",
    toProgram: "Mastercard Data Rate I, Business Core, 2.65% + $0.10",
    deltaPct: 0.75,
    deltaCents: 0,
    fix: "Populate the sales tax amount, which has to be a real figure between 0.1 percent and 22 percent of the sale rather than zero, and a customer or order reference on every business card authorization. A genuinely tax exempt sale needs the tax exempt indicator, not a zero in the tax field.",
    rangeNote:
      "Visa's Business Product 2 and Business Product 1 rows carry the same two rates to the cent at the base spend tier, 1.90% + $0.10 and 2.65% + $0.10, which is the strongest available evidence that Visa's Product numbering is the data level. Level 3 is not the next step on a small business card: Visa Business Product 3 is 2.40% + $0.10, above Product 2, and Mastercard's small business credit table has no Data Rate III row at all.",
    defaultSharePct: 0,
    defaultOn: false,
    source: `${MC_SOURCE}. Visa comparison from ${VISA_SOURCE}`,
  },
  {
    id: "business-non-qualified",
    label: "Business card falls all the way to Non-Qualified or Standard",
    basis: "commercial",
    trigger:
      "The business card sale missed the basic qualification tests as well as the data tests, usually a late batch or a missing card not present element on top of missing enhanced data. This is the floor of the ladder and there is nothing below it.",
    fromProgram: "Visa Business Product 1, business credit spend tier I, 2.65% + $0.10",
    toProgram: "Visa Business Non-Qualified, 3.15% + $0.20",
    deltaPct: 0.5,
    deltaCents: 10,
    fix: "Fix the settlement window and the address data before you touch enhanced data. Level 2 and Level 3 fields do nothing for a transaction that has already failed timeliness, because it never reaches the data test.",
    rangeNote:
      "Visa's Business Non-Qualified row is 3.15% + $0.20 in every one of the five business credit spend tiers. Mastercard's small business Standard runs from 2.95% + $0.10 at Business Core to 3.30% + $0.10 at Level 5, so the fall is worse the richer the card.",
    defaultSharePct: 0,
    defaultOn: false,
    source: `${VISA_SOURCE}. Mastercard comparison from ${MC_SOURCE}`,
  },
];

// ---------------------------------------------------------------------------
// The enhanced data ladder
//
// Mode two of the widget prices a move up this ladder. Kept separate from
// `DOWNGRADE_REASONS` because it is a different question: the reasons list asks
// what is going wrong now, the ladder asks what the next rung is worth.
// ---------------------------------------------------------------------------

/**
 * The Visa Commercial Enhanced Data Program participation fee.
 *
 * Charged on enhanced data submissions, which is why the widget subtracts it
 * from the Visa saving rather than quietly ignoring it. NOTE THE PROVENANCE: it
 * is not in the Visa rate sheet. It comes from processor documentation and is
 * labelled as such wherever it is rendered.
 */
export const CEDP_PARTICIPATION_FEE_PCT = 0.05;

export const CEDP_FEE_SOURCE =
  "Rainforest Pay CEDP requirements documentation, which states a 0.05 percent (5 basis point) participation fee on enhanced data submissions and gives the Level 3 sunset as 17 October 2025 and the Level 2 sunset as April 2026, checked 5 September 2026. Processor documentation, not a Visa publication";

/**
 * Exported by name as well as in the array because `noUncheckedIndexedAccess`
 * is on: `ENHANCED_DATA_LADDERS[0]` is typed as possibly undefined, so a widget
 * needs a named constant to fall back to rather than a non-null assertion.
 */
export const CORPORATE_LADDER: EnhancedDataLadder = {
  id: "corporate",
  label: "Corporate, purchasing and fleet cards",
  note: "Visa rows are the Purchasing and Corporate T&E column of section E. Mastercard rows are the Large Market Credit column. This is the family where Level 3 pays: both networks put their deepest enhanced data rate here.",
  rungs: [
    {
      id: "level1",
      label: "Level 1 only",
      visaProgram: "Commercial Card Not Present",
      visaPct: 2.7,
      visaCents: 10,
      mcProgram: "Data Rate I",
      mcPct: 2.7,
      mcCents: 10,
    },
    {
      id: "level2",
      label: "Level 2 (tax amount and customer code)",
      // Visa retired the general Commercial Level II row in April 2026, so
      // there is no Visa rung here and a Visa transaction carrying Level 2 data
      // clears at the same rate as one without. `null` renders as "no program"
      // rather than silently reusing the Level 1 rate.
      visaProgram: null,
      visaPct: null,
      visaCents: null,
      mcProgram: "Data Rate II",
      mcPct: 2.5,
      mcCents: 10,
    },
    {
      id: "level3",
      label: "Level 3 (line item detail)",
      visaProgram: "Commercial Product 3",
      visaPct: 1.75,
      visaCents: 10,
      mcProgram: "Data Rate III",
      mcPct: 1.9,
      mcCents: 10,
    },
  ],
  source: `${VISA_SOURCE}. ${MC_SOURCE}`,
};

export const SMALL_BUSINESS_LADDER: EnhancedDataLadder = {
  id: "smallbusiness",
  label: "Small business cards",
  note: "Visa rows are the business credit spend tier I column of section G. Mastercard rows are the Level 1 / Business Core column of the small business credit table. Level 2 is the bottom of the ladder here, not the middle: Visa prices Product 3 above Product 2 and Mastercard publishes no Data Rate III for small business credit at all.",
  rungs: [
    {
      id: "level1",
      label: "Level 1 only",
      visaProgram: "Business Product 1",
      visaPct: 2.65,
      visaCents: 10,
      mcProgram: "Data Rate I",
      mcPct: 2.65,
      mcCents: 10,
    },
    {
      id: "level2",
      label: "Level 2 (tax amount and customer code)",
      visaProgram: "Business Product 2",
      visaPct: 1.9,
      visaCents: 10,
      mcProgram: "Data Rate II",
      mcPct: 1.9,
      mcCents: 10,
    },
    {
      id: "level3",
      label: "Level 3 (line item detail)",
      visaProgram: "Business Product 3",
      visaPct: 2.4,
      visaCents: 10,
      // No Data Rate III row exists in Mastercard's small business credit
      // table. This is a real gap in the schedule, not a missing read.
      mcProgram: null,
      mcPct: null,
      mcCents: null,
    },
  ],
  source: `${VISA_SOURCE}. ${MC_SOURCE}`,
};

export const ENHANCED_DATA_LADDERS: EnhancedDataLadder[] = [CORPORATE_LADDER, SMALL_BUSINESS_LADDER];
