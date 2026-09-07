import type { ToolDef } from "@/lib/tools";

/**
 * PCI SAQ Level Finder.
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation-and-lookup half of the PCI
 * cluster: "which SAQ do I need", "PCI SAQ types", "PCI compliance level
 * calculator", "SAQ A vs SAQ A-EP". Definitions stay in `/glossary/pci-dss` and
 * the neighboring glossary entries, and the page ends by linking into them.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Three things, all checkable:
 *
 *   1. It conflates merchant level with SAQ type. They are set by different
 *      bodies (the card networks and the PCI SSC), decided by different inputs
 *      (annual transaction count and acceptance method) and answer different
 *      questions (how you validate and which form you fill in). Most pages
 *      present "Level 4" as if it were the answer to "which SAQ do I need".
 *
 *   2. It reads the Level 3 threshold against total transaction volume. Level 3
 *      is an E-COMMERCE count. A card-present shop with 900,000 in-store sales
 *      and 400 online is Level 4, and pages that add the two make it Level 3.
 *
 *   3. It still says SAQ A requires no vulnerability scanning. That was true
 *      under PCI DSS v3.2.1. Requirement 11.3.2, quarterly external scanning by
 *      an Approved Scanning Vendor, is in Section 2 of SAQ A under v4.x.
 *
 * WHERE THE NUMBERS CAME FROM. The SAQ descriptions, eligibility criteria and
 * the 11, 27, 29 and 139 requirement counts are the PCI SSC's own, from the SAQ
 * Instructions and Guidelines v4.0 of September 2023. The January 2025 SAQ A
 * revision is from the Council's own bulletin and FAQ 1588. The requirement
 * families each questionnaire covers were read off the published SAQ documents.
 * The merchant levels are Visa's compliance validation page and section 2.2.2 of
 * the Mastercard Security Rules and Procedures, Merchant Edition. Sources and
 * dates are in `lib/tools-data/pci.ts` and in the assumptions block below.
 *
 * SCOPE LIMIT, LOAD BEARING. This page indicates a likely SAQ and merchant level
 * from the answers given. It is not a compliance determination and must never be
 * written as one. Nothing here may read as a certification, and the tool does
 * not tell anyone they are compliant.
 */
