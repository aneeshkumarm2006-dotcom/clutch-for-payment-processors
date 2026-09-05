/**
 * The fixed-fee long tail on a US merchant statement
 *
 * Generated reference data for the `/tools/*` calculators. The maintenance
 * contract is in `lib/tools-data/index.ts`: every figure here was read from a
 * primary source on the date recorded beside it, and a checked date must never
 * be moved without re-reading the source.
 *
 * ONE MODULE PER TOOL, ON PURPOSE. `/tools/[tool]` is a single route serving
 * every calculator, so anything a client widget imports lands in the chunk that
 * EVERY tool page loads. Splitting these is what keeps the 290 row MCC table off
 * the Stripe fee calculator. Do not merge them back into one file, and do not
 * import from `lib/tools-data/index.ts` inside a `"use client"` module.
 *
 * ─── Why every row carries a verdict, and why the verdict is not always bad ──
 *
 * The entire credibility of this page rests on NOT calling everything a scam.
 * Interchange is set by the issuer, assessments are set by the card networks,
 * and neither is negotiable by anyone in the chain. A PCI compliance program fee
 * sometimes buys a real quarterly scan and a real breach warranty. If the page
 * lumps those in with a $99 annual fee that buys nothing, a merchant who checks
 * one row and finds it unfair discards the other thirteen.
 *
 * So `verdict` is one of four values and every row has to justify which one it
 * got in `verdictNote`. The four:
 *
 *   pass-through  the money leaves your processor and goes to a network or an
 *                 issuer. Not margin, not negotiable, and not junk.
 *   real-service  you are buying something that costs the seller money.
 *                 Negotiable, sometimes removable, but not invented.
 *   mixed         a real service wrapped in a markup nobody itemises.
 *   margin        the processor keeps it and it buys you nothing.
 *
 * ─── Why some rows have a default amount of zero ─────────────────────────────
 *
 * A wrong number renders identically to a right one. Four of the lines below are
 * real and appear on real statements, but I could not find a US processor,
 * acquirer or public contract that PUBLISHES a dollar amount for them. Those
 * rows carry `sourced: false`, a default amount of zero and `defaultOn: false`,
 * so the page never prints a figure it cannot stand behind. The merchant types
 * the amount off their own statement, which is the only authority that matters
 * for those lines anyway.
 *
 * Every row with `sourced: true` has its dollar figure in the `source` string
 * beside it, with the document and the date it was read.
 *
 * ─── The monthly minimum is not a flat fee ───────────────────────────────────
 *
 * `model: "floor"` exists because of one specific arithmetic error that every
 * competing "hidden fees" page makes. A monthly minimum is a FLOOR on your
 * processing charge, not a line added to it. A merchant paying $435 a month in
 * discount fees against a $20 minimum pays the minimum nothing. Adding $20 a
 * month to that merchant's bill overstates the annual total by $240 and is the
 * single easiest way for this page to be wrong. See `lib/calc/junk-fees.ts`.
 */

/** How often the line is billed. `amortized` is a one-off spread over a term. */
export type JunkFeeFrequency = "monthly" | "annual" | "per-business-day" | "amortized";

/**
 * How the arithmetic treats the line.
 *
 *   flat         the amount is charged, full stop.
 *   floor        the amount is a minimum on your processing charge, so it costs
 *                you only the shortfall.
 *   termination  a one-off, spread across the months left on your term.
 */
export type JunkFeeModel = "flat" | "floor" | "termination";

/** Whose money it really is. See the module header for what each value means. */
export type JunkFeeVerdict = "pass-through" | "real-service" | "mixed" | "margin";

/** How hard it is to make the line go away. Drives the ranked removal list. */
export type JunkFeeNegotiability = "remove" | "negotiate" | "replace" | "fixed";

