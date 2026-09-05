/**
 * US interchange rate programs
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
 * import from `lib/tools-data/index.ts` inside a `"use client"` module. This
 * table is the largest dataset in the directory, so it is passed to the widget
 * as a PROP from `ToolWidget` rather than imported by the client component.
 *
 * ─── Where every number came from ────────────────────────────────────────────
 * Two documents, both published by the network itself, both current at the time
 * of writing. Nothing here is transcribed from a blog, a processor's summary or
 * another calculator, because those are the pages this one exists to replace.
 *
 *   Visa        `VISA_SOURCE` below. Read directly off usa.visa.com.
 *   Mastercard  `MASTERCARD_SOURCE` below. mastercard.com refuses this machine
 *               (HTTP 403), so the PDF was read from an Internet Archive capture
 *               of the same URL and the CAPTURE date is recorded.
 *
 * ─── Why there are no Discover rows ──────────────────────────────────────────
 * Discover does not publish its US schedule. Its acquirer interchange page gates
 * the US rates behind a verification code issued by your acquirer, and the
 * confidentiality notice on that page states the fee information may not be
 * disclosed to any third party. Visa and Mastercard publish theirs as public
 * PDFs. So the honest table is a two network table, and any page showing a
 * Discover US interchange schedule is republishing a document its holder was
 * told not to republish. Do not add Discover rows from a secondary source.
 *
 * ─── One row per program, at the base consumer card tier ─────────────────────
 * Both networks price a program across several card products: Visa runs six
 * columns (Infinite Spend Qualified, Infinite Spend Not Qualified, Signature
 * Preferred, Signature, Traditional Rewards, All Other Products) and Mastercard
 * five (Core, Enhanced Value, World, World High Value, World Elite). Emitting
 * every cell would be roughly 1,100 rows of near duplicates and would make the
 * table unusable. Each row therefore carries ONE rate, at the tier named in
 * `cardType`, and `notes` carries the premium tiers for the same program. The
 * tier chosen is the mainstream one: Traditional Rewards for Visa consumer
 * credit, Core for Mastercard consumer credit. `notes` is where the spread
 * lives, and the page copy says so.
 *
 * ─── This expires on a published schedule ────────────────────────────────────
 * Both networks revise in April and October. The April 2026 editions are the
 * current ones; the October 2026 revisions land inside this dataset's life.
 * Re-read both PDFs each April and each October, replace the rows, and move the
 * checked dates. Separately, the November 2025 MDL 1720 settlement reduces the
 * US combined average effective credit interchange rate by 10 basis points for
 * five years and caps standard US consumer credit at 125 basis points, which
 * will change these numbers once it takes effect. Do not pre-apply it here.
 */

/** Where the sheet states the acceptance channel. "Any" means the sheet does not. */
export type InterchangeChannel = "Card present" | "Card not present" | "Any";

export interface InterchangeRate {
  /** Stable, unique, slug shaped. Used as the React key and the search anchor. */
  id: string;
  network: string;
  /** The program name exactly as the network prints it. */
  programName: string;
  /** The card product the rate applies to, because one program has several rates. */
  cardType: string;
  channel: InterchangeChannel;
  /** Editorial grouping for the filter. Not a network classification, see below. */
  category: string;
  /** Percentage component, as a percentage. 1.51 means 1.51%. */
  ratePct: number;
  /** Fixed component in US dollars. */
  fixed: number;
  /** Maximum total interchange on one transaction, where the sheet prints a cap. */
  cap?: number;
  /**
   * Minimum total interchange, where the sheet prints "(min. $0.04)".
   *
   * A minimum is NOT a fixed fee and the two must not be added. Visa's
   * Restaurant program is "2.10% (min. $0.04)": on a $10 check that is 21 cents,
   * not 25 cents. Getting this wrong overstates small tickets by the minimum on
   * every single one of them.
   */
  min?: number;
  notes: string;
  /** Publisher, document, effective date and the date this row was checked. */
  source: string;
}

export interface InterchangeDefaults {
  amount: number;
  network: string;
  category: string;
  channel: string;
  query: string;
  /** How many matching rows the widget renders before asking the user to narrow. */
  maxRows: number;
}

/**
 * Widget default state, kept here so the defaults are data rather than magic
 * strings in the component. $50.00 is deliberate: it is close to the $46.32
 * average US debit ticket the Federal Reserve reported for 2024, and it is small
 * enough that the fixed component still visibly matters.
 */
export const INTERCHANGE_DEFAULTS: InterchangeDefaults = {
  amount: 50,
  network: "all",
  category: "all",
  channel: "all",
  query: "",
  maxRows: 60,
};

const VISA_SOURCE =
  "Visa, Visa USA Interchange Reimbursement Fees (Visa Supplemental Requirements), rates effective April 18, 2026, usa.visa.com, checked September 5, 2026";

const MASTERCARD_SOURCE =
  "Mastercard, Mastercard 2026 to 2027 U.S. Region Interchange Programs and Rates, effective April 17, 2026, mastercard.com, read from the Internet Archive capture of June 16, 2026, checked September 5, 2026";

const REG_II_SOURCE =
  "Federal Reserve Board, Regulation II, 12 CFR 235.3(b) and 235.4, eCFR, checked September 5, 2026; rate as printed in the network sheets above";

export const INTERCHANGE_NETWORKS: string[] = ["Visa", "Mastercard"];

/**
 * Editorial groupings, chosen so a merchant can find their own business.
 *
 * NOT a network classification. Visa organises its sheet by card product and
 * acceptance channel, Mastercard by program name in alphabetical order, and
 * neither groups by industry. The filter exists because "which of these 196 rows
 * is mine" is the question the page is answering.
 */
export const INTERCHANGE_CATEGORIES: string[] = [
  "Retail and general",
  "Supermarket and grocery",
  "Restaurant and bar",
  "Fuel and convenience",
  "Travel, lodging and transport",
  "Ecommerce and keyed",
  "Recurring and subscription",
  "Utilities and bill payment",
  "Healthcare, education and insurance",
  "Real estate and lending",
  "Charity and public sector",
  "Small ticket and micropayment",
  "Regulated debit",
  "Commercial and business cards",
  "Downgrades and unqualified",
];

