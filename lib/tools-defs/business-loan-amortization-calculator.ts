import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/business-loan-amortization-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on business borrowing:
 * "business loan amortization calculator", "loan amortization schedule", "small
 * business loan calculator", "sba loan payment calculator", "amortization
 * schedule with extra payments". It also has to answer the informational sibling
 * the same searcher types within a minute, "why is my APR higher than my
 * interest rate", because that question is what sends them looking for a
 * schedule in the first place.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. This is the most crowded query in the
 * batch and every page on it is a mortgage calculator wearing a business label.
 * Four specific, checkable failures:
 *
 *   1. THE FEES ARE MISSING. A business lender nets its origination fee out of
 *      the wire. The borrower repays the face amount and receives less than it,
 *      so the effective rate is above the note rate by construction. On this
 *      page's defaults that gap is 62 basis points; on a three year note with a
 *      3 percent fee it is 210. Almost no ranking calculator has a fee field at
 *      all, and the ones that do add the fee to the balance, which is the
 *      opposite of what happens.
 *   2. THE SCHEDULE DOES NOT LAND ON ZERO. Interest is rounded to the cent every
 *      period, so a level payment repeated n times leaves a residue. Real
 *      servicers adjust the final payment. Competing schedules print a closing
 *      balance of a few cents and hope nobody checks.
 *   3. THE SBA GUARANTY FEE IS COMPUTED ON THE WRONG BASE. SBA charges the
 *      upfront fee on the GUARANTEED PORTION, which is 75 percent of a loan over
 *      $150,000, not on the loan. Applying 3 percent to a $500,000 face amount
 *      gives $15,000 when the real fee is $11,250.
 *   4. NOBODY NAMES THE ACTUAL ALTERNATIVE. A business searching for this
 *      calculator is usually choosing between a term loan and a merchant cash
 *      advance, not between two banks. The widget translates the loan into the
 *      factor rate an advance would have to quote, then says plainly that equal
 *      dollars are not an equal price and hands the reader to the MCA tool.
 *
 * WHERE THE NUMBERS CAME FROM.
 *   - The APR method is the actuarial method of Appendix J to 12 CFR Part 1026,
 *     read on consumerfinance.gov 5 September 2026, with the amount financed
 *     defined by 1026.18(b)(3) and the tolerance by 1026.22(a).
 *   - The SBA guaranty fee tiers are SBA Information Notice 5000-872051, the
 *     FY 2026 7(a) fee schedule effective 28 August 2025, read from sba.gov
 *     5 September 2026.
 *   - Guaranty percentages, the $5,000,000 program maximum and the maximum
 *     variable spreads are sba.gov "Terms, conditions and eligibility", read
 *     5 September 2026. Maturity limits are 13 CFR 120.212.
 *   - The prime rate is 6.75 percent, Federal Reserve H.15, release dated
 *     4 September 2026.
 *   - Lender experience figures are the Federal Reserve Banks' 2026 Report on
 *     Employer Firms, published 3 March 2026 from the 2025 Small Business Credit
 *     Survey.
 *
 * Every dollar figure in the copy below was produced by `lib/calc/amortization.ts`
 * on the widget's own default inputs and is asserted in
 * `tests/tools/batch-four/business-loan-amortization-calculator.test.ts`, because
 * a hand written number that disagrees with the widget on the same page has
 * shipped on this site before and is the worst defect this section can carry.
 */

const NOT_ADVICE =
  "This is arithmetic on the figures you entered, not financial advice and not an offer. Your account agreement or loan note is the authority on what you will actually earn or owe.";

