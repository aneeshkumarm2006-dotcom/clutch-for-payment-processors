import type { ToolDef } from "@/lib/tools";

/**
 * /tools/interchange-fee-lookup
 *
 * SEARCH INTENT THIS PAGE OWNS: the lookup. "interchange fee lookup",
 * "interchange rates", "visa interchange rates", "mastercard interchange rates",
 * "interchange rate table". Somebody with a statement open who wants to know
 * what a specific program costs. It does NOT reach for "what is interchange"
 * (that is /glossary/interchange), "interchange plus vs flat rate" (that is
 * /tools/interchange-plus-vs-flat-rate-calculator and /glossary/interchange-plus)
 * or any processor's pricing.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Three things, all checkable:
 *
 *   1. They are stale. The networks reprice every April and every October. Most
 *      pages ranking for these terms publish a table captured once and never
 *      touched, and several still carry programs both networks have retired.
 *   2. They are unusable. The networks publish PDFs. The pages that retype them
 *      produce a flat wall of text with no search, no filter and no way to price
 *      your own ticket, which is the only question a merchant actually has.
 *   3. They publish Discover rates. Discover does not publish a US schedule: its
 *      acquirer interchange page gates the US rates behind a verification code
 *      issued by an acquirer and states the fee information is confidential and
 *      may not be disclosed to third parties. A page carrying a Discover US
 *      interchange table is republishing a document somebody was told not to.
 *      This page says so instead, and carries the two networks that do publish.
 *
 * WHERE THE NUMBERS CAME FROM. Every rate is in `lib/tools-data/interchange.ts`,
 * read from the Visa USA Interchange Reimbursement Fees sheet effective 18 April
 * 2026 and the Mastercard 2026 to 2027 U.S. Region Interchange Programs and
 * Rates effective 17 April 2026. The regulated debit formula is 12 CFR 235.3(b)
 * and 235.4. The debit averages are the Federal Reserve's Regulation II data for
 * 2024, published 19 December 2025. The settlement terms are Visa's Form 8-K of
 * 10 November 2025. Every dollar figure in the worked example and the rate table
 * below is produced by `lib/calc/interchange.ts` and asserted in
 * `tests/tools/batch-four/interchange-fee-lookup.test.ts`, because a hand
 * written number that disagrees with the widget on the same page has shipped on
 * this site before.
 */
