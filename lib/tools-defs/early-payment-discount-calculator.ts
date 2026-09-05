import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/early-payment-discount-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on trade terms:
 * "2/10 net 30 calculator", "early payment discount calculator", "cost of trade
 * credit", "discount to APR". The 2/10 net 30 query is the specific high intent
 * one and is named explicitly in the title, the h1, the intro, a section heading
 * and two FAQs. The definitional siblings ("what does net 30 mean") are answered
 * in prose here because the same searcher asks both, but the definitions
 * themselves belong to the glossary.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Four things, all checkable.
 *
 *   1. They publish ONE number and call it the APR. The textbook figure,
 *      (d / (1 - d)) x (365 / n), is a simple annualization, not an APR. On
 *      2/10 net 30 it is 37.24 percent, and the compounded effective annual rate
 *      on the same terms is 44.59 percent. This page publishes both, labelled,
 *      and says which one answers which question.
 *   2. They do not say whether the year is 365 days or 360. AccountingTools'
 *      cost of credit article uses 360 and works 2/15 net 40 to 29.4 percent;
 *      the same terms on 365 days are 29.80 percent. A reader cannot reconcile
 *      two pages that both hide their convention. This one is a visible input.
 *   3. Nothing runs the arithmetic from the SELLER's side properly. The seller's
 *      denominator is the day customers ACTUALLY pay, not the net date, which
 *      moves the break-even on 2/10 from 37.24 percent to 21.28 percent against
 *      customers paying at day 45. And take-up divides straight out of the
 *      break-even, so "what take-up rate do I need" is a question with no answer.
 *   4. None of them connects it to the card fee, which is this site's subject.
 *      Paying a supplier by card to capture a 2 percent discount at a 2.9 percent
 *      card fee loses money on the fee line alone.
 *
 * WHERE THE NUMBERS CAME FROM.
 *
 *   - Every percentage and dollar figure in the intro, the worked example, the
 *     rate table and the FAQs is computed by `lib/calc/early-payment.ts` and was
 *     read off a run of that module on 5 September 2026, not written by hand.
 *     The rate table caption says so. The test file re-derives them independently.
 *   - Bank prime loan rate, 6.75 percent: Federal Reserve H.15 Selected Interest
 *     Rates, release of 4 September 2026, which posts 6.75 for every business day
 *     from 28 August to 3 September 2026. Fetched from federalreserve.gov on
 *     5 September 2026.
 *   - Card fee to pay a supplier bill, 2.9 percent, and ACH at 50 cents: Melio's
 *     published US pricing, melio.com/pricing, read 5 September 2026.
 *   - PayPal invoicing rates (3.49% + $0.49 via PayPal Checkout, 2.99% + $0.49
 *     standard cards, Pay by Bank 1% capped at $10.00): PayPal's US business fees
 *     page, which prints "September 1, 2026" as its own last updated date, read
 *     5 September 2026.
 *   - Helcim ACH (0.5% + 25 cents, capped at $6): helcim.com/pricing, read
 *     5 September 2026.
 *   - The 360 day convention and its 29.4 percent worked figure for 2/15 net 40:
 *     AccountingTools, "Cost of credit formula", read 5 September 2026. Cited as
 *     market colour for the convention split, not as the source of any figure
 *     this page computes.
 *   - SBA 7(a) variable rate ceilings are described as a RANGE tied to prime plus
 *     a maximum spread, because the spread schedule could not be read off an SBA
 *     primary source on the day this shipped. The page states the base rate it is
 *     built on and does not publish a single ceiling number as fact.
 */

const NOT_ADVICE =
  "This is arithmetic on the figures you entered, not financial advice and not an offer of credit. Your supplier agreement, your loan note and your card issuer's terms are the authority on what you will actually pay or receive.";

