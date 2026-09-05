/**
 * Cross border and currency conversion reference data
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
 * ─── Why this module exists, and what it is careful not to blur ──────────────
 * A US merchant taking a payment from a foreign customer can be charged three
 * separate things, and every page that ranks for "cross border fee" treats them
 * as one:
 *
 *   1. The CARD NETWORK cross border assessment. Charged because the acquirer
 *      and the issuer are in different countries. It has nothing to do with
 *      currency and it applies even when the whole transaction settles in US
 *      dollars. `NETWORK_CROSS_BORDER_ASSESSMENTS` holds it.
 *   2. The PROCESSOR international card fee. The processor's own add-on, which
 *      on flat rate pricing is what you pay INSTEAD of seeing the network
 *      assessment, because the processor absorbed it and priced it. On
 *      interchange plus the network assessment appears on your statement and
 *      the processor usually adds nothing. `CROSS_BORDER_FEES` holds both, with
 *      `passesNetworkFeesThrough` deciding which one applies.
 *   3. The CURRENCY CONVERSION markup. This one is not a fee at all in the
 *      accounting sense: it is a spread inside an exchange rate. It never
 *      appears as a line item, which is exactly why nobody sees it.
 *
 * ─── Sources, and what each one can and cannot support ───────────────────────
 * 1. Wells Fargo Merchant Services Payment Network Pass-Through Fee Schedule,
 *    effective 1 July 2026 (document code WFMS-204 06/26), read 5 September
 *    2026. Visa, Mastercard and Discover do not publish an acquirer facing fee
 *    schedule to the open web, so the network layer below comes from a US bank's
 *    own merchant disclosure of what the networks charge it. This is the same
 *    document `lib/tools-data/adyen.ts` uses for scheme fees.
 * 2. Each processor's own published US page or fee schedule, read on the date
 *    recorded in the row. stripe.com and paypal.com geo-redirect this machine to
 *    non US pricing, so those two were read off Wayback captures of the US pages
 *    and the CAPTURE date is the checked date, per NOTES.md.
 * 3. Federal Reserve statistical release H.10, Foreign Exchange Rates, weekly
 *    release dated 31 August 2026, read 5 September 2026. This supplies the
 *    reference rates in `FX_REFERENCE_RATES`, which exist so a merchant has a
 *    free, official, US mid market rate to measure a processor's rate against
 *    rather than taking the processor's word for it.
 *
 * ─── The trap this data is shaped around ─────────────────────────────────────
 * The H.10 release prints some currencies as US dollars per foreign unit (euro,
 * Australian dollar) and most as foreign units per US dollar (yen, Canadian
 * dollar, peso). Reading one as the other inverts the answer, and an inverted
 * exchange rate does not throw: it returns a confident number. So the published
 * figure is stored VERBATIM alongside the direction it was published in, and the
 * inversion happens once, in `lib/calc/fx.ts`, where it is tested.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One line of a network's cross border charge, as the acquirer disclosure names it. */
export interface AssessmentComponent {
  name: string;
  pct: number;
}

export interface NetworkCrossBorderAssessment {
  id: string;
  network: string;
  label: string;
  /**
   * The percentage lines only. The TOTAL is deliberately not stored: it is
   * summed in `lib/calc/fx.ts` and asserted against a hand computed figure in
   * the test, so a mistyped component cannot hide inside a correct looking
   * total.
   */
  components: AssessmentComponent[];
  /**
   * The per item network charge ABOVE the domestic equivalent, not the whole
   * international per item fee. Visa bills $0.0395 on an international credit
   * authorization instead of the $0.0195 it bills domestically, so the
   * incremental cost of the card being foreign is two cents, not four.
   */
  incrementalFixed: number;
  incrementalFixedNote: string;
  definition: string;
  source: string;
}

