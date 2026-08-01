import Link from "next/link";
import { Facebook, Instagram, Linkedin, Twitter, type LucideIcon } from "lucide-react";
import type { CategoryData } from "@/lib/serialize";
import type { ISiteSettings } from "@/models";

/**
 * Footer (DESIGN §6/§9) — ink-950, hairline columns. Categories are data-driven;
 * social links + footer copy come from SiteSettings.
 */
type FooterSettings = Pick<ISiteSettings, "siteName" | "socialLinks" | "footerText">;

const COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "Methodology", href: "/methodology" },
  { label: "Blog", href: "/blog" },
  { label: "For processors", href: "/for-processors" },
];

/** High-value capability landing pages + glossary — site-wide internal links. */
const POPULAR_LINKS = [
  { label: "Best for Shopify", href: "/payment-processors/for-shopify" },
  { label: "ACH processors", href: "/payment-processors/ach" },
  { label: "Interchange-plus", href: "/payment-processors/interchange-plus" },
  { label: "Flat-rate processors", href: "/payment-processors/flat-rate" },
  { label: "Payments glossary", href: "/glossary" },
];

/**
 * Head glossary terms, linked site-wide.
 *
 * The header's MegaMenu and mobile Sheet both render their links inside Radix
 * `PopoverContent` / `SheetContent`, which are not in the server HTML — so every
 * crawlable site-wide link on this site comes from this footer, and no individual
 * glossary term had one. These eight are the terms a reader actually arrives
 * looking for (they are the line items on a merchant statement), which is why a
 * glossary column is a normal pattern for a payments reference site rather than
 * a link dump.
 */
const GLOSSARY_LINKS = [
  { label: "Interchange", href: "/glossary/interchange" },
  { label: "Effective rate", href: "/glossary/effective-rate" },
  { label: "Merchant account", href: "/glossary/merchant-account" },
  { label: "Payment gateway", href: "/glossary/payment-gateway" },
  { label: "Chargeback", href: "/glossary/chargeback" },
  { label: "PCI DSS", href: "/glossary/pci-dss" },
  { label: "Rolling reserve", href: "/glossary/rolling-reserve" },
  { label: "Payout time", href: "/glossary/payout-time" },
];

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

const SOCIALS: { key: keyof ISiteSettings["socialLinks"]; label: string; Icon: LucideIcon }[] = [
  { key: "twitter", label: "Twitter / X", Icon: Twitter },
  { key: "linkedin", label: "LinkedIn", Icon: Linkedin },
  { key: "facebook", label: "Facebook", Icon: Facebook },
  { key: "instagram", label: "Instagram", Icon: Instagram },
];

export function Footer({
  categories,
  settings,
  landingPages = [],
}: {
  categories: CategoryData[];
  settings: FooterSettings;
  /** Admin-created landing pages, appended to "Popular" so they aren't orphans. */
  landingPages?: { label: string; href: string }[];
}) {
  const siteName = settings.siteName || "Payment Processor Guide";
  const year = new Date().getFullYear();
  /*
    Was `slice(0, 5)`. With 11 published categories that silently stranded six of
    them: /category/restaurants had ZERO inbound links anywhere on the site,
    nonprofits had one, developers two. Worse, the list is ordered by
    `displayOrder, name`, so creating one admin category evicted a strong
    commercial category from every page at once. The cap stays (an unbounded
    footer is its own problem) but is now well above the real category count.
  */
  const categoryLinks = categories.slice(0, 12);
  // De-duped by href so a landing page that also appears in POPULAR_LINKS is
  // listed once rather than twice.
  const popularLinks = [
    ...POPULAR_LINKS,
    ...landingPages.filter((l) => !POPULAR_LINKS.some((p) => p.href === l.href)),
  ];
  const socials = SOCIALS.filter((s) => settings.socialLinks?.[s.key]);

  return (
    <footer className="mt-auto bg-ink-950 text-ink-300">
      <div className="mx-auto max-w-content px-4 py-16 lg:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[1.4fr_repeat(5,1fr)]">
          <div>
            <Link href="/" className="text-h4 tracking-tighter2 text-ink-50">
              {siteName}
              <span className="text-violet-400">.</span>
            </Link>
            <p className="mt-3 max-w-xs text-small text-ink-400">
              An independent directory and review platform for payment processors.
            </p>
            {socials.length > 0 && (
              <div className="mt-5 flex items-center gap-2">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={settings.socialLinks[s.key]}
                    target="_blank"
                    rel="noopener"
                    aria-label={s.label}
                    className="flex size-9 items-center justify-center rounded border border-ink-800 text-ink-400 transition-colors hover:border-ink-700 hover:text-ink-50"
                  >
                    <s.Icon className="size-4" aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </div>

          <FooterColumn heading="Categories">
            {categoryLinks.length > 0 ? (
              categoryLinks.map((c) => (
                <FooterLink key={c.slug} href={`/category/${c.slug}`} label={c.name} />
              ))
            ) : (
              <FooterLink href="/processors" label="All processors" />
            )}
          </FooterColumn>

          <FooterColumn heading="Popular">
            {popularLinks.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
          </FooterColumn>

          <FooterColumn heading="Glossary">
            {GLOSSARY_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
            <FooterLink href="/glossary" label="All terms" />
          </FooterColumn>

          <FooterColumn heading="Company">
            {COMPANY_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
          </FooterColumn>

          <FooterColumn heading="Legal">
            {LEGAL_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
          </FooterColumn>
        </div>

        <div className="mt-12 border-t border-ink-800 pt-6 text-small text-ink-400">
          {settings.footerText?.trim()
            ? settings.footerText
            : `© ${year} ${siteName}. Independent payment processor reviews. Always confirm current fees and terms with each provider.`}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-label uppercase text-ink-400">{heading}</h2>
      <ul className="mt-4 space-y-2.5 text-small">{children}</ul>
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link href={href} className="text-ink-300 transition-colors hover:text-ink-50">
        {label}
      </Link>
    </li>
  );
}

export default Footer;
