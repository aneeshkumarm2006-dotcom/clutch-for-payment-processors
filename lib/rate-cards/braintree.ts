/**
 * Braintree's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to `BrandFeeCalculator` as a prop, so
 * only the one card a page needs is ever serialized.
 *
 * MAINTENANCE CONTRACT. Every figure below was read off a PayPal-published US
 * schedule on the `checked` date, with the source beside it. A wrong number
 * renders identically to a right one, so do not move `checked` without
 * re-reading the source, and treat an unverified edit as a content bug.
 *
 * THREE THINGS ABOUT THIS CARD THAT ARE NOT TRUE OF THE OTHERS.
 *
 * 1. Braintree no longer publishes its own pricing page. `braintreepayments.com`
 *    301s to `paypal.com/us/enterprise/paypal-braintree-fees`, which is the
 *    source used here. That page states its own last-updated date, recorded in
 *    the source label below.
 * 2. The `paypal` channel is NOT a Braintree-published rate. Braintree's fee
 *    table prices PayPal wallet transactions as "Subject to the terms applicable
 *    to your PayPal account", so the figure carried here is PayPal's own
 *    published US PayPal Checkout commercial rate, from PayPal's US business fee
 *    schedule, cited separately. A merchant on negotiated PayPal pricing pays
 *    something else, and the channel note says so.
 * 3. The ACH cap is NOT modelled by `BrandFeeCalculator`, which computes
 *    `rate% x amount + fixed` with no ceiling. Standard ACH is capped at $5.00,
 *    which binds from $666.67 upward (5.00 / 0.0075). The channel note and the
 *    page's assumptions block both state this, because the calculator will
 *    over-report an ACH fee on a large invoice otherwise. Do not "fix" it by
 *    inventing a lower percentage: the rate is the published rate.
 */

import type { RateCard } from "@/lib/tools-rates";

export const BRAINTREE_RATE_CARD: RateCard = {
  key: "braintree",
  processorName: "Braintree",
  processorSlug: "braintree",
  checked: "5 September 2026",
  sources: [
    {
      label:
        "PayPal Braintree US fees (paypal.com/us/enterprise, page states last updated 7 May 2026)",
      url: "https://www.paypal.com/us/enterprise/paypal-braintree-fees",
    },
    {
      label:
        "PayPal US business fees, for the PayPal wallet rate Braintree defers to (page states last updated 1 September 2026)",
      url: "https://www.paypal.com/us/business/paypal-business-fees",
    },
    {
      label: "Braintree developer docs, network fees on excessive retries of declined transactions",
      url: "https://developer.paypal.com/braintree/articles/control-panel/transactions/declines",
    },
  ],
  plans: [{ id: "standard", label: "Standard US pricing", monthly: 0 }],
  channels: [
    {
      id: "cards",
      label: "Cards and third-party digital wallets",
      note: "Braintree's standard US commercial rate. Covers Apple Pay, Google Pay and the card networks.",
      rates: { standard: { rate: 2.89, fixed: 0.29 } },
    },
    {
      id: "paypal",
      label: "PayPal wallet inside Braintree",
      note: "Braintree bills PayPal transactions under your PayPal account terms. This is PayPal's published US Checkout commercial rate; negotiated PayPal pricing differs.",
      rates: { standard: { rate: 3.49, fixed: 0.49 } },
    },
    {
      id: "venmo",
      label: "Venmo",
      note: "US only, and priced separately from the card rate rather than as a wallet.",
      rates: { standard: { rate: 3.49, fixed: 0.49 } },
    },
    {
      id: "ach",
      label: "ACH Direct Debit, standard",
      note: "Capped at $5.00 per transaction, a cap this calculator does not apply. Above $666.67 the real fee is $5.00 flat.",
      rates: { standard: { rate: 0.75, fixed: 0 } },
    },
    {
      id: "ach-same-day",
      label: "ACH Direct Debit, same day",
      note: "No cap is published on the same-day rate.",
      rates: { standard: { rate: 1.5, fixed: 0.1 } },
    },
    {
      id: "amex-passthrough",
      label: "Pass-through American Express",
      note: "For merchants with their own American Express account. A flat fee per transaction with no further Braintree percentage.",
      rates: { standard: { rate: 0, fixed: 0.15 } },
    },
    {
      id: "charity-cards",
      label: "Cards and digital wallets, verified 501(c)(3) charity",
      note: "The charity discount applies to the card rate only. Venmo, ACH, the add-ons and the chargeback fee are unchanged.",
      rates: { standard: { rate: 2.19, fixed: 0.29 } },
    },
  ],
  addOns: [
    {
      id: "non-usd",
      label: "Presented in a non-USD currency",
      rate: 1,
      note: "Stacks on the channel rate.",
    },
    {
      id: "cross-border",
      label: "Customer card issued outside the United States",
      rate: 1,
      note: "Separate from the currency add-on, and the two stack.",
    },
  ],
  extras: [
    { label: "Monthly fee", value: "None published on standard US pricing" },
    { label: "Chargeback", value: "$15.00" },
    { label: "ACH returned or disputed", value: "$5.00 each" },
    {
      label: "Fees on a refunded transaction",
      value: "Not returned on flat-rate pricing",
    },
    {
      label: "Visa fee on retries past the network threshold",
      value: "$0.10 domestic, $0.15 international, per attempt",
    },
    {
      label: "Mastercard fee on excessive retries",
      value: "$0.10 per reattempt beyond 10 in 24 hours, MAC 03 and MAC 21",
    },
    {
      label: "Custom pricing",
      value: "Custom flat rates and interchange plus, for established businesses",
    },
  ],
};
