/**
 * Venmo, Cash App and Zelle: what a US business actually pays, and what it gives up
 *
 * Generated reference data for the `/tools/*` calculators. The maintenance
 * contract is in `lib/tools-data/index.ts`: every figure here was read from a
 * primary source on the date recorded beside it, and a checked date must never
 * be moved without re-reading the source.
 *
 * ONE MODULE PER TOOL, ON PURPOSE. `/tools/[tool]` is a single route serving
 * every calculator, so anything a client widget imports lands in the chunk that
 * EVERY tool page loads. Splitting these is what keeps the 290 row MCC table off
 * the Stripe fee calculator. Do not merge them back into one file, and do not
 * import from `lib/tools-data/index.ts` inside a `"use client"` module.
 *
 * WHY THIS DATASET IS SHAPED THE WAY IT IS
 *
 * The three products in the page title are not one product with three logos, and
 * the row shape says so. Venmo and Cash App are payment services that charge a
 * seller a percentage plus a fixed fee, hold the money in a balance, charge again
 * if you want that balance moved out fast, and report you to the IRS above a
 * threshold. Zelle is a bank to bank message: no fee, no balance, no reporting,
 * and no dispute mechanism of any kind. So each row carries not just a rate but
 * `buyerDisputeRight`, `businessUse` and `taxReporting`, because a comparison
 * that prices only the percentage concludes that free beats 2.6 percent, which is
 * the mistake nearly every ranking page makes.
 *
 * THE INSTANT PAYOUT BAND IS A SEPARATE EXPORT because it is a separate decision.
 * The seller fee is charged whether you like it or not. The payout fee is charged
 * only if you choose speed, and its shape (a percentage with a floor and, for
 * Venmo, a hard ceiling) behaves nothing like the seller fee: it is regressive on
 * small withdrawals because of the minimum, and progressive up to the cap.
 *
 * PUBLISHED BANDS ARE CARRIED AS BANDS. Cash App publishes its instant transfer
 * fee as a range and says the exact figure is disclosed at the time of the
 * transaction, so `ratePctLow` and `ratePctHigh` differ and the calculator prints
 * both ends. Inventing a midpoint would be inventing a number.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A per payment charge: a percentage of the payment plus a fixed amount. */
export interface P2pSellerFee {
  ratePct: number;
  fixed: number;
}

/**
 * A payout fee: a percentage with a minimum floor and an optional hard cap.
 *
 * `ratePctLow` and `ratePctHigh` are equal where the provider publishes one
 * number and differ where it publishes a band. `maxFee` is null where the
 * provider publishes no ceiling.
 */
export interface P2pPayoutFee {
  ratePctLow: number;
  ratePctHigh: number;
  minFee: number;
  maxFee: number | null;
}

export interface P2pService {
  id: string;
  label: string;
  /** `p2p` for the three apps, `card` for the merchant account baseline they are compared against. */
  kind: "p2p" | "card";
  seller: P2pSellerFee;
  /** What the provider charges when a payment is disputed and you lose. Zero where there is no mechanism. */
  disputeFee: number;
  /**
   * True where the buyer has a route to reverse the payment against you.
   *
   * This is the field the fee comparison exists to sit beside. It is a cost to
   * the seller and a reason a buyer will agree to pay at all, which is why the
   * cheapest row in the table is not automatically the right answer.
   */
  buyerDisputeRight: boolean;
  disputeMechanism: string;
  /** Whether a business may use this product at all, and on what account type. */
  businessUse: string;
  /** How payments through this rail reach the IRS. */
  taxReporting: string;
  standardPayout: string;
  note: string;
  source: string;
}

export interface P2pInstantTransfer {
  serviceId: string;
  label: string;
  fee: P2pPayoutFee | null;
  speed: string;
  source: string;
}

export interface P2pDefaults {
  monthlyVolume: number;
  transactions: number;
  singlePayment: number;
  payoutAmount: number;
  payoutsPerMonth: number;
  instantPayout: boolean;
}

// ---------------------------------------------------------------------------
// Widget defaults
// ---------------------------------------------------------------------------

/**
 * The widget's opening state, kept here rather than as literals in the
 * component so the server rendered default result is data with a home.
 *
 * $6,000 across 120 payments is a $50 average ticket, which is roughly where a
 * services business or a market stall sits and is small enough that the fixed
 * component of each fee is visible rather than rounded away.
 */
