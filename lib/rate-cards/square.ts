/**
 * Square's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to `BrandFeeCalculator` as a prop, so
 * only the one card a page needs is ever serialized.
 *
 * MAINTENANCE CONTRACT. Every figure was read off Square's own published US
 * schedule on the `checked` date recorded below, with the source beside it. A
 * wrong number renders identically to a right one, so do not move `checked`
 * without re-reading the source, and treat an unverified edit as a content bug.
 */

import type { RateCard } from "@/lib/tools-rates";

export const SQUARE_RATE_CARD: RateCard = {
  key: "square",
  processorName: "Square",
  processorSlug: "square",
  checked: "12 August 2026",
  sources: [
    { label: "squareup.com US pricing", url: "https://squareup.com/us/en/pricing" },
    { label: "squareup.com payments fees", url: "https://squareup.com/us/en/payments/our-fees" },
  ],
  plans: [
    { id: "free", label: "Square Free", monthly: 0 },
    { id: "plus", label: "Square Plus", monthly: 49, note: "Per location." },
    { id: "premium", label: "Square Premium", monthly: 149, note: "Per location." },
  ],
  channels: [
    {
      id: "inperson",
      label: "Tap, dip or swipe",
      note: "Card present. The rate Square raised in 2026, and the one most ranking calculators still get wrong.",
      rates: {
        free: { rate: 2.6, fixed: 0.15 },
        plus: { rate: 2.5, fixed: 0.15 },
        premium: { rate: 2.4, fixed: 0.15 },
      },
    },
    {
      id: "online",
      label: "Online and invoices",
      note: "Square groups invoice payments WITH online, which is where the plan difference bites hardest.",
      rates: {
        free: { rate: 3.3, fixed: 0.3 },
        plus: { rate: 2.9, fixed: 0.3 },
        premium: { rate: 2.9, fixed: 0.3 },
      },
    },
    {
      id: "api",
      label: "Online API",
      note: "Payments taken inside your own app or site through Square's APIs.",
      rates: {
        free: { rate: 2.9, fixed: 0.3 },
        plus: { rate: 2.9, fixed: 0.3 },
        premium: { rate: 2.9, fixed: 0.3 },
      },
    },
    {
      id: "keyed",
      label: "Manual entry or card on file",
      rates: {
        free: { rate: 3.5, fixed: 0.15 },
        plus: { rate: 3.5, fixed: 0.15 },
        premium: { rate: 3.5, fixed: 0.15 },
      },
    },
    {
      id: "afterpay",
      label: "Afterpay",
      rates: {
        free: { rate: 6, fixed: 0.3 },
        plus: { rate: 6, fixed: 0.3 },
        premium: { rate: 6, fixed: 0.3 },
      },
    },
    {
      id: "ebt",
      label: "EBT",
      note: "Fees waived while the feature is in beta.",
      rates: {
        free: { rate: 1.8, fixed: 0.05 },
        plus: { rate: 1.8, fixed: 0.05 },
        premium: { rate: 1.8, fixed: 0.05 },
      },
    },
  ],
  addOns: [{ id: "intl", label: "Card issued outside the US", rate: 1.5 }],
  extras: [
    { label: "ACH by invoice", value: "1%, $1 minimum, $10 fee cap on Plus and Premium" },
    { label: "Gift card load", value: "2.5% on Free and Plus, 0% on Premium" },
    { label: "Monthly plan fee", value: "$0, $49 or $149 per location" },
    { label: "Standard payouts", value: "Next business day" },
  ],
};
