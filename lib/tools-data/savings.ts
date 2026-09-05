/**
 * Processing cost reduction levers
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
 * ─── Why a savings tool needs a data module at all ──────────────────────────
 *
 * Because the alternative is a component full of magic numbers that nobody can
 * audit. Every lever below is priced off a document: two rows on a published
 * network rate sheet, a vendor's published price, or a network rule. The widget
 * multiplies those figures by the merchant's own volume and does nothing else.
 * Where a figure is an editorial starting point rather than a sourced fact, the
 * `source` field says so in those words, and the page repeats it.
 *
 * ─── The honesty constraint that shaped this file ───────────────────────────
 *
 * A savings calculator that always finds savings is a lead form with arithmetic
 * on it. Two design choices exist to stop that happening:
 *
 *   1. Every lever carries a `catch`. It is rendered. A lever with no downside
 *      is a lever that has not been thought about.
 *   2. Surcharging defaults to zero share. It is the one lever whose cost lands
 *      on the customer rather than on the processor, and defaulting it on would
 *      inflate every headline figure on the page for free.
 *
 * ─── Sources, with the dates they were read ─────────────────────────────────
 *
 * VISA INTERCHANGE. "Visa USA Interchange Reimbursement Fees, Visa Supplemental
 * Requirements", rates effective 18 April 2026, downloaded from usa.visa.com and
 * read on 5 September 2026. Every basis point delta in `SAVINGS_LEVERS` and in
 * `QUOTED_RATE_ROWS` is the arithmetic difference between two rows of that
 * document, both quoted in full so the working is visible.
 *
 * ASSESSMENTS. Visa US Acquirer Service Fee 0.14% on credit and 0.13% on debit,
 * and an authorization processing fee of $0.0195 on US credit; Mastercard's
 * combined assessment of 0.14% plus 0.0075%, with a further 0.01% on consumer
 * credit and commercial sales of $1,000 or more. Read from the Wells Fargo
 * Merchant Services Payment Network Pass-Through Fee Schedule effective
 * 1 July 2026, and corroborated line for line by the Fiserv Card Organization
 * Pass-Through Fee Schedule published as Appendix G by the North Carolina Office
 * of the State Controller. Both checked 5 September 2026. Neither document is
 * reproduced here; only the two percentages are cited.
 *
 * ACH. Stripe ACH Direct Debit at 0.8% capped at $5.00, from stripe.com/pricing.
 * That page geo-redirects this machine to Indian pricing, so it was read from the
 * Internet Archive capture dated 1 September 2026, which is the honest checked
 * date. Helcim ACH at 0.5% plus $0.25 capped at $6.00, read directly from
 * helcim.com/pricing on 5 September 2026.
 *
 * MARKUP BENCHMARK. Helcim's published US interchange plus markup ladder,
 * helcim.com/pricing, read 5 September 2026. `lib/tools-data/helcim.ts` carries
 * the full five band ladder for the Helcim calculator; the three bands below are
 * an independently read subset, kept here so this widget imports one module.
 *
 * SURCHARGING. Visa's merchant surcharging question and answer document, which
 * states the surcharge must be limited to "your merchant discount rate (MDR) for
 * the applicable credit card or 3% whichever is lowest" and that debit and
 * prepaid cards cannot be surcharged. usa.visa.com, checked 5 September 2026.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SavingsLeverId =
  | "ach"
  | "enhanced-data"
  | "downgrades"
  | "junk-fees"
  | "reprice"
  | "surcharge";

/** Iteration order for the results table. Also the order the model applies them. */
export const SAVINGS_LEVER_IDS: SavingsLeverId[] = [
  "ach",
  "enhanced-data",
  "downgrades",
  "junk-fees",
  "reprice",
  "surcharge",
];

