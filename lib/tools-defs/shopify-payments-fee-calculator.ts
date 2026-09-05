/**
 * `/tools/shopify-payments-fee-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. "shopify fee calculator", "shopify payments
 * fees", "how much does shopify take per sale", "shopify transaction fee". It
 * owns the CALCULATION modifier only: Shopify as a platform belongs to
 * `/payment-processors/for-shopify`, and Stripe's own pricing belongs to
 * `/processor/stripe`. There is no `/processor/shopify` listing on this site,
 * and this page must not try to become one.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Shopify bills a merchant TWICE and
 * almost every calculator on the query shows one of the two costs. There is the
 * Shopify Payments card rate, which moves with the plan and the channel, and
 * there is the third-party transaction fee, which Shopify charges on top of the
 * order when the money did not go through Shopify Payments. That second fee buys
 * no processing whatsoever: a Basic merchant taking an $80 order through Stripe
 * pays Stripe $2.62 and then pays Shopify a further $1.60 on the same order. The
 * pages ranking for this term are mostly Shopify app vendors and affiliate blogs,
 * and they either omit the third-party fee, quote pre-rename plan names, or bury
 * the calculator behind an email form.
 *
 * WHERE THE NUMBERS CAME FROM. Every plan fee, card rate and third-party fee is
 * from `lib/rate-cards/shopify.ts`, read off a Wayback capture of the US
 * shopify.com/pricing page taken 4 September 2026 (shopify.com geo-redirects this
 * machine to rupee pricing). The Stripe half of the third-party channel is
 * `lib/rate-cards/stripe.ts`, stripe.com/pricing, 1 September 2026. Every dollar
 * figure and every break-even volume in the copy below was produced by running
 * the same arithmetic the widget runs and is asserted in
 * `tests/tools/batch-four/shopify-payments-fee-calculator.test.ts`. Nothing here
 * was written from intuition.
 */

import type { ToolDef } from "@/lib/tools";

const NOT_ADVICE =
  "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.";

