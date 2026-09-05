/**
 * `/tools/authorize-net-fee-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on Authorize.Net cost:
 * "authorize.net fee calculator", "authorize net fees", "authorize.net pricing",
 * "authorize.net monthly fee", "authorize.net batch fee". The brand review, the
 * "is it worth it" comparison and the definitions belong to `/processor/authorize-net`,
 * `/compare/braintree-vs-authorize-net` and `/glossary/*`, which this page links
 * into rather than duplicating.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Authorize.Net sells two products under
 * one price list, and almost every calculator on this query collapses them into
 * one. All-in-One bundles a merchant account and quotes $25.00 a month plus 2.9%
 * and 30 cents. Payment Gateway Only quotes $25.00 a month plus 10 cents a
 * transaction plus a 10 cent DAILY BATCH FEE, and the card percentage on that
 * plan is charged by the merchant's own acquirer and is not Authorize.Net's money
 * at all. The two failure modes in the wild are applying 2.9% to a gateway-only
 * merchant, which overstates Authorize.Net's take by roughly sixteen times on the
 * worked example below, and quoting "$25 plus 10 cents" as the whole cost of
 * acceptance, which understates the real bill by the same margin. Both drop the
 * batch fee entirely, because a per-settled-batch charge does not fit the three
 * line model every fee calculator is built on.
 *
 * WHERE THE NUMBERS CAME FROM. Every published figure was read from
 * authorize.net/en-us/sign-up/pricing.html and the Merchant Interface fee
 * definitions page on 5 September 2026, and the settlement cadence from
 * Authorize.Net's own support article on the transaction cut-off time, same date.
 * They are recorded with their sources in `lib/rate-cards/authorize-net.ts`.
 * Every dollar figure in the worked example, the rate table and the FAQs is
 * arithmetic on those inputs, reproduced line by line and asserted in
 * `tests/tools/batch-four/authorize-net-fee-calculator.test.ts` in integer cents.
 * The 250 business day basis is 2026's 261 weekdays less the eleven federal
 * holidays, all of which fall on a weekday in 2026; the test recomputes it from a
 * calendar rather than trusting the constant.
 */

import type { ToolDef } from "@/lib/tools";

