/**
 * False declines: issuer decline groups, retry rules and the published
 * benchmarks that bound the argument.
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
 * ─── The one thing in here that is NOT sourced, and why it is labelled ───────
 *
 * `typicalSharePct` on each decline group is an EDITORIAL DEFAULT, not a
 * measured distribution. No card network and no US processor publishes the mix
 * of decline reasons across merchants, and the aggregator pages that quote a
 * percentage for "insufficient funds" trace back to nothing. Publishing an
 * invented distribution as fact is the exact failure this file exists to
 * prevent, so the shares are marked with `shareBasis`, are shown on the page as
 * a default the merchant is told to replace, and the widget's arithmetic is
 * driven by a user input rather than by these numbers. The ONE published claim
 * about the mix is Stripe's, that issuers categorize MOST declines as generic,
 * and that is why the generic group carries the largest default share.
 *
 * Everything else in this module, the Visa response code categories, the
 * reattempt limits, the retry advice codes and every benchmark, is quoted from
 * a named, dated document.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * What a merchant is allowed to do with a decline.
 *
 * These map onto Visa's four response code categories, introduced April 2020
 * and revised effective 17 April 2021, and onto the `advice_code` Stripe
 * surfaces on the charge outcome. They are not a matter of taste: reattempting a
 * Category 1 code is a rules breach, and reattempting anything more than 15
 * times in 30 days is a rules breach whatever the code.
 */
export type RetryRule = "never" | "fix-first" | "timed";

/** How likely this group is to contain a good customer who was wrongly refused. */
export type FalseDeclineRisk = "high" | "medium" | "low";

export interface DeclineCodeGroup {
  id: string;
  label: string;
  /** Which Visa response code category the bulk of this group falls into. */
  visaCategory: string;
  /** Representative network or processor codes. Illustrative, not exhaustive. */
  exampleCodes: string;
  retry: RetryRule;
  /** What the rules actually permit, in one sentence. */
  retryRule: string;
  falseDeclineRisk: FalseDeclineRisk;
  /** Why this group does or does not hide good customers. */
  note: string;
  /**
   * Share of a merchant's declines. AN EDITORIAL DEFAULT, NOT A MEASURED FIGURE.
   * See the module header. Read `shareBasis` before quoting it anywhere.
   */
  typicalSharePct: number;
  shareBasis: string;
  source: string;
}

export interface FalseDeclineBenchmark {
  metric: string;
  value: string;
  detail: string;
  source: string;
}

export interface FalseDeclineDefaults {
  monthlyAttempts: number;
  approvalRatePct: number;
  averageOrderValue: number;
  grossMarginPct: number;
  falseDeclineSharePct: number;
  retryRecoverySharePct: number;
  walkAwaySharePct: number;
  lifetimeGrossProfit: number;
  fraudDeclineSharePct: number;
  chargebackFee: number;
  softDeclineSharePct: number;
  retrySuccessRatePct: number;
}

// ---------------------------------------------------------------------------
// Widget defaults
// ---------------------------------------------------------------------------

/**
 * The default state the widget renders on the server.
 *
 * Held here rather than as literals in the component so the page's worked
 * example, the tests and the widget are all describing the same merchant. Every
 * value is a starting point a merchant is expected to overwrite from their own
 * gateway report; none of them is a published benchmark, and the assumptions
 * block on the page says so in those words.
 *
 * `softDeclineSharePct` is set to 60 because it is the sum of the three decline
 * groups below that can be reattempted without the customer touching anything
 * (generic, funds and limits, system and routing). Keeping it consistent with
 * the table means the default cannot silently contradict the reference data
 * printed beside it.
 */
export const FALSE_DECLINE_DEFAULTS: FalseDeclineDefaults = {
  monthlyAttempts: 12000,
  approvalRatePct: 87,
  averageOrderValue: 96,
  grossMarginPct: 42,
  falseDeclineSharePct: 20,
  retryRecoverySharePct: 35,
  walkAwaySharePct: 25,
  lifetimeGrossProfit: 180,
  fraudDeclineSharePct: 12,
  chargebackFee: 15,
  softDeclineSharePct: 60,
  retrySuccessRatePct: 30,
};

