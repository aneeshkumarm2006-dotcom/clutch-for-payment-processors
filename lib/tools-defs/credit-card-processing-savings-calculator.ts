import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/credit-card-processing-savings-calculator`
 *
 * ─── The intent this page owns ──────────────────────────────────────────────
 *
 * "credit card processing savings calculator", "how much can I save on credit
 * card processing", "am I overpaying for credit card processing", and the two
 * informational siblings the same person types within a minute of the first
 * one: "what is a good credit card processing rate" and "how to lower credit
 * card processing fees". Both siblings are answered in prose here, in named
 * sections, because the searcher asks both and a page that answers one and
 * links away for the other loses the session.
 *
 * NOT targeted: "processing fee savings calculator". Prior keyword research on
 * this site found that exact phrase returns nothing in autocomplete. Naming a
 * page after a phrase nobody types is a way of ranking first for zero.
 *
 * ─── What the ranking competition gets wrong ────────────────────────────────
 *
 * Two things, and they are the same thing twice.
 *
 * First, every savings calculator on this query prices each lever against the
 * merchant's original statement and adds the results up. The levers overlap. A
 * commercial card sent without Level 2 data IS a downgrade. Junk fees ARE part
 * of the markup. Moving from flat rate to interchange plus and negotiating the
 * markup down are one lever, not two, because both of them set the markup to a
 * number. And a surcharge recovers your cost of acceptance, so its ceiling falls
 * every time an earlier lever works. Added up naively, six real savings produce
 * a total no merchant can collect. `lib/calc/savings.ts` therefore applies them
 * in a fixed order against a running balance and documents why each one sits
 * where it does.
 *
 * Second, none of them can say do nothing. Every incumbent on this query is a
 * lead form: a statement analysis service that wants a PDF and a phone number
 * before it shows a number, run by a company that sells payment processing. A
 * calculator that always finds savings is a sales tool, and it reads as one.
 * This page has a real `doNothing` branch, an editorial floor it names, and no
 * email gate anywhere.
 *
 * ─── Where the numbers came from ───────────────────────────────────────────
 *
 * Every basis point figure is the difference between two quoted rows of the
 * Visa USA Interchange Reimbursement Fees schedule, rates effective 18 April
 * 2026, read from usa.visa.com on 5 September 2026. The assessment figures come
 * from two acquirer pass through fee schedules that agree with each other. ACH
 * pricing is Stripe's and Helcim's published US prices. The markup target ladder
 * is Helcim's published US markup table. The surcharge ceiling is Visa's own
 * surcharging question and answer document. All of it, with dates, is in
 * `lib/tools-data/savings.ts`.
 *
 * Every dollar figure in `workedExample` was produced by running
 * `computeSavings` on `SAVINGS_DEFAULTS`, not by hand. The widget on this page
 * renders the same scenario, so the two cannot disagree. That has gone wrong
 * here before: the interchange plus page once claimed a break even near $6,400
 * while the widget beside it computed $2,769.
 */

const NOT_ADVICE =
  "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.";

export const PROCESSING_SAVINGS_TOOL: ToolDef = {
  slug: "credit-card-processing-savings-calculator",
  name: "Processing Savings Calculator",
  h1: "Credit card processing savings calculator",
  title: "Credit Card Processing Savings Calculator | Estimate Savings",
  description:
    "Use our credit card processing savings calculator to estimate annual savings, processor markup, effective rates, ACH savings, and fee reductions.",
  intro:
    "This credit card processing savings calculator starts from your last statement rather than from a sales quote. On $120,000 a month at a 3.15 percent effective rate, the Processing Savings Calculator finds $18,056.64 a year and shows exactly where each dollar of it sits. The mechanism is one subtraction: total fees minus interchange and assessments leaves the processor markup, and the markup is the only part of your bill anybody can change. It then prices six concrete fixes against your own volume, in the order they have to happen, because most of them touch the same dollars.",
  tier: 1,
  summary:
    "Split your statement into pass through and markup, then price six fixes in annual dollars, including the honest answer that you are already well priced.",
  widget: "savings",
  workedExample: {
    scenario:
      "A commercial printer in Denver runs $120,000 a month across 900 card transactions and pays $3,780 in total fees, of which $180 is monthly line items: a $25 statement fee, a $20 gateway fee, a $19.95 PCI non-compliance fee it has never cleared, a batch fee and a regulatory charge. About 20 percent of its card volume is on corporate and small business cards. Its bookkeeper estimates 8 percent of the rest clears non-qualified because batches close the next afternoon. Thirty thousand dollars a month arrives as 24 invoices averaging $1,250, all of which could be collected by bank debit instead.",
    result:
      "The effective rate is 3,780 divided by 120,000, which is 3.15 percent. Pass through at the 1.90 percent midpoint is $2,280, so the processor markup is $1,500 a month, or 125 basis points. That $1,500 is the entire negotiable surface. Now the six levers, each priced on what the one above it left behind. ACH first, because it removes dollars from the card channel: the variable card cost on that $30,000 is 3.00 percent, so $900, while 24 payments of $1,250 at 0.8 percent all hit the $5.00 cap and cost $120, saving $780 a month. That leaves $90,000 on cards across 876 transactions. Level 2 data on the 20 percent commercial share, $18,000, at 75 basis points is $135. Downgrade repair on 8 percent of the remainder, $7,200, at 111 basis points is $79.92. Removing $100 of the $180 monthly line items is $100. Repricing what is left: the markup on the residual $90,000 is $990, against a published target of 0.45 percent plus 20 cents, which is $405 plus $175.20, so $580.20, a saving of $409.80. Surcharging is off. Total $1,504.72 a month, $18,056.64 a year. The bill falls from $3,780 to $2,275.28, and the effective rate on the same $120,000 falls from 3.15 percent to 1.90 percent.",
  },
  sections: [
    {
      heading: "How the credit card processing savings calculator splits a statement",
      body: [
        "Two numbers off page one of your statement produce the only figure that matters. Total fees divided by total card volume is your effective rate, and it is the true price of accepting a dollar. On the worked example above, $3,780 divided by $120,000 is 3.15 percent. That single number already tells you more than your contracted rate does, because it includes the per item fees, the monthly line items and every downgrade you did not know you took.",
        "The effective rate then splits into two parts that behave completely differently. Pass through is interchange plus card brand assessments: interchange goes to the bank that issued your customer's card, assessments go to the network. Neither is your processor's money and neither is negotiable at any volume, because a merchant doing a billion dollars a year pays the same published interchange as one doing a hundred thousand. Everything above pass through is processor markup, and that is the whole negotiable surface. In the example it is $1,500 a month, or 125 basis points, and it is the number to walk into a repricing conversation with.",
        "Pass through has to be estimated unless your statement itemizes interchange, which flat rate and tiered plans never do. The Processing Savings Calculator defaults to 1.90 percent and treats it as a band rather than a fact. The floor is a card present debit heavy merchant: regulated debit is capped at 0.05 percent plus 21 cents and exempt retail debit is 0.80 percent plus 15 cents. The ceiling is a card not present rewards heavy merchant, where Visa Product 1 is 2.04 percent plus 10 cents and Visa Signature Preferred 2.60 percent plus 10 cents. Assessments add 13 to 14 basis points on top of either.",
        "If you have an interchange plus statement, replace the estimate with your real interchange line first. Everything downstream moves when pass through moves, and a debit heavy retail business that leaves the default in place will see a markup figure that is too small and wrongly conclude there is nothing to fix.",
      ],
    },
    {
      heading: "The six levers, and why the order changes the answer",
      body: [
        "The Processing Savings Calculator scores six things: moving large invoices to ACH, sending Level 2 and Level 3 data on commercial cards, repairing the transactions that downgrade, stripping the monthly line items, repricing the markup to a target you name, and surcharging credit cards where it is lawful. Each gets an annual dollar figure, an effort rating and a catch. The catch is always shown, because a lever with no downside is a lever nobody has thought about.",
        "They are applied in that fixed order, and the order is the part every competing calculator gets wrong. ACH goes first because it removes dollars from the card channel entirely, so everything priced per card dollar has to be computed on what is left: in the example $30,000 moves out, and the five levers below it are priced on $90,000 rather than on $120,000. Enhanced data and downgrade repair come next because both cut interchange, which changes the pass through figure the markup is measured against. Junk fees come before repricing because monthly line items are part of the markup, so removing them afterwards would remove the same dollars twice. Surcharging comes last because it recovers your cost of acceptance, and every lever above it makes that cost smaller.",
        "There are six rather than seven for a reason worth saying plainly: moving from flat rate to interchange plus and negotiating your markup down are the same lever, because both set your markup to a number. Listing them separately is the commonest way a savings page doubles its own headline. One more overlap is handled quietly. A commercial card sent without Level 2 data is itself a downgrade, so downgraded volume here is capped at the non commercial share; without that cap, a merchant reporting 30 percent commercial and 30 percent downgraded volume gets paid twice for one basis point gap.",
        "ACH is the largest single lever in the worked example, at $9,360 a year, and it works only because the fee is capped in dollars rather than scaling with the amount: a $1,250 invoice costs $37.50 on a card at 3.00 percent and $5.00 by bank debit. It is also the only lever whose success depends on your customers agreeing to something, so model the share you can actually convert. Surcharging is the mirror image: capped at the lower of 3 percent and your own merchant discount rate under Visa's rules, unable to touch debit or prepaid at all, and restricted by state law in several places. It is off by default here and will stay off by default.",
      ],
    },
    {
      heading: "What a good credit card processing rate looks like in 2026",
      body: [
        "A good rate is a low markup, not a low headline. Two merchants can both pay 2.6 percent all in and one of them be badly overcharged, because a card present grocery business with a debit heavy mix has a pass through cost near 1.2 percent while a card not present business selling to rewards card holders has one near 2.1 percent. The first is paying 140 basis points of markup and the second 50. Any benchmark quoted as a total effective rate without a card mix attached is describing the customer, not the deal.",
        "Merchants want a ladder anyway, so here is the one this site scores every fee tool against. Under 1.9 percent is excellent and better than most small merchants ever see. Up to 2.25 percent is good, worth re-checking once a year rather than today. Up to 2.75 percent is average, which is what flat rate pricing produces and where there is usually room at volume. Up to 3.2 percent is high, and the first place to look is your pricing model and monthly fixed fees rather than your percentage. Above 3.2 percent something specific is wrong: tiered pricing, junk line items, or a high risk rate you have outgrown.",
        "The markup ladder is more useful and almost nobody publishes it. Processors that price interchange plus publish their markup, which makes it checkable. Helcim's public US table charges 0.50 percent plus 25 cents on keyed and online volume under $50,000 a month, 0.45 percent plus 20 cents from $50,000 to $100,000, and 0.35 percent plus 20 cents from $100,000 to $500,000. Card present markups run lower still. Those are the numbers the Processing Savings Calculator uses as its default target, and a merchant whose own markup is 125 basis points against a published 45 has a specific, quotable gap rather than a feeling.",
      ],
    },
    {
      heading: "Level 2 and Level 3 data, and the trap in Visa's small business ladder",
      body: [
        "If your customers pay with corporate, purchasing or small business cards, sending extra data with the authorization moves those sales into cheaper interchange programs. Level 2 means the tax amount and a customer reference code. Level 3 adds line item detail: descriptions, quantities, unit prices, commodity codes. On the Visa schedule effective 18 April 2026, a purchasing or corporate card not present sale clears at Commercial Card Not Present, 2.70 percent plus 10 cents, and the same sale with full line item detail clears at Commercial Product 3, 1.75 percent plus 10 cents. That is 95 basis points, worth $1,620 a year on $18,000 a month of commercial volume.",
        "Here is the trap, on the same rate sheet. Visa's small business ladder does not run in the direction the names suggest. Business Product 1 is 2.65 percent plus 10 cents, Business Product 2 is 1.90 percent plus 10 cents, and Business Product 3 is 2.40 percent plus 10 cents. Level 2 data saves 75 basis points. Level 3 data on the same card costs 50 basis points more than stopping at Level 2. A gateway integration built to send everything, on the assumption that more data is always cheaper, makes small business volume more expensive than a smaller build would have. The corporate ladder behaves normally; the small business one does not.",
        "One more thing on this sheet changed recently and most published guidance has not caught up. Visa's Corporate and Purchasing section no longer carries a general Commercial Level II row. The only Level II line left is Commercial Level II Fuel at 2.20 percent plus 10 cents, because Level 2 as a standalone Visa commercial program has been folded into the Commercial Enhanced Data Program outside fleet and fuel. Any page quoting you a named Visa Level II rate on corporate cards is describing a program that is not on the current sheet. Mastercard still runs its own Data Rate I, II and III ladder, so the lever is real; it just does not work the way a 2023 blog post describes.",
      ],
    },
    {
      heading: "When the answer is do nothing",
      body: [
        "The Processing Savings Calculator has a branch that says stop, and it renders. If the six levers together come to less than $600 a year, the page tells you not to act. That threshold is an editorial judgment rather than a sourced figure, and the reasoning is on the page: repricing or moving a merchant account costs a week of somebody's attention, a re-integration and a real chance of a settlement gap. Below roughly fifty dollars a month of identified saving, the work costs more than it returns.",
        "The second version of do nothing is worth more than the first. If your markup is already at or below the target you entered, the repricing lever returns zero no matter how high your total effective rate is. That happens most often to small ticket merchants, where the fixed fee rather than the percentage is doing the damage. A merchant with a $9 average ticket paying a fair 2.60 percent plus 10 cents has an effective rate of 3.71 percent and almost nothing to negotiate, because 10 cents on $9 is 111 basis points on its own. The fix there is a higher average order value or an order minimum, not a new processor.",
        "Before you move, check what the cheaper number is attached to. A markup quoted 20 basis points below your current one, wrapped in a three year term with an early termination fee and a 48 month equipment lease, is not cheaper. Terminal leases in particular are where the savings from a repricing go to die: a fair market value lease is the only common structure where you can make every payment and own nothing at the end. Compare the two total costs rather than the two rates.",
      ],
    },
  ],
  rateTable: {
    caption:
      "What each lever is priced off. Every row except the last is two rows of the Visa USA Interchange Reimbursement Fees schedule, rates effective 18 April 2026, read from usa.visa.com on 5 September 2026, with the difference computed by this page. The ACH row is computed by this page from the worked example above and from published US ACH pricing.",
    columns: ["What it clears as now", "What it could clear as", "The difference"],
    rows: [
      {
        label: "Level 3 data on a corporate or purchasing card",
        note: "Visa Purchasing and Corporate T&E",
        values: ["Commercial Card Not Present, 2.70% + $0.10", "Commercial Product 3, 1.75% + $0.10", "0.95% of the sale"],
      },
      {
        label: "Level 2 data on a small business card",
        note: "Visa Business Credit, spend tier I",
        values: ["Business Product 1, 2.65% + $0.10", "Business Product 2, 1.90% + $0.10", "0.75% of the sale"],
      },
      {
        label: "Level 3 data on a small business card",
        note: "The ladder runs backwards here. Sending full line item detail on a Visa small business card costs more than stopping at Level 2.",
        values: ["Business Product 2, 1.90% + $0.10", "Business Product 3, 2.40% + $0.10", "0.50% worse"],
      },
      {
        label: "A consumer credit sale that downgrades",
        note: "Visa card not present, Traditional Rewards card",
        values: ["Non-Qualified Consumer Credit, 3.15% + $0.10", "Product 1, 2.04% + $0.10", "1.11% of the sale"],
      },
      {
        label: "A business card that falls to non-qualified",
        note: "Visa Business Credit, spend tier I",
        values: ["Business Non-Qualified, 3.15% + $0.20", "Business Product 1, 2.65% + $0.10", "0.50% plus $0.10"],
      },
      {
        label: "A $1,250 invoice moved from card to ACH",
        note: "Computed by this page at the worked example's 3.00 percent variable card rate",
        values: ["$37.50 on a card", "$5.00 by ACH, capped", "$32.50 per invoice"],
      },
    ],
  },
  assumptions: [
    "Every basis point figure on this page is the arithmetic difference between two quoted rows of the Visa USA Interchange Reimbursement Fees schedule, Visa Supplemental Requirements, rates effective 18 April 2026, read from usa.visa.com on 5 September 2026. Both rows are printed in the table above so the working is visible. Visa and Mastercard revise in April and October, so re-read the sheet before acting on a figure that matters.",
    "Pass through defaults to 1.90 percent, a midpoint of a 1.70 to 2.10 percent band, and it is an estimate rather than a measurement. The band is bounded by named programs on the same Visa schedule: regulated debit at 0.05 percent plus 21 cents and exempt retail debit at 0.80 percent plus 15 cents at the floor, and Visa Product 1 at 2.04 percent plus 10 cents rising to Visa Signature Preferred at 2.60 percent plus 10 cents at the ceiling. Assessments of 0.13 to 0.14 percent plus roughly two cents an authorization sit on top, read from the Wells Fargo Merchant Services Payment Network Pass-Through Fee Schedule effective 1 July 2026 and corroborated by the Fiserv pass through schedule published as Appendix G by the North Carolina Office of the State Controller, both checked 5 September 2026.",
    "ACH pricing is Stripe at 0.8 percent capped at $5.00, from stripe.com/pricing read through the Internet Archive capture dated 1 September 2026 because that page geo-redirects this machine to non-US pricing, and Helcim at 0.5 percent plus 25 cents capped at $6.00, read from helcim.com/pricing on 5 September 2026. The markup target ladder is Helcim's published US interchange plus table, read the same day. It is one processor's public price list used as a checkable negotiation target, not a claim about who is cheapest.",
    "The surcharge ceiling is Visa's own rule, from its merchant surcharging question and answer document on usa.visa.com, checked 5 September 2026: limit the surcharge to your merchant discount rate for the applicable credit card or 3 percent, whichever is lowest, and debit and prepaid cards cannot be surcharged. Whether you may surcharge at all turns on your state, your acquirer agreement and thirty days of written notice to the networks, none of which this page decides for you. It is off by default.",
    "The illustrative merchant, meaning the volume, the transaction count, the fee total, the commercial card share and the downgraded share, is an example rather than a benchmark. Nothing on this page treats those five figures as typical of anything, and every one of them is an input you should replace from your own statement before reading the answer.",
    "The $600 a year floor under which this page tells you to do nothing is an editorial judgment, not a sourced figure. It is roughly what a week of somebody's attention costs against the disruption of a migration, and it is stated on the page rather than hidden in the model.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "How much can I save on credit card processing?",
      answer:
        "It depends entirely on your markup, not your headline rate. On the worked example above, a merchant at $120,000 a month and a 3.15 percent effective rate has $1,500 a month of processor markup and recovers $18,056.64 a year across six levers, dropping to a 1.90 percent effective rate. A merchant already paying a 45 basis point markup recovers close to nothing, and this calculator will say so.",
    },
    {
      question: "Am I overpaying for credit card processing?",
      answer:
        "Divide total fees by total card volume to get your effective rate, then subtract an interchange and assessments estimate of about 1.90 percent. What is left is markup. Under 50 basis points of markup is competitive, and published interchange plus markups run from 0.15 to 0.50 percent depending on volume and channel. If your markup is over 100 basis points you are overpaying, whatever your contracted rate says.",
    },
    {
      question: "What is a good credit card processing rate?",
      answer:
        "As a blended effective rate: under 1.9 percent is excellent, up to 2.25 percent is good, up to 2.75 percent is average and typical of flat rate pricing, up to 3.2 percent is high, and above that something specific is wrong. But the better test is markup. Two merchants at 2.6 percent can be 90 basis points apart on the only part that is negotiable, because their card mixes differ.",
    },
    {
      question: "How do I lower my credit card processing fees?",
      answer:
        "In order of what usually pays: move large invoices to ACH, where a $1,250 invoice costs $5.00 instead of $37.50; remove monthly line items, especially a PCI non-compliance fee, which is a penalty rather than a price; fix the transactions that downgrade, worth up to 111 basis points on affected volume; send Level 2 data on commercial cards, worth 75 to 95 basis points; then reprice the markup itself.",
    },
    {
      question: "Can I negotiate my credit card processing rate?",
      answer:
        "You can negotiate the markup, which is your entire negotiable surface. You cannot negotiate interchange or assessments, which typically make up 1.70 to 2.10 percent of volume and go to the issuing bank and the network rather than to your processor. Walk in with your markup in basis points and a published target, for example 0.45 percent plus 20 cents at $50,000 to $100,000 a month, rather than with a total rate.",
    },
    {
      question: "Is it worth switching payment processors to save on fees?",
      answer:
        "Below about $600 a year of identified saving, no. A migration costs a week of attention, a re-integration and a real chance of a settlement gap, and this page says do nothing when the arithmetic lands there. Above roughly $3,000 a year it usually is, provided the cheaper markup is not attached to a three year term, an early termination fee, or a 48 month equipment lease.",
    },
  ],
  related: [
    "effective-rate-calculator",
    "interchange-plus-vs-flat-rate-calculator",
    "merchant-account-junk-fee-calculator",
    "interchange-downgrade-calculator",
    "ach-vs-credit-card-fee-calculator",
  ],
  links: [
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
    { label: "Processors with interchange plus pricing", href: "/payment-processors/interchange-plus" },
    { label: "Effective rate, explained", href: "/glossary/effective-rate" },
    { label: "Markup, explained", href: "/glossary/markup" },
    { label: "Interchange, explained", href: "/glossary/interchange" },
    { label: "Compare all processors", href: "/processors" },
  ],
  cta: {
    heading: "You have the number. Now get the quotes.",
    body: "A markup in basis points and a published target is everything you need to reprice. Compare processors that publish interchange plus pricing and itemize the interchange line, or tell us your volume and we will shortlist the ones that price your mix differently.",
    label: "Get matched",
  },
};
