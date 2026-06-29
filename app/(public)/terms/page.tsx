import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { Prose } from "@/components/public/Prose";
import { JsonLd } from "@/components/public/JsonLd";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";

/** Terms of service (PRD §9.11). Static legal page, SSG. */
export const revalidate = 86400;

/** Effective date — update when the terms materially change. */
const EFFECTIVE_DATE = "January 1, 2026";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Terms of service",
    description: "The terms that govern your use of the PayCompare website.",
    path: "/terms",
  });
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Terms", path: "/terms" },
        ])}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Terms" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">Terms of service</h1>
        <p className="mt-2 text-small text-muted-foreground">Effective {EFFECTIVE_DATE}</p>
      </header>

      <Prose className="mt-8 max-w-prose">
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-body text-ink-700 dark:text-ink-300">
          This is a sample agreement provided as a starting template. Have it reviewed by qualified
          legal counsel and tailored to your jurisdiction before going live.
        </p>

        <h2>Acceptance</h2>
        <p>
          By accessing or using PayCompare (the “Service”), you agree to these terms. If you don’t
          agree, please don’t use the Service.
        </p>

        <h2>Use of the Service</h2>
        <p>
          PayCompare provides directory, comparison, and review content for informational purposes.
          You agree to use the Service lawfully and not to interfere with its operation, scrape it at
          scale, or attempt to game rankings or reviews.
        </p>

        <h2>Reviews and submissions</h2>
        <ul>
          <li>You must own the rights to anything you submit and your review must be truthful.</li>
          <li>
            Reviews are moderated; we may decline, edit for length or clarity, or remove content that
            is spam, abusive, off-topic, or fraudulent.
          </li>
          <li>
            By submitting content you grant us a non-exclusive licence to display it on the Service.
          </li>
        </ul>

        <h2>No financial advice</h2>
        <p>
          Pricing, fees, and features change frequently and may contain errors or sample data. Nothing
          on the Service is financial, legal, or professional advice. Always confirm current terms
          directly with a processor before making a decision. See how listings are ordered on our{" "}
          <Link href="/methodology">methodology</Link> page.
        </p>

        <h2>Third-party links</h2>
        <p>
          The Service links to third-party websites, some via affiliate or sponsored links. We aren’t
          responsible for the content, products, or practices of those sites.
        </p>

        <h2>Disclaimer & limitation of liability</h2>
        <p>
          The Service is provided “as is” without warranties of any kind. To the maximum extent
          permitted by law, PayCompare is not liable for any indirect or consequential damages arising
          from your use of the Service or reliance on its content.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms from time to time. Continued use of the Service after changes take
          effect constitutes acceptance of the revised terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms? <Link href="/contact">Contact us</Link>.
        </p>
      </Prose>
    </div>
  );
}