interface RawRate {
  programName: string;
  cardType: string;
  channel: InterchangeChannel;
  category: string;
  ratePct: number;
  fixed: number;
  cap?: number;
  min?: number;
  notes: string;
  /** Overrides the network default where a row is sourced somewhere else too. */
  source?: string;
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const finish = (network: string, defaultSource: string) => (r: RawRate): InterchangeRate => ({
  id: `${slug(network)}-${slug(r.programName)}-${slug(r.cardType)}`,
  network,
  programName: r.programName,
  cardType: r.cardType,
  channel: r.channel,
  category: r.category,
  ratePct: r.ratePct,
  fixed: r.fixed,
  ...(r.cap === undefined ? {} : { cap: r.cap }),
  ...(r.min === undefined ? {} : { min: r.min }),
  notes: r.notes,
  source: r.source ?? defaultSource,
});

// ---------------------------------------------------------------------------
// Visa
// ---------------------------------------------------------------------------

const VISA_RAW: RawRate[] = [
  // --- Table A, consumer check card, exempt, card present --------------------
  {
    programName: "CPS/Supermarket, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 0,
    fixed: 0.3,
    notes:
      "A flat 30 cents whatever the basket is worth. There is no percentage component at all, which is why a large grocery basket on an exempt debit card is the cheapest card transaction in the US schedule.",
  },
  {
    programName: "CPS/Retail, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 0.8,
    fixed: 0.15,
    notes: "The default card present debit program for an ordinary retailer that is not a supermarket, restaurant or fuel merchant.",
  },
  {
    programName: "CPS/Automated Fuel Dispenser (AFD), Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Fuel and convenience",
    ratePct: 0.8,
    fixed: 0.15,
    cap: 0.95,
    notes: "Capped at 95 cents, so a large fill costs the same as a $100 fill.",
  },
  {
    programName: "CPS/Service Station, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Fuel and convenience",
    ratePct: 0.8,
    fixed: 0.15,
    cap: 0.95,
    notes: "The attended equivalent of the AFD program, same rate and same 95 cent cap.",
  },
  {
    programName: "CPS/Small Ticket, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Small ticket and micropayment",
    ratePct: 1.55,
    fixed: 0.04,
    notes: "Visa notes that the small ticket rate on PIN authenticated Visa Debit applies only to Visa Network 002 transactions.",
  },
  {
    programName: "CPS/Restaurant, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Restaurant and bar",
    ratePct: 1.19,
    fixed: 0.1,
    notes: "Applies to the settled amount, which includes the tip, not to the food and beverage total.",
  },
  {
    programName: "CPS/Hotel and Car Rental Card Present, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Travel, lodging and transport",
    ratePct: 1.19,
    fixed: 0.1,
    notes: "Requires the card present lodging or vehicle rental data set, including check in and check out dates.",
  },
  {
    programName: "CPS/Passenger Transport Card Present, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Travel, lodging and transport",
    ratePct: 1.19,
    fixed: 0.1,
    notes: "Airlines, rail and other passenger carriers accepting in person.",
  },
  {
    programName: "Travel Service, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Travel, lodging and transport",
    ratePct: 1.19,
    fixed: 0.1,
    notes: "Travel agents and tour operators taking the card in person.",
  },
  {
    programName: "CPS/Retail Key Entry, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Ecommerce and keyed",
    ratePct: 1.65,
    fixed: 0.15,
    notes:
      "Typing the number in rather than dipping or tapping costs 85 basis points more than CPS/Retail on the same card. Visa notes this program is not applicable to PIN authenticated transactions.",
  },

  // --- Table A, consumer check card, exempt, card not present ----------------
  {
    programName: "CPS/Retail 2 Card Not Present, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 0.65,
    fixed: 0.15,
    cap: 2,
    notes: "One of the cheapest card not present debit programs in the sheet, and capped at $2.00.",
  },
  {
    programName: "CPS/Debt Repayment 2",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Real estate and lending",
    ratePct: 0.65,
    fixed: 0.15,
    cap: 2,
    notes: "Payments against an existing consumer debt, capped at $2.00.",
  },
  {
    programName: "CPS/Debt Repayment (No Fee)",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Real estate and lending",
    ratePct: 0.65,
    fixed: 0.15,
    cap: 0.65,
    notes: "The variant where the merchant charges the cardholder no convenience fee. The cap drops to 65 cents.",
  },
  {
    programName: "CPS/Utility Recurring Bill Payment, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Utilities and bill payment",
    ratePct: 0,
    fixed: 0.45,
    notes: "A flat 45 cents. No percentage at all, which is why a utility can accept a $400 bill on debit for pennies.",
  },
  {
    programName: "CPS/Utility, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Utilities and bill payment",
    ratePct: 0,
    fixed: 0.65,
    notes: "A flat 65 cents for a one off utility payment rather than an enrolled recurring one.",
  },
  {
    programName: "CPS/Government",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Charity and public sector",
    ratePct: 0.65,
    fixed: 0.15,
    cap: 2,
    notes: "Restricted to government merchant category codes and capped at $2.00.",
  },
  {
    programName: "Consumer Bill Payment Service, Consumer Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Utilities and bill payment",
    ratePct: 1.65,
    fixed: 0.15,
    notes: "The generic bill payment program, materially worse than the utility specific ones above.",
  },
  {
    programName: "CPS/Card Not Present, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.65,
    fixed: 0.15,
    notes: "The general card not present debit program where no better one applies.",
  },
  {
    programName: "CPS/e-Commerce Basic, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.65,
    fixed: 0.15,
    notes: "Online sales that do not meet the Preferred data requirements.",
  },
  {
    programName: "CPS/e-Commerce Preferred Retail, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.6,
    fixed: 0.15,
    notes: "Five basis points cheaper than e-Commerce Basic for meeting the Preferred requirements. The gap is small on debit and much larger on credit.",
  },
  {
    programName: "CPS/e-Commerce Preferred Hotel and Car Rental, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Travel, lodging and transport",
    ratePct: 1.7,
    fixed: 0.15,
    notes: "Online lodging and vehicle rental bookings meeting the Preferred data requirements.",
  },
  {
    programName: "CPS/e-Commerce Preferred Passenger Transport, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Travel, lodging and transport",
    ratePct: 1.7,
    fixed: 0.15,
    notes: "Online ticketing for airlines, rail and other carriers.",
  },
  {
    programName: "CPS/Hotel and Car Rental Card Not Present, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Travel, lodging and transport",
    ratePct: 1.7,
    fixed: 0.15,
    notes: "51 basis points more than the card present version of the same booking.",
  },
  {
    programName: "CPS/Passenger Transport Card Not Present, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Travel, lodging and transport",
    ratePct: 1.7,
    fixed: 0.15,
    notes: "Phone and remote ticket sales for passenger carriers.",
  },
  {
    programName: "CPS/Account Funding, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Real estate and lending",
    ratePct: 1.75,
    fixed: 0.2,
    notes: "Loading a card, wallet or brokerage account. Priced above ordinary ecommerce because the funds leave the card system.",
  },
  {
    programName: "Electronic Interchange Reimbursement Fee (EIRF), Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Downgrades and unqualified",
    ratePct: 1.75,
    fixed: 0.2,
    notes:
      "A downgrade, not a program you apply for. A transaction lands here when it was authorised electronically but missed a CPS requirement. Visa notes EIRF transactions from AFDs and service stations are eligible for a 95 cent cap.",
  },
  {
    programName: "Standard Interchange Reimbursement Fee, Debit",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Downgrades and unqualified",
    ratePct: 1.9,
    fixed: 0.25,
    notes: "The worst debit outcome. Where a transaction lands when it was not authorised properly or was settled outside the required window.",
  },

  // --- Regulated debit, Table A and B ---------------------------------------
  {
    programName: "Regulated Visa Check Card",
    cardType: "Consumer debit or prepaid, covered issuer",
    channel: "Any",
    category: "Regulated debit",
    ratePct: 0.05,
    fixed: 0.21,
    notes:
      "The Durbin cap. Applies to debit and prepaid cards issued by a bank holding $10 billion or more in assets, and it is a formula in Regulation II rather than a Visa pricing decision: 21 cents plus 5 basis points of the transaction value. Same number on Visa, Mastercard and every other network. Supermarket, restaurant, fuel and ecommerce all pay it identically.",
    source: REG_II_SOURCE,
  },
  {
    programName: "Regulated Visa Check Card with fraud prevention adjustment",
    cardType: "Consumer debit or prepaid, covered issuer",
    channel: "Any",
    category: "Regulated debit",
    ratePct: 0.05,
    fixed: 0.22,
    notes:
      "Visa's sheet marks the regulated rate with an asterisk: issuers that certify compliance with the fraud prevention standards receive an additional 1 cent. Regulation II 235.4 permits an adjustment of no more than 1 cent per transaction. Effectively every covered issuer certifies, so 22 cents plus 5 basis points is the number you actually see on a statement.",
    source: REG_II_SOURCE,
  },

  // --- Table B, consumer prepaid, exempt, card present -----------------------
  {
    programName: "CPS/Supermarket, Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.15,
    fixed: 0.15,
    cap: 0.35,
    notes: "Capped at 35 cents, so it behaves like a flat fee above about a $17 basket.",
  },
  {
    programName: "CPS/Retail, Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.15,
    fixed: 0.15,
    notes: "Uncapped, unlike the supermarket version, so a large prepaid purchase in a shop costs materially more than the same purchase on exempt debit.",
  },
  {
    programName: "CPS/Automated Fuel Dispenser (AFD), Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Fuel and convenience",
    ratePct: 1.15,
    fixed: 0.15,
    cap: 0.95,
    notes: "Same 95 cent cap as the debit version.",
  },
  {
    programName: "CPS/Service Station, Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Fuel and convenience",
    ratePct: 1.15,
    fixed: 0.15,
    cap: 0.95,
    notes: "Attended fuel sales on a prepaid card, capped at 95 cents.",
  },
  {
    programName: "CPS/Small Ticket, Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Small ticket and micropayment",
    ratePct: 1.6,
    fixed: 0.05,
    notes: "Visa notes the small ticket rate on PIN authenticated Visa Prepaid applies only to Visa Network 002.",
  },
  {
    programName: "CPS/Hotel and Car Rental Card Present, Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Travel, lodging and transport",
    ratePct: 1.15,
    fixed: 0.15,
    notes: "Lodging and vehicle rental taken in person on a prepaid card.",
  },
  {
    programName: "CPS/Restaurant, Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Restaurant and bar",
    ratePct: 1.15,
    fixed: 0.15,
    notes: "Four basis points cheaper than the debit restaurant program on the percentage, and five cents more on the fixed component.",
  },
  {
    programName: "CPS/Passenger Transport Card Present, Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Travel, lodging and transport",
    ratePct: 1.15,
    fixed: 0.15,
    notes: "In person ticketing on a prepaid card.",
  },
  {
    programName: "Travel Service, Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Travel, lodging and transport",
    ratePct: 1.15,
    fixed: 0.15,
    notes: "Travel agents and tour operators taking a prepaid card in person.",
  },
  {
    programName: "CPS/Retail Key Entry, Prepaid",
    cardType: "Consumer prepaid, exempt issuer",
    channel: "Card present",
    category: "Ecommerce and keyed",
    ratePct: 1.75,
    fixed: 0.2,
    notes: "Keying a prepaid card costs 60 basis points and a nickel more than swiping it. Visa notes the program is not applicable to PIN authenticated transactions.",
  },

  // --- Table C, consumer credit, card present, Traditional Rewards column ----
  {
    programName: "Supermarket Credit Tier 0",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.18,
    fixed: 0.05,
    notes:
      "Tier 0 needs 525.0 million transactions and $27.60 billion of volume in the qualifying year, so this is a national grocery chain rate. Visa Signature 1.55% + $0.05, Signature Preferred and Infinite Spend Qualified 1.65% + $0.05.",
  },
  {
    programName: "Supermarket Credit Tier I",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.2,
    fixed: 0.05,
    notes: "Requires 188.0 million transactions and $15.00 billion of volume. Visa Signature 1.55% + $0.05, Signature Preferred 1.65% + $0.05.",
  },
  {
    programName: "Supermarket Credit Tier II",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.22,
    fixed: 0.05,
    notes: "Requires 102.6 million transactions and $5.90 billion of volume. Visa Signature 1.55% + $0.05, Signature Preferred 1.65% + $0.05.",
  },
  {
    programName: "Supermarket Credit Tier III",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.22,
    fixed: 0.05,
    notes: "The lowest supermarket tier, and still 23.4 million transactions and $1.35 billion of volume. Visa Signature 1.60% + $0.05, Signature Preferred 1.75% + $0.05.",
  },
  {
    programName: "Supermarket Credit All Other",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.5,
    fixed: 0.07,
    notes:
      "Where every ordinary grocer lands, because the four tiers above are gated on national scale. 28 basis points and two cents worse than Tier III for the same basket. Visa Signature 1.65% + $0.07, Signature Preferred and Infinite Spend Qualified 2.00% + $0.07.",
  },
  {
    programName: "Retail Credit Performance Threshold I",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.43,
    fixed: 0.1,
    notes:
      "Requires 133.4 million transactions, $8.83 billion of volume, a dispute financials ratio of 0.020% or better, and PCI compliance. Visa Signature 1.65% + $0.10, Signature Preferred 2.10% + $0.10, Infinite Spend Qualified 2.30% + $0.10.",
  },
  {
    programName: "Retail Credit Performance Threshold II",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.47,
    fixed: 0.1,
    notes: "Requires 86.3 million transactions and $4.73 billion of volume. Visa Signature 1.65% + $0.10, Signature Preferred 2.10% + $0.10.",
  },
  {
    programName: "Retail Credit Performance Threshold III",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.51,
    fixed: 0.1,
    notes: "Requires 19.2 million transactions and $1.08 billion of volume. Visa Signature 1.65% + $0.10, Signature Preferred 2.10% + $0.10.",
  },
  {
    programName: "Product 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.65,
    fixed: 0.1,
    notes:
      "The everyday card present credit rate for a merchant too small for the retail thresholds and too large for the small merchant program. All Other Products 1.51% + $0.10, Visa Signature 1.65% + $0.10, Signature Preferred 2.10% + $0.10, Infinite Spend Qualified 2.30% + $0.10.",
  },
  {
    programName: "Small Ticket",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Small ticket and micropayment",
    ratePct: 1.9,
    fixed: 0,
    min: 0.04,
    notes:
      "A percentage with a floor, not a percentage plus a fixed fee. On a $1.00 sale the floor binds and interchange is 4 cents. Premium consumer cards pay 2.20% with the same 4 cent minimum.",
  },
  {
    programName: "Fuel",
    cardType: "Consumer credit, all consumer products",
    channel: "Card present",
    category: "Fuel and convenience",
    ratePct: 1.15,
    fixed: 0.25,
    cap: 1.1,
    notes: "The one consumer credit program Visa prices identically across all six card tiers, and it is capped at $1.10.",
  },
  {
    programName: "Service Station and Government Small Ticket",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Fuel and convenience",
    ratePct: 1.65,
    fixed: 0.04,
    notes: "Visa prints this as not applicable for Infinite Spend Qualified and Signature Preferred. Visa Signature pays the same 1.65% + $0.04.",
  },
  {
    programName: "Advertising 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.7,
    fixed: 0.1,
    notes: "All Other Products 1.55% + $0.10, Visa Signature 1.75% + $0.10, Signature Preferred and Infinite Spend Qualified 2.30% + $0.10.",
  },
  {
    programName: "Insurance 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Healthcare, education and insurance",
    ratePct: 1.43,
    fixed: 0.05,
    notes:
      "One of the category programs whose eligibility turns on your merchant category code. Visa Signature also pays 1.43% + $0.05; Signature Preferred and Infinite Spend Qualified pay 2.25% + $0.10.",
  },
  {
    programName: "Education 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Healthcare, education and insurance",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Applies to transactions of $500 or more. Below that the sale falls to the ordinary retail program. Signature Preferred and Infinite Spend Qualified 2.15% + $0.10.",
  },
  {
    programName: "Healthcare 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Healthcare, education and insurance",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Applies to transactions of $500 or more. Signature Preferred and Infinite Spend Qualified 2.30% + $0.10.",
  },
  {
    programName: "Real Estate 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Real estate and lending",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Applies to transactions of $500 or more. Signature Preferred and Infinite Spend Qualified 2.15% + $0.10.",
  },
  {
    programName: "Services 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.7,
    fixed: 0.1,
    notes: "Applies to transactions of $100 or more. All Other Products 1.55% + $0.10, Visa Signature 1.85% + $0.10, Signature Preferred 2.30% + $0.10.",
  },
  {
    programName: "Travel 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Travel, lodging and transport",
    ratePct: 1.95,
    fixed: 0.1,
    notes: "All Other Products 1.75% + $0.10, Visa Signature 2.25% + $0.10, Signature Preferred 2.40% + $0.10, Infinite Spend Qualified 2.55% + $0.10.",
  },
  {
    programName: "Restaurant 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Restaurant and bar",
    ratePct: 2.1,
    fixed: 0,
    min: 0.04,
    notes:
      "A percentage with a 4 cent floor and no fixed component, so a restaurant pays a straight 2.10% of the settled amount above a $1.91 check. Premium consumer cards pay 2.60% with the same floor. The settled amount includes the tip.",
  },
  {
    programName: "Taxi 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Travel, lodging and transport",
    ratePct: 2.1,
    fixed: 0,
    min: 0.04,
    notes: "Priced identically to Restaurant 2. Premium consumer cards pay 2.60% with a 4 cent floor.",
  },
  {
    programName: "Charity 2",
    cardType: "Consumer credit, all consumer products",
    channel: "Card present",
    category: "Charity and public sector",
    ratePct: 1.35,
    fixed: 0.05,
    notes: "Identical across all six Visa consumer credit card tiers, which is unusual and worth knowing if you run a nonprofit.",
  },
  {
    programName: "Government 2",
    cardType: "Consumer credit, all consumer products",
    channel: "Card present",
    category: "Charity and public sector",
    ratePct: 1.55,
    fixed: 0.1,
    notes: "Identical across all six consumer credit tiers.",
  },
  {
    programName: "Consumer Bill Payment Service, Consumer Credit 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Utilities and bill payment",
    ratePct: 2.04,
    fixed: 0.1,
    notes: "All Other Products 1.89% + $0.10, Visa Signature 2.05% + $0.10, Signature Preferred 2.50% + $0.10, Infinite Spend Qualified 2.60% + $0.10.",
  },
  {
    programName: "Non-Qualified Consumer Credit",
    cardType: "Consumer credit, all consumer products",
    channel: "Card present",
    category: "Downgrades and unqualified",
    ratePct: 3.15,
    fixed: 0.1,
    notes:
      "The ceiling, and the same 3.15% + $0.10 on every consumer card tier. This is where a transaction lands when it fails CPS qualification outright. It is roughly double Product 2 on the same card.",
  },

  // --- Table C, consumer credit, card not present ----------------------------
  {
    programName: "Recurring Tier 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Recurring and subscription",
    ratePct: 1.33,
    fixed: 0.05,
    notes: "The cheapest consumer credit program in the card not present table. Visa Signature also 1.33% + $0.05, Signature Preferred 1.85% + $0.05.",
  },
  {
    programName: "Recurring Tier 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Recurring and subscription",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Signature Preferred and Infinite Spend Qualified 2.20% + $0.05.",
  },
  {
    programName: "Recurring Tier 3",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Recurring and subscription",
    ratePct: 1.53,
    fixed: 0.05,
    notes: "Signature Preferred and Infinite Spend Qualified 2.30% + $0.05.",
  },
  {
    programName: "Recurring",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Recurring and subscription",
    ratePct: 1.53,
    fixed: 0.05,
    notes:
      "The untiered recurring program, where a subscription business without the volume for a tier lands. Still 51 basis points better than Product 1 on the same card, which is the strongest argument for flagging a charge as recurring correctly.",
  },
  {
    programName: "Product 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 2.04,
    fixed: 0.1,
    notes:
      "The everyday card not present credit rate. All Other Products 1.89% + $0.10, Visa Signature 2.05% + $0.10, Signature Preferred 2.50% + $0.10, Infinite Spend Qualified 2.60% + $0.10.",
  },
  {
    programName: "Advertising 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.8,
    fixed: 0.1,
    notes: "All Other Products 1.65% + $0.10, Visa Signature 1.85% + $0.10, Signature Preferred 2.40% + $0.10.",
  },
  {
    programName: "Insurance 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Healthcare, education and insurance",
    ratePct: 1.53,
    fixed: 0.05,
    notes: "Signature Preferred and Infinite Spend Qualified 2.35% + $0.10.",
  },
  {
    programName: "Education 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Healthcare, education and insurance",
    ratePct: 1.53,
    fixed: 0.05,
    notes: "Applies to transactions of $500 or more. Signature Preferred and Infinite Spend Qualified 2.25% + $0.10.",
  },
  {
    programName: "Healthcare 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Healthcare, education and insurance",
    ratePct: 1.53,
    fixed: 0.05,
    notes: "Applies to transactions of $500 or more. Signature Preferred and Infinite Spend Qualified 2.40% + $0.10.",
  },
  {
    programName: "Real Estate 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Real estate and lending",
    ratePct: 1.53,
    fixed: 0.05,
    notes: "Applies to transactions of $500 or more. This is the program a property manager taking rent online should be qualifying for.",
  },
  {
    programName: "Services 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.8,
    fixed: 0.1,
    notes: "Applies to transactions of $100 or more. All Other Products 1.65% + $0.10, Signature Preferred and Infinite Spend Qualified 2.40% + $0.10.",
  },
  {
    programName: "Travel 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Travel, lodging and transport",
    ratePct: 1.95,
    fixed: 0.1,
    notes: "All Other Products 1.75% + $0.10, Visa Signature 2.25% + $0.10, Infinite Spend Qualified 2.55% + $0.10.",
  },
  {
    programName: "Restaurant 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Restaurant and bar",
    ratePct: 2.2,
    fixed: 0,
    min: 0.08,
    notes: "The delivery and online ordering equivalent of Restaurant 2, ten basis points worse and with an 8 cent floor. Premium consumer cards pay 2.70%.",
  },
  {
    programName: "Taxi 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Travel, lodging and transport",
    ratePct: 2.2,
    fixed: 0,
    min: 0.08,
    notes: "In app ride hailing rather than a card tapped in the vehicle. Premium consumer cards pay 2.70% with the same 8 cent floor.",
  },
  {
    programName: "Charity 1",
    cardType: "Consumer credit, all consumer products",
    channel: "Card not present",
    category: "Charity and public sector",
    ratePct: 1.35,
    fixed: 0.05,
    notes: "Identical across all six consumer credit tiers, and identical to the card present charity rate. Online giving costs a nonprofit no more than in person giving.",
  },
  {
    programName: "Government 1",
    cardType: "Consumer credit, all consumer products",
    channel: "Card not present",
    category: "Charity and public sector",
    ratePct: 1.55,
    fixed: 0.1,
    notes: "Identical across all six consumer credit tiers.",
  },
  {
    programName: "Consumer Bill Payment Service, Consumer Credit 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Utilities and bill payment",
    ratePct: 2.04,
    fixed: 0.1,
    notes: "All Other Products 1.89% + $0.10, Signature Preferred 2.50% + $0.10, Infinite Spend Qualified 2.60% + $0.10.",
  },
  {
    programName: "CPS/Utility",
    cardType: "Consumer credit, all consumer products",
    channel: "Card not present",
    category: "Utilities and bill payment",
    ratePct: 0,
    fixed: 0.75,
    notes:
      "A flat 75 cents on a consumer credit card, on every card tier including Infinite. A $300 electricity bill costs the utility 75 cents. Nothing else in the consumer credit schedule works like this.",
  },
  {
    programName: "Non-Qualified Consumer Credit, Card Not Present",
    cardType: "Consumer credit, all consumer products",
    channel: "Card not present",
    category: "Downgrades and unqualified",
    ratePct: 3.15,
    fixed: 0.1,
    notes: "Same ceiling as the card present table, on every card tier.",
  },

  // --- Table C, Small Merchant Fee Program ----------------------------------
  {
    programName: "Small Merchant Product 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.43,
    fixed: 0.1,
    notes:
      "The Small Merchant Fee Program is open to merchants with gross Visa consumer credit sales at or below $280,000, measured on 12 months of Visa system activity ending September 30, 2024. This is 22 basis points better than Product 2 on the same card. All Other Products 1.29% + $0.10, Signature Preferred and Infinite Spend Qualified 1.88% + $0.10.",
  },
  {
    programName: "Small Merchant Product 1",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.73,
    fixed: 0.1,
    notes: "31 basis points better than Product 1 on the same card. All Other Products 1.58% + $0.10, Signature Preferred and Infinite Spend Qualified 2.18% + $0.10.",
  },
  {
    programName: "Small Merchant Advertising 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Any",
    category: "Retail and general",
    ratePct: 1.7,
    fixed: 0.1,
    notes: "All Other Products 1.55% + $0.10, Signature Preferred and Infinite Spend Qualified 2.30% + $0.10.",
  },
  {
    programName: "Small Merchant Education 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Any",
    category: "Healthcare, education and insurance",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Signature Preferred and Infinite Spend Qualified 2.15% + $0.10.",
  },
  {
    programName: "Small Merchant Healthcare 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Any",
    category: "Healthcare, education and insurance",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Signature Preferred and Infinite Spend Qualified 2.30% + $0.10.",
  },
  {
    programName: "Small Merchant Insurance 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Any",
    category: "Healthcare, education and insurance",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Signature Preferred and Infinite Spend Qualified 2.25% + $0.10.",
  },
  {
    programName: "Small Merchant Real Estate 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Any",
    category: "Real estate and lending",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Signature Preferred and Infinite Spend Qualified 2.15% + $0.10.",
  },
  {
    programName: "Small Merchant Recurring 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Card not present",
    category: "Recurring and subscription",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Signature Preferred and Infinite Spend Qualified 2.20% + $0.05.",
  },
  {
    programName: "Small Merchant Services 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Any",
    category: "Retail and general",
    ratePct: 1.7,
    fixed: 0.1,
    notes: "All Other Products 1.55% + $0.10, Signature Preferred and Infinite Spend Qualified 2.30% + $0.10.",
  },
  {
    programName: "Small Merchant Restaurant 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Any",
    category: "Restaurant and bar",
    ratePct: 2.1,
    fixed: 0,
    min: 0.04,
    notes: "Identical to Restaurant 2, so the small merchant program buys an independent restaurant nothing on card present dining. Premium consumer cards pay 2.60%.",
  },
  {
    programName: "Small Merchant Supermarket 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Any",
    category: "Supermarket and grocery",
    ratePct: 1.5,
    fixed: 0.07,
    notes: "Identical to Supermarket Credit All Other, so an independent grocer gains nothing here either.",
  },
  {
    programName: "Small Merchant Taxi 1 and 2",
    cardType: "Consumer credit, Traditional Rewards",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 2.1,
    fixed: 0,
    min: 0.04,
    notes: "Premium consumer cards pay 2.60% with a 4 cent floor.",
  },

  // --- Table E, corporate and purchasing ------------------------------------
  {
    programName: "Commercial Product 3",
    cardType: "Purchasing and Corporate T&E",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 1.75,
    fixed: 0.1,
    notes:
      "The Level 3 data rate. Passing line item detail on a commercial card is worth 75 basis points against Commercial Card Present and 95 against Commercial Card Not Present. Visa notes Purchasing includes Fleet cards.",
  },
  {
    programName: "Commercial Level II Fuel",
    cardType: "Purchasing and Corporate T&E",
    channel: "Any",
    category: "Fuel and convenience",
    ratePct: 2.2,
    fixed: 0.1,
    notes: "Level 2 data on a commercial fuel purchase.",
  },
  {
    programName: "Commercial Card Present",
    cardType: "Purchasing and Corporate T&E",
    channel: "Card present",
    category: "Commercial and business cards",
    ratePct: 2.5,
    fixed: 0.1,
    notes: "A commercial card dipped or tapped with no enhanced data. Nearly a point worse than an ordinary consumer card on the same counter.",
  },
  {
    programName: "Commercial Travel Service",
    cardType: "Purchasing and Corporate T&E",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 2.65,
    fixed: 0.1,
    notes: "Travel agents and tour operators accepting a corporate card.",
  },
  {
    programName: "Commercial Card Not Present",
    cardType: "Purchasing and Corporate T&E",
    channel: "Card not present",
    category: "Commercial and business cards",
    ratePct: 2.7,
    fixed: 0.1,
    notes: "The rate a B2B seller pays on a corporate card invoice with no Level 2 or Level 3 data attached.",
  },
  {
    programName: "Consumer Bill Payment Service, Commercial",
    cardType: "Purchasing and Corporate T&E",
    channel: "Any",
    category: "Utilities and bill payment",
    ratePct: 2.7,
    fixed: 0.1,
    notes: "Bill payment on a commercial card.",
  },
  {
    programName: "Commercial Non-Qualified",
    cardType: "Purchasing and Corporate T&E",
    channel: "Any",
    category: "Downgrades and unqualified",
    ratePct: 2.95,
    fixed: 0.1,
    notes: "The commercial downgrade.",
  },
  {
    programName: "Commercial Non-Qualified with Data",
    cardType: "Purchasing and Corporate T&E",
    channel: "Any",
    category: "Downgrades and unqualified",
    ratePct: 2.95,
    fixed: 0.1,
    notes: "Priced identically to plain Non-Qualified, so sending enhanced data on a transaction that has already failed qualification recovers nothing.",
  },
  {
    programName: "Commercial Product Large Ticket",
    cardType: "Purchasing and Corporate T&E",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 1.3,
    fixed: 35,
    notes:
      "A large ticket rate inverts the usual shape: a $35.00 fixed fee with a low percentage. Against Commercial Product 3 at 1.75% + $0.10 the crossover is $7,755.56, so it is cheaper on a big B2B invoice and far worse on anything ordinary.",
  },
  {
    programName: "Government-to-Government (G2G)",
    cardType: "Purchasing only",
    channel: "Any",
    category: "Charity and public sector",
    ratePct: 1.65,
    fixed: 0.1,
    notes: "Purchasing cards only, not Corporate T&E.",
  },
  {
    programName: "GSA Large Ticket",
    cardType: "Purchasing only",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 1.2,
    fixed: 39,
    notes: "The federal government purchasing large ticket rate. Purchasing cards only.",
  },

  // --- Table G, business credit, Spend Tier I --------------------------------
  {
    programName: "Business Product 3",
    cardType: "Business credit, Spend Tier I",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 2.4,
    fixed: 0.1,
    notes: "Level 3 data on a small business card. Spend Tier V pays 2.75% + $0.10, so the issuer's spend tier moves this by 35 basis points.",
  },
  {
    programName: "Business Product 2",
    cardType: "Business credit, Spend Tier I",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 1.9,
    fixed: 0.1,
    notes: "The cheapest business credit program in the table. Spend Tier V pays 2.25% + $0.10.",
  },
  {
    programName: "Business Product 1",
    cardType: "Business credit, Spend Tier I",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 2.65,
    fixed: 0.1,
    notes: "Spend Tier V pays 3.00% + $0.10.",
  },
  {
    programName: "Consumer Bill Payment Service, Business Credit",
    cardType: "Business credit, Spend Tier I",
    channel: "Any",
    category: "Utilities and bill payment",
    ratePct: 2.65,
    fixed: 0.1,
    notes: "Spend Tier V pays 3.00% + $0.10.",
  },
  {
    programName: "Business Travel",
    cardType: "Business credit, Spend Tier I",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 2.35,
    fixed: 0.1,
    notes: "Spend Tier V pays 2.70% + $0.10.",
  },
  {
    programName: "Business Non-Qualified",
    cardType: "Business credit, all spend tiers",
    channel: "Any",
    category: "Downgrades and unqualified",
    ratePct: 3.15,
    fixed: 0.2,
    notes: "3.15% + $0.20 on every business spend tier. The most expensive card present outcome in the whole Visa US schedule.",
  },
  {
    programName: "Business Utility Program",
    cardType: "Business credit, all spend tiers",
    channel: "Any",
    category: "Utilities and bill payment",
    ratePct: 0,
    fixed: 1.5,
    notes: "A flat $1.50 on every business spend tier.",
  },

  // --- Table G, business debit, exempt --------------------------------------
  {
    programName: "Business Debit, Card Present",
    cardType: "Business debit, exempt issuer",
    channel: "Card present",
    category: "Commercial and business cards",
    ratePct: 1.7,
    fixed: 0.1,
    notes: "Nearly a point worse than consumer CPS/Retail Debit for the same swipe, which is why business debit is worth separating in a statement analysis.",
  },
  {
    programName: "Business Debit, Card Not Present",
    cardType: "Business debit, exempt issuer",
    channel: "Card not present",
    category: "Commercial and business cards",
    ratePct: 2.45,
    fixed: 0.1,
    notes: "80 basis points worse than the card present version.",
  },
  {
    programName: "Consumer Bill Payment Service, Business Debit",
    cardType: "Business debit, exempt issuer",
    channel: "Any",
    category: "Utilities and bill payment",
    ratePct: 2.45,
    fixed: 0.1,
    notes: "Bill payment on a business debit card.",
  },
  {
    programName: "Business Debit, Non-Qualified",
    cardType: "Business debit, exempt issuer",
    channel: "Any",
    category: "Downgrades and unqualified",
    ratePct: 2.95,
    fixed: 0.1,
    notes: "The business debit downgrade.",
  },
  {
    programName: "Business Utility Program, Recurring Bill Payment",
    cardType: "Business debit, exempt issuer",
    channel: "Card not present",
    category: "Utilities and bill payment",
    ratePct: 0,
    fixed: 0.75,
    notes: "A flat 75 cents for an enrolled recurring business utility payment.",
  },
  {
    programName: "Business Utility Program, Card Not Present Only",
    cardType: "Business debit, exempt issuer",
    channel: "Card not present",
    category: "Utilities and bill payment",
    ratePct: 0,
    fixed: 1.5,
    notes: "A flat $1.50 for a one off business utility payment.",
  },
];

// ---------------------------------------------------------------------------
// Mastercard
// ---------------------------------------------------------------------------

const MASTERCARD_RAW: RawRate[] = [
  // --- Consumer credit, Core column unless stated ---------------------------
  {
    programName: "Airline",
    cardType: "Consumer credit, World High Value and World Elite",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 2.55,
    fixed: 0.1,
    notes: "Mastercard prints this program as not applicable for Core, Enhanced Value and World cards. It exists only for the two premium tiers.",
  },
  {
    programName: "Charities",
    cardType: "Consumer credit, all tiers",
    channel: "Any",
    category: "Charity and public sector",
    ratePct: 2,
    fixed: 0.1,
    notes: "2.00% + $0.10 on Core, Enhanced Value, World, World High Value and World Elite alike. Notably worse than Visa's 1.35% + $0.05 charity rate.",
  },
  {
    programName: "Convenience Purchases Base",
    cardType: "Consumer credit, Core",
    channel: "Any",
    category: "Fuel and convenience",
    ratePct: 1.65,
    fixed: 0.04,
    notes: "Enhanced Value 1.80% + $0.04, World 1.90% + $0.04, World High Value and World Elite 2.30% + $0.04.",
  },
  {
    programName: "Convenience Purchases Tier I",
    cardType: "Consumer credit, Core",
    channel: "Any",
    category: "Fuel and convenience",
    ratePct: 1.35,
    fixed: 0,
    notes:
      "No fixed component at all. Tier I needs USD 1.00 billion of annual qualifying volume, or a route for merchants where 60 percent of Mastercard consumer credit transactions are USD 20 or lower and Mastercard prepaid is offered. World tiers 1.45%.",
  },
  {
    programName: "Full UCAF",
    cardType: "Consumer credit, Core",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.95,
    fixed: 0.1,
    notes: "Fully authenticated ecommerce. Enhanced Value 2.10% + $0.10, World 2.20% + $0.10, World High Value and World Elite 2.60% + $0.10.",
  },
  {
    programName: "Key-entered",
    cardType: "Consumer credit, Core",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.95,
    fixed: 0.1,
    notes: "Priced identically to Merit I. Enhanced Value 2.10% + $0.10, World 2.20% + $0.10, premium tiers 2.60% + $0.10.",
  },
  {
    programName: "Lodging and Auto Rental",
    cardType: "Consumer credit, Core",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 1.65,
    fixed: 0.1,
    notes: "Enhanced Value 1.75% + $0.10. Mastercard prints this as not applicable for World, World High Value and World Elite, which use T&E instead.",
  },
  {
    programName: "Merchant UCAF",
    cardType: "Consumer credit, Core",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.95,
    fixed: 0.1,
    notes: "Partial authentication. Priced the same as Full UCAF on every tier, so the incentive to authenticate fully is liability shift rather than interchange.",
  },
  {
    programName: "Merit I",
    cardType: "Consumer credit, Core",
    channel: "Any",
    category: "Ecommerce and keyed",
    ratePct: 1.95,
    fixed: 0.1,
    notes:
      "Mastercard's base program, and the one a merchant with no category specific program lands on. Enhanced Value 2.10% + $0.10, World 2.20% + $0.10, World High Value and World Elite 2.60% + $0.10.",
  },
  {
    programName: "Merit I (Insurance MCCs)",
    cardType: "Consumer credit, Core",
    channel: "Any",
    category: "Healthcare, education and insurance",
    ratePct: 1.43,
    fixed: 0.05,
    notes:
      "Mastercard limits this to MCCs 5960 and 6300. 52 basis points and a nickel better than plain Merit I on the same card, and the only thing separating them is the merchant category code. World High Value and World Elite 2.25% + $0.10.",
  },
  {
    programName: "Merit I (Real Estate MCCs)",
    cardType: "Consumer credit, Core",
    channel: "Any",
    category: "Real estate and lending",
    ratePct: 1.43,
    fixed: 0.05,
    notes: "Limited to MCC 6513. World High Value and World Elite 2.20% + $0.10.",
  },
  {
    programName: "Merit I (Day Care MCCs)",
    cardType: "Consumer credit, Core",
    channel: "Any",
    category: "Healthcare, education and insurance",
    ratePct: 1.6,
    fixed: 0.1,
    notes: "Limited to MCC 8351. Core, Enhanced Value and World all pay 1.60% + $0.10; Mastercard prints it as not applicable for World High Value and World Elite.",
  },
  {
    programName: "Merit III Base",
    cardType: "Consumer credit, Core",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.65,
    fixed: 0.1,
    notes: "The card present retail program. Enhanced Value 1.80% + $0.10, World 1.90% + $0.10, premium tiers 2.30% + $0.10.",
  },
  {
    programName: "Merit III Tier 1",
    cardType: "Consumer credit, Core",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.43,
    fixed: 0.1,
    notes:
      "Requires USD 1.80 billion of qualifying annual volume, and Mastercard notes only retail and restaurant MCCs may qualify for Merit III tiers. World 1.53% + $0.10, premium tiers 2.05% + $0.10.",
  },
  {
    programName: "Merit III Tier 2",
    cardType: "Consumer credit, Core",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.48,
    fixed: 0.1,
    notes: "Requires USD 1.25 billion of qualifying annual volume. World 1.58% + $0.10, premium tiers 2.10% + $0.10.",
  },
  {
    programName: "Merit III Tier 3",
    cardType: "Consumer credit, Core",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.55,
    fixed: 0.1,
    notes: "Requires USD 750 million of qualifying annual volume. World 1.65% + $0.10, premium tiers 2.15% + $0.10.",
  },
  {
    programName: "Passenger Transport",
    cardType: "Consumer credit, Core",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 1.65,
    fixed: 0.1,
    notes: "Enhanced Value 1.75% + $0.10. Not applicable for World, World High Value and World Elite.",
  },
  {
    programName: "Payment Transaction (Gaming Payments MCCs)",
    cardType: "Consumer credit, all tiers",
    channel: "Any",
    category: "Retail and general",
    ratePct: 0,
    fixed: 0.1,
    notes:
      "A flat 10 cents with no percentage, on every card tier, restricted to MCCs 7800, 7801, 7802, 7994 and 7995. Effectively free interchange on a regulated gaming payout or wager.",
  },
  {
    programName: "Payment Transaction",
    cardType: "Consumer credit, all tiers",
    channel: "Any",
    category: "Retail and general",
    ratePct: 0.19,
    fixed: 0.53,
    notes: "The general payment transaction rate, identical on every consumer credit tier.",
  },
  {
    programName: "Petroleum Base",
    cardType: "Consumer credit, Core",
    channel: "Any",
    category: "Fuel and convenience",
    ratePct: 1.9,
    fixed: 0,
    cap: 0.95,
    notes: "A percentage with a 95 cent ceiling and no fixed component. World and premium tiers 2.00% with the same cap. The cap binds above a $50 fill on Core.",
  },
  {
    programName: "Public Sector",
    cardType: "Consumer credit, all tiers",
    channel: "Any",
    category: "Charity and public sector",
    ratePct: 1.55,
    fixed: 0.1,
    notes: "1.55% + $0.10 on every consumer credit tier, matching Visa's government rate exactly.",
  },
  {
    programName: "Restaurant",
    cardType: "Consumer credit, World",
    channel: "Any",
    category: "Restaurant and bar",
    ratePct: 1.85,
    fixed: 0.1,
    notes: "Mastercard prints this as not applicable for Core and Enhanced Value, which use Merit III instead. World High Value and World Elite pay 2.00% + $0.10.",
  },
  {
    programName: "Service Industries",
    cardType: "Consumer credit, all tiers",
    channel: "Any",
    category: "Small ticket and micropayment",
    ratePct: 1.15,
    fixed: 0.05,
    notes:
      "1.15% + $0.05 on every consumer credit tier, which makes it the cheapest consumer credit program Mastercard publishes. Eligibility is restricted to specific service MCCs.",
  },
  {
    programName: "Small Ticket Card Present",
    cardType: "Consumer credit, Core",
    channel: "Card present",
    category: "Small ticket and micropayment",
    ratePct: 1.65,
    fixed: 0.02,
    notes: "Mastercard notes small ticket rates apply to transactions of $5 and below. Enhanced Value 1.80% + $0.02, World 1.90% + $0.02, premium tiers 2.30% + $0.02.",
  },
  {
    programName: "Small Ticket Card-Not-Present",
    cardType: "Consumer credit, Core",
    channel: "Card not present",
    category: "Small ticket and micropayment",
    ratePct: 1.95,
    fixed: 0.02,
    notes: "Enhanced Value 2.10% + $0.02, World 2.20% + $0.02, premium tiers 2.60% + $0.02.",
  },
  {
    programName: "Standard",
    cardType: "Consumer credit, all tiers",
    channel: "Any",
    category: "Downgrades and unqualified",
    ratePct: 3.15,
    fixed: 0.1,
    notes: "Mastercard's downgrade, 3.15% + $0.10 on every consumer credit tier. Identical to Visa's Non-Qualified Consumer Credit rate.",
  },
  {
    programName: "Supermarket Base",
    cardType: "Consumer credit, Core",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.45,
    fixed: 0.1,
    notes: "Enhanced Value 1.60% + $0.10, World 1.70% + $0.10, premium tiers 2.10% + $0.10.",
  },
  {
    programName: "Supermarket Tier 1",
    cardType: "Consumer credit, Core",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.15,
    fixed: 0.05,
    notes: "Requires USD 6.00 billion of annual qualifying volume. World and premium tiers 1.25% + $0.05.",
  },
  {
    programName: "Supermarket Tier 2",
    cardType: "Consumer credit, Core",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.15,
    fixed: 0.05,
    notes: "Requires USD 2.00 billion of annual qualifying volume. World and premium tiers 1.25% + $0.05.",
  },
  {
    programName: "Supermarket Tier 3",
    cardType: "Consumer credit, Core",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.22,
    fixed: 0.05,
    notes: "Requires USD 750 million of annual qualifying volume. World and premium tiers 1.32% + $0.05.",
  },
  {
    programName: "T&E",
    cardType: "Consumer credit, World",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 2.25,
    fixed: 0.1,
    notes: "Not applicable for Core and Enhanced Value. World High Value and World Elite pay 2.55% + $0.10.",
  },
  {
    programName: "T&E Large Ticket",
    cardType: "Consumer credit, World High Value and World Elite",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 2.55,
    fixed: 0,
    notes: "No fixed component, and offered only on the two premium consumer tiers.",
  },
  {
    programName: "Utilities",
    cardType: "Consumer credit, all tiers",
    channel: "Any",
    category: "Utilities and bill payment",
    ratePct: 0,
    fixed: 0.75,
    notes: "A flat 75 cents on every consumer credit tier, matching Visa's CPS/Utility exactly. The percentage component is zero.",
  },

  // --- Unregulated consumer debit -------------------------------------------
  {
    programName: "Charities",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Charity and public sector",
    ratePct: 1.45,
    fixed: 0.15,
    notes: "Prepaid pays the same 1.45% + $0.15.",
  },
  {
    programName: "Emerging Markets",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Retail and general",
    ratePct: 0.8,
    fixed: 0.25,
    notes: "Prepaid pays the same 0.80% + $0.25.",
  },
  {
    programName: "Emerging Markets (Education and Government MCCs)",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Healthcare, education and insurance",
    ratePct: 0.65,
    fixed: 0.15,
    cap: 2,
    notes:
      "Mastercard limits this to MCCs 7800, 8211, 8220, 8299, 9211, 9222, 9223, 9311, 9399 and 9402, and caps it at $2.00. A school taking a $2,000 tuition payment on exempt debit pays $2.00 of interchange.",
  },
  {
    programName: "Full UCAF",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.65,
    fixed: 0.15,
    notes: "Prepaid pays 1.76% + $0.20.",
  },
  {
    programName: "Key-Entered",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.65,
    fixed: 0.15,
    notes: "Prepaid pays 1.76% + $0.20.",
  },
  {
    programName: "Lodging and Auto Rental",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 1.15,
    fixed: 0.15,
    notes: "Prepaid pays the same 1.15% + $0.15.",
  },
  {
    programName: "Merchant UCAF",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card not present",
    category: "Ecommerce and keyed",
    ratePct: 1.65,
    fixed: 0.15,
    notes: "Prepaid pays 1.76% + $0.20.",
  },
  {
    programName: "Merit I",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Ecommerce and keyed",
    ratePct: 1.65,
    fixed: 0.15,
    notes: "The base exempt debit program. Prepaid pays 1.76% + $0.20.",
  },
  {
    programName: "Merit I (Real Estate MCCs)",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Real estate and lending",
    ratePct: 0.8,
    fixed: 0.25,
    cap: 5,
    notes:
      "Capped at $5.00, which makes exempt debit the cheapest way to collect a large rent payment: a $2,500 rent charge costs $5.00 of interchange rather than $20.25 uncapped.",
  },
  {
    programName: "Merit I (Consumer Loan MCCs)",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Real estate and lending",
    ratePct: 0.8,
    fixed: 0.25,
    cap: 2.95,
    notes: "Mastercard notes this rate requires an approved and assigned Merchant ID. Capped at $2.95.",
  },
  {
    programName: "Merit III Base",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 1.05,
    fixed: 0.15,
    notes: "Card present exempt debit retail. Prepaid pays 1.15% + $0.15.",
  },
  {
    programName: "Merit III Tier 1",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 0.7,
    fixed: 0.15,
    notes: "Requires USD 400 million of annual qualifying exempt debit volume.",
  },
  {
    programName: "Merit III Tier 2",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 0.83,
    fixed: 0.15,
    notes: "Requires USD 275 million of annual qualifying exempt debit volume.",
  },
  {
    programName: "Merit III Tier 3",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 0.95,
    fixed: 0.15,
    notes: "Requires USD 175 million of annual qualifying exempt debit volume.",
  },
  {
    programName: "Passenger Transport",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 1.6,
    fixed: 0.15,
    notes: "Prepaid pays the same 1.60% + $0.15.",
  },
  {
    programName: "Payment Transaction",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Retail and general",
    ratePct: 0.19,
    fixed: 0.53,
    notes: "Prepaid pays the same.",
  },
  {
    programName: "Payment Transaction (Gaming Payments MCCs)",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Retail and general",
    ratePct: 0,
    fixed: 0.1,
    notes: "MCCs 7800, 7801, 7802, 7994 and 7995. A flat 10 cents.",
  },
  {
    programName: "Petroleum CAT/AFD",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Fuel and convenience",
    ratePct: 0.7,
    fixed: 0.17,
    cap: 0.95,
    notes: "Unattended fuel on exempt debit, capped at 95 cents.",
  },
  {
    programName: "Petroleum Service Station",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Fuel and convenience",
    ratePct: 0.7,
    fixed: 0.17,
    cap: 0.95,
    notes: "Attended fuel on exempt debit, capped at 95 cents.",
  },
  {
    programName: "Restaurant",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Restaurant and bar",
    ratePct: 1.19,
    fixed: 0.1,
    notes: "Identical to Visa's CPS/Restaurant Debit rate, to the basis point.",
  },
  {
    programName: "Service Industries",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Small ticket and micropayment",
    ratePct: 1.15,
    fixed: 0.05,
    notes: "Same rate as the consumer credit version of this program.",
  },
  {
    programName: "Small Ticket Base",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Small ticket and micropayment",
    ratePct: 1.55,
    fixed: 0.04,
    notes: "Identical to Visa's CPS/Small Ticket Debit rate.",
  },
  {
    programName: "Small Ticket Tier 1",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Small ticket and micropayment",
    ratePct: 1.3,
    fixed: 0.03,
    notes: "Requires 175 million qualifying small ticket transactions a year, so this is a vending, transit or coffee chain rate.",
  },
  {
    programName: "Standard",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Downgrades and unqualified",
    ratePct: 1.9,
    fixed: 0.25,
    notes: "The exempt debit downgrade. Identical to Visa's Standard Interchange Reimbursement Fee for debit.",
  },
  {
    programName: "Supermarket Base",
    cardType: "Consumer debit, exempt issuer",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.05,
    fixed: 0.15,
    cap: 0.35,
    notes: "Capped at 35 cents, so a $200 grocery basket on exempt debit costs the grocer 35 cents of interchange.",
  },
  {
    programName: "Utilities",
    cardType: "Consumer debit, exempt issuer",
    channel: "Any",
    category: "Utilities and bill payment",
    ratePct: 0,
    fixed: 0.65,
    notes: "A flat 65 cents, matching Visa's CPS/Utility Debit.",
  },

  // --- Regulated and PIN debit ----------------------------------------------
  {
    programName: "Regulated POS Debit",
    cardType: "Consumer or commercial debit or prepaid, covered issuer",
    channel: "Any",
    category: "Regulated debit",
    ratePct: 0.05,
    fixed: 0.21,
    notes:
      "The Durbin cap, identical to Visa's. Mastercard notes the regulated rates also apply to any US interregional transaction between the US, American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the US Virgin Islands.",
    source: REG_II_SOURCE,
  },
  {
    programName: "Regulated POS Debit with Fraud Adjustment",
    cardType: "Consumer or commercial debit or prepaid, covered issuer",
    channel: "Any",
    category: "Regulated debit",
    ratePct: 0.05,
    fixed: 0.22,
    notes: "The 1 cent fraud prevention adjustment permitted by 12 CFR 235.4, which almost every covered issuer claims.",
    source: REG_II_SOURCE,
  },
  {
    programName: "PIN Debit All Other Base",
    cardType: "Consumer debit, exempt issuer, PIN",
    channel: "Card present",
    category: "Retail and general",
    ratePct: 0.9,
    fixed: 0.15,
    notes: "Mastercard's PIN debit schedule is separate from its signature debit schedule and is generally cheaper for retail.",
  },
  {
    programName: "PIN Debit Convenience Base",
    cardType: "Consumer debit, exempt issuer, PIN",
    channel: "Card present",
    category: "Fuel and convenience",
    ratePct: 0.75,
    fixed: 0.17,
    cap: 0.95,
    notes: "Convenience store and fuel purchases on PIN debit, capped at 95 cents, which is the same ceiling the signature debit petroleum programs carry.",
  },
  {
    programName: "PIN Debit Supermarket/Warehouse Base",
    cardType: "Consumer debit, exempt issuer, PIN",
    channel: "Card present",
    category: "Supermarket and grocery",
    ratePct: 1.05,
    fixed: 0.15,
    cap: 0.35,
    notes: "Capped at 35 cents, the same shape as the signature debit supermarket program.",
  },

  // --- Commercial, small business credit, Level 1 / Business Core ------------
  {
    programName: "Charities",
    cardType: "Small business credit, Level 1 / Business Core",
    channel: "Any",
    category: "Charity and public sector",
    ratePct: 2,
    fixed: 0.1,
    notes: "2.00% + $0.10 across all five business levels.",
  },
  {
    programName: "Data Rate I",
    cardType: "Small business credit, Level 1 / Business Core",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 2.65,
    fixed: 0.1,
    notes: "Level 2 data on a small business card. Level 5 pays 3.00% + $0.10.",
  },
  {
    programName: "Data Rate II",
    cardType: "Small business credit, Level 1 / Business Core",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 1.9,
    fixed: 0.1,
    notes: "The enhanced data rate, 75 basis points better than Data Rate I on the same card. Level 5 pays 2.25% + $0.10.",
  },
  {
    programName: "Payment Transaction",
    cardType: "Small business credit, Level 1 / Business Core",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 0.19,
    fixed: 0.53,
    notes: "0.19% + $0.53 across all five business levels.",
  },
  {
    programName: "Standard",
    cardType: "Small business credit, Level 1 / Business Core",
    channel: "Any",
    category: "Downgrades and unqualified",
    ratePct: 2.95,
    fixed: 0.1,
    notes: "The small business downgrade. Level 5 pays 3.30% + $0.10, the highest published rate in the Mastercard US schedule.",
  },
  {
    programName: "T&E Rate",
    cardType: "Small business credit, Level 1 / Business Core",
    channel: "Any",
    category: "Travel, lodging and transport",
    ratePct: 2.35,
    fixed: 0.1,
    notes: "Level 5 pays 2.70% + $0.10.",
  },
  {
    programName: "Utilities",
    cardType: "Small business credit, Level 1 / Business Core",
    channel: "Any",
    category: "Utilities and bill payment",
    ratePct: 0,
    fixed: 1.5,
    notes: "A flat $1.50 across all five business levels, matching Visa's Business Utility Program.",
  },

  // --- Commercial debit and large market credit -----------------------------
  {
    programName: "Data Rate I",
    cardType: "Large market credit",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 2.7,
    fixed: 0.1,
    notes: "Large market is Mastercard's corporate and purchasing tier, above small business.",
  },
  {
    programName: "Data Rate II",
    cardType: "Large market credit",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 2.5,
    fixed: 0.1,
    notes: "Commercial debit pays 2.10% + $0.10 for the same program.",
  },
  {
    programName: "Data Rate III",
    cardType: "Large market credit",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 1.9,
    fixed: 0.1,
    notes: "Line item level data. Mastercard prints Data Rate III as not applicable for commercial debit and commercial prepaid, so only large market credit can reach it.",
  },
  {
    programName: "Large Ticket",
    cardType: "Large market credit",
    channel: "Any",
    category: "Commercial and business cards",
    ratePct: 1.45,
    fixed: 35,
    notes: "The same shape as Visa's commercial large ticket rate: a $35.00 fixed fee and a low percentage, so it only beats Data Rate III on very large invoices.",
  },
  {
    programName: "Data Rate II (Petroleum MCCs)",
    cardType: "Commercial debit",
    channel: "Any",
    category: "Fuel and convenience",
    ratePct: 2.05,
    fixed: 0.1,
    notes: "Large market credit pays 2.20% + $0.10 for the same program.",
  },
  {
    programName: "Commercial Bill Pay Standard",
    cardType: "Commercial, bill payment",
    channel: "Any",
    category: "Utilities and bill payment",
    ratePct: 2.5,
    fixed: 0.1,
    notes: "Mastercard's Bill Pay Commercial program.",
  },
];

/**
 * The published table: 196 programs, 119 Visa and 77 Mastercard.
 *
 * Kept in RATE SHEET ORDER within each network rather than sorted by rate. The
 * sheets group by card product and then by acceptance channel, which is the
 * order a merchant reading their own statement is thinking in, and it makes a
 * row easy to find again in the source PDF. The widget does not re-sort.
 */
export const INTERCHANGE_RATES: InterchangeRate[] = [
  ...VISA_RAW.map(finish("Visa", VISA_SOURCE)),
  ...MASTERCARD_RAW.map(finish("Mastercard", MASTERCARD_SOURCE)),
];