export const PCI_SAQ_TOOL: ToolDef = {
  slug: "pci-saq-level-finder",
  name: "PCI SAQ Level Finder",
  h1: "PCI SAQ Level Finder: which SAQ do I need?",
  title: "PCI SAQ Level Finder | Find Your Required SAQ",
  description:
    "Use our PCI SAQ Level Finder to identify the right PCI DSS self-assessment questionnaire and merchant level based on how you accept payments.",
  intro:
    "Which SAQ you need is decided by how you accept payments. How you validate is decided by how much you process. Those are two different classifications, and mixing them up is why this question is hard to answer online. Merchant level, 1 to 4, comes from annual transaction count per card brand. SAQ type, A through D, comes from your checkout, your terminal or your virtual terminal. Nearly every small US merchant is Level 4 and still has to pick the right SAQ. The PCI SAQ Level Finder answers both, separately, against PCI DSS v4.0.1.",
  tier: 2,
  summary: "The likely SAQ for your payment channel and your merchant level, kept apart, against PCI DSS v4.0.1.",
  widget: "pci-saq",
  workedExample: {
    scenario:
      "Fern and Filament, a plant shop in Portland, sells online through its own storefront and takes cards at the counter on a standalone IP-connected terminal. Last year it settled 41,000 Visa and Mastercard transactions, 26,400 of them online. Checkout is the processor's hosted card fields dropped into a form the shop's own server delivers, with the processor's JavaScript running on that page.",
    result:
      "Two answers, and they come from different inputs. On merchant level: 41,000 total transactions is far below the 1 million line, so Levels 1 and 2 are out, but 26,400 e-commerce transactions is above the 20,000 line, so this is a Level 3 merchant rather than the Level 4 the owner assumed. That is 6,400 online transactions above the threshold: online volume would have to fall by 6,400 to drop back to Level 4, and total volume would have to rise by 959,001 to reach Level 2. On SAQ type, the shop needs two, one per payment channel. The e-commerce channel is SAQ A-EP, not SAQ A, because the payment page is delivered by the shop's own server and loads a script that builds it, which fails the SAQ A criterion that every element of the payment page originate only and directly from the processor. That is 139 PCI DSS requirements against the 29 the shop would have answered on SAQ A. The counter channel, a standalone PTS-approved terminal on an IP connection with nothing else attached, is SAQ B-IP. Both channels carry Requirement 11.3.2, a quarterly external scan by an Approved Scanning Vendor.",
  },
  sections: [
    {
      heading: "Which SAQ do I need, and what actually decides it",
      body: [
        "One input decides it: how account data reaches you in the channel you are assessing. Not your revenue, not your headcount, not your processor. The PCI Security Standards Council publishes nine self-assessment questionnaires: eight for merchants, and SAQ D for Service Providers, which is the only one a service provider may ever use.",
        "The Council's flow chart, on pages 23 and 24 of the SAQ Instructions and Guidelines, asks three things in a fixed order. Are you a service provider. Do you store any account data electronically, including legacy data. And how do you accept payments. The order is not cosmetic: storing card numbers puts you on SAQ D whatever your checkout looks like, so a tool that asks about checkout first will hand a merchant with an old order table full of card numbers the shortest questionnaire in the set. The PCI SAQ Level Finder asks in the Council's order for that reason.",
        "One SAQ covers one payment channel, not one business. A shop that sells online and takes cards at a counter runs the finder twice and usually ends up with two different questionnaires. The Council adds that merchants with more than one channel should ask their acquirer and payment brands how to report the combination.",
        "The eligibility criteria are attestations, not descriptions. Completing SAQ C-VT means signing that the computer running the virtual terminal is isolated in a single location, connected to no other systems, with no software that stores account data and no card reader attached. That is the criterion most often untrue in practice: the moment the back office machine also does email and sits on the shop network, SAQ C-VT stops applying and nothing tells you.",
      ],
    },
    {
      heading: "SAQ A vs SAQ A-EP, the distinction most online stores get wrong",
      body: [
        "The test is one sentence in the eligibility criteria, and it is about the browser rather than the card number. For SAQ A, all elements of the payment page delivered to the customer's browser must originate only and directly from a PCI DSS compliant third-party service provider. For SAQ A-EP, each element originates from either the merchant's website or a compliant provider. Neither lets account data touch merchant systems.",
        "The Council gives its own examples. A merchant with no access to its own website, a website that redirects to the processor, and a website that embeds the processor's payment page in an iframe are all SAQ A, carrying 11, 27 and 29 applicable requirements. A site that creates the payment form and posts the data straight from the browser, often called Direct Post, and a site that loads a script supporting creation of the payment page, are both SAQ A-EP, which is 139 requirements. Roughly five times the iframe case, and the most expensive misclassification available to a small online merchant.",
        "In practice the trap is modern checkout tooling. Hosted card fields dropped into a form your own template renders, a payment SDK loaded from a script tag, a tag manager that can inject anything onto the checkout page: each is an element of the payment page originating from your website. The processor may still describe the integration as reducing PCI scope, which is true against taking raw card numbers, but reducing scope to SAQ A-EP is not reducing it to SAQ A.",
        "There is a second reason the distinction matters more than it used to. SAQ A under PCI DSS v4.x carries Requirement 11.3.2, an external vulnerability scan performed at least once every three months by a PCI SSC Approved Scanning Vendor, plus 11.3.2.1 for a scan after any significant change. SAQ A required no scanning under v3.2.1, and a great deal of published guidance has not caught up. If a page tells you SAQ A means no scans, check its date.",
      ],
    },
    {
      heading: "Merchant level 1 to 4 is a different question with a different answer",
      body: [
        "Merchant levels are card network classifications, not PCI SSC ones, and the two networks define them in almost the same words. Visa puts Level 1 at over 6 million transactions a year across all channels, Level 2 at 1 million to 6 million, Level 3 at 20,000 to 1 million e-commerce transactions, and Level 4 at everything below. Mastercard mirrors those numbers for combined Mastercard and Maestro volume and adds that meeting Visa's criteria at a level meets Mastercard's too.",
        "The denominator is where published calculators go wrong. Levels 1 and 2 are decided on all transactions across every channel. Level 3 is decided only on the e-commerce subset. A hardware store with 900,000 card-present sales and 400 online sales has a 900,400 total, nowhere near the 1 million line, and 400 e-commerce transactions, nowhere near the 20,000 line. It is Level 4. Read that total against the Level 3 line and you have told the shop it needs validation it does not need.",
        "The two networks also disagree at exactly one number. Mastercard's rule is greater than 20,000 e-commerce transactions for Level 3. Visa's page describes Level 3 as 20,000 to 1 million and Level 4 as fewer than 20,000, which claims 20,000 for both. The PCI SAQ Level Finder uses the strict Mastercard reading, so exactly 20,000 returns Level 4, and it flags the tie on screen rather than pretending the boundary is crisp. If you are within a few hundred transactions of it, ask your acquirer instead of picking the answer you prefer.",
        "What the level changes is the validation route, not the security. A Level 1 merchant undergoes an annual assessment producing a Report on Compliance signed by a Qualified Security Assessor or a certified Internal Security Assessor. Levels 2, 3 and 4 complete a questionnaire, though Mastercard requires a Level 2 merchant completing SAQ A, A-EP or D to additionally engage a QSA or ISA. Your acquirer assigns the level, per brand, so you can be Level 2 at one network and Level 4 at another. Mastercard also reserves the right to deem any merchant Level 1 at its discretion, including after a confirmed compromise.",
      ],
    },
    {
      heading: "What PCI DSS v4.0.1 changed, and the date that already passed",
      body: [
        "PCI DSS v4.0.1 is the only active version of the standard. It was published as a limited revision in June 2024 with no new or deleted requirements, v4.0 was retired at the end of December 2024, and the Council opened a request for comments on v4.0.1 in June 2026 to begin the next iteration. The date that matters more than the version number is 31 March 2025, when the future-dated requirements in v4.x stopped being best practice and became mandatory.",
        "Two of them are about the payment page, and they are why the SAQ A question got sharper. Requirement 6.4.3 makes a merchant manage every script loaded and executed in the consumer's browser on the payment page: authorize it, justify it, keep an inventory. Requirement 11.6.1 requires a change and tamper detection mechanism that alerts on unauthorized modification to the payment page and its HTTP headers. Requirement 12.3.1 requires a targeted risk analysis supporting the frequency chosen for 11.6.1. Together they are the standard's answer to digital skimming.",
        "SAQ A was revised twice in quick succession because of them. The October 2024 version included all three. The January 2025 revision, effective 31 March 2025, removed them and added an eligibility criterion instead: the merchant has confirmed that their site is not susceptible to attacks from scripts that could affect the merchant's e-commerce systems. FAQ 1588 says a merchant confirms that either by deploying protections itself, using techniques such as those in 6.4.3 and 11.6.1, or by getting written confirmation from its processor that the embedded solution includes them. It applies to embedded payment pages, not full redirects. Removing a requirement from a questionnaire does not remove it from the standard.",
        "Requirement 11.3.2, the quarterly Approved Scanning Vendor scan, is the other v4.x change worth knowing before you budget. It appears in Section 2 of SAQ A, A-EP, B-IP, C and D for Merchants, and not at all in SAQ B, C-VT or P2PE, which contain no Requirement 11 entries. That is the clearest commercial argument for a listed point-to-point encryption solution or a genuinely dial-out terminal: not only a shorter questionnaire but a recurring scanning bill you never open.",
      ],
    },
    {
      heading: "When the answer means act, and when it means do nothing",
      body: [
        "Most of the time it means do nothing. If the PCI SAQ Level Finder names the questionnaire you already file, your acquirer agrees, and you can genuinely confirm every criterion on the eligibility list, you are done for the year. A single-location shop on a validated PCI-listed P2PE solution is the cleanest case in the standard: SAQ P2PE touches three of the twelve requirement families and carries no external scanning.",
        "Act if the finder says SAQ A-EP and you have been filing SAQ A. There are two honest routes. You can re-scope, moving to a full redirect or an iframe you add nothing to, and become genuinely eligible for SAQ A. Or you can accept SAQ A-EP and work through 139 requirements, which is a real project and a real budget. The third option, filing SAQ A because nobody has asked, holds up until a forensic investigator reads your checkout page after an incident, at which point the attestation you signed is the problem.",
        "Act if you have crossed a level line. Mastercard gives an explicit grace period: when a merchant transitions from one level to another because volume grew, the acquirer must ensure compliance with the new level as soon as practical and in any event within one year of the event that caused it. A merchant who went from 18,000 to 26,000 online transactions has that year, not forever.",
        "Finally, act if a line on your statement is doing the work instead of you. A monthly PCI non-compliance fee is not a compliance program and paying it does not validate anything. Neither does a bundled breach insurance product sold as PCI protection. Work out which questionnaire you are actually eligible for first, then decide what you are buying, and price the fees separately. The junk fee calculator on this site itemizes what those lines usually are.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Every PCI DSS v4.0.1 self-assessment questionnaire, the channels it may be used for, and whether it carries the quarterly Approved Scanning Vendor scan. The descriptions and channels are the PCI SSC's own, from the SAQ Instructions and Guidelines. The requirement family counts and the scan column were read off the published questionnaires by this site, not published as a table by the Council.",
    columns: ["Who it is for", "Channels", "Requirement families", "Quarterly ASV scan"],
    rows: [
      {
        label: "SAQ A",
        note: "All account data functions fully outsourced. 11, 27 or 29 requirements depending on whether you have no website, a redirect or an iframe.",
        values: [
          "Card-not-present merchants whose payment page comes entirely and directly from the processor",
          "E-commerce, mail order and telephone order",
          "7 of 12",
          "Yes, where systems are in scope",
        ],
      },
      {
        label: "SAQ A-EP",
        note: "Partially outsourced e-commerce. 139 requirements.",
        values: [
          "Merchants whose own website does not receive account data but does affect the payment page",
          "E-commerce only",
          "12 of 12",
          "Yes",
        ],
      },
      {
        label: "SAQ B",
        note: "No Requirement 11 entries at all.",
        values: [
          "Imprint machines, or standalone terminals that dial out over a phone line and connect to nothing else",
          "Card present, mail order and telephone order",
          "4 of 12",
          "No",
        ],
      },
      {
        label: "SAQ B-IP",
        note: "Excludes secure card readers and secure card readers for PIN.",
        values: [
          "Standalone PCI-listed approved PTS point-of-interaction devices on an IP connection, isolated from other systems",
          "Card present, mail order and telephone order",
          "9 of 12",
          "Yes",
        ],
      },
      {
        label: "SAQ C-VT",
        note: "The isolated computing device criterion is the one most often broken.",
        values: [
          "Merchants keying one sale at a time into a hosted virtual terminal on an isolated computer",
          "Card present, mail order and telephone order",
          "10 of 12",
          "No",
        ],
      },
      {
        label: "SAQ C",
        note: "Single store only, and the payment application must be segmented from other systems.",
        values: [
          "Merchants with a payment application or point-of-sale system connected to the Internet",
          "Card present, mail order and telephone order",
          "12 of 12",
          "Yes",
        ],
      },
      {
        label: "SAQ P2PE",
        note: "Only while the solution is still listed. An expired validation ends eligibility.",
        values: [
          "Merchants using only terminals from a validated, PCI-listed point-to-point encryption solution",
          "Card present, mail order and telephone order",
          "3 of 12",
          "No",
        ],
      },
      {
        label: "SAQ SPoC",
        note: "New in PCI DSS v4.0. Attended card present only, not kiosks or self-checkout.",
        values: [
          "Merchants using an approved PTS SCRP reader with a phone or tablet, as part of a listed SPoC solution",
          "Card present, attended only",
          "Not counted here",
          "Not verified here",
        ],
      },
      {
        label: "SAQ D for Merchants",
        note: "Where you land if you store account data electronically, or accept it on your own site.",
        values: [
          "Every merchant that does not meet the criteria for one of the questionnaires above",
          "Any",
          "12 of 12",
          "Yes",
        ],
      },
      {
        label: "SAQ D for Service Providers",
        note: "The only SAQ a service provider may use.",
        values: [
          "Service providers a payment brand has defined as eligible to self-assess",
          "Any",
          "12 of 12",
          "Yes",
        ],
      },
    ],
  },
  assumptions: [
    "This tool indicates a LIKELY SAQ and merchant level from the answers you give. It is not a compliance determination, it does not certify anything, and it is not a substitute for reading the eligibility criteria in the questionnaire itself. Your acquirer sets your obligations and a Qualified Security Assessor validates them.",
    "SAQ descriptions, eligibility criteria and the 11, 27, 29 and 139 requirement counts are the PCI Security Standards Council's own, from the PCI DSS Self-Assessment Questionnaire Instructions and Guidelines v4.0 of September 2023, pages 4 to 24, checked 5 September 2026. The Council sets its SAQ headings with en dashes and uses curly quotes; both have been replaced with commas, colons and straight quotes for house style, and nothing else was reworded.",
    "The Council publishes an item count for SAQ A and SAQ A-EP only. No item count is given here for any other questionnaire, because counting requirement rows out of the published PDFs does not reproduce the Council's own convention: a count of level three requirement identifiers in SAQ A-EP returns 108 against the published 139. The requirement family column is a different measure entirely, and it is this site's count of how many of the twelve PCI DSS requirement families appear in Section 2 of each published questionnaire, read on 5 September 2026.",
    "SAQ SPoC is the one row with gaps. Unlike the other eight questionnaires, its document could not be retrieved from the PCI SSC public listing from this machine, so neither its requirement family count nor whether it carries the quarterly scan is asserted here. Its description and eligibility criteria come from the SAQ Instructions and Guidelines, which is complete on both.",
    "The January 2025 SAQ A revision, effective 31 March 2025, removed Requirements 6.4.3, 11.6.1 and 12.3.1 from SAQ A and added an eligibility criterion about susceptibility to script attacks in their place. That is from the PCI SSC's own announcement and its FAQ 1588, checked 5 September 2026. Removing a requirement from a questionnaire does not remove it from PCI DSS: the three requirements remain in the standard and became effective on 31 March 2025.",
    "Merchant levels are Visa's and Mastercard's, not the PCI SSC's. The Visa thresholds are from Visa's compliance validation pages, checked 5 September 2026. The Mastercard thresholds, the validation requirements and the one-year transition allowance are from the Mastercard Security Rules and Procedures, Merchant Edition, 6 August 2024, section 2.2.2, read from a Moneris-hosted copy because mastercard.com refuses requests from this machine, checked 5 September 2026. American Express and Discover run their own programs with their own thresholds, which this tool does not model.",
    "The finder assesses one payment channel at a time, because one SAQ covers one channel. A business with more than one channel runs it more than once and may hold more than one questionnaire. Levels are also per card brand, and where they differ the strictest applies in practice, because the acquirer runs one compliance program per account.",
    "This is an indication from the answers you entered, not a quote and not a compliance determination. Your acquirer is the authority on what you actually have to validate.",
  ],
  faqs: [
    {
      question: "Which SAQ do I need?",
      answer:
        "It depends on how account data reaches you in the channel you are assessing, not on your size. Store card numbers electronically and it is SAQ D whatever else is true. Otherwise: a fully outsourced online checkout is SAQ A, a checkout your own server delivers is SAQ A-EP, a dial-out terminal is SAQ B, an IP-connected PTS terminal is SAQ B-IP, a listed P2PE solution is SAQ P2PE, a hosted virtual terminal on an isolated computer is SAQ C-VT, and an Internet-connected payment application is SAQ C.",
    },
    {
      question: "What is the difference between SAQ A and SAQ A-EP?",
      answer:
        "Where the payment page comes from. SAQ A requires that every element delivered to the customer's browser originates only and directly from your compliant processor, which covers a full redirect or a plain iframe. If your own website delivers the payment page or loads a script that builds or submits it, that is SAQ A-EP. The workload difference is large: 29 requirements for the iframe case against 139 for SAQ A-EP.",
    },
    {
      question: "What PCI compliance level am I?",
      answer:
        "Level 1 is more than 6 million transactions a year across all channels. Level 2 is 1 million to 6 million. Level 3 is more than 20,000 e-commerce transactions a year with a total under 1 million. Level 4 is everything else, which is nearly every small US merchant. The Level 3 line counts online transactions only, so a shop with 900,000 in-store sales and 400 online sales is Level 4, not Level 3.",
    },
    {
      question: "Does SAQ A require a vulnerability scan?",
      answer:
        "Under PCI DSS v4.x, yes, where you have systems in scope. Requirement 11.3.2 is in Section 2 of SAQ A: an external scan at least once every three months by a PCI SSC Approved Scanning Vendor, plus 11.3.2.1 after any significant change. SAQ A required no scanning under v3.2.1, which is why a lot of older guidance says otherwise. SAQ B, SAQ C-VT and SAQ P2PE contain no Requirement 11 entries at all.",
    },
    {
      question: "How many PCI SAQ types are there?",
      answer:
        "Nine in PCI DSS v4.0.1. Eight are for merchants: A, A-EP, B, B-IP, C-VT, C, P2PE and SPoC, plus SAQ D for Merchants as the catch-all. The ninth, SAQ D for Service Providers, is the only questionnaire a service provider may use. SAQ SPoC was added in v4.0 for merchants using an approved secure card reader with an ordinary phone or tablet as part of a listed solution.",
    },
    {
      question: "Can I choose which SAQ to complete?",
      answer:
        "No. You confirm you meet every eligibility criterion for a questionnaire before you start it, and the Council tells entities to check with the acquirer or payment brand that they are eligible first. Signing SAQ A when your own site delivers the payment page is a false attestation, and it is the document a forensic investigator reads first after an incident. Being on the right questionnaire is worth more than being on the short one.",
    },
  ],
  related: [
    "merchant-account-junk-fee-calculator",
    "chargeback-cost-calculator",
    "high-risk-merchant-account-cost-calculator",
    "effective-rate-calculator",
    "credit-card-processing-savings-calculator",
  ],
  links: [
    { label: "What PCI DSS is, in plain terms", href: "/glossary/pci-dss" },
    { label: "Tokenization, and how it cuts scope", href: "/glossary/tokenization" },
    { label: "Hosted checkout explained", href: "/glossary/hosted-checkout" },
    { label: "What a virtual terminal is", href: "/glossary/virtual-terminal" },
    { label: "How this site sources and checks its numbers", href: "/methodology" },
  ],
  cta: {
    heading: "Now check what compliance is costing you",
    body: "A PCI non-compliance fee, a monthly PCI program fee and a breach insurance line can all sit on one statement without any of them validating anything. Itemize them before you decide what to buy.",
    label: "Check your statement fees",
  },
};
