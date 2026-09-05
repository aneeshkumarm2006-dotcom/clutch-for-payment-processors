import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/invoice-factoring-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on receivables finance:
 * "invoice factoring calculator", "factoring rate to APR", "invoice factoring
 * cost", "accounts receivable factoring calculator", "what does invoice
 * factoring cost". It also has to answer the informational siblings the same
 * searcher types within a minute, "is invoice factoring expensive" and "what is
 * the difference between recourse and non recourse factoring", because those are
 * the questions that sent them looking for a calculator.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Almost every invoice factoring
 * calculator on the first page is published by a factor, and every one of them
 * stops at two outputs: the advance and the fee. Four checkable failures:
 *
 *   1. NOBODY ANNUALIZES. A factoring quote is a percentage per period with the
 *      period left vague. Three percent sounds like three percent. On a 30 day
 *      invoice at an 85 percent advance it is 42.94 percent a year. A calculator
 *      that returns dollars and no rate cannot be compared to a bank line, an
 *      SBA loan or a merchant cash advance, which is the only decision anybody
 *      is actually making on this page.
 *   2. THE DENOMINATOR IS WRONG WHEREVER ANYONE DOES ANNUALIZE. The fee is
 *      charged on the invoice FACE VALUE. The merchant receives the ADVANCE,
 *      typically 80 to 90 percent of it. Dividing the fee by face understates the
 *      cost by exactly the advance rate, every time, in the merchant's favor.
 *      On this page's defaults that is 40.96 percent against a true 48.22.
 *   3. THE ANCILLARY FEES ARE MISSING. The discount rate is the advertised
 *      number and rarely the largest one. A wire fee is charged per advance, so a
 *      business factoring twelve invoices a month pays it 144 times a year. A
 *      monthly minimum charges you in the months you did not need the facility.
 *      A termination fee is priced on the facility LIMIT, not on what you drew.
 *   4. NON RECOURSE IS SOLD AS BAD DEBT INSURANCE. It is not. It covers the
 *      debtor going insolvent. A dispute about the work is still yours.
 *
 * WHERE THE NUMBERS CAME FROM.
 *   - The annualization method is the actuarial method of Appendix J to 12 CFR
 *     Part 1026, paragraph (b)(5)(vii) on single advance single payment
 *     transactions, read on law.cornell.edu 5 September 2026. California's commercial
 *     financing disclosure regulations require that method by name at
 *     10 CCR 940(a); New York's 23 NYCRR Part 600 requires the same.
 *   - The denominator argument is not this site's opinion. California defines
 *     the amount financed for a factoring disclosure as "the original advance
 *     amount, minus any prepaid finance charge" at 10 CCR 900(a)(1)(D), and the
 *     finance charge as "the face value on the invoice minus the amount paid
 *     directly to the recipient upon assignment" at 10 CCR 943(a)(3). Both read
 *     on law.cornell.edu 5 September 2026.
 *   - The factoring disclosure table itself, including the estimated term row
 *     and the repurchase row, is 23 NYCRR 600.12, and the assumption that the
 *     invoice is paid on its due date is 10 CCR 941(a). Read 5 September 2026.
 *   - Advance rate and fee ranges are altLINE (a division of The Southern Bank
 *     Company), "Invoice Factoring Rates and Cost", page last updated 6 July
 *     2026, and eCapital, "Understanding Factoring Rates, Fees, and the Total
 *     Cost of a Factoring Agreement", updated 29 July 2026. Both read
 *     5 September 2026. They are vendor pages and are attributed as such.
 *   - The recourse and non recourse wording is altLINE, "Recourse vs.
 *     Non-Recourse Factoring", last updated 23 June 2026, read 5 September 2026.
 *   - The exit fee case examples are Liquid Capital, "5 Invoice Factoring
 *     Contract Terms That Can Trap Your Business", published 16 April 2026, read
 *     5 September 2026. No reliable published RANGE for an exit fee exists, so
 *     the page gives the cases and declines to invent a range.
 *   - The prime benchmark is 6.75 percent, Federal Reserve statistical release
 *     H.15, release dated 4 September 2026.
 *   - The SBA line about how factoring is priced is sba.gov, "Asset-Based
 *     Lending: What is the Upside and Downside?", published 31 December 2017.
 *   - Borrower cost expectations are the Federal Reserve Banks' 2026 Report on
 *     Employer Firms, published 3 March 2026 from the 2025 Small Business Credit
 *     Survey.
 *
 * Every dollar and percentage figure in the copy below was produced by
 * `lib/calc/factoring.ts` on the widget's own default inputs and is asserted in
 * `tests/tools/batch-four/invoice-factoring-calculator.test.ts`, because a hand
 * written number that disagrees with the widget on the same page has shipped on
 * this site before and is the worst defect this section can carry.
 */