export const P2P_DEFAULTS: P2pDefaults = {
  monthlyVolume: 6000,
  transactions: 120,
  singlePayment: 50,
  payoutAmount: 1500,
  payoutsPerMonth: 4,
  // Off by default so the opening comparison is a clean seller fee comparison.
  // Instant payout is an opt in cost, it is priced as a band on Cash App, and it
  // has a whole mode of its own; folding it into the default headline would put
  // a range in front of a merchant who has not yet said they take one.
  instantPayout: false,
};

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const P2P_SERVICES: P2pService[] = [
  {
    id: "venmo-business",
    label: "Venmo business profile",
    kind: "p2p",
    seller: { ratePct: 1.9, fixed: 0.1 },
    disputeFee: 0,
    buyerDisputeRight: true,
    disputeMechanism:
      "Venmo Purchase Protection. A buyer who does not receive the item, or receives one that is not as described, can dispute the payment and Venmo opens an investigation. Venmo states that the seller transaction fee is what funds the program.",
    businessUse:
      "Permitted, and this is the sanctioned route. Venmo's US user agreement says a business profile is offered inside a personal account and is what you use to receive payments for the sale of goods and services.",
    taxReporting:
      "Venmo is a third party settlement organization, so it files Form 1099-K once payments for goods and services to you exceed $20,000 AND the number of transactions exceeds 200 in the calendar year. Both tests must be met.",
    standardPayout: "Free, 1 to 3 business days to a linked bank account, about 48 hours to an eligible debit card.",
    note: "Tap to Pay contactless payments are priced separately at 2.29 percent. Venmo's help article puts the fixed component of the Tap to Pay rate at $0.10 and its own fees page prints $0.09 for the same product, so the two Venmo pages disagree by a cent; the standard 1.9 percent plus $0.10 rate is stated identically on both. Venmo's user agreement also says Tap to Pay transactions are not eligible for Purchase Protection, because the buyer did not pay from a Venmo account.",
    source:
      "Rate from help.venmo.com, Business Profile Transaction Fees (article vhel221); payout and instant transfer figures from venmo.com/about/fees; account rules and Purchase Protection eligibility from venmo.com/legal/us-user-agreement. All checked 5 September 2026",
  },
  {
    id: "venmo-personal-gs",
    label: "Venmo personal profile, goods and services",
    kind: "p2p",
    seller: { ratePct: 2.99, fixed: 0 },
    disputeFee: 0,
    buyerDisputeRight: true,
    disputeMechanism:
      "Venmo Purchase Protection, the same program that covers business profiles. The buyer toggles the payment as a purchase, which is what triggers both the protection and the fee.",
    businessUse:
      "For occasional selling only. Venmo's user agreement states that personal accounts and Teen Accounts may not be used to conduct business, commercial or merchant transactions with other personal accounts, including accepting payment from people you do not personally know for goods or services. The remedies the agreement lists for a review include blocked transfers, money being held, and account limitation, suspension or termination.",
    taxReporting:
      "Same third party settlement organization rules as a business profile: Form 1099-K above $20,000 and more than 200 goods and services transactions.",
    standardPayout: "Free, 1 to 3 business days to a linked bank account.",
    note: "This is the most expensive of the three app rates and it is the one an occasional seller falls into by default, because the toggle sits in the buyer's flow rather than the seller's. It costs 109 basis points more than the same payment through a business profile, and on a $50 ticket the business profile also adds a 10 cent fixed fee, so the crossover is not a straight percentage comparison.",
    source:
      "Seller transaction fee from venmo.com/about/fees; personal account restriction and enforcement remedies from venmo.com/legal/us-user-agreement. Both checked 5 September 2026",
  },
  {
    id: "cashapp-business",
    label: "Cash App Business account",
    kind: "p2p",
    seller: { ratePct: 2.6, fixed: 0.15 },
    disputeFee: 0,
    buyerDisputeRight: true,
    disputeMechanism:
      "Card network chargebacks plus Cash App's own reversal powers. Cash App's terms say purchases from a Business Account made with a linked card are processed by the card network, and that you authorize Cash App, as your agent, to void a transaction where it reasonably believes a chargeback is likely.",
    businessUse:
      "Permitted on a Business Account, and required. Cash App's terms describe the peer to peer service as being for personal, non-commercial purposes, and state that if Cash App determines in its sole discretion that you are using your account to sell goods and services, it may require you to open or switch to a Cash App Business Account.",
    taxReporting:
      "Cash App is a third party settlement organization and files Form 1099-K for Business Accounts above the same federal thresholds: more than $20,000 and more than 200 transactions.",
    standardPayout: "Free, 1 to 3 business days to a linked bank account.",
    note: "Two things worth knowing that are not in the rate. Tap to Pay on iPhone is priced at a flat 3 percent rather than 2.6 percent plus $0.15. And Cash App's terms state that a Business Account holder may be liable for all unauthorized transactions regardless of when the activity is reported, which is a materially different position from the consumer error resolution rights on a personal account.",
    source:
      "Rate from cash.app/help/6521-cash-app-business-fees, read from the Internet Archive capture dated 14 December 2025 because cash.app blocks automated requests. Account rules, unauthorized transaction liability and the instant transfer band from the US Cash App Terms of Service, cash.app/legal/us/en-us/tos, Internet Archive capture dated 11 June 2026",
  },
  {
    id: "zelle",
    label: "Zelle",
    kind: "p2p",
    seller: { ratePct: 0, fixed: 0 },
    disputeFee: 0,
    buyerDisputeRight: false,
    disputeMechanism:
      "None. Zelle states plainly that it does not offer purchase protection, for example if you make a purchase using Zelle but do not receive the item or the item is not as described, and that Zelle payments cannot be reversed because money moves into an enrolled recipient's account within minutes.",
    businessUse:
      "Depends entirely on your bank. Zelle says eligible small businesses can send and receive money, that your bank or credit union must currently offer Zelle for your business account type, and that your bank sets the fees and the limits. Many banks do not offer it on business accounts at all.",
    taxReporting:
      "None from Zelle. Zelle states that it does not report transactions made on the Zelle Network to the IRS. The income is still taxable and still your responsibility to report; there is simply no Form 1099-K coming.",
    standardPayout: "There is no payout. The money lands in your bank account directly, typically within minutes.",
    note: "Free, instant and irreversible, which cuts both ways. No chargeback can be raised against you, and no buyer who has read a single fraud warning will send a stranger money this way. Zelle's own guidance tells consumers not to use it where they are unsure they will get what they paid for, and calls those transactions potentially high risk.",
    source:
      "Fees, protection, reversibility, small business eligibility and IRS reporting all from zelle.com: the Using Zelle FAQ, the small business account FAQ, and the FAQ headed I am unsure about using Zelle to pay someone I do not know. Checked 5 September 2026",
  },
  {
    id: "card-standard",
    label: "Standard card processing (reference)",
    kind: "card",
    seller: { ratePct: 2.9, fixed: 0.3 },
    disputeFee: 15,
    buyerDisputeRight: true,
    disputeMechanism:
      "The full card network dispute process, with a representment right: you can contest a chargeback with evidence and win. The processor charges a dispute fee whether you win or lose.",
    businessUse: "Its entire purpose. A merchant account or payment facilitator account, underwritten as a business.",
    taxReporting:
      "Form 1099-K from the first dollar. The de minimis exception in the Form 1099-K instructions applies only to third party settlement organizations; a payment settlement entity handling payment card transactions files with no dollar or transaction threshold at all.",
    standardPayout: "Typically 2 business days on standard payout terms, with no fee to take it.",
    note: "This row exists so the comparison is honest. It is the most expensive per payment and it is still the right answer for a lot of merchants, because it is the only one in this table that comes with underwriting, a representment right, a payout schedule you can plan around, and a rail your customer already trusts for a purchase from a stranger.",
    source:
      "2.9 percent plus $0.30 online and the $15 dispute fee are Stripe's published US standard pricing, from stripe.com/pricing, checked 1 September 2026 and carried in this site's Stripe rate card. Form 1099-K threshold treatment from the IRS Instructions for Form 1099-K, irs.gov, checked 5 September 2026",
  },
];