// ---------------------------------------------------------------------------
// Decline groups
// ---------------------------------------------------------------------------

const VISA_RULES_SOURCE =
  "Visa Business News, Updates to Rules for Declined Transaction Resubmission and Use of Authorization Response Codes, Article ID AI10325, published 3 September 2020, effective 17 April 2021, usa.visa.com, checked 5 September 2026";

const STRIPE_DECLINES_SOURCE =
  "Stripe documentation, Card declines and Decline codes, docs.stripe.com/declines/card and docs.stripe.com/declines/codes, checked 5 September 2026";

export const DECLINE_CODE_GROUPS: DeclineCodeGroup[] = [
  {
    id: "generic",
    label: "Generic issuer decline",
    visaCategory: "Category 4, generic response codes, though 51 without a stated reason sits in Category 2",
    exampleCodes: "05 do not honor, 51 without a stated reason, Stripe generic_decline and do_not_honor",
    retry: "timed",
    retryRule:
      "Usually reattemptable, up to 15 times in 30 days across all attempts on the same transaction, but read the advice code first: Stripe returns do_not_try_again on some of these and try_again_later on others. Space the attempts out rather than firing them in a burst.",
    falseDeclineRisk: "high",
    note:
      "The single largest and least informative bucket. Stripe states plainly that card issuers categorize most declines as generic, which makes the exact reason unclear. Nothing in the code says the customer is bad, so this is where wrongly refused good customers hide.",
    typicalSharePct: 26,
    shareBasis:
      "Editorial default. Sized largest because Stripe documents that issuers categorize most declines as generic. The number itself is not published by anyone.",
    source: `${VISA_RULES_SOURCE}. That article states there are four categories but names only 1 to 3; the Category 4 generic bucket is described in acquirer documentation, CardConnect CardPointe, Visa Decline Rules and Responses, support.cardpointe.com, checked 5 September 2026, so treat the label as second hand. Generic decline characterization and advice codes from ${STRIPE_DECLINES_SOURCE}`,
  },
  {
    id: "funds",
    label: "Funds and limits",
    visaCategory: "Category 2, issuer cannot approve at this time",
    exampleCodes:
      "51 insufficient funds, 61 exceeds withdrawal limit, 65 exceeds withdrawal frequency, Stripe insufficient_funds and card_velocity_exceeded",
    retry: "timed",
    retryRule:
      "Reattempt is permitted within the same 15 attempts in 30 days limit. Timing is the whole strategy here, because the balance changes and the code does not.",
    falseDeclineRisk: "low",
    note:
      "A real constraint on a real account, so it is not a false decline. It is still recoverable revenue: the same card often approves days later, which is why subscription billing retries on a schedule rather than immediately.",
    typicalSharePct: 22,
    shareBasis: "Editorial default. Replace it with the share your own gateway reports.",
    source: VISA_RULES_SOURCE,
  },
  {
    id: "data",
    label: "Data quality",
    visaCategory: "Category 3, issuer cannot approve based on the details provided",
    exampleCodes:
      "14 invalid account number, 54 expired card, incorrect CVV or postal code, Stripe incorrect_number, expired_card, incorrect_cvc, incorrect_zip",
    retry: "fix-first",
    retryRule:
      "Never reattempt the same details. Correct the data, or update the credential, then reattempt. Visa footnotes response code 14 to say it keeps counting toward data quality monitoring.",
    falseDeclineRisk: "medium",
    note:
      "A typo at checkout is not a false decline. A card on file that expired since the customer last bought from you is a good customer refused for a stale credential, and that is what network tokens and account updater exist to fix.",
    typicalSharePct: 15,
    shareBasis: "Editorial default. Replace it with the share your own gateway reports.",
    source: VISA_RULES_SOURCE,
  },
  {
    id: "suspected-fraud",
    label: "Suspected fraud, issuer side",
    visaCategory: "Category 1 or Category 2 depending on the exact code",
    exampleCodes: "59 suspected fraud, 62 restricted card, 63 security violation, Stripe fraudulent and restricted_card",
    retry: "never",
    retryRule:
      "Do not reattempt the same transaction. Stripe returns advice code do_not_try_again on these. Hammering a suspected fraud decline is itself read as fraud.",
    falseDeclineRisk: "high",
    note:
      "The issuer's model said no, not your customer's bank balance. Travel, a first purchase at a new merchant, an unusual ticket size and an unfamiliar device all trigger it. This is the second place good customers get lost, and the fix is better data on the authorization rather than a retry.",
    typicalSharePct: 12,
    shareBasis: "Editorial default. Replace it with the share your own gateway reports.",
    source: `${VISA_RULES_SOURCE}. Advice code behavior from ${STRIPE_DECLINES_SOURCE}`,
  },
  {
    id: "hard-account",
    label: "Hard, account level",
    visaCategory: "Category 1, issuer will never approve",
    exampleCodes:
      "04 pick up card, 41 lost card, 43 stolen card, 46 closed account, R0 and R1 stop payment order, Stripe lost_card, stolen_card, pickup_card, invalid_account",
    retry: "never",
    retryRule:
      "Zero reattempts. Visa is explicit that a Category 1 code means the issuer will never approve, and a merchant that reattempts one is in breach whatever the attempt count.",
    falseDeclineRisk: "low",
    note:
      "The account is closed, blocked or reported. Nothing you send will change the answer. The only recovery is a different payment method, and for a stopped recurring payment the honest recovery is asking the customer whether they meant to cancel.",
    typicalSharePct: 13,
    shareBasis: "Editorial default. Replace it with the share your own gateway reports.",
    source: VISA_RULES_SOURCE,
  },
  {
    id: "system",
    label: "System and routing",
    visaCategory: "Category 2, issuer cannot approve at this time",
    exampleCodes:
      "91 issuer or switch inoperative, 96 system malfunction, 19 reenter transaction, Stripe issuer_not_available, processing_error, reenter_transaction",
    retry: "timed",
    retryRule:
      "Reattempt, and soon. Stripe's guidance on these is to attempt the payment again, and only escalate to the customer if it still fails.",
    falseDeclineRisk: "high",
    note:
      "Nothing is wrong with the card or the customer. A network or issuer host was unreachable at that moment. Every one of these that you do not retry is a sale you threw away for a timeout, which is why this group is the cheapest approval rate you will ever buy.",
    typicalSharePct: 12,
    shareBasis: "Editorial default. Replace it with the share your own gateway reports.",
    source: `${VISA_RULES_SOURCE}. Retry guidance from ${STRIPE_DECLINES_SOURCE}`,
  },
];