export interface JunkFee {
  id: string;
  label: string;
  /** How the line usually reads on a US merchant statement. Statements abbreviate. */
  statementLabels: string[];
  frequency: JunkFeeFrequency;
  model: JunkFeeModel;
  /** Starting amount in US dollars. Zero where no published US figure was verified. */
  defaultAmount: number;
  /** True when `defaultAmount` was read off a published document named in `source`. */
  sourced: boolean;
  /** Ticked in the widget's default state. Only sourced rows may be ticked. */
  defaultOn: boolean;
  /** What the line commonly costs, in words, so a range is never mistaken for a figure. */
  typicalRange: string;
  verdict: JunkFeeVerdict;
  /** Why this row got that verdict. This is the paragraph the page is judged on. */
  verdictNote: string;
  negotiability: JunkFeeNegotiability;
  /** What to actually say or do to get rid of it. */
  removal: string;
  /** Publisher, document and the date it was read. Or the reasoning, where nothing is published. */
  source: string;
}

export interface JunkFeeDefaults {
  /** Card volume a month, in US dollars. */
  monthlyVolume: number;
  /** The merchant's current all-in processing rate, before any of these lines. */
  effectiveRatePct: number;
  /** Months left on the contract, used to spread an early termination fee. */
  remainingTermMonths: number;
}

/**
 * The widget's opening state, kept here rather than in the component so the
 * defaults are data and the worked example on the page can be checked against
 * them. On these numbers the monthly processing charge is $435.00, which is
 * comfortably above the $20.00 minimum, so the minimum costs nothing and the
 * page gets to show that rather than assert it.
 */
export const JUNK_FEE_DEFAULTS: JunkFeeDefaults = {
  monthlyVolume: 15000,
  effectiveRatePct: 2.9,
  remainingTermMonths: 24,
};

const WELLS_FARGO =
  "Wells Fargo Merchant Services payment processing pricing page, wellsfargo.com/biz/merchant/payment-processing-pricing, which lists a merchant account fee of $9.95 per month per merchant ID and a PCI Compliance Program fee of $10.00 per month per merchant ID, and states there are no application fees, no monthly minimums and no early termination fees. Read September 5, 2026.";

const NC_FISERV =
  "State of North Carolina and Fiserv/First Data Merchant Services, Schedule of Fees, Merchant Card Processing Services, contract number 500200-000, effective May 24, 2024, published at ncosc.gov. Read September 5, 2026.";

const HEARTLAND =
  "A completed Heartland Payment Systems Merchant Processing Agreement, fee schedule page, filed as a public attachment to a City of Dalton, Georgia council meeting packet. Read September 5, 2026.";

const AUTHORIZE_NET =
  "Authorize.net published US pricing, authorize.net/en-us/sign-up.html, listing a $25 monthly gateway fee on all three plans and a 10 cent daily batch fee on the gateway only plans. Read September 5, 2026.";

const HELCIM =
  "helcim.com/pricing, which states no account monthly fees and no minimums, software fees or statement fees, prices the annual compliance self assessment at $0, and states there are no contracts, leases, termination fees or cancellation fees. Read September 5, 2026.";

const NC_PASS_THROUGH =
  "North Carolina Office of the State Controller, Appendix G, Reference Guide for Card Brand Pass Through Fees, ncosc.gov. Lists the Visa US Acquirer Service Fee at 0.14% credit and 0.13% debit and prepaid, the Mastercard Acquirer Brand Volume fee at 0.13%, the Mastercard Network Access and Brand Usage authorization fee at $0.0195, Discover at 0.14% and American Express at 0.165%. Read September 5, 2026.";

/**
 * Fourteen lines, in the order they tend to appear on a statement.
 *
 * The seven with `defaultOn: true` make up the page's worked example. Their
 * amounts total $1,323.00 a year on the default inputs, and that figure is
 * asserted in `tests/tools/batch-four/merchant-account-junk-fee-calculator.test.ts`
 * from hand arithmetic. If you change an amount here, that test fails and the
 * worked example in `lib/tools-defs/merchant-account-junk-fee-calculator.ts` has
 * to be rewritten. That coupling is deliberate.
 */
