import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/adyen-fee-calculator`
 *
 * ─── The intent this page owns ───────────────────────────────────────────────
 * "adyen fee calculator", "adyen pricing", "adyen fees", "adyen interchange++",
 * "how much does adyen charge". The calculation modifier belongs here; Adyen's
 * product, support and contract story belongs to `/processor/adyen`, and the
 * head to head belongs to `/compare/stripe-vs-adyen`. This page ends by linking
 * into both rather than trying to replace either.
 *
 * ─── What the ranking competition gets wrong ────────────────────────────────
 * Every page currently ranking for these terms quotes the two numbers on Adyen's
 * price list, the $0.13 fixed processing fee and the 0.60% acquirer fee, and
 * then stops. Those two numbers are 24 percent of what an Adyen payment actually
 * costs. The other 76 percent is interchange and card scheme fees, which Adyen
 * passes through at cost and therefore never publishes, and which no competing
 * calculator supplies. The result is a SERP of pages implying Adyen costs 0.60%
 * plus 13 cents, which would make it four times cheaper than any acquirer in the
 * world. The second failure is the mirror image: pages that blend Adyen to about
 * 2.9% so it can be compared with Stripe, which erases the only thing that makes
 * interchange++ worth choosing, that a cheap card is cheap.
 *
 * This page does the one thing the competition cannot: it separates the three
 * components and shows which share is Adyen's. On the default scenario that
 * share is 24.5 percent, and it is the only share anyone can negotiate.
 *
 * ─── Where the numbers came from ────────────────────────────────────────────
 * Adyen's own prices: adyen.com/pricing plus two help.adyen.com articles, read 5
 * September 2026. The US page served USD directly on this machine, so no Wayback
 * capture was needed and `checked` is the read date.
 * Interchange: Visa USA Interchange Reimbursement Fees, Visa Supplemental
 * Requirements, rates effective 18 April 2026, read 5 September 2026.
 * Scheme fees: Wells Fargo Merchant Services Payment Network Pass-Through Fee
 * Schedule, effective 1 July 2026, read 5 September 2026, cross-checked against
 * the Fiserv Card Organization Pass-Through Fee Schedule published as Appendix G
 * by the North Carolina Office of the State Controller.
 * The minimum invoice amount is NOT sourced, because Adyen does not publish one.
 * It is a widget input with a starting value and the page says so three times.
 *
 * Every dollar figure in the intro, the worked example, the sections and the
 * rate table was produced by `lib/calc/adyen.ts` and is asserted in
 * `tests/tools/batch-four/adyen-fee-calculator.test.ts`. A hand-written number
 * that disagreed with the widget on the same page has shipped on this site
 * before; do not add one.
 */
export const ADYEN_FEE_TOOL: ToolDef = {
  slug: "adyen-fee-calculator",
  name: "Adyen Fee Calculator",
  h1: "Adyen fee calculator: what interchange++ actually costs",
  title: "Adyen fee calculator: the real cost of a payment",
  description:
    "Adyen fee calculator for US merchants. Splits a payment into interchange, card scheme fees and Adyen's own 0.60 percent plus 13 cents, then prices a month.",
  intro:
    "The Adyen Fee Calculator prices a payment the way Adyen bills it, in three parts rather than one. An $85 online sale on a Visa rewards card costs $2.61: $1.83 of interchange to the card issuer, $0.14 of scheme fees to Visa, and $0.64 to Adyen, which is its 0.60 percent acquirer fee plus its $0.13 fixed processing fee. Only that last 24.5 percent is Adyen's money, and only that last 24.5 percent is negotiable. Enter a payment or a month of volume and this tool splits all three and compares the total against a 2.9 percent plus 30 cents flat rate.",
  tier: 3,
  summary: "Splits an Adyen interchange++ payment into interchange, scheme fees and Adyen's own take.",
  widget: "adyen-fee",
  rateCard: "adyen",
  workedExample: {
    scenario:
      "A US online retailer running $250,000 a month of card volume at an average ticket of $85, so 2,941 payments. Every payment is treated as a Visa consumer credit card with a traditional rewards programme, card not present, which Visa prices at 2.04 percent plus $0.10 under its Product 1 programme effective 18 April 2026. Adyen is on its published floor of a 0.60 percent acquirer fee plus a $0.13 fixed processing fee, scheme fees are taken at 0.14 percent plus $0.0195, and the minimum invoice is set to $120.",
    result:
      "Interchange is 2.04 percent of $250,000, or $5,100.00, plus 2,941 payments at $0.10, or $294.10, so $5,394.10 goes to the card issuers. Scheme fees are 0.14 percent of $250,000, or $350.00, plus 2,941 authorizations at $0.0195, or $57.35, so $407.35 goes to Visa. Those two are $5,801.45 of pass-through that nobody at Adyen sets and nobody can negotiate. Adyen's own bill is 0.60 percent of $250,000, or $1,500.00, plus 2,941 payments at $0.13, or $382.33, so $1,882.33. The month costs $7,683.78, an effective rate of 3.07 percent, and Adyen keeps 24.5 percent of it. The $120 minimum invoice is nowhere near binding: at this ticket it stops costing anything above $3,904 of monthly volume. The same month at 2.9 percent plus 30 cents costs $7,250.00 plus $882.30, which is $8,132.30, so interchange++ saves $448.52 a month and $5,382.24 a year. That saving is fragile in one way: every extra 0.20 percentage points of acquirer fee costs $500 a month here, so a quoted markup above roughly 0.78 percent hands the whole advantage back to the flat rate.",
  },
  sections: [
    {
      heading: "What the Adyen Fee Calculator is splitting apart",
      body: [
        "Adyen does not have a rate. It has a markup, and the markup sits on top of two costs that belong to other companies. The first plus is interchange, which goes to the bank that issued your customer's card. The second plus is the card scheme fee, which goes to Visa or Mastercard. Adyen's own money is what is left: an acquirer fee its documentation says starts at 0.60 percent per transaction and falls with monthly card volume, plus a $0.13 fixed processing fee charged on every transaction whatever the payment method. Quote any one of the three on its own and you have a number that describes nothing.",
        "The Adyen Fee Calculator asks which card was used, applies Visa's published interchange for that card, adds the scheme fee, adds Adyen's two lines, and shows the four figures separately. The split on the default scenario holds roughly across the whole US card mix. An $85 online payment on a Visa traditional rewards card costs $2.61: $1.83 of interchange, $0.14 of scheme fees, $0.51 of Adyen acquirer fee and $0.13 of Adyen processing fee. Pass-through is $1.97, or 75.5 percent. Adyen is $0.64, or 24.5 percent.",
        "That last figure is the only one anybody can negotiate, and a ten basis point improvement on it is worth eight and a half cents on this payment. One quirk catches people on refunds. Adyen's support documentation describes the processing fee as charged when Adyen receives a payment request or a refund request, so a sale that is later refunded carries the $0.13 twice. On a low margin business with a high return rate that is a real line, and it is separate from the interchange the issuer keeps.",
      ],
    },
    {
      heading: "Interchange and scheme fees, the two pluses that are not Adyen's",
      body: [
        "Interchange is the largest component and it is set entirely by the card. Visa publishes the whole schedule. On a card not present consumer credit payment under Visa's Product 1 programme, effective 18 April 2026, a plain card with no rewards programme costs 1.89 percent plus $0.10, a traditional rewards card 2.04 percent plus $0.10, a Visa Signature card 2.05 percent plus $0.10, a Visa Signature Preferred card 2.50 percent plus $0.10, and a spend qualified Visa Infinite card 2.60 percent plus $0.10. That is a 71 basis point spread on identical transactions, wider than Adyen's entire acquirer fee.",
        "Debit is a different world. A regulated debit card, capped by the Durbin Amendment, costs 0.05 percent plus $0.21 online, with an additional $0.01 where the issuer certifies compliance with Visa's fraud prevention standards. An exempt debit card from a small issuer costs 1.65 percent plus $0.15 for the same purchase, over thirty times as much on a $50 order. In a store the rate halves again to 0.80 percent plus $0.15 under CPS/Retail. If much of your volume is regulated debit, a flat rate plan is charging you a credit card price for a debit card cost.",
        "Scheme fees are the smaller plus and the one with no public schedule, because Visa and Mastercard do not publish acquirer facing rates to the open web. What is published is what a bank discloses to its own merchants: a Visa U.S. Acquirer Service Fee of 0.14 percent on credit and 0.13 percent on debit, and an authorization processing fee of $0.0195 on a US credit authorization. Treat those as a floor. Both networks levy a dozen further conditional fees and Adyen passes all of them through in the same invoice line, so this page's default understates the scheme fee rather than overstating it.",
      ],
    },
    {
      heading: "Where Adyen crosses over against 2.9 percent plus 30 cents",
      body: [
        "The received wisdom is that interchange++ beats a flat rate on large tickets and loses on small ones. Run Adyen's actual price list and that inverts. Adyen's total fixed cost on a US card not present credit payment is $0.2495: ten cents of interchange, $0.0195 of scheme fee and $0.13 of processing fee, against 30 cents on a 2.9 percent plus 30 cents flat rate. Adyen is five and a half cents cheaper before the percentage is considered at all, so it wins on the smallest tickets. A $5 payment costs $0.39 on Adyen against $0.45 flat.",
        "What decides the answer is the card, and the crossover runs in both directions. On a plain, traditional rewards or Visa Signature card, Adyen's combined percentage is 2.78 to 2.79 percent, under the flat 2.9 percent, and its fixed cost is under 30 cents, so there is no crossover at all: Adyen is cheaper at every ticket and the gap widens as the ticket grows. On a Visa Signature Preferred card the combined percentage is 3.24 percent and the two prices meet at $14.85, above which the flat rate wins. On a spend qualified Visa Infinite card the crossover falls to $11.48. American Express in North America, at 3.3 percent plus $0.10 on top of the $0.13, crosses at exactly $17.50.",
        "Two readings follow. If your basket is heavy in premium rewards cards, interchange++ transfers that expense onto you and a flat rate is card mix insurance you were getting cheaply. And the answer is sensitive to the acquirer fee you are actually quoted: on $250,000 of monthly volume every extra 0.20 percentage points costs $500 a month, so a markup above roughly 0.78 percent wipes out the $448.52 advantage in the worked example above. Adyen says the acquirer fee starts at 0.60 percent and is determined by monthly card volume, so 0.60 percent is a floor, not a rate to assume.",
      ],
    },
    {
      heading: "The minimum invoice, and the monthly volume that clears it",
      body: [
        "Adyen states on its pricing page that it has no monthly fees, setup fees, integration fees or closure fees, then adds that it does have a minimum invoice depending on industry or business model. It does not say what the minimum is, and this page will not invent one. The calculator treats it as an input with a starting value of $120, the figure third party reviews most commonly report for direct US accounts, and you should replace it with whatever your own agreement says. Enterprise contracts run materially higher.",
        "The mechanism is what matters, and it is the one a merchant account monthly minimum uses: a floor on the invoice, not an extra line on it. Adyen bills the greater of the month's fees and the minimum, so a merchant generating $61.59 of fees against a $120 minimum pays $120, not $181.59. Modelling it as an addition, which is what a monthly fee field invites, overstates a small merchant's bill by the whole of the fees they actually generated. This calculator applies it as a floor for exactly that reason.",
        "The volume that clears the floor is one line of arithmetic: cost per dollar of volume is the combined percentage plus the combined fixed fee divided by the average ticket. On the default profile that is 2.78 percent plus $0.2495 divided by $85, which is 3.0735 percent, so a $120 minimum stops costing anything above $3,904 a month. Change the ticket and it barely moves: $3,176 at a $25 ticket, $4,167 at a $250 ticket. That is a low bar, and it says something plainly. Adyen's minimum invoice is not what keeps small merchants off Adyen. Its onboarding is.",
      ],
    },
    {
      heading: "When the answer is switch, and when it is do nothing",
      body: [
        "Do nothing if your card mix is premium rewards heavy and your quoted acquirer fee is not close to the 0.60 percent floor. Those two together turn interchange++ from a saving into a bill, and both are visible before you sign. Ask for a card mix breakdown off your current statement, then ask Adyen what fee your volume actually earns rather than reading the number off the price list. A quoted markup above roughly 0.78 percent on a rewards heavy US online basket means a 2.9 percent plus 30 cents flat rate is cheaper, and the honest answer is to stay put.",
        "Switch when your volume contains cheap cards you are currently paying a credit card price for. Regulated debit at 0.05 percent plus $0.21 costs $1.03 on an $85 payment through Adyen against $2.77 on a flat rate, and every cent of that difference is currently margin for your flat rate processor. The same logic applies in a store, where Visa's Retail Credit programme prices a plain consumer credit card at 1.43 percent plus $0.10 against 1.89 percent online. A business with a shop and a website should never measure itself against one blended number.",
        "Move the large tickets off cards before renegotiating anything. Adyen prices ACH Direct Debit at $0.27 plus the $0.13 processing fee, so $0.40 flat, with no percentage and no cap because it needs none. A $4,000 B2B invoice costs $0.40 by ACH and $111.45 on a Visa rewards card through the same processor, and the crossover against a card is $3.45. After that, treat the acquirer fee as the only negotiable line and revisit it annually: interchange resets every April and October when Visa republishes, and your markup moves when your volume does.",
      ],
    },
  ],
  rateTable: {
    caption:
      "What an $85 online payment costs on Adyen by card, computed by this page rather than published by Adyen. Adyen's own fees are its 0.60 percent published floor acquirer fee plus its $0.13 processing fee. Interchange is Visa's published US schedule effective 18 April 2026, and scheme fees are taken at 0.14 percent plus $0.0195. The last column is the ticket size at which the total meets a 2.9 percent plus 30 cents flat rate.",
    columns: ["US interchange", "Adyen total", "Effective rate", "Against 2.9% + $0.30"],
    rows: [
      {
        label: "Regulated debit, online",
        note: "Durbin capped, issuer with $10bn or more in assets",
        values: ["0.05% + $0.21", "$1.03", "1.21%", "Adyen cheaper above $2.82"],
      },
      {
        label: "Exempt debit, online",
        note: "Small issuer, outside the Durbin cap",
        values: ["1.65% + $0.15", "$2.33", "2.74%", "Adyen cheaper at every ticket"],
      },
      {
        label: "Consumer credit, no rewards",
        values: ["1.89% + $0.10", "$2.49", "2.92%", "Adyen cheaper at every ticket"],
      },
      {
        label: "Consumer credit, traditional rewards",
        note: "The calculator's default and the most common card in a US online basket",
        values: ["2.04% + $0.10", "$2.61", "3.07%", "Adyen cheaper at every ticket"],
      },
      {
        label: "Visa Signature",
        values: ["2.05% + $0.10", "$2.62", "3.08%", "Adyen cheaper at every ticket"],
      },
      {
        label: "Visa Signature Preferred",
        values: ["2.50% + $0.10", "$3.00", "3.53%", "Adyen cheaper below $14.85"],
      },
      {
        label: "Visa Infinite, spend qualified",
        values: ["2.60% + $0.10", "$3.09", "3.63%", "Adyen cheaper below $11.48"],
      },
      {
        label: "American Express, North America",
        note: "Not interchange++. Adyen publishes 3.3% plus $0.10 as one all in method fee.",
        values: ["Not published", "$3.04", "3.57%", "Adyen cheaper below $17.50"],
      },
      {
        label: "ACH Direct Debit",
        note: "No percentage component at all, so the cost is $0.40 on any amount",
        values: ["None", "$0.40", "0.47%", "Adyen cheaper above $3.45"],
      },
    ],
  },
  assumptions: [
    "Adyen's own fees are its published US pricing, read from adyen.com/pricing on 5 September 2026: a $0.13 fixed processing fee on every transaction, Visa, Mastercard and Maestro at interchange++ plus 0.60 percent, American Express in North America at 3.3 percent plus $0.10, Discover and Diners at 3.95 percent, ACH Direct Debit at $0.27, Cash App Pay at 2.90 percent plus $0.30, Klarna at 4.29 percent plus $0.30, Affirm at 4.19 percent plus $0.30 and Afterpay at 4.99 percent plus $0.30. Adyen's support documentation states that acquirer fees are set by Adyen and determined by monthly card volume, starting at 0.60 percent per transaction, so treat 0.60 percent as a floor rather than as your rate.",
    "Interchange is Visa's own published schedule: Visa USA Interchange Reimbursement Fees, Visa Supplemental Requirements, rates effective 18 April 2026, read 5 September 2026. Card not present credit rows are Visa's Product 1 programme and card present credit rows are Retail Credit, Performance Threshold I. Mastercard publishes a separate schedule with different programme names and different rates, and it is deliberately not mixed in, so every interchange figure on this page is a Visa figure. Merchants in Visa's category programmes for restaurants, supermarkets, fuel, charity, utility, education, insurance and real estate pay different rates again, decided by their merchant category code.",
    "Scheme fees default to 0.14 percent plus $0.0195, the Visa credit assessment and the US credit authorization processing fee, read from the Wells Fargo Merchant Services Payment Network Pass-Through Fee Schedule effective 1 July 2026 on 5 September 2026 and cross-checked against the Fiserv Card Organization Pass-Through Fee Schedule published as Appendix G by the North Carolina Office of the State Controller. Visa and Mastercard do not publish acquirer facing schedules to the open web, which is why the source is a bank's own merchant disclosure rather than the networks. Those two fees are a floor: both networks levy further conditional fees that Adyen passes through in the same line, so your real scheme fee is higher.",
    "Adyen's minimum invoice amount is NOT a published figure and nothing here should be read as one. Adyen's pricing page states that it has no monthly, setup, integration or closure fees and that it does have a minimum invoice depending on industry or business model, without naming an amount. The $120 default in the calculator is the figure third party reviews most commonly report for direct US accounts, and enterprise contracts run materially higher. Replace it with the number in your own agreement. It is applied as a floor on the invoice, not as an added line.",
    "Chargeback fees, Revenue Protect, the Authentication Engine for 3D Secure, network tokenization, terminal hardware and terminal SIM subscriptions are all billed separately by Adyen and none of their amounts are published, so none of them are modelled here. Adyen's support documentation also states that the fixed processing fee is charged when Adyen receives a payment request or a refund request, so a refunded sale carries it twice.",
    "One card profile is applied across a whole month in monthly mode. A real basket mixes regulated debit, exempt debit, plain credit and premium rewards cards, so a real blended answer sits between the profiles shown. Percentage fees are charged on the volume you enter and fixed fees on a whole number of payments, so the transaction count is rounded to the nearest payment.",
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "How much does Adyen charge per transaction?",
      answer:
        "Adyen charges a $0.13 fixed processing fee on every transaction plus a payment method fee. On Visa and Mastercard that method fee is interchange++ plus an acquirer fee starting at 0.60 percent, so the total is interchange plus scheme fees plus 0.60 percent plus $0.13. An $85 online payment on a Visa rewards card works out at $2.61, of which $1.97 is pass-through to the issuer and the card network and $0.64 is Adyen's.",
    },
    {
      question: "What is Adyen's interchange++ pricing?",
      answer:
        "Interchange++ bills three separate costs rather than one blended rate: the interchange fee that goes to the bank that issued the card, the scheme fee that goes to Visa or Mastercard, which is the first plus, and the acquirer fee, which is the second plus and is Adyen's. Adyen sets only the third and says it is determined by monthly card volume, starting at 0.60 percent. On a typical US online payment the two pass-through components are about 75 percent of the total.",
    },
    {
      question: "Is Adyen cheaper than Stripe?",
      answer:
        "It depends on your card mix, not your ticket size. On a Visa traditional rewards card Adyen at its 0.60 percent floor totals 2.78 percent plus $0.2495 against 2.9 percent plus $0.30, so it is cheaper at every amount. On a Visa Signature Preferred card it totals 3.24 percent plus $0.2495 and the two meet at $14.85, above which the flat rate wins. On $250,000 a month at an $85 ticket the rewards scenario saves $448.52 a month.",
    },
    {
      question: "Does Adyen have a monthly fee or a minimum?",
      answer:
        "No monthly fee. Adyen's pricing page states it has no monthly fees, setup fees, integration fees or closure fees, and then that it does have a minimum invoice depending on industry or business model. Adyen does not publish the amount. Third party reviews commonly report around $120 a month for direct US accounts. If yours is $120, at an $85 average ticket it stops costing anything above roughly $3,904 of monthly card volume, and across realistic ticket sizes the clearing point sits between $3,200 and $4,200.",
    },
    {
      question: "What is Adyen's 0.60 percent fee?",
      answer:
        "It is the acquirer fee, the second plus in interchange++, and alongside the $0.13 processing fee it is the only part of an Adyen card payment that is Adyen's own revenue. Adyen's support documentation says acquirer fees are set by Adyen and determined by monthly card volume, starting at 0.60 percent per transaction, so it is a floor for high volume accounts rather than a rate everyone pays. On $250,000 of monthly volume, every extra 0.20 percentage points costs $500 a month.",
    },
    {
      question: "Why is my Adyen invoice higher than 0.60 percent plus 13 cents?",
      answer:
        "Because 0.60 percent plus $0.13 is roughly a quarter of the cost. The rest is interchange and scheme fees, which Adyen collects and passes through at cost. On an $85 Visa rewards payment the interchange line is $1.83 and the scheme fee line is $0.14, against $0.64 for Adyen. Adyen itemizes markup, scheme fees and interchange separately on the invoice, so read those three lines individually. Only the markup is worth a conversation with your account manager.",
    },
  ],
  related: [
    "interchange-plus-vs-flat-rate-calculator",
    "interchange-fee-lookup",
    "cross-border-fee-calculator",
    "effective-rate-calculator",
    "helcim-fee-calculator",
  ],
  links: [
    { label: "Adyen review and full pricing breakdown", href: "/processor/adyen" },
    { label: "Stripe vs Adyen", href: "/compare/stripe-vs-adyen" },
    { label: "Interchange-plus processors", href: "/payment-processors/interchange-plus" },
    { label: "Multi-currency processors", href: "/payment-processors/multi-currency" },
    { label: "What interchange is", href: "/glossary/interchange" },
    { label: "Interchange-plus pricing explained", href: "/glossary/interchange-plus" },
  ],
  cta: {
    heading: "Find out what your card mix is really worth",
    body: "Interchange++ pays only when your basket holds cards a flat rate is overcharging you for. Tell us your volume and we will shortlist processors that price your mix at cost.",
    label: "Get matched",
  },
};