// ---------------------------------------------------------------------------
// Published benchmarks
// ---------------------------------------------------------------------------

const VISA_TOKEN_PAPER =
  "Visa Commercial Solutions white paper, A deep dive on tokens, copyright 2024 Visa, corporate.visa.com, checked 5 September 2026";

/**
 * Every row here is a direct quote or a direct restatement of a named, dated
 * document. Nothing in this array is an estimate, a round number or an industry
 * figure passed along from a secondary page.
 *
 * Read the Visa figures carefully before repeating them: three of them are
 * MERCHANT LEVEL relative lifts and one is a NETWORK WIDE absolute change, and
 * they are not the same claim. A 4.6 percent lift in a merchant's authorization
 * rate and a six basis point rise in the global approval rate can both be true
 * at once, and a page that mixes them up is quoting a number it does not
 * understand.
 */
export const FALSE_DECLINE_BENCHMARKS: FalseDeclineBenchmark[] = [
  {
    metric: "Network tokens, authorization uplift",
    value: "4 percent",
    detail:
      "Visa: token based transactions drive a 30 percent reduction in fraud online against the plain card number, and a four percent uplift in authorization. Visa defines auth rate here as approved authorizations divided by total authorization attempts, on the first attempt of a unique transaction.",
    source: `${VISA_TOKEN_PAPER}, footnote 1: VisaNet, Oct to Dec 2022`,
  },
  {
    metric: "Network tokens, card-not-present lift",
    value: "4.6 percent",
    detail:
      "Visa: token card-not-present transactions have seen a 4.6 percent lift in authorization rates globally compared to the plain card number. Measured on merchants running more than 1,000 card-not-present token transactions a month per country, and Visa states individual results vary.",
    source: `${VISA_TOKEN_PAPER}, footnote 5: Visa Risk Datamart, Global, FY22 Q1 to Q4`,
  },
  {
    metric: "Tokenization, network wide approval rate",
    value: "6 basis points",
    detail:
      "Visa: tokenization has caused a six basis point increase in payment approval rates globally, and generated more than $40 billion in incremental ecommerce revenue for businesses. The gap between six basis points across the whole network and 4.6 percent at a tokenized merchant is the point: the merchants who adopt it get the lift, the average does not.",
    source: "Visa press release, Visa Issues 10 Billionth Token, usa.visa.com, 4 June 2024, checked 5 September 2026",
  },
  {
    metric: "Checkout abandonment from payment issues",
    value: "up to 44 percent",
    detail:
      "Cited by Visa: payment issues can cause up to 44 percent of digital abandonment. This is abandonment attributed to payment problems, not a decline rate, and it is survey data rather than network data.",
    source:
      "Euromonitor International, Voice of the Consumer: Digital Survey, March 2021, quoted as footnote 2 in the Visa Commercial Solutions white paper A deep dive on tokens, checked 5 September 2026",
  },
  {
    metric: "US debit card fraud losses, all parties",
    value: "17.6 basis points of transaction value",
    detail:
      "Federal Reserve Board: in 2023, across all transactions for covered issuers, fraud losses to all parties as a share of transaction value were 17.6 basis points, or $17.63 per $10,000 of transaction value, up from 7.8 basis points in 2011. Debit and general use prepaid only, and only issuers covered by Regulation II.",
    source:
      "Federal Reserve Board, 2023 Interchange Fee Revenue, Covered Issuer Costs, and Covered Issuer and Merchant Fraud Losses Related to Debit Card Transactions, released 19 December 2025, federalreserve.gov, checked 5 September 2026",
  },
  {
    metric: "Share of card fraud losses merchants absorb",
    value: "49.9 percent",
    detail:
      "Federal Reserve Board: in 2023 merchants absorbed 49.9 percent of losses from fraudulent transactions reported by covered issuers, up from 46.9 percent in 2021 and 38.3 percent in 2011. Issuers absorbed 28.3 percent and cardholders 21.8 percent.",
    source:
      "Federal Reserve Board, 2023 Interchange Fee Revenue, Covered Issuer Costs, and Covered Issuer and Merchant Fraud Losses Related to Debit Card Transactions, released 19 December 2025, federalreserve.gov, checked 5 September 2026",
  },
  {
    metric: "US dual-message debit fraud incidence",
    value: "0.12 percent of transactions",
    detail:
      "Federal Reserve Board: in 2023 dual-message debit transactions carried fraud losses of 17.9 basis points of value and fraudulent transactions were 0.12 percent of all such transactions. That is roughly one fraudulent transaction in 830, which is the order of magnitude a fraud rule is hunting in.",
    source:
      "Federal Reserve Board, 2023 Interchange Fee Revenue, Covered Issuer Costs, and Covered Issuer and Merchant Fraud Losses Related to Debit Card Transactions, released 19 December 2025, federalreserve.gov, checked 5 September 2026",
  },
  {
    metric: "Reattempt ceiling on a declined transaction",
    value: "15 attempts in 30 days",
    detail:
      "Visa moved response codes 03, 62, 78 and 93 from Category 1 to Category 2 effective 17 April 2021 specifically to allow merchants to reattempt up to 15 times in 30 days. Category 1 codes still permit zero reattempts.",
    source: VISA_RULES_SOURCE,
  },
  {
    metric: "Practical retry ceiling",
    value: "8 retries",
    detail:
      "Stripe recommends a maximum of eight retries for charges that permit retries, and warns that additional retries can look like fraud to issuers and increase declines on legitimate charges. The network limit is a ceiling, not a target.",
    source: STRIPE_DECLINES_SOURCE,
  },
];
