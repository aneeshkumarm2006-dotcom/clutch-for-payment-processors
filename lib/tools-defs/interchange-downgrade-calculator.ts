import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/interchange-downgrade-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on downgrades:
 * "interchange downgrade", "downgrade calculator", "why did my transaction
 * downgrade", "what does a downgrade cost", "level 2 level 3 savings
 * calculator". Per the anti-cannibalisation rule in `lib/tools.ts`, it does NOT
 * reach for "what is interchange" (that is `/glossary/interchange`), for
 * "interchange plus vs flat rate" (that is the sibling tool and the facet), or
 * for any brand's pricing.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Three things, all checkable.
 *
 *   1. Nobody prices it. The pages ranking for "interchange downgrade" are ISO
 *      and gateway blog posts that list the causes and stop, or that offer a
 *      free statement audit behind an email form. Not one of them multiplies a
 *      named cause by a merchant's own volume.
 *   2. The ones that do quote a cost quote a single vague band, "0.3% to 1%",
 *      with no source. A downgrade has no price of its own: it is the gap
 *      between two rows on a rate sheet, and which two rows depends entirely on
 *      the card. Every figure on this page is a subtraction between two rows
 *      that are quoted verbatim beside it.
 *   3. They are stale on the biggest change in years. Visa's Commercial
 *      Enhanced Data Program replaced Level 3 with Commercial Product 3 in
 *      October 2025 and retired the general Commercial Level II program in
 *      April 2026. Pages still telling a B2B merchant to "send Level 2 data to
 *      Visa" are describing a program that no longer has a rate.
 *
 * WHERE THE NUMBERS CAME FROM. Two primary rate sheets, both read for this page:
 * Visa USA Interchange Reimbursement Fees, rates effective 18 April 2026, from
 * usa.visa.com; and Mastercard 2026 to 2027 U.S. Region Interchange Programs and
 * Rates, effective 17 April 2026, read from the Internet Archive because
 * mastercard.com returns HTTP 403 to this machine. Every row is in
 * `lib/tools-data/downgrades.ts` with its own source string. The arithmetic is
 * `lib/calc/downgrade.ts` and every figure in `workedExample` below was produced
 * by running it, not by hand.
 */

const NOT_ADVICE =
  "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.";

