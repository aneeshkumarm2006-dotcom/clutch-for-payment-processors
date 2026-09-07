import type { ToolDef } from "@/lib/tools";

/**
 * SEARCH INTENT THIS PAGE OWNS
 *
 * The calculation half of "venmo business fees", "cash app business fees",
 * "zelle business fees" and "venmo fee calculator": how much a US business keeps
 * when a customer pays through one of the three consumer apps, and what the
 * cheapest of them costs in things that are not money.
 *
 * WHAT THE RANKING COMPETITION GETS WRONG. Three things, all checkable.
 *
 *   1. It treats the three as one product. They are not. Two are payment
 *      services with a seller fee, a balance and a Form 1099-K; the third is a
 *      bank to bank message with none of those and no dispute mechanism.
 *   2. It prices a month as one percentage of total volume. Venmo's business
 *      rate is 1.9 percent PLUS TEN CENTS a payment and Cash App's is 2.6
 *      percent PLUS FIFTEEN CENTS a payment, so a 120 payment month is
 *      understated by $17.85 on Cash App alone.
 *   3. It republishes a flat 2.75 percent for Cash App with no fixed fee. Cash
 *      App's own fee article states 2.6 percent plus $0.15.
 *
 * WHERE THE NUMBERS CAME FROM. Venmo's business profile rate from
 * help.venmo.com article vhel221; the 2.99 percent seller transaction fee, the
 * instant transfer fee and the transfer timings from venmo.com/about/fees;
 * account rules and Purchase Protection eligibility from the Venmo US user
 * agreement. All checked 5 September 2026. Cash App's rate from
 * cash.app/help/6521-cash-app-business-fees and its instant transfer band and
 * account rules from the US Cash App Terms of Service, both read from Internet
 * Archive captures because cash.app blocks automated requests. Zelle's fee,
 * protection, reversibility, small business eligibility and IRS position from
 * zelle.com. The Form 1099-K threshold from IRS release IR-2025-107 and the
 * Instructions for Form 1099-K. The card comparison rate is Stripe's published
 * US online price, carried in this site's Stripe rate card. Every figure in the
 * worked example is reproduced by `lib/calc/p2p.ts` and asserted in
 * `tests/tools/batch-four/venmo-cash-app-zelle-business-fee-calculator.test.ts`.
 */
