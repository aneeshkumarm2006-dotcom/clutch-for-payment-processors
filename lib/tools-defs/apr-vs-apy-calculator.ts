import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/apr-vs-apy-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on the APR and APY
 * pair: "apr vs apy", "apr to apy calculator", "apy to apr", "convert apr to
 * apy". The informational sibling ("what is APY") is answered in prose on this
 * page because the same searcher asks both in the same session, but the
 * definitional query itself belongs to the glossary, not here.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Three things, all checkable.
 *
 *   1. Almost every APR to APY tool converts in ONE direction. A saver holding a
 *      bank's advertised APY, which is the number Regulation DD requires the bank
 *      to lead with, cannot get back to the nominal rate they need to model a
 *      month. This page converts both ways and also restates a nominal rate from
 *      one compounding schedule onto another.
 *   2. They offer four frequencies. Semimonthly and biweekly are different
 *      numbers, payroll advances and some business lines of credit use one or
 *      the other, and continuous is the only way to show how much of the ceiling
 *      a schedule captures. This page carries nine.
 *   3. They print a percentage and stop. 24.99 against 28.379 reads as a
 *      rounding argument until you put it on a balance, at which point it is
 *      $338.87 a year on $10,000. Every screen here prints the dollars beside the
 *      points.
 *
 * WHERE THE NUMBERS CAME FROM.
 *
 *   - The APY formula and its published worked example: Appendix A to 12 CFR
 *     Part 1030 (Regulation DD), and the definitions in 12 CFR 1030.2, read from
 *     consumerfinance.gov on 5 September 2026. The regulation's own example,
 *     $30.37 of interest on $1,000 over 182 days giving 6.18 percent, is
 *     reproduced by `lib/calc/apr-apy.ts` in the test file.
 *   - The APR side: 12 CFR 1026.14(a) and (b), 12 CFR 1026.4(a) and 12 CFR
 *     1026.6(b)(4)(i) (Regulation Z), same source and date.
 *   - Card rate levels: Federal Reserve G.19 Consumer Credit release of 7 August
 *     2026, credit card plan rates for 2026 Q2.
 *   - Deposit rate levels: FDIC national rates effective 17 August 2026.
 *   - Every percentage and dollar figure in the worked example, the rate table
 *     and the FAQ answers is computed by `lib/calc/apr-apy.ts` and was read off a
 *     run of that module, not written by hand. The rate table caption says so.
 */

const NOT_ADVICE =
  "This is arithmetic on the figures you entered, not financial advice and not an offer. Your account agreement or loan note is the authority on what you will actually earn or owe.";