export const AUTHORIZE_NET_FEE_TOOL: ToolDef = {
  slug: "authorize-net-fee-calculator",
  name: "Authorize.Net Fee Calculator",
  h1: "Authorize.Net Fee Calculator: All-in-One vs Gateway Only",
  title: "Authorize.Net fee calculator: both plans priced",
  description:
    "Price Authorize.Net All-in-One against Payment Gateway Only, including the 10 cent daily batch fee that costs 25 dollars a year and nobody else counts.",
  intro:
    "An accurate Authorize.Net fee calculator has to start by asking which of the two pricing shapes you are actually on, because mixing the two up is the mistake almost every merchant pricing Authorize.Net makes at least once. All-in-One is $25.00 a month plus 2.9% and 30 cents, with a merchant account bundled. Payment Gateway Only is $25.00 a month plus 10 cents a transaction plus a 10 cent daily batch fee, and the card percentage belongs to your own acquirer, not to Authorize.Net. This Authorize.Net Fee Calculator prices both, and annualizes the fee nobody counts: 10 cents across 250 US business days is $25.00 a year, an extra month of gateway bill.",
  tier: 2,
  summary:
    "Both Authorize.Net plans priced side by side, with the daily batch fee annualized.",
  widget: "brand-fee",
  rateCard: "authorize-net",
  workedExample: {
    scenario:
      "Ardmore Fasteners, an industrial supplier in Ohio, runs $40,000 a month across 320 card transactions, an average ticket of $125. It already holds a merchant account through its bank at a 2.25% discount rate and needs a gateway to sit in front of it, so it is pricing Authorize.Net's Payment Gateway Only plan against the All-in-One plan that would replace the bank account entirely.",
    result:
      "Payment Gateway Only, with the bank's 2.25% left where it is. The discount rate is 2.25% of $40,000, which is $900.00. Authorize.Net's per transaction fee is 320 x $0.10, which is $32.00. The gateway fee is $25.00 a month. The daily batch fee is $0.10 on each of 250 US business days, which is $25.00 a year, or $2.08 a month. Total $959.08 a month, $11,508.96 a year, an effective rate of 2.40%. Now the identical month on All-in-One: 2.9% of $40,000 is $1,160.00, the 30 cent transaction fee across 320 sales is $96.00, and the plan fee is $25.00, so $1,281.00 a month, $15,372.00 a year, an effective rate of 3.20%. Staying on Payment Gateway Only saves Ardmore $321.92 a month and $3,863.04 a year. Then look at what Authorize.Net itself earns from that gateway-only month: $32.00 of transaction fees, $25.00 of gateway fee and $2.08 of annualized batch fees, which is $59.08 a month and $708.96 a year. The other $900.00 a month is the bank's. Any page that shows you the $59.08 and calls it your Authorize.Net cost is right about Authorize.Net and useless about your business, and any page that applies 2.9% to a gateway-only merchant has overstated Authorize.Net's take by more than sixteen times.",
  },
  sections: [
    {
      heading: "How the Authorize.Net Fee Calculator prices the two plans",
      body: [
        "The formula is the same on both plans and only the inputs move. Monthly cost equals card volume times a percentage rate, plus transaction count times a per transaction fee, plus the monthly plan fee, plus the batch fee times the number of batches you settle. On All-in-One the percentage is 2.9%, the per transaction fee is $0.30, the plan fee is $25.00 and no daily batch fee is listed. On Payment Gateway Only the per transaction fee is $0.10, the plan fee is $25.00, the batch fee is $0.10 a day, and the percentage is whatever your own merchant account charges, which Authorize.Net neither sets nor publishes.",
        "The Authorize.Net Fee Calculator folds the batch fee into the monthly plan line, because a per settled batch charge does not fit the three-line shape most fee calculators are built on. Ten cents across 250 US business days is $25.00 a year, which is $2.08 a month, so the gateway-only plans price at $27.08 rather than the advertised $25.00. On those plans you also pick the discount rate your own provider charges you, because without it the calculator can only tell you what Authorize.Net earns, not what a card payment costs you. Comparing 2.9% against 10 cents head to head is meaningless: one price buys a merchant account and a gateway, the other buys a gateway alone.",
        "Switch to the single payment mode and the picture changes shape again, because the monthly fees vanish from a per sale view. A $120 card sale is $3.78 on All-in-One, an effective 3.15% on that one payment, and $2.80 at a 2.25% merchant account plus the gateway's 10 cents, an effective 2.33%. Authorize.Net's own share of that $120 sale on the gateway-only plan is exactly ten cents. Judge a single payment on the per sale numbers and a month on the blended effective rate; the verdict band under the monthly mode scores the blend, which is the number your statement actually shows.",
      ],
    },
    {
      heading: "The daily batch fee, and why $25 a year is a thirteenth gateway bill",
      body: [
        "A batch is the end of day handoff. During the day you authorize cards and capture the ones you intend to collect, but no money moves until the captured transactions are bundled and sent to the networks for settlement. Authorize.Net does that automatically every 24 hours, immediately after your transaction cut-off time, which defaults to 4:00 PM Pacific and produces one batch a day. On the gateway-only plans each settled batch costs 10 cents. That is the entire mechanism, and it is why the fee is invisible: it is a daily line item on a monthly statement, dwarfed by everything above it.",
        "Annualize it and it stops being invisible. 2026 holds 261 weekdays, and all eleven federal holidays fall on a weekday, so a business that settles every US business day settles 250 batches and pays $25.00 a year. That is exactly one extra month of the $25.00 gateway fee, a thirteenth bill nobody budgets for. A business that settles seven days a week, which most retail and ecommerce operations do, settles up to 365 batches and pays $36.50. Because the charge is per settled batch, a day with no captured transactions should not produce one, so 250 is a planning ceiling rather than a guaranteed charge.",
        "It deserves a line of its own because it does not scale with anything. $2.08 a month is 10.4 basis points of a $2,000 month and 0.52 basis points of a $40,000 month, so it is a rounding error for a busy merchant and a real cost for a small or seasonal one. There is also nothing to optimize: you cannot batch less often than once a day and still get paid on a normal cycle. Count it when you compare plans rather than trying to avoid it. If your statement shows a batch fee you do not recognize, check whether it is Authorize.Net's 10 cents or a separate settlement fee your acquirer charges, because both exist.",
      ],
    },
    {
      heading: "On Payment Gateway Only the card rate is not Authorize.Net money",
      body: [
        "Authorize.Net states the position itself: the gateway-only plan requires an existing merchant account, and the processing rates on it are set by your merchant service provider. Authorize.Net moves the transaction, your acquirer prices it. That means the percentage column in this calculator's gateway-only plans is an assumption you supply from your own statement, not a published Authorize.Net rate, and the plan labels say so. Pick the option closest to the effective rate on your last statement and the total will be close; pick one at random and you have a number that looks authoritative and means nothing.",
        "This is the distinction that separates a useful answer from a confident wrong one. Run the worked example both ways. Applying All-in-One's 2.9% to a gateway-only merchant gives $1,281.00 a month and claims Authorize.Net is charging it, when Authorize.Net is charging $59.08. Quoting only the gateway fees gives $59.08 and implies that is what accepting cards costs, when the real bill is $959.08. Both errors show up constantly on Authorize.Net pricing pages, and they are the same error: treating a gateway price list as a processing price list.",
        "To find your real percentage, take your last merchant account statement, add every fee on it, and divide by the card volume it settled. That effective rate already includes interchange, assessments, your provider's markup and monthly minimums. If it lands over 3%, the gateway is still not your problem: a percentage point of markup on $40,000 a month is $400, against a total Authorize.Net bill of $59.08.",
        "There is a crossover, and it is easy to state. At $40,000 a month across 320 sales, Payment Gateway Only plus your own merchant account is cheaper than All-in-One until your merchant account's discount rate passes about 3.05%. At that point $40,000 at 3.05% plus $32.00 plus $27.08 equals All-in-One's $1,281.00, and above it the bundled plan wins. The crossover moves with average ticket, because the 30 cent fee on All-in-One and the 10 cent fee on gateway only diverge fastest when you run many small transactions. Change the transaction count in the calculator and watch it move.",
      ],
    },
    {
      heading: "What Authorize.Net does not charge, and what your reseller might",
      body: [
        "The published extras are unusually clean for this industry. Setup is $0.00. There is no contract and no cancellation fee published. Advanced Fraud Detection Suite and Customer Information Manager, the tokenized card on file vault, carry no monthly fee. Account Updater costs $0.25 per update, charged only when a card on file is actually refreshed. eCheck.Net, the ACH product, is 0.75% of the transaction with a $10.00 minimum monthly fee and a $3.00 returned item fee. All of it was read from the same price list on 5 September 2026.",
        "The eCheck.Net minimum is the one to watch, because $10.00 divided by 0.75% is about $1,333 of monthly bank payment volume. Below that you pay the minimum rather than the rate, so a merchant collecting one $500 ACH invoice a month is paying $10.00 for a service that priced at $3.75. Above it the economics are excellent: a $5,000 B2B invoice costs $37.50 by eCheck.Net against $145.30 on an All-in-One card payment, a difference of $107.80 on a single invoice. If you send large invoices, the bank payment channel is worth more than any gateway negotiation you will ever have.",
        "The bigger caveat is that Authorize.Net is heavily resold. Independent sales organizations bundle the gateway into their own offers and set their own prices for it, so the figures on your statement may not match the direct price list at all. If your gateway line reads $15 or $35 rather than $25, you are on a reseller's paper, and the number to compare is the total of everything the provider bills. The junk fee calculator linked below is built for that. That matters for continuity as much as pricing: Authorize.Net has been a Visa company since Visa completed its acquisition of CyberSource in 2010, so the entity setting the price list is not going anywhere.",
      ],
    },
    {
      heading: "When to move, and when the answer is do nothing",
      body: [
        "Start with the blended effective rate the monthly mode reports. Under 2.25% is a good deal for a small US merchant and nothing here is worth your afternoon. Between 2.25% and 2.75% is typical, worth a look once a year. Above 3.2% something specific is wrong, and it is almost never the gateway. On the worked example the entire Authorize.Net bill is 0.15% of annual volume, so a merchant paying 3.4% has roughly 1.2 points of merchant account markup to argue about and 15 basis points of gateway to ignore.",
        "One comparison decides the All-in-One question quickly. Authorize.Net's All-in-One card rate is 2.9% plus 30 cents, which is identical to Stripe's published US online rate, and Authorize.Net adds $25.00 a month on top of it while Stripe charges no monthly fee. On published rates alone, All-in-One is therefore Stripe plus $25.00 a month, or $300 a year, and the case for it has to be made on something other than price: an existing integration, the virtual terminal, recurring billing, a reseller relationship, or an acquirer that will actually underwrite you. If none of those apply and you are shopping purely on rate, All-in-One is not the answer.",
        "Payment Gateway Only is a genuinely strong product for a specific merchant: one who already has a merchant account worth keeping, or who needs a specialist or high risk acquirer that a flat rate aggregator will not board. At $59.08 a month all in, you keep the ability to change acquirers without rebuilding your checkout, and that optionality is the real product.",
        "The honest closing advice is that this page is usually a five minute check that tells you to leave the gateway alone. Fixing your merchant account rate is worth roughly ten times more than fixing your gateway: 40 basis points on $480,000 of annual card volume is $1,920, against a total gateway bill of $708.96. Run the monthly mode, note the effective rate, then take that number to the effective rate calculator and the savings calculator linked below and spend your negotiating energy on the percentage. The batch fee is worth counting. It is not worth switching over.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Authorize.Net US plans, read from the published price list on 5 September 2026. The two rows marked computed are arithmetic on those figures, done on this page.",
    columns: ["All-in-One", "Payment Gateway Only"],
    rows: [
      { label: "Monthly plan fee", values: ["$25.00", "$25.00"] },
      {
        label: "Charged by Authorize.Net per card sale",
        values: ["2.9% + $0.30", "$0.10"],
      },
      {
        label: "Merchant account discount rate",
        note: "The percentage your acquirer charges on card volume",
        values: ["Included in the 2.9%", "Set by your own provider"],
      },
      {
        label: "Daily batch fee",
        note: "One batch a day, after the 4:00 PM Pacific default cut-off",
        values: ["Not listed", "$0.10 per settled batch"],
      },
      {
        label: "Batch fee over 250 US business days",
        note: "Computed on this page from the 10 cent published fee",
        values: ["None", "$25.00 a year, $2.08 a month"],
      },
      { label: "Setup fee", values: ["$0.00", "$0.00"] },
      { label: "Contract or cancellation fee", values: ["None published", "None published"] },
      {
        label: "eCheck.Net bank payments",
        note: "$10.00 minimum monthly fee, $3.00 returned item fee",
        values: ["0.75%", "0.75%"],
      },
      { label: "Account Updater", values: ["$0.25 per update", "$0.25 per update"] },
      {
        label: "Advanced Fraud Detection Suite and Customer Information Manager",
        values: ["No monthly fee", "No monthly fee"],
      },
      {
        label: "The worked example month above",
        note: "Computed on this page: $40,000 across 320 sales, gateway only priced at a 2.25% merchant account",
        values: ["$1,281.00", "$959.08"],
      },
    ],
  },
  assumptions: [
    "Published rates were read from authorize.net/en-us/sign-up/pricing.html on 5 September 2026: All-in-One at $25.00 a month plus 2.9% and $0.30, Payment Gateway Only at $25.00 a month plus $0.10 a transaction plus a $0.10 daily batch fee, eCheck.Net at 0.75% with a $10.00 minimum monthly fee and a $3.00 returned item fee, $0.00 setup, and Account Updater at $0.25 per update. Fee names were checked against Authorize.Net's Merchant Interface fee definitions page on the same date.",
    "The daily batch fee is annualized over 250 US business days, which is 2026's 261 weekdays less the eleven federal holidays, all of which fall on a weekday in 2026. That is $25.00 a year, or $2.08 a month, and it is added to the gateway-only plan fee so the calculator shows $27.08 rather than the advertised $25.00. A business that settles seven days a week pays up to $36.50 a year instead. Because the fee is charged per settled batch, a day with no captured transactions should not produce one, so 250 is a ceiling for a weekday business rather than a guaranteed charge.",
    "The settlement cadence, one automatic batch every 24 hours immediately after a transaction cut-off time that defaults to 4:00 PM Pacific, comes from Authorize.Net's own support article on the cut-off time, checked 5 September 2026.",
    "On the Payment Gateway Only plans the percentage rate is your merchant account's discount rate, which you choose from the plan list. It is your assumption from your own statement, not an Authorize.Net published figure. Authorize.Net states that the gateway-only plan requires an existing merchant account and that its processing rates are set by your merchant service provider.",
    "The $10.00 eCheck.Net minimum monthly fee is not applied by the calculator. Below roughly $1,333 of monthly bank payment volume you pay the minimum rather than the 0.75% rate, so the eCheck figures shown here understate the cost of a very small ACH volume.",
    "Authorize.Net is widely resold by independent sales organizations who set their own gateway pricing, so a resold account's monthly and per transaction fees can differ from the direct published figures above. Interchange, assessments, PCI fees, monthly minimums and any acquirer batch fee sit on the merchant account side and are not modelled here.",
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "How much does Authorize.Net cost per month?",
      answer:
        "$25.00 a month on either plan, before transaction fees. All-in-One adds 2.9% plus 30 cents per sale, so $40,000 across 320 sales is $1,281.00 a month. Payment Gateway Only adds 10 cents a transaction and a 10 cent daily batch fee, so Authorize.Net's own bill on that same month is $59.08, with your merchant account's discount rate charged separately by your provider.",
    },
    {
      question: "What is the Authorize.Net daily batch fee?",
      answer:
        "A 10 cent charge on each settled batch, on the Payment Gateway Only plans. Authorize.Net batches captured transactions automatically every 24 hours after your cut-off time, which defaults to 4:00 PM Pacific, so it is effectively one charge a day. Across 250 US business days that is $25.00 a year, exactly one extra month of the $25.00 gateway fee. Settle seven days a week and it is $36.50.",
    },
    {
      question: "Is Authorize.Net a payment processor or a payment gateway?",
      answer:
        "A gateway. It authorizes and settles transactions but the merchant account that actually receives the money can be someone else's, which is what the Payment Gateway Only plan is for. The All-in-One plan bundles a merchant account with the gateway and quotes a single 2.9% plus 30 cents rate. Authorize.Net has been a Visa company since Visa acquired CyberSource in 2010.",
    },
    {
      question: "Does Authorize.Net charge 2.9% on the gateway only plan?",
      answer:
        "No. On Payment Gateway Only, Authorize.Net charges $25.00 a month, 10 cents per transaction and a 10 cent daily batch fee, and nothing as a percentage of your sales. The percentage on your statement is your merchant account provider's discount rate. On a $40,000 month that difference is $59.08 of Authorize.Net fees against $900.00 of acquirer fees at a 2.25% rate.",
    },
    {
      question: "Is Authorize.Net worth $25 a month?",
      answer:
        "It depends which plan. All-in-One's 2.9% plus 30 cents matches Stripe's published US online rate, so on price alone it is Stripe plus $300 a year. Payment Gateway Only is different: $59.08 a month all in, on a $40,000 month, buys a stable gateway in front of a merchant account you chose and can change without rebuilding checkout.",
    },
    {
      question: "Does Authorize.Net have a setup fee or a contract?",
      answer:
        "The published price list shows $0.00 setup and no contract or cancellation fee on either plan, checked 5 September 2026. Advanced Fraud Detection Suite and Customer Information Manager carry no monthly fee either. Account Updater is 25 cents per update. If your statement shows a setup or cancellation charge, you are on a reseller's paper rather than direct pricing.",
    },
  ],
  related: [
    "merchant-account-junk-fee-calculator",
    "credit-card-processing-fee-calculator",
    "effective-rate-calculator",
    "braintree-fee-calculator",
    "credit-card-processing-savings-calculator",
  ],
  links: [
    { label: "Authorize.Net review and full pricing breakdown", href: "/processor/authorize-net" },
    { label: "Braintree vs Authorize.Net", href: "/compare/braintree-vs-authorize-net" },
    { label: "What a payment gateway is", href: "/glossary/payment-gateway" },
    { label: "Gateway fee, explained", href: "/glossary/gateway-fee" },
    { label: "Merchant account, explained", href: "/glossary/merchant-account" },
    { label: "Processors with a virtual terminal", href: "/payment-processors/with-virtual-terminal" },
  ],
  cta: {
    heading: "The gateway is 15 basis points. The merchant account is the other 300.",
    body: "On the worked example above, the entire Authorize.Net bill is $708.96 a year and forty basis points of merchant account markup is $1,920. Work out your blended effective rate from your last statement, then see what the same volume costs on interchange plus pricing.",
    label: "Check your effective rate",
  },
};
