import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/chargeback-cost-calculator`.
 *
 * ─── The intent this page owns ───────────────────────────────────────────────
 * The FINANCIAL question: "how much does a chargeback cost", "true cost of a
 * chargeback", "chargeback cost calculator". Not the compliance question. This
 * site already ranks a page for that: `/tools/chargeback-ratio-calculator` owns
 * the ratio, the denominators and the Visa and Mastercard thresholds, and it
 * carries a basic per-chargeback cost mode. This page starts one step past it
 * and goes where that page deliberately stops: the multiple of order value, the
 * economics of representment, the annual P&L line, and the assessment ladder
 * once a monitoring program has already picked you up. It links to the ratio
 * page for the threshold question and says so in the copy rather than restating
 * a single threshold row.
 *
 * ─── What the ranking competition gets wrong ─────────────────────────────────
 * Four checkable things, all of which this page fixes.
 *
 * 1. THE MULTIPLE IS QUOTED WITHOUT ITS DEFINITION. Everyone repeats "a
 *    chargeback costs two to three times the transaction value" and nobody says
 *    whether the reversed sale is inside the multiple. It changes the answer by
 *    roughly a factor of two. This page computes both figures, labels which is
 *    cash and which is exposure, and shows the division.
 * 2. THE WIN RATE IS NOT COMPOUNDED. A representment accepted at the first cycle
 *    can be reversed at pre-arbitration. 44.6 percent first-cycle wins with 19
 *    percent of those reversed is a 36.13 percent final win rate, and almost
 *    every calculator that models representment at all uses the raw first-cycle
 *    number.
 * 3. FIGHTING IS ASSUMED TO BE FREE. It costs an hour of somebody's time and, on
 *    several processors, a second fee to submit the evidence. Once those are in
 *    the model there is a break-even order value below which representment
 *    destroys value: $155.51 on this page's defaults. No competing calculator
 *    publishes one.
 * 4. THE ANNUAL FIGURE IS DIVIDED BY REVENUE. The question a merchant is
 *    actually asking is how much more they have to SELL, and that divides by
 *    gross margin. On a 49 percent margin the revenue answer is half the truth.
 *
 * ─── Where the numbers came from ─────────────────────────────────────────────
 * Representment: Chargebacks911 2026 Chargeback Field Report, published 30 June
 * 2026. 44.6 percent first-cycle win rate, 10.7 percent net recovery across all
 * chargebacks received, 19 percent of first-cycle wins reversed at the second
 * cycle. Checked 5 September 2026. No source publishes a win rate by reason
 * code, so this page does not print one; see `lib/tools-data/chargeback-cost.ts`.
 *
 * Labor: Bureau of Labor Statistics, Employer Costs for Employee Compensation,
 * March 2026, released 12 June 2026. Total employer compensation for private
 * industry workers averaged $46.60 per hour worked.
 *
 * Escalation: PayPal Braintree developer documentation, Mastercard Excessive
 * Chargeback Program, read 5 September 2026, for the ECM and HECM ladders and
 * the issuer recovery assessment. Mastercard does not publish these amounts.
 * Visa does not publish its VAMP assessment amount at all: its own fact sheet on
 * corporate.visa.com carries the ratio and the thresholds and no dollar figure,
 * so the approximate $8 per event is attributed to Chargeflow's VAMP guide,
 * updated 3 September 2026, and flagged on the page as not published.
 *
 * Every dollar figure in `workedExample` was produced by running
 * `lib/calc/chargeback-cost.ts` on the stated inputs, not written by hand.
 */

const NOT_ADVICE =
  "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.";

export const CHARGEBACK_COST_TOOL: ToolDef = {
  slug: "chargeback-cost-calculator",
  name: "True Cost of a Chargeback Calculator",
  h1: "True Cost of a Chargeback Calculator",
  title: "True Cost of a Chargeback Calculator | Estimate Dispute Costs",
  description:
    "Use our true cost of a chargeback calculator to estimate lost revenue, chargeback fees, processing costs, staff time, and total dispute exposure.",
  intro:
    "The true cost of a chargeback on a $120 order is neither $120 nor $15. On the defaults below it removes $110.73 of cash from the bank account, which is $230.73 of total exposure once the reversed sale is counted, or 1.92 times the order value. The True Cost of a Chargeback Calculator adds up all six lines, then prices the part nobody models: representment wins 44.6 percent of the time at the first cycle and 19 percent of those wins are reversed later, so fighting a $120 dispute loses money in expectation.",
  tier: 1,
  summary:
    "The full multiple of order value, whether representment pays, and the extra sales at your margin a year of chargebacks costs.",
  widget: "chargeback-cost",
  workedExample: {
    scenario:
      "Harbor Lane Goods is a US direct to consumer outdoor gear brand. It ships 3,200 orders a month at a $214 average order value and takes 38 chargebacks a month, a 1.19 percent dispute rate. Cost of goods on the average order is $86 and fulfillment is $12. It is on flat-rate pricing at 2.9 percent plus 30 cents, with a $15 dispute received fee and a $15 dispute countered fee that is returned on a win. A support lead spends 45 minutes logging and reconciling each dispute and another 60 minutes building a case on the ones the team decides to fight, at a loaded cost of $46.60 an hour. They fight 60 percent of disputes. They use the published averages for outcomes: 44.6 percent of represented disputes won at the first cycle, 19 percent of those wins reversed at the second.",
    result:
      "Start with one chargeback. Goods and fulfillment already spent are $98. The processing fee on the original sale is 2.9 percent of $214, which is $6.21, plus the 30 cent fixed fee, so $6.51, and none of it comes back. The dispute received fee is $15.00. Forty five minutes at $46.60 an hour is $34.95. Cash out of the bank is 98.00 plus 6.51 plus 15.00 plus 34.95, which is $154.46. Add the $214.00 sale that was reversed and total exposure is $368.46, or 1.72 times the order value. Gross margin on a good order is 214 minus 86 minus 12 minus 6.51, which is $109.49, a 51.16 percent margin, so replacing the cash from one chargeback takes 1.41 more orders. Now the representment. The final win rate is 44.6 percent multiplied by 81 percent, which is 36.13 percent, not 44.6 and not 25.6. Fighting one case costs 60 minutes at $46.60 plus the $15.00 countered fee, so $61.60. A win returns the $214.00 order plus the $15.00 countered fee, and 36.13 percent of $229.00 is $82.73. Expected value per case fought is $82.73 minus $61.60, which is $21.13, so at this order value fighting pays. It stops paying below $155.51. Now the year. Cash out on all 456 chargebacks is $70,433.76. Fighting 60 percent of them, 273.6 cases, costs $16,853.76 and returns $22,634.53, so the net annual cost is $64,652.99, which is 0.79 percent of $8,217,600 of revenue. At a $109.49 gross margin that is 591 additional orders, or $126,365 of extra revenue, just to get back to where they started. Push representment from 60 percent to 100 percent and the year costs $60,799.15 instead, an improvement of $3,853.85. Cutting the disputes themselves from 38 a month to 30, which is a dispute rate of 0.94 percent instead of 1.19 percent, takes the year to $51,041.84 and saves $13,611.16, three and a half times as much as fighting every case.",
  },
  sections: [
    {
      heading: "What the true cost of a chargeback actually adds up to",
      body: [
        "Six lines, and only one of them is the fee everybody shops on. The reversed revenue is the sale amount the issuer takes back. The cost of goods and the fulfillment are money already spent getting an order out of the door that you will not see again, because a disputed order is almost never returned. The processing fee on the original sale stays with the processor: a dispute is not a refund. Then the chargeback fee, charged on receipt whatever the outcome. Then the staff time, which on the defaults here is the second largest line in the calculation.",
        "The True Cost of a Chargeback Calculator separates two numbers that every other page runs together. Cash out is what actually leaves the bank account: goods plus fulfillment plus the retained processing fee plus the chargeback fee plus the labor. The settlement and the chargeback debit cancel over the life of the order, so the sale amount is not a cash line twice. Total exposure is cash out plus the reversed sale, and it is the figure behind the claim that a chargeback costs two to three times the transaction value. On a $120 order with $48 of goods, $9 of fulfillment, $3.78 of processing, a $15 fee and 45 minutes at $46.60 an hour, cash out is $110.73 and total exposure is $230.73, a multiple of 1.92.",
        "The multiple is real and it is also a framing choice, which is why it floats between two and three depending on who is quoting it. Nobody who repeats it says whether the reversed sale is inside it, and the answer moves by roughly a factor of two. Small tickets run higher multiples, because the chargeback fee and the staff hour do not scale: a $15 fee and 45 minutes on a $30 order is a multiple above five. The staff hour is also the line merchants leave at zero. The default here is $46.60, the Bureau of Labor Statistics figure for total employer compensation per hour worked for private industry workers in March 2026, released 12 June 2026. Wages alone were $32.60 of that, and the loaded figure is the right one.",
      ],
    },
    {
      heading: "Representment is a bet, and most merchants take it at the wrong odds",
      body: [
        "Representment means resubmitting the transaction with evidence: either the money comes back or it does not. Chargebacks911's 2026 Chargeback Field Report, published 30 June 2026, puts the first-cycle win rate at 44.6 percent of the disputes merchants chose to fight, and the net recovery rate across every chargeback received, fought or not, at 10.7 percent. That gap is what this section is about.",
        "The same report says 19 percent of first-cycle wins are lost again at the second cycle, which is pre-arbitration and arbitration. That means the two rates COMPOUND. The final win rate is 44.6 percent multiplied by 81 percent, which is 36.13 percent. It is not 44.6 percent, which ignores the second cycle, and it is not 25.6 percent, which subtracts one from the other. All three look reasonable printed on a page and only one is right. The True Cost of a Chargeback Calculator does the multiplication and shows both inputs, so you can replace them with your own last twelve months.",
        "Now price the bet. Fighting costs an hour of somebody's time, and on several processors a second fee to submit the evidence. Stripe charges a dispute countered fee on top of the dispute received fee, returns the countered one if you win, and keeps the received one either way. The expected value of fighting one case is therefore the final win rate multiplied by the order value plus any refundable fee, minus the labor and the fee. Solve for zero and you get a break-even order value: labor plus fee, divided by the win probability, minus the refundable fee. On the defaults that is $155.51.",
        "Below $155.51 an order, fighting the average dispute loses money in expectation. That is an argument for fighting selectively, because the average hides enormous variation. A product-not-received dispute where you hold tracked delivery to the billing address is worth fighting at almost any order value: the evidence is objective and the case takes ten minutes. A not-as-described dispute where your only evidence is a product page is worth fighting almost never. Nobody publishes a win rate by reason code, so this page does not invent one.",
      ],
    },
    {
      heading: "A year of chargebacks, and the only number that lands in a meeting",
      body: [
        "One chargeback is an annoyance. A year of them at a steady rate is a P&L line, and usually the first time anyone in the business sees the size of it. The annual view multiplies the per-chargeback cash out by twelve months of disputes, then layers the representment: what fighting a share of them costs, and what it returns at the compounded win rate.",
        "On the defaults, 60 chargebacks a month against 5,000 transactions is a 1.20 percent dispute rate and 720 chargebacks a year. Cash out on all of them is $79,725.60. Fighting 60 percent, which is 432 cases, costs $26,611.20 and returns $21,068.68, so representment makes this merchant worse off by $5,542.52 across the year, because the $120 order value sits below the $155.51 break-even. Net annual cost is $85,268.12, or 1.18 percent of $7,200,000 of revenue.",
        "Then the conversion that changes the conversation. How much more do you have to sell to earn that back? Not $85,268 of revenue, because revenue is not money you keep. You have to sell enough that the GROSS MARGIN on the extra orders covers the loss, and here that margin is $59.22 an order, or 49.35 percent. That is 1,440 additional orders, or $172,782 of extra revenue. Dividing $85,268 by the $120 order value gives 711 orders and is the comfortable wrong answer, understating the real figure by exactly the ratio of order value to margin.",
        "Margin is the right denominator and almost nobody uses it, which is why chargeback losses get budgeted as a fee line rather than a hole in the sales plan. It also reframes the fix: if a year of chargebacks needs 1,440 replacement orders and your acquisition cost is above zero, those orders cost more than the loss they cover. A dollar spent on the reason the disputes arrive, clearer billing descriptors, a working cancellation flow, delivery confirmation, is competing against a fully loaded cost of acquisition and usually wins.",
      ],
    },
    {
      heading: "What it costs once a monitoring program picks you up",
      body: [
        "Everything above assumes your acquirer is content. Once a card network monitoring program identifies you, a second cost starts on top: monthly assessments that escalate for as long as you stay identified. Whether your ratio puts you inside one of those programs is a different question, and the chargeback ratio calculator on this site owns it, scoring you against the current Visa VAMP and Mastercard lines with every source recorded. This page starts from you already being in.",
        "The Mastercard ladder is the one to internalize, and the table below carries it in full. Month one, the month you are identified, is free. It steps from USD 1,000 a month to USD 100,000 a month across nineteen months, and twelve months at the Excessive Chargeback Merchant tier totals USD 192,000. The High Excessive tier is USD 383,000 over the same year, plus an issuer recovery assessment of USD 5 for every chargeback above 300 in the month from the fourth month onward.",
        "Two things there are worth reading twice. A merchant who reads USD 1,000 off a program guide and budgets one payment is out by a factor of nearly two hundred inside a year. And exit takes three consecutive months back below the line while the current month's assessment keeps being charged, so a business that fixes the problem in month six still pays months seven, eight and nine at the month seven rate. The escalation is a function of TIME identified, not of how bad the ratio got.",
        "Visa's program works differently and its cost is genuinely uncertain. There is no ladder and no warning tier: assessments start in the month you are identified and are charged per qualifying event, and an event is a fraud report or a dispute, so the count is larger than your chargeback count. Visa's own Acquirer Monitoring Program fact sheet sets out the ratio and the thresholds and states no dollar figure, so the widely repeated USD 8 per event is industry reporting rather than a Visa number, and this page labels it as such.",
      ],
    },
    {
      heading: "When the answer means act, and when it means do nothing",
      body: [
        "Two thresholds decide what to do, and neither is a network ratio. The first is the break-even order value, which decides whether to fight. The second is your annual cost as a share of gross margin, which decides whether to spend on prevention. Below about 0.50 percent by count the cost is real but not strategic; above 0.90 percent you are in the range most US acquirers watch on an internal limit they never publish.",
        "The break-even order value is the output that tells you when the right answer is to stop fighting. If your average order sits below it, the hour your team spends on representment is worth more redeployed. That is counterintuitive in a market where every vendor sells dispute response, and it falls out of the arithmetic: a 36 percent chance of recovering a small order does not cover an hour of loaded labor plus a countered fee.",
        "Refunding early is the move the cost model keeps recommending and merchants keep resisting. A refund issued before the chargeback posts costs you the goods and the processing fee. A chargeback on the same order costs all of that plus a chargeback fee, the staff time, and a mark against your ratio that a win does not erase. On the defaults that is the $15 fee plus 45 minutes of dispute handling, $49.95 on a $120 order, and it removes the ratio risk. It is also what pre-dispute tools and alert networks are really selling, and it is worth being clear-eyed about what they buy: ratio, not money, because a resolution through them is still a refund.",
        "And know when the answer is do nothing. If your dispute rate is under half a percent, your average order is under the break-even, and no program has identified you, the right action is to record the number, stop paying for dispute response you do not need, and re-run this in six months. Run the True Cost of a Chargeback Calculator with your own numbers before you buy anything.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Monthly assessments once a card network monitoring program identifies you, and what twelve months of each costs. The monthly amounts are SOURCED from the PayPal Braintree developer documentation for the Mastercard Excessive Chargeback Program, read 5 September 2026; Mastercard does not publish them and Visa does not publish its amount at all. The twelve month totals are COMPUTED on this page by summing those ladders, and every cell is reproducible with the escalation mode of the calculator above.",
    columns: ["Mastercard ECM", "Mastercard HECM", "Visa VAMP Excessive merchant"],
    rows: [
      {
        label: "Month 1, the month you are identified",
        note: "Both Mastercard tiers are free in month one, which is the line merchants budget from and should not.",
        values: ["$0", "$0", "$8 per event, from month one"],
      },
      {
        label: "Months 2 to 3",
        values: ["$1,000 a month", "$1,000 then $2,000", "$8 per event"],
      },
      {
        label: "Months 4 to 6",
        note: "The Mastercard issuer recovery assessment starts here at the High Excessive tier: USD 5 for every chargeback above 300 in the month.",
        values: ["$5,000 a month", "$10,000 a month", "$8 per event"],
      },
      {
        label: "Months 7 to 11",
        values: ["$25,000 a month", "$50,000 a month", "$8 per event"],
      },
      {
        label: "Months 12 to 18",
        values: ["$50,000 a month", "$100,000 a month", "$8 per event"],
      },
      {
        label: "Month 19 and beyond",
        values: ["$100,000 a month", "$200,000 a month", "$8 per event"],
      },
      {
        label: "First twelve months, total",
        note: "Computed by summing the ladder. The Visa column is 8 times your monthly fraud plus dispute count times twelve, shown here at 90 events a month.",
        values: ["$192,000", "$383,000", "$8,640"],
      },
      {
        label: "Is the amount published by the network?",
        note: "Visa's own Acquirer Monitoring Program fact sheet carries the ratio and the thresholds and states no assessment figure. The $8 is attributed to Chargeflow's VAMP guide, updated 3 September 2026, which itself calls it approximate.",
        values: ["No", "No", "No"],
      },
    ],
  },
  assumptions: [
    "Representment outcomes default to the Chargebacks911 2026 Chargeback Field Report, published 30 June 2026 and checked 5 September 2026: a 44.6 percent first-cycle win rate on disputes merchants chose to fight, 19 percent of those wins reversed at the second cycle, and a 10.7 percent net recovery rate across every chargeback received. Both inputs are editable and you should replace them with your own last twelve months.",
    "No source publishes a representment win rate by dispute reason category with a disclosed sample, so this page does not print one. The reason category selector changes the guidance on what decides the outcome, which is checkable against published network rules, and leaves the rate as an input. Any page showing you a table of win rates per reason code is quoting a vendor's own book of business.",
    "The default hourly cost of staff time is $46.60, which is total employer compensation costs per hour worked for private industry workers in March 2026, from the Bureau of Labor Statistics Employer Costs for Employee Compensation news release dated 12 June 2026. Wages and salaries alone were $32.60. Use your own loaded rate if you have one.",
    "The default $15.00 dispute received fee and $15.00 dispute countered fee are Stripe's US amounts, read from stripe.com/pricing for this site's Stripe rate card on 1 September 2026. Stripe's dispute fees FAQ at support.stripe.com, read 5 September 2026, states that the countered fee is returned if you win and does not print the amounts. Square charges nothing for disputes and PayPal charges $20.00 on a card chargeback, so change the field.",
    "No network publishes its assessment amounts. Mastercard's ECM and HECM ladders and the USD 5 issuer recovery assessment come from PayPal Braintree's developer documentation for the Mastercard Excessive Chargeback Program, read 5 September 2026; a Moneris acquirer guide last modified March 2025 carries the same ladder with one cell differing, USD 25,500 rather than USD 25,000 for ECM months seven to eleven. Visa's fact sheet states no figure at all, so the USD 8 per fraud or dispute event is from Chargeflow's VAMP guide, updated 3 September 2026, which itself calls it approximate. Get the real number from your acquirer, which is the party that bills it. This page deliberately carries no network threshold table: the chargeback ratio calculator on this site owns that question and sources every row.",
    "Cash out treats the original settlement and the chargeback debit as cancelling, so the reversed sale is reported on its own line rather than counted as cash twice. Recovered inventory, reshipped goods, acquirer or ISO fees added on top of the network assessment, rolling reserves and the cost of losing processing entirely are all outside the model.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "How much does a chargeback cost?",
      answer:
        "More than the fee and less than most vendors claim, and the answer depends on your unit economics. On a $120 order with $48 of goods, $9 of fulfillment, $3.78 of processing already paid, a $15 chargeback fee and 45 minutes of staff time at $46.60 an hour, $110.73 of cash leaves the bank. Counting the $120 sale that was reversed takes total exposure to $230.73, which is 1.92 times the order value.",
    },
    {
      question: "Is a chargeback really 2 to 3 times the transaction value?",
      answer:
        "It can be, but the claim is meaningless without saying whether the reversed sale is inside the multiple, and nobody who quotes it says. Cash out on the example above is 0.92 times the order. Add the reversed sale and it is 1.92 times. Small tickets run higher because the $15 fee and the staff hour do not scale: on a $30 order the multiple is above five. Compute your own rather than quoting a range.",
    },
    {
      question: "Is it worth fighting a chargeback?",
      answer:
        "Only above a break-even order value, which the True Cost of a Chargeback Calculator computes. At a 36.13 percent final win rate, an hour of staff time at $46.60 and a $15 countered fee, fighting breaks even at $155.51. Below that the average case loses money in expectation. Above it, and in categories where the evidence is objective such as tracked delivery on a product-not-received dispute, representment is clearly worth the hour.",
    },
    {
      question: "What percentage of chargebacks do merchants win?",
      answer:
        "Chargebacks911's 2026 Chargeback Field Report, published 30 June 2026, puts the first-cycle win rate at 44.6 percent of disputes merchants chose to fight, with 19 percent of those wins reversed at the second cycle. That compounds to a 36.13 percent final win rate. Across every chargeback received, fought or not, the same report puts net recovery at 10.7 percent. No source publishes a credible win rate by reason code.",
    },
    {
      question: "Do you get the chargeback fee back if you win?",
      answer:
        "Usually not. Stripe keeps the dispute received fee whatever happens and returns only the separate dispute countered fee you pay to submit evidence. PayPal charges $20.00 on a card chargeback regardless of who wins. Square charges nothing. Winning also does not remove the dispute from your chargeback ratio on either network, so representment recovers money and leaves your standing exactly where it was.",
    },
    {
      question: "How much do chargeback monitoring program fees cost?",
      answer:
        "At the Mastercard Excessive Chargeback Merchant tier the ladder runs $0 in month one, $1,000 in months two and three, $5,000 a month for months four to six, $25,000 a month for months seven to eleven and $50,000 a month after that. Twelve months of it is $192,000. The High Excessive tier is $383,000 over the same year plus $5 per chargeback above 300 a month from month four.",
    },
  ],
  related: [
    "chargeback-ratio-calculator",
    "refund-cost-calculator",
    "false-decline-cost-calculator",
    "high-risk-merchant-account-cost-calculator",
    "rolling-reserve-calculator",
  ],
  links: [
    { label: "What a chargeback is", href: "/glossary/chargeback" },
    { label: "Dispute, defined", href: "/glossary/dispute" },
    { label: "Chargeback ratio, defined", href: "/glossary/chargeback-ratio" },
    { label: "Processors with no rolling reserve", href: "/payment-processors/no-rolling-reserve" },
    { label: "High-risk payment processors", href: "/category/high-risk" },
  ],
  cta: {
    heading: "The fee is the smallest line in the calculation",
    body: "Shopping processors on the chargeback fee alone means grading them on the cheapest line in the whole calculation. What matters more is who holds a reserve, how they handle representment, and what their underwriting tolerates before they reprice you. Compare US processors on all of it.",
    label: "Compare US payment processors",
  },
};