export const APR_VS_APY_TOOL: ToolDef = {
  slug: "apr-vs-apy-calculator",
  name: "APR vs APY Converter",
  h1: "APR vs APY converter",
  title: "APR vs APY Converter: Convert Rates & Compare Interest",
  description:
    "Convert APR to APY or APY to APR with different compounding schedules. Compare effective rates and see the dollar impact of compounding on your balance.",
  intro:
    "APR vs APY is a compounding question. APR is a nominal annual rate that ignores compounding inside the year, and APY is the effective annual yield with the compounding counted, which is why Regulation DD makes US banks advertise it. The gap is real money: 24.99 percent APR compounded daily is an APY of 28.379 percent, so a $10,000 balance costs $2,837.87 of interest in a year rather than $2,499.00. The APR vs APY Converter runs the conversion in both directions, across nine compounding schedules from annual to continuous, and prints the dollar difference beside the percentage one.",
  tier: 3,
  summary:
    "Convert APR to APY and back across nine compounding schedules, with the dollar gap on your own balance.",
  widget: "apr-apy",
  workedExample: {
    scenario:
      "Ridgeline Supply, a Denver wholesaler, is carrying $10,000 on a business card quoted at 24.99 percent APR, and the cardholder agreement says interest is compounded daily. The same bank is separately advertising a business money market account at 4.50 percent APY, compounded monthly. Ridgeline wants both numbers on the same footing, which is the pass the APR vs APY Converter makes.",
    result:
      "Take the card first. A 24.99 percent APR compounded daily is a periodic rate of 24.99 divided by 365, which is 0.068466 percent a day. Compound that across the year and the effective annual yield is (1 + 0.2499 / 365) raised to the power 365, minus 1, which is 28.379 percent. On $10,000 held for a full year that is $2,837.87 of interest at the APY against $2,499.00 at the nominal rate, so compounding alone adds $338.87. Change nothing but the schedule and the answer moves: the same 24.99 percent compounded monthly is 28.061 percent and $2,806.06, and compounded once a year it is exactly 24.99 percent and $2,499.00, because annual compounding is the one case where an APR and an APY are the same number. Restated the other way, 24.99 percent compounded daily and 25.243 percent compounded monthly are the identical deal. Now the deposit, which runs the conversion backwards. A 4.50 percent APY compounded monthly is a nominal 4.410 percent APR, a periodic rate of 0.367481 percent a month, and $10,000 earns $450.00 over the year of which $9.02 is the compounding. Put the two beside each other and the point lands: the same arithmetic costs Ridgeline $338.87 a year on the card and pays them $9.02 on the account. The mechanism is identical. Only the rate and the direction of the money differ.",
  },
  sections: [
    {
      heading: "APR vs APY: what the two numbers actually measure",
      body: [
        "An APR is a nominal annual rate: a per period rate multiplied up to a year, containing no compounding within that year by construction. An APY is an effective annual yield, the total interest a balance earns or costs across 365 days once the interest already credited starts earning too. Regulation DD is explicit about the split. At 12 CFR 1030.2 it defines the annual percentage yield as a percentage rate reflecting the total amount of interest paid on an account, based on the interest rate and the frequency of compounding for a 365 day period, and the interest rate as the annual rate of interest paid on an account which does not reflect compounding.",
        "That has a consequence people miss: a rate with no compounding schedule attached is not yet a number. Twelve percent means one thing compounded annually and another compounded daily, and only the frequency turns a nominal rate into a quantity two offers can be compared on. That is why the APR vs APY Converter asks for the schedule before it will answer.",
        "US law decides which number goes on the poster. Regulation DD at 12 CFR 1030.8(b) says that if an advertisement states a rate of return, it shall state the rate as an annual percentage yield using that term, and that the interest rate may be stated in conjunction with, but not more conspicuously than, the annual percentage yield to which it relates. A US bank advertisement therefore leads with the APY by law, while a card or a loan leads with the APR. The two sides of your balance sheet are quoted in different units and nobody converts them for you.",
        "Annual compounding is the only case where the two agree, and it agrees exactly: the periodic rate is the annual rate, nothing is credited part way through the year for the balance to earn on, and the APR and APY match to every decimal place. Every other schedule pushes the APY above the APR, and the gap widens with both the rate and the frequency.",
      ],
    },
    {
      heading: "The two formulas, and how to reproduce them by hand",
      body: [
        "APR to APY, the formula is APY = (1 + r / n) raised to the power n, minus 1, where r is the nominal annual rate as a decimal and n is the number of compounding periods in a year. At 24.99 percent compounded daily, r is 0.2499, n is 365, the periodic rate r / n is 0.00068466, and the result is 28.379 percent. Continuous compounding has no n to divide by, so the formula becomes e to the power r, minus 1, which is 28.390 percent. That is the ceiling: no schedule beats it, and daily captures 99.96 percent of it.",
        "The other way, from an advertised APY back to the nominal rate, it inverts to APR = n multiplied by ((1 + APY) raised to the power 1 / n, minus 1). A 4.50 percent APY compounded monthly is 12 multiplied by (1.045 to the power one twelfth, minus 1), which is 4.410 percent. This is the direction a saver needs and the one most calculators skip: you want it to model a single month, reconcile a statement line, or compare an advertised yield against a note quoted nominally.",
        "A third formula is worth knowing because the regulation publishes it. Appendix A to 12 CFR Part 1030 gives APY as 100 multiplied by ((1 + Interest / Principal) raised to the power 365 divided by days in term, minus 1). Principal is the amount assumed deposited at the beginning of the account, Interest is the total dollar interest earned on it for the term, and days in term is the actual number of days. The appendix works it through: $30.37 of interest on a $1,000 principal over 182 days is an annual percentage yield of 6.18 percent. That version starts from dollars rather than a rate, and this page's test suite reproduces its 6.18 percent exactly.",
        "One warning about doing this in a spreadsheet. Both formulas end by subtracting 1 from a number very close to 1, and at low rates with daily compounding that subtraction quietly destroys about four significant digits. This page uses the exponential and logarithm forms that never build the intermediate value, which is why converting a rate and converting it back returns what you typed.",
      ],
    },
    {
      heading: "Why a card quoted at 24.99 percent APR costs more than 24.99 percent",
      body: [
        "Regulation Z defines the APR at 12 CFR 1026.14(a) as a measure of the cost of credit, expressed as a yearly rate. For open end credit, which is what a credit card is, 12 CFR 1026.14(b) says the annual percentage rate to be disclosed shall be computed by multiplying each periodic rate by the number of periods in a year. That is a nominal calculation by design, and it is why 12 CFR 1026.6(b)(4)(i) requires the rate to be disclosed as a periodic rate and a corresponding annual percentage rate: the same fact stated twice, once per period and once per year, with no compounding in between.",
        "Meanwhile the card compounds. A statement quoting a daily periodic rate is telling you that unpaid interest joins the balance every day and accrues interest of its own from the next. The disclosed 24.99 percent and the 28.379 percent you accrue over a year of revolving are both correct; they answer different questions, and nothing on the statement performs the second one for you.",
        "This matters at real rate levels. The Federal Reserve's G.19 release of 7 August 2026 puts the average rate on credit card plans at 20.94 percent for all accounts in the second quarter of 2026 and 22.15 percent on accounts assessed interest. Compounded daily those are 23.286 percent and 24.786 percent, so a cardholder revolving a balance pays roughly 2.3 to 2.6 percentage points a year more than the agreement says.",
        "One asymmetry cuts the other way. On a closed end loan the Regulation Z APR is not a bare rate at all: 12 CFR 1026.4(a) defines the finance charge as the cost of consumer credit as a dollar amount, any charge imposed by the creditor as an incident to or a condition of the extension of credit, with points and loan fees among the listed examples. A loan APR therefore sits above the note rate because it swallows origination fees, while a card APR sits below the true annual cost because it ignores compounding. This page converts rates and does not model fees, so enter a loan APR as the rate it already is.",
      ],
    },
    {
      heading: "What the dollar gap is worth, and when the right answer is do nothing",
      body: [
        "The percentage gap is why this gets ignored and the dollar gap is why it should not be. At 4.50 percent on $10,000 the whole spread between annual and daily compounding is $10.25 over a year. At 24.99 percent on the same balance it is $338.87. The gap grows roughly with the square of the rate, so compounding frequency matters in proportion to how expensive the money already is.",
        "So chasing a compounding schedule is almost always the wrong move on the deposit side. At the FDIC national average savings rate of 0.38 percent, effective 17 August 2026, the difference between the two ways of stating that rate is about seven cents a year on $10,000. Moving to the 0.63 percent money market average on the same date is worth about $25, roughly 350 times more. If you came here to choose between daily and monthly compounding on a business savings account, the honest answer is that it does not matter.",
        "On the borrowing side the same arithmetic argues the opposite way, because the balance is larger and the rate several times higher. On a $25,000 revolving balance at 22.15 percent compounded daily, compounding alone is worth $659.09 a year. Know it before you compare a card against a term loan quoted nominally: lining up two APRs without restating them on one schedule flatters whichever one compounds more often.",
        "That is what the restate mode in the APR vs APY Converter is for. It takes a nominal rate on one schedule and finds the nominal rate on another that pays out exactly the same: 24.99 percent compounded daily, for instance, restates to 25.243 percent compounded monthly. If both offers already carry an APY, no conversion is needed. Compare the APYs and stop.",
      ],
    },
    {
      heading: "A factor rate is neither an APR nor an APY",
      body: [
        "This is a payments site, so the commonest misuse of this page is worth stating plainly. A merchant cash advance is priced with a factor rate, a flat multiplier with no time in it: a 1.30 factor on $50,000 means you repay $65,000, and that $15,000 charge is the same whether repayment takes six months or eighteen. There is no periodic rate to compound and no schedule to convert, so typing 1.30, or 30, into the APR vs APY Converter returns a number that is arithmetically valid and financially meaningless.",
        "The missing variable is the one that decides the price. Because the charge is fixed at signing, the annualized cost depends entirely on how fast the money comes back. The same 1.30 factor on $50,000 is roughly 111 percent APR when a 10 percent holdback clears it in about 137 banking days, and roughly 37 percent when the same $65,000 is stretched over eighteen months. One factor rate, two completely different prices, and nothing on the term sheet says which one you signed.",
        "The right tool is the merchant cash advance calculator, which solves for the rate that makes the cash you actually received equal the stream of daily payments, the way the actuarial method in Appendix J to 12 CFR Part 1026 does. Once it gives you an APR you can bring that back here for the APY. The same warning already sits on this site's compound interest and simple interest calculators, for the same reason.",
        "Two other payments figures do not belong here either. A processing effective rate is a fee on a transaction, not a rate on a balance over time, so there is nothing to annualize; use the effective rate calculator. A rolling reserve does sit idle earning nothing under almost every US merchant agreement, but its real cost is having less cash on hand, not the forgone interest.",
      ],
    },
  ],
  rateTable: {
    caption:
      "The same nominal rate as an APY on five compounding schedules, computed by this page rather than sourced. Every cell is (1 + r / n) to the power n, minus 1, with the continuous column being e to the power r, minus 1. The note beside each row is the extra interest daily compounding earns over annual compounding on a $10,000 balance across one year, in dollars, which is the figure the percentage columns hide.",
    columns: ["Annually", "Quarterly", "Monthly", "Daily", "Continuously"],
    rows: [
      {
        label: "4.50% nominal",
        note: "Daily beats annual by $10.25 a year on $10,000",
        values: ["4.500%", "4.577%", "4.594%", "4.602%", "4.603%"],
      },
      {
        label: "8.00% nominal",
        note: "Daily beats annual by $32.78 a year on $10,000",
        values: ["8.000%", "8.243%", "8.300%", "8.328%", "8.329%"],
      },
      {
        label: "12.00% nominal",
        note: "Daily beats annual by $74.75 a year on $10,000",
        values: ["12.000%", "12.551%", "12.683%", "12.747%", "12.750%"],
      },
      {
        label: "18.00% nominal",
        note: "Daily beats annual by $171.64 a year on $10,000",
        values: ["18.000%", "19.252%", "19.562%", "19.716%", "19.722%"],
      },
      {
        label: "24.99% nominal",
        note: "Daily beats annual by $338.87 a year on $10,000",
        values: ["24.990%", "27.431%", "28.061%", "28.379%", "28.390%"],
      },
    ],
  },
  assumptions: [
    "The APY definition and formula are Regulation DD: 12 CFR 1030.2(c) and (o) for the definitions, 12 CFR 1030.8(b) for the advertising rule, and Appendix A to 12 CFR Part 1030 for the formula and its worked example. All read from the CFPB's published regulation text at consumerfinance.gov on 5 September 2026. The appendix's own example, $30.37 of interest on a $1,000 principal over a 182 day term giving an annual percentage yield of 6.18 percent, is asserted in this site's test suite.",
    "The APR definition is Regulation Z: 12 CFR 1026.14(a) and (b) for the open end computation, 12 CFR 1026.6(b)(4)(i) for the periodic rate disclosure, and 12 CFR 1026.4(a) and (b) for the finance charge. Same source and same date. Regulation Z applies to consumer credit, so a business card or a commercial loan is generally outside it and your issuer may quote on a different basis. Check the agreement.",
    "The card rate levels quoted in the copy are the Federal Reserve's G.19 Consumer Credit release of 7 August 2026, which reports 20.94 percent on all credit card accounts and 22.15 percent on accounts assessed interest for the second quarter of 2026. The deposit rate levels are the FDIC national rates effective 17 August 2026: savings 0.38 percent, money market 0.63 percent, twelve month CD 1.71 percent. Both were read on 5 September 2026 and both move.",
    "Every percentage and dollar figure in the widget, the worked example and the rate table is computed by this page from the inputs shown, not taken from a published table. A year is 365 days throughout, which is what Regulation DD's formula uses. Leap years, day count conventions such as Actual/360, and any grace period on a card are not modeled.",
    "The conversion assumes the rate and the balance both hold still for the whole term. No payments, deposits, withdrawals, fees, taxes, inflation, minimum payments or promotional periods are modeled. On a real credit card balance that is a simplification in your favour if you are paying it down and against you if you are not.",
    "A Regulation Z APR on a closed end loan already includes prepaid finance charges such as points and origination fees, so it is above the note rate before this page touches it. This tool converts a rate between compounding schedules. It does not add or remove fees, so enter a loan APR as the rate it already is rather than trying to rebuild it here.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "What is the difference between APR and APY?",
      answer:
        "APR is a nominal annual rate that ignores compounding within the year. APY is the effective annual yield with compounding included. Regulation DD defines the APY as reflecting the total interest paid based on the interest rate and the frequency of compounding for a 365 day period. At 24.99 percent compounded daily the APR is 24.99 percent and the APY is 28.379 percent, a difference of $338.87 a year on a $10,000 balance.",
    },
    {
      question: "How do I convert APR to APY?",
      answer:
        "Divide the APR by the number of compounding periods in a year to get the periodic rate, add 1, raise it to the power of the number of periods, then subtract 1. At 24.99 percent compounded daily that is (1 + 0.2499 / 365) to the power 365, minus 1, which is 28.379 percent. For continuous compounding the formula is e to the power of the rate, minus 1, giving 28.390 percent at the same rate.",
    },
    {
      question: "How do I convert APY to APR?",
      answer:
        "Invert the same identity: multiply the number of periods by ((1 + APY) raised to the power of one divided by the number of periods, minus 1). A 4.50 percent APY compounded monthly is 12 multiplied by (1.045 to the power one twelfth, minus 1), which is a nominal 4.410 percent, or 0.367481 percent a month. You need this direction because US banks advertise the APY and your own cash flow model needs the periodic rate.",
    },
    {
      question: "Is APY always higher than APR?",
      answer:
        "At a positive rate, yes, except at annual compounding where the two are exactly equal because there is nothing credited part way through the year to earn on. The gap grows with both the rate and the frequency. At 4.50 percent, annual to daily is worth 0.102 percentage points; at 24.99 percent it is worth 3.389 points. Continuous compounding is the ceiling, and at 24.99 percent daily compounding already captures 99.96 percent of it.",
    },
    {
      question: "Does a credit card APR include compounding?",
      answer:
        "No. Regulation Z at 12 CFR 1026.14(b) says the annual percentage rate is computed by multiplying each periodic rate by the number of periods in a year, which is a nominal calculation by definition, while the card itself compounds unpaid interest daily. Both figures are correct and they answer different questions. The Federal Reserve's G.19 average of 22.15 percent on accounts assessed interest in the second quarter of 2026 is 24.786 percent once daily compounding is counted.",
    },
    {
      question: "Can you convert a factor rate to an APR or an APY?",
      answer:
        "Not on this page. A merchant cash advance factor rate is a flat multiplier with no time in it, so there is nothing to compound and no schedule to convert. A 1.30 factor on $50,000 repays $65,000 whether that takes six months or eighteen, and the same charge is roughly 111 percent APR at one speed and roughly 37 percent at another. Use the merchant cash advance calculator, which solves for the rate implied by the actual payment stream.",
    },
  ],
  related: [
    "compound-interest-calculator",
    "simple-interest-calculator",
    "business-loan-amortization-calculator",
    "merchant-cash-advance-calculator",
    "invoice-factoring-calculator",
  ],
  links: [
    { label: "All calculators", href: "/tools" },
    { label: "Effective rate, explained", href: "/glossary/effective-rate" },
    { label: "How we research and check these numbers", href: "/methodology" },
    { label: "Payment processors for small businesses", href: "/category/small-business" },
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
  ],
  cta: {
    heading: "The rate you pay every day is the one worth converting",
    body: "Compounding on a card balance is worth a few hundred dollars a year. Your card processing rate is charged on every sale you will ever make, and on $100,000 a month of volume forty basis points is $4,800 a year. Work out what you are really paying first.",
    label: "Check your effective rate",
  },
};
