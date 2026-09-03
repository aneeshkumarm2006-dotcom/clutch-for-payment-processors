/**
 * Credit card surcharging
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
 */

export type SurchargeStatus =
  | "Permitted"
  | "Permitted with conditions"
  | "Prohibited"
  | "Unclear";

export interface SurchargeState {
  state: string;
  status: SurchargeStatus;
  detail: string;
  source: string;
  checked: string;
}

export interface NetworkCap {
  network: string;
  cap: string;
  source: string;
}

export const SURCHARGE_DEFAULTS: { ticket: number; surchargePct: number; processingRate: number; processingFixed: number } = {
  ticket: 200,
  surchargePct: 3,
  processingRate: 2.9,
  processingFixed: 0.3,
};

export const SURCHARGE_NETWORK_CAPS: NetworkCap[] = [
  {
    network: "Visa",
    cap: "3% of the transaction, or your merchant discount rate for the credit card surcharged, whichever is lowest",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
  },
  {
    network: "Mastercard",
    cap: "4% Maximum Surcharge Cap, and never more than your average effective merchant discount rate for Mastercard credit acceptance",
    source: "https://www.mastercard.com/us/en/business/support/merchant-surcharge-rules.html",
  },
];

/**
 * State by state surcharging status.
 *
 * REFERENCE MATERIAL, NOT A COMPUTED LEGAL ANSWER. The page shows this beside
 * the calculator and the calculator never outputs a "maximum legal surcharge",
 * because that turns on the state, the network rules, the merchant's cost of
 * acceptance and the acquirer agreement, and answering it would be advice.
 *
 * "Unclear" exists so a state nobody could verify is shown as unverified rather
 * than guessed at. Do not upgrade a status without a source.
 */
