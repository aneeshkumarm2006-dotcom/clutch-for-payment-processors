import type { ToolDef } from "@/lib/tools";

/**
 * The second batch of free tools, added 2026-09-04.
 *
 * Kept in its own module purely for file size: `lib/tools.ts` already carries the
 * rate cards and the shared types, and one 4,000 line registry is harder to
 * review than two. `lib/tools.ts` concatenates this into `TOOLS`, and the import
 * of `ToolDef` here is `import type`, so it is erased at compile time and there
 * is no runtime cycle between the two modules.
 *
 * Everything else about these is identical to the first batch: same `ToolDef`
 * shape, same route, same anti-cannibalisation rule (a tool owns the calculation
 * modifier and nothing else), same requirement for a dated assumptions block.
 * The constants each widget reads live in `lib/tools-data.ts`.
 */
export const MORE_TOOLS: ToolDef[] = [
  {
    slug: "merchant-cash-advance-calculator",
    name: "Merchant Cash Advance Calculator",
    h1: "Merchant Cash Advance Calculator: Factor Rate to APR",
    title: "Merchant Cash Advance Calculator: APR & Cost",
    description: "Calculate a merchant cash advance's estimated APR, total repayment and payoff time from the factor rate and holdback. Compare the true cost with other financing options.",
    intro: "A merchant cash advance is priced with a factor rate, not an interest rate, and a factor rate has no time in it. This Merchant Cash Advance Calculator takes the advance, the factor, the holdback percentage of your daily card settlement and your monthly card volume, and returns the number every funder leaves out: the annual percentage rate. The same 1.30 factor is roughly 109 percent APR if it clears in six months and roughly 37 percent if it takes eighteen. Nothing on the term sheet tells you which one you are signing.",
    tier: 2,
    summary: "Turn a factor rate and holdback into a real APR, total cost and estimated payoff date.",
    widget: "mca",
    workedExample: {
      scenario: "A two location taqueria doing $100,000 a month in card volume is offered $50,000 at a 1.30 factor rate, repaid with a 10 percent holdback of daily card settlement, plus a 2.5 percent underwriting fee. The advance, the factor and the holdback are the Federal Reserve Board's own published merchant cash advance illustration; the 2.5 percent set-up or underwriting fee is the figure the same Fed review found on one funder's website.",
      result: "Total repayment is 50,000 x 1.30 = $65,000, so the funder's charge is $15,000. The 2.5 percent underwriting fee is $1,250 and comes off the top, so $48,750 actually lands in the bank account. Total cost of capital is $16,250. Card volume of $100,000 a month spread over about 21 banking days is $4,761.90 a day, and a 10 percent holdback takes $476.19 of that every banking day, about $2,380.95 a week. Repaying $65,000 at $476.19 a day takes 137 banking days, roughly 6.5 months or 192 calendar days. Now solve for the rate that makes $48,750 received today equal to 136 daily payments of $476.19 plus a final $238.10: the daily rate is 0.4412 percent, and 0.4412 x 252 banking days = 111.19 percent APR. Strip out the underwriting fee and it is still 100.90 percent. Now change one input and nothing else: push the holdback to 20 percent. The dollars are identical, $65,000 on $50,000, but you finish in 69 banking days instead of 137, and the APR is 221.07 percent. Drop the holdback to 5 percent and the same $65,000 takes 273 banking days and costs 55.76 percent. One factor rate, three completely different prices.",
    },
    sections: [
      {
        heading: "A factor rate is a price with no time in it",
        body: [
          "A factor rate is a multiplier, not a rate. A 1.30 factor on $50,000 means you repay $65,000. That is the whole quote. Notice what is missing: when. Interest has time built into its definition, so 12 percent means 12 percent per year. A factor means nothing per anything. It is a flat markup with the clock removed.",
          "The Federal Reserve Board's review of online lender websites found one funder advertising factor rates \"usually between 1.14 and 1.48\" and another quoting rates \"as low as 1.15\". The Federal Trade Commission puts the same thing the other way round: the business repays the advanced amount plus a \"factor\", \"often between 20% to 50% of that amount.\" Call it 1.15 to 1.50 and you have covered most of the market.",
          "Because the markup is fixed, the only thing deciding what the money costs per year is how fast it comes back. The Fed's own illustration is $50,000 of capital in exchange for $65,000 of future receipts, collected as 10 percent of daily credit card sales. On $100,000 a month of card volume that clears in about 137 banking days, and by the actuarial method it is about 101 percent APR before fees. Stretch the identical $65,000 over eighteen months and it is about 37 percent. Same factor, two different products.",
        ],
      },
      {
        heading: "The holdback sets your APR, not the factor",
        body: [
          "The holdback, which New York's rule calls the split rate, is the share of each day's card settlement the funder takes before the money reaches you. On $100,000 a month of card volume across roughly 21 banking days, a 10 percent holdback is about $476 a day. Raise it to 20 percent and the same $65,000 clears in about 69 banking days instead of 137. The dollars did not change, but the APR went from about 111 percent to about 221 percent, because you had the money for half as long. Negotiate the holdback before the factor.",
          "Many advances are not a percentage at all: they debit a flat daily or weekly amount by ACH and reconcile afterwards, or never. The FTC flagged that some providers \"may fail to conduct promised 'true-ups' or 'reconciliations' to lower merchants' daily payment amounts to reflect drops in their sales,\" and said failing to adjust when sales fall \"would be concerning, and potentially unlawful.\" If your payment does not drop when January is bad, you carry all of the volume risk.",
          "PayPal Working Capital requires that \"you must pay at least 5% or 10% of your total loan amount (loan + the fixed fee) every 90 days,\" the 5 percent applying to loans estimated at twelve months or more. Shopify Capital sets minimums of \"30% of the total loan by the 6-month mark and 60% of the total payment amount by the 12-month mark\" inside an eighteen month maximum. Stripe is the instructive contrast: its US loans carry minimum payments, typically on a 30 or 60 day basis, with shortfalls debited from your bank account, while its US merchant cash advance says that \"unlike a loan, you don't have a fixed payment schedule or periodic debits.\" A published floor caps how slowly you repay. A true advance has none.",
        ],
      },
      {
        heading: "Why nobody quotes you an APR, and the states that changed that",
        body: [
          "The Truth in Lending Act does not reach this product. Regulation Z exempts \"an extension of credit primarily for a business, commercial or agricultural purpose\" and \"an extension of credit to other than a natural person.\" No APR box is federally required on any business financing, so a five figure funding offer can carry less cost disclosure than a store credit card. Funders argue it is not credit at all: Stripe describes its US merchant cash advance as YouLend's purchase of future receivables that \"isn't a loan or a credit transaction.\"",
          "States filled the gap. California's SB 1235 and the DFPI regulations effective December 9, 2022 require a disclosure table carrying an \"Estimated Annual Percentage Rate\" row, with the mandated sentence \"APR is not an interest rate. The cost of this financing is based upon fees charged by [financer] rather than interest that accrues over time.\" The industry sued and lost twice: summary judgment for the DFPI on December 4, 2023, affirmed by the Ninth Circuit on April 15, 2025 in Small Business Finance Association v. Mohseni. SB 362, chaptered October 6, 2025 and effective January 1, 2026, then barred using \"interest\" or \"rate\" deceptively.",
          "New York's 23 NYCRR Part 600, certified January 12, 2023, covers commercial financing of $2,500,000 or less. Its rate must be \"determined in accordance with either the United States Rule method or the actuarial method, as both are set forth in Appendix J, 12 C.F.R. Part 1026,\" shown to the nearest two decimal points. That is Truth in Lending math applied to a product Truth in Lending does not cover. A provider using the historical method fixes a look back window of \"no less than four months and no more than twelve months\" of sales. Connecticut, Florida, Georgia, Kansas, Missouri, Texas, Utah and Virginia have their own versions. Outside those ten states, nobody has to give you an APR.",
        ],
      },
      {
        heading: "Double dipping, and what a renewal actually costs",
        body: [
          "Around the halfway mark a broker will offer to renew you: more capital, one simple payment. New York wrote the clearest definition of the mechanic underneath by forcing funders to ask it on the disclosure form: \"Does the renewal financing include any amount that is used to pay unpaid finance charges or fees, also known as double dipping?\" Where the old deal carried a fixed finance fee, the rule makes the funder compute the answer pro rata against how much of the previous financing has been repaid.",
          "Put numbers on it: $50,000 at a 1.30 factor. Total repayment $65,000, of which $15,000 is the funder's charge. You are halfway through: you have paid $32,500 and you owe $32,500. Because the charge was fixed at the start rather than accrued over time, $7,500 of that payoff figure is finance charge you have not used yet. Renew, let the new advance retire the old balance, and that $7,500 is folded into your new principal and marked up a second time. At another 1.30 factor that is $2,250 for the privilege of paying twice for the same money.",
          "At the FTC's forum, panelists described businesses \"being forced to renew their advances or take out multiple MCAs at the same time, potentially encumbering the same receipts (a phenomenon known as 'stacking')\" simply to keep meeting the last set of payments. Ask for a payoff quote with the unearned finance charge broken out as a separate line, ask whether the renewal is net funded or gross funded, then price the deal on the new money only.",
        ],
      },
      {
        heading: "When this is the right call, and when it is not",
        body: [
          "None of this means never. An advance at triple digit APR is defensible in a narrow set of cases: the money buys inventory or a contract that returns more than it costs inside the repayment window, you cannot get a bank line in time, and the term is short. Paying $16,250 to unlock $50,000 is a good trade if it prevents a $60,000 loss or captures an $80,000 order. APR is the right way to compare offers. Total dollars against a specific return is the right way to decide whether to take one.",
          "It cannot bridge a shrinking business: the holdback scales with sales, so a bad quarter stretches the term rather than cutting the cost. The Federal Reserve Banks' 2026 Report on Employer Firms, published March 3, 2026 with findings from the 2025 Small Business Credit Survey, found that 60 percent of firms that borrowed from online lenders reported actual borrowing costs were higher than expected. The tail of that distribution is ugly: New York's Attorney General settled with Yellowstone Capital on January 22, 2025 over advances the office said carried rates \"up to 820 percent per year,\" cancelling $534,552,724 of small business debt, and won a judgment of more than $77,298,631 against Richmond Capital and related firms on February 8, 2024 over deals including a $10,000 advance repaid at $19,900 across ten days.",
          "Before you sign, get the estimated term in writing, since without it the factor rate is not a price. Read the reconciliation clause. Ask whether there is a personal guarantee or a confession of judgment attached. Check whether your processor offers a cheaper version first. Then compare it against the boring alternative: on $100,000 a month of card volume, shaving 40 basis points off your effective processing rate is $4,800 a year, with nothing to repay.",
        ],
      },
    ],
    rateTable: {
      caption: "Estimated APR for the same factor rate at different payoff speeds, computed on this page rather than sourced. Assumes a $50,000 advance repaid in equal daily amounts across 21 banking days a month with no fees, solved by the actuarial method and annualized over 252 banking days. Every cell is arithmetic you can reproduce with the method this page uses, not survey data about what funders charge.",
      columns: [
        "Repaid in 6 months",
        "Repaid in 9 months",
        "Repaid in 12 months",
        "Repaid in 18 months",
      ],
      rows: [
        {
          label: "1.20 factor",
          note: "Total repayment $60,000, cost $10,000",
          values: [
            "74.8%",
            "50.0%",
            "37.5%",
            "25.0%",
          ],
        },
        {
          label: "1.30 factor",
          note: "Total repayment $65,000, cost $15,000",
          values: [
            "109.3%",
            "73.0%",
            "54.8%",
            "36.6%",
          ],
        },
        {
          label: "1.40 factor",
          note: "Total repayment $70,000, cost $20,000",
          values: [
            "142.2%",
            "95.0%",
            "71.3%",
            "47.6%",
          ],
        },
        {
          label: "1.50 factor",
          note: "Total repayment $75,000, cost $25,000",
          values: [
            "173.8%",
            "116.1%",
            "87.2%",
            "58.2%",
          ],
        },
      ],
    },
    assumptions: [
      "Repayment is modeled on 21 banking days a month and 252 a year, because card settlement funds on banking days. If your funder debits seven days a week, the days to repay shown here will look longer than reality while the APR barely moves.",
      "The model holds your card volume flat at the figure you enter. Real volume moves and a real advance term moves with it, which is exactly why California and New York both require the term and the rate to be labeled estimates rather than facts.",
      "The APR is nominal: the daily rate multiplied by 252. That matches the actuarial method in Appendix J to 12 CFR Part 1026 that New York's rule points to. It is not compounded. Compounding the same daily rate produces a far bigger number that no state disclosure means and no funder owes you.",
      "Origination and underwriting fees are treated as prepaid finance charges, deducted from the cash you receive rather than added to the balance. Some funders instead finance the fee, which lowers the computed APR slightly, so check which one your offer does.",
      "The factor rate and fee figures come from a Federal Reserve website review conducted in August 2019 and published in December 2019, and from an FTC paper published in February 2020. They are the most recent federal figures I could verify and they will drift with the market. The list of ten disclosure states reflects a survey published in March 2026 and changes most legislative sessions, so treat both as dated rather than permanent.",
    ],
    faqs: [
      {
        question: "How do you convert a factor rate to an APR?",
        answer: "Multiply the advance by the factor to get total repayment, then subtract the advance to get the finance charge. Subtract any origination fee from the advance to get the cash you actually receive. Work out the daily payment from your holdback and card volume, and divide total repayment by it to get the number of banking days. Then solve for the daily rate that makes the net cash you received equal to that stream of daily payments, and multiply by 252 banking days. Worked through: a 1.30 factor on $50,000, repaid at a 10 percent holdback on $100,000 of monthly card volume with a 2.5 percent fee, takes 137 banking days and comes to 111.19 percent APR. The factor on its own tells you nothing, because it contains no term.",
      },
      {
        question: "What is a normal factor rate for a merchant cash advance?",
        answer: "The Federal Reserve Board's review of online lender websites found one funder advertising factor rates \"usually between 1.14 and 1.48\" and another quoting rates \"as low as 1.15\". The FTC describes the factor as \"often between 20% to 50%\" of the advance, which is the same thing expressed as 1.20 to 1.50. The trap is assuming a lower factor is automatically cheaper. On this page's method a 1.20 repaid in three months works out at about 149 percent a year, while a 1.40 repaid over eighteen months is about 48 percent. Always compare the APR, not the multiplier.",
      },
      {
        question: "Is a merchant cash advance a loan?",
        answer: "Funders structure it as a purchase of your future receivables rather than a loan, which is why the contract talks about buying receipts and why there is no stated interest rate. Stripe's documentation describes its US advance as YouLend's purchase of future receivables that \"isn't a loan or a credit transaction.\" That characterization is not always accepted. New York's Attorney General secured a settlement with Yellowstone Capital on January 22, 2025 on the basis that its transactions were disguised loans carrying annual rates up to 820 percent, above New York's usury limits. Whether a particular contract is a true sale or a loan turns on its specific terms, especially the reconciliation clause and whether repayment is genuinely contingent on your sales.",
      },
      {
        question: "Do merchant cash advance companies have to disclose an APR?",
        answer: "Not under federal law. Regulation Z exempts credit extended \"primarily for a business, commercial or agricultural purpose,\" so there is no federal APR requirement on any business financing. Several states now require one anyway. California's disclosure regulations took effect December 9, 2022 and were upheld by the Ninth Circuit on April 15, 2025; New York's Part 600 was certified January 12, 2023, covering financing of $2,500,000 or less. Both mandate an Estimated Annual Percentage Rate row on offers. Connecticut, Florida, Georgia, Kansas, Missouri, Texas, Utah and Virginia have passed their own versions. Outside those ten states, expect a factor rate and nothing else, which is why running the number yourself matters.",
      },
      {
        question: "What does double dipping mean on an MCA renewal?",
        answer: "It means being charged a second markup on finance charges you already owe from the first advance. New York forces funders to answer it directly on the disclosure form: \"Does the renewal financing include any amount that is used to pay unpaid finance charges or fees, also known as double dipping?\" Where the old deal carried a fixed finance fee, the amount is calculated pro rata from how much of the previous financing has been repaid. On a $50,000 advance at a 1.30 factor that is halfway repaid, $7,500 of the $32,500 payoff balance is finance charge you have not used yet. Roll that into a new 1.30 advance and it costs you another $2,250 before the new money buys anything.",
      },
    ],
    related: [
      "effective-rate-calculator",
      "credit-card-processing-fee-calculator",
      "interchange-plus-vs-flat-rate-calculator",
      "simple-interest-calculator",
    ],
    links: [
      {
        label: "How to lower payment processing fees",
        href: "/blog/how-to-lower-payment-processing-fees",
      },
      {
        label: "Best processors for high risk businesses",
        href: "/blog/best-processors-for-high-risk-businesses",
      },
      {
        label: "Rolling reserve, explained",
        href: "/glossary/rolling-reserve",
      },
      {
        label: "Underwriting, explained",
        href: "/glossary/underwriting",
      },
      {
        label: "Settlement, explained",
        href: "/glossary/settlement",
      },
      {
        label: "Payout time, explained",
        href: "/glossary/payout-time",
      },
      {
        label: "High risk payment processors",
        href: "/category/high-risk",
      },
      {
        label: "Compare all processors",
        href: "/processors",
      },
      {
        label: "How we test and score",
        href: "/methodology",
      },
    ],
    cta: {
      heading: "Fix the rate you pay every day before you price the advance",
      body: "An advance is a one time trade you can walk away from. Your processing rate is a charge on every transaction you will ever run. On $100,000 a month of card volume, forty basis points is $4,800 a year with nothing to repay, which is a third of what the worked example above pays a funder for six months of money. Work out your current effective rate first, then see what the same volume costs on interchange plus.",
      label: "Check your effective rate",
    },
  },
  {
    slug: "mcc-code-lookup",
    name: "Merchant Category Code Lookup",
    h1: "Merchant Category Code (MCC) Lookup",
    title: "MCC Code Lookup: Merchant Category Code Search",
    description: "Search US merchant category codes by business type and find the MCC assigned to your business. Check high-risk classifications and understand why your MCC matters for processing.",
    intro: "A merchant category code is the four digit number your acquiring bank attaches to your merchant account to say what you sell, and it quietly decides which interchange rates you are eligible for, whether your customers earn category rewards on their card, and how hard an underwriter looks at you. This Merchant Category Code Lookup lists 290 generic US MCCs taken from the April 2026 edition of Visa's Merchant Data Standards Manual, searchable by code or description and filterable by industry. Codes that Visa designates high integrity risk, or that sit in categories a mainstream aggregator like Stripe prohibits or restricts, are flagged. You cannot assign your own MCC, but you can find out what yours is and ask your acquirer to fix it.",
    tier: 2,
    summary: "Search 290 verified US merchant category codes, with high-risk flags.",
    widget: "mcc-lookup",
    workedExample: {
      scenario: "A property management company in Denver takes rent by card. When it was boarded, the sales rep picked MCC 7399, Business Services (Not Elsewhere Classified), from a dropdown. The business is property management, which is MCC 6513, Real Estate Agents and Managers. It runs 60 rent payments a month averaging $1,800, mostly on Mastercard Core consumer credit cards, on interchange plus pricing.",
      result: "Under MCC 6513 the transaction qualifies for Mastercard's Merit I Real Estate program at 1.43% plus $0.05. On $1,800 that is $25.74 plus $0.05, so $25.79 of interchange. Under MCC 7399 there is no category program, so it falls into plain Merit I at 1.95% plus $0.10, which is $35.10 plus $0.10, so $35.20. The four digits alone cost $9.41 on every rent payment. At 60 payments a month that is $564.60 a month and $6,775.20 a year, on identical transactions from identical cards. On interchange plus pricing the merchant absorbs all of that. On a flat rate plan the merchant would notice nothing, because the headline rate does not move, and the processor would keep the $6,775.20 instead.",
    },
    sections: [
      {
        heading: "What an MCC is, and who actually picks yours",
        body: [
          "A merchant category code is a four digit number attached to your merchant account that tells every bank in a transaction what you sell. Visa's own glossary defines it as a code designating the principal trade, profession, or line of business in which a merchant is engaged. The codes come from ISO 18245 and are shared across Visa, Mastercard, American Express and Discover, though each network words them slightly differently. The April 2026 edition of Visa's Merchant Data Standards Manual carries 934 of them. Roughly two thirds, 641 to be exact, are brand specific codes for individual airlines, car rental firms and hotel chains, which leaves 290 generic categories an ordinary US business can actually be assigned. Those 290 are what this tool lists.",
          "You do not choose your own. Visa Core Rule 1.5.1.11 puts the obligation on the bank: unless otherwise required by law, an acquirer must assign to a merchant outlet the MCC that most accurately describes its business. In practice that means whoever underwrote you: your acquiring bank on a traditional merchant account, or the payment facilitator on Stripe, Square or PayPal, where the code is usually derived from an industry dropdown you filled in at signup and forgot about. Stripe documents its fallback chain openly: if it cannot determine your MCC from the industry you selected, it looks at your website, and if that fails it uses the platform's MCC or its own default, 5734, Computer Software Stores.",
          "The same Visa rule requires more than one MCC in situations worth knowing about. A location with a fuel dispenser that also sells goods or services face to face needs two. So does a site with genuinely separate lines of business under separate merchant agreements, or one where a line of business is designated high integrity risk and the rest is not. Visa adds a fourth case that catches a lot of modern businesses: an ecommerce site that links out to a separate website qualifying for a different code needs a code for each. If you bolted a second business onto an existing merchant account rather than opening a new one, you are probably outside that rule.",
        ],
      },
      {
        heading: "Why four digits decide what you pay",
        body: [
          "Interchange is not one rate, it is a few hundred rates, and eligibility for the cheap ones is gated on your MCC. Mastercard's public US rate card for 2026 to 2027 says so in its footnotes. Merit I Insurance applies to MCCs 5960 and 6300 only. Merit I Real Estate applies to 6513 only. Merit I Day Care applies to 8351 only. The near free Payment Transaction Gaming rate applies to 7800, 7801, 7802, 7994 and 7995 and nothing else. On the debit side, the Emerging Markets education and government rate is limited to 7800, 8211, 8220, 8299, 9211, 9222, 9223, 9311, 9399 and 9402.",
          "The gaps between those programs are not rounding errors. On a Core consumer credit card, ordinary Merit I costs 1.95% plus $0.10. The real estate version of the same program costs 1.43% plus $0.05. That is 52 basis points and a nickel, and the only thing separating them is which four digits sit in your merchant record.",
          "Visa's debit schedule shows the same effect in a different shape. Card present on an exempt Visa check card, CPS/Supermarket is a flat $0.30 regardless of ticket size, while CPS/Retail is 0.80% plus $0.15. The two cross over at $18.75. Below that, retail pricing is cheaper. Above it, the supermarket program wins by a widening margin: on a $200 basket it is $0.30 against $1.75.",
          "The same code drives your customers' rewards. When a card offers 3x on dining, nothing about the food decides whether a purchase qualifies. The MCC decides it. Merchants sitting in a vague code such as 5999 sometimes get complaints that a purchase did not earn the category bonus a customer expected, and there is nothing anyone at the counter can do about it.",
        ],
      },
      {
        heading: "Three ways a wrong code costs you",
        body: [
          "The first cost is interchange, as above. It is invisible on a flat rate plan, because you pay the same headline rate whatever your MCC is and the processor keeps the difference. On interchange plus it lands entirely on you, which is an underrated argument for interchange plus: miscoding shows up on your statement instead of in someone else's margin.",
          "The second is the account itself. Aggregators underwrite by category, and a mismatch between the code on file and what your website plainly sells is a review trigger. Stripe says that when its review finds an inaccurate MCC it may change the code itself, regardless of who set it originally, that it notifies the platform by webhook, and that the platform cannot change it back and gets an error if it tries. Being reclassified into a restricted category by someone else's risk team is a worse outcome than declaring the category honestly at signup.",
          "The third is monitoring. Card networks measure dispute and fraud ratios against peer groups defined by MCC. A subscription business coded as ordinary retail gets measured against ordinary retail, where baseline dispute rates are low, so a perfectly normal subscription dispute rate can read as excessive and pull you into a chargeback monitoring program. There is a reporting angle too: box 2 of Form 1099-K is literally labeled merchant category code, so the category your processor has on file is the one that goes to the IRS, and a code that does not match how you file invites questions.",
        ],
      },
      {
        heading: "How to find yours, and how to get it changed",
        body: [
          "Check three places. Your monthly merchant statement usually prints it near the DBA name and merchant ID, sometimes labeled SIC rather than MCC. Your processor dashboard may expose it directly; on Stripe it is the business_profile.mcc field on the Account object, or configuration.merchant.mcc on the newer accounts API. Failing both, ask your account manager in writing, and ask them to confirm the four digits rather than describe your industry back to you.",
          "Changing it is not something you can do yourself. Visa's manual is explicit that to request a new MCC or a change to an existing one, members must submit a completed Visa Merchant Category Code Request Form, available on Visa Access. Members means banks and other licensed participants, not merchants. Your route is your acquirer, and the request travels further if you make their job easy: name the code you believe is correct, quote the network's description of it, explain why it fits better than the current one, and attach evidence.",
          "Expect friction in one specific case. If the change moves you into a cheaper interchange bucket and you are on flat rate pricing, your processor keeps that difference today and gains nothing from fixing it. Worth knowing before you read a slow response as ordinary bureaucracy. On interchange plus your processor is broadly indifferent, and the change usually moves faster.",
          "Do not shop for a code that flatters you. Picking a category that does not describe your business breaches your merchant agreement, and it is exactly the behavior the networks' integrity programs exist to catch. A cheaper interchange bucket is not worth a terminated account and a listing on MATCH.",
        ],
      },
      {
        heading: "Which codes acquirers treat as high risk",
        body: [
          "There is no single industry standard list, which is why so much of what gets published about high risk MCCs is guesswork. The closest thing to an authority is Visa's, printed in the same manual as the codes. In the April 2026 edition Visa designates as high integrity risk, for all card absent transactions: 5122, 5912, 5966, 5967, 5993, 7273 and 7995. For certain card absent transactions it adds 4816 for cyber lockers and file sharing, 6211 for financial trading platforms, 5968 for negative option subscriptions, 5816 for skilled game wagering such as daily fantasy sports, and 6051 and 6012 for crypto exchanges, wallets and on ramps.",
          "Past that list, high risk means whatever the processor you are applying to says it means. Stripe's published restricted businesses list, last updated 13 May 2026, prohibits or restricts debt collection, bail bonds, timeshares, commercial airlines, cruises, credit repair and counseling, door to door sales, telemarketing, dating, cyberlockers, money transmission, legal firearms, tobacco and prescription pharmaceuticals, among others. The flag in the table above is set when a code appears on Visa's list, or when the business the code plainly describes is prohibited or restricted on Stripe's. That is a reasonable proxy for whether a mainstream aggregator will board you.",
          "A flag is not a verdict. It means a flat rate aggregator will probably decline you and you will end up with a specialist acquirer, higher rates, a rolling reserve, or all three. It is worth knowing what the flag misses. Several of the most scrutinized US verticals have no code of their own. CBD, nutraceuticals and supplements get filed under 5499 or the catch all 5999, and shipped alcohol under 5921, none of which carries a flag here. That is precisely why underwriters read your website instead of trusting four digits, and why a bland code will not get a genuinely restricted business boarded.",
        ],
      },
    ],
    rateTable: {
      caption: "Mastercard US consumer credit interchange programs whose eligibility is limited by MCC, effective April 17, 2026. These rates go to the card issuer. They are not what your processor charges you, but on interchange plus pricing they pass through to you at cost.",
      columns: [
        "MCCs the program is limited to",
        "Core card",
        "World Elite card",
      ],
      rows: [
        {
          label: "Merit I (the base program)",
          note: "Where a merchant with no category specific program lands. Every row below is a discount off this baseline, available only to the listed codes.",
          values: [
            "No MCC restriction",
            "1.95% + $0.10",
            "2.60% + $0.10",
          ],
        },
        {
          label: "Merit I, Insurance",
          values: [
            "5960, 6300",
            "1.43% + $0.05",
            "2.25% + $0.10",
          ],
        },
        {
          label: "Merit I, Real Estate",
          values: [
            "6513",
            "1.43% + $0.05",
            "2.20% + $0.10",
          ],
        },
        {
          label: "Merit I, Day Care",
          note: "Mastercard lists this program as N/A for World High Value and World Elite cards only. Core, Enhanced Value and World cards all get 1.60% plus $0.10.",
          values: [
            "8351",
            "1.60% + $0.10",
            "Not offered",
          ],
        },
        {
          label: "Payment Transaction, Gaming Payments",
          note: "US region only. The percentage component is zero, so the cost is a flat ten cents whatever the amount.",
          values: [
            "7800, 7801, 7802, 7994, 7995",
            "0.00% + $0.10",
            "0.00% + $0.10",
          ],
        },
      ],
    },
    assumptions: [
      "Codes and descriptions are taken verbatim from one network's list, the April 2026 Visa Merchant Data Standards Manual. Mastercard, American Express and Discover recognize nearly all the same numbers but word many descriptions differently, so your statement may show different wording for the same code. Visa's 42 en dashes have been replaced with commas and its 26 curly apostrophes with plain ones for house style; nothing else was reworded.",
      "The list covers the 290 generic codes a US merchant can be assigned. Visa's Section 2 listing contains 934 codes in total. This tool excludes the 641 codes in the 3000 to 3999 range, which are brand specific codes for named airlines, car rental firms and hotel chains, plus 4723 (package tour operators, Germany only), 9406 (government-owned lotteries, non US region) and 9702 (emergency services, Visa use only). 934 minus 641 minus 3 leaves 290.",
      "Networks add, retire and reword codes at every twice yearly release, so this goes stale on a predictable schedule. The April 2026 Visa edition created 31 new codes, though all 31 were brand specific hotel and airline codes rather than generic categories. The Mastercard rates in the table above are superseded each April, and Visa reprices in April and October. Check the current network documents before acting on any code or rate that matters.",
      "The high risk flag combines two published sources: Visa's high integrity risk MCC list and the categories on Stripe's restricted businesses list. It is deliberately conservative, so a code is flagged only where one of those two documents names it or names the business it plainly describes. Pawn shops, buying clubs and general direct marketers are not flagged for that reason, even though some acquirers scrutinize them. It is not an acquirer standard, no two underwriting teams agree, and a flag is a signal that a category attracts scrutiny rather than a prediction about your application.",
      "Group names are this site's editorial grouping, chosen so the filter is useful to a merchant looking for their own business. Card networks organize MCCs by numeric range instead (agricultural, contracted services, transportation, utilities, retail outlet, clothing, miscellaneous stores, business services, professional services, government), which puts restaurants and pawn shops in the same bucket.",
    ],
    faqs: [
      {
        question: "What is my merchant category code?",
        answer: "Look on your monthly merchant statement, usually printed near your DBA name and merchant ID, sometimes labeled SIC rather than MCC. Your processor dashboard may show it directly; on Stripe it is the business_profile.mcc field on the Account object. If neither shows it, ask your account manager in writing to confirm the four digits on file, not just to describe your industry. Merchants on aggregators often find the code was derived from an industry dropdown they filled in at signup. Box 2 of your Form 1099-K also carries the merchant category code your processor reported.",
      },
      {
        question: "Who assigns a merchant category code?",
        answer: "Your acquirer does, not you and not the card networks directly. Visa Core Rule 1.5.1.11 requires that, unless otherwise required by law, an acquirer must assign to a merchant outlet the MCC that most accurately describes its business. If you are on a payment facilitator such as Stripe, Square or PayPal, the facilitator sets it. The networks define and maintain the list of codes, and they audit whether acquirers are applying them correctly.",
      },
      {
        question: "Can I change my MCC?",
        answer: "Not directly. Visa's manual says a member must submit a completed Visa Merchant Category Code Request Form to request a new or changed code, and members are banks and licensed participants, not merchants. So you ask your acquirer, and it helps to name the specific code you want, quote the network's description of it, and explain why it fits better. If you are on flat rate pricing and the change would lower interchange, expect less enthusiasm, because your processor currently keeps that difference.",
      },
      {
        question: "Does my MCC affect my payment processing fees?",
        answer: "Yes, through interchange. Mastercard's public US rate card limits its cheaper programs to named codes: Merit I Real Estate to 6513, Merit I Insurance to 5960 and 6300, Merit I Day Care to 8351. On a Core consumer credit card that real estate program is 1.43% plus $0.05 against 1.95% plus $0.10 for the general Merit I program. On interchange plus pricing you feel the whole difference. On flat rate pricing you feel none of it, because your headline rate does not change and the processor absorbs or keeps the gap.",
      },
      {
        question: "Which merchant category codes are high risk?",
        answer: "There is no universal list. Visa's is the closest to authoritative: in its April 2026 manual it designates 5122, 5912, 5966, 5967, 5993, 7273 and 7995 as high integrity risk for all card absent transactions, and adds 4816, 6211, 5968, 5816, 6051 and 6012 for certain card absent transactions. Beyond that, high risk means whatever your prospective processor's underwriting says. Some heavily scrutinized verticals, including CBD, supplements and shipped alcohol, have no code of their own, which is why underwriters read your website rather than trusting the code.",
      },
    ],
    related: [
      "effective-rate-calculator",
      "interchange-plus-vs-flat-rate-calculator",
      "credit-card-processing-fee-calculator",
    ],
    links: [
      {
        label: "What interchange actually is",
        href: "/glossary/interchange",
      },
      {
        label: "Interchange plus pricing explained",
        href: "/glossary/interchange-plus",
      },
      {
        label: "Processors with interchange plus pricing",
        href: "/payment-processors/interchange-plus",
      },
      {
        label: "What makes a merchant high risk",
        href: "/glossary/high-risk-merchant",
      },
      {
        label: "How underwriting works",
        href: "/glossary/underwriting",
      },
      {
        label: "Processors for high risk businesses",
        href: "/category/high-risk",
      },
      {
        label: "How to lower payment processing fees",
        href: "/blog/how-to-lower-payment-processing-fees",
      },
    ],
    cta: {
      heading: "Found your code. Now find out whether you are paying for it.",
      body: "A miscoded MCC only shows up on your statement if your pricing passes interchange through at cost. On flat rate pricing it is invisible by design. Run your last statement through the effective rate calculator to see what you are really paying per dollar, then compare processors that publish interchange plus pricing and itemize the interchange line.",
      label: "Compare interchange plus processors",
    },
  },
  {
    slug: "restaurant-credit-card-fee-calculator",
    name: "Restaurant Card Fee Calculator",
    h1: "Restaurant Credit Card Fee Calculator",
    title: "Restaurant Credit Card Fee Calculator: True Cost",
    description: "Calculate restaurant card processing costs including tips, average ticket, cost per cover and effective rate. See what card payments really cost your restaurant.",
    intro: "The Restaurant Card Fee Calculator prices what your restaurant actually runs through the terminal: food and beverage sales plus the tip on top, which is where most restaurant fee estimates go wrong. A room with $73,950 of card sales and a 19.3 percent average tip is processing $88,222, and at Square's published 2.6 percent plus 15 cents that is $2,553.73 a month, of which $371.08 is the fee on tips alone. Enter your own sales, average check, tip percentage, rate and fixed fees and it returns total monthly cost, the tip share of it, cost per cover, your effective rate and the annual number. It tells you to exclude third party marketplace delivery volume, because on those orders the platform runs the card and you never paid a processing fee.",
    tier: 2,
    summary: "Restaurant card fees including the cost of processing tips, cost per cover and effective rate.",
    widget: "restaurant",
    workedExample: {
      scenario: "A 70 seat neighborhood full service restaurant. $85,000 in monthly food and beverage sales, 87 percent of it settled on cards, an average card check of $42.66 before tip, tips averaging 19.3 percent, flat rate card present pricing of 2.6 percent plus 15 cents, and no monthly account fee. No third party marketplace delivery volume is included, because the platform processes those cards.",
      result: "Card food and beverage sales are $85,000 times 0.87, or $73,950. Tips at 19.3 percent add $14,272.35, so the terminal processes $88,222.35, not $73,950. At $42.66 a check that is 1,733 card transactions. Percentage cost is $88,222.35 times 0.026, or $2,293.78. Per transaction cost is 1,733 times $0.15, or $259.95. Total processing is $2,553.73 a month and $30,644.77 a year. The tip line alone is $14,272.35 times 0.026, or $371.08 a month and $4,452.97 a year, which is 14.5 percent of the entire bill. Cost per cover is $2,553.73 divided by 1,733, or $1.47. The effective rate on card volume is 2.89 percent, but measured against all food and beverage sales, cash included, it is 3.00 percent, and that second number is the one most operators quote at their processor. A calculator that stopped at food and beverage sales and ignored tips would have told this operator $2,182.65, understating the monthly bill by 17 percent. For scale: the National Restaurant Association's 2026 State of the Restaurant Industry puts median fullservice income before taxes at 2.8 percent of sales in 2024, which on $85,000 of sales is $2,380. Card acceptance costs this restaurant more than its median peer earns.",
    },
    sections: [
      {
        heading: "The tip is card volume, and you are paying to process it",
        body: [
          "Your POS reports food and beverage sales. Your processor bills on what you authorized and settled, which is the check plus tax plus tip. Square says so in its own fee documentation: payment processing fees are taken out of the total amount of each transaction, including tax and tip. The networks bill the acquirer on the full settled amount, and the acquirer bills you on it.",
          "That gap is the reason this page exists. A restaurant with $73,950 of card food and beverage sales and a 19.3 percent average tip runs $88,222 through the terminal. At 2.6 percent plus 15 cents the bill is $2,553.73 a month. Model the food and beverage sales alone and you get $2,182.65, understated by $371.08 every month and $4,452.97 a year.",
          "Which tip percentage you feed the model matters more than the rate you pay. Toast, measuring card and digital transactions across its US restaurants, puts full service at 19.3 percent for the first quarter of 2026, quick service at 15.8 and takeout at 13.7. Square, measuring its own food and beverage base in the same quarter, reports 14.82 percent for full service and 17.30 for bars. They disagree because the bases disagree, and neither one sees a cash tip. Use your own POS number.",
        ],
      },
      {
        heading: "Whether you can pass the fee on the tip to your servers",
        body: [
          "Federal law permits it, narrowly. The Department of Labor's Fact Sheet 15 says that when tips are charged on customers' credit cards and the employer can show it pays the card company a percentage on such sales, the employer may pay the employee the tip, less that percentage. Its own example: at a 3 percent card fee, paying 97 percent of the tips does not violate the FLSA.",
          "Three hard limits catch operators. You cannot reduce the tip by more than the transactional fee the card company actually charged, whether or not you take a tip credit, and Fact Sheet 15 calls doing so a keeping violation under section 3(m)(2)(B). That fee may not reduce the wage below the required minimum including any tip credit claimed: at a $2.13 cash wage, a $5.12 maximum tip credit and a $7.25 minimum, an employer taking the full credit has no headroom at all. And the money is due by the regular payday, not when the card company reimburses you.",
          "State law can remove the option outright. California Labor Code 351 requires an employer who lets patrons tip by card to pay the full amount of the gratuity the patron indicated on the credit card slip, without any deductions for any credit card payment processing fees or costs, by the next regular payday. This is a wage and hour question, answered by the law of your state.",
          "It is worth sizing what you are fighting over. At a $42.66 check and a 19.3 percent tip, the tip is $8.23 and 2.6 percent of it is 21 cents. Across 1,733 checks that is about $371 a month to the house. Plenty of operators price that against the FLSA exposure and decide to eat it.",
        ],
      },
      {
        heading: "Third party marketplace volume is not your processing cost",
        body: [
          "Marketplace delivery orders do not belong in this calculator, and no ranking restaurant fee calculator says so. DoorDash's merchant documentation states there are no payment processing fees for restaurants on DoorDash app or website orders, and lists credit card processing among what the commission covers. The platform takes the card and pays the interchange; you get a payout net of commission. Feed that volume in and you invent a cost you never incurred, on top of the commission you did.",
          "Direct channels are uneven, so check the product. Uber's webshop, where the order runs on your own site, charges US merchants 2.5 percent plus 29 cents as an order processing fee, a real acceptance cost that belongs in the model at its own rate: Visa prices restaurant card not present interchange 10 basis points above card present and doubles the per transaction floor. DoorDash goes the other way on its direct product, saying all DoorDash offerings include credit card processing.",
          "The mix is big enough to matter. The National Restaurant Association's 2026 State of the Restaurant Industry reports that 75 percent of delivery customers ordered through a third party service in the past six months, and that 44 percent prefer that to ordering directly. If much of your revenue arrives as a net marketplace payout, your card volume is smaller than your sales report and your effective rate is wrong top and bottom.",
        ],
      },
      {
        heading: "Where the money actually is: ticket size, card mix, and pricing model",
        body: [
          "Per transaction fees matter more in restaurants than the headline rate, because ticket sizes swing so hard. On a $50.89 full service charge, being a $42.66 check plus a 19.3 percent tip, Square's 2.6 percent plus 15 cents costs $1.47, an effective rate of 2.89 percent. On a $17.05 counter charge, being Toast's July 2026 median burger at $14.72 plus a 15.8 percent quick service tip, the same pricing costs 59 cents, an effective 3.48 percent. The percentage never moved. The 15 cents did.",
          "Card mix is the other lever, and a flat rate statement hides it. Interchange is the wholesale floor paid to the card issuing bank. Visa's schedule effective April 18, 2026 prices card present restaurant credit at 2.10 percent for Traditional Rewards and All Other Products and 2.60 percent for Visa Signature, Signature Preferred and Infinite, both with a 4 cent minimum. Exempt debit at the restaurant category is 1.55 percent plus 4 cents; regulated debit is 0.05 percent plus 21 cents. On that same $50.89 charge, interchange alone runs from 24 cents to $1.32, on nothing but which card the guest hands you.",
          "That spread is why flat rate and interchange plus diverge for restaurants. Flat rate averages the mix and keeps the difference; interchange plus passes it through. Helcim publishes interchange plus 0.35 percent plus 7 cents for card present volume between $50,000 and $100,000 a month. On a card at Visa's 2.10 percent rate that is $1.32 against Square's $1.47, about $271 a month. Network assessments, which neither network publishes, come out of that gap.",
          "One restaurant specific mechanic never shows as a fee line but causes them. You authorize the check, the guest writes a tip, and you settle a larger amount at batch. Visa permits the cleared amount to exceed the authorized amount, and effective February 21, 2026 the US tolerance is up to 30 percent for merchant category codes 5811 caterers, 5812 eating places and restaurants, and 5814 fast food restaurants. MCC 5813, drinking places, is not in that US row. Go past it, or leave a terminal unbatched, and you are into reauthorization, downgrades and disputes.",
        ],
      },
      {
        heading: "Surcharges and service charges are two different things",
        body: [
          "A credit card surcharge is capped twice. Visa's core rules set the US maximum at 3.00 percent and separately cap a brand level surcharge at the merchant's Visa Surcharge Cap, meaning the average merchant discount rate you pay your acquirer for credit card transactions. Mastercard publishes a Maximum Surcharge Cap of 4 percent with the same lesser of test against your average effective discount rate. Neither brand permits surcharging debit or prepaid cards. Both want 30 days notice, and disclosure at the point of sale and as a dollar amount on every receipt.",
          "Recovery is never complete. Only credit cards can be surcharged, and the Federal Reserve's 2026 Diary of Consumer Payment Choice has US consumers making 16 credit and 15 debit payments a month, so close to half your card transactions are out of scope before you start. The surcharge is itself part of what you process, since Visa requires it inside the transaction amount, so you pay your own rate on it. And tips are excluded: Square's implementation bars surcharges on tips, debit, ACH, offline and split tender payments. Square does not offer surcharging at all in Connecticut, Maine, Massachusetts or Puerto Rico.",
          "A service charge is a different instrument, and its consequences land in payroll rather than payments. The Department of Labor is unambiguous: a compulsory charge for service, for example 15 percent of the bill, is not considered a tip under the FLSA. Sums distributed to employees from service charges are not tips, but may be used to satisfy the employer's minimum wage and overtime pay obligations, and must be included in the regular rate of pay for computing overtime.",
          "This calculator prices card acceptance. It will tell you what a surcharge or service charge does to your effective rate. It will not tell you whether either is lawful where you operate.",
        ],
      },
    ],
    rateTable: {
      caption: "Visa US interchange for restaurant fee programs, rates effective April 18, 2026, from the Visa USA Interchange Reimbursement Fees schedule. Interchange is the wholesale floor paid to the card issuing bank and is not what a merchant pays. Your merchant discount adds network assessments and your processor's markup on top of these figures.",
      columns: [
        "Consumer credit: Traditional Rewards and All Other Products",
        "Consumer credit: Visa Signature, Signature Preferred, Infinite",
      ],
      rows: [
        {
          label: "Restaurant 2 (card present)",
          note: "The rate most dine in card present credit transactions settle at.",
          values: [
            "2.10%, 4 cent minimum",
            "2.60%, 4 cent minimum",
          ],
        },
        {
          label: "Restaurant 1 (card not present)",
          note: "Applies to your own online ordering and phone orders, not to marketplace delivery the platform processes.",
          values: [
            "2.20%, 8 cent minimum",
            "2.70%, 8 cent minimum",
          ],
        },
        {
          label: "Small Merchant Restaurant 1 and 2",
          note: "A qualifying small merchant pays the card present rate on card not present volume too. Visa caps the small merchant category at $280,000 of gross Visa consumer credit sales.",
          values: [
            "2.10%, 4 cent minimum",
            "2.60%, 4 cent minimum",
          ],
        },
        {
          label: "Exempt Visa debit, CPS/Restaurant (card present)",
          note: "Debit does not carry the consumer credit product tiers, so one rate applies. Exempt means the issuer is not covered by the Durbin cap.",
          values: [
            "1.55% + $0.04",
            "1.55% + $0.04",
          ],
        },
        {
          label: "Regulated Visa debit (card present)",
          note: "Issuers that certify compliance with the interim fraud prevention standards receive an additional 1 cent. On a $50.89 charge this is about 24 cents.",
          values: [
            "0.05% + $0.21",
            "0.05% + $0.21",
          ],
        },
      ],
    },
    assumptions: [
      "Every rate on this page is a published list price or a published interchange schedule, and interchange changes roughly twice a year. The Visa figures here are the April 18, 2026 edition. When Visa publishes the next one, the interchange table and every benchmark built on it goes stale.",
      "The calculator applies one blended rate to every card, and real statements do not work that way. On the same $50.89 charge, Visa interchange alone runs from about 24 cents on a regulated debit card to $1.32 on a Signature or Infinite credit card. A dining room full of premium rewards cards costs more than any blended figure suggests, and a debit heavy counter costs less.",
      "Tip percentage is the input with the widest disagreement between credible sources. Toast reports 19.3 percent for full service in the first quarter of 2026; Square reports 14.82 percent for full service in the same quarter. Different bases, different customer mixes, and neither counts cash tips. Use your own POS number rather than either default.",
      "The $85,000 monthly sales default is a round starting figure, not a benchmark, and the $42.66 average check is constructed from Toast's July 2026 median menu prices rather than any published survey of check averages. The 87 percent card share is the non cash share of all US consumer payments by number of payments, from the Federal Reserve's 2026 Diary, used as a proxy because no restaurant specific figure could be verified. It counts every non cash method, not only cards. Replace all three before you trust the output.",
      "The model prices what you settle with your processor. It ignores sales tax, which processing is charged on, so it understates your true cost by roughly your sales tax rate times your processing rate unless you add tax into the sales figure. It also ignores chargeback fees, cross border and international card fees, PCI non compliance fees, early termination and equipment leases, all of which arrive on the same statement.",
    ],
    faqs: [
      {
        question: "Do credit card processing fees apply to tips?",
        answer: "Yes. The fee is calculated on the total amount you authorize and settle, which includes the tip and the sales tax, not on your food and beverage sales. Square puts it in writing: payment processing fees are taken out of the total amount of each transaction, including tax and tip. At 2.6 percent, a 19.3 percent tip on a $42.66 check adds about 21 cents of cost to that check. Across 1,733 card checks a month that is $371.08, or $4,452.97 a year, on the tip line alone. It is roughly 14.5 percent of a typical full service restaurant's total processing bill and it is the number most fee calculators leave out.",
      },
      {
        question: "Can a restaurant deduct credit card fees from a server's tips?",
        answer: "Under federal law usually yes, within tight limits. The Department of Labor's Fact Sheet 15 permits an employer that pays the card company a percentage on the sale to pay the employee the tip, less that percentage; its example is paying 97 percent of tips where the card company charges 3 percent. You may not deduct more than the actual transactional fee, regardless of whether or not you take a tip credit, the deduction may not reduce the employee's wage below the required minimum wage including any tip credit claimed, and the tip must be paid by the regular payday rather than held until the card company reimburses you. State law can override this entirely. California Labor Code 351 requires the full gratuity the patron indicated on the slip to be paid without any deduction for card processing fees or costs. Confirm your own state with an employment lawyer before you change payroll.",
      },
      {
        question: "What is a good effective rate for a restaurant?",
        answer: "It depends on your average ticket and your card mix far more than on which processor you signed with. On Square's published 2.6 percent plus 15 cents, a $50.89 full service charge lands at 2.89 percent and a $17.05 counter charge lands at 3.48 percent, with no change in pricing at all. The floor underneath both is interchange: Visa prices card present restaurant credit at 2.10 percent for Traditional Rewards and All Other Products and 2.60 percent for Signature and Infinite, and card present debit at 1.55 percent plus 4 cents exempt or 0.05 percent plus 21 cents regulated. If your statement shows well above 3 percent on card present dine in volume with a $40 plus average check, the gap between that and 2.89 percent is markup worth asking about.",
      },
      {
        question: "Do I pay credit card processing fees on DoorDash and Uber Eats orders?",
        answer: "Not on marketplace orders. DoorDash's merchant documentation states there are no payment processing fees for restaurants on DoorDash app or website orders and lists credit card processing among what the commission covers. The platform runs the card, the platform pays the interchange, and you are paid net of commission. Uber does not publish an equivalent statement for Uber Eats marketplace orders, so treat that one as unconfirmed rather than assuming it matches. What Uber does publish is a fee on your own direct channel: its webshop product, which runs on your own site, charges US merchants 2.5 percent plus 29 cents as an order processing fee. Exclude marketplace volume from this calculator or you will price a cost you never paid, on top of a commission you did.",
      },
      {
        question: "Should a restaurant add a surcharge or a service charge to cover card fees?",
        answer: "They are different tools with different rules. A credit card surcharge is capped by Visa at 3.00 percent in the US and additionally at your own average merchant discount rate, and by Mastercard at a 4 percent Maximum Surcharge Cap with the same lesser of test; neither allows surcharging debit or prepaid, both want 30 days notice before you start, and several states restrict it. Recovery is partial at best: about half of consumer card payments are debit, the surcharge is itself processed at your rate, and tips are excluded. A service charge is not a surcharge and not a tip. The Department of Labor treats a compulsory charge for service as wages, usable toward minimum wage and overtime obligations and includable in the regular rate for overtime, which changes your payroll rather than your processing bill. Take advice on both before you print either on a menu.",
      },
    ],
    related: [
      "credit-card-processing-fee-calculator",
      "effective-rate-calculator",
      "interchange-plus-vs-flat-rate-calculator",
    ],
    links: [
      {
        label: "Processors for restaurants",
        href: "/category/restaurants",
      },
      {
        label: "Toast",
        href: "/processor/toast",
      },
      {
        label: "Square",
        href: "/processor/square",
      },
      {
        label: "Clover",
        href: "/processor/clover",
      },
      {
        label: "Helcim",
        href: "/processor/helcim",
      },
      {
        label: "Interchange plus processors",
        href: "/payment-processors/interchange-plus",
      },
      {
        label: "Tap to pay processors",
        href: "/payment-processors/tap-to-pay",
      },
      {
        label: "What interchange is",
        href: "/glossary/interchange",
      },
      {
        label: "Effective rate, defined",
        href: "/glossary/effective-rate",
      },
      {
        label: "Surcharge rules",
        href: "/glossary/surcharge",
      },
      {
        label: "How to lower payment processing fees",
        href: "/blog/how-to-lower-payment-processing-fees",
      },
      {
        label: "How we test and score processors",
        href: "/methodology",
      },
    ],
    cta: {
      heading: "Check this against your actual statement",
      body: "An estimate is a starting point, not an answer. Pull last month's merchant statement, take the total fees line and the total card volume line, divide one by the other, and compare it to the effective rate this calculator produced. If the gap is more than about a tenth of a point, something in your assumptions is off: marketplace delivery volume counted as your own, a monthly fee you forgot, sales tax missing from the volume figure, or a card mix richer in premium rewards cards than you thought. Then take the real number processor shopping.",
      label: "Compare restaurant processors",
    },
  },
  {
    slug: "credit-card-surcharge-calculator",
    name: "Credit Card Surcharge Calculator",
    h1: "Credit Card Surcharge Calculator",
    title: "Credit Card Surcharge Calculator: Calculate the Fee",
    description: "Calculate the credit card surcharge, customer's total, your net deposit and the processing cost you still absorb. Use your actual transaction amount and processing rate.",
    intro: "The Credit Card Surcharge Calculator shows what a surcharge actually does to your deposit. Enter a ticket, a surcharge percentage and your processing rate, and it returns the surcharge, the total your customer pays, the processing cost on that larger amount, your net deposit, and the residual you still absorb. That last number is the one merchants miss: you pay processing on the surcharge too, so a surcharge set at your discount rate never fully covers your cost. This tool does dollar math only. It does not tell you what surcharge is legal where you operate, because that is a legal question, so the state rules ship below as a dated reference table with the statute behind each one.",
    tier: 2,
    summary: "See your surcharge, customer total, net deposit and the residual you still absorb.",
    widget: "surcharge",
    workedExample: {
      scenario: "A $200 repair invoice, a 3% surcharge, and processing at 2.9% plus $0.30 per transaction (Stripe's published standard US rate for domestic cards).",
      result: "The surcharge is $200 x 0.03 = $6.00, so the customer pays $206.00. Processing is charged on the full $206.00, not the original $200: $206.00 x 0.029 = $5.974, plus the $0.30 fixed fee, equals $6.274. Your deposit is $206.00 minus $6.274 = $199.73. You wanted to keep $200, so you still absorb $0.27. Without the surcharge you would have netted $200 minus $6.10 = $193.90, so the surcharge moved you $5.83 closer to whole, recovering about 96 percent of your processing cost but not all of it. The gap has three parts and they do not all pull the same way: the $0.30 fixed fee, which no percentage surcharge scales with, plus the 2.9% you pay on the $6.00 surcharge itself, which is $0.17, less the $0.20 by which a 3% surcharge overshoots the 2.9% base rate on a $200 ticket. That is 0.30 plus 0.17 minus 0.20, the $0.27 you absorb. At this ticket size the surcharge that would break you exactly even is 3.14%, above the 3% cap Visa publishes. On these inputs, full recovery inside Visa's cap does not arrive until the ticket reaches about $2,308.",
    },
    sections: [
      {
        heading: "The number the calculator exists to show you",
        body: [
          "Almost every surcharge calculator stops at the customer total. That is the easy half. What decides whether surcharging was worth doing is the amount landing in your bank account, and it is always less than the ticket you started with, because your processor bills you on the amount you actually run. Run $206 instead of $200 and you pay the percentage on $206.",
          "So a surcharge set exactly at your effective rate under-recovers by design. Two things leak: the fixed per-transaction fee, typically $0.10 to $0.30, which a percentage cannot scale with, and the percentage you pay on the surcharge itself. So the surcharge that leaves you whole is not your rate, it is (rate x ticket + fixed fee) divided by (ticket x (1 minus rate)). On a $200 ticket at 2.9% plus $0.30 that is 3.14%. On a $25 ticket it is 4.22%, above both networks' caps. On a $2,308 ticket it lands exactly on 3.00%.",
          "That is why surcharging pays very differently for a $2,000 HVAC install than for a $22 lunch. The fixed fee is a flat drag a percentage never catches, so recovery improves as the ticket grows and collapses as it shrinks. At $25 with a 3% surcharge you collect $0.75 against $1.05 of cost, recovering about 72 percent and eating about $0.30 per sale anyway. At $2,000 you recover essentially all of it. Enter a percentage above your own cost of acceptance and the calculator flags over-recovery rather than celebrating it, because that breaches the network rules below and, in several states, the statute.",
        ],
      },
      {
        heading: "The network rules, and the cap that is not one number",
        body: [
          "Visa and Mastercard do not publish the same cap, and anyone telling you there is a single number is guessing. Visa's merchant Q and A, version 02152024, tells merchants to limit the amount to their merchant discount rate for that credit card or 3%, whichever is lowest. Mastercard's merchant surcharge rules page states plainly: the Maximum Surcharge Cap, 4%. Its settlement FAQ adds that 4% only matters where a merchant pays more than 4% for Mastercard acceptance, working the example that a merchant on a 2.50% discount rate is capped at 2.50%.",
          "If you accept both brands and surcharge at the brand level, the lower ceiling governs, which in practice means 3%. Neither network's materials point to a federal ceiling, and several competitor pages assert a 4% federal limit that does not exist as a statute. These are private network rules enforced through your acquirer, and Visa notes that the acquirer of a merchant caught surcharging improperly may be assessed an immediate $1,000 fine.",
          "Above the cap sits the cost of acceptance ceiling, the rule that actually binds most merchants: you may never surcharge more than that card costs you to accept. Mastercard defines the brand level cap as your average effective interchange rate plus network and acquirer fees on your Mastercard credit volume over the preceding one or twelve months, at your option. Product level is your discount rate for that product less the Durbin Amendment cap on debit interchange. You may surcharge at one level or the other, not both.",
          "Three operational rules catch people out. Notification: Visa requires at least 30 days notice to your acquirer, Mastercard 30 days written notice to both Mastercard and your acquirer, after which the acquirer registers you within 10 days. Debit and prepaid: never surchargeable anywhere in the US, and Visa closes the loophole, since a debit card does not become surchargeable when the cardholder selects credit at the terminal, which only picks signature over PIN. Disclosure: notice at the point of entry and the point of sale, or the first page referencing card brands online, plus the surcharge as a separate line on the receipt, returned in proportion on a refund or chargeback.",
        ],
      },
      {
        heading: "The state layer, and the California error worth avoiding",
        body: [
          "Four US jurisdictions prohibit surcharging outright. Connecticut has the broadest rule in the country: General Statutes 42-133ff(b) says no person may impose a surcharge on any transaction, defining surcharge by any method of payment rather than credit cards alone, with a carve out for certain government payments and a civil penalty of up to $500. Massachusetts chapter 140D section 28A bars a surcharge on a cardholder electing to use a credit card. Maine 9-A section 8-509 and Puerto Rico's 10 L.P.R.A. section 11 both cover debit as well as credit, Maine carving out only governmental entities. Cash discounts are expressly preserved in the first three; Puerto Rico's text is silent, which is not the same thing.",
          "A second group permits surcharging but attaches conditions with real teeth. Colorado gives you two routes, 2% of the total cost to the buyer or the merchant discount fee you actually incur, with exact signage wording prescribed for each. Minnesota caps at 5% of the purchase price and requires oral notice plus a posted sign in person. New Jersey caps at actual processing cost and requires you to disclose the amount, not merely the existence: a sign reading only that your surcharge does not exceed processing costs fails. New York requires the total price inclusive of surcharge to be posted, so a bare percentage is not enough.",
          "Two states changed recently and most guides have not caught up. Kansas amended 16a-2-403 effective 1 January 2025 to permit surcharging with clear and conspicuous notice of the amount in advance. Oklahoma, long listed as prohibiting, legalised surcharging effective 1 November 2025 under Laws 2025 chapter 410, capped at 2% of the total transaction or actual processing cost, whichever is less. Visa's state list still shows Oklahoma as prohibiting, because that document is dated 15 February 2024. Treat any undated state list as wrong.",
          "Then California, which several 2026 pages get backwards. SB 478 is not a surcharge ban but the Honest Pricing law, effective 1 July 2024, at Civil Code 1770(a)(29), prohibiting advertised prices that exclude mandatory fees. The Attorney General's hidden fees guidance confirms a credit card processing fee is not a mandatory fee where the customer can avoid it by paying another way, and becomes mandatory only if the business accepts nothing but credit cards. The actual surcharge statute is Civil Code 1748.1, from 1985, held unenforceable against the businesses that sued in Italian Colors Restaurant v. Becerra and never repealed; the Attorney General will generally apply that decision to similarly situated merchants. Texas and Florida sit in a related posture, though the relief differs: the Eleventh Circuit struck Florida's statute down facially, while Texas's injunction reaches only the merchants who sued.",
        ],
      },
      {
        heading: "When surcharging is the wrong instrument",
        body: [
          "Run the calculator at your real average ticket before your best one. Under a 3% ceiling at 2.9% plus $0.30 you recover about 50 percent of your processing cost on a $10 ticket, 67 percent at $20, 72 percent at $25 and 84 percent at $50. At small tickets the residual is almost exactly the fixed fee, close to $0.30 a sale whatever the ticket. You will have added a line item, a signage obligation, a receipt requirement, a registration with two networks and a reason for customers to complain, in exchange for recovering part of a fee and still eating thirty cents. That makes sense for a contractor invoicing $3,000, much less for a coffee shop.",
          "Cash discounting is the usual alternative, expressly preserved in three of the four prohibiting jurisdictions: Connecticut, Massachusetts and Maine each protect it in the statute, Connecticut requiring posted notice. Puerto Rico is the exception, carrying no equivalent allowance, so do not assume the mainland workaround travels there. The mechanics matter elsewhere too. You post the card price as the regular price and discount off it for cash, rather than posting a cash price and adding a fee. Visa is explicit that a final bill reached by applying an additional fee for a card payment may be treated as a surcharge whatever you call it.",
          "There is also the part no calculator models, the conversion cost. A surcharge appearing at checkout after a customer has chosen a card is a late, visible fee at the highest friction point in the transaction, and in card not present retail that shows up as abandonment. In B2B, where the buyer often has the option to send an ACH transfer instead, surcharging frequently works well precisely because it pushes payers toward the cheaper rail. That is the honest case for it: a pricing signal that moves volume to ACH or cash, not a fee recovery machine. If none of your customers can switch rails, you are taxing the method they were always going to use.",
        ],
      },
    ],
    rateTable: {
      caption: "Visa and Mastercard US surcharging rules, verified from each network's own published materials on 4 September 2026",
      columns: [
        "Network",
        "Maximum surcharge cap",
        "Cost of acceptance ceiling",
        "Advance notice required",
        "Debit and prepaid",
      ],
      rows: [
        {
          label: "Visa",
          note: "Visa U.S. Merchant Surcharge Q and A, version 02152024. Visa also requires the surcharge in Field 28 of the transaction message and discloses a $1,000 acquirer fine for improper surcharging.",
          values: [
            "3%",
            "Your merchant discount rate for the credit card surcharged, or 3%, whichever is lowest",
            "At least 30 days to your acquirer before you begin",
            "Cannot be surcharged, including a debit card run as credit at the terminal",
          ],
        },
        {
          label: "Mastercard",
          note: "Mastercard merchant surcharge rules page (live) and the U.S. Merchant Class Settlement surcharge FAQ (dated May 2019). The 4% figure binds only where cost of Mastercard acceptance exceeds 4%; the FAQ works the example of a 2.50% discount rate capping the surcharge at 2.50%.",
          values: [
            "4%",
            "Brand level: the lesser of your average effective merchant discount rate for Mastercard credit acceptance or the 4% cap. Product level: your cost to accept that product less the Durbin debit interchange cap",
            "30 days written notice to Mastercard and to your acquirer; the acquirer registers you within 10 days",
            "Not allowed on Debit Mastercard or Mastercard prepaid cards",
          ],
        },
      ],
    },
    assumptions: [
      "The calculator assumes a flat percentage plus fixed fee per transaction, which is how flat rate processors bill. On interchange plus pricing your effective rate varies by card, so use your actual effective rate from a recent statement rather than a headline number, and remember the cost of acceptance ceiling is measured against that real figure.",
      "The default of 2.9% plus $0.30 is Stripe's published standard US rate for domestic cards, confirmed on stripe.com/pricing on 4 September 2026. It is a placeholder, not a recommendation, and your own rate is the only one that matters for the cost of acceptance ceiling.",
      "The state table reflects statutes and official guidance checked on 4 September 2026 and will go stale. Oklahoma changed in November 2025 and Kansas in January 2025, both after Visa's own published state list was dated. Re-check before you launch a program, and re-check again if you open a location in a new state.",
      "For the 39 jurisdictions marked Permitted, the basis is the absence of a restricting statute in Visa's merchant Q and A rather than an independent 50 state statutory review by us. That is an honest limit: absence of evidence in one card network's dated document is weaker than a positive citation, which is why every one of those rows carries the same caveat instead of a confident green light.",
      "Nothing here accounts for your merchant agreement, which can be stricter than the network rules, or for industry specific rules such as those covering government, education, utilities and healthcare payments, where convenience fee programs often apply instead of surcharging.",
    ],
    faqs: [
      {
        question: "How much can I legally surcharge a credit card?",
        answer: "There is no single number and no federal cap. Visa's published guidance tells merchants to limit the surcharge to their merchant discount rate for that card or 3%, whichever is lowest. Mastercard publishes a Maximum Surcharge Cap of 4%, but says it only bites where your Mastercard cost of acceptance exceeds 4%, because the binding limit is normally your own discount rate. If you accept both brands and surcharge at the brand level, the lower ceiling governs in practice. On top of that, state law can restrict you further: Colorado at 2% of the total cost to the buyer or, at your election, the merchant discount fee you actually incur; Oklahoma at 2% or actual processing cost, whichever is less; Minnesota at 5% of the purchase price; New Jersey and New York at your actual cost. What is legal for you specifically is a question for your attorney and your acquirer, which is why this calculator does the dollar math and does not output a maximum.",
      },
      {
        question: "Do I pay processing fees on the surcharge itself?",
        answer: "Yes, and this is the single most misunderstood part of surcharging. Your processor bills on the total amount you run, so if you add a $6 surcharge to a $200 ticket you are charged on $206. At 2.9% plus $0.30 that is $6.27 of cost against $6.00 collected, leaving $0.27 you still absorb. Two things widen the gap, the fixed per transaction fee and the percentage charged on the surcharge amount, and one narrows it, the small margin by which a 3% surcharge exceeds a 2.9% rate. The break even surcharge is (rate x ticket + fixed fee) divided by (ticket x (1 minus rate)), which on those inputs is 3.14%, above Visa's 3% cap. Full recovery inside a 3% cap does not arrive until roughly a $2,308 ticket.",
      },
      {
        question: "Can I surcharge a debit card?",
        answer: "No, nowhere in the United States, on any network. Visa states that US merchants cannot surcharge a Visa debit card or prepaid card, and specifically closes the workaround: a debit card does not become surchargeable because the cardholder presses credit at the terminal, since that selection only chooses signature over PIN. Mastercard's merchant page says the fees are not allowed on Debit Mastercard or Mastercard prepaid cards. This is a card network rule rather than a federal statute, and some states reinforce it directly, with Maine, Colorado and Puerto Rico all barring debit surcharges by law and Connecticut barring surcharges on any method of payment. Your terminal or gateway must therefore identify card type by BIN and suppress the surcharge on debit and prepaid automatically.",
      },
      {
        question: "Is credit card surcharging legal in California?",
        answer: "In practice yes for most merchants, but not because of SB 478, which several guides describe incorrectly. SB 478 is the Honest Pricing law effective 1 July 2024, sitting at Civil Code 1770(a)(29) and governing how prices are advertised. The California Attorney General's hidden fees guidance confirms a credit card processing fee is not a mandatory fee that must sit inside the advertised price, since the customer can avoid it by paying another way, and it only becomes mandatory if you accept nothing but credit cards. The actual surcharge statute is Civil Code 1748.1, from 1985, which a federal court held could not be enforced against the businesses that brought Italian Colors Restaurant v. Becerra in 2018, but which was never repealed. The Attorney General says it will generally apply that decision to similarly situated merchants. That is why surcharging is common in California and also why it is not entirely risk free.",
      },
      {
        question: "Do I have to tell my processor before I start surcharging?",
        answer: "Yes, and it is the compliance step merchants skip most often. Visa requires at least 30 days notice to your acquirer before you begin surcharging. Mastercard requires a minimum of 30 days advance written notice to both Mastercard and your acquirer, after which your acquirer must register you with Mastercard within 10 days. You also have to decide upfront whether you are surcharging at the brand level, meaning the same percentage on all that network's credit cards, or the product level, meaning specific card products only. You cannot do both. Alongside notification you need disclosure at the point of entry and point of sale, or the first page referencing card brands online, and the surcharge shown as a separate line on the receipt.",
      },
    ],
    related: [
      "credit-card-processing-fee-calculator",
      "effective-rate-calculator",
      "interchange-plus-vs-flat-rate-calculator",
    ],
    links: [
      {
        label: "What a surcharge is",
        href: "/glossary/surcharge",
      },
      {
        label: "Effective rate, defined",
        href: "/glossary/effective-rate",
      },
      {
        label: "Interchange, defined",
        href: "/glossary/interchange",
      },
      {
        label: "How to lower payment processing fees",
        href: "/blog/how-to-lower-payment-processing-fees",
      },
      {
        label: "Compare payment processors",
        href: "/processors",
      },
      {
        label: "How we test and score processors",
        href: "/methodology",
      },
    ],
    cta: {
      heading: "Know your real rate before you set a surcharge",
      body: "The cost of acceptance ceiling is measured against what you actually pay, not the rate on a pricing page. Work out your true effective rate from a recent statement first, then come back and size the surcharge against it.",
      label: "Calculate your effective rate",
    },
  },
  {
    slug: "reverse-fee-calculator",
    name: "Reverse Fee Calculator",
    h1: "Reverse Fee Calculator: What to Charge So You Net the Amount You Want",
    title: "Reverse Fee Calculator: Calculate the Gross Payment",
    description: "Calculate how much to charge so you receive an exact amount after payment processing fees. Enter your target payout, percentage fee and fixed transaction fee.",
    intro: "This reverse fee calculator answers one question: if you want a specific amount to land in your bank account, what do you charge the card? Enter the net you want and either pick a processor preset or type your own rate, and it returns the gross amount, the fee at that amount, and the net you actually end up with. The formula is gross equals net plus the fixed fee, divided by one minus the percentage rate. Adding the percentage to your price does not work, and the second half of this page explains both why it undershoots and why turning the difference into a line item on an invoice can put you on the wrong side of Visa's surcharge rules.",
    tier: 3,
    summary: "Find the gross amount to charge so an exact net amount lands in your bank account.",
    widget: "gross-up",
    workedExample: {
      scenario: "A design studio agreed a $2,500 fee with a client and wants $2,500 to actually arrive. The client is paying by card through Stripe, on Stripe's published US standard rate of 2.9% plus $0.30 per successful domestic transaction.",
      result: "The naive approach is to add 2.9% and invoice $2,572.50. Stripe then takes 2.9% of $2,572.50, which is $74.60, plus the $0.30 fixed fee, for a total fee of $74.90. The studio nets $2,497.60 and is $2.40 short. The gross up formula gives (2500 + 0.30) divided by (1 minus 0.029), which is 2500.30 divided by 0.971, or $2,574.9743, rounded to $2,574.97. Stripe takes 2.9% of $2,574.97, which is $74.67, plus $0.30, for a fee of $74.97. The studio nets $2,574.97 minus $74.97, which is exactly $2,500.00. The difference between the two invoices is $2.47, and the reason the naive figure fails is that the extra $72.50 the studio added is itself charged 2.9%.",
    },
    sections: [
      {
        heading: "Why adding the fee percentage always leaves you short",
        body: [
          "The instinct is to add the rate back on. You want $100, Stripe takes 2.9% plus 30 cents, so you charge $102.90 and consider it handled. Run the actual deduction and it falls apart. Stripe does not charge 2.9% of the $100 you wanted, it charges 2.9% of the $102.90 you actually ran. That is $2.98, plus the 30 cent fixed fee, for a total of $3.28. You net $99.62. You are 38 cents short, and adding another 2.9% will not close the gap, because whatever you add gets charged 2.9% as well.",
          "The fix is one line of algebra. Call the amount you want to keep the net, the percentage the rate, and the per transaction flat charge the fixed fee. Then gross equals net plus fixed, all divided by one minus rate. For $100 net on Stripe's published US rate, that is 100.30 divided by 0.971, which is 103.2956, or $103.30 once you round to the cent. Check it against how the processor actually bills: 2.9% of $103.30 is $3.00, plus the 30 cent fixed fee is $3.30, and $103.30 minus $3.30 is exactly $100.00.",
          "The fixed fee is what makes this ugly on small tickets, and it is the part people forget entirely. To net one dollar on 2.9% plus 30 cents you have to charge $1.34, an effective rate of 25.4%. To net $20 you charge $20.91. The percentage is almost irrelevant down there. This is also why the gap between the naive number and the correct number is not a constant: on a $100 sale it is 40 cents, on a $2,500 invoice it is $2.47, and it grows roughly in proportion to the amount because the compounding term dominates once the flat fee stops mattering.",
          "One thing worth being clear about before the rest of this page gets complicated. Charging $103.30 for something is always allowed. That is a price. You can set your prices at whatever number makes your margin work, and nobody has any interest in how you arrived at it. Everything that follows is about what happens the moment you stop treating it as a price and start presenting the $3.30 to the customer as a fee.",
        ],
      },
      {
        heading: "Where the gross up actually earns its keep",
        body: [
          "The first case is an agreed number. You quoted $2,500, the client signed off on $2,500, and if $2,497.60 arrives you either eat the difference or have an awkward conversation about $2.40. Building the gross up into how you generate invoices is the difference between a rate card that means what it says and one that quietly runs 3% light. The same logic applies to contractor payouts, marketplace transfers, retainers, and any situation where a number was negotiated before a payment method was chosen.",
          "The second is nonprofit donations, where the pattern is now close to universal. A donor picks $250, ticks a box offering to cover the processing cost, and the charge runs at a slightly higher figure so the organization banks the full $250. On PayPal's published US rate for receiving domestic donations, 2.89% plus $0.49, the correct charge is $257.94. PayPal takes $7.45 in percentage and $0.49 fixed, for $7.94, and $250.00 lands. The naive calculation of $250 times 1.0289 gives $257.23 and nets $249.31, which is 69 cents of donor generosity that evaporates for no reason.",
          "The third is the case where you are pricing rather than passing anything on. A subscription business that knows every customer pays by card can simply set the price at the grossed up figure and never mention fees to anyone. This is the cleanest option available and it is worth saying plainly, because a lot of merchants reach for a surcharge when what they actually wanted was a price increase of three percent. A price increase has no registration requirement, no cap, no state law problem and no receipt disclosure obligation.",
        ],
      },
      {
        heading: "Putting a fee line on the invoice makes you a surcharger",
        body: [
          "Visa's definition is broad and it is the one that matters: a surcharge is an additional fee or charge that a merchant adds to a consumer's bill for using a particular form of payment. A line item reading processing fee, card fee, convenience charge or 3% for card payments is that, whatever you call it in your invoicing software. Once you are surcharging, a stack of requirements applies at once. You must notify your acquirer at least 30 days before you start, and Mastercard requires that notice reach Mastercard as well as your acquirer. You must limit it to credit cards, because debit and prepaid cards cannot be surcharged at all, and that includes a debit card where the cardholder chose credit on the terminal. The surcharge amount has to be passed in a dedicated data field in the transaction message, which your acquirer populates. You must disclose it at the point of entry, at the point of sale, and separately on every receipt. And you must surcharge at either the brand level or the product level, not both.",
          "Then there is the cap, and this is where the arithmetic on this page collides with the rules. Visa limits the surcharge to your merchant discount rate for that card or 3%, whichever is lowest. Mastercard's published maximum is 4%, and its cap is the lesser of that and your average effective rate for Mastercard credit acceptance, so if you take both brands you are effectively working to 3%. A full gross up of a 2.9% plus $0.30 flat rate does not fit inside 3% on any normal transaction. On a $100 sale the gross up is $3.30, which is 3.3% of the $100 price. On a $20 sale it is $0.91, which is 4.55%. The crossover point where a full gross up of that rate finally drops under 3% is around $2,308. If you cap the surcharge at 3% and charge $103.00 instead, your fee is $3.29 and you net $99.71, so you are still 29 cents down and you have accepted an entire compliance regime to recover most of it.",
          "Enforcement is not theoretical. Visa says it uses yearly mystery shopping by outside auditors, and that the acquirer of a merchant identified as surcharging improperly may be assessed an immediate $1,000 fine. That flows to you through your processing agreement. Stripe's own surcharging documentation is blunt about where liability sits: you are fully responsible for any fines, penalties or losses arising from failure to adhere to applicable surcharging requirements. Stripe caps US surcharges at 3% and restricts them to credit cards in its own implementation, and it requires you to return the entire surcharge on a full refund and a prorated share on a partial one.",
          "State law sits on top of all of this. Visa's own published understanding, dated 15 February 2024 and disclaimed as non authoritative, is that Connecticut, Maine, Massachusetts, Oklahoma and Puerto Rico prohibit surcharging, and that Colorado, Minnesota, New Jersey and New York impose requirements on it. If you operate in several states, the rule follows the location of each outlet, so you can surcharge in one and not another. There is also a consumer pricing angle that catches people who thought they had solved this. Under California's SB 478, in force since 1 July 2024, the advertised price must include all mandatory fees other than government taxes and reasonable shipping. The Attorney General's guidance answers no to advertising one price and separately stating that an additional percentage fee applies, and no to disclosing the extra fee before the customer finalizes the transaction. Fees for optional services do not have to be included, and the law does not reach purchases for commercial use, which is why a B2B invoice and a consumer checkout are genuinely different problems.",
        ],
      },
      {
        heading: "The cover the fee checkbox: fine for a charity, risky for a store",
        body: [
          "For a 501(c)(3) taking donations, the checkbox is on solid ground, and the reason is structural rather than a matter of anyone looking the other way. The donor is not paying a fee for using a card. They are choosing to make a larger gift. Nothing is being sold, so there is no bill to add a charge to, and the amount is voluntary, so it is not a mandatory fee under a price transparency law either. Keep it that way and it stays clean: leave the box unchecked by default, label it as increasing the gift rather than as a fee, and offer it on every payment method rather than only on cards. The moment it appears exclusively for card payers and is described as covering the card fee, you have built something that looks a lot more like a payment method contingent charge.",
          "Worth checking your rate before you set the percentage, because charities frequently gross up against the wrong number. PayPal's published US schedule prices domestic donations at 2.89% plus $0.49, and confirmed charities who apply and are pre-approved get 1.99% plus $0.49. On the charity rate, netting $250 needs a charge of $255.58, not the $257.94 the standard donation rate requires. A default cover the fee percentage set to 3% or 4% because that felt about right is collecting more than the cost, which is defensible if you say so and awkward if you have told donors it covers the fee.",
          "For a for profit merchant the same widget is a different animal. A checkbox at checkout offering to add the processing cost to a sale is a fee added to a consumer's bill for using a card, and the fact that the customer could have paid by ACH or check instead does not exempt it. Optional in the sense of the customer having chosen it is not the same as optional in the sense the rules care about. If you want to move card costs onto customers without surcharging, the sanctioned route is a cash discount, and Visa is specific about how it has to look: display only the card price, or display the card and cash prices side by side per item, and the total charged on a card must be the displayed total. Visa warns directly that a total reached by adding an extra fee for card payment at the final bill may be treated as a surcharge and subjected to the surcharge rules. In other words, a cash discount that is really a surcharge with better labeling is still a surcharge.",
        ],
      },
      {
        heading: "What grossing up will not fix",
        body: [
          "Refunds are the big one. Grossing up gets the right money in on the way through and does nothing for you on the way back out. Stripe's policy is that processing fees from the original transaction are not returned. Square's is that when you refund a payment, the processing fees for that payment are not refunded back to you. So on that $103.30 charge, refunding the customer in full costs you $103.30 out of pocket against $100.00 that ever reached you, and you are down the full $3.30. If you surcharged, you also have to return the surcharge in full on a full refund and prorate it on a partial one, which means you refund more than you netted. High return rate businesses should model this before deciding a gross up has solved anything.",
          "The formula also assumes you know the rate, which is only reliably true on flat rate pricing. On interchange plus you do not know what a transaction costs until you know which card was presented, because a consumer debit card and a corporate rewards card can differ by well over a percentage point. You can gross up against your blended effective rate from last month's statement and be roughly right on average, but any individual transaction will land above or below, and a premium card on a large ticket can miss by real money. If you are on interchange plus and you need an exact net, price for the worst case card you actually see rather than the average.",
          "It also assumes you picked the right rate off your own processor's schedule, which is easier to get wrong than it sounds. Square is the clearest example: on the Free plan, Square Online and Invoices run 3.3% plus 30 cents, while the eCommerce API runs 2.9% plus 30 cents, and keyed in or card on file transactions run 3.5% plus 15 cents on every plan. Those are three different answers for the same merchant depending on how the payment was taken. Gross up against the wrong one and you are off by 40 or 60 basis points before you start.",
          "And there are costs that simply are not per transaction percentages, so nothing here reaches them. Chargeback and dispute fees land on top and are usually flat. International cards and currency conversion add percentage points that the domestic rate you typed does not include. Amex is often priced separately. Monthly platform fees, gateway fees and monthly minimums are not attached to any one sale and cannot be recovered a transaction at a time. Grossing up handles the arithmetic of one flat rate charge accurately and completely, and that is the whole of what it does.",
        ],
      },
    ],
    rateTable: {
      caption: "What you must charge for exactly $100.00 to land in your account, using each processor's published US rate as checked on 4 September 2026.",
      columns: [
        "Percentage rate",
        "Fixed fee",
        "Charge to net $100",
        "Fee at that amount",
      ],
      rows: [
        {
          label: "Stripe, online standard",
          note: "Stripe's published standard rate for domestic cards, with no setup or monthly fee.",
          values: [
            "2.9%",
            "$0.30",
            "$103.30",
            "$3.30",
          ],
        },
        {
          label: "PayPal Checkout, domestic",
          note: "Same rate applies to PayPal Guest Checkout.",
          values: [
            "3.49%",
            "$0.49",
            "$104.12",
            "$4.12",
          ],
        },
        {
          label: "PayPal donations, domestic",
          note: "Standard rate for receiving domestic donations.",
          values: [
            "2.89%",
            "$0.49",
            "$103.48",
            "$3.48",
          ],
        },
        {
          label: "PayPal confirmed charity",
          note: "Subject to eligibility, application and pre-approval by PayPal.",
          values: [
            "1.99%",
            "$0.49",
            "$102.53",
            "$2.53",
          ],
        },
        {
          label: "Square in person, Free plan",
          note: "Tap, dip or swipe on the $0 per month plan. Plus and Premium are lower.",
          values: [
            "2.6%",
            "$0.15",
            "$102.82",
            "$2.82",
          ],
        },
        {
          label: "Square Online or Invoices, Free plan",
          note: "Square's online store and Invoices on the free plan. The eCommerce API is priced differently.",
          values: [
            "3.3%",
            "$0.30",
            "$103.72",
            "$3.72",
          ],
        },
        {
          label: "Square eCommerce API, or online on Plus or Premium",
          note: "The eCommerce API is 2.9% plus 30 cents on every plan, including Free.",
          values: [
            "2.9%",
            "$0.30",
            "$103.30",
            "$3.30",
          ],
        },
        {
          label: "Square keyed in or card on file",
          note: "Manually entered cards, the same rate on all Square plans.",
          values: [
            "3.5%",
            "$0.15",
            "$103.78",
            "$3.78",
          ],
        },
      ],
    },
    assumptions: [
      "Published rates go stale, and Square's online pricing is the easiest one here to get wrong. On the Free plan, Square Online and Invoices are 3.3% plus 30 cents while the eCommerce API is still 2.9% plus 30 cents; the paid Plus and Premium plans apply 2.9% plus 30 cents to all online methods. Checked on 4 September 2026. Check any rate here against your own statement before you rely on it.",
      "The calculator assumes flat rate pricing: one percentage and one flat fee. On interchange plus the rate is not known until the card is presented, so a gross up against a blended rate is an estimate rather than a guarantee.",
      "Fee rounding is modelled as the percentage component rounded to the nearest cent and the flat fee then added. Processors are not perfectly uniform about rounding and your statement may differ by a cent on any given transaction.",
      "All rates shown are for domestic US consumer cards on each processor's standard published schedule. International cards, currency conversion, Amex where separately priced and negotiated rates all differ and are not modelled.",
      "Card network surcharge rules are actively changing. Trade press reported that the revised Visa and Mastercard interchange settlement received preliminary approval on 9 June 2026 and that it contains expanded surcharging and steering rights for merchants. Preliminary approval is not final approval, and nothing on this page reflects rules that have not taken effect.",
    ],
    faqs: [
      {
        question: "What is the formula to gross up a credit card fee?",
        answer: "Gross equals net plus the fixed fee, divided by one minus the percentage rate, with the rate expressed as a decimal. For a $100 net on 2.9% plus $0.30, that is (100 + 0.30) divided by (1 minus 0.029), which is 100.30 divided by 0.971, or $103.30. The division is the whole trick. It accounts for the fee charged on the amount you added, which is the step multiplication misses.",
      },
      {
        question: "Why doesn't adding 2.9% get me back to $100?",
        answer: "Because the processor charges its percentage on what you actually ran, not on what you wanted to keep. Charge $102.90 and Stripe takes 2.9% of $102.90, which is $2.98, plus the $0.30 fixed fee, for $3.28 total. You net $99.62 rather than $100. The extra $2.90 you added is itself charged 2.9%, and the fixed fee was never covered at all. Adding a bigger percentage does not fix it, because the same problem recurs at every step.",
      },
      {
        question: "How much do I need to charge to receive exactly $1,000?",
        answer: "It depends on the rate. On Stripe's US standard 2.9% plus $0.30, charge $1,030.18 and the fee is $30.18. On PayPal Checkout at 3.49% plus $0.49, charge $1,036.67 for a fee of $36.67. On Square Online or Invoices on the Free plan at 3.3% plus $0.30, charge $1,034.44. On Square in person at 2.6% plus $0.15, charge $1,026.85. The first three markups all exceed 3% of the sale, which matters if you were planning to pass the difference to a customer as a surcharge. Only the Square in person figure, at 2.685%, would fit inside Visa's 3% cap.",
      },
      {
        question: "Can I add a credit card processing fee to my invoice?",
        answer: "Sometimes, and it is more work than it looks. A separate processing fee line for card payment is a surcharge under Visa's definition, which triggers a full set of requirements: 30 days notice to your acquirer, and to Mastercard as well if you take Mastercard, credit cards only since debit and prepaid cannot be surcharged, a cap at the lower of your merchant discount rate or 3% for Visa, disclosure at the point of entry, at the point of sale and on every receipt, and surcharge return on refunds. Several states prohibit or restrict it, and California's SB 478 separately bars advertising one price to consumers and then adding a mandatory fee. Whether it is permitted for your business in your state is a question for a lawyer, not a calculator.",
      },
      {
        question: "Is it legal to ask donors to cover the processing fee?",
        answer: "A voluntary, opt in option for a donor to increase their gift so the charity receives the full amount is not a surcharge, because nothing is being sold and no fee is being added to a bill for using a particular payment method. It is a larger donation. Keep the box unchecked by default, describe it as increasing the gift rather than as a card fee, and offer it on every payment method rather than only on cards. The tax treatment of the extra amount for the donor is a separate question and one for a tax adviser, not for this page.",
      },
    ],
    related: [
      "stripe-fee-calculator",
      "paypal-fee-calculator",
      "square-fee-calculator",
    ],
    links: [
      {
        label: "What a surcharge is",
        href: "/glossary/surcharge",
      },
      {
        label: "Effective rate, explained",
        href: "/glossary/effective-rate",
      },
      {
        label: "Flat rate pricing",
        href: "/glossary/flat-rate-pricing",
      },
      {
        label: "Interchange plus pricing",
        href: "/glossary/interchange-plus",
      },
      {
        label: "Processors for nonprofits",
        href: "/category/nonprofits",
      },
      {
        label: "How to lower payment processing fees",
        href: "/blog/how-to-lower-payment-processing-fees",
      },
      {
        label: "Flat rate vs interchange plus",
        href: "/blog/flat-rate-vs-interchange-plus",
      },
      {
        label: "Stripe profile and pricing",
        href: "/processor/stripe",
      },
      {
        label: "How we test and rate processors",
        href: "/methodology",
      },
    ],
    cta: {
      heading: "Gross up from your real rate, not the headline one",
      body: "This formula is only as good as the rate you type into it. The 2.9% on a pricing page is the domestic consumer card rate, and your statement almost certainly shows something higher once international cards, keyed entries, Amex and monthly fees are folded in. Work out what you actually paid last month, then gross up from that number.",
      label: "Open the effective rate calculator",
    },
  },
  {
    slug: "chargeback-ratio-calculator",
    name: "Chargeback Ratio and Cost Calculator",
    h1: "Chargeback Ratio and Cost Calculator",
    title: "Chargeback Ratio Calculator: Calculate Your Risk",
    description: "Calculate your chargeback ratio and compare it with Visa and Mastercard monitoring thresholds. See how each additional chargeback can affect your ratio and processing risk.",
    intro: "Two US merchants with the same 1.2 percent chargeback rate can be in completely different trouble, because Visa and Mastercard do not measure the same thing and do not use the same month. The Chargeback Ratio and Cost Calculator runs your monthly counts through both formulas as the networks actually define them, scores you against the current Visa VAMP merchant line and the Mastercard ECM and HECM tiers, and then prices what a single chargeback removes from your bank account. Every threshold here comes from Visa's own VAMP fact sheet and Mastercard's Security Rules and Procedures Merchant Edition, with the source and the date next to it. Where a network does not publish a number, this page says so instead of filling the gap.",
    tier: 3,
    summary: "Score your ratio against current Visa and Mastercard thresholds, then price one chargeback.",
    widget: "chargeback",
    workedExample: {
      scenario: "Northline Supply is a US direct-to-consumer brand selling online only. March was 4,000 orders, April was 6,000, at an $85 average order value. In April they took 90 Mastercard chargebacks, and their gateway dashboard reports a 1.50 percent dispute rate for the month. Their unit economics on the average order are $34 of goods, $8 of shipping and $2.77 of processing fees already paid. Their processor charges $15 per chargeback, and each dispute costs a support lead about 45 minutes at a $32 loaded hourly rate.",
      result: "The dashboard is wrong for the only test that matters. Mastercard divides April's 90 chargebacks by March's transaction count, not April's: 90 divided by 4,000 is 2.25 percent, or 225 basis points, against an ECM line of 150. What saves them is the count test. ECM requires at least 100 chargebacks in the month and they have 90, so Mastercard does not identify them in April, though ten more would. On the Visa side they are nowhere near the 1,500 fraud-plus-dispute count minimum, so the 150 basis point merchant line does not reach them at all. The cost side is where the real money sits. Each chargeback costs $34 of goods plus $8 of shipping plus $2.77 of processing fees the processor keeps plus the $15 chargeback fee plus $24 of labour, which is $83.77 out of pocket. Gross margin per order is $85 minus $44.77, or $40.23, a 47.33 percent margin, so replacing $83.77 of cash takes $176.99 of new revenue, about 2.08 more orders at the same average. Ninety chargebacks in April therefore cost roughly $7,539 in cash and about $15,929 of revenue to earn back.",
    },
    sections: [
      {
        heading: "Visa and Mastercard are not counting the same thing",
        body: [
          "Visa's own VAMP fact sheet gives the formula in one line: the VAMP ratio is the count of fraud reports (TC40) plus disputes (TC15) divided by the count of settled transactions (TC05), across card-not-present VisaNet transactions, domestic and cross-border. Three things in that sentence catch merchants out. It is count-based, so a $9 dispute weighs as much as a $900 one. Fraud reports sit in the numerator even when the issuer never files a chargeback, so Visa can push you toward a line with events that never touched your balance. And card-present volume is not in the denominator, so a retailer with an online store is measured on the online store alone.",
          "Mastercard defines its ratio differently, and says so in plain language in the Security Rules and Procedures Merchant Edition dated 4 August 2026: basis points are the number of chargebacks received for a merchant in a calendar month, divided by the number of Mastercard transactions in the preceding month, multiplied by 10,000. The denominator is last month. Not this month, not a trailing average, last month.",
          "That single word does real damage to a growing business. Sell 4,000 orders in March and 6,000 in April, take 90 Mastercard chargebacks in April, and your intuitive rate is 90 over 6,000, or 1.50 percent. Mastercard computes 90 over 4,000, or 2.25 percent. You are 75 basis points worse than your dashboard says purely because you grew. A shrinking business gets the opposite gift, which is one reason chargeback trouble surfaces right after a good quarter.",
          "Neither figure is the one your gateway shows you. Most dashboards divide this month's disputes by this month's transactions across every card brand at once. That is a fine internal metric and it is not what either network scores. Run the two formulas separately, on each brand's own volume, or you are managing to a number nobody enforces.",
        ],
      },
      {
        heading: "The count minimum decides whether the threshold reaches you at all",
        body: [
          "Every one of these programs is an AND, never an OR, and this is where competing pages contradict each other most often. Visa's merchant Excessive line in the United States is 150 basis points, cut from 220 on 1 April 2026, and it applies only where the monthly count of fraud plus disputes reaches 1,500. Visa restated that minimum on its own site in October 2025. The arithmetic lands the opposite way from what small merchants fear: to hold 1,500 fraud and dispute events at exactly the 1.50 percent line you need roughly 100,000 card-not-present Visa transactions that month. Below that scale your ratio can sit at 4 percent and Visa will not name you under VAMP.",
          "Mastercard's counts are much lower and far easier to trip. An Excessive Chargeback Merchant needs at least 100 chargebacks in the month and a ratio of at least 1.50 percent. A High Excessive Chargeback Merchant needs at least 300 and at least 3.00 percent. Both halves of each pair have to be true in the same month, so a merchant with 95 chargebacks at 4 percent is neither, and one with 350 at 2.1 percent stays an ECM because the HECM ratio test fails. Mastercard does not publish those numbers; this page takes them from two acquirer guides that agree. Assessments start in the second month above the line, and at the HECM tier they climb from USD 1,000 in month two to USD 200,000 a month past eighteen months, with issuer recovery adding USD 5 per chargeback above 300 from the fourth month.",
          "So who actually closes an account at 2 percent with 60 chargebacks a month? The acquirer. Every merchant agreement in the United States gives the acquiring bank the right to hold a reserve, reprice, or terminate on its own risk judgment, and most acquirers run an internal limit near 1 percent that they never publish. Termination can be followed by a MATCH listing, which is the thing that genuinely ends a business, and MATCH is an acquirer action rather than a network threshold. Score yourself against the network lines, but understand that the party who moves first is the one reading your statement every month.",
        ],
      },
      {
        heading: "What one chargeback actually removes from your bank account",
        body: [
          "Take an $85 order carrying $34 of goods, $8 of shipping and $2.77 of processing fees already paid, plus a $15 chargeback fee and 45 minutes of somebody's time at $32 an hour. The original settlement and the chargeback debit cancel each other out, so the sale amount is not a cash item twice over. What genuinely leaves the business is the goods, the shipping, the processing fee the processor keeps, the chargeback fee and the labour: 34 plus 8 plus 2.77 plus 15 plus 24, which is $83.77. That is 99 cents on every dollar of the order, gone.",
          "You will read almost everywhere that a chargeback costs two to three times the transaction value. That is not wrong, it is a framing choice, and it is worth watching somebody do it in the open. Add the $85 sale you no longer have to the $83.77 that left the bank and you get $168.77, which is 1.99 times the order. Nudge the labour estimate up or add a write-off and you reach 2.5. The multiple is real, but it turns entirely on whether the reversed sale is counted, and nobody who quotes it says which convention they used.",
          "The figure that changes behaviour is what it takes to get back to even. At $85 with $44.77 of variable cost, this merchant keeps $40.23 of gross margin per order, a 47.33 percent margin. Replacing $83.77 of cash at that margin takes $176.99 of new revenue, which is 2.08 more orders. At 55 chargebacks a month that is about $4,607 of cash a month and roughly $55,288 a year, and the chargeback fee line inside that monthly figure is just $825. The fee is the smallest item in the calculation and the only one most merchants shop on.",
          "Fees vary, though not in the direction you would guess. Square charges nothing for disputes and covers the cost of challenging them. Stripe takes a $15 dispute received fee it never returns, plus a further $15 if you counter, which comes back only if you win. PayPal charges $20 on a card chargeback whether or not the buyer wins, and either $15 or $30 on a PayPal checkout dispute depending on your own dispute ratio. Helcim charges $15 only when you lose. The spread on a single event is about $30 against a total cost near $84.",
        ],
      },
      {
        heading: "What to do at each band, and why a fix takes two months to show up",
        body: [
          "Under 0.50 percent you are clear on both networks and your time is better spent elsewhere. Between 0.50 and 0.90 percent, start instrumenting: split disputes by reason code, by card brand, and by whether they are fraud or service failures, because the fix for friendly fraud and the fix for a delivery problem have nothing in common. Between 0.90 and 1.50 percent you are inside the range most acquirers quietly watch. Above 1.50 percent you are over Mastercard's ECM ratio and over Visa's US merchant line, and whether either program names you comes down entirely to your counts.",
          "Visa's fact sheet carves two things out of the VAMP ratio: disputes resolved through pre-dispute solutions, and TC40 fraud that qualifies for Compelling Evidence 3.0. That exclusion is why Rapid Dispute Resolution and the alert networks get sold so aggressively. Read what you are buying, though. An RDR resolution is a refund: you lose the sale and the goods, you simply keep the event out of the ratio. It buys ratio, not money. Mastercard counts chargebacks received, so a refund issued before the chargeback posts keeps it out of that count too, the same trade in a different wrapper.",
          "Fighting a dispute and winning does not remove it from either ratio. Visa's published exclusions are pre-dispute resolutions and CE3.0-qualified fraud reports, and a dispute you contested and won is on neither list. Mastercard counts chargebacks received, and you received it. Representment gets your money back and leaves your ratio precisely where it was. It is probably the most expensive misunderstanding in this area.",
          "Finally, budget for the lag. Mastercard's denominator is the preceding month, and both networks report a month behind, so a fix you ship today lands in a report your acquirer reads 30 to 60 days from now. If you are near a line, the deadline you are working to is roughly six weeks earlier than the one printed on the letter.",
        ],
      },
    ],
    rateTable: {
      caption: "Published per-chargeback fees at US processors, every figure taken from the processor's own page on 4 September 2026",
      columns: [
        "Fee per chargeback",
        "Returned if you win",
        "Where it is published",
      ],
      rows: [
        {
          label: "Square",
          note: "Square states there are no fees for dispute management services for chargebacks and that it covers the fee for every dispute challenged. Processing fees on the original sale are not refunded when you lose.",
          values: [
            "$0.00",
            "Not applicable",
            "squareup.com dispute help article",
          ],
        },
        {
          label: "Stripe",
          note: "A separate $15.00 dispute countered fee applies when you submit evidence, and that one is returned if you win. Fighting and losing costs $30.00 in fees.",
          values: [
            "$15.00 dispute received fee",
            "No",
            "support.stripe.com dispute pricing, effective 17 June 2025",
          ],
        },
        {
          label: "PayPal, card chargeback",
          note: "Applies to card transactions not processed through a buyer's PayPal account or PayPal Guest Checkout. The User Agreement states it applies regardless of whether the buyer succeeds.",
          values: [
            "$20.00",
            "No",
            "paypal.com US merchant fees and User Agreement",
          ],
        },
        {
          label: "PayPal, checkout dispute",
          note: "The $15.00 standard fee is not charged for disputes decided in your favor, among other exclusions. The $30.00 high volume fee has a shorter exclusion list that does not include a decision in your favor, so it is charged even when you win. It applies when your dispute ratio is 1.5 percent or more and you had more than 100 sales transactions in the previous three full calendar months.",
          values: [
            "$15.00 standard, $30.00 high volume",
            "Standard yes, high volume no",
            "paypal.com US merchant fees and User Agreement",
          ],
        },
        {
          label: "Braintree",
          note: "Flat, with no tiering between commercial and charity rates. The published schedule does not say whether the fee is returned on a win.",
          values: [
            "$15.00",
            "Not stated",
            "paypal.com Braintree fee schedule",
          ],
        },
        {
          label: "Helcim",
          values: [
            "$15.00",
            "Yes, $0 if resolved in your favor",
            "helcim.com pricing",
          ],
        },
        {
          label: "Authorize.net gateway",
          note: "This is the gateway fee only, alongside a $25.00 monthly gateway fee. The acquiring bank behind an Authorize.net account charges its own chargeback fee, which Authorize.net does not publish.",
          values: [
            "$0.00 cards, $25.00 eCheck.Net",
            "Not applicable",
            "authorize.net pricing",
          ],
        },
      ],
    },
    assumptions: [
      "The thresholds in this tool are constants checked on 4 September 2026, not a live feed. Visa cut the US merchant Excessive line from 220 to 150 basis points on 1 April 2026 and has moved the program's numbers more than once since launch, so treat anything here as verify-before-you-rely after roughly six months.",
      "Mastercard's ECM and HECM numbers are not published by Mastercard. The public rulebook gives only the formula and refers to a manual behind a Mastercard Connect login, so the counts and ratios here come from two acquirer program guides, last revised March 2025 and December 2019. They agree with each other, but they are secondary sources and older than the Visa figures on this page.",
      "The calculator scores Visa VAMP and Mastercard ECM and HECM only. American Express and Discover run their own monitoring programs whose current thresholds were not verified for this page, and your acquirer's internal limit is usually stricter than any network line and is not published anywhere.",
      "Ratio mode assumes every transaction you enter is in scope for the program being scored. VAMP covers card-not-present VisaNet transactions only, so if part of your volume is card-present, your real VAMP ratio is higher than the number shown here. Enter each brand's volume separately for an accurate read.",
      "Cost mode treats the settlement and the chargeback debit as cancelling out, so the reversed sale is reported on its own line rather than being folded into the cash loss. Revenue recovered from won disputes, returned inventory and reshipped goods is not modelled, and processor chargeback fees exclude whatever your acquirer, ISO or payment facilitator adds on top.",
    ],
    faqs: [
      {
        question: "What is a good chargeback ratio?",
        answer: "Under 0.50 percent by count is comfortable for a US merchant on both networks. The formal lines are higher: Mastercard's ECM tier starts at 1.50 percent with at least 100 chargebacks in the month, and Visa's US merchant Excessive line is 150 basis points with at least 1,500 fraud and dispute events. The practical ceiling is lower than either, because most US acquirers apply an unpublished internal limit around 1 percent and act on it long before a network does.",
      },
      {
        question: "Is the chargeback ratio based on this month's transactions or last month's?",
        answer: "It depends on the network, and this is where most published guidance is wrong. Mastercard states it directly in its Security Rules and Procedures Merchant Edition: chargebacks received in a calendar month, divided by Mastercard transactions in the preceding month. Visa's VAMP ratio uses settled card-not-present transactions (TC05) as its denominator, and acquirer documentation aligns the numerator and denominator to the same calendar month by central processing date, though Visa's own fact sheet does not name the month. If you are growing, the Mastercard convention alone can add 50 to 100 basis points to your reported ratio.",
      },
      {
        question: "What happens if my chargeback rate goes over 1 percent?",
        answer: "From Visa and Mastercard, on their own, nothing automatic. Both programs require a count as well as a ratio: 100 chargebacks for Mastercard's ECM tier, 1,500 fraud and dispute events for Visa's US merchant line. A small merchant at 1 percent trips neither. What does happen is that your acquirer sees it, and the acquirer holds the reserve, repricing and termination rights in your merchant agreement. That conversation arrives well before any network assessment does.",
      },
      {
        question: "How much does one chargeback actually cost?",
        answer: "On a typical $85 US ecommerce order with $34 of goods, $8 of shipping, $2.77 of processing fees already paid, a $15 chargeback fee and 45 minutes of staff time at $32 an hour, $83.77 leaves the business. Counting the reversed $85 sale as well takes the headline to $168.77, or 1.99 times the order value, which is where the familiar two-to-three-times claim comes from. At a 47.33 percent gross margin it takes $176.99 of new revenue, roughly 2.08 more orders, to earn that cash back.",
      },
      {
        question: "Does winning a chargeback remove it from my chargeback ratio?",
        answer: "No. Mastercard counts chargebacks received in the month regardless of who eventually wins. Visa's published VAMP exclusions are disputes resolved through pre-dispute solutions and TC40 fraud that qualifies for Compelling Evidence 3.0, and a dispute you fought and won is on neither list. Representment recovers the money and leaves your standing unchanged. Only resolving the case before it becomes a chargeback, through a refund or a pre-dispute tool, keeps it out of the count.",
      },
    ],
    related: [
      "credit-card-processing-fee-calculator",
      "effective-rate-calculator",
      "stripe-fee-calculator",
    ],
    links: [
      {
        label: "Chargeback ratio, defined",
        href: "/glossary/chargeback-ratio",
      },
      {
        label: "What a chargeback is",
        href: "/glossary/chargeback",
      },
      {
        label: "Dispute",
        href: "/glossary/dispute",
      },
      {
        label: "Rolling reserve",
        href: "/glossary/rolling-reserve",
      },
      {
        label: "High-risk merchant",
        href: "/glossary/high-risk-merchant",
      },
      {
        label: "Underwriting",
        href: "/glossary/underwriting",
      },
      {
        label: "Processors with no rolling reserve",
        href: "/payment-processors/no-rolling-reserve",
      },
      {
        label: "Best processors for high-risk businesses",
        href: "/blog/best-processors-for-high-risk-businesses",
      },
      {
        label: "High-risk processors",
        href: "/category/high-risk",
      },
      {
        label: "How we test and score processors",
        href: "/methodology",
      },
    ],
    cta: {
      heading: "Your acquirer acts before Visa does",
      body: "If your ratio is drifting toward 1 percent, the conversation that decides your outcome is with the company that underwrites you, not with a card network. Compare US processors on what they charge per dispute, whether they hold a rolling reserve, how they handle representment, and what their underwriting actually tolerates, before you find out on a Tuesday morning.",
      label: "Compare US payment processors",
    },
  },
  {
    slug: "rolling-reserve-calculator",
    name: "Rolling Reserve Calculator",
    h1: "Rolling Reserve Calculator for High-Risk Merchants",
    title: "Rolling Reserve Calculator: Calculate Funds Held",
    description: "Calculate how much money a payment processor holds in a rolling reserve and when those funds may be released. Estimate the working capital tied up by your reserve.",
    intro: "The Rolling Reserve Calculator gives you the number your term sheet leaves out: the permanent cash hole a reserve creates, which is roughly your monthly card volume multiplied by the reserve percentage multiplied by the hold period in months. On $100,000 a month at a 10% reserve held for six months, that is $60,000 locked up from month six onward, with the first release landing in month seven. Enter your own volume, percentage and hold period to get the month-by-month held and released amounts, the peak balance and the month the first batch comes back. Every constant on this page is sourced to a processor agreement, a card network rule or a Federal Reserve release read on September 4, 2026.",
    tier: 3,
    summary: "See how much working capital a rolling reserve locks up, and when the first release lands.",
    widget: "rolling-reserve",
    workedExample: {
      scenario: "A supplement subscription business doing $100,000 a month in card volume signs with a high-risk acquirer at a 10% rolling reserve on a six month hold. The first batch is withheld in January.",
      result: "Every month, $10,000 goes into reserve. The balance is $10,000 at the end of January, $30,000 by the end of March, and $60,000 by the end of June. In July the January batch finally releases: $10,000 in, $10,000 out, balance flat at $60,000. That $60,000 is the steady state and it stays there for every month the account processes. The arithmetic is $100,000 x 10% x 6 = $60,000. At the 6.75% bank prime loan rate reported in the Federal Reserve H.15 release of September 2, 2026, financing a $60,000 gap you did not plan for costs about $4,050 a year. Double the business to $200,000 a month and the locked balance doubles to $120,000, funded out of exactly the year you are growing fastest. The merchant is never billed a reserve fee and never sees the $60,000 again until the account closes.",
    },
    sections: [
      {
        heading: "A rolling reserve is a working capital hole, not a fee",
        body: [
          "Merchants read a term sheet that says 10% rolling reserve, 180 days and file it next to the discount rate, as if it were another 10% off the top. It is not. Every dollar comes back to you if chargebacks do not eat it. It is collateral, not a charge. It moves a fixed slice of your cash from your bank account to the processor's and keeps it there for as long as you process. The number that matters is not the percentage on the term sheet but monthly volume multiplied by the reserve percentage multiplied by the hold period in months.",
          "Run that on a real account. A business doing $100,000 a month at 10% on a six month hold has $10,000 withheld every month. Month one it holds $10,000, month two $20,000, and by the end of month six the balance is $60,000. In month seven the first batch releases, and from then on $10,000 goes in and $10,000 comes out every month. Cash flow normalises. The $60,000 does not come back.",
          "That plateau is where merchants stop paying attention, and it is the expensive part: the monthly pain has gone and the balance sheet hole is permanent. At the 6.75% bank prime loan rate in the Federal Reserve's H.15 release of September 2, 2026, carrying $60,000 you cannot touch costs roughly $4,050 a year in financing. The hole also scales with success: grow to $200,000 a month and the steady state locked balance grows to $120,000, funded out of the months when you are buying inventory and hiring.",
        ],
      },
      {
        heading: "Rolling, upfront, minimum and capped are four different problems",
        body: [
          "A rolling reserve withholds a percentage of every batch and releases each batch on its own clock. PayPal's US User Agreement spells out the mechanics: a reserve set at 10% for a 90 day rolling period means 10% of day 1's money is held and released on day 91, day 2's money on day 92, and so on. PayPal calls rolling reserves the most common type. Stripe works the same way, holding a percentage of each charge and releasing that hold a set number of days later.",
          "An upfront reserve is a different instrument. You post a lump sum before processing a single transaction, and nothing is withheld from your daily batches. PaymentCloud puts the usual size at 50% to 100% of monthly processing volume. That is brutal at signup and benign afterwards. A rolling reserve is the reverse: painless in week one and permanent thereafter. If you have the cash and you expect to grow, an upfront reserve is often cheaper, because it does not scale with your volume.",
          "A minimum reserve is a floor balance you must keep available in the account at all times. PayPal builds one either as a single upfront deposit or by taking a percentage of sales until the floor is reached, and its agreement states that one or both categories may be applied at the same time. Read your reserve notice carefully for the word 'and', because two reserves at once is a documented possibility, not a horror story.",
          "A capped reserve withholds a percentage until the balance hits a fixed ceiling and then stops. This is the version to ask for, and Corepay and Stripe both describe it. A capped reserve behaves identically to a rolling one until you reach the cap, then stops growing while the rolling version tracks your volume forever. If an acquirer opens with 10% rolling, ask what the same risk looks like capped at six months of reserve at today's volume. You are asking them to fix the number, not lower it, which is a much easier yes.",
        ],
      },
      {
        heading: "What US processors actually publish, and why 180 days keeps appearing",
        body: [
          "There is no rate card for reserves. The networks permit them and set no number. Visa's public rules require an acquirer to pay its merchant promptly after transaction deposit, less credits, discounts, disputes, other agreed fees, and 'Merchant reserve funds (if applicable) accumulated to guarantee the Merchant's ... payment system obligations to the Acquirer.' A second rule, US region only, requires an acquirer to hold and control reserves accumulated from merchant settlement funds. Both are permission, not a formula. Your reserve is a term in your merchant agreement and nothing else, which is why the same business gets quoted 5% at one acquirer and 15% at another the same week.",
          "What does get published sits in a narrow band. Stripe's guidance puts rolling reserves at 5% to 15% of each transaction, with 30 to 90 days for lower risk sectors and 180 days or more for industries with higher chargeback rates. PayPal's contractual example is 10% for 90 days. Corepay, a US high-risk acquirer, publishes 5% to 15% with holds usually 90 to 180 days. PaymentCloud puts the average at 5% to 10% of expected monthly sales volume. Square publishes neither a percentage nor a duration.",
          "The 180 day figure is not arbitrary and it is not a floor. Under the Visa Core Rules and Visa Product and Service Rules effective April 18, 2026, the standard dispute time limit is 120 calendar days from the transaction processing date, with certain delayed delivery conditions stretching to a ceiling of 540 calendar days. Regulation Z adds a shorter clock at the front: a cardholder must give notice of a billing error no later than 60 days after the creditor transmitted the first periodic statement reflecting it. So 120 days covers most exposure and 180 gives an acquirer a margin. Stripe's Connect Reserves API enforces that ceiling in code: a hold cannot be scheduled more than 180 days out, and releases automatically at 180 days.",
          "If you are quoted more than six months, or more than 10%, the burden is on the acquirer to name the exposure. Ask which dispute conditions apply to your product and for how long. A merchant shipping physical goods in three days has a completely different tail than one selling a twelve month membership. Bring the 120 day number to the conversation.",
        ],
      },
      {
        heading: "When it goes on, when it comes off, and what happens when you leave",
        body: [
          "PayPal publishes the factors it weighs, and they are the ones every underwriter uses: how long you have been in business, whether your industry has a higher likelihood of chargebacks, your payment processing history with PayPal and other providers, your business and personal credit history, your delivery time frames, and whether you have a higher than average number of returns, chargebacks, claims or disputes. Stripe adds two more: longer than average delivery windows, and an unexplained sharp increase in processing volume. A good month can trigger a reserve.",
          "Coming off is slower than going on and it is never automatic. Stripe runs another credit review a few days before a reserve is set to expire and decides then whether to remove, decrease, increase or extend it. Square reviews accounts with reserves after a minimum of six months, proactively and without being asked. PaymentCloud is blunter: renegotiation becomes possible only after about six months of actual processing without chargebacks. Nothing moves unless you ask, with a chargeback ratio and a refund policy to point at.",
          "Read the release language in your contract before you rely on the hold period. The Stripe Services Agreement, section 3.3, says the user acknowledges Stripe has sole control over the Reserve, has no legal or equitable right or interest in any earnings generated by it, and that Stripe releases funds 'only if, and to the extent that, Stripe is satisfied that the relevant risk exposure has been mitigated.' The hold period on your term sheet is a schedule, not a guarantee, and the interest your money earns is not yours.",
          "Leaving is where the number gets ugly, and almost nobody models it. Stopping processing stops new withholding, but the existing balance does not release on the same day. PaymentCloud states that banks usually hold reserve funds for 180 days post closure. PayPal's user agreement lists, among the actions it may take, holding your business account balance for up to 180 days to protect against the risk of liability, and longer under a court order. Square's terms say only that funds held at closure are paid out on your payout schedule, naming no day count at all. Switch from acquirer A to acquirer B, both wanting 10% for six months, and the worst case is not a wash: A's $60,000 sits frozen post closure while B's builds from zero, and your peak locked balance hits $120,000 for the overlap. Budget that before you sign with B, not after.",
        ],
      },
    ],
    rateTable: {
      caption: "Reserve terms US processors actually publish. Every figure below was read from the named source on September 4, 2026. Where a processor does not publish a number, this table says so rather than estimating.",
      columns: [
        "Reserve percentage",
        "Hold period",
      ],
      rows: [
        {
          label: "Stripe, published guidance",
          note: "In Stripe's Connect Reserves API, a hold cannot be scheduled more than 180 days after it is created and releases automatically once 180 days pass.",
          values: [
            "5% to 15% of each transaction",
            "30 to 90 days for lower risk, 180 days or more for higher chargeback industries",
          ],
        },
        {
          label: "PayPal, US User Agreement",
          note: "PayPal calls rolling reserves the most common type, and states that one or both categories of reserve, rolling and minimum, may be applied at the same time.",
          values: [
            "10% in PayPal's own contractual example",
            "90 day rolling period in that example",
          ],
        },
        {
          label: "Square",
          note: "Square's payment terms allow the reserve to be raised, reduced or removed at any time in its sole discretion, based on payment history, a credit review, or the amount of any arbitration award or court judgment.",
          values: [
            "Not published, set per account",
            "Not published; accounts with reserves are reviewed after a minimum of six months",
          ],
        },
        {
          label: "Corepay, high-risk acquirer",
          note: "Also describes capped reserves, which withhold until a predetermined maximum, and upfront reserves funded before processing starts.",
          values: [
            "5% to 15%",
            "Usually 90 to 180 days",
          ],
        },
        {
          label: "PaymentCloud, high-risk acquirer",
          note: "Upfront reserves are separately described as 50% to 100% of monthly processing volume. Banks usually hold reserve funds for 180 days post closure.",
          values: [
            "5% to 10% of expected monthly sales volume",
            "Rolling, usually six months to a year of processing",
          ],
        },
      ],
    },
    assumptions: [
      "Constant volume, zero refunds and zero disputes. The calculator models the reserve as a pure cash timing machine. Real reserves get drawn down: Stripe releases a hold immediately to cover a refund or dispute equal to or larger than that hold, so a real balance sits below the modelled one. Treat the output as the ceiling on what is locked up, not a prediction.",
      "Monthly arithmetic on a daily schedule. PayPal and Stripe both hold and release per transaction per day, not per month. This tool treats a six month hold as 180 days, so day 1 money releases on day 181. The steady state total is the same either way, but your first release lands on a specific day, not on the first of a month.",
      "Published ranges, not your contract. Nothing here overrides your reserve notice. Acquirers set reserves individually and two merchants in the same vertical routinely get different terms in the same week.",
      "The financing cost figure goes stale. The 6.75% carry rate is the bank prime loan rate from the Federal Reserve H.15 release of September 2, 2026, which is published weekly. Check the current rate before quoting the annual cost.",
      "Processor terms go stale too. The Stripe, PayPal and Square documents cited here were read on September 4, 2026, the PayPal US User Agreement then in force being the version last updated on September 1, 2026, and all three companies reserve the right to change reserve terms.",
    ],
    faqs: [
      {
        question: "Do you get rolling reserve money back?",
        answer: "Yes, unless chargebacks or refunds consume it. A rolling reserve is your money held as collateral, not a fee, so it is released on schedule as each batch ages past the hold period. Stripe puts it plainly: reserve funds are released in full at the end of the reserve period if they are not needed to cover disputes or refunds. Two caveats matter. First, release is conditional in most contracts: Stripe's Services Agreement says it will release reserve funds only if and to the extent it is satisfied the relevant risk exposure has been mitigated. Second, you do not earn anything on it. Stripe's agreement states the user has no legal or equitable right or interest in any earnings generated by the reserve. So you get the principal back and the processor keeps the float.",
      },
      {
        question: "How long is a typical rolling reserve hold?",
        answer: "90 to 180 days is the normal band for a US high-risk account. Corepay publishes 90 to 180 days, Stripe's guidance says 30 to 90 days for lower risk sectors and 180 days or more for high chargeback industries, and PayPal's contractual example uses 90 days. 180 days is a common ceiling because the standard Visa dispute time limit is 120 calendar days from the transaction processing date, which leaves the acquirer a margin. Stripe's Connect Reserves API enforces 180 days as a hard maximum on any single hold.",
      },
      {
        question: "How do I get a rolling reserve lifted or reduced?",
        answer: "You ask, with numbers, after building a track record. Stripe runs a fresh credit review a few days before a reserve is set to expire and decides then whether to remove, decrease, increase or extend it. Square reviews accounts with reserves after a minimum of six months, and says that review happens proactively without needing to be requested. PaymentCloud says renegotiation is realistic only after about six months of actual processing without chargebacks. Come to the conversation with your chargeback ratio, your refund rate, your dispute win rate and any fulfilment changes you made. If a full removal is refused, ask to convert a rolling reserve to a capped one, which fixes the number instead of letting it grow with your volume.",
      },
      {
        question: "What happens to my rolling reserve when I close my merchant account?",
        answer: "It does not release on your last processing day. The chargeback tail outlives the account, so processors hold the balance past closure. PaymentCloud states that banks usually hold reserve funds for 180 days post closure. PayPal's user agreement lists holding your business account balance for up to 180 days among the actions it may take if reasonably needed to protect against the risk of liability, and longer under a court order or regulatory requirement. Square's payment terms say only that funds held in custody at closure are paid out on your payout schedule, subject to the other conditions in those terms, with no day count stated. Plan for up to six months after your last transaction, and remember that if you are moving to a new acquirer with its own reserve, you can be funding both at once.",
      },
      {
        question: "Is money held in a rolling reserve still taxable revenue?",
        answer: "That is an accounting and tax question, not a payments question, and it depends on your method of accounting and your specific agreement. This page does not answer it and this calculator deliberately reports cash held and cash released only. Bring your reserve notice and your processor statements to a CPA. The practical point for planning is separate and not in dispute: reserve cash is not available to you, so a business that is profitable on paper can still miss payroll while a reserve builds.",
      },
    ],
    related: [
      "effective-rate-calculator",
      "credit-card-processing-fee-calculator",
      "interchange-plus-vs-flat-rate-calculator",
      "compound-interest-calculator",
    ],
    links: [
      {
        label: "Rolling reserve, defined",
        href: "/glossary/rolling-reserve",
      },
      {
        label: "Chargeback ratio: the number that triggers a reserve",
        href: "/glossary/chargeback-ratio",
      },
      {
        label: "High-risk merchant",
        href: "/glossary/high-risk-merchant",
      },
      {
        label: "How underwriting decides your reserve",
        href: "/glossary/underwriting",
      },
      {
        label: "Payout time and settlement",
        href: "/glossary/payout-time",
      },
      {
        label: "Processors that advertise no rolling reserve",
        href: "/payment-processors/no-rolling-reserve",
      },
      {
        label: "High-risk processors compared",
        href: "/category/high-risk",
      },
      {
        label: "Best processors for high-risk businesses",
        href: "/blog/best-processors-for-high-risk-businesses",
      },
      {
        label: "PaymentCloud review",
        href: "/processor/paymentcloud",
      },
      {
        label: "Corepay review",
        href: "/processor/corepay",
      },
      {
        label: "Easy Pay Direct review",
        href: "/processor/easy-pay-direct",
      },
      {
        label: "Soar Payments review",
        href: "/processor/soar-payments",
      },
      {
        label: "How we test and rate processors",
        href: "/methodology",
      },
    ],
    cta: {
      heading: "Know your number before the underwriting call",
      body: "Work out your steady state locked balance here, then take it into the conversation. An acquirer quoting 10% for six months is asking for a specific dollar figure out of your working capital, and naming that figure back to them changes the negotiation. If the answer is more cash than your business can spare, our high-risk processor comparison shows which US acquirers publish capped reserves, shorter holds, or none at all.",
      label: "Compare high-risk processors",
    },
  },
  {
    slug: "payout-date-calculator",
    name: "Payout Date Calculator",
    h1: "Payout Date Calculator: When Will the Money Hit My Bank?",
    title: "Payout Date Calculator: Find Your Settlement Date",
    description: "Calculate when your payment processor payout should arrive based on the settlement rule, weekends and US Federal Reserve holidays. Get an estimated calendar date instead of “in 2 days.”",
    intro: "A card payment taken today almost never lands today, and the ranking pages that describe the rule in prose stop short of telling you the date. The Payout Date Calculator takes your processor, the calendar date and clock time of the sale, and the payout speed you pay for, then resolves the rule to an actual date, skipping weekends and every day the Federal Reserve is closed in 2026 and 2027. It gets the awkward cases right, including the Saturday holiday rule that makes Friday July 3, 2026 a normal settlement day even though most offices are shut. It also flags the part nobody can promise: the final hop into your account is your bank's decision, not your processor's.",
    tier: 3,
    summary: "Resolves your processor's payout rule to a real calendar date, weekends and Fed holidays included.",
    widget: "payout-date",
    workedExample: {
      scenario: "A Square seller in Austin runs $18,400 through the terminal on Thursday July 2, 2026, with the last card tapped at 3:10 PM Central. Payroll clears Friday morning. Two questions: will the money be there, and is it worth paying for an Instant Transfer to be sure?",
      result: "Square's default close of day is 5 PM PT, which is 8 PM ET. The 3:10 PM CT sale is 4:10 PM ET, before the cutoff, so it belongs to the Thursday July 2 batch. Square's standard timing is next business day. The next calendar day is Friday July 3, 2026. Independence Day 2026 falls on Saturday July 4, and under the Federal Reserve rule for Saturday holidays, Reserve Banks are open the preceding Friday. So July 3 is a normal settlement day and the expected deposit date is Friday July 3, 2026, at no cost. An Instant Transfer would move the same $18,400 immediately at 1.95%: $18,400 x 0.0195 = $358.80. That buys less than one business day, which is about 712% on a simple annualized basis (1.95% x 365). What it actually buys is certainty about the hour rather than the day, because Square's own wording for the parallel Friday case is that funds post by Monday morning depending on your bank's processing speeds. If your bank posts the overnight file early, the $358.80 buys nothing. Now change one variable. The same $18,400 taken Friday July 2, 2027 at 4:10 PM ET also makes the pre-cutoff batch, but July 4, 2027 falls on a Sunday, so the Federal Reserve observes it on Monday July 5. Next business day is Tuesday July 6, 2027, four calendar days out instead of one. The same $358.80 now buys four days, about 178% annualized, and that is the weekend where the fee can actually be defensible.",
    },
    sections: [
      {
        heading: "Why next day funding is not 24 hours",
        body: [
          "A card sale runs on three separate clocks and only one of them belongs to your processor. The first is the authorization, which takes about two seconds and moves no money. The second is the batch, the moment your terminal or gateway hands the day's captured transactions to the acquirer. The third is the payout, an ACH credit your processor originates and the Federal Reserve settles on a banking day. Next day funding describes the gap between the second clock and the third, not the gap between the customer's tap and money you can spend.",
          "That distinction is where merchants get burned. A Toast restaurant that closes out at 10:00 PM Eastern has missed Toast's 9:30 PM ET cutoff by half an hour, and the deposit moves from next business day to two business days out. A Square seller who runs a card at 8:30 PM ET has missed the 8:00 PM ET close of day and lands in tomorrow's batch. Neither merchant did anything wrong. They crossed a line that lives in a help article rather than on the merchant agreement.",
        ],
      },
      {
        heading: "What the Federal Reserve counts as a business day",
        body: [
          "The Federal Reserve observes eleven holidays. In 2026 they are January 1, January 19, February 16, May 25, June 19, July 4, September 7, October 12, November 11, November 26 and December 25. In 2027 they are January 1, January 18, February 15, May 31, June 19, July 4, September 6, October 11, November 11, November 25 and December 25. The dates are the easy part. The observance rules are where the arithmetic breaks.",
          "When a holiday falls on a Saturday, Federal Reserve Banks and Branches are open the preceding Friday. That is the reverse of the federal employee rule, which moves the day off to Friday, and it is the most common error in payout math. Independence Day 2026 falls on Saturday July 4. Federal offices close Friday July 3, so your branch may be dark, but the Fed is settling and payouts move normally. The same happens twice in 2027: Juneteenth falls on Saturday June 19 and Christmas on Saturday December 25. Neither costs you a settlement day.",
          "When a holiday falls on a Sunday, Reserve Banks close the following Monday. July 4, 2027 is a Sunday, so Monday July 5, 2027 is a real closure and every payout scheduled for it slides to Tuesday July 6. Two 2026 dates catch people out for the opposite reason, landing midweek instead of making a long weekend. Juneteenth 2026 is a Friday and Veterans Day 2026 is a Wednesday. A Wednesday closure splits the week: a Tuesday November 10 sale on Stripe's two business day schedule pays out Friday November 13, not Thursday.",
          "Card networks do not stop for any of this. Authorizations clear on Christmas morning. What stops is the bank leg. Most payouts still move as an ACH credit, which follows the Federal Reserve calendar exactly. The exceptions are built on newer rails: Helcim's Faster Deposits moves money over RTP and FedNow, and every instant payout product pushes to a debit card. That is why those pay on a Sunday and a standard transfer cannot.",
        ],
      },
      {
        heading: "Cutoffs are where you lose the day",
        body: [
          "Every processor draws its line at a different hour in a different time zone, which is why a single rule of thumb is useless. Square's default close of day is 5:00 PM Pacific, or 8:00 PM Eastern. Toast cuts at 9:30 PM Eastern and runs an automatic batch at 4:00 AM local for anyone who never closes out. Helcim wants the batch closed by 7:00 PM Mountain to qualify for next business day funding, with terminals defaulting to a 5:00 PM auto settlement in your account time zone. PayPal flags withdrawals started after 7:00 PM Eastern as potentially a day later, and PayPal's clock runs from when you start the withdrawal, not from the sale.",
          "Clover is the one you cannot look up. Its help centre says Clover picks your closeout method and time from the details on your application, so there is no published default hour that applies to every merchant. An older Clover blog post cites a 1:00 AM default, and an overnight close is genuinely useful where it applies, because a bar that stops serving at midnight still makes that night's batch. Since the hour is set account by account, this calculator does not shift a Clover batch on clock time. Look up yours in the Dashboard: a sale after it belongs to the next day's batch.",
          "Geography does real damage. A Square seller in Honolulu who takes a card at 4:00 PM local has already passed 8:00 PM Eastern and is in tomorrow's batch. A Pacific time restaurant on Toast that closes at 10:00 PM local is batching at 1:00 AM Eastern, past the 9:30 PM cutoff and into a different calendar day.",
          "Stripe and Adyen work on a different principle. Stripe publishes no hourly cutoff. Its US default is a rolling two business day delay counted from the day the charge is created, so the clock time of the sale does not change the answer. Adyen closes a sales day at midnight to midnight in the merchant account's local time zone, then applies a payout delay of two business days for accounts settling mainly in USD. Adyen is also explicit that a bank holiday on the sales day, on the payout day, or anywhere in between increases that delay.",
        ],
      },
      {
        heading: "What speed costs and when it is worth buying",
        body: [
          "Instant is a real product at a real price. Stripe charges US accounts 1.5% per Instant Payout with a 50 cent minimum, a 9,999 dollar cap per payout and ten payouts a day, with funds landing within 30 minutes, weekends and holidays included. Square charges 1.95% per Instant Transfer and runs it around the clock, bank holidays included, though new sellers are capped at one transfer a day of up to 2,000 dollars. Clover's Rapid Deposit is 1.75%, deducted from your next standard deposit and paid to an eligible Visa or Mastercard debit card. PayPal business accounts pay 1.50% for Instant Transfer, 50 cent minimum, capped at 25,000 dollars per transaction to a bank account.",
          "Price those against the wait they remove. Paying 1.95% to pull a deposit forward by one business day works out to roughly 712% on a simple annualized basis. Paying the same 1.95% to bridge a Friday sale across the four calendar days to Tuesday July 6, 2027 is roughly 178% annualized. Neither is cheap. Either can still be correct if the alternative is a failed payroll run or a supplier who pulls your terms, and both are indefensible if you are buying a day you did not need.",
          "The free version of speed is almost always a cutoff change, not a product. Moving a Toast batch from 10:00 PM Eastern to 9:00 PM Eastern converts a two business day deposit into a next business day one, free. Moving a Helcim settlement from 8:00 PM Mountain to 6:00 PM Mountain does the same. Helcim will also give you next business day funding free through Faster Deposits if your bank is on RTP or FedNow. Check the batch time before you buy the fee.",
        ],
      },
      {
        heading: "The last leg nobody controls",
        body: [
          "Every date this tool produces is when your processor is expected to release the payout, not a promise from your bank. Once the ACH credit settles, your receiving bank decides when it posts to your available balance. Some post the overnight file before dawn, some mid morning, and some hold credits on a new commercial account through a review period. Adyen says plainly that on bank holidays clearing for a currency may be closed, so it cannot process payouts, and that funds can take up to two days to arrive depending on the banks involved.",
          "A whole category of holds is not modeled here, because they are account specific and none publish a schedule. New accounts sit under verification, and Clover states that deposits may be delayed a few extra days until verification completes. High risk accounts carry rolling reserves. A volume spike or a chargeback ratio problem triggers a manual risk review. Backup withholding starts when tax identification information is wrong or incomplete. If a deposit is missing and the date math says it should not be, the cause is almost always one of those, not the Fed calendar.",
          "Use the output as the earliest reasonable date, plan cash to the day after it, and treat the instant option as insurance rather than routine.",
        ],
      },
    ],
    rateTable: {
      caption: "Published US payout timing, batch cutoffs and instant payout fees, verified against each processor's own documentation on September 4, 2026. Standard timing counts business days, not calendar days.",
      columns: [
        "Standard timing",
        "Batch cutoff",
        "Instant option and fee",
      ],
      rows: [
        {
          label: "Stripe",
          note: "First payout on a new account completes 7 to 14 days after the first live payment. Manual payouts started before 5:00 PM ET can settle same day.",
          values: [
            "2 business days from the charge",
            "None published",
            "Instant Payouts, 1.5%, $0.50 min, $9,999 max, 10 per day",
          ],
        },
        {
          label: "Square",
          note: "Same-Day Transfer sends at 8:15 PM ET, or 15 minutes after close of day, for the same 1.95%. New sellers are limited to one instant transfer a day of up to $2,000.",
          values: [
            "Next business day before cutoff, second business day after",
            "5 PM PT / 8 PM ET close of day",
            "Instant Transfer, 1.95%, 24 hours a day",
          ],
        },
        {
          label: "PayPal",
          note: "Money sits in your PayPal balance first. Standard bank transfers are free. Transfers to a card cap at $50,000 per transaction.",
          values: [
            "Typically 1 business day, up to 1 to 3",
            "7:00 PM ET, on the withdrawal not the sale",
            "Instant Transfer, 1.50% business, $0.50 min, $25,000 max to a bank",
          ],
        },
        {
          label: "Helcim",
          note: "Terminals default to a 5:00 PM auto settlement in your account time zone. Banks not on RTP or FedNow fall back to 1 to 3 business days. ACH runs 3 to 5 business days.",
          values: [
            "1 to 2 business days after the batch settles",
            "7:00 PM MT for next business day funding",
            "No instant product. Faster Deposits is next business day at no cost, over RTP and FedNow",
          ],
        },
        {
          label: "Adyen",
          note: "The 2 day delay applies where at least 80% of transactions are in USD, EUR, GBP, CAD, AUD, NZD, SEK or RON. A bank holiday on the sales day, the payout day, or in between increases the delay.",
          values: [
            "2 business days for USD accounts",
            "Sales day closes midnight to midnight, account local time",
            "No instant payout. Delay can be shortened at a premium",
          ],
        },
        {
          label: "Clover",
          note: "The Rapid Deposit fee is deducted from your next standard deposit. Clover sets your closeout time from your application, so check your own in the Dashboard.",
          values: [
            "1 to 3 business days after closeout",
            "Not published, assigned per merchant at signup",
            "Rapid Deposit, 1.75% per deposit, to a Visa or Mastercard debit card",
          ],
        },
        {
          label: "Toast",
          note: "A federal banking holiday on your scheduled deposit day delays the deposit by one day.",
          values: [
            "Next business day before cutoff, two business days after",
            "9:30 PM ET, auto batch at 4:00 AM local",
            "No instant payout product published",
          ],
        },
        {
          label: "SumUp",
          note: "Payouts go out daily except weekends and federal holidays. Weekly runs Monday, monthly on the third business day. The calculator uses 2 business days because the range starts at the send date.",
          values: [
            "1 to 2 business days from the time the payout is sent",
            "None published",
            "No instant payout to an external bank account",
          ],
        },
      ],
    },
    assumptions: [
      "The result is the date your processor is expected to release the payout, not the moment your bank posts it. Receiving banks set their own posting windows and can add hours or a full day, and no processor controls that leg.",
      "Every processor timing here is the published default for a standard US account in good standing. Negotiated funding terms, reseller-sold next day funding upgrades, and enterprise contracts override these numbers and are not public.",
      "Where a processor publishes a range, the calculator uses the fast end and the note names the slow end. PayPal publishes 1 to 3 business days, Clover 1 to 3, Helcim 1 to 2. SumUp is the exception: its 1 to 2 business days is measured from the moment SumUp sends the payout rather than from the sale, so the calculator uses 2. Treat every date as the earliest reasonable arrival.",
      "Account level holds are not modeled: new account verification, rolling reserves, risk reviews, chargeback holds and backup withholding all delay funding on schedules no processor publishes.",
      "The holiday table covers 2026 and 2027 only, and the Federal Reserve normally publishes the following year in advance. Cutoff times and instant payout fees change without much notice, so this page needs a re-verification pass against every source URL at least once a year and again each time the Fed posts a new schedule.",
    ],
    faqs: [
      {
        question: "When will my Stripe payout hit my bank account?",
        answer: "For a standard US Stripe account the default is two business days from the day the charge is created, and Stripe does not publish an hourly cutoff, so the time of day does not change the date. A Monday charge pays out Wednesday if no holiday intervenes. Weekends and Federal Reserve holidays push it forward, so a Tuesday November 10, 2026 charge pays out Friday November 13 because Veterans Day falls on Wednesday November 11 that year. New accounts are different: Stripe schedules the first payout to complete 7 to 14 days after your first live payment, so do not plan cash around the standard rule until you are past that.",
      },
      {
        question: "Is July 3, 2026 a bank holiday for payment processing?",
        answer: "No. Independence Day 2026 falls on Saturday July 4, and the Federal Reserve rule for a Saturday holiday is that Reserve Banks and Branches are open the preceding Friday. Federal offices and many bank branches close July 3, which is why so many merchants expect a delay, but settlement runs normally and a payout scheduled for July 3, 2026 should arrive that day. The rule flips when a holiday falls on a Sunday: July 4, 2027 is a Sunday, Reserve Banks close Monday July 5, 2027, and that one genuinely costs you a settlement day.",
      },
      {
        question: "Why did my Friday sale not deposit until Tuesday?",
        answer: "Almost always because the sale missed Friday's cutoff and the batch date rolled to Saturday, which is not a banking day, so the business day count did not start until Monday. Helcim states this directly: settle a batch on a Friday evening and the business day countdown begins Monday. Add a Monday holiday and you get Tuesday. If your processor is on a two business day schedule rather than next day, a Friday afternoon sale lands the following Wednesday as a matter of routine, with nothing wrong.",
      },
      {
        question: "Does Square deposit on weekends?",
        answer: "Standard transfers do not, because they ride the ACH rails and those follow the Federal Reserve calendar. Square's own guidance is that a payment accepted Friday before 5 PM PT posts to your bank by Monday morning, depending on your bank's processing speeds. Square also holds Friday transfers in your balance over the weekend by default so the money stays available to Instant Transfer, which does run 24 hours a day including bank holidays at 1.95% per transfer. During a bank holiday, Square says your regular transfer arrives the day after the holiday.",
      },
      {
        question: "Is an instant payout worth the fee?",
        answer: "Do the arithmetic on the days you are actually buying. Square and Clover charge 1.95% and 1.75%, Stripe charges 1.5% for US accounts and PayPal business accounts pay 1.50%. Paying 1.95% to move money forward one business day is about 712% on a simple annualized basis. Paying it to bridge a four day holiday weekend is about 178%. Both are expensive money, but a $358.80 fee on an $18,400 deposit is cheap next to a failed payroll run. Before you pay it, check whether moving your batch cutoff an hour earlier gets you the same day for free.",
      },
    ],
    related: [
      "stripe-fee-calculator",
      "square-fee-calculator",
      "paypal-fee-calculator",
    ],
    links: [
      {
        label: "What settlement means",
        href: "/glossary/settlement",
      },
      {
        label: "What a batch is",
        href: "/glossary/batch",
      },
      {
        label: "Payout time explained",
        href: "/glossary/payout-time",
      },
      {
        label: "Rolling reserve",
        href: "/glossary/rolling-reserve",
      },
      {
        label: "Underwriting and new account holds",
        href: "/glossary/underwriting",
      },
      {
        label: "Compare all payment processors",
        href: "/processors",
      },
      {
        label: "Stripe profile and payout terms",
        href: "/processor/stripe",
      },
      {
        label: "Square profile and payout terms",
        href: "/processor/square",
      },
      {
        label: "Toast profile and payout terms",
        href: "/processor/toast",
      },
      {
        label: "Clover profile and payout terms",
        href: "/processor/clover",
      },
      {
        label: "Helcim profile and payout terms",
        href: "/processor/helcim",
      },
      {
        label: "Processors that settle by ACH",
        href: "/payment-processors/ach",
      },
      {
        label: "How we test and verify",
        href: "/methodology",
      },
    ],
    cta: {
      heading: "Stop paying 1.95% for a day you already had",
      body: "Most merchants who buy instant payouts are bridging a gap their own batch cutoff created. Run your real sale time through the calculator, then check what your processor charges to accept card payments in the first place. The processing rate usually costs more per year than every instant transfer fee combined.",
      label: "Compare processor rates and payout terms",
    },
  },
  {
    slug: "involuntary-churn-calculator",
    name: "Involuntary Churn Calculator",
    h1: "Involuntary Churn Calculator",
    title: "Involuntary Churn Calculator: Revenue Lost to Failed Payments",
    description: "Estimate revenue and customers lost because recurring card payments fail. Separate involuntary churn from voluntary cancellations to measure the impact of payment failures.",
    intro: "This involuntary churn calculator sizes the revenue you lose to failed card payments, and only to failed card payments. You give it your subscriber count, your average revenue per subscriber, your monthly decline rate, what you currently recover through retries and dunning, and what you think you could recover. It returns monthly revenue at risk, revenue recovered, revenue lost, the upside at your target recovery rate, the annualised figure, and your effective involuntary churn rate. Every benchmark on this page is sourced to a document we fetched and dated, and where the industry has no reliable public number we say so rather than filling the gap.",
    tier: 3,
    summary: "Size the revenue lost to failed subscription payments, separated from voluntary churn.",
    widget: "churn",
    workedExample: {
      scenario: "A US subscription business with 2,500 active subscribers at $49 per subscriber per month. Roughly 4% of renewal attempts decline each month. Its current retry and dunning sequence recovers about 53% of those failed invoices. It wants to know what moving to 71% recovery is worth, and what its involuntary churn rate actually is once recovery is accounted for.",
      result: "Monthly recurring revenue is 2,500 x $49 = $122,500. At a 4% decline rate, $4,900 of that is at risk every month. At 53% recovery, $2,597 comes back and $2,303 is lost, which is $27,636 a year. Lifting recovery to 71% would bring back $3,479 instead, an extra $882 a month, or $10,584 a year. The effective involuntary churn rate is the decline rate multiplied by the share that never recovers: 4% x 47% = 1.88% of subscribers per month, or about 47 subscribers. Compounded over twelve months that is 20.37% of the base, not the 22.56% you get by multiplying by 12. At the 71% target, involuntary churn falls to 1.16% monthly and 13.07% annualised, about 29 subscribers a month.",
    },
    sections: [
      {
        heading: "Involuntary churn is a plumbing problem wearing a pricing problem's clothes",
        body: [
          "Most churn dashboards give you one number. Recurly's network data, updated with July 2026 figures, puts overall subscription churn at 3.60%, voluntary at 2.34% and involuntary at 1.25%. Recurly labels those median annual rates, and the label matters more than the values do: roughly 35% of all churn happens because a card failed, not because a customer decided to leave. Most calculators for this search never separate those halves, which is strange, because they respond to completely different work.",
          "Voluntary churn is a product, pricing and onboarding conversation. Involuntary churn is a payments conversation: retry timing, decline code handling, account updater coverage, stored credential indicators, gateway routing. A team that reads a blended 4% and spends a quarter rebuilding onboarding has aimed at the wrong half of its number. If your involuntary slice is small, tuning dunning is busywork.",
          "This calculator refuses to infer the split. It takes your decline rate as an input, because your processor can tell you that number and no benchmark can. Effective involuntary churn is decline rate multiplied by the share of declines that never recover, compounded annually rather than multiplied by twelve: 1.88% monthly is 20.37% over a year, not 22.56%. Recurly also shows involuntary churn falling steeply as average revenue per customer rises, from 1.30% in the $10 to $25 tier to 0.18% above $250. If you sell a $12 app subscription, failed payments are probably your largest leak. If you sell a $400 seat, this page is a rounding error.",
        ],
      },
      {
        heading: "What is actually failing, and how much of it comes back",
        body: [
          "Ethoca ran a study with one card issuing bank across five merchant customers to find out what the generic 'do not honour' response code really represents. The average breakdown: insufficient funds 44.4%, card data errors covering wrong expiry date and wrong CVV2 20.6%, other declines 15.2%, lost or stolen 10.4%, and suspected fraud 9.4%. That research is from March 2017, the most granular public breakdown we could verify, so treat it as shape rather than this year's numbers.",
          "The shape is the useful part. Almost half of declines are a cash timing problem, a fifth are a card data problem, and only about a tenth are fraud. Merchants guess the opposite, and Ethoca found that 52% of orders merchants rejected as fraudulent were good orders they could have fulfilled. You will not see this in your own reporting: as Stripe puts it, card issuers categorise most declines as generic, which is why your decline report has one enormous unhelpful bucket at the top.",
          "Recovery follows the same split. Recurly found that insufficient funds has the highest recovery rate of the top five reasons, that the three most common decline messages recover at over 45%, and that invalid card number, the only hard decline in the top five, still recovers at over 20%, though that is a new card rather than a retry working. Timing is tight: 90% of recovered transactions land within the first 10 days, most in a two to twelve day window. A dunning sequence still running in week four is collecting sunk cost.",
          "Set your target against your own decline mix, not a vendor's case study. Stripe will not retry nine decline codes at all: incorrect_number, lost_card, pickup_card, stolen_card, revocation_of_authorization, revocation_of_all_authorizations, authentication_required, highest_risk_level and transaction_not_allowed. If many of your declines sit in that list, no retry schedule moves your number.",
        ],
      },
      {
        heading: "The retry rules are contractual, not advisory",
        body: [
          "Visa's Business News bulletin AI10325, published 3 September 2020 and effective 17 April 2021, groups authorization response codes into four categories and tells acquirers and merchants to manage reattempts by category. Category 1 means the issuer will never approve and the merchant is not permitted to reattempt at all. Category 2 means the issuer cannot approve at this time, and merchants may reattempt up to 15 times in 30 days. It moved codes 03, 62, 78 and 93 from Category 1 into Category 2 so merchants could retry them, and is explicit that code 14, invalid account number, must not be reattempted using the same account number.",
          "Mastercard signals per transaction instead of by category, using Merchant Advice Codes. Stripe normalises both networks into a single advice_code field with three values: do_not_try_again, try_again_later and confirm_card_data. That field, read per decline, should decide whether attempt number four happens. Stripe recommends a maximum of eight retries and defaults Smart Retries to eight tries within two weeks, while a custom schedule caps at three. Its reason is worth repeating to anyone selling an aggressive retry engine: issuers can read heavy retrying as fraud, raising declines on legitimate charges. For merchants on interchange plus pricing, Adaptive Acceptance blocks some attempts before they reach the network, avoiding excessive retry penalties and cases where authorization is unlikely.",
          "A second rule set affects your baseline before any retry happens. Visa Acceptance states that any transaction initiated by a merchant as a follow-on to an initial cardholder-initiated transaction must follow the merchant-initiated transaction framework, that Visa's mandate dates from 2017, and that Mastercard revised its own framework in late 2021 to cover eight use cases. That means flagging the initiator and transaction type correctly on every renewal, and compliance is associated with higher authorization rates. If your integration does not, your decline rate is inflated before you tune a single retry.",
        ],
      },
      {
        heading: "Account updater is the cheapest recovery you will ever buy",
        body: [
          "Roughly a fifth of declines in the Ethoca breakdown were card data errors, and that bucket is two problems wearing one label. It combines wrong expiry dates with wrong CVV2 values, and only the expiry half is the network's to fix for you. That is what Visa Account Updater and Mastercard Automatic Billing Updater exist to do. The CVV2 half belongs to checkout, since stored credential renewals generally do not submit a CVV2 at all, so do not expect an updater to touch it.",
          "Visa's merchant fact sheet spells out the mechanics. Issuers submit changes within two business days of a permanent change becoming active in their authorization system, and Visa strongly encourages daily files. Merchants enrol through their acquirer, submit account numbers a few days before billing, and must update billing records within five days of a response. Responses cover account number updates, expiration date updates, closed account advices and contact cardholder advices. Triggers include expiration, lost or stolen replacement, account closure and portfolio conversions from Mastercard, American Express or Discover to Visa.",
          "Coverage differs by processor. Stripe performs automatic card updates as part of the platform, with support wide in the United States across most American Express, Visa, Mastercard and Discover cards issued here, though it cannot say in advance which cards support it. Braintree covers Visa, Mastercard and Discover for Braintree Direct merchants based in the US, but it is off by default, pricing depends on your pricing model, and prepaid cards plus Apple Pay and Google Pay tokens are excluded. Adyen's Real Time Account Updater fetches updated details during a decline and immediately retries. Ask your processor whether it is on today, which brands it covers, and the per inquiry charge.",
        ],
      },
      {
        heading: "Reading your own number honestly",
        body: [
          "Watch the period on any benchmark you compare yourself against. This calculator reports involuntary churn monthly and annualised, while Recurly's 1.25% is a median annual rate. The defaults show why that matters: 4% monthly declines with 53% recovery annualises to 20.37%, roughly sixteen times Recurly's median. That gap is not a finding about your business. It is a warning that the 4% placeholder comes from 2017 card-not-present data rather than subscription renewals, and that your own renewal decline report is the only input here worth trusting.",
          "Be careful with the target recovery rate. Recurly published a case where optimised retry strategies moved recovery from about 53% to about 71%, at an enterprise big-box retailer with membership subscriptions and real engineering behind the change. It suggests businesses in the low to mid 50s aim for the high 60s to low 70s. That is not a default, and typing 90% into the target field produces a number nobody should take to a budget meeting.",
          "If your annualised upside is smaller than the annual cost of the vendor you are evaluating, the answer is no. If it is several multiples larger, work in cost order rather than vendor order: fix your stored credential indicators, confirm account updater is on, tune the retry schedule inside Visa's fifteen-in-thirty limit and Stripe's eight-retry guidance, and only then pay for a prediction layer. Each step changes your decline rate or your recovery rate, so re-run this after each one rather than stacking gains measured from the same starting point.",
        ],
      },
    ],
    rateTable: {
      caption: "Card account updater coverage at three processors, taken from their own current documentation, checked 4 September 2026. None of the three publishes a per-inquiry price, so the cost column reports what the documentation actually says rather than a figure we cannot verify.",
      columns: [
        "Card brands covered",
        "How you get it",
        "Stated cost",
        "Known exclusions",
      ],
      rows: [
        {
          label: "Stripe",
          note: "Stripe describes support as widely available in the United States, with international coverage varying by country.",
          values: [
            "Most American Express, Visa, Mastercard and Discover cards issued in the US",
            "Runs as part of the platform, surfaced via the payment_method.automatically_updated event",
            "Not listed as a separate charge in the cards documentation",
            "Coverage depends on issuer participation, and Stripe states you cannot identify in advance which cards support automatic updates",
          ],
        },
        {
          label: "Braintree",
          note: "Braintree sends all vaulted Visa, Mastercard and Discover cards to the issuers in batches of 600,000, then moves to rolling updates tied to expiry, upcoming recurring payments and other activity. Accounts holding over 2 million vaulted payment methods only include cards expired within 13 months in the initial request.",
          values: [
            "Visa, Mastercard, Discover",
            "Off by default, must be requested from Braintree, for Braintree Direct merchants based in the US or transacting primarily with US customers",
            "Documentation states pricing varies by pricing model and directs merchants to contact Braintree",
            "Prepaid cards, and cards processed through Apple Pay or Google Pay",
          ],
        },
        {
          label: "Adyen",
          note: "Real Time Account Updater retrieves updated details during the decline and retries immediately, which is the only one of the three that closes the loop inside a single authorization attempt.",
          values: [
            "Visa, Mastercard, Cartes Bancaires",
            "Real Time Account Updater is synchronous and needs no integration work; Batch Account Updater uses request and result files",
            "Not published in the account updater documentation",
            "No American Express or Discover coverage is listed, and Cartes Bancaires is a French domestic network, so US merchants get Visa and Mastercard",
          ],
        },
      ],
    },
    assumptions: [
      "The subscriber count and ARPU defaults, 2,500 and $49, are arbitrary placeholders chosen to make the arithmetic legible. They carry no source. The outputs also assume a flat subscriber base, a stable decline rate, and that every recovered invoice belongs to a subscriber who would otherwise have left for good. Growing businesses will understate the opportunity and shrinking ones will overstate it.",
      "The default 4% decline rate comes from Ethoca's 2017 finding that physical goods merchants often run 3% to 4% and that one digital goods merchant measured approximately 4% when counted by unique cardholder. Per-unique-cardholder is the right unit for a monthly renewal, but the data is nine years old and covers card-not-present broadly, not renewals. Annualised, it implies far more involuntary churn than Recurly's median, so treat it as a high placeholder and replace it with your processor's renewal decline report.",
      "The 53% and 71% recovery defaults come from a single published Recurly case, an enterprise big-box retailer with membership subscriptions, dated 30 April 2026. One case is not a distribution. They are anchors for the slider, not expectations for your business.",
      "Recurly labels its churn figures median annual rates. This calculator reports involuntary churn both monthly and annualised, and only the annualised output is comparable to Recurly's 1.25%. Comparing a monthly figure to an annual benchmark is the same period error this page exists to correct, so we label the period on every number.",
      "Everything here goes stale on a schedule. Network reattempt rules change by bulletin, processor account updater terms and pricing change without notice, and vendor recovery benchmarks are marketing artefacts that get refreshed annually. Re-check the Visa bulletin and your processor's documentation before making a purchasing decision on these numbers.",
    ],
    faqs: [
      {
        question: "What is a good involuntary churn rate?",
        answer: "There is no single good number, and the first thing to check is the period. Recurly's network data from July 2026 puts involuntary churn at 1.25% against total churn of 3.60%, and labels both median annual rates, so involuntary failures account for roughly 35% of all subscription churn across its book. The same data shows the rate depends heavily on price: 1.30% in the $10 to $25 average revenue per customer tier falling to 0.18% above $250. Compare your annualised figure to those, never your monthly one. The ratio of involuntary to total churn is the more honest comparison anyway, since it does not depend on how the period is defined.",
      },
      {
        question: "How do I calculate involuntary churn separately from voluntary churn?",
        answer: "Involuntary churn is your monthly decline rate multiplied by the share of those declines you never recover. If 4% of renewals decline and you recover 53% of them, your effective involuntary churn is 4% x 47% = 1.88% per month. Subtract that from your blended churn rate and what remains is voluntary. The one thing to avoid is annualising by multiplying by twelve. Churn compounds, so 1.88% monthly is 20.37% of the base over a year, not 22.56%. This calculator does the compounding for you, which is the main reason it exists.",
      },
      {
        question: "How many times can you retry a declined subscription payment?",
        answer: "It depends on the decline. Visa's Business News bulletin AI10325, effective 17 April 2021, groups response codes into four categories. Category 1 means the issuer will never approve and you are not permitted to reattempt at all. Category 2 means the issuer cannot approve at this time and you may reattempt up to 15 times in 30 days. Visa also states that response code 14, invalid account number, must not be reattempted with the same account number. Mastercard signals per transaction through Merchant Advice Codes rather than by category. Separately from the network ceilings, Stripe recommends a maximum of eight retries and defaults its Smart Retries to eight tries within two weeks, warning that heavy retrying can look like fraud to issuers and raise declines on your legitimate charges.",
      },
      {
        question: "What percentage of failed subscription payments can you recover?",
        answer: "Recurly published a case where optimised retry strategies moved recovery from approximately 53% to approximately 71% for an enterprise retailer with membership subscriptions, and suggests businesses currently in the low to mid 50s target the high 60s to low 70s. By decline reason, Recurly found the three most common decline messages recover at over 45%, insufficient funds recovers best of the top five, and invalid card number still recovers over 20%, though that is usually a new card rather than a successful retry. Timing constrains the ceiling: 90% of recovered transactions land within the first 10 days of the failure, so sequences running past three weeks add very little.",
      },
      {
        question: "Does a card account updater actually reduce failed payments?",
        answer: "It addresses a specific slice, and a smaller one than vendors imply. Card data errors accounted for 20.6% of declines in Ethoca's study, but that bucket mixes wrong expiry dates with wrong CVV2 values, and an account updater only supplies the new expiry date or account number. It does not supply a CVV2, and stored credential renewals generally do not submit one anyway, so the expiry half is the part an updater actually recovers. Within that half it works without any customer contact: Visa Account Updater has issuers submit changes within two business days of a permanent change going live, and requires enrolled merchants to update their billing records within five days of a response. Stripe runs automatic card updates as part of the platform with wide US coverage across Amex, Visa, Mastercard and Discover. Braintree offers it on Visa, Mastercard and Discover but off by default, excluding prepaid cards plus Apple Pay and Google Pay tokens. Adyen offers a real time version that retries inside the same decline. Confirm yours is active and re-measure for a full billing cycle before you evaluate a dunning vendor.",
      },
    ],
    related: [
      "credit-card-processing-fee-calculator",
      "effective-rate-calculator",
      "stripe-fee-calculator",
    ],
    links: [
      {
        label: "Recurring billing, defined",
        href: "/glossary/recurring-billing",
      },
      {
        label: "Dunning, defined",
        href: "/glossary/dunning",
      },
      {
        label: "Authorization, defined",
        href: "/glossary/authorization",
      },
      {
        label: "Card-not-present, defined",
        href: "/glossary/card-not-present",
      },
      {
        label: "Processors for subscription businesses",
        href: "/category/subscriptions",
      },
      {
        label: "Stripe processor profile",
        href: "/processor/stripe",
      },
      {
        label: "Braintree processor profile",
        href: "/processor/braintree",
      },
      {
        label: "Adyen processor profile",
        href: "/processor/adyen",
      },
      {
        label: "How we test and score processors",
        href: "/methodology",
      },
    ],
    cta: {
      heading: "Know your number before you buy a solution for it",
      body: "Once you have your annualised involuntary churn figure, the next question is whether your current processor is the reason it is that high. Account updater coverage, stored credential handling and retry controls vary more between processors than pricing does, and they are rarely on the comparison page. See how the major US processors handle recurring billing before you pay a third party to patch around one.",
      label: "Compare processors for subscriptions",
    },
  },
  {
    slug: "pos-terminal-lease-vs-buy-calculator",
    name: "POS Terminal Lease Calculator",
    h1: "POS Terminal Lease vs Buy Calculator",
    title: "POS Lease vs Buy Calculator: Compare Total Cost",
    description: "Compare the total cost of leasing a POS terminal with buying the hardware outright. Include monthly payments, contract length, residual costs and the hardware purchase price.",
    intro: "A four year terminal lease at $59 a month costs $2,832 for a device with a street price near $299. This calculator does that arithmetic on your own quote: total paid over the term including the buyout, what the same device costs bought outright, the gap between them, the implied interest rate buried in the payment, and the month your cumulative payments pass the purchase price. Enter the number your sales rep quoted and the price of the actual device, and everything after that is arithmetic you can check. We are not neutral on this one: the numbers on a non-cancellable equipment lease are usually indefensible, and the fastest way to see it is to compute the rate nobody disclosed.",
    tier: 3,
    summary: "See what a quoted terminal lease really costs against buying the device outright.",
    widget: "lease-vs-buy",
    workedExample: {
      scenario: "A coffee shop is quoted a countertop terminal at $59 a month on a 48 month non-cancellable lease with a fair market value buyout, no insurance or tax add-ons on the statement, and the owner expects to use the device for five years. The comparable device they could buy outright is a Square Terminal, listed at $299 on Square's US hardware page.",
      result: "Lease: $59 x 48 = $2,832, plus a fair market value buyout the contract does not name. Buy: $299, once. Difference: $2,533, so the lease total is 9.5 times the purchase price and the gap alone is 8.5 times it. Break-even month: 6, because 6 x $59 = $354 passes $299, and at that point 42 payments are still owed. Implied interest rate: solving for the rate that makes $59 a month amortise $299 over 48 months gives 19.7% per month, a 236.7% nominal APR, or 767.7% on an effective annual basis. Over five years of use the bought terminal costs $4.98 per month of use. The leased one costs $59.00 per month for 48 months, and then you hand it back and own nothing.",
    },
    sections: [
      {
        heading: "The arithmetic on a terminal lease, done honestly",
        body: [
          "Payments industry sources put a typical terminal lease at $59 to $99 per month on a 36 or 48 month term, against terminals that cost $150 to $400 to buy. Helcim's own guide uses a $29 a month lease over 60 months, which is $1,740, for a device it prices at $300 to $500. Take the low end of both: $59 a month for 48 months is $2,832 for hardware you could have bought for $299. That is 9.5 times the purchase price, and the low end is the charitable case. At the $99 top of the range it is $4,752, or 15.9 times.",
          "The reason the gap is so wide is that the payment is not derived from the device price at all. Leasing companies quote agents a factor rate: a multiplier applied per dollar of funding, priced off the business owner's credit. CCSalesPro, which trains payment sales agents, puts the range on a 48 month lease at 0.0296 for A+ credit to 0.0429 for E credit. The agent works it backwards. Their own published example: a $29.95 monthly payment divided by a 0.0296 factor funds $1,011, minus $300 for the terminal leaves $711, of which the agent keeps 85 percent after the ISO split, or $605 cash on signing.",
          "Read that example again, because it explains the whole product. The rep is not selling you a terminal. They are selling a stream of 48 payments to a funder and taking the spread up front, in one lump, on the day you sign. The device is the pretext. That is why a $299 terminal arrives at $59 a month, why the quote is expressed monthly and never as a total, and why nobody in the conversation volunteers what the hardware costs to buy. CCSalesPro says the quiet part out loud in its own training copy: yes, they will end up paying more for the terminal than what it is worth.",
        ],
      },
      {
        heading: "Non-cancellable is not a figure of speech",
        body: [
          "The legal machinery is UCC Article 2A, adopted in some form across the states. Section 2A-407 says that in a finance lease that is not a consumer lease, the lessee's promises become irrevocable and independent upon the lessee's acceptance of the goods, and that such a promise is not subject to cancellation, termination, modification, repudiation, excuse, or substitution without the consent of the party to whom the promise runs. Equipment finance people call it the hell or high water clause. It means exactly what it sounds like.",
          "Three practical consequences follow. First, the lease is a separate contract from your merchant agreement, usually assigned to a third party funder you never chose and may not recognise on your bank statement, so leaving your processor does nothing to the payments. Second, most of these are personally guaranteed, so the obligation follows the owner rather than dying with the business. Third, the equipment failing, the business closing, or the terminal becoming obsolete are all your problem and none of the lessor's. You keep paying.",
          "This is not a theoretical risk. On July 30, 2013 the FTC charged Merchant Services Direct and its principals with duping merchants into leasing terminals for two to four years by falsely claiming their existing swipe terminals were outdated, getting binding contracts signed by telling merchants the documents were merely applications, and falsely telling them they could cancel at any time. It settled on October 27, 2014 for $175,000. New York's case against Northern Leasing Systems produced a June 8, 2020 decision rescinding the leases and vacating 29,617 default judgments the company had obtained in New York City Civil Court, in a business where over 95 percent of the merchants it sued did not reside in New York. A September 25, 2023 decision awarded over $680 million against the company and over $9.3 million against its attorneys. The New York AG's own page notes that no funds have been collected under that judgment. Merchants can win these fights. It takes about a decade.",
        ],
      },
      {
        heading: "The three buyouts, and what you actually own at the end",
        body: [
          "A one dollar buyout is a capital lease, which is an instalment purchase wearing a lease costume. You carry the equipment on your balance sheet from day one and take title for a dollar at the end. It carries the highest monthly payment of the three structures, and it is the only one where the ending is certain. If someone is going to put you on a lease, this is the least bad version, and it is the version you should insist on if the alternative is walking.",
          "A ten percent PUT is a purchase upon termination. The ten percent is an obligation, not an option: you agreed at signing to buy the device for ten percent of its original purchase price when the term ends. Payments are lower than a dollar buyout because the lessor's residual is guaranteed rather than speculative. The catch is the phrase original purchase price. That is the lessor's booked figure, not the street price, and the factor arithmetic above shows the booked figure on a $300 terminal can be over $1,000. Ten percent of the number in the contract can exceed a third of what the hardware is worth.",
          "Fair market value is the lowest payment and by a wide margin the worst ending. The lessor owns the device for the whole term. At the end you return it, renew, or buy it at fair market value, an amount the contract does not name when you sign it. In general equipment finance, FMV is settled by independent appraisal or auction comparables, which works fine for a dump truck. There is no auction market for a four year old payment terminal, which means the number is effectively whatever the lessor says it is. Helcim's guide puts the practical outcome plainly: at the end of the term you return the equipment or sign a new lease, because you still do not own it.",
        ],
      },
      {
        heading: "How to read the output, and what to do if you already signed",
        body: [
          "Enter the street price of the device you are actually being offered, not a category average. Square publishes its prices: $299 for the Square Terminal, $149 for the Stand, $399 for the Handheld, $899 for the Register. PayPal publishes its own: $199 for the Terminal, $29 for a first Card Reader. Stripe lists the Reader S700 and S710 at $299 and the Reader M2 at $59. Clover does not publish a purchase price for any device on its site, gating hardware pricing behind a configurator and a lead form, which is itself part of why the lease survives contact with a buyer. If you cannot price your exact device, price the closest comparable and treat the result as a floor. For monthly extras, pull your last statement and add the loss and damage waiver or equipment protection line plus any sales tax charged on the lease payment, because those are real cash leaving your account.",
          "Break-even month is the month your cumulative lease payments pass the purchase price of the device. At $59 against a $299 terminal it is month 6, and the useful thing about that number is what comes after it: 42 more payments on a device you have already paid for twice over. The implied interest rate is the monthly rate that would make your payments amortise the purchase price over the term. It is our arithmetic, not a disclosed figure, and it has to be, because business equipment leases are not consumer credit and carry no APR disclosure requirement. That absence is the entire commercial logic of the product. A 236.7% APR quoted on a loan application would end the conversation. Expressed as fifty nine dollars a month, it closes.",
          "If you have already signed, do four things. Read the lease itself for the term, the buyout type, the personal guarantee, and any evergreen renewal clause that lets it continue past the stated end date. Identify who actually debits the payment, because a name you do not recognise means the paper was assigned to a funder and your processor cannot help you. Ask the lessor in writing for a payoff quote on the remaining payments, which is negotiable more often than the contract implies. Then run the arithmetic anyway on buying the device outright today, because at these multiples it is frequently cheaper to buy a replacement terminal and keep servicing the dead lease than to run the lease to term. One thing not to do: never sign a new lease to escape an old one, no matter how the offer is framed.",
        ],
      },
    ],
    rateTable: {
      caption: "What a 48 month lease costs against a $299 Square Terminal. The monthly payment figures are quoted in the industry sources listed below. The totals, multiples and implied rates are our own arithmetic, not rates any leasing company quotes or discloses.",
      columns: [
        "Monthly payment",
        "Total over 48 months",
        "Multiple of $299",
        "Implied nominal APR",
      ],
      rows: [
        {
          label: "$29.95",
          note: "A real 48 month lease payment used in CCSalesPro agent training material",
          values: [
            "$1,437.60",
            "4.8x",
            "118.9%",
          ],
        },
        {
          label: "$39.95",
          note: "A second 48 month payment from the same CCSalesPro article, which does not price the terminal in that example",
          values: [
            "$1,917.60",
            "6.4x",
            "159.9%",
          ],
        },
        {
          label: "$59.00",
          note: "Low end of the typical range reported by Bancard Sales",
          values: [
            "$2,832.00",
            "9.5x",
            "236.7%",
          ],
        },
        {
          label: "$99.00",
          note: "High end of that same range",
          values: [
            "$4,752.00",
            "15.9x",
            "397.3%",
          ],
        },
      ],
    },
    assumptions: [
      "Device prices are what Square, PayPal and Stripe published on their US sites on September 4, 2026. Hardware pricing and promotions change without notice, so re-check the vendor page before you rely on the gap this tool shows.",
      "The $59 to $99 monthly range and the 36 to 48 month terms come from payments industry sources, not from a survey of signed contracts. Your quote may sit outside the range. The calculator uses whatever you type in, not these figures.",
      "The implied interest rate is derived, not disclosed. It is the monthly rate that makes your entered payment amortise your entered purchase price over your entered term, computed on the base lease payment only. Insurance and tax add-ons are excluded from the rate because they are fees, not repayment of the equipment, though they are included in the total paid.",
      "A fair market value buyout cannot be priced in advance, because the contract does not name a number when you sign it. Any FMV total shown here is a floor, and the ownership flag on that scenario is false: you can complete every payment and own nothing.",
      "We could not verify purchase prices for Clover, PAX, Dejavoo or Verifone devices, because those manufacturers and resellers do not publish them at retail. Dejavoo and Verifone terminals both turn up by name in the agent training material cited here. If your quote covers one of those, price the nearest comparable you can verify and read the result as conservative.",
    ],
    faqs: [
      {
        question: "Can you cancel a POS terminal lease early?",
        answer: "Almost never on your own terms. Under UCC 2A-407, in a business finance lease the lessee's promises become irrevocable and independent once you accept the equipment, and are not subject to cancellation, termination, modification, repudiation, excuse or substitution without the lessor's consent. That is the hell or high water clause, and it is why these contracts are marketed as non-cancellable. Closing the business, switching processors, or the terminal failing does not end the payments, and a personal guarantee means the debt follows you rather than the entity. Merchants do get out, but by negotiating a payoff on the remaining payments, or by making a fraud claim about how the lease was sold, not by cancelling.",
      },
      {
        question: "Is it ever worth leasing a credit card terminal?",
        answer: "Rarely, and the test is arithmetic rather than opinion. A lease is defensible when the payments plus the buyout land close to the purchase price, which is what genuine manufacturer financing looks like. Square lists the Square Terminal at $299 or $27 a month for 12 months, which totals $324. That is a short instalment plan with a modest premium and it is fine. A $59 payment for 48 months on the same class of device totals $2,832, which is 9.5 times the purchase price, and no bundled support, paper supplies or swap warranty justifies a gap that size. If the quote is monthly and the term is four years, treat it as a financing product and price it as one.",
      },
      {
        question: "What does a fair market value buyout mean on a terminal lease?",
        answer: "It means the leasing company owns the device for the entire term and you have not agreed a purchase price. At the end you return it, renew, or buy it for whatever the lessor calls market value. In broader equipment finance, FMV is settled by independent appraisal or by auction comparables, which is workable for machinery with a resale market. There is no such market for a four year old payment terminal, so the figure is effectively the lessor's to set. FMV carries the lowest monthly payment of the three common structures and the worst ending, because you can make 48 payments totalling thousands of dollars and own nothing at all. If you are being offered a lease, a one dollar buyout is the version to ask for.",
      },
      {
        question: "How much does a credit card terminal actually cost to buy?",
        answer: "Prices published on US vendor sites as of September 4, 2026: PayPal's Terminal is $199, or $239 with a built in barcode scanner, and its Card Reader is $29 for the first unit and $79 for additional ones. Square lists the Square Terminal at $299, Square Stand and Square Kiosk at $149, Square Handheld at $399 and Square Register at $899. Stripe lists the Reader S700 and Reader S710 at $299 and the Reader M2 at $59. Industry sources put a typical countertop terminal at $150 to $400, or $300 to $500 depending who you ask. Clover publishes no device prices on its site, so if you are quoted a Clover lease you will have to ask directly what the hardware costs to buy.",
      },
      {
        question: "What interest rate am I actually paying on a terminal lease?",
        answer: "The lease will not tell you, because business equipment leases are not consumer credit and carry no APR disclosure requirement. You have to derive it. Take the purchase price of the device as the amount financed, your monthly payment, and the term in months, then solve for the rate that makes them balance. On a $299 terminal at $59 a month for 48 months that is roughly 19.7% per month, a 236.7% nominal APR. At $99 a month it is 397.3%. Those are not typos and they are not adjusted for insurance or tax add-ons, which would push them higher. That number is precisely what a monthly quote is designed to keep out of the conversation.",
      },
    ],
    related: [
      "credit-card-processing-fee-calculator",
      "effective-rate-calculator",
      "square-fee-calculator",
    ],
    links: [
      {
        label: "Compare processors that sell hardware outright",
        href: "/processors",
      },
      {
        label: "How to lower payment processing fees",
        href: "/blog/how-to-lower-payment-processing-fees",
      },
      {
        label: "Helcim processor review",
        href: "/processor/helcim",
      },
      {
        label: "Square processor review",
        href: "/processor/square",
      },
      {
        label: "Tap to pay processors, no terminal required",
        href: "/payment-processors/tap-to-pay",
      },
      {
        label: "Glossary: monthly minimum",
        href: "/glossary/monthly-minimum",
      },
      {
        label: "How we test and score processors",
        href: "/methodology",
      },
    ],
    cta: {
      heading: "Buy the terminal, then choose the processor",
      body: "If the arithmetic went the way it usually goes, the next question is who to process with once you are not tied to a leasing company. Our processor directory shows which providers sell hardware outright at or near cost, which bundle it into the rate, and what each one charges per transaction, with the pricing model stated plainly rather than implied.",
      label: "Compare payment processors",
    },
  },
];