export interface CrossBorderFeeProfile {
  processorSlug: string;
  name: string;
  /** The published all in card rate the add-ons stack on top of. */
  basePct: number;
  baseFixed: number;
  baseLabel: string;
  /**
   * The processor's OWN international card add-on. Zero where the processor
   * passes the network assessment through instead of adding its own line, which
   * is not the same thing as free.
   */
  internationalPct: number;
  internationalPublished: string;
  /**
   * Currency conversion markup, low and high. Both are set to the same number
   * where the processor publishes one figure, and they differ where the
   * processor publishes a range. `null` means the processor does not publish a
   * conversion markup on the page checked, which is recorded rather than guessed.
   */
  fxMarkupLowPct: number | null;
  fxMarkupHighPct: number | null;
  fxMarkupPublished: string;
  /**
   * True only where the processor states in its own words that the exchange
   * rate it applies carries no markup and the conversion charge is the stated
   * percentage instead. That claim is worth flagging because it is the only
   * structure a merchant can actually audit.
   */
  midMarketStated: boolean;
  /** True on interchange plus and interchange++ pricing, where the network assessment lands on your statement. */
  passesNetworkFeesThrough: boolean;
  settlement: string;
  note: string;
  source: string;
}

export interface FxMarkupBand {
  /** Upper bound, exclusive, of the implied markup measured against the mid market rate. */
  maxPct: number;
  label: string;
  note: string;
}

/** A published mid market reference rate, stored exactly as the Federal Reserve prints it. */
export interface FxReferenceRate {
  code: string;
  label: string;
  /** The rate as published. Read `publishedAs` before doing anything with it. */
  published: number;
  publishedAs: "usd-per-unit" | "unit-per-usd";
  source: string;
}

export interface FxDefaults {
  mode: "payment" | "blended" | "markup";
  processorSlug: string;
  amount: number;
  foreignCard: boolean;
  currencyConverted: boolean;
  passThroughNetwork: boolean;
  networkId: string;
  basePct: number;
  baseFixed: number;
  internationalPct: number;
  fxMarkupPct: number;
  monthlyVolume: number;
  averageTicket: number;
  foreignSharePct: number;
  convertedSharePct: number;
  currencyCode: string;
  foreignAmount: number;
  midRate: number;
  receivedRate: number;
  quoteDirection: "usd-per-unit" | "unit-per-usd";
  statedMarkupPct: number;
  transactionsPerYear: number;
}

// ---------------------------------------------------------------------------
// The network layer
// ---------------------------------------------------------------------------

const WF_SOURCE =
  "Wells Fargo Merchant Services Payment Network Pass-Through Fee Schedule, effective 1 July 2026 (WFMS-204 06/26), read 5 September 2026";

/**
 * What the card networks charge a US acquirer when the issuer is not in the US.
 *
 * Note the symmetry, which is the single most useful thing on this page: Visa
 * and Mastercard arrive at the same total by different routes, and both charge
 * exactly 40 basis points more when the transaction is not settled in US
 * dollars. American Express is not listed, because the same schedule shows no
 * separate cross border assessment on OptBlue volume; do not read that as zero
 * cost, read it as priced elsewhere.
 */