// ---------------------------------------------------------------------------
// Instant payout
// ---------------------------------------------------------------------------

/**
 * What each service charges to move the balance out fast.
 *
 * Kept separate from `P2P_SERVICES` because it prices a different decision, and
 * because the shapes do not line up: Venmo publishes one rate with a floor and a
 * ceiling, Cash App publishes a band with a variable floor and a very high
 * ceiling, and Zelle has no balance to move, so its entry is null rather than
 * zero. Null and zero mean different things here and the widget renders them
 * differently.
 */
export const P2P_INSTANT_TRANSFER: P2pInstantTransfer[] = [
  {
    serviceId: "venmo-business",
    label: "Venmo Instant Transfer",
    fee: { ratePctLow: 1.75, ratePctHigh: 1.75, minFee: 0.25, maxFee: 25 },
    speed: "Minutes, to an eligible debit card or bank account.",
    source: "venmo.com/about/fees, checked 5 September 2026",
  },
  {
    serviceId: "venmo-personal-gs",
    label: "Venmo Instant Transfer",
    fee: { ratePctLow: 1.75, ratePctHigh: 1.75, minFee: 0.25, maxFee: 25 },
    speed: "Minutes, to an eligible debit card or bank account.",
    source: "venmo.com/about/fees, checked 5 September 2026",
  },
  {
    serviceId: "cashapp-business",
    label: "Cash App Instant Transfer",
    fee: { ratePctLow: 0.5, ratePctHigh: 2.5, minFee: 0.25, maxFee: 75 },
    speed: "Minutes, to a linked card or bank account.",
    source:
      "Fee schedule in section I of the US Cash App Terms of Service, cash.app/legal/us/en-us/tos, Internet Archive capture dated 11 June 2026: 0.5 percent to 2.5 percent, a minimum of $0.25 to $1, and a maximum that shall not exceed $75. Cash App's older help article on withdrawal speed options published a narrower 0.5 percent to 1.75 percent band with a $0.25 minimum; the terms of service is the newer document and the binding one, so it is what this tool uses",
  },
  {
    serviceId: "zelle",
    label: "Not applicable",
    fee: null,
    speed: "There is no balance and no payout step. Funds land in the bank account within minutes.",
    source: "zelle.com Using Zelle FAQ, checked 5 September 2026",
  },
  {
    serviceId: "card-standard",
    label: "Instant payout (optional)",
    fee: { ratePctLow: 1.5, ratePctHigh: 1.5, minFee: 0.5, maxFee: null },
    speed: "Minutes, to an eligible debit card, where the processor offers it.",
    source: "Stripe instant payouts, 1.5 percent with a $0.50 minimum, from stripe.com/pricing, checked 1 September 2026",
  },
];
