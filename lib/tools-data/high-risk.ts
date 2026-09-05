/**
 * High risk merchant accounts: the cost lines and the classifications
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
 * WHY THIS DATASET IS SHAPED AS RANGES RATHER THAN RATES
 * There is no rate card for high risk acceptance. Two things are genuinely
 * published and can be quoted exactly: the card networks' own program fees, and
 * the fee schedules that a handful of US high risk providers put on their own
 * websites. Everything else in a high risk quote is negotiated per account, so a
 * single number would be a fabrication. Each row below therefore carries a
 * SHAPE (what the fee is charged on) and a RANGE (what two or more named US
 * sources publish), never an invented point estimate. The widget's defaults are
 * midpoints of these published ranges, and the widget says so.
 *
 * THE ONE FIGURE CARRIED OVER RATHER THAN RE-READ
 * The Visa VAMP merchant threshold quoted in this page's copy (1.5 percent of
 * settled card-not-present transactions with a 1,500 count minimum in the same
 * month) is the value recorded in `lib/tools-data/chargebacks.ts`, read from
 * Visa's Acquirer Monitoring Program fact sheet on 4 September 2026. It was not
 * re-read for this module. Re-verify it there, not here.
 */

export interface HighRiskCostLine {
  id: string;
  label: string;
  /** What the fee is charged ON. The shape is the durable part; the range is not. */
  shape: string;
  /** What named US sources publish. A range, always, because no point estimate is honest here. */
  typicalRange: string;
  /** What the same line looks like on an ordinary low risk account, for contrast. */
  standardComparison: string;
  /** Why the cost exists. The honest version, not the outraged one. */
  why: string;
  source: string;
}

export interface HighRiskIndustry {
  id: string;
  label: string;
  /** Why an acquirer classifies it, in mechanism terms rather than reputation terms. */
  whyClassified: string;
  source: string;
}

export interface HighRiskDefaults {
  // Shared shape of the business
  monthlyVolume: number;
  averageTicket: number;
  chargebackRatePct: number;
  targetChargebackRatePct: number;

  // The high risk account
  hrRatePct: number;
  hrPerTransaction: number;
  hrMonthlyFixed: number;
  hrGatewayPerTransaction: number;
  setupFee: number;
  setupAmortizeMonths: number;
  annualRegistrationFees: number;
  specialtyVolumeBps: number;
  specialtyPerTransaction: number;
  specialtySharePct: number;
  hrChargebackFee: number;
  alertsPerMonth: number;
  alertCost: number;
  monitoringMonthlyFee: number;
  extraMids: number;

  // The reserve, priced as working capital rather than as a fee
  reservePct: number;
  reserveHoldMonths: number;
  borrowingRatePct: number;

  // The standard account the same business would have been given
  stdRatePct: number;
  stdPerTransaction: number;
  stdMonthlyFixed: number;
  stdChargebackFee: number;
}

/**
 * The widget's opening state.
 *
 * Every default is either a published figure or the MIDPOINT of a published
 * range named in `HIGH_RISK_COST_LINES`, except three which are modeling choices
 * and are labeled as such on the page: `chargebackRatePct` (an illustrative
 * input, not a published average), `setupAmortizeMonths` (how long you choose to
 * spread a one time cost over) and `specialtySharePct` (100 prices the case
 * where every network bills its specialty program fee, which is the worst case).
 *
 * The business modeled is $150,000 a month at a $75 ticket, which is 2,000
 * transactions a month. Round numbers on purpose: every figure in the page's
 * worked example has to be reproducible by hand from these.
 */
export const HIGH_RISK_DEFAULTS: HighRiskDefaults = {
  monthlyVolume: 150000,
  averageTicket: 75,
  chargebackRatePct: 1,
  targetChargebackRatePct: 0.5,

  hrRatePct: 3.95,
  hrPerTransaction: 0.25,
  hrMonthlyFixed: 80,
  hrGatewayPerTransaction: 0.1,
  setupFee: 250,
  setupAmortizeMonths: 12,
  annualRegistrationFees: 1950,
  specialtyVolumeBps: 10,
  specialtyPerTransaction: 0.02,
  specialtySharePct: 100,
  hrChargebackFee: 25,
  alertsPerMonth: 20,
  alertCost: 15,
  monitoringMonthlyFee: 0,
  extraMids: 1,

  reservePct: 10,
  reserveHoldMonths: 6,
  borrowingRatePct: 6.75,

  stdRatePct: 2.9,
  stdPerTransaction: 0.3,
  stdMonthlyFixed: 0,
  stdChargebackFee: 15,
};