export interface LeverSavingRange {
  /**
   * `bps` levers are priced per dollar of the volume they touch. `dollars`
   * levers are priced per month in flat money. Mixing the two units in one
   * field is what makes a savings table unreadable, so the unit is explicit and
   * the widget renders it.
   */
  unit: "bps" | "dollars";
  low: number;
  high: number;
  note: string;
}

export interface SavingsLever {
  id: SavingsLeverId;
  label: string;
  /** One sentence, present tense: what changes on the statement if you pull it. */
  whatItDoes: string;
  saving: LeverSavingRange;
  effort: "Low" | "Medium" | "High";
  effortNote: string;
  risk: string;
  /**
   * The catch. Rendered beside the dollar figure, never hidden behind a toggle.
   * A lever with no catch has not been thought about.
   */
  catch: string;
  /** Publisher, document, effective date, and the date it was read. */
  source: string;
}

export interface QuotedRateRow {
  /** What the transaction clears as today. */
  from: string;
  /** What it could clear as. */
  to: string;
  /** Percentage points of the sale, `from` minus `to`. Negative means it costs more. */
  deltaPct: number;
  /** Cents per transaction, `from` minus `to`. */
  deltaCents: number;
  source: string;
}

export interface AchPrice {
  id: string;
  label: string;
  ratePct: number;
  fixed: number;
  cap: number;
  source: string;
}

export interface MarkupBenchmark {
  id: string;
  label: string;
  /** Inclusive lower bound of monthly card volume, in dollars. */
  minVolume: number;
  /** Exclusive upper bound, or null for the top band published. */
  maxVolume: number | null;
  /** Markup over interchange for keyed, online and invoice volume. */
  markupPct: number;
  markupPerItem: number;
  source: string;
}

export interface SavingsDefaults {
  monthlyVolume: number;
  monthlyTransactions: number;
  monthlyFees: number;
  monthlyFixedFees: number;
  passThroughPct: number;
  achVolume: number;
  achPayments: number;
  achRatePct: number;
  achCap: number;
  commercialSharePct: number;
  enhancedDataBps: number;
  downgradeSharePct: number;
  downgradeBps: number;
  removableFixedFees: number;
  targetMarkupPct: number;
  targetMarkupPerItem: number;
  surchargeSharePct: number;
  surchargeRatePct: number;
}

// ---------------------------------------------------------------------------
// Constants that are rules rather than prices
// ---------------------------------------------------------------------------

/**
 * Pass through, as a BAND rather than a point value.
 *
 * Interchange plus assessments is not one number. Visa alone publishes several
 * hundred consumer credit, commercial and debit programs, and which one a sale
 * lands in depends on the card product, the merchant category code, the channel
 * and the data sent with the authorization. Any tool that prints a single
 * precise pass through figure for a merchant it knows nothing about is showing a
 * guess as a fact.
 *
 * The band is bounded by named rows of the 18 April 2026 Visa schedule plus the
 * two published assessment rates. The floor is a card present, debit heavy
 * merchant: regulated debit at 0.05% + $0.21 and exempt CPS/Retail debit at
 * 0.80% + $0.15, with credit at Retail Credit Performance Threshold III,
 * 1.51% + $0.10 on a Traditional Rewards card. The ceiling is a card not present
 * rewards heavy merchant: Visa Product 1 at 2.04% + $0.10 rising to Visa
 * Signature Preferred at 2.60% + $0.10. Assessments add 13 to 14 basis points
 * and roughly two cents an authorization on top of either.
 *
 * KEEP THESE THREE NUMBERS IN SYNC with `ESTIMATED_PASS_THROUGH` in
 * `components/public/tools/EffectiveRateCalculator.client.tsx`. Two pages on this
 * site that split the same statement into pass through and markup must not
 * disagree about where the line is, and a merchant who runs both will notice.
 */
export const PASS_THROUGH_BAND = { low: 1.7, mid: 1.9, high: 2.1 };

