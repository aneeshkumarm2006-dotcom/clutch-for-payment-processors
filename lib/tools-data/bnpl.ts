/**
 * Buy now, pay later merchant pricing
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
 * ─── Why this dataset is harder to source than a card rate card ─────────────
 *
 * Card processors publish a rate card. Most BNPL providers do not. Klarna,
 * Affirm and Zip all quote on application in the United States, and Klarna's own
 * developer documentation says the applicable rate is returned per transaction
 * by its Price Plans API and that partners "should be considered dynamic and
 * should not be stored on your end". So there is no Klarna rate card to read.
 *
 * What there IS: the payment service providers that resell these methods publish
 * the rate they charge a US merchant for each one, and those are real, public,
 * dated numbers a merchant can actually be charged. Every rate below therefore
 * comes from one of four kinds of source, in this order of preference:
 *
 *   1. The BNPL provider's own published US merchant agreement (Sezzle) or its
 *      own merchant pricing page (PayPal).
 *   2. A payment service provider's published US rate for that method (Stripe's
 *      local payment methods pricing, Square's developer payments pricing).
 *   3. The provider's own marketing page, for uplift claims ONLY, always labeled
 *      as a vendor claim.
 *
 * `rateNote` says which one a row came from and whether the figure is a single
 * published rate, a published range, or a resold rate that a direct contract may
 * beat. Nothing here is a market estimate, an average of blog posts, or a number
 * somebody told us. If a provider publishes nothing, the row says so.
 *
 * ─── The uplift claims are claims, and they are recorded as claims ───────────
 *
 * `upliftClaim` carries the provider's own headline number, verbatim where
 * possible, with the publisher named. Not one of them is a controlled
 * measurement: they compare BNPL orders against all orders, which is a selection
 * effect, not a treatment effect. The calculator's whole reason to exist is that
 * a merchant has to supply the INCREMENTAL share themselves, and these numbers
 * are shown so the reader can see how far the vendor number is from that.
 * Do not promote any of them into the maths.
 */

export interface BnplProvider {
  id: string;
  name: string;
  /** Published US merchant percentage. The low end where a row carries a range. */
  ratePct: number;
  /** Top of the published range, equal to `ratePct` where a single rate is published. */
  ratePctHigh: number;
  /** Published fixed fee per transaction, in dollars. */
  fixedFee: number;
  /** Where the rate came from, and whether it is a single rate, a range, or a resold rate. */
  rateNote: string;
  /** The provider's own headline uplift number, with the publisher named. A claim, not a finding. */
  upliftClaim: string;
  /** When the merchant is paid, in the provider's own words where they publish it. */
  settlement: string;
  /** Who carries credit risk, fraud risk and disputes, verified per provider rather than generalized. */
  liability: string;
  /** Publisher, document, and the date it was read. */
  source: string;
}

export interface BnplDefaults {
  monthlyOrders: number;
  averageOrderValue: number;
  cardRatePct: number;
  cardFixedFee: number;
  providerId: string;
  bnplSharePct: number;
  incrementalSharePct: number;
  aovUpliftPct: number;
  grossMarginPct: number;
  /** The single order priced in the per-order comparison mode. */
  singleOrderValue: number;
}

/**
 * The widget's opening state, as data rather than magic strings in the
 * component.
 *
 * `aovUpliftPct` defaults to ZERO on purpose, and that is the most important
 * default in this file. Every provider in the table below claims a basket uplift
 * of between 32 and 58 percent, and dropping any of those in as the default
 * would make the calculator agree with the marketing before the merchant has
 * entered anything. Zero isolates the one effect nobody disputes, which is that
 * the same sale now costs two to three times as much to accept, and makes the
 * headline output the break-even rather than a vendor's press release.
 *
 * `incrementalSharePct` of 25 is likewise a deliberately unflattering starting
 * point rather than a measured figure. It says three quarters of BNPL orders
 * would have happened anyway. A merchant who has actually run a holdout test
 * should replace it; a merchant who has not should not assume better.
 */
