import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/merchant-account-junk-fee-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS: "merchant account fees" with a calculation
 * modifier, plus the three informational siblings the same searcher types within
 * a minute of each other, "hidden credit card processing fees", "what is a PCI
 * compliance fee" and "statement fee". It does NOT reach for brand pricing, for
 * definitions, or for best-of lists. Those belong to `/processor/<slug>`,
 * `/glossary/<term>` and the facet pages, and this page ends by linking into
 * them.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Three things, all checkable.
 *
 *   1. Nobody adds up. Every page-one result for the hidden-fees query is a list
 *      of fee names with a vague range beside each, and not one of them produces
 *      a total, let alone a rate. A merchant cannot act on "$10 to $50 a month".
 *   2. Everybody gets the monthly minimum wrong. It is a FLOOR on the processing
 *      charge, not a line added to it, so a merchant above the floor pays it
 *      nothing. Treating it as a flat charge is the most common arithmetic error
 *      in the category, and it is silent.
 *   3. Everybody calls everything a scam. Assessments and interchange are
 *      genuine pass through at published rates, and a PCI program fee sometimes
 *      buys a real approved-scanning-vendor scan. A page that cannot tell the
 *      difference loses the reader on the first row they know about.
 *
 * WHERE THE NUMBERS CAME FROM. Every dollar figure in the copy below is either
 * read off a published document, named with its date in `assumptions`, or
 * computed by `lib/calc/junk-fees.ts` from those figures. The five documents:
 * Wells Fargo's merchant services pricing page; the State of North Carolina's
 * merchant card processing contract with Fiserv/First Data, effective 24 May
 * 2024; a completed Heartland merchant processing agreement filed in a Georgia
 * council packet; Authorize.net's published US pricing; and the FTC's July 2022
 * action against First American Payment Systems.
 *
 * THE WORKED EXAMPLE IS THE WIDGET'S DEFAULT STATE. $1,323.00 a year on
 * $15,000 a month is asserted from hand arithmetic in
 * `tests/tools/batch-four/merchant-account-junk-fee-calculator.test.ts`. If you
 * change an amount in `lib/tools-data/junk-fees.ts`, that test fails and this
 * copy has to be rewritten with it. A hand-written number that disagrees with
 * the widget on the same page has shipped on this site before.
 */