/**
 * Visa's published ceiling on a US credit card surcharge, as a percentage.
 *
 * The rule is the LOWER of this and your own merchant discount rate, which is
 * why `lib/calc/savings.ts` caps recovery at the merchant's own post fix cost of
 * acceptance rather than at 3 percent flat. Debit and prepaid cards cannot be
 * surcharged at all, which is why the widget asks for a share of CREDIT volume.
 */
export const SURCHARGE_NETWORK_CAP_PCT = 3;

/**
 * The editorial floor under which this page says do nothing, in annual dollars.
 *
 * NOT a sourced figure and it is labeled as an editorial judgment on the page.
 * The reasoning: repricing or moving a merchant account is a week of somebody's
 * attention, a re-integration, a new set of statement descriptors and a real
 * chance of a settlement gap. Below roughly fifty dollars a month of identified
 * saving, the work costs more than it returns, and a page that says so is more
 * useful than one that does not.
 */
export const DO_NOTHING_FLOOR_ANNUAL = 600;

// ---------------------------------------------------------------------------
// Priced options
// ---------------------------------------------------------------------------

export const ACH_PRICE_OPTIONS: AchPrice[] = [
  {
    id: "stripe",
    label: "Stripe ACH: 0.8%, capped at $5.00",
    ratePct: 0.8,
    fixed: 0,
    cap: 5,
    source:
      "Stripe published US pricing, stripe.com/pricing. The page geo-redirects this machine to Indian pricing, so it was read from the Internet Archive capture dated 1 September 2026",
  },
  {
    id: "helcim",
    label: "Helcim ACH: 0.5% + $0.25, capped at $6.00",
    ratePct: 0.5,
    fixed: 0.25,
    cap: 6,
    source: "Helcim published US pricing table, helcim.com/pricing, read 5 September 2026",
  },
];

const HELCIM_MARKUP_SOURCE =
  "Helcim published US interchange plus markup ladder, helcim.com/pricing, read 5 September 2026. Keyed, online and invoice band";

/**
 * A published markup ladder, used as the default negotiation target.
 *
 * This is one processor's public price list, not a market average and not a
 * claim about who is cheapest. It is here because a negotiation target has to be
 * a number somebody actually publishes, otherwise the merchant is arguing with
 * their account manager about a figure from a blog post. The widget uses the
 * band matching the merchant's residual card volume and lets them overwrite it.
 */
export const PUBLISHED_MARKUP_BENCHMARKS: MarkupBenchmark[] = [
  {
    id: "b1",
    label: "Under $50K a month",
    minVolume: 0,
    maxVolume: 50000,
    markupPct: 0.5,
    markupPerItem: 0.25,
    source: HELCIM_MARKUP_SOURCE,
  },
  {
    id: "b2",
    label: "$50K to $100K a month",
    minVolume: 50000,
    maxVolume: 100000,
    markupPct: 0.45,
    markupPerItem: 0.2,
    source: HELCIM_MARKUP_SOURCE,
  },
  {
    id: "b3",
    label: "$100K a month and up",
    minVolume: 100000,
    maxVolume: null,
    markupPct: 0.35,
    markupPerItem: 0.2,
    source: HELCIM_MARKUP_SOURCE,
  },
];

// ---------------------------------------------------------------------------
// The rate sheet rows every basis point figure on this page is derived from
// ---------------------------------------------------------------------------

const VISA_SOURCE =
  "Visa USA Interchange Reimbursement Fees, Visa Supplemental Requirements, rates effective 18 April 2026, usa.visa.com, read 5 September 2026";

/**
 * Two rows and a subtraction, six times over.
 *
 * A downgrade, a missing data level and an enhanced data program have no price
 * of their own. Each is the gap between the program a transaction was eligible
 * for and the program it actually cleared in. Quoting both rows means the page
 * can show its working, and means a rate sheet revision is fixed by replacing
 * two strings rather than by adjusting a number whose provenance nobody
 * remembers.
 */
