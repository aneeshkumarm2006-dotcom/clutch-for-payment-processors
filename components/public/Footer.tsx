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
}: {
  categories: CategoryData[];
  settings: FooterSettings;
}) {
  const siteName = settings.siteName || "PayCompare";
  const year = new Date().getFullYear();
  const categoryLinks = categories.slice(0, 5);
  const socials = SOCIALS.filter((s) => settings.socialLinks?.[s.key]);

  return (
    <footer className="mt-auto bg-ink-950 text-ink-300">
      <div className="mx-auto max-w-content px-4 py-16 lg:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="text-h4 tracking-tighter2 text-ink-50">
              {siteName}
              <span className="text-violet-400">.</span>
            </Link>
            <p className="mt-3 max-w-xs text-small text-ink-500">
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
            {POPULAR_LINKS.map((l) => (
              <FooterLink key={l.href} href={l.href} label={l.label} />
            ))}
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

        <div className="mt-12 border-t border-ink-800 pt-6 text-small text-ink-500">
          {settings.footerText?.trim()
            ? settings.footerText
            : `© ${year} ${siteName}. Independent payment processor reviews — always confirm current fees and terms with each provider.`}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-label uppercase text-ink-500">{heading}</h2>
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
