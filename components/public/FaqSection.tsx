import type { IFaqItem } from "@/models";

/**
 * Visible FAQ section (PRD §13). Pairs with `faqJsonLd(faqs)` in the page's
 * <JsonLd> block so the same Q&As render on-page AND become FAQPage structured
 * data. Renders nothing when there are no FAQs. Matches the `<dl>` treatment used
 * on the for-processors / facet pages.
 */
export function FaqSection({
  faqs,
  title = "Frequently asked questions",
  className,
}: {
  faqs?: IFaqItem[] | null;
  title?: string;
  className?: string;
}) {
  if (!faqs || faqs.length === 0) return null;

  return (
    <section
      aria-label="Frequently asked questions"
      className={className ?? "mt-16 max-w-3xl"}
    >
      <h2 className="text-h2 tracking-tighter2 text-foreground">{title}</h2>
      <dl className="mt-6 divide-y divide-ink-150 dark:divide-ink-800">
        {faqs.map((f) => (
          <div key={f.question} className="py-5">
            <dt className="text-h4 text-foreground">{f.question}</dt>
            <dd className="mt-2 text-body text-muted-foreground">{f.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default FaqSection;