export const SHOPIFY_PAYMENTS_FEE_TOOL: ToolDef = {
  slug: "shopify-payments-fee-calculator",
  name: "Shopify Payments Fee Calculator",
  h1: "Shopify fee calculator",
  title: "Shopify fee calculator: rates by plan and gateway",
  description:
    "Shopify fee calculator that stacks all three costs: the plan fee, the Shopify Payments card rate for your plan and channel, and the third-party gateway fee.",
  intro:
    "The Shopify Payments Fee Calculator prices an order twice, because Shopify can bill you twice. An $80 order on Basic costs $2.62 through Shopify Payments. The same $80 order taken through Stripe costs $4.22, because Stripe charges 2.9% plus 30 cents and Shopify then adds a 2% third-party transaction fee on top of it. That second fee buys no processing at all. Most Shopify fee calculator results show one of those two numbers and quietly drop the other.",
  tier: 1,
  summary:
    "Shopify plan fee, Shopify Payments card rate and the third-party gateway fee, stacked the way Shopify bills them.",
  widget: "brand-fee",
  rateCard: "shopify",
  workedExample: {
    scenario:
      "A homewares store on Shopify Basic, billed monthly at $39, takes 500 online orders in a month at an average ticket of $80, so $40,000 of card volume. It is deciding whether to keep Shopify Payments or move checkout to Stripe.",
    result:
      "On Shopify Payments the card rate on Basic is 2.9% plus 30 cents. The percentage on $40,000 is $1,160, the 30 cent fee across 500 orders is $150, and the plan fee is $39, so the month costs $1,349. That is an effective rate of 3.37%, which is already higher than the 2.9% headline because the plan fee and the fixed fee are in it. On a single $80 order the fee is 2.9% of $80, which is $2.32, plus 30 cents, so $2.62, and the store keeps $77.38. Now switch the same volume to Stripe. Stripe charges its own 2.9% plus 30 cents, and Shopify adds its 2% third-party transaction fee, so the blended rate is 4.9% plus 30 cents. The percentage on $40,000 is $1,960, the fixed fees are still $150, the plan fee is still $39, and the month costs $2,149 at an effective rate of 5.37%. The difference is $800 a month, or $9,600 a year, and it is exactly 2% of $40,000. Nothing was bought with it. Shopify Payments and Stripe charge an identical 2.9% plus 30 cents on Basic, so on this store the entire gap is the third-party fee and nothing else. Switching the same store to yearly billing takes the plan fee from $39 to $29 and saves a further $120 a year.",
  },
  sections: [
    {
      heading: "How the Shopify fee calculator adds the two stacked costs",
      body: [
        "Shopify's total cost of acceptance is three numbers added together, and the Shopify Payments Fee Calculator computes all three. The first is the plan fee, a fixed monthly charge per store: $39 on Basic, $105 on Grow, $399 on Advanced when you pay monthly, and $29, $79 or $299 when you pay a year up front. The second is the per transaction rate, quoted as a percentage of the order plus a fixed amount, which is 2.9% plus 30 cents online on Basic and falls to 2.7% on Grow and 2.5% on Advanced. The third only appears if you do not use Shopify Payments, and it is the one this page exists for.",
        "Write the month out and it is plain arithmetic. Monthly cost equals volume times the rate, plus the number of orders times the fixed fee, plus the plan fee. Volume is card volume, not revenue: gift cards, cash and third party marketplace orders are not in it. The order count matters more than merchants expect, because the fixed 30 cents does not scale. Five hundred orders carry $150 of fixed fees whether they are $20 orders or $200 orders, which is why a low average ticket wrecks the effective rate.",
        "Effective rate is the only number worth comparing between two setups, and it is total cost divided by card volume. On the worked example above it is 3.37%, not 2.9%, because the plan fee and the fixed fee are inside it. Anyone quoting you 2.9% is quoting the percentage component of one of three charges.",
        "Card present sales price differently and should never be blended into an online number. Shopify POS is 2.6% plus 10 cents on Basic, 2.5% on Grow and 2.4% on Advanced. The percentage is lower and the fixed fee is a third of the online one, so a $40 in person sale costs $1.14 against $1.46 online. If you sell in both places, run the calculator twice and add the answers rather than averaging the rates.",
      ],
    },
    {
      heading: "The third-party transaction fee is platform rent, not processing",
      body: [
        "When you use a payment provider other than Shopify Payments, Shopify charges a transaction fee on the order in addition to whatever the provider charges you. It is 2% on Basic, 1% on Grow, 0.6% on Advanced and 0.2% on Plus. Shopify performs no processing for this money. Your gateway authorizes the card, settles the funds and charges you for doing it, and Shopify then takes a further percentage of the same order for allowing it to happen on your store.",
        "The size of it is easy to underestimate because it looks small next to a card rate. Put it in dollars. A Basic store doing $40,000 a month pays $800 a month in third-party fees, $9,600 a year, on top of full processing costs. The Basic plan itself costs $348 a year at the yearly price, so the fee for not using Shopify Payments is more than twenty seven times the cost of the plan it rides on. On an $80 order it is $1.60, which is more than half of what the entire card transaction costs on Shopify Payments.",
        "The comparison people actually want is Shopify Payments against Stripe, and on Basic it is unusually clean. Shopify Payments charges 2.9% plus 30 cents online on Basic and Stripe's published US online rate is also 2.9% plus 30 cents, so the two are identical before the third-party fee and the third-party fee is the entire difference. On Grow and Advanced the Shopify Payments rate improves to 2.7% and 2.5% while Stripe's stays at 2.9%, so the gap widens rather than narrows. There is no plan on which routing a US card payment through Stripe instead of Shopify Payments is cheaper on the published rates.",
        "Two honest exceptions exist, and neither is about price. Shopify Payments is not available in every country and will not underwrite every category, so plenty of merchants have no choice. Others pay the fee deliberately to keep one processor across several sales channels. If that is you, use the option that shows Shopify's fee on its own, add your gateway's rate to it, and at least know what the arrangement costs.",
      ],
    },
    {
      heading: "Where each Shopify plan stops paying for itself",
      body: [
        "Upgrading a plan buys a lower rate, so there is a volume at which the extra plan fee is exactly repaid. The Shopify Payments Fee Calculator finds it if you switch plans with the same volume in the box, and the crossovers are nothing like where merchants guess they are.",
        "For a store on Shopify Payments the rate improves by 0.2 percentage points per step. Basic to Grow costs $66 more a month when billed monthly and saves 0.2% of volume, so the break-even is $33,000 a month of card volume. Below that, Basic is cheaper. Grow to Advanced costs $294 more a month for another 0.2 percentage points, so the break-even is $147,000 a month. Both crossovers are exact: at $147,000 across 500 orders, Grow costs $4,224 for the month and so does Advanced. On yearly billing the same two crossovers fall to $25,000 and $110,000 a month, because the plan fee gap shrinks while the rate gap does not.",
        "For a store on an outside gateway the ladder is completely different, because what improves is the third-party fee, and it improves by a full percentage point at the first step. Basic to Grow costs $66 more and cuts the fee from 2% to 1%, so it breaks even at only $6,600 a month of volume. Grow to Advanced costs $294 more for another 0.4 points and breaks even at $73,500 a month. A merchant on Basic taking $40,000 a month through Stripe is paying $839 a month in Shopify fees where Grow would charge $505, so the $66 upgrade saves $334 every month. Merchants on an outside gateway tend to compare plan fees against the card rate ladder and never notice the third-party fee has its own, much steeper one, which is how this saving gets missed.",
        "Watch the direction of both ladders. On Shopify Payments an upgrade rarely pays before five figures a month. On an outside gateway it pays almost immediately, because what you are really buying down is a fee that bought you nothing in the first place. The cheaper move, where the option is open, is to switch to Shopify Payments and stay on the plan you have.",
      ],
    },
    {
      heading: "The US line items most Shopify fee calculators leave out",
      body: [
        "Premium cards cost more and Shopify publishes a separate rate for them. Online premium card rates are 3.5% plus 30 cents on Basic, 3.3% on Grow and 3.1% on Advanced, against the standard 2.9%, 2.7% and 2.5%. Corporate cards, purchasing cards and some high reward consumer cards land here, so a B2B store can carry a materially higher blended rate than a consumer store on identical volume. Only the payouts report tells you which orders were premium.",
        "Manual entry is priced as its own channel and does not improve with the plan. In person manual card entry is 3.5% plus 10 cents on Basic, on Grow and on Advanced alike, so a store taking phone orders through the POS pays nearly a point more than the same store taking the same card in person. Cards issued outside the US add 1% to the online rate on every plan, a flat add-on the same way Stripe adds 1.5%, just at a lower rate.",
        "Two fixed costs sit outside the per transaction rate. POS Pro is $89 a month per location on top of the plan, so a three store retailer pays $267 a month before a single sale. Marketplace order syncing is free to 50 orders a month and then charges 1% capped at $99 a month. Neither is in the per order rate, and neither appears in a calculator that only models a percentage.",
        "Shopify Plus is deliberately absent from the plan selector, and that absence is the honest answer rather than a gap. Shopify publishes three Plus numbers: from $2,300 a month, card rates from 2.25% plus 30 cents, and a 0.2% third-party fee. Every other Plus cell in its own table reads as most competitive rates, which means negotiated. Any calculator that hands you a firm Plus in person rate has made it up.",
      ],
    },
    {
      heading: "When the number means act, and when it means do nothing",
      body: [
        "Three results are worth acting on immediately: an effective rate above roughly 3.2% on a store that is entirely online and domestic, a third-party fee line of any size when Shopify Payments is open to you, and a plan sitting above its own break-even volume. The high effective rate usually means an outside gateway is costing you the third-party fee, or your average ticket is small enough that the 30 cent fee dominates.",
        "Two results mean do nothing. A store on Basic with Shopify Payments doing under $33,000 a month is on the right plan, and the upgrade would cost more than it saves. And a rate that looks high purely because the average ticket is small is not a pricing problem: at a $12 average ticket, the 30 cent fixed fee alone is 2.5% of the sale and no plan change touches it. The fix there is order value, bundling or a minimum order, not a processor conversation.",
        "The move merchants jump to instead is leaving the platform, and it is usually the wrong first step. Work out the annual number first: at $40,000 a month on Basic with Shopify Payments the whole payments cost is $16,188 a year, and moving to interchange plus pricing might realistically save a fifth of it. Compare that against a quote for the migration, the lost conversion while it runs and the integrations you rebuild, before anyone writes a project plan.",
        "Finally, check that these figures are still current. Shopify has renamed and repriced its plans more than once, which is why the Shopify Payments Fee Calculator prints the date its rate card was read at the foot of the page. If that date is more than a few months old, open Shopify's own pricing page before you act on a number you read here.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Shopify US plan fees and rates as published on 4 September 2026, except the last row, which this page computes",
    columns: ["Basic", "Grow", "Advanced", "Plus"],
    rows: [
      { label: "Plan fee, billed monthly", values: ["$39", "$105", "$399", "From $2,300"] },
      { label: "Plan fee, billed yearly", values: ["$29", "$79", "$299", "Negotiated"] },
      {
        label: "Online standard card",
        note: "Shopify Payments",
        values: ["2.9% + $0.30", "2.7% + $0.30", "2.5% + $0.30", "From 2.25% + $0.30"],
      },
      {
        label: "Online premium card",
        note: "Rewards and commercial cards",
        values: ["3.5% + $0.30", "3.3% + $0.30", "3.1% + $0.30", "Not published"],
      },
      {
        label: "In person",
        note: "Shopify POS, card present",
        values: ["2.6% + $0.10", "2.5% + $0.10", "2.4% + $0.10", "Not published"],
      },
      {
        label: "In person, manually keyed",
        values: ["3.5% + $0.10", "3.5% + $0.10", "3.5% + $0.10", "Not published"],
      },
      { label: "Card issued outside the US", note: "Added to the online rate", values: ["+1%", "+1%", "+1%", "Not published"] },
      {
        label: "Third-party transaction fee",
        note: "Charged on top of your gateway's own fee",
        values: ["2%", "1%", "0.6%", "0.2%"],
      },
      {
        label: "Transaction fee on Shopify Payments",
        values: ["None", "None", "None", "None"],
      },
      {
        label: "Same order through Stripe, all in",
        note: "Computed on this page: Stripe 2.9% + $0.30 plus Shopify's third-party fee",
        values: ["4.9% + $0.30", "3.9% + $0.30", "3.5% + $0.30", "3.1% + $0.30"],
      },
    ],
  },
  assumptions: [
    "Plan fees and card rates are Shopify's published US schedule, read from a Wayback capture of shopify.com/pricing taken on 4 September 2026. shopify.com geo-redirects to local pricing, so the checked date is the capture date rather than the date you are reading this.",
    "The third-party gateway option adds Stripe's published US online rate of 2.9% plus 30 cents, read from stripe.com/pricing on 1 September 2026, to Shopify's third-party transaction fee. If your gateway prices differently, choose the option that shows Shopify's fee on its own and add your gateway's own rate to the result.",
    "Shopify Plus is not in the plan selector on purpose. Shopify publishes only two Plus figures, from $2,300 a month and card rates from 2.25% plus 30 cents, and marks every other Plus cell in its own table as most competitive rates. Plus pricing is negotiated, so a calculator that quotes you a firm Plus rate is guessing.",
    "POS Pro at $89 a month per location, app subscriptions, Shopify Markets, currency conversion, shipping labels and dispute fees are not modelled. Shopify does not publish a US dispute fee on its pricing page, so this page does not quote one.",
    "Figures are for US stores selling in US dollars. Shopify's rates, and in some markets its plan names, differ by country.",
    "The break-even volumes in the copy are arithmetic on those published rates, computed exactly the way the calculator computes a month, and reproducible by entering the same figures above. They are not survey data about what merchants pay.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "How much does Shopify take per sale?",
      answer:
        "On Shopify Payments in the US it is 2.9% plus 30 cents online on Basic, 2.7% plus 30 cents on Grow and 2.5% plus 30 cents on Advanced. In person it is 2.6%, 2.5% or 2.4% plus 10 cents. On an $80 online order on Basic that is $2.62, leaving you $77.38. If you use an outside gateway, add Shopify's third-party transaction fee of 2%, 1% or 0.6% on top of your gateway's own charge.",
    },
    {
      question: "What is the Shopify transaction fee if I do not use Shopify Payments?",
      answer:
        "2% on Basic, 1% on Grow, 0.6% on Advanced and 0.2% on Plus, charged on the order value in addition to whatever your gateway charges. It buys no processing. A Basic store doing $40,000 a month pays $800 a month, or $9,600 a year, purely for the right to use a different provider on its own checkout.",
    },
    {
      question: "Is Shopify Payments cheaper than Stripe on Shopify?",
      answer:
        "Yes, on the published US rates, on every plan. On Basic both charge 2.9% plus 30 cents, so Shopify's 2% third-party fee is the entire difference: $1,349 a month against $2,149 on $40,000 across 500 orders. On Grow and Advanced the Shopify Payments rate drops to 2.7% and 2.5% while Stripe stays at 2.9%, so the gap gets bigger, not smaller.",
    },
    {
      question: "How much does Shopify cost per month?",
      answer:
        "Basic is $39 a month billed monthly or $29 billed yearly, Grow is $105 or $79, Advanced is $399 or $299, and Plus starts at $2,300. POS Pro adds $89 a month per location. Those are per store, and they sit on top of the per transaction card rate rather than replacing it.",
    },
    {
      question: "Is it cheaper to pay for Shopify yearly?",
      answer:
        "Yes, and the saving is fixed rather than proportional: $10 a month on Basic, which is $120 a year, $26 a month on Grow, which is $312 a year, and $100 a month on Advanced, which is $1,200 a year. The card rates are identical either way, so the annual discount is the only thing that changes.",
    },
    {
      question: "When is it worth upgrading from Shopify Basic to Grow?",
      answer:
        "It depends entirely on whether you use Shopify Payments. On Shopify Payments the upgrade costs $66 more a month and saves 0.2 percentage points, so it breaks even at $33,000 a month of card volume. On an outside gateway it cuts the third-party fee from 2% to 1%, so it breaks even at just $6,600 a month, and a store at $40,000 a month saves $334 every month by upgrading.",
    },
  ],
  related: [
    "stripe-fee-calculator",
    "credit-card-processing-fee-calculator",
    "effective-rate-calculator",
    "break-even-and-margin-calculator",
  ],
  links: [
    { label: "Payment processors that work with Shopify", href: "/payment-processors/for-shopify" },
    { label: "Stripe review and full US pricing", href: "/processor/stripe" },
    { label: "Stripe vs PayPal, if you are picking a gateway", href: "/compare/stripe-vs-paypal" },
    { label: "What a payment gateway is", href: "/glossary/payment-gateway" },
    { label: "Effective rate, defined", href: "/glossary/effective-rate" },
    { label: "Processors for ecommerce", href: "/category/ecommerce" },
  ],
  cta: {
    heading: "Paying Shopify a fee that buys no processing?",
    body: "Tell us your volume and platform and we will shortlist processors that price your checkout differently.",
    label: "Get matched",
  },
};
