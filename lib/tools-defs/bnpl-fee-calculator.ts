import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/bnpl-fee-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on buy now, pay later
 * merchant economics: "bnpl merchant fees", "buy now pay later cost for
 * merchants", "klarna merchant fees", "afterpay merchant fees", "affirm merchant
 * fees", "is bnpl worth it for merchants". The brand PRICING intent still
 * belongs to `/processor/<slug>` (PayPal's Pay Later line sits in PayPal's own
 * rate card there, and Square's Afterpay line in Square's), the definition
 * belongs to `/glossary/bnpl`, and the shortlist belongs to
 * `/payment-processors/bnpl`. This page owns the arithmetic and links into all
 * three.
 *
 * WHAT THE COMPETITION GETS WRONG, and it is the same mistake three times over:
 *
 *   1. THE WRONG DENOMINATOR. Every ranking page, and every vendor case study
 *      they reprint, computes the return on TOTAL BNPL volume. A customer who
 *      would have paid by card and instead pays by Klarna has not created a
 *      sale. The merchant has paid roughly twice the fee for a sale it already
 *      had. Run the arithmetic on total volume and a method that destroys margin
 *      prints money, because the gross margin on sales you already had dwarfs a
 *      three point fee. On this page's defaults the naive answer is $6,697.44 a
 *      month and the honest one is $1,273.68, a factor of 5.3.
 *   2. NO BREAK-EVEN AT ALL. Not one page ranking for this cluster answers the
 *      only question that decides anything: how much NEW revenue the method has
 *      to create before it stops being a discount on existing sales. It is
 *      arithmetic, it takes five inputs, and nobody does it.
 *   3. THE UPLIFT CLAIMS ARE REPEATED AS FINDINGS. Klarna claims 40 percent,
 *      Afterpay 58 percent, Sezzle 50 percent or more, Zip 46 percent, PayPal
 *      93 percent for enterprises. Every one of those compares BNPL orders
 *      against all orders,
 *      which measures who chooses BNPL rather than what BNPL causes. This page
 *      records them as claims, attributes each one, and defaults the uplift
 *      input to ZERO so the calculator does not agree with the marketing before
 *      the merchant has typed anything.
 *
 * WHERE THE NUMBERS CAME FROM. Every published rate, settlement line and
 * liability position is in `lib/tools-data/bnpl.ts` with its own source string
 * and date. In short: Klarna, Affirm and Zip publish no US merchant rate card at
 * all, so their rates are read off Stripe's published local payment methods
 * pricing (Wayback capture 29 August 2026, because this machine geo-redirects
 * stripe.com); Afterpay's 6% plus 30 cents is on Square's own developer pricing
 * page (read 5 September 2026) and on Stripe's; Sezzle publishes 6.1% plus 30
 * cents in its own US merchant agreement (last updated 7 May 2026); PayPal
 * publishes Pay Later at 4.99% plus $0.49 in its US business fees table (last
 * updated 1 September 2026, read live 5 September 2026).
 *
 * Every dollar figure in the copy below is produced by `lib/calc/bnpl.ts` and
 * asserted in `tests/tools/batch-four/bnpl-fee-calculator.test.ts` against the
 * SHIPPED defaults, not against a local copy of them. A hand-written number that
 * the widget on the same page contradicts has shipped here before.
 */

const NOT_ADVICE =
  "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.";