export const EARLY_PAYMENT_DISCOUNT_TOOL: ToolDef = {
  slug: "early-payment-discount-calculator",
  name: "Early Payment Discount to APR Calculator",
  h1: "Early payment discount and 2/10 net 30 calculator",
  title: "2/10 net 30 calculator: early payment discount to APR",
  description:
    "Turn 2/10 net 30 into an annual rate. Get both the nominal 37.24 percent and the compounded 44.59 percent effective rate, and what a discount costs a seller.",
  intro:
    "On 2/10 net 30, skipping the discount costs 37.24 percent a year nominal, or 44.59 percent as a compounded effective annual rate. The arithmetic is 0.02 divided by 0.98, which is 2.0408 percent for the 20 days between day 10 and day 30, multiplied by the 18.25 such periods in a 365 day year. The Early Payment Discount to APR Calculator publishes both figures because almost every competing 2/10 net 30 calculator prints only the first and labels it an APR. It also runs the trade backwards, for the supplier deciding whether to offer the discount at all.",
  tier: 3,
  summary:
    "2/10 net 30 as an annual rate, nominal and compounded, from both the buyer's side and the seller's.",
  widget: "early-payment-discount",
  workedExample: {
    scenario:
      "Coastal Bindery, a commercial print shop in Sacramento, holds a $10,000 paper invoice on 2/10 net 30. Its line of credit is priced off the bank prime rate, 6.75 percent as of the Federal Reserve's H.15 release of 4 September 2026. The bindery has no spare cash on day 10, so taking the discount means drawing on the line.",
    result:
      "Take the discount and Coastal Bindery pays $9,800 on day 10 instead of $10,000 on day 30, so the discount is worth $200. What it buys the supplier is 20 days. Restated as a rate, $200 to keep $9,800 for 20 days is 0.02 divided by 0.98, which is 2.0408 percent over the period. A 365 day year holds 18.25 of those periods, so the nominal annualized cost of skipping this discount is 2.0408 multiplied by 18.25, or 37.24 percent. Compound the same period rate 18.25 times and the effective annual rate is 44.59 percent. Now price the draw. Borrowing $9,800 for 20 days at 6.75 percent costs $9,800 multiplied by 0.0675 multiplied by 20 divided by 365, which is $36.25. Against a $200 discount that is a net gain of $163.75 on one invoice, and the break-even borrowing rate is exactly the nominal figure: at 37.24 percent the interest on the draw would come to $200 and the trade would be flat. Coastal Bindery would have to be borrowing at more than five times prime before skipping this discount made sense. Two variations change the answer. Put the payment on a business card through a bill pay service charging 2.9 percent and the fee is $284.20 on the $9,800 charge, which the $200 discount does not cover on its own; add 1.5 percent of card rewards, which is $147.00, and five days of statement float worth $9.32, and the card route comes out $72.12 ahead of simply paying cash on day 30. Strip the rewards out and it is $74.88 behind. Flip to the supplier's side of the same terms and the sign flips too. A supplier with $1,200,000 of annual credit sales whose customers actually pay at day 45, offering 2/10 with 40 percent take-up, hands over $9,600 of discount a year, cuts days sales outstanding from 45 to 31, and releases $45,106.85 of cash, which at 6.75 percent is worth $3,044.71 a year. That is a net loss of $6,555.29. The supplier's break-even cost of capital is 21.28 percent, not 37.24, because the discount only accelerates payment by 35 days rather than 20.",
  },
  sections: [
    {
      heading: "How a 2/10 net 30 calculator turns a discount into an annual rate",
      body: [
        "In 2/10 net 30 the first number is the discount percentage, the second is the last day it can be taken, and the third is the day the full amount falls due. Declining the discount is a borrowing decision: you keep the money for the days between those two dates, and the discount you gave up is what that credit cost. The formula is the discount divided by one minus the discount, multiplied by the year divided by the credit period. For 2/10 net 30 on a 365 day year, 0.02 divided by 0.98 is 2.0408 percent and 365 divided by 20 is 18.25, giving 37.24 percent.",
        "The detail separating a correct answer from a nearly correct one is that first denominator. It is one minus the discount, not one. The 2 percent is a share of the face amount, but the credit is extended on the amount you would actually have paid, $9,800 on a $10,000 invoice. Dividing by 0.98 rather than by 1 moves 2/10 net 30 from 36.50 percent to 37.24 percent, and it is worth 1.7 points at a 3 percent discount. It is the commonest error in spreadsheets built from memory.",
        "The second detail is the year. Some published versions divide 360 by the credit period and some divide 365. AccountingTools' cost of credit article uses 360 and works 2/15 net 40 to 29.4 percent; the same terms on 365 days come to 29.80 percent. On 2/10 net 30 the two give 36.73 percent and 37.24 percent. Neither is wrong, but a page that hides its convention cannot be reconciled against one that used the other, so the Early Payment Discount to APR Calculator makes the basis a visible selector.",
        "Terms with no discount are where the arithmetic says do nothing. Net 30, net 60 and net 90 offer nothing for paying early, so that trade credit costs zero and every day of it is free. Paying a net 60 invoice on day 12 is a donation of 48 days of your own working capital to a supplier who did not ask for it. The calculator returns Free rather than a misleading 0.00 percent.",
      ],
    },
    {
      heading: "Nominal against effective, and why the two differ by seven points",
      body: [
        "There are two defensible annual rates here and most calculators publish only the first. The nominal figure multiplies the period cost by the periods in a year: 2.0408 percent times 18.25 is 37.24 percent. The effective annual rate compounds instead, so one plus 0.020408 raised to the power 18.25, minus one, is 44.59 percent. Both come from the same two inputs and they are 7.34 points apart.",
        "Which is right depends on whether the decision repeats. For a single invoice funded by a draw on a line of credit charging simple interest, the nominal figure is the correct comparison and not an approximation of anything. Set the discount equal to simple interest on the discounted amount over the credit period, solve for the rate, and you get the nominal formula exactly, which is why the break-even borrowing rate here is always identical to the nominal number. When the same supplier bills you monthly and you skip the discount every time, the charge recurs 18.25 times a year and the effective rate is the honest one.",
        "The gap widens fast with the discount. At 1/10 net 30 the nominal cost is 18.43 percent and the effective is 20.13 percent, 1.7 points apart. At 3/10 net 30 the nominal is 56.44 percent and the effective is 74.35 percent, 17.9 points apart. Any page printing one figure for 3/10 net 30 is off by more than the whole cost of a bank loan, and none of them says which way.",
        "The window matters more than the discount, and that is the counterintuitive part. Two percent over the 20 days of 2/10 net 30 annualizes to 37.24 percent. The identical 2 percent over the 50 days of 2/10 net 60 annualizes to 14.90 percent, because you are paid the same amount for two and a half times the waiting. A supplier who lengthens the net date without touching the discount has quietly made it far less attractive.",
      ],
    },
    {
      heading: "Should you borrow to take an early payment discount?",
      body: [
        "The test is one comparison: your own annual cost of capital against the nominal annualized cost of the terms. If your money costs less than the terms, take the discount, borrowing if you have to. If it costs more, pay on the net date and keep the cash. The Early Payment Discount to APR Calculator prints the break-even rate directly.",
        "At normal US business borrowing rates, 2/10 net 30 is a take. The Federal Reserve's H.15 release of 4 September 2026 puts the bank prime loan rate at 6.75 percent. An SBA 7(a) variable rate loan is priced as a permitted base rate plus a maximum spread set by loan size, so its ceiling sits a few points above prime rather than anywhere near 37 percent, and a business card revolving in the low twenties is still well below the break-even. On a $10,000 invoice, borrowing the $9,800 for 20 days at 6.75 percent costs $36.25 against a $200 discount, a net gain of $163.75.",
        "The answers that go the other way exist and are worth naming. A merchant cash advance is priced with a factor rate, which contains no time in it at all, so the same 1.30 factor can annualize anywhere from roughly 37 percent to well over 100 percent depending on how fast the holdback clears it. Funding a 2 percent discount from an advance can easily be a loss, and the cost has to be solved from the actual payment stream rather than read off a term sheet.",
        "There is a case where taking the discount is right and doing it is still wrong, and no calculator can see it. If paying on day 10 means a payroll run clears late, or a rolling reserve is holding cash you assumed you had, the liquidity constraint beats the rate comparison. A missed payroll is not priced in basis points.",
      ],
    },
    {
      heading: "What offering an early payment discount actually costs the seller",
      body: [
        "Run the same terms from the supplier's side and the numbers change, because the denominator changes. A seller offering 2/10 net 30 is not paid 20 days sooner. They are paid however much sooner than their customers pay today, and US business to business invoices are commonly settled after the net date. If customers pay at day 45 now, the discount buys 35 days, so the break-even cost of capital is 0.02 divided by 0.98, multiplied by 365 divided by 35, which is 21.28 percent a year rather than 37.24.",
        "Put dollars on it. A supplier with $1,200,000 of annual credit sales, customers paying at day 45, 40 percent take-up and a 6.75 percent cost of capital hands over $9,600 of discount a year. Days sales outstanding falls from 45 to 31, releasing $45,106.85 of cash once, worth $3,044.71 a year at 6.75 percent. Net, the program costs $6,555.29 a year. The released cash is computed on sales net of the discount, because an invoice that clears early clears at the discounted amount.",
        "Take-up is where most seller-side analysis goes astray. It is the number everybody wants to forecast, and it cannot change the answer. Take-up multiplies the discount handed over and the cash released by exactly the same factor, so it divides straight out of the break-even. Higher take-up on a program that loses money simply loses more. There is no share of customers at which a losing early payment discount starts to pay for itself.",
        "That is not an argument against ever offering one, but for pricing it against the alternatives, all of which are cheaper per dollar of acceleration. Tightening dunning costs nothing. So does charging a late fee. Offering a bank rail so customers can pay the moment they approve an invoice costs a few dollars. A 2 percent discount is the most expensive way a US business can buy 35 days.",
      ],
    },
    {
      heading: "Paying by card, and getting paid by card, both have a fee attached",
      body: [
        "This is a payments site, so the connection nobody else makes belongs here. If you want the discount but not the cash outflow, one route is to pay the supplier on a business card through a bill pay service and settle the statement later. Melio's published US pricing, read 5 September 2026, charges 2.9 percent to pay a business bill by card. On a $10,000 invoice at 2/10 net 30 the card charge is $9,800 and the fee is $284.20, against a discount worth $200. The fee alone eats the discount and $84.20 more.",
        "Rewards and float are what rescue it, and both are arithmetic rather than opinion. A 1.5 percent rewards rate on the $9,800 charge is $147.00. If the statement falls due 25 days after a day 10 charge, the cash leaves on day 35 rather than day 30, which is five days of float on $10,084.20 worth $9.32 at 6.75 percent. Add them up and the card route is $72.12 ahead. The Early Payment Discount to APR Calculator solves both flip points: at a 2.9 percent fee you need a 0.76 percent rewards rate to break even, and at a 1.5 percent rewards rate you can pay a fee of up to 3.64 percent. Carry the balance past the statement date and card interest swamps every figure above.",
        "The same question from the collections side has a starker answer. If you are weighing a 2 percent discount because you want the money sooner, price it against a faster payment rail. On a $10,000 invoice the discount costs $200. PayPal charges 1 percent capped at $10.00 for Pay by Bank on an invoice, and Helcim charges 0.5 percent plus 25 cents on a bank payment, capped at $6, so the bank rail collects that invoice for $6 to $10 and every customer can use it. Cards run the other way at this ticket size: PayPal charges 3.49 percent plus 49 cents through PayPal Checkout and 2.99 percent plus 49 cents for a standard card, which is $349.49 or $299.49, more than the discount costs, though on small invoices the fixed fee flips it back. Work out your own crossover with the ACH against credit card fee calculator, and if the real problem is the whole cycle rather than one invoice, the cash conversion cycle calculator frames it.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Common US trade terms, annualized. Every figure is computed by this page from the terms notation, not read from a published table: nominal is the discount divided by one minus the discount, multiplied by the year over the credit period, and effective compounds the same period rate. The 360 day column is included because several published versions of this formula use it and do not say so.",
    columns: ["Credit days", "Nominal (365)", "Effective (365)", "Nominal (360)"],
    rows: [
      {
        label: "2/10 net 30",
        note: "The default across US wholesale and distribution",
        values: ["20", "37.24%", "44.59%", "36.73%"],
      },
      {
        label: "1/10 net 30",
        note: "Same window, half the discount, roughly half the cost",
        values: ["20", "18.43%", "20.13%", "18.18%"],
      },
      {
        label: "2/10 net 60",
        note: "Same discount over 50 days instead of 20",
        values: ["50", "14.90%", "15.89%", "14.69%"],
      },
      {
        label: "3/10 net 30",
        note: "Where nominal and effective separate hardest, 17.9 points apart",
        values: ["20", "56.44%", "74.35%", "55.67%"],
      },
      {
        label: "net 30",
        note: "No discount is offered, so the credit is free",
        values: ["n/a", "Free", "Free", "Free"],
      },
      {
        label: "net 60",
        note: "Free credit, twice as much of it",
        values: ["n/a", "Free", "Free", "Free"],
      },
      {
        label: "net 90",
        note: "Free credit for a quarter. Take every day of it",
        values: ["n/a", "Free", "Free", "Free"],
      },
    ],
  },
  assumptions: [
    "Every percentage and dollar figure on this page is computed from the inputs shown, by the module at lib/calc/early-payment.ts, and was read off a run of that module on 5 September 2026. Nothing in the table is a published rate. The nominal cost is the discount divided by one minus the discount, multiplied by the day count basis over the credit period; the effective annual rate compounds that period rate across the same number of periods. Both are re-derived by hand in this site's test suite so the copy and the widget cannot drift apart.",
    "The day count basis is a genuine fork rather than a rounding choice. This page defaults to 365 days and offers 360, and prints which one produced the answer. AccountingTools' cost of credit article, read 5 September 2026, uses 360 and works 2/15 net 40 to 29.4 percent; the same terms on 365 days are 29.80 percent. If your figure disagrees with someone else's by about half a point on 2/10 net 30, this is why.",
    "The default cost of capital is the bank prime loan rate, 6.75 percent, from the Federal Reserve's H.15 Selected Interest Rates release of 4 September 2026, which posts that rate for every business day from 28 August to 3 September 2026. It is a starting point, not your rate. Enter your own line of credit rate, or what the cash would earn if you kept it. SBA 7(a) variable rate loans are priced as a permitted base rate plus a maximum spread that varies with loan size, so their ceilings sit above prime; this page does not publish a spread schedule because it could not be read off an SBA primary source when this shipped.",
    "The card figures are US published pricing read on 5 September 2026. Melio charges 2.9 percent to pay a business bill by card and 50 cents by bank transfer (melio.com/pricing). PayPal charges 3.49 percent plus 49 cents for an invoice paid through PayPal Checkout, 2.99 percent plus 49 cents for standard card payments, and 1 percent capped at $10.00 for Pay by Bank, from its US business fees page which prints 1 September 2026 as its own last updated date. Helcim charges 0.5 percent plus 25 cents on a bank payment, capped at $6 (helcim.com/pricing). Vendor pricing moves; re-read the source rather than trusting the date on this page.",
    "The buyer side uses simple interest on the discounted amount across the credit period, because that is what a single draw on a line of credit costs, and the break-even borrowing rate it reports is exactly the nominal annualized cost, which is an algebraic identity rather than a coincidence. It does not model an origination fee, a minimum draw, an unused line fee, or the tax treatment of the discount or the interest. The seller side values the released cash at your cost of capital for one year and computes it on sales net of the discount, assumes customers who decline keep paying on the day they do now, and does not model bad debt avoided, collection effort saved, or customers who take the discount and still pay late, which is a real and unpriced risk in US trade credit.",
    "The card comparison assumes the statement is paid in full on its due date. Carrying the balance past that point adds card interest that is larger than every figure on this page. Rewards rates on business bill payments are set by your issuer and some categories are excluded from earning at all.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "What does 2/10 net 30 mean?",
      answer:
        "Take 2 percent off if you pay within 10 days of the invoice date, otherwise pay the full amount within 30 days. On a $10,000 invoice that is $9,800 on day 10 or $10,000 on day 30. The 2 percent buys the supplier 20 days, which is why skipping it is a borrowing decision rather than a discount you can politely decline for free.",
    },
    {
      question: "What is 2/10 net 30 as an annual interest rate?",
      answer:
        "37.24 percent nominal, or 44.59 percent as a compounded effective annual rate. The nominal figure is 0.02 divided by 0.98, which is 2.0408 percent over 20 days, multiplied by the 18.25 twenty day periods in a 365 day year. On a 360 day year the same terms come to 36.73 percent. Most calculators publish only the nominal number and describe it as an APR.",
    },
    {
      question: "How do you calculate the cost of trade credit?",
      answer:
        "Divide the discount by one minus the discount, then multiply by the year divided by the number of days between the discount date and the net date. For 3/10 net 30 that is 0.03 divided by 0.97, giving 3.0928 percent, multiplied by 365 divided by 20, giving 56.44 percent. Dividing by one minus the discount rather than by one matters: it is worth 1.7 points on a 3 percent discount.",
    },
    {
      question: "Is it worth taking a 2/10 net 30 discount?",
      answer:
        "Almost always, yes. The break-even is your own borrowing rate against 37.24 percent. With the bank prime loan rate at 6.75 percent as of the Federal Reserve's H.15 release of 4 September 2026, borrowing $9,800 for 20 days costs $36.25 against a $200 discount, a net gain of $163.75 per invoice. Only funding priced above 37.24 percent, such as some merchant cash advances, makes skipping it correct.",
    },
    {
      question: "Should I offer my customers an early payment discount?",
      answer:
        "Usually not, at 2 percent. Your break-even is the discount annualized over the days you actually gain, and against customers who pay at day 45 today, 2/10 works out at a 21.28 percent cost of capital. On $1,200,000 of credit sales with 40 percent take-up, the discount costs $9,600 a year and releases cash worth $3,044.71, a net loss of $6,555.29. Take-up scales that loss and never reverses it.",
    },
    {
      question: "Should I pay a supplier by credit card to get the early payment discount?",
      answer:
        "Only if rewards and float cover the fee. At Melio's published 2.9 percent US card fee, capturing a $200 discount on a $10,000 invoice costs $284.20, so the discount alone loses money. Add 1.5 percent of rewards, which is $147.00, and five days of statement float worth $9.32, and the card route wins by $72.12. The break-even rewards rate at a 2.9 percent fee is 0.76 percent.",
    },
  ],
  related: [
    "cash-conversion-cycle-calculator",
    "invoice-factoring-calculator",
    "business-loan-amortization-calculator",
    "ach-vs-credit-card-fee-calculator",
    "apr-vs-apy-calculator",
  ],
  links: [
    { label: "All calculators", href: "/tools" },
    { label: "Processors with built-in invoicing", href: "/payment-processors/with-invoicing" },
    { label: "Payment processors for small businesses", href: "/category/small-business" },
    { label: "Settlement, explained", href: "/glossary/settlement" },
    { label: "How we research and check these numbers", href: "/methodology" },
  ],
  cta: {
    heading: "The cheapest way to get paid sooner is usually not a discount",
    body: "A 2 percent discount costs $200 on a $10,000 invoice. A bank payment rail costs $6 to $10 to collect the same invoice, and every customer can use it rather than only the ones who would have taken a discount. Compare the two rails on your own average ticket first.",
    label: "Compare ACH against card fees",
  },
};
