import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/cross-border-fee-calculator`
 *
 * ─── The search intent this page owns ────────────────────────────────────────
 * The calculation half of "cross border fee", "fx markup calculator",
 * "international transaction fee merchant" and "currency conversion fee". A US
 * merchant looks at a settlement report, sees less money than the sale was worth,
 * and cannot tell which of three charges took it. The page owns the arithmetic
 * and links out to `/glossary/multi-currency`, `/glossary/assessment-fee`,
 * `/payment-processors/multi-currency` and `/category/international` for the
 * definition, the shortlist and the category intents.
 *
 * ─── What the ranking competition gets wrong ─────────────────────────────────
 * Three things, all checkable.
 *
 * 1. It treats three charges as one. The card network cross border assessment is
 *    a GEOGRAPHY charge and is billed even when the whole transaction settles in
 *    dollars. The processor international card fee is the processor's own add-on
 *    and on flat rate pricing it REPLACES the assessment. The conversion markup
 *    is a CURRENCY charge and is not a fee at all, it is a spread inside a rate.
 *    Most pages add the first two together, which double counts, or omit the
 *    third, which is usually the largest.
 * 2. It quotes a Visa International Service Assessment of 0.80%. Every secondary
 *    page found in September 2026 still carries that number. A US bank's own
 *    current pass-through schedule prints 1.00% base and 1.40% enhanced, plus a
 *    0.45% International Acquirer Fee on top. The stale figure understates a
 *    foreign card by 65 basis points.
 * 3. It cannot compare a processor quoting a percentage against one quoting a
 *    rate, because it never derives an implied markup. The widget's third mode
 *    does exactly that, against a free official US reference rate.
 *
 * ─── Where the numbers came from ────────────────────────────────────────────
 * Network layer: Wells Fargo Merchant Services Payment Network Pass-Through Fee
 * Schedule, effective 1 July 2026, read 5 September 2026. Processor layer: each
 * processor's own published US page, dated per row in `lib/tools-data/fx.ts`;
 * stripe.com and paypal.com geo-redirect this machine, so both were read off
 * Wayback captures of the US pages and the capture date is the checked date.
 * Reference rates: Federal Reserve H.10, weekly release dated 31 August 2026.
 * Dynamic currency conversion mechanics: Adyen's own developer documentation and
 * Visa's cardholder guidance, both read 5 September 2026.
 *
 * Every dollar figure in `workedExample` is reproducible with the widget on this
 * page and is asserted in `tests/tools/batch-four/cross-border-fee-calculator.test.ts`
 * against hand arithmetic. Do not edit one without re-running the other.
 */
export const CROSS_BORDER_FEE_TOOL: ToolDef = {
  slug: "cross-border-fee-calculator",
  name: "Cross-Border and FX Markup Calculator",
  h1: "Cross border fee and FX markup calculator",
  title: "Cross Border Fee & FX Markup Calculator | Estimate Costs",
  description:
    "Use our cross border fee and FX markup calculator to estimate international card fees, currency conversion markups, network charges, and blended payment costs.",
  intro:
    "A cross border fee is not one charge, it is three, and only two of them appear on your statement. The card networks bill a US acquirer 1.45% when the card was issued abroad and the sale still settled in dollars, and 1.85% when it did not. Your processor adds its own international fee on top, typically 1% to 1.5%. Then, if the money had to be converted, a currency conversion markup is taken inside the exchange rate, where it is never a line item. This Cross-Border and FX Markup Calculator separates all three and derives the markup hidden in a rate you were actually given.",
  tier: 2,
  summary: "Separate the network cross border fee, the processor add-on and the FX markup buried in your exchange rate.",
  widget: "fx-markup",
  workedExample: {
    scenario:
      "A Denver based online store on standard Stripe pricing sells a $180 order to a customer in Germany, priced in euros. The card was issued outside the US and the euros have to be converted into the store's dollar balance. The owner also wants to know what the euro leg cost: customers paid 1,000 euros across the month's German orders and $1,125.00 landed in the account.",
    result:
      "On the payment: 2.9% of $180 is $5.22, plus the 30 cent fixed fee, so the base card fee is $5.52. The international card add-on is 1.5% of $180, which is $2.70. The currency conversion markup is 1% of $180, which is $1.80. Total $10.02, so the store nets $169.98 and the all-in rate is 5.57%, against 3.07% for the identical order on a US card paid in dollars. Being international cost $4.50, which is 2.5% of the sale and roughly four fifths of the entire domestic processing fee. On the euro leg: the Federal Reserve H.10 release for the week to 28 August 2026 puts the euro at 1.1598 US dollars, so 1,000 euros was worth $1,159.80. The account received $1,125.00, a rate of 1.1250. The difference is $34.80, a markup of 3.00% measured against the mid market value, or 3.09% measured against the rate the store was given. At 600 converted payments a year that spread is $20,880, and none of it ever appeared as a fee. Blended across the month: at $60,000 of volume with a $180 average ticket, 18% of it on foreign cards and 12% needing conversion, the month costs $2,074.00. That is a blended effective rate of 3.46% against 3.07% with no international mix at all, so the mix adds 39 basis points, $234 a month and $2,808 a year.",
  },
  sections: [
    {
      heading: "What a cross border fee actually is, and the two charges it is not",
      body: [
        "A cross border fee is a card network assessment charged because the acquiring bank and the issuing bank sit in different countries. It is a geography test. It is not a currency charge, it is not your processor's charge, and it is billed in full on a sale that begins and ends in US dollars. Merchants routinely pay all three charges while believing they paid one.",
        "Card networks do not publish acquirer facing schedules to the open web, but US banks disclose them to their own merchants. Wells Fargo's pass-through schedule effective 1 July 2026 prints a Visa International Service Fee of 1.00% where the merchant is in the US, the issuer or cardholder is outside it, and the sale settled in USD, rising to 1.40% where it did not, plus a Visa International Acquirer Fee of 0.45% either way. Mastercard reaches the same place differently: US Cross Border at 0.60% or 1.00%, plus a Global Acquirer Fee of 0.85%. Both land on 1.45% and 1.85%. Discover charges one International Service Fee of 0.80%. There is a per item step too: Visa bills $0.0395 to authorize an international credit transaction against $0.0195 domestically.",
        "The second charge is your processor's international card fee, and here is the trap that ruins most published estimates. On flat rate pricing the add-on is what you pay INSTEAD of the assessment, because the processor already absorbed the assessment when it set the add-on. Stripe, Square and PayPal charge 1.5%, Shopify Payments and Braintree charge 1%. On interchange plus the assessment reaches your statement and the processor adds nothing: Helcim publishes its pass-through as Visa plus 1.45% and 3.6 cents, Mastercard plus 1.45%, which is exactly the sum of the two Visa lines and of the two Mastercard lines in the bank schedule. Most pages ranking for this term still quote 0.80% and omit the acquirer fee, understating a foreign card by 65 basis points before anyone mentions currency.",
      ],
    },
    {
      heading: "The FX markup is a rate, not a fee, which is why nobody sees it",
      body: [
        "The third charge is different because it is usually not expressed as money at all. A conversion charge is a spread: the provider converts at a rate slightly worse than the mid market rate and keeps the difference. Nothing is deducted, nothing appears on a statement, and the arithmetic reconciles perfectly. You simply received fewer dollars than the sale was worth.",
        "Some processors do state it as a percentage. Stripe publishes plus 1% when conversion is required, and separately notes that its Adaptive Pricing feature presents the shopper a conversion fee starting at 2%. Braintree adds 1% when a transaction is presented in any non-USD currency. Shopify Payments charges 1.5% for United States stores and 2% elsewhere, and is the only one here whose documentation states the underlying rate is a mid-market rate without any markup, which makes the charge auditable rather than merely disclosed. PayPal publishes the largest figure and publishes it as a spread rather than a fee: 3.00% on most transactions and 4.00% on the listed conversion types.",
        "Comparing those needs a reference rate from somebody who is not selling you anything, and in the United States that is the Federal Reserve's H.10 release, which is free, weekly and official. Multiply the foreign amount by the H.10 rate, subtract what landed, divide by the mid market value. The Cross-Border and FX Markup Calculator takes the quote direction as an input, because H.10 prints the euro as dollars per euro and the yen as yen per dollar, and reading one as the other inverts the answer silently. It also reports the markup two ways, because a provider that adds 3% to a yen per dollar quote takes 2.9126% of the value, not 3%.",
      ],
    },
    {
      heading: "Dynamic currency conversion, and who actually gets the money",
      body: [
        "Dynamic currency conversion is the terminal prompt offering a foreign cardholder the chance to pay in their own currency rather than yours. It is the most expensive version of everything above, because the markup is larger than a processor's own conversion fee and is charged to the cardholder rather than to you. That last part is why someone will sell it to you as free money.",
        "The mechanics are documented rather than rumored. Adyen's developer documentation states that a customer selecting DCC pays the current exchange rate plus an additional markup, and that Adyen uses a revenue share model where the markup revenue can be split between the platform, the merchant and Adyen. After the portion Adyen keeps is deducted, the platform chooses how to split what is left. In Adyen's settlement report the DCC markup is its own column, where a negative amount indicates a credit in favor of the merchant. So all three gain, in an order set by a contract, and the rate is agreed in an addendum rather than published.",
        "The network rules that constrain it are also your best defense as a buyer. The cardholder must be prompted to choose, DCC must not be offered by default or on an opt-out basis, and the disclosure has to carry the total in both currencies, the rate used, and any commission, fees or markups over the wholesale or government mandated rate. Visa tells its own cardholders that merchants must not choose on their behalf. The European Union went further: Regulation (EU) 2019/518 requires conversion charges to be expressed as a percentage mark-up over the latest available European Central Bank reference rates, with the main provisions applying from 19 April 2020. Nothing equivalent exists in the United States, which is why you have to compute it yourself.",
      ],
    },
    {
      heading: "How the three charges stack on one payment",
      body: [
        "Stacking is the part worth modeling. A $180 order on standard Stripe pricing costs $5.52 domestically. Add the international card add-on and it is $8.22. Add the conversion markup and it is $10.02. The all-in rate moves from 3.07% to 5.57%, and the two extra charges come to $4.50, roughly four fifths of the entire domestic fee on the same order.",
        "The two tests are independent, and modeling them as one is the second most common error here. Braintree prices them separately: 1% where the card was issued outside the United States, and 1% where the transaction is presented in any non-USD currency. A US issued card charged in euros picks up the second and not the first. A UK card charged in dollars picks up the first and not the second. A UK card charged in euros picks up both. That is why the calculator gives you two checkboxes.",
        "Which charge lands on your statement depends on your pricing model. Whether the third charge happens at all depends on the settlement currency. On flat rate you see the add-on and never the assessment; on interchange plus you see the assessment and the processor adds nothing. A euro balance paid out to a euro account is never converted, so the spread does not shrink, it does not occur, which is why Adyen lets you choose when and in which currency you settle. The cross border assessment survives that, because it is about where the card was issued. Then there is scale: at $60,000 a month with a $180 average ticket, 18% foreign volume and 12% converted, the mix adds 39 basis points to the blended monthly rate and $2,808 a year.",
      ],
    },
    {
      heading: "When the answer is act, and when it is do nothing",
      body: [
        "Do nothing if your foreign volume is under about 5% and you are on flat rate pricing. On the numbers above a 5% foreign mix with no conversion adds roughly 8 basis points to a blended rate. That is real money at scale and noise at $60,000 a month.",
        "Act on the conversion markup first, because it is the largest and the least visible. Work out your implied markup against the H.10 rate for the day of the payment. Under about 1.25% you are in published add-on territory and there is nothing to find. Between 1.5% and 2% you are paying something like a stated conversion fee. Around 3% to 4% you are in wallet spread territory, where PayPal's published figure sits, and on six figures of converted volume that is a five figure annual line that never appeared as a fee. Above about 3.5%, check whether the payment ran through dynamic currency conversion at the terminal, or whether the money was converted twice.",
        "Then act on structure rather than on rate. Real volume in one foreign currency argues for a settlement account in that currency, which removes the conversion instead of discounting it. A meaningful international mix on flat rate pricing argues for pricing interchange plus against it, because the assessment you would then see is 1.45% or 1.85% for everyone, so the only thing left to negotiate is the markup. Volume in one country argues for asking what local acquiring would do, since a domestically acquired sale is not cross border at all. What none of this argues for is selling less internationally: a 5.57% all-in rate on a $180 order is a poor rate and an excellent order, and the number that decides it is your gross margin.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Published US cross border and currency conversion charges, sourced from each processor's own page and from a US bank's pass-through fee schedule, not computed by this page. The network rows are what the card networks charge a US acquirer; the processor rows are what the processor charges you.",
    columns: ["International card add-on", "Currency conversion markup", "Checked"],
    rows: [
      {
        label: "Visa network assessment",
        note: "International Service Fee 1.00% base or 1.40% off USD, plus International Acquirer Fee 0.45%. Plus about 2 cents per item.",
        values: ["1.45% settled in USD, 1.85% otherwise", "Not a network charge", "1 July 2026 schedule"],
      },
      {
        label: "Mastercard network assessment",
        note: "US Cross Border 0.60% or 1.00%, plus Global Acquirer Fee 0.85%. Plus about 2 cents across authorization and settlement.",
        values: ["1.45% settled in USD, 1.85% otherwise", "Not a network charge", "1 July 2026 schedule"],
      },
      {
        label: "Discover network assessment",
        note: "International Service Fee. Discover states one rate rather than splitting on settlement currency.",
        values: ["0.80%", "Not a network charge", "1 July 2026 schedule"],
      },
      {
        label: "Stripe",
        note: "Flat rate. The add-on is charged instead of the assessment, and the two add-ons stack on a converted foreign card.",
        values: ["+1.5%", "+1%", "1 September 2026"],
      },
      {
        label: "PayPal",
        note: "The 1.50% is a stated fee. The conversion charge is a spread inside the exchange rate. Advanced card payments priced as interchange plus plus carry no international percentage.",
        values: ["+1.50%", "3.00%, or 4.00% on listed types", "15 July 2026 schedule"],
      },
      {
        label: "Square",
        note: "Identical on Free, Plus and Premium. A US Square account settles in dollars, so conversion is usually the cardholder's bank's charge rather than yours.",
        values: ["+1.5%", "None published", "12 August 2026"],
      },
      {
        label: "Shopify Payments",
        note: "The only row here whose documentation states the underlying conversion rate carries no markup. 2% outside the United States.",
        values: ["+1%", "1.5% for US stores", "5 September 2026"],
      },
      {
        label: "Braintree",
        note: "Two separate 1% add-ons, one for the geography test and one for the currency test. They stack only when both apply.",
        values: ["+1%", "+1% on non-USD presentment", "7 May 2026 schedule"],
      },
      {
        label: "Helcim",
        note: "Interchange plus, so the network assessment passes through instead of an add-on. American Express +1.00% and Discover +1.30%.",
        values: ["Visa +1.45% + 3.6 cents, Mastercard +1.45%", "None charged to the merchant", "5 September 2026"],
      },
      {
        label: "Adyen",
        note: "Interchange++, so the assessment appears on the invoice at cost. Its documentation states the Adyen exchange rate includes a 3% markup charge in its balance conversion products.",
        values: ["Not published, passed through", "Contractual", "5 September 2026"],
      },
    ],
  },
  assumptions: [
    "Network assessments are read from the Wells Fargo Merchant Services Payment Network Pass-Through Fee Schedule effective 1 July 2026, document code WFMS-204 06/26, checked 5 September 2026. Visa, Mastercard and Discover do not publish acquirer facing schedules to the open web, so a US bank's own merchant disclosure is the most primary source available. Your acquirer may pass these through at a different figure, and the networks reprice twice a year.",
    "Processor rates are each processor's own published US figures, dated per row in the table above. Stripe and PayPal geo-redirect this machine away from US pricing, so both were read off Wayback captures of the US pages and the capture date is recorded as the checked date rather than today.",
    "Reference exchange rates are the Federal Reserve H.10 release, Foreign Exchange Rates, weekly release dated 31 August 2026 covering the week to 28 August 2026. They are a weekly published figure and not a live market tick, so a fraction of a percent of any derived markup is timing rather than markup. A markup worth arguing about is a point or more.",
    "The calculator treats the geography test and the currency test as independent, because they are. A card issued abroad and charged in dollars is cross border without converting; a US card charged in euros converts without being cross border. Ticking one box does not tick the other.",
    "On flat rate pricing the processor international add-on is charged INSTEAD of the network assessment, not on top of it, so the calculator never applies both. Tick the interchange plus box only if your statement itemizes network fees, or the answer will be roughly 145 basis points too high.",
    "Markup is reported two ways because both are used in public: against the mid market value of the sale, and against the rate you were given. They differ by about 3% of themselves, which is exactly the size of the disagreement a merchant ends up having with a support agent.",
    "Dynamic currency conversion markup rates are not published by anyone. Adyen's documentation confirms the revenue share exists and that the rate is agreed in a contract addendum; it does not state a percentage, and no percentage is asserted here. Enter the rate your own provider quoted you.",
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "What is a cross border fee?",
      answer:
        "A card network assessment charged because the acquiring bank and the issuing bank are in different countries. On a US merchant taking a foreign card it runs 1.45% when the sale still settles in dollars and 1.85% when it does not, on both Visa and Mastercard, plus about two cents per item. Discover charges 0.80%. It is a geography charge, so it applies even when no currency is converted.",
    },
    {
      question: "How much is the international transaction fee for merchants?",
      answer:
        "On flat rate pricing you pay your processor's add-on rather than the network assessment: Stripe, Square and PayPal charge 1.5% or 1.50%, Shopify Payments and Braintree charge 1%. On interchange plus you pay the assessment itself, which Helcim publishes as Visa plus 1.45% and 3.6 cents, Mastercard plus 1.45%. Add a conversion markup on top if the money also had to be converted.",
    },
    {
      question: "What is a currency conversion fee and where does it show up?",
      answer:
        "It is a spread added to the exchange rate rather than a deduction, which is why it never appears as a line item. Published US figures range from 1% at Stripe and Braintree, to 1.5% at Shopify Payments, to 3.00% or 4.00% at PayPal. To find yours, multiply the foreign amount by a mid market rate, subtract what actually landed, and divide by the mid market value.",
    },
    {
      question: "How do I calculate the FX markup my processor charged me?",
      answer:
        "Take the mid market rate for the day of the payment from the Federal Reserve H.10 release, multiply by the amount in the foreign currency, and compare against the dollars you received. Worked through: 1,000 euros at 1.1598 is worth $1,159.80. If $1,125.00 arrived, the spread took $34.80, which is 3.00% of the mid market value or 3.09% measured against the rate you were given.",
    },
    {
      question: "Is dynamic currency conversion good for merchants?",
      answer:
        "Sometimes, and rarely by much. The markup is charged to the cardholder and shared out, and Adyen's documentation confirms the revenue can be split between the platform, the merchant and Adyen under a negotiated addendum. Network rules require the cardholder to choose, forbid offering it by default, and require any markup over the wholesale rate to be disclosed. It suits hotels and airport retail, not an ordinary US storefront.",
    },
    {
      question: "How do I avoid cross border and currency conversion fees?",
      answer:
        "You cannot avoid the network assessment on a foreign card, only see it honestly, which is an argument for interchange plus. You can eliminate the conversion markup by settling in the currency you sell in, since a euro balance paid to a euro account is never converted. Local acquiring removes the cross border assessment entirely, because a domestically acquired sale is not cross border.",
    },
  ],
  related: [
    "stripe-fee-calculator",
    "adyen-fee-calculator",
    "paypal-fee-calculator",
    "effective-rate-calculator",
    "break-even-and-margin-calculator",
  ],
  links: [
    { label: "Multi-currency payment processors", href: "/payment-processors/multi-currency" },
    { label: "Processors for international selling", href: "/category/international" },
    { label: "Multi-currency, explained", href: "/glossary/multi-currency" },
    { label: "Assessment fees, explained", href: "/glossary/assessment-fee" },
    { label: "Adyen review and pricing", href: "/processor/adyen" },
  ],
  cta: {
    heading: "Paying three charges where one was quoted?",
    body: "Tell us your volume and where your customers are, and we will shortlist processors that settle in your selling currency and itemize the network fee instead of burying it.",
    label: "Get matched",
  },
};
