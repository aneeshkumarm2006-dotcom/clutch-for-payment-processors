import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/refund-cost-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on refunds, plus the
 * head question the whole category is built on: "do you get processing fees back
 * on a refund". Also "stripe refund fee", "does square refund processing fees",
 * "paypal refund fee", all of which are the same question asked at a brand. The
 * brand PRICING intent still belongs to `/processor/<slug>`, so this page prices
 * the consequence and links out for the rate card.
 *
 * WHAT THE COMPETITION GETS WRONG. Three things, all checkable:
 *
 *   1. They answer one processor in one sentence and stop. Nobody prices the
 *      consequence, which is that a merchant pays processing on volume that
 *      produced no revenue, so the rate on the money actually kept is higher
 *      than the rate on the statement. On this page's defaults that is 4.01
 *      percent against a 2.9 percent headline.
 *   2. They are stale on Square and on PayPal. Square returned processing fees
 *      on refunds until 11 April 2023 and stopped; PayPal returned the
 *      percentage portion until 2019 and stopped. Pages written before those
 *      dates still rank.
 *   3. They treat a partial refund as a scaled-down full refund. It is not: the
 *      fixed fee was charged once, in full, and nothing prorates it, so the fee
 *      lands on whatever sliver of the order you keep.
 *
 * WHERE THE NUMBERS CAME FROM. The policy flags, quotes and dates are in
 * `lib/tools-data/refunds.ts`, one primary source per row, all read 5 September
 * 2026. The return rate benchmarks are the National Retail Federation and Happy
 * Returns release of 15 October 2025. Every dollar figure in the copy below was
 * produced by `lib/calc/refund.ts` on the widget's own default inputs and is
 * asserted in `tests/tools/batch-four/refund-cost-calculator.test.ts`, because a
 * hand-written number that disagrees with the widget on the same page has
 * shipped on this site before.
 */