export const NETWORK_CROSS_BORDER_ASSESSMENTS: NetworkCrossBorderAssessment[] = [
  {
    id: "visa-usd",
    network: "Visa",
    label: "Visa, foreign card, settled in USD",
    components: [
      { name: "Visa International Service Fee, Base", pct: 1.0 },
      { name: "Visa International Acquirer Fee (IAF)", pct: 0.45 },
    ],
    incrementalFixed: 0.02,
    incrementalFixedNote:
      "Visa Authorization Processing Fee, credit: $0.0395 international against $0.0195 domestic. On debit it is $0.0355 against $0.0155, the same two cents.",
    definition:
      "The Base International Service Fee applies where the merchant is in the US, the issuer or cardholder is outside the US, and the transaction settled in USD. The International Acquirer Fee applies to any Visa sale on the same geography test, regardless of currency.",
    source: WF_SOURCE,
  },
  {
    id: "visa-nonusd",
    network: "Visa",
    label: "Visa, foreign card, not settled in USD",
    components: [
      { name: "Visa International Service Fee, Enhanced", pct: 1.4 },
      { name: "Visa International Acquirer Fee (IAF)", pct: 0.45 },
    ],
    incrementalFixed: 0.02,
    incrementalFixedNote:
      "Same Authorization Processing Fee step as the USD settled case. The currency does not change the per item charge, only the percentage.",
    definition:
      "The Enhanced rate replaces the Base rate whenever the transaction was not settled in US dollars. It is the same fee at a higher number, not an extra fee.",
    source: WF_SOURCE,
  },
  {
    id: "mc-usd",
    network: "Mastercard",
    label: "Mastercard, foreign card, settled in USD",
    components: [
      { name: "Mastercard U.S. Cross Border USD", pct: 0.6 },
      { name: "Mastercard Global Acquirer Fee (GAF)", pct: 0.85 },
    ],
    incrementalFixed: 0.02,
    incrementalFixedNote:
      "Network Access Brand Usage cross border is $0.0295 on authorization and $0.0295 on settlement, against $0.0195 and $0.0195 domestically. Two cents across the pair.",
    definition:
      "The Cross Border USD fee applies where the merchant is in the US, the issuer or cardholder is outside the US, and the transaction settled in USD. The Global Acquirer Fee applies to any Mastercard sale on the same geography test.",
    source: WF_SOURCE,
  },
  {
    id: "mc-nonusd",
    network: "Mastercard",
    label: "Mastercard, foreign card, not settled in USD",
    components: [
      { name: "Mastercard U.S. Cross Border non-USD", pct: 1.0 },
      { name: "Mastercard Global Acquirer Fee (GAF)", pct: 0.85 },
    ],
    incrementalFixed: 0.02,
    incrementalFixedNote:
      "Unchanged from the USD settled case. Only the cross border percentage moves.",
    definition:
      "The non-USD rate replaces the USD rate whenever the transaction was not settled in US dollars.",
    source: WF_SOURCE,
  },
  {
    id: "discover",
    network: "Discover",
    label: "Discover, foreign card",
    components: [{ name: "Discover International Service Fee", pct: 0.8 }],
    incrementalFixed: 0,
    incrementalFixedNote:
      "Discover publishes no international variant of its per item Data Usage or Network Authorization fees in this schedule, so the incremental per item cost is recorded as zero rather than estimated.",
    definition:
      "Applies to the dollar amount of card sales, excluding cash over, where the merchant is in the US and the issuer or cardholder is outside the US. Discover states one rate rather than splitting on settlement currency.",
    source: WF_SOURCE,
  },
];

// ---------------------------------------------------------------------------
// The processor layer
// ---------------------------------------------------------------------------

