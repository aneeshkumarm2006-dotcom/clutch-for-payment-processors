import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/cash-conversion-cycle-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on working capital
 * days: "cash conversion cycle calculator", "DSO calculator", "days sales
 * outstanding calculator", "DSO formula", "how to calculate cash conversion
 * cycle". The definitional siblings ("what is DSO", "what is a good cash
 * conversion cycle") are answered in prose here because the same searcher asks
 * both in the same session, but the definitions themselves stay in the glossary
 * and the brand questions stay on the processor profiles.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Four things, every one of them
 * checkable against the pages currently on page one.
 *
 *   1. They print ONE cash conversion cycle and never say which balance went on
 *      top. Average balance and ending balance are both defensible and they do
 *      not agree. On this page's default figures the two conventions are 55.26
 *      days and 58.30 days, a spread of 3.04 days, which is $20,000 of working
 *      capital. Both are computed here on every keystroke and the gap is shown
 *      as a result in its own right.
 *   2. None of them offers a countback DSO. The simple formula divides a
 *      receivables balance by an AVERAGE sales rate, which is only meaningful
 *      when sales were level. On the default seasonal months here the simple
 *      formula says 47.59 days and the countback says 58.90 days, an 11.31 day
 *      error in the flattering direction, worth about $71,326.
 *   3. They stop at days. Days are not a decision. Every figure here is also
 *      translated into dollars on the visitor's own volume, on the correct
 *      denominator: a day of DSO is a day of CREDIT SALES, a day of DIO or DPO
 *      is a day of COST OF GOODS SOLD. Valuing all three at revenue overstates
 *      the last two by exactly the gross margin and looks entirely plausible.
 *   4. None of them knows that settlement time sits inside DSO, which is the
 *      part this site is qualified to own. A processor that pays out in two
 *      business days instead of five hands back three days of card revenue,
 *      once and permanently, and a rolling reserve of ten percent released after
 *      180 days holds eighteen days of card revenue at steady state.
 *
 * WHERE THE NUMBERS CAME FROM.
 *
 *   - Every day count and dollar figure in the intro, the worked example and the
 *     FAQs is computed by `lib/calc/cash-cycle.ts` and was read off a run of that
 *     module on 5 September 2026, not written by hand. The test file re-derives
 *     each of them from the raw formulas independently.
 *   - The rate table is arithmetic done here on sourced dollar figures: net
 *     sales and trade receivables for all US manufacturing corporations, from
 *     Tables 1.0 and 1.1 of the US Census Bureau Quarterly Financial Report,
 *     2026 Quarter 1, read 5 September 2026. The QFR publishes balances and
 *     sales but no ratio, and it carries no cost of goods sold line at all,
 *     which is why DIO and DPO are absent from that table rather than estimated.
 *   - Bank prime loan rate, 6.75 percent: Federal Reserve H.15 Selected Interest
 *     Rates release of 4 September 2026, which posts that rate for every
 *     business day from 28 August to 3 September 2026.
 *   - US B2B credit and payment behaviour: Atradius Payment Practices Barometer,
 *     survey results for the US, 2025, published 17 September 2025, survey run
 *     between the end of Q2 and mid Q3 2025. Read 5 September 2026.
 *   - Stripe US settlement timing of 2 business days: docs.stripe.com/payouts,
 *     read 5 September 2026.
 */

const NOT_ADVICE =
  "This is arithmetic on the figures you entered, not financial advice and not an accounting opinion. Your ledger, your aged receivables report and your bank line agreement are the authority on what you actually hold and what it actually costs.";

