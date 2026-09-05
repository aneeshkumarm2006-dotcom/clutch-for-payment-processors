/**
 * PCI DSS self-assessment questionnaires and card network merchant levels
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
 * ─── The distinction this module exists to keep straight ────────────────────
 *
 * Two different things are called a "level" and conflating them is the mistake
 * on nearly every page ranking for these queries.
 *
 *   MERCHANT LEVEL (1 to 4) is set by annual transaction count per card brand
 *   and decides HOW YOU VALIDATE: an on-site assessment and a Report on
 *   Compliance signed by a QSA, or a self-assessment questionnaire you complete
 *   yourself. It is defined by Visa and Mastercard, not by the PCI SSC.
 *
 *   SAQ TYPE (A, A-EP, B, B-IP, C-VT, C, P2PE, SPoC, D) is set by HOW YOU
 *   ACCEPT PAYMENTS and decides WHICH QUESTIONNAIRE you fill in. It is defined
 *   by the PCI SSC, not by the card networks.
 *
 * They are independent. A corner shop is almost always Level 4 and still has to
 * pick the right SAQ, and a Level 4 merchant on SAQ D answers every requirement
 * in the standard. `PCI_MERCHANT_LEVELS` therefore carries its own sources
 * (Visa and Mastercard), separate from `PCI_SAQ_TYPES` (PCI SSC).
 *
 * ─── Requirement counts are mostly absent, deliberately ─────────────────────
 *
 * The PCI SSC publishes an item count for SAQ A and SAQ A-EP and for nothing
 * else. Counting requirement rows out of the published PDFs does not reproduce
 * the Council's own figures (a count of level three requirement identifiers in
 * SAQ A-EP returns 108 against the published 139, because the Council counts
 * some bulleted sub-items separately), so every other count here is null with
 * the reason recorded. A plausible invented count would render identically to a
 * real one. Do not fill these in from a vendor blog.
 *
 * ─── House style ────────────────────────────────────────────────────────────
 *
 * PCI SSC documents set their SAQ headings with en dashes and use curly quotes
 * throughout. Both have been replaced with commas, colons and straight quotes
 * for house style. No wording was otherwise changed.
 */

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const SRC_GUIDELINES =
  "PCI Security Standards Council, PCI DSS Self-Assessment Questionnaire Instructions and Guidelines v4.0, September 2023, pages 4 to 24. Checked 5 September 2026";

const SRC_BULLETIN_401 =
  "PCI Security Standards Council bulletin, SAQs for PCI DSS v4.0.1 Now Available, 15 October 2024, pcisecuritystandards.org. Checked 5 September 2026";

const SRC_SAQ_A_JAN_2025 =
  "PCI Security Standards Council, Important Updates Announced for Merchants Validating to Self-Assessment Questionnaire A, and FAQ 1588, blog.pcisecuritystandards.org. Checked 5 September 2026";

const SRC_SAQ_PDFS =
  "Requirement 11.3.2 presence read directly from Section 2 of the PCI DSS v4.0 SAQ documents published at listings.pcisecuritystandards.org. Checked 5 September 2026";

const SRC_VISA =
  "Visa, Compliance validation levels, visa.com small business information security pages. Checked 5 September 2026";

const SRC_MASTERCARD =
  "Mastercard Security Rules and Procedures, Merchant Edition, 6 August 2024, section 2.2.2, Level 1 to Level 4 Merchants. Checked 5 September 2026";

/**
 * Every source this module rests on, in one exported list so the page can print
 * its provenance and a reviewer can re-verify without reading the file.
 */
export const PCI_SOURCES: string[] = [
  SRC_GUIDELINES,
  SRC_BULLETIN_401,
  SRC_SAQ_A_JAN_2025,
  SRC_SAQ_PDFS,
  SRC_VISA,
  SRC_MASTERCARD,
];

/** The version of the standard every figure in this module describes. */
export const PCI_DSS_VERSION = "PCI DSS v4.0.1";

/**
 * The date the future-dated v4.x requirements stopped being best practice.
 *
 * Kept as a constant because three separate strings in the copy depend on it and
 * the page is worthless if they disagree.
 */
export const PCI_FUTURE_DATED_EFFECTIVE = "31 March 2025";

// ---------------------------------------------------------------------------
// SAQ types
// ---------------------------------------------------------------------------

/**
 * Whether the SAQ carries PCI DSS Requirement 11.3.2, the quarterly ASV scan.
 *
 * "unverified" is a real state, not a placeholder. The SAQ SPoC document is not
 * retrievable from the Council's public listing from this machine, so its
 * Requirement 11 content has not been read and is not asserted. A guess here
 * would render identically to a checked answer.
 */
export type PciScanNeed = "yes" | "conditional" | "no" | "unverified";