export const CROSS_BORDER_FEES: CrossBorderFeeProfile[] = [
  {
    processorSlug: "stripe",
    name: "Stripe",
    basePct: 2.9,
    baseFixed: 0.3,
    baseLabel: "Online cards, US issued",
    internationalPct: 1.5,
    internationalPublished: "+1.5% for international cards",
    fxMarkupLowPct: 1,
    fxMarkupHighPct: 1,
    fxMarkupPublished: "+1% if currency conversion is required",
    midMarketStated: false,
    passesNetworkFeesThrough: false,
    settlement: "USD by default. Settlement in additional currencies is available on eligible accounts.",
    note: "The two add-ons stack, so a converted foreign card runs 2.9% plus 1.5% plus 1%, which is 5.4% plus 30 cents. Stripe's Adaptive Pricing, which prices in the shopper's currency, instead presents the shopper a conversion fee that the same page describes as starting at 2%.",
    source: "stripe.com/pricing, US page read through a Wayback capture dated 1 September 2026",
  },
  {
    processorSlug: "paypal",
    name: "PayPal",
    basePct: 3.49,
    baseFixed: 0.49,
    baseLabel: "PayPal Checkout, domestic",
    internationalPct: 1.5,
    internationalPublished: "1.50% additional percentage-based fee for international commercial transactions",
    fxMarkupLowPct: 3,
    fxMarkupHighPct: 4,
    fxMarkupPublished: "3.00% currency conversion spread, or 4.00% on the listed conversion types",
    midMarketStated: false,
    passesNetworkFeesThrough: false,
    settlement: "Multiple currency balances. Converting a balance to USD triggers the spread.",
    note: "PayPal's schedule is the clearest illustration of the point this page makes: the 1.50% international fee is a stated fee, and the conversion spread is not, because the schedule says the transaction exchange rate will itself include the spread. One is on your statement and one is inside a number. Note also that Advanced Credit and Debit Card Payments priced as interchange plus plus carries no additional international percentage at all.",
    source: "paypal.com US business fees, page states last updated 15 July 2026, read through a Wayback capture dated 6 August 2026",
  },
  {
    processorSlug: "square",
    name: "Square",
    basePct: 2.9,
    baseFixed: 0.3,
    baseLabel: "Online, all plans",
    internationalPct: 1.5,
    internationalPublished:
      "1.5% international card transaction fee, identical on Free, Plus and Premium",
    fxMarkupLowPct: null,
    fxMarkupHighPct: null,
    fxMarkupPublished: "No currency conversion markup appears on Square's US pricing page",
    midMarketStated: false,
    passesNetworkFeesThrough: false,
    settlement: "USD.",
    note: "Square charges the international add-on on cards issued outside the US and prices it the same on every plan, which is unusual. Because a US Square account is settled in dollars, the conversion is generally the cardholder's bank's problem rather than yours, so a Square merchant usually has two of these three charges rather than three.",
    source: "squareup.com/us/en/pricing, read through a Wayback capture dated 12 August 2026",
  },
  {
    processorSlug: "shopify",
    name: "Shopify Payments",
    basePct: 2.9,
    baseFixed: 0.3,
    baseLabel: "Online, Basic plan",
    internationalPct: 1,
    internationalPublished: "+1% for cards issued outside the store's country",
    fxMarkupLowPct: 1.5,
    fxMarkupHighPct: 1.5,
    fxMarkupPublished: "1.5% currency conversion fee for United States stores, 2% elsewhere",
    midMarketStated: true,
    passesNetworkFeesThrough: false,
    settlement: "Store payout currency, with Multi-Currency Payout available on some plans.",
    note: "The only processor in this table that says in its own documentation that the conversion rate itself is a mid market rate without any markup, and that the charge is the stated percentage instead. That is the structure a merchant can audit, because the rate is checkable and the fee is a line. Since 6 April 2026 the fee is calculated on the gross order amount rather than after other fees.",
    source: "Shopify Help Center, international pricing fees and the currency conversion fee calculation article, read 5 September 2026",
  },
  {
    processorSlug: "braintree",
    name: "Braintree",
    basePct: 2.89,
    baseFixed: 0.29,
    baseLabel: "Cards and wallets, US standard",
    internationalPct: 1,
    internationalPublished: "Additional 1% where the customer card was issued outside the United States",
    fxMarkupLowPct: 1,
    fxMarkupHighPct: 1,
    fxMarkupPublished: "Additional 1% where the transaction is presented in any non-USD currency",
    midMarketStated: false,
    passesNetworkFeesThrough: false,
    settlement: "USD, with additional settlement currencies on approved accounts.",
    note: "Braintree is the cleanest demonstration that the geography test and the currency test are separate. A US issued card charged in euros picks up the non-USD 1% and not the cross border 1%. A UK issued card charged in dollars picks up the cross border 1% and not the non-USD 1%. A UK card charged in euros picks up both.",
    source: "paypal.com US Braintree fees page, stated last updated 7 May 2026, read 5 September 2026",
  },
  {
    processorSlug: "helcim",
    name: "Helcim",
    basePct: 0.5,
    baseFixed: 0.25,
    baseLabel: "Online markup only, under $50K a month, interchange and assessments on top",
    internationalPct: 0,
    internationalPublished:
      "No Helcim add-on. Helcim publishes the network cost it passes through: Visa +1.45% + 3.6 cents, Mastercard +1.45%, American Express +1.00%, Discover +1.30%",
    fxMarkupLowPct: null,
    fxMarkupHighPct: null,
    fxMarkupPublished:
      "None charged. Helcim states the conversion is handled by the customer's bank, so the merchant pays no foreign transaction or conversion fee",
    midMarketStated: false,
    passesNetworkFeesThrough: true,
    settlement: "USD for a US account, CAD for a Canadian one.",
    note: "Worth reading against the network table on this page. Helcim's published Visa and Mastercard cross border figure of 1.45% is exactly the sum of the two Visa lines and exactly the sum of the two Mastercard lines in a US bank's own pass-through schedule. Two independent sources landing on the same number is the strongest evidence available that 1.45% is the real US cost of a foreign card settling in dollars.",
    source: "helcim.com international credit card processing page and helcim.com/pricing, read 5 September 2026",
  },
  {
    processorSlug: "adyen",
    name: "Adyen",
    basePct: 0.6,
    baseFixed: 0.13,
    baseLabel: "Acquirer fee floor plus the fixed processing fee, interchange++ on top",
    internationalPct: 0,
    internationalPublished:
      "No cross border add-on is published on adyen.com/pricing. On interchange++ the network assessment passes through at cost and appears on the invoice",
    fxMarkupLowPct: null,
    fxMarkupHighPct: null,
    fxMarkupPublished:
      "Not published on the US pricing page. Adyen's own documentation states that the Adyen exchange rate includes a 3% markup charge in its balance conversion products, and card acquiring FX terms are contractual",
    midMarketStated: false,
    passesNetworkFeesThrough: true,
    settlement: "Multiple settlement currencies. Adyen states you can choose when and in which currency you settle.",
    note: "The reason to hold a matching settlement currency is here rather than in the fee schedule: a euro balance paid out to a euro account is never converted, so the conversion markup is not reduced, it does not happen. The cross border assessment still applies, because it is about where the card was issued and not about currency.",
    source: "adyen.com/pricing and docs.adyen.com foreign exchange fees, read 5 September 2026",
  },
];