const NOT_ADVICE =
  "This is arithmetic on the figures you entered, not financial advice and not an offer. Your factoring agreement is the authority on what you will actually pay.";

export const INVOICE_FACTORING_TOOL: ToolDef = {
  slug: "invoice-factoring-calculator",
  name: "Invoice Factoring Rate to APR Calculator",
  h1: "Invoice factoring calculator: discount rate to real APR",
  title: "Invoice factoring calculator: rate to real APR",
  description:
    "Turn an invoice factoring rate into a real annualized cost. Prices the fee on the invoice face value but annualizes it on the cash actually advanced to you.",
  intro:
    "Every invoice factoring calculator gives you the fee, and almost none gives you the rate. A 3 percent factoring fee on a 30 day invoice is not 3 percent: at an 85 percent advance rate it is 42.94 percent a year, because the fee is charged on the invoice face value while the only cash you received was the advance. This Invoice Factoring Rate to APR Calculator computes both figures and labels them, using the annualization method California's commercial financing rules require by name, so you can see which one your factor quoted and what the deal costs against a term loan.",
  tier: 2,
  summary: "Turn a factoring discount rate into a real APR on the cash actually advanced, plus the ancillary fees.",
  widget: "factoring",
  workedExample: {
    scenario:
      "A 14 person commercial cleaning contractor in Columbus, Ohio invoices a hospital group $50,000 on net 30 terms and factors it. The factor advances 85 percent, charges 3.0 percent of face for the first 30 days plus 1.0 percent for each further 10 days, and takes a $25 wire fee out of the advance. The hospital pays on day 45. The 85 percent advance rate is the midpoint of the 80 to 90 percent altLINE publishes for general factoring, and the 3.0 plus 1.0 percent structure is a modeled default sitting inside the 1 to 5 percent of invoice value altLINE publishes as its general market range. Replace both with your own term sheet.",
    result:
      "The advance is 50,000 x 0.85 = $42,500, so $7,500 is held in reserve. The $25 wire comes out of the advance, so $42,475 reaches the bank on day one. Day 45 is 15 days past the opening 30 day tier, which buys two further 10 day blocks, so the fee is 3.0 + 1.0 + 1.0 = 5.0 percent of the $50,000 face, which is $2,500. When the hospital pays, the factor releases the $7,500 reserve less the $2,500 fee, so $5,000 comes back. Total received is $47,475 and total cost is $2,525, which is 5.05 percent of the face value and 5.94 percent of the advance. Now annualize it. The amount financed is the advance net of the prepaid wire fee, $42,475, and the finance charge is $2,525, so the periodic rate is 5.9447 percent across 45 days and a year holds 365/45 = 8.111 of those periods: 5.9447 x 8.111 = 48.22 percent. Annualize the same $2,525 over the $50,000 face instead, which is what a factoring calculator normally does, and you get 40.96 percent. The 7.26 point gap is the advance rate and it is there on every single invoice. Compounded rather than annualized straight, rolling this deal all year is 59.74 percent. Change nothing but the payment date and the picture moves again: paid on day 30 the same invoice costs $1,525 and 43.68 percent, and paid on day 90 it costs $4,525 and 43.21 percent.",
  },
  sections: [
    {
      heading: "Why an invoice factoring calculator has to divide by the advance",
      body: [
        "Factoring has two prices. The discount fee is quoted as a percentage of the invoice face value, because the face value is the asset the factor is buying. The cash that reaches your account is the advance, a fraction of it. Divide the fee by the face and you get a cost per dollar of receivable; divide it by the advance and you get a cost per dollar you actually had. Only the second is a financing rate, because only the second has a borrower in it.",
        "The gap is exactly the advance rate. At 85 percent, dividing by face understates the cost by 15 percent of itself, in your favor, on every invoice. In the worked example above that is 40.96 percent against a true 48.22 percent a year. Both look like a plausible factoring cost, so the number alone cannot tell you which you are reading. This Invoice Factoring Rate to APR Calculator prints both and labels them rather than quietly picking one.",
        "That is the regulator's arithmetic, not an editorial preference. California's commercial financing rules define the amount financed for a factoring disclosure as the original advance amount minus any prepaid finance charge (title 10, section 900(a)(1)(D)), and the finance charge as the face value on the invoice minus the amount paid directly to the recipient on assignment (section 943(a)(3)), with the reserve subtracted only where the factor reasonably anticipates returning it. Follow those definitions and the denominator is the advance. New York's 23 NYCRR Part 600 builds its table the same way.",
        "The annualization is fixed too: section 940(a) requires the United States Rule or the actuarial method of Appendix J to 12 CFR Part 1026. Appendix J (b)(5)(vii) says that in a single advance, single payment transaction whose term is under a year and is not a whole number of months, the term holds one unit period and a year holds 365 divided by the days in the term. So the rate is the finance charge over the amount financed, multiplied by 365 over the days outstanding.",
      ],
    },
    {
      heading: "The three ways a factor quotes the fee, and what each one hides",
      body: [
        "A flat discount rate is one percentage of face covering a whole recourse period, which eCapital calls a one time cost for the entire recourse period, usually 60 or 90 days. What it hides is time. The fee does not move whether the customer pays on day 12 or day 88, so the same quote can differ by a factor of six once annualized. A flat 3 percent at an 85 percent advance is about 86 percent a year if the invoice clears in 15 days and about 14 percent if it clears in 90. The fast paying customer is the expensive one.",
        "A tiered rate is the common small facility structure: an opening percentage for the first 30 days, then a step per further block of 10, 15 or 30 days. altLINE publishes a schedule opening at 1.5 percent for 0 to 30 days and stepping 0.50 percent every 10 days to 4.5 percent at 81 to 90, and eCapital publishes a split fee of 5 percent for the first 15 days plus 1.0 percent per further 15. What tiering hides is that the cost is a staircase, not a slope. Nobody prorates a step, so an invoice paid on day 41 costs what one paid on day 50 costs, one third more than day 40.",
        "That staircase shows up in the calculator above. On the default structure the annualized cost is 43.68 percent if the invoice is paid on day 30, 48.22 percent on day 45, and 43.21 percent by day 90. Being paid slightly late is worse than being paid much later, because you cross a boundary and then spend the rest of the block amortizing it. The worst day to be paid is the first day of a new tier.",
        "A prime plus facility behaves like a bank line: a benchmark plus a margin, per year, accrued daily on funds employed rather than on the invoice. eCapital's published example is prime plus 3.5 percent. At the 6.75 percent bank prime loan rate in the Federal Reserve's H.15 release of 4 September 2026 that is 10.25 percent, or $544.53 on the same $50,000 invoice held 45 days against $2,500. Check two things: the day count, because a 360 day year turns 10.25 percent into 10.39 without changing the paper, and the monthly servicing fee, which is usually the larger number.",
      ],
    },
    {
      heading: "The fees beside the rate are where the margin actually is",
      body: [
        "The discount rate is the advertised number and often not the biggest. altLINE publishes $15 to $30 per wire, charged per advance rather than per month, so a business factoring twelve invoices a month pays it 144 times a year. On the facility defaults above, $25 a wire is $3,600 a year, and because it comes out of the advance it also shrinks the amount financed, so it lifts the rate by more than its own size. ACH is the cheap alternative, $0 to $3 at altLINE against a market range of $5 to $30.",
        "The monthly minimum hurts a seasonal business, because it charges you in the months you did not need the facility. Read whether the contract makes it a floor on your discount fees or a separate charge on top, which differ by the entire minimum in every month you are above it. This calculator treats it as a floor by default, which is how a factoring agreement normally words it, and lets you switch.",
        "The early termination fee is priced on the facility limit or on a volume shortfall, not on what you drew, and no reliable published range exists. Liquid Capital's case files carry a company charged a 10 percent facility termination fee, $100,000 to leave a $1,000,000 line, and a manufacturer billed $160,000 on a minimum volume shortfall. Pair that with the notice window, because a written cancellation requirement of 30 to 90 days that you miss silently renews the whole term. Ask how it would be computed if you left after three months.",
        "Then there is the fee your customer triggers rather than you. Every assigned invoice is redirected to the factor's lockbox, and long standing customers keep paying the way they always have. A payment that lands with you and is not remitted inside the contract window, usually two to five business days, triggers a misdirected payment fee, and depositing the check is a breach rather than a fee. Application and due diligence round it out: altLINE publishes $150 to $500 for filing, against a market origination of 0 to 3 percent of the credit line plus $35 to $100 per debtor credit check.",
      ],
    },
    {
      heading: "Recourse and non recourse, said plainly",
      body: [
        "Under recourse factoring, the default and the cheaper of the two, the credit risk stays with you. If your customer never pays, you substitute another good invoice or hand the money back. altLINE puts it plainly in its own example: if payment is never received, the client will ultimately be required to pay altLINE back for the total amount of the cash advance provided. Recourse factoring is a cash flow product, not a bad debt product: it moves money forward in time, it does not move risk.",
        "Non recourse costs more and buys much less than merchants think. altLINE says the only time a non recourse contract protects you from a chargeback is if the debtor files bankruptcy, and that there is no warranty you are hedged against products or services disputed by the client. So the two most common reasons a US B2B invoice goes unpaid, a dispute about the work and a customer who stalls, sit outside the cover you paid extra for. Short pays, retainage, offsets and missing paperwork stay your problem in both structures.",
        "New York wrote the useful question into its form. 23 NYCRR 600.12 requires a factoring disclosure table carrying the funding provided, the estimated APR, the finance charge, the estimated term and a repurchase row. If you are outside a disclosure state and your term sheet has no repurchase row, ask for one in writing: what triggers a repurchase, what it costs, and how long you have to cure. That answer is the product you are actually buying.",
      ],
    },
    {
      heading: "When factoring is worth it, and what to compare it against",
      body: [
        "The honest case is narrow. Factoring is fast, it underwrites your customer rather than your balance sheet, and it scales with sales instead of a fixed limit, so a young B2B business with strong customers and no credit history can get funded when a bank will not look at it. If a 5 percent discount on a $50,000 invoice wins a job carrying $20,000 of margin, the annualized rate is beside the point. The rate starts to matter when factoring becomes permanent working capital rather than a bridge, because then you pay for the same money over and over.",
        "Compare it in units that survive the comparison. The SBA states the mismatch: asset-based loans are priced with an annual percentage rate, while factoring lines are priced by discounting the full value of the invoice by a percentage. Those are not comparable until one is converted, which is the whole job of this Invoice Factoring Rate to APR Calculator. Use the facility mode too: a facility is not an invoice. Factoring $150,000 of face value a month at an 85 percent advance on 45 day payment leaves an average balance of $188,630 outstanding, not the $1,800,000 that passed through, and dividing the annual bill by that balance gives 49.62 percent a year on the defaults.",
        "Price the cheaper alternatives first. Offering a 2 percent discount for payment in 10 days is frequently cheaper than factoring at 5 percent for 45. Getting paid by card or ACH at issue removes the receivable entirely. And go in informed: the Federal Reserve Banks' 2026 Report on Employer Firms, published 3 March 2026, found 60 percent of firms that borrowed from online lenders reported actual borrowing costs higher than expected. Annualizing the quote first is how you avoid joining them.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Annualized cost of a factoring discount fee, computed by this page rather than sourced. Every cell assumes an 85 percent advance rate and no ancillary fees, and is the Appendix J single payment calculation: (discount rate divided by 0.85) multiplied by (365 divided by days). Reproduce any of them by hand. The discount rates down the side bracket the 1 to 5 percent of invoice value altLINE publishes as its general range.",
    columns: ["Paid in 30 days", "Paid in 45 days", "Paid in 60 days", "Paid in 90 days"],
    rows: [
      {
        label: "1.5% of face value",
        note: "The bottom of the published range, usual only on large, fast paying, investment grade debtors",
        values: ["21.47%", "14.31%", "10.74%", "7.16%"],
      },
      {
        label: "2.0% of face value",
        values: ["28.63%", "19.08%", "14.31%", "9.54%"],
      },
      {
        label: "3.0% of face value",
        note: "Roughly the middle of the market for a small first facility",
        values: ["42.94%", "28.63%", "21.47%", "14.31%"],
      },
      {
        label: "4.0% of face value",
        values: ["57.25%", "38.17%", "28.63%", "19.08%"],
      },
      {
        label: "5.0% of face value",
        note: "Where a tiered structure lands once an invoice ages past 40 days",
        values: ["71.57%", "47.71%", "35.78%", "23.86%"],
      },
    ],
  },
  assumptions: [
    "The annualization is the actuarial method of Appendix J to 12 CFR Part 1026, paragraph (b)(5)(vii), which sets one unit period for a single advance, single payment transaction under a year and 365 divided by the term in days as the number of unit periods per year. It is nominal, not compounded, because that is what the disclosure rules mean. The compounded equivalent is shown separately and labeled, and it is always the larger figure.",
    "The denominator is the advance, not the invoice face value. California's commercial financing regulations define the amount financed for a factoring disclosure as the original advance amount minus any prepaid finance charge (10 CCR 900(a)(1)(D)) and the finance charge as the face value minus the amount paid directly to you on assignment (10 CCR 943(a)(3)). Both read on law.cornell.edu 5 September 2026. The reserve is assumed to be released in full less the fees, which is what the same regulation contemplates; if your factor keeps part of it permanently, that money is a cost and belongs in the fee fields.",
    "The 85 percent advance rate and the 1 to 5 percent discount range are altLINE's published figures for general factoring, read from its Invoice Factoring Rates and Cost page (last updated 6 July 2026) on 5 September 2026. The flat, tiered and prime plus structures and the prime plus 3.5 percent example are eCapital's, from its factoring rates page (updated 29 July 2026), read the same day. Both are factoring companies writing about their own market, attributed rather than treated as neutral research, and they are modeled defaults you should replace with your own term sheet.",
    "The prime benchmark is the bank prime loan rate of 6.75 percent from Federal Reserve statistical release H.15, release dated 4 September 2026. Prime moves; re-enter it rather than trusting the default once the FOMC has met.",
    "Application, due diligence, monthly minimum, lockbox and termination fees all default to zero. That is deliberate. Published ranges for them are wide enough ($150 to $500 filing at altLINE against 0 to 3 percent of the credit line across the market, $50 to $1,000 a month for a lockbox, and no published range at all for an exit fee) that any single default would be a guess dressed as a figure. Enter your own and watch what happens to the rate.",
    "Days to payment is your estimate of when the debtor really pays, not the stated terms. California assumes payment on the invoice due date for its disclosure (10 CCR 941(a)), which is why every state mandated factoring APR is labeled an estimate. If your customers pay net 30 in 45 days, model 45.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "How do you calculate the real cost of invoice factoring?",
      answer:
        "Take the total fees, divide by the cash actually advanced to you rather than by the invoice face value, then multiply by 365 divided by the days the money was outstanding. Worked through: a $50,000 invoice at an 85 percent advance with a 5 percent discount fee and a $25 wire costs $2,525 on $42,475 of cash, held 45 days, which is 5.9447 percent x 8.111 = 48.22 percent a year. Dividing by the $50,000 face instead gives 40.96 percent, which is the number most calculators show.",
    },
    {
      question: "What is a typical invoice factoring rate?",
      answer:
        "altLINE publishes 1 to 5 percent of invoice value, with advance rates of 80 to 90 percent for general factoring, and its own tiered structure runs from 1.5 percent at 0 to 30 days to 4.5 percent at 81 to 90 days. Treat that as one factor's published range rather than a market average. What matters more than the headline percentage is the period it covers and whether the fee is charged on the invoice or on the funds advanced.",
    },
    {
      question: "Is invoice factoring expensive?",
      answer:
        "Measured per invoice it looks cheap and measured per year it usually is not. A 3 percent fee on a 30 day invoice at an 85 percent advance is 42.94 percent annualized. At 2 percent on 45 day payment it is 19.08 percent, which is closer to an expensive business credit card. Whether that is expensive depends on the alternative: against a bank line it is dear, and against a merchant cash advance at triple digit rates it is often cheap.",
    },
    {
      question: "How is the factoring fee calculated, on the invoice or on the advance?",
      answer:
        "The fee is normally charged on the full invoice face value even though you only receive the advance, which is what makes the effective rate higher than the headline. The exception is a prime plus facility, where interest accrues daily on funds employed, which is the advance. On a $50,000 invoice held 45 days, a 5 percent discount fee is $2,500 while prime plus 3.5 percent on the advance is $544.53. Ask which base your quote uses before comparing two quotes.",
    },
    {
      question: "What is the difference between recourse and non recourse factoring?",
      answer:
        "Under recourse, if your customer never pays you buy the invoice back or substitute another. Under non recourse the factor absorbs that loss, but only for a defined credit event, essentially the debtor going insolvent. altLINE states that the only time a non recourse contract protects you from a chargeback is if the debtor files bankruptcy, and that there is no warranty against disputed products or services. Non recourse costs more and does not cover a dispute about your work.",
    },
    {
      question: "What hidden fees do factoring companies charge?",
      answer:
        "The ones that do not appear in the discount rate. Wire fees of $15 to $30 per advance, 144 charges a year at twelve invoices a month. A monthly minimum that bills you in the months you did not factor. Lockbox and monitoring of $50 to $1,000 a month. Origination of $150 to $500 or up to 3 percent of the line, credit checks of $35 to $100 per debtor, an exit fee with no published range, and a misdirected payment fee when a customer pays you, not the factor.",
    },
  ],
  related: [
    "merchant-cash-advance-calculator",
    "business-loan-amortization-calculator",
    "early-payment-discount-calculator",
    "cash-conversion-cycle-calculator",
    "apr-vs-apy-calculator",
  ],
  links: [
    { label: "Processors for small business", href: "/category/small-business" },
    { label: "Processors with invoicing built in", href: "/payment-processors/with-invoicing" },
    { label: "Settlement, explained", href: "/glossary/settlement" },
    { label: "How we research and check these numbers", href: "/methodology" },
    { label: "All free calculators", href: "/tools" },
  ],
  cta: {
    heading: "Stop financing the receivable and remove it instead",
    body: "Factoring prices a gap your payment setup created. Getting invoices paid by card or ACH on issue closes the gap outright, and costs a fraction of a discount rate. Tell us your invoice sizes and we will shortlist processors that invoice and take ACH.",
    label: "Get matched",
  },
};
