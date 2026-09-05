/**
 * Adyen's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to the widget as a prop, so only the
 * one card a page needs is ever serialized.
 *
 * ADYEN IS NOT A FLAT RATE PROCESSOR, so this card does not mean what the Stripe
 * or Square cards mean. Adyen is interchange++: the merchant pays the issuer's
 * interchange, plus the Visa or Mastercard scheme fees, plus Adyen. Only the
 * third part is Adyen's, and only the third part is on this card.
 *
 *   channel.rates.standard.rate   Adyen's own percentage for that payment method.
 *                                 On Visa, Mastercard and Maestro that is the
 *                                 acquirer markup and it sits ON TOP of
 *                                 interchange and scheme fees. On American
 *                                 Express, Discover, Diners and the BNPL methods
 *                                 it is the whole published method fee.
 *   channel.rates.standard.fixed  Adyen's $0.13 fixed processing fee, plus the
 *                                 method's own per transaction fee where the
 *                                 published price has one (American Express
 *                                 $0.10, the BNPL methods $0.30, ACH $0.27).
 *
 * The card therefore CANNOT be used on its own to price a Visa payment. It is
 * two of the three parts short. `lib/calc/adyen.ts` adds interchange and scheme
 * fees; `lib/tools-data/adyen.ts` carries the sourced figures for both.
 *
 * MAINTENANCE CONTRACT. Every figure was read off Adyen's own published US
 * pricing page on the `checked` date recorded below, with the source beside it.
 * A wrong number renders identically to a right one, so do not move `checked`
 * without re-reading the source, and treat an unverified edit as a content bug.
 */

import type { RateCard } from "@/lib/tools-rates";

export const ADYEN_RATE_CARD: RateCard = {
  key: "adyen",
  processorName: "Adyen",
  processorSlug: "adyen",
  checked: "5 September 2026",
  sources: [
    { label: "adyen.com/pricing", url: "https://www.adyen.com/pricing" },
    {
      label: "Adyen support: what is interchange++",
      url: "https://help.adyen.com/en_US/knowledge/payment-methods/explore-payment-methods/what-is-the-interchange",
    },
    {
      label: "Adyen support: what are the fees on my invoice",
      url: "https://help.adyen.com/en_US/knowledge/finance/invoices/what-are-the-fees-on-my-invoice",
    },
  ],
  plans: [
    {
      id: "standard",
      label: "Adyen published pricing",
      monthly: 0,
      note: "No monthly fee, setup fee, integration fee or closure fee. A minimum invoice applies and Adyen does not publish the amount.",
    },
  ],
  channels: [
    {
      id: "visa",
      label: "Visa",
      note: "Interchange++. The 0.60% is Adyen's acquirer fee only and sits on top of interchange and scheme fees, which pass through at cost. Adyen states the acquirer fee is set by monthly card volume and starts at 0.60%, so 0.60% is a floor rather than a rate.",
      rates: { standard: { rate: 0.6, fixed: 0.13 } },
    },
    {
      id: "mastercard",
      label: "Mastercard",
      note: "Interchange++, priced identically to Visa on Adyen's published page. Same caveat: 0.60% is Adyen's floor, not the cost of the payment.",
      rates: { standard: { rate: 0.6, fixed: 0.13 } },
    },
    {
      id: "maestro",
      label: "Maestro",
      note: "Interchange++, same published shape as Visa and Mastercard. Rare on US issued cards.",
      rates: { standard: { rate: 0.6, fixed: 0.13 } },
    },
    {
      id: "amex-na",
      label: "American Express (North America)",
      note: "Not interchange++. A published all in method fee of 3.3% plus $0.10, and the fixed figure here is that $0.10 added to the $0.13 processing fee. Outside North America Adyen publishes 3.95% with no per transaction amount.",
      rates: { standard: { rate: 3.3, fixed: 0.23 } },
    },
    {
      id: "discover",
      label: "Discover",
      note: "Not interchange++. A published all in method fee of 3.95%.",
      rates: { standard: { rate: 3.95, fixed: 0.13 } },
    },
    {
      id: "diners",
      label: "Diners Club",
      note: "Not interchange++. A published all in method fee of 3.95%.",
      rates: { standard: { rate: 3.95, fixed: 0.13 } },
    },
    {
      id: "cash-app-pay",
      label: "Cash App Pay",
      note: "Published all in method fee of 2.90% plus $0.30. The fixed figure here is that $0.30 added to the $0.13 processing fee.",
      rates: { standard: { rate: 2.9, fixed: 0.43 } },
    },
    {
      id: "klarna",
      label: "Klarna (US and Canada)",
      note: "Published all in method fee of 4.29% plus $0.30.",
      rates: { standard: { rate: 4.29, fixed: 0.43 } },
    },
    {
      id: "affirm",
      label: "Affirm (US)",
      note: "Published all in method fee of 4.19% plus $0.30.",
      rates: { standard: { rate: 4.19, fixed: 0.43 } },
    },
    {
      id: "afterpay",
      label: "Afterpay and Clearpay (US and Canada)",
      note: "Published all in method fee of 4.99% plus $0.30.",
      rates: { standard: { rate: 4.99, fixed: 0.43 } },
    },
    {
      id: "ach",
      label: "ACH Direct Debit",
      note: "No percentage at all. $0.27 for the method plus the $0.13 processing fee, so $0.40 flat however large the payment is. This is the line that decides large B2B invoices.",
      rates: { standard: { rate: 0, fixed: 0.4 } },
    },
  ],
  // Adyen publishes no percentage add-ons for the US on its pricing page. The
  // things that behave like add-ons here are the pass-through components, and
  // they are not Adyen's to publish, so they live in `lib/tools-data/adyen.ts`
  // with their own card network sources rather than being invented here.
  addOns: [],
  extras: [
    { label: "Fixed processing fee", value: "$0.13 per transaction, every payment method" },
    { label: "Acquirer fee on Visa and Mastercard", value: "From 0.60%, set by monthly card volume" },
    { label: "Monthly, setup, integration and closure fees", value: "None" },
    { label: "Minimum invoice", value: "Applies. Amount not published" },
    { label: "Apple Pay, Google Pay, Samsung Pay", value: "$0.13 plus whatever the underlying card costs" },
    { label: "Refund request", value: "Charged the fixed processing fee again" },
    {
      label: "Chargebacks, Revenue Protect, 3D Secure, network tokens",
      value: "Billed separately, amounts not published",
    },
  ],
};