export interface PciSaqType {
  /** Stable id used by the decision tree and the widget. */
  id: string;
  /** Short label, as merchants and acquirers say it. */
  label: string;
  /** The Council's own section heading, en dash replaced with a comma. */
  title: string;
  /** One sentence on who fills this in. */
  whoItIsFor: string;
  /** Channels the SAQ may be used for. */
  channels: string[];
  /** The Council's eligibility criteria, transcribed. */
  eligibility: string[];
  /** The explicit exclusions the Council prints in bold under each SAQ. */
  notApplicable: string[];
  /** Published item count, or null where the Council publishes none. */
  requirementCount: number | null;
  /** Why the count is what it is, or why it is absent. */
  requirementCountNote: string;
  /**
   * Which of the twelve PCI DSS requirement families appear in Section 2 of the
   * questionnaire, read off the published documents. This is the count that CAN
   * be verified, unlike the item count, and it is the honest way to say how much
   * of the standard a questionnaire asks about.
   */
  requirementFamilies: number[] | null;
  scan: PciScanNeed;
  scanNote: string;
  source: string;
}

export const PCI_SAQ_TYPES: PciSaqType[] = [
  {
    id: "a",
    label: "SAQ A",
    title: "SAQ A, card-not-present merchants, all account data functions fully outsourced",
    whoItIsFor:
      "E-commerce or mail and telephone order merchants who have handed every account data function to a compliant processor, and whose payment page comes entirely and directly from that processor.",
    channels: ["E-commerce", "Mail order and telephone order"],
    eligibility: [
      "The merchant accepts only card-not-present (e-commerce or mail/telephone-order) transactions",
      "All processing of account data is entirely outsourced to a PCI DSS compliant third-party service provider (TPSP) or payment processor",
      "The merchant does not electronically store, process, or transmit any account data on merchant systems or premises, but relies entirely on a TPSP to handle all these functions",
      "The merchant has reviewed the PCI DSS Attestation of Compliance forms for its TPSPs and confirmed that they are PCI DSS compliant for the services being used",
      "Any account data the merchant might retain is on paper, for example printed reports or receipts, and these documents are not received electronically",
      "For e-commerce channels: all elements of the payment pages and forms delivered to the customer's browser originate only and directly from a PCI DSS compliant TPSP or payment processor",
      "Added in the January 2025 revision, for e-commerce channels: the merchant has confirmed that their site is not susceptible to attacks from scripts that could affect the merchant's e-commerce systems",
    ],
    notApplicable: ["Not applicable to face-to-face channels", "Not applicable to service providers"],
    requirementCount: 29,
    requirementCountNote:
      "The Council publishes three counts for SAQ A because the applicable requirements depend on the implementation: 11 where the merchant has no access to its own website, 27 where the merchant website redirects to the processor, and 29 where the merchant website embeds the processor's payment page or form in an iframe. The 29 shown here is the iframe case. All three predate the January 2025 revision, which removed Requirements 6.4.3, 11.6.1 and 12.3.1 from this SAQ.",
    requirementFamilies: [2, 3, 6, 8, 9, 11, 12],
    scan: "conditional",
    scanNote:
      "PCI DSS Requirement 11.3.2, quarterly external scanning by a PCI SSC Approved Scanning Vendor, is present in SAQ A under v4.x. It was not in SAQ A under v3.2.1. It is not applicable where the merchant has completely outsourced with no redirection mechanism and therefore has no systems in scope.",
    source: `${SRC_GUIDELINES}. January 2025 revision: ${SRC_SAQ_A_JAN_2025}. Scan requirement: ${SRC_SAQ_PDFS}`,
  },
  {
    id: "a-ep",
    label: "SAQ A-EP",
    title: "SAQ A-EP, partially outsourced e-commerce merchants using a third-party website for payment processing",
    whoItIsFor:
      "E-commerce merchants whose own website never receives card data but does affect the security of the payment page, which is where most self-hosted online stores actually sit.",
    channels: ["E-commerce"],
    eligibility: [
      "The merchant accepts only e-commerce transactions",
      "All processing of account data, with the exception of the payment page, is entirely outsourced to a PCI DSS compliant TPSP or payment processor",
      "The merchant's e-commerce website does not receive account data but controls how customers, or their account data, are redirected to a PCI DSS compliant TPSP or payment processor",
      "If the merchant website is hosted by a TPSP, the TPSP is compliant with all applicable PCI DSS requirements, including PCI DSS Appendix A if it is a multi-tenant hosting provider",
      "Each element of the payment pages delivered to the customer's browser originates from either the merchant's website or a PCI DSS compliant TPSP",
      "The merchant does not electronically store, process, or transmit any account data on merchant systems or premises",
      "The merchant has reviewed the PCI DSS Attestation of Compliance forms for its TPSPs and confirmed they are compliant for the services being used",
      "Any account data the merchant might retain is on paper and is not received electronically",
    ],
    notApplicable: ["Applicable only to e-commerce channels", "Not applicable to service providers"],
    requirementCount: 139,
    requirementCountNote:
      "139 PCI DSS v4.0 requirements, published by the Council in the e-commerce method table of the SAQ Instructions and Guidelines. Roughly five times the SAQ A iframe count, which is the whole reason the A versus A-EP question matters.",
    requirementFamilies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    scan: "yes",
    scanNote:
      "Requirement 11.3.2 is in Section 2 of SAQ A-EP: an external scan by a PCI SSC Approved Scanning Vendor at least once every three months, plus a scan after any significant change under 11.3.2.1.",
    source: `${SRC_GUIDELINES}. Scan requirement: ${SRC_SAQ_PDFS}`,
  },
  {
    id: "b",
    label: "SAQ B",
    title: "SAQ B, merchants with only imprint machines or only standalone dial-out terminals, no electronic account data storage",
    whoItIsFor:
      "Merchants whose only card acceptance is a knuckle-buster imprinter or a terminal that dials the processor over a phone line and touches nothing else.",
    channels: ["Card present", "Mail order and telephone order"],
    eligibility: [
      "The merchant uses only an imprint machine and/or only standalone, dial-out terminals, connected via a phone line to the merchant processor, to take customers' payment card information",
      "The standalone, dial-out terminals are not connected to any other systems within the merchant environment",
      "The standalone, dial-out terminals are not connected to the Internet",
      "The merchant does not store account data in electronic format",
      "Any account data the merchant might retain is on paper and is not received electronically",
    ],
    notApplicable: ["Not applicable to e-commerce channels", "Not applicable to service providers"],
    requirementCount: null,
    requirementCountNote:
      "The Council does not publish an item count for this SAQ, and counting rows out of the PDF does not reproduce the Council's own convention, so no count is given here. Count Section 2 of the current document if you need the figure.",
    requirementFamilies: [3, 7, 9, 12],
    scan: "no",
    scanNote:
      "SAQ B contains no Requirement 11 entries at all, so there is no quarterly ASV scan. Nothing in the environment is on the Internet, which is the point of the SAQ.",
    source: `${SRC_GUIDELINES}. Scan requirement: ${SRC_SAQ_PDFS}`,
  },
  {
    id: "b-ip",
    label: "SAQ B-IP",
    title: "SAQ B-IP, merchants with standalone, PCI-listed approved PTS POI devices, no electronic account data storage",
    whoItIsFor:
      "Merchants whose only card acceptance is a standalone terminal on an IP connection, approved under the PIN Transaction Security program and isolated from every other system.",
    channels: ["Card present", "Mail order and telephone order"],
    eligibility: [
      "The merchant uses only standalone, PCI-listed approved PTS point-of-interaction devices, excluding secure card readers (SCRs) and secure card readers for PIN (SCRPs), connected via IP to the payment processor",
      "The standalone, IP-connected POI devices are validated to the PTS POI program as listed on the PCI SSC website",
      "The standalone, IP-connected PTS POI devices are not connected to any other systems within the merchant environment, which can be achieved via network segmentation",
      "The only transmission of account data is from the approved PTS POI devices to the payment processor",
      "The PTS POI device does not rely on any other device, for example a computer, mobile phone or tablet, to connect to the payment processor",
      "The merchant does not store account data in electronic format",
      "Any account data the merchant might retain is on paper and is not received electronically",
    ],
    notApplicable: ["Not applicable to e-commerce channels", "Not applicable to service providers"],
    requirementCount: null,
    requirementCountNote:
      "The Council does not publish an item count for this SAQ. Count Section 2 of the current document if you need the figure.",
    requirementFamilies: [1, 2, 3, 6, 7, 8, 9, 11, 12],
    scan: "yes",
    scanNote:
      "Requirement 11.3.2 is in Section 2 of SAQ B-IP. The terminals are on an IP connection, so quarterly ASV scanning applies here and does not apply to the dial-out equivalent, SAQ B.",
    source: `${SRC_GUIDELINES}. Scan requirement: ${SRC_SAQ_PDFS}`,
  },
  {
    id: "c-vt",
    label: "SAQ C-VT",
    title: "SAQ C-VT, merchants with web-based third-party virtual payment terminal solutions, no electronic account data storage",
    whoItIsFor:
      "Merchants who key one transaction at a time into a hosted virtual terminal in a browser, on a computer that does nothing else and is connected to nothing else.",
    channels: ["Card present", "Mail order and telephone order"],
    eligibility: [
      "The only payment processing is via a virtual payment terminal accessed by an Internet-connected web browser",
      "The virtual payment terminal solution is provided and hosted by a PCI DSS compliant third-party service provider",
      "The PCI DSS compliant virtual payment terminal solution is only accessed via a computing device that is isolated in a single location, and is not connected to other locations or systems",
      "The computing device does not have software installed that causes account data to be stored, for example there is no software for batch processing or store-and-forward",
      "The computing device does not have any attached hardware devices that are used to capture or store account data, for example there are no card readers attached",
      "The merchant does not otherwise receive, transmit, or store account data electronically through any channels",
      "Any account data the merchant might retain is on paper and is not received electronically",
    ],
    notApplicable: ["Not applicable to e-commerce channels", "Not applicable to service providers"],
    requirementCount: null,
    requirementCountNote:
      "The Council does not publish an item count for this SAQ. Count Section 2 of the current document if you need the figure.",
    requirementFamilies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12],
    scan: "no",
    scanNote:
      "SAQ C-VT contains no Requirement 11 entries, so there is no quarterly ASV scan. The isolated computing device criterion is what earns that, and it is also the criterion most often broken in practice: the moment the machine is also used for email or sits on the shop network, the SAQ no longer applies.",
    source: `${SRC_GUIDELINES}. Scan requirement: ${SRC_SAQ_PDFS}`,
  },
  {
    id: "c",
    label: "SAQ C",
    title: "SAQ C, merchants with payment application systems connected to the Internet, no electronic account data storage",
    whoItIsFor:
      "Single-location merchants running a point-of-sale or other payment application that is on the Internet but segmented away from everything else.",
    channels: ["Card present", "Mail order and telephone order"],
    eligibility: [
      "The merchant has a payment application system and an Internet connection on the same device and/or same local area network",
      "The payment application system is not connected to any other systems within the merchant environment, which can be achieved via network segmentation",
      "The physical location of the point-of-sale environment is not connected to other premises or locations, and any local area network is for a single store only",
      "The merchant does not store account data in electronic format",
      "Any account data the merchant might retain is on paper and is not received electronically",
    ],
    notApplicable: ["Not applicable to e-commerce channels", "Not applicable to service providers"],
    requirementCount: null,
    requirementCountNote:
      "The Council does not publish an item count for this SAQ. It is one of the longer ones: Section 2 of SAQ C runs to nine of the twelve PCI DSS requirement families.",
    requirementFamilies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    scan: "yes",
    scanNote:
      "Requirement 11.3.2 is in Section 2 of SAQ C, along with 11.3.2.1 for scans after a significant change.",
    source: `${SRC_GUIDELINES}. Scan requirement: ${SRC_SAQ_PDFS}`,
  },
  {
    id: "p2pe",
    label: "SAQ P2PE",
    title: "SAQ P2PE, merchants using only payment terminals in a PCI-listed P2PE solution, no electronic account data storage",
    whoItIsFor:
      "Merchants whose terminals are part of a point-to-point encryption solution that appears on the PCI SSC list, so the card number is encrypted inside the reader and never reaches the merchant in the clear.",
    channels: ["Card present", "Mail order and telephone order"],
    eligibility: [
      "All payment processing is via a validated PCI-listed P2PE solution",
      "The only systems in the merchant environment that store, process, or transmit account data are the payment terminals from a validated PCI-listed P2PE solution",
      "The merchant does not otherwise receive, transmit, or store account data electronically",
      "Any account data the merchant might retain is on paper and is not received electronically",
      "The merchant has implemented all controls in the P2PE Instruction Manual provided by the P2PE solution provider",
    ],
    notApplicable: ["Not applicable to e-commerce channels", "Not applicable to service providers"],
    requirementCount: null,
    requirementCountNote:
      "The Council does not publish an item count for this SAQ. It is the shortest of the card-present questionnaires, which is the commercial argument for buying a listed P2PE solution rather than an ordinary terminal.",
    requirementFamilies: [3, 9, 12],
    scan: "no",
    scanNote:
      "SAQ P2PE contains no Requirement 11 entries, so there is no quarterly ASV scan. This only holds while the solution is still listed: a solution on the PCI list of Point-to-Point Solutions with Expired Validations is no longer validated, and the SAQ stops applying.",
    source: `${SRC_GUIDELINES}. Scan requirement: ${SRC_SAQ_PDFS}`,
  },
  {
    id: "spoc",
    label: "SAQ SPoC",
    title: "SAQ SPoC, merchants using only a PCI-listed approved PTS SCRP device and a COTS device as part of a validated PCI-listed SPoC solution",
    whoItIsFor:
      "Attended card-present merchants taking payments on an ordinary phone or tablet paired with an approved secure card reader that is part of a listed Software-based PIN entry on COTS solution.",
    channels: ["Card present, attended only"],
    eligibility: [
      "All payment processing is only via a card-present payment channel",
      "All cardholder data entry is via an SCRP that is part of a validated SPoC solution approved and listed by PCI SSC",
      "The only systems in the merchant's SPoC environment that store, process, or transmit account data are those used as part of the validated SPoC solution approved and listed by PCI SSC",
      "The merchant does not otherwise receive, transmit or store account data electronically",
      "This payment channel is not connected to any other systems or networks within the merchant environment",
      "Any account data the merchant might retain is on paper and is not received electronically",
      "The merchant has implemented all controls in the SPoC user guide provided by the SPoC solution provider",
    ],
    notApplicable: [
      "Not applicable to unattended card-present channels such as kiosks and self-checkout",
      "Not applicable to mail order and telephone order channels",
      "Not applicable to e-commerce channels",
      "Not applicable to service providers",
    ],
    requirementCount: null,
    requirementCountNote:
      "The Council does not publish an item count for this SAQ. It was new in PCI DSS v4.0 and the Council says it significantly reduces the number of applicable requirements for merchants using a listed SPoC solution.",
    requirementFamilies: null,
    scan: "unverified",
    scanNote:
      "Not asserted. Unlike the other eight questionnaires, the SAQ SPoC document could not be retrieved from the PCI SSC public listing from this machine, so its Requirement 11 content has not been read. What is documented: the mobile device need not be dedicated to payments, the payment channel must not be connected to any other merchant systems or networks, and merchants using non-PTS listed magnetic stripe readers are not eligible.",
    source: `${SRC_GUIDELINES}`,
  },
  {
    id: "d-merchant",
    label: "SAQ D for Merchants",
    title: "SAQ D for Merchants, all other SAQ-eligible merchants",
    whoItIsFor:
      "Every merchant that does not meet the criteria for one of the other questionnaires, including anyone who stores account data electronically or accepts card data on their own website.",
    channels: ["Any"],
    eligibility: [
      "SAQ D for Merchants applies to merchants that are eligible to complete a self-assessment questionnaire but do not meet the criteria for any other SAQ type",
      "Examples include e-commerce merchants that accept account data on their own website",
      "Merchants with electronic storage of account data",
      "Merchants that do not store account data electronically but that do not meet the criteria of another SAQ type",
      "Merchants with environments that might meet the criteria of another SAQ type, but that have additional PCI DSS requirements applicable to their environment",
    ],
    notApplicable: ["Not applicable to service providers, who use SAQ D for Service Providers"],
    requirementCount: null,
    requirementCountNote:
      "All PCI DSS requirements. The Council's e-commerce table gives the count for SAQ D as All PCI DSS Requirements rather than a number, so no number is published here.",
    requirementFamilies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    scan: "yes",
    scanNote:
      "Requirement 11.3.2 is in Section 2 of SAQ D for Merchants, along with internal scanning, penetration testing and every other requirement family in the standard.",
    source: `${SRC_GUIDELINES}. Scan requirement: ${SRC_SAQ_PDFS}`,
  },
  {
    id: "d-service-provider",
    label: "SAQ D for Service Providers",
    title: "SAQ D for Service Providers, SAQ-eligible service providers",
    whoItIsFor:
      "Service providers that a payment brand has defined as eligible to self-assess. It is the only SAQ a service provider may use.",
    channels: ["Any"],
    eligibility: [
      "SAQ D for Service Providers applies to all service providers defined by a payment brand as being eligible to complete a self-assessment questionnaire",
      "For service providers eligible to conduct a self-assessment, the only applicable SAQ is SAQ D for Service Providers",
      "For PCI DSS v4.0, SAQ D for Service Providers requires additional documentation in Section 2a and specifies that service providers describe results for each PCI DSS requirement",
    ],
    notApplicable: ["No other SAQ type may be used by a service provider"],
    requirementCount: null,
    requirementCountNote:
      "All PCI DSS requirements, plus the additional Section 2a documentation the Council added in v4.0. No number is published.",
    requirementFamilies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    scan: "yes",
    scanNote:
      "Requirement 11.3.2 applies. Most service providers are also required to validate to a payment brand rather than to an acquirer, and many are required to produce a Report on Compliance instead.",
    source: `${SRC_GUIDELINES}`,
  },
];

