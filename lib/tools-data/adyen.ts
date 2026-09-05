/**
 * Adyen interchange++ reference data
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
 * ─── Why this module exists separately from `lib/rate-cards/adyen.ts` ─────────
 * The rate card holds Adyen's OWN prices, which are Adyen's to publish and which
 * Adyen does publish. This module holds the two components Adyen passes through
 * at cost and therefore does not set: the issuer's interchange, and the Visa and
 * Mastercard scheme fees. Those come from the card networks and from a bank's
 * published pass-through schedule, they move on a different clock from Adyen's
 * page, and they are the reason an Adyen quote of "interchange++ plus 0.60%"
 * cannot be turned into a dollar figure without a second set of numbers.
 *
 * ─── The three sources, and what each one can and cannot support ─────────────
 * 1. adyen.com/pricing, read 5 September 2026. Adyen's fixed processing fee and
 *    per method fees. Authoritative, and it is Adyen's own page.
 * 2. Visa USA Interchange Reimbursement Fees, Visa Supplemental Requirements,
 *    rates effective 18 April 2026, read 5 September 2026. Interchange. Visa
 *    publishes this; it is as primary as it gets. Mastercard's schedule is a
 *    separate document and is NOT reproduced here, so every interchange row
 *    below is a Visa row and says so.
 * 3. Wells Fargo Merchant Services Payment Network Pass-Through Fee Schedule,
 *    effective 1 July 2026, read 5 September 2026. Scheme fees. Visa and
 *    Mastercard do not publish an acquirer-facing fee schedule to the open web,
 *    so the figures below come from a US bank's own merchant disclosure of what
 *    the networks charge it. They were cross-checked against the Fiserv Card
 *    Organization Pass-Through Fee Schedule published as Appendix G by the North
 *    Carolina Office of the State Controller, which gives the same assessment
 *    and authorization figures from an April 2023 edition.
 *
 * ─── What is NOT verifiable, and how it is handled ───────────────────────────
 * Adyen's minimum invoice. Adyen states on its pricing page that it has one and
 * that it depends on industry or business model, and does not name an amount.
 * `ADYEN_DEFAULTS.minimumInvoice` is therefore a widget INPUT with a starting
 * value, not a published rate, and the page says so in as many words. Third
 * party reviews report figures around $120 a month for direct US accounts and
 * materially higher amounts on enterprise contracts. Read yours off your own
 * contract; the calculator exists to show what a floor does, not to assert where
 * yours sits.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdyenPaymentMethod {
  id: string;
  label: string;
  /**
   * How Adyen prices the method.
   *
   * `interchange-plus-plus` means the published percentage is Adyen's acquirer
   * fee ONLY and interchange plus scheme fees are added on top at cost.
   * `published-method-fee` means the published percentage is the whole method
   * fee and there is nothing to add. Getting this flag wrong understates a Visa
   * payment by roughly two thirds and overstates an American Express one by the
   * same amount, and neither error throws.
   */
  pricing: "interchange-plus-plus" | "published-method-fee";
  /** Adyen's published percentage for the method. */
  methodPct: number;
  /** The method's own per transaction amount, EXCLUDING the $0.13 processing fee. */
  methodFixed: number;
  /** Adyen's published fee string, verbatim from the pricing page. */
  published: string;
  note: string;
  source: string;
}

export interface AdyenInterchangeProfile {
  id: string;
  label: string;
  /** Card present or card not present. Interchange differs by more than a point across the two. */
  channel: "card-present" | "card-not-present";
  ratePct: number;
  fixed: number;
  note: string;
  source: string;
}

export interface AdyenSchemeFeeNote {
  label: string;
  value: string;
  note: string;
  source: string;
}

export interface AdyenDefaults {
  /** Single payment mode. */
  amount: number;
  /** Monthly mode. */
  monthlyVolume: number;
  averageTicket: number;
  /** Ids into the two tables below. */
  methodId: string;
  interchangeProfileId: string;
  /** Adyen's published acquirer fee floor, in percent. */
  markupPct: number;
  /** Adyen's fixed processing fee per transaction, in dollars. */
  processingFixed: number;
  /** Scheme fee estimate: the published assessment plus the authorization fee. */
  schemePct: number;
  schemeFixed: number;
  /** Not a published Adyen figure. See the module header. */
  minimumInvoice: number;
  /** The flat rate the comparison is run against. */
  flatRatePct: number;
  flatRateFixed: number;
}

// ---------------------------------------------------------------------------
// Adyen's own published US prices
// ---------------------------------------------------------------------------

const ADYEN_PRICING_SOURCE = "adyen.com/pricing, checked 5 September 2026";