export const BNPL_FEE_TOOL: ToolDef = {
  slug: "bnpl-fee-calculator",
  name: "BNPL Merchant Cost Calculator",
  h1: "BNPL merchant fees and break-even calculator",
  title: "BNPL Merchant Fees Calculator | Estimate Break-Even Costs",
  description:
    "Use our BNPL merchant fees calculator to estimate buy now pay later costs, extra processing fees, break-even sales, margin impact, and required incremental orders.",
  intro:
    "BNPL merchant fees run from 4.5 to 8 percent plus a 30 to 49 cent fixed fee in the United States, against 2.9 percent plus 30 cents on a card, so a $120 sale costs $7.49 through Klarna and $3.78 on a card. That makes the fee the wrong question. The right one is the break-even: on 1,200 orders a month at a 12 percent BNPL mix, nine genuinely new orders, a lift of 0.74 percent, pays for the 108 sales that merely switched. This BNPL Merchant Cost Calculator computes that break-even on incremental sales rather than on total BNPL volume, which is where every vendor case study goes wrong.",
  tier: 2,
  summary:
    "Published US BNPL rates, and the extra orders BNPL has to create before it pays for its own fee.",
  widget: "bnpl",
  workedExample: {
    scenario:
      "Ridgeline Outfitters is a US direct to consumer outdoor gear brand doing 1,200 orders a month at a $120 average order value, on a 2.9 percent plus 30 cent card rate, with a 45 percent gross margin. It turns Klarna on at Stripe's published US rate of 5.99 percent plus 30 cents. Twelve percent of orders move to Klarna. The founder's honest estimate, before any holdout test, is that a quarter of those Klarna orders would not have happened at all. The basket does not change.",
    result:
      "Klarna takes $7.49 on a $120 order against $3.78 on the card, so every switched sale costs $3.71 more. Twelve percent of 1,200 orders is 144 Klarna orders: 36 genuinely new and 108 switched. That puts the cannibalization bill at 108 x $3.71 = $400.68 a month. Each of the 36 new orders contributes $120 x 45 percent minus the $7.49 fee, which is $46.51, so $1,674.36 in all. The net effect is $1,674.36 minus $400.68 = $1,273.68 a month, or $15,284.16 a year. The break-even sits well below what Ridgeline entered: 8.61 extra orders a month, so nine, which is a 0.74 percent lift on the 1,164 orders it would have had anyway. Expressed the other way, only 7.39 percent of Klarna orders have to be genuinely new, against the 25 percent assumed. Now change one input and the answer inverts. Set incrementality to zero, meaning every Klarna order was a card order in disguise, and the identical month costs $534.24, or $6,410.88 a year, and returns nothing. Or hold incrementality at zero and ask what the basket would have to do instead: it has to reach $129.51, a 7.92 percent lift, for the swap to be margin neutral. Meanwhile the blended effective rate rises from 3.15 percent on cards alone to 3.52 percent, which is 37 basis points added to every dollar of revenue Ridgeline takes.",
  },
  sections: [
    {
      heading: "What BNPL merchant fees actually cost in the United States",
      body: [
        "The structure is the same as a card, a percentage of the order plus a fixed fee, and only the percentage differs. Published US merchant rates run from 4.5 percent plus 30 cents to 7.99 percent plus 30 cents, against 2.9 percent plus 30 cents on a typical flat rate card account. On a $120 order that is $5.70 to $9.89 against $3.78. The multiple moves with ticket size, which is why the BNPL Merchant Cost Calculator prices the basket you actually sell: Klarna is 1.75 times the card fee on a $25 order, 1.98 times on $120 and 2.04 times on $400, as the shared 30 cent fixed fee dilutes.",
        "The awkward part of researching this is that most providers publish no rate card. Klarna's own developer documentation says the rate is returned per transaction by its Price Plans API and is dynamic, so there is nothing to read, and Affirm and Zip quote on application. Sezzle is the exception: 6.1 percent plus 30 cents in its own US merchant agreement, with a caveat that the rate can be higher by industry classification. PayPal is the other, publishing Pay Later at 4.99 percent plus $0.49 against 3.49 percent plus $0.49 for PayPal Checkout, which puts the BNPL premium on that platform at exactly 150 basis points. The rest of the rates below are real published US prices, just published by somebody else: Stripe prints a rate for every BNPL method it resells, and Square prints Afterpay at 6 percent plus 30 cents beside its own 2.6 percent plus 15 cent card rate. Treat those as the list price, because a direct contract at volume can be lower.",
        "One trap before the arithmetic starts. A lower percentage is not automatically cheaper, because the fixed fees are not equal. PayPal Pay Later charges 49 cents where every other method here charges 30. On a $15 basket that makes Pay Later $1.24 and Klarna $1.20, so the lower rate is the more expensive method. The two are identical at $19 and the ranking flips either side of it.",
      ],
    },
    {
      heading: "The break-even is the only number that decides anything",
      body: [
        "BNPL is not sold as a payment method, it is sold as a growth channel. The pitch is more conversions and bigger baskets, and the price is roughly double a card. So the question is not what it costs. It is how much new revenue it has to create before it stops being a voluntary discount on sales you already had.",
        "The arithmetic has five terms and no mystery in it. Take the extra fee per switched order, the BNPL fee minus the card fee, and multiply by the number of orders that switched. That is the deficit. Then take the contribution one genuinely new order makes, the order value times gross margin less the BNPL fee. Divide the deficit by that contribution and you have the extra orders a month the method must create. On the defaults the deficit is $400.68, a new order contributes $46.51, and the answer is 8.61 orders, which rounds up to nine. Against 1,164 baseline orders that is a lift of 0.74 percent.",
        "That number is low. At a 45 percent gross margin, a BNPL method that creates almost any incremental demand at all pays for itself. The margin does the work: a new $120 sale carries $54.00 of contribution and the fee takes only $7.49 of it, so a handful of extra orders covers a lot of cannibalized ones. That is the honest case for BNPL.",
        "Which is why the margin is the input to stress first, not the fee. Run the same scenario at a 25 percent gross margin and the break-even share nearly doubles to 14.15 percent of BNPL orders. At 15 percent margin it is 26.09 percent, the required basket uplift is 34.30 percent, and the month turns net negative at the entered mix. Underneath all of it is a hard floor: when gross margin is at or below the BNPL rate, every order on that method loses money whether it is new or not.",
      ],
    },
    {
      heading: "Cannibalization, and why vendor case studies use the wrong denominator",
      body: [
        "Here is the mistake. A customer arrives at your checkout intending to buy, sees a BNPL button, and uses it. You have not gained a sale. You have taken the sale you were already going to make and paid roughly twice the fee to process it. That order belongs in the cost column, and on the defaults there are 108 of them a month against 36 genuinely new ones.",
        "Almost every published BNPL return figure gets this backwards, in the direction that flatters the seller. Compute the margin on all 144 BNPL orders instead of the 36 incremental ones and the same month returns $6,697.44 instead of $1,273.68. That is a factor of 5.3, both look reasonable, and nothing tells you which one you are reading. The Consumer Financial Protection Bureau, in Buy Now, Pay Later: Market Trends and Consumer Impacts, describes lenders deploying models, product features and marketing campaigns to increase the likelihood of incremental sales. Incremental is a word to earn, not assume.",
        "The vendor uplift statistics have the identical flaw. Klarna's business site claims a 40 percent increase in average order value and a 20 percent increase in conversion. Afterpay's US retailer page claims 58 percent, attributed to internal Afterpay data. Sezzle claims 50 percent or more and Zip a 46 percent average order value lift. PayPal claims 93 percent higher average order value for enterprises and 62 percent for small businesses, both footnoted to its own internal data. Not one is a controlled measurement. Every one compares people who chose BNPL against people who did not, which tells you who self-selects into installments and nothing about what would have happened without the button.",
        "There is one way to find your own number and it is not a spreadsheet. Turn the method off for a randomized share of traffic, or off entirely for a fixed period against a comparable one, and measure total orders and total revenue rather than BNPL orders and BNPL revenue. If total orders do not move, incrementality is zero. The 25 percent default here is a guess, not a measurement.",
      ],
    },
    {
      heading: "Who carries the fraud, credit and dispute risk",
      body: [
        "The genuine structural advantage of BNPL is that the provider buys the receivable. You are paid for the order and the provider chases the installments, so a shopper who stops paying is the provider's loss. Klarna states that you always get paid upfront and in full and that it assumes credit and fraud risk. Afterpay states that the money arrives in one to two business days. Zip's loans are originated by WebBank subject to credit approval, so a missed repayment is the lender's exposure, and Affirm carries the credit risk on the loan it underwrote. That is a real transfer of risk and it is worth something.",
        "It is narrower than the marketing implies, and the boundary is the same on every product: the provider takes the shopper's ability to pay, the merchant keeps everything about the goods. Adyen's integration guidance is the clearest public statement of it. On Afterpay, the provider performs risk checks on the shopper and, where they succeed, takes on the full fraud risk for the payment, but the chargeable dispute reasons remain product not received, product unacceptable and credit not processed, and the merchant pays the dispute fee on those regardless of outcome. Shoppers can raise a chargeback with Afterpay up to 120 days after the payment, the cancellation, or the expected receipt of the goods. On Klarna, the same guidance says Klarna assumes the risk of non-payment only if the merchant meets Klarna's order fulfillment rules, and can charge the payment back where it does not.",
        "Three published terms decide the rest, and none is visible in a rate. Dispute fees: on Stripe a lost Klarna dispute costs $15.00 against $3.00 on Zip, a fivefold gap on an otherwise similar product. Refunds: Sezzle charges 2 percent plus 30 cents to initiate one and retains the original processing fee, so a returned item costs the fee twice. Settlement: Sezzle publishes one to seven business days after order capture against Afterpay's one to two, and Affirm and Zip publish no window at all.",
      ],
    },
    {
      heading: "When BNPL is worth it, and when the answer is do nothing",
      body: [
        "Offer it when the arithmetic clears with room to spare. Higher margin categories are the natural fit, because the fee is a smaller share of contribution and the break-even lift is tiny. Considered purchases with a real affordability barrier are the other fit: furniture, equipment, electronics, travel, elective health and dental, anything where the ticket is large enough that a shopper genuinely abandons rather than downgrades. That is where the incremental share is plausibly high, because there is a specific reason the sale would not otherwise happen.",
        "Do nothing when your gross margin is thin, when your average ticket is small, or when you cannot say why a customer would fail to buy without installments. A grocer at a 5 percent gross margin offered a 5.99 percent method is not facing a marginal decision, they are facing a method that loses money on every order. A $25 ticket makes the effective rate 7.20 percent at Klarna's published rate, and nobody abandons a $25 cart for want of four payments of $6.25. In both cases the honest output is to leave things alone, and this calculator will say so.",
        "There is a middle path that gets skipped: BNPL does not have to be on for everything. The fee is a percentage, so the cost concentrates on your largest orders, and the affordability argument is strongest there too. That makes a minimum order threshold the highest leverage setting most providers offer, because turning the method on above a floor cuts the cannibalization on small everyday baskets, where incrementality is lowest.",
        "And do the boring comparison first, because it usually wins. On the worked example the extra fee bill from turning BNPL on is $400.68 a month at 25 percent incrementality and $534.24 at zero. Shaving 30 basis points off the card rate on the same $139,680 of monthly card volume is $419.04 a month, with no incrementality assumption and nothing to measure. The two decisions compete for the same money, and only one of them needs a holdout test to prove.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Published US merchant rates for the six BNPL methods a US business is most likely to be offered, with the dollar columns computed on this page rather than sourced. The rates are sourced per provider, with publisher and date, in the assumptions below. The fee, effective rate and multiple are arithmetic on a $120 order against a 2.9% plus $0.30 card rate, reproducible in the calculator above. Klarna, Affirm and Zip publish no US rate card of their own, so their figures are the published price a payment service provider charges for that method.",
    columns: ["Published US rate", "Fee on $120", "Effective rate", "Times the card fee"],
    rows: [
      {
        label: "Card, for reference",
        note: "A typical US flat rate online card account. This is the baseline every row below is measured against.",
        values: ["2.9% + $0.30", "$3.78", "3.15%", "1.00x"],
      },
      {
        label: "Zip",
        note: "Specifically the Pay in 4 product WITH a customer fee, meaning the shopper pays an origination fee disclosed at checkout. Zip's own worked example is an $8.00 origination fee on a $400 Pay in 4 purchase, with the range running $4.00 to $62.00 by purchase price. Zip sets the merchant service fee in the letter of offer at approval.",
        values: ["4.5% + $0.30", "$5.70", "4.75%", "1.51x"],
      },
      {
        label: "PayPal Pay Later",
        note: "The only BNPL line published inside an ordinary US card processing schedule. The 49 cent fixed fee is 19 cents higher than every other row and flips the ranking below roughly $19.",
        values: ["4.99% + $0.49", "$6.48", "5.40%", "1.71x"],
      },
      {
        label: "Klarna",
        note: "One published rate for the United States and Canada. Klarna's own documentation says rates are returned per transaction and are dynamic, so a direct contract at volume may differ.",
        values: ["5.99% + $0.30", "$7.49", "6.24%", "1.98x"],
      },
      {
        label: "Afterpay",
        note: "The same 6% plus 30 cents in person and online, published on Square's own pricing page beside its 2.6% plus 15 cent card rate, and by Stripe for Cash App Afterpay.",
        values: ["6% + $0.30", "$7.50", "6.25%", "1.98x"],
      },
      {
        label: "Affirm",
        note: "A published range, not one rate: Standard at 6% plus 30 cents and Enhanced at 7.99% plus 30 cents. The Enhanced tier is $9.89 on a $120 order, an 8.24% effective rate and 2.62 times the card fee. Treat the low end as the floor.",
        values: ["6% to 7.99% + $0.30", "$7.50", "6.25%", "1.98x"],
      },
      {
        label: "Sezzle",
        note: "The only rate here published by the BNPL provider itself. The agreement adds a refund fee of 2% plus 30 cents and states the standard rate can be higher by industry classification.",
        values: ["6.1% + $0.30", "$7.62", "6.35%", "2.02x"],
      },
    ],
  },
  assumptions: [
    "Rates are the published US merchant list price for each method, not a quote. Klarna at 5.99% plus $0.30, Affirm at 6% plus $0.30 standard and 7.99% plus $0.30 enhanced, Cash App Afterpay at 6% plus $0.30, and Zip Pay in 4 with a customer fee at 4.5% plus $0.30 all come from Stripe's local payment methods pricing page, read from a Wayback Machine capture dated 29 August 2026 because this machine geo-redirects stripe.com to non-US pricing. Afterpay's 6% plus $0.30 was cross-checked on Square's developer payments pricing page on 5 September 2026.",
    "Sezzle's 6.1% plus 30 cents, its 2% plus 30 cent refund fee and its one to seven business day settlement window are from Sezzle's own US merchant agreement, last updated 7 May 2026 and effective 13 May 2026, read 5 September 2026. PayPal Pay Later at 4.99% plus $0.49 is from PayPal's US business fees table, which states it was last updated 1 September 2026, read 5 September 2026, where PayPal Checkout on the same schedule is 3.49% plus $0.49 and the chargeback and standard dispute fees are $20.00 and $15.00.",
    "Every uplift figure quoted on this page is the provider's own marketing claim, attributed to the provider, and none of them is used in the calculation. Klarna's 40 percent, Afterpay's 58 percent, Sezzle's 50 percent and PayPal's 93 percent enterprise figure were read from klarna.com/business, afterpay.com/en-US/for-retailers, sezzle.com/merchant-results and paypal.com/us/business/accept-payments/installment-payments on 5 September 2026. Zip's 46 percent comes from a Wayback Machine capture of zip.co/us/for-business dated 16 January 2026, because the live page renders entirely client side and returns no readable text. Affirm's own claims are animated counters with no footnote at all, so this page quotes none of them. All of them compare BNPL orders against other orders, which is a selection effect and not a measured treatment effect, so the calculator's basket uplift input starts at zero and the incremental share must be supplied by you. The observation that BNPL lenders deploy models, product features and marketing campaigns to increase the likelihood of incremental sales is the Consumer Financial Protection Bureau's, from Buy Now, Pay Later: Market Trends and Consumer Impacts, consumerfinance.gov, read 5 September 2026.",
    "Liability positions were verified per provider rather than generalized. The fulfillment condition on Klarna's risk transfer, the chargeable dispute reasons on Afterpay, and the 120 day Afterpay chargeback window are from Adyen's published chargeback guidelines for those methods, read 5 September 2026. The $15.00 lost Klarna dispute fee and the $3.00 lost Zip dispute fee are from Stripe's published local payment methods pricing. Affirm and Zip publish no consolidated liability matrix on their public merchant pages, and where a fact is not published this page says so instead of estimating it.",
    "The model holds your order count, basket and margin flat for the month and applies each fee per order, rounded to the cent the way a processor rounds, before multiplying. Order counts are kept fractional through the arithmetic, so a 12 percent mix on 1,199 orders is 143.88 BNPL orders rather than 144; only the break-even order count is rounded, and it is rounded up, because half a sale does not pay a bill. Dispute fees, refund fees, chargebacks and any monthly platform charge are excluded from the break-even and are priced separately by the chargeback and refund calculators on this site.",
    "The required basket uplift is solved in closed form on unrounded dollars, because the answer is a ratio and forcing it onto the cent grid would make it jump in visible steps. Feeding that exact uplift back into the monthly model can therefore land a cent either side of break-even. That is a rounding artefact of the per-order fee, not a solver error.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "How much does BNPL cost a merchant?",
      answer:
        "Published US merchant rates run from 4.5 percent plus 30 cents to 7.99 percent plus 30 cents, against 2.9 percent plus 30 cents on a typical flat rate card account. On a $120 order that is $5.70 to $9.89 against $3.78, so roughly 1.5 to 2.6 times the card fee. Klarna is 5.99 percent plus 30 cents, Afterpay and Affirm 6 percent plus 30 cents, Sezzle 6.1 percent plus 30 cents, PayPal Pay Later 4.99 percent plus 49 cents.",
    },
    {
      question: "How much does Klarna charge merchants?",
      answer:
        "Klarna does not publish a US rate card. Its own developer documentation says rates are returned per transaction by its Price Plans API and are dynamic. The published US price a merchant can actually be charged today is 5.99 percent plus 30 cents through Stripe, which is $7.49 on a $120 order against $3.78 on a card at 2.9 percent plus 30 cents. A direct Klarna contract at volume may be lower, and Stripe notes some businesses get a temporary 2.9 percent plus 30 cent promotional rate first.",
    },
    {
      question: "What are Afterpay merchant fees?",
      answer:
        "6 percent plus 30 cents in the United States, both in person and online. It is the most reliably published BNPL rate in the country because Square owns Afterpay and prints it on its own pricing page directly beside its 2.6 percent plus 15 cent card rate. Stripe publishes the same 6 percent plus 30 cents for Cash App Afterpay. On a $120 order that is $7.50, an effective rate of 6.25 percent, and 1.98 times what the same order costs on a card.",
    },
    {
      question: "Is buy now pay later worth it for merchants?",
      answer:
        "It depends on one number nobody else asks you for: what share of BNPL orders would not have happened otherwise. At a 45 percent gross margin, a $120 basket and a 12 percent BNPL mix, only 7.39 percent of BNPL orders need to be genuinely new for Klarna to pay for itself. At a 25 percent margin that rises to 14.15 percent, at 15 percent to 26.09 percent, and when your gross margin falls below the BNPL rate no volume of new orders can fix it.",
    },
    {
      question: "Does BNPL cannibalize my card sales?",
      answer:
        "Partly, and that is the whole cost. A customer who was going to buy anyway and taps the BNPL button has not created a sale, they have moved one from a 2.9 percent method to a 5.99 percent method. On 1,200 orders a month at a 12 percent mix, 108 of the 144 BNPL orders are switched at the default 25 percent incrementality, costing $400.68 a month in extra fees. At zero incrementality it is $534.24 a month, or $6,410.88 a year, for nothing.",
    },
    {
      question: "Who pays if a BNPL customer does not pay?",
      answer:
        "The provider, not you. Klarna states it assumes credit and fraud risk and pays you upfront and in full. Afterpay takes the full fraud risk where its shopper checks succeed, and pays in one to two business days. Zip's loans are originated by WebBank, so a missed repayment is the lender's. What stays with you is everything about the goods: on Adyen the chargeable Afterpay dispute reasons are product not received, product unacceptable and credit not processed, and a lost Klarna dispute costs $15.00 on Stripe against $3.00 on Zip.",
    },
  ],
  related: [
    "square-fee-calculator",
    "break-even-and-margin-calculator",
    "credit-card-processing-fee-calculator",
    "refund-cost-calculator",
    "effective-rate-calculator",
  ],
  links: [
    { label: "Payment processors that support BNPL", href: "/payment-processors/bnpl" },
    { label: "Buy now, pay later, defined", href: "/glossary/bnpl" },
    { label: "Processors for ecommerce", href: "/category/ecommerce" },
    { label: "PayPal review and full pricing breakdown", href: "/processor/paypal" },
    { label: "Square review, including the Afterpay line", href: "/processor/square" },
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
  ],
  cta: {
    heading: "Fix the rate on every order before you price the one channel",
    body: "BNPL touches a tenth of your orders. Your card rate touches all of them. On the worked example above, 30 basis points off the card rate is worth more every month than the entire BNPL fee bill, and it needs no incrementality test to prove.",
    label: "Check your effective rate",
  },
};
