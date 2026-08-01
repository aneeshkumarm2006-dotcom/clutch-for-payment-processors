import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Store } from "lucide-react";
import { Breadcrumb } from "@/components/public/Breadcrumb";
import { ContactForm } from "@/components/public/ContactForm";
import { JsonLd } from "@/components/public/JsonLd";
import { getOrCreateSiteSettings } from "@/lib/settings";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";

/** Contact (PRD §9.10). Form → Lead with source: 'contact'. SSG shell + client form. */
export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Contact us",
    description:
      "Get in touch with the Payment Processor Guide team about feedback, corrections to a profile, or partnership enquiries.",
    path: "/contact",
  });
}

export default async function ContactPage() {
  const settings = await getOrCreateSiteSettings().catch(() => null);
  const contactEmail = settings?.contactEmail;

  return (
    <div className="mx-auto max-w-content px-4 py-10 lg:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />

      <Breadcrumb items={[{ name: "Home", href: "/" }, { name: "Contact" }]} />

      <header className="mt-4 max-w-prose">
        <h1 className="text-h1 tracking-tighter2 text-foreground">Contact us</h1>
        <p className="mt-3 text-body-lg text-muted-foreground">
          Questions, feedback, or a correction to a processor’s profile? Send us a message and we’ll
          get back to you by email.
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <ContactForm />

        <aside className="space-y-6">
          {contactEmail && (
            <div className="rounded-lg border bg-card p-5">
              <div className="flex items-center gap-2 text-ink-700 dark:text-ink-300">
                <Mail className="size-4" aria-hidden />
                <h2 className="text-h4 text-foreground">Email</h2>
              </div>
              <a
                href={`mailto:${contactEmail}`}
                className="mt-2 block text-body text-accent hover:underline"
              >
                {contactEmail}
              </a>
            </div>
          )}

          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2 text-ink-700 dark:text-ink-300">
              <Store className="size-4" aria-hidden />
              <h2 className="text-h4 text-foreground">List your processor</h2>
            </div>
            <p className="mt-2 text-body text-muted-foreground">
              Run a payment company? Add it to the directory.
            </p>
            <Link
              href="/for-processors"
              className="mt-3 inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
            >
              Get listed →
            </Link>
          </div>
        </aside>
      </div>

      {/*
        A bare form + email address is ~90 words, which Semrush flags as low word
        count. More to the point, "contact us" is where a reader decides whether a
        comparison site is accountable: who answers, how fast, and what happens
        when a published fee is wrong. Spelling that out is an E-E-A-T signal, not
        padding, and it deflects the enquiries that have a self-serve answer.
      */}
      <section className="mt-16 max-w-prose border-t pt-10">
        <h2 className="text-h2 tracking-tighter2 text-foreground">What we can help with</h2>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="text-h4 text-foreground">Corrections to a processor profile</h3>
            <p className="mt-2 text-body text-muted-foreground">
              Pricing changes constantly, and a rate that was right last quarter may not be right
              today. If a fee, payout time, contract term, or supported payment method on a profile
              is out of date, tell us which page and what it should say. Corrections that come with
              a link to the provider&rsquo;s own pricing page are the fastest to verify, and we
              update the listing rather than deleting the old figure quietly.
            </p>
          </div>

          <div>
            <h3 className="text-h4 text-foreground">Questions about a review</h3>
            <p className="mt-2 text-body text-muted-foreground">
              Every merchant review is checked before it is published, and we keep the negative ones.
              If you believe a review is inaccurate or was left by someone who was never a customer,
              send us the processor and the reviewer name and we will look at it. We do not remove a
              review because a provider dislikes it.
            </p>
          </div>

          <div>
            <h3 className="text-h4 text-foreground">Getting your processor listed or updated</h3>
            <p className="mt-2 text-body text-muted-foreground">
              Listings are free and are not ranked by payment.{" "}
              <Link href="/for-processors" className="font-medium text-accent hover:underline">
                List your processor
              </Link>{" "}
              to submit one, or write to us if you already have a profile and want to correct it.
              Sponsored placements exist, they are labelled on the page, and they never change how a
              processor scores. The{" "}
              <Link href="/methodology" className="font-medium text-accent hover:underline">
                methodology
              </Link>{" "}
              explains exactly how listings are researched and scored.
            </p>
          </div>

          <div>
            <h3 className="text-h4 text-foreground">Press and partnerships</h3>
            <p className="mt-2 text-body text-muted-foreground">
              We are happy to comment on payment processing pricing, chargebacks, and merchant
              account underwriting. Say what you are working on and your deadline.
            </p>
          </div>
        </div>

        <h2 className="mt-10 text-h3 text-foreground">What we cannot help with</h2>
        <p className="mt-3 text-body text-muted-foreground">
          We are an independent directory, not a payment processor. We cannot access your merchant
          account, release a held payout, reverse a chargeback, or resolve a dispute on your behalf.
          For any of those, contact your processor&rsquo;s support team directly; the link on each{" "}
          <Link href="/processors" className="font-medium text-accent hover:underline">
            processor profile
          </Link>{" "}
          goes to their own site. If you are trying to work out what a fee on your statement is, the{" "}
          <Link href="/glossary" className="font-medium text-accent hover:underline">
            payments glossary
          </Link>{" "}
          defines the line items most statements use.
        </p>

        <h2 className="mt-10 text-h3 text-foreground">Response times</h2>
        <p className="mt-3 text-body text-muted-foreground">
          Messages are answered by email, usually within two business days. Profile corrections are
          verified against the provider&rsquo;s published pricing before we change anything, so those
          can take a little longer. We do not sell or share the email address you write in from.
        </p>
      </section>
    </div>
  );
}