export const CASH_CONVERSION_CYCLE_TOOL: ToolDef = {
  slug: "cash-conversion-cycle-calculator",
  name: "Cash Conversion Cycle and DSO Calculator",
  h1: "Cash conversion cycle calculator: DSO, DIO and DPO in days and dollars",
  title: "Cash conversion cycle calculator with DSO in dollars",
  description:
    "Calculate your cash conversion cycle and DSO on both balance conventions, run a countback DSO for seasonal sales, and see what one day is worth in dollars.",
  intro:
    "Your cash conversion cycle is DSO plus DIO minus DPO, and on the figures loaded below it is 55.3 days. That is where every other page stops. One day of that cycle is a specific amount of money: at $2.4 million of credit sales a day of DSO is $6,575, so collecting five days sooner releases $32,877 of cash you have already earned. This Cash Conversion Cycle and DSO Calculator computes both balance conventions, runs a countback DSO for seasonal sales, and prices the days in dollars at your own borrowing rate.",
  tier: 2,
  summary:
    "DSO, DIO, DPO and the cash conversion cycle on both conventions, plus a countback DSO and what each day is worth in cash.",
  widget: "cash-cycle",
  workedExample: {
    scenario:
      "Cascade Valve Supply is a US industrial wholesaler. Over a 365 day year it made $2,400,000 of credit sales at a cost of goods sold of $1,440,000, a 40 percent gross margin. Receivables opened at $260,000 and closed at $300,000. Inventory opened at $220,000 and closed at $240,000. Payables opened at $170,000 and closed at $190,000. It funds the gap on a bank line at 6.75 percent, the bank prime loan rate posted in the Federal Reserve H.15 release of 4 September 2026. Sixty percent of revenue arrives by card, settling five days after the sale, and the invoiced forty percent takes 45 days to collect, which is the average US B2B payment term reported in the Atradius Payment Practices Barometer for the US, 2025.",
    result:
      "Average receivables are (260,000 + 300,000) / 2 = $280,000, so DSO is 280,000 / 2,400,000 x 365 = 42.6 days. Average inventory is $230,000, so DIO is 230,000 / 1,440,000 x 365 = 58.3 days. Average payables are $180,000, so DPO is 180,000 / 1,440,000 x 365 = 45.6 days. The cash conversion cycle is 42.6 + 58.3 - 45.6 = 55.3 days. Now switch to ending balances and change nothing else: 45.6 + 60.8 - 48.2 = 58.3 days. Same year, same statements, 3.0 days apart. The cycle ties up 280,000 + 230,000 - 180,000 = $330,000 of working capital, which costs $22,275 a year to fund at 6.75 percent, or $61.03 every day. Now put the days into dollars on the right denominators. A day of DSO is a day of credit sales, 2,400,000 / 365 = $6,575.34. A day of DIO or DPO is a day of cost of goods sold, 1,440,000 / 365 = $3,945.21. Collect five days sooner and $32,876.71 comes back. Hold five days less stock and $19,726.03 comes back. Pay suppliers five days later and another $19,726.03 comes back. All three together release $72,328.77 and save $4,882.19 a year of interest. Now the payments half, which no other calculator prices. Card revenue is $1,440,000, or $3,945.21 a day. Moving from a five day payout to the two business days Stripe publishes for US accounts hands back three days of card revenue: $11,835.62, once, permanently, worth $798.90 a year at 6.75 percent. Terms and payouts together imply a DSO of 0.6 x 5 + 0.4 x 45 = 21.0 days, but the balance sheet says 42.6, so 21.6 days, about $141,918, is collections performance rather than terms. Change one input and nothing else: set a rolling reserve of 10 percent released after 180 days, and that reserve alone holds 0.10 x 180 = 18 days of card revenue, $71,013.70, which is six times what the faster payout was worth.",
  },
  sections: [
    {
      heading: "How the cash conversion cycle calculator computes DSO, DIO and DPO",
      body: [
        "Three ratios and one subtraction. Days sales outstanding is receivables divided by credit sales, times days in the period: DSO = (AR / credit sales) x days. Days inventory outstanding is inventory divided by cost of goods sold, times days. Days payable outstanding is payables divided by cost of goods sold, times days. The cash conversion cycle is DSO plus DIO minus DPO. Every term comes off your own statements except the day count: 365 for a year, 91 or 92 for a quarter, 30 or 31 for a month.",
        "Read the subtraction literally and the cycle stops being an abstraction. DSO is how long a sale sits as somebody else's promise. DIO is how long your money sits on a shelf. DPO is how long your suppliers finance you for free. The cycle is the days between paying for something and being paid for it, which is the number of days you have to fund yourself. It can be negative, and that means suppliers fund your working capital entirely.",
        "Two denominators are where published numbers go wrong. The first is credit sales, not total revenue: a business taking half its money at the till has no receivable for that half, so total revenue underneath a receivables balance divides a partial numerator by a whole one and roughly halves the reported DSO. The second is cost of goods sold, not revenue, for both inventory and payables. Inventory is carried at cost, so measuring it against a revenue flow understates the days by your gross margin.",
        "The Cash Conversion Cycle and DSO Calculator also returns a second DPO measured against purchases, because payables arise from what you bought rather than what you sold. Purchases equal cost of goods sold plus closing inventory minus opening inventory, $1,460,000 in the worked example, and DPO drops from 45.6 days to 45.0. The two diverge as fast as inventory moves, so a page reporting DIO honestly and DPO on cost of sales double counts an inventory build.",
      ],
    },
    {
      heading: "Average balance against ending balance, and why the answer moves",
      body: [
        "DSO, DIO, DPO and the cash conversion cycle are analyst ratios, not accounting measures. No US accounting standard defines any of them, which is why two competent people can compute different numbers from the same audited statements and both be right. The largest source of disagreement is which balance goes on top, and it is a real fork rather than a rounding preference.",
        "Underneath it is a units mismatch: a balance sheet number is a stock measured at one instant, while sales and cost are flows across a whole period. Averaging the opening and closing balance at least approximates the window the flow covers, which is why analysts building a series average. The ending balance is a snapshot, so a large shipment on 31 December lands in the ratio at full weight. Its virtue is reproducibility from one statement, which is why lenders and screening tools use it.",
        "The gap is not a rounding error and it has no fixed sign. Take the trade receivables and net sales the US Census Bureau publishes for all US manufacturing corporations and run both conventions quarter by quarter. In the fourth quarter of 2025 they agree to within a tenth of a day. In the first quarter of 2026 they are 1.61 days apart and the ending balance reads worse. On this page's defaults, a business whose balance sheet grew all year, the spread is 3.04 days.",
        "The rule that follows is unglamorous and load bearing. Pick one convention, write down which one, and never compare a number computed one way against one computed the other. That includes your own DSO against a benchmark, a covenant, or last year: a series that quietly switched convention has an inflection nothing in the business caused. This calculator computes both and prints the spread, so the choice is visible instead of buried.",
      ],
    },
    {
      heading: "Countback DSO, the version that survives a seasonal year",
      body: [
        "The simple DSO formula contains an assumption nobody states: that sales were roughly level across the period. It divides a receivables balance by an average daily sales rate, and an average only describes a flat line fairly. Give it a seasonal business, or one growing at forty percent, and it is not slightly wrong. It is wrong in a predictable direction.",
        "When sales are falling into the period end, the balance was built by big months and the formula divides it by a small average, so DSO reads longer than it is. When sales are rising, the balance is mostly recent and the average is large, so DSO reads shorter. That second direction is the dangerous one: a growing business is told its collections are improving at precisely the moment its receivables are growing fastest, and receivables growth is the most common way a profitable company runs out of cash.",
        "Countback DSO, sometimes called the exhaustion method, averages nothing. It walks backwards from the most recent month, retiring the balance against actual sales: whole months while the balance exceeds them, then a pro rata slice of the month where it runs out. On the months loaded into the Seasonal DSO tab, a $300,000 balance consumes the most recent month's $120,000 whole, 31 days, then 180,000 / 200,000 of the prior month, 27.9 of its 31 days. That is 58.9 days against the simple formula's 47.59, a gap of 11.31 days worth about $71,326.",
        "Two failure modes are worth naming because neither throws an error. Month order is load bearing: entered oldest first, the method retires the balance against the wrong sales and returns a confident wrong number. And a balance that outruns every month supplied cannot be counted back, only extrapolated, which usually means long dated receivables a ratio was never going to explain. The Cash Conversion Cycle and DSO Calculator says so rather than printing the extrapolation as a measurement.",
      ],
    },
    {
      heading: "Settlement time is inside DSO, and a rolling reserve is a lot of it",
      body: [
        "A card sale is not cash on the day it clears. It is a receivable from your processor until the payout lands, so your payout schedule sits inside DSO the way invoice terms do. Almost nothing written about the cash conversion cycle acknowledges this: the finance literature was written for businesses that invoice, and the payments literature is about fees. For a merchant taking most of its money by card, the processor is the largest customer on the receivables ledger and nobody has aged it.",
        "The arithmetic is simple and the amounts are not. At steady state you always wait on one payout cycle of card revenue. Stripe publishes a US settlement timing of two business days; a merchant on a five day hold who moves to that is not saving a fee, they are handing back three days of card revenue, once and permanently. On $1,440,000 of annual card volume that is $11,835.62 of cash and $798.90 a year of interest at 6.75 percent.",
        "A rolling reserve is the far bigger lever and is almost never modelled. A reserve of r percent released after h days holds r multiplied by h days of card revenue at steady state. Ten percent held for 180 days is eighteen days of card revenue in someone else's account, $71,013.70 on the same volume, six times what the faster payout was worth. A merchant negotiating high risk terms should spend their leverage on the reserve percentage and hold period before the rate.",
        "The last piece is the channel mix. Sixty percent by card at five days and forty percent invoiced at 45 days blends to a DSO of 21.0 days, the floor your terms and processor imply, not a measurement. Where the balance sheet says more, the difference is collections performance: invoices past terms, disputes, work delivered but not billed. In the worked example that is 21.6 days and about $141,918, usually the cheapest part of the cycle to fix, needing no supplier concession and no capital.",
      ],
    },
    {
      heading: "Turning days into dollars, and when the answer means do nothing",
      body: [
        "The translation from days to dollars is where this page earns its place, and it has one trap. A day of DSO is worth a day of credit sales. A day of DIO or DPO is worth a day of cost of goods sold, which at any positive gross margin is smaller. Valuing all three at revenue overstates an inventory or payables improvement by exactly the gross margin, throws no error, and reads perfectly well. Here it would inflate a five day inventory saving from $19,726 to $32,877.",
        "The financing cost is what makes days actionable. Working capital in the cycle is receivables plus inventory less payables, $330,000 in the worked example, and carrying it a year at the 6.75 percent bank prime loan rate posted in the Federal Reserve H.15 release of 4 September 2026 costs $22,275, or $61.03 a day. That is the price of a day of delay, and the number to set beside whatever the fix costs. If a lockbox or a faster processor costs less than the interest it saves, the case is closed.",
        "For context rather than as a target: aggregate DSO for all US manufacturing corporations, computed from the Census Bureau Quarterly Financial Report for 2026 Quarter 1, sat between 45.5 and 48.6 days on ending balances across five quarters, and manufacturers with assets under $50 million came in at 44.0 days. The Atradius Payment Practices Barometer for the US in 2025 reports average terms of 45 days from invoicing, 43 percent of B2B invoice value overdue and 5 percent written off. Together those say a DSO near your stated terms is normal and one twenty days above them is a collections problem. Any tighter band is this page's reasoning, not a published standard.",
        "Finally, the cases where the correct action is nothing. Stretching DPO is the only lever taking its money from someone else, and it is not free: pushing past terms costs supplier goodwill, priority during a shortage, and often an early payment discount worth more than the interest. Cutting DIO below what service levels need buys working capital with stockouts. And if your cycle already sits close to what your terms and settlement schedule imply, there is no gap left to close.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Days sales outstanding for US manufacturing corporations, on both balance conventions. The dollar figures are sourced: net sales and trade accounts and trade notes receivable, all total asset sizes unless stated, from Tables 1.0 and 1.1 of the US Census Bureau Quarterly Financial Report, 2026 Quarter 1, read 5 September 2026. The day counts are arithmetic done on this page, because the QFR publishes balances and sales but no ratio. The QFR carries no cost of goods sold line, so DIO and DPO cannot be computed from it and are deliberately absent rather than estimated.",
    columns: ["Net sales ($m)", "Trade receivables ($m)", "DSO, ending", "DSO, average", "Gap"],
    rows: [
      {
        label: "1Q 2025",
        note: "90 days. No prior quarter balance appears in this release, so the average convention cannot be computed.",
        values: ["1,906,754", "993,135", "46.88", "n/a", "n/a"],
      },
      {
        label: "2Q 2025",
        note: "91 days",
        values: ["2,034,630", "1,018,002", "45.53", "44.97", "+0.56"],
      },
      {
        label: "3Q 2025",
        note: "92 days",
        values: ["2,057,270", "1,037,405", "46.39", "45.96", "+0.43"],
      },
      {
        label: "4Q 2025",
        note: "92 days. The two conventions agree to a tenth of a day here, which they do not always do.",
        values: ["2,081,800", "1,033,390", "45.67", "45.76", "-0.09"],
      },
      {
        label: "1Q 2026",
        note: "90 days. Receivables grew faster than sales, so the ending balance reads 1.61 days worse.",
        values: ["2,048,251", "1,106,744", "48.63", "47.02", "+1.61"],
      },
      {
        label: "1Q 2026, assets under $50m",
        note: "90 days. Smaller manufacturers collect faster than the aggregate.",
        values: ["94,952", "46,435", "44.01", "44.47", "-0.46"],
      },
    ],
  },
  assumptions: [
    "Every day count and dollar figure in the intro, the worked example and the FAQs is computed by the module at lib/calc/cash-cycle.ts from the inputs shown in the widget, and was read off a run of that module on 5 September 2026. Nothing on this page is a hand written number, and the site's test suite re-derives each figure from the raw formulas independently so the copy and the widget cannot drift apart. Money is computed in integer cents and rounded half up; day counts are kept as floats and only rounded for display, because rounding a ratio before multiplying it by a daily dollar rate moves the dollars.",
    "DSO, DIO, DPO and the cash conversion cycle are analyst ratios rather than accounting measures. No US accounting standard defines them, so a figure computed here will not necessarily match one computed by your lender, your board pack or a screening tool. Where they differ, the cause is almost always the balance convention, credit sales against total revenue, or cost of goods sold against purchases. All three are visible inputs here for that reason.",
    "The default borrowing rate is the bank prime loan rate of 6.75 percent, from the Federal Reserve H.15 Selected Interest Rates release of 4 September 2026, which posts that rate for every business day from 28 August to 3 September 2026. It is a starting point, not your rate. Enter your own line of credit rate. The financing figure is simple interest on the drawn balance rather than compounded, because that is how a revolving line accrues.",
    "The 45 day default for collecting an invoice is the average US B2B payment term from invoicing reported in the Atradius Payment Practices Barometer, survey results for the US, 2025, published 17 September 2025 from a survey run between the end of Q2 and mid Q3 2025, read 5 September 2026. The same report puts 43 percent of the value of B2B invoices overdue and 5 percent written off as bad debt, and finds nearly half of US B2B sales are made on credit.",
    "The benchmark table is arithmetic performed on this page over sourced dollar figures from the US Census Bureau Quarterly Financial Report, 2026 Quarter 1, Tables 1.0 and 1.1, read 5 September 2026. It is not a published DSO series and the Census Bureau does not endorse it. The QFR publishes no cost of goods sold line, so no DIO, DPO or cash conversion cycle benchmark is offered here rather than one being estimated off an unrelated expense line.",
    "Settlement figures treat payout days as calendar days from the sale to cleared funds. Most US processors quote BUSINESS days, which is longer in practice because weekends and Federal Reserve holidays do not settle. Stripe's published US settlement timing of two business days was read from docs.stripe.com/payouts on 5 September 2026. Use the payout date calculator on this site for a real date, and note that a rolling reserve moves the cycle far more than a payout schedule does.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "How do you calculate the cash conversion cycle?",
      answer:
        "Cash conversion cycle equals DSO plus DIO minus DPO. DSO is receivables divided by credit sales, times days in the period. DIO is inventory divided by cost of goods sold, times days. DPO is payables divided by cost of goods sold, times days. On the figures loaded above that is 42.6 plus 58.3 minus 45.6, which is 55.3 days. A negative result is valid and means your suppliers fund the business.",
    },
    {
      question: "What is a good DSO?",
      answer:
        "Close to your stated terms. The Atradius Payment Practices Barometer puts average US B2B payment terms at 45 days from invoicing in its 2025 US report, and aggregate DSO for US manufacturing corporations computed from the Census Bureau Quarterly Financial Report for 2026 Quarter 1 ran between 45.5 and 48.6 days on ending balances across five quarters. A DSO within a few days of your terms is normal. Twenty days above them is a collections problem, not a terms problem.",
    },
    {
      question: "Should I use average or ending balances for DSO?",
      answer:
        "Either, but say which. Averaging opening and closing balances matches a stock to a flow more honestly; the ending balance is reproducible from one published statement, which is why lenders use it. They disagree by 3.04 days on the default figures here and by 1.61 days on US manufacturing aggregates in the first quarter of 2026. Never compare a number computed one way against a number computed the other.",
    },
    {
      question: "How much is one day of DSO worth?",
      answer:
        "One day of credit sales. At $2,400,000 of annual credit sales that is $6,575.34, so cutting five days off DSO releases $32,876.71 of cash you have already earned. Be careful with the other two: a day of DIO or DPO is worth a day of cost of goods sold, $3,945.21 on the same figures. Valuing inventory or payables days at revenue overstates the saving by your whole gross margin.",
    },
    {
      question: "What is countback DSO and when do I need it?",
      answer:
        "Countback DSO retires the receivables balance against actual recent sales month by month, newest first, instead of dividing by an average. Use it whenever sales are seasonal or growing fast, because the simple formula then reads short. On the seasonal months loaded above, countback gives 58.9 days against the simple formula's 47.59, an 11.31 day error worth roughly $71,326 in the flattering direction.",
    },
    {
      question: "Does payment processing affect days sales outstanding?",
      answer:
        "Yes, directly. A card sale is a receivable from your processor until the payout lands. Moving from a five day hold to the two business days Stripe publishes for US accounts returns three days of card revenue, $11,835.62 on $1,440,000 of card volume. A rolling reserve matters far more: ten percent held 180 days holds eighteen days of card revenue, $71,013.70 on the same volume, permanently.",
    },
  ],
  related: [
    "payout-date-calculator",
    "rolling-reserve-calculator",
    "early-payment-discount-calculator",
    "invoice-factoring-calculator",
    "break-even-and-margin-calculator",
  ],
  links: [
    { label: "Payout time, explained", href: "/glossary/payout-time" },
    { label: "Settlement, explained", href: "/glossary/settlement" },
    { label: "Rolling reserve, explained", href: "/glossary/rolling-reserve" },
    { label: "Processors with invoicing built in", href: "/payment-processors/with-invoicing" },
    { label: "ACH payment processors", href: "/payment-processors/ach" },
    { label: "Processors for small business", href: "/category/small-business" },
  ],
  cta: {
    heading: "The fastest days to remove are the ones your processor is holding",
    body: "Collections take months to fix and suppliers have to agree to longer terms. A payout schedule and a rolling reserve are contract terms, and changing them releases cash once and permanently. Tell us your volume and risk profile and we will shortlist processors that settle faster and hold less.",
    label: "Get matched",
  },
};