// ---------------------------------------------------------------------------
// The decision tree
// ---------------------------------------------------------------------------

export interface PciSaqOption {
  id: string;
  label: string;
  /** The detail that decides the answer, shown under the option. */
  hint?: string;
  /** SAQ ids this answer makes possible. */
  rulesIn: string[];
  /** SAQ ids this answer eliminates. */
  rulesOut: string[];
  /** Next question, or null when this answer settles it. */
  next: string | null;
  /** Set when the answer settles it outright. */
  resolvesTo?: string;
}

export interface PciSaqQuestion {
  id: string;
  question: string;
  /** Why this question is being asked, in one line. */
  help: string;
  options: PciSaqOption[];
}

const ALL_SAQ_IDS = PCI_SAQ_TYPES.map((t) => t.id);
const without = (...keep: string[]) => ALL_SAQ_IDS.filter((id) => !keep.includes(id));

/**
 * The tree follows the Council's own flow chart, "Which SAQ Best Applies to My
 * Environment?", pages 23 and 24 of the SAQ Instructions and Guidelines.
 *
 * ORDER IS LOAD BEARING. The Council asks about a service provider first, then
 * about electronic storage of account data, and only then about the acceptance
 * channel, because both of the first two answers override everything downstream.
 * A merchant who stores card numbers is on SAQ D no matter how the cards arrive,
 * and a tree that asks about checkout first will happily hand that merchant
 * SAQ A. Do not reorder these for a shorter path.
 */