export const INTERCHANGE_LOOKUP_TOOL: ToolDef = {
  slug: "interchange-fee-lookup",
  name: "Interchange Fee Lookup",
  h1: "Interchange fee lookup: current US Visa and Mastercard rates",
  title: "Interchange Fee Lookup | US Visa & Mastercard Rates",
  description:
    "Use our interchange fee lookup to compare current US Visa and Mastercard interchange rates by card type, merchant category, channel, and transaction amount.",
  intro:
    "Interchange is the fee your acquirer pays the card issuer on every card sale, and on interchange plus pricing it passes straight through to you at cost. This Interchange Fee Lookup carries 196 published US programs, 119 from the Visa sheet effective 18 April 2026 and 77 from the Mastercard sheet effective 17 April 2026, searchable by program, card product, merchant category and acceptance channel, and priced on whatever amount you type in. The spread is the point. The same $50 card present sale costs 24 cents on regulated debit and $1.68 if it downgrades to Non-Qualified.",
  tier: 1,
  summary:
    "196 published US interchange programs from the April 2026 Visa and Mastercard rate sheets, priced on your ticket.",
  widget: "interchange-lookup",
  workedExample: {
    scenario:
      "Bishop Hardware, a single location store in Ohio with about $190,000 of annual Visa consumer credit sales, rings up a $50.00 sale at the counter. The same $50.00, on the same terminal, on the same afternoon, five different customers.",
    result:
      "Customer one pays with a debit card issued by a bank holding more than $10 billion in assets, so Regulation II applies: 0.05% of $50.00 is 2.5 cents, plus the 21 cent base component, so interchange is $0.24, an effective rate of 0.48%. Customer two pays with a debit card from a small community bank, which is exempt from the cap, and the sale qualifies for Visa's CPS/Retail Debit at 0.80% + $0.15: that is $0.40 plus $0.15, so $0.55, or 1.10%. Customer three pays with an ordinary Visa Traditional Rewards credit card. Because the store's Visa consumer credit sales are under the $280,000 small merchant ceiling, the sale qualifies for Small Merchant Product 2 at 1.43% + $0.10, which is $0.715 plus $0.10, rounded to $0.82, or 1.64%. Customer four is identical to customer three except that the store has grown past the small merchant ceiling, so the same card lands on Product 2 at 1.65% + $0.10, which is $0.825 plus $0.10, rounded to $0.93, or 1.86%. Customer five's sale is authorised correctly but the batch is settled late, so it falls to Non-Qualified Consumer Credit at 3.15% + $0.10, which is $1.575 plus $0.10, rounded to $1.68, or 3.36%. Five identical $50 sales, five different costs, from $0.24 to $1.68. The dearest is seven times the cheapest, and only one of the five differences is anything the store could have controlled on the day.",
  },
  sections: [
    {
      heading: "What an interchange fee lookup gives you, and what it does not",
      body: [
        "Interchange is one line inside your processing cost, not the whole of it. Every published program has the same shape: a percentage of the transaction, plus a fixed amount, and sometimes a cap or a minimum on the total. Visa's Product 2 program is 1.65% + $0.10, so a $50 sale carries $0.825 of percentage plus a dime, which the network rounds to $0.93. That is what your acquirer pays the bank that issued the card.",
        "Two things sit on top of it before you get a bill. The network charges the acquirer assessments, a small percentage of volume. Your processor then adds its markup, which is the only part of the stack anybody negotiates. On interchange plus pricing your statement itemises all three, so the rows in this table appear on it by name. On flat rate pricing you see none of them, which is how a merchant can be handed a worse interchange program and never notice.",
        "Two operators in the published schedules are routinely mishandled by pages that retype them. A minimum is not a fixed fee: Visa prints its restaurant program as 2.10% with a minimum of $0.04, so a $10 check costs 21 cents, not 25. A cap ceilings the entire fee rather than the percentage part of it: CPS/Automated Fuel Dispenser Debit is 0.80% + $0.15 with a $0.95 cap, so a $200 fill costs 95 cents rather than the $1.75 the uncapped formula gives. The Interchange Fee Lookup applies both the way the network does.",
        "What this page cannot tell you is which program a given sale actually qualified for. That is settled after the fact by your merchant category code, whether the card was present, what data your terminal or gateway sent, and when you settled. Your statement records what happened; this table records what each outcome costs, and the gap between them is the money.",
      ],
    },
    {
      heading: "Who actually pays interchange, and why it is not negotiable",
      body: [
        "Visa's own rate sheet opens by saying that merchants do not pay interchange reimbursement fees; merchants pay merchant discount to their financial institution. That is formally accurate and practically irrelevant. Interchange moves from the acquiring bank to the issuing bank, and the acquiring bank recovers it from you inside whatever you were quoted. You pay it, just not directly, which is exactly why so few merchants can name what they are paying.",
        "It follows that interchange is not negotiable, and anyone offering to negotiate it is confused or selling something. Your processor cannot discount a fee it does not keep. What it can move is its own markup, and on a flat rate plan it can also absorb the difference when your transactions qualify for a cheaper program than your headline rate implies. A pitch that promises lower interchange describes something that cannot happen; one that promises a lower markup should be quoted in basis points over interchange.",
        "The levers a merchant does have are qualification, tender mix and markup. Tender mix is usually the largest and is almost never modelled: a $2,500 rent payment costs $5.00 of interchange under Mastercard's capped Merit I program for real estate merchant category codes on an exempt debit card, and $51.10 on a consumer credit card under Visa's Product 1. That tenfold difference is produced by which card the payer reaches for, and it is why property managers, schools and utilities push so hard toward bank payments.",
        "For a benchmark, the Federal Reserve publishes what US debit interchange averages. Across all networks in 2024 it was $0.34 per transaction on an average value of $46.32, splitting into $0.23 on covered transactions and $0.51 on exempt ones. Credit is another order of magnitude: the consumer credit programs in this table run from 1.15% + $0.05, which is Mastercard's Service Industries rate, up to 3.15% + $0.10 at both networks' ceilings, or $0.63 against $1.68 on a $50 sale.",
      ],
    },
    {
      heading: "Why the same card costs three different amounts at three different merchants",
      body: [
        "The first gate is your merchant category code. Mastercard limits its Merit I insurance rate to codes 5960 and 6300, real estate to 6513 and day care to 8351, and each is 1.43% + $0.05 on a Core card against 1.95% + $0.10 for plain Merit I. That is 52 basis points and a nickel, decided by four digits your acquirer assigned you rather than by anything you did at the till. Its Emerging Markets education and government debit rate is restricted to ten named codes and capped at $2.00.",
        "The second gate is the acceptance channel. Visa's CPS/Retail Debit program is 0.80% + $0.15 when the card is dipped or tapped and CPS/Retail Key Entry is 1.65% + $0.15 for the same card typed in by hand. On credit, the card present Product 2 program at 1.65% + $0.10 becomes the card not present Product 1 program at 2.04% + $0.10, and the restaurant program moves from 2.10% with a 4 cent floor in the dining room to 2.20% with an 8 cent floor on a delivery order.",
        "The third gate is data, and it is worth the most on commercial cards. Visa's Commercial Product 3 rate, which requires line item level detail, is 1.75% + $0.10. The same corporate card with no enhanced data lands on Commercial Card Not Present at 2.70% + $0.10. That is 95 basis points for populating fields your gateway can already send, which on $80,000 a month of corporate card invoices is $760.",
        "The fourth gate is scale, and it runs both ways. Visa's Retail Credit Performance Threshold I needs 133.4 million transactions, $8.83 billion of volume, a dispute financials ratio at or below 0.020% and PCI compliance; Mastercard's Merit III Tier 1 needs USD 1.80 billion. Those are national chain rates. The exception runs the other way: Visa's Small Merchant Fee Program is open at or below $280,000 of gross Visa consumer credit sales, and Small Merchant Product 2 at 1.43% + $0.10 is 22 basis points better than Product 2. It is the one place in the schedule where being small is worth money.",
      ],
    },
    {
      heading: "Regulated debit, the Durbin cap, and the case that could remove it",
      body: [
        "Regulated debit is the row most worth getting right, because it is not a percentage and not a network pricing decision. 12 CFR 235.3(b) caps the fee at 21 cents plus 5 basis points of the transaction value, and 235.4 lets an issuer that certifies to its fraud prevention standards add no more than 1 cent. Under 235.5(a) it applies only to cards from an institution that, with its affiliates, holds $10 billion or more in assets. Cards from smaller banks and credit unions are exempt and priced by the network.",
        "Because the formula is almost entirely fixed, the cap is a large discount on a big ticket and a penalty on a small one. On a $250 sale it is $0.34, an effective rate of 0.14%, which nothing else in the schedule comes near. On a $4.50 coffee it is $0.21, an effective 4.7%, where Visa's CPS/Small Ticket Debit program on an exempt card would be $0.11. That shape is what sits behind the Federal Reserve's 2024 figures, where covered transactions averaged $0.23 and exempt ones $0.51.",
        "There is a proposed change that has not happened. On 25 October 2023 the Board requested comment on lowering the base component to 14.4 cents and the ad valorem component to 4.0 basis points, raising the fraud prevention adjustment to 1.3 cents, and updating the cap every other year from issuer cost data. It has not been finalised. The operative numbers remain 21 cents plus 5 basis points, plus the 1 cent adjustment nearly every covered issuer claims.",
        "There is also live litigation. On 6 August 2025, in Corner Post, Inc. v. Board of Governors of the Federal Reserve System, the US District Court for the District of North Dakota held that the Board had exceeded its statutory authority and vacated Regulation II, then stayed its own vacatur pending appeal to the Eighth Circuit so that interchange would not become a completely unregulated market. The cap is still in force while the appeal runs. Plan against the number that is in force, not the one that might replace it.",
      ],
    },
    {
      heading: "When these interchange rates change, and when the answer means do nothing",
      body: [
        "Both networks reprice on a published schedule, in April and in October. The editions behind this table are Visa's, effective 18 April 2026, and Mastercard's, effective 17 April 2026. That cadence is why most interchange rate tables on the web are wrong: one captured and never revisited has been superseded twice a year ever since. A table with no effective date beside the rates is not telling you the one thing you most need to know about it.",
        "A larger change is queued behind the twice yearly one. Visa's Form 8-K of 10 November 2025 describes a proposed settlement of the merchant interchange multidistrict litigation: a reduction of the US combined average effective credit interchange rate by 10 basis points for five years, standard US consumer credit rates capped at 125 basis points, and more merchant options to surcharge. The Eastern District of New York granted preliminary approval in June 2026 and final approval is still outstanding. Size it honestly: 10 basis points off an effective 1.86% is a five percent cut in the interchange line, not in the bill.",
        "The answer means act in three situations, each checkable from a statement. If you are on interchange plus and volume is settling to Non-Qualified, EIRF or Standard, you are paying the ceiling on sales that should have qualified, which on a $50 average ticket is $0.75 each against Product 2. If your merchant category code does not match a category program you belong in, the gap is 52 basis points on the Mastercard insurance and real estate codes alone. And if a large recurring payment runs on consumer credit when the payer would use debit or a bank transfer, the tender mix is worth more than any negotiation open to you.",
        "It means do nothing at least as often. On flat rate pricing under roughly $10,000 a month, none of these rows reaches your bill and the right response to an interchange table is to close it. If your volume is already card present debit at a supermarket or fuel merchant category code, you are near the floor of the published schedule. And if a processor offers to negotiate your interchange, the useful information is not the offer, it is what the offer tells you about the seller.",
      ],
    },
  ],
  rateTable: {
    caption:
      "The same $50 card present sale under ten published US programs. Published rates are read from the two network rate sheets named in the assumptions below. The interchange and effective rate columns are computed by this page's own calculator and are reproducible in the tool above by entering 50.",
    columns: ["Published rate", "Interchange on $50", "Effective rate"],
    rows: [
      {
        label: "Regulated debit, either network",
        note: "The Durbin cap. Applies to any debit or prepaid card issued by a bank holding $10 billion or more in assets.",
        values: ["0.05% + $0.21", "$0.24", "0.48%"],
      },
      {
        label: "Visa CPS/Retail, Debit",
        note: "Exempt issuer, card present.",
        values: ["0.80% + $0.15", "$0.55", "1.10%"],
      },
      {
        label: "Mastercard Merit III Base, exempt debit",
        note: "Card present retail on an exempt debit card.",
        values: ["1.05% + $0.15", "$0.68", "1.36%"],
      },
      {
        label: "Visa Small Merchant Product 2",
        note: "Traditional Rewards credit. Gross Visa consumer credit sales at or below $280,000.",
        values: ["1.43% + $0.10", "$0.82", "1.64%"],
      },
      {
        label: "Visa Product 2",
        note: "Traditional Rewards credit, card present, above the small merchant ceiling.",
        values: ["1.65% + $0.10", "$0.93", "1.86%"],
      },
      {
        label: "Mastercard Merit III Base, Core credit",
        note: "Card present retail on a Core consumer credit card. Identical to Visa's Product 2 rate.",
        values: ["1.65% + $0.10", "$0.93", "1.86%"],
      },
      {
        label: "Visa Restaurant 2",
        note: "Traditional Rewards credit, card present. A percentage with a 4 cent floor and no fixed component.",
        values: ["2.10% (min $0.04)", "$1.05", "2.10%"],
      },
      {
        label: "Mastercard Merit I, Core credit",
        note: "The base Mastercard program, where a merchant with no category specific program lands.",
        values: ["1.95% + $0.10", "$1.08", "2.16%"],
      },
      {
        label: "Visa Product 1",
        note: "Traditional Rewards credit, card not present. The same card as Product 2, bought online.",
        values: ["2.04% + $0.10", "$1.12", "2.24%"],
      },
      {
        label: "Visa Non-Qualified and Mastercard Standard",
        note: "The downgrade. Both networks price their consumer credit ceiling identically.",
        values: ["3.15% + $0.10", "$1.68", "3.36%"],
      },
    ],
  },
  assumptions: [
    "Visa rates are read from the Visa USA Interchange Reimbursement Fees supplement, rates effective April 18, 2026, published at usa.visa.com and checked on September 5, 2026. That document covers transactions completed within the 50 United States and the District of Columbia. 119 of the 196 rows come from it.",
    "Mastercard rates are read from Mastercard 2026 to 2027 U.S. Region Interchange Programs and Rates, effective April 17, 2026. mastercard.com refuses requests from this machine, so the PDF was read from the Internet Archive capture of June 16, 2026 and that capture date is the checked date. 77 of the 196 rows come from it.",
    "There are no Discover rows, deliberately. Discover does not publish a US schedule: its acquirer interchange service centre requires a verification code issued by your acquirer and states that the fee information is confidential and, except with your current acquirer, may not be disclosed to any third party. American Express is also absent, because it prices merchant discount directly rather than publishing interchange. Any page showing a Discover US interchange table is republishing a confidential document.",
    "Each program appears once, at the card product named in the Card column: Traditional Rewards for Visa consumer credit and Core for Mastercard consumer credit. Visa prices every consumer credit program across six card columns and Mastercard across five, so publishing every cell would be roughly 1,100 near duplicate rows. The premium tiers for each program are carried in that row's notes, and a premium consumer card always costs more than the rate shown.",
    "The regulated debit rows are the Regulation II formula, not a network pricing decision: 21 cents plus 5 basis points under 12 CFR 235.3(b), plus a fraud prevention adjustment of no more than 1 cent under 12 CFR 235.4, applying to issuers holding $10 billion or more in assets under 12 CFR 235.5(a). Read from the eCFR on September 5, 2026. Regulation II was vacated by the US District Court for the District of North Dakota on August 6, 2025 in Corner Post, Inc. v. Board of Governors, and that vacatur is stayed pending appeal to the Eighth Circuit, so the cap remains in force.",
    "Both networks revise their US schedules in April and October, so this table has a known expiry. Separately, Visa's Form 8-K of November 10, 2025 describes a proposed settlement reducing the US combined average effective credit interchange rate by 10 basis points for five years and capping standard US consumer credit at 125 basis points. It received preliminary approval in the Eastern District of New York in June 2026 and is not yet final. None of it is pre-applied to the rates above.",
    "Interchange is not your processing cost. Network assessments and your processor's markup sit on top of every row here, and which program a sale qualifies for is decided by your merchant category code, the acceptance channel, the data sent and when you settled. This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "What is an interchange fee?",
      answer:
        "It is the fee the acquiring bank pays the card issuing bank on every card transaction, and it is the largest component of what you pay to accept cards. Every published program is a percentage plus a fixed amount, sometimes with a cap or a minimum: Visa's Product 2 credit program is 1.65% + $0.10, which is $0.93 on a $50 sale. Visa's own sheet says merchants pay merchant discount rather than interchange, but the acquirer recovers it from you inside that discount.",
    },
    {
      question: "What are Visa interchange rates in 2026?",
      answer:
        "Visa's current US schedule took effect on April 18, 2026 and this Interchange Fee Lookup carries 119 of its programs. Consumer credit runs from 1.15% + $0.25 on the fuel program, capped at $1.10, up to 3.15% + $0.10 for Non-Qualified. Exempt consumer debit runs from a flat $0.30 on CPS/Supermarket to 1.90% + $0.25 for Standard. Regulated debit is 0.05% + $0.21. Visa reprices in April and October, so re-check the current sheet before acting on any figure.",
    },
    {
      question: "What are Mastercard interchange rates in 2026?",
      answer:
        "Mastercard's 2026 to 2027 US schedule took effect on April 17, 2026 and 77 of its programs are in this table. The base consumer credit program, Merit I, is 1.95% + $0.10 on a Core card and 2.60% + $0.10 on World Elite. Card present retail sits on Merit III Base at 1.65% + $0.10, the cheapest consumer credit program is Service Industries at 1.15% + $0.05, and the ceiling is Standard at 3.15% + $0.10.",
    },
    {
      question: "What is the debit card interchange cap in 2026?",
      answer:
        "21 cents plus 5 basis points, under 12 CFR 235.3(b), plus a fraud prevention adjustment of up to 1 cent under 12 CFR 235.4, so 22 cents plus 5 basis points in practice. It applies only to cards issued by institutions holding $10 billion or more in assets, and on a $50 sale it is $0.24. A 2023 Federal Reserve proposal would cut the base to 14.4 cents, and a North Dakota court vacated Regulation II in August 2025 with the vacatur stayed pending appeal, so today's number stands.",
    },
    {
      question: "Can you negotiate interchange fees?",
      answer:
        "No. Your processor cannot discount a fee it does not keep, because interchange goes to the bank that issued the customer's card. What is negotiable is your processor's markup over interchange, quoted in basis points on interchange plus pricing. Everything else you can move is qualification and tender mix: a $2,500 rent payment costs $5.00 of interchange on Mastercard's capped real estate debit program and $51.10 on a Visa consumer credit card.",
    },
    {
      question: "Why is the interchange on my statement higher than the published rate?",
      answer:
        "Usually because the transaction did not qualify for the program you assumed. Four things decide it: your merchant category code, whether the card was present, what data your terminal or gateway sent, and whether you settled inside the required window. A keyed Visa debit sale costs 1.65% + $0.15 rather than the 0.80% + $0.15 of a dipped one, and a credit sale that misses qualification entirely lands on Non-Qualified at 3.15% + $0.10, which is $1.68 on a $50 sale against $0.93.",
    },
  ],
  related: [
    "interchange-downgrade-calculator",
    "interchange-plus-vs-flat-rate-calculator",
    "mcc-code-lookup",
    "effective-rate-calculator",
    "helcim-fee-calculator",
  ],
  links: [
    { label: "What interchange actually is", href: "/glossary/interchange" },
    { label: "Interchange plus pricing explained", href: "/glossary/interchange-plus" },
    { label: "Processors with interchange plus pricing", href: "/payment-processors/interchange-plus" },
    { label: "Compare US payment processors", href: "/processors" },
    { label: "How this site tests and rates processors", href: "/methodology" },
  ],
  cta: {
    heading: "Knowing the rate is half of it. The other half is your markup.",
    body: "Interchange is the same for everyone at the same merchant category code, channel and card. What differs between two businesses on identical volume is the markup their processor adds on top, and on flat rate pricing you cannot see either number. Compare the processors that publish interchange plus pricing and itemise the interchange line on the statement.",
    label: "Compare interchange plus processors",
  },
};
