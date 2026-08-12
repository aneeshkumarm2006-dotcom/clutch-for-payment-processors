/**
 * The homepage's Q&As — the single source for both `seed-seo.ts` (which seeds a
 * fresh database) and `apply-homepage-seo-copy.ts` (which updates a live one).
 *
 * They live in their own module because they are rendered twice over: once as
 * the visible FAQ section and once as FAQPage structured data, and Google only
 * honours the markup when it matches the text on the page. Two copies of this
 * list in two scripts is exactly how those two drift apart.
 *
 * Each question targets a term the homepage owns (see the `keywords` list on the
 * "home" PageSeo record). Terms that belong to another page stay off this list:
 * "payment gateway" appears here only in the last answer, which explains the
 * distinction and is the query the homepage should intercept, while the
 * definition itself is owned by /glossary/payment-gateway.
 */
export interface HomepageFaq {
  question: string;
  answer: string;
}

export const HOMEPAGE_FAQS: HomepageFaq[] = [
  {
    question: "What is a payment processing platform?",
    answer:
      "A payment processing platform enables businesses to securely accept credit card, debit card, digital wallet, and online payments. It connects your website or point-of-sale system with banks to authorize and process transactions efficiently.",
  },
  {
    question: "How do I compare payment processors?",
    answer:
      "When comparing payment processors, consider transaction fees, monthly costs, payout speed, integrations, payment methods, customer support, and verified merchant reviews. Comparing these features helps you choose the best solution for your business.",
  },
  {
    question: "What should I look for in a merchant services provider?",
    answer:
      "A reliable merchant services provider should offer transparent pricing, secure payment processing, flexible integrations, fast payouts, and support for your business model. Reading verified merchant reviews can also help you make a confident decision.",
  },
  {
    question: "Which payment processor is best for small businesses?",
    answer:
      "The best payment processor for small businesses depends on your sales channels, transaction volume, and required features. Compare pricing, hardware options, integrations, and customer reviews before selecting a provider.",
  },
  {
    question: "What is the difference between a payment gateway and a payment processor?",
    answer:
      "A payment gateway securely captures payment information from customers, while a payment processor communicates with banks and card networks to authorize and complete transactions. Many businesses use both together for secure online payments.",
  },
];
