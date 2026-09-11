import type { ToolDef } from "@/lib/tools";

/**
 * Third batch of `/tools/*` entries: general money arithmetic.
 *
 * WHY THESE ARE IN THEIR OWN MODULE. Every other tool in the registry answers a
 * question a merchant has about their processor. These two answer a question
 * about interest, which is adjacent rather than native, so they are fenced off
 * where the difference is visible instead of buried in the middle of
 * `tools-more.ts`. If the section is ever pruned back to payments-only, this is
 * the file to delete.
 *
 * They still obey the anti-cannibalisation rule in `lib/tools-data/index.ts`: a
 * tool owns the CALCULATION modifier and nothing else. Neither page tries to
 * rank for a definition (that is `/glossary`), a comparison (`/compare`) or a
 * processor's pricing (`/processor/<slug>`), and both link into the pages that
 * do. Where they touch this site's actual subject, they touch it honestly: a
 * rolling reserve really is a lump sum sitting still for a term, and a merchant
 * cash advance really is priced in a way that has no interest rate in it at all.
 *
 * ON THE NUMBERS. Every figure in the copy below is arithmetic this page's own
 * code produces, and was checked against `lib/tools-math.ts` before shipping,
 * not asserted from memory. The two exceptions are sourced and dated: the
 * Regulation DD formula and its worked example, and the FDIC national deposit
 * averages. Those live in `lib/tools-data/interest.ts` with their citations.
 */

const NOT_ADVICE =
  "This is arithmetic on the figures you entered, not financial advice and not an offer. Your account agreement or loan note is the authority on what you will actually earn or owe.";