/**
 * Every cost a high risk account carries that an ordinary one does not, or
 * carries at a different size.
 *
 * Ordered the way the money leaves: the rate, then the per transaction fees,
 * then the monthly fixed fees, then the annual network fees, then the one off
 * fees, then the reserve, then the dispute machinery, then the cost of running
 * more than one merchant account.
 */
export const HIGH_RISK_COST_LINES: HighRiskCostLine[] = [
  {
    id: "discount-rate",
    label: "Elevated discount rate",
    shape: "Percentage of every dollar settled",
    typicalRange: "3.00% to 6.00%, with 3.49% to 3.95% published by one provider as its own range",
    standardComparison: "2.90% flat rate, or interchange plus a margin of 0.40% to 0.50% for a low risk merchant",
    why: "The acquirer, not the card network, is financially liable when a merchant cannot fund its own chargebacks. A vertical whose customers dispute more often, or whose goods are delivered weeks after the card is charged, is a bigger unsecured credit exposure, and the discount rate is where that exposure is priced. This is the single largest line and it is also the most negotiable one, because it is the only line that is pure acquirer margin rather than a pass through.",
    source: "Range from TailoredPay, High Risk Merchant Account Fees, page dated 17 February 2026 (3% to 6% plus $0.10 to $0.50), and PaymentCloud, High Risk Merchant Account Fees, updated 18 July 2026 (3.49% to 3.95%). Standard comparison from Authorize.net published US pricing, All-in-One plan 2.9% + $0.30, and Helcim published US pricing, Interchange+ 0.40% + 8 cents in person and 0.50% + 25 cents keyed and online at the $0 to $50K tier. All four read 5 September 2026.",
  },
  {
    id: "per-transaction",
    label: "Higher per transaction fee",
    shape: "Flat cents on every authorization, whatever the ticket",
    typicalRange: "$0.10 to $0.50, with about $0.25 published by one provider",
    standardComparison: "$0.30 on a flat rate aggregator, 8 to 25 cents on published interchange plus",
    why: "Underwriting, monitoring and dispute handling cost the acquirer roughly the same on a $9 sale as on a $900 one, so part of the price is a flat charge. It is the line that decides whether a low ticket high risk business is viable at all: at a $9 average ticket a 25 cent fee is another 278 basis points on top of the percentage.",
    source: "TailoredPay, High Risk Merchant Account Fees, 17 February 2026 ($0.10 to $0.50); PaymentCloud, updated 18 July 2026 (about $0.25). Read 5 September 2026.",
  },
  {
    id: "monthly-fixed",
    label: "Monthly account, statement and PCI fees",
    shape: "Fixed dollars a month, per merchant account, whether you process or not",
    typicalRange: "$10 to $50 account, $5 to $15 statement, $10 to $30 PCI compliance, plus $15 to $50 a month if you fall out of PCI compliance",
    standardComparison: "$0 on a flat rate aggregator, which bundles all of it into the percentage",
    why: "These are the fees a flat rate aggregator hides inside its headline percentage and a traditional merchant account itemizes. They are not high risk specific in kind, only in number, and they are the reason a small high risk merchant can pay a double digit effective rate: on $5,000 a month of volume, $80 of fixed fees is another 160 basis points before a single percentage point of discount rate.",
    source: "PaymentCloud, updated 18 July 2026 (base monthly account fee $10 to $50, with PCI, gateway and statement fees stacking on top and often adding another $25 to $60, a flat monthly account upkeep charge of $10 to $25, and a PCI non compliance fee of $15 to $50 a month until resolved); TailoredPay, 17 February 2026 ($15 to $50 monthly, $5 to $15 statement, $10 to $30 PCI, $0.10 to $0.30 per daily batch). Both read 5 September 2026.",
  },
  {
    id: "gateway",
    label: "Gateway fee",
    shape: "Fixed dollars a month plus cents per transaction, sometimes plus a daily batch fee",
    typicalRange: "$10 to $30 a month plus $0.05 to $0.15 per transaction",
    standardComparison: "Authorize.net publishes $25 a month plus 10 cents per transaction plus a 10 cent daily batch fee on its Gateway Only plan, with no setup fee",
    why: "A high risk merchant account is almost never sold with a bundled checkout, so the gateway is a separate contract with a separate bill. The published low risk gateway price and the high risk one are close, which is worth knowing: this is a line where being classified high risk should not cost you extra, and if it does, ask why.",
    source: "PaymentCloud, updated 18 July 2026 ($10 to $30 a month plus $0.05 to $0.15 per transaction). Authorize.net sign-up pricing page, read 5 September 2026.",
  },
  {
    id: "setup",
    label: "Setup or application fee",
    shape: "One time, per merchant account opened",
    typicalRange: "$0 to $500",
    standardComparison: "$0 at every flat rate aggregator and at both published interchange plus providers checked here",
    why: "High risk underwriting is manual. Somebody reads your website, your processing history, your refund policy and your personal credit file, and in the Visa and Mastercard registered categories the acquirer also has to file a registration and, in Visa's tiers 1 and 2, sit a control assessment. A setup fee that buys real underwriting is defensible. A setup fee on an account that is then declined is not, so ask whether it is refundable before you pay it.",
    source: "TailoredPay, 17 February 2026 ($0 to $500 one time). PaymentCloud states it charges no startup fee, updated 18 July 2026. Visa Ecosystem Risk Programs Guide, October 2024, section AHIR.C1.1, requires acquirers applying for High Integrity Risk registration to submit a one time, non refundable application fee and, for tiers 1 and 2, undergo control assessments. Read 5 September 2026.",
  },
  {
    id: "registration",
    label: "Card brand registration fees",
    shape: "Annual, per merchant, per card brand, per merchant account",
    typicalRange: "Visa $950 a year. Mastercard $1,000 a year from 1 May 2026, doubled from $500.",
    standardComparison: "$0. A merchant outside the registered categories is never registered and never billed either fee.",
    why: "This is not your acquirer marking you up. Visa and Mastercard charge the acquirer a registration fee for every merchant it boards in a designated category, and the acquirer passes it through. It is the cleanest evidence that the classification itself has a price: two identical businesses, one in a registered MCC and one not, differ by nearly $2,000 a year before anybody discusses a rate.",
    source: "Mastercard bulletin AP/LAC/MEA/US 12568.1, New and Updated Specialty Merchant Registration Program Fees, published 28 October 2025, effective 1 May 2026: Specialty Merchant Registration Program fee USD 1,000, annual per merchant registration. Visa figure of $950 annually from Helcim's published high risk merchant program fee documentation and from Corepay, Visa Integrity Risk Program, updated 20 May 2026, which also states the increase from $500 to $950 took effect 1 April 2024. Note that Helcim's page still shows the Mastercard fee at $500, which the Mastercard bulletin superseded on 1 May 2026. All read 5 September 2026.",
  },
  {
    id: "specialty-transaction",
    label: "Network specialty program transaction and volume fees",
    shape: "Cents per transaction plus basis points on volume, billed weekly to the acquirer",
    typicalRange: "Mastercard: USD 0.02 per transaction and 10 basis points of volume, effective 3 June 2026, first billed 14 June 2026. Corepay reports a comparable 10 cents plus ten basis points under Visa's program.",
    standardComparison: "$0 and 0 basis points. These fees attach to transactions carrying a specialty merchant transaction type identifier.",
    why: "New in 2026, and most published high risk cost guides predate them entirely. Mastercard applies them to purchase transactions carrying a Transaction Type Identifier of P70 or P76 for cryptocurrency, P71 for high risk securities, and P72 for all other specialty merchant categories. Ten basis points sounds trivial until you annualize it: on $1.8 million of yearly volume it is $1,800 that did not exist in 2025.",
    source: "Mastercard bulletin AP/LAC/MEA/US 12568.1, published 28 October 2025: Specialty Merchant Transaction Fee USD 0.02 weekly per transaction, Specialty Merchant Volume Fee 10 bps weekly per transaction, both GCMS and MDS. Visa figure from Corepay, Visa Integrity Risk Program, updated 20 May 2026, a US high risk acquirer, attributed rather than primary because Visa does not publish its VIRP fee schedule. Read 5 September 2026.",
  },
  {
    id: "acquirer-license",
    label: "High risk acquirer license fee",
    shape: "Annual, billed to the acquirer, not to you",
    typicalRange: "USD 50,000 a year from 1 May 2026, recovered across the acquirer's whole high risk book",
    standardComparison: "$0. An acquirer that boards no specialty merchants needs no supplemental license.",
    why: "Included here because it explains a price you cannot see on your statement. Mastercard now charges every acquirer that registers specialty merchants a $50,000 annual license, and grants it automatically to acquirers already in the business, who are still billed. That cost is spread across the high risk merchants on the book. It is also a barrier to entry, which is the real reason high risk pricing does not compete itself down to low risk pricing.",
    source: "Mastercard bulletin AP/LAC/MEA/US 12568.1, published 28 October 2025: High-Risk Acquirer License Fee, service ID MA, USD 50,000 annual, effective 1 May 2026, with automatic supplemental licenses for existing acquirers who are still billed. Read 5 September 2026.",
  },
  {
    id: "reserve",
    label: "Rolling reserve",
    shape: "Not a fee. A percentage of every batch withheld and released after a fixed hold, so the cash is yours but not available",
    typicalRange: "5% to 15% withheld, held 90 to 180 days",
    standardComparison: "Usually none, though any processor can impose one. Several US processors advertise no rolling reserve as a feature.",
    why: "The reserve is collateral against disputes the acquirer would otherwise have to fund itself, and Visa's rules explicitly permit an acquirer to deduct merchant reserve funds from settlement. Under constant volume it is not a cost that is paid and gone: it is a permanent working capital hole of monthly volume times the reserve percentage times the hold in months, and it grows as you grow. Price it at what borrowing that money costs you, not at the interest you are not earning on it.",
    source: "PaymentCloud, updated 18 July 2026 (5% to 10% of processing volume, 90 to 180 days, higher risk accounts 15% or more); TailoredPay, 17 February 2026 (5% to 10%, 90 to 180 days); Corepay publishes 5% to 15% at 90 to 180 days. Permission to withhold from settlement is primary: the Visa Core Rules and Visa Product and Service Rules effective 18 April 2026 require an Acquirer to pay its Merchant promptly after Transaction Deposit, in the Transaction totals less credits, applicable discounts, Disputes, other agreed fees or Merchant reserve funds accumulated to guarantee the Merchant's payment system obligations to the Acquirer. The Visa Ecosystem Risk Programs Guide, October 2024, adds that acquirers settle within market based timelines provided there are no mandated holding periods, naming Future Service Merchants as the example, and retain settlements to offset disputes or losses. All read 5 September 2026.",
  },
  {
    id: "chargeback-fee",
    label: "Chargeback fee",
    shape: "Flat dollars for every dispute received, win or lose",
    typicalRange: "$15 to $35 per dispute, with about $20 published by one provider",
    standardComparison: "$15 on Stripe and Braintree, $20 on PayPal, $0 on Square and on Authorize.net card disputes, and $15 on Helcim only if the case is lost",
    why: "The fee itself is small money. It matters because it is charged on disputes you win as well as disputes you lose, so a merchant with a 1 percent dispute rate pays it 240 times a year on 24,000 transactions whatever the outcomes are. The larger cost of a dispute, the goods, the fulfillment and the reversed revenue, is a different calculation and this site models it separately.",
    source: "TailoredPay, 17 February 2026 ($15 to $35); PaymentCloud, updated 18 July 2026 (around $20). Low risk comparisons from this site's own processor chargeback fee dataset, and from Helcim's published US pricing page and Authorize.net's sign-up pricing page, both read 5 September 2026.",
  },
  {
    id: "alerts",
    label: "Chargeback prevention alerts",
    shape: "Per alert, pay as you go, on top of whatever you refund to resolve the case",
    typicalRange: "$15 per Visa RDR alert, $15 per Verifi CDRN alert, $29 per Ethoca alert, from one vendor publishing rates openly",
    standardComparison: "Optional for anyone, but a low risk merchant rarely buys them and is rarely required to",
    why: "An alert lets you refund a transaction before it becomes a chargeback, which keeps it out of your dispute ratio and out of a monitoring program. High risk acquirers frequently require enrollment as a condition of boarding. The economics are not automatic: you pay the alert fee and you refund the sale, so an alert only pays for itself where the chargeback fee plus the ratio damage exceeds the alert fee plus the refunds you would not otherwise have given.",
    source: "Chargeback.io published pricing page, read 5 September 2026: $29 per Ethoca alert, $15 per Visa RDR alert, $15 per Verifi CDRN alert, with no monthly fee, no setup fee and no minimum. Vendors that do not publish were not estimated.",
  },
  {
    id: "monitoring",
    label: "Chargeback monitoring or mitigation platform",
    shape: "Usually a monthly platform fee, sometimes a share of recovered funds",
    typicalRange: "Not reliably published. The vendors that publish anything publish per alert pricing, not platform pricing.",
    standardComparison: "Not typically required",
    why: "This line is in the calculator as an input rather than as a default because no defensible number exists to default it to. Treat any monthly platform fee as a quote to get in writing, and price it against the alert fees above, which are the one part of this market with a public price.",
    source: "No published US figure verified. Left as a user input rather than estimated, checked 5 September 2026.",
  },
  {
    id: "termination",
    label: "Early termination fee",
    shape: "One time on exit, or the remaining value of the contract term",
    typicalRange: "$250 to $1,000, or the remaining contract value",
    standardComparison: "$0 at flat rate aggregators and at the published interchange plus providers checked here, which are month to month",
    why: "The reason a bad high risk quote is expensive twice. It converts a rate you can walk away from into a rate you cannot, which is exactly why the term length matters more on a high risk contract than on any other kind. It is not in the annual cost model below, because it is a cost of leaving rather than a cost of processing, but it belongs in the decision.",
    source: "TailoredPay, High Risk Merchant Account Fees, 17 February 2026 ($250 to $1,000 or the remaining contract value). Read 5 September 2026.",
  },
  {
    id: "extra-mid",
    label: "A second merchant account",
    shape: "Duplicates the monthly fixed fees, the gateway fee, the registration fees and the setup fee, per account",
    typicalRange: "No published figure exists for the count of accounts. The cost is the duplication itself, which the calculator computes from the lines above.",
    standardComparison: "One account, and no reason to want a second",
    why: "Redundancy is a real operational need for a business that can lose an account with thirty days notice, and running a backup MID at a second acquirer is a legitimate response to that. What it costs is every fixed and annual line billed twice. What it must not be used for is splitting volume so that neither account's dispute ratio reaches a monitoring threshold, which is a different thing entirely and is dealt with on this page.",
    source: "Computed by this page from the published fixed, gateway, registration and setup lines above rather than sourced, checked 5 September 2026.",
  },
];

