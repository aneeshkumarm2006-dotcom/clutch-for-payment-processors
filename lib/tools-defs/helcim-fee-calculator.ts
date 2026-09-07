import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/helcim-fee-calculator`
 *
 * ─── The search intent this page owns ───────────────────────────────────────
 *
 * "helcim fee calculator" and "helcim pricing", plus the questions the same
 * searcher asks in the same session: what Helcim charges per transaction, what
 * their effective rate would actually be, how the volume discount works, and
 * whether Helcim beats the flat rate they are on now. The CALCULATION modifier
 * belongs here. Helcim's brand review, its full fee schedule in prose and the
 * head term "helcim pricing" belong to `/processor/helcim`, and this page ends
 * by linking into it rather than trying to replace it.
 *
 * ─── What the competition gets wrong ────────────────────────────────────────
 *
 * Two failures, and both are checkable.
 *
 * The first is treating Helcim's published 0.40% as a PRICE. It is a margin.
 * The number a merchant pays is interchange plus assessments plus that margin,
 * and a calculator that multiplies 0.40% by a sale amount understates a real
 * Helcim bill by roughly two percentage points, in the direction that makes
 * Helcim look free. Several pages ranking for this term do exactly that, because
 * they were built by pointing a flat-rate widget at a different rate card.
 *
 * The second is asserting a single interchange figure. Visa and Mastercard
 * publish interchange as downloadable rate tables covering several hundred
 * programs, not as a feed, so no calculator can know which program a merchant's
 * next sale lands in. This page therefore takes the card mix as an input, prices
 * each band separately off a named program on a 2026 rate sheet, shows the
 * assumption on screen and lets the merchant replace it. Publishing a band and
 * saying it is a band is the only honest option available.
 *
 * ─── Where the numbers came from ────────────────────────────────────────────
 *
 * Helcim's markup ladder, monthly fees, chargeback fees and ACH pricing: read
 * directly off helcim.com/pricing on 5 September 2026. The cross-border figures
 * are from helcim.com/international-credit-card-processing/, same date. Both are
 * recorded in `lib/rate-cards/helcim.ts`.
 *
 * Interchange bands: Visa USA Interchange Reimbursement Fees, rates effective
 * 18 April 2026, and the Mastercard 2026 to 2027 US Region Interchange Programs
 * and Rates, effective 17 April 2026. Every band in
 * `lib/tools-data/helcim.ts` names the exact program its default was taken from.
 *
 * Realised debit averages: Federal Reserve Regulation II data for calendar year
 * 2024, published 19 December 2025. Card mix by value: Federal Reserve Payments
 * Study released July 2026, 2024 data.
 *
 * Assessments: the networks do not publish these the way they publish
 * interchange. The default comes off a government-published acquirer schedule,
 * the Reference Guide for Card Brand Pass Through Fees posted by the North
 * Carolina Office of the State Controller, and is an editable input because that
 * schedule is dated.
 *
 * Every dollar figure in `workedExample`, `rateTable` and the FAQs is produced
 * by `lib/calc/helcim.ts` and pinned by
 * `tests/tools/batch-four/helcim-fee-calculator.test.ts`, which asserts the
 * printed strings against the same functions the widget calls. A hand-written
 * number that disagrees with the widget on the same page has shipped here before.
 */
export const HELCIM_FEE_TOOL: ToolDef = {
  slug: "helcim-fee-calculator",
  name: "Helcim Fee Calculator",
  h1: "Helcim fee calculator",
  title: "Helcim Fee Calculator | Calculate Helcim Processing Fees",
  description:
    "Use our Helcim fee calculator to estimate processing fees, interchange, assessments, Helcim markup, and effective rates for your business.",
  intro:
    "Helcim does not publish a rate, it publishes a margin. What you pay is interchange, plus card network assessments, plus a Helcim markup that starts at 0.40% and 8 cents in person and steps down automatically as your monthly volume rises. On $30,000 a month across 500 card-present sales at a typical US card mix, this Helcim Fee Calculator returns $655.37, an effective rate of 2.18%, and only $160 of that is Helcim. The rest is network cost that follows you to whichever processor you use.",
  tier: 2,
  summary:
    "Helcim's real interchange-plus cost on your own card mix, with the whole volume tier ladder priced out.",
  widget: "helcim-fee",
  rateCard: "helcim",
  workedExample: {
    scenario:
      "Ridgeline Salon, a single-location hair salon, runs $30,000 a month across 500 card-present sales, a $60 average ticket, on Helcim. Its card mix is the US average by value: 41 percent debit and 59 percent credit, split 25 percent regulated debit, 16 percent non-regulated debit, 24 percent plain consumer credit, 30 percent rewards credit and 5 percent commercial. Interchange is priced off the April 2026 Visa and Mastercard US rate sheets and assessments at 0.13% plus 2 cents an authorization.",
    result:
      "At $30,000 a month the salon sits in Helcim's entry band, so the margin is 0.40% plus 8 cents card present. That is $120 on volume plus $40 across 500 sales, so $160. Assessments are 0.13% of $30,000, which is $39, plus 500 authorizations at 2 cents, which is $10, so $49. Interchange is worked out band by band, each band taking its share of both the volume and the transaction count: regulated debit is $7,500 across 125 sales at 0.05% plus 22 cents, which is $31.25; non-regulated debit is $4,800 across 80 sales at 0.80% plus 15 cents, which is $50.40; plain consumer credit is $7,200 across 120 sales at 1.51% plus 10 cents, which is $120.72; rewards credit is $9,000 across 150 sales at 2.10% plus 10 cents, which is $204.00; commercial is $1,500 across 25 sales at 2.50% plus 10 cents, which is $40.00. Interchange totals $446.37. The month costs $446.37 plus $49.00 plus $160.00, which is $655.37, an effective rate of 2.18% and $1.31 a sale. Helcim keeps $160 of that, 24 percent of the bill; the other $495.37 is card network cost no processor can discount. Now push the salon to $50,000 a month at the same $60 ticket and it crosses into the next band, where the margin is 0.35% plus 7 cents. On 833 sales that is $233.31 instead of $266.64, a saving of $33.33 a month, $399.96 a year, or 7 basis points off the effective rate. Nothing is signed and nothing is paid to get it: Helcim applies the band automatically on the average of the last three months.",
  },
  sections: [
    {
      heading: "How the Helcim fee calculator builds the number",
      body: [
        "An interchange-plus bill is three charges stacked on the same sale, and each has a percentage part and a per-item part. Interchange is the largest and goes to the bank that issued your customer's card. Assessments go to Visa or Mastercard for running the network. The markup, the only part your processor sets, goes to Helcim. The Helcim Fee Calculator prices all three and shows them as three lines, because the split is what decides whether switching processors is worth an afternoon.",
        "Written out, monthly cost is interchange plus assessments plus markup, where each term is a rate times your volume plus a per-item fee times your transaction count. Helcim's markup at the entry band is 0.40% plus 8 cents card present and 0.50% plus 25 cents keyed or online, and both are a margin over interchange rather than a price. Reading them as a price is the mistake nearly every other Helcim calculator makes: multiply 0.40% by a sale amount and the result is out by roughly two percentage points, in the direction that flatters Helcim.",
        "Interchange is not one rate, so this calculator does not treat it as one. It splits your volume across five card types, prices each separately, then adds them back up. The spread is enormous. On the same $30,000 month, a merchant taking nothing but regulated debit pays $334 and lands at 1.11%, while a merchant taking nothing but rewards credit pays $889 and lands at 2.96%. Identical volume, identical Helcim margin, 185 basis points apart.",
        "The transaction count does more work than people expect. Both the per-item interchange and Helcim's 8 or 25 cents scale with the number of sales rather than their size, so a small average ticket is punished twice. Drop the salon in the worked example to an $8 average ticket and the effective rate goes past 4.7%. Under about a $15 ticket, the per-item fees are the thing to fix, and no markup negotiation will touch them.",
      ],
    },
    {
      heading: "Helcim's volume discount, and why it is not a break-even",
      body: [
        "Helcim publishes five volume bands and moves you down them automatically. Card present, the markup runs 0.40% plus 8 cents under $50,000 a month, 0.35% plus 7 cents to $100,000, 0.25% plus 7 cents to $500,000, 0.20% plus 6 cents to $1 million, and 0.15% plus 6 cents to $5 million. Keyed and online runs 0.50% plus 25 cents, then 0.45% plus 20 cents, 0.35% plus 20 cents, 0.25% plus 15 cents and 0.15% plus 15 cents. Above $5 million a month Helcim stops publishing and quotes custom pricing, so this calculator stops there too.",
        "The band is applied on the average of your last three months of processing volume. A good December does not move you down a band on its own, and a slow quarter can move you back up one, so if your volume is seasonal the rate you pay in March is a fact about last winter. There is also nothing to apply for and nobody to negotiate with. That is unusual in this industry.",
        "Because the discount costs nothing to take, there is no break-even in the usual sense. On a paid plan you pay a monthly fee to buy a lower rate, and the crossover is the volume where the saving covers the fee. Helcim charges no monthly fee at any band, so the crossover is simply the published threshold, and the only question worth computing is what crossing it is worth. On the worked example that is $33.33 a month and $399.96 a year, 7 basis points. The volume tiers mode in the Helcim Fee Calculator prices your month at all five bands at once.",
        "Seven basis points is not a reason to restructure a business, but it is a reason to stop splitting volume across two merchant accounts, because the bands are measured per account. A merchant running $30,000 through Helcim and $25,000 through a legacy terminal account is priced at two entry bands instead of one $55,000 band, and pays for the privilege twice.",
      ],
    },
    {
      heading: "Why the interchange assumption is an input, not an answer",
      body: [
        "Visa and Mastercard publish interchange as downloadable rate tables covering several hundred programs, revised twice a year in April and October. The rate that applies to a given sale depends on the card product, the merchant category code, the channel, how the transaction authorized and how much data was passed with it. No calculator can know which program your next sale will land in, and a tool that prints one precise interchange figure for an unknown merchant is presenting a guess as a fact.",
        "So the assumption is on screen and editable. Each band defaults to a named program off the current rate sheets: regulated debit to 0.05% plus 22 cents, non-regulated debit card present to Visa CPS/Retail Debit at 0.80% plus 15 cents, plain consumer credit card present to Visa Retail Credit Performance Threshold III at 1.51% plus 10 cents, rewards credit card present to Visa Signature Preferred at 2.10% plus 10 cents, and commercial to Visa Commercial Card Present at 2.50% plus 10 cents. Card-not-present defaults are higher across the board, which is why the channel question comes first. Tick the override box and every one becomes a field you can fill from your own statement.",
        "The one band with no width to it is regulated debit. The Durbin Amendment caps interchange on debit issued by banks holding $10 billion or more at 0.05% plus 21 cents, with a further cent for issuers certifying compliance with the fraud prevention standards. The Federal Reserve's own Regulation II data for 2024 confirms the realized average on covered dual-message transactions at 22 cents, or 0.45% of value, and puts exempt debit, issued by banks under the threshold, at 61 cents and 1.41%. Debit is not one thing, and the gap between its two halves is larger than most merchants' entire processor markup.",
        "The practical instruction is short. If you hold an interchange-plus statement from Helcim or anyone else, the interchange total is on it, usually as a pass-through line separate from the margin. Put that figure in and this stops being an estimate.",
      ],
    },
    {
      heading: "Where Helcim beats a flat rate, and where it does not",
      body: [
        "On the worked example the arithmetic is one-sided. Square Free charges 2.6% plus 15 cents in person, which on $30,000 across 500 sales is $855.00 against Helcim's $655.37, a difference of $199.63 a month and $2,395.56 a year. Take the same month online and Stripe's 2.9% plus 30 cents is $1,020.00 against Helcim's $850.53, a difference of $169.47 a month and $2,033.64 a year. Those are published rates multiplied out, not estimates.",
        "The catch is that the gap is a property of your card mix, not of Helcim. Flat-rate pricing overcharges most on debit, because a regulated debit card costs the network 0.05% plus 22 cents and a flat rate bills it at the same 2.6% as a premium rewards card. The more debit you take, the bigger the saving from moving to interchange-plus. A merchant whose customers pay almost entirely on rewards credit cards sees far less of it, and on the numbers above would be paying 2.96% all in on Helcim.",
        "Ticket size cuts the other way and can flip the answer. Helcim's keyed and online margin at the entry band carries 25 cents a transaction, which is a real cost on a small sale. Helcim's own pricing page says most merchants land near or below 2% in person and below 2.5% keyed and online. On this page's default mix the first claim holds, at 2.18% in person, but the second does not at a $60 average ticket: the same month online comes out at 2.84%. Raise the ticket to $150 and it falls to 2.43%, under Helcim's stated figure. Which one you get depends on your own numbers rather than on anybody's marketing.",
        "The honest framing is that interchange-plus is a structurally better deal that asks more of you. There is no contract, no monthly fee and no cancellation fee at Helcim, so the switching cost is time rather than money. What you take on is a statement with more lines on it and a bill that moves when the networks move their rates. If nobody is going to read that statement, some of the value of the model goes unused.",
      ],
    },
    {
      heading: "The US fees and edge cases the headline markup does not cover",
      body: [
        "Recurring billing costs more. Helcim adds 0.4% per transaction on automated subscription billing, on top of the volume band markup, which roughly doubles the margin at the entry band and more than triples it at the top one. For a subscription business that is the most important number on the page, and the one most easily missed, because it sits in a different table from the volume ladder.",
        "Cards issued outside the US cost more, but not because Helcim charges for them. The card networks apply a cross-border fee that Helcim passes through inside the interchange-plus price: Visa adds 1.45% plus 3.6 cents, Mastercard 1.45%, Discover 1.30% and American Express 1.00%. Currency conversion is handled by the cardholder's own bank rather than billed to you. If a meaningful share of your customers are overseas, add that percentage to the relevant band in the interchange override rather than to the markup.",
        "Then the fees that are not percentages. There is no monthly account fee, no monthly minimum, no statement fee, no PCI compliance fee, no setup fee and no cancellation fee. A chargeback costs nothing if the case resolves in your favor and $15 if you lose it, a materially better structure than a flat fee win or lose. ACH and EFT-PAD run 0.5% plus 25 cents capped at $6.00, with an extra 0.05% above $25,000, and a returned or NSF bank payment costs $5.00. Refunds carry no added fee, but the original transaction's fees are not returned.",
        "Two things this calculator deliberately does not model. Level 2 and Level 3 interchange optimization, which Helcim supports, can move commercial card transactions into cheaper programs when the extra invoice data is supplied, and the saving depends entirely on data your systems may or may not pass. And the three-month averaging window means the band you are in today reflects volume you already ran, so a fast-growing business is always priced slightly behind itself.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Helcim's published US markup ladder, and what each band works out to on one example month",
    columns: [
      "In person markup",
      "Keyed and online markup",
      "In person effective rate",
      "Keyed and online effective rate",
    ],
    rows: [
      {
        label: "Under $50K a month",
        note: "The entry band",
        values: ["0.40% + $0.08", "0.50% + $0.25", "2.18%", "2.84%"],
      },
      {
        label: "$50K to $100K a month",
        values: ["0.35% + $0.07", "0.45% + $0.20", "2.12%", "2.70%"],
      },
      {
        label: "$100K to $500K a month",
        values: ["0.25% + $0.07", "0.35% + $0.20", "2.02%", "2.60%"],
      },
      {
        label: "$500K to $1M a month",
        values: ["0.20% + $0.06", "0.25% + $0.15", "1.95%", "2.42%"],
      },
      {
        label: "$1M to $5M a month",
        note: "Above $5M Helcim quotes custom pricing rather than publishing a rate",
        values: ["0.15% + $0.06", "0.15% + $0.15", "1.90%", "2.32%"],
      },
    ],
  },
  assumptions: [
    "The two markup columns are Helcim's published US schedule, read from helcim.com/pricing on 5 September 2026, and are a margin over interchange rather than a price. The two effective-rate columns are computed by this page, not published by Helcim: they price $30,000 a month across 500 sales at the default card mix in each band.",
    "Interchange defaults are named programs off the Visa USA Interchange Reimbursement Fees sheet with rates effective 18 April 2026 and the Mastercard 2026 to 2027 US Region Interchange Programs and Rates effective 17 April 2026. The networks publish interchange as rate tables covering several hundred programs rather than as a feed, and they revise them twice a year, so this tool shows a band and a named default rather than a point value, and every band is an editable field.",
    "The regulated debit band is the Durbin Amendment cap of 0.05% plus 21 cents, plus a further cent for issuers certifying compliance with the fraud prevention standards. The Federal Reserve's Regulation II data for calendar year 2024, published 19 December 2025, puts the realised average at 22 cents or 0.45% of value on covered dual-message transactions and 61 cents or 1.41% on exempt ones.",
    "The default card mix splits 41 percent debit to 59 percent credit, which is the 2024 US value share reported by the Federal Reserve Payments Study released in July 2026. How that 41 percent divides between regulated and non-regulated debit, and how the 59 percent divides across plain, rewards and commercial credit, is an editable starting point rather than a published statistic. Replace all five with your own statement figures if you have them.",
    "Assessments default to 0.13% of volume plus 2 cents an authorization. The card networks do not publish assessments the way they publish interchange, so this comes off a government-published acquirer schedule, the Reference Guide for Card Brand Pass Through Fees posted by the North Carolina Office of the State Controller, which gives 0.13% to 0.14% of volume plus roughly 2 cents per authorization. That schedule is dated, which is why the field is editable.",
    "The model gives every card type the same average ticket. In practice debit tickets run smaller than rewards-credit tickets, which pushes real per-item interchange slightly above the figure here. It also excludes Level 2 and Level 3 interchange optimization, the 0.4% recurring billing add-on unless you add it yourself, and the three-month averaging lag on the volume band.",
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "How much does Helcim charge per transaction?",
      answer:
        "Helcim charges interchange plus assessments plus its own margin, which is 0.40% plus 8 cents in person at the entry band. On a $100 card-present sale that margin is 48 cents, but the total fee depends on the card: about $0.90 on regulated debit, $1.58 on non-regulated debit, $2.24 on plain consumer credit, $2.83 on a rewards card and $3.23 on a commercial card, using the April 2026 network rate sheets.",
    },
    {
      question: "What is Helcim's effective rate?",
      answer:
        "On $30,000 a month across 500 card-present sales at the US average card mix, the Helcim Fee Calculator returns 2.18%, or $655.37. The same month taken online comes out at 2.84%, because card-not-present interchange is higher and the online margin carries 25 cents a transaction instead of 8. Helcim's own pricing page says most merchants land near or below 2% in person and below 2.5% online.",
    },
    {
      question: "Does Helcim have monthly fees?",
      answer:
        "No. Helcim's published US schedule carries no monthly account fee, no monthly minimum, no statement fee, no PCI compliance fee, no setup fee and no cancellation fee. The costs outside the per-transaction price are a $15 chargeback fee if you lose a case, nothing if you win it, and $5.00 for a returned ACH payment. Hardware is bought outright rather than leased.",
    },
    {
      question: "How do Helcim's volume discounts work?",
      answer:
        "Automatically, on the average of your last three months of processing volume, across five published bands from under $50,000 a month to $5 million. The card-present margin falls from 0.40% plus 8 cents to 0.15% plus 6 cents across that range. There is nothing to apply for and no fee to recover, so crossing a threshold is pure saving: on a $60 average ticket, moving from the entry band to the $50,000 band is worth $33.33 a month, or $399.96 a year.",
    },
    {
      question: "Is Helcim cheaper than Square?",
      answer:
        "On the example month, by $199.63. Square Free is 2.6% plus 15 cents in person, which on $30,000 across 500 sales is $855.00, against $655.37 on Helcim, a difference of $2,395.56 a year. The gap comes from debit: a flat rate bills a regulated debit card at the same percentage as a rewards card, and interchange-plus does not. A merchant taking mostly rewards credit sees a much smaller gap.",
    },
    {
      question: "Why is my Helcim bill higher than 0.40%?",
      answer:
        "Because 0.40% is Helcim's margin, not the price. Interchange and assessments sit underneath it and are usually three quarters of the bill. On the example month Helcim keeps $160 of a $655.37 total, 24 percent of it, and the other $495.37 goes to the card networks and the issuing banks. That portion follows you to any processor, which is why switching can only ever save you the margin.",
    },
  ],
  related: [
    "interchange-plus-vs-flat-rate-calculator",
    "interchange-fee-lookup",
    "effective-rate-calculator",
    "credit-card-processing-savings-calculator",
    "interchange-downgrade-calculator",
  ],
  links: [
    { label: "Helcim review and full pricing breakdown", href: "/processor/helcim" },
    { label: "Interchange-plus processors", href: "/payment-processors/interchange-plus" },
    { label: "Interchange-plus, defined", href: "/glossary/interchange-plus" },
    { label: "Interchange, defined", href: "/glossary/interchange" },
    { label: "Stripe vs Helcim", href: "/compare/stripe-vs-helcim" },
    { label: "Square vs Helcim", href: "/compare/square-vs-helcim" },
  ],
  cta: {
    heading: "Want interchange-plus quotes to compare against this?",
    body: "Tell us your monthly volume and card mix and we will shortlist processors that price the way Helcim does.",
    label: "Get matched",
  },
};
