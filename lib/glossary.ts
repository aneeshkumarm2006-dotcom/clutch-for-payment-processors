/**
 * Payments glossary data — the source behind `/glossary` (hub) and
 * `/glossary/<slug>` (term pages).
 *
 * Static TS rather than a Mongoose model on purpose: the glossary is reference
 * content that changes rarely, benefits from version control and review, and has
 * no per-request state. (It can be promoted to a `/seoteam`-editable model later
 * if the content team needs to own it.) The file is client-safe — no `@/models`
 * import — so the sitemap can read `GLOSSARY_SLUGS` without bundling Mongoose.
 *
 * `relatedFacets` slugs must exist in `lib/facet-pages.ts`; `related` slugs must
 * exist below. These cross-links are the glossary's main SEO value: they weave
 * definitions into the facet + directory graph.
 */

export interface GlossaryTerm {
  slug: string;
  term: string;
  /** Synonyms / expansions (also emitted as DefinedTerm alternateName). */
  aka?: string[];
  /** One-line summary — used on the hub list and as the meta description. */
  short: string;
  /** Full definition (2–3 sentences). */
  definition: string;
  /** Other glossary slugs to cross-link. */
  related?: string[];
  /** Facet-page slugs (`/payment-processors/<slug>`) to cross-link. */
  relatedFacets?: string[];
}

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    slug: "payment-processor",
    term: "Payment processor",
    short: "The company that moves a card payment between the customer's bank and yours.",
    definition:
      "A payment processor handles the technical movement of funds for a card transaction: it routes the payment from the customer's issuing bank to your acquiring bank and back, handling authorization and settlement. Many processors also act as the gateway and merchant account, so 'processor' is often used loosely to mean the whole payment stack.",
    related: ["payment-gateway", "merchant-account", "acquiring-bank"],
  },
  {
    slug: "payment-gateway",
    term: "Payment gateway",
    short: "The software layer that securely passes card data from checkout to the processor.",
    definition:
      "A payment gateway is the technology that captures card details at checkout and transmits them securely to the payment processor for authorization. Online, the gateway does what a card terminal does in a shop. Some providers bundle the gateway with processing; others charge a separate gateway fee.",
    related: ["payment-processor", "hosted-checkout", "tokenization"],
    relatedFacets: ["for-shopify", "for-woocommerce"],
  },
  {
    slug: "merchant-account",
    term: "Merchant account",
    short: "A bank account type that lets a business accept and hold card payments.",
    definition:
      "A merchant account is a specialised bank account that holds funds from card sales before they're paid out to your regular business account. Traditional processors set one up per merchant after underwriting; aggregators like Stripe and PayPal place you under one shared account instead, which speeds up onboarding.",
    related: ["acquiring-bank", "underwriting", "payout-time"],
  },
  {
    slug: "acquiring-bank",
    term: "Acquiring bank",
    aka: ["Acquirer"],
    short: "The bank that holds the merchant's account and receives card payments on their behalf.",
    definition:
      "The acquiring bank (or acquirer) is the financial institution that maintains the merchant account and collects card payments for the business. It settles funds from the card networks and deposits them, minus fees, to the merchant. It sits opposite the issuing bank in every transaction.",
    related: ["issuing-bank", "merchant-account", "settlement"],
  },
  {
    slug: "issuing-bank",
    term: "Issuing bank",
    aka: ["Issuer"],
    short: "The customer's bank that issued their card and approves or declines the payment.",
    definition:
      "The issuing bank is the institution that issued the customer's credit or debit card. During a transaction it decides whether to authorize the payment based on available funds and fraud checks, and it ultimately bears the cost of interchange. Chargebacks are filed through the issuer.",
    related: ["acquiring-bank", "interchange", "chargeback"],
  },
  {
    slug: "interchange",
    term: "Interchange",
    aka: ["Interchange fee"],
    short: "The fee set by the card networks and paid to the customer's issuing bank on every card sale.",
    definition:
      "Interchange is the largest component of card processing cost — a fee set by Visa, Mastercard, and other networks that goes to the cardholder's issuing bank. Rates vary by card type (rewards cards cost more), channel, and merchant category. No processor can discount interchange itself; they only mark it up.",
    related: ["interchange-plus", "assessment-fee", "effective-rate"],
    relatedFacets: ["interchange-plus"],
  },
  {
    slug: "interchange-plus",
    term: "Interchange-plus",
    aka: ["Interchange++", "Cost-plus pricing"],
    short: "A transparent pricing model: true interchange cost plus a fixed processor markup.",
    definition:
      "Interchange-plus pricing itemises your cost as the network's interchange fee plus a fixed markup (for example, interchange + 0.30% + $0.10). Because the two parts are separated, it's the most transparent model and usually the cheapest once you have steady volume. Compare it with flat-rate and tiered pricing.",
    related: ["interchange", "flat-rate-pricing", "tiered-pricing", "effective-rate"],
    relatedFacets: ["interchange-plus", "flat-rate"],
  },
  {
    slug: "flat-rate-pricing",
    term: "Flat-rate pricing",
    short: "One blended percentage (plus a fixed fee) on every sale, regardless of card type.",
    definition:
      "Flat-rate pricing charges a single, predictable rate — such as 2.9% + $0.30 — on every transaction, no matter the underlying interchange. It's simple and has no monthly minimums, which makes it ideal for new or low-volume businesses, but it can cost more than interchange-plus as volume grows.",
    related: ["interchange-plus", "tiered-pricing", "effective-rate"],
    relatedFacets: ["flat-rate"],
  },
  {
    slug: "tiered-pricing",
    term: "Tiered pricing",
    short: "Transactions are bucketed into 'qualified', 'mid-qualified', and 'non-qualified' rates.",
    definition:
      "Tiered pricing sorts each transaction into a pricing tier — typically qualified, mid-qualified, and non-qualified — each with a different rate. It looks simple but is the least transparent model, because the processor decides which tier a card falls into and can route more sales to expensive tiers.",
    related: ["flat-rate-pricing", "interchange-plus", "effective-rate"],
  },
  {
    slug: "effective-rate",
    term: "Effective rate",
    short: "Your true cost of processing: total fees divided by total sales volume.",
    definition:
      "The effective rate is the single most useful number for comparing processors: divide all the fees you paid in a period by your total card volume, then multiply by 100. It captures interchange, markup, monthly fees, and assessments in one figure, so it cuts through headline rates.",
    related: ["interchange-plus", "flat-rate-pricing", "markup"],
  },
  {
    slug: "markup",
    term: "Markup",
    short: "The processor's own margin added on top of interchange and network fees.",
    definition:
      "Markup is what the processor keeps — the amount added on top of the non-negotiable interchange and assessment fees. In interchange-plus pricing the markup is stated explicitly; in tiered or flat-rate pricing it's baked in and harder to see. Lower markup means a lower effective rate.",
    related: ["interchange-plus", "effective-rate", "assessment-fee"],
  },
  {
    slug: "assessment-fee",
    term: "Assessment fee",
    short: "A small fee paid directly to the card network (Visa, Mastercard) on each transaction.",
    definition:
      "Assessment fees are charged by the card networks themselves — separate from interchange, which goes to the issuing bank. They're a small percentage of volume and, like interchange, can't be discounted by a processor. Together interchange and assessments form the wholesale cost of accepting cards.",
    related: ["interchange", "markup", "effective-rate"],
  },
  {
    slug: "gateway-fee",
    term: "Gateway fee",
    short: "A separate charge for the software that transmits transactions to the processor.",
    definition:
      "A gateway fee is a monthly and/or per-transaction charge for using a payment gateway, levied when the gateway is a separate product from the processor (as with Authorize.net-style setups). All-in-one providers usually fold it into their rate, so watch for it when comparing quotes.",
    related: ["payment-gateway", "monthly-minimum", "effective-rate"],
  },
  {
    slug: "monthly-minimum",
    term: "Monthly minimum",
    short: "A floor on monthly fees — you pay the difference if processing fees fall short.",
    definition:
      "A monthly minimum is the least a processor will charge you in a month; if your transaction fees don't reach it, you pay the gap. It penalises seasonal or low-volume merchants, so many modern processors (especially flat-rate ones) advertise no monthly minimum.",
    related: ["gateway-fee", "flat-rate-pricing", "effective-rate"],
  },
  {
    slug: "surcharge",
    term: "Surcharge",
    short: "A fee added to a card payment to pass processing costs to the customer.",
    definition:
      "A surcharge is an extra charge added to credit-card transactions to offset the merchant's processing fee. It's regulated — capped in amount, banned in some regions, and it must be disclosed and applied only to credit (not debit) cards. Cash discounting is a related but distinct approach.",
    related: ["assessment-fee", "effective-rate"],
  },
  {
    slug: "authorization",
    term: "Authorization",
    aka: ["Auth"],
    short: "The issuing bank's approval that holds funds for a pending transaction.",
    definition:
      "Authorization is the first step of a card payment: the issuing bank confirms the card is valid and the funds are available, then places a hold. No money moves yet — that happens at capture and settlement. An authorization can be voided before it's captured.",
    related: ["capture", "settlement", "void"],
  },
  {
    slug: "capture",
    term: "Capture",
    short: "The step that turns an authorization into an actual charge to be settled.",
    definition:
      "Capture tells the processor to collect the funds that authorization put on hold. Many businesses authorize at checkout and capture at fulfilment (shipping the goods). Uncaptured authorizations expire after a few days and release the hold.",
    related: ["authorization", "settlement", "void"],
  },
  {
    slug: "void",
    term: "Void",
    short: "Cancelling an authorized transaction before it's captured or settled.",
    definition:
      "A void cancels a transaction that has been authorized but not yet captured or settled, releasing the hold on the customer's funds. Because no money has moved, a void is cleaner and faster than a refund, which reverses a completed charge.",
    related: ["authorization", "capture", "refund"],
  },
  {
    slug: "refund",
    term: "Refund",
    short: "Returning funds to a customer for a transaction that has already settled.",
    definition:
      "A refund reverses a completed, settled payment and returns the money to the customer's card. Unlike a chargeback it's merchant-initiated and doesn't count against your dispute ratio, though some processors don't return the original transaction fee.",
    related: ["chargeback", "void", "settlement"],
  },
  {
    slug: "settlement",
    term: "Settlement",
    aka: ["Clearing"],
    short: "The batch process that moves captured funds from the issuer to the merchant's account.",
    definition:
      "Settlement is where money actually changes hands: captured transactions are batched (usually daily) and the funds flow from issuing banks through the networks to the acquiring bank. The time from settlement to money in your account is the payout time.",
    related: ["batch", "payout-time", "capture"],
  },
  {
    slug: "batch",
    term: "Batch",
    aka: ["Batching"],
    short: "A group of captured transactions submitted together for settlement, usually daily.",
    definition:
      "Batching is submitting a day's captured transactions to the processor in one bundle for settlement. Most terminals and gateways batch automatically at a set time; batching late can delay your payout by a day.",
    related: ["settlement", "payout-time", "capture"],
  },
  {
    slug: "payout-time",
    term: "Payout time",
    aka: ["Settlement time", "Funding time"],
    short: "How long after a sale the money actually lands in your bank account.",
    definition:
      "Payout time is the delay between a settled transaction and funds arriving in your bank — commonly next-day or two business days (T+2), with some processors offering instant or same-day payout for a fee. Faster payouts help cash flow but can carry a premium.",
    related: ["settlement", "batch", "rolling-reserve"],
    relatedFacets: ["ach"],
  },
  {
    slug: "ach",
    term: "ACH",
    aka: ["Automated Clearing House", "Bank transfer"],
    short: "A US network for low-cost bank-to-bank transfers, cheaper than cards for large payments.",
    definition:
      "ACH (Automated Clearing House) moves money directly between US bank accounts in batches. Because fees are usually a small flat amount rather than a percentage, ACH is far cheaper than cards for high-value or recurring payments, at the cost of slower settlement (a few business days).",
    related: ["sepa", "payout-time", "recurring-billing"],
    relatedFacets: ["ach"],
  },
  {
    slug: "sepa",
    term: "SEPA",
    aka: ["Single Euro Payments Area"],
    short: "The euro-area scheme for low-cost bank transfers and direct debits.",
    definition:
      "SEPA lets businesses and consumers make euro bank transfers and direct debits across participating European countries as easily as domestic ones. Like ACH in the US, SEPA Direct Debit is a cheap way to collect recurring euro payments.",
    related: ["ach", "recurring-billing", "multi-currency"],
    relatedFacets: ["multi-currency"],
  },
  {
    slug: "chargeback",
    term: "Chargeback",
    short: "A forced reversal of a card payment initiated by the customer's bank after a dispute.",
    definition:
      "A chargeback happens when a cardholder disputes a charge with their issuing bank, which reverses the payment and usually adds a fee. Unlike a refund, it's outside the merchant's control and counts against your chargeback ratio. Too many can jeopardise your merchant account.",
    related: ["dispute", "chargeback-ratio", "rolling-reserve", "3d-secure"],
  },
  {
    slug: "chargeback-ratio",
    term: "Chargeback ratio",
    short: "Chargebacks as a share of transactions — a key risk metric for processors.",
    definition:
      "The chargeback ratio is your number of chargebacks divided by transactions (by count or volume) in a period. Card-network monitoring programs typically flag merchants above roughly 0.9–1%, which can bring fines, reserves, or account termination. Keeping it low is central to staying in good standing.",
    related: ["chargeback", "dispute", "high-risk-merchant"],
  },
  {
    slug: "dispute",
    term: "Dispute",
    short: "A customer's formal challenge to a charge, which may escalate into a chargeback.",
    definition:
      "A dispute is the process a cardholder starts when they don't recognise or disagree with a charge. The merchant can respond with evidence (representment); if unresolved it becomes a chargeback. Clear billing descriptors and responsive support prevent many disputes.",
    related: ["chargeback", "chargeback-ratio", "refund"],
  },
  {
    slug: "rolling-reserve",
    term: "Rolling reserve",
    short: "A portion of your sales held back for months to cover potential chargebacks.",
    definition:
      "A rolling reserve is a risk buffer: the processor withholds a percentage of each transaction (often 5–10%) for a set period, then releases it on a rolling basis. It protects the processor against future chargebacks but ties up cash — which is why some merchants seek processors with no rolling reserve.",
    related: ["chargeback", "high-risk-merchant", "underwriting"],
    relatedFacets: ["no-rolling-reserve"],
  },
  {
    slug: "high-risk-merchant",
    term: "High-risk merchant",
    short: "A business in an industry with elevated chargeback, fraud, or regulatory risk.",
    definition:
      "A high-risk merchant operates in a category banks consider riskier — such as subscriptions with free trials, travel, CBD, adult, or firearms — because of higher chargeback rates or regulation. These merchants face stricter underwriting, higher fees, and often rolling reserves, and need processors that specifically support their vertical.",
    related: ["underwriting", "rolling-reserve", "chargeback-ratio", "kyc"],
    relatedFacets: ["no-rolling-reserve"],
  },
  {
    slug: "underwriting",
    term: "Underwriting",
    short: "The risk review a processor runs before approving a merchant to accept payments.",
    definition:
      "Underwriting is the assessment a processor or acquiring bank performs before (and during) a merchant relationship, weighing business type, processing history, credit, and expected volume. It determines approval, pricing, and any reserve. Aggregators automate light underwriting for fast onboarding; traditional accounts underwrite more thoroughly.",
    related: ["merchant-account", "high-risk-merchant", "kyc"],
  },
  {
    slug: "kyc",
    term: "KYC",
    aka: ["Know Your Customer"],
    short: "Identity checks a processor must run to comply with anti-money-laundering rules.",
    definition:
      "KYC (Know Your Customer) is the identity-verification a payment provider is legally required to perform on the businesses it onboards, as part of anti-money-laundering (AML) compliance. Expect to supply business registration, ownership, and bank details before you can accept live payments.",
    related: ["underwriting", "merchant-account", "high-risk-merchant"],
  },
  {
    slug: "pci-dss",
    term: "PCI DSS",
    aka: ["PCI compliance", "Payment Card Industry Data Security Standard"],
    short: "The security standard every business handling card data must follow.",
    definition:
      "PCI DSS is the card industry's security standard for storing, processing, and transmitting cardholder data. Compliance requirements scale with volume (Levels 1–4). Using a hosted checkout or tokenization shifts most of the burden to your processor and shrinks your compliance scope.",
    related: ["tokenization", "hosted-checkout", "3d-secure"],
  },
  {
    slug: "tokenization",
    term: "Tokenization",
    short: "Replacing card numbers with a meaningless token so you never store real card data.",
    definition:
      "Tokenization swaps a card's real number (PAN) for a randomised token that stands in for it in your systems. Because the token is useless if stolen, it reduces PCI scope and enables safe repeat billing without holding card data yourself.",
    related: ["pci-dss", "recurring-billing", "payment-gateway"],
  },
  {
    slug: "3d-secure",
    term: "3D Secure",
    aka: ["3DS", "Verified by Visa", "SCA"],
    short: "An extra authentication step that verifies the shopper and can shift fraud liability.",
    definition:
      "3D Secure adds a verification step — a bank prompt, biometric, or one-time code — to confirm the shopper is the genuine cardholder. It underpins Strong Customer Authentication (SCA) in Europe and can shift liability for fraudulent chargebacks from the merchant to the issuer.",
    related: ["avs", "cvv", "chargeback", "pci-dss"],
  },
  {
    slug: "avs",
    term: "AVS",
    aka: ["Address Verification Service"],
    short: "A fraud check that matches the billing address entered against the card issuer's records.",
    definition:
      "AVS (Address Verification Service) compares the numeric parts of the billing address a customer enters with what the issuing bank has on file. A mismatch is a fraud signal you can use to flag or decline card-not-present transactions. It's commonly paired with a CVV check.",
    related: ["cvv", "3d-secure", "card-not-present"],
  },
  {
    slug: "cvv",
    term: "CVV",
    aka: ["CVC", "Card security code"],
    short: "The 3–4 digit code that proves the shopper physically has the card.",
    definition:
      "The CVV (Card Verification Value) is the short security code printed on a card. Requesting it for card-not-present sales helps prove the buyer holds the physical card; card networks prohibit storing it after authorization.",
    related: ["avs", "card-not-present", "3d-secure"],
  },
  {
    slug: "emv",
    term: "EMV",
    aka: ["Chip card"],
    short: "The global chip-card standard that reduces counterfeit fraud for in-person payments.",
    definition:
      "EMV (named for Europay, Mastercard, and Visa) is the standard behind chip cards, which generate a unique code per transaction to prevent cloning. Since the EMV 'liability shift', whichever party (merchant or issuer) is least chip-capable bears fraud losses on in-person transactions.",
    related: ["nfc", "card-present", "tap-to-pay"],
  },
  {
    slug: "nfc",
    term: "NFC",
    aka: ["Contactless", "Near-field communication"],
    short: "The short-range wireless tech behind tap-to-pay cards and mobile wallets.",
    definition:
      "NFC (near-field communication) lets a card or phone communicate with a terminal by tapping, powering contactless payments and digital wallets like Apple Pay and Google Pay. It's fast, and combined with tokenization it's more secure than a swipe.",
    related: ["tap-to-pay", "digital-wallet", "emv"],
    relatedFacets: ["tap-to-pay", "apple-pay", "google-pay"],
  },
  {
    slug: "tap-to-pay",
    term: "Tap to Pay",
    short: "Accepting contactless payments directly on a phone, with no separate card reader.",
    definition:
      "Tap to Pay uses a compatible phone's built-in NFC to read contactless cards and wallets, turning the device itself into a terminal. It removes the need to buy hardware, which makes it popular with mobile sellers and pop-ups.",
    related: ["nfc", "digital-wallet", "card-present"],
    relatedFacets: ["tap-to-pay", "apple-pay", "google-pay"],
  },
  {
    slug: "digital-wallet",
    term: "Digital wallet",
    aka: ["Mobile wallet"],
    short: "A stored-card app like Apple Pay or Google Pay that speeds up secure checkout.",
    definition:
      "A digital wallet stores a customer's cards on their device and pays with a tokenised, biometric-approved tap or click — for example Apple Pay, Google Pay, or PayPal. Wallets cut checkout friction and reduce fraud because the real card number is never shared.",
    related: ["nfc", "tap-to-pay", "tokenization"],
    relatedFacets: ["apple-pay", "google-pay"],
  },
  {
    slug: "bnpl",
    term: "Buy now, pay later",
    aka: ["BNPL"],
    short: "Letting customers split a purchase into instalments while the merchant is paid up front.",
    definition:
      "Buy now, pay later (BNPL) lets shoppers pay in instalments while the provider pays the merchant the full amount immediately and takes on repayment risk. It can raise average order value and conversion, in exchange for a fee usually higher than a standard card transaction.",
    related: ["digital-wallet", "recurring-billing"],
    relatedFacets: ["bnpl"],
  },
  {
    slug: "card-present",
    term: "Card-present",
    aka: ["CP"],
    short: "An in-person transaction where the physical card is dipped, tapped, or swiped.",
    definition:
      "A card-present transaction is one where the card is physically read at a terminal — chip, tap, or swipe. Because it carries less fraud risk than online payments, card-present interchange rates are typically lower than card-not-present.",
    related: ["card-not-present", "emv", "tap-to-pay"],
  },
  {
    slug: "card-not-present",
    term: "Card-not-present",
    aka: ["CNP"],
    short: "A remote transaction — online, phone, or mail — where the card isn't physically read.",
    definition:
      "A card-not-present (CNP) transaction is any payment where the card isn't physically present: e-commerce, phone (MOTO), and mail orders. CNP carries higher fraud risk and higher interchange, so fraud tools like AVS, CVV, and 3D Secure matter most here.",
    related: ["card-present", "moto", "avs", "cvv"],
    relatedFacets: ["with-virtual-terminal"],
  },
  {
    slug: "moto",
    term: "MOTO",
    aka: ["Mail order / telephone order"],
    short: "Taking card payments by phone or mail, keyed into a virtual terminal.",
    definition:
      "MOTO (mail order / telephone order) covers payments a business keys in manually after taking card details by phone or mail. It's a card-not-present method usually run through a virtual terminal, and keyed-in rates are higher than card-present ones.",
    related: ["card-not-present", "virtual-terminal"],
    relatedFacets: ["with-virtual-terminal"],
  },
  {
    slug: "virtual-terminal",
    term: "Virtual terminal",
    short: "A web page in your dashboard for keying in card payments without hardware.",
    definition:
      "A virtual terminal is a secure form in your payment dashboard where staff manually enter a customer's card details to take a payment. It's the standard tool for phone and mail (MOTO) orders and for businesses that don't have a physical card reader.",
    related: ["moto", "card-not-present", "payment-link"],
    relatedFacets: ["with-virtual-terminal", "with-payment-links"],
  },
  {
    slug: "payment-link",
    term: "Payment link",
    short: "A shareable link that lets a customer pay on a hosted page — no website required.",
    definition:
      "A payment link is a URL you create for a set or custom amount and send by email, text, or social; the customer pays on the processor's hosted page. It's the fastest way to get paid without building a checkout, popular with freelancers and service businesses.",
    related: ["hosted-checkout", "virtual-terminal", "recurring-billing"],
    relatedFacets: ["with-payment-links", "with-invoicing"],
  },
  {
    slug: "hosted-checkout",
    term: "Hosted checkout",
    short: "A prebuilt payment page hosted by the processor, reducing your PCI burden.",
    definition:
      "Hosted checkout redirects customers to a payment page hosted and secured by the processor, so card data never touches your servers. It's quick to implement and shrinks your PCI scope, at the cost of some control over the checkout experience.",
    related: ["payment-gateway", "pci-dss", "payment-link"],
    relatedFacets: ["for-shopify", "for-woocommerce"],
  },
  {
    slug: "recurring-billing",
    term: "Recurring billing",
    aka: ["Subscription billing"],
    short: "Automatically charging a saved payment method on a repeating schedule.",
    definition:
      "Recurring billing charges a customer's stored (tokenized) card or bank account on a set schedule — weekly, monthly, or annually — without re-entering details. It's the backbone of subscriptions and needs dunning logic to recover failed payments.",
    related: ["tokenization", "dunning", "ach"],
    relatedFacets: ["with-invoicing"],
  },
  {
    slug: "dunning",
    term: "Dunning",
    aka: ["Failed-payment recovery"],
    short: "Automated retries and reminders that recover failed recurring payments.",
    definition:
      "Dunning is the process of recovering revenue when a recurring payment fails — through smart retries, card-updater services, and customer emails prompting an update. Good dunning meaningfully reduces involuntary churn for subscription businesses.",
    related: ["recurring-billing", "tokenization"],
  },
  {
    slug: "multi-currency",
    term: "Multi-currency",
    short: "Accepting payment in customers' currencies and settling in yours.",
    definition:
      "Multi-currency processing lets you present prices and take payment in several currencies, then settle to your account — sometimes in the original currency, sometimes converted at an FX margin. Local-currency pricing improves international conversion; watch the conversion spread each processor charges.",
    related: ["sepa", "settlement", "payout-time"],
    relatedFacets: ["multi-currency", "crypto"],
  },
];

/** All glossary slugs, for `generateStaticParams` + the sitemap. */
export const GLOSSARY_SLUGS: string[] = GLOSSARY_TERMS.map((t) => t.slug);

const TERM_BY_SLUG = new Map(GLOSSARY_TERMS.map((t) => [t.slug, t]));

/** Look up a glossary term by slug (undefined if not found). */
export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return TERM_BY_SLUG.get(slug);
}

/** Terms grouped by uppercase first letter, each group alphabetised — for the hub A–Z list. */
export function glossaryByLetter(): { letter: string; terms: GlossaryTerm[] }[] {
  const groups = new Map<string, GlossaryTerm[]>();
  for (const t of GLOSSARY_TERMS) {
    const letter = t.term.charAt(0).toUpperCase();
    const bucket = groups.get(letter) ?? [];
    bucket.push(t);
    groups.set(letter, bucket);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, terms]) => ({
      letter,
      terms: terms.slice().sort((a, b) => a.term.localeCompare(b.term)),
    }));
}