export const BNPL_DEFAULTS: BnplDefaults = {
  monthlyOrders: 1200,
  averageOrderValue: 120,
  cardRatePct: 2.9,
  cardFixedFee: 0.3,
  providerId: "klarna",
  bnplSharePct: 12,
  incrementalSharePct: 25,
  aovUpliftPct: 0,
  grossMarginPct: 45,
  singleOrderValue: 120,
};

export const BNPL_PROVIDERS: BnplProvider[] = [
  {
    id: "klarna",
    name: "Klarna",
    ratePct: 5.99,
    ratePctHigh: 5.99,
    fixedFee: 0.3,
    rateNote:
      "A single published rate for the United States and Canada, published by Stripe rather than by Klarna. Klarna does not publish a US rate card: its own developer documentation says rates are returned per transaction by the Price Plans API and are dynamic. A direct Klarna contract at volume may be cheaper, and Stripe notes that some businesses are offered a temporary promotional rate of 2.9% plus 30 cents for at least one month before standard pricing applies.",
    upliftClaim:
      "Klarna's own business site claims brands using Klarna see a 40 percent increase in average order value, a 20 percent increase in conversion, and 46 percent higher purchase frequency than average shoppers. No methodology, sample or control group is published alongside those figures.",
    settlement:
      "Klarna states that you always get paid upfront and in full with any Klarna payment option.",
    liability:
      "Klarna states that it assumes credit and fraud risk. Adyen's integration guidance qualifies that materially: Klarna pays upfront and assumes the risk of non-payment by the shopper only if the merchant meets Klarna's order fulfillment rules, and Klarna has the right to charge the payment back where the merchant does not. Non-delivery and faulty goods stay with the merchant. On Stripe, a lost Klarna dispute costs the merchant $15.00 on top of the reversed sale.",
    source:
      "Rate from Stripe local payment methods pricing, stripe.com/pricing/local-payment-methods, read from a Wayback Machine capture dated 29 August 2026 because this machine geo-redirects stripe.com to non-US pricing. Claims and the paid-upfront line from klarna.com/business, read 5 September 2026. Fulfillment condition and chargeback right from the Adyen Klarna chargeback guidelines at docs.adyen.com, risk-management/chargeback-guidelines/klarna-chargebacks, read 5 September 2026. Dynamic pricing note from docs.klarna.com pricing overview, read 5 September 2026.",
  },
  {
    id: "afterpay",
    name: "Afterpay",
    ratePct: 6,
    ratePctHigh: 6,
    fixedFee: 0.3,
    rateNote:
      "The most widely published BNPL rate in the US, because Square owns Afterpay and prints it on its own developer pricing page for both card present and online. Stripe publishes the identical 6% plus 30 cents for Cash App Afterpay. Square's US in-person line reads 2.6% plus 15 cents for cards and 6% plus 30 cents for Afterpay side by side, which is the cleanest same-page comparison any provider offers.",
    upliftClaim:
      "Afterpay's US retailer page claims a 58 percent increase in average order values with merchants who accept Afterpay, and attributes the page's figures to internal Afterpay data. It is a comparison of Afterpay orders against other orders, not a controlled test.",
    settlement:
      "Afterpay states that your business gets paid upfront and that you get your money in 1 to 2 business days, whether the customer checks out in store, online or in the app.",
    liability:
      "Afterpay performs risk checks on the shopper and, where those succeed, takes on the full fraud risk for the payment, so a fraud dispute is not charged to the merchant. The merchant remains liable for the non-fraud categories. On Adyen the chargeable dispute reasons are product not received, product unacceptable and credit not processed, and the merchant pays the dispute fee on those regardless of outcome. Shoppers can raise a chargeback with Afterpay up to 120 days after the payment, the cancellation, or the expected receipt of the goods.",
    source:
      "Rate from Square developer payments pricing, developer.squareup.com/docs/payments-pricing, read 5 September 2026, cross-checked against Stripe local payment methods pricing (Cash App Afterpay) in a Wayback Machine capture dated 29 August 2026. Uplift claim and settlement timing from afterpay.com/en-US/for-retailers, read 5 September 2026. Liability, the three chargeable dispute reasons and the 120 day window from the Adyen Afterpay and Clearpay chargeback guidelines at docs.adyen.com, risk-management/chargeback-guidelines/afterpay-chargebacks, read 5 September 2026.",
  },
  {
    id: "affirm",
    name: "Affirm",
    ratePct: 6,
    ratePctHigh: 7.99,
    fixedFee: 0.3,
    rateNote:
      "A published range, not one rate. Stripe lists two Affirm tiers for US merchants: Standard at 6% plus 30 cents and Enhanced at 7.99% plus 30 cents. Affirm itself publishes no US merchant rate card and quotes on application, and a direct Affirm contract prices by risk, ticket size and whether the merchant subsidises a 0 percent APR offer for the shopper. Treat the low end as the floor rather than the expected price.",
    upliftClaim:
      "Affirm's merchant page headlines a lift in average order values and fewer abandoned carts than any other BNPL provider. Both figures are rendered as animated counters carrying no footnote, sample size, date or methodology, which is less disclosure than any other provider in this table offers, so no number from that page is reproduced here.",
    settlement:
      "Affirm funds the purchase and the merchant is paid for the order rather than waiting for the shopper's installments. Affirm does not publish a settlement window on its public merchant pages, so treat the timing as a contract term to confirm rather than a published fact.",
    liability:
      "Affirm underwrites the shopper and carries the credit risk on an approved loan, so a shopper who stops paying is Affirm's problem and not the merchant's. Non-fraud disputes are not: product condition, delivery and cancellation claims are handled as merchant disputes with a response window and the disputed amount at risk. Affirm publishes no consolidated public liability matrix, which is itself worth knowing before signing.",
    source:
      "Rates from Stripe local payment methods pricing, stripe.com/pricing/local-payment-methods, read from a Wayback Machine capture dated 29 August 2026, which lists Affirm Standard at 6% plus 30 cents and Affirm Enhanced at 7.99% plus 30 cents. Claims from affirm.com/business, read 5 September 2026 and cross-checked against a Wayback Machine capture dated 2 August 2026. The absence of a published US merchant rate, a settlement window and a liability matrix was verified on affirm.com/business the same day; where a fact is not published this row says so instead of estimating it.",
  },
  {
    id: "zip",
    name: "Zip",
    ratePct: 4.5,
    ratePctHigh: 4.5,
    fixedFee: 0.3,
    rateNote:
      "The cheapest published US BNPL rate in this table, and the one with the biggest catch: Stripe's 4.5% plus 30 cents is specifically the Pay in 4 product WITH a customer fee, meaning the shopper pays an origination fee that Zip discloses at checkout. Zip's own worked example puts that at $8.00 on a $400 Pay in 4 purchase, with origination fees ranging from $4.00 to $62.00 by purchase price, and at $18.97 on the same $400 split into eight payments, where the fee range runs $9.48 to $85.37. Zip publishes no merchant rate itself and sets the merchant service fee in the letter of offer at approval.",
    upliftClaim:
      "Zip's US business page claims a 46 percent average AOV lift, alongside 6.4 million global active customers and 87.5 thousand global merchant partners. The AOV figure carries an asterisk on the page but no published methodology, sample or control group.",
    settlement:
      "Zip publishes no merchant settlement window on its US business page, so treat funding timing as a contract term to confirm in the letter of offer rather than a published fact.",
    liability:
      "Zip publishes no merchant liability matrix. What it does publish is that loans through the Zip app and Zip Checkout are originated by WebBank and are subject to credit approval, so a shopper who stops repaying is the lender's exposure rather than the merchant's. That covers the shopper defaulting, not the shopper disputing. On Stripe a lost Zip dispute costs the merchant $3.00, the lowest lost-dispute fee of any BNPL method Stripe publishes, against $15.00 on Klarna.",
    source:
      "Rate and the $3.00 lost-dispute fee from Stripe local payment methods pricing, stripe.com/pricing/local-payment-methods, read from a Wayback Machine capture dated 29 August 2026. Claims, origination fee ranges and the WebBank origination line from zip.co/us/for-business, read from a Wayback Machine capture dated 16 January 2026: the live page was fetched on 5 September 2026 and renders entirely client side, returning no readable text, so the last static capture is the only readable primary source.",
  },
  {
    id: "sezzle",
    name: "Sezzle",
    ratePct: 6.1,
    ratePctHigh: 6.1,
    fixedFee: 0.3,
    rateNote:
      "The only rate in this table published by the BNPL provider itself, in its own US merchant agreement: Sezzle's standard payment processing fee is 6.1 percent plus 30 cents per transaction. The agreement adds that the standard rate may vary by industry classification and can be higher where Sezzle views the industry as higher risk, so 6.1 percent is a floor for a mainstream category rather than a universal price.",
    upliftClaim:
      "Sezzle's merchant results page claims a boost in average order value of 50 percent or more, a 40 percent drop in cart abandonment and a 110 percent return on investment. Vendor marketing, with no control group published.",
    settlement:
      "Sezzle's merchant agreement states that funds typically settle into the merchant's external bank account within one to seven business days after Sezzle receives notification of order capture. That is the widest published settlement window in this table.",
    liability:
      "Sezzle charges a refund fee of 2 percent of the transaction plus 30 cents to initiate a refund, and retains the original payment processing fee on a refunded order, so a returned item costs the merchant the original fee plus a second fee. The agreement also puts the risk of loss on the merchant if Sezzle becomes insolvent or is otherwise unable to honour a settlement request, which is a counterparty exposure the card networks do not have an equivalent of.",
    source:
      "Sezzle US merchant agreement, legal.sezzle.com/merchant/en-us, last updated 7 May 2026 and effective 13 May 2026, read 5 September 2026. Claims from sezzle.com/merchant-results, read 5 September 2026.",
  },
  {
    id: "paypal-pay-later",
    name: "PayPal Pay Later",
    ratePct: 4.99,
    ratePctHigh: 4.99,
    fixedFee: 0.49,
    rateNote:
      "The only BNPL line that sits inside an ordinary US card processing schedule. PayPal publishes Pay Later options at 4.99% plus the standard US fixed fee of $0.49 in its US business fees table, against 3.49% plus $0.49 for PayPal Checkout, so the BNPL premium on the same platform is exactly 150 basis points. The 49 cent fixed fee is 19 cents higher than every other row in this table, which matters more than it looks on a small basket.",
    upliftClaim:
      "PayPal's installment payments page claims 93 percent higher average order value than a standard PayPal transaction for enterprises and 62 percent higher for small businesses, footnoted to PayPal internal data analysis covering March 2025 to February 2026 and calendar 2024 respectively. A separate 98 percent AOV increase with Pay Monthly is footnoted to one merchant's own internal analysis, Whisker, May 2023 to May 2024, so it is a single case study and not a portfolio figure.",
    settlement:
      "PayPal states that merchants offer installments and get paid up front, and that there are no monthly or setup fees for Pay Later. Money lands on the merchant's ordinary PayPal settlement schedule rather than a separate BNPL one.",
    liability:
      "The installment loan is between the shopper and PayPal's lending partner, so the merchant is not exposed to the shopper missing an installment. Ordinary PayPal dispute economics still apply to the sale itself: PayPal's published US schedule charges $20.00 for a chargeback and $15.00 for a standard dispute, and those are the same whether the sale was paid by card or by Pay Later.",
    source:
      "Rate from the PayPal US business fees table, paypal.com/us/business/paypal-business-fees, which states it was last updated 1 September 2026, read 5 September 2026: Pay Later at 4.99% plus the $0.49 USD fixed fee, against 3.49% plus $0.49 for PayPal Checkout, with a $20.00 chargeback fee and a $15.00 standard dispute fee on the same schedule. The no-monthly-fee line and every uplift claim were read from paypal.com/us/business/accept-payments/installment-payments on 5 September 2026.",
  },
];

/** Always resolves, so the widget can read a provider straight from a select value. */
export function getBnplProvider(id: string, providers: BnplProvider[]): BnplProvider {
  return providers.find((p) => p.id === id) ?? providers[0]!;
}