/**
 * Every US-relevant row on Adyen's published pricing page.
 *
 * `methodFixed` deliberately EXCLUDES the $0.13 fixed processing fee, which
 * Adyen charges on top of every row without exception. Adding it here as well
 * would double count it, which is the single easiest mistake to make with this
 * price list, because Adyen writes each row as "$0.13 + <the method fee>".
 */
export const ADYEN_PAYMENT_METHODS: AdyenPaymentMethod[] = [
  {
    id: "visa",
    label: "Visa",
    pricing: "interchange-plus-plus",
    methodPct: 0.6,
    methodFixed: 0,
    published: "$0.13 + Interchange++ + 0.60%",
    note: "The 0.60% is Adyen's acquirer fee alone. Adyen's own support documentation says acquirer fees are set by Adyen and determined by monthly card volume, starting at 0.60% per transaction, so treat it as a floor you may be quoted above.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "mastercard",
    label: "Mastercard",
    pricing: "interchange-plus-plus",
    methodPct: 0.6,
    methodFixed: 0,
    published: "$0.13 + Interchange++ + 0.60%",
    note: "Priced identically to Visa on Adyen's published page. Mastercard interchange comes from a different schedule than the Visa rows in this module, so the profiles below do not describe it.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "maestro",
    label: "Maestro",
    pricing: "interchange-plus-plus",
    methodPct: 0.6,
    methodFixed: 0,
    published: "$0.13 + Interchange++ + 0.60%",
    note: "Same published shape as Visa and Mastercard. Almost never seen on a US issued card, and listed because Adyen prices it in the same interchange++ family.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "amex-na",
    label: "American Express, North America",
    pricing: "published-method-fee",
    methodPct: 3.3,
    methodFixed: 0.1,
    published: "$0.13 + 3.3% + $0.10",
    note: "Not interchange++. American Express does not publish interchange in the US the way Visa and Mastercard do, so Adyen prices it as one all in number. Outside North America Adyen publishes 3.95% with no per transaction amount.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "discover",
    label: "Discover",
    pricing: "published-method-fee",
    methodPct: 3.95,
    methodFixed: 0,
    published: "$0.13 + 3.95%",
    note: "Not interchange++. One published percentage, no split, no volume ladder.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "diners",
    label: "Diners Club",
    pricing: "published-method-fee",
    methodPct: 3.95,
    methodFixed: 0,
    published: "$0.13 + 3.95%",
    note: "Not interchange++. Priced with Discover, which owns the network in the US.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "cash-app-pay",
    label: "Cash App Pay",
    pricing: "published-method-fee",
    methodPct: 2.9,
    methodFixed: 0.3,
    published: "$0.13 + 2.90% + $0.30",
    note: "The one US method Adyen prices at almost exactly a standard flat card rate, and then adds its fixed processing fee on top, which makes it $0.13 dearer than the same headline elsewhere.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "klarna",
    label: "Klarna, US and Canada",
    pricing: "published-method-fee",
    methodPct: 4.29,
    methodFixed: 0.3,
    published: "$0.13 + 4.29% + $0.30",
    note: "Buy now pay later methods carry the credit risk, which is why the percentage is roughly double a card. Adyen passes the provider's price through and adds the processing fee.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "affirm",
    label: "Affirm, US",
    pricing: "published-method-fee",
    methodPct: 4.19,
    methodFixed: 0.3,
    published: "$0.13 + 4.19% + $0.30",
    note: "Same shape as Klarna, ten basis points cheaper on Adyen's published page.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "afterpay",
    label: "Afterpay and Clearpay, US and Canada",
    pricing: "published-method-fee",
    methodPct: 4.99,
    methodFixed: 0.3,
    published: "$0.13 + 4.99% + $0.30",
    note: "The most expensive published US method on Adyen's page.",
    source: ADYEN_PRICING_SOURCE,
  },
  {
    id: "ach",
    label: "ACH Direct Debit",
    pricing: "published-method-fee",
    methodPct: 0,
    methodFixed: 0.27,
    published: "$0.13 + $0.27",
    note: "No percentage component at all, so the cost is $0.40 whether the payment is $40 or $40,000. Adyen does not publish a cap because it does not need one.",
    source: ADYEN_PRICING_SOURCE,
  },
];

// ---------------------------------------------------------------------------
// Interchange, the first plus
// ---------------------------------------------------------------------------

const VISA_IRF_SOURCE =
  "Visa USA Interchange Reimbursement Fees, Visa Supplemental Requirements, rates effective 18 April 2026, read 5 September 2026";

