import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/braintree-fee-calculator`.
 *
 * ─── The intent this page owns ───────────────────────────────────────────────
 * "braintree fee calculator" and the informational sibling every one of those
 * searchers also types, "braintree fees". The calculation modifier is ours; the
 * brand pricing narrative stays on `/processor/braintree`, the head-to-heads stay
 * on `/compare/paypal-vs-braintree` and `/compare/stripe-vs-braintree`, and this
 * page links into all three rather than restating them.
 *
 * ─── What the ranking competition gets wrong ─────────────────────────────────
 * Three checkable things.
 *
 * 1. THE RATE. `braintreepayments.com/braintree-pricing` now 301s to
 *    `paypal.com/us/enterprise/paypal-braintree-fees`. Several 2026 review pages
 *    and at least one "Braintree pricing calculator" quote 2.59% + $0.49, which
 *    is not what the live US fee table says. It says 2.89% + $0.29.
 * 2. THE PAYPAL ROW. Braintree's fee table gives PayPal transactions no rate at
 *    all: it says they are "Subject to the terms applicable to your PayPal
 *    account". Every calculator that prices a Braintree checkout at one blended
 *    percentage is wrong for any store where customers use the PayPal button,
 *    because that path bills at PayPal's own US Checkout rate of 3.49% + $0.49.
 *    On a $60 order that is a 56 cent difference per sale, and it is the whole
 *    story of this page: one company, two prices, one integration.
 * 3. THE ADD-ONS. Braintree publishes TWO separate 1% add-ons, one for a non-USD
 *    presentment currency and one for a card issued outside the US. Pages that
 *    fold them into a single "international" toggle understate a Eurozone sale by
 *    exactly one percent.
 *
 * ─── Where the numbers came from ─────────────────────────────────────────────
 * Every rate is in `lib/rate-cards/braintree.ts` with its own source and the
 * 5 September 2026 checked date. Every dollar figure in the copy below is
 * arithmetic on those rates, reproduced independently in
 * `tests/tools/batch-four/braintree-fee-calculator.test.ts`, and every one of
 * them is reproducible in the widget on this page. The two numbers deliberately
 * NOT published as fact are the qualifying volume for custom pricing (PayPal
 * publishes none; the widely repeated $80,000 a month is attributed, not
 * asserted) and any per-decline fee (Braintree publishes none, only the Visa and
 * Mastercard excessive-retry charges, which are network fees and are labelled as
 * such).
 */

const NOT_ADVICE =
  "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.";

export const BRAINTREE_FEE_TOOL: ToolDef = {
  slug: "braintree-fee-calculator",
  name: "Braintree Fee Calculator",
  h1: "Braintree fee calculator",
  title: "Braintree fee calculator: card, PayPal, Venmo and ACH rates",
  description:
    "Braintree fee calculator for US merchants: price cards at 2.89 percent plus 29 cents, the PayPal wallet and Venmo rates, and ACH with its 5 dollar cap.",
  intro:
    "Braintree fees start at 2.89% plus 29 cents on a US card, but the customer decides which price you actually pay. Braintree is owned by PayPal, and a PayPal wallet payment taken inside Braintree bills under your PayPal account terms instead, which is 3.49% plus 49 cents. Venmo is the same. On a $60 order that is $2.02 against $2.58, a 56 cent gap on every wallet checkout. This Braintree Fee Calculator prices each method separately, including ACH at 0.75% capped at $5.00 and the two 1% cross-border add-ons.",
  tier: 2,
  summary:
    "Price a Braintree sale by payment method: cards, the PayPal wallet, Venmo, ACH and the two 1% add-ons.",
  widget: "brand-fee",
  rateCard: "braintree",
  workedExample: {
    scenario:
      "Harbor Lane Goods is a US ecommerce store on Braintree standard pricing. It takes 1,000 orders a month at an average ticket of $60, so $60,000 of monthly volume. The mix is 620 card orders, 250 paid with the PayPal button, 90 paid with Venmo and 40 collected by ACH bank debit, and it receives three chargebacks a month.",
    result:
      "Cards: 620 orders is $37,200 of volume, so 2.89% is $1,075.08 plus 620 fixed fees of 29 cents, which is $179.80, giving $1,254.88. PayPal wallet: 250 orders is $15,000, so 3.49% is $523.50 plus 250 fixed fees of 49 cents, which is $122.50, giving $646.00. Venmo: 90 orders is $5,400, so 3.49% is $188.46 plus $44.10 of fixed fees, giving $232.56. ACH: 40 orders is $2,400 at 0.75% with no fixed fee, giving $18.00, and no debit is anywhere near the $5.00 cap at a $60 ticket. Three chargebacks at $15.00 add $45.00. Total Braintree cost is $2,196.44 on $60,000, a blended effective rate of 3.66%, not 2.89%. Now the number that decides something: if those same 960 card, PayPal and Venmo orders had all run at the Braintree card rate, they would have cost $1,943.04 instead of $2,133.44. The wallet mix costs $190.40 a month, $2,284.80 a year, which is exactly 340 wallet orders times the 56 cent per-order gap.",
  },
  sections: [
    {
      heading: "What Braintree fees actually are, method by method",
      body: [
        "The published US rate for cards and third-party digital wallets is 2.89% plus 29 cents per transaction. On a $60 order that is $2.02 and you keep $57.98. On $100 it is $3.18. The percentage holds steady as the ticket size changes, but the 29 cents does not scale, so the effective rate falls as the order grows: 8.69% on a $5 sale, 4.05% on $25, 3.37% on $60, 3.18% on $100. If your average order is under about $15, the fixed fee rather than the percentage is what your rate is made of, and negotiating basis points will not touch it.",
        "The card rate is not the whole card. Two separate 1% add-ons stack on top of it, and they are separate conditions: one applies to a payment presented in any non-USD currency, the other to a customer card issued outside the United States. A European buyer paying in euros on a European card triggers both, which makes the rate 4.89% plus 29 cents. On the same $60 order that is $3.22 rather than $2.02, an effective 5.37%. Braintree publishes them as two rows, not one.",
        "Verified 501(c)(3) charities pay 2.19% plus 29 cents on cards and digital wallets. Nothing else moves: Venmo, both ACH products, the two add-ons, the returned ACH fee and the $15.00 chargeback fee are identical on the charity schedule. On $60,000 of monthly card volume the 70 basis point discount is worth $420 a month, which is the largest single line item on this page that costs nothing but paperwork to claim.",
        "One more shape of fee is easy to miss. A merchant holding its own American Express agreement can pass Amex through Braintree at a flat 15 cents per transaction with no Braintree percentage on top at all. On a $60 Amex sale that is 15 cents against $2.02. Braintree publishes no monthly fee on standard US pricing, so outside the per-transaction lines and the dispute fees there is no fixed cost to model.",
      ],
    },
    {
      heading: "The PayPal wallet inside Braintree is priced by PayPal, not by Braintree",
      body: [
        "PayPal has owned Braintree since 2013, and the most expensive consequence is that the two products are still priced separately. Braintree's own US fee table does not give PayPal a rate. Against the row labelled PayPal transactions it says the transaction is subject to the terms applicable to your PayPal account. Your PayPal account's published US commercial rate for a Checkout payment is 3.49% plus 49 cents. So one company sells you a card at 2.89% plus 29 cents and its own wallet at 3.49% plus 49 cents, through a single integration, and only one of those numbers appears on the Braintree page.",
        "On a $60 order the card path costs $2.02 and the PayPal wallet path costs $2.58. That is 56 cents a sale, every sale, and it is invisible in a blended effective rate until you split your settlement report by payment method. A store where a third of orders arrive through the PayPal button is not paying 2.89% and never was.",
        "Venmo lands at the same 3.49% plus 49 cents, US only, and unlike the PayPal row, Braintree does publish that rate itself rather than deferring to your PayPal account. For costing purposes the two wallets behave as one bucket at 3.49% plus 49 cents against a card bucket at 2.89% plus 29 cents. Cross-border behaves differently by path too: Braintree's card add-ons are 1% each, while a PayPal-funded transaction follows PayPal's own schedule, where the international commercial add-on is 1.50%.",
        "None of this argues for switching the wallets off. Offering PayPal and Venmo lifts conversion for some catalogs, and 56 cents on an order you would not otherwise have won is not a cost at all. The point is to know the number rather than assume it away. Price the two paths separately in the Braintree Fee Calculator above, multiply the gap by the wallet orders you genuinely receive, and then decide whether the wallet is paying for itself.",
      ],
    },
    {
      heading: "ACH, the $5.00 cap, and the invoice size where it changes the answer",
      body: [
        "Braintree's ACH Direct Debit is 0.75% with a maximum fee of $5.00 per transaction. There is no fixed component, which matters more than it sounds: many ACH products carry a minimum, and a 25 cent floor turns a $10 debit into a 2.5% payment. Braintree's does not, so on this rate card ACH is cheaper than the card rate at every amount, from the first cent. That is not true of every processor, so check it rather than assume it.",
        "The cap is where the money is. At 0.75%, the fee reaches $5.00 at $666.67, and above that it stops moving entirely. A $2,000 business invoice costs $58.09 on a card and $5.00 by ACH, a difference of $53.09 on a single payment. A business collecting twenty invoices of that size a month is spending $1,061.80 to accept cards on money it could take by bank debit. This is the largest saving on the whole rate card, and it costs a change to an invoice template.",
        "Same-day ACH is a different product at 1.5% plus 10 cents, and Braintree publishes no cap on it. On that same $2,000 invoice it is $30.10 rather than $5.00. Same-day settlement is worth paying for on a payment you are chasing; it is not worth switching on by default. Returned or disputed ACH debits cost $5.00 each, so one customer with an unreliable balance can erase the saving on their own invoice.",
        "One honest warning about the calculator above. The shared brand widget applies a percentage and a fixed fee and does not apply caps, so on an ACH amount over $666.67 it will report more than Braintree charges. Read the ACH line as 0.75% up to a ceiling of $5.00, and treat $5.00 as the answer for anything larger. It is stated here rather than quietly patched because a labelled limitation is worth more than a silent overstatement.",
      ],
    },
    {
      heading: "Chargebacks, refunds, declines and the fees that never come back",
      body: [
        "A chargeback costs $15.00 on Braintree, on the standard and the charity schedules alike, and that sits on top of losing the disputed amount and the processing fee already paid on it. On the $60 order used throughout this page, a single chargeback costs $60 of goods, the $2.02 fee that is not returned, and $15.00 of dispute fee, which is $77.02 of damage on a sale that grossed $60. That ratio is why a chargeback rate a fraction of a percent still deserves engineering time.",
        "Refunds are the fee people are most often surprised by, and Braintree states the rule plainly: transaction fees charged by Braintree will not be returned for refunded transactions. Refund a $60 card order and the customer receives the full $60 while the $2.02 stays gone, so a refunded sale costs you the fee twice in margin terms. There is one documented exception worth knowing. Braintree's transaction-level fee report carries refunded interchange and refunded discount rows for merchants on interchange-plus pricing, which flat-rate merchants do not get. The answer to whether Braintree refunds fees is therefore no on flat rate, and partly on interchange plus.",
        "Declines are the cost almost nobody models, and the honest version is narrower than the internet suggests. Braintree publishes no fee for a declined authorization on standard US pricing. What it does document is the card networks' excessive-retry charges, which pass through to you: Visa charges 10 cents on a domestic transaction and 15 cents on an international one for every retry beyond the network threshold, and Mastercard charges 10 cents for every reattempt beyond ten in a rolling 24 hours on merchant advice codes 03 and 21. A dunning routine that hammers a failed subscription card is buying itself a fee schedule. Retry on a published schedule, not in a loop.",
        "Custom pricing exists but is not published. Braintree's US fee page says custom flat rates, interchange plus pricing and discounted rates are available to established businesses based on business model and processing volume, and it names no qualifying volume. Several 2026 review sites quote roughly $80,000 a month as the point where the sales conversation becomes available. PayPal does not publish that figure, so this page attributes it rather than asserting it.",
      ],
    },
    {
      heading: "How the Braintree Fee Calculator reads your mix, and when the answer is do nothing",
      body: [
        "The Braintree Fee Calculator prices one payment method at a time, in a single-payment mode and a monthly mode, because that is the only way to model a rate card whose price depends on which button the customer pressed. Run it once per method with that method's volume and transaction count, add the results, then divide by total volume. That blended figure, not the 2.89% headline, is the number to put beside another processor's quote.",
        "The blended rate is also the only place the verdict band means anything. It scores a merchant's monthly effective rate against the bands this site uses across every fee tool. Judging one payment against them would label a perfectly ordinary Braintree rate on a $5 sale as very high, which is a fact about the 29 cent fixed fee rather than about the deal you are on.",
        "Once you have the number, the answer is usually do nothing about the gateway. Braintree at 2.89% plus 29 cents is a cent or two cheaper than Stripe's standard online rate of 2.9% plus 30 cents at every ticket size, but only just: on $60,000 a month across 1,000 orders the entire difference is $16.00. Re-integrating a checkout to save $16.00 a month is a loss before the first line of code. The things worth acting on are structural instead: moving large invoices to ACH, checking whether the wallet mix carries its own cost, tightening a retry loop that is buying network fees, and asking for custom pricing once your volume makes that conversation worth having.",
        "If your blended effective rate lands above roughly 3.2%, the card rate is usually not the reason. It is a mix problem or an add-on problem: too much wallet volume, too many cross-border sales carrying both 1% add-ons, chargebacks at $15.00 each, or an invoice book sitting on cards that belongs on bank debit. Work down that list before you shop for a new processor, because a new processor will not fix any of it.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Braintree US rates by payment method. The rates are read from PayPal's published US Braintree fee schedule; the cost column is computed by this page.",
    columns: ["Rate", "Cost on a $60 sale"],
    rows: [
      {
        label: "Cards and third-party digital wallets",
        note: "The standard US commercial rate",
        values: ["2.89% + $0.29", "$2.02"],
      },
      {
        label: "Cards, verified 501(c)(3) charity",
        values: ["2.19% + $0.29", "$1.60"],
      },
      {
        label: "PayPal wallet inside Braintree",
        note: "Braintree defers to your PayPal account terms. Shown at PayPal's published US Checkout rate.",
        values: ["3.49% + $0.49", "$2.58"],
      },
      { label: "Venmo", note: "US only", values: ["3.49% + $0.49", "$2.58"] },
      {
        label: "ACH Direct Debit, standard",
        note: "Capped at $5.00, which binds above $666.67",
        values: ["0.75%", "$0.45"],
      },
      {
        label: "ACH Direct Debit, same day",
        note: "No cap published",
        values: ["1.5% + $0.10", "$1.00"],
      },
      {
        label: "Pass-through American Express",
        note: "Requires your own American Express account",
        values: ["$0.15", "$0.15"],
      },
      { label: "Presented in a non-USD currency", values: ["+1%", "+$0.60"] },
      { label: "Customer card issued outside the US", values: ["+1%", "+$0.60"] },
      { label: "Chargeback", values: ["$15.00", "$15.00"] },
      { label: "ACH returned or disputed", values: ["$5.00", "$5.00"] },
      { label: "Monthly fee", values: ["$0", "$0"] },
    ],
  },
  assumptions: [
    "Rates are PayPal's published US Braintree fee schedule, read on 5 September 2026 from a page stating it was last updated on 7 May 2026. braintreepayments.com now redirects to that page.",
    "The PayPal wallet figure of 3.49% plus 49 cents is PayPal's own published US Checkout commercial rate, read on 5 September 2026, because Braintree's table prices PayPal transactions as subject to your PayPal account terms rather than publishing a rate of its own. A merchant on negotiated PayPal pricing pays something else.",
    "Standard ACH is capped at $5.00 per transaction and the shared brand widget does not apply caps. Above $666.67 the true fee is $5.00 flat, whatever the calculator shows.",
    "Custom flat rates and interchange plus pricing are available to established businesses and are not modelled here. PayPal publishes no qualifying volume, and the $80,000 a month figure repeated by review sites is attributed on this page, not asserted.",
    "The 10 and 15 cent retry charges are Visa and Mastercard network fees documented in Braintree's developer documentation, read on 5 September 2026. They are not a Braintree decline fee, and Braintree publishes no fee for a declined authorization on standard pricing.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "How much does Braintree charge per transaction?",
      answer:
        "2.89% plus 29 cents on US cards and third-party digital wallets, which is $2.02 on a $60 order. Venmo is 3.49% plus 49 cents, ACH is 0.75% capped at $5.00, and a verified 501(c)(3) charity pays 2.19% plus 29 cents. A chargeback costs $15.00 and there is no published monthly fee.",
    },
    {
      question: "Is Braintree cheaper than PayPal?",
      answer:
        "On cards, yes, and they are the same company. Braintree's card rate is 2.89% plus 29 cents against PayPal Checkout at 3.49% plus 49 cents, which on a $60 order is $2.02 against $2.58. The catch is that a customer who pays with the PayPal button inside Braintree still pays the PayPal rate.",
    },
    {
      question: "Does Braintree charge extra when a customer pays with PayPal or Venmo?",
      answer:
        "Effectively yes. Braintree's fee table gives PayPal transactions no rate at all, saying they are subject to your PayPal account terms, which is 3.49% plus 49 cents on the published US schedule. Venmo is 3.49% plus 49 cents too. Both cost 56 cents more than the card rate on a $60 order.",
    },
    {
      question: "Does Braintree refund fees when you refund a customer?",
      answer:
        "No, on flat-rate pricing. Braintree states that transaction fees will not be returned for refunded transactions, so refunding a $60 order returns $60 to the customer while the $2.02 fee stays gone. Merchants on interchange plus do see refunded interchange and refunded discount rows in the transaction-level fee report.",
    },
    {
      question: "How much does Braintree charge for ACH?",
      answer:
        "0.75% per transaction with no fixed fee, capped at $5.00. The cap binds from $666.67 upward, so a $2,000 invoice costs $5.00 by ACH against $58.09 on a card, a saving of $53.09. Same-day ACH is 1.5% plus 10 cents with no published cap, and a returned debit costs $5.00.",
    },
    {
      question: "Does Braintree charge for declined transactions?",
      answer:
        "Braintree publishes no fee for a declined authorization on standard US pricing. What it does pass through are network retry charges: Visa bills 10 cents domestic and 15 cents international for each retry beyond its threshold, and Mastercard bills 10 cents for every reattempt beyond ten in 24 hours on advice codes 03 and 21.",
    },
  ],
  related: [
    "paypal-fee-calculator",
    "stripe-fee-calculator",
    "chargeback-cost-calculator",
    "effective-rate-calculator",
    "refund-cost-calculator",
  ],
  links: [
    { label: "Braintree review and full pricing breakdown", href: "/processor/braintree" },
    { label: "PayPal vs Braintree", href: "/compare/paypal-vs-braintree" },
    { label: "Stripe vs Braintree", href: "/compare/stripe-vs-braintree" },
    { label: "What a payment gateway is", href: "/glossary/payment-gateway" },
    { label: "Processors for ecommerce", href: "/category/ecommerce" },
  ],
  cta: {
    heading: "Paying the wallet rate on most of your orders?",
    body: "Tell us your volume and your payment method mix and we will shortlist processors that price it better.",
    label: "Get matched",
  },
};