export const MONEY_TOOLS: ToolDef[] = [
  // -------------------------------------------------------------------------
  {
    slug: "compound-interest-calculator",
    name: "Compound Interest Calculator",
    h1: "Compound Interest Calculator",
    title: "Compound Interest Calculator: Growth With Contributions",
    description:
      "Calculate compound interest with regular contributions at your chosen rate and compounding frequency. See how your balance and interest grow over time.",
    intro:
      "Enter an opening balance, a rate, a term, how often interest is added and what you pay in along the way. You get back your opening deposit, your contributions, the interest and the closing balance. Most calculators stop there. This one also runs the same deposits through simple interest at the same rate, because compounding only means something next to the alternative. On the defaults it comes to $2,853.16 of a $55,290.66 balance. The other $12,437.50 of interest would have turned up either way.",
    tier: 3,
    summary: "Project a balance with contributions and any compounding frequency, and see what compounding is worth over simple interest.",
    widget: "compound-interest",
    workedExample: {
      scenario:
        "You open an account with $10,000 and add $250 at the end of every month. It pays a nominal 5% a year, compounded monthly, and you leave it alone for ten years. Three questions: what do you end with, how much of that is interest rather than your own money, and how much of the interest is there only because earlier interest earned interest?",
      result:
        "You end with $55,290.66. Of that, $10,000 is the opening balance, $30,000 is the 120 monthly deposits and $15,290.66 is interest. A nominal 5% compounded monthly is an APY of 5.1162%, because the twelve additions inside the year each earn for the rest of it. Run the same deposits with interest that never compounds and you get $52,437.50, so compounding is worth the $2,853.16 difference, or 18.7% of the interest. The effect arrives late. Year one earns $581.33. Year ten earns $2,611.40 off the same $250 a month, 4.5 times as much, because the balance doing the earning is four and a half times bigger. Stretch the plan to thirty years and interest becomes $152,742.10 of a $252,742.10 balance: 60.4% of the account is money you never deposited, against 16.2% at the five year mark.",
    },
    sections: [
      {
        heading: "Why the first years feel like nothing is happening",
        body: [
          "The mechanic is one line. Interest gets added to the balance, and after that the interest earns interest too. It needs a calculator because the curve is not a straight line, and people misjudge it in a consistent direction. Short horizons get over-estimated. Long ones get badly under-estimated.",
          "Run the defaults out and watch how much of the balance is interest instead of deposits. Five years, 16.2%. Ten years, 27.7%. Twenty, 46.1%. Thirty, 60.4%. The only thing changing is the number of years. Somewhere in the third decade the account stops being mostly your own money.",
          "The same thing happens inside a single run. Year one earns $581.33. Year ten earns $2,611.40, off an identical $250 a month. The rate never accelerated. The balance doing the earning just got bigger, which is why the early years feel like nothing is happening, and why starting feels least worthwhile at the point it matters most.",
          "It is also why the comparison has to be against simple interest and not against zero. Same deposits, same rate, no compounding: $52,437.50. With compounding: $55,290.66. The $2,853.16 gap is what compounding bought, a fifth of the $15,290.66 of interest. Pages that hand you the total interest and call it the compounding effect are out by a factor of five.",
        ],
      },
      {
        heading: "APY is the number US law defines",
        body: [
          "You cannot compare two accounts on their nominal rates. 5% compounded monthly and 5% compounded annually are different products wearing the same number. What settles it is the effective annual rate, and in the United States that has a legal definition rather than a conventional one.",
          "Appendix A to 12 CFR Part 1030, Regulation DD under the Truth in Savings Act, gives the general formula as APY = 100 [(1 + Interest/Principal)^(365/Days in term) - 1], where Principal is what was assumed deposited at the start, Interest is the total dollars earned over the term, and Days in term is the actual number of days. For a 365 day term it collapses to APY = 100 (Interest/Principal). The regulation supplies its own example: an institution paying $30.37 on a $1,000 six month certificate over a 182 day period discloses an annual percentage yield of 6.18%. Put those numbers into the simple interest calculator here and it returns 6.1837%, which rounds to the regulation's figure.",
          "So compare APYs, never nominal rates. Any US deposit account has to disclose one, so the comparison is always there for you. If someone quotes a rate without saying how often it compounds, ask, because until you know that you do not yet have a number.",
          "The calculator shows the APY for whichever frequency you pick. Switch the selector and the APY moves while the rate you typed sits still. That is all compounding frequency does.",
        ],
      },
      {
        heading: "Frequency is the input that changes the answer least",
        body: [
          "It is also the one people fiddle with most. Take $10,000 at a nominal 4.50% for one year. Compounded annually it earns $450.00. Semiannually, $455.06. Quarterly, $457.65. Monthly, $459.40. Daily, $460.25. Continuously, the ceiling no real product pays, $460.28.",
          "Annual to daily is $10.25 on $10,000, and daily lands three cents short of the theoretical maximum. Nothing is left past daily. That is why no product compounds more often, and why continuous compounding stays a teaching device.",
          "Rate and term are the levers. Half a point on that same $10,000, 4.50% to 5.00%, is worth $50.00 against the $10.25 the entire frequency range buys. One extra year beats both. If one account compounds daily and the other pays a tenth of a point more, take the tenth of a point.",
          "The continuous option exists to settle that question rather than approximate it. On the defaults it beats monthly by $38.79 over ten years, and that is the most frequency can ever be worth to you. Knowing the ceiling is $38.79 over a decade is useful before anyone sells you a compounding schedule.",
        ],
      },
      {
        heading: "The Rule of 72, and where it is wrong",
        body: [
          "Divide 72 by the rate for roughly the years to double. It is a good approximation and it is wrong predictably, so this calculator prints the exact figure beside it instead of passing the shortcut off as fact.",
          "Exact doubling time is ln(2) divided by ln(1 + effective annual rate). At 1% the rule says 72 years and the truth is 69.66, overstating by 2.34 years. At 2% it says 36 against 35.00. At 4%, 18 against 17.67. At 6%, 12 against 11.90. At 8% it is 9 against 9.006, effectively exact. Above 8% the error changes sign: at 12% the rule says 6 years against 6.12, at 20% it says 3.6 against 3.80. So 72 flatters low rates and shortchanges high ones. It is at its best in the mid single digits, which is where most people use it anyway.",
          "The doubling figure here covers the opening balance and ignores your contributions. Fold fresh deposits into it and you are describing a savings plan, not growth. Mixing the two is how a calculator ends up claiming a savings account doubles your money in four years.",
          "At the FDIC national average savings rate of 0.38%, doubling takes 182 years. That is the argument for chasing the rate rather than the compounding schedule, in one number.",
        ],
      },
      {
        heading: "Where a merchant actually runs into this",
        body: [
          "Most compound interest calculators are built for retirement savers. Merchants arrive here for three other reasons, and each one changes a decision.",
          "A rolling reserve is a lump sum sitting still for a fixed term. A processor holding 10% of your card volume for 180 days is sitting on money you cannot deploy, and under almost every US merchant agreement it earns you nothing while it sits. Drop your reserve balance and holding period into the simple interest calculator at the FDIC money market average of 0.63% and you get the interest you are giving up. On $50,000 held for 180 days, $155.34. It is a small number and it should be. What a reserve costs you is the use of the cash, and $155.34 is not that. Work the figure out once so nobody can wave it around as a stand-in for the real damage.",
          "A merchant cash advance goes the other way. It has no interest rate, only a factor rate, so nothing on this page applies to it and there is nothing to compound. Type a factor rate in here and you get a confident, meaningless number. Use the factor rate to APR converter, which solves for the rate that makes the cash you received equal the stream of daily payments.",
          "The third is dull and real: cash you are holding anyway. Payout timing, settlement float and a reserve you have already agreed to all leave a balance parked somewhere for a known number of days. This page and its simple interest twin price that balance, and the FDIC table below says what the national averages currently are. Between them that is enough to separate a bank offer worth switching for from one worth $12 a year.",
          NOT_ADVICE,
        ],
      },
    ],
    rateTable: {
      caption:
        "FDIC national deposit averages effective 17 August 2026, with what $10,000 becomes at each rate on this page's own arithmetic. The FDIC defines the national rate as the average of rates paid by all insured depository institutions and credit unions for which data is available, weighted by each institution's share of domestic deposits. These are averages. Individual institutions pay well above and well below them.",
      columns: ["National average", "APY, compounded monthly", "$10,000 after 10 years", "Years to double"],
      rows: [
        {
          label: "Savings",
          note: "Where most balances actually sit. Read the doubling column.",
          values: ["0.38%", "0.381%", "$10,387.25", "182 years"],
        },
        {
          label: "Money market",
          values: ["0.63%", "0.632%", "$10,650.09", "110 years"],
        },
        {
          label: "12-month CD",
          values: ["1.71%", "1.723%", "$11,863.46", "41 years"],
        },
        {
          label: "24-month CD",
          values: ["1.57%", "1.581%", "$11,698.76", "44 years"],
        },
        {
          label: "36-month CD",
          values: ["1.34%", "1.348%", "$11,433.07", "52 years"],
        },
        {
          label: "48-month CD",
          values: ["1.27%", "1.277%", "$11,353.41", "55 years"],
        },
        {
          label: "60-month CD",
          note: "Longer is not automatically higher. The 60 month average sits above both the 36 and 48 month averages here. That is the curve on the day it was read, not a rule.",
          values: ["1.36%", "1.369%", "$11,455.94", "51 years"],
        },
      ],
    },
    assumptions: [
      "The defaults, $10,000 opening and $250 a month at 5% for ten years, are placeholders picked to make the arithmetic legible. They are not a forecast, and nobody is offering you that rate. Replace all four with your own figures before reading anything into the output.",
      "The rate is treated as fixed and known for the whole term, and every deposit is assumed to arrive in full and on time. Real accounts reprice, real savers skip months, and neither is modelled. A ten year projection at a rate nobody has committed to for ten years illustrates the arithmetic, not the future.",
      "The compounding frequency and the contribution frequency are independent, because in practice they are: daily compounding with monthly deposits is the normal case. The maths converts the nominal rate to an effective annual rate first, then to a rate per contribution period. That is exact for any pairing, rather than an approximation that only holds when the two happen to match.",
      "Contribution timing is a switch, and it moves the answer. Deposits at the end of each period, the default, earn nothing in the period they arrive. Deposits at the start earn for the full period. On the defaults that is $161.75 over ten years. Small, but it decides which of two calculators agrees with your statement.",
      "Nothing here models tax, inflation, fees or early withdrawal penalties, and all four are real. Interest on a US deposit account is generally taxable in the year it is credited, so the after-tax figure is lower than the number shown, and an inflation-adjusted figure is lower again. Treat the output as a gross nominal balance.",
      "The FDIC averages in the table above are national averages published by the FDIC, effective 17 August 2026. The FDIC republishes them monthly, so re-check the source before quoting them. The derived columns beside them are computed by this page, not published by the FDIC.",
    ],
    faqs: [
      {
        question: "What is the compound interest formula?",
        answer:
          "For a lump sum it is A = P(1 + r/n)^(nt), where P is the opening balance, r is the nominal annual rate as a decimal, n is the number of compounding periods a year, and t is the number of years. $10,000 at 5% compounded monthly for ten years is 10,000 x (1 + 0.05/12)^120 = $16,470.09. Regular deposits need a second term, the future value of an annuity. This calculator handles the two frequencies separately instead of assuming your deposits land exactly when interest is credited: it works out the effective annual rate, converts that to a rate per deposit period, then steps through the term. That gives the same answer as the closed form when the frequencies match, and the right answer when they do not.",
      },
      {
        question: "How much difference does compounding frequency really make?",
        answer:
          "Much less than the term or the rate. On $10,000 at a nominal 4.50% for one year, annual compounding earns $450.00, quarterly earns $457.65, monthly earns $459.40 and daily earns $460.25. Continuous compounding, the mathematical ceiling that no product pays, earns $460.28, so daily lands within three cents of the maximum possible. The whole annual-to-daily range is $10.25 on $10,000. A tenth of a percentage point on the rate beats any change in frequency, which is why comparing APYs settles the question and comparing compounding schedules does not.",
      },
      {
        question: "What is the difference between compound interest and simple interest?",
        answer:
          "Simple interest is paid only on the money you deposited. Compound interest is paid on the deposits and on the interest already credited. Over short terms the gap is close to nothing: $25,000 at 9% for 30 days earns $184.93 either way, to the cent. Over long terms it takes over. On this page's defaults, ten years of $250 a month on a $10,000 opening balance ends at $55,290.66 compounded against $52,437.50 simple, a gap of $2,853.16. Watch the proportion, because it gets misstated constantly. Total interest is $15,290.66, and compounding accounts for $2,853.16 of it. The other $12,437.50 would have been earned anyway.",
      },
      {
        question: "How long does it take to double your money?",
        answer:
          "The exact figure is ln(2) divided by ln(1 + the effective annual rate). The Rule of 72 approximates it by dividing 72 by the rate, and this calculator prints both so you can see the error. The rule is nearly perfect at 8%, where it says 9 years against a true 9.006. Below that it overstates: at 1% it says 72 years against 69.66. Above that it understates: at 20% it says 3.6 years against 3.80. For a sense of scale on real deposit rates, the FDIC national average savings rate of 0.38% doubles money in 182 years. The doubling figure here covers the opening balance only and leaves your contributions out, because a doubling time that counts fresh deposits is describing a savings plan rather than growth.",
      },
      {
        question: "Should contributions be set at the start or the end of the period?",
        answer:
          "Match whichever your account actually does. If you do not know, use the end of the period, which is the default here and the more conservative of the two. A deposit at the start earns interest for that whole period, an annuity due in the language of the formula. A deposit at the end earns nothing until the next one. On the defaults the difference is $161.75 over ten years on a $55,290.66 balance, so it will not change a decision, but it will decide whether this calculator agrees with your bank statement, and that is usually why anyone is checking.",
      },
      {
        question: "Does this calculator account for tax and inflation?",
        answer:
          "No, and both matter more than most of the inputs it does model. Interest credited to a US deposit account is generally taxable in the year it is credited, so the balance you keep is smaller than the balance shown, and how much smaller depends on your marginal rate rather than on anything here. Inflation is a second, separate reduction in what the balance buys. The output is a gross nominal projection. Use it to compare two options on identical assumptions, not to predict a future amount of spendable money.",
      },
    ],
    related: [
      "simple-interest-calculator",
      "rolling-reserve-calculator",
      "merchant-cash-advance-calculator",
    ],
    links: [
      { label: "Simple interest calculator", href: "/tools/simple-interest-calculator" },
      { label: "Rolling reserve calculator", href: "/tools/rolling-reserve-calculator" },
      { label: "Merchant cash advance calculator", href: "/tools/merchant-cash-advance-calculator" },
      { label: "Rolling reserve, defined", href: "/glossary/rolling-reserve" },
      { label: "Payout time, defined", href: "/glossary/payout-time" },
      { label: "Settlement, defined", href: "/glossary/settlement" },
      { label: "All free calculators", href: "/tools" },
      { label: "How we research and check these numbers", href: "/methodology" },
    ],
    cta: {
      heading: "The money you cannot compound is the money your processor is holding",
      body: "Interest on an idle balance is worth a few hundred dollars a year. What decides how much of your revenue is idle in the first place is payout timing and reserve terms, and those vary far more between processors than deposit rates vary between banks. See how the major US processors compare on payout speed, reserve policy and pricing model.",
      label: "Compare payment processors",
    },
  },

  // -------------------------------------------------------------------------
  {
    slug: "simple-interest-calculator",
    name: "Simple Interest Calculator",
    h1: "Simple Interest Calculator",
    title: "Simple Interest Calculator: Actual/360 & Actual/365",
    description:
      "Calculate simple interest using Actual/360, Actual/365 or other day-count conventions. See total interest, repayment amount and the effective annual rate for the term.",
    intro:
      "Simple interest is I = P x R x T and takes four seconds to work out, so the fair question is why it needs a page. The answer is the T. A term counted in days has to be divided by an assumed year length, and US commercial lending routinely assumes 360 days instead of 365. That turns a 9.00% note into a 9.125% one without touching the rate on the paper. This calculator makes the day count an input, shows the rate the convention actually charges, and runs the result through Regulation DD's APY formula so you can hold a short-dated deal up against anything else.",
    tier: 3,
    summary: "Simple interest on any term, with the Actual/360 day count and the effective rate it really charges.",
    widget: "simple-interest",
    workedExample: {
      scenario:
        "A $25,000 short-term note at 9% a year, running 180 days, with interest computed on an Actual/365 basis and paid at maturity along with the principal. You want the interest, the daily accrual, and a figure that lets you set this deal beside a compounding one.",
      result:
        "Interest is 25,000 x 0.09 x (180/365) = $1,109.59, so $26,109.59 is due at maturity and the note accrues $6.16 a day. The annual percentage yield on those dollars, by Regulation DD's formula 100[(1 + 1,109.59/25,000)^(365/180) - 1], is 9.2054%: above the stated 9% because the formula assumes the money comes back and is re-earned for the rest of the year. Now change one thing and nothing else. Switch the day count to Actual/360 and the same 180 days costs $1,125.00, or $15.41 more, because 180/360 is half a year while 180/365 is not. The effective rate is 9.125%, not 9%. Over a full 365 days the gap opens to the whole difference between the two conventions: $2,250.00 against $2,281.25 on $25,000, and $1,250 a year on a $1,000,000 balance.",
    },
    sections: [
      {
        heading: "The formula is one line. The time fraction is the problem",
        body: [
          "Simple interest is I = P x R x T. Principal times annual rate times time in years. Interest never joins the principal, so the balance earning interest on the last day is the same as on the first, and the accrual per day is constant.",
          "Everything interesting sits in T, and T is a division. A term in years or months is unambiguous, because six months is half a year to anyone. A term in days is not, because the denominator is a convention rather than a fact. Divide 180 days by 365 and you get 0.4931 of a year. Divide it by 360 and you get 0.5000. On $25,000 at 9% that is the difference between $1,109.59 and $1,125.00.",
          "This calculator makes the denominator an input instead of a hidden assumption, and it only offers the choice when the term is counted in days, because that is the only time the choice exists. A six month term is half a year under either convention and no day count changes it.",
          "One more thing about simple interest: the daily accrual never moves. On the worked example it is $6.16 a day from day one to day 180. If a lender quotes you a per diem that rises over the term, you are not looking at simple interest, whatever the paperwork calls it.",
        ],
      },
      {
        heading: "Actual/360 is a rate increase that never appears in the rate",
        body: [
          "The convention is straightforward once stated. Interest accrues at the annual rate divided by 360, and is charged for the actual number of days elapsed. Since a year has 365 days, a borrower pays 365 days of a rate calibrated to a 360 day year.",
          "The multiplier is 365/360, or 1.0139. A 9.00% note accrues at 9.125%. An 8.00% note accrues at 8.111%. The quoted rate is unchanged, the document is accurate, and the borrower pays 1.39% more interest than the rate implies. On $100,000 at 8% for a year that is $8,111.11 rather than $8,000.00. On $1,000,000 at 9%, it adds $1,250 a year.",
          "None of this is a trick. It is a stated convention and it is normal in US commercial lending. It only becomes a problem when a borrower sets an Actual/360 quote against an Actual/365 quote as though the two rates were the same unit. They are not. Convert both to the same basis first, which is what the effective rate output here is for.",
          "The direction never reverses, which makes it easy to remember. Actual/360 always favours the lender on a loan and always favours the depositor on a deposit, for the same reason: it counts more days of accrual than a 360 day year contains. If you are the one paying, ask which basis the note uses before you compare anything.",
        ],
      },
      {
        heading: "When the compounding gap is a rounding error, and when it is not",
        body: [
          "Simple interest usually gets presented as the poor relation. Over the terms it is actually used for, the difference barely exists, and the numbers below show that rather than assert it.",
          "Take $25,000 at 9%. Over 30 days, simple interest earns $184.93 and monthly compounding earns $184.92: identical, and marginally in simple interest's favour, because a 30 day term does not contain a full compounding period. Over 90 days the gap is $4.09. Over 180 days, $20.66. Over a full year, $95.17 on $2,250 of interest, a bit over 4%. Over three years it reaches $966.13, and by then the choice of convention is real money.",
          "Under a year, then, simple against compound is a rounding error, and arguing about it costs more than it saves. Past a year it compounds, in both senses, and the gap grows faster than the term does.",
          "The same arithmetic explains why short-dated instruments get quoted simple in the first place. There is nothing meaningful to hide over 30 or 90 days, and simple interest is easier to compute, easier to check and easier to prorate if the borrower repays early.",
        ],
      },
      {
        heading: "APY is how you compare a simple-interest deal to anything else",
        body: [
          "A simple-interest quote and a compounding quote are not directly comparable, and the fix is the one US law already mandates for deposits. Appendix A to 12 CFR Part 1030, Regulation DD under the Truth in Savings Act, defines APY = 100 [(1 + Interest/Principal)^(365/Days in term) - 1], where Days in term is the actual number of days in the term.",
          "This page runs your result through that formula. On the worked example the 9% note over 180 days returns an APY of 9.2054%, higher than the stated rate because annualising assumes the money comes back and is re-earned for the rest of the year. The direction reverses past a year: the same 9% simple over three years is an APY of 8.2932%, because a deal that never compounds falls further behind the annualised standard the longer it runs.",
          "You can check the formula against the regulation's own example. Regulation DD states that an institution paying $30.37 in interest on a $1,000 six month certificate, where the six month period contains 182 days, discloses an annual percentage yield of 6.18%. Enter $1,000, 6.0907%, 182 days on an Actual/365 basis, and this calculator returns $30.37 of interest and an APY of 6.1837%. That is the regulation's own figure to two decimal places.",
          "One caution on the exponent. The Reg DD formula uses actual days in the term, so it always divides by 365, even when the interest itself accrued on a 360 day basis. That is deliberate. The accrual convention decides how many dollars you earned, and the APY formula then annualises those dollars over real time. Mixing 360 into the exponent counts the convention twice.",
        ],
      },
      {
        heading: "Where merchants meet simple interest, and where they only think they do",
        body: [
          "Three things on this site run into this page. Start with the one that catches people out.",
          "A merchant cash advance is priced with a factor rate, a flat multiplier with no time in it, so there is no interest rate to put into this calculator and no term to divide by. A 1.30 factor on $50,000 means you repay $65,000 whether it takes six months or eighteen, and the same $15,000 charge is roughly 111% APR at one speed and roughly 37% at another. Type a factor rate in here and the answer is arithmetically fine and financially meaningless. Use the factor rate to APR converter, which solves for the rate that makes the cash you actually received equal the stream of daily payments.",
          "The case that does fit is money held still for a known number of days, and a rolling reserve is the clearest one. A processor holding 10% of your card volume for 180 days is holding a fixed sum for a fixed term, which is exactly the shape this formula wants. At the FDIC money market national average of 0.63%, a $50,000 reserve held 180 days gives up $155.34 of interest. Work that out once and you can see what a reserve does not cost you. The damage is the cash being unavailable to run the business, and calling $155.34 the damage understates it by an order of magnitude.",
          "The third is a short-term note or a working capital line, which is where the day count section earns its place. If you are borrowing against receivables or taking a bank line to bridge a payout cycle, the quote will usually be simple interest on an Actual/360 basis, and the rate you compare it against needs converting before you compare it.",
          NOT_ADVICE,
        ],
      },
    ],
    rateTable: {
      caption:
        "$25,000 at 9% across a range of terms, computed on this page rather than sourced. Interest and APY are on an Actual/365 basis. The last column is what the same principal and term would produce with monthly compounding, to show where the gap stops being a rounding error. Every cell is arithmetic you can reproduce with the widget above.",
      columns: ["Simple interest", "Total at maturity", "APY", "Gap vs monthly compounding"],
      rows: [
        {
          label: "30 days",
          note: "Compounding is marginally behind here, because a 30 day term does not contain a full monthly compounding period.",
          values: ["$184.93", "$25,184.93", "9.3812%", "-$0.01"],
        },
        { label: "90 days", values: ["$554.79", "$25,554.79", "9.3098%", "$4.09"] },
        { label: "180 days", values: ["$1,109.59", "$26,109.59", "9.2054%", "$20.66"] },
        {
          label: "365 days",
          note: "At exactly one year the APY equals the stated rate. It is the only term where the two agree.",
          values: ["$2,250.00", "$27,250.00", "9.0000%", "$95.17"],
        },
        {
          label: "3 years",
          note: "Past a year the APY falls below the stated rate, because a deal that never compounds loses ground against the annualised standard every year it runs.",
          values: ["$6,750.00", "$31,750.00", "8.2932%", "$966.13"],
        },
      ],
    },
    assumptions: [
      "Simple interest means interest is never added to the principal, so the accrual per day is constant for the whole term. If your agreement capitalises unpaid interest at any point, even once, this is the wrong calculator and the compound interest calculator is the right one.",
      "A term entered in days is divided by the day basis you select, 365 or 360. A term entered in months or years is not, because no days were counted: six months is half a year under either convention. The day basis selector therefore only appears when the unit is days, which is the only place it legitimately applies.",
      "The Actual/360 option models the convention as it is normally written: accrue at the annual rate divided by 360, for the actual number of days elapsed. That produces an effective rate of 365/360 times the quoted rate, so the page reports it separately and the comparison against an Actual/365 quote stays out in the open.",
      "The APY output uses the general formula in Appendix A to 12 CFR Part 1030 and always divides by the actual days in the term, never by 360, even when the interest accrued on a 360 day basis. That is deliberate. The accrual convention decides how many dollars were earned; the APY formula then annualises those dollars over real elapsed time.",
      "Months are converted at 365/12 days for the per-day and APY figures. Institutions vary here and some use a 30 day month, so a result stated in months can differ by a few cents from a statement computed another way. Enter the term in days if you need to match a specific document to the cent.",
      "Nothing here models tax, fees, origination charges, prepayment penalties or early repayment, and it makes no assumption about how the interest is paid. It computes what accrues over the term you entered. Your note or account agreement governs everything else.",
      "The defaults, $25,000 at 9% for 180 days, are a placeholder chosen to make the day count effect visible. They are not a rate anyone is offering.",
    ],
    faqs: [
      {
        question: "What is the simple interest formula?",
        answer:
          "I = P x R x T. Principal times the annual rate as a decimal times time in years. $25,000 at 9% for 180 days on a 365 day basis is 25,000 x 0.09 x (180/365) = $1,109.59, and $26,109.59 is repaid at maturity. The part that trips people up is T, because a term in days has to be divided by an assumed year length, and US commercial lending often assumes 360 days rather than 365. The same $25,000 over the same 180 days is $1,125.00 on an Actual/360 basis. Terms in months or years are unaffected, since no days were counted.",
      },
      {
        question: "What is Actual/360 and why does it cost more?",
        answer:
          "Actual/360 means interest accrues at the annual rate divided by 360, charged for the actual number of days elapsed. Because a calendar year has 365 days, a borrower pays 365 days of interest at a rate calibrated to a 360 day year, so the effective rate is 365/360 of the quoted rate, a multiplier of about 1.0139. A 9.00% note accrues at 9.125%, and an 8.00% note at 8.111%: $8,111.11 rather than $8,000.00 on $100,000 for a year. On $1,000,000 at 9% the convention adds $1,250 a year. It is a stated convention rather than a trick, but it makes an Actual/360 quote and an Actual/365 quote non-comparable at face value, which is why this calculator reports the effective rate alongside the interest.",
      },
      {
        question: "When is simple interest better than compound interest?",
        answer:
          "As a borrower, always, because compounding charges you interest on interest. As a saver, never over a long term, and effectively never either way over a short one. On $25,000 at 9%, simple and monthly compounding are identical to the cent over 30 days, differ by $4.09 over 90 days and by $20.66 over 180 days. Over a full year the gap is $95.17 on $2,250 of interest, and over three years it is $966.13. So under a year the distinction is not worth arguing about, and past a year it is the main thing separating two otherwise identical quotes.",
      },
      {
        question: "How do you compare a simple interest deal to a compounding one?",
        answer:
          "Convert both to APY, the comparison US law already defines for deposits. Appendix A to 12 CFR Part 1030 gives APY = 100 [(1 + Interest/Principal)^(365/Days in term) - 1], and this calculator applies it automatically. Expect two things. On a term shorter than a year the APY exceeds the stated rate, because annualising assumes the money comes back and is re-earned: 9% over 180 days is an APY of 9.2054%. On a term longer than a year it falls below, because a deal that never compounds loses ground against the annualised standard: 9% simple over three years is an APY of 8.2932%. At exactly 365 days the two are equal, and that is the only term where they agree.",
      },
      {
        question: "Is a merchant cash advance simple interest?",
        answer:
          "No, and this is the most common misuse of a simple interest calculator in payments. An advance is priced with a factor rate, a flat multiplier that contains no time at all. A 1.30 factor on $50,000 means $65,000 is repaid, and the charge is the same $15,000 whether repayment takes six months or eighteen. So there is no rate to enter here and no term to divide by, and the answer this page would give you is arithmetically valid and financially meaningless. Because the price does not move with speed, the annualised cost swings enormously: the same 1.30 factor is roughly 111% APR when a 10% holdback clears it in about 137 banking days, and roughly 37% when it stretches over eighteen months. Use the merchant cash advance calculator, which solves for the rate that makes the cash you actually received equal the stream of daily payments.",
      },
      {
        question: "How do I calculate daily interest on a loan?",
        answer:
          "Under simple interest the daily accrual is constant: principal times the annual rate divided by the day basis. $25,000 at 9% on a 365 day basis accrues 25,000 x 0.09 / 365 = $6.16 a day, every day of the term. On a 360 day basis it is $6.25 a day, which is where the extra cost of that convention comes from. This calculator shows the per-day figure directly. If a lender quotes a per diem that rises over the term, the loan is not simple interest regardless of how it is described, and you want the compound interest calculator instead.",
      },
    ],
    related: [
      "compound-interest-calculator",
      "merchant-cash-advance-calculator",
      "rolling-reserve-calculator",
    ],
    links: [
      { label: "Compound interest calculator", href: "/tools/compound-interest-calculator" },
      { label: "Merchant cash advance calculator", href: "/tools/merchant-cash-advance-calculator" },
      { label: "Rolling reserve calculator", href: "/tools/rolling-reserve-calculator" },
      { label: "Rolling reserve, defined", href: "/glossary/rolling-reserve" },
      { label: "Settlement, defined", href: "/glossary/settlement" },
      { label: "High-risk merchant, defined", href: "/glossary/high-risk-merchant" },
      { label: "All free calculators", href: "/tools" },
      { label: "How we research and check these numbers", href: "/methodology" },
    ],
    cta: {
      heading: "Before you borrow against your receivables, check what the processing is costing",
      body: "Short-term borrowing is usually a response to a cash flow gap, and for a card-accepting business that gap is normally made of two things: what the processor takes, and how long it holds the rest. Both are fixable without signing a note. Compare the major US processors on pricing model, payout speed and reserve policy first.",
      label: "Compare payment processors",
    },
  },
];