export const JUNK_FEES: JunkFee[] = [
  {
    id: "statement-fee",
    label: "Monthly statement fee",
    statementLabels: ["STATEMENT FEE", "MONTHLY STMT FEE", "PAPER STATEMENT"],
    frequency: "monthly",
    model: "flat",
    defaultAmount: 0,
    sourced: false,
    defaultOn: false,
    typicalRange: "A few dollars a month where it still exists. Read the amount off your own statement.",
    verdict: "margin",
    verdictNote:
      "It was a printing and postage charge when statements went out in envelopes. Almost nothing about a modern statement is printed, and the processors that publish a full fee list either price paper reporting at nothing or say plainly that they charge no statement fee at all.",
    negotiability: "remove",
    removal:
      "Ask to be moved to electronic statements and to have the line removed with it. This is the easiest single call on the list, because there is no service left underneath it to argue about.",
    source:
      "No US processor or acquirer I could find publishes a dollar amount for this line, so the default is zero rather than a guess. Two published documents establish the direction of travel: the North Carolina state contract prices hard copy reporting at No Charge, and " +
      HELCIM,
  },
  {
    id: "account-maintenance",
    label: "Monthly account or service fee",
    statementLabels: [
      "MERCHANT ACCOUNT FEE",
      "MONTHLY SERVICE FEE",
      "ACCOUNT MAINTENANCE",
      "SERVICE AND REGULATORY MANDATE FEE",
    ],
    frequency: "monthly",
    model: "flat",
    defaultAmount: 9.95,
    sourced: true,
    defaultOn: true,
    typicalRange: "$9.95 a month at Wells Fargo. Traditional accounts commonly run higher.",
    verdict: "mixed",
    verdictNote:
      "Something real usually sits under it: reporting, dispute tooling, support. The problem is the name. Heartland's own merchant application tells the merchant, in a footnote to the fee schedule, that a monthly fee will be titled Service and Regulatory Mandate Fee on the statement, which is a processor fee wearing the word mandate. Nobody mandated it.",
    negotiability: "negotiate",
    removal:
      "This is the line to trade rather than delete. Ask for it to be waived for the remaining term in exchange for staying, and ask what it buys that the per transaction rate does not. If the answer is a list of things you do not use, price a processor that bundles them at zero.",
    source: WELLS_FARGO,
  },
  {
    id: "monthly-minimum",
    label: "Monthly minimum",
    statementLabels: ["MONTHLY MINIMUM", "MINIMUM DISCOUNT FEE", "MIN FEE ADJUSTMENT"],
    frequency: "monthly",
    model: "floor",
    defaultAmount: 20,
    sourced: true,
    defaultOn: true,
    typicalRange: "$20.00 a month on the agreement below. $25 and $50 floors are both common.",
    verdict: "margin",
    verdictNote:
      "It exists to guarantee the processor a floor on an account that might process almost nothing. That is a rational thing for a processor to want and a bad thing for a seasonal or part time merchant to sign. It costs you only the shortfall, so above the floor it is invisible and below it, it is brutal in percentage terms.",
    negotiability: "negotiate",
    removal:
      "Ask for the minimum to be dropped or halved at renewal, and point at your own twelve month history if you have never once triggered it. If you are seasonal, ask for it to be annualized instead of monthly, which is a normal accommodation and stops the quiet months costing you.",
    source: HEARTLAND,
  },
  {
    id: "pci-compliance",
    label: "PCI compliance program fee",
    statementLabels: ["PCI COMPLIANCE FEE", "PCI PROGRAM FEE", "PCI SERVICE FEE"],
    frequency: "monthly",
    model: "flat",
    defaultAmount: 10,
    sourced: true,
    defaultOn: true,
    typicalRange: "$10.00 a month at Wells Fargo, or $219 a year per merchant ID on the state contract below.",
    verdict: "mixed",
    verdictNote:
      "Sometimes this buys a real thing: a hosted self assessment portal, quarterly external vulnerability scanning by an approved scanning vendor, and a breach liability warranty. Sometimes it buys a login to a questionnaire you could complete for free. The way to tell is to ask which approved scanning vendor is attached to your account. If nobody can name one, you are paying for a login.",
    negotiability: "negotiate",
    removal:
      "Ask for the scanning vendor name and the warranty limit in writing. If both exist, the fee is a product and worth comparing against buying the scan directly. If neither exists, ask for it to be removed, and price processors that charge nothing for the same self assessment.",
    source: WELLS_FARGO + " The annual variant, $219 per primary merchant ID per SAQ filing, is from " + NC_FISERV,
  },
  {
    id: "pci-annual",
    label: "Annual PCI program fee",
    statementLabels: ["ANNUAL PCI FEE", "PCI COMPLYALLY SERVICE FEE"],
    frequency: "annual",
    model: "flat",
    defaultAmount: 219,
    sourced: true,
    defaultOn: false,
    typicalRange: "$219 a year per primary merchant ID on the North Carolina state contract.",
    verdict: "mixed",
    verdictNote:
      "The same product as the monthly PCI program fee, billed once a year instead, so tick one or the other and never both. The same state contract also shows the fee can be negotiated away entirely: its Annual PCI Compliance line, covering the Rapid Comply tool used by Level 3 and Level 4 merchants, is marked WAIVED.",
    negotiability: "negotiate",
    removal:
      "The precedent to quote is in the contract itself. A state government negotiated one PCI line to WAIVED and paid $219 for another. Ask which of the two yours is, and ask for the waived treatment.",
    source: NC_FISERV,
  },
  {
    id: "pci-non-compliance",
    label: "PCI non-compliance fee",
    statementLabels: ["PCI NON-COMPLIANCE FEE", "NON-RECEIPT OF PCI VALIDATION", "PCI NON VALIDATION"],
    frequency: "monthly",
    model: "flat",
    defaultAmount: 19.95,
    sourced: true,
    defaultOn: true,
    typicalRange: "$19.95 a month on the state contract below, $125.00 a month on the merchant agreement below.",
    verdict: "margin",
    verdictNote:
      "This is the single most avoidable line on a US merchant statement. It is not a fine from the card networks and no regulator receives it. Your processor charges it because you have not filed an annual self assessment questionnaire, and it keeps charging it every month until you do. The state contract wording is exact about the mechanism: charged for each month after the PCI validation due date until validation is received.",
    negotiability: "remove",
    removal:
      "File the questionnaire. Find which SAQ applies to you, complete it in your processor's portal, and the fee stops on the next statement. Then ask for the months you were charged while non-compliant to be credited back, which processors do grant more often than merchants expect because the fee is theirs to waive.",
    source:
      NC_FISERV +
      " The $125.00 a month figure, the high end seen here, is from " +
      HEARTLAND +
      " Eligibility for the shortest questionnaire is set out in PCI Security Standards Council, PCI DSS Self-Assessment Questionnaire A, version 4.0, listings.pcisecuritystandards.org, read September 5, 2026.",
  },
  {
    id: "annual-fee",
    label: "Annual fee",
    statementLabels: ["ANNUAL FEE", "ANNUAL MEMBERSHIP FEE", "YEARLY ACCOUNT FEE"],
    frequency: "annual",
    model: "flat",
    defaultAmount: 99,
    sourced: true,
    defaultOn: true,
    typicalRange: "$99.00 a year on the merchant agreement below.",
    verdict: "margin",
    verdictNote:
      "There is no service that costs a processor money once a year and nothing the other eleven months. It is a monthly fee collected in one hit, and it is priced to be small enough to ignore and timed to land in a month you are not reading closely. It is also the line most often forgotten between renewals.",
    negotiability: "remove",
    removal:
      "Ask for it to be waived at renewal, in writing, and check the following twelve statements. If it reappears without a signed amendment, that is a billing error rather than a negotiation, and it should be credited.",
    source: HEARTLAND,
  },
  {
    id: "batch-fee",
    label: "Batch or settlement fee",
    statementLabels: ["BATCH FEE", "SETTLEMENT FEE", "DAILY BATCH", "BATCH HEADER FEE"],
    frequency: "per-business-day",
    model: "flat",
    defaultAmount: 0.1,
    sourced: true,
    defaultOn: true,
    typicalRange: "10 cents per batch on Authorize.net's gateway only plans.",
    verdict: "mixed",
    verdictNote:
      "Closing a batch is a real message to a real network and it does cost something. Ten cents a day is not the number that hurts. The number that hurts is a merchant closing four batches a day across three terminals and never noticing, because the line is priced per batch and nobody counts batches.",
    negotiability: "negotiate",
    removal:
      "Count your batches before you argue about the price. If you are closing more than one a day per terminal, fix the settlement schedule first, because that is worth more than the rate. Then ask for the fee to be folded into the per transaction price, which is where flat rate processors already put it.",
    source: AUTHORIZE_NET,
  },
  {
    id: "gateway-fee",
    label: "Payment gateway fee",
    statementLabels: ["GATEWAY FEE", "MONTHLY GATEWAY", "AUTH.NET MONTHLY"],
    frequency: "monthly",
    model: "flat",
    defaultAmount: 25,
    sourced: true,
    defaultOn: true,
    typicalRange: "$25.00 a month at Authorize.net, on every plan.",
    verdict: "real-service",
    verdictNote:
      "A gateway is real software that really does route your card not present transactions, and Authorize.net publishes $25 a month for it openly. This is on the list for one reason: duplication. Merchants routinely pay a gateway fee to a reseller on top of the gateway fee the gateway charges, or pay for a gateway their new processor already includes.",
    negotiability: "replace",
    removal:
      "Find out who actually operates your gateway and what the vendor charges for it directly. If your processor is reselling at a markup, or if your processor already bundles a gateway you are not using, you are paying twice. That is a switch, not a negotiation.",
    source: AUTHORIZE_NET,
  },
  {
    id: "irs-report-fee",
    label: "IRS report or 1099-K fee",
    statementLabels: ["IRS REPORTING FEE", "1099-K FEE", "ANNUAL IRS FEE"],
    frequency: "annual",
    model: "flat",
    defaultAmount: 0,
    sourced: false,
    defaultOn: false,
    typicalRange: "Usually a single-figure or low double-figure dollar amount once a year. Read it off your statement.",
    verdict: "margin",
    verdictNote:
      "The processor is charging you for something the law already requires it to do. 26 U.S.C. 6050W obliges a payment settlement entity to file an information return for the payments it settles for you, and to send you a copy. The filing is not a service you commissioned, and the cost of it belongs in the price of the account.",
    negotiability: "remove",
    removal:
      "Name the statute when you ask. A fee for performing a mandatory information return is the easiest line on this list to argue about, because there is no optional service to point at in reply.",
    source:
      "No US processor I could find publishes a dollar amount for this line, so the default is zero rather than a guess. The legal obligation it purports to cover is real and is at 26 U.S.C. 6050W, returns relating to payments made in settlement of payment card and third party network transactions.",
  },
  {
    id: "network-access-fee",
    label: "Network access fee, charged as a flat monthly",
    statementLabels: ["NETWORK ACCESS FEE", "NETWORK FEE", "CARD BRAND ACCESS"],
    frequency: "monthly",
    model: "flat",
    defaultAmount: 0,
    sourced: false,
    defaultOn: false,
    typicalRange: "A flat monthly amount, distinct from the per authorization network fees below. Read it off your statement.",
    verdict: "margin",
    verdictNote:
      "Genuine network access is charged per authorization, not per month. Mastercard's Network Access and Brand Usage fee is $0.0195 an authorization on the published pass through schedule below, which on 500 transactions is $9.75, not a round monthly number. A flat monthly line borrowing the network's vocabulary is a processor fee wearing a network's name, and the giveaway is that it does not move when your transaction count does.",
    negotiability: "remove",
    removal:
      "Ask for the line to be restated per transaction against the published network schedule. If it cannot be tied to a per authorization rate, it is not a network fee, and it should come off.",
    source:
      "No US processor I could find publishes a dollar amount for a flat monthly line under this name, so the default is zero rather than a guess. The per authorization figure it is confused with is published: " +
      NC_PASS_THROUGH,
  },
  {
    id: "assessments",
    label: "Card network assessments and per authorization network fees",
    statementLabels: ["ASSESSMENT", "VISA ASSESSMENT", "MC NABU", "ACQUIRER PROCESSING FEE"],
    frequency: "monthly",
    model: "flat",
    defaultAmount: 0,
    sourced: false,
    defaultOn: false,
    typicalRange:
      "Visa 0.14% on credit and 0.13% on debit and prepaid, Mastercard 0.13%, Mastercard NABU $0.0195 an authorization, Discover 0.14%, American Express 0.165%.",
    verdict: "pass-through",
    verdictNote:
      "This is here so the page cannot be accused of calling everything junk. Assessments and interchange are set by the card networks and the issuing banks, they leave your processor and go to somebody else, and no processor can waive or discount them. They are also the largest part of your bill. If a salesperson offers to cut your interchange, that is the tell that they are not describing interchange.",
    negotiability: "fixed",
    removal:
      "Nothing to remove. What you can change is how much of it you pay: pricing model, card mix, how transactions qualify, and whether your merchant category code is right. Those are separate questions and this site has separate tools for them.",
    source: NC_PASS_THROUGH,
  },
  {
    id: "terminal-rental",
    label: "Terminal or equipment rental",
    statementLabels: ["EQUIPMENT RENTAL", "TERMINAL LEASE", "POS RENTAL", "HARDWARE FEE"],
    frequency: "monthly",
    model: "flat",
    defaultAmount: 35,
    sourced: true,
    defaultOn: true,
    typicalRange:
      "$35.00 a month to rent a Clover Flex Gen 3 on the state contract below, against $734.00 to buy the same device outright and $78.00 a month to lease it over 36 months.",
    verdict: "margin",
    verdictNote:
      "The state contract prices all three options for the same device side by side, which is rare and useful. Renting at $35.00 a month passes the $734.00 purchase price in 21 months and then keeps charging. Leasing at $78.00 a month for 36 months is $2,808 for a $734 device. A rental is at least cancellable month to month. A lease usually is not, and it is the contract this industry gets sued over.",
    negotiability: "replace",
    removal:
      "Buy the terminal. Almost every current device can be bought outright, the purchase price is public, and the break even against a rental is usually inside two years. Never sign a separate equipment lease with a leasing company: it survives the end of your processing agreement and is the one document in the pile that is genuinely hard to get out of.",
    source: NC_FISERV,
  },
  {
    id: "early-termination",
    label: "Early termination fee",
    statementLabels: ["EARLY TERMINATION FEE", "ETF", "CANCELLATION FEE", "LIQUIDATED DAMAGES"],
    frequency: "amortized",
    model: "termination",
    defaultAmount: 495,
    sourced: true,
    defaultOn: false,
    typicalRange: "$495 in the FTC action below. Some agreements instead bill liquidated damages for the rest of the term.",
    verdict: "margin",
    verdictNote:
      "You do not pay this monthly, so it does not belong in a monthly total. It belongs in the price of staying. Spread across the months left on your term it tells you what your own inertia costs a year, which is the number you need when a cheaper processor quotes you. The FTC's 2022 action alleged that First American's enrollment flow hid both the three year auto renewing term and a $495 cancellation fee.",
    negotiability: "negotiate",
    removal:
      "Get the fee, the term end date and the auto renewal notice window in writing before you do anything else, because the window is often 30 to 90 days and missing it renews you. Then price the switch against the fee: a better rate frequently repays a $495 exit inside a quarter. Plenty of processors publish that they charge no termination fee at all.",
    source:
      "Federal Trade Commission press release, FTC Takes Action to Stop Payment Processor First American from Trapping Small Businesses with Surprise Exit Fees and Zombie Charges, July 29, 2022, ftc.gov, which describes a three-year term with a $495 cancellation fee and a $4.9 million settlement. Read September 5, 2026. Processors publishing no termination fee: " +
      AUTHORIZE_NET +
      " " +
      HELCIM,
  },
];