export const LOAN_AMORTIZATION_TOOL: ToolDef = {
  slug: "business-loan-amortization-calculator",
  name: "Business Loan Amortization Calculator",
  h1: "Business loan amortization calculator",
  title: "Business loan amortization calculator with fees and APR",
  description:
    "Business loan amortization calculator that nets origination and SBA guaranty fees out of the disbursement, solves the real APR, and ends the schedule on zero.",
  intro:
    "A business loan amortization calculator is only useful if it prices the fees. Borrow $250,000 at 9.25 percent over ten years and the payment is $3,200.82, but a 2 percent origination fee and $1,500 of closing costs come out of the disbursement, so $243,500 lands in the account while you repay all $250,000. The real APR is 9.87 percent, not 9.25. This Business Loan Amortization Calculator solves that rate the way Regulation Z does, builds the full schedule, and lands the final payment exactly on zero.",
  tier: 1,
  summary:
    "Payment, full schedule and the real APR once origination and SBA guaranty fees come out of the wire.",
  widget: "loan-amortization",
  workedExample: {
    scenario:
      "Cedar Line Facilities, a nine van commercial cleaning company in Columbus, borrows $250,000 over ten years at a 9.25 percent fixed note rate. The lender charges a 2 percent origination fee and $1,500 of packaging, filing and documentation costs, both netted out of the wire rather than added to the balance. Those are the calculator's default inputs, so every figure below is reproducible in the widget at the top of this page.",
    result:
      "The monthly rate is 9.25 divided by 12, which is 0.7708333 percent. Put that into P = L x i / (1 - (1+i)^-n) with L of $250,000 and n of 120 and the payment is $3,200.82. The fees are 2 percent of $250,000, which is $5,000, plus $1,500, so $6,500 comes out of the wire and the amount financed is $243,500. Payment one splits $1,927.08 of interest against $1,273.74 of principal, leaving $248,726.26, so 60.2 percent of the first payment is rent on the money. By payment 120 the interest is down to $24.48 and the last payment is $3,200.43 rather than $3,200.82, thirty nine cents lighter, because the balance has to land exactly on zero after ten years of per period cent rounding. Across the whole note the interest is $134,098.01, the total repaid is $384,098.01, and the total cost of the money is $140,598.01 once the fees are counted. Now the number the lender did not quote: solve for the monthly rate that makes $243,500 received today equal 119 payments of $3,200.82 plus one of $3,200.43, and it is 0.822783 percent. Multiply by twelve, as Appendix J requires, and the APR is 9.87 percent. The $6,500 of fees is worth 62 basis points on a ten year note. Add $250 a month of extra principal and the loan clears after 107 payments instead of 120, saving $16,736.67 of interest for $26,500 of extra principal put in.",
  },
  sections: [
    {
      heading: "How a business loan amortization calculator builds the schedule",
      body: [
        "An amortizing loan is one formula and then one loop. The formula sizes the payment: P = L x i / (1 - (1 + i) to the power of minus n), where L is the face amount of the note, i is the annual rate divided by twelve, and n is the number of monthly payments. On $250,000 at 9.25 percent over 120 months that is $3,200.82. At a zero rate the formula divides by zero, so an interest free note has to be its own case rather than trusted to the algebra.",
        "The loop produces the schedule. Each month, interest is the outstanding balance times i, rounded to the cent, and principal is whatever is left of the payment. The balance falls by that principal, so next month's interest is smaller. That explains the shape everyone notices: payment one on the default loan is 60.2 percent interest and payment 120 is 0.8 percent, without the rate ever moving. Interest is not front loaded by policy. It is front loaded because you owe more at the start.",
        "What separates a real schedule from a spreadsheet approximation is the last line. Because each month's interest is rounded to the cent independently, a level payment repeated 120 times never quite retires the balance. A servicer fixes that by adjusting the final payment, and so does the Business Loan Amortization Calculator: the last payment is $3,200.43 rather than $3,200.82, and the closing balance is zero rather than three cents. If a schedule ends on anything but zero, do not reconcile a payoff quote against it.",
        "Every figure is computed in integer cents from first line to last. That sounds pedantic until you are checking a lender's table against a payoff statement, which is the only reason anyone opens a schedule. Floating point arithmetic on dollars produces one cent disagreements at exactly that moment, and one cent is enough to make a borrower distrust the page.",
      ],
    },
    {
      heading: "Why the APR is higher than the rate on the note",
      body: [
        "There are two prices on every business loan and lenders quote the smaller one. The note rate accrues on the balance. The APR is what the money costs once you account for not having received all of it. Regulation Z defines the gap at 12 CFR 1026.18(b): the amount financed is the principal loan amount, plus any other amounts financed, minus any prepaid finance charge. Origination, packaging and SBA guaranty fees deducted at closing are prepaid finance charges, so they come off the cash and never off the balance you repay.",
        "On the default loan, $6,500 of fees turns $250,000 of face value into $243,500 of cash while the repayment schedule is unchanged, so the rate that reconciles the two sides is 9.87 percent rather than 9.25. Appendix J to 12 CFR Part 1026 sets out the solve: find the unit period rate at which the present value of the payments equals the amount financed, then multiply it by the number of unit periods in a year. Multiplied, never compounded. Section 1026.22(a) permits the actuarial method or the United States Rule method, and paragraph (a)(2) allows a regular transaction one eighth of one percentage point of tolerance.",
        "The size of the effect depends almost entirely on the term, which is the part borrowers get wrong. A fee is paid once, so a long loan spreads it over many periods and a short loan does not. Three percent of principal on a ten year note adds 72 basis points to the APR. The identical fee on a three year note adds 210. On short paper, negotiate the fee. On long paper, negotiate the rate.",
        "Regulation Z does not require any of this to be disclosed to you. Section 1026.3(a) exempts credit extended primarily for a business or commercial purpose, so no APR box is federally required on a business loan. It is the same exemption that lets merchant cash advance funders quote a factor rate with no annual rate beside it, and while a handful of states now require a commercial financing disclosure, in most of the country nobody has to tell you the number.",
      ],
    },
    {
      heading: "SBA 7(a) loans, and the fee almost every calculator computes wrong",
      body: [
        "SBA does not lend. It guarantees part of a bank loan and charges an upfront guaranty fee for doing so. The FY 2026 schedule, in SBA Information Notice 5000-872051 effective 28 August 2025, covers 7(a) loans approved between 1 October 2025 and 30 September 2026. On a maturity over twelve months it is 2 percent up to $150,000, 3 percent from $150,001 to $700,000, and 3.5 percent from $700,001 to $5,000,000 with 3.75 percent on the slice above one million. A maturity of twelve months or less is 0.25 percent, and manufacturers in NAICS sectors 31 to 33 borrowing $950,000 or less pay nothing.",
        "Here is the part that gets miscalculated everywhere. Every one of those percentages applies to the guaranteed portion, not to the loan. SBA guarantees 85 percent of a loan of $150,000 or less and 75 percent above that, so a 3 percent fee on a $500,000 loan is 3 percent of $375,000, which is $11,250 and not $15,000. On this page's default $250,000 loan the guaranteed portion is $187,500 and the fee is $5,625. A calculator that multiplies the face amount by the tier percentage overstates the fee by a third, then feeds an overstated APR.",
        "The rate side has ceilings rather than prices. On a variable rate 7(a) loan SBA caps the spread over the base rate at 6.5 points for loans of $50,000 or less, 6.0 from $50,001 to $250,000, 4.5 from $250,001 to $350,000, and 3.0 above $350,000. With the bank prime loan rate at 6.75 percent on the Federal Reserve H.15 release dated 4 September 2026, the ceiling on a $250,000 loan is 12.75 percent and above $350,000 it is 9.75 percent. Knowing where the cap sits turns a quote into a negotiation.",
        "Two structural limits belong beside the arithmetic. The 7(a) program maximum is $5 million, and 13 CFR 120.212 caps maturity at ten years unless the loan finances real estate or equipment with a useful life beyond ten years, in which case up to 25. A prime based SBA loan is variable, so the schedule the Business Loan Amortization Calculator prints is the path if the rate never moves, which it will. Re-run it at prime plus two and at prime minus one.",
      ],
    },
    {
      heading: "What an extra payment is worth, and what a balloon really is",
      body: [
        "Extra principal is the only lever a borrower controls after closing, and it is worth less than the internet implies and more than most owners assume. On the default loan, adding $250 a month clears the note after 107 payments instead of 120 and saves $16,736.67 of interest. You put in $26,500 of extra principal to get that, so the return is real but it is not free money: it is a prepayment earning the note rate, which at 9.25 percent is a good use of idle cash and a poor use of March payroll.",
        "Check the note before you start. Business term loans commonly carry a declining prepayment charge in the first two or three years, and an SBA 7(a) loan with a maturity of fifteen years or more carries a statutory prepayment charge in the first three years when you prepay more than a quarter of the balance in a single year. Check how the servicer applies unscheduled money too: if it is held as a prepaid regular payment rather than applied to principal, the extra saves you nothing at all.",
        "A balloon deserves more suspicion than it gets. The payment is sized on a long amortization, the note matures early, and the unpaid balance falls due in one lump. Take the same $250,000 at 9.25 percent, size the payment on ten years and mature it at five: the payment is still $3,200.82, but $153,296.45 is outstanding at maturity, so the final payment is $156,497.27. Sixty payments of ordinary money and then one forty nine times the size of the others.",
        "That last one is not really a payment, it is an appointment to refinance. You are agreeing today to be creditworthy in five years, at whatever rate exists then. Price the refinance the day you sign, not the quarter before it matures.",
      ],
    },
    {
      heading: "When the real choice is a term loan against a merchant cash advance",
      body: [
        "Most businesses reaching this calculator are choosing between a bank and a faster, more expensive product, usually a merchant cash advance, and the two are quoted in units that do not compare. A loan is quoted as a rate. An advance is quoted as a factor, a flat multiplier with no time in it. The default loan puts $243,500 in the account and takes back $384,098.01, which as a factor rate is 1.58.",
        "That translation is where most comparisons stop, and stopping there is the mistake. Equal dollars are not an equal price. The loan takes those dollars over ten years. An advance at a 1.58 factor with a normal holdback repays out of daily card settlement in six to nine months, so the same total charge is compressed into a fourteenth of the time and the annualized cost lands in triple digits. The factor answers how many dollars. The APR answers how expensive. Run the advance on the merchant cash advance calculator first.",
        "The benchmark that matters here is what borrowers report afterwards. In the Federal Reserve Banks' 2026 Report on Employer Firms, published 3 March 2026 from the 2025 Small Business Credit Survey, 60 percent of firms that borrowed from online lenders said the actual cost was higher than expected, against 37 percent at small banks and 32 percent at large banks. Fifty seven percent of applicants at small banks were fully approved. Slow money that gets approved is usually cheaper than fast money that always does.",
        "So when does the Business Loan Amortization Calculator tell you to act, and when does it tell you to do nothing. Act when the APR gap between two live offers beats the delay: on $250,000 over ten years, one percentage point is $16,518.55 of extra interest, worth waiting three weeks for. Act when a fee is large and the term is short, because that is where fees dominate. Do nothing when the only offer is a refinance that resets a partly amortized note to the start, since you would pay front loaded interest twice on the same principal. And price the boring option first: forty basis points off your processing rate on $100,000 a month is $4,800 a year with nothing to repay.",
      ],
    },
  ],
  rateTable: {
    caption:
      "What an origination fee is worth in APR, by term. Computed by this page from a $250,000 loan at a 9.25 percent note rate, using the actuarial method of Appendix J to 12 CFR Part 1026 with the fee deducted from the disbursement. These are not published rates and no lender quotes them: they are arithmetic you can reproduce in the calculator above.",
    columns: ["3 years", "5 years", "7 years", "10 years"],
    rows: [
      { label: "No origination fee", note: "APR equals the note rate", values: ["9.25%", "9.25%", "9.25%", "9.25%"] },
      { label: "1% origination fee", values: ["9.94%", "9.68%", "9.57%", "9.49%"] },
      { label: "2% origination fee", note: "This page's default", values: ["10.64%", "10.12%", "9.90%", "9.73%"] },
      { label: "3% origination fee", values: ["11.35%", "10.56%", "10.23%", "9.97%"] },
      { label: "5% origination fee", values: ["12.80%", "11.47%", "10.90%", "10.47%"] },
    ],
  },
  assumptions: [
    "Interest accrues monthly on the outstanding balance at the note rate divided by twelve, each period is rounded to the cent, and the final payment is adjusted so the closing balance is exactly zero. That is how a servicer builds a schedule, and it is why the last payment differs from the others.",
    "The APR is the actuarial method of Appendix J to 12 CFR Part 1026, read on consumerfinance.gov 5 September 2026: the unit period rate that equates the amount financed to the present value of the payments, multiplied by twelve. It is never compounded. The amount financed follows 12 CFR 1026.18(b), which subtracts prepaid finance charges, so origination, packaging and guaranty fees reduce the cash advanced rather than increasing the balance.",
    "Regulation Z does not apply to business purpose credit at all, by the exemption at 12 CFR 1026.3(a). The APR here is that method applied voluntarily so two offers can be compared. No lender is obliged to publish it and most will not.",
    "SBA guaranty fee tiers, the twelve month short term tier and the FY 2026 manufacturing waiver come from SBA Information Notice 5000-872051, effective 28 August 2025, read from sba.gov on 5 September 2026. It covers loans approved between 1 October 2025 and 30 September 2026 and expires 1 October 2026, so re-read the successor notice after that date. Guaranty percentages of 85 and 75 percent, the maximum variable spreads and the $5 million program maximum are from sba.gov Terms, conditions and eligibility, read 5 September 2026. Maturity limits are 13 CFR 120.212.",
    "The prime rate offered as a default is 6.75 percent, the bank prime loan rate from the Federal Reserve H.15 release dated 4 September 2026. It moves with the FOMC. A prime based SBA loan is variable, and this calculator holds the rate flat for the whole term, which is a projection and not a forecast.",
    "The lender's 0.55 percent annual service fee is excluded from every figure because SBA Information Notice 5000-872051 states lenders may not pass it on to the borrower. Late charges, extraordinary servicing fees, prepayment charges and any fee financed into the balance rather than deducted at closing are also excluded.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "How do you calculate a business loan amortization schedule?",
      answer:
        "Size the payment with P = L x i / (1 - (1+i) to the power of minus n), where L is the loan, i is the annual rate over twelve and n is the number of payments. Then loop: interest is the balance times i, principal is the rest of the payment, and the balance falls by that principal. On $250,000 at 9.25 percent over 120 months the payment is $3,200.82 and total interest is $134,098.01. Adjust the last payment so the balance closes on zero.",
    },
    {
      question: "What is the monthly payment on a $100,000 business loan?",
      answer:
        "It depends entirely on the rate and the term. At 10 percent over five years the payment is $2,124.70 and you repay $127,482.30, of which $27,482.30 is interest. Stretch the same loan to ten years and the payment falls to $1,321.51 while the interest more than doubles, to $58,580.56. Add a 3 percent origination fee deducted at closing and you receive $97,000 while repaying $100,000, which lifts the APR from 10.00 percent to 11.32 percent.",
    },
    {
      question: "Why is my business loan APR higher than the interest rate?",
      answer:
        "Because the fees came out of the money rather than being added to the balance. Under 12 CFR 1026.18(b) the amount financed is the loan minus any prepaid finance charge, so a 2 percent origination fee plus $1,500 of closing costs on a $250,000 loan means $243,500 lands in the account while you still repay $250,000. That gap is worth 62 basis points over ten years: a 9.25 percent note rate is a 9.87 percent APR.",
    },
    {
      question: "How much is the SBA guaranty fee on a 7(a) loan?",
      answer:
        "For FY 2026 it is 2 percent of the guaranteed portion on loans of $150,000 or less, 3 percent from $150,001 to $700,000, and 3.5 percent from $700,001 to $5,000,000 with 3.75 percent above one million dollars of guaranteed portion. It is charged on the guaranteed portion, not the loan, so a $250,000 loan guaranteed at 75 percent pays 3 percent of $187,500, which is $5,625. Manufacturers borrowing $950,000 or less pay nothing in FY 2026.",
    },
    {
      question: "Does paying extra on a business loan actually save money?",
      answer:
        "Yes, and the amount is calculable rather than a matter of opinion. On a $250,000 loan at 9.25 percent over ten years, an extra $250 a month clears the note after 107 payments instead of 120 and saves $16,736.67 of interest, for $26,500 of extra principal paid in. Check the note first for a prepayment charge, and confirm the servicer applies unscheduled money to principal rather than holding it as a prepaid payment.",
    },
    {
      question: "What is a balloon payment on a business loan?",
      answer:
        "It is the unpaid balance that falls due when a note matures before it has fully amortized. Size a $250,000 loan at 9.25 percent on a ten year schedule but mature it at five years, and the payment stays $3,200.82 while $153,296.45 is still outstanding at maturity, making the final payment $156,497.27. Calling that a payment is generous. It is a refinance you agreed to sight unseen, priced at whatever rate the market sets five years out.",
    },
  ],
  related: [
    "merchant-cash-advance-calculator",
    "apr-vs-apy-calculator",
    "invoice-factoring-calculator",
    "cash-conversion-cycle-calculator",
    "simple-interest-calculator",
  ],
  links: [
    { label: "Payment processors for small business", href: "/category/small-business" },
    { label: "Effective rate, explained", href: "/glossary/effective-rate" },
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
    { label: "All free calculators", href: "/tools" },
    { label: "How we research and check these numbers", href: "/methodology" },
  ],
  cta: {
    heading: "Cheaper than borrowing: the rate you pay every day",
    body: "A loan is one negotiation. Your processing rate is a charge on every sale you will ever make, and forty basis points on $100,000 a month is $4,800 a year with nothing to repay. Check what you are paying now.",
    label: "Check your effective rate",
  },
};
