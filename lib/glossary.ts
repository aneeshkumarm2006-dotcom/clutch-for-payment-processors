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
  /**
   * "How it works" — 2–3 paragraphs on the mechanics and what they cost or
   * change for a merchant.
   *
   * Added because a term page carrying only `short` + `definition` is ~80 words,
   * and Semrush flagged all 30 crawled term pages "low word count". Thin pages
   * also lose to the competitor with the same definition plus context, and give
   * an answer engine nothing quotable beyond a dictionary line. Each entry aims
   * for 350+ words of genuinely useful copy, not padding.
   */
  detail?: string[];
  /** A worked example, with real numbers wherever the term is a fee or a rate. */
  example?: string;
  /**
   * Q&A pairs. Rendered as an FAQ section AND emitted as FAQPage JSON-LD, which
   * is the format both rich results and answer engines lift most readily.
   */
  faqs?: { question: string; answer: string }[];
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
    detail: [
      "Card sales all run the same loop, whatever the shop front looks like. Your terminal or checkout page hands the card details to the processor. It formats them for the card network and sends an authorization request to the issuing bank, which checks funds and fraud rules and answers in about a second or two. Approval or decline code, straight back down the same wire. Then, at the end of the day, the processor submits that batch of captured sales so the acquiring bank can settle them.",
      "Plenty of the companies selling you card processing are not processors at all. They are resellers, independent sales organisations or payment facilitators sitting on top of a larger platform, and that is not automatically bad. It does mean the name on your contract, the name on your statement and the business actually holding your money can all be different companies. So ask which bank sponsors the account. Ask who picks up the phone when a payout is held, and read the contract for the clause that lets pricing change on written notice.",
      "The processor is the party you sign with, so it sets your pricing model and how fast you are paid. What it cannot touch is interchange or the network assessment; no processor discounts those. Competing offers therefore differ only in the markup and in the monthly and per-transaction fees stacked around it, not in the headline rate you are being sold. That same signature also hands over the risk decisions that can hold your funds, and those will matter more to you than a few basis points ever will.",
    ],
    example: "Say a customer pays $100 on a rewards credit card. The processor authorizes it in about two seconds, batches it that night, and deposits $96.80 two business days later on a 2.9% + $0.30 flat rate. Only a slice of that $3.20 stays with the processor. Most of it is interchange, passed straight to the issuing bank, about $0.14 is the network assessment, and what is left over is the markup you were actually shopping for.",
    faqs: [
      {
        question: "How much does a payment processor cost?",
        answer: "Most small US businesses land somewhere between about 2% and 3.5% of card volume once every line on the statement is counted. The headline per-transaction rate is only one of those lines. Monthly account fees, gateway fees, PCI fees, statement fees and chargeback fees all land in the same total. Divide a full month of fees by that month's card volume and you have the number that actually matters.",
      },
      {
        question: "Can I switch payment processors without changing my business bank account?",
        answer: "Almost always, yes. A processor deposits into whatever business bank account you nominate, so the bank side stays put. The work is on the exit. Check for an early termination fee and a terminal lease on its own contract, then sort out how stored card details for recurring customers will move. Most established providers will run a compliant transfer of stored cards on request, but it has to be arranged in advance.",
      },
      {
        question: "What is the difference between a payment processor and a payment service provider?",
        answer: "A payment service provider bundles the processor, gateway and merchant account into one account you can open in minutes. A traditional processor puts you through full underwriting and gives you your own merchant account at the end of it. PSPs, also called aggregators, place you under a shared master account. That is why approval is fast, and it is also why holds and account closures can arrive without much warning.",
      },
    ],
    related: ["payment-gateway", "merchant-account", "acquiring-bank", "issuing-bank"],
  },
  {
    slug: "payment-gateway",
    term: "Payment gateway",
    short: "The software layer that securely passes card data from checkout to the processor.",
    definition:
      "A payment gateway is the technology that captures card details at checkout and transmits them securely to the payment processor for authorization. Online, the gateway does what a card terminal does in a shop. Some providers bundle the gateway with processing; others charge a separate gateway fee.",
    detail: [
      "At checkout the gateway collects the card in a field or iframe it controls, encrypts it, and swaps the number for a token before anything reaches your server. It then translates the request into whatever format your processor expects and sends it for authorization. The approval comes back the same way, along with the AVS, CVV and 3D Secure results. Your capture request rides those rails too. The money itself does not move until settlement.",
      "The fee that hides here is the per-authorization charge. Some gateways bill a few cents on every attempt, declines and $0 card verifications included, so a business with a high decline rate is paying for traffic it never converts. Compare the authorization or transaction count on your statement with your own count of approved sales. A wide gap means you are buying failures, and cleaning up the retries cuts the bill.",
      "Your choice of gateway also sets your PCI scope. A hosted page or an iframe field keeps card data off your servers and puts you in the lightest self-assessment questionnaire, SAQ A. A gateway that posts card data through your own page pulls you into a heavier one, with quarterly scanning and more evidence to produce. The same decision shapes your checkout conversion and whether your stored cards can move with you when you leave. Settle it before you build.",
    ],
    example: "A shop doing 1,200 card sales a month on $60,000 of volume pays a standalone gateway $25 a month plus $0.10 per transaction. Call it $145, or about 0.24% of volume, sitting on top of whatever the processing itself costs. Now add 200 declined attempts that get billed at $0.10 as well. The total is $165 and the gateway is quietly costing roughly 0.28%.",
    faqs: [
      {
        question: "Is a payment gateway the same as a payment processor?",
        answer: "They are different layers, though most merchants buy them as one product. The gateway is the software that captures card data at checkout and passes it on. The processor is the company that moves the money between the issuing and acquiring banks. Buy them separately and you sign two agreements and pay two sets of fees, which is why the number to compare is the combined cost, not the processing rate.",
      },
      {
        question: "Do I need a payment gateway if I sell on Shopify or WooCommerce?",
        answer: "You already have one, you just did not buy it separately. Shopify includes a gateway with Shopify Payments, and WooCommerce runs whichever gateway plugin your provider supplies, so the real question is which processor sits behind the checkout. Watch the Shopify part: it adds an extra transaction fee when you use a processor other than Shopify Payments, and that fee can outweigh a lower headline rate.",
      },
      {
        question: "How much does a payment gateway cost?",
        answer: "Roughly $10 to $30 a month plus a few cents per transaction, if you buy the gateway on its own. Bundled into a processing rate it costs nothing separately, because it is already in the rate. Some older contracts also carry a setup fee. To see what yours really costs, add the monthly and per-transaction parts together and divide by your monthly volume.",
      },
    ],
    related: ["payment-processor", "hosted-checkout", "tokenization", "virtual-terminal", "gateway-fee"],
    relatedFacets: ["for-shopify", "for-woocommerce"],
  },
  {
    slug: "merchant-account",
    term: "Merchant account",
    short: "A bank account type that lets a business accept and hold card payments.",
    definition:
      "A merchant account is a specialised bank account that holds funds from card sales before they're paid out to your regular business account. Traditional processors set one up per merchant after underwriting; aggregators like Stripe and PayPal place you under one shared account instead, which speeds up onboarding.",
    detail: [
      "The thing nobody warns you about is that a merchant account keeps charging when you stop selling. Monthly account fees, statement fees, PCI fees and minimum fees attach to the account rather than to your sales, so a seasonal business, or one that has simply paused, can run up charges on zero volume. Closing it has to be done in writing with the provider. Cancelling the direct debit or letting the deposit account go dormant ends nothing, and it certainly does not end an equipment lease attached to it.",
      "The account itself sits at an acquiring bank and carries a merchant ID, the number that tags every transaction you send. Settled funds land there first. Fees and any reserve come out, and what is left is swept to your ordinary business bank account on your payout schedule. You cannot spend from it directly. Larger businesses often run several merchant IDs, one per location or sales channel, which keeps risk and reporting separate.",
      "Dedicated account or aggregator is a trade between speed and stability. A dedicated account costs you days of underwriting and paperwork, and buys you negotiable pricing plus a much lower chance that a volume spike or one unusually large sale trips a freeze. An aggregator has you live the same afternoon at a published rate. There the risk rules are applied automatically and the reviews arrive without warning, which is what instant onboarding actually costs.",
    ],
    example: "Take March: $40,000 across 900 sales on interchange-plus pricing, at interchange + 0.30% + $0.10. Interchange and assessments on a mixed card-present basket come to roughly $730. The markup adds $210 on top of that, and at month end a $25 monthly fee and a $20 PCI fee come out of the same balance. About $39,015 reaches the business bank account, which works out at an effective rate of about 2.5%.",
    faqs: [
      {
        question: "Do I need a merchant account to accept credit cards?",
        answer: "You need one, but you do not have to be the one who opens it. Aggregators such as Stripe, Square and PayPal put your business under their own master merchant account, which is why you can take payments the day you sign up. Your own dedicated account, in your own business name, becomes worth the paperwork once volume is steady or your industry is treated as high risk.",
      },
      {
        question: "How long does it take to get a merchant account?",
        answer: "A few business days for a dedicated account, once your documents are in, and longer if the business is high risk or has no processing history. Underwriters usually want business registration, identification for the owners, a bank account for deposits and recent processing statements. An aggregator account is normally approved in minutes, with the checks continuing quietly in the background afterwards.",
      },
      {
        question: "Why would a merchant account be frozen or closed?",
        answer: "Freezes happen when your activity stops matching what was underwritten. The usual triggers are a sudden jump in volume, an unusually large single sale, a rising chargeback ratio, selling products outside the category you were approved for, or a mismatch between your business details and the deposit account. Tell your provider before a big campaign or a new product line and most holds never happen.",
      },
    ],
    related: ["acquiring-bank", "underwriting", "payout-time", "monthly-minimum", "payment-processor"],
  },
  {
    slug: "acquiring-bank",
    term: "Acquiring bank",
    aka: ["Acquirer"],
    short: "The bank that holds the merchant's account and receives card payments on their behalf.",
    definition:
      "The acquiring bank (or acquirer) is the financial institution that maintains the merchant account and collects card payments for the business. It settles funds from the card networks and deposits them, minus fees, to the merchant. It sits opposite the issuing bank in every transaction.",
    detail: [
      "Your acquirer carries the loss if you take money and fail to deliver. That one fact explains most of what it does to you. It, and not your processor's sales team, decides whether you are approved, what reserve you sit behind and how much volume you can run. Same business, two providers, two different answers. That is risk appetite, not paperwork. It is also why a chargeback spike arrives as a rolling reserve or a held payout rather than as a conversation about your account.",
      "Only a licensed member of the card networks can plug a business into them, and the acquiring bank is that member. It sponsors your merchant ID and stands behind your transactions to Visa and Mastercard. Each day it takes in the settled funds and deducts interchange, assessments and its own fees before the balance reaches you. Processors that are not banks partner with an acquirer for this part and resell the relationship to you.",
      "Most merchants never learn who their acquirer is until a payout stops. The name usually sits in the merchant agreement, in the clause naming the sponsoring or member bank, and some statements carry it as a separate bank line. Find it while nothing is wrong. And if you are on an aggregator, that relationship belongs to the aggregator rather than to you, so there is no independent line to the bank when funds are held.",
    ],
    example: "Follow $75 through a card tap at your bakery. The issuer approves it and holds $75 against the customer's account. That night your terminal batches the sale, and the card network moves the money from the issuer to your acquiring bank, less interchange and assessments. The acquirer credits your merchant account, takes the markup you agreed with your processor, and pays the rest into your business bank account a day or two later.",
    faqs: [
      {
        question: "Is my acquiring bank the same as my business bank?",
        answer: "Almost never the same institution, though plenty of banks sell you both and make it look like one product. Your business bank holds the account you spend from. The acquiring bank holds the merchant account that card sales settle into before the money is paid across to you. Two agreements, separate terms, separate fees, and a separate support line to call when something goes wrong.",
      },
      {
        question: "How do I find out who my acquiring bank is?",
        answer: "Start with the merchant agreement. The sponsoring or member bank is normally named near the signature page, and your monthly statement often carries the same name in the header or the footer. If neither is clear, ask your provider in writing. Do this while nothing is wrong: you want the name and its contact details in hand before you ever need to escalate a held payout or a closed account.",
      },
      {
        question: "Does the acquiring bank decide whether a transaction is approved?",
        answer: "That decision belongs to the issuing bank. The acquirer's job starts after the approval: it collects the settled funds and pays them into your merchant account. Its decisions are about you as a business rather than about any single sale, which is why a rejected application, a reserve or an account closure comes from the acquirer, while a declined card comes from the customer's issuer.",
      },
    ],
    related: ["issuing-bank", "merchant-account", "settlement", "payment-processor"],
  },
  {
    slug: "issuing-bank",
    term: "Issuing bank",
    aka: ["Issuer"],
    short: "The customer's bank that issued their card and approves or declines the payment.",
    definition:
      "The issuing bank is the institution that issued the customer's credit or debit card. During a transaction it decides whether to authorize the payment based on available funds and fraud checks, and it ultimately bears the cost of interchange. Chargebacks are filed through the issuer.",
    detail: [
      "You never sign anything with an issuer, and yet the issuer sets two of your biggest numbers: what a sale costs you and how often a sale fails. Interchange is paid to them, so the same basket on a premium rewards card or a corporate card costs you more than it does on a standard debit card. Their fraud models produce the false declines too. The fix for those is richer data on each request, not blind retries of a card that has already been refused.",
      "The authorization itself takes under two seconds. In that time the issuer asks whether the card is live, whether there is credit or balance available, whether the address and security code match, and whether the pattern looks like fraud. Then it answers, with an approval or a numbered decline code. An approval puts a hold on the funds, and the settled amount lands on the cardholder's statement a day or two later.",
      "The part that catches merchants out is who judges a chargeback. Your processor only forwards the evidence. The issuing bank decides the first round, and it has already heard the cardholder's version before it ever sees yours. Prevention is worth more than paperwork here: a billing descriptor customers recognise, a refund policy they can find, and support that answers quickly will stop more losses than a well argued representment recovers after the fact.",
    ],
    example: "Roughly $4.30 of a $200 furniture sale goes to the customer's bank when she pays on a premium rewards credit card. Her issuer approves in about a second and holds $200 against her credit line. Interchange on a card like that commonly runs a little over 2% plus a fixed few cents, which is where the $4.30 comes from. Put the same sale on a regulated debit card and it costs you well under a dollar.",
    faqs: [
      {
        question: "What is the difference between an issuing bank and an acquiring bank?",
        answer: "The issuing bank is the customer's side of the transaction and the acquiring bank is yours. The issuer gave the cardholder their card, approves or declines each payment, and receives the interchange fee. The acquirer holds your merchant account, takes in the settled funds and pays you. Every card transaction has one of each, passing messages to one another through the card network.",
      },
      {
        question: "Can I contact a customer's issuing bank about a chargeback?",
        answer: "There is no channel for it. Issuers do not take evidence directly from merchants, so your representment goes to your processor or acquirer and is passed up through the card network. The customer, though, you can contact. A dispute the cardholder withdraws is far easier to stop than one you have to fight on paper.",
      },
      {
        question: "Why does an issuing bank decline a card that has money on it?",
        answer: "Most of those declines are fraud rules, not empty accounts. Issuers score every request on location, merchant category, amount and how the card has been used lately, so a card-not-present sale that looks out of character is refused whatever the balance says. Send the full billing address, the security code and a 3D Secure result with the request and you will see fewer of them.",
      },
    ],
    related: ["acquiring-bank", "interchange", "chargeback"],
  },
  {
    slug: "interchange",
    term: "Interchange",
    aka: ["Interchange fee"],
    short: "The fee set by the card networks and paid to the customer's issuing bank on every card sale.",
    definition:
      "Interchange is the largest component of card processing cost: a fee set by Visa, Mastercard, and other networks that goes to the cardholder's issuing bank. Rates vary by card type (rewards cards cost more), channel, and merchant category. No processor can discount interchange itself; they only mark it up.",
    detail: [
      "What moves your interchange bill is the mix of cards your customers hand over, not how hard you negotiate. Regulated debit from the largest US banks is capped by law, and it is the cheapest card you can take. Premium rewards and commercial cards sit at the top, because interchange is what funds the points and cashback the cardholder earns. You rarely see it broken out. Unless you are on interchange-plus pricing, interchange sits inside whatever rate you were quoted.",
      "The same card can cost you two different amounts depending on how the sale is handled. A transaction that qualifies for a cheaper category drops into a costlier one. That is a downgrade. Settle your batch late and you get one. So will keying a card without an address check, or leaving out the extra data a commercial card expects. On a flat-rate plan you never see it, because the provider has priced the average in. On interchange-plus it shows up as sales landing in a more expensive interchange line.",
      "Underneath all of it are the interchange tables Visa and Mastercard publish, which run to hundreds of categories and get revised roughly twice a year, typically in April and October. Each sale is matched to one category based on the card product, how it was accepted, your merchant category code, and the data your processor sends with the transaction. The issuing bank keeps that amount out of the settled funds. Your processor bills it on to you and cannot discount a cent of it.",
    ],
    example: "Two $200 sales, $1.30 apart in wholesale cost. The first is a basic consumer credit card, chip-read in store, carrying interchange in the region of 1.65% + $0.10, so about $3.40. The second is a premium rewards card keyed into an online checkout, nearer 2.30% + $0.10, so about $4.70. Your processor's markup is identical on both, and that $1.30 gap would be much the same at any processor you signed with.",
    faqs: [
      {
        question: "Why do rewards credit cards cost more to accept?",
        answer: "The points, miles, or cashback have to be paid for, and interchange is where the issuing bank finds the money. Premium consumer and commercial cards therefore sit in the most expensive interchange categories, meaningfully above a basic consumer credit card on the same sale. You cannot decline them selectively. A customer base that carries premium cards simply raises your average cost.",
      },
      {
        question: "How often do interchange rates change?",
        answer: "About twice a year, normally in April and October, when Visa and Mastercard revise their published interchange tables. Changes tend to be category-specific rather than across the board, but they can move your cost without your processor touching your contract. If you are on interchange-plus, expect your effective rate to drift a little after each update. Your markup stays where it is.",
      },
      {
        question: "What is an interchange downgrade?",
        answer: "A transaction settles into a more expensive interchange category than it qualified for at the point of sale. Common causes are settling a batch more than a day after authorization, keying a card without address verification, and missing purchase data on a commercial card. Batching on schedule is one of the easier fixes. It costs you nothing to change.",
      },
    ],
    related: ["interchange-plus", "assessment-fee", "effective-rate", "issuing-bank", "surcharge"],
    relatedFacets: ["interchange-plus"],
  },
  {
    slug: "interchange-plus",
    term: "Interchange-plus",
    aka: ["Interchange++", "Cost-plus pricing"],
    short: "A transparent pricing model: true interchange cost plus a fixed processor markup.",
    definition:
      "Interchange-plus pricing itemises your cost as the network's interchange fee plus a fixed markup (for example, interchange + 0.30% + $0.10). Because the two parts are separated, it's the most transparent model and usually the cheapest once you have steady volume. Compare it with flat-rate and tiered pricing.",
    detail: [
      "Two contract shapes get sold as interchange-plus without behaving like it. Bill-back plans charge a low base rate when the sale happens, then add the real interchange difference on a later statement, so no single month can be read on its own. Others quote a markup over interchange but leave assessments and network fees outside the quote. Neither is the real thing. Check that the interchange lines on your statement match the tables Visa and Mastercard publish on their own sites.",
      "On a genuine interchange-plus statement the two halves are printed separately. The pass-through half lists interchange by category and the network assessment fees, and it should carry no processor margin. The markup half is the deal you agreed, a percentage of volume plus a fixed amount per transaction, applied to every sale alike. Only the pass-through half moves, which is why two months with identical volume but a different card mix produce different totals while your markup stays put.",
      "The markup is the only part you are negotiating, and that makes competing quotes directly comparable. On the same volume, 0.20% + $0.10 beats 0.40% + $0.10 every time. Weigh the two halves of the markup against your average ticket, because the per-item fee dominates on small sales. Ask for the monthly charges in the same breath: interchange-plus plans more often carry separate gateway, PCI, and statement fees that flat-rate providers fold into their rate.",
    ],
    example: "You process $40,000 across 800 sales, an average ticket of $50. Interchange and assessments come to $760, which is 1.90% of volume, and none of that is negotiable. Your markup of 0.25% + $0.10 adds $100 on volume plus $80 on transactions, so $180. Fees total $940, an effective rate of 2.35%. That same month on a 2.9% + $0.30 flat rate would have cost $1,400.",
    faqs: [
      {
        question: "Is interchange-plus always cheaper than flat-rate pricing?",
        answer: "Not always. Above roughly $10,000 a month in card volume it usually wins, though the crossover depends on your average ticket and card mix. Below that, the monthly account, gateway, and PCI fees attached to these plans can outweigh the saving on the rate. Work out your effective rate under both quotes using last month's real volume and transaction count before you switch.",
      },
      {
        question: "What is a good interchange-plus markup?",
        answer: "0.15% to 0.50% plus around $0.05 to $0.15 per transaction is competitive for a small business with steady volume. Smaller merchants are usually quoted at the top of that range or above it. If a quote lands well above it, take the same volume and transaction count to another provider and compare the two markups side by side.",
      },
      {
        question: "Can a new business get interchange-plus pricing?",
        answer: "The best markups usually go to merchants who can show several months of processing statements, but a new business can still get the model. Without that history you will be quoted on projected volume, and the markup is often renegotiable once you have real numbers behind you. Ask at signing whether the rate is reviewed, how often, and whether a review can move it up as well as down.",
      },
    ],
    related: ["interchange", "flat-rate-pricing", "tiered-pricing", "effective-rate"],
    relatedFacets: ["interchange-plus", "flat-rate"],
  },
  {
    slug: "flat-rate-pricing",
    term: "Flat-rate pricing",
    short: "One blended percentage, plus a fixed fee, on every sale, regardless of card type.",
    definition:
      "Flat-rate pricing charges a single, predictable rate (such as 2.9% + $0.30) on every transaction, no matter the underlying interchange. It's simple and has no monthly minimums, which makes it ideal for new or low-volume businesses, but it can cost more than interchange-plus as volume grows.",
    detail: [
      "One rate per channel. The provider absorbs the difference between that rate and what each card actually costs, profiting on the cheap ones, regulated debit and basic consumer credit, losing on premium rewards, commercial, and international cards, then pooling the two across every merchant on the plan. In-person rates are lower than online rates. Manually keyed sales usually carry the highest published rate of the three.",
      "The headline rate on the homepage covers one channel. Check the published fee schedule for the channel you actually sell through, and for the charges that sit outside the rate: currency conversion on foreign cards, instant-payout fees, chargeback fees, and hardware. Aggregator accounts also underwrite you after you start selling rather than before, so an unusual spike in volume or a run of disputes can trigger a review and a hold on your funds.",
      "You are buying predictability and speed: published pricing you can read without a sales call, no interchange report to interpret, no negotiation, and fast onboarding, usually under the provider's own master merchant account. The cost of that is a rate that never improves as you grow, since the same percentage applies whether you take $2,000 a month or ten times that. The fixed per-transaction fee bites hardest on small tickets. That is where flat-rate merchants overpay most.",
    ],
    example: "At 2.9% + $0.30 online, a $12 sale costs $0.65 in fees. That is an effective rate of 5.4%. The same rate on a $250 sale costs $7.55, or 3.0%. Scale it up: $18,000 taken over 900 sales in a month costs $792, an effective rate of 4.4%. Small tickets, not the headline percentage, are what make flat-rate pricing expensive.",
    faqs: [
      {
        question: "At what volume should I switch from flat-rate to interchange-plus?",
        answer: "Somewhere above $10,000 to $15,000 a month in card volume is where most merchants start saving on interchange-plus, though the crossover depends on your average ticket and card mix. Below that, the monthly account and gateway fees on an interchange-plus plan usually cancel out the lower rate. Compare the two on your last three statements rather than on the headline numbers.",
      },
      {
        question: "Why is the online flat rate higher than the in-person rate?",
        answer: "Card-not-present sales carry higher interchange and more fraud risk than a chip or contactless payment. The card is not physically read, so the issuing bank prices in the chance the buyer is not the cardholder, and the merchant, not the issuer, usually carries the loss on a fraud chargeback. Providers pass that gap on as a higher published rate for online and keyed sales.",
      },
      {
        question: "Does flat-rate pricing include every fee?",
        answer: "No. Processing is covered, and usually the gateway and PCI compliance, but that is where it stops. Chargeback fees, instant-payout fees, currency conversion on foreign cards, and terminal hardware are billed separately by most flat-rate providers, and the original fee is often not returned when you refund a sale. Read the fee schedule, not the pricing page, and total the charges that apply to how you sell.",
      },
    ],
    related: ["interchange-plus", "tiered-pricing", "effective-rate", "monthly-minimum"],
    relatedFacets: ["flat-rate"],
  },
  {
    slug: "tiered-pricing",
    term: "Tiered pricing",
    short: "Transactions are bucketed into 'qualified', 'mid-qualified', and 'non-qualified' rates.",
    definition:
      "Tiered pricing sorts each transaction into a pricing tier (typically qualified, mid-qualified, and non-qualified), each with a different rate. It looks simple but is the least transparent model, because the processor decides which tier a card falls into and can route more sales to expensive tiers.",
    detail: [
      "There is no industry definition of 'qualified'. Each processor writes its own rules into the merchant agreement, mapping hundreds of interchange categories into three or four buckets and setting a rate for each. A basic consumer card, chip-read in store and batched on time, is normally qualified. A rewards card, a keyed card, a corporate card, or a late batch is not. The processor keeps the gap between your tier rate and the real interchange. Those buckets sit in your contract, not in any network rulebook, so categories can be shifted between them on written notice, raising your cost while every rate on your quote stays the same.",
      "The number on the quote is the qualified rate, and it can apply to a minority of your sales. A plan advertised in the high 1% range can settle well above 3% once rewards, keyed, and commercial transactions land in the upper tiers. You can check in under a minute. Look on the statement for more than one percentage charged against the same card brand, or for the words qualified, mid-qualified, non-qualified, or standard. Then divide total fees by total volume and compare the answer with the rate you were sold. If a processor will not restate the same quote as a single markup over interchange, treat that as the answer.",
    ],
    example: "The quote reads 1.79% qualified, 2.49% mid-qualified, 3.29% non-qualified, plus $0.20 per transaction. Run $30,000 across 600 sales through it, with 35% qualifying, 40% mid-qualified and 25% non-qualified, and the percentage fees come to $188, $299, and $247. Add $120 in per-item fees and the month costs $854. That is an effective rate of 2.85%, not the 1.79% you were shown.",
    faqs: [
      {
        question: "Is tiered pricing ever cheaper than interchange-plus?",
        answer: "Rarely, and only by accident. It can win for a merchant whose sales fall almost entirely into the qualified tier, such as a shop taking chip-read debit on small tickets. For everyone else the buckets are set wide enough that the processor keeps more margin than an interchange-plus markup would give it, which is the point of the model.",
      },
      {
        question: "What is a non-qualified surcharge?",
        answer: "Extra percentage, charged when a transaction lands in the processor's most expensive tier. On a tiered statement it appears as a separate line, often labelled non-qual surcharge or downgrade fee, and it sits on top of the qualified rate rather than replacing it. Read it as the difference between the rate you were advertised and the rate you are actually paying.",
      },
      {
        question: "How do I get out of a tiered pricing contract?",
        answer: "An early-termination fee may apply if you leave mid-term, so check the term length before you cancel anything. You exit in writing under the termination clause in your merchant agreement, and these contracts often run for a fixed period with automatic renewal. Equipment leases are usually a separate agreement and can outlast the processing contract, so check both before you sign anything new.",
      },
    ],
    related: ["flat-rate-pricing", "interchange-plus", "effective-rate"],
  },
  {
    slug: "effective-rate",
    term: "Effective rate",
    short: "Your true cost of processing: total fees divided by total sales volume.",
    definition:
      "The effective rate is the single most useful number for comparing processors: divide all the fees you paid in a period by your total card volume, then multiply by 100. It captures interchange, markup, monthly fees, and assessments in one figure, so it cuts through headline rates.",
    detail: [
      "$45 of monthly charges on $5,000 of volume is 0.9% before a single transaction fee is counted. That is the first thing that distorts an effective rate: leave the fixed monthly fees out and the number flatters whoever calculated it, and the smaller you are the more they matter. The second is who is doing the sums. A rep working out your current effective rate has every reason to include each fee in yours and none in theirs. Rebuild both figures from the actual debits on your bank statement.",
      "Take one full statement month and add up every charge the processor took: the percentage and per-transaction fees, monthly account and gateway fees, PCI and statement fees, batch fees, chargeback fees, and any monthly minimum shortfall. The denominator is gross card volume for the same month, before refunds are netted out. Run it for three consecutive months, because a single month is distorted by annual charges and by whatever card mix your season brings.",
      "The effective rate is the one figure that survives a change of pricing model, which is what makes it the right basis for holding a flat-rate quote against an interchange-plus one. It prices in everything a headline rate leaves out. So when a sales rep gives you a number, hand over last month's statement and ask what your effective rate would have been on that exact volume and transaction count, with their monthly fees included.",
    ],
    example: "March: $52,000 across 1,300 card sales. The statement shows $1,196 in transaction fees, a $25 monthly account fee, a $20 gateway fee, and a $99 annual PCI fee that happened to be billed that month. Fees total $1,340. Divide by $52,000, multiply by 100, and your effective rate is 2.58%. The rate on your contract says 2.30%.",
    faqs: [
      {
        question: "What is a good effective rate for a small business?",
        answer: "Roughly 2.2% to 2.8% is competitive for a typical small business taking a mix of consumer cards, and anything above 3.5% is worth investigating. Small average tickets and card-not-present sales push it up legitimately, as does a customer base on premium rewards cards. Compare yourself against businesses that sell the way you do.",
      },
      {
        question: "Why is my effective rate higher than the rate I was quoted?",
        answer: "The quoted rate covers only the percentage taken on each sale. Your effective rate includes the fixed per-transaction fee and every monthly charge on top, and on a small average ticket the per-sale fee alone can add half a percentage point or more. Monthly account, gateway, PCI, and statement fees add the rest. They hit hardest in a quiet month.",
      },
      {
        question: "Should refunds and chargebacks be included when calculating an effective rate?",
        answer: "Include the fees, exclude the reversed amounts. Use gross card volume as the denominator and count every fee you were charged, including chargeback fees and any transaction fee the processor kept on a refund. Netting refunds out of volume makes your rate look worse than it is, and it stops the figure comparing cleanly with a quote.",
      },
    ],
    related: ["interchange-plus", "flat-rate-pricing", "markup", "surcharge", "gateway-fee"],
  },
  {
    slug: "markup",
    term: "Markup",
    short: "The processor's own margin added on top of interchange and network fees.",
    definition:
      "Markup is what the processor keeps: the amount added on top of the non-negotiable interchange and assessment fees. In interchange-plus pricing the markup is stated explicitly; in tiered or flat-rate pricing it's baked in and harder to see. Lower markup means a lower effective rate.",
    detail: [
      "A gap of 0.20% between two quotes reads like a rounding error. On $600,000 of annual card volume it is $1,200 a year. That is the whole reason markup is the line to argue over: interchange costs the same whoever you sign with, assessments too, and the markup is the only part of the price a competing processor is free to move.",
      "Every card sale splits three ways. Interchange goes to the bank that issued the card, assessments go to the network, and what is left goes to your processor and to whoever resold you the account. That remainder is the markup, normally quoted as a percentage of volume plus a few cents per transaction. It does not stop there. Monthly account fees, statement fees, PCI fees and batch fees all land in the same pocket, so treat them as part of the same number.",
      "How it reaches you matters as much as how big it is. Daily discount pricing deducts it from each deposit, so your bank statement never shows the gross sale. Monthly billing takes one lump sum you can audit instead. Most agreements also let the processor reprice on written notice, and that notice is often a single line at the foot of a statement. On a tiered or flat-rate statement none of it is itemised at all, so your effective rate is the only handle you have.",
    ],
    example: "Your markup on a $50,000 month can be 0.42% of volume while the quote in your hand says 0.30%. Here is how. The processor prices at interchange plus 0.30% and $0.10 per transaction, and you run 500 sales. Volume markup is $150, transaction markup $50, so $200, and a $10 statement fee takes it to $210. Add $900 of interchange and assessments and the total cost is $1,110, an effective rate of 2.22%.",
    faqs: [
      {
        question: "What is a good markup for credit card processing?",
        answer: "Between about 0.15% and 0.50% plus $0.05 to $0.15 per transaction is where most small businesses on interchange-plus land, with the lower end reserved for higher volume. Above that, push back. Ask for the quote in writing as a stated percentage and per-item fee, and compare offers on markup alone, because interchange costs every processor you approach exactly the same.",
      },
      {
        question: "Can you negotiate your processing markup?",
        answer: "Processors set the markup themselves, so yes, they can cut it to win or keep an account, and twelve months of statements showing steady volume is the strongest thing you can put in front of them. Ask for a rate review rather than a new contract, since a rewritten agreement can reset your term and your cancellation terms. Interchange and assessments are fixed by the networks and nobody can discount them.",
      },
      {
        question: "How do I find the markup on my statement?",
        answer: "Look for a line that sits apart from interchange. On an interchange-plus statement it shows as a stated percentage and per-item fee, often labelled discount rate or processor fee. Tiered and flat-rate statements do not break it out at all. There you have to work backwards: calculate your effective rate and treat anything above a realistic wholesale cost as markup.",
      },
    ],
    related: ["interchange-plus", "effective-rate", "assessment-fee"],
  },
  {
    slug: "assessment-fee",
    term: "Assessment fee",
    short: "A small fee paid directly to the card network, such as Visa or Mastercard, on each transaction.",
    definition:
      "Assessment fees are charged by the card networks themselves, separate from interchange, which goes to the issuing bank. They're a small percentage of volume and, like interchange, can't be discounted by a processor. Together interchange and assessments form the wholesale cost of accepting cards.",
    detail: [
      "Assessments are the one line on your bill that no amount of negotiating will move. The networks do not lend the money or approve the payment. They run the rails and set the rules, and they charge for it. Their real value to you is as a floor: interchange plus assessments is wholesale, and no processor sells card acceptance below wholesale and stays in business. A headline rate at or under your likely wholesale cost is either recovering the difference somewhere else or applies to a narrow slice of your card mix.",
      "The charge arrives in two shapes: a percentage of the settled amount, around 0.13% to 0.14% on the main US networks, and a small fixed fee of roughly two cents on each authorization. Under pass-through pricing your acquirer pays the network and bills you the identical amount, while flat-rate providers absorb the same cost inside their headline rate. Small as it is, it applies to every settled dollar, including tax, shipping and tips, so it scales exactly with revenue.",
      "Foreign cards cost more. A card issued outside the United States attracts extra network charges for cross-border handling, and conversion charges on top where the currency differs, which together can add close to a percentage point to an otherwise ordinary sale. The fixed piece is charged when the authorization is requested, so declined and abandoned attempts cost you as well. And if your statement carries one vague line such as card brand fees, ask for the itemised pass-through detail behind it.",
    ],
    example: "Run $50,000 across 500 card sales in a month. At roughly 0.14% of volume the networks take about $70, and the fixed fee of about two cents on each of the 500 authorizations adds another $10. Call it $80, or close to 0.16% of volume. That sits underneath interchange and underneath your processor's markup, and nobody in the chain can remove it.",
    faqs: [
      {
        question: "Why am I charged an assessment fee on top of interchange?",
        answer: "Two different parties are being paid. Interchange compensates the bank that issued the card for its risk and its funding; the assessment pays the network for running the rails and clearing the transaction. Neither is optional, and no processor can waive either one. Between them they make up the wholesale cost that every merchant pays, whatever pricing model sits on top.",
      },
      {
        question: "How much are Visa and Mastercard assessment fees?",
        answer: "Roughly 0.13% to 0.14% of the settled amount on both networks, plus a fixed fee of around two cents per authorization. The exact figure depends on card type and ticket size, and on whether the transaction runs as credit or debit. The networks also republish their schedules twice a year, so treat any single number as an approximation rather than a rate you can hold a processor to.",
      },
      {
        question: "Why did my assessment fees go up without notice?",
        answer: "The card networks reset their published schedules, normally in April and October, and pass-through charges follow automatically. Your processor is not required to negotiate that with you, because it is not their fee. What should not move without notice is the markup, so pull the statements either side of the increase and compare that line specifically.",
      },
    ],
    related: ["interchange", "markup", "effective-rate", "surcharge"],
  },
  {
    slug: "gateway-fee",
    term: "Gateway fee",
    short: "A separate charge for the software that transmits transactions to the processor.",
    definition:
      "A gateway fee is a monthly and/or per-transaction charge for using a payment gateway, levied when the gateway is a separate product from the processor (as with Authorize.net-style setups). All-in-one providers usually fold it into their rate, so watch for it when comparing quotes.",
    detail: [
      "The expensive surprise with a gateway is that it is usually a separate contract, with its own term and its own notice period. Change processor and the gateway bill carries on, and you can end up paying for both for a few months. Cancelling is complicated further by who invoices you. Some merchants pay the gateway vendor directly; others see the charge bundled into the processor's monthly statement because a sales agent resold the licence. Notice has to go to the party you actually signed with.",
      "The bill itself has a monthly platform fee and a per-transaction fee, sometimes a one-off setup charge, and optional modules priced separately. The headline number rarely covers the modules. A tokenization vault, recurring billing or advanced fraud filtering can each carry its own monthly charge. Ask for the full price list before you sign, and ask specifically whether the per-transaction fee applies to declines.",
      "Which half of that bill hurts more depends on your business. The monthly portion bites when volume is low, the per-transaction portion when your average ticket is small. Convert both into a percentage of monthly card volume before you compare providers, because a gateway that looks cheap at $25 a month is not cheap once its ten-cent transaction fee meets a thousand $12 sales. Fold the result into your effective rate.",
    ],
    example: "Take 600 sales at an average of $50, so $30,000 of volume. A gateway at $25 a month plus $0.10 per transaction bills you $25 fixed and $60 on transactions, which is $85 for the month, and your processor's own rate sits on top of that. As a share of volume the gateway alone is 0.28%. That is more than many processors charge in markup.",
    faqs: [
      {
        question: "Do I have to pay a separate gateway fee?",
        answer: "Only if the gateway is a separate product from your processing. Most all-in-one and flat-rate providers bundle it into their rate, so there is nothing extra to pay. The separate fee shows up when you hold a traditional merchant account and license the gateway in its own right. Neither model is automatically cheaper; your volume and your average ticket decide it.",
      },
      {
        question: "How much does a payment gateway cost per month?",
        answer: "Roughly $10 to $25 a month plus about $0.05 to $0.10 per transaction for most standalone gateways, with setup fees, where they exist, usually a modest one-off charge. Gateways with built-in fraud tooling, vaulting or multi-acquirer routing cost more than that. Before you compare, ask whether the per-transaction fee is charged per authorization, because that means declines cost you as well.",
      },
      {
        question: "Can I keep my gateway if I switch processors?",
        answer: "Usually, yes. Most independent gateways connect to several acquirers and can be repointed at a new processor without rebuilding your checkout, which is a large part of why merchants choose a standalone gateway over a bundled one. Check that yours supports the new processor's platform before you commit, and check how much time your existing gateway contract still has to run.",
      },
    ],
    related: ["payment-gateway", "monthly-minimum", "effective-rate"],
  },
  {
    slug: "monthly-minimum",
    term: "Monthly minimum",
    short: "A floor on monthly fees: you pay the difference if processing fees fall short.",
    definition:
      "A monthly minimum is the least a processor will charge you in a month; if your transaction fees don't reach it, you pay the gap. It penalises seasonal or low-volume merchants, so many modern processors (especially flat-rate ones) advertise no monthly minimum.",
    detail: [
      "At the end of each billing month your processor totals the fees it earned from you and compares that against the contracted minimum. If you fall short it adds a line, usually labelled monthly minimum fee, for exactly the difference. Clear the threshold and the line never appears, so you are never charged twice for the same month. Traditional merchant accounts commonly set the figure somewhere between $15 and $35 a month. What it does is convert a variable cost into a fixed floor: harmless when you are busy, expensive when you are not.",
      "Seasonal businesses feel that hardest. A landscaper or a ski shop can pay the full minimum for four or five months of the year while processing almost nothing, and it distorts the effective rate badly, because a small denominator makes even a modest fixed charge look enormous as a percentage. What decides the real cost is which fees count towards the minimum. Contracts that count every processing charge including interchange are barely ever triggered; contracts that count only the processor's own markup set a far higher bar. The minimum also sits alongside your monthly account, statement and PCI fees rather than replacing them, so get that in writing before you sign.",
    ],
    example: "A slow month: $3,000 across 60 sales, against a contract with a $25 monthly minimum measured on the processor's markup of 0.25% plus $0.10 per transaction. The markup earns $7.50 on volume and $6.00 on transactions, so $13.50 in total. The processor adds an $11.50 monthly minimum fee to bring it up to $25. On $3,000 of sales, that floor on its own is 0.83%.",
    faqs: [
      {
        question: "Do I pay a monthly minimum if I process nothing at all?",
        answer: "A month with zero sales triggers the full minimum, because the whole amount is the shortfall. Dormant accounts keep costing money, and the monthly account fee usually applies on top. If you expect months when the business is closed, negotiate the minimum out of the contract, or close the account properly rather than leaving it idle.",
      },
      {
        question: "Is a monthly minimum negotiable?",
        answer: "More often than merchants assume, particularly if you can show consistent volume or you are moving across from another provider. A processor would rather waive a $25 floor than lose the account, and plenty will drop it for the first year or remove it entirely above an agreed volume. Get any waiver written into the agreement itself. A promise from the sales rep is not a term of your contract.",
      },
      {
        question: "How much volume do I need to avoid a monthly minimum?",
        answer: "Divide the minimum by what your processor earns on an average sale. On a 0.25% plus $0.10 markup with a $50 average ticket, each sale earns them just under 23 cents, so a $25 minimum needs roughly 112 sales, or about $5,600 of volume. Ask which fees count towards the minimum before you rely on that, because counting interchange changes the answer completely.",
      },
    ],
    related: ["gateway-fee", "flat-rate-pricing", "effective-rate"],
  },
  {
    slug: "surcharge",
    term: "Surcharge",
    short: "A fee added to a card payment to pass processing costs to the customer.",
    definition:
      "A surcharge is an extra charge added to credit-card transactions to offset the merchant's processing fee. It's regulated: capped in amount, banned in some regions, and it must be disclosed and applied only to credit (not debit) cards. Cash discounting is a related but distinct approach.",
    detail: [
      "Surcharging does not make card acceptance free. The fee becomes part of the transaction amount, so you pay interchange and assessments on the surcharge as well and recover slightly less than you added. Two ceilings then cap what you can add. The networks publish a maximum percentage, which has come down in recent years, and your own cost of acceptance is the tighter limit for most merchants: you may never charge the customer more than that card costs you. That is why most surcharging sits between 2% and 3%.",
      "The procedure is fixed. Notify the card networks and your acquirer at least 30 days before you start, and confirm the current cap with the acquirer while you are there. Post signage at the entrance and at the point of sale, and show the surcharge as its own line on the receipt. The fee is added before authorization, so the customer's bank approves the higher total. Credit cards only: never debit or prepaid, and not even a debit card run without a PIN.",
      "Local law sits on top of the network rules. A small number of US states and territories, including Connecticut and Massachusetts, prohibit credit-card surcharging outright, while others regulate how the price must be displayed. Those rules change, so check yours before you switch anything on. Where surcharging is banned, cash discounting is the usual alternative. Weigh the whole thing honestly: you are trading most of your card cost for friction at checkout, complaints, and some abandoned baskets online.",
    ],
    example: "Add a 3% surcharge to a $200 credit-card sale and the customer pays $206. Your own rate of 2.9% plus $0.30 now applies to that larger figure, so $5.97 plus $0.30, or $6.27. Against the $6.00 you collected in surcharge, the sale costs you $0.27 rather than the $6.10 it would have cost without one. Most of the fee comes back to you. Not all of it.",
    faqs: [
      {
        question: "Is it legal to charge customers a credit card fee?",
        answer: "In most of the United States, yes, provided you follow the card network rules and your state allows it. The conditions are specific: register with the networks 30 days in advance, disclose the fee before the sale and again on the receipt, keep it within both your cost of acceptance and the network's published cap, and apply it to credit cards only.",
      },
      {
        question: "What is the difference between a surcharge and a cash discount?",
        answer: "A surcharge adds a fee to the credit-card price. A cash discount posts the higher price for everyone and takes money off for paying in cash. The customer can end up paying an identical amount either way, but the treatment is not identical: cash discounting is permitted in every US state and can apply to debit as well as credit, which is why merchants in states that ban surcharging use it instead.",
      },
      {
        question: "Can I surcharge debit cards?",
        answer: "No, nowhere in the United States. Network rules prohibit surcharging debit and prepaid cards, and that includes a debit card processed as credit without a PIN. Your terminal or gateway has to identify the card type and apply the fee to credit transactions only. Getting this wrong is one of the most common reasons a surcharging program is shut down.",
      },
    ],
    related: ["assessment-fee", "effective-rate"],
  },
  {
    slug: "authorization",
    term: "Authorization",
    aka: ["Auth"],
    short: "The issuing bank's approval that holds funds for a pending transaction.",
    definition:
      "Authorization is the first step of a card payment: the issuing bank confirms the card is valid and the funds are available, then places a hold. No money moves yet; that happens at capture and settlement. An authorization can be voided before it's captured.",
    detail: [
      "Your terminal or gateway sends the authorization request to your processor, which passes it to the card network, which routes it to the issuing bank. The issuer looks at the available balance and runs its own fraud rules against whatever you sent, including any AVS and CVV data. It answers in a second or two, with either an approval code or a decline code. An approval reduces the cardholder's available balance. It does not debit the account.",
      "The hold is what generates support tickets. A customer sees a pending line on their banking app for an order you have not shipped, and assumes they have been charged twice. That gets worse when a failed attempt and a successful one have both left holds sitting there. You can void the stale authorization, but the issuer decides how fast the pending line disappears, and that can take several days. One sentence on your order confirmation prevents most of those calls.",
      "Authorization rate is a cost line most merchants never look at. Every decline is a sale you have already paid to acquire, and approval rates do differ between processors, depending on how much data they pass to the issuer and whether they retry soft declines sensibly. Some gateways also bill a small fee on every authorization attempt, declines included, so a checkout that keeps retrying a failing card adds fees without adding revenue. Ask any provider you are quoting for its approval rate.",
    ],
    example: "A customer orders a $180 chair on Tuesday. Your gateway asks for authorization, the issuer approves, and $180 of their available balance goes on hold. Nothing has left the account. You ship on Thursday and capture the $180 then. If the chair had been out of stock you would have voided the authorization instead, and the hold would have fallen away. Leave an authorization uncaptured and it expires by itself, usually within a few days.",
    faqs: [
      {
        question: "How long does a credit card authorization hold last?",
        answer: "A few days for most sales, often around a week, and then the issuer releases the held funds without anyone asking it to. The window varies by card network and by merchant category: hotels, car rental firms and fuel stations get longer ones because nobody knows the final amount when the card is first authorized. If you already know you will not capture, void the transaction and the hold clears sooner.",
      },
      {
        question: "Why do card authorizations get declined?",
        answer: "Most of them come from the issuing bank rather than your processor. Insufficient funds will do it, so will an expired or blocked card, a fraud rule tripped by the amount or the country, or too many attempts in a short period. AVS and CVV mismatches account for more. Read the response code, because it tells you which. Soft declines are worth retrying and hard declines are not.",
      },
      {
        question: "Can I charge more than the amount I authorized?",
        answer: "Not without a second authorization, or an incremental one on top of the first. Capturing above the approved amount invites a decline or a dispute, so if the total climbs through shipping or added items, most processors want the higher figure authorized up front. Restaurants are the usual exception. Network rules there allow a tolerance for tips added after the card has been authorized.",
      },
    ],
    related: ["capture", "settlement", "void", "issuing-bank"],
  },
  {
    slug: "capture",
    term: "Capture",
    short: "The step that turns an authorization into an actual charge to be settled.",
    definition:
      "Capture tells the processor to collect the funds that authorization put on hold. Many businesses authorize at checkout and capture at fulfilment (shipping the goods). Uncaptured authorizations expire after a few days and release the hold.",
    detail: [
      "Check your dashboard's default before anything else. Several platforms capture automatically at checkout unless you switch that off, so a shop that believes it captures at dispatch may in fact be charging customers at the basket. The other version of the same problem is capturing after the authorization has expired. Plenty of processors will still submit it, but the issuer no longer guarantees the funds, the transaction can downgrade into a more expensive interchange category, and you carry more chargeback risk.",
      "Mechanically, capture is a second message to your processor quoting the original authorization code. It marks that transaction for your next batch. Money still has not moved at that point, because settlement is what moves it. Most processors let you capture less than you authorized, which is how out-of-stock lines and split shipments get handled, and some allow several partial captures against a single authorization.",
      "Timing is the real decision capture forces on you. Card network rules expect physical goods to be billed when they are dispatched rather than when the order is placed, and capturing days early means a later cancellation has to be refunded rather than voided, which usually costs you the processing fee. Capturing at dispatch is the safer habit, but it starts the payout clock later. A business shipping on a five-day lead time waits five extra days for its money.",
    ],
    example: "A customer orders $240 of goods and one $60 item turns out to be out of stock. Capture $180 against the original authorization and the remaining $60 of the hold falls away. At a flat 2.9% + $0.30 that is $5.52 in fees. Capture the full $240 and refund the $60 afterwards and you would have paid $7.26, and most flat-rate processors keep that money, so the partial capture is worth $1.74.",
    faqs: [
      {
        question: "How long do I have to capture a transaction?",
        answer: "About seven days from authorization is the common answer, though the exact window depends on the card network and the card type as well as your processor. After that the hold lapses, and the right move is to re-authorize the card rather than push a late capture through. Businesses with long fulfilment times, made-to-order furniture for instance, often run a small authorization to confirm the card is live and charge in full at dispatch.",
      },
      {
        question: "Can I capture less than the amount I authorized?",
        answer: "Partial capture is supported by nearly every modern processor and it is the correct way to handle a short shipment. You capture what you actually shipped, the balance of the hold is released, and percentage fees apply only to what you collected. Capturing more than once against a single authorization is the part that varies by provider, so confirm it before you build split shipments into your workflow.",
      },
      {
        question: "Is the money in my account once a transaction is captured?",
        answer: "No. Capture only queues the transaction for your next batch, and the funds then clear through the card networks and reach your bank on your processor's payout schedule, commonly one to two business days later. A sale captured on Friday afternoon usually batches that evening and can land the following Tuesday. That is why capture dates and deposit dates so rarely line up on a statement.",
      },
    ],
    related: ["authorization", "settlement", "void", "batch"],
  },
  {
    slug: "void",
    term: "Void",
    short: "Cancelling an authorized transaction before it's captured or settled.",
    definition:
      "A void cancels a transaction that has been authorized but not yet captured or settled, releasing the hold on the customer's funds. Because no money has moved, a void is cleaner and faster than a refund, which reverses a completed charge.",
    detail: [
      "The deadline is not capture. It is your batch cutoff. A void pulls a transaction before the batch closes. A sale that is only authorized has its hold released, and a captured sale can usually still be cancelled too, as long as the batch has not gone to the networks. Once it has, refunding is the only route left. A staff habit of checking the open batch before it closes turns paid refunds into free voids.",
      "Voiding is almost always free. Refunding the same sale usually costs you the original processing fee, sometimes a refund fee too, and it feeds a refund count that some processors watch as a risk signal alongside chargebacks. The catch is the customer's statement. A void does not always clear the pending line at once. Some processors send a full authorization reversal and the issuer releases it quickly, while others stop the transaction on their side and let the hold expire. Ask which yours does, because it decides whether a customer waits an hour or several days.",
    ],
    example: "A customer cancels at 4pm and your batch does not close until 10pm, so you void the $500 order. The hold drops off and it costs you nothing. The same cancellation at 9am the next morning lands after the batch has gone, which makes it a refund instead. At 2.9% + $0.30 the processor keeps $14.80 on a sale you no longer have. Twenty of those in a year is $296.",
    faqs: [
      {
        question: "Can I void a payment after it has settled?",
        answer: "No. Once a transaction has settled, refunding is the only option left. The practical cutoff is your daily batch. Anything still sitting in the open batch can normally be voided, and anything already submitted to the card networks cannot. If your dashboard lists a payment as uncaptured or pending batch, void it. Once it reads settled or paid out, refund it.",
      },
      {
        question: "Does a voided transaction show on the customer's bank statement?",
        answer: "No charge lands on the final statement, though a pending authorization may sit there for a few days until the bank drops it. Nothing is debited and nothing settles. When a customer is worried, tell them the amount is showing as pending rather than charged, and that the timing of the release belongs to their bank rather than to you.",
      },
      {
        question: "Is there a fee for voiding a transaction?",
        answer: "Most processors charge nothing, which is the whole argument for voiding rather than refunding. Some gateways still bill a small per-transaction or per-authorization fee whatever the outcome, so read the fee schedule if you void a high share of orders. Even then, compare it against a refund, where the original percentage fee is usually gone for good.",
      },
    ],
    related: ["authorization", "capture", "refund"],
  },
  {
    slug: "refund",
    term: "Refund",
    short: "Returning funds to a customer for a transaction that has already settled.",
    definition:
      "A refund reverses a completed, settled payment and returns the money to the customer's card. Unlike a chargeback it's merchant-initiated and doesn't count against your dispute ratio, though some processors don't return the original transaction fee.",
    detail: [
      "Refunds are not free reversals. Under flat-rate pricing most providers keep the original percentage and the fixed fee, so a return costs you the goods back plus the fee you already paid, and some add a small refund fee as well. Interchange-plus is less predictable. Some processors return part of the interchange and keep their markup, and others return nothing at all. Sell in a high-return category such as apparel and you should build your return rate into the effective rate you compare quotes on.",
      "The mechanism itself is simple. You raise the refund against the original transaction and your processor sends a credit through the card network to the issuing bank, which posts it to the cardholder's account. The money comes out of your next settlement, or gets debited from your bank account if that day's sales do not cover it. Network rules require the credit to return to the card that paid, which is why you cannot refund to a different card or hand back cash.",
      "Timing is where it turns into a support problem. The credit takes several business days to appear because the issuing bank decides when it posts, and a customer who files a dispute while your refund is still in flight can cost you twice unless you answer with proof that the refund was sent. Funding is the other one. Refund more in a day than you sell and your processor debits your bank account for the difference, which bites after a heavy return week.",
    ],
    example: "Sell a $120 dress on flat-rate pricing at 2.9% + $0.30 and you pay $3.78 in fees, netting $116.22. The customer returns it, you refund the full $120, and with most flat-rate providers that $3.78 stays with the processor. So the round trip costs you $3.78 on top of the lost sale. Scale it up: on $50,000 of monthly card sales with a fifth of it returned, roughly $300 a month goes in fees you never see again.",
    faqs: [
      {
        question: "How long does a refund take to show on a customer's card?",
        answer: "Five to ten business days from the moment you issue it, typically. Your processor sends the credit within a day, but the issuing bank decides when it posts and you have no control over that step at all. Debit cards sometimes clear faster than credit cards. Give customers that range up front, with a reference number, and far fewer of them open a dispute.",
      },
      {
        question: "Is there a deadline for refunding a transaction?",
        answer: "There is one, and a returns policy can easily outlast it. Processors generally let you refund against the original transaction for a limited window, often somewhere between 90 and 180 days, after which the reference closes. Past that point you are paying the customer another way, by bank transfer or store credit, and carrying both the cost and the fraud risk. Check your provider's window before you write the policy.",
      },
      {
        question: "Should I refund a customer or let it become a chargeback?",
        answer: "Refund, in almost any case where the customer has a fair point. A chargeback adds a fee, commonly in the $15 to $25 range, counts towards the chargeback ratio the card networks monitor, and can still leave you without the goods. A refund costs you the processing fee and stays off that ratio entirely. Move fast enough and the dispute often never gets filed.",
      },
    ],
    related: ["chargeback", "void", "settlement", "batch"],
  },
  {
    slug: "settlement",
    term: "Settlement",
    aka: ["Clearing"],
    short: "The batch process that moves captured funds from the issuer to the merchant's account.",
    definition:
      "Settlement is where money actually changes hands: captured transactions are batched (usually daily) and the funds flow from issuing banks through the networks to the acquiring bank. The time from settlement to money in your account is the payout time.",
    detail: [
      "Your bank shows $96.80 for a $100 sale, and that is net settlement: fees come out before the money reaches you. It is how most flat-rate providers work, and it leaves you unpicking the fee later from a statement. Gross settlement deposits the full amount and debits fees once a month. Traditional merchant accounts commonly work that way, and it makes reconciliation and effective-rate calculations far easier.",
      "Behind that, the sequence is fixed. Your batch cuts off, your processor submits the day's captured transactions to the card networks, and the networks clear them. Every issuer is told what it owes. Interchange and assessments come out at this stage, and the net amount moves to your acquiring bank, which credits your merchant account and starts the transfer to your business bank. Nothing you do after batch cutoff changes that day's settlement, which is why the cutoff time matters more than merchants tend to think.",
      "On a statement, settlement date and deposit date are two different things, and support teams confuse them constantly. A sale that settles on Friday can sit over the weekend and turn up on Tuesday. Settlement is also the moment an interchange downgrade becomes visible, because the final category is fixed when the transaction clears, so a batch full of keyed-in or missing-data sales costs more than your quote implied. Any reserve is withheld here too.",
    ],
    example: "Your terminal batches at 9pm on Tuesday with 42 sales totalling $3,180, and the networks clear the batch on Wednesday. You are on interchange-plus at interchange + 0.25% + $0.10, and interchange and assessments average 1.95% of volume, so fees come to $74.16. Net settlement makes Thursday's deposit $3,105.84. Gross settlement lands the full $3,180 and debits the $74.16 at month end.",
    faqs: [
      {
        question: "Why is my bank deposit smaller than my sales total?",
        answer: "Most processors settle net, taking their fees before the money reaches your bank. The gap is those fees plus whatever else came out that day: refunds you issued, chargebacks and their fees, any rolling reserve. Match one day's batch report against the matching deposit line and it should reconcile exactly. When it does not, ask your processor for the itemised settlement report for that date.",
      },
      {
        question: "Does settled mean the money is in my bank account?",
        answer: "No. Settled means the transaction has cleared between the banks, and your funds then travel to your business account on your processor's payout schedule, commonly one to two business days later. Dashboards label these stages inconsistently, so check what settled means on yours: cleared with the networks, or actually transferred to you. The two can be days apart.",
      },
      {
        question: "Can I change what time my transactions settle?",
        answer: "Usually yes. Most terminals and gateways have a batch cutoff time that you or your processor can move, and that time decides which day a sale settles. Shift the cutoff from 5pm to late evening and evening sales join the same day's batch instead of the next one, which pulls your deposit forward by a day. Weekends and bank holidays still push funding to the next business day.",
      },
    ],
    related: ["batch", "payout-time", "capture", "multi-currency"],
  },
  {
    slug: "batch",
    term: "Batch",
    aka: ["Batching"],
    short: "A group of captured transactions submitted together for settlement, usually daily.",
    definition:
      "Batching is submitting a day's captured transactions to the processor in one bundle for settlement. Most terminals and gateways batch automatically at a set time; batching late can delay your payout by a day.",
    detail: [
      "The expensive mistake is a batch that never closes. A terminal set to manual close holds its transactions until someone ends the day, so a forgotten long weekend can leave several days of sales sitting unsettled and unpaid. Run more than one device, or a terminal alongside an online gateway, and each one closes on its own schedule. That is why the deposits landing in your bank so rarely line up with your trading days one for one.",
      "Here is what closing actually does. A captured sale sits in an open batch on your terminal or gateway, visible in your reports and not yet money. At the cut-off the batch goes to your processor, which sorts the transactions by card network and sends them for clearing. The networks debit each issuing bank and credit your acquiring bank, and your acquirer funds you from there. Before the batch closes, none of those steps have started. Nothing has moved.",
      "So the cut-off starts your payout clock, not the sale. A sale taken at 9pm against an 8pm cut-off rides the next day's batch and funds a day behind the ones either side of it. Delay can cost money too. The card networks expect a transaction to clear within a short window after authorization, usually a day or two, and a stale one can be re-priced into a more expensive interchange category.",
    ],
    example: "Thursday's deposit is $2,379.28. Behind it: a cafe's 96 card sales worth $2,480 taken on Tuesday, batched automatically at 11:00pm so all 96 cleared together, less $100.72 in fees at 2.9% plus $0.30 a sale. One $60 sale rung up at 11:20pm missed the cut-off; it joined Wednesday's batch and funds on Friday instead.",
    faqs: [
      {
        question: "What happens if I forget to close my batch?",
        answer: "Nothing gets paid. The transactions stay open and unsettled until the batch is submitted, and on top of that they can age past the network's clearing window and be downgraded to a costlier interchange rate. Most terminals and gateways now close automatically at a preset time, so this is rare, but any system that needs a manual close can bite you over a long break.",
      },
      {
        question: "Can I change my batch cut-off time?",
        answer: "Most processors will move it if you ask, usually for free. Set it after your latest normal closing time and a full trading day stays in one batch, which makes reconciliation simpler and stops evening sales slipping into the next day's payout. Businesses that trade past midnight often go the other way and ask for an early-morning cut-off.",
      },
      {
        question: "Why does my bank deposit not match my batch total?",
        answer: "The batch total is gross sales and the deposit is net of fees, refunds, and any reserve. Processors that bill daily take their fees out of each deposit; those that bill monthly pay you gross and debit the fees once at month end. Same-day refunds come off too. Reconcile against the settlement report rather than the terminal's batch slip.",
      },
    ],
    related: ["settlement", "payout-time", "capture"],
  },
  {
    slug: "payout-time",
    term: "Payout time",
    aka: ["Settlement time", "Funding time"],
    short: "How long after a sale the money actually lands in your bank account.",
    definition:
      "Payout time is the delay between a settled transaction and funds arriving in your bank, commonly next-day or two business days (T+2), with some processors offering instant or same-day payout for a fee. Faster payouts help cash flow but can carry a premium.",
    detail: [
      "Take a business turning over $60,000 a month and move it from T+2 to next-day funding: about $2,000 of cash is released, once, and stays released. That is what payout time is worth to you. It behaves like a working-capital cost rather than a fee, because every extra day is another day of sales you have already paid staff and suppliers for and cannot yet spend. Instant payout closes the gap, priced as a percentage of the amount moved.",
      "Three clocks run in sequence. Your batch closes and goes to the processor. The card networks clear those transactions and move funds to your acquiring bank, which takes roughly a business day. Then the acquirer sends an ACH credit to your bank, and your bank posts it on its own schedule. The payout time you were quoted is the sum of all three, and only that last leg belongs to your bank rather than the processor.",
      "Whatever a processor advertises describes an established account. A new one runs slower for the first week or two while underwriting watches your early transactions, and any rolling reserve sits on top of that. Weekends and US bank holidays are not business days either, so a Friday sale on T+2 terms usually arrives Tuesday. Worth asking outright: does the clock your processor quotes start at the sale or at settlement?",
    ],
    example: "Friday afternoon, $1,200 taken before the 10:00pm cut-off, standard T+2 terms. The batch closes that night. Saturday and Sunday are not business days, so the two business days land on Monday and Tuesday, and the money posts Tuesday: four calendar days after the sale. Paying 1% for instant payout would have cost $12 to hold the same $1,200 that evening.",
    faqs: [
      {
        question: "How long does it take to get paid after a customer pays by card?",
        answer: "One to two business days after the transaction settles, for most US processors. Flat-rate providers commonly quote next-day or T+2 as standard, and traditional merchant accounts sit in the same range. New accounts, unusually large transactions, and high-risk categories get held longer while the processor reviews them. Weekends and bank holidays stretch the calendar wait without changing the business-day count.",
      },
      {
        question: "Is instant payout worth paying for?",
        answer: "Only when the fee is small next to the cash-flow gap it closes. The price is a percentage of the amount moved, so cost scales with volume while the benefit does not: pulling $50,000 forward by a day costs far more than short-term borrowing would. Use it to cover an occasional tight week rather than as a standing arrangement.",
      },
      {
        question: "Can a processor hold my payout?",
        answer: "It can, and in the first weeks of a new account or after an unusual transaction it is common. Holds get triggered when volume jumps sharply, when one sale is far larger than your average, or when underwriting flags the business type. They are usually released once you supply invoices, tracking, or proof of delivery, so answer quickly rather than sitting on it.",
      },
    ],
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
    detail: [
      "The mechanics are unglamorous. You collect a routing and account number plus a signed or recorded authorization to debit. Your provider hands that debit to an originating bank, which submits it into the ACH network, and the network delivers it to the customer's bank, which either pays the item or returns it. Same-day windows exist for an extra fee. Standard entries still run on a one to three business day cycle.",
      "What surprises merchants is the tail. An ACH return is not a chargeback, but a consumer can claim a debit was unauthorized for up to 60 days after the statement it appeared on, and the funds get pulled back with a return fee attached. Keep the signed authorization on file. Check as well whether your provider verifies account ownership before the first debit, because a mistyped account number tends to surface only after you have shipped.",
      "None of which stops the economics winning at a certain ticket size. ACH is normally priced as a flat fee per transaction, often under a dollar, or as a low percentage with a cap, so your cost stops rising with the amount while a card fee keeps climbing. On a $5,000 invoice that is roughly $145 at a 2.9% card rate against well under a dollar. Speed and settled certainty are what you trade away.",
    ],
    example: "$2,091.60 a year against $6. That is a design studio billing a $6,000 retainer monthly: on flat-rate card pricing at 2.9% plus $0.30 the fee is $174.30 a month, while the same invoice collected by ACH at a $0.50 flat fee costs $6 over the year. The trade is a few business days of clearing instead of next-day funding, plus the occasional returned debit to chase.",
    faqs: [
      {
        question: "Is ACH cheaper than accepting a credit card?",
        answer: "Almost always, because ACH is priced as a flat fee and cards are priced as a percentage of the sale. A $2,000 payment might cost well under a dollar by ACH and around $58 at a 2.9% card rate. The two only converge on very small tickets of a few dollars, and cards still win there on speed and convenience.",
      },
      {
        question: "How long does an ACH payment take to clear?",
        answer: "One to three business days for standard ACH; same-day ACH can settle the same afternoon if you pay extra for it. Clearing is not the same as certainty, though. A debit can still be returned for insufficient funds after it looks like it has gone through, which is why many businesses wait several days before shipping high-value goods paid this way.",
      },
      {
        question: "Can ACH payments be reversed like a chargeback?",
        answer: "They can be reversed, but through a different process with different deadlines. A consumer has up to 60 days after the statement a debit appeared on to claim it was unauthorized, and the bank returns the funds. Insufficient-funds returns usually land within a couple of business days. There is no formal representment stage as there is with cards, so a valid signed authorization is your main defence.",
      },
    ],
    related: ["sepa", "payout-time", "recurring-billing", "dunning", "multi-currency"],
    relatedFacets: ["ach"],
  },
  {
    slug: "sepa",
    term: "SEPA",
    aka: ["Single Euro Payments Area"],
    short: "The euro-area scheme for low-cost bank transfers and direct debits.",
    definition:
      "SEPA lets businesses and consumers make euro bank transfers and direct debits across participating European countries as easily as domestic ones. Like ACH in the US, SEPA Direct Debit is a cheap way to collect recurring euro payments.",
    detail: [
      "Start with the part that bites. Under the core SEPA Direct Debit scheme a consumer can demand their money back within eight weeks of a collection, for any reason, with no explanation owed to you, and up to thirteen months if the mandate was never valid. Settlement currency deserves the same attention: your provider may collect in euros and convert to your home currency at its own FX margin, which can cost more than the collection fee.",
      "SEPA itself is two things you meet as a merchant. SEPA Credit Transfer is a push: the customer tells their bank to send euros to your IBAN. SEPA Direct Debit is a pull: the customer signs a mandate giving you permission to collect, then you or your provider submit collections that reference that mandate and the funds arrive on a scheduled date. No card network sits in the middle of either, which is why the fees look nothing like card fees.",
      "For euro subscriptions the draw is reliability as much as price. Mandates do not expire and cards do, so there is no reissue to chase and the involuntary churn that dunning exists to fix largely disappears. Fees are usually a small flat amount per collection, sometimes a percentage capped on large amounts. What it costs you is spontaneity: each collection needs advance notice to the customer, so charging on demand is off the table.",
    ],
    example: "A SaaS company bills 400 European customers 29 euros a month. Card collection at a typical European flat rate of around 1.5% plus 0.25 euros comes to about 274 euros a month. SEPA Direct Debit at 0.35 euros a collection comes to 140 euros. The bigger prize is not the monthly saving: an expired card fails at renewal, while a mandate keeps working until the customer cancels it.",
    faqs: [
      {
        question: "Can a US business accept SEPA payments?",
        answer: "If your payment provider supports SEPA and you can settle to a euro account, yes, and most international processors handle that. No European entity is needed to receive SEPA Credit Transfers. Direct debit is stricter: providers generally require a creditor identifier and some require a euro-area bank account, so check the onboarding rules before you promise customers direct debit.",
      },
      {
        question: "How long does a SEPA transfer take?",
        answer: "A standard SEPA Credit Transfer arrives within one business day, and instant transfers settle in seconds where both banks are on the instant scheme. Direct debit works on a different logic: you submit the collection a set number of days ahead of the due date, and the funds reach you on that date. Plan for a few business days of lead time rather than card-style immediacy.",
      },
      {
        question: "Is SEPA Direct Debit safer than card payments for recurring billing?",
        answer: "More reliable, not lower risk. Mandates do not expire the way cards do, so far fewer renewals fail, but that eight-week no-questions refund right means a collection can be reversed long after you booked it as revenue. For a subscription delivered month by month the exposure is small. For anything with a large upfront charge, treat it like a card dispute.",
      },
    ],
    related: ["ach", "recurring-billing", "multi-currency"],
    relatedFacets: ["multi-currency"],
  },
  {
    slug: "chargeback",
    term: "Chargeback",
    short: "A forced reversal of a card payment initiated by the customer's bank after a dispute.",
    definition:
      "A chargeback happens when a cardholder disputes a charge with their issuing bank, which reverses the payment and usually adds a fee. Unlike a refund, it's outside the merchant's control and counts against your chargeback ratio. Too many can jeopardise your merchant account.",
    detail: [
      "The bank drives this, and you are the last to hear. The cardholder files a dispute with their issuing bank under a reason code: goods not received, say, or fraud. The issuer credits the cardholder provisionally and pulls the funds back through the network from your acquirer, which debits your account. That reversal is the chargeback. Only then do you get a notice carrying the reason code and a deadline, set by your processor inside the network's response window, to submit evidence. Your reply is called representment.",
      "It costs more than the sale did. You lose the goods, the original transaction fee, and the amount itself, and most processors add a chargeback fee on top, commonly in the $15 to $40 range and higher on high-risk accounts, charged whatever the outcome. A few providers waive it. Winning gets the transaction amount back but usually not the fee. The bigger exposure is your chargeback ratio: sustained levels above the networks' monitoring thresholds bring fines, reserves, or account closure.",
      "Most of them are not criminal fraud, either. A large share are friendly fraud: a real customer who does not recognise the billing descriptor on their statement, or who forgot about a subscription. Set the descriptor to your trading name with a phone number beside it and a surprising number of cases disappear before they start. One more trap worth knowing: refunding after a dispute has been filed does not withdraw it, so check the dispute queue before you issue any refund or you can pay twice.",
    ],
    example: "You win the dispute and you are still $25 down. The sale was a $180 pair of boots; six weeks later the cardholder filed for goods not received, your acquirer took back the $180 and added a $25 chargeback fee, leaving you $205 down plus the stock. Tracking showing delivery won it, so the $180 came back. The $25 did not, and neither did the several hours of admin.",
    faqs: [
      {
        question: "How long does a chargeback take to resolve?",
        answer: "Most cases close within 30 to 90 days of the cardholder filing. Your evidence window is short inside that, often a week or two, and then the issuer reviews and rules, which can take another month or more. Cases escalated to pre-arbitration or network arbitration can run past six months, and arbitration carries fees of several hundred dollars for the losing side.",
      },
      {
        question: "Can I win a chargeback, and how?",
        answer: "Merchants win a meaningful share of disputes, but only with evidence that matches the reason code. Goods not received calls for tracking and proof of delivery to the address on the order. An unrecognised charge calls for the order confirmation, IP address, AVS and CVV results, and any correspondence with the customer. Generic responses lose. A document pack aimed at the specific reason code wins.",
      },
      {
        question: "How many chargebacks are too many?",
        answer: "Card-network monitoring programs typically start at around 0.9% to 1% of monthly transactions, with a minimum dispute count attached. Cross that and you land in a remediation program with per-dispute fines and a deadline to get back under. Acquirers grow uneasy well before the threshold, though, so a practical internal ceiling is half the network threshold, and any month above that deserves investigation.",
      },
    ],
    related: ["dispute", "chargeback-ratio", "rolling-reserve", "3d-secure", "issuing-bank"],
  },
  {
    slug: "chargeback-ratio",
    term: "Chargeback ratio",
    short: "Chargebacks as a share of transactions, a key risk metric for processors.",
    definition:
      "The chargeback ratio is your number of chargebacks divided by transactions (by count or volume) in a period. Card-network monitoring programs typically flag merchants above roughly 0.9% to 1%, which can bring fines, reserves, or account termination. Keeping it low is central to staying in good standing.",
    detail: [
      "Each network counts your chargebacks separately, per merchant ID, per calendar month, then divides them by that same month's transaction count rather than by the sales that produced them. The denominator is what catches people out. A quiet month following a busy one can push you over the line with nothing about your fraud having changed, which is how seasonal businesses fail this in January. Refunding a customer after the chargeback is filed does not remove it from the count either, so refund early or not at all.",
      "Monitoring programs pair the percentage with a minimum number of disputes, so a very small merchant can sit above the percentage without being flagged at network level. That is less comfort than it sounds. Your processor's risk team applies a second, stricter internal ceiling, and it is the one that acts first, imposing a rolling reserve or holding payouts long before any network gets involved.",
      "Every chargeback in the numerator has already cost you the sale, the goods, and a chargeback fee commonly running $15 to $40, which makes the ratio a lagging summary of money you have lost. Crossing a threshold then adds network fines passed through per dispute, monthly fees for as long as you stay in the monitoring program, a written remediation plan, a reserve, repricing, or termination. Fraud screening is cheaper. So is a billing descriptor customers recognise, and so is answering support tickets fast.",
    ],
    example: "1.44%. That is your January ratio: 26 chargebacks against 1,800 transactions. The same 26 disputes in November sat against 4,000 transactions and worked out at 0.65%, uncomfortable but under the network line. Nothing about your fraud changed in between. The denominator did, and that alone has put you in a monitoring program, where those 26 disputes have already cost roughly $650 in fees on top of the lost sales.",
    faqs: [
      {
        question: "What is a good chargeback ratio?",
        answer: "Under 0.5% by transaction count is the working target for most merchants, and under 0.3% if you are a low-risk retailer with delivery tracking and a billing descriptor customers recognise. Card networks will not open a monitoring case until roughly 0.9% to 1%. That is not the number to aim at, because your processor keeps its own ceiling well below it and acts sooner.",
      },
      {
        question: "Do chargebacks I win still count against my ratio?",
        answer: "Yes. Most card-network monitoring programs count a dispute when it is filed, not when it is decided, so winning representment returns the money and leaves the ratio exactly where it was. Which is why prevention beats fighting: a clear billing descriptor, delivery tracking, and chargeback alert services that let you refund before a dispute is formally raised.",
      },
      {
        question: "Do refunds count towards your chargeback ratio?",
        answer: "No. Refunds are merchant-initiated and sit outside the chargeback count entirely, which is exactly why issuing one quickly is usually cheaper than defending a dispute. A high refund rate can still draw attention from your processor's risk team as a sign of fulfilment problems, and refunding after a chargeback is already filed can leave you out of pocket twice.",
      },
    ],
    related: ["chargeback", "dispute", "high-risk-merchant"],
  },
  {
    slug: "dispute",
    term: "Dispute",
    short: "A customer's formal challenge to a charge, which may escalate into a chargeback.",
    definition:
      "A dispute is the process a cardholder starts when they don't recognise or disagree with a charge. The merchant can respond with evidence (representment); if unresolved it becomes a chargeback. Clear billing descriptors and responsive support prevent many disputes.",
    detail: [
      "A cardholder rings the issuing bank, which assigns a reason code (fraud, goods not received, not as described, duplicate charge, subscription cancelled) and provisionally credits them. The issuer debits your acquiring bank, and that debit is the chargeback your processor passes on to you. You get a notice with a response deadline, often 7 to 21 days. From there you either accept the loss or submit representment evidence. Either side can escalate to pre-arbitration and network arbitration, where filing fees run into the hundreds of dollars and make escalating a small case a poor bet.",
      "The money leaves on the notice, not on the outcome, and stays gone for weeks either way. Most processors charge a dispute fee of roughly $15 to $25 and keep it when you win. Below a certain order value, fighting costs more staff time than it recovers, so set a threshold: defend anything above it with evidence and accept the rest. The biggest avoidable cause is a billing descriptor nobody recognises, so put your trading name and a support phone number in it. Processors differ on ignored notices too, and where some accept liability for you and close the case, others still charge the fee.",
    ],
    example: "Day one: a customer disputes a $180 order as not received, and your processor debits the $180 plus a $15 dispute fee. You upload carrier tracking showing delivery to the AVS-matched billing address, the signed delivery confirmation and your terms. Six weeks later the issuer rules in your favour and the $180 comes back. The $15 stays with the processor. A win, and it still cost you the fee and an hour of admin.",
    faqs: [
      {
        question: "How long does a dispute take to resolve?",
        answer: "Most are settled 30 to 90 days after filing, but your own window inside that is much shorter: processors typically give you 7 to 21 days to upload evidence, and missing it is an automatic loss. The issuer then takes several weeks to rule. Add another one to three months if the case escalates to pre-arbitration or arbitration.",
      },
      {
        question: "If I refund the customer, will the dispute be dropped?",
        answer: "Not automatically, and you can easily end up paying twice. By the time a dispute is filed the issuer has usually credited the cardholder already, so a refund on top hands them the money a second time and you rarely get it back. Refund before a dispute is raised, or answer the dispute with evidence that a refund was already issued rather than sending another one.",
      },
      {
        question: "What evidence wins a dispute?",
        answer: "Proof that the genuine cardholder ordered the thing and received it. In practice: carrier tracking with delivery confirmation, an AVS and CVV match, the IP address and device used at checkout, timestamped acceptance of your terms, and your support messages. For subscriptions, add the cancellation policy and the date the customer last used the service.",
      },
    ],
    related: ["chargeback", "chargeback-ratio", "refund"],
  },
  {
    slug: "rolling-reserve",
    term: "Rolling reserve",
    short: "A portion of your sales held back for months to cover potential chargebacks.",
    definition:
      "A rolling reserve is a risk buffer: the processor withholds a percentage of each transaction (often 5% to 10%) for a set period, then releases it on a rolling basis. It protects the processor against future chargebacks but ties up cash, which is why some merchants seek processors with no rolling reserve.",
    detail: [
      "Hold 10% for 180 days and roughly six months of 10% of revenue sits permanently out of reach, earning you nothing. That balance, not the headline percentage, is the number to price: your reserve rate multiplied by sales across the whole hold period. Count it as working capital when you compare quotes, because a lower rate with a reserve attached is often the more expensive deal. Ask whether the reserve is rolling or capped. A capped one stops growing once it hits an agreed target.",
      "The mechanics are simple enough. The processor takes its percentage out of each day's settlement before paying you and parks it in an account it controls. Each held amount runs its own clock, commonly 90 or 180 days from the day it was withheld, so once the first period ends releases start arriving daily. That pot is also the processor's first source of funds for your chargebacks, refunds and fees, and if it runs short it debits your bank account directly.",
      "The rate and the period are set at underwriting and written into your merchant agreement, and most agreements let the processor raise them on notice. The reserve also outlives the account: on termination, processors typically hold what is left for the full chargeback window, often 180 days past your last transaction. Six clean months gives you something to bargain with, so ask in writing for a review and get the review date into the agreement. Check your statement for the separate reserve and reserve release lines.",
    ],
    example: "Take $200,000 a month at a 10% reserve held for 180 days. $20,000 goes in every month, and nothing comes back until month seven, when the first $20,000 is released. From then on the balance settles at around $120,000. That is your own money and you cannot spend it, and if you leave the processor it is typically held for a further six months.",
    faqs: [
      {
        question: "How long does a rolling reserve last?",
        answer: "90 to 180 days for each individual amount withheld. The reserve itself lasts as long as the processor thinks it needs one, releasing and refilling every day, so there is no end date to point at. Close the account and expect the remaining balance to be held for the full chargeback window, commonly 180 days after your last transaction.",
      },
      {
        question: "Can you get a rolling reserve removed or reduced?",
        answer: "Not on request alone, but six to twelve months of clean processing usually makes the case for you. Ask in writing, quote your chargeback ratio and refund rate, and push for a scheduled review date written into the agreement rather than a vague promise. If the processor will not move, a competing quote without a reserve is fair grounds to switch once your history supports it.",
      },
      {
        question: "Do you earn interest on money held in a rolling reserve?",
        answer: "Usually not. The funds sit in an account the processor controls, and most merchant agreements state plainly that no interest is payable to the merchant. Treat the balance as an interest-free loan you are making to your processor, and add that cost of capital to the effective rate you compare against other providers.",
      },
    ],
    related: ["chargeback", "high-risk-merchant", "underwriting"],
    relatedFacets: ["no-rolling-reserve"],
  },
  {
    slug: "high-risk-merchant",
    term: "High-risk merchant",
    short: "A business in an industry with elevated chargeback, fraud, or regulatory risk.",
    definition:
      "A high-risk merchant operates in a category banks consider riskier, such as subscriptions with free trials, travel, CBD, adult, or firearms, because of higher chargeback rates or regulation. These merchants face stricter underwriting, higher fees, and often rolling reserves, and need processors that specifically support their vertical.",
    detail: [
      "There is no agreed list. Classification is a scoring exercise, and underwriters weigh your merchant category code against chargeback history, average ticket, how long after payment you deliver, whether you sell subscriptions or free trials, cross-border exposure and the owner's credit file. Appetite is set by the acquirer's sponsoring bank, which is why the same business can be routine at one processor and prohibited at the next. Aggregators mostly decline rather than price for the risk.",
      "Whether the label ever comes off depends on why it was applied. If the category itself is the problem, such as CBD, adult or firearms, no amount of clean history reclassifies you, and what a strong record buys is better pricing and a smaller reserve. If chargebacks caused it, twelve clean months at volume can move you back. Either way the real danger is termination for excessive chargebacks, which puts the business and its owners on MATCH, the terminated-merchant file acquirers check at application.",
      "Pricing follows the risk. Expect a discount rate commonly one to two percentage points above a standard quote, higher per-transaction and chargeback fees, a monthly account fee, a rolling reserve, and payouts on a slower schedule such as weekly. Build for continuity rather than for the cheapest rate. A second merchant account with a different acquirer protects you more than shaving a fraction off the markup.",
    ],
    example: "A supplement subscription business billing $150,000 a month across 2,500 orders would pay $5,100 on a standard flat-rate quote of 2.9% + $0.30. It cannot get that quote. The high-risk offer it can actually get, 3.9% + $0.25 with a $95 monthly fee, costs $6,570, an effective rate of 4.38%. The rate gap stings. The 10% rolling reserve parking $15,000 a month is the bigger constraint, because that one is cash flow rather than price.",
    faqs: [
      {
        question: "Can a high-risk business use Stripe or PayPal?",
        answer: "Usually not. Check their prohibited and restricted business lists first, because if your category appears on one the answer is no. Aggregators onboard fast because they underwrite lightly, then manage the risk that creates by freezing funds and closing accounts rather than by pricing for it. Read the acceptable use policy before you integrate. If your model sits close to the line, start with a dedicated merchant account.",
      },
      {
        question: "How much more does high-risk payment processing cost?",
        answer: "One to two percentage points on top of a standard rate is the usual gap, plus higher fixed fees. Budget as well for a rolling reserve of 5% to 10%, a monthly account fee, chargeback fees at the higher end of the $15 to $40 range, and slower payouts. The reserve is often the larger hit to cash flow, not the rate itself.",
      },
      {
        question: "Can a business stop being classified as high risk?",
        answer: "Only when the classification came from your performance rather than your industry. If chargebacks caused it, build six to twelve months at steady volume with a chargeback ratio well under 0.5% and a low refund rate, then re-quote with statements in hand. If your category is the trigger, aim for better terms instead: tighter free-trial wording, easy cancellation, a fixed billing descriptor.",
      },
    ],
    related: ["underwriting", "rolling-reserve", "chargeback-ratio", "kyc"],
    relatedFacets: ["no-rolling-reserve"],
  },
  {
    slug: "underwriting",
    term: "Underwriting",
    short: "The risk review a processor runs before approving a merchant to accept payments.",
    definition:
      "Underwriting is the assessment a processor or acquiring bank performs before (and during) a merchant relationship, weighing business type, processing history, credit, and expected volume. It determines approval, pricing, and any reserve. Aggregators automate light underwriting for fast onboarding; traditional accounts underwrite more thoroughly.",
    detail: [
      "It starts with paperwork: the legal entity, tax ID, ownership details for anyone holding 25% or more, the deposit account and your website. Automated checks run identity and sanctions screening, a credit file on the owners and a MATCH lookup. Then an underwriter assigns your merchant category code and reads the site itself. Larger or riskier applications also need three to six months of processing and business bank statements.",
      "What comes back is rarely a clean yes or no. Approvals arrive with conditions attached: a monthly volume cap, a delayed payout schedule, a rolling reserve. Each of those has a price, and the volume cap is the one that hurts, because it turns your best month into declined transactions. Read the approval terms as carefully as you read the rate sheet, and ask in writing what it takes to have each condition lifted.",
      "Underwriting does not stop at approval. Processors watch volume, average ticket, chargebacks and refunds continuously, and a sudden spike triggers a review that can hold your settlements while it runs, so tell your risk team before a campaign, a seasonal peak or a press mention. The most common avoidable decline, though, is the website: missing refund and delivery policies, no contact address, or products that do not match what the application says you sell.",
    ],
    example: "Month four is when it breaks. You applied as a new online retailer projecting $40,000 a month at an $80 average ticket, and the underwriter approved you with a $60,000 monthly cap and two-day payouts. Then a product goes viral and you take $110,000. Settlements pause at the cap while the risk team re-reviews the account, and the fix, three months of statements plus a revised forecast, takes a week you cannot afford.",
    faqs: [
      {
        question: "How long does payment processor underwriting take?",
        answer: "Minutes with an aggregator. One to five business days for a traditional merchant account, and one to three weeks if you are high risk or need a specialised acquirer. Delays are almost always missing paperwork: unverified ownership, a deposit account in a different name, or a website that does not yet show pricing, contact and refund details.",
      },
      {
        question: "What documents do you need to get a merchant account approved?",
        answer: "Business registration and tax ID, government photo ID for every owner holding 25% or more, a bank letter or voided check for the deposit account, and a live website showing products, prices, refund policy and contact details. Above a certain size, or in a riskier category, add three to six months of processing and business bank statements.",
      },
      {
        question: "Why was my merchant account application declined?",
        answer: "Four things account for most declines: a business category the acquirer's sponsoring bank will not support, a website missing required information, poor personal credit or a MATCH listing on an owner, or projected volume far out of line with your history. Ask the processor which one it was, fix it, then apply elsewhere rather than reapplying immediately.",
      },
    ],
    related: ["merchant-account", "high-risk-merchant", "kyc"],
  },
  {
    slug: "kyc",
    term: "KYC",
    aka: ["Know Your Customer"],
    short: "Identity checks a processor must run to comply with anti-money-laundering rules.",
    definition:
      "KYC (Know Your Customer) is the identity-verification a payment provider is legally required to perform on the businesses it onboards, as part of anti-money-laundering (AML) compliance. Expect to supply business registration, ownership, and bank details before you can accept live payments.",
    detail: [
      "Most applications stall on paperwork. The provider asks for a document, nobody at your end has it to hand, and the file sits. Before you start, pull together your incorporation certificate, photo ID for every owner, a recent bank statement, and your last few processing statements. With those ready, an aggregator running automated checks can clear a straightforward single-owner business the same day. A traditional merchant account with several owners, or a holding company somewhere in the chain, takes considerably longer. KYC is not a fee. It is a timeline.",
      "What they actually collect splits in two. On the business: legal name, registration or incorporation number, tax ID, trading address, and website. On the people: full personal details for every beneficial owner holding roughly 25% or more, and for the control person who signs the agreement. Those names are screened against sanctions and politically exposed person lists, and identity documents are matched to each individual. Your settlement bank account is verified separately, usually by micro-deposit or an open-banking connection, and payouts stay off until it clears.",
      "Then it happens again. Providers re-run checks when ownership changes, when your volume runs well past what you declared, or on a routine review cycle, and they can sit on your payouts until you answer. The two triggers that catch merchants out most often are a product line you started selling and never disclosed, and a mismatch between your registered legal name and the name on your settlement bank account. Keep both current with your provider, and answer requests quickly.",
    ],
    example: "Two partners, 50% each, applying to a flat-rate processor for their consultancy. Both cross the ownership threshold, so both verify: legal name, date of birth, home address, and the last four digits of a Social Security number, with a photo ID upload requested for one of them. The company side wants the EIN and the incorporation certificate. Everything is automated, both owners clear that afternoon, and live payments switch on the next morning.",
    faqs: [
      {
        question: "How long does KYC take when opening a merchant account?",
        answer: "Same day to a couple of business days on an aggregator, if your business is straightforward. A traditional merchant account is often a week or more. Complexity is what moves the file to a human reviewer: several beneficial owners, a trust or holding company in the chain, a high-risk category, or documents that do not match your registered details.",
      },
      {
        question: "Why does a payment processor need my Social Security number?",
        answer: "Anti-money-laundering rules make the provider identify the people behind the company, not only the company itself. In the US that normally means the last four digits of a Social Security number for each owner at roughly 25% or more and for the control person, checked against identity records. Some processors also run a credit check on the signer.",
      },
      {
        question: "Is KYC the same as underwriting?",
        answer: "Different questions entirely. KYC asks who you are, and underwriting asks how risky you are to process for. One is a legal obligation under anti-money-laundering law with a pass or fail outcome. The other is a commercial decision that sets your pricing, any rolling reserve, and your volume cap. Passing KYC cleanly and still being declined or reserved by underwriting happens all the time.",
      },
    ],
    related: ["underwriting", "merchant-account", "high-risk-merchant"],
  },
  {
    slug: "pci-dss",
    term: "PCI DSS",
    aka: ["PCI compliance", "Payment Card Industry Data Security Standard"],
    short: "The security standard every business handling card data must follow.",
    definition:
      "PCI DSS is the card industry's security standard for storing, processing, and transmitting cardholder data. Compliance requirements scale with volume (Levels 1 to 4). Using a hosted checkout or tokenization shifts most of the burden to your processor and shrinks your compliance scope.",
    detail: [
      "Look at your statement first. Many processors charge a PCI non-compliance fee, commonly in the region of $20 to $40 a month, and it runs until you complete the questionnaire and attestation in their portal. Some also charge a smaller PCI service fee whether you validate or not. For a merchant with a fully outsourced checkout the questionnaire is short, so that monthly charge is buying nothing except your own inertia. Compliance itself is mostly an admin cost. Non-compliance is a line item.",
      "Your level comes from annual card volume across every channel you sell through. Level 1 sits above six million Visa or Mastercard transactions a year and brings a formal annual assessment, normally by a Qualified Security Assessor, plus quarterly scans by an approved scanning vendor. Below that you usually self-assess, using whichever Self-Assessment Questionnaire matches how the card data reaches you: SAQ A if the checkout is fully outsourced, SAQ A-EP if you host the page and it posts to a gateway, SAQ D for anything that touches card data directly.",
      "Outsourcing shrinks your scope. It does not end your obligation, and you still validate and attest every year. Version 4.0 of the standard, in full effect since 2025, also tightened the rules on scripts running on payment pages, so ask your provider what it now expects from you. Watch two habits in particular: taking card numbers over the phone or by email drags you into a heavier questionnaire, and a call recording that captures a spoken security code is a breach of the standard.",
    ],
    example: "$299.40. That is what one online shop paid for ignoring reminder emails. It takes 12,000 card transactions a year, which puts it at Level 4, and its checkout is hosted, so its obligation is SAQ A: a short self-assessment and an annual attestation in the processor's portal. Roughly an hour of paperwork. Instead the shop carried a $24.95 monthly non-compliance fee all year.",
    faqs: [
      {
        question: "Am I PCI compliant automatically if I use a hosted checkout?",
        answer: "Hosted checkout removes almost all of the technical burden and none of the paperwork. You still have to validate compliance yourself, normally by completing SAQ A and an annual attestation. Your provider answers for its own systems, not for your obligation as a merchant. Anything outside the hosted page stays yours too, including staff taking card details over the phone.",
      },
      {
        question: "How much does PCI compliance cost a small business?",
        answer: "For a small merchant on a hosted checkout, usually nothing beyond your own time, plus whatever PCI fee your processor adds. Some providers charge a small monthly PCI service fee, and many charge a non-compliance fee of roughly $20 to $40 a month if you never validate. The cost only jumps at Level 1, where engaging a Qualified Security Assessor runs into tens of thousands of dollars.",
      },
      {
        question: "What happens if I am not PCI compliant and card data is stolen?",
        answer: "Card-network fines, passed through your processor, plus the cost of a forensic investigation and card reissuance. Your acquirer can also close the account. The fines land on the acquiring bank first and flow down to you under your merchant agreement, which is why the liability clause is worth reading before you sign. Validating beforehand does not remove liability after a breach, but it improves your position substantially.",
      },
    ],
    related: ["tokenization", "hosted-checkout", "3d-secure"],
  },
  {
    slug: "tokenization",
    term: "Tokenization",
    short: "Replacing card numbers with a meaningless token so you never store real card data.",
    definition:
      "Tokenization swaps a card's real number (PAN) for a randomised token that stands in for it in your systems. Because the token is useless if stolen, it reduces PCI scope and enables safe repeat billing without holding card data yourself.",
    detail: [
      "The card number goes from the shopper's browser to the gateway, through a hosted field or iframe your own page cannot read. The gateway vaults it and hands back a token. That string has no mathematical route back to the card. You store the token against the customer record and send it for every charge after, and the gateway swaps the live number back in before the transaction reaches the network. Your customer database stops being worth stealing, which keeps PCI scope small and most breach exposure away from you. Saved cards, one-click repeat purchases, and subscriptions work without you holding anything sensitive.",
      "Mainstream providers rarely bill tokenization as a separate line item, though some gateways price the vault as an add-on, so confirm rather than assume. The real cost is portability. Most gateway tokens are proprietary and mean nothing to anyone else, so changing provider means asking your current one to hand the underlying card numbers over under a PCI-compliant migration. They will do it, rarely quickly. Ask how that works before you sign rather than on the way out. Network tokens are a different animal: the card networks issue them, and they refresh themselves when a card is reissued, which cuts subscription declines.",
    ],
    example: "A customer pays $49 on a subscription site. Their card number never touches the merchant's server. What lands in the customer table is a string like tok_9f3a1c7be24d, and that is all that sits there. Next month the billing job posts the token and the $49 amount to the gateway, which swaps in the real number and charges the card. If that database leaked, nobody could use the token to charge that card anywhere else.",
    faqs: [
      {
        question: "Is tokenization the same as encryption?",
        answer: "Encryption is reversible by design: scramble the number with a key, and anyone holding the key can unscramble it. A token cannot be reversed at all, because the mapping lives only in the provider's vault. Payments use both. Encryption protects the number while it moves, and tokenization removes the need to keep it once it arrives.",
      },
      {
        question: "Can I move my saved cards to a new payment processor?",
        answer: "The cards move, the tokens do not. You request a PCI-compliant vault migration: your old provider transfers the underlying card numbers directly to the new one, which issues fresh tokens against your customer records. Most large processors support this and many do not charge for it, but it usually takes weeks. Confirm how it works before you sign anything.",
      },
      {
        question: "Does tokenization make me PCI compliant?",
        answer: "It shrinks your scope and leaves the obligation intact. Tokenization plus a hosted field or hosted checkout usually puts you on SAQ A, the shortest self-assessment, and you still validate and attest every year. Anything that puts a live card number back in your hands, phone orders keyed in by staff being the usual culprit, pulls you into a longer questionnaire regardless.",
      },
    ],
    related: ["pci-dss", "recurring-billing", "payment-gateway", "dunning"],
  },
  {
    slug: "3d-secure",
    term: "3D Secure",
    aka: ["3DS", "Verified by Visa", "SCA"],
    short: "An extra authentication step that verifies the shopper and can shift fraud liability.",
    definition:
      "3D Secure adds a verification step, such as a bank prompt, biometric, or one-time code, to confirm the shopper is the genuine cardholder. It underpins Strong Customer Authentication (SCA) in Europe and can shift liability for fraudulent chargebacks from the merchant to the issuer.",
    detail: [
      "Two things can happen, and the shopper only notices one of them. On submit, the gateway hands device and order data to a 3DS server, which routes it through the card network's directory to the issuing bank. The issuer scores the risk and answers. Frictionless comes back in about a second, and the shopper sees nothing at all. A challenge drops the shopper onto a bank-controlled screen for a passcode, an app approval, or a biometric. Whichever way it goes, the result is carried into the authorization request that follows.",
      "Liability shift is narrower than most merchants expect. It covers fraud disputes and nothing else, so the customer who says the parcel never arrived, or that the goods were not as described, still charges back to you. It does not apply on transactions where you claimed an exemption and skipped authentication. It will not stop an issuer declining the card outright either. What it does do is real: authenticate successfully and a later fraud claim lands on the issuer, not on your account.",
      "Against that sits conversion. A challenge is an extra step, and some shoppers walk away at it, especially on mobile where the handoff to a banking app can crawl. Pricing varies too: some gateways bundle 3DS into their rate, others bill per authentication attempt, so read the fee schedule before you switch it on across the whole checkout. The US has no mandate to use 3D Secure at all, which is why most American merchants trigger it selectively through risk rules.",
    ],
    example: "An online retailer sends every order above $300 through 3D Secure and leaves the rest alone. Take a month with 1,000 of those high-value orders. Say 850 authenticate in the background, invisible to the shopper, and 150 get a bank challenge, of which 10 abandon. The retailer is out 10 sales. In exchange it holds issuer liability on the 990 orders that completed, including whichever of them come back later as fraud claims.",
    faqs: [
      {
        question: "Does 3D Secure reduce chargebacks?",
        answer: "It moves fraud liability rather than stopping disputes. Authenticate a transaction successfully and a later fraud claim is charged to the issuing bank instead of your account. Claims about delivery, product quality, or a subscription the customer swears they cancelled are untouched, and for most merchants those make up the larger share of disputes.",
      },
      {
        question: "Is 3D Secure required in the United States?",
        answer: "There is no US mandate. Strong Customer Authentication rules require most online card payments in the UK and European Economic Area to be authenticated, and 3D Secure is how cards meet that test, but nothing equivalent applies in the US. Most US merchants run it selectively, on high-value orders, address mismatches, or new customers, because applying it to every sale costs more conversion than it saves in fraud.",
      },
      {
        question: "Will 3D Secure hurt my checkout conversion?",
        answer: "Only on the sessions that get challenged, and under 3DS 2 that share is usually small. Most authentications settle in the background, because the issuer gets enough device and order data to decide without troubling the shopper. Your measurable loss sits at the challenge step, mobile worst of all, so track abandonment there rather than watching your overall rate.",
      },
    ],
    related: ["avs", "cvv", "chargeback", "pci-dss", "emv"],
  },
  {
    slug: "avs",
    term: "AVS",
    aka: ["Address Verification Service"],
    short: "A fraud check that matches the billing address entered against the card issuer's records.",
    definition:
      "AVS (Address Verification Service) compares the numeric parts of the billing address a customer enters with what the issuing bank has on file. A mismatch is a fraud signal you can use to flag or decline card-not-present transactions. It's commonly paired with a CVV check.",
    detail: [
      "AVS never declines anything. Your gateway posts the numeric street number and ZIP the shopper typed alongside the authorization request, the issuer compares them with its own records, and a single letter comes back with the approval. Y means the street number and the ZIP both matched. Z means the ZIP matched and the street number did not, A is the other way round, and N means neither matched. U or S tell you the issuer did not check. Only the digits are compared, so street names and spelling never come into it.",
      "The approval or decline is the issuer's own call, made on funds and its fraud model. The letter only tells you how well the address fitted. The rule is yours to write. In your gateway you decide to accept Y and Z, send A to review, reject N, or whatever balance suits what you sell. Too tight and you turn away customers who typed an old address. Too loose and you carry fraud you could have stopped.",
      "A rejection is not free. The issuer had already approved the authorization before your rule voided it, so the customer can see a pending hold on their card for a few days, and some processors bill an authorization fee whether or not the sale completes. Coverage is the other problem. Outside the US, Canada, and the UK, plenty of issuers simply report that no check was performed, so a rule written to catch fraud quietly starts blocking good international orders instead.",
    ],
    example: "A customer at 42 Oakfield Avenue, ZIP 90210, types '42 Oakfeild Ave' and the same ZIP 90210. AVS returns Y. The misspelling is irrelevant, because the only things compared are the digits 42 and 90210. A second order comes in with the same street number but ZIP 90211, which returns A. Reject anything other than Y and that sale is voided, most likely on a customer who moved house and never told their bank.",
    faqs: [
      {
        question: "Does an AVS mismatch mean the card is stolen?",
        answer: "Most mismatches are honest. A customer moved, the card is registered to a partner's address, or the order is a gift billed to one address and shipped to another. Treat the code as one input among several rather than a verdict: read it next to the CVV result, the order value, and what you know of the customer, and send the borderline ones to manual review instead of declining them.",
      },
      {
        question: "Does passing AVS protect me from a chargeback?",
        answer: "AVS carries no liability protection, unlike a successful 3D Secure authentication. A matching address is useful evidence when you fight a dispute, but the issuer still decides who wins. AVS earns its keep by stopping bad orders before they settle rather than by winning disputes afterwards, so treat it as a screening tool and not a shield.",
      },
      {
        question: "Does AVS work for international customers?",
        answer: "Rarely. Mainly US, Canadian, and UK issuers support it, and most other banks return a code meaning the check was not performed. Block those responses and you reject nearly every overseas order, so set your rules by issuer country. Strict AVS at home, and for international traffic lean on CVV, 3D Secure, and device or velocity checks.",
      },
    ],
    related: ["cvv", "3d-secure", "card-not-present", "virtual-terminal"],
  },
  {
    slug: "cvv",
    term: "CVV",
    aka: ["CVC", "Card security code"],
    short: "The 3-4 digit code that proves the shopper physically has the card.",
    definition:
      "The CVV (Card Verification Value) is the short security code printed on a card. Requesting it for card-not-present sales helps prove the buyer holds the physical card; card networks prohibit storing it after authorization.",
    detail: [
      "Never keep the code. Card network rules and PCI DSS forbid storing it once the transaction is authorized, in any form, and the copy that catches merchants out may not be in the database at all: a note a phone-order agent typed into your CRM counts just the same. Check where your staff write things down.",
      "The code itself is generated by the issuer from the card details, using keys only it holds. That is why it cannot be worked out from the card number, and why it is deliberately left off the magnetic stripe and the chip. Visa, Mastercard and Discover print three digits on the back; American Express prints four on the front. Your checkout sends the code up with the authorization request, and the issuer returns a separate match, no-match or not-processed result alongside its approval decision.",
      "The result is advisory, not a decline. An issuer can approve the payment and report a mismatch in the same response, so your gateway rules decide what happens next. Most gateways can void a mismatch automatically, which is the safer default for anything you ship, and it costs you a small share of good orders: typos happen, and cards get reissued with new codes. A match is useful evidence if you have to defend a dispute. It proves possession, not liability, and will not move fraud losses to the issuer the way 3D Secure can.",
    ],
    example: "Losing the order is the cheap outcome. You take a $180 online order, the billing address partly matches, the security code comes back a no-match, and your gateway voids the sale automatically. Capture it instead and let it turn out to be fraud, and you are out the goods and the $180, plus a chargeback fee commonly between $15 and $40. The dispute counts towards your chargeback ratio too.",
    faqs: [
      {
        question: "Can I store the CVV to charge the customer again later?",
        answer: "Card network rules and PCI DSS prohibit it once the transaction is authorized, encrypted or not. Repeat and subscription charges run on a stored token instead, which is why a saved card never asks for the code again. Check the places it hides: CRM records, order notes, call recordings. Anywhere it turns up is a compliance problem, and it needs removing.",
      },
      {
        question: "Does checking the CVV protect me from chargebacks?",
        answer: "Not from the ones that hurt. A match is useful evidence when you respond to a dispute, but it does not shift fraud liability to the issuer, so a card-not-present fraud chargeback still lands on you unless the transaction was authenticated through 3D Secure, which can move that liability. Treat the check as a filter that stops obvious fraud early, not as cover once the goods have gone.",
      },
      {
        question: "Should I decline every order where the code does not match?",
        answer: "Decline by default. Most gateways can void a mismatch automatically, and for shipped goods that is the right setting. Relax it only when you can see genuine customers failing: some merchants queue mismatches for manual review instead, usually on low-value digital products or for known repeat buyers. Pull the mismatch rate from your gateway reports before you choose.",
      },
    ],
    related: ["avs", "card-not-present", "3d-secure"],
  },
  {
    slug: "emv",
    term: "EMV",
    aka: ["Chip card"],
    short: "The global chip-card standard that reduces counterfeit fraud for in-person payments.",
    definition:
      "EMV (named for Europay, Mastercard, and Visa) is the standard behind chip cards, which generate a unique code per transaction to prevent cloning. Since the EMV 'liability shift', whichever party (merchant or issuer) is least chip-capable bears fraud losses on in-person transactions.",
    detail: [
      "October 2015 is the date that still costs merchants money in the US. That is when the liability shift landed, and a counterfeit card used at a terminal that cannot read chips became the merchant's loss rather than the issuer's. An old swipe-only reader converts someone else's problem into yours, one chargeback at a time. Any terminal sold today reads chip and contactless as standard, so the exposure is usually legacy hardware nobody replaced.",
      "Dipping a card starts a short conversation between the chip and the terminal. The terminal picks the card's payment application, runs its risk checks, then asks the chip for a cryptogram: a one-time code computed from the amount, a transaction counter, and a key only the issuer can verify. That cryptogram rides up with the authorization request. Because it never repeats, data copied off the card is worthless for the next sale.",
      "EMV is narrower than merchants assume. The chip stops counterfeit cards at the counter and does nothing at all for online fraud, which is exactly where card fraud moved after the shift. Fallback transactions are the other thing to watch. When a chip will not read and staff swipe instead, the sale is flagged as a fallback and carries non-chip liability. Your processor can usually report your fallback count, and a rising one normally means a dirty or failing reader.",
    ],
    example: "The same $600 laptop, the same cloned card, two different readers. The clone was made from stolen stripe data, so it has no working chip to dip: at your chip terminal the sale fails or the issuer declines it. On a swipe-only reader it sails through. Then the real cardholder disputes the charge, and you are out the laptop and the $600, plus a chargeback fee commonly between $15 and $40.",
    faqs: [
      {
        question: "Do I still need a chip reader if most customers tap?",
        answer: "You do, and in practice the same terminal does both, because contactless is EMV carried over NFC. Some cards have no contactless antenna, and some issuers ask for a dip on a first use or a high-value sale. A reader that only takes taps will turn away a share of in-person customers, so check the spec covers chip, tap and swipe.",
      },
      {
        question: "What should staff do when a chip will not read?",
        answer: "Tap first. If the chip still will not read, let the terminal prompt a fallback swipe, and keep in mind that a fallback sale carries the fraud liability of a non-chip transaction. Some acquirers monitor or block them. Repeat failures are a hardware fault, not bad luck, so clean or replace the reader. Keying the card in works as a last resort, though it prices as card-not-present.",
      },
      {
        question: "Does EMV do anything for my online sales?",
        answer: "Chip hardware and the in-store liability shift do nothing for an online order. EMVCo also publishes EMV 3-D Secure, which is the current version of 3D Secure and does apply online, but that is a separate integration from your terminal. E-commerce needs its own controls: AVS and CVV checks, velocity limits, 3D Secure where you want liability moved to the issuer.",
      },
    ],
    related: ["nfc", "card-present", "tap-to-pay"],
  },
  {
    slug: "nfc",
    term: "NFC",
    aka: ["Contactless", "Near-field communication"],
    short: "The short-range wireless tech behind tap-to-pay cards and mobile wallets.",
    definition:
      "NFC (near-field communication) lets a card or phone communicate with a terminal by tapping, powering contactless payments and digital wallets like Apple Pay and Google Pay. It's fast, and combined with tokenization it's more secure than a swipe.",
    detail: [
      "Hold a card near the reader and the terminal's own field powers the antenna inside it. That is the whole trick, and it works over an inch or two. Nothing exotic crosses the gap. What runs over the link is the same EMV exchange a chip dip uses: a one-time cryptogram from the card or phone, verified by the issuer. A phone adds a layer on top, presenting a device token rather than the real card number and using a fingerprint or face check as cardholder verification.",
      "For pricing, a tap is a card-present sale. Most US processors charge the same rate for it as for a dip, taps from a phone wallet included, so contactless should not show up as a separate line on your statement. What you buy is time at the counter, which matters when there is a queue, and no cards left behind in the chip slot. Almost any reader sold in recent years supports it.",
      "There is a ceiling on it. Above an amount each network and country sets, the cardholder has to be verified, and the terminal asks for a PIN or a signature; a wallet payment approved by biometric usually passes without one. Then check the category on your statement. If tapped sales are billed at a keyed-in or card-not-present rate, something is misconfigured in the terminal or your account, and the gap is worth chasing.",
    ],
    example: "Four seconds a sale sounds like nothing. A cafe taking 400 card sales a day gets close to half an hour of counter time back, because a chip dip ties up the terminal for several seconds while the card sits in the slot and a tap clears in about one. And it costs nothing extra: a contactless sale is card-present, in the same interchange category as the dip it replaced.",
    faqs: [
      {
        question: "Does accepting contactless cost more than chip payments?",
        answer: "Most US processors price a tap exactly like a chip dip, because both are card-present transactions and take card-present interchange. That includes taps from Apple Pay and Google Pay. If contactless or wallet volume shows up on your statement at a higher rate than chip volume, ask your provider which category it was billed under.",
      },
      {
        question: "Is there a maximum amount a customer can tap?",
        answer: "Each card network sets a ceiling, above which the cardholder has to be verified and the terminal asks for a PIN or a signature. The limit varies by network and country, and it has risen over the years. Payments from a phone wallet usually clear it without a prompt, because the device already verified the customer with a biometric.",
      },
      {
        question: "Do I need to buy a new terminal to accept NFC?",
        answer: "Probably not. Card readers sold in recent years handle chip, tap and swipe in one device, marked with the contactless wave symbol. If yours predates contactless, replacing it usually costs less than the sales you lose to customers carrying only a phone. Ask your processor before you buy, because some may swap the hardware at no charge, particularly at contract renewal.",
      },
    ],
    related: ["tap-to-pay", "digital-wallet", "emv"],
    relatedFacets: ["tap-to-pay", "apple-pay", "google-pay"],
  },
  {
    slug: "tap-to-pay",
    term: "Tap to Pay",
    short: "Accepting contactless payments directly on a phone, with no separate card reader.",
    definition:
      "Tap to Pay uses a compatible phone's built-in NFC to read contactless cards and wallets, turning the device itself into a terminal. It removes the need to buy hardware, which makes it popular with mobile sellers and pop-ups.",
    detail: [
      "A phone reads contactless and nothing else. That is the constraint the rest hangs off: a customer holding a chip-only or magnetic-stripe card has no way to pay you, so you need a fallback ready, a payment link or a keyed sale, both of which cost more. Your till is also a phone now. Battery life and patchy signal turn into trading risks, and so does a staff member wandering off with the handset. Check the app supports separate staff logins.",
      "Setting it up means installing your processor's app on a supported phone and passing its verification checks, after which the app switches on the handset's built-in NFC reader. The customer holds a card, phone or watch against your handset where the app indicates, the same contactless EMV exchange runs, and the app sends the authorization through your processor. The phone's secure hardware handles the card data, so the app in front of you never receives the full card number.",
      "What you save is hardware. A countertop terminal is a few hundred dollars to buy, or a monthly line on a lease, and taking payments on a phone you already own removes both. The rate is where the saving can disappear. Some providers price their phone product exactly like their terminal; others set it slightly higher. Compare both quotes against the volume you actually take, not the volume you hope for.",
    ],
    example: "Start with the reader you did not buy: around $200 up front. Now take $6,000 a month over 300 in-person sales. At 2.6% + $0.10 your fees are $186, and if your provider prices its phone product 0.3 points above its terminal rate you are paying $18 a month more, so the hardware you skipped would have paid for itself in about eleven months.",
    faqs: [
      {
        question: "Can Tap to Pay replace a card reader completely?",
        answer: "Only if every customer can tap. Your phone reads contactless cards and wallets, so a chip-only or magnetic-stripe card has no route through it at all. Most sellers keep a fallback ready: a payment link, an invoice, a keyed sale in a virtual terminal. Each of those prices as card-not-present and leaves the fraud risk with you.",
      },
      {
        question: "Which phones support Tap to Pay?",
        answer: "Recent iPhones on a current iOS release, plus Android devices that meet your provider's security requirements, so it depends on the handset and the processor together. Rooted or jailbroken phones are excluded. Check the supported-device list before you commit, and remember that older handsets drop off it as the manufacturer stops issuing security updates.",
      },
      {
        question: "Is taking payments on a phone as secure as using a terminal?",
        answer: "In the ways that decide your liability, it is. Card data is handled by the phone's secure hardware, the app never sees the full number, and the sale counts as card-present for fraud purposes exactly as a terminal sale does. Your real exposures are ordinary phone risks: a lost device, shared logins, staff taking payments on personal handsets.",
      },
    ],
    related: ["nfc", "digital-wallet", "card-present", "emv"],
    relatedFacets: ["tap-to-pay", "apple-pay", "google-pay"],
  },
  {
    slug: "digital-wallet",
    term: "Digital wallet",
    aka: ["Mobile wallet"],
    short: "A stored-card app like Apple Pay or Google Pay that speeds up secure checkout.",
    definition:
      "A digital wallet stores a customer's cards on their device and pays with a tokenised, biometric-approved tap or click, for example Apple Pay, Google Pay, or PayPal. Wallets cut checkout friction and reduce fraud because the real card number is never shared.",
    detail: [
      "Wallets do not have a price of their own. The channel does. A tap in your shop is card-present and costs what any chip sale costs; the same wallet on your website is card-not-present and takes card-not-present interchange. Apple Pay and Google Pay levy no merchant fee of their own, though a wallet that is also its own payment brand, such as PayPal, prices separately. On a phone the wallet button also removes the card entry form, which is where mobile checkouts most often stall.",
      "Adding a card to a wallet provisions a device account number: a token only the card network can map back to the real card. At payment the device signs a one-time cryptogram with that token, and the fingerprint, face or passcode check stands in as cardholder verification. In person the token reaches you over NFC. Online it arrives through a browser or app interface your gateway exposes. Either way, the card number never passes through your systems.",
      "Two things surprise merchants. Your records show the last four digits of the device token rather than the customer's own card, so a shopper reading their statement to your support team will quote a number that does not match yours; refunds still route correctly. The other is a setup step. Accepting Apple Pay on the web needs domain verification in your gateway, which is the usual reason a wallet button works in testing and never appears on the live site.",
    ],
    example: "A customer pays $95 on your website with a wallet. That is card-not-present, so on a flat rate of 2.9% + $0.30 you pay $3.06, exactly what a typed card number would have cost. Move the same purchase into your shop, where the wallet is tapped rather than clicked, and it prices as card-present: 2.6% + $0.10, so $2.57. The wallet changed the security, not the price.",
    faqs: [
      {
        question: "Does accepting Apple Pay or Google Pay cost extra?",
        answer: "US merchants pay no separate Apple Pay or Google Pay fee, because those wallets earn from the card side rather than from you. You pay your normal rate for the channel: card-present when the customer taps in store, card-not-present when they pay online. On your statement, wallet volume should sit in the same categories as ordinary card volume.",
      },
      {
        question: "Do I need a separate merchant account to accept digital wallets?",
        answer: "A wallet payment is a card payment underneath, so it settles through the merchant account you already have. Turning it on is normally a switch in your gateway, plus a domain verification step for the web. If a provider quotes a separate contract or an extra monthly fee for wallets, ask exactly what it covers before you sign.",
      },
      {
        question: "Why does a wallet payment show a different card number from the customer's statement?",
        answer: "The wallet pays with a device token rather than the card itself, so your records end in the last four digits of that token while their statement shows the funding card. Refunds still reach the right card, because the network maps the token back. Brief your support team, or they will spend time chasing a mismatch that is not an error.",
      },
    ],
    related: ["nfc", "tap-to-pay", "tokenization", "emv", "bnpl"],
    relatedFacets: ["apple-pay", "google-pay"],
  },
  {
    slug: "bnpl",
    term: "Buy now, pay later",
    aka: ["BNPL"],
    short: "Letting customers split a purchase into instalments while the merchant is paid up front.",
    definition:
      "Buy now, pay later (BNPL) lets shoppers pay in instalments while the provider pays the merchant the full amount immediately and takes on repayment risk. It can raise average order value and conversion, in exchange for a fee usually higher than a standard card transaction.",
    detail: [
      "The fee is the decision. BNPL commonly lands somewhere in the region of 3% to 6% of the order plus a small fixed amount, deducted before payout, against roughly 2.5% to 3% on a card sale. Providers price by plan. A pay-in-4 arrangement normally costs less than a longer interest-free instalment plan, because the provider funds the balance for longer. Work out whether the bigger baskets, and the orders you would otherwise have lost, cover that gap at your margin.",
      "The option sits next to the card fields at checkout. The provider scores the application in seconds, usually with a soft credit check that leaves no mark on the shopper's credit file, and approves or declines on the spot. Approved orders confirm straight away. You are paid the order value less the provider's fee on its payout schedule, not as the customer repays, and the shopper settles up with the provider, most often in four payments over six weeks.",
      "Repayment risk and dispute risk are different things, and the provider only takes the first. If a customer says the goods never arrived or arrived faulty, the provider refunds them and recovers the money from you. BNPL also settles on its own schedule with its own fee line, separate from your card volume, so it sits outside your card effective rate until you deliberately fold it in.",
    ],
    example: "A $600 sofa costs a furniture shop $15.70 to take on a card at 2.6% + $0.10, leaving $584.30. Through a pay-in-4 provider at 5% + $0.30 the fee is $30.30 and $569.70 lands, so $14.60 less. Whether that matters depends on margin: at 40% gross on a $600 order, one extra sale in sixteen pays for the added cost on the other fifteen.",
    faqs: [
      {
        question: "Is BNPL more expensive than accepting a credit card?",
        answer: "Yes, and the gap is rarely small. Most BNPL providers charge several percent of the order plus a small fixed fee, commonly around double what a typical card sale costs you. That premium buys two things: a provider carrying the repayment risk and funding the instalment plan, and whatever conversion and basket-size lift the option brings you.",
      },
      {
        question: "What happens if a BNPL customer stops paying?",
        answer: "You keep the money. The provider approved the shopper, so collection and any late fees are its problem, as is the loss if the debt is never recovered. That protection covers non-payment and nothing else. If the shopper disputes the order itself, for non-delivery or a faulty item, the provider refunds them and takes the amount back out of your account.",
      },
      {
        question: "How do refunds work with buy now, pay later?",
        answer: "You refund through the BNPL provider rather than the card networks, and that cancels or reduces the shopper's remaining instalments. A partial refund usually shrinks the later payments instead of sending cash back, so a customer who has paid one instalment may see very little of it directly. Check whether your provider returns its transaction fee on a refunded order, because many keep it.",
      },
    ],
    related: ["digital-wallet", "recurring-billing"],
    relatedFacets: ["bnpl"],
  },
  {
    slug: "card-present",
    term: "Card-present",
    aka: ["CP"],
    short: "An in-person transaction where the physical card is dipped, tapped, or swiped.",
    definition:
      "A card-present transaction is one where the card is physically read at a terminal by chip, tap, or swipe. Because it carries less fraud risk than online payments, card-present interchange rates are typically lower than card-not-present.",
    detail: [
      "Card-present describes how the card was read, not where the customer was standing. Key a number into your countertop terminal because the chip will not read, and the sale prices as keyed, at a higher rate, with none of the liability protection the chip would have carried. Your statement will show it. Look for lines labelled keyed, downgrade, or non-qualified, and count how often they appear against your total.",
      "Underneath, the terminal reads the card, and for chip and contactless payments the card generates a one-time cryptogram tied to that transaction. The terminal sends that with your merchant details to the processor, which routes the request through the card network to the issuing bank. The issuer validates the cryptogram, checks the funds, and returns an approval code, usually within a couple of seconds. The sale then sits in the day's batch until settlement, and settling late can cost you.",
      "That read is what makes these the cheapest card sales you can take. Interchange for in-person retail is set below the equivalent remote category, and flat-rate processors publish a separate in-person rate, commonly around 2.6% + $0.10 against 2.9% + $0.30 for online sales. The chip also leaves counterfeit-fraud liability with the issuer, so a cloned card used at your chip reader is not your loss. What you pay for that is terminals, bought and maintained.",
    ],
    example: "A failing chip reader is not a small problem. Take a coffee shop doing $18,000 a month across 1,200 terminal sales averaging $15: at an in-person 2.6% + $0.10 that is $468 plus $120, so $588 in fees. Force 150 of those sales to be keyed at 3.5% + $0.15 and that slice costs $101 rather than $74. Roughly $28 a month, or $330 a year, from one piece of hardware.",
    faqs: [
      {
        question: "Is a card-present rate always cheaper than an online rate?",
        answer: "Almost always, and the exceptions are narrow. Interchange for in-person retail sits below the equivalent card-not-present category because the chip proves the card was there, and processors pass that gap on in their published rates. US regulated debit is capped whichever way the card is taken, and premium rewards cards stay expensive in both channels.",
      },
      {
        question: "Does tapping a phone count as a card-present transaction?",
        answer: "It does. The terminal reads a tap from Apple Pay or Google Pay exactly as it reads a contactless card, so it qualifies for card-present pricing and the same liability treatment. Wallet payments also present a device-specific token rather than the real card number, which is why they carry slightly lower fraud risk than a piece of plastic.",
      },
      {
        question: "Can I still get a chargeback on a card-present sale?",
        answer: "Far fewer than online, but yes. Chip and contactless payments close off the counterfeit-fraud reason codes behind most disputes. What remains is the customer who says they never authorized the purchase, or that a subscription was cancelled, or that the goods were not as described. Keep your terminal receipts and batch records, because that is the evidence which wins a card-present dispute.",
      },
    ],
    related: ["card-not-present", "emv", "tap-to-pay", "batch"],
  },
  {
    slug: "card-not-present",
    term: "Card-not-present",
    aka: ["CNP"],
    short: "A remote transaction, online, phone, or mail, where the card isn't physically read.",
    definition:
      "A card-not-present (CNP) transaction is any payment where the card isn't physically present: e-commerce, phone (MOTO), and mail orders. CNP carries higher fraud risk and higher interchange, so fraud tools like AVS, CVV, and 3D Secure matter most here.",
    detail: [
      "Plenty of merchants think of this as their website. It is broader than that. Deposits taken over the phone, emailed invoices, and repeat billing on a saved card are all card-not-present, even for a shop with a counter and a terminal. Anywhere the card itself is not read, you are in this category, paying its rates and carrying its risk.",
      "The rate is only half of it. Card-not-present interchange is higher, and flat-rate processors publish a higher online rate to match. Liability is the bigger number: fraud losses on a remote sale fall on you by default, and each dispute carries a fee of roughly $15 to $25 that many processors keep even when you win the case. Running 3D Secure on risky orders is the main way to push that liability back to the issuer.",
      "Card number, expiry date, and security code go in remotely, typed by the customer at checkout or by your staff in a virtual terminal. The gateway encrypts them and forwards them to the processor with the signals the issuer wants: billing address for the AVS check, the security code, device and IP data, any 3D Secure result. Back comes an approval or decline, plus separate match codes for the address and the security code. An approval is not a verdict on the order. The issuer can approve a sale and still flag an address mismatch, which most gateways let through unless you set a rule to hold or reject.",
    ],
    example: "An equipment dealer runs $40,000 a month in two channels. In store: $30,000 across 400 sales at 2.6% + $0.10, costing $820. Online: $10,000 across 120 sales at 2.9% + $0.30, costing $326. Shift $5,000 of counter volume to the website and the rate difference alone adds $15 a month, plus $0.20 on each of those sales. One $400 fraud chargeback would wipe out more than a year of that gap.",
    faqs: [
      {
        question: "Why do card-not-present transactions cost more to process?",
        answer: "The issuer cannot confirm the card was physically there, so the networks price that risk into interchange, publishing separate and higher categories for remote sales. Your processor then adds its markup on top. On published flat rates the gap is commonly around a quarter to half a percentage point, plus a higher fixed fee per transaction.",
      },
      {
        question: "Does an approved card-not-present transaction mean the payment is safe?",
        answer: "No, and the two are barely related. Approval means the issuer found the card valid and the funds available, nothing more, and says nothing about whether the person typing the number owns it. Read the AVS and security-code responses that arrive alongside the approval. An address mismatch on a high-value or rush-delivery order is reason enough to hold it for review.",
      },
      {
        question: "Who pays for fraud on a card-not-present sale?",
        answer: "You do, in almost every case. Without a chip read to prove the card was present, the merchant carries liability for fraudulent remote transactions, and the disputed amount plus a dispute fee comes back out of your account. The exception worth building for is a sale authenticated with 3D Secure, which shifts liability for that fraud type to the issuing bank.",
      },
    ],
    related: ["card-present", "moto", "avs", "cvv", "virtual-terminal"],
    relatedFacets: ["with-virtual-terminal"],
  },
  {
    slug: "moto",
    term: "MOTO",
    aka: ["Mail order / telephone order"],
    short: "Taking card payments by phone or mail, keyed into a virtual terminal.",
    definition:
      "MOTO (mail order / telephone order) covers payments a business keys in manually after taking card details by phone or mail. It's a card-not-present method usually run through a virtual terminal, and keyed-in rates are higher than card-present ones.",
    detail: [
      "MOTO is the most expensive routine way to take a card. Keyed sales fall into the highest interchange categories and carry full fraud liability, and the compliance cost lands on top. The moment a member of staff hears a card number, your phone handling and your call recording come into PCI scope, along with anything anyone writes down. Numbers left on an order pad, or sitting in a stored recording, are a common compliance failure.",
      "The sale itself is ordinary enough. The customer reads out their card number, expiry date, security code, and billing address; your staff key those into a virtual terminal or a POS screen and flag the sale as a mail or telephone order, which sets the indicator the issuer sees. From there it authorizes like any remote payment, returning an approval alongside AVS and security-code match results. One precondition: your merchant account has to be approved for MOTO during underwriting.",
      "Your processor approved you for a declared mix of channels, so a retail account that suddenly runs a third of its volume by phone can trigger a review, and with it a reserve or a hold on funds. The other thing worth knowing is that keying is often avoidable. Send a payment link during the same call and the customer pays on a hosted page, which keeps the card number away from your staff and usually prices as ordinary e-commerce.",
    ],
    example: "A commercial cleaning firm keys 60 phone orders a month, averaging $250, so $15,000 of volume. At a typical keyed rate of 3.5% + $0.15 that is $525 plus $9, or $534. The same $15,000 through payment links at 2.9% + $0.30 costs $435 plus $18, or $453. Roughly $81 a month saved, and card numbers stay out of staff phone calls.",
    faqs: [
      {
        question: "Is taking card details over the phone legal and PCI compliant?",
        answer: "Legal, yes, and compliant as long as the details are never stored. Key the number straight into a virtual terminal while the customer is on the line. Do not write it down, do not save it in a CRM note, and do not leave it sitting in a call recording. The security code can never be stored after authorization.",
      },
      {
        question: "Do I need a special merchant account for MOTO payments?",
        answer: "MOTO is a setting on the account you already have with most providers, not a separate account. During underwriting you declare the share of volume you expect to key in, and the processor prices and approves on that basis. Some high-risk categories are refused MOTO outright, and processing well above your declared share can trigger a risk review.",
      },
      {
        question: "How much more does a MOTO transaction cost than an in-person one?",
        answer: "Roughly half a percentage point to a full point more than a card-present sale. Keyed transactions fall into the highest interchange categories, and flat-rate processors typically publish a separate keyed rate near 3.5% + $0.15 against 2.6% + $0.10 in person. On $10,000 of monthly phone volume that difference is close to $90.",
      },
    ],
    related: ["card-not-present", "virtual-terminal"],
    relatedFacets: ["with-virtual-terminal"],
  },
  {
    slug: "virtual-terminal",
    term: "Virtual terminal",
    short: "A web page in your dashboard for keying in card payments without hardware.",
    definition:
      "A virtual terminal is a secure form in your payment dashboard where staff manually enter a customer's card details to take a payment. It's the standard tool for phone and mail (MOTO) orders and for businesses that don't have a physical card reader.",
    detail: [
      "You sign into your processor's dashboard, open the virtual terminal, and type in the amount along with the card number, expiry date, security code, and billing address. The form posts to the same gateway your website checkout would use, so it authorizes in real time and settles in that day's batch with everything else. Most send the customer a receipt, hold a reference for reconciliation, and let you refund from the same screen. The terminal is usually included with the account, though gateway-led providers may bill $10 to $25 a month for it.",
      "Pricing is where a virtual terminal actually costs you. Every sale you key in is a card-not-present, keyed transaction at your highest standard rate, and the fraud liability stays with you. 3D Secure cannot run, because the cardholder is not there to answer the challenge. Access matters too: anyone with a login can take a payment or push a refund, so give staff individual users and keep refund rights narrow. And teams drift into keying out of habit, for sales a payment link or an invoice would handle more cheaply. Pull a monthly count and ask which of them needed it.",
    ],
    example: "A wholesale supplier keys 40 phone orders a month into the virtual terminal, averaging $600 each. That is $24,000 at 3.5% + $0.15, or $846, plus a $15 gateway fee: $861. Move 30 of those orders to emailed payment links at 2.9% + $0.30 and the monthly total drops to about $758. A saving of roughly $1,200 a year, for changing nothing but how the customer is asked to pay.",
    faqs: [
      {
        question: "Is a virtual terminal the same as a payment gateway?",
        answer: "No. A gateway is the plumbing that carries card data to the processor; a virtual terminal is one front end sitting on top of it, a web form your staff type into. A website checkout, a payment link, and a virtual terminal can all feed the same gateway. What separates them is who enters the card details, and where.",
      },
      {
        question: "Do I need a website to use a virtual terminal?",
        answer: "Not at all. It runs from your processor's dashboard in a browser: no website, no hardware, and no integration work. That makes it the usual starting point for a tradesperson or a clinic, and for wholesalers who invoice or take orders by phone. You do still need an approved merchant account with mail and telephone order processing enabled on it.",
      },
      {
        question: "Is it cheaper to use a virtual terminal or a payment link?",
        answer: "The link, normally. Keying a card into a virtual terminal is priced as a keyed transaction, typically your most expensive standard rate, while a link is priced as ordinary e-commerce. It is safer as well, because the customer types their own card number on the processor's hosted page and it never passes through your staff or your systems.",
      },
    ],
    related: ["moto", "card-not-present", "payment-link"],
    relatedFacets: ["with-virtual-terminal", "with-payment-links"],
  },
  {
    slug: "payment-link",
    term: "Payment link",
    short: "A shareable link that lets a customer pay on a hosted page, no website required.",
    definition:
      "A payment link is a URL you create for a set or custom amount and send by email, text, or social; the customer pays on the processor's hosted page. It's the fastest way to get paid without building a checkout, popular with freelancers and service businesses.",
    detail: [
      "A link stays payable until you cap it. Mark one-off invoices single-use, or you will end up refunding the client whose accounts team paid the forwarded email a second time. The other trap is liability. Nobody was present to look at the card, so a disputed link payment is yours to lose, and 3D Secure is worth switching on for customers you have never dealt with. Put an invoice number in the link's reference field and the payout report reconciles without guesswork. Refunds, disputes and reporting otherwise behave like any other online sale.",
      "You create one in the dashboard or through the API: an amount, fixed or open for the customer to type in, a currency, a description, and often an expiry date or a usage limit. Back comes a unique URL, usually on the processor's own domain, carrying your business name and logo. The customer pays on it by card or wallet and the money settles into your usual account on your usual payout schedule. The link itself normally costs nothing extra. Since the customer keys the card in, it prices as card-not-present, at your standard online rate rather than the cheaper card-present one, and the invoicing and subscription modules built on top of links are a separate matter, often sold as paid add-ons.",
    ],
    example: "A consultant wraps up a $2,400 project and emails a payment link instead of a bank-transfer invoice. The client pays by card that afternoon. On flat-rate pricing of 2.9% + $0.30 the fee is $69.90, and $2,330.10 lands on the normal payout schedule. Offer a bank debit option on the same link and the flat ACH fee of a few dollars keeps roughly $65 more.",
    faqs: [
      {
        question: "Do I need a website to take payments with a payment link?",
        answer: "No. The payment page belongs to your processor, so all you need is an account and some way to send the URL: email, text message, WhatsApp, a social bio, or a QR code printed on a card. Plenty of freelancers and service businesses run entirely on links and never build a checkout at all.",
      },
      {
        question: "Do payment links cost more than a normal online checkout?",
        answer: "Same rate, almost everywhere: processors price a link as a card-not-present sale, exactly as they price their hosted checkout. The cost sits in the layer above it, an invoicing, subscription or billing module commonly sold as a paid add-on. Check whether the quote you were given covers those features or only the raw transaction.",
      },
      {
        question: "Can the same payment link be paid twice?",
        answer: "Easily, unless you set it to expire or limit it to one use. The URL has no idea who is opening it, so a forwarded email or a refreshed page can produce a second payment, usually from a client's accounts team. Create a single-use link tied to the invoice for anything one-off. For a published price, a reusable link is exactly what you want.",
      },
    ],
    related: ["hosted-checkout", "virtual-terminal", "recurring-billing"],
    relatedFacets: ["with-payment-links", "with-invoicing"],
  },
  {
    slug: "hosted-checkout",
    term: "Hosted checkout",
    short: "A prebuilt payment page hosted by the processor, reducing your PCI burden.",
    definition:
      "Hosted checkout redirects customers to a payment page hosted and secured by the processor, so card data never touches your servers. It's quick to implement and shrinks your PCI scope, at the cost of some control over the checkout experience.",
    detail: [
      "The reason to use one is SAQ A. Card data never reaches your servers, so your PCI DSS obligation usually collapses to that questionnaire, the shortest of them, rather than the far longer versions that apply when card fields sit on your own pages. It saves audit time and removes a category of breach risk. What you give up is control: the provider's layout, the fields it supports, whatever address or upsell logic it has chosen to offer. Larger merchants tend to move to an embedded form later for exactly that reason.",
      "The flow itself is short. Your server tells the processor what is being bought, the line items, the amount, the currency, and the URLs to return to, and gets back a session identifier. The customer lands on a page served from the processor's domain, or an overlay drawn from it, and types the card number into fields your code cannot read. The processor authorizes, sends the customer to your success URL, and separately posts a webhook to your server confirming what happened.",
      "Trust the webhook, not the redirect. Someone who pays and then closes the tab never reaches your success page, so an order marked paid only on return will simply go missing. Two more questions before you commit. Can the page run on your own domain, and does the provider charge for that? And can saved-card tokens be exported if you leave? A hosted checkout is the hardest part of a stack to migrate, which makes the second answer matter more than it looks on day one.",
    ],
    example: "A $95 order, paid on the provider's page. Your server opens a checkout session, the browser hands the customer over, the card is authorized, and they come back to your thank-you page while a webhook marks the order paid. At 2.9% + $0.30 the fee is $3.06 and you keep $91.94. No card number ever touched your server, so the annual PCI paperwork stays SAQ A.",
    faqs: [
      {
        question: "Does a hosted checkout make me PCI compliant?",
        answer: "Not automatically, though it does change what compliance means for you. Card data never reaching your systems is what qualifies most merchants for SAQ A, the shortest self-assessment, instead of a questionnaire covering your own servers and network. You still complete and submit it yourself. You still keep skimming scripts off the pages that lead to the redirect, and you still answer honestly about any other card handling, phone orders included.",
      },
      {
        question: "What is the difference between hosted checkout and an embedded payment form?",
        answer: "Where the card fields live. A hosted checkout sends the shopper to a page on the provider's domain. An embedded form keeps them on yours and loads the input fields from the provider inside an iframe. Both keep card data out of your servers and both usually qualify for a reduced PCI scope, so the choice comes down to layout control, where the embedded version wins comfortably.",
      },
      {
        question: "Does redirecting to a hosted checkout lose sales?",
        answer: "A small amount of conversion, yes, mostly on mobile and mostly when the page looks nothing like the site the shopper just left. The fixes are dull and they work: use the provider's branding options so the logo and colours match, keep the wallet buttons (Apple Pay, Google Pay) at the top, and check that the back button lands on a cart that still holds the items.",
      },
    ],
    related: ["payment-gateway", "pci-dss", "payment-link", "bnpl"],
    relatedFacets: ["for-shopify", "for-woocommerce"],
  },
  {
    slug: "recurring-billing",
    term: "Recurring billing",
    aka: ["Subscription billing"],
    short: "Automatically charging a saved payment method on a repeating schedule.",
    definition:
      "Recurring billing charges a customer's stored (tokenized) card or bank account on a set schedule (weekly, monthly, or annually) without re-entering details. It's the backbone of subscriptions and needs dunning logic to recover failed payments.",
    detail: [
      "Customers authenticate the first charge the way they would any other purchase, and that is the one doing the heavy lifting: the processor stores a token against their record together with your mandate to bill again. After that a plan holds the amount, the interval and the next billing date. On that date the processor submits a merchant-initiated transaction flagged as recurring, telling the issuing bank no cardholder is present. Success or failure comes back by webhook.",
      "Every renewal prices as a card-not-present sale. On flat-rate pricing that costs what any other online charge costs, and the fixed per-transaction fee lands hardest on cheap plans. Billing software usually sits on top of that, commonly at a small percentage of recurring revenue. High-ticket and B2B subscriptions push customers towards ACH or SEPA Direct Debit for that reason: the fee is flat and does not grow with the invoice.",
      "Cards expire and get reissued, so a share of your renewals fails every month for reasons that have nothing to do with the customer wanting to leave. Account updaters and dunning belong in the setup, not on a list of optional extras. The other cost is easy to miss, and it is the billing descriptor. A vague one turns a forgotten subscription into a chargeback, so put a recognisable trading name and a support number on the statement line.",
    ],
    example: "3.51%. That is the effective rate when 500 subscribers pay $49 a month, or $24,500 of volume, on pricing of 2.9% + $0.30: $710.50 in percentage fees, $150 in per-transaction fees, $860.50 in total. Those 500 fixed fees are about a sixth of the bill, which is the argument for annual plans. Bill the same 500 people $588 once a year and the fixed fees come to $150, not $1,800.",
    faqs: [
      {
        question: "Do customers have to approve every recurring payment?",
        answer: "Only the first one. That charge is cardholder-initiated, may trigger a 3D Secure prompt, and is where the customer agrees to be billed again; in Europe it is also what keeps later charges outside Strong Customer Authentication. Renewals run as merchant-initiated transactions against the stored token, with no prompt and nothing for the customer to do, so your cancellation route has to be easy to find.",
      },
      {
        question: "Is recurring billing the same as a subscription management platform?",
        answer: "They get sold together, which is where the confusion starts, but recurring billing is only the charging mechanism. A subscription platform is the logic around it: plans, upgrades, proration, trials, coupons, invoices, tax, dunning. Some processors bundle both and some sell the second as a paid module, so when you compare quotes, check which side of that line each price covers.",
      },
      {
        question: "Is ACH cheaper than cards for subscriptions?",
        answer: "Once the ticket is large, yes. ACH usually costs a small flat fee rather than a percentage, so a $500 monthly invoice can cost a few dollars instead of roughly fifteen. What you trade is timing and certainty: funds take a few business days to clear, and a returned debit can land days after you thought the payment was good, sometimes after you have delivered the service.",
      },
    ],
    related: ["tokenization", "dunning", "ach", "bnpl"],
    relatedFacets: ["with-invoicing"],
  },
  {
    slug: "dunning",
    term: "Dunning",
    aka: ["Failed-payment recovery"],
    short: "Automated retries and reminders that recover failed recurring payments.",
    definition:
      "Dunning is the process of recovering revenue when a recurring payment fails, through smart retries, card-updater services, and customer emails prompting an update. Good dunning meaningfully reduces involuntary churn for subscription businesses.",
    detail: [
      "A failed renewal arrives with a decline code, and the code, not your schedule, decides what happens next. Soft declines, insufficient funds, a temporary issuer problem, a velocity limit, are worth retrying, so the schedule spaces three or four attempts across roughly two weeks, often timed for the days salaries land. Hard declines are a different animal: a closed account or a card reported stolen should not be retried at all. Running alongside the retries, an account-updater service asks the networks for refreshed card details while your emails ask the customer to fix it.",
      "There is a ceiling on all this. The card networks cap how often a declined recurring transaction may be re-presented inside a set window, and hammering a hard-declined card can bring fines from your processor. Cost creeps in as well: some processors bill a small fee for every declined authorization, so an aggressive schedule running across thousands of subscribers earns its own line on the statement.",
      "The money at stake is bigger than most owners expect, because failed cards are a steady monthly leak rather than a one-off, and winning back a customer who never intended to leave costs a few automated emails against the full price of acquiring a replacement. What usually breaks is delivery. Dunning emails land in spam or go to an address nobody reads, so send the update-card link from your normal support address, keep it working without a login, and show the notice inside the product as well.",
    ],
    example: "Bill 2,000 subscribers $30 a month, lose 7 renewals in every 100, and $4,200 is at risk that month. Retries and an account updater that recover just over half of it keep about $2,310, roughly $27,700 across a year. Recovery is cheap: three attempts on each of the 140 failures is 420 authorizations, about $42 at $0.10 per attempt.",
    faqs: [
      {
        question: "How many times should you retry a failed subscription payment?",
        answer: "Three or four, spread over about two weeks. Spacing matters more than volume: retry the next day, then a few days later, then near the end of the month when salaries land. Stop the moment you get a hard decline, a closed or stolen card, because those will never succeed and the networks limit how often a declined charge may be re-presented.",
      },
      {
        question: "What is involuntary churn?",
        answer: "A customer lost to a failed payment rather than a decision to cancel. The card expired, or was reissued after fraud, or there was simply no money on it on the billing date, and the subscription lapsed while the customer still wanted the product. It is the churn dunning exists to prevent, and the cheapest kind to win back.",
      },
      {
        question: "Is dunning included with my payment processor?",
        answer: "The basic version usually is. Most processors with a subscription product ship a configurable retry schedule and a set of failed-payment emails. What costs extra is the card account updater, which some bill per card refreshed, and anything cleverer than a fixed retry rule. Dedicated recovery tools sell that layer on its own, normally for a share of what they recover.",
      },
    ],
    related: ["recurring-billing", "tokenization"],
  },
  {
    slug: "multi-currency",
    term: "Multi-currency",
    short: "Accepting payment in customers' currencies and settling in yours.",
    definition:
      "Multi-currency processing lets you present prices and take payment in several currencies, then settle to your account, sometimes in the original currency, sometimes converted at an FX margin. Local-currency pricing improves international conversion; watch the conversion spread each processor charges.",
    detail: [
      "Two charges usually sit on an international sale, and neither is the one you negotiated. The conversion margin comes first, commonly in the region of 1% to 2% above the mid-market rate and higher with some providers. Then the cross-border or international card fee, often around 1%, which applies whenever the card was issued outside your own country. Together they can add more than your entire processing markup, so an international mix changes which processor is actually cheapest for you.",
      "Which of you pays for the conversion depends on how you price. With local pricing you display and charge in the customer's currency, and the swap happens on your side when the processor settles, either into a currency-specific balance you hold or into US dollars at the processor's rate. Charge in dollars instead and the customer's issuing bank does the conversion, adding its own foreign transaction fee to their statement. Hold a balance in a currency you also spend, on suppliers or contractors, and you avoid the margin entirely.",
      "The margin never shows up on a statement, because it is baked into the exchange rate rather than itemised as a fee. You can work it out. Take the amount your processor settled before card fees, divide by the amount the customer was charged, and compare that rate with the mid-market rate for the day. Refunds are the other trap: many processors convert them back at the rate on the refund date, so a rate that has moved leaves you short.",
    ],
    example: "EUR 5,000 of euro sales in a month, at an assumed mid-market rate of $1.08, is $5,400 of value. Convert at a 2% margin and you receive about $5,292, so the spread alone costs $108. Add the cross-border fee of 1%, roughly $54, and currency handling has taken $162 before a single card fee.",
    faqs: [
      {
        question: "Do I need a bank account in every currency I sell in?",
        answer: "Almost certainly not. Most processors will convert foreign sales and pay them into your home account, which is both the default and the simplest thing to run. Local accounts only start paying for themselves when you hold enough volume in a currency to care about the conversion margin, or you have costs in it, suppliers or staff, that you can settle without converting twice.",
      },
      {
        question: "What is a cross-border fee?",
        answer: "Often around 1%, charged when the customer's card was issued in a different country from your merchant account. It is separate from currency conversion and it applies even when the sale is in your own currency, so a US business selling to a Canadian shopper in dollars still pays it. Check whether a quoted headline rate includes it. Many do not.",
      },
      {
        question: "Should I price in my customer's currency or charge in US dollars?",
        answer: "Price locally if international sales matter to you. Shoppers convert better when the price is in the currency they think in, and nothing surprising turns up on their statement afterwards. Dollars are cheaper for you on paper, since the conversion cost shifts to the cardholder, but you pay for it in abandoned carts and in disputes from buyers who did not expect the amount their bank took.",
      },
    ],
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
