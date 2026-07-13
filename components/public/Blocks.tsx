import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { IBlock } from "@/models";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/public/RichText";
import { FaqSection } from "@/components/public/FaqSection";
import { Button } from "@/components/ui/button";

/**
 * Public renderer for modular content blocks (Phase 3).
 *
 * A server component — blocks are static content and must be in the initial HTML
 * so crawlers see them (the whole point of the schema they feed).
 *
 * The `data` payload is `Mixed` in Mongo and arrives here typed as
 * `Record<string, unknown>`, so each renderer narrows what it needs and bails out
 * quietly if the shape is wrong. A malformed block renders nothing rather than
 * throwing — one bad block must not 500 an entire page.
 *
 * HTML-bearing blocks (`richtext`, `htmlEmbed`) are sanitized ON SAVE by
 * `lib/sanitize-html.ts` in the write routes, matching how blog `content` is
 * already handled. Do not render either of them from an unsanitized source.
 */

const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Every block sits in the same vertical rhythm and reading column. */
function BlockShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("mt-10 first:mt-0", className)}>{children}</section>;
}

function BlockHeading({ title }: { title?: string }) {
  if (!title?.trim()) return null;
  return <h2 className="mb-4 text-h3 tracking-tighter2 text-foreground">{title}</h2>;
}

function ComparisonBlock({ data }: { data: Record<string, unknown> }) {
  const headers = asArray<string>(data.headers);
  const rows = asArray<{ name?: string; url?: string; cells?: string[] }>(data.rows);
  if (!rows.length) return null;

  return (
    <BlockShell>
      <BlockHeading title={asString(data.title) || undefined} />
      {/* Wide tables must scroll inside their own box, never widen the page. */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-body">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-label font-medium text-muted-foreground">
                Name
              </th>
              {headers.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-4 py-3 text-left text-label font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.name}-${i}`} className="border-t border-border">
                <th scope="row" className="px-4 py-3 text-left font-medium text-foreground">
                  {row.url ? (
                    <Link href={row.url} className="hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                </th>
                {headers.map((h, ci) => (
                  <td key={h} className="px-4 py-3 text-muted-foreground">
                    {asArray<string>(row.cells)[ci] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BlockShell>
  );
}

function FeatureGridBlock({ data }: { data: Record<string, unknown> }) {
  const items = asArray<{ title?: string; description?: string }>(data.items);
  if (!items.length) return null;

  return (
    <BlockShell>
      <BlockHeading title={asString(data.title) || undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it, i) => (
          <div key={`${it.title}-${i}`} className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-h4 text-foreground">{it.title}</h3>
            {it.description ? (
              <p className="mt-1.5 text-body text-muted-foreground">{it.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </BlockShell>
  );
}

function ProsConsBlock({ data }: { data: Record<string, unknown> }) {
  const pros = asArray<string>(data.pros);
  const cons = asArray<string>(data.cons);
  if (!pros.length && !cons.length) return null;

  const column = (
    label: string,
    items: string[],
    Icon: typeof Check,
    tone: string,
  ) =>
    items.length ? (
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-label font-medium text-muted-foreground">{label}</h3>
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex gap-2.5 text-body text-foreground">
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone)} aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <BlockShell>
      <BlockHeading title={asString(data.title) || undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        {column("Pros", pros, Check, "text-success")}
        {column("Cons", cons, X, "text-destructive")}
      </div>
    </BlockShell>
  );
}

function CtaBlock({ data }: { data: Record<string, unknown> }) {
  const heading = asString(data.heading);
  const url = asString(data.buttonUrl);
  const label = asString(data.buttonLabel);
  if (!heading || !url || !label) return null;

  return (
    <BlockShell>
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <h2 className="text-h3 tracking-tighter2 text-foreground">{heading}</h2>
        {data.body ? (
          <p className="mx-auto mt-2 max-w-prose text-body text-muted-foreground">
            {asString(data.body)}
          </p>
        ) : null}
        <Button asChild variant="accent" className="mt-5">
          <Link href={url}>{label}</Link>
        </Button>
      </div>
    </BlockShell>
  );
}

function MediaBlock({ data }: { data: Record<string, unknown> }) {
  const url = asString(data.url);
  if (!url) return null;
  const alt = asString(data.alt);
  const caption = asString(data.caption);

  return (
    <BlockShell>
      <figure>
        <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-border bg-muted">
          <Image src={url} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 720px" />
        </div>
        {caption ? (
          <figcaption className="mt-2 text-small text-muted-foreground">{caption}</figcaption>
        ) : null}
      </figure>
    </BlockShell>
  );
}

function BlockRenderer({ block }: { block: IBlock }) {
  const data = (block.data ?? {}) as Record<string, unknown>;

  switch (block.type) {
    case "richtext":
      return (
        <BlockShell>
          <RichText html={asString(data.html)} />
        </BlockShell>
      );

    case "faq": {
      const items = asArray<{ question: string; answer: string }>(data.items).filter(
        (i) => i?.question && i?.answer,
      );
      if (!items.length) return null;
      // Reuses the site's existing FAQ section so a block FAQ and a legacy `faqs`
      // FAQ are visually indistinguishable. Its default `mt-16` is overridden —
      // BlockShell already owns the vertical rhythm between blocks.
      return (
        <BlockShell>
          <FaqSection
            faqs={items}
            className="max-w-3xl"
            {...(asString(data.title) ? { title: asString(data.title) } : {})}
          />
        </BlockShell>
      );
    }

    case "comparison":
      return <ComparisonBlock data={data} />;
    case "featureGrid":
      return <FeatureGridBlock data={data} />;
    case "prosCons":
      return <ProsConsBlock data={data} />;
    case "cta":
      return <CtaBlock data={data} />;
    case "media":
      return <MediaBlock data={data} />;

    case "htmlEmbed":
      // Sanitized on save (see the file header). Rendering raw here is the same
      // trust model the blog body already uses.
      return (
        <BlockShell>
          <div
            className="richtext"
            dangerouslySetInnerHTML={{ __html: asString(data.html) }}
          />
        </BlockShell>
      );

    default:
      // An unknown type means the config removed a block that content still uses.
      // Render nothing rather than crash — the data is intact and comes back the
      // moment the type is re-enabled.
      return null;
  }
}

export function Blocks({ blocks, className }: { blocks?: IBlock[] | null; className?: string }) {
  if (!blocks?.length) return null;
  return (
    <div className={className}>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}

export default Blocks;
