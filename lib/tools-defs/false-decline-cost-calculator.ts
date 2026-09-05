import type { ToolDef } from "@/lib/tools";

/**
 * `/tools/false-decline-cost-calculator`
 *
 * SEARCH INTENT THIS PAGE OWNS. The calculation modifier on wrongly declined
 * good customers: "false decline", "false positive fraud decline cost",
 * "declined transaction cost", "authorization rate calculator", "what is one
 * point of approval rate worth". It also answers the informational siblings the
 * same searcher types on the way in, "what is a false decline", "why did my
 * card get declined", "can I retry a declined card", because the same person
 * asks both and there is no reason to send them somewhere else for it. The
 * definitional intents still belong to the glossary and this page links into
 * them rather than trying to replace them.
 *
 * WHAT THE COMPETITION GETS WRONG. Three things, all checkable:
 *
 *   1. They quote one enormous unsourced industry figure, usually a number of
 *      billions attributed to nobody, and give the merchant no way to turn it
 *      into their own number. This page publishes no industry total at all. It
 *      publishes the merchant's arithmetic and the handful of statistics that
 *      have a named, dated document behind them.
 *   2. They print a scare number with nothing on the other side of the ledger.
 *      A fraud ruleset that refuses good customers also stops real fraud, and a
 *      page that never nets the two off cannot be used in the conversation the
 *      merchant has to have with whoever owns the rules. This one returns a net
 *      position and the break-even false-decline share.
 *   3. They treat retries as a free lever. Visa's response code categories make
 *      reattempting a Category 1 decline a rules breach, and cap everything else
 *      at 15 attempts in 30 days. A retry strategy written without that is a
 *      compliance problem wearing a revenue costume.
 *
 * WHERE THE NUMBERS CAME FROM. Every published statistic is in
 * `lib/tools-data/false-decline.ts` with its document and date: Visa's response
 * code rules (Article ID AI10325, 3 September 2020, effective 17 April 2021),
 * Visa's token white paper and its 4 June 2024 press release, Stripe's decline
 * documentation, and the Federal Reserve Board's 2023 debit card report released
 * 19 December 2025. Every dollar figure in the copy below was produced by
 * `lib/calc/false-decline.ts` on the widget's own default inputs and is asserted
 * in `tests/tools/batch-four/false-decline-cost-calculator.test.ts`, because a
 * hand-written number that disagrees with the widget on the same page has
 * shipped on this site before.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED. Nobody publishes the mix of decline reasons
 * across US merchants, and nobody publishes a credible false-decline rate. Both
 * are user inputs here, with defaults labelled as editorial placeholders in the
 * data module, on the page and in the assumptions block.
 */

const NOT_ADVICE =
  "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.";

