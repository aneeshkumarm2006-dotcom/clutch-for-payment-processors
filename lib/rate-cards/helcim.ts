/**
 * Helcim's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to the widget as a prop, so only the
 * one card a page needs is ever serialized.
 *
 * MAINTENANCE CONTRACT. Every figure was read off Helcim's own published US
 * schedule on the `checked` date recorded below, with the source beside it. A
 * wrong number renders identically to a right one, so do not move `checked`
 * without re-reading the source, and treat an unverified edit as a content bug.
 *
 * WHAT MAKES THIS CARD DIFFERENT FROM THE FLAT-RATE CARDS.
 *
 * Stripe, PayPal and Square publish a rate you pay. Helcim publishes a MARGIN it
 * adds on top of interchange, so every percentage in `channels` below is a
 * markup and NOT a price. The number a merchant actually pays is interchange,
 * plus card network assessments, plus the markup here. Reading these figures as
 * a total cost understates a real Helcim bill by roughly two percentage points,
 * which is why this card cannot drive `BrandFeeCalculator` and gets its own
 * widget.
 *
 * WHY THE VOLUME TIERS LIVE IN `plans`.
 *
 * `RateCard.plans` was built for a paid plan ladder (Square Free, Plus,
 * Premium). Helcim has no plans and no monthly fee at all, so the slot carries
 * the thing that actually changes the rate: the monthly volume band. Every plan
 * below therefore has `monthly: 0`, and the band boundaries are in each plan's
 * `note`. The discount is automatic and is applied on the average of the last
 * three months of processing volume, so there is nothing to negotiate and
 * nothing to sign up for.
 *
 * The machine-readable thresholds a calculator needs are in
 * `lib/tools-data/helcim.ts` as `HELCIM_VOLUME_TIERS`. The two are cross-checked
 * against each other in `tests/tools/batch-four/helcim-fee-calculator.test.ts`
 * so they cannot drift apart silently.
 */

import type { RateCard } from "@/lib/tools-rates";

export const HELCIM_RATE_CARD: RateCard = {
  key: "helcim",
  processorName: "Helcim",
  processorSlug: "helcim",
  checked: "5 September 2026",
  sources: [
    { label: "helcim.com/pricing", url: "https://www.helcim.com/pricing/" },
    {
      label: "helcim.com international card processing",
      url: "https://www.helcim.com/international-credit-card-processing/",
    },
  ],
  plans: [
    {
      id: "t1",
      label: "Under $50K a month",
      monthly: 0,
      note: "Monthly credit card volume of $0 to $50,000. The entry band, and where most single-location merchants sit.",
    },
    {
      id: "t2",
      label: "$50K to $100K a month",
      monthly: 0,
      note: "Monthly credit card volume of $50,000 to $100,000. Applied automatically on your three-month average.",
    },
    {
      id: "t3",
      label: "$100K to $500K a month",
      monthly: 0,
      note: "Monthly credit card volume of $100,000 to $500,000. The widest band, and the one most multi-location merchants stay in for years.",
    },
    {
      id: "t4",
      label: "$500K to $1M a month",
      monthly: 0,
      note: "Monthly credit card volume of $500,000 to $1,000,000.",
    },
    {
      id: "t5",
      label: "$1M to $5M a month",
      monthly: 0,
      note: "Monthly credit card volume of $1,000,000 to $5,000,000. Above $5,000,000 Helcim quotes custom pricing rather than publishing a rate.",
    },
  ],
  channels: [
    {
      id: "inPerson",
      label: "In person (card present)",
      note: "MARKUP ONLY, added on top of interchange and assessments. Chip, tap and PIN through a Helcim terminal or Tap to Pay.",
      rates: {
        t1: { rate: 0.4, fixed: 0.08 },
        t2: { rate: 0.35, fixed: 0.07 },
        t3: { rate: 0.25, fixed: 0.07 },
        t4: { rate: 0.2, fixed: 0.06 },
        t5: { rate: 0.15, fixed: 0.06 },
      },
    },
    {
      id: "online",
      label: "Keyed and online",
      note: "MARKUP ONLY, added on top of interchange and assessments. Covers online checkout, payment links, invoices and the virtual terminal.",
      rates: {
        t1: { rate: 0.5, fixed: 0.25 },
        t2: { rate: 0.45, fixed: 0.2 },
        t3: { rate: 0.35, fixed: 0.2 },
        t4: { rate: 0.25, fixed: 0.15 },
        t5: { rate: 0.15, fixed: 0.15 },
      },
    },
  ],
  addOns: [
    {
      id: "recurring",
      label: "Recurring and subscription billing",
      rate: 0.4,
      note: "Helcim's own add-on, charged per transaction on automated subscription billing.",
    },
    {
      id: "crossBorder",
      label: "Card issued outside the US (Visa or Mastercard)",
      rate: 1.45,
      note: "A card network cross-border fee, passed through inside the interchange-plus price rather than added by Helcim. Visa is +1.45% plus 3.6 cents, Mastercard +1.45%, American Express +1.00% and Discover +1.30%.",
    },
  ],
  extras: [
    { label: "Monthly account fee", value: "$0. No minimum, statement or software fee" },
    { label: "Setup and PCI compliance", value: "$0" },
    { label: "Contract and cancellation fee", value: "$0. No contract and no termination fee" },
    { label: "Chargeback", value: "$0 if the case is resolved in your favor, $15 if lost" },
    { label: "ACH and EFT-PAD", value: "0.5% + $0.25, capped at $6.00, plus 0.05% above $25,000" },
    { label: "ACH return, reject or NSF", value: "$5.00 per rejected transaction" },
    { label: "Refunds", value: "No added fee, but the original transaction fees are not returned" },
    { label: "Deposit speed", value: "Next business morning on card and debit transactions" },
    { label: "How the volume discount is applied", value: "Automatically, on the average of your last three months of processing volume" },
  ],
};
