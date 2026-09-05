import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/clover-fee-calculator`.
 *
 * SEARCH INTENT THIS PAGE OWNS. "clover fee calculator" and "clover processing
 * fees": a merchant who already has, or is being sold, a Clover system and wants
 * to know what a sale costs and whether the monthly software plan is worth
 * paying for. Brand pricing prose belongs to `/processor/clover`, "best retail
 * POS" belongs to `/category/retail-pos`, and definitions belong to the
 * glossary. This page owns the arithmetic and ends by linking into all three.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG, and it is the same mistake on every
 * page sampled. They price Clover as if it were Square: one rate for the brand,
 * usually a single card present percentage lifted from one vertical page, with
 * the monthly software fee either omitted or mentioned once and never modelled.
 * Two things follow from that. First, the plan question, which is the only
 * question a Clover merchant can actually act on, never gets answered: the card
 * present rate is 2.6%, 2.5% or 2.3% depending purely on which software plan you
 * are on, so "what does Clover charge" has three published answers and the one
 * that applies to you is a purchasing decision, not a fact about Clover. Second,
 * and worse, none of them say that Clover is a Fiserv brand sold through
 * thousands of resellers, so the schedule on clover.com is Clover Direct's price
 * and not necessarily yours. A calculator that quietly implies otherwise sends a
 * merchant to argue with their bank using the wrong number.
 *
 * WHERE THE NUMBERS CAME FROM. Every rate, plan fee and hardware price is read
 * off Clover's own US pricing pages on 5 September 2026 and recorded in
 * `lib/rate-cards/clover.ts` with its sources. The crossover volumes, the
 * hardware subscription totals and the per additional device fee are arithmetic
 * this page performs on those published figures, and the rate table caption says
 * which column is which. Every dollar figure in `workedExample` is reproducible
 * in the widget on this page and is asserted in
 * `tests/tools/batch-four/clover-fee-calculator.test.ts`, because a hand written
 * number that disagrees with the widget beside it has shipped here before.
 */
export const CLOVER_FEE_TOOL: ToolDef = {
  slug: "clover-fee-calculator",
  name: "Clover Fee Calculator",
  h1: "Clover fee calculator",
  title: "Clover fee calculator: Clover processing fees by plan",
  description:
    "Work out Clover processing fees on every published US plan, from the free Starter plan at 2.6 percent plus 10 cents to the Growth plans at 2.3 percent.",
  intro:
    "Clover processing fees are set by your software plan, not by the device on your counter. Card present is 2.6% plus 10 cents on the free Starter plan, 2.5% plus 10 cents on Essentials at $29.95 a month, and 2.3% plus 10 cents on the Growth plans at $84.95 or $89.95. Typed in, online and phone payments are 3.5% plus 10 cents on every plan. This Clover Fee Calculator prices all five plans and shows the volume where a paid plan starts paying for itself, which on the $84.95 plans is $28,316.67 a month.",
  tier: 2,
  summary:
    "Clover processing fees across all five published US software plans, and the volume where a Growth plan pays for itself.",
  widget: "brand-fee",
  rateCard: "clover",
  workedExample: {
    scenario:
      "Bell Street Hardware is a single location retail store on a Clover Station Duo. It takes $30,000 a month in card payments across 600 card present sales, an average ticket of $50. The owner has been offered the Retail Growth plan at $84.95 a month and wants to know whether the lower rate covers the fee.",
    result:
      "On the free Starter plan the rate is 2.6% plus 10 cents. 2.6% of $30,000 is $780.00, the 10 cent per transaction fee across 600 sales is $60.00, and there is no software fee, so the month costs $840.00 and the effective rate is 2.80%. On Retail Growth the rate drops to 2.3% plus 10 cents: 2.3% of $30,000 is $690.00, the same $60.00 of per transaction fees, plus the $84.95 software fee, so the month costs $834.95 and the effective rate is 2.78%. The Growth plan saves $5.05 a month, $60.60 a year. It is the right answer by a margin so thin it is inside a bad week of sales, because $30,000 is barely past the crossover. The crossover itself is exact: the plans differ by 0.30 percentage points, so the $84.95 fee is covered at $84.95 divided by 0.003, which is $28,316.67 of monthly card volume. Below that, the free Starter plan is cheaper. Double the store to $60,000 a month across 1,200 sales and the picture changes completely: Starter costs $1,680.00 at 2.80% while Retail Growth costs $1,584.95 at 2.64%, a saving of $95.05 a month or $1,140.60 a year.",
  },
  sections: [
    {
      heading: "How the Clover Fee Calculator works out your Clover processing fees",
      body: [
        "The formula has three parts and Clover publishes all of them: a percentage of the sale, a flat 10 cents per transaction, and a monthly software fee that does not move with volume. Card present, the percentage is 2.6% on the Starter plan, 2.5% on Essentials and 2.3% on any of the three Growth plans. Typed in, online or over the phone it is 3.5% on all five, and the 10 cent per transaction fee is identical everywhere.",
        "That 10 cents is the smallest fixed fee among the mainstream US flat rate providers, and on small tickets the fixed fee is the whole story. On a $5 sale, 2.6% is 13 cents and the fixed fee is 10 cents, so the sale costs 23 cents, an effective rate of 4.6%. If your average ticket is under about $10, the gap between a 10 cent and a 30 cent fixed fee matters more than half a point of percentage, and negotiating the rate will not touch it.",
        "The monthly software fee is the part every competing Clover calculator leaves out, and it is the part that decides the answer. A fixed monthly cost behaves like a fixed transaction fee scaled up: it dominates at low volume and disappears at high volume. On $10,000 a month the $84.95 Retail Growth fee is 0.85 percentage points of your effective rate by itself, more than the 0.30 points the plan saves on the percentage. On $200,000 a month it is 0.04 points and irrelevant. Switch the Clover Fee Calculator above to the monthly mode and the plan select re-prices the whole month rather than one sale.",
        "Don't run a single payment through the effective rate bands on this calculator. Those bands judge a blended monthly rate, and an ordinary Clover rate on a $6 coffee looks terrible against them for no reason other than the fixed fee. Switch to monthly mode first, then read the verdict.",
      ],
    },
    {
      heading: "Clover is sold through resellers, so the rate on clover.com may not be your rate",
      body: [
        "This is the single most useful thing a Clover merchant can learn and almost no calculator says it. Clover is a hardware and software brand, part of the Fiserv group of companies, and it is sold two ways: directly by Clover, and through banks, independent sales organizations and other resellers who sign the merchant, own the pricing and send the statement. Clover says so itself. Its pricing FAQ answers the question about termination fees by saying that contract terms and any termination fees \"can vary based on your service provider, whether Clover Direct or among our trusted partners including Citi, PNC and Wells Fargo, or from more than 3,000 other financial institution partners that also sell Clover solutions in the US.\"",
        "The consequence is concrete. Two businesses can run identical Clover Stations, on the same software plan, taking the same cards, and pay materially different rates, because the rate was set by whoever signed them. A reseller is under no obligation to use Clover's published structure. Many quote tiered pricing, where sales are sorted into qualified, mid qualified and non qualified buckets after the fact and only the qualified rate appears in the pitch. Others quote interchange plus. The Clover brand tells you nothing about which one you are on.",
        "So use the rates in this Clover Fee Calculator the way an auditor would. They are Clover Direct's published online prices, read off clover.com on 5 September 2026. Take last month's statement, divide total fees by total card volume to get your real effective rate, and compare it with what this page computes for your volume and plan. If the statement is meaningfully worse and no line item explains the gap, the gap is your reseller's markup and it is negotiable. If it is better, there is nothing to do.",
        "The same caution applies to anything quoting one Clover rate as fact. A page saying Clover charges 2.6% plus 10 cents is quoting the Starter plan on clover.com's own storefront. That figure is real. It is just not universal.",
      ],
    },
    {
      heading: "The software plan sets the rate, and the crossover is about $28,000 a month",
      body: [
        "Read Clover's six vertical pricing pages together and one pattern falls out: the card present rate tracks the software plan and ignores the hardware. A Clover Go reader and a Station Duo both charge 2.6% plus 10 cents on Starter and both charge 2.3% plus 10 cents on a Growth plan. That makes the plan choice a simple piece of arithmetic, because the 10 cent per transaction fee is identical on every plan and cancels out.",
        "Starter and the Growth plans differ by 0.30 percentage points. A Growth plan at $84.95 a month therefore pays for itself at $84.95 divided by 0.003, which is $28,316.67 of monthly card present volume. Restaurant Growth costs $89.95, so its crossover is $29,983.33 a month. Below those figures the free Starter plan is cheaper on card fees, and the paid plan has to justify itself on features instead.",
        "The Essentials plan at $29.95 is the interesting case, and the arithmetic says something unflattering. Essentials saves 0.10 points against Starter, so it needs $29.95 divided by 0.001, which is $29,950 a month, to break even. But a $84.95 Growth plan saves 0.20 points against Essentials for $55.00 more, so it overtakes Essentials at $27,500 a month. Those thresholds are the wrong way round: by the time Essentials beats the free plan at $29,950, Growth has already beaten Essentials. On the $84.95 plan families, Essentials is never the cheapest of the three at any volume. On the restaurant family, where Growth costs $89.95, it is cheapest only in a window fifty dollars wide, between $29,950 and $30,000 a month. Buy Essentials for what it does, not for what it saves.",
        "One more figure before a sales call. Clover prices extra devices as an increment on the software fee: the retail Advanced bundle publishes $104.90 against $84.95 for the single device bundle, and the dining bundles publish $109.90 and $129.85 against $89.95. Each step is $19.95, so a second Clover device adds $19.95 a month. That is subtraction on Clover's published prices rather than a figure Clover states, so confirm it on your quote.",
      ],
    },
    {
      heading: "What Clover charges for keyed, online and phone payments",
      body: [
        "Clover charges 3.5% plus 10 cents for a card that is not physically present, and that rate is the same on all five plans. Clover's own pricing FAQ is explicit about what counts: it describes a \"typed-in\" fee for transactions \"where the card is not present, like an online sale or phone order.\" So an ecommerce order, an invoice paid by card, a virtual terminal payment and a phone order all land on the same 3.5% line.",
        "A plan upgrade does nothing for card not present volume, and that is where this gets expensive for a mixed-channel business. Take the same $30,000 a month across 600 transactions from the worked example, but assume every sale is keyed or online rather than tapped. On Retail Growth that is 3.5% of $30,000, which is $1,050.00, plus $60.00 of per transaction fees, plus the $84.95 plan fee: $1,194.95 a month at an effective rate of 3.98%. The identical volume taken card present on the same plan costs $834.95 at 2.78%. The gap is $360.00 a month, and no plan on Clover's published schedule closes it.",
        "That reframes the question for anyone selling both ways. If a meaningful share of your volume is phone orders or online sales, the thing to price is not which Clover plan you are on but whether Clover should carry that channel at all. A Clover merchant is free to run ecommerce elsewhere while keeping Clover on the counter. It also makes the mechanical fix worth real money: getting a card dipped instead of read out over the phone is worth 1.2 percentage points, which on a $75 ticket is 90 cents.",
        "Two smaller line items belong in the same column, because they are percentages of your money. Rapid Deposit, Clover's instant funding option, costs 1.75% of the amount moved, so habitual use on a $30,000 month costs $525 on top of everything above. Clover Capital is repaid out of card sales and priced with a factor rate rather than an interest rate, which is a different kind of arithmetic entirely.",
      ],
    },
    {
      heading: "Clover hardware: buy it, subscribe to it, or get talked into leasing it",
      body: [
        "Clover publishes both a purchase price and a 36 month subscription price for the same devices, and comparing them is the clearest arithmetic on the whole pricing page. The Compact terminal is $349 outright or $16 a month for 36 months. Sixteen dollars times thirty six is $576, so the subscription costs $227 more than buying, a 65% premium, for the same box. The retail Station Duo bundle is $180 a month for 36 months against $1,899 plus $84.95 a month to buy, so once you subtract the software fee both routes pay, the hardware share of the subscription is $3,421.80 over the term against $1,899 to own it.",
        "That premium is not automatically a bad deal. A subscription is no money down and includes a warranty and an equipment protection program, so paying $227 to avoid a $349 outlay can be rational. The premium should be a decision rather than a surprise, and very few Clover merchants are shown it in dollars.",
        "The terms are where it gets sharp, and Clover states them plainly. Its FAQ says subscriptions \"are non-cancelable and ineligible for refunds.\" At the end of the term you choose to purchase or return the equipment, and if you do nothing, \"your subscription term will be extended at the same monthly charge.\" To stop that you have to tell Clover at least 30 days before the term ends. An auto extending agreement that keeps billing after the hardware is paid for several times over is the most common complaint in this category.",
        "The genuinely bad version is a third party lease. Clover devices bought or leased from other entities \"cannot be used with other payment processors,\" so a leased Clover is not a device you can take elsewhere if the rate turns out to be poor. Non cancelable four year terminal leases at forty or eighty dollars a month, on hardware worth a few hundred, are a fixture of this industry. Before signing anything with a monthly figure and a term on it, run it through the terminal lease versus buy calculator on this site, which turns the payment into an implied interest rate.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Clover's published US software plans. The monthly fee and the two rates are read off clover.com on 5 September 2026. The last column is computed by this page, not published by Clover: it is the monthly card present volume at which the plan's lower percentage covers its monthly fee compared with the free Starter plan, and the 10 cent per transaction fee cancels out because it is identical on every plan.",
    columns: [
      "Monthly software fee",
      "Card tapped, swiped or inserted",
      "Typed in, online or phone",
      "Beats Starter above",
    ],
    rows: [
      {
        label: "Starter",
        note: "The default plan, and the one clover.com quotes on its cheapest bundles",
        values: ["$0", "2.6% + $0.10", "3.5% + $0.10", "Baseline"],
      },
      {
        label: "Essentials",
        note: "Never the cheapest of the three on the $84.95 plan families, at any volume",
        values: ["$29.95", "2.5% + $0.10", "3.5% + $0.10", "$29,950.00 a month"],
      },
      {
        label: "Retail Growth",
        note: "Sold on the retail systems pricing page",
        values: ["$84.95", "2.3% + $0.10", "3.5% + $0.10", "$28,316.67 a month"],
      },
      {
        label: "Restaurant Growth",
        note: "Sold on both the full service dining and quick service restaurant pages",
        values: ["$89.95", "2.3% + $0.10", "3.5% + $0.10", "$29,983.33 a month"],
      },
      {
        label: "Services Growth",
        note: "Sold on the professional, personal, and home and field services pages",
        values: ["$84.95", "2.3% + $0.10", "3.5% + $0.10", "$28,316.67 a month"],
      },
    ],
  },
  assumptions: [
    "Every rate, plan fee and hardware price here is Clover Direct's published US online pricing, read from clover.com/pricing and its six vertical pricing pages on 5 September 2026. Clover states on those pages that the prices shown are only available on Clover.com.",
    "Clover is a Fiserv brand sold through resellers, and Clover's own pricing FAQ says terms vary by service provider across Clover Direct, Citi, PNC, Wells Fargo and more than 3,000 other financial institution partners in the US. If a bank or an ISO signed you, your agreement is the authority and these figures are a benchmark to audit it against, not a description of your account.",
    "The crossover volumes, the hardware subscription totals and the $19.95 per additional device figure are computed by this page from Clover's published numbers rather than published by Clover, and the rate table caption says which column is which.",
    "The model prices card volume only. It does not include Rapid Deposit at 1.75% of the amount moved, Clover Capital, third party app subscriptions from the Clover App Market, PCI fees, or anything a reseller adds on its own statement.",
    "Clover does not publish a stacking international or currency conversion surcharge on its US pricing pages the way Stripe and PayPal do, so this calculator models none. That is an absence of published data, not a claim that cross border cards cost the same.",
    "Hardware prices are the online purchase prices for new equipment and exclude tax, shipping, accessories and the promotional statement credit Clover was running when these were read.",
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "How much does Clover charge per transaction?",
      answer:
        "Card present, 2.6% plus 10 cents on the free Starter plan, 2.5% plus 10 cents on Essentials at $29.95 a month, and 2.3% plus 10 cents on the Growth plans at $84.95 or $89.95 a month. Typed in, online and phone payments are 3.5% plus 10 cents on every plan. A $50 card present sale costs $1.40 on Starter and $1.25 on a Growth plan.",
    },
    {
      question: "What is Clover's monthly fee?",
      answer:
        "It depends on the software plan, not the hardware. Clover publishes $0 for Starter, $29.95 for Essentials, $84.95 for Retail Growth and Services Growth, and $89.95 for Restaurant Growth, all read from clover.com on 5 September 2026. Each additional Clover device on the same plan adds about $19.95 a month. Hardware is billed separately, either bought outright or on a 36 month subscription.",
    },
    {
      question: "Why is my Clover rate higher than the rate on clover.com?",
      answer:
        "Because Clover is a Fiserv brand sold through resellers, and the reseller sets your price. Clover's own FAQ says contract terms vary by service provider across Clover Direct, Citi, PNC, Wells Fargo and more than 3,000 other financial institution partners. The clover.com schedule is Clover Direct's online price. If a bank or an ISO signed you, they may have quoted tiered pricing instead, and the gap between your statement and this page is their markup.",
    },
    {
      question: "Is Clover cheaper than Square?",
      answer:
        "On a card present sale the headline percentages match at the entry level, 2.6% on both, but Clover's fixed fee is 10 cents against Square's 15 cents, so a $50 sale is $1.40 on Clover Starter and $1.45 on Square Free. Clover can go lower, to 2.3% plus 10 cents, but only by paying $84.95 or $89.95 a month, which needs roughly $28,000 to $30,000 of monthly volume to earn back. Square's paid plans work the same way.",
    },
    {
      question: "Can I use Clover hardware with a different payment processor?",
      answer:
        "No. Clover states that its devices may be purchased or leased from other entities but \"cannot be used with other payment processors.\" That is what makes a third party Clover lease risky: if the processing rate attached to it turns out to be poor, the hardware is not portable, and the lease usually is not cancelable either. Buying the device outright, at $349 for a Compact up to $4,447 for the largest dining bundle, keeps the decisions separate.",
    },
    {
      question: "How much does Clover charge for online and keyed-in payments?",
      answer:
        "3.5% plus 10 cents, on every plan. Clover's FAQ groups online sales and phone orders with typed in payments, so ecommerce, invoices paid by card and virtual terminal transactions all price the same. On $30,000 a month across 600 sales that is $1,194.95 including the $84.95 Growth plan fee, an effective rate of 3.98%, against $834.95 and 2.78% if the same volume were tapped at the counter.",
    },
  ],
  related: [
    "toast-fee-calculator",
    "square-fee-calculator",
    "pos-terminal-lease-vs-buy-calculator",
    "restaurant-credit-card-fee-calculator",
    "effective-rate-calculator",
  ],
  links: [
    { label: "Clover review and full pricing breakdown", href: "/processor/clover" },
    { label: "Payment processors for retail and POS", href: "/category/retail-pos" },
    { label: "Processors with tap to pay", href: "/payment-processors/tap-to-pay" },
    { label: "Card present, explained", href: "/glossary/card-present" },
    { label: "Merchant account, explained", href: "/glossary/merchant-account" },
    { label: "Effective rate, explained", href: "/glossary/effective-rate" },
  ],
  cta: {
    heading: "Check your Clover statement against the published rate",
    body: "Clover is sold by thousands of resellers, so the only way to know whether your rate is competitive is to compute your real effective rate and compare it. Tell us your volume and card present versus keyed split, and we will point you to processors that would charge less for the same mix.",
    label: "Get matched",
  },
};