export const QUOTED_RATE_ROWS: QuotedRateRow[] = [
  {
    from: "Visa Commercial Card Not Present, Purchasing and Corporate T&E, 2.70% + $0.10",
    to: "Visa Commercial Product 3, Purchasing and Corporate T&E, 1.75% + $0.10",
    deltaPct: 0.95,
    deltaCents: 0,
    source: VISA_SOURCE,
  },
  {
    from: "Visa Business Product 1, business credit spend tier I, 2.65% + $0.10",
    to: "Visa Business Product 2, business credit spend tier I, 1.90% + $0.10",
    deltaPct: 0.75,
    deltaCents: 0,
    source: VISA_SOURCE,
  },
  {
    from: "Visa Business Product 2, business credit spend tier I, 1.90% + $0.10",
    to: "Visa Business Product 3, business credit spend tier I, 2.40% + $0.10",
    deltaPct: -0.5,
    deltaCents: 0,
    source: VISA_SOURCE,
  },
  {
    from: "Visa Non-Qualified Consumer Credit, card not present, 3.15% + $0.10",
    to: "Visa Product 1, card not present, Traditional Rewards, 2.04% + $0.10",
    deltaPct: 1.11,
    deltaCents: 0,
    source: VISA_SOURCE,
  },
  {
    from: "Visa Business Non-Qualified, 3.15% + $0.20",
    to: "Visa Business Product 1, business credit spend tier I, 2.65% + $0.10",
    deltaPct: 0.5,
    deltaCents: 10,
    source: VISA_SOURCE,
  },
  {
    from: "Visa Regulated Consumer Check Card, any program, 0.05% + $0.21",
    to: "No cheaper program exists. Regulated debit is the Durbin cap, not a rate you can improve",
    deltaPct: 0,
    deltaCents: 0,
    source: VISA_SOURCE,
  },
];

// ---------------------------------------------------------------------------
// The levers
// ---------------------------------------------------------------------------

/**
 * Six levers, in the order the model applies them.
 *
 * The order is not cosmetic and it is not a ranking by size. It exists because
 * the levers OVERLAP, and applying them in the wrong order double counts. ACH
 * removes dollars from the card channel, so everything priced per card dollar
 * has to be computed on what is left. Enhanced data and downgrade repair both
 * cut interchange, so they have to land before the markup is repriced or the
 * markup target is measured against a pass through figure that no longer
 * applies. Junk fees are part of the markup, so removing them before repricing
 * stops the same dollar being saved twice. Surcharging recovers whatever cost
 * survives all five, which is why it is last and why its ceiling moves down as
 * the earlier levers work.
 *
 * There are six rather than seven because moving from flat rate to interchange
 * plus and negotiating a markup down to a basis point target are the SAME
 * arithmetic: both set your markup to a number. Listing them separately is the
 * single most common way a savings calculator doubles its own headline.
 */
