/**
 * PayPal's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to `BrandFeeCalculator` as a prop, so
 * only the one card a page needs is ever serialized.
 *
 * MAINTENANCE CONTRACT. Every figure was read off PayPal's own published US
 * schedule on the `checked` date recorded below, with the source beside it. A
 * wrong number renders identically to a right one, so do not move `checked`
 * without re-reading the source, and treat an unverified edit as a content bug.
 */

import type { RateCard } from "@/lib/tools-rates";

export const PAYPAL_RATE_CARD: RateCard = {
  key: "paypal",
  processorName: "PayPal",
  processorSlug: "paypal",
  checked: "27 August 2026",
  sources: [
    {
      label: "paypal.com US business fees (page states last updated 15 July 2026)",
      url: "https://www.paypal.com/us/business/paypal-business-fees",
    },
  ],
  plans: [{ id: "standard", label: "Standard US seller rates", monthly: 0 }],
  channels: [
    {
      id: "checkout",
      label: "PayPal Checkout",
      note: "Also Guest Checkout and Pay with Venmo. The default rate for a PayPal button.",
      rates: { standard: { rate: 3.49, fixed: 0.49 } },
    },
    {
      id: "cards",
      label: "Standard card payments",
      note: "A card entered on your own site rather than through the PayPal wallet.",
      rates: { standard: { rate: 2.99, fixed: 0.49 } },
    },
    {
      id: "advanced",
      label: "Advanced card payments",
      note: "The upgraded card processing product, subject to approval.",
      rates: { standard: { rate: 2.89, fixed: 0.49 } },
    },
    {
      id: "invoice",
      label: "Invoicing",
      note: "An invoice paid through PayPal Checkout or Venmo.",
      rates: { standard: { rate: 3.49, fixed: 0.49 } },
    },
    {
      id: "qr",
      label: "QR code in person",
      note: "The cheapest PayPal channel, and the one most sellers never switch on.",
      rates: { standard: { rate: 2.29, fixed: 0.09 } },
    },
    {
      id: "pos",
      label: "PayPal Point of Sale, card present",
      rates: { standard: { rate: 2.29, fixed: 0.09 } },
    },
    {
      id: "vt",
      label: "Virtual Terminal",
      note: "Phone and mail orders keyed in by you.",
      rates: { standard: { rate: 3.39, fixed: 0.49 } },
    },
    {
      id: "paylater",
      label: "PayPal Pay Later",
      rates: { standard: { rate: 4.99, fixed: 0.49 } },
    },
    {
      id: "micro",
      label: "Micropayments",
      note: "Opt-in pricing. Cheaper only on very small tickets, roughly under $12.",
      rates: { standard: { rate: 4.99, fixed: 0.09 } },
    },
    {
      id: "ach",
      label: "ACH services",
      note: "Capped at $5.00 per transaction.",
      rates: { standard: { rate: 0.8, fixed: 0 } },
    },
  ],
  addOns: [
    {
      id: "intl",
      label: "Buyer outside the US",
      rate: 1.5,
      note: "Added to whichever domestic rate applies.",
    },
  ],
  extras: [
    { label: "Chargeback fee", value: "$20.00" },
    { label: "Standard dispute fee", value: "$15.00" },
    { label: "Currency conversion spread", value: "3.00% to 4.00% depending on transaction type" },
    { label: "Monthly account fee", value: "None on standard rates" },
  ],
};
