/**
 * Toast's published US rate card.
 *
 * ONE MODULE PER CARD, for the same bundling reason `lib/tools-data/*` is split:
 * `/tools/[tool]` is a single route, so anything reachable from a `"use client"`
 * module lands in the chunk every calculator page downloads. The cards are read
 * on the SERVER in `ToolWidget` and handed to `BrandFeeCalculator` as a prop, so
 * only the one card a page needs is ever serialized.
 *
 * MAINTENANCE CONTRACT. Every figure below was read off a Toast page on the
 * `checked` date recorded here, with the source beside it. A wrong number renders
 * identically to a right one, so do not move `checked` without re-reading the
 * source, and treat an unverified edit as a content bug.
 *
 * ─── Why this card looks thinner than Stripe's or Square's ────────────────────
 * Because Toast publishes almost nothing. Two card rates exist on Toast's own
 * website, both on the Starter Kit shop page and both card present:
 *
 *   Pay-as-you-Go   "A 3.09% card processing fee covers all costs, except for
 *                    shipping and taxes."
 *   Traditional     "This option includes a 2.49% card processing fee."
 *
 * That is the whole published schedule. Everything else is quoted:
 * `pos.toasttab.com/payments/payment-processing-fees` says "We'll work with you
 * to build a custom rate specific to the characteristics of your restaurant",
 * and the Point of Sale and Build Your Own plans on `pos.toasttab.com/pricing`
 * carry a software price and no card rate at all.
 *
 * THREE CONSEQUENCES FOR THIS FILE, all deliberate:
 *
 * 1. `fixed` is 0 on every row. Toast states both rates as bare percentages with
 *    no per transaction component. Plenty of ranking pages attach "+ $0.15" to
 *    these rates. No Toast page this card was built from does, so inventing one
 *    here would put a number on the page that Toast never published. If Toast
 *    ever publishes a per item fee, add it and move `checked`.
 *
 * 2. The card not present channel carries the SAME rates as the card present
 *    channel, and its note says why. Toast's own fees page states that "the
 *    processing costs for card-not-present transactions are higher than for
 *    card-present transactions" but publishes no CNP rate. Copying the card
 *    present rate makes the online figure an explicit FLOOR rather than an
 *    estimate, which is the only honest thing the widget can compute. The page
 *    copy says so in the assumptions block, and the channel note says so in the
 *    UI.
 *
 * 3. The $69 on the Traditional plan is Toast's published Point of Sale starting
 *    price ("Starting at $69 /month"), NOT a quoted Starter Kit software fee.
 *    Toast does not publish what the Traditional Starter Kit's monthly software
 *    subscription costs, so treat $69 as a floor. It is labeled that way in the
 *    plan note, on the rate table and in the assumptions.
 */

import type { RateCard } from "@/lib/tools-rates";

export const TOAST_RATE_CARD: RateCard = {
  key: "toast",
  processorName: "Toast",
  processorSlug: "toast",
  checked: "5 September 2026",
  sources: [
    { label: "Toast Starter Kit shop page (the two published card rates)", url: "https://pos.toasttab.com/shop/starter-kits" },
    { label: "Toast pricing and plans", url: "https://pos.toasttab.com/pricing" },
    { label: "Toast payment processing fees", url: "https://pos.toasttab.com/payments/payment-processing-fees" },
    { label: "Toast Delivery Services fees (Toast support)", url: "https://support.toasttab.com/en/article/Toast-Delivery-Services" },
    { label: "Toast hardware", url: "https://pos.toasttab.com/hardware" },
  ],
  plans: [
    {
      id: "payg",
      label: "Starter Kit, Pay-as-you-Go",
      monthly: 0,
      note: "No monthly software fee and no upfront hardware cost. You pay for both in the card rate.",
    },
    {
      id: "traditional",
      label: "Starter Kit, Traditional",
      monthly: 69,
      note: "Hardware bought outright plus a monthly software subscription. $69 is Toast's published Point of Sale starting price, not a quoted Starter Kit fee, so treat it as a floor.",
    },
  ],
  channels: [
    {
      id: "inperson",
      label: "In person: tap, dip or swipe",
      note: "Toast's two published US card rates. Both are stated as bare percentages with no per transaction fee, and both include the tip, the tax and any service charge on the check.",
      rates: {
        payg: { rate: 3.09, fixed: 0 },
        traditional: { rate: 2.49, fixed: 0 },
      },
    },
    {
      id: "cnp",
      label: "Online ordering, phone or keyed",
      note: "A FLOOR, not an estimate. Toast states that card not present costs more than card present but publishes no card not present rate, so this channel repeats the published card present rate. Your quoted online rate will be above it.",
      rates: {
        payg: { rate: 3.09, fixed: 0 },
        traditional: { rate: 2.49, fixed: 0 },
      },
    },
  ],
  addOns: [],
  extras: [
    { label: "Published card rate, Pay-as-you-Go", value: "3.09% of the transaction, no monthly software fee, no upfront hardware cost" },
    { label: "Published card rate, Traditional", value: "2.49% of the transaction, hardware paid up front" },
    { label: "Card not present rate", value: "Quoted. Toast publishes none, and states card not present costs more" },
    { label: "Point of Sale software plan", value: "Starting at $69 a month, card rate quoted" },
    { label: "Build Your Own plan", value: "Custom pricing, card rate quoted" },
    { label: "POS and Payroll bundle", value: "Starting at $69 a month plus $9 per employee a month" },
    { label: "Hardware", value: "Starting at $0, first device only. Software and processing fees apply" },
    { label: "Toast Online Ordering commission", value: "None. Toast markets its own online ordering as commission free" },
    { label: "Toast Delivery Services, Uber Direct", value: "$6.99 under 6 miles, $8.74 at 6 to 8 miles, $9.99 at 9 to 10 miles" },
    { label: "Toast Delivery Services, DoorDash Drive", value: "$7.49 within 5 miles, plus $0.50 per mile above 5 up to 10" },
    { label: "Delivery regulatory fees", value: "California +$2.00, New York City +$3.00, Seattle +$5.00 on Uber Direct" },
    { label: "Processing base", value: "The gross amount of every card transaction, tips included" },
  ],
};