export const SAVINGS_LEVERS: SavingsLever[] = [
  {
    id: "ach",
    label: "Move large invoices to ACH",
    whatItDoes:
      "Takes your biggest invoices off cards entirely and collects them as bank debits, where the fee is capped in dollars instead of scaling with the amount.",
    saving: {
      unit: "dollars",
      low: 5,
      high: 45,
      note: "Per invoice, on invoices between $1,000 and $5,000, comparing a 2.5% to 3.2% card cost against ACH at 0.8% capped at $5.00.",
    },
    effort: "Medium",
    effortNote:
      "The processor side is a settings change. Getting customers to hand over bank details and authorize a debit is the actual work, and it fails on some of them.",
    risk: "ACH returns land days later than a card decline, and an unauthorized return can come back for 60 days.",
    catch:
      "This is the only lever whose success depends on your customers agreeing to something. Model the share you can genuinely convert, not the share that is eligible.",
    source:
      "Stripe ACH Direct Debit 0.8% capped at $5.00, stripe.com/pricing read from the Internet Archive capture dated 1 September 2026. Helcim ACH 0.5% + $0.25 capped at $6.00, helcim.com/pricing, read 5 September 2026",
  },
  {
    id: "enhanced-data",
    label: "Send Level 2 and Level 3 data on commercial cards",
    whatItDoes:
      "Passes tax amount, customer code and line item detail with commercial card authorizations, which moves them into a cheaper interchange program.",
    saving: {
      unit: "bps",
      low: 50,
      high: 95,
      note: "Per dollar of commercial card volume. 95 basis points is Visa Commercial Card Not Present at 2.70% against Commercial Product 3 at 1.75%. 75 basis points is Visa Business Product 1 at 2.65% against Business Product 2 at 1.90%.",
    },
    effort: "High",
    effortNote:
      "Your gateway has to support the fields and your systems have to populate them accurately on every line. This is a development project, not a setting.",
    risk: "None to the merchant beyond the build cost. Bad data does not downgrade you further, it simply fails to qualify.",
    catch:
      "It only touches commercial card volume, which for most consumer facing merchants is a rounding error. And on Visa small business cards, Level 3 is WORSE than Level 2: Business Product 3 is 2.40% + $0.10 against Business Product 2 at 1.90% + $0.10, so full line item detail costs you 50 basis points more than stopping at Level 2.",
    source: VISA_SOURCE,
  },
  {
    id: "downgrades",
    label: "Fix the transactions that downgrade",
    whatItDoes:
      "Settles batches inside 24 hours, sends address verification on card not present sales, stops keying cards that could be dipped, and settles the amount that was authorized.",
    saving: {
      unit: "bps",
      low: 50,
      high: 111,
      note: "Per dollar of downgraded volume. 111 basis points is Visa Non-Qualified Consumer Credit at 3.15% + $0.10 against Visa Product 1 card not present at 2.04% + $0.10 on a Traditional Rewards card.",
    },
    effort: "Low",
    effortNote:
      "Usually a batch schedule and a gateway setting. The hard part is finding the downgraded volume in the first place, which needs an itemized statement.",
    risk: "None. Every fix here is a hygiene change your processor will help with.",
    catch:
      "You cannot see downgrades at all on flat rate or tiered pricing, because your headline rate does not move when one happens. On flat rate the processor keeps the difference. Repricing to interchange plus is what makes this lever visible.",
    source: VISA_SOURCE,
  },
  {
    id: "junk-fees",
    label: "Strip the monthly line items",
    whatItDoes:
      "Removes statement fees, non-compliance penalties, gateway fees you are paying twice, batch fees and monthly minimums that no longer apply.",
    saving: {
      unit: "dollars",
      low: 0,
      high: 0,
      note: "Whatever is on your own statement. This page will not invent a figure for fees it cannot see, so the amount you can remove is an input, not an estimate.",
    },
    effort: "Low",
    effortNote:
      "One phone call for most of them. A PCI non-compliance fee is removed by completing the self assessment questionnaire, not by negotiating.",
    risk: "Canceling a gateway you still depend on. Check what each line item actually buys before you kill it.",
    catch:
      "A PCI non-compliance fee is a penalty, not a price, so it is fully avoidable. A monthly minimum is not a fee at all, it is a floor on your processing charge, so removing it saves nothing in a month where you cleared it.",
    source:
      "No published source exists for another merchant's junk fees, and this page does not pretend otherwise. The amount is read off your own statement",
  },
  {
    id: "reprice",
    label: "Reprice the markup, whether by moving to interchange plus or by negotiating",
    whatItDoes:
      "Sets the only negotiable part of your bill, the processor markup over pass through cost, to a basis point and per item target you name.",
    saving: {
      unit: "bps",
      low: 15,
      high: 50,
      note: "The published target, not the saving. Helcim publishes 0.50% + 25 cents under $50,000 a month for keyed and online volume, 0.45% + 20 cents from $50,000 to $100,000, and 0.35% + 20 cents from $100,000 to $500,000. Your saving is your current markup minus the target you choose.",
    },
    effort: "Medium",
    effortNote:
      "A repricing on an existing account is a phone call and a countersigned schedule. A move to a new processor is a week of integration work and a settlement gap to plan around.",
    risk: "A cheaper headline markup attached to a three year term, an early termination fee, or an equipment lease is not cheaper.",
    catch:
      "Moving from flat rate to interchange plus and negotiating your markup down are the same lever, not two. Both of them set your markup to a number. Counting them separately is how a savings page doubles its own headline figure.",
    source: HELCIM_MARKUP_SOURCE,
  },
  {
    id: "surcharge",
    label: "Surcharge credit cards, where it is lawful",
    whatItDoes:
      "Passes part of the cost of credit card acceptance to the customer who chose to pay by credit card, as a disclosed line on the receipt.",
    saving: {
      unit: "bps",
      low: 0,
      high: 300,
      note: "Capped at the lower of your own merchant discount rate and 3 percent, per Visa's published surcharging rules, and only on the credit share of volume.",
    },
    effort: "Medium",
    effortNote:
      "Thirty days written notice to the card networks and your acquirer, signage at the entrance and the point of sale, and the surcharge itemized on every receipt.",
    risk: "State law. Several states restrict or prohibit surcharging outright and the position moves, so this is the one lever with a standing legal review attached.",
    catch:
      "Debit and prepaid cards cannot be surcharged at all, so it never touches your debit volume. And the recovery is capped at your own cost of acceptance, which means every other lever on this list makes this one smaller. It is off by default here for exactly that reason.",
    source:
      "Visa merchant surcharging question and answer document, usa.visa.com, checked 5 September 2026. Limit the amount to your merchant discount rate for the applicable credit card or 3 percent, whichever is lowest, and debit and prepaid cards cannot be surcharged",
  },
];