export const INTERCHANGE_DOWNGRADE_TOOL: ToolDef = {
  slug: "interchange-downgrade-calculator",
  name: "Interchange Downgrade Cost Calculator",
  h1: "Interchange Downgrade Cost Calculator",
  title: "Interchange Downgrade Cost Calculator | Calculate Fees",
  description:
    "Use our interchange downgrade cost calculator to estimate downgrade fees, Level 2 and Level 3 data savings, and the cost of payment processing rate downgrades.",
  intro:
    "An interchange downgrade is what happens when a transaction fails to qualify for the interchange program it was eligible for and clears in a more expensive one instead. It has no price of its own. The cost is the gap between two rows on a network rate sheet, so it depends entirely on the card. On Visa's April 2026 schedule a corporate card sent without enhanced data falls from Commercial Product 3 at 1.75% plus 10 cents to Commercial Card Not Present at 2.70% plus 10 cents, which is 95 basis points on that sale. The Interchange Downgrade Cost Calculator prices each cause against your own volume and ranks them.",
  tier: 2,
  summary:
    "What each downgrade cause costs you a year, priced off two published rate sheet rows, ranked worst first.",
  widget: "downgrade",
  workedExample: {
    scenario:
      "Fairview Supply is a plumbing wholesaler running $250,000 a month across 1,000 card sales, an average ticket of $250. Forty five percent of that volume, $112,500, is on corporate and purchasing cards from contractor accounts, and the gateway sends Level 1 data only. Two other things are wrong. One of three counter terminals never auto-closes, so about 5 percent of volume settles more than 48 hours after authorization. And a failing chip reader means staff key about 8 percent of sales by hand.",
    result:
      "The Interchange Downgrade Cost Calculator prices the three causes worst first. The stale batch has the biggest per dollar delta: Mastercard Merit III Base at 1.65% plus 10 cents becomes Standard at 3.15% plus 10 cents, a fall of 1.50 points, and on $12,500 of affected volume that is $187.50 a month. The missing enhanced data is the biggest line: 0.95 points on $112,500 is $1,068.75 a month, or $12,825 a year from one gateway setting. Keying at the counter moves Visa CPS/Retail Debit at 0.80% plus 15 cents to CPS/Retail Key Entry Debit at 1.65% plus 15 cents, 0.85 points on $20,000, which is $170.00 a month. Total $1,426.25 a month, $17,115 a year, and 57.05 basis points added to the effective rate on every dollar Fairview takes, not just the 58 percent that downgraded. The second mode prices the fix rather than the fault, and gives a slightly smaller number for the same enhanced data line: $12,150 a year on Visa and $10,800 on Mastercard, against the $12,825 above. The difference is the Commercial Enhanced Data Program participation fee of 5 basis points on enhanced data submissions, which is $675 a year on $112,500 a month and which mode one has no reason to charge because Fairview is not sending enhanced data yet.",
  },
  sections: [
    {
      heading: "What an interchange downgrade actually is",
      body: [
        "Interchange is not one rate. Each network publishes a schedule of programs, and a transaction clears in exactly one of them based on what it is and what data came with it. Visa's April 2026 schedule runs to twenty five pages. An interchange downgrade is a transaction landing in a worse program than the one it was eligible for, because it failed a qualification test somewhere between the authorization and the clearing file.",
        "So a downgrade has no price of its own. The cost is a subtraction: the rate of the program it cleared in, minus the rate of the program it should have cleared in. Which two rows those are depends on the card, the network and the channel, and the gap ranges from ten basis points to a hundred and fifty. Any page quoting one number is averaging things that are not comparable. The Interchange Downgrade Cost Calculator quotes both rows for every figure it prints.",
        "The tests themselves are mechanical and mostly about data, not about risk. Was the batch closed inside the network's window? Was the card swiped, dipped or tapped rather than keyed? Did the authorization carry an address verification request, and did the ZIP match? Did the amount that cleared equal the amount that was authorized? On a commercial card, were the tax amount, customer code and line items present? Fail one and the transaction falls, with no decline, no error and no message to the merchant.",
        "This matters more than it used to because the fallback programs have consolidated. Visa's consumer credit table no longer has an EIRF row or a Standard row at all: there is one line, Non-Qualified Consumer Credit, at 3.15% plus 10 cents, identical in the card present and card not present tables and across all six card product columns. Mastercard's consumer credit Standard row is 3.15% plus 10 cents too. There is no longer a soft landing on credit.",
      ],
    },
    {
      heading: "The causes, and the two rate sheet rows behind each price",
      body: [
        "A stale batch is the most expensive common failure per dollar. Visa moves a card not present sale to EIRF at two days and to Standard at three or more; Mastercard requires clearing inside three business days. On Mastercard consumer credit that is Merit III Base at 1.65% plus 10 cents becoming Standard at 3.15% plus 10 cents, a fall of 1.50 percentage points. On Visa exempt consumer debit the same failure is gentler: 1.65% plus 15 cents to EIRF at 1.75% plus 20 cents, then Standard at 1.90% plus 25 cents. The usual cause is one terminal switched off before its close time.",
        "Keying a card at the counter has its own program and its own price. On Visa exempt consumer debit, CPS/Retail Debit is 0.80% plus 15 cents and CPS/Retail Key Entry Debit is 1.65% plus 15 cents, a difference of 0.85 points before anything else goes wrong. A keyed sale that also comes back with no ZIP match falls further, to Non-Qualified Consumer Credit or Mastercard Standard at 3.15% plus 10 cents. Staff key a card when the reader fails, so a hardware fault shows up on the statement as a rate. Pull your keyed share per terminal, not per store.",
        "Address verification is one field in the authorization message, and most gateways send it only if the integration populates it. An ecommerce build that made billing ZIP optional at checkout is downgrading every order that skipped it, invisibly. Read the AVS response codes: a field that is sent but never matches is a different bug from one that is never sent.",
        "The amount that clears has to equal the amount that was authorized, outside the tip variance allowed to restaurants and a few other categories. Partial shipments do this. Shipping added after checkout does this. A subscription that prorates mid cycle does it every renewal. Authorize the final figure, or use incremental authorization and authorization reversal, rather than clearing a different number and hoping. Both networks also levy separate integrity fees on authorizations that are never cleared or are cleared for a different amount.",
      ],
    },
    {
      heading: "Level 2 and Level 3 data, and where it actually pays",
      body: [
        "This is the headline for any business that takes corporate or purchasing cards. Visa's Purchasing and Corporate T&E table prices Commercial Product 3 at 1.75% plus 10 cents. The same sale with basic data only clears at Commercial Card Not Present, 2.70% plus 10 cents, and if it misses the card not present requirements as well it falls to Non-Qualified at 2.95% plus 10 cents. That is 0.95 to 1.20 points on every commercial dollar, decided by whether a gateway populates a few fields. Mastercard's Large Market Credit column runs the same way: Data Rate III at 1.90% plus 10 cents against Data Rate I at 2.70% plus 10 cents, a gap of 0.80 points.",
        "Level 2 is two fields: a real sales tax amount, between 0.1 and 22 percent of the sale rather than zero, and a customer or order reference. Level 3 adds line item detail, product code, quantity, unit of measure, unit price and line total, plus freight and duty. The trap in Level 3 is arithmetic rather than plumbing: Visa requires the line items, tax and freight to sum exactly to the authorization amount, so a one cent rounding difference fails the whole submission and the sale clears at the Level 1 rate with no warning.",
        "The part almost every competing page gets wrong is that Level 3 is not universally better. On small business cards it is the wrong target. Visa prices Business Product 2 at 1.90% plus 10 cents in the base spend tier and Business Product 3 at 2.40% plus 10 cents, so Product 3 costs more than Product 2, and Mastercard's small business credit table publishes no Data Rate III row at all. Level 2 is the cheap rung there, and the deep Level 3 discount lives on corporate, purchasing and fleet cards.",
        "Two dated facts change the plumbing here. Visa's Commercial Enhanced Data Program replaced Level 3 with Commercial Product 3 in October 2025, and the general Commercial Level II program retired in April 2026 outside fleet and fuel. The 18 April 2026 rate sheet confirms it: the only Level II row left in the Corporate and Purchasing table is Commercial Level II Fuel at 2.20% plus 10 cents. There is now no partial credit on a Visa corporate card. Either you send the full Level 3 payload and reach Product 3, or you sit at Commercial Card Not Present. Enhanced data also carries a 5 basis point participation fee.",
      ],
    },
    {
      heading: "Why your statement will not tell you which transactions downgraded",
      body: [
        "On flat rate pricing you cannot see downgrades at all, because you are not being charged interchange. You pay 2.9% plus 30 cents whatever program the transaction clears in, and the processor keeps the difference. That is not a reason to ignore this page. It is the reason interchange plus exists: on a B2B book where the enhanced data line alone is worth 95 basis points, the flat rate processor is capturing that value and you have no lever on it.",
        "On interchange plus you can see them, but only in the right report. The monthly statement summary shows a blended effective rate and a markup. The interchange detail, which lists each program by name with its count and volume, is usually a separate report you have to ask for. Request a full month and look for the rows called Standard, Non-Qualified, EIRF, Data Rate I and Commercial Card Not Present. Their combined volume over your total volume is the share to enter above.",
        "The share of volume is the input people get wrong, in both directions. Merchants who have just read an article about downgrades assume the whole book is affected and get a frightening number. Merchants who have never looked assume it is zero. For most accounts it is a few percent on the general causes and much more on commercial cards, because enhanced data is either configured or it is not.",
        "One more thing: this calculator allocates causes rather than summing them, because a transaction clears in exactly one program and can therefore only downgrade once. A sale that settles late and lacks a customer code is charged once, at the worse of the two. Every other model multiplies each cause by the full volume and adds the answers up, which on a merchant with four problems produces a downgrade cost larger than their whole interchange bill. The widget prints the naive total beside the real one.",
      ],
    },
    {
      heading: "When to act on a downgrade, and when the answer is do nothing",
      body: [
        "Rank by annual dollars, not by how bad the cause sounds. A 1.50 point fall on 2 percent of volume is worth less than a 0.95 point fall on 45 percent of it, which is why the Interchange Downgrade Cost Calculator sorts by delta but reports in dollars. In the worked example above, the stale batch has the worst rate impact and the third biggest bill.",
        "Act when the fix is a configuration change. Automatic batch close, a required billing ZIP field, and a populated tax amount and customer code are settings, not projects, and they pay back on the first statement. Act when the fix is hardware: a chip reader that intermittently fails costs 0.85 points on every sale it pushes staff to key, and a replacement costs less than a month of that.",
        "Think harder when the fix is an integration. Full Level 3 is real engineering work: line items, product codes, units of measure and freight, all reconciled to the penny against the authorization amount. Price it against the annual figure the second mode gives you before you scope it. On $112,500 a month of commercial volume it is worth roughly $10,800 to $12,150 a year, which funds the work comfortably. On $8,000 a month of commercial volume it is worth under a thousand dollars a year and the answer is do nothing yet.",
        "Do nothing at all if you are on flat rate pricing and intend to stay there, or if your commercial share is near zero and your keyed and late settled volume are both under one percent. There is a real cost to chasing basis points that are not there. Run this once, fix the lines that are real, then re-run it after a pricing change or a gateway migration, which is when settings quietly revert.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Enhanced data programs and fallback rows on US commercial and consumer credit cards. Every figure is SOURCED, read off the published schedules, not computed by this page.",
    columns: ["Visa, effective 18 April 2026", "Mastercard, effective 17 April 2026"],
    rows: [
      {
        label: "Corporate and purchasing, Level 1 only",
        note: "Visa Purchasing and Corporate T&E column; Mastercard Large Market Credit column",
        values: ["Commercial Card Not Present, 2.70% + $0.10", "Data Rate I, 2.70% + $0.10"],
      },
      {
        label: "Corporate and purchasing, Level 2",
        note: "Visa retired the general Commercial Level II program in April 2026",
        values: ["No program outside fleet and fuel", "Data Rate II, 2.50% + $0.10"],
      },
      {
        label: "Corporate and purchasing, Level 3",
        values: ["Commercial Product 3, 1.75% + $0.10", "Data Rate III, 1.90% + $0.10"],
      },
      {
        label: "Corporate and purchasing, failed qualification",
        values: ["Non-Qualified, 2.95% + $0.10", "Standard, 2.95% + $0.10"],
      },
      {
        label: "Small business card, Level 1 only",
        note: "Visa business credit spend tier I; Mastercard Level 1 / Business Core",
        values: ["Business Product 1, 2.65% + $0.10", "Data Rate I, 2.65% + $0.10"],
      },
      {
        label: "Small business card, Level 2",
        note: "The cheap rung on this card type, on both networks",
        values: ["Business Product 2, 1.90% + $0.10", "Data Rate II, 1.90% + $0.10"],
      },
      {
        label: "Small business card, Level 3",
        note: "Dearer than Level 2 on Visa, and not published at all by Mastercard",
        values: ["Business Product 3, 2.40% + $0.10", "No published program"],
      },
      {
        label: "Small business card, failed qualification",
        values: ["Business Non-Qualified, 3.15% + $0.20", "Standard, 2.95% to 3.30% + $0.10"],
      },
      {
        label: "Consumer credit, failed qualification",
        note: "Visa's single fallback row; identical card present and card not present",
        values: ["Non-Qualified Consumer Credit, 3.15% + $0.10", "Standard, 3.15% + $0.10"],
      },
    ],
  },
  assumptions: [
    "Visa figures are read from Visa USA Interchange Reimbursement Fees, Visa Supplemental Requirements, rates effective 18 April 2026, downloaded from usa.visa.com on 5 September 2026. Mastercard figures are read from Mastercard 2026 to 2027 U.S. Region Interchange Programs and Rates, effective 17 April 2026; mastercard.com returns HTTP 403 to this machine, so it was read from the Internet Archive capture dated 16 June 2026, which is the honest checked date for those rows.",
    "Every cost delta on this page is a subtraction between two published rows, shown beside it, never a market estimate. Worked once: Visa Commercial Product 3 is 1.75% + $0.10 and Visa Commercial Card Not Present is 2.70% + $0.10, both in the Purchasing and Corporate T&E column of section E of the April 2026 schedule, so the delta is 0.95 percentage points and zero cents. If a rate sheet moves, the two quoted rows change and the delta is recomputed from them.",
    "Visa's rate sheet does not state that its Business Product 1, 2 and 3 rows are data levels. They are read as data levels here because at the base spend tier they match Mastercard's Data Rate I and Data Rate II, which are labelled as data levels, to the cent: 2.65% + $0.10 and 1.90% + $0.10 on both sheets. That is an inference. The quoted rows stand on their own if it is ever shown to be wrong.",
    "Settlement windows are from processor documentation rather than a network publication: Payrix interchange data requirements (Visa, no more than 24 hours between authorization and capture; Mastercard, cleared within three business days) and Nuvei Paya merchant support (Visa EIRF at two days, Standard at three or more), both checked 5 September 2026. The Visa Commercial Enhanced Data Program participation fee of 0.05 percent, and the Level 3 sunset of 17 October 2025 and Level 2 sunset of April 2026, come from Rainforest Pay CEDP documentation checked the same day. That the general Commercial Level II row is absent from Visa's April 2026 Corporate and Purchasing table is our own reading of the sheet.",
    "A transaction clears in exactly one interchange program, so causes are allocated worst first and the downgraded share never exceeds your volume. Summing the causes independently, which is what every other model of this does, double counts any transaction that fails two tests. The widget shows both totals so the gap is visible rather than asserted.",
    "The second mode assumes commercial cards carry the same average ticket as the rest of your book, because nothing in the inputs says otherwise. On most B2B accounts the commercial ticket is larger, which makes the percentage part of the saving bigger and the per transaction part smaller. Interchange is also not the whole price: your acquirer's markup sits on top of every row here, and on flat rate pricing the acquirer absorbs the downgrade rather than passing it on.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "What is an interchange downgrade?",
      answer:
        "A transaction that failed to qualify for the interchange program it was eligible for and cleared in a more expensive one instead. There is no decline and no error message. On Visa's April 2026 schedule a corporate card that should have cleared at Commercial Product 3, 1.75% plus 10 cents, clears instead at Commercial Card Not Present, 2.70% plus 10 cents, which is 95 basis points more on that sale.",
    },
    {
      question: "Why did my transaction downgrade?",
      answer:
        "Almost always one of five things: the batch was not settled inside the network window, the card was keyed rather than dipped or tapped, the authorization carried no address verification or the ZIP did not match, the settled amount differed from the authorized amount, or a commercial card was sent without its tax amount, customer code or line item detail. The Interchange Downgrade Cost Calculator prices each of those separately.",
    },
    {
      question: "How much does an interchange downgrade cost?",
      answer:
        "It depends on the two programs involved, so it ranges from about 10 basis points to about 150. A late batch on Mastercard consumer credit is Merit III Base at 1.65% falling to Standard at 3.15%, which is 1.50 points. A missing address on Visa exempt consumer debit is 1.65% plus 15 cents becoming 1.75% plus 20 cents, which is 0.10 points and 5 cents. On a $250 sale that is $3.75 against 30 cents.",
    },
    {
      question: "What is Level 2 and Level 3 credit card processing?",
      answer:
        "Extra data fields sent with a commercial card authorization. Level 2 is a real sales tax amount, between 0.1 and 22 percent of the sale, plus a customer or order code. Level 3 adds line item detail: description, product code, quantity, unit of measure, unit price, line total, freight and duty. On Visa corporate and purchasing cards Level 3 is worth 0.95 points, moving 2.70% plus 10 cents to 1.75% plus 10 cents.",
    },
    {
      question: "Is Level 3 processing worth it for a small business card?",
      answer:
        "No, and this is where most advice is wrong. Visa prices Business Product 2 at 1.90% plus 10 cents and Business Product 3 at 2.40% plus 10 cents in the base spend tier, so Level 3 is dearer than Level 2 on a small business card, and Mastercard publishes no Data Rate III row for small business credit at all. Send Level 2 there and save the Level 3 build for corporate, purchasing and fleet cards.",
    },
    {
      question: "How do I stop transactions from downgrading?",
      answer:
        "Set automatic batch close at a fixed time on every terminal and gateway account and verify it for a week. Make billing ZIP a required checkout field and confirm the gateway passes it in the authorization. Authorize the final amount rather than clearing a different one. Fix any card reader that makes staff key cards. Then populate tax amount and customer code on commercial cards, and full Level 3 if you take corporate or purchasing cards.",
    },
  ],
  related: [
    "interchange-fee-lookup",
    "interchange-plus-vs-flat-rate-calculator",
    "effective-rate-calculator",
    "credit-card-processing-savings-calculator",
    "mcc-code-lookup",
  ],
  links: [
    { label: "Interchange, explained", href: "/glossary/interchange" },
    { label: "Settlement, explained", href: "/glossary/settlement" },
    { label: "Batch, explained", href: "/glossary/batch" },
    { label: "AVS, explained", href: "/glossary/avs" },
    { label: "Interchange-plus processors", href: "/payment-processors/interchange-plus" },
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
  ],
  cta: {
    heading: "You cannot fix a downgrade you cannot see",
    body: "Downgrades are invisible on flat rate pricing, because the processor absorbs them and keeps the difference. If your commercial card share is meaningful, that difference is the largest single line on this page. Tell us your volume and card mix and we will shortlist processors that price on interchange plus and pass the detail through.",
    label: "Get matched",
  },
};