export const SURCHARGE_STATES: SurchargeState[] = [
  {
    state: "Alabama",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Alaska",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Arizona",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Arkansas",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "California",
    status: "Permitted with conditions",
    detail: "Civil Code 1748.1, which bans credit card surcharges, is still on the books but was held unconstitutional as applied to the plaintiffs in Italian Colors Restaurant v. Becerra (9th Cir. 2018). The Attorney General states it will generally apply that decision to merchants similarly situated to the Italian Colors plaintiffs, so surcharging is widespread but not risk free. SB 478, the Honest Pricing law effective 1 July 2024, is NOT a surcharge ban: it sits at Civil Code 1770(a)(29) and governs advertised prices. The Attorney General's separate hidden fees guidance, at oag.ca.gov/hiddenfees, states that a credit card processing fee is not a mandatory fee if the customer can avoid it by paying a different way, but is mandatory and must sit inside the advertised price if the business accepts only credit cards.",
    source: "https://oag.ca.gov/consumers/general/credit-card-surcharges",
    checked: "2026-09-04",
  },
  {
    state: "Colorado",
    status: "Permitted with conditions",
    detail: "C.R.S. 5-2-212, as amended by SB 21-091 effective 1 July 2022, lets a seller choose one of two routes: a surcharge not exceeding 2% of the total cost to the buyer, or a surcharge not exceeding the merchant discount fee actually incurred on that transaction. It is not a flat 2% ceiling. Each route prescribes the exact signage wording you must post in store, or display before an online checkout completes. The surcharge must appear as a separate line item on the receipt, only one surcharge is allowed per transaction, and no surcharge may be imposed on cash, check, debit card or gift card redemption.",
    source: "https://law.justia.com/codes/colorado/title-5/consumer-credit-code/article-2/part-2/section-5-2-212/",
    checked: "2026-09-04",
  },
  {
    state: "Connecticut",
    status: "Prohibited",
    detail: "General Statutes 42-133ff(b): no person may impose a surcharge on any transaction. This is the broadest ban in the country because the statute defines a surcharge by reference to any method of payment, not credit cards alone. The statutory definition of transaction does carve out certain payments to state agencies, the Department of Revenue Services and municipalities, but for ordinary retail it is a flat ban. A violation is an unfair or deceptive trade practice under 42-110b(a), and the Commissioner of Consumer Protection may impose an additional civil penalty of up to $500 per violation. Discounts to induce cash, check or debit payment remain lawful if you post the required notice.",
    source: "https://law.justia.com/codes/connecticut/title-42/chapter-739/section-42-133ff/",
    checked: "2026-09-04",
  },
  {
    state: "Delaware",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "District of Columbia",
    status: "Permitted",
    detail: "No statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list the District as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Florida",
    status: "Permitted with conditions",
    detail: "Fla. Stat. 501.0117 still appears in the statute books and on its face makes surcharging a second degree misdemeanour, but the Eleventh Circuit struck it down facially as an unconstitutional abridgment of free speech in Dana's Railroad Supply v. Bondi, decided 4 November 2015. Because the relief was facial rather than as applied, Florida rests on firmer ground than Texas or California. The statute has not been repealed.",
    source: "https://law.justia.com/cases/federal/appellate-courts/ca11/14-14426/14-14426-2015-11-04.html",
    checked: "2026-09-04",
  },
  {
    state: "Georgia",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Hawaii",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Idaho",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Illinois",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Indiana",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Iowa",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Kansas",
    status: "Permitted with conditions",
    detail: "K.S.A. 16a-2-403, as amended by L. 2024 ch. 6 sec. 51 effective 1 January 2025, permits a surcharge provided the merchant discloses the amount of the surcharge through a clear and conspicuous notice to the customer at the point of entry or the point of sale and in advance of the transaction. The statute sets no percentage cap of its own, so the network cost of acceptance ceiling governs. The previous ban had been held unconstitutional on First Amendment grounds in CardX, LLC v. Schmidt (D. Kan. 2021).",
    source: "https://www.ksrevisor.gov/statutes/chapters/ch16a/016a_002_0403.html",
    checked: "2026-09-04",
  },
  {
    state: "Kentucky",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Louisiana",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Maine",
    status: "Prohibited",
    detail: "9-A M.R.S. 8-509: a seller in a sales transaction may not impose a surcharge on a cardholder who elects to use a credit card or debit card in lieu of payment by cash, check or similar means. The ban therefore covers debit as well as credit. The statute states that a discount or reduction from the regular price is not a surcharge, so cash discounting remains available. The only carve out is for governmental entities, which may surcharge if the charge is disclosed in advance, consumers are told they can avoid it by paying cash or check, and it does not exceed the card service costs directly incurred.",
    source: "https://legislature.maine.gov/statutes/9-A/title9-Asec8-509.html",
    checked: "2026-09-04",
  },
  {
    state: "Maryland",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Massachusetts",
    status: "Prohibited",
    detail: "M.G.L. c. 140D sec. 28A: no seller in any sales transaction may impose a surcharge on a cardholder who elects to use a credit card in lieu of payment by cash, check or similar means. The same section protects the alternative: a cash discount offered to all prospective buyers and disclosed clearly and conspicuously does not constitute a finance charge.",
    source: "https://law.onecle.com/massachusetts/140d/28A.html",
    checked: "2026-09-04",
  },
  {
    state: "Michigan",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Minnesota",
    status: "Permitted with conditions",
    detail: "Minn. Stat. 325G.051, most recently amended by 2023 c 57 art 4 s 19, permits a credit or charge card surcharge provided it does not exceed five percent of the purchase price. For in person sales the merchant must inform the customer of the surcharge both orally at the time of sale and by a conspicuously posted sign; online sales require a conspicuous surcharge notice during the sale, at the point of sale, on the order summary or on the checkout page; telephone sales require oral notice.",
    source: "https://www.revisor.mn.gov/statutes/cite/325G.051",
    checked: "2026-09-04",
  },
  {
    state: "Mississippi",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Missouri",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Montana",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Nebraska",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Nevada",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "New Hampshire",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "New Jersey",
    status: "Permitted with conditions",
    detail: "P.L. 2023 c. 146 (N.J.S.A. 56:8-156.1 and 156.2) bars a surcharge greater than the actual cost to the seller to process the credit card payment. Critically you must disclose the amount of the surcharge, not merely that one exists: the Division of Consumer Affairs says in terms that a sign reading We impose a credit card surcharge that does not exceed our processing costs is not sufficient to comply. Stating the amount as a percentage is permissible. In person, post at both the point of entry and the point of sale; restaurants must also post in the customer service area and on menus including menu boards and QR menus; online, on the checkout page; by phone, verbally before processing. A flat rate is allowed if it does not exceed the actual cost of processing that transaction. The cap does not apply to debit or gift card transactions. Division guidance revised 6 March 2026.",
    source: "https://www.njconsumeraffairs.gov/News/Consumer%20Briefs/credit-card-surcharges-faq.pdf",
    checked: "2026-09-04",
  },
  {
    state: "New Mexico",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "New York",
    status: "Permitted with conditions",
    detail: "N.Y. General Business Law 518, current text revised 16 February 2024, requires a seller imposing a surcharge to clearly and conspicuously post the total price for using a credit card, inclusive of the surcharge. Posting only a percentage is not enough, and the final sales price may not exceed the posted price. The surcharge may not exceed the amount charged to the business by the credit card company for that credit card use, and a violation carries a civil penalty of up to $500 per violation.",
    source: "https://www.nysenate.gov/legislation/laws/GBS/518",
    checked: "2026-09-04",
  },
  {
    state: "North Carolina",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "North Dakota",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Ohio",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Oklahoma",
    status: "Permitted with conditions",
    detail: "Changed recently: 14A O.S. 2-211, as amended by Laws 2025 ch. 410 sec. 1 effective 1 November 2025, now permits surcharging. Notice displaying the amount of the surcharge must be posted at the point of entry and the point of sale for in person transactions, and on the home page and the point of sale webpage for online transactions, and disclosed verbally for phone transactions. No surcharge may exceed 2% of the total transaction or the actual amount charged to process the credit card transaction, whichever is less. A customer is not considered to have chosen to use a credit card if the retailer accepts only credit cards. Visa's own state list, dated 15 February 2024, still shows Oklahoma as prohibiting and is out of date on this point.",
    source: "https://law.justia.com/codes/oklahoma/title-14a/section-14a-2-211/",
    checked: "2026-09-04",
  },
  {
    state: "Oregon",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Pennsylvania",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Puerto Rico",
    status: "Prohibited",
    detail: "10 L.P.R.A. sec. 11, enacted as Act 150 of 4 August 2008 and amended by Act 152 of 13 December 2013: no merchant may impose a surcharge on a consumer who chooses to use a valid payment method, including a credit or debit card, in lieu of cash, check or any similar payment method, in any transaction involving the sale or lease of goods and services. The ban covers debit as well as credit. Unlike Connecticut, Maine and Massachusetts, the current text carries no express cash discount allowance, so do not assume the mainland cash discount workaround is available here without local advice.",
    source: "https://law.justia.com/codes/puerto-rico/title-ten/subtitle-1/chapter-2/11/",
    checked: "2026-09-04",
  },
  {
    state: "Rhode Island",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "South Carolina",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "South Dakota",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Tennessee",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Texas",
    status: "Permitted with conditions",
    detail: "Tex. Bus. and Com. Code 604A.0021, which bars surcharging, remains on the books and has not been repealed, but the Western District of Texas held it unconstitutional as applied and permanently enjoined the State from enforcing it against the plaintiff merchants in Rowell LLC v. Paxton (W.D. Tex. 2018), on First Amendment commercial speech grounds. Surcharging is common in Texas on that basis. Because the injunction runs only to the merchants who sued rather than repealing the statute, this is the state where practice and statute diverge most, and it is worth specific legal advice.",
    source: "https://caselaw.findlaw.com/court/us-dis-crt-w-d-tex-aus-div/1952276.html",
    checked: "2026-09-04",
  },
  {
    state: "Utah",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Vermont",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Virginia",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Washington",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "West Virginia",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Wisconsin",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
  {
    state: "Wyoming",
    status: "Permitted",
    detail: "No state statute restricting credit card surcharges identified, and Visa's merchant Q and A, version 02152024, does not list this state as prohibiting or restricting surcharging. Network caps, the cost of acceptance ceiling and point of sale disclosure still apply.",
    source: "https://usa.visa.com/content/dam/VCOM/global/support-legal/documents/merchant-surcharging-qa-for-web.pdf",
    checked: "2026-09-04",
  },
];