/**
 * Visa US interchange profiles, for the interchange++ methods.
 *
 * These are ISSUER fees. They are not Adyen's, they are not negotiable, and
 * every acquirer in the country pays the same ones. They are here so the
 * calculator can show the merchant which part of an Adyen invoice is Adyen's,
 * which is the whole point of the page.
 *
 * VISA ONLY, ON PURPOSE. Mastercard publishes its own schedule with different
 * programme names and different numbers, and mixing the two into one "typical
 * interchange" row is how competing calculators end up quoting a rate that
 * exists nowhere. If you add Mastercard rows, source them separately and label
 * them.
 *
 * Card not present rows are Visa's Product 1 programme, the general card not
 * present consumer credit programme. Card present credit rows are Retail
 * Credit, Performance Threshold I. Debit rows are the Consumer Check Card
 * schedule. Merchants in the category programmes Visa carves out (restaurant,
 * supermarket, fuel, charity, utility, education, insurance, real estate) pay
 * something different again, which is exactly why an MCC is worth checking.
 */
export const ADYEN_INTERCHANGE_PROFILES: AdyenInterchangeProfile[] = [
  {
    id: "cnp-regulated-debit",
    label: "Regulated debit, online",
    channel: "card-not-present",
    ratePct: 0.05,
    fixed: 0.21,
    note: "A debit card from a bank with $10bn or more in assets, capped by the Durbin Amendment. Issuers that certify compliance with Visa's interim fraud prevention standards receive an additional $0.01. The cheapest interchange in the United States by a wide margin, and it is the reason a debit heavy merchant should never accept a blended rate.",
    source: VISA_IRF_SOURCE,
  },
  {
    id: "cnp-exempt-debit",
    label: "Exempt debit, online",
    channel: "card-not-present",
    ratePct: 1.65,
    fixed: 0.15,
    note: "CPS/e-Commerce Basic, Debit and CPS/Card Not Present, Debit both carry this rate. A debit card from a small issuer exempt from the Durbin cap costs thirty times the regulated rate on a $50 order.",
    source: VISA_IRF_SOURCE,
  },
  {
    id: "cnp-credit-standard",
    label: "Consumer credit, no rewards, online",
    channel: "card-not-present",
    ratePct: 1.89,
    fixed: 0.1,
    note: "Product 1, All Other Products: a plain consumer credit card with no rewards programme attached. The cheapest consumer credit interchange an ordinary online merchant sees.",
    source: VISA_IRF_SOURCE,
  },
  {
    id: "cnp-credit-rewards",
    label: "Consumer credit, traditional rewards, online",
    channel: "card-not-present",
    ratePct: 2.04,
    fixed: 0.1,
    note: "Product 1, Traditional Rewards. The most common card in a US online basket and the calculator's default.",
    source: VISA_IRF_SOURCE,
  },
  {
    id: "cnp-signature",
    label: "Visa Signature, online",
    channel: "card-not-present",
    ratePct: 2.05,
    fixed: 0.1,
    note: "Product 1, Visa Signature. Only one basis point above Traditional Rewards, which surprises people who assume every premium card is expensive.",
    source: VISA_IRF_SOURCE,
  },
  {
    id: "cnp-signature-preferred",
    label: "Visa Signature Preferred, online",
    channel: "card-not-present",
    ratePct: 2.5,
    fixed: 0.1,
    note: "Product 1, Visa Signature Preferred. This is where a premium rewards card starts to hurt: 46 basis points above Traditional Rewards on the same purchase.",
    source: VISA_IRF_SOURCE,
  },
  {
    id: "cnp-infinite",
    label: "Visa Infinite, spend qualified, online",
    channel: "card-not-present",
    ratePct: 2.6,
    fixed: 0.1,
    note: "Product 1, Visa Infinite, Spend Qualified. The most expensive ordinary consumer credit interchange on Visa's card not present schedule. A spend not qualified Visa Infinite is 2.20% plus $0.10 instead.",
    source: VISA_IRF_SOURCE,
  },
  {
    id: "cp-retail-debit",
    label: "Exempt debit, card present retail",
    channel: "card-present",
    ratePct: 0.8,
    fixed: 0.15,
    note: "CPS/Retail, Debit. Half the online debit rate, which is most of the reason a store is cheaper to run than a website.",
    source: VISA_IRF_SOURCE,
  },
  {
    id: "cp-credit-standard",
    label: "Consumer credit, no rewards, card present retail",
    channel: "card-present",
    ratePct: 1.43,
    fixed: 0.1,
    note: "Retail Credit, Performance Threshold I, All Other Products and Traditional Rewards, which carry the same rate in this programme. 46 basis points below the equivalent online rate.",
    source: VISA_IRF_SOURCE,
  },
  {
    id: "cp-signature-preferred",
    label: "Visa Signature Preferred, card present retail",
    channel: "card-present",
    ratePct: 2.1,
    fixed: 0.1,
    note: "Retail Credit, Performance Threshold I, Visa Signature Preferred. Even in a store a premium rewards card costs more than a plain card does online.",
    source: VISA_IRF_SOURCE,
  },
];

