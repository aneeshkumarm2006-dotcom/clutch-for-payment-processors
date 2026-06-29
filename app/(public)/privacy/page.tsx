import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { Prose } from "@/components/public/Prose";
import { JsonLd } from "@/components/public/JsonLd";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";

/** Privacy policy (PRD §9.11). Static legal page, SSG. */
export const revalidate = 86400;

/** Effective date — update when the policy materially changes. */
const EFFECTIVE_DATE = "January 1, 2026";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Privacy policy",
    description: "How PayCompare collects, uses, and protects your information.",
    path: "/privacy",
  });
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Privacy", path: "/privacy" },
        ])}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Privacy" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">Privacy policy</h1>
        <p className="mt-2 text-small text-muted-foreground">Effective {EFFECTIVE_DATE}</p>
      </header>

      <Prose className="mt-8 max-w-prose">
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-body text-ink-700 dark:text-ink-300">
          This is a sample policy provided as a starting template. Have it reviewed by qualified legal
          counsel and tailored to your jurisdiction before going live.
        </p>

        <h2>Who we are</h2>
        <p>
          PayCompare (“we”, “us”) operates an independent directory and review platform for payment
          processors. This policy explains what information we collect, why, and your choices.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Information you provide.</strong> When you write a review, request a quote, submit
            your processor, or contact us, we collect the details you enter — such as your name,
            email, business information, and message.
          </li>
          <li>
            <strong>Review email addresses</strong> are collected solely to verify that a reviewer is
            a genuine merchant. They are kept private and are never displayed publicly or sold.
          </li>
          <li>
            <strong>Usage data.</strong> We collect aggregate, privacy-friendly analytics about how
            pages and links are used (for example, clicks on “Visit website”) to improve the site.
          </li>
        </ul>

        <h2>How we use information</h2>
        <ul>
          <li>To publish moderated reviews and keep ratings accurate.</li>
          <li>To respond to quote requests, listing submissions, and contact messages.</li>
          <li>To understand site usage and improve our content and rankings.</li>
          <li>To detect and prevent spam and abuse.</li>
        </ul>

        <h2>Sharing</h2>
        <p>
          We don’t sell your personal information. When you request a quote, we may pass the details
          you provide to the relevant processor so they can respond. We use service providers (such as
          hosting and email) who process data on our behalf under appropriate safeguards.
        </p>

        <h2>Affiliate links</h2>
        <p>
          Some outbound links are affiliate or sponsored links. If you follow one and sign up, we may
          earn a commission at no cost to you. See our <Link href="/methodology">methodology</Link> for
          how this is disclosed.
        </p>

        <h2>Your choices</h2>
        <p>
          You can request access to, correction of, or deletion of the information you’ve submitted by
          contacting us. Depending on where you live, you may have additional rights under laws such as
          the GDPR or CCPA.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy? <Link href="/contact">Get in touch</Link> and we’ll be happy to
          help.
        </p>
      </Prose>
    </div>
  );
}
