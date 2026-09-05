/**
 * Clover's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to `BrandFeeCalculator` as a prop, so
 * only the one card a page needs is ever serialized.
 *
 * MAINTENANCE CONTRACT. Every figure was read off Clover's own published US
 * schedule on the `checked` date recorded below, with the source beside it. A
 * wrong number renders identically to a right one, so do not move `checked`
 * without re-reading the source, and treat an unverified edit as a content bug.
 *
 * WHY THIS CARD IS SHAPED BY PLAN AND NOT BY DEVICE, which is the one thing a
 * Clover merchant gets wrong. Clover publishes six vertical pricing pages
 * (retail, full service dining, quick service restaurant, professional services,
 * personal services, home and field services) and each one sells a bundle of
 * hardware plus a software plan. Read across all six and the card rate does not
 * track the hardware at all: a Clover Go reader and a Station Duo both charge
 * 2.6% + $0.10 card present on the Starter plan and both charge 2.3% + $0.10 on
 * a Growth plan. The SOFTWARE PLAN is the rate. That is why `plans` here is the
 * five published plan names rather than the six vertical bundles, and why the
 * hardware prices live in `extras` rather than in the rate maths.
 *
 * THE BIGGER CAVEAT, which the page copy states plainly and this comment repeats
 * so nobody edits it out. Clover is a Fiserv brand sold through resellers.
 * Clover's own pricing FAQ says contract terms and termination fees "can vary
 * based on your service provider, whether Clover Direct or among our trusted
 * partners including Citi, PNC and Wells Fargo, or from more than 3,000 other
 * financial institution partners that also sell Clover solutions in the US." The
 * rates below are Clover Direct's published online prices. A merchant signed by
 * a bank or an ISO can be on a completely different, often tiered, schedule on
 * identical hardware. This card is therefore a BASELINE to compare a statement
 * against, not a promise about what any given Clover merchant pays.
 *
 * NO ADD-ONS ARRAY ON PURPOSE. Stripe and PayPal publish stacking percentage
 * surcharges (keyed, international, currency conversion) and this card would
 * carry them if Clover published any. Clover does not publish an international
 * or a currency conversion add-on on its US pricing pages, so inventing one to
 * fill the field would be a fabricated number. An empty array renders no
 * checkbox group in `BrandFeeCalculator`, which is the correct outcome.
 */

import type { RateCard } from "@/lib/tools-rates";

export const CLOVER_RATE_CARD: RateCard = {
  key: "clover",
  processorName: "Clover",
  processorSlug: "clover",
  checked: "5 September 2026",
  sources: [
    { label: "clover.com US pricing hub and pricing FAQ", url: "https://www.clover.com/pricing" },
    { label: "clover.com retail systems pricing", url: "https://www.clover.com/pricing/retail" },
    { label: "clover.com full service dining pricing", url: "https://www.clover.com/pricing/restaurant" },
    {
      label: "clover.com quick service restaurant pricing",
      url: "https://www.clover.com/pricing/quick-service-restaurant",
    },
    {
      label: "clover.com professional services pricing",
      url: "https://www.clover.com/pricing/professional-services",
    },
    {
      label: "clover.com home and field services pricing",
      url: "https://www.clover.com/pricing/home-field-services",
    },
    { label: "clover.com Clover Go pricing", url: "https://www.clover.com/pricing/go" },
  ],
  // Ordered cheapest monthly fee first, so `defaultPlanId` lands on the plan a
  // merchant is put on by default rather than on the one Clover would rather
  // sell. The two Growth plans at $84.95 are separate entries because Clover
  // publishes them under separate names on separate vertical pages, and a
  // merchant looking for the plan on their own invoice needs to find it here.
  plans: [
    { id: "starter", label: "Starter", monthly: 0, note: "No monthly software fee." },
    { id: "essentials", label: "Essentials", monthly: 29.95 },
    { id: "retail-growth", label: "Retail Growth", monthly: 84.95 },
    { id: "restaurant-growth", label: "Restaurant Growth", monthly: 89.95 },
    { id: "services-growth", label: "Services Growth", monthly: 84.95 },
  ],
  channels: [
    {
      id: "inperson",
      label: "Card tapped, swiped or inserted",
      note: "Card present at a Clover device. The rate moves with your software plan, not with the device.",
      rates: {
        starter: { rate: 2.6, fixed: 0.1 },
        essentials: { rate: 2.5, fixed: 0.1 },
        "retail-growth": { rate: 2.3, fixed: 0.1 },
        "restaurant-growth": { rate: 2.3, fixed: 0.1 },
        "services-growth": { rate: 2.3, fixed: 0.1 },
      },
    },
    {
      id: "keyed",
      label: "Card typed in, online or over the phone",
      note: "Clover charges one card not present rate on every plan, and its own FAQ groups online sales and phone orders under it.",
      rates: {
        starter: { rate: 3.5, fixed: 0.1 },
        essentials: { rate: 3.5, fixed: 0.1 },
        "retail-growth": { rate: 3.5, fixed: 0.1 },
        "restaurant-growth": { rate: 3.5, fixed: 0.1 },
        "services-growth": { rate: 3.5, fixed: 0.1 },
      },
    },
  ],
  // Clover publishes no stacking percentage surcharges on its US pricing pages.
  // See the module header: an empty array is the honest value here.
  addOns: [],
  extras: [
    { label: "Monthly software fee", value: "$0, $29.95, $84.95 or $89.95 depending on the plan" },
    { label: "Each additional device on the same plan", value: "$19.95 a month" },
    { label: "Rapid Deposit", value: "1.75% of the amount moved" },
    { label: "Hardware, bought outright", value: "$199 Clover Go to $4,447 for the largest dining bundle" },
    { label: "Hardware, on subscription", value: "36 months, non-cancelable, auto-extends without 30 days notice" },
    { label: "Processor lock", value: "Clover devices cannot be used with another payment processor" },
  ],
};