/**
 * Why a business gets classified, in mechanism terms.
 *
 * There is no industry standard list, and the pages that publish one usually
 * publish somebody's marketing copy. The two lists that actually bind are the
 * card networks' own: Visa's High Integrity Risk categories, which drive VIRP
 * registration, and Mastercard's Specialty Merchant categories, which now drive
 * a registration fee, a transaction fee and a volume fee. Where a vertical is
 * widely underwritten as high risk but appears on neither list, that is said
 * here rather than papered over.
 */
export const HIGH_RISK_INDUSTRIES: HighRiskIndustry[] = [
  {
    id: "gambling",
    label: "Online gambling and skill based wagering",
    whyClassified:
      "Named by both networks. Visa designates MCC 7995 as high integrity risk for all card absent transactions and adds 5816, skilled game wagering such as daily fantasy sports, for certain card absent transactions. Legality varies by US state, which is the actual risk: the acquirer, not the merchant, answers for a transaction that was illegal where the cardholder sat.",
    source: "Visa Merchant Data Standards Manual, April 2026 edition, high integrity risk MCC list, as recorded in this site's MCC dataset. Read 5 September 2026.",
  },
  {
    id: "crypto",
    label: "Cryptocurrency exchanges, wallets and on ramps",
    whyClassified:
      "Visa lists MCC 6051 and 6012 for crypto exchanges, wallets and on ramps under certain card absent transactions. Mastercard goes further and tags the transactions themselves: purchases carrying a Transaction Type Identifier of P70 or P76 are cryptocurrency transactions and attract the specialty merchant transaction and volume fees. The underlying risk is irreversibility, since the goods cannot be recovered when the card payment is reversed.",
    source: "Visa Merchant Data Standards Manual, April 2026, as recorded in this site's MCC dataset. Mastercard bulletin AP/LAC/MEA/US 12568.1, 28 October 2025, TTI P70 and P76. Read 5 September 2026.",
  },
  {
    id: "securities",
    label: "High risk securities and trading platforms",
    whyClassified:
      "Visa lists MCC 6211, financial trading platforms, for certain card absent transactions. Mastercard assigns these transactions a Transaction Type Identifier of P71 and bills the specialty merchant fees on them. A funded trading account is cash out the door with no deliverable to point at in a dispute.",
    source: "Visa Merchant Data Standards Manual, April 2026, as recorded in this site's MCC dataset. Mastercard bulletin AP/LAC/MEA/US 12568.1, 28 October 2025, TTI P71. Read 5 September 2026.",
  },
  {
    id: "pharma",
    label: "Pharmacy, telehealth and weight loss",
    whyClassified:
      "Visa designates MCC 5122 and 5912 as high integrity risk for all card absent transactions. Registration can be volume triggered rather than automatic: Helcim publishes a threshold of 25 percent of Visa volume, or 50 percent of Mastercard volume, before the annual registration fee applies to a pharmacy, and notes that Visa may waive its fee with specific certifications while Mastercard does not.",
    source: "Visa Merchant Data Standards Manual, April 2026, as recorded in this site's MCC dataset. Helcim published high risk merchant program fee documentation, read 5 September 2026.",
  },
  {
    id: "tobacco",
    label: "Tobacco, vape and nicotine",
    whyClassified:
      "Visa designates MCC 5993 as high integrity risk for all card absent transactions. Helcim publishes an unusually low registration trigger here, 0.01 percent of Visa volume against 50 percent of Mastercard volume, so a business selling almost no tobacco online can still land in Visa's registered population.",
    source: "Visa Merchant Data Standards Manual, April 2026, as recorded in this site's MCC dataset. Helcim published high risk merchant program fee documentation, read 5 September 2026.",
  },
  {
    id: "adult",
    label: "Adult content and dating",
    whyClassified:
      "Visa designates MCC 5967, direct marketing inbound teleservices, and 7273, dating and escort services, as high integrity risk for all card absent transactions. Both carry a documented friendly fraud problem: the disputed transaction is one the cardholder would rather not explain, which is the highest represented dispute category there is.",
    source: "Visa Merchant Data Standards Manual, April 2026, as recorded in this site's MCC dataset. Read 5 September 2026.",
  },
  {
    id: "negative-option",
    label: "Subscriptions and negative option billing",
    whyClassified:
      "Visa lists MCC 5968, negative option subscriptions, for certain card absent transactions. The mechanism is structural rather than moral: a recurring charge that the cardholder did not consciously approve this month is the easiest possible dispute to win, and free trials that convert to paid billing generate them at scale.",
    source: "Visa Merchant Data Standards Manual, April 2026, as recorded in this site's MCC dataset. Read 5 September 2026.",
  },
  {
    id: "supplements",
    label: "Nutraceuticals, supplements and CBD",
    whyClassified:
      "The important case, because it has no merchant category code of its own. These businesses are filed under 5499 or the catch all 5999, neither of which Visa flags, and they are still routinely declined by mainstream aggregators. The classification comes from underwriting reading the website, not from four digits, which is why a bland MCC does not get a genuinely restricted business boarded.",
    source: "Absence of a dedicated MCC verified against the Visa Merchant Data Standards Manual, April 2026, as recorded in this site's MCC dataset. Stripe's published restricted businesses list, last updated 13 May 2026, as recorded in the same dataset. Read 5 September 2026.",
  },
  {
    id: "future-service",
    label: "Travel, ticketing and anything delivered later",
    whyClassified:
      "Not on either network's high risk list, and still underwritten as high risk everywhere. The reason is the dispute tail rather than the dispute rate: the standard Visa dispute time limit runs 120 calendar days from the transaction processing date, and delayed delivery conditions stretch it as far as 540 days, so an acquirer carries the liability for a cruise long after it has paid the merchant. Visa's rules contemplate mandated holding periods for future service merchants specifically.",
    source: "Visa dispute time limits of 120 calendar days from the processing date, with delayed delivery conditions reaching 540, as recorded on this site's rolling reserve calculator from the Visa Core Rules and Visa Product and Service Rules effective 18 April 2026. Mandated holding periods for Future Service Merchants are named verbatim in the Visa Ecosystem Risk Programs Guide, October 2024, which says acquirers settle within market based timelines provided there are no mandated holding periods, giving Future Service Merchants as the example. Read 5 September 2026.",
  },
  {
    id: "restricted-services",
    label: "Debt collection, credit repair, bail bonds and telemarketing",
    whyClassified:
      "Visa designates MCC 5966, outbound telemarketing, as high integrity risk for all card absent transactions, and Stripe's published restricted businesses list names debt collection, bail bonds, credit repair and counseling, door to door sales and telemarketing among the businesses it prohibits or restricts. These verticals sell to customers already in financial distress, which correlates directly with disputes and with the merchant's own ability to fund them.",
    source: "Visa Merchant Data Standards Manual, April 2026, and Stripe's restricted businesses list last updated 13 May 2026, both as recorded in this site's MCC dataset. Read 5 September 2026.",
  },
];