// ---------------------------------------------------------------------------
// Scoring an implied markup
// ---------------------------------------------------------------------------

/**
 * Bands for the markup this page derives, measured as the share of the mid
 * market value of a sale that did not reach the merchant.
 *
 * These are anchored on the published figures in `CROSS_BORDER_FEES` rather than
 * invented: 1% is Stripe and Braintree, 1.5% is Shopify Payments, 3% to 4% is
 * PayPal's published spread and also where dynamic currency conversion lives.
 */
export const FX_MARKUP_BANDS: FxMarkupBand[] = [
  {
    maxPct: 0.25,
    label: "At the reference rate",
    note: "Within a quarter of a point of the published mid market rate. Either you were not converted at all, or your provider genuinely passes the rate through.",
  },
  {
    maxPct: 1.25,
    label: "Published add-on territory",
    note: "Consistent with a stated conversion fee of about 1%, which is what Stripe and Braintree publish. Normal, and it should appear as a line rather than only in the rate.",
  },
  {
    maxPct: 2,
    label: "A stated fee, at the high end",
    note: "Around Shopify Payments' 1.5% US conversion fee. Fine if it is disclosed as a percentage, expensive if it is buried in a rate you cannot check.",
  },
  {
    maxPct: 3.5,
    label: "Wallet spread territory",
    note: "This is where PayPal's published 3.00% conversion spread sits. On six figures of converted volume a year it is a five figure line that never appears as a fee.",
  },
  {
    maxPct: Number.POSITIVE_INFINITY,
    label: "Check for dynamic currency conversion",
    note: "Above about 3.5% the arithmetic stops looking like a conversion fee. Check whether the payment ran through dynamic currency conversion at the terminal, or whether a second conversion happened on the payout.",
  },
];

