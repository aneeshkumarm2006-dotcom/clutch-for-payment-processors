/**
 * Stripe's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to `BrandFeeCalculator` as a prop, so
 * only the one card a page needs is ever serialized.
 *
 * MAINTENANCE CONTRACT. Every figure was read off Stripe's own published US
 * schedule on the `checked` date recorded below, with the source beside it. A
 * wrong number renders identically to a right one, so do not move `checked`
 * without re-reading the source, and treat an unverified edit as a content bug.
 */

import type { RateCard } from "@/lib/tools-rates";

export const STRIPE_RATE_CARD: RateCard = {
  key: "stripe",
  processorName: "Stripe",
  processorSlug: "stripe",
  checked: "1 September 2026",
  sources: [{ label: "stripe.com/pricing", url: "https://stripe.com/pricing" }],
  plans: [{ id: "standard", label: "Standard pricing", monthly: 0 }],
  channels: [
    {
      id: "online",
      label: "Online cards and wallets",
      note: "Domestic cards, the standard rate most accounts pay.",
      rates: { standard: { rate: 2.9, fixed: 0.3 } },
    },
    {
      id: "terminal",
      label: "In person (Terminal)",
      note: "Card present. Tap to Pay adds $0.10 per authorization.",
      rates: { standard: { rate: 2.7, fixed: 0.05 } },
    },
    {
      id: "link",
      label: "Instant bank payments",
      note: "Bank payments confirmed at card speed.",
      rates: { standard: { rate: 2.6, fixed: 0.3 } },
    },
    {
      id: "ach",
      label: "ACH Direct Debit",
      note: "Capped at $5.00 per transaction, which is why it wins on large tickets.",
      rates: { standard: { rate: 0.8, fixed: 0 } },
    },
  ],
  addOns: [
    {
      id: "keyed",
      label: "Card details typed in manually",
      rate: 0.5,
      note: "Applies on top of the online rate.",
    },
    { id: "intl", label: "Card issued outside the US", rate: 1.5 },
    { id: "fx", label: "Currency conversion required", rate: 1 },
  ],
  extras: [
    { label: "Dispute received fee", value: "$15.00 per dispute" },
    { label: "Instant payouts", value: "1.5% of volume, minimum $0.50" },
    { label: "Standard payouts", value: "Free" },
    { label: "Monthly account fee", value: "None on standard pricing" },
  ],
};