export const P2P_BUSINESS_FEE_TOOL: ToolDef = {
  slug: "venmo-cash-app-zelle-business-fee-calculator",
  name: "Venmo, Cash App and Zelle Business Fee Calculator",
  h1: "Venmo, Cash App and Zelle business fee calculator",
  title: "Venmo Cash App Zelle Business Fee Calculator",
  description:
    "Compare Venmo, Cash App, and Zelle business fees with our calculator. Estimate transaction fees, instant transfer costs, and effective rates.",
  intro:
    "Venmo, Cash App and Zelle are three different products and only two of them charge you anything. A Venmo business profile takes 1.9% plus $0.10 of each payment. A Cash App Business account takes 2.6% plus $0.15. Zelle takes nothing, because it is a bank to bank message rather than a payment service, and it arrives with no purchase protection, no way to dispute, and no Form 1099-K. This Venmo, Cash App and Zelle Business Fee Calculator prices a month of sales on all three, adds the instant transfer fee if you take one, and shows which of them lets your customer reverse the payment.",
  tier: 1,
  summary: "What Venmo, Cash App and Zelle really cost a US business, with the recourse each one does or does not give.",
  widget: "p2p-business",
  workedExample: {
    scenario:
      "A mobile dog groomer in Austin bills $6,000 a month across 120 appointments, so her average ticket is $50. She takes the free standard transfer to her bank rather than the instant one.",
    result:
      "On a Venmo business profile, 1.9% of $50 is $0.95 and the fixed fee adds $0.10, so each appointment costs $1.05. Across 120 payments that is $126.00 a month, an effective 2.10%, and $1,512 a year. On a Cash App Business account, 2.6% of $50 is $1.30 plus $0.15, so $1.45 a payment, $174.00 a month, 2.90%, and $2,088 a year. If she instead lets customers pay her personal Venmo profile with the goods and services toggle on, the seller transaction fee is 2.99% with no fixed fee: $1.495 a payment, which rounds up to $1.50, so $180.00 a month and 3.00%. Standard card processing at 2.9% plus $0.30 is $1.75 a payment, $210.00 a month, 3.50%, and $2,520 a year. Zelle is $0.00. Now change one thing and switch on instant transfers, four a month. After Venmo's $126.00 in seller fees she has $5,874.00 sitting in the balance, so each of the four withdrawals moves $1,468.50. Venmo's instant transfer fee is 1.75%, which on $1,468.50 is $25.70, above Venmo's published $25.00 cap, so each withdrawal costs exactly $25.00 and the four cost $100.00. Her Venmo month goes from $126.00 to $226.00 and her effective rate from 2.10% to 3.77%, which is worse than the 3.50% the card charged before any instant payout at all. Zelle still costs $0.00, saving $126.00 a month against the business profile, and the price of that saving is that a customer sending $50 to someone she has not met has no route to get it back.",
  },
  sections: [
    {
      heading: "Venmo, Cash App and Zelle business fees are three different products",
      body: [
        "The first thing the Venmo, Cash App and Zelle Business Fee Calculator does is refuse to treat these as one thing. Venmo and Cash App are payment services: they take a percentage plus a fixed fee, hold the proceeds in an app balance, charge again if you want that balance moved out in minutes, and file a Form 1099-K on you above a federal threshold. Zelle does none of that. It is a messaging layer between two banks, run by Early Warning Services and offered inside your bank's own app. No balance, no fee, no payout step, no reporting.",
        "Here are the published US rates, current as of the dates in the assumptions block below. A Venmo business profile is 1.9% plus $0.10, or 2.29% on a Tap to Pay contactless payment. A Venmo personal profile receiving a payment the buyer tagged as goods and services pays 2.99% with no fixed component. A Cash App Business account is 2.6% plus $0.15, or a flat 3% on Tap to Pay on iPhone. Zelle is zero, though Zelle is explicit that your own bank sets any fees and limits on a business account, so zero is Zelle's number rather than your bank's.",
        "One correction worth making loudly. Plenty of pages ranking for Cash App business fees still print a flat 2.75% with no fixed fee. Cash App's own fee article states 2.6% plus $0.15, which on a $50 payment is $1.45 rather than $1.375, so the repeated figure is understated on any ticket above about $10.",
        "The gap that matters more than the one between 1.9% and 2.6% is that these do not carry the same rights. Venmo runs a Purchase Protection program and says the seller transaction fee is what funds it. Cash App payments made from a linked card run over the card networks, so a chargeback can reach you. Zelle states plainly that it does not offer purchase protection and that its payments cannot be reversed. That is a difference in product, not a footnote, which is why the results table above carries a recourse column beside the money.",
      ],
    },
    {
      heading: "The formula, and why the fixed fee decides your rate on small tickets",
      body: [
        "The seller fee on each payment is rate times amount, plus a fixed fee. Rate is the published percentage, amount is what the customer sent, and the fixed fee is a flat number of cents that does not scale with anything. Your effective rate is those fees divided by the total you were paid. The Venmo, Cash App and Zelle Business Fee Calculator computes the fee on each payment, rounds it to the cent the way the provider rounds it, then multiplies by your payment count, which is what your transaction list does.",
        "Doing it the other way round is the commonest error in this category. Applying the percentage to the month's total volume and adding the fixed fee once understates the bill by the fixed fee times every payment after the first. On $6,000 across 120 payments that is 119 times $0.15, or $17.85 a month on Cash App and $214.20 a year, on a business whose whole reason for using a payment app was that it looked cheap.",
        "The fixed fee also inverts the ranking at the bottom of the range. A Venmo business profile beats the 2.99% personal seller fee on any payment above $9.17, which is where $0.10 plus 1.9% crosses 2.99%. Below that the flat 2.99% is cheaper, because ten cents is a large share of a small payment. Cash App passes the same 2.99% rate at $38.46. On an $8 payment a Venmo business profile costs $0.25, which is 3.13% on a product whose headline is 1.9%.",
        "Then there is the second fee, the one for speed. Standard transfers out of Venmo and Cash App are free and take one to three business days. Venmo charges 1.75% to go instantly, with a $0.25 minimum and a $25.00 cap; Cash App publishes a band of 0.5% to 2.5% with a minimum between $0.25 and $1 and a maximum not exceeding $75. The shape matters. Venmo's cap means the fee stops rising above $1,428.57, so one large withdrawal beats four small ones, and the minimum means a $10 withdrawal costs $0.25 for the privilege of not waiting two days.",
      ],
    },
    {
      heading: "Free is not cheap: what Zelle gives up",
      body: [
        "Zelle wins the fee comparison by construction and should still lose most of the decisions. Zelle's own guidance says that if you do not know the person, or are not sure you will get what you paid for, you should not use Zelle for that transaction, and calls those transactions potentially high risk. It states that it does not offer purchase protection, giving as its own example a purchase where you do not receive the item or it is not as described, and that Zelle payments cannot be reversed because the money moves into an enrolled recipient's account within minutes.",
        "For a seller, that cuts two ways, and both cuts are real. Nothing can be charged back against you, which matters if you have been burned by friendly fraud before. But your customer knows the same thing, or their bank's fraud warnings have told them, and someone paying a business they have not dealt with before will often simply refuse. That refusal is a cost; it just never appears on a statement. Zelle works best where trust already exists and the invoice is large: a repeat B2B customer, a landlord and a long standing tenant, a contractor on a second job.",
        "Availability is the second thing it gives up. Zelle says eligible small businesses can send and receive money, but also that your bank must currently offer Zelle for your business account type, and that your financial institution determines the fees and the limits. Plenty of banks that offer consumer Zelle do not offer it on business accounts, and those that do often set a ceiling well below what a real business takes.",
        "The third is the paper trail. Zelle states that it does not report transactions made on the Zelle Network to the IRS. That is not a tax benefit, since the income is taxable either way, but your bookkeeping then has no third party record to reconcile against. On Venmo and Cash App the Form 1099-K is at least an independent statement of what came in.",
      ],
    },
    {
      heading: "Using a personal account for business is how a balance gets frozen",
      body: [
        "The cheapest way to take a payment on Venmo looks like the personal profile, because there is no fee at all when neither side tags the payment as goods and services. It is also a breach of the agreement you accepted. Venmo's US user agreement states that personal accounts and Teen Accounts may not be used to conduct business, commercial or merchant transactions with other personal accounts, which it defines to include accepting payment for goods or services from people you do not personally know.",
        "The remedies that agreement lists are what makes this expensive rather than merely irregular: delayed, blocked or canceled withdrawals or transfers, money or payments being held, and account limitation, suspension or termination. If that lands on a month when your working capital is sitting in the app balance, the cost is not a percentage. It is every dollar in the balance, unavailable for as long as the review takes.",
        "Cash App says the same thing in its own words. Its terms describe the peer to peer service as being for sending or receiving funds for peer to peer personal, non-commercial purposes, and state that if Cash App determines in its sole discretion that you are using your account to sell goods and services, it may require you to open or switch to a Cash App Business Account. One further clause is worth reading before treating that as a formality: Cash App's terms state that a Business Account holder may be liable for all unauthorized transactions regardless of when the activity is reported.",
        "The advice is short. If you sell regularly, open the business profile or the business account and treat the seller fee as the price of not having your money frozen. If you sell twice a year, the buyer's goods and services toggle at 2.99% is the sanctioned route. If you are running real volume through a personal profile because it is free, you are not saving 1.9%, you are carrying an unpriced risk of losing access to the whole balance.",
      ],
    },
    {
      heading: "Form 1099-K in 2026, and when a card processor is the cheaper answer",
      body: [
        "The reporting threshold has moved twice in recent years and a lot of published advice is stranded on an old number, so take this from the source. The One, Big, Beautiful Bill retroactively reinstated the threshold that applied before the American Rescue Plan Act of 2021, and the IRS announced it in release IR-2025-107 on 23 October 2025 with Fact Sheet 2025-08: third party settlement organizations are not required to file Forms 1099-K unless the gross amount of reportable payment transactions to a payee exceeds $20,000 and the number of transactions exceeds 200. Both tests must be met, not either. Venmo and Cash App are third party settlement organizations. Zelle is not, and reports nothing.",
        "Two things that follow are routinely missed. Several states set their own, much lower thresholds, so a state form can arrive when no federal one does. And the de minimis exception in the Instructions for Form 1099-K applies only to third party settlement organizations: a payment settlement entity handling payment card transactions, which is what a merchant account is, files with no dollar or transaction threshold at all. Moving from Venmo to a card processor does not lower your reporting exposure, it raises it to every dollar. The form reports rather than assesses in any case, and business income is taxable whether or not one is issued.",
        "Which brings the comparison back to where it started. On the worked example above, a Venmo business profile at $126.00 a month genuinely does beat standard card processing at $210.00, at every ticket size, because 1.9% plus $0.10 is below 2.9% plus $0.30 from the first cent. Turn on instant transfers and Venmo's month becomes $226.00, worse than the card. Add a customer who will not pay a stranger through a consumer app, a dispute you would rather fight with evidence than a support ticket, or a payout schedule your accountant can forecast, and the card wins on more than price. Run your own volume through the Venmo, Cash App and Zelle Business Fee Calculator above, then put the same figures through a full processing fee calculator and compare totals rather than headline rates.",
      ],
    },
  ],
  rateTable: {
    caption:
      "Published US rates for each service, read from each provider's own documents on the dates given in the assumptions block below. These are sourced figures, not computed by this page. The last row is Stripe's published US standard pricing, shown as the reference a merchant account is priced against.",
    columns: ["Seller fee per payment", "Instant payout", "Buyer can dispute", "Form 1099-K"],
    rows: [
      {
        label: "Venmo business profile",
        note: "Tap to Pay is priced separately at 2.29% and is not eligible for Purchase Protection",
        values: ["1.9% + $0.10", "1.75%, min $0.25, max $25.00", "Yes, Purchase Protection", "Above $20,000 and 200"],
      },
      {
        label: "Venmo personal profile, goods and services",
        note: "The buyer tags the payment, which triggers both the fee and the protection",
        values: ["2.99%", "1.75%, min $0.25, max $25.00", "Yes, Purchase Protection", "Above $20,000 and 200"],
      },
      {
        label: "Cash App Business account",
        note: "Tap to Pay on iPhone is a flat 3%",
        values: [
          "2.6% + $0.15",
          "0.5% to 2.5%, min $0.25 to $1, max $75",
          "Yes, card network chargeback",
          "Above $20,000 and 200",
        ],
      },
      {
        label: "Zelle",
        note: "Your bank sets any fee and any limit, and may not offer it on a business account at all",
        values: ["$0.00", "No payout step, funds land in minutes", "No, and no reversal either", "None, Zelle does not report"],
      },
      {
        label: "Standard card processing",
        note: "Shown for comparison. Dispute fee $15.00 whether you win or lose",
        values: ["2.9% + $0.30", "1.5%, min $0.50, optional", "Yes, with a representment right", "From the first dollar"],
      },
    ],
  },
  assumptions: [
    "Venmo's business profile rate of 1.9% plus $0.10, and the 2.29% Tap to Pay rate, are from the Venmo help article Business Profile Transaction Fees (vhel221). The 2.99% seller transaction fee, the 1.75% instant transfer fee with its $0.25 minimum and $25.00 maximum, and the transfer timings are from venmo.com/about/fees. The personal account restriction and the Purchase Protection eligibility rules are from the Venmo US user agreement. All three checked 5 September 2026. Venmo's two pages disagree by one cent on the fixed component of the Tap to Pay rate, $0.10 on the help article against $0.09 on the fees page; they agree exactly on the 1.9% plus $0.10 standard rate this tool uses.",
    "Cash App's 2.6% plus $0.15, and the flat 3% for Tap to Pay on iPhone, are from cash.app/help/6521-cash-app-business-fees, read from an Internet Archive capture dated 14 December 2025 because cash.app blocks automated requests. The instant transfer band of 0.5% to 2.5% with a $0.25 to $1 minimum and a maximum not exceeding $75, the peer to peer personal use rule, and the unauthorized transaction liability clause are from the US Cash App Terms of Service, Internet Archive capture dated 11 June 2026. Cash App's older help article on withdrawal speeds published a narrower 0.5% to 1.75% band; the terms of service is the newer and binding document, so it is the one used here.",
    "Zelle's zero fee, the absence of purchase protection, the statement that payments cannot be reversed, the small business eligibility position and the statement that Zelle does not report transactions to the IRS are all from zelle.com, checked 5 September 2026. Because your own bank sets the fees and limits on a business account, a zero here means Zelle charges nothing, not that your bank does.",
    "The card comparison is Stripe's published US standard pricing of 2.9% plus $0.30 online, a $15.00 dispute fee and instant payouts at 1.5% with a $0.50 minimum, from stripe.com/pricing, checked 1 September 2026. It stands in for flat rate card processing generally, and your own processor's numbers will differ.",
    "The Form 1099-K threshold of more than $20,000 and more than 200 transactions comes from IRS release IR-2025-107 dated 23 October 2025 and the accompanying Fact Sheet 2025-08, and the point that the de minimis exception applies only to third party settlement organizations comes from the IRS Instructions for Form 1099-K. Both checked 5 September 2026. Several states set lower thresholds of their own, which this page does not enumerate, so check your state before relying on the federal figure.",
    "Monthly figures apply the seller fee to each payment and round it to the cent the way the provider rounds it, then multiply by your payment count, using your volume divided by your count as the average ticket. Your real mix of ticket sizes moves the percentage component by cents rather than dollars, because the fee that depends on the count is the fixed one. Instant payout fees are charged on the balance left after the seller fee, which is what is actually there to move.",
    "This is an estimate from the figures you entered, not a quote. Your processor statement is the authority on what you actually pay.",
  ],
  faqs: [
    {
      question: "How much does Venmo charge for business?",
      answer:
        "A Venmo business profile takes 1.9% plus $0.10 of each standard payment, so a $50 payment costs $1.05 and you keep $48.95. Tap to Pay contactless payments are 2.29% instead. If you receive a payment on a personal profile that the buyer tagged as goods and services, the seller transaction fee is 2.99% with no fixed fee, which is $1.50 on the same $50. Moving the balance out instantly adds 1.75%, with a $0.25 minimum and a $25.00 cap.",
    },
    {
      question: "How much does Cash App charge for business?",
      answer:
        "A Cash App Business account takes 2.6% plus $0.15 on each payment received from a customer's Cash App account, so $1.45 on a $50 sale, and a flat 3% on Tap to Pay on iPhone. Standard transfers to your bank are free and take one to three business days. Instant transfers cost between 0.5% and 2.5%, with a minimum between $0.25 and $1 and a maximum that does not exceed $75, and Cash App discloses the exact figure at the time of the transfer.",
    },
    {
      question: "Does Zelle charge a fee for business payments?",
      answer:
        "Zelle itself charges nothing to send or receive, and there is no payout step because the money lands in the bank account directly, usually within minutes. Your bank is a different question: Zelle says your financial institution decides the fees and the limits on a business account, and many banks that offer consumer Zelle do not support it on business accounts at all. Confirm both before you rely on it.",
    },
    {
      question: "Can I use my personal Venmo account for my business?",
      answer:
        "Not for regular selling. Venmo's US user agreement says personal accounts may not be used to conduct business, commercial or merchant transactions with other personal accounts, including taking payment for goods or services from people you do not personally know. The remedies it lists include blocked transfers, money being held, and account limitation, suspension or termination. For occasional sales the buyer's goods and services toggle at 2.99% is the sanctioned route; for regular sales, open a business profile at 1.9% plus $0.10.",
    },
    {
      question: "Do I get a 1099-K from Venmo, Cash App or Zelle?",
      answer:
        "From Venmo and Cash App, only once your goods and services payments exceed $20,000 and the number of transactions exceeds 200 in the year. Both tests have to be met. The One, Big, Beautiful Bill restored that threshold and the IRS confirmed it in release IR-2025-107 on 23 October 2025. Several states set lower thresholds. Zelle states it does not report transactions to the IRS at all, so no form is coming. The income is taxable either way.",
    },
    {
      question: "Is Venmo or Cash App cheaper for a small business?",
      answer:
        "Venmo's business profile is cheaper at every payment size: 1.9% plus $0.10 is below 2.6% plus $0.15 from the first cent and the gap widens, so a $50 payment is $1.05 against $1.45, and a $6,000 month of 120 payments is $126.00 against $174.00. The comparison that does flip is Venmo's own two rates: the 2.99% personal seller fee beats the business profile below $9.17, because ten cents is a large share of a very small payment.",
    },
  ],
  related: [
    "credit-card-processing-fee-calculator",
    "ach-vs-credit-card-fee-calculator",
    "payout-date-calculator",
    "chargeback-cost-calculator",
    "effective-rate-calculator",
  ],
  links: [
    { label: "PayPal review and full US pricing", href: "/processor/paypal" },
    { label: "Processors with payment links", href: "/payment-processors/with-payment-links" },
    { label: "ACH, defined", href: "/glossary/ach" },
    { label: "Processors for small business", href: "/category/small-business" },
    { label: "How to lower payment processing fees", href: "/blog/how-to-lower-payment-processing-fees" },
  ],
  cta: {
    heading: "Outgrown the consumer apps?",
    body: "Once instant transfers and frozen balances cost more than a seller fee, a real merchant account is usually cheaper. Tell us your volume and we will shortlist processors that price for it.",
    label: "Get matched",
  },
};