// ---------------------------------------------------------------------------
// Reference rates
// ---------------------------------------------------------------------------

const H10_SOURCE =
  "Federal Reserve statistical release H.10, Foreign Exchange Rates, weekly release dated 31 August 2026, rate for 28 August 2026, read 5 September 2026";

/**
 * Free, official US mid market rates, printed the way the Federal Reserve prints
 * them, asterisks and all.
 *
 * The point of shipping these is not that a merchant needs today's rate to the
 * fourth decimal. It is that a merchant arguing with a processor about a
 * conversion needs a rate from somebody who is not selling them anything, and
 * the H.10 release is the obvious US answer that no competing calculator names.
 * These are a WEEK OLD BY DESIGN and go staler every week; treat them as a
 * starting value in the field, not as today's market.
 *
 * Sterling is absent because it was not in the weekly table read for this
 * module. An absent row is better than a guessed one, and the widget lets a
 * merchant type any rate.
 */
export const FX_REFERENCE_RATES: FxReferenceRate[] = [
  { code: "EUR", label: "Euro", published: 1.1598, publishedAs: "usd-per-unit", source: H10_SOURCE },
  { code: "CAD", label: "Canadian dollar", published: 1.3895, publishedAs: "unit-per-usd", source: H10_SOURCE },
  { code: "AUD", label: "Australian dollar", published: 0.7166, publishedAs: "usd-per-unit", source: H10_SOURCE },
  { code: "JPY", label: "Japanese yen", published: 159.97, publishedAs: "unit-per-usd", source: H10_SOURCE },
  { code: "MXN", label: "Mexican peso", published: 17.043, publishedAs: "unit-per-usd", source: H10_SOURCE },
  { code: "CHF", label: "Swiss franc", published: 0.8085, publishedAs: "unit-per-usd", source: H10_SOURCE },
  { code: "SGD", label: "Singapore dollar", published: 1.2744, publishedAs: "unit-per-usd", source: H10_SOURCE },
  { code: "INR", label: "Indian rupee", published: 95.38, publishedAs: "unit-per-usd", source: H10_SOURCE },
  { code: "BRL", label: "Brazilian real", published: 5.2168, publishedAs: "unit-per-usd", source: H10_SOURCE },
];

// ---------------------------------------------------------------------------
// Widget defaults
// ---------------------------------------------------------------------------

/**
 * The widget's opening state, kept here so the defaults are DATA rather than
 * magic strings scattered through the component, and so the worked example in
 * `lib/tools-defs/cross-border-fee-calculator.ts` can be checked against one
 * object rather than against the component's render.
 *
 * The received rate of 1.1250 US dollars per euro is not a market observation.
 * It is the H.10 mid market rate less exactly 3%, chosen so the opening state
 * demonstrates the arithmetic the page is about. The page says so.
 */
export const FX_DEFAULTS: FxDefaults = {
  mode: "payment",
  processorSlug: "stripe",
  amount: 180,
  foreignCard: true,
  currencyConverted: true,
  passThroughNetwork: false,
  networkId: "visa-usd",
  basePct: 2.9,
  baseFixed: 0.3,
  internationalPct: 1.5,
  fxMarkupPct: 1,
  monthlyVolume: 60000,
  averageTicket: 180,
  foreignSharePct: 18,
  convertedSharePct: 12,
  currencyCode: "EUR",
  foreignAmount: 1000,
  midRate: 1.1598,
  receivedRate: 1.125,
  quoteDirection: "usd-per-unit",
  statedMarkupPct: 3,
  transactionsPerYear: 600,
};
