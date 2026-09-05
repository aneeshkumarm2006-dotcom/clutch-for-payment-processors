import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/high-risk-merchant-account-cost-calculator`
 *
 * --- THE SEARCH INTENT THIS PAGE OWNS ----------------------------------------
 * "high risk merchant account fees", "high risk payment processing cost",
 * "high risk merchant account calculator". The searcher has been quoted a rate
 * by a specialist acquirer, or has just been declined by an aggregator, and
 * wants to know whether the quote is normal and what it will cost over a year.
 *
 * The page owns the CALCULATION modifier only. "Best high risk processors" is
 * `/category/high-risk`, the definition is `/glossary/high-risk-merchant`, the
 * reserve release timeline is `/tools/rolling-reserve-calculator`, and the cost
 * of an individual dispute is `/tools/chargeback-cost-calculator`. This page
 * links into all four rather than reaching for any of them.
 *
 * --- WHAT THE RANKING COMPETITION GETS WRONG ---------------------------------
 * Three things, and all three are checkable:
 *
 *   1. THEY PUBLISH A RATE AND CALL IT THE COST. Every page on the query gives a
 *      discount rate band and a list of fee names. None totals the account, so
 *      none can answer the only question the searcher has, which is what the
 *      classification costs per year against what the same business would have
 *      paid on ordinary terms.
 *   2. THEY MISPRICE THE RESERVE. It is either omitted, added to the cost as if
 *      it were a fee (which overstates it roughly threefold on the defaults
 *      here), or priced as forgone deposit interest (which understates it by
 *      roughly twenty times). It is a working capital hole and it is carried at
 *      a borrowing rate, which is the treatment this site already uses on
 *      `/tools/rolling-reserve-calculator`.
 *   3. THEY PREDATE 2026. Mastercard doubled its specialty merchant registration
 *      fee to USD 1,000 on 1 May 2026 and introduced a USD 0.02 per transaction
 *      fee and a 10 basis point volume fee on 3 June 2026. Every high risk cost
 *      guide checked while building this page was written before those existed.
 *
 * --- WHERE THE NUMBERS CAME FROM ---------------------------------------------
 * Card brand fees: Mastercard bulletin AP/LAC/MEA/US 12568.1, published 28
 * October 2025, read in full 5 September 2026. Visa's $950 registration is
 * attributed to Helcim's published high risk program documentation and Corepay,
 * because Visa does not publish a VIRP fee schedule. Provider fee ranges:
 * PaymentCloud (updated 18 July 2026) and TailoredPay (17 February 2026), two
 * named US high risk providers that publish their own ranges. Low risk
 * comparisons: Authorize.net and Helcim published US pricing, read 5 September
 * 2026. Alert pricing: chargeback.io published pricing, read 5 September 2026.
 * Carry rate: bank prime loan rate 6.75%, Federal Reserve H.15 release of 4
 * September 2026. Rules quotations: Visa Core Rules and Visa Product and Service
 * Rules effective 18 April 2026, and the Visa Ecosystem Risk Programs Guide of
 * October 2024, both downloaded and read 5 September 2026.
 *
 * Every dollar figure in `workedExample` is produced by
 * `lib/calc/high-risk.ts` on the widget's own default state and is asserted in
 * `tests/tools/batch-four/high-risk-merchant-account-cost-calculator.test.ts`.
 * A hand written number that disagrees with the widget on the same page has
 * shipped on this site before. Do not add one.
 */

const NOT_ADVICE =
  "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.";

export const HIGH_RISK_COST_TOOL: ToolDef = {
  slug: "high-risk-merchant-account-cost-calculator",
  name: "High-Risk Account True Cost Calculator",
  h1: "High risk merchant account fees: the total cost of acceptance",
  title: "High risk merchant account fees: true cost calculator",
  description:
    "Total every high risk merchant account fee: the elevated rate, monthly and card brand registration fees, chargeback fees and what a rolling reserve costs.",
  intro:
    "A high risk merchant account is not just a higher percentage. On $150,000 a month at a $75 ticket, a 3.95% rate plus $0.25 a transaction, $80 of monthly fixed fees, $1,950 of annual card brand registrations, Mastercard's new specialty fees, a second merchant account for redundancy and a 10% rolling reserve held six months comes to $103,775 a year, which is 5.77% of volume. The same business on a standard 2.9% plus $0.30 account pays $63,000. The High-Risk Account True Cost Calculator totals every line and prices the classification itself at $40,775 a year.",
  tier: 2,
  summary:
    "Total what a high risk account costs a year, including the reserve carry, against what the same business would pay on standard terms.",
  widget: "high-risk",
  workedExample: {
    scenario:
      "A supplements brand doing $150,000 a month at a $75 average ticket, which is 2,000 transactions a month and $1,800,000 a year. It was declined by two aggregators and boarded with a specialist acquirer at 3.95% plus $0.25, with $80 a month of account, statement, PCI and gateway fees, a $0.10 gateway transaction fee, a $250 setup fee, Visa and Mastercard registration at $1,950 a year, a 10% rolling reserve held six months, and a $25 chargeback fee. Its dispute rate is 1.00%, it buys 20 prevention alerts a month at $15, and it runs a second merchant account for redundancy. It can borrow at 6.75%, the bank prime loan rate in the Federal Reserve H.15 release of 4 September 2026.",
    result:
      "Monthly: 3.95% of $150,000 is $5,925, plus 2,000 x $0.25 which is $500, plus 2,000 x $0.10 of gateway which is $200, plus $80 x 2 merchant accounts which is $160, plus Mastercard's specialty fees at 10 basis points of $150,000 which is $150 and 2,000 x $0.02 which is $40, plus 20 chargebacks at $25 which is $500, plus 20 alerts at $15 which is $300. That is $7,775 a month, or $93,300 a year. Add $1,950 x 2 accounts of registration, which is $3,900, and $250 x 2 of setup, which is $500. Cash fees are $97,700 a year, 5.43% of volume. Now the reserve: 10% of $150,000 is $15,000 withheld every month, and after six months the balance plateaus at $90,000 and stays there. That is not a fee, it is cash you own and cannot touch, and financing it at 6.75% costs $6,075 a year. Total cost of acceptance is $103,775, or 5.77% of volume, which is $4.32 on every transaction. The same business on a standard account at 2.9% plus $0.30 with a $15 chargeback fee pays $4,350 plus $600 plus $300, which is $5,250 a month and $63,000 a year, exactly 3.50%. The risk classification therefore costs $40,775 a year, 227 basis points, or $1.70 on every single transaction. Of that premium, $6,075, or 14.9%, is the reserve carry and the rest is fees. Halving the dispute rate from 1.00% to 0.50% saves $3,000 of chargeback fees and $1,800 of alert fees, which is $4,800 a year, or only 11.8% of the premium. The second merchant account costs $3,160 a year on its own. And $40,775 a year is $3,398 a month, so a $15,000 project to get reclassified pays for itself in 4.4 months.",
  },
  sections: [
    {
      heading: "What high risk merchant account fees actually total",
      body: [
        "High risk merchant account fees are usually quoted as a single number, the discount rate, and that number is between 3.00% and 6.00% at the US providers that publish a range. TailoredPay publishes 3% to 6% plus $0.10 to $0.50 a transaction. PaymentCloud publishes 3.49% to 3.95% with a per transaction fee of about $0.25. Both figures are real and neither is the cost of the account, because the rate is only the first of nine lines. The High-Risk Account True Cost Calculator adds the other eight and divides the total by your volume, which is the only figure comparable to the 2.9% a flat rate aggregator quotes.",
        "The formula is straightforward once every term is named. Annual cost of acceptance equals twelve times the monthly lines, plus the annual lines, plus the reserve carry. The monthly lines are the discount rate on volume, the acquirer and gateway per transaction fees times your transaction count, the fixed fees for account, statement, PCI compliance and gateway, the card network specialty program fees, the chargeback fees on disputes received, and anything spent on prevention alerts. The annual lines are the card brand registration fees and, in year one, the setup fee. Transaction count is volume divided by average ticket, which is why two businesses with identical volume can pay rates two points apart.",
        "Fixed dollars are what make small high risk accounts brutal. On $150,000 a month, $80 of monthly fees plus $1,950 of registration is 0.09% of volume and nobody notices. On $8,000 a month, the same fixed lines are 1.20% before a single percentage point of discount rate has been applied, and the effective rate on an otherwise ordinary 3.95% quote lands above 5.4%. Under about $15,000 a month, negotiate the fixed fees first and the rate second. Above $100,000 a month, do the opposite. One line sits outside the annual total on purpose: the early termination fee, published at $250 to $1,000 or the remaining contract value, is a cost of leaving rather than of processing.",
      ],
    },
    {
      heading: "The rolling reserve is not a fee, and pricing it as one gets it wrong twice",
      body: [
        "A rolling reserve withholds a percentage of every batch and releases each batch after a fixed hold. US providers publish 5% to 15% held for 90 to 180 days. It is collateral, not a charge: every dollar comes back to you if disputes do not consume it, and Visa's rules explicitly permit an acquirer to deduct merchant reserve funds from settlement to secure the merchant's payment system obligations. That makes both of the common ways of pricing it wrong, in opposite directions and by large margins.",
        "Adding the withheld cash to your cost is the first error: on this page's default business that reads as $180,000 a year against a genuine cost of $6,075. The second error is subtler and commoner on pages that try to be careful, which is pricing the reserve as the interest the money would have earned in a deposit account. At a national money market average that is roughly $270 a year on a $90,000 balance. Forgone deposit interest understates the damage by roughly an order of magnitude.",
        "The right treatment is working capital. Under constant volume, a rolling reserve is a permanent hole equal to monthly volume multiplied by the reserve percentage multiplied by the hold in months. On $150,000 a month at 10% for six months that is $90,000, reached in month six and never recovered while you keep processing. The cost is what filling that hole costs you, which is your borrowing rate: at the 6.75% bank prime loan rate from the Federal Reserve H.15 release of 4 September 2026, $6,075 a year. Two things about that hole matter. It scales with success, so doubling your volume doubles the locked balance in exactly the year you are buying inventory. And it does not release on your last processing day, so a merchant switching acquirers can be funding two reserves at once. The High-Risk Account True Cost Calculator prices the carry and nothing else, because the month by month schedule belongs to the rolling reserve calculator on this site.",
      ],
    },
    {
      heading: "The card brand fees that changed in 2026",
      body: [
        "Two fees on a high risk statement are not your acquirer's margin at all. Visa and Mastercard each charge a registration fee for every merchant boarded in a designated category, and the acquirer passes it through. Visa's is $950 a year, raised from $500 on 1 April 2024 under the Visa Integrity Risk Program. Mastercard's was $500 and became USD 1,000, annual per merchant registration, on 1 May 2026 under the Specialty Merchant Registration Program. That is nearly $2,000 a year of pure classification cost before anybody discusses a rate, and it is the cleanest evidence available that the category itself has a price.",
        "Mastercard added two more fees in the same bulletin, new enough that essentially no competing page carries them. From 3 June 2026, first billed 14 June 2026, a Specialty Merchant Transaction Fee of USD 0.02 and a Specialty Merchant Volume Fee of 10 basis points both apply weekly, to purchases carrying a Transaction Type Identifier of P70 or P76 for cryptocurrency, P71 for high risk securities, or P72 for all other specialty categories. Ten basis points reads as nothing and annualizes into real money: on $1.8 million of volume it is $1,800 that did not exist in 2025.",
        "The same bulletin introduced a High-Risk Acquirer License Fee of USD 50,000 a year, billed to the acquirer rather than to you, with automatic supplemental licenses granted to acquirers already in the business who are still billed for it. You will never see that line on a statement and you pay part of it anyway, spread across the acquirer's book. It is also the best available explanation for why high risk pricing does not compete itself down: a $50,000 license plus Visa's tiered control assessments is a barrier to entry.",
        "Registration is not automatic for every business in a flagged industry. Helcim publishes volume triggers: a pharmacy registers once high risk sales pass 25% of Visa volume or 50% of Mastercard volume, while for tobacco and vape the Visa trigger is 0.01%. Ask your acquirer which registrations you are actually in and what triggered them.",
      ],
    },
    {
      heading: "What the premium is worth, and what to spend to escape it",
      body: [
        "The output this page exists for is the second one, not the first. Knowing that you pay 5.77% is useful. Knowing that the same business on ordinary terms would pay 3.50%, so the classification costs $40,775 a year, 227 basis points, or $1.70 a transaction, is what turns a complaint into a budget. That premium is the honest ceiling on what getting out of the classification is worth spending, and at $3,398 a month a $15,000 project pays for itself in 4.4 months.",
        "Where that money should go is the part most merchants get backwards. Cutting the dispute rate in half, from 1.00% to 0.50%, saves $3,000 of chargeback fees and $1,800 of alert fees a year. That is $4,800, which is only 11.8% of the premium. Buying a chargeback tool to save fees is therefore a rounding error against the problem. The reason to cut the dispute rate anyway is that it is the evidence that unlocks the other 88%: the discount rate and the reserve do not fall because your ratio fell, they fall because you took a lower ratio into a renegotiation and asked.",
        "High risk pricing exists for a real reason and the negotiation goes better when you concede it. The acquirer, not the network and not the issuer, is liable when a merchant cannot fund its own chargebacks, and Visa's own guidance directs acquirers to assess creditworthiness, business activity, delivery methods and return policies at onboarding. What a lower dispute rate, a tighter refund policy and a shorter delivery window buy you is a smaller exposure, and a smaller exposure is a cheaper price.",
        "So bring numbers rather than grievances: six months of dispute ratios, a representment win rate, your average days to delivery, and specific asks. Converting a rolling reserve to a capped one is usually the easiest yes, because it fixes the collateral at today's number instead of asking for a reduction, and it stops your locked balance growing every time you have a good month.",
      ],
    },
    {
      heading: "Multiple MIDs, load balancing, and the line that ends an account",
      body: [
        "Running more than one merchant account is normal in high risk and it costs real money. A second MID duplicates every fixed and annual line: the monthly account, statement, PCI and gateway fees, the card brand registration fees, and the setup fee. On this page's defaults that is $960 plus $1,950 plus $250, or $3,160 a year, for an account that may process nothing. It does not duplicate the discount rate or the per transaction fees, because the volume is split between the accounts rather than doubled.",
        "The legitimate reasons are good ones. A high risk account can be closed with short notice for reasons that have nothing to do with you, including your acquirer exiting your vertical, so a dormant second MID at a different acquirer with a different sponsor bank is a disaster recovery plan. Separate MIDs are also genuinely required when you run distinct lines of business, since the networks expect a merchant category code that accurately describes each one.",
        "The illegitimate reason is the one the industry euphemism covers. Deliberately splitting volume across accounts so that no single account's dispute ratio reaches a monitoring threshold is not a strategy, it is a violation, and it is treated as one. The Visa Core Rules effective 18 April 2026 list, among the grounds on which Visa may permanently prohibit a merchant from the Visa system, presenting transaction receipts that do not result from an act between a cardholder and that merchant, which is laundering, and entering into a merchant agreement under a new name with the intent to circumvent the Visa Rules. That second clause is the one that catches load balancing arranged to hide a ratio.",
        "The trade is obviously bad. Getting caught costs you both accounts and the reserve balances at both acquirers, held through their post closure periods. Getting away with it saves a monitoring program's assessments while leaving the dispute rate exactly where it was. If your ratio is near a threshold, this site's chargeback ratio calculator will tell you which programs you are close to and on which denominator.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Every cost line on a US high risk merchant account against the same line on an ordinary one. The ranges are sourced, not estimated: provider ranges are from PaymentCloud (updated 18 July 2026) and TailoredPay (17 February 2026), card brand fees from Mastercard bulletin AP/LAC/MEA/US 12568.1 (published 28 October 2025) and from Helcim's and Corepay's published documentation, alert prices from chargeback.io's published pricing, and low risk comparisons from Authorize.net and Helcim published US pricing. All read 5 September 2026. Nothing in this table is computed by this page.",
    columns: ["High risk", "Ordinary account"],
    rows: [
      {
        label: "Discount rate",
        note: "The largest line and the most negotiable, because it is acquirer margin rather than a pass through.",
        values: ["3.00% to 6.00%", "2.90% flat, or interchange plus 0.40% to 0.50%"],
      },
      {
        label: "Per transaction fee",
        values: ["$0.10 to $0.50", "$0.30 flat rate, $0.08 to $0.25 interchange plus"],
      },
      {
        label: "Monthly account, statement and PCI",
        note: "Plus $15 to $50 a month if you fall out of PCI compliance.",
        values: ["$25 to $95 a month combined", "$0 on a flat rate aggregator"],
      },
      {
        label: "Gateway",
        values: ["$10 to $30 a month plus $0.05 to $0.15", "$25 a month plus $0.10 and a $0.10 daily batch"],
      },
      {
        label: "Setup or application fee",
        values: ["$0 to $500, per merchant account", "$0"],
      },
      {
        label: "Card brand registration",
        note: "Visa raised its fee from $500 on 1 April 2024. Mastercard doubled its fee from $500 on 1 May 2026.",
        values: ["Visa $950 a year, Mastercard $1,000 a year", "$0"],
      },
      {
        label: "Network specialty transaction and volume fees",
        note: "Mastercard, effective 3 June 2026, first billed 14 June 2026. Applied to transactions carrying a specialty merchant transaction type identifier.",
        values: ["$0.02 per transaction plus 10 basis points", "$0"],
      },
      {
        label: "High risk acquirer license",
        note: "Billed to the acquirer, not to you, and recovered across its whole high risk book.",
        values: ["$50,000 a year, from 1 May 2026", "$0"],
      },
      {
        label: "Rolling reserve",
        note: "Not a fee. Cash you own and cannot use, so it is priced here as a carry cost at your borrowing rate.",
        values: ["5% to 15% held 90 to 180 days", "Usually none"],
      },
      {
        label: "Chargeback fee",
        values: ["$15 to $35 per dispute", "$15 Stripe, $20 PayPal, $0 Square, $15 Helcim if lost"],
      },
      {
        label: "Prevention alerts",
        values: ["$15 RDR, $15 CDRN, $29 Ethoca", "Optional and rarely bought"],
      },
      {
        label: "Early termination fee",
        values: ["$250 to $1,000, or the remaining contract value", "$0, month to month"],
      },
    ],
  },
  assumptions: [
    "Provider fee ranges come from two named US high risk providers that publish their own: PaymentCloud's high risk merchant account fees page, updated 18 July 2026, and TailoredPay's, dated 17 February 2026. Both were read on 5 September 2026. The calculator's defaults are midpoints of those published ranges, not a quote, and no point estimate anywhere on this page is invented.",
    "Card brand fees are primary. Mastercard bulletin AP/LAC/MEA/US 12568.1, New and Updated Specialty Merchant Registration Program Fees, published 28 October 2025 and read in full on 5 September 2026, sets the Specialty Merchant Registration Program fee at USD 1,000 annual per merchant registration effective 1 May 2026, the High-Risk Acquirer License Fee at USD 50,000 annual, the Specialty Merchant Transaction Fee at USD 0.02 weekly per transaction and the Specialty Merchant Volume Fee at 10 basis points, the last two effective 3 June 2026 with first billing on 14 June 2026. Visa's $950 annual registration is attributed rather than primary: Visa does not publish a VIRP fee schedule, so the figure comes from Helcim's published high risk merchant program documentation and from Corepay, a US high risk acquirer, updated 20 May 2026. Note that Helcim's page still shows the Mastercard fee at $500, which Mastercard's own bulletin superseded on 1 May 2026.",
    "The reserve is modeled as working capital, not as a fee and not as forgone interest. The locked balance is monthly volume multiplied by the reserve percentage multiplied by the hold in months, which is the steady state the rolling reserve calculator on this site produces, and the annual cost is that balance at the borrowing rate you enter. The 6.75% default is the bank prime loan rate in the Federal Reserve H.15 release of 4 September 2026, published weekly. Check the current rate before quoting the annual figure.",
    "The standard account comparison holds the business constant. Same volume, same average ticket, same transaction count and the same number of disputes on both sides, with only the terms changed, so the gap is the price of the classification rather than the difference between two businesses. Its defaults are the published US flat rate shape, 2.9% plus $0.30 with no monthly fee and a $15 dispute fee, which is Stripe's published US online card pricing and dispute received fee as recorded in this site's Stripe rate card. Authorize.net publishes the same 2.9% plus 30 cents on its All-in-One plan but adds $25 a month on top, and Helcim charges its $15 chargeback fee only when the case is lost, so raise the standard monthly fee field if you are comparing against either. Authorize.net and Helcim pricing read 5 September 2026.",
    "Three inputs are modeling choices rather than published figures and are labeled as such. The 1.00% default chargeback rate is illustrative, not an average of anything. The setup fee is spread over twelve months: the honest first year view, not a claim about contract length. The network specialty fees are applied to all volume, which is the worst case: Mastercard bills them on Mastercard branded specialty transactions, so a merchant with a small Mastercard share will pay less than the calculator shows on that line.",
    "Every rule quoted on this page was read in the primary document on 5 September 2026. The permanent prohibition grounds, including laundering and entering a merchant agreement under a new name with the intent to circumvent the rules, are Visa Core Rules and Visa Product and Service Rules effective 18 April 2026, rule 1.9.1.4. The acquirer's right to deduct merchant reserve funds from settlement is in the same document. The onboarding assessment of creditworthiness, business activity, delivery methods and return policies, the mandated holding periods naming Future Service Merchants, and the one time non refundable application fee plus tier 1 and tier 2 control assessments for High Integrity Risk registration are all in the Visa Ecosystem Risk Programs Guide, October 2024, requirement AHIR.C1.1. Two figures are carried over from this site's other datasets rather than re-read for this page: the Visa VAMP merchant threshold of 1.5% of settled card-not-present transactions with a 1,500 count minimum, read from Visa's Acquirer Monitoring Program fact sheet on 4 September 2026, and the Visa high integrity risk merchant category code list from the April 2026 Visa Merchant Data Standards Manual. No monthly platform price for a chargeback mitigation service is published here, because no US vendor publishes one that could be verified; that field is a user input with a zero default rather than an estimate.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "How much does a high risk merchant account cost?",
      answer:
        "More than the rate you were quoted. On $150,000 a month at a $75 ticket, a 3.95% plus $0.25 account with $80 of monthly fees, $1,950 of annual card brand registration, Mastercard's specialty fees, a backup merchant account and a 10% reserve held six months totals $103,775 a year, which is 5.77% of volume or $4.32 a transaction. Cash fees are $97,700 of that and $6,075 is the cost of financing the $90,000 the reserve locks up.",
    },
    {
      question: "What is a typical high risk merchant account rate?",
      answer:
        "Two US providers that publish their own ranges give 3.00% to 6.00% plus $0.10 to $0.50 a transaction, and 3.49% to 3.95% plus about $0.25. Treat anything inside that band as normal and anything above 6% as needing an explanation you can check. The rate is only about 70% of the total on a mid sized account, so compare quotes on total annual cost rather than on the percentage.",
    },
    {
      question: "Why do high risk processors charge more?",
      answer:
        "Because the acquirer is financially liable when a merchant cannot fund its own chargebacks, and part of the price is a pass through rather than margin. Visa charges $950 a year to register a merchant in a designated category and Mastercard $1,000 from 1 May 2026, plus $0.02 a transaction and 10 basis points of volume from 3 June 2026. Mastercard also charges acquirers $50,000 a year for the license to board these merchants at all.",
    },
    {
      question: "How much is a rolling reserve on a high risk account?",
      answer:
        "US providers publish 5% to 15% of volume held for 90 to 180 days. The number that matters is not the percentage but the balance it creates: volume times the percentage times the hold in months. At $150,000 a month, 10% and six months, that is $90,000 permanently locked from month six onward. It is not a fee, since it all comes back, but financing it at the 6.75% bank prime loan rate costs $6,075 a year.",
    },
    {
      question: "Can you get off high risk classification?",
      answer:
        "Sometimes, and the premium tells you what it is worth trying. On the example above the classification costs $40,775 a year, so a $15,000 project pays back in 4.4 months. Cutting your dispute rate is the precondition rather than the prize: halving it from 1.00% to 0.50% saves only $4,800 of fees, 11.8% of the premium. The other 88% comes from renegotiating the rate and the reserve with the lower ratio as evidence.",
    },
    {
      question: "Is it legal to have multiple merchant accounts to spread volume?",
      answer:
        "Having more than one is normal and often sensible: a backup MID at a second acquirer costs about $3,160 a year in duplicated fixed, registration and setup fees and protects you against a sudden closure. Splitting volume so that no account's dispute ratio reaches a monitoring threshold is different, and the Visa Core Rules effective 18 April 2026 let Visa permanently prohibit a merchant that enters an agreement under a new name with the intent to circumvent them.",
    },
  ],
  related: [
    "rolling-reserve-calculator",
    "chargeback-cost-calculator",
    "chargeback-ratio-calculator",
    "merchant-account-junk-fee-calculator",
    "effective-rate-calculator",
  ],
  links: [
    { label: "Processors for high risk businesses", href: "/category/high-risk" },
    { label: "Processors that advertise no rolling reserve", href: "/payment-processors/no-rolling-reserve" },
    { label: "High risk merchant, defined", href: "/glossary/high-risk-merchant" },
    { label: "Rolling reserve, defined", href: "/glossary/rolling-reserve" },
    { label: "How underwriting decides your terms", href: "/glossary/underwriting" },
    { label: "Best processors for high risk businesses", href: "/blog/best-processors-for-high-risk-businesses" },
  ],
  cta: {
    heading: "Take the premium into the call, not the complaint",
    body: "An acquirer quoting you a rate is quoting a number. Knowing that the classification costs $40,775 a year on your volume, and that 14.9% of it is a reserve you could ask to have capped, changes what you are negotiating about.",
    label: "Compare high risk processors",
  },
};