export const PCI_SAQ_QUESTIONS: PciSaqQuestion[] = [
  {
    id: "entity",
    question: "Are you assessing a merchant or a service provider?",
    help: "A service provider is any entity that stores, processes or transmits account data on behalf of someone else, or that can affect the security of a payment. There is exactly one SAQ for service providers.",
    options: [
      {
        id: "merchant",
        label: "A merchant. We accept payments for our own sales.",
        rulesIn: without("d-service-provider"),
        rulesOut: ["d-service-provider"],
        next: "storage",
      },
      {
        id: "service-provider",
        label: "A service provider. We handle payments or payment security for other businesses.",
        hint: "Hosting providers, gateways, marketplaces of record, managed service providers with access to a client cardholder data environment.",
        rulesIn: ["d-service-provider"],
        rulesOut: without("d-service-provider"),
        next: null,
        resolvesTo: "d-service-provider",
      },
    ],
  },
  {
    id: "storage",
    question: "Does anything you run store account data electronically, including legacy data?",
    help: "Account data means the card number and anything on the magnetic stripe or chip. Legacy counts: an old order table, a CRM note, a call recording, a spreadsheet from a previous processor.",
    options: [
      {
        id: "no",
        label: "No. Nothing we run holds a card number electronically.",
        rulesIn: without("d-service-provider"),
        rulesOut: ["d-service-provider"],
        next: "channel",
      },
      {
        id: "yes",
        label: "Yes, or we are not certain.",
        hint: "Storage of account data puts you on SAQ D whatever else is true, so an uncertain answer here belongs on the yes side until somebody has actually looked.",
        rulesIn: ["d-merchant"],
        rulesOut: without("d-merchant"),
        next: null,
        resolvesTo: "d-merchant",
      },
    ],
  },
  {
    id: "channel",
    question: "Which payment channel are you assessing?",
    help: "One SAQ covers one channel. A shop that sells online and in person completes the finder twice and may well end up with two different questionnaires.",
    options: [
      {
        id: "ecommerce",
        label: "E-commerce. Customers pay on a website.",
        rulesIn: ["a", "a-ep", "d-merchant"],
        rulesOut: ["b", "b-ip", "c", "c-vt", "p2pe", "spoc", "d-service-provider"],
        next: "ecom",
      },
      {
        id: "moto",
        label: "Mail order or telephone order. Staff take the card details and key them in.",
        rulesIn: ["a", "b", "b-ip", "c", "c-vt", "p2pe", "d-merchant"],
        rulesOut: ["a-ep", "spoc", "d-service-provider"],
        next: "moto",
      },
      {
        id: "card-present",
        label: "Card present. The customer and the card are in front of you.",
        rulesIn: ["b", "b-ip", "c", "c-vt", "p2pe", "spoc", "d-merchant"],
        rulesOut: ["a", "a-ep", "d-service-provider"],
        next: "cp",
      },
    ],
  },
  {
    id: "ecom",
    question: "Where does the payment page come from?",
    help: "This is the question the whole page exists for. It is decided by what the customer's browser loads, not by who holds the card number.",
    options: [
      {
        id: "no-website",
        label: "We have no website of our own. The store is entirely hosted and managed by the processor.",
        hint: "The Council's smallest case: 11 applicable requirements.",
        rulesIn: ["a"],
        rulesOut: ["a-ep", "d-merchant"],
        next: null,
        resolvesTo: "a",
      },
      {
        id: "redirect",
        label: "Our site sends the customer away to the processor's own hosted checkout, then they come back.",
        hint: "A full page redirect to a URL on the processor's domain. 27 applicable requirements.",
        rulesIn: ["a"],
        rulesOut: ["a-ep", "d-merchant"],
        next: null,
        resolvesTo: "a",
      },
      {
        id: "iframe",
        label: "Our page embeds the processor's payment page in an iframe, and we add nothing to it.",
        hint: "Eligible for SAQ A only if you can also confirm the surrounding page is not susceptible to script attacks, an eligibility criterion added in January 2025. 29 applicable requirements.",
        rulesIn: ["a"],
        rulesOut: ["a-ep", "d-merchant"],
        next: null,
        resolvesTo: "a",
      },
      {
        id: "merchant-page-scripts",
        label: "Our own server delivers the payment page, or our page loads scripts that build or submit it.",
        hint: "Direct Post, a JavaScript SDK, hosted card fields dropped into our own form, a tag manager on the checkout page. Any of these is A-EP, not A.",
        rulesIn: ["a-ep"],
        rulesOut: ["a", "d-merchant"],
        next: null,
        resolvesTo: "a-ep",
      },
      {
        id: "own-systems",
        label: "Card data reaches our own servers, or we cannot say what runs on the checkout page.",
        rulesIn: ["d-merchant"],
        rulesOut: ["a", "a-ep"],
        next: null,
        resolvesTo: "d-merchant",
      },
    ],
  },
  {
    id: "moto",
    question: "How does the card number get captured on a mail or telephone order?",
    help: "Same question as the card-present one, minus the terminal in the customer's hand.",
    options: [
      {
        id: "fully-outsourced",
        label: "It does not reach us. The customer is sent a payment link or an invoice and pays the processor directly.",
        rulesIn: ["a"],
        rulesOut: ["b", "b-ip", "c", "c-vt", "p2pe", "d-merchant"],
        next: null,
        resolvesTo: "a",
      },
      {
        id: "dial-out",
        label: "Keyed into a standalone terminal that dials out over a phone line.",
        rulesIn: ["b"],
        rulesOut: ["a", "b-ip", "c", "c-vt", "p2pe", "d-merchant"],
        next: null,
        resolvesTo: "b",
      },
      {
        id: "p2pe",
        label: "Keyed into a terminal that is part of a validated, PCI-listed P2PE solution.",
        hint: "Check the PCI SSC list. A terminal that merely advertises encryption is not a listed P2PE solution.",
        rulesIn: ["p2pe"],
        rulesOut: ["a", "b", "b-ip", "c", "c-vt", "d-merchant"],
        next: null,
        resolvesTo: "p2pe",
      },
      {
        id: "ip-terminal",
        label: "Keyed into a standalone PTS-approved terminal on an IP connection, isolated from everything else.",
        rulesIn: ["b-ip"],
        rulesOut: ["a", "b", "c", "c-vt", "p2pe", "d-merchant"],
        next: null,
        resolvesTo: "b-ip",
      },
      {
        id: "virtual-terminal",
        label: "Typed into a hosted virtual terminal in a browser, on a computer that is isolated and does nothing else.",
        rulesIn: ["c-vt"],
        rulesOut: ["a", "b", "b-ip", "c", "p2pe", "d-merchant"],
        next: null,
        resolvesTo: "c-vt",
      },
      {
        id: "payment-app",
        label: "Typed into a payment application or point-of-sale system that is connected to the Internet.",
        rulesIn: ["c"],
        rulesOut: ["a", "b", "b-ip", "c-vt", "p2pe", "d-merchant"],
        next: null,
        resolvesTo: "c",
      },
      {
        id: "other",
        label: "None of these, or more than one of these on the same channel.",
        rulesIn: ["d-merchant"],
        rulesOut: ["a", "b", "b-ip", "c", "c-vt", "p2pe"],
        next: null,
        resolvesTo: "d-merchant",
      },
    ],
  },
  {
    id: "cp",
    question: "What takes the card in person?",
    help: "The hardware decides the questionnaire. Two terminals that look identical on the counter can sit in different SAQs depending on how they connect and whether the solution is listed.",
    options: [
      {
        id: "imprint-dial",
        label: "An imprint machine, or a standalone terminal that dials out over a phone line. Nothing on the Internet.",
        rulesIn: ["b"],
        rulesOut: ["b-ip", "c", "c-vt", "p2pe", "spoc", "d-merchant"],
        next: null,
        resolvesTo: "b",
      },
      {
        id: "p2pe",
        label: "A terminal that is part of a validated, PCI-listed P2PE solution.",
        hint: "Listed on the PCI SSC website and not expired, and you have implemented the P2PE Instruction Manual.",
        rulesIn: ["p2pe"],
        rulesOut: ["b", "b-ip", "c", "c-vt", "spoc", "d-merchant"],
        next: null,
        resolvesTo: "p2pe",
      },
      {
        id: "spoc",
        label: "A phone or tablet with an approved card reader, as part of a PCI-listed SPoC solution.",
        hint: "Attended card-present only. Not for kiosks, self-checkout, MOTO or e-commerce.",
        rulesIn: ["spoc"],
        rulesOut: ["b", "b-ip", "c", "c-vt", "p2pe", "d-merchant"],
        next: null,
        resolvesTo: "spoc",
      },
      {
        id: "ip-terminal",
        label: "A standalone PTS-approved terminal on an IP connection, isolated from every other system.",
        hint: "Excludes secure card readers and secure card readers for PIN, and excludes any reader that reaches the processor through a till or a computer.",
        rulesIn: ["b-ip"],
        rulesOut: ["b", "c", "c-vt", "p2pe", "spoc", "d-merchant"],
        next: null,
        resolvesTo: "b-ip",
      },
      {
        id: "payment-app",
        label: "A point-of-sale or payment application on the Internet, at a single location, segmented from other systems.",
        rulesIn: ["c"],
        rulesOut: ["b", "b-ip", "c-vt", "p2pe", "spoc", "d-merchant"],
        next: null,
        resolvesTo: "c",
      },
      {
        id: "virtual-terminal",
        label: "A browser-based virtual terminal on an isolated computer, keyed one sale at a time.",
        rulesIn: ["c-vt"],
        rulesOut: ["b", "b-ip", "c", "p2pe", "spoc", "d-merchant"],
        next: null,
        resolvesTo: "c-vt",
      },
      {
        id: "other",
        label: "Multiple locations on one network, tills connected to back office systems, or anything else.",
        rulesIn: ["d-merchant"],
        rulesOut: ["b", "b-ip", "c", "c-vt", "p2pe", "spoc"],
        next: null,
        resolvesTo: "d-merchant",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Merchant levels
// ---------------------------------------------------------------------------

export interface PciMerchantLevel {
  level: 1 | 2 | 3 | 4;
  label: string;
  /** Visa's own words for the threshold. */
  visaCriteria: string;
  /** Mastercard's own words for the threshold. */
  mastercardCriteria: string;
  validation: string;
  /**
   * Machine-readable thresholds, in transactions per year. `null` means the
   * side is unbounded. `total` is all transactions across all channels;
   * `ecommerce` is the e-commerce subset, which is the only thing that
   * separates Level 3 from Level 4.
   */
  minTotal: number | null;
  minEcommerce: number | null;
  source: string;
}

export const PCI_MERCHANT_LEVELS: PciMerchantLevel[] = [
  {
    level: 1,
    label: "Level 1",
    visaCriteria: "Over 6 million Visa transactions annually across all channels.",
    mastercardCriteria:
      "Greater than six million total combined Mastercard and Maestro transactions annually, any merchant meeting Visa's Level 1 criteria, and any merchant Mastercard determines should meet Level 1 requirements, which may include any merchant with a confirmed account data compromise event.",
    validation:
      "Annual on-site assessment producing a Report on Compliance signed by a QSA or a PCI SSC certified Internal Security Assessor, quarterly network scans by an Approved Scanning Vendor, and an Attestation of Compliance.",
    minTotal: 6_000_001,
    minEcommerce: null,
    source: `${SRC_VISA}. ${SRC_MASTERCARD}`,
  },
  {
    level: 2,
    label: "Level 2",
    visaCriteria: "1 million to 6 million Visa transactions annually across all channels.",
    mastercardCriteria:
      "Greater than one million but less than or equal to six million total combined Mastercard and Maestro transactions annually, and any merchant meeting Visa's Level 2 criteria.",
    validation:
      "Annual SAQ, quarterly ASV scans and an Attestation of Compliance. Mastercard adds that a Level 2 merchant completing SAQ A, SAQ A-EP or SAQ D must additionally engage a QSA or an Internal Security Assessor for validation.",
    minTotal: 1_000_001,
    minEcommerce: null,
    source: `${SRC_VISA}. ${SRC_MASTERCARD}`,
  },
  {
    level: 3,
    label: "Level 3",
    visaCriteria: "20,000 to 1 million Visa e-commerce transactions annually.",
    mastercardCriteria:
      "Greater than 20,000 but less than or equal to one million total combined Mastercard and Maestro e-commerce transactions annually, and any merchant meeting Visa's Level 3 criteria.",
    validation:
      "Annual SAQ, quarterly ASV scans and an Attestation of Compliance. Mastercard does not require a Level 3 merchant to submit its validation to Mastercard, though the acquirer usually does.",
    minTotal: null,
    minEcommerce: 20_001,
    source: `${SRC_VISA}. ${SRC_MASTERCARD}`,
  },
  {
    level: 4,
    label: "Level 4",
    visaCriteria:
      "Fewer than 20,000 Visa e-commerce transactions annually, and all other merchants processing up to 1 million Visa transactions annually.",
    mastercardCriteria:
      "Any merchant not deemed to be a Level 1, Level 2 or Level 3 merchant. Compliance with PCI DSS is required, but validation to Mastercard is not, except where law or regulation requires it.",
    validation:
      "Annual SAQ and quarterly ASV scans where applicable, as defined by the acquirer. This is where the great majority of US merchants sit, and where the acquirer, not the card network, sets the paperwork.",
    minTotal: null,
    minEcommerce: null,
    source: `${SRC_VISA}. ${SRC_MASTERCARD}`,
  },
];

// ---------------------------------------------------------------------------
// Widget defaults
// ---------------------------------------------------------------------------

export interface PciSaqDefaults {
  mode: "saq" | "level" | "types";
  /** Question id to option id. Chosen so the finder resolves on first render. */
  answers: Record<string, string>;
  totalAnnualTransactions: number;
  ecommerceAnnualTransactions: number;
  hadCompromise: boolean;
}

/**
 * The defaults ARE the worked example on the page, deliberately. The widget is a
 * client island rendered on the server with these values, so the initial HTML
 * carries the same figures the worked example prose quotes, and the two cannot
 * drift apart without somebody noticing.
 */
export const PCI_SAQ_DEFAULTS: PciSaqDefaults = {
  mode: "saq",
  answers: {
    entity: "merchant",
    storage: "no",
    channel: "ecommerce",
    ecom: "merchant-page-scripts",
  },
  totalAnnualTransactions: 41_000,
  ecommerceAnnualTransactions: 26_400,
  hadCompromise: false,
};