// ---------------------------------------------------------------------------
// Widget defaults
// ---------------------------------------------------------------------------

/**
 * The default state, held here rather than as literals in the component, so the
 * scenario the page server renders is the same scenario the worked example in
 * `lib/tools-defs/credit-card-processing-savings-calculator.ts` describes and the
 * same one `tests/tools/batch-four/credit-card-processing-savings-calculator.test.ts`
 * asserts. Change one of those three and you must change all three.
 *
 * The merchant is a business to business commercial printer: $120,000 a month
 * across 900 card transactions, paying $3,780, which is a 3.15% effective rate.
 * It is deliberately a merchant with something to fix, because a default state
 * that already reads "do nothing" teaches nothing about the tool.
 *
 * WHAT IS SOURCED AND WHAT IS NOT. `passThroughPct`, `achRatePct`, `achCap`,
 * `enhancedDataBps`, `downgradeBps`, `targetMarkupPct`, `targetMarkupPerItem`
 * and `surchargeRatePct` are all sourced, above. The volume, the transaction
 * count, the fees, the commercial share and the downgraded share are an
 * illustrative merchant, not a benchmark, and the widget labels them as figures
 * to replace from your own statement.
 */
export const SAVINGS_DEFAULTS: SavingsDefaults = {
  monthlyVolume: 120000,
  monthlyTransactions: 900,
  monthlyFees: 3780,
  monthlyFixedFees: 180,
  passThroughPct: PASS_THROUGH_BAND.mid,
  achVolume: 30000,
  achPayments: 24,
  achRatePct: 0.8,
  achCap: 5,
  commercialSharePct: 20,
  enhancedDataBps: 75,
  downgradeSharePct: 8,
  downgradeBps: 111,
  removableFixedFees: 100,
  targetMarkupPct: 0.45,
  targetMarkupPerItem: 0.2,
  surchargeSharePct: 0,
  surchargeRatePct: 3,
};
