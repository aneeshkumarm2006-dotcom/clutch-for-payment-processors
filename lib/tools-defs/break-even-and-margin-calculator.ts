import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/break-even-and-margin-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on unit economics:
 * "margin vs markup calculator", "break even calculator", "profit margin
 * calculator", "markup to margin", "contribution margin calculator", "how many
 * units do I need to sell to break even". It also has to answer the
 * informational siblings the same person types within a minute, "is markup the
 * same as margin" and "do card fees come out of my margin", because those are
 * the questions that sent them looking for a calculator in the first place.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. These are three of the highest volume
 * calculator queries on the open web and the first page is wall to wall generic
 * finance sites, so the only way to be worth citing is to be correct where they
 * are sloppy and complete where they are thin. Four checkable failures:
 *
 *   1. NOT ONE GENERAL MARGIN CALCULATOR INCLUDES THE PAYMENT PROCESSING FEE.
 *      For a business that takes cards it is a real, per unit, variable cost.
 *      Stripe's published US standard rate on a $24.00 sale is exactly $1.00,
 *      which is 4.17 percent of the price rather than the 2.9 percent on the
 *      poster, and on the defaults here it moves the monthly break-even from 500
 *      units to 538. That single omission is why this page exists on this site.
 *   2. THE FEE IS TREATED AS A CONSTANT WHEN IT IS A FUNCTION OF PRICE. A
 *      percentage plus a fixed amount cannot be entered into a "variable cost
 *      per unit" box before the price is known, and when the price is what you
 *      are solving for it has to be carried through the algebra. The target
 *      margin solve here divides by (1 - feeRate - margin), not by (1 - margin).
 *   3. MARGIN AND MARKUP GET SWAPPED. margin = (price - cost) / price. markup =
 *      (price - cost) / cost. A 50 percent markup is a 33.33 percent margin.
 *      Both are percentages, neither throws, and a page that swaps them prices
 *      every product it touches too low.
 *   4. THE UNIT COUNT IS ROUNDED BEFORE THE MONEY. A fraction of a unit does not
 *      cover a fraction of the rent, so break-even units round UP, while
 *      break-even revenue is derived from the exact figure. Both are printed.
 *
 * WHERE THE NUMBERS CAME FROM.
 *   - The break-even and contribution margin formulas, and the definition of a
 *     fixed cost, are the U.S. Small Business Administration's own, from its
 *     business guide page "Break-even point", read 5 September 2026. SBA states
 *     break-even units as fixed costs divided by (sales price per unit less
 *     variable cost per unit), break-even sales dollars as fixed costs divided
 *     by the contribution margin, and contribution margin as (sale price per
 *     unit less variable cost per unit) divided by sale price per unit. This
 *     page uses exactly that, with the card fee counted inside variable cost.
 *   - The default card rate is Stripe's US standard published pricing, 2.9
 *     percent plus 30 cents per successful transaction for domestic cards, read
 *     from a Wayback Machine capture of stripe.com/pricing dated 4 September
 *     2026 (web.archive.org/web/20260904174240/https://stripe.com/pricing).
 *     Read through the archive because this machine geo-redirects stripe.com to
 *     non-US pricing; the capture date is the checked date.
 *   - The sector margin benchmarks in the rate table are "Margins by Sector
 *     (US)", Aswath Damodaran, NYU Stern School of Business, data as of January
 *     2026, 5,994 firms, read on pages.stern.nyu.edu 5 September 2026. The gross
 *     margin and net margin columns are his. The last column is computed here.
 *   - Every other figure on this page is arithmetic produced by
 *     `lib/calc/margin.ts` and asserted in
 *     `tests/tools/batch-four/break-even-and-margin-calculator.test.ts`. The
 *     worked example was run through the module rather than written by hand.
 */

const NOT_ADVICE =
  "This is arithmetic on the figures you entered, not financial advice and not a quote. Your own accounts are the authority on your costs, and your processor statement is the authority on what you actually pay to accept cards.";

export const BREAK_EVEN_MARGIN_TOOL: ToolDef = {
  slug: "break-even-and-margin-calculator",
  name: "Break-Even and Margin Markup Calculator",
  h1: "Break-Even and Margin Markup Calculator",
  title: "Margin vs markup calculator with break-even and card fees",
  description:
    "Margin vs markup calculator and break-even solver that counts the card processing fee as a per unit variable cost, the one cost other margin calculators omit.",
  intro:
    "Margin and markup are not the same number. A 50 percent markup is a 33.33 percent margin, because margin divides the profit by the price and markup divides it by the cost. The Break-Even and Margin Markup Calculator converts between them, and then does the one thing no other margin vs markup calculator does: it treats the card processing fee as a per unit variable cost. On a $24.00 item at 2.9 percent plus 30 cents that fee is exactly $1.00, which is 4.17 percent of the price, and it moves a $7,200 a month break-even from 500 units to 538.",
  tier: 2,
  summary:
    "Margin against markup, break-even units and revenue, and the price for a target margin, all with the card fee counted as a variable cost.",
  widget: "margin-markup",
  workedExample: {
    scenario:
      "Harbor Lane Roasters sells a twelve ounce bag of coffee for $24.00. Green coffee, packaging and labor come to $9.60 a bag. Rent, two salaries, insurance and software are $7,200 a month and do not move with volume. Every sale is on a card at Stripe's published US standard rate of 2.9 percent plus 30 cents. Two questions: how many bags a month clear the fixed costs, and what does accepting cards cost when it is counted in bags rather than in basis points.",
    result:
      "$24.00 less $9.60 is $14.40 of gross profit a bag. Against the price that is a 60.00 percent margin, and against the cost it is a 150.00 percent markup. Those two numbers are the same fact. Now the fee: 2.9 percent of $24.00 is 69.6 cents, which the processor rounds to 70 cents, plus the 30 cent fixed leg, so exactly $1.00. That is 4.17 percent of the price rather than 2.9 percent, because the fixed leg does not scale with the ticket. Variable cost a bag is therefore $9.60 plus $1.00, or $10.60, and contribution is $24.00 less $10.60, which is $13.40 a bag, a 55.83 percent contribution margin. Break-even is $7,200 divided by $13.40, which is 537.31 bags, so 538 bags, or $12,895.52 of sales a month. Take the fee back out and contribution is $14.40, break-even is exactly 500 bags and $12,000.00. Accepting cards costs Harbor Lane 37.31 bags a month, which is $895.52 of sales a month and $10,746.27 a year. One more thing falls out of the same inputs. If the goal was a 60.00 percent margin after the fee rather than before it, $24.00 is the wrong price: it leaves 55.83 percent. The price that leaves 60.00 percent once the processor is paid is $26.68, because the fee rate and the target margin add in the denominator, so the cost plus the fixed fee gets divided by 1 less 0.029 less 0.60, which is 0.371, not by 0.40.",
  },
  sections: [
    {
      heading: "Margin vs markup: one fact with two denominators",
      body: [
        "Both describe the same gross profit and differ only in what they divide it by. Margin is (price less cost) divided by price. Markup is (price less cost) divided by cost. Price is what the customer pays. Cost here is cost of goods for one unit, before rent, salaries or the card fee. On a $24.00 item costing $9.60 the gross profit is $14.40, so the margin is 14.40 over 24.00, which is 60.00 percent, and the markup is 14.40 over 9.60, which is 150.00 percent.",
        "The conversion runs both ways and depends on nothing but the number itself, because the cost cancels out. Markup to margin is markup divided by (100 plus markup). Margin to markup is margin divided by (100 less margin). A 50 percent markup is a 33.33 percent margin, a 100 percent markup is a 50.00 percent margin, and a 40 percent margin needs a 66.67 percent markup. Markup has no ceiling and margin does: no finite markup reaches a 100 percent margin, since that would mean a zero cost. The Break-Even and Margin Markup Calculator prints the whole ladder so you can read the pair off instead of solving for it.",
        "The reason to be pedantic is that the error is silent. Both numbers are percentages, both are plausible for a real product, and nothing throws. Someone who wants a 40 percent margin and multiplies a $60.00 cost by 1.40 gets $84.00, feels finished, and has priced at a 28.57 percent margin. The correct price is $100.00. Across a catalog that is a permanent, invisible shortfall that surfaces only as the business being mysteriously tight on cash. Use margin to compare yourself to anything external, since every benchmark is stated against revenue, and use markup to set a price from a cost.",
      ],
    },
    {
      heading: "How the break-even calculator handles a fee that moves with the price",
      body: [
        "The Small Business Administration states the standard formula plainly: break-even point in units is fixed costs divided by (sales price per unit less variable cost per unit), break-even point in sales dollars is fixed costs divided by the contribution margin, and contribution margin is (sale price less variable cost) divided by sale price. Fixed costs are the ones that do not change with volume, which SBA lists as rent, salaries, property taxes, insurance, interest and depreciation. This break-even calculator implements exactly that, and the only opinionated part is what goes in the variable box.",
        "The card fee goes in the variable box, and it is why the solve is more than a division. A fee quoted as a percentage plus a fixed amount is not a number you can type in before the price is settled, because it depends on the price. Contribution per unit is therefore price multiplied by (1 less the fee rate), less the fixed fee, less the unit cost, evaluated at the actual price rather than a guessed one. On the worked example the fee is $1.00 on a $24.00 item, so contribution is $13.40 rather than $14.40 and break-even is 538 units rather than 500. Enter a fee of zero, as every general break-even calculator implicitly does, and the answer is 38 units a month optimistic.",
        "Two rounding rules matter. The percentage leg of the fee is rounded to the nearest cent first and the fixed leg added afterwards, because that is the order a processor uses and it is what reconciles against a statement. And the unit count is rounded up rather than to nearest, because 537.31 units do not cover $7,200 of rent, while break-even revenue comes off the exact 537.31 figure so it reports the true crossover.",
        "If some sales are cash or check, set the card share below 100 percent. A cash sale pays no processing fee at all rather than a smaller one, so the fee is rounded per transaction and only then blended by the share. On the same example at 60 percent card, the blended fee is 60 cents, contribution is $13.80 and break-even falls to 522 units.",
      ],
    },
    {
      heading: "What a card fee actually takes out of a US margin",
      body: [
        "The headline rate is never the rate you pay, because the fixed leg does not scale. At Stripe's published US standard 2.9 percent plus 30 cents, an $8.00 sale costs $0.53, which is 6.63 percent. A $20.00 sale costs $0.88, which is 4.40 percent. A $40.00 sale costs $1.46, which is 3.65 percent. A $250.00 sale costs $7.55, which is 3.02 percent. Same schedule, and the effective rate more than doubles across that range. Under about a $15 ticket the fixed fee is the largest single driver of your processing cost, and negotiating the percentage will barely move it.",
        "Set that against what a US business actually keeps. Aswath Damodaran's Margins by Sector dataset at NYU Stern, data as of January 2026 across 5,994 firms, puts net margin at 5.19 percent for retail special lines, 1.32 percent for grocery and food retail and 9.74 percent for the total market. On a $40.00 sale at a 5.19 percent net margin the entire net profit is $2.08, and the card fee on that sale is $1.46. The fee isn't a rounding error next to the profit. It's roughly seventy percent of the size of it. Those are public company aggregates, and a small independent shop usually sits below them.",
        "The same point shows up inside the conversion ladder. Hold the sale at $50.00, where the fee is $1.75, and walk down the markups. At a 10 percent markup, a 9.09 percent margin, that one fee is 38.50 percent of the gross profit on the sale. At a 50 percent markup, a 33.33 percent margin, it is 10.50 percent. At a 300 percent markup, a 75.00 percent margin, it is 4.67 percent. The fee is the identical $1.75 on every row and only the profit it comes out of changes. None of this is an argument against accepting cards. Refusing them costs far more in lost sales than 3 or 4 percent. It's an argument for putting the number in the model: a cost worth several points of margin that never shows up in a margin calculation is a cost nobody manages.",
      ],
    },
    {
      heading: "Pricing to a target margin once the fee is inside the algebra",
      body: [
        "The third mode answers the question the other two set up: what do I charge to keep a given margin after the processor is paid. Let p be the price, c the unit cost including any other variable cost, f the percentage fee as a decimal, F the fixed fee and m the target margin. Profit per unit is p less c less (f times p plus F). Set profit divided by p equal to m, collect the p terms, and p equals (c plus F) divided by (1 less f less m). The fee rate and the target margin add in the denominator, and that is the step every general calculator skips.",
        "Put the worked numbers through it. A $9.60 cost at a 60 percent target with the fee ignored gives $9.60 divided by 0.40, or $24.00. Charge $24.00 and the achieved margin after a $1.00 fee is 55.83 percent, four and a sixth points short. Solve it properly and the denominator is 1 less 0.029 less 0.60, which is 0.371, so the price is ($9.60 plus $0.30) divided by 0.371, which lands at $26.68. The fee at that price is $1.07, profit is $16.01 and the margin is 60.01 percent. The uplift is $2.68, more than two and a half times the fee itself, because raising the price also raises the percentage leg you are trying to cover.",
        "That denominator also explains why some targets are impossible. Once the fee rate plus the target margin reaches 1, no price works: every extra dollar hands part of itself straight back as a percentage fee. There is no price that leaves a 98 percent margin at a 2.9 percent card rate, and the Break-Even and Margin Markup Calculator returns a plain refusal there rather than a negative number, because a negative price renders identically to a real one. This is a margin gross-up, not a fee gross-up. If you want the amount to charge so that an exact sum lands in your bank, with no reference to cost or margin, that is the reverse fee calculator on this site.",
      ],
    },
    {
      heading: "Break-even bands, and when the answer means do nothing",
      body: [
        "A break-even number on its own decides nothing. Compare it to what you already sell. If break-even is 538 units and you sold 700 last month, you are fine, and the number to watch is the gap, because that gap is your entire profit and a bad month takes it first. If break-even is 538 and you sold 400, you have a pricing or a fixed cost problem that effort at the current price cannot fix. If the two are within about 10 percent of each other, you are running a business that survives on the assumption that nothing goes wrong.",
        "The price ladder in the results panel is there because the real question is usually whether to move the price. On the worked example, dropping the price 20 percent to $19.20 pushes break-even from 538 units to 824, a 53 percent increase in the volume you need. Raising it 20 percent to $28.80 pulls break-even down to 399. Contribution does not move proportionally with price, because the unit cost and the fixed leg of the card fee are both fixed in dollars, which is why each row is computed rather than scaled off the middle one.",
        "Two conditions make the processing fee worth acting on, and they have to hold together. One: an average ticket under roughly $25, where the fixed leg does most of the damage. Two: a contribution margin under about 40 percent, where a few points of fee is a large share of what's left. A business with a $9 ticket and a 30 percent margin should look hard at pricing, ticket size and its processor. A business with a $200 ticket and a 70 percent margin pays 3.02 percent on a sale yielding $140 of gross profit and should spend its time elsewhere. When it does mean act, raising the average ticket beats renegotiating the rate, because the fixed leg is the part you cannot negotiate away. Only after that is it worth pricing an interchange plus deal against a flat rate.",
      ],
    },
  ],
  rateTable: {
    caption:
      "US sector margins, with what a single card fee is worth against the net profit on one sale. The firm count, gross margin and net margin columns are published data: Aswath Damodaran, Margins by Sector (US), NYU Stern School of Business, data as of January 2026, read 5 September 2026. The last column is computed by this page, not sourced. Stripe's published US standard rate of 2.9 percent plus 30 cents on a $40.00 sale is $1.46, and that ticket is held constant across every row so the only thing moving is the size of the profit the fee comes out of. These are public company figures, so a small independent business will usually sit below them, and the reported net margin is already net of whatever those firms pay to accept cards, which makes the last column a size comparison rather than a subtraction.",
    columns: ["Firms", "Gross margin", "Net margin", "$1.46 fee vs net profit on $40"],
    rows: [
      { label: "Retail (General)", values: ["23", "33.18%", "5.61%", "65%"] },
      {
        label: "Retail (Special Lines)",
        note: "Specialty and single category stores",
        values: ["94", "35.30%", "5.19%", "70%"],
      },
      { label: "Retail (Grocery and Food)", values: ["15", "26.31%", "1.32%", "277%"] },
      { label: "Restaurant/Dining", values: ["64", "32.24%", "9.37%", "39%"] },
      { label: "Apparel", values: ["35", "56.88%", "3.85%", "95%"] },
      {
        label: "Total Market",
        note: "Every US listed firm in the dataset",
        values: ["5,994", "37.76%", "9.74%", "37%"],
      },
    ],
  },
  assumptions: [
    "Margin here is measured against the price the customer pays, not against the amount that settles in your bank after the processor takes its cut. Both conventions exist and they differ by roughly the fee, so two people using different ones will never agree. Price is the denominator because it is the number on the invoice, the number in your revenue line, and the number every published benchmark is computed against. The fee then appears where it belongs, as a cost.",
    "All money is computed in integer cents, and the card fee is built the way a processor builds it: the percentage leg is rounded to the nearest cent first, then the fixed leg is added. On a $24.00 sale at 2.9 percent plus 30 cents that is 70 cents plus 30 cents, exactly $1.00. A consequence worth knowing is that contribution is a step function of price, so two prices a cent apart can carry the same fee, which is why the target margin solver verifies its own closed form answer instead of trusting it.",
    "The break-even and contribution margin formulas are the US Small Business Administration's, from its business guide page on the break-even point, read 5 September 2026. SBA's own caveat applies here too: the break-even point is an estimate for planning and lender viability, not an accounting result, since that can only be produced after the costs and the production have actually happened.",
    "The default processing rate is Stripe's published US standard pricing, 2.9 percent plus 30 cents per successful transaction for domestic cards, read from a Wayback Machine capture of stripe.com/pricing dated 4 September 2026. It was read through the archive because this machine is geo-redirected away from US pricing, and the capture date is the checked date. Enter your own rate: an in person rate, an interchange plus rate or a high risk rate will all be different, and the fields accept any percentage and any fixed fee.",
    "The sector benchmarks in the table are Aswath Damodaran's Margins by Sector (US) dataset at NYU Stern, data as of January 2026 covering 5,994 firms, read 5 September 2026. They are public company aggregates. A small independent business typically runs below them on net margin and often above them on gross margin, so treat the table as a scale rather than as a target.",
    "Which costs are fixed and which are variable is your judgment and the model believes you. A cost that rises in steps, such as hiring a second shift once volume passes a threshold, breaks the assumption that fixed costs are flat, and the break-even it produces will be understated above the step. Anything that scales with each unit sold belongs in a variable field or the answer comes out low.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "What is the difference between margin and markup?",
      answer:
        "Both measure the same gross profit and divide it by different things. Margin is (price less cost) divided by price. Markup is (price less cost) divided by cost. A $24.00 item costing $9.60 has $14.40 of gross profit, which is a 60.00 percent margin and a 150.00 percent markup. Because markup divides by the smaller number, it is always the larger percentage above zero, and confusing the two prices products too low.",
    },
    {
      question: "What markup do I need to get a 40 percent margin?",
      answer:
        "66.67 percent. The formula is margin divided by (100 less margin), so 40 divided by 60, which is 0.6667. In practice that means multiplying the cost by 1.6667, not by 1.40. On a $60.00 cost the correct price is $100.00 and the common mistake, multiplying by 1.40 to get $84.00, actually delivers a 28.57 percent margin. That is a shortfall of more than eleven points on every unit.",
    },
    {
      question: "How do I calculate my break-even point in units?",
      answer:
        "Divide your monthly fixed costs by the contribution per unit, where contribution is the price less every cost that moves with each sale, including the card fee. On the worked example, $7,200 of fixed costs divided by $13.40 of contribution is 537.31, so 538 units and $12,895.52 of sales a month. Round the unit count up rather than to nearest: a fraction of a unit does not cover a fraction of the rent.",
    },
    {
      question: "Do credit card fees count as a fixed or a variable cost?",
      answer:
        "Variable, because they scale with sales. A processing fee quoted as a percentage plus a fixed amount per transaction is variable in both legs: the percentage moves with the price and the fixed leg is charged once per sale, not once per month. Only genuinely monthly charges, such as a gateway subscription or a PCI fee, belong in fixed costs. Putting the per transaction fee there understates your break-even at every volume.",
    },
    {
      question: "How much does a 2.9 percent plus 30 cent fee cut my profit margin?",
      answer:
        "More than 2.9 percent, and how much more depends entirely on your ticket. At Stripe's published US standard rate the fee is 6.63 percent of an $8.00 sale, 4.40 percent of a $20.00 sale, 3.65 percent of a $40.00 sale and 3.02 percent of a $250.00 sale. Those are the points that come straight off your margin. On a $24.00 item at a 60.00 percent gross margin, the $1.00 fee takes the margin to 55.83 percent.",
    },
    {
      question: "What price gives me a 60 percent margin after payment processing fees?",
      answer:
        "Divide the unit cost plus the fixed fee by (1 less the fee rate less the target margin). On a $9.60 cost at 2.9 percent plus 30 cents, that is $9.90 divided by 0.371, which is $26.68. The naive answer, cost divided by 0.40, gives $24.00 and actually leaves 55.83 percent. Note the fee rate and the target margin add in the denominator, which is why the uplift is $2.68 rather than the $1.00 the fee costs.",
    },
  ],
  related: [
    "reverse-fee-calculator",
    "credit-card-processing-fee-calculator",
    "refund-cost-calculator",
    "bnpl-fee-calculator",
    "cash-conversion-cycle-calculator",
  ],
  links: [
    { label: "Payment processors for small businesses", href: "/category/small-business" },
    { label: "Effective rate, explained", href: "/glossary/effective-rate" },
    { label: "All calculators", href: "/tools" },
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
    { label: "Compare all processors", href: "/processors" },
  ],
  cta: {
    heading: "The fee in this model is a number you can change",
    body: "Unit cost and rent are hard to move. The processing rate is a line item on a contract, and at 538 units a month on the worked example it is $538 of card fees, every month, forever. Work out what you actually pay across your whole mix first, then see who prices that mix differently.",
    label: "Compare processors",
  },
};