export const JUNK_FEE_TOOL: ToolDef = {
  slug: "merchant-account-junk-fee-calculator",
  name: "Junk Fee Annualizer",
  h1: "Merchant account fees calculator",
  title: "Merchant Account Fees Calculator | Estimate Hidden Fees",
  description:
    "Use our merchant account fees calculator to estimate annual fixed fees, PCI charges, gateway costs, terminal rentals, and their impact on your processing rate.",
  intro:
    "A service fee, a PCI fee, a gateway fee and a terminal rental each look like nothing at around $10 to $35 a month. On a store running $15,000 a month they come to $1,323 a year, which is 0.735 percent, or 74 basis points, sitting on top of whatever rate you were quoted. The Junk Fee Annualizer adds up the fixed lines on a US merchant statement, converts the total into basis points on your own volume, and ranks them by how easily each one comes off. Two of them usually come off for the asking.",
  tier: 2,
  summary:
    "Add up the fixed fees on your merchant statement, see them as basis points, and rank what comes off first.",
  widget: "junk-fees",
  workedExample: {
    scenario:
      "A single-location hardware store runs $15,000 a month on cards at a 2.90 percent all-in rate, on a traditional merchant account with 24 months left on the term. Its statement carries eight fixed lines: a $9.95 monthly account fee, a $10.00 PCI compliance program fee, a $19.95 PCI non-compliance fee, a $20.00 monthly minimum, a $99.00 annual fee, a 10 cent batch fee, a $25.00 gateway fee and a $35.00 terminal rental. Every one of those amounts is read from a published US fee schedule, listed with its source in the assumptions below.",
    result:
      "Run the arithmetic line by line. The account fee, 9.95 x 12, comes to $119.40. Same math on the PCI compliance program fee: 10.00 x 12, or $120.00. The PCI non-compliance fee is steeper, 19.95 x 12, at $239.40. The annual fee needs no multiplication at all, it is just $99.00. The batch fee is the odd one, billed per banking day rather than per month, so 0.10 x 252 comes to $25.20. Gateway and terminal rental are both a straightforward times twelve: $300.00 for the gateway (25.00 x 12) and $420.00 for the rental (35.00 x 12). The monthly minimum, on the other hand, costs nothing at all. At $15,000 a month and 2.90 percent, this store already pays $435.00 in discount fees, which clears the $20.00 floor with room to spare, so the shortfall is zero. Add it up and the total is $1,323.00 a year, or $110.25 a month. Divide that by $180,000 of annual card volume, 1,323 / 180,000, and you get 0.735 percent, which the Junk Fee Annualizer rounds to 74 basis points, pushing the real cost of acceptance from 2.90 percent to 3.635 percent. Now cut. The PCI non-compliance fee stops the month the annual self-assessment questionnaire is filed, which is $239.40. The $99.00 annual fee buys nothing and is normally waived on request. That is $338.40 for two phone calls, leaving $984.60 and 54.7 basis points. Buy the terminal instead of renting it and the rental goes too: North Carolina's state contract prices the same Clover Flex Gen 3 at $734.00 to buy against $35.00 a month to rent, so the purchase pays for itself in 21 months and saves $1,366 across five years. All three cuts leave $564.60 a year and 31.4 basis points, from 74.",
  },
  sections: [
    {
      heading: "What merchant account fees actually appear on a US statement",
      body: [
        "A merchant statement has three layers and only the top one gets discussed. The bottom layer is interchange, which goes to the bank that issued your customer's card. The middle layer is assessments, which go to the card networks: on North Carolina's published pass-through schedule, 0.14 percent for Visa credit, 0.13 percent for Mastercard, 0.14 percent for Discover and 0.165 percent for American Express, plus Mastercard's network access fee of $0.0195 per authorization. Neither layer is your processor's money and neither is negotiable by anyone in the chain.",
        "The top layer is where your processor makes its living, and it has two halves. One is the markup on every transaction, which is the number everybody negotiates. The other is a long tail of small fixed charges billed monthly, annually or per settlement batch, and almost nobody negotiates those, because each one is too small to be worth a phone call on its own. The Junk Fee Annualizer exists to price the tail rather than the markup.",
        "The full set is short enough to list. Monthly: a statement fee, an account or service fee, a PCI compliance program fee, a PCI non-compliance fee, a gateway fee, a terminal or equipment rental, and sometimes a flat line called a network access fee. Annually: an annual or membership fee, sometimes a separate annual PCI program fee, and occasionally an IRS reporting or 1099-K fee. Per settlement: a batch fee. And one that is not periodic at all, the early termination fee, which you only pay on the way out but which prices your ability to leave.",
        "Two deserve a warning about their names. Heartland's merchant processing agreement tells the merchant, in a footnote to its own fee schedule, that a monthly fee will appear on the statement titled Service and Regulatory Mandate Fee. Nothing about it is a mandate. And a flat monthly network access fee is not the network's: the real one is $0.0195 an authorization and moves with your transaction count. A line that calls itself a network fee and does not move with your volume is a processor fee wearing a network's clothes.",
      ],
    },
    {
      heading: "Why a $10 line is worth 74 basis points",
      body: [
        "A percentage fee is a rate by construction. A fixed fee is a rate too, but you have to divide to see it, and the divisor is your volume. That is the entire mechanism this page exists to expose. Take the $1,323 annual bill in the worked example above and hold it still while the volume moves: at $5,000 a month it is 221 basis points, at $10,000 it is 110, at $15,000 it is 74, at $25,000 it is 44, at $50,000 it is 22 and at $100,000 it is 11. Same fees, same processor, same statement. Nine times the volume, one twentieth of the rate.",
        "The consequence is that fixed fees are regressive, and they are worst for exactly the merchants who negotiate least. A business processing $100,000 a month can shrug at $1,323 because it is a rounding error against interchange. A business processing $5,000 a month is paying more in fixed fees than most processors charge in markup, and it is usually the one being told that its rate is competitive. The rate probably is competitive. The rate is not the bill.",
        "This is also why comparing processors on rate alone gives the wrong answer at the bottom of the market. A flat-rate account at 2.9 percent plus 30 cents with no monthly fees is often more expensive per transaction than an interchange-plus account at cost plus 0.25 percent, and cheaper in total, because the second account carries $110 a month of fixed charges that the first does not. The crossover moves with volume and it is worth working out rather than assuming. The Junk Fee Annualizer gives you one half of that comparison and the effective rate calculator gives you the other.",
      ],
    },
    {
      heading: "The PCI non-compliance fee is the most avoidable line you will ever be charged",
      body: [
        "This one deserves its own section because it is the only line on the list that is pure penalty, entirely within your control, and charged every single month until you act. It is not a fine from the card networks. No regulator receives it. Your processor charges it because you have not filed an annual self-assessment questionnaire, and it keeps charging until you do. North Carolina's contract with Fiserv states the mechanism exactly: the non-receipt of PCI validation fee is $19.95 a month, charged for each month after the PCI validation due date until validation is received.",
        "The amounts vary far more than any other line here. The state contract's $19.95 a month is $239.40 a year. A completed Heartland merchant agreement filed in a Georgia council packet shows the fee at $125.00 a month, which is $1,500 a year for not filling in a form. Neither figure is a market rate, because there is no market: the processor sets it and the processor keeps it, and there is nothing on the other side of the transaction.",
        "The fix is genuinely small for most small merchants. The PCI Security Standards Council publishes a set of self-assessment questionnaires and the shortest, SAQ A, covers merchants who accept only card-not-present transactions and have outsourced all account data handling to compliant third parties, keeping no account data in electronic form on their own systems or premises. That describes a great many small ecommerce sellers using a hosted checkout. A merchant swiping cards in a store falls into a different questionnaire, and one that stores card numbers falls into a much longer one, so the first job is finding out which applies to you rather than starting to answer questions. Once it is filed, ask for the months already charged to be credited, then diarize the anniversary: the commonest way this fee comes back is a validation lapsing at twelve months while nobody is watching.",
      ],
    },
    {
      heading: "Which of these are legitimate, and which are pure margin",
      body: [
        "The credibility of a page like this rests entirely on not calling everything a scam, so here is the honest split. Interchange and assessments are pass through: the money leaves your processor and goes to an issuing bank or a card network at published rates, and no processor can waive them. If a salesperson offers to cut your interchange, that is a reliable signal that they are describing something else, usually their own markup.",
        "A gateway fee is a real service. Authorize.net publishes $25 a month for its gateway on every plan, and a gateway really does route card-not-present transactions. It is on this list for duplication rather than invention: merchants routinely pay a gateway fee to a reseller on top of the fee the gateway itself charges, or pay for a gateway their processor already includes. The PCI compliance program fee is the genuinely ambiguous one. At its best it buys quarterly external scanning by an approved scanning vendor and a breach liability warranty. At its worst it buys a login. The test is one question: which approved scanning vendor is attached to my account? If nobody can name one, you are paying for a login, and Helcim publishes $0 for the same annual self-assessment alongside no minimums, software fees or statement fees.",
        "The rest are margin. A statement fee was postage when statements went out in envelopes. An annual fee is a monthly fee collected in one hit, timed to land in a month you are not reading closely, and nothing costs a processor money once a year and nothing the other eleven months. An IRS reporting or 1099-K fee charges you for something the processor already has to do, because 26 U.S.C. 6050W obliges a payment settlement entity to file an information return on the payments it settles for you. A monthly minimum is margin too, but with an honest structure behind it, and it only ever costs you the shortfall.",
      ],
    },
    {
      heading: "How to get them removed, and when the answer is to do nothing",
      body: [
        "Work down the ranked list in annual dollars, not in order of annoyance. On the worked example that is terminal rental at $420, gateway at $300, PCI non-compliance at $239.40, PCI program fee at $120, account fee at $119.40, annual fee at $99, batch fee at $25.20 and the monthly minimum at nothing. Ask for all of them in one call rather than one a quarter: the cost of the call is the same, and a processor with a retention target responds better to a list than to a nibble.",
        "Terminal rental is the most reliably winnable and the least often attacked. North Carolina's state contract prices the same Clover Flex Gen 3 three ways: $734.00 to buy, $35.00 a month to rent month to month, and $78.00 a month on a 36 month lease. The rental passes the purchase price in 21 months and then keeps charging. The lease is $2,808 across the term for a $734 device and, unlike a rental, usually cannot be cancelled. Never sign an equipment lease with a separate leasing company: it survives the end of your processing agreement. Price the exit too. The Federal Trade Commission's July 2022 action against First American Payment Systems described an enrollment flow that hid a three year auto-renewing term and a $495 cancellation fee, and settled with $4.9 million turned over for refunds. Get your own fee, term end date and auto-renewal notice window in writing, because that window is often 30 to 90 days and missing it renews you. A $495 exit spread across 24 remaining months is $247.50 a year, which a better rate frequently repays inside a quarter.",
        "Sometimes the right answer is to do nothing, and the Junk Fee Annualizer says so as clearly as it says the opposite. If your fixed fees come to under about 10 basis points on your volume, the tail is not your problem and interchange qualification and your pricing model are. If your monthly minimum shows as costing nothing, leave it alone rather than negotiating a floor you never touch. And if $10 a month buys a PCI program with a named scanning vendor and a breach warranty, that is a product you are buying rather than a fee you are suffering. Knowing which is which is the point.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Merchant account fee amounts read from published US documents, with the source beside each. Sourced, not estimated: every figure below was read off the named document on 5 September 2026. The annual totals this page computes are arithmetic on these numbers.",
    columns: ["Published amount", "What it really is"],
    rows: [
      {
        label: "Monthly account or service fee",
        note: "Wells Fargo Merchant Services pricing page",
        values: ["$9.95 a month per merchant ID", "Mixed. Real tooling, misleading name"],
      },
      {
        label: "PCI compliance program fee",
        note: "Wells Fargo Merchant Services pricing page",
        values: ["$10.00 a month per merchant ID", "Mixed. Ask who scans you"],
      },
      {
        label: "Annual PCI program fee",
        note: "North Carolina state contract with Fiserv, effective 24 May 2024",
        values: ["$219 a year per primary merchant ID", "Mixed. One other PCI line on the same contract is marked WAIVED"],
      },
      {
        label: "PCI non-compliance fee",
        note: "North Carolina state contract with Fiserv, effective 24 May 2024",
        values: ["$19.95 a month until validation is received", "Pure margin. Entirely avoidable"],
      },
      {
        label: "PCI non-compliance fee, high end seen",
        note: "Heartland merchant processing agreement, Georgia council packet",
        values: ["$125.00 a month", "Pure margin. $1,500 a year for an unfiled form"],
      },
      {
        label: "Monthly minimum",
        note: "Heartland merchant processing agreement, Georgia council packet",
        values: ["$20.00 a month floor", "Margin, but only ever costs the shortfall"],
      },
      {
        label: "Annual fee",
        note: "Heartland merchant processing agreement, Georgia council packet",
        values: ["$99.00 a year", "Pure margin"],
      },
      {
        label: "Gateway fee",
        note: "Authorize.net published US pricing",
        values: ["$25.00 a month on every plan", "Real service. Watch for paying twice"],
      },
      {
        label: "Batch or settlement fee",
        note: "Authorize.net published US pricing, gateway only plans",
        values: ["10 cents a batch", "Mixed. Count your batches before arguing"],
      },
      {
        label: "Terminal rental against purchase",
        note: "North Carolina state contract with Fiserv, Clover Flex Gen 3",
        values: ["$35.00 a month to rent, $734.00 to buy, $78.00 a month to lease over 36 months", "Margin. Buying wins after 21 months"],
      },
      {
        label: "Early termination fee",
        note: "FTC v. First American Payment Systems, 29 July 2022",
        values: ["$495 alleged, on a hidden three year auto-renewing term", "Margin. Price it before you switch"],
      },
      {
        label: "Card network assessments",
        note: "North Carolina Office of the State Controller, card brand pass through schedule",
        values: ["Visa 0.14% credit and 0.13% debit, Mastercard 0.13%, Discover 0.14%, American Express 0.165%", "Genuine pass through. Not negotiable by anyone"],
      },
      {
        label: "Mastercard network access and brand usage",
        note: "North Carolina Office of the State Controller, card brand pass through schedule",
        values: ["$0.0195 per authorization", "Genuine pass through. Moves with transaction count"],
      },
    ],
  },
  assumptions: [
    "Every dollar figure in the default state was read from a published US document on 5 September 2026: Wells Fargo Merchant Services' pricing page for the $9.95 monthly account fee and the $10.00 PCI Compliance Program fee, both per merchant ID; the State of North Carolina and Fiserv/First Data Schedule of Fees, contract 500200-000 effective 24 May 2024, for the $19.95 monthly PCI non-validation fee, the $219 annual PCI service fee and the Clover Flex Gen 3 pricing at $734.00 to buy, $35.00 a month to rent and $78.00 a month to lease over 36 months; a completed Heartland Payment Systems merchant processing agreement filed in a City of Dalton, Georgia council packet for the $20.00 monthly minimum, the $99.00 annual fee and the $125.00 PCI non-compliance fee; and Authorize.net's published US pricing for the $25.00 monthly gateway fee and the 10 cent daily batch fee.",
    "Four lines default to zero and are unticked, because no US processor, acquirer or public contract I could find publishes a dollar amount for them: the statement fee, the IRS reporting or 1099-K fee, a flat monthly network access fee, and card network assessments, which are a percentage rather than a fixed monthly charge. The Junk Fee Annualizer would rather show nothing than print a figure it cannot stand behind, so type those in off your own statement.",
    "A monthly minimum is modeled as a floor on your processing charge, not as a line added to it. It costs you the shortfall and nothing more, so on the default inputs, $15,000 a month at 2.90 percent, it costs zero. This is the arithmetic every competing hidden-fees page gets wrong, and getting it wrong overstates the default bill by $240 a year.",
    "The early termination fee is not counted as a monthly cost, because you only pay it if you leave. It is spread across the months left on your term, which prices what staying costs you a year. The $495 figure is the amount alleged in the Federal Trade Commission's 29 July 2022 action against First American Payment Systems, not a market average.",
    "A batch fee is charged per settlement, and settlement happens on banking days, so it is annualized at 252 banking days and 21 a month. The rest of the model holds your volume and your fee schedule flat for twelve months and multiplies by twelve. Fees are a flow rather than a growth rate, so they do not compound.",
    "Interchange and card network assessments are excluded from the totals on purpose. They are genuine pass through at published rates, they are the largest part of your bill, and no processor can waive or discount them. The published assessment rates in the table above are from the North Carolina Office of the State Controller's card brand pass through schedule, read 5 September 2026, and the networks reprice them.",
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "What are merchant account fees?",
      answer:
        "Three layers. Interchange goes to the bank that issued your customer's card. Assessments go to the card networks, at published rates such as 0.14 percent for Visa credit and $0.0195 per authorization for Mastercard's network access fee. The third layer is your processor's own charges: a markup on every transaction, plus a tail of fixed monthly, annual and per-batch fees. On $15,000 a month that tail commonly runs $1,323 a year, or 74 basis points.",
    },
    {
      question: "What is a PCI compliance fee?",
      answer:
        "A monthly or annual charge from your processor for administering PCI DSS validation. Wells Fargo publishes $10.00 a month per merchant ID; North Carolina's state contract with Fiserv shows $219 a year per merchant ID. It is legitimate when it buys quarterly scanning by an approved scanning vendor and a breach warranty, and it is a login fee when it does not. Ask which scanning vendor is attached to your account, and note that some processors charge $0 for the same self-assessment.",
    },
    {
      question: "What is a PCI non-compliance fee and how do I get rid of it?",
      answer:
        "It is a monthly penalty your processor charges because you have not filed an annual self-assessment questionnaire. North Carolina's Fiserv contract prices it at $19.95 a month, charged every month after the validation due date until validation is received; one Heartland agreement shows $125.00 a month, which is $1,500 a year. File the questionnaire in your processor's portal and it stops on the next statement. Then ask for the months already charged to be credited back.",
    },
    {
      question: "What is a statement fee on a merchant account?",
      answer:
        "A monthly charge that originally covered printing and posting a paper statement. Almost nothing about a modern statement is printed, which is why the processors that publish a full fee list either price paper reporting at nothing, as North Carolina's state contract does, or say plainly that they charge no statement fee at all, as Helcim does. Ask to move to electronic statements and to have the line removed with them. It is the easiest single call on the list.",
    },
    {
      question: "Are merchant account fees negotiable?",
      answer:
        "The fixed ones usually are, and interchange and assessments never are. In the worked example above, $338.40 a year of the $1,323 bill comes off for the asking: a $239.40 PCI non-compliance fee that stops when you file, and a $99.00 annual fee that buys nothing. Another $420 comes off by buying the terminal rather than renting it. Ask for everything in one call, in writing, and check the next three statements, because a waiver that is not applied is common.",
    },
    {
      question: "How much are hidden credit card processing fees?",
      answer:
        "As a rate rather than a dollar figure, because that is the only way to compare them. The same $1,323 annual bill is 221 basis points on $5,000 a month, 74 on $15,000, 22 on $50,000 and 11 on $100,000. Fixed fees are regressive: they are worst for the smallest merchants, who negotiate them least. Under about 10 basis points the tail is not your problem and your pricing model is.",
    },
  ],
  related: [
    "pci-saq-level-finder",
    "effective-rate-calculator",
    "credit-card-processing-savings-calculator",
    "authorize-net-fee-calculator",
    "pos-terminal-lease-vs-buy-calculator",
  ],
  links: [
    { label: "Monthly minimum, explained", href: "/glossary/monthly-minimum" },
    { label: "Gateway fee, explained", href: "/glossary/gateway-fee" },
    { label: "Assessment fee, explained", href: "/glossary/assessment-fee" },
    { label: "What PCI DSS actually requires", href: "/glossary/pci-dss" },
    { label: "Effective rate, explained", href: "/glossary/effective-rate" },
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
  ],
  cta: {
    heading: "The fixed fees are the easy half",
    body: "Once the tail is off your statement, the money is in interchange qualification and your pricing model. Tell us your volume and we will shortlist processors that publish what they charge.",
    label: "Get matched",
  },
};