// ---------------------------------------------------------------------------
// Scheme fees, the second plus
// ---------------------------------------------------------------------------

const SCHEME_SOURCE =
  "Wells Fargo Merchant Services Payment Network Pass-Through Fee Schedule, effective 1 July 2026, read 5 September 2026";

/**
 * What the scheme fee line on an Adyen invoice is made of.
 *
 * NOT AN EXHAUSTIVE LIST, and that matters. Visa and Mastercard each levy a
 * couple of dozen acquirer facing fees, and Adyen passes the lot through in this
 * one line. The rows below are the two that apply to every single settled card
 * payment and therefore act as a FLOOR on the scheme fee. Your real line is
 * higher by the fees that apply conditionally: Visa's Transaction Integrity Fee,
 * the Fixed Acquirer Network Fee, Base II clearing, misuse of authorization, and
 * the cross border and currency fees when the card was issued abroad.
 *
 * `ADYEN_DEFAULTS.schemePct` and `schemeFixed` are set from the credit rows, so
 * the calculator's default understates rather than overstates. Understating
 * Adyen's cost is the safe direction for a page whose readers are deciding
 * whether to leave a flat rate processor.
 */
export const ADYEN_SCHEME_FEE_NOTES: AdyenSchemeFeeNote[] = [
  {
    label: "Visa assessment, credit",
    value: "0.14% of the amount",
    note: "The Visa U.S. Acquirer Service Fee. Applies to all Visa credit sale transactions, with no cap and no minimum.",
    source: SCHEME_SOURCE,
  },
  {
    label: "Visa assessment, debit and prepaid",
    value: "0.13% of the amount",
    note: "Applies to all Visa debit and prepaid sale transactions. One basis point below the credit rate.",
    source: SCHEME_SOURCE,
  },
  {
    label: "Visa authorization processing fee, credit",
    value: "$0.0195 per authorization",
    note: "Charged per authorization request, not per sale, so declines and abandoned authorizations carry it too. The same fee on a non US issued card is $0.0395.",
    source: SCHEME_SOURCE,
  },
  {
    label: "Visa authorization processing fee, debit and prepaid",
    value: "$0.0155 per authorization",
    note: "The debit equivalent. $0.0355 where the card was issued outside the US.",
    source: SCHEME_SOURCE,
  },
  {
    label: "Mastercard assessment",
    value: "0.14% plus 0.0075% of the amount",
    note: "The published definition describes the Mastercard assessment as the Acquirer Brand Volume Fee of 0.14% together with the Annual Acquirer License Fee and the Type III Third Party Registration Fee of 0.0075%. A further 0.01% applies to consumer credit and commercial sales of $1,000 or more.",
    source: SCHEME_SOURCE,
  },
  {
    label: "Visa international service assessment",
    value: "1.00% base, 1.40% enhanced",
    note: "Applies when the merchant's country differs from the country the card was issued in. The enhanced rate applies when the transaction settles in a currency other than US dollars. This is the single largest reason a cross border payment on Adyen costs more than a domestic one, and it is a network fee rather than an Adyen fee.",
    source: SCHEME_SOURCE,
  },
];

// ---------------------------------------------------------------------------
// Widget defaults
// ---------------------------------------------------------------------------

/**
 * The widget's opening state, kept here rather than as string literals in the
 * component so the defaults are data and can be asserted in a test.
 *
 * The default profile is a $85 online payment on a Visa Traditional Rewards
 * consumer credit card, which is the most common single case in a US online
 * basket, and the flat rate it is compared against is 2.9% plus $0.30, the
 * published US online card rate at Stripe and the number every merchant already
 * has in their head.
 */
export const ADYEN_DEFAULTS: AdyenDefaults = {
  amount: 85,
  monthlyVolume: 250000,
  averageTicket: 85,
  methodId: "visa",
  interchangeProfileId: "cnp-credit-rewards",
  markupPct: 0.6,
  processingFixed: 0.13,
  schemePct: 0.14,
  schemeFixed: 0.0195,
  minimumInvoice: 120,
  flatRatePct: 2.9,
  flatRateFixed: 0.3,
};