export const REFUND_COST_TOOL: ToolDef = {
  slug: "refund-cost-calculator",
  name: "Refund Cost Calculator",
  h1: "Refund cost calculator: what a refunded order really costs",
  title: "Refund cost calculator: do you get processing fees back?",
  description:
    "Refund cost calculator for US merchants: what refunded orders cost in processing fees you never get back, and the real effective rate your returns create.",
  intro:
    "This Refund Cost Calculator prices the thing most merchants only find out from a statement: when you refund a customer, US processors keep the processing fee. Stripe, PayPal, Square, Braintree, Helcim and Shopify Payments all say so in writing, and Authorize.net charges another 10 cents to run the refund transaction. A $90 order refunded in full costs you $2.91 outright at 2.9 percent plus 30 cents. At a 19.3 percent return rate that is $13,479.12 a year, and it turns a 3.23 percent effective rate into 4.01 percent on the revenue you actually keep.",
  tier: 2,
  summary:
    "What refunded orders cost in fees nobody gives back, and the effective rate your return rate really produces.",
  widget: "refund-cost",
  workedExample: {
    scenario:
      "Northbrook Threads, an online apparel store on Stripe, takes $180,000 a month across 2,000 orders and refunds 19.3 percent of them, which is the US online return rate the National Retail Federation and Happy Returns published on 15 October 2025. It pays the standard 2.9 percent plus 30 cents. These are the Refund Cost Calculator's default inputs, so every figure below is what the widget shows before you change anything.",
    result:
      "$180,000 across 2,000 orders is a $90 average order. The fee on one order is 2.9 percent of $90, which is $2.61, plus the 30 cent fixed fee, so $2.91. Across 2,000 orders that is $5,820.00 of processing in a month. A 19.3 percent return rate is 386 refunded orders, handing $34,740 of sales back to customers. Stripe returns none of the fee, so those 386 orders each leave $2.91 behind: $1,123.26 a month, $13,479.12 a year, paid on revenue the business no longer has. Now the part no statement shows. Sales that survived the refunds are $180,000 minus $34,740, which is $145,260, and the processor still took $5,820.00. Divide the fee by the revenue that is left and the real rate is 4.01 percent, not the 3.23 percent the same $5,820 looks like against gross volume, and nowhere near the 2.9 percent on the pricing page. If Stripe returned the percentage and kept only the fixed fee, that same year of refunds would cost $1,389.60 rather than $13,479.12, a difference of $12,089.52. It does not, so the only lever is the return rate itself: at 10 percent returns the real rate is 3.59 percent, at 20 percent it is 4.04 percent, and at 30 percent it is 4.62 percent.",
  },
  sections: [
    {
      heading: "Do you get processing fees back on a refund?",
      body: [
        "No, and not at any major US processor. Stripe's documentation says it plainly: \"Stripe's processing fees from the original transaction aren't returned.\" PayPal's US merchant fees page says \"there are no fees to make the refund, but the fees you originally paid to receive the payment are not returned to you.\" Square says \"the processing fees for the payment aren't refunded back to you.\" The published PayPal Braintree fee schedule says \"Transaction fees charged by PayPal Braintree will not be returned for refunded transactions.\" Helcim, Shopify Payments and Authorize.net are the same. Every one of those sentences was read from the processor's own document on 5 September 2026.",
        "The mechanic is what makes it expensive. You hand back 100 percent of what the customer paid and keep none of what you paid to collect it. A refunded order is not a cancelled sale, it is a sale that happened, cost a fee, and produced no revenue. A business with a 10 percent return rate is paying card processing on a tenth of its volume for nothing at all.",
        "It was not always this way, which is why so many pages are wrong. Square returned processing fees on refunds until it changed the policy for US sellers on 11 April 2023, saying it does not recoup those fees in full from its own network and payment partners. PayPal returned the percentage portion and kept the fixed fee until 2019, then stopped returning anything. Any calculator or blog post written before those dates is still describing a product that no longer exists, and several of them still rank.",
        "One processor charges you twice. Authorize.net's fee definitions state that \"the credit card transaction types for which the per-transaction fee is charged are: charges, refunds, voids and declines.\" The gateway fee on its Gateway Only plan is 10 cents, so the refund costs 10 cents on top of the 10 cents the sale already cost. On the worked example above, that adds $463.20 a year, taking the bill from $13,479.12 to $13,942.32.",
      ],
    },
    {
      heading: "How the Refund Cost Calculator prices a refunded order",
      body: [
        "The fee on any card sale is a percentage of the amount plus a flat per-transaction fee, rounded to the cent on each transaction: fee equals amount times rate, plus fixed. On a $90 order at 2.9 percent plus 30 cents that is $2.61 plus $0.30, so $2.91. The Refund Cost Calculator then applies your processor's refund policy as three independent switches. Does the percentage come back? Does the fixed fee come back? Is there a new fee for running the refund? What is left after those three questions is the fee retained, and that is the real cost of the refunded order.",
        "The output that matters is the second one, and it turns entirely on a denominator. Your fee bill for the month divided by gross volume is the nominal effective rate, and it barely moves as returns rise, because the fees and the volume shrink together. Your fee bill divided by the revenue that survived the refunds is the true effective rate, and it is the one you actually pay, because the money that stayed has to carry the whole bill. On the defaults those are 3.23 percent and 4.01 percent. Both are plausible numbers, so this page prints both and labels them rather than quietly picking one.",
        "Average order value is derived from monthly volume and order count rather than typed in as a third input. Volume and transaction count are both printed on a statement, average order usually is not, and taking all three invites figures that contradict each other. Money is in integer cents, and the percentage is rounded per transaction the way a processor rounds it, because a merchant checking this page against a payout report will notice a cent. Restocking and return shipping are added per returned order and deliberately kept out of the rate: they are real costs, but they are not processing fees, and mixing them in produces a percentage that means nothing.",
      ],
    },
    {
      heading: "Partial refunds are where the fixed fee does the damage",
      body: [
        "A partial refund is not a scaled down full refund. The fixed fee was charged once, in full, when the payment was accepted, and there is nothing in it to prorate. So the whole fee lands on whatever sliver of the order you keep. Refund $80 of a $100 order at 2.9 percent plus 30 cents and you keep $20 while carrying the entire $3.20 fee, which is 16.00 percent of the revenue retained. Refund $60 of a $90 order and the $2.91 fee sits on the $30 you kept, an effective 9.70 percent.",
        "It gets worse where the processor also charges to run the refund. Refund $95 of a $100 order through a gateway that bills 10 cents a transaction and you carry $3.30 against the $5 you kept, which is 66 percent. Two partial refunds on one order cost that fee twice, because it is charged per transaction submitted rather than per order. A store that settles a complaint by refunding shipping, then a restocking allowance, then a goodwill credit, pays for each separately.",
        "Processors differ most here, which is why the Refund Cost Calculator models the fixed fee as returnable only on a full refund. The one common structure that gave anything back on a partial refund was PayPal's pre-2019 policy, which returned the percentage prorated on the amount handed back and kept the fixed fee. If your agreement still works that way, set the switches yourself with the custom processor option and the calculator prices it. Every US policy verified for this page returns nothing on a partial refund at all.",
        "There is one genuinely free reversal, and it is worth building a process around. Helcim states that \"transactions that are voided do not incur any processing fees\" while a refund applies the original fee, and Stripe recommends authorizing and capturing separately if you reverse orders soon after checkout, because cancelling an uncaptured payment costs nothing. The window is short, usually until the batch closes, but for a store that cancels unshipped orders it is the difference between the full fee and zero.",
      ],
    },
    {
      heading: "What refunds cost across US processors and US return rates",
      body: [
        "Return rates are published, so measure yourself against them. The National Retail Federation and Happy Returns reported on 15 October 2025 that 15.8 percent of US retail sales would be returned, worth $849.9 billion, against 16.9 percent and $890 billion the year before. Online is worse at 19.3 percent and holiday sales run about 17 percent. A merchant under 10 percent is well below the national picture, an online store between 15 and 20 percent is ordinary, and above 25 percent is a business model question rather than a payments one.",
        "The rate you pay decides how much that return rate costs. Hold Northbrook Threads' $180,000 a month and 386 refunded orders constant and change only the pricing: at 2.9 percent plus 30 cents the refunds leave $13,479.12 a year behind, at Braintree's published US rate of 2.89 percent plus 29 cents it is $13,386.48, and at PayPal Checkout's 3.49 percent plus 49 cents it is $16,814.16, which pushes the real effective rate to 5.00 percent. The most expensive channel and the highest return rate are a bad combination, and they are the two things a merchant controls independently.",
        "Ticket size decides how visible the problem is. A small ticket store, say $60,000 a month across 2,400 orders at a $25 average with a 5 percent return rate, runs a 4.12 percent nominal rate against a 4.34 percent true rate, a gap of only 0.22 points, because so little of its volume comes back. Northbrook Threads, at four times the ticket and four times the return rate, opens a 0.77 point gap. The gap scales with the return rate rather than the ticket.",
        "Handling costs usually dwarf the fees, even though they stay out of the rate. Put $6.50 of restocking and $8.00 of return shipping on each of those 386 monthly returns and it is $67,164 a year, against $13,479.12 of retained fees, a total cost of refunds of $80,643.12. Nobody publishes a credible US average for either figure, so the Refund Cost Calculator leaves both at zero until you enter your own rather than inventing a benchmark.",
      ],
    },
    {
      heading: "When the number means act, and when it means do nothing",
      body: [
        "Start with what cannot be fixed. No processor will start returning fees because you asked, and the policy is published rather than negotiated, so the fee retained on a refunded order is not a line you can argue down. What is negotiable is the rate underneath it, and that arithmetic lives on the effective rate calculator. Everything else here is a returns problem wearing a payments costume.",
        "So the lever is the return rate. Take Northbrook Threads from 19.3 percent to 15 percent and the retained fees fall from $13,479.12 to $10,476.00 a year, which is $3,003.12. That is the small half of the prize. The large half is the sales: 4.3 points of 2,000 monthly orders at $90 is $7,740 a month, or $92,880 a year of revenue that stopped coming back through the door. Better size charts, better photography, tighter fulfilment accuracy and a shipping cutoff that stops the order arriving after it was needed are all cheaper than 4.3 points of anything.",
        "Do nothing if the gap between your nominal and true rate is small. Under about a quarter of a point, which is where a low return rate or a small ticket puts you, refund cost is real but it is not the biggest number in your payments stack, and the time is better spent on a rate review. Act when the gap crosses roughly half a point, when one category or SKU produces a disproportionate share of the returns, or when partial refunds are routine, because that is where the fixed fee turns a 2.9 percent account into a double digit rate on the revenue retained.",
        "One thing this page deliberately does not price. Chargebacks cost far more than refunds, because you lose the sale, the fee, the goods and a dispute fee of $15 to $20 on top, and the chargeback cost calculator prices those instead. Refunding a customer who would otherwise dispute is almost always the cheaper of the two, and the Refund Cost Calculator gives you the number to compare it against.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Refund fee treatment at eight US processors. Sourced, not computed: every row was read from the processor's own document on 5 September 2026, and the sentence it came from is shown beside the calculator above.",
    columns: ["Percentage returned", "Fixed fee returned", "Fee to issue a refund"],
    rows: [
      {
        label: "Stripe",
        note: "docs.stripe.com/refunds. Cancelling an uncaptured payment is free.",
        values: ["No", "No", "None"],
      },
      {
        label: "PayPal",
        note: "US merchant fees page. Returned the percentage until 2019.",
        values: ["No", "No", "None"],
      },
      {
        label: "Square",
        note: "Square Support. Returned fees until 11 April 2023 for US sellers.",
        values: ["No", "No", "None"],
      },
      {
        label: "Braintree",
        note: "PayPal Braintree Fees, US schedule dated 13 January 2025.",
        values: ["No", "No", "None"],
      },
      {
        label: "Helcim",
        note: "Helcim documentation. A void before the batch closes costs nothing.",
        values: ["No", "No", "None"],
      },
      {
        label: "Shopify Payments",
        note: "Shopify Help Center. Applies whether or not the order shipped.",
        values: ["No", "No", "None"],
      },
      {
        label: "Authorize.net",
        note: "Fee Definitions, Merchant Interface. Gateway fee only; your acquirer sets the discount rate.",
        values: ["No", "No", "$0.10"],
      },
      {
        label: "Adyen",
        note: "Refund documentation states no fee treatment. Marked unverified rather than guessed.",
        values: ["Not published", "Not published", "Not published"],
      },
    ],
  },
  assumptions: [
    "Every refund policy was read from the processor's own document on 5 September 2026, and the sentence it came from is shown in the calculator: Stripe documentation at docs.stripe.com/refunds, PayPal's US merchant fees page, Square Support with the effective dates from Square's policy and pricing updates page, the PayPal Braintree Fees US schedule last updated 13 January 2025, Helcim's refunds and voids documentation, the Shopify Help Center, and Authorize.net's Fee Definitions in the Merchant Interface help.",
    "Adyen is marked unverified because its published refund documentation does not mention fees at all. That row is priced on the industry default of nothing coming back, labelled as unverified, and should be checked against your own agreement before you act on it. Authorize.net's row covers the gateway's own per-transaction fee; on the Gateway Only plan the discount rate belongs to a separate merchant account whose acquirer sets its own refund treatment.",
    "Return rate benchmarks are the National Retail Federation and Happy Returns 2025 Retail Returns Landscape, released 15 October 2025: 15.8 percent of all US retail sales, 19.3 percent of online sales and about 17 percent of holiday sales.",
    "Money is computed in integer cents and the percentage is rounded per transaction, which is how a processor prices it. The model prices the average order and multiplies by the order count, so a real statement covering a mixed basket will differ by rounding.",
    "Monthly volume is held flat across twelve months and the annual figures are one month multiplied by twelve. Refund fees are a flow rather than a growth rate, so nothing compounds here.",
    "Restocking and return shipping default to zero because no credible published US average exists for either. Enter your own. Chargebacks are not included: they cost more than refunds and are priced by the chargeback cost calculator instead.",
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "Do you get processing fees back on a refund?",
      answer:
        "No, not at any major US processor. Stripe, PayPal, Square, Braintree, Helcim, Shopify Payments and Authorize.net all state in their own documentation that the fee on the original transaction is not returned. On a $90 order at 2.9 percent plus 30 cents that is $2.91 you never see again, on top of handing the customer back the full $90. Authorize.net also charges 10 cents to run the refund itself.",
    },
    {
      question: "Does Stripe refund the fee when you refund a customer?",
      answer:
        "No. Stripe's documentation states that its processing fees from the original transaction are not returned. There is no charge to issue the refund, but the original 2.9 percent plus 30 cents stays with Stripe, so a refunded $90 order costs you $2.91. Cancelling a payment before it is captured does cost nothing, which is why Stripe recommends separate authorization and capture for businesses that reverse orders soon after checkout.",
    },
    {
      question: "Does Square refund processing fees?",
      answer:
        "Not since 11 April 2023 in the US. Square used to return processing fees on refunds and changed the policy, saying it does not recoup those fees in full from its own network and payment partners. Its support documentation now states that the processing fees for a payment are not refunded back to you, on full and partial refunds alike. Any calculator showing Square returning fees was built before that date.",
    },
    {
      question: "How much do refunds actually cost my business?",
      answer:
        "Take your monthly volume, your order count and your return rate. A store doing $180,000 a month across 2,000 orders at a 19.3 percent return rate refunds 386 orders, and at 2.9 percent plus 30 cents each one leaves $2.91 behind: $1,123.26 a month and $13,479.12 a year. Add restocking and return shipping and the total is usually several times the fee figure.",
    },
    {
      question: "Why is my effective rate higher than my processing rate?",
      answer:
        "Because you paid a fee on orders that produced no revenue. The fee bill has to be carried by the sales that survived, not by gross volume. A 2.9 percent plus 30 cent account with a $90 average order looks like 3.23 percent against gross volume, but at a 19.3 percent return rate the real figure is 4.01 percent, and at 30 percent returns it is 4.62 percent.",
    },
    {
      question: "Is it cheaper to void a transaction than to refund it?",
      answer:
        "Yes, and it is usually free. Helcim states that voided transactions do not incur any processing fees while a refund applies the original fee, and Stripe charges nothing to cancel a payment that has not been captured. The window is short, typically until the batch settles or the capture runs, so reversing an order the same day can save the whole fee that refunding it the next morning would cost.",
    },
  ],
  related: [
    "chargeback-cost-calculator",
    "effective-rate-calculator",
    "credit-card-processing-fee-calculator",
    "break-even-and-margin-calculator",
    "false-decline-cost-calculator",
  ],
  links: [
    { label: "Refund, explained", href: "/glossary/refund" },
    { label: "Void, explained", href: "/glossary/void" },
    { label: "Effective rate, explained", href: "/glossary/effective-rate" },
    { label: "Payment processors for ecommerce", href: "/category/ecommerce" },
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
  ],
  cta: {
    heading: "Refunds are not the only fee you cannot see",
    body: "The Refund Cost Calculator shows what returns take out of your rate. Tell us your volume and channel mix and we will shortlist processors that price the rest of it better.",
    label: "Get matched",
  },
};