export const FALSE_DECLINE_TOOL: ToolDef = {
  slug: "false-decline-cost-calculator",
  name: "False Decline Cost Calculator",
  h1: "False decline cost calculator: what refusing good customers costs",
  title: "False decline cost calculator: approval rate to dollars",
  description:
    "Price what false declines cost in lost revenue, gross profit and lifetime value, net of the fraud your rules stopped, plus what one approval point is worth.",
  intro:
    "A false decline is a real customer your rules refused by mistake, and unlike fraud it arrives with no chargeback notice, no fee and no record, so it never appears in a report you already run. That is why most merchants have never priced it. On 12,000 order attempts a month at an 87 percent approval rate, a $96 average order and a 42 percent margin, the False Decline Cost Calculator puts the loss at $266,603 a year against $158,776 of fraud prevented, a net loss of $107,827. It also prices one percentage point of approval rate, which on that volume is $58,061 a year in gross profit.",
  tier: 3,
  summary:
    "What wrongly declined good customers cost, netted against the fraud your rules caught, plus the dollar value of one approval point.",
  widget: "false-decline",
  workedExample: {
    scenario:
      "Northline Supply, a US direct to consumer retailer, runs 12,000 card authorization attempts a month and its gateway reports an 87 percent approval rate. Average order is $96 at a 42 percent gross margin. Its fraud team's own estimate is that 20 percent of declines are good customers, that 35 percent of those get through on a second attempt, and that 25 percent never come back. A retained customer is worth another $180 of gross profit beyond the order that was refused. Genuine fraud accounts for 12 percent of declines, and the processor charges $15 a dispute.",
    result:
      "Start with the declines: 12,000 x 0.87 is 10,440 approved, so 1,560 attempts were refused. Twenty percent of 1,560 is 312 good customers turned away. Of those, 109.2 come back and succeed, leaving 202.8 orders gone. At $96 each that is $19,468.80 of revenue a month and $233,625.60 a year, but the loss to the business is the margin, not the sale: gross profit per order is 96 x 0.42 = $40.32, so 202.8 x $40.32 = $8,176.90 a month. Separately, 25 percent of the 312, which is 78 customers, never return, and at $180 of future gross profit each that is $14,040 a month walking out of the door. Total damage is $8,176.90 + $14,040 = $22,216.90 a month, or $266,602.80 a year. Now the other side. Twelve percent of 1,560 declines, 187.2 orders, were genuine fraud the rules stopped. A blocked fraudulent order does not save you the $96, because that money was always going to be reversed. It saves the goods you did not ship, 96 less 40.32 = $55.68, plus the $15 dispute fee you were not charged, so $70.68 each. 187.2 x $70.68 = $13,231.30 a month, or $158,775.60 a year. Net position: $13,231.30 less $22,216.90 is minus $8,985.60 a month, minus $107,827.20 a year. The rules are losing money, and they would only break even if 11.9 percent of declines were good customers rather than 20 percent. Finally the approval rate view. One percentage point of 12,000 attempts is 120 orders, $11,520 of revenue a month and $4,838.40 of gross profit, which is $58,060.80 a year. The 312 false declines are 2.60 points of approval rate, so a perfect ruleset would run at 89.60 percent instead of 87.00 percent, and the total damage is worth 4.59 points at this margin.",
  },
  sections: [
    {
      heading: "How the False Decline Cost Calculator prices a wrongly refused order",
      body: [
        "Start with the population. Order attempts times your approval rate gives approved orders, and everything else is a decline. A false decline is the subset of those declines that were good customers: a real cardholder, buying a real thing, refused by a rule rather than by a lack of funds. Nobody can tell you your share, so the False Decline Cost Calculator takes it as an input and shows what each value implies rather than pretending to know it.",
        "Then split the falsely declined into three fates, because they cost wildly different amounts. Some retry and succeed, and those cost you nothing but friction. Some abandon this order and shop with you later, and those cost the gross profit on one order. Some never come back, and those cost the gross profit on the order plus every dollar of margin they would have delivered afterwards. The third group is where the money is, and it is invisible in every report a merchant already runs.",
        "The arithmetic is deliberately in gross profit rather than revenue. A refused order does not cost you the sale price, because you never shipped the goods. It costs you the margin. Lost revenue is the bigger and more quotable figure and this page prints it, but the number that belongs in a business case is the profit. The lifetime value input is future gross profit beyond the declined order for the same reason: a lifetime value that already contains this order counts one sale twice.",
        "The last step is the one nobody else takes. Fraud rules that refuse good customers also stop real fraud, and a blocked fraudulent order is a genuine saving: the goods you did not ship plus the dispute fee you were not charged. It is not the order value, because that revenue was always going to be reversed. Netting the two gives a position rather than a scare number, plus the break-even share of declines, the point below which your rules pay for themselves.",
      ],
    },
    {
      heading: "Issuers decline, merchants pay, and the levers you actually hold",
      body: [
        "The authorization decision is not yours. When a customer clicks pay, the issuing bank's models decide, and Stripe's documentation lists what those models look at: spending habits, account balance, and card data including expiry date, address information and CVC. Your processor relays the answer. That changes what you can do about a decline: you cannot approve a transaction the issuer refused, you can only change what the issuer was looking at when it decided.",
        "That leaves four levers. The first is the quality of the data on the authorization: address verification, the card security code and a consistent billing name are what let an issuer tell a returning customer from a stolen card. The second is authentication. Running 3-D Secure gives the issuer a verified cardholder rather than a guess, and where authentication succeeds it shifts liability for fraud disputes to the issuer, which Stripe describes as protecting businesses from liability for fraudulent card payments. It adds a step at checkout, so it is a trade rather than a free win.",
        "The third lever is the credential itself. Network tokens replace the card number with a token specific to you that carries a cryptogram, and they update themselves when the card is reissued. Visa's own figures are the best evidence available: token based transactions drive a four percent uplift in authorization and a 30 percent reduction in fraud online against the plain card number, measured on VisaNet from October to December 2022. Account updater services do a slower version of the same job.",
        "The fourth lever is the one you own outright, your own fraud tool. Everything above is an issuer decision. The rules you or your vendor wrote are yours, and so are the orders they block before an issuer ever sees them. If your fraud tool rejects orders itself rather than declining them at the bank, those rejections are not in your gateway's decline count at all, and you have to go and get them separately before this arithmetic is complete.",
      ],
    },
    {
      heading: "Hard declines, soft declines, and the retry that is a rules breach",
      body: [
        "Visa groups authorization response codes into four categories, and the grouping decides what you may do next. Category 1 means the issuer will never approve: 04 pick up card, 41 lost card, 43 stolen card. Zero reattempts. Category 2 means the issuer cannot approve at this time, covering 51 insufficient funds, 61 and 65 limits and 91 issuer unavailable, and those may be reattempted up to 15 times in 30 days. Category 3 is data quality: correct the details, never resend the same ones. Category 4 is everything else, the generic codes. Visa's update of 3 September 2020, effective 17 April 2021, moved codes 03, 62, 78 and 93 out of Category 1 into Category 2 so merchants could stop discarding those sales.",
        "So a retry program has to read the code, not just the failure. Reattempting a Category 1 decline is a rules breach whatever your success rate looks like, and a burst of retries on any code reads to issuers as card testing. Stripe's guidance is to stop at eight retries, and it says directly that additional retries can be seen as potential fraud and increase declines on legitimate charges. The network ceiling is 15 in 30 days; the working limit is well below it.",
        "The largest and least useful group is the generic decline, Category 4, led by response code 05 do not honor. Stripe states that card issuers categorize most declines as generic, which makes the exact reason unclear. That is why false declines hide there: nothing in the code says the customer was bad. Read the advice code before you reattempt one, because Stripe returns do_not_try_again on some and try_again_later on others. Then send more data, not more attempts, because this is where a better authorization does more good than a second identical one.",
        "The cheapest approval rate you will ever buy is in the system and routing group: issuer unavailable, system malfunction, reenter transaction. Nothing is wrong with the card or the customer, and every one you do not retry is a sale thrown away for a timeout. The False Decline Cost Calculator's third tab prices a retry program separately, and its figure overlaps with the first tab. Do not add the two together.",
      ],
    },
    {
      heading: "Benchmarks you can check, and the ones nobody publishes",
      body: [
        "There is a large, round, frequently repeated dollar figure for the annual cost of false declines in US ecommerce. This page does not print it, because every trail leads back to a survey nobody can produce or a vendor with something to sell. What does exist is narrower and worth more. The Federal Reserve Board reported that in 2023, for issuers covered by Regulation II, fraud losses to all parties were 17.6 basis points of transaction value, up from 7.8 basis points in 2011, and merchants absorbed 49.9 percent of them. That report was released on 19 December 2025 and covers debit and prepaid cards only.",
        "The same report gives the incidence, which is what puts a fraud ruleset in perspective. Fraudulent transactions were 0.12 percent of dual-message debit transactions in 2023, roughly one in 830. A rule tuned to catch that needle works through a great deal of hay, and every point of over-blocking costs real orders.",
        "On the recovery side the strongest public evidence is Visa's, and it needs reading carefully, because Visa publishes two different kinds of number. The merchant level figures are relative lifts: four percent uplift in authorization from tokens, 4.6 percent globally on high volume tokenized merchants. The network level figure is absolute: tokenization has caused a six basis point increase in payment approval rates globally, alongside more than $40 billion of incremental ecommerce revenue, per Visa's press release of 4 June 2024. Both are true. Merchants who adopt tokens get the lift; the network average moves six basis points because most volume is not tokenized.",
        "What nobody publishes is the two figures this calculator most wants: the share of declines that are false, and the mix of decline reasons across merchants. Every page quoting those is quoting itself. Both are inputs here, the default decline mix in the third tab is labeled an editorial placeholder rather than data, and the fix is the same for both: export your own decline codes for a month and put the real shares in.",
      ],
    },
    {
      heading: "When the number means act, and when it means do nothing",
      body: [
        "Act when the net position is negative and the break-even share is close to plausible. On the defaults above the rules lose $107,827 a year and would break even at an 11.9 percent false decline share against the 20 percent entered. That is not a rounding error, and it survives being wrong: at half the assumed rate the case for loosening still holds. The second output is what wins the argument. One point of approval rate on 12,000 attempts is $58,061 a year of gross profit, which is why approval rate work loses budget to projects with smaller returns and better slides.",
        "Do nothing when the loss is small against the fraud caught, when your margin is thin, or when a fraud spike would be existential rather than expensive. A merchant at a 12 percent gross margin recovers little from an extra approved order and loses a great deal on a fraudulent one, so tight rules are correct there and this arithmetic will say so. Near a card network chargeback monitoring threshold, loosening rules is the wrong move at the wrong time.",
        "Before you touch a rule, do the free things. Send address verification and the card security code on every authorization. Turn on an account updater for cards on file. Adopt network tokens if your processor supports them. Retry the system and routing declines you currently discard. All four raise the approval rate without moving your risk appetite by a point, and three cost nothing but a configuration change. Loosening a fraud rule is the last lever to reach for, because it is the only one that trades directly against fraud losses.",
        "Then measure. Pull a month of declines with their reason codes and order values, and find out how many were generic, how many were hard, and how many were never retried. Every number here becomes yours at that point, and the False Decline Cost Calculator stops being an argument and starts being an accounting entry.",
      ],
    },
  ],
  rateTable: {
    caption:
      "What one percentage point of approval rate is worth, computed on this page rather than sourced. Assumes a $96 average order and a 42 percent gross margin, held flat across the year, and that recovered orders look like your average order. Every cell is arithmetic you can reproduce in the calculator above by changing the order attempts.",
    columns: ["Extra orders a month", "Extra revenue a month", "Extra revenue a year", "Gross profit a year"],
    rows: [
      { label: "2,000 attempts a month", values: ["20", "$1,920", "$23,040", "$9,676.80"] },
      { label: "5,000 attempts a month", values: ["50", "$4,800", "$57,600", "$24,192.00"] },
      {
        label: "12,000 attempts a month",
        note: "The worked example above",
        values: ["120", "$11,520", "$138,240", "$58,060.80"],
      },
      { label: "40,000 attempts a month", values: ["400", "$38,400", "$460,800", "$193,536.00"] },
      { label: "150,000 attempts a month", values: ["1,500", "$144,000", "$1,728,000", "$725,760.00"] },
    ],
  },
  assumptions: [
    "Every input is yours, and none of the defaults is a benchmark. The 87 percent approval rate, the 20 percent false decline share, the 12 percent fraud share and the decline mix in the third tab are editorial starting values chosen to make the page render a complete answer on load. No card network or US processor publishes a false decline rate or a decline reason mix, so replace all four from a month of your own gateway data before quoting any figure from this page.",
    "The retry rules and response code categories come from Visa Business News, Updates to Rules for Declined Transaction Resubmission and Use of Authorization Response Codes, Article ID AI10325, published 3 September 2020 and effective 17 April 2021, read 5 September 2026. That article states there are four categories, defines Category 1 and Category 2, confirms the 15 attempts in 30 days ceiling and lists codes 03, 62, 78 and 93 as moving between them; the Category 4 generic bucket is described in acquirer documentation rather than in the article itself, so treat that label as second hand. The eight retry working limit, the advice codes and the generic decline characterization come from Stripe's decline documentation, read the same day.",
    "Fraud loss context comes from the Federal Reserve Board's 2023 Interchange Fee Revenue, Covered Issuer Costs, and Covered Issuer and Merchant Fraud Losses report, released 19 December 2025: 17.6 basis points of transaction value in fraud losses to all parties, 49.9 percent of them absorbed by merchants, and fraudulent transactions at 0.12 percent of dual-message debit transactions. That study covers debit and general use prepaid cards from issuers covered by Regulation II, not credit cards and not every issuer, so treat it as an order of magnitude rather than as your own fraud rate.",
    "Authorization uplift figures are Visa's own, from the Visa Commercial Solutions white paper A deep dive on tokens, copyright 2024, and Visa's press release of 4 June 2024. They are vendor figures about a vendor product, they mix merchant level relative lifts with a network wide absolute change, and Visa states that individual results vary. The $15 dispute fee default is Stripe's published US figure from this site's Stripe rate card, checked 1 September 2026.",
    "Lifetime value is defined as future gross profit beyond the refused order, so the declined sale is counted once. The share who retry successfully and the share who never come back describe the same customers, so the second is capped at whatever the first leaves and the calculator says when that happens. Monthly figures are multiplied by twelve, not compounded: these are flows and volume is held flat.",
    "The retry recovery figure in the third tab overlaps with the false decline loss in the first, because some recovered orders are the same customers. They answer different questions for different budgets and must never be added together.",
    NOT_ADVICE,
  ],
  faqs: [
    {
      question: "What is a false decline?",
      answer:
        "A legitimate customer refused at checkout by a fraud rule or an issuer model rather than by anything actually wrong with the card. The order looked risky, so it was blocked, but the buyer was real. It is invisible in normal reporting because a refused customer leaves no record, unlike fraud, which arrives as a chargeback with a fee. On this page's default merchant, 312 of 1,560 monthly declines are false and 78 of those customers never return.",
    },
    {
      question: "How much do false declines cost merchants?",
      answer:
        "There is no trustworthy industry total, which is why this page does not print one. It costs whatever your own volume and margin say. On 12,000 attempts a month at an 87 percent approval rate, a $96 order and a 42 percent margin, the False Decline Cost Calculator returns $8,176.90 a month of lost gross profit plus $14,040 of lifetime value, or $266,603 a year, against $158,776 of fraud prevented. That is a net loss of $107,827 a year.",
    },
    {
      question: "How do I calculate my false decline rate?",
      answer:
        "You cannot compute it, only estimate it, because nobody records which refused customers were genuine. The usable approach is to export a month of declines with their reason codes, set aside the hard, account level ones as almost certainly correct, and treat the generic and suspected fraud groups as the pool where false declines live. Then test: loosen one rule, measure approvals and chargebacks for 30 days, and back the rate out of the difference.",
    },
    {
      question: "What is a good authorization rate for ecommerce?",
      answer:
        "There is no published US benchmark worth quoting, because it swings by category, ticket size, card mix and how much of your volume is recurring. What is comparable is your own rate over time and against your own segments. The useful number is not the level but the value of a point: on 12,000 attempts a month at a $96 order and a 42 percent margin, one percentage point is 120 orders, $138,240 of annual revenue and $58,061 of annual gross profit.",
    },
    {
      question: "Can I retry a declined credit card?",
      answer:
        "It depends on the code. Visa's Category 1 codes, which mean the issuer will never approve, permit zero reattempts, and retrying one is a rules breach. Category 2 codes, which mean the issuer cannot approve right now, may be retried up to 15 times in 30 days. Category 3 codes require you to correct the data first and never resend the same details. Stripe recommends stopping at eight retries, because a burst reads as fraud to issuers.",
    },
    {
      question: "Does 3-D Secure reduce declines or cause them?",
      answer:
        "Both, and which one wins depends on your traffic. A successfully authenticated transaction gives the issuer a verified cardholder rather than a guess, which lifts approvals, and it shifts liability for fraud disputes to the issuer. It also adds a step at checkout that some customers abandon. Visa cites Euromonitor survey work from March 2021 finding payment issues can cause up to 44 percent of digital abandonment, so measure completion, not just approval rate, before and after.",
    },
  ],
  related: [
    "chargeback-cost-calculator",
    "involuntary-churn-calculator",
    "refund-cost-calculator",
    "high-risk-merchant-account-cost-calculator",
    "break-even-and-margin-calculator",
  ],
  links: [
    { label: "Authorization, explained", href: "/glossary/authorization" },
    { label: "3-D Secure and the liability shift", href: "/glossary/3d-secure" },
    { label: "Address verification (AVS), explained", href: "/glossary/avs" },
    { label: "CVV, explained", href: "/glossary/cvv" },
    { label: "Tokenization, explained", href: "/glossary/tokenization" },
    { label: "Payment processors for ecommerce", href: "/category/ecommerce" },
  ],
  cta: {
    heading: "One point of approval rate is worth more than most fee negotiations",
    body: "On 12,000 attempts a month it is $58,061 a year of gross profit, with no rate to renegotiate and nothing to repay. Work out what your own point is worth above, then check whether your processor gives you the decline codes, the network tokens and the account updater you need to go and get it.",
    label: "Compare processors",
  },
};
