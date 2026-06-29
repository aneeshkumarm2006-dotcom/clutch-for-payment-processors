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
      "Get in touch with the PayCompare team — feedback, corrections to a profile, or partnership enquiries.",
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
    </div>
  );
}
