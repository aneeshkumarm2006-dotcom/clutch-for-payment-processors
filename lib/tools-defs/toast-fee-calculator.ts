import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/toast-fee-calculator`.
 *
 * SEARCH INTENT THIS PAGE OWNS. "toast fee calculator", "toast pos fees",
 * "toast processing fees", "how much does toast charge per transaction". A
 * calculation modifier and nothing else: Toast brand pricing belongs to
 * `/processor/toast`, "best restaurant processors" to `/category/restaurants`,
 * and the tip and interchange mechanics of restaurant acceptance in general to
 * `/tools/restaurant-credit-card-fee-calculator`. This page links into all
 * three rather than trying to replace them.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Two things, both checkable.
 *
 * First, almost every page ranking for these terms prints a Toast rate with a
 * per transaction fee attached, usually "2.49% + $0.15" or "3.09% + $0.15". No
 * Toast page carries that fixed component. Toast's own Starter Kit shop page
 * states two bare percentages, and its payments page says the rate on every
 * other plan is built to quote. A page that invents a per item fee is inventing
 * about $250 a month of cost on a 1,650 check restaurant.
 *
 * Second, none of them models tips. A restaurant does not pay a card fee on its
 * food and drink sales, it pays one on the gross settled amount, which is the
 * check plus tax plus the tip the guest wrote on it. Toast says so itself in the
 * surcharging FAQ: "You remain responsible for paying your full contractual
 * processing rate on the gross amount of all card transactions". At Toast's own
 * published 19.3 percent full service tip average, 16.2 percent of what a
 * restaurant processes is tip money that never lands in revenue and still
 * attracts a card fee.
 *
 * WHERE THE NUMBERS CAME FROM. All Toast pages read live on 5 September 2026:
 *
 *   pos.toasttab.com/shop/starter-kits          3.09% Pay-as-you-Go, 2.49%
 *                                               Traditional. The only two card
 *                                               rates Toast publishes.
 *   pos.toasttab.com/pricing                    Starter Kit $0, Point of Sale
 *                                               from $69 a month, Build Your Own
 *                                               custom, payroll bundle $69 plus
 *                                               $9 per employee. Page states it
 *                                               was last updated 20 August 2026.
 *   pos.toasttab.com/payments/payment-processing-fees
 *                                               "custom rate", and the card
 *                                               present versus card not present
 *                                               split. Last updated 16 July 2026.
 *   pos.toasttab.com/hardware                   "Starting at $0", first device
 *                                               only. Last updated 16 July 2026.
 *   support.toasttab.com Toast Delivery Services
 *                                               Uber Direct and DoorDash Drive
 *                                               flat fees and the CA, NYC and
 *                                               Seattle regulatory fees. Last
 *                                               updated 31 August 2026.
 *   support.toasttab.com Credit Card Surcharging FAQ
 *                                               the gross amount quote, and
 *                                               "Tips and taxes are not
 *                                               surcharged." Last updated
 *                                               17 August 2026.
 *   support.toasttab.com Optimize Tip Withholding
 *                                               Toast's own feature for
 *                                               reclaiming the card fee on tips.
 *                                               Last updated 23 June 2026.
 *   pos.toasttab.com/blog/data/restaurant-tipping-trends
 *                                               19.3% full service, 15.8% quick
 *                                               service, 13.7% takeout, 18.8%
 *                                               overall, Q1 2026, card and
 *                                               digital tips only, roughly
 *                                               171,000 locations.
 *
 * One non-Toast figure: the National Restaurant Association's analysis published
 * 16 October 2025 reports median income before taxes of 4.3 percent of sales in
 * 2024 among fullservice operators with $2 million or more of annual sales. It
 * is used once, for scale, and the sales band is stated with it.
 *
 * Every dollar figure in the worked example and the rate table is arithmetic
 * this page performs on those published rates, and every one of them is
 * reproducible in the widget above by entering the same volume and plan. They
 * are asserted against independently hand computed values in
 * `tests/tools/batch-four/toast-fee-calculator.test.ts`.
 */
export const TOAST_FEE_TOOL: ToolDef = {
  slug: "toast-fee-calculator",
  name: "Toast Fee Calculator",
  h1: "Toast fee calculator for US restaurants",
  title: "Toast Fee Calculator | Calculate Toast Processing Fees",
  description:
    "Use our Toast fee calculator to estimate processing fees, transaction costs, tips, and monthly Toast plan costs for your restaurant.",
  intro:
    "The Toast Fee Calculator prices Toast's two published US card rates, 3.09 percent on the Pay-as-you-Go Starter Kit and 2.49 percent on the Traditional Starter Kit, against the number that actually reaches your statement: gross card volume with the tips inside it. Every other Toast plan carries a quoted rate, and Toast's own fees page says so. At Toast's published 19.3 percent full service tip average, 16.2 percent of everything you process is money handed straight to staff that still attracts a card fee. On $70,400 of card food and drink sales that is $419.84 a month.",
  tier: 2,
  summary:
    "Toast's two published card rates, priced on gross card volume with the tips included.",
  widget: "brand-fee",
  rateCard: "toast",
  workedExample: {
    scenario:
      "A 55 seat full service restaurant on Toast's Pay-as-you-Go Starter Kit. $80,000 a month in food and drink sales, 88 percent of it settled on cards, tips running at Toast's published Q1 2026 full service average of 19.3 percent, and about 1,650 card checks a month. No third party marketplace delivery volume is included, because on a DoorDash or Uber Eats marketplace order the platform runs the card and you never paid Toast a processing fee on it.",
    result:
      "Card food and drink sales are $80,000 times 0.88, or $70,400. Tips at 19.3 percent add $13,587.20, so the terminal settles $83,987.20, not $70,400. At Toast's published Pay-as-you-Go rate of 3.09 percent, with no per transaction fee to add, the card bill is $2,595.20 a month and $31,142.45 a year. The tip line by itself is $13,587.20 times 3.09 percent, or $419.84 a month and $5,038.13 a year, which is 16.2 percent of the entire card bill and is paid on money that never appears as restaurant revenue. Measured against card volume the effective rate is exactly 3.09 percent, because there is no fixed fee to inflate it on a small check. Measured against all $80,000 of food and drink sales, cash included, it is 3.24 percent, and that second number is the one an operator quotes at a sales rep. Now switch the plan and change nothing else. The Traditional Starter Kit at 2.49 percent costs $2,091.28 in card fees plus $69 of software, so $2,160.28 a month and $25,923.38 a year. The zero dollar plan is $434.92 a month and $5,219.08 a year more expensive at this volume. The two plans cross at $11,500 of monthly card volume, which is $69 divided by the 0.60 percentage point gap between the rates. Below that line the free plan wins. Above it the paid one does, and this restaurant is more than seven times past the line.",
  },
  sections: [
    {
      heading: "What the Toast fee calculator prices, and what Toast actually publishes",
      body: [
        "Toast publishes exactly two card rates, and both live on the Starter Kit shop page rather than the pricing page. Pay-as-you-Go is described there as a 3.09 percent card processing fee that covers all costs except shipping and taxes, with no upfront hardware cost and no monthly software subscription. Traditional pricing is a 2.49 percent card processing fee, with the hardware bought outright and software billed monthly. That is the whole published schedule for a US restaurant.",
        "Everything else is quoted. Toast's payment processing fees page says its team will build a custom rate specific to the characteristics of your restaurant, and the pricing page lists Point of Sale from $69 a month and Build Your Own as custom, with no card rate beside either. A calculator cannot compute what a sales rep has not told you yet, so the Toast Fee Calculator prices the two published rates and asks you to put your quoted rate against the same volume once you have one.",
        "That leaves two disagreements with the pages currently ranking for these terms. The first is the per transaction fee. Most of them print Toast at 2.49 percent plus 15 cents or 3.09 percent plus 15 cents. No Toast page states a per item component, so the calculator applies none. On 1,650 checks a month, an imaginary 15 cent fee invents $247.50 of monthly cost. That is a 10 percent error on a $2,595 bill.",
        "The second is the online rate. Toast's fees page draws the card present and card not present distinction explicitly and says card not present costs more, but it publishes no card not present number. So the online, phone and keyed channel here repeats the published card present rate. The figure that returns is a floor, not an estimate. Your quoted online rate will sit above it, never below.",
      ],
    },
    {
      heading: "Tips are card volume, and Toast bills you on the gross amount",
      body: [
        "Your Toast sales report shows food and drink sales. Your processing statement is built on something larger: the gross settled amount of every card transaction, which is the check plus tax plus whatever the guest wrote on the tip line. Toast states this plainly in its own credit card surcharging FAQ, which says you remain responsible for paying your full contractual processing rate on the gross amount of all card transactions, including both credit and debit cards.",
        "The size of the gap is set by your tip rate, not your rate card. Toast's platform data, drawn from card and digital tips across roughly 171,000 locations, puts the average full service tip at 19.3 percent in the first quarter of 2026, quick service at 15.8 percent, takeout at 13.7 percent and the all restaurant average at 18.8 percent. Cash tips are excluded, correctly, because a cash tip never touches the card rail. At 19.3 percent the tips are 16.2 percent of everything you process: on $70,400 of card food and drink sales, $13,587.20 of tips and $419.84 a month of fees on money you are holding for somebody else.",
        "Toast builds a feature for exactly this, which tells you how common the complaint is. Tip Withholding, under Employees and Payroll management in Toast Web, lets a manager reclaim a percentage of employee card tips to cover card processing fees, and Toast notes it applies to debit as well as credit because both carry fees. Whether you may use it is a wage and hour question that turns on your state, and several states including California prohibit any deduction from a card tip.",
        "Surcharging does not solve it either. Toast's surcharging FAQ is explicit that tips and taxes are not surcharged, and that surcharging debit and prepaid cards is prohibited for all US merchants. The purest pass through line in your volume, the tip, is the one a surcharge program can never recover. If a rep pitches surcharging as the fix, work out what share of your volume is tips and debit, then take that share off whatever recovery was promised.",
      ],
    },
    {
      heading: "The zero dollar Starter Kit is a financing decision, not a discount",
      body: [
        "The two Starter Kit plans are the same product bought two ways. Pay-as-you-Go hands you the hardware with nothing down and no monthly software fee, and Toast is clear this is not a lease: you own the hardware from day one. Traditional pricing has you buy the hardware up front and pay a monthly software subscription, in exchange for a card rate 0.60 percentage points lower. The terminals, the software and the support do not change. Only who carries the cost.",
        "That makes it a break even, and the break even is one division. The 0.60 point gap has to cover $69 of monthly software, so it flips at $69 divided by 0.006, which is $11,500 of monthly card volume. A food truck running $8,000 a month is better off on the free plan, full stop. The full service room in the worked example, at $83,987 a month, is more than seven times past the line and paying $5,219.08 a year for the privilege of not writing a hardware check.",
        "Two cautions on that figure. The $69 in it is Toast's published Point of Sale starting price, not a quoted Starter Kit software fee, because Toast does not publish what Traditional Starter Kit software costs. Treat $11,500 as a floor on the crossover: a higher real software fee pushes it up, a negotiated rate below 2.49 percent pulls it down. And the Traditional plan wants hardware money up front, so this is a running cost comparison rather than a total cost of ownership one.",
        "The wider point is that a percentage rate is a tax on volume and a monthly fee is not. A rate that looks generous when you open is the same rate when you are three times the size, and it collects three times as much. That is why the cheap door has the expensive rate behind it. Review the plan when your volume steps up, not when your contract renews.",
      ],
    },
    {
      heading: "Online ordering, delivery and the costs that are not card processing",
      body: [
        "Toast markets its own online ordering as commission free, and on its first party channels that is what it is: no percentage of the order goes to Toast beyond the card rate. The subscription is not free. Online ordering sits inside the Digital Storefront Suite, and Toast publishes no price for it: its own support article on subscribing points at a sales form rather than a number. A Toast digital sales line therefore carries a subscription you have to ask for and a card not present rate you also have to ask for.",
        "Delivery is the part Toast does publish, in the support documentation rather than on any marketing page. Toast Delivery Services charges a flat fee per delivery instead of a commission. Through Uber Direct that is $6.99 under 6 miles, $8.74 for 6 to 8 miles, $9.49 for 8 to 9 and $9.99 for 9 to 10. Through DoorDash Drive it is $7.49 within 5 miles plus 50 cents for each additional mile up to 10. On top of those, California adds $2.00, New York City adds $3.00 on Uber Direct or $2.99 on DoorDash Drive, and Seattle adds $5.00 or $4.99.",
        "Those fees do not arrive as an invoice. Toast withholds the flat delivery fee, the driver tip and a Toast service fee from your card payouts on each order, then emails a monthly billing summary. That matters for reconciliation more than for cost: deposits arrive already net of them, so an operator watching the bank balance reads delivery cost as a smaller card payout and blames the processing rate. The driver tip is tracked against a TDS Driver employee and comes out before you pay your own staff.",
        "Marketplace delivery is a different animal and does not belong in this calculator. When an order arrives through the DoorDash or Uber Eats app, the platform takes the card. You receive a payout net of commission and paid Toast no processing fee, so feeding marketplace sales into any card fee calculator invents a cost you never incurred on top of the commission you did. Enter only what settled through your own Toast terminals and your own Toast online ordering.",
      ],
    },
    {
      heading: "Reading a Toast quote, and when the answer is to do nothing",
      body: [
        "Because Toast quotes rather than publishes, the negotiation comes down to a few specific lines. Ask for the card present and card not present rates separately, because Toast's own fees page confirms the two are priced differently and a blended quote hides what your online channel pays. Ask whether there is a per transaction amount at all, since the published rates have none and a quoted one may. Ask what the monthly software subscription is on the plan being sold, because $69 is a starting price and Build Your Own has no published price at all.",
        "Then size the answer against the business rather than the rate. In the worked example the card bill is $31,142.45 a year against $960,000 of annual food and drink sales, or 3.24 percent. The National Restaurant Association's analysis published on 16 October 2025 reports median income before taxes of 4.3 percent of sales in 2024 among fullservice operators with $2 million or more of annual sales, a band this restaurant sits below. Card acceptance is consuming roughly three quarters of what a larger, better placed peer keeps before tax, and the tip line alone, at $5,038.13 a year, is about 12 percent of that margin.",
        "That framing also stops the number becoming a panic. A 3.09 percent effective rate on card present restaurant volume is high, and the calculator's verdict band says so, but the fix is a plan change and a quote rather than a platform migration. Moving the same restaurant to the Traditional plan removes $5,219.08 a year without touching a terminal. A quoted card present rate a quarter of a point below 2.49 percent on $83,987 of monthly volume is worth another $2,519.62 a year. Both are conversations, not projects.",
        "The case for doing nothing is real too. Under $11,500 of monthly card volume, Pay-as-you-Go is already the right answer and a lower rate will not repay the software fee. If you run Toast mainly because the kitchen display, the handhelds and the payroll integration take labor cost out, a 40 basis point rate difference against a standalone processor is often smaller than the labor it puts back. Price the whole stack, not the rate line.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Toast plans and monthly fees are read off pos.toasttab.com on 5 September 2026; the 3.09 percent and 2.49 percent card rates are read off Toast's Starter Kit shop page on the same date. Every dollar figure is COMPUTED BY THIS PAGE, not published by Toast, on a restaurant with $70,400 of monthly card food and drink sales, and each row states the tip rate applied to it. Rows one and two use Toast's own published 19.3 percent full service tip average, which puts $83,987.20 through the terminal.",
    columns: [
      "Monthly software fee",
      "Card rate",
      "Monthly card cost",
      "Annual card cost",
    ],
    rows: [
      {
        label: "Starter Kit, Pay-as-you-Go",
        note: "Published. No monthly software fee and no upfront hardware cost. Tips at 19.3 percent.",
        values: ["$0", "3.09%", "$2,595.20", "$31,142.45"],
      },
      {
        label: "Starter Kit, Traditional",
        note: "Published rate. Hardware bought outright. The $69 is Toast's published Point of Sale starting price, not a quoted Starter Kit software fee, so read it as a floor. Tips at 19.3 percent.",
        values: ["$69", "2.49%", "$2,160.28", "$25,923.38"],
      },
      {
        label: "Point of Sale plan",
        note: "Toast publishes the software price and quotes the card rate.",
        values: ["From $69", "Quoted", "Not published", "Not published"],
      },
      {
        label: "Build Your Own plan",
        note: "Toast publishes neither the software price nor the card rate.",
        values: ["Custom", "Quoted", "Not published", "Not published"],
      },
      {
        label: "Same restaurant, no tips at all",
        note: "The counterfactual, not an option. Processed volume $70,400. This is what every calculator that stops at food and drink sales tells you.",
        values: ["$0", "3.09%", "$2,175.36", "$26,104.32"],
      },
      {
        label: "Same restaurant, tips at 15%",
        note: "Processed volume $80,960. The fee on the tip line alone is $326.30 a month and $3,915.65 a year.",
        values: ["$0", "3.09%", "$2,501.66", "$30,019.97"],
      },
      {
        label: "Same restaurant, tips at 18%",
        note: "Processed volume $83,072. The fee on the tip line alone is $391.56 a month and $4,698.78 a year.",
        values: ["$0", "3.09%", "$2,566.92", "$30,803.10"],
      },
      {
        label: "Same restaurant, tips at 20%",
        note: "Processed volume $84,480. The fee on the tip line alone is $435.07 a month and $5,220.86 a year.",
        values: ["$0", "3.09%", "$2,610.43", "$31,325.18"],
      },
    ],
  },
  assumptions: [
    "The two card rates are Toast's own published US figures, read off the Toast Starter Kit shop page on 5 September 2026: 3.09 percent on Pay-as-you-Go and 2.49 percent on Traditional pricing. Plan prices are from pos.toasttab.com/pricing, which states it was last updated on 20 August 2026.",
    "No per transaction fee is applied, because Toast publishes none. Both published rates are stated as bare percentages. If your Toast quote contains a per item amount, add it yourself: on 1,650 checks a month, 15 cents is $247.50.",
    "The online, phone and keyed channel repeats the published card present rate and is therefore a FLOOR rather than an estimate. Toast's payment processing fees page, last updated 16 July 2026, states that card not present costs more than card present but publishes no card not present rate. Your quoted online rate will be above the figure shown.",
    "The $69 attached to the Traditional plan is Toast's published Point of Sale starting price, not a quoted Starter Kit software fee, so the $11,500 plan crossover is a floor. Toast does not publish what Traditional Starter Kit software costs, and the Point of Sale and Build Your Own plans quote the card rate rather than publishing it.",
    "Card volume means gross settled volume, tips and tax included. Toast's credit card surcharging FAQ, last updated 17 August 2026, states that you remain responsible for paying your full contractual processing rate on the gross amount of all card transactions. Tip percentages quoted here are Toast's own platform data for the first quarter of 2026, card and digital tips only, cash tips excluded.",
    "Third party marketplace delivery volume is excluded. On a DoorDash or Uber Eats marketplace order the platform runs the card, so that volume is not your Toast processing cost. Toast Delivery Services fees, Digital Storefront subscriptions and hardware are separate lines and are shown as reference rather than modeled.",
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "How much does Toast charge per transaction?",
      answer:
        "Toast publishes two card rates and both are card present: 3.09 percent on the Pay-as-you-Go Starter Kit, which has no monthly software fee and no upfront hardware cost, and 2.49 percent on the Traditional Starter Kit, where you buy the hardware and pay for software monthly. Neither is published with a per transaction fee attached. Every other Toast plan is quoted, and Toast's own payments page says the rate is built to your restaurant.",
    },
    {
      question: "Does Toast charge a fee on tips?",
      answer:
        "Yes. The card fee is charged on the gross settled amount, which is the check plus tax plus the tip, and Toast's surcharging FAQ states that you remain responsible for your full contractual processing rate on the gross amount of all card transactions. At Toast's published 19.3 percent full service tip average, a restaurant with $70,400 of card food and drink sales processes $83,987.20 and pays $419.84 a month, or $5,038.13 a year, on the tip line alone at 3.09 percent.",
    },
    {
      question: "Is the $0 Toast Starter Kit really free?",
      answer:
        "The hardware and the software are genuinely free of upfront and monthly charges, and Toast confirms the hardware is yours to keep rather than leased. You pay for both in the rate: 3.09 percent instead of 2.49 percent, a gap of 0.60 percentage points. That gap covers $69 of monthly software at $11,500 of card volume a month. Above that the free plan costs you money. At $83,987 a month it costs $5,219.08 a year more than the paid plan.",
    },
    {
      question: "What does Toast POS cost per month?",
      answer:
        "Toast publishes three restaurant tiers. The Starter Kit is $0 a month for one location with one or two terminals. Point of Sale starts at $69 a month, and Toast notes the price includes the first hardware terminal subscription with additional charges for further devices. Build Your Own is custom priced. A bundle of Point of Sale with Toast Payroll starts at $69 a month plus $9 per employee per month. Online ordering, sold inside the Digital Storefront Suite, has no published price.",
    },
    {
      question: "Does Toast charge commission on online orders?",
      answer:
        "Not on its own first party online ordering, which Toast markets as commission free, though you still pay card processing on those orders and the Digital Storefront subscription that carries the feature is priced by quote. Toast Delivery Services charges a flat fee per delivery instead of a commission: $6.99 under 6 miles through Uber Direct or $7.49 within 5 miles through DoorDash Drive, plus regulatory fees of $2.00 in California, $3.00 in New York City and $5.00 in Seattle.",
    },
    {
      question: "Is Toast cheaper than Square for a restaurant?",
      answer:
        "On published card present rates, Square's 2.6 percent plus 15 cents beats Toast's 3.09 percent Pay-as-you-Go plan and sits close to Toast's 2.49 percent Traditional plan, which has no per item fee. On a $50.90 check with tip, Square costs $1.47 and Toast's Traditional plan costs $1.27. The comparison stops being about rate quickly, though, because Toast quotes most of its deals and bundles payroll, kitchen displays and handhelds that Square prices separately.",
    },
  ],
  related: [
    "restaurant-credit-card-fee-calculator",
    "clover-fee-calculator",
    "square-fee-calculator",
    "effective-rate-calculator",
    "break-even-and-margin-calculator",
  ],
  links: [
    { label: "Toast review and full pricing breakdown", href: "/processor/toast" },
    { label: "Best payment processors for restaurants", href: "/category/restaurants" },
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
    { label: "Effective rate, explained", href: "/glossary/effective-rate" },
    { label: "Card present, explained", href: "/glossary/card-present" },
    { label: "Surcharge, explained", href: "/glossary/surcharge" },
  ],
  cta: {
    heading: "Toast quotes most of its rates. Know your number first.",
    body: "Work out what you process once tips are counted, then compare that against processors that publish their pricing.",
    label: "Compare restaurant processors",
  },
};
