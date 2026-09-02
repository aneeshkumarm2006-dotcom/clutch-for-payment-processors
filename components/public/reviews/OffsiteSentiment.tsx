import Link from "next/link";
import { ArrowUpRight, Check, MessageSquare, TriangleAlert } from "lucide-react";
import type { IGoogleReviewsOverview, IRedditOverview, ISentimentQuote, ISentimentTheme } from "@/models/sentiment";
import {
  formatSubreddit,
  groupThemes,
  hasSentimentContent,
  STAR_LEVELS,
  TONE_LABELS,
} from "@/lib/sentiment";
import { cn, formatCount, formatRating } from "@/lib/utils";
import { RatingStars } from "@/components/public/RatingStars";

/**
 * "What people say elsewhere" — the Google-listing and Reddit overviews on
 * `/processor/<slug>/reviews`.
 *
 * A server component, deliberately. The whole value of these sections is that
 * they are unique text about one processor in the initial HTML; fetching them
 * after hydration would throw away the only reason the page ranks.
 *
 * ## Why they sit where they sit
 *
 * Directly under the on-site rating summary and ABOVE the review list. A reader
 * who lands here with four on-site reviews in front of them needs the off-site
 * picture before the list, not after it, or the page answers a question they
 * stopped asking. The editor's blocks stay below the reviews, where they were.
 *
 * ## Why every number is labelled with its source
 *
 * A Google rating and this site's rating are two different populations, and a
 * page that shows "4.8" and "4.2" without saying which is whose is worse than one
 * that shows neither. So each card carries its source in the header, the strip at
 * the top names all three side by side, and none of it is ever averaged together.
 * The site's own aggregate, the one in the Product JSON-LD, is untouched by
 * anything on this file — see the header of `models/sentiment.ts`.
 *
 * All text here is rendered as text nodes. Nothing on these sub-documents is HTML
 * and nothing on them is sanitized, so nothing here may use
 * `dangerouslySetInnerHTML`.
 */

export const GOOGLE_SECTION_ID = "google-reviews";
export const REDDIT_SECTION_ID = "reddit";

/** Off-site links are other people's pages. Same `rel` treatment site-wide. */
const EXTERNAL_REL = "nofollow noopener";

// ---------------------------------------------------------------------------
// Brand marks
//
// lucide dropped brand icons, and these two sources are recognized by their mark
// long before their name. Small, and the only colour on the page that is not a
// design token: it is doing work, telling the reader whose numbers these are.
// ---------------------------------------------------------------------------

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-5", className)}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.26a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.11C6.22 6.88 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function RedditMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-5", className)} fill="#FF4500">
      <path d="M24 11.78a2.6 2.6 0 0 0-4.4-1.86 12.8 12.8 0 0 0-6.98-2.23l1.19-5.6 3.89.83a1.86 1.86 0 1 0 .2-.93l-4.34-.92a.46.46 0 0 0-.55.36l-1.33 6.25a12.8 12.8 0 0 0-7.08 2.24 2.6 2.6 0 1 0-2.87 4.25 5.1 5.1 0 0 0-.06.79c0 4.02 4.69 7.29 10.47 7.29S22.6 19 22.6 14.96c0-.26-.02-.53-.06-.79A2.6 2.6 0 0 0 24 11.78ZM6.2 13.64a1.86 1.86 0 1 1 3.72 0 1.86 1.86 0 0 1-3.72 0Zm10.4 4.92c-1.27 1.27-3.7 1.37-4.41 1.37-.71 0-3.14-.1-4.41-1.37a.48.48 0 0 1 .68-.68c.8.8 2.52 1.09 3.73 1.09 1.21 0 2.92-.29 3.73-1.09a.48.48 0 0 1 .68.68Zm-.33-3.06a1.86 1.86 0 1 1 0-3.72 1.86 1.86 0 0 1 0 3.72Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/**
 * Plain-text prose. Blank lines become paragraphs so an editor can write more
 * than one without needing a rich-text field (and without opening an HTML path
 * into a sub-document nothing sanitizes).
 */
function SourceProse({ text }: { text?: string }) {
  const paragraphs = (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line text-body text-ink-700 dark:text-ink-300">
          {p}
        </p>
      ))}
    </div>
  );
}

/**
 * Themes in two columns: what the source likes, what it does not.
 *
 * "Mixed" files with the criticisms (see `groupThemes`). Headings are passed in
 * because Google reviewers "praise" and Reddit threads "keep coming back to",
 * and one pair of labels for both reads as a template.
 */
function ThemeColumns({
  themes,
  positiveLabel,
  negativeLabel,
}: {
  themes?: ISentimentTheme[];
  positiveLabel: string;
  negativeLabel: string;
}) {
  const { positive, negative } = groupThemes(themes);
  if (!positive.length && !negative.length) return null;

  const column = (label: string, items: ISentimentTheme[], tone: "positive" | "negative") => {
    if (!items.length) return null;
    const Icon = tone === "positive" ? Check : TriangleAlert;
    return (
      <div>
        <h4 className="text-label uppercase text-ink-500">{label}</h4>
        <ul className="mt-2.5 space-y-2.5">
          {items.map((t, i) => (
            <li key={`${t.label}-${i}`} className="flex gap-2.5">
              <Icon
                className={cn(
                  "mt-[3px] size-4 shrink-0",
                  tone === "positive" ? "text-success" : "text-warning",
                )}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="text-body font-medium text-foreground">{t.label}</span>
                {t.detail ? (
                  <span className="block text-small text-muted-foreground">{t.detail}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {column(positiveLabel, positive, "positive")}
      {column(negativeLabel, negative, "negative")}
    </div>
  );
}

/** Attribution line under a quote: author, where, when, and its star rating. */
function QuoteAttribution({ quote }: { quote: ISentimentQuote }) {
  const parts = [quote.author, quote.context, quote.date].filter(Boolean);
  if (!parts.length && quote.rating == null) return null;
  return (
    <footer className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      {parts.length > 0 && (
        <cite className="text-small not-italic text-muted-foreground">{parts.join(" · ")}</cite>
      )}
      {quote.rating != null && <RatingStars value={quote.rating} size={12} />}
    </footer>
  );
}

/**
 * Verbatim excerpts.
 *
 * Quoted rather than paraphrased because a summary of other people's opinions is
 * only checkable if some of the originals are on the page, and `url` links each
 * one back to where it was written.
 */
function QuoteList({ quotes, label }: { quotes?: ISentimentQuote[]; label: string }) {
  if (!quotes?.length) return null;
  return (
    <div>
      <h4 className="text-label uppercase text-ink-500">{label}</h4>
      <div className="mt-2.5 space-y-3">
        {quotes.map((q, i) => (
          <blockquote
            key={i}
            className="border-l-2 border-border-strong pl-4 text-body text-ink-700 dark:text-ink-300"
          >
            <p className="whitespace-pre-line">{q.text}</p>
            <QuoteAttribution quote={q} />
            {q.url ? (
              <Link
                href={q.url}
                target="_blank"
                rel={EXTERNAL_REL}
                className="mt-1 inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
              >
                Read it in full
                <ArrowUpRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </blockquote>
        ))}
      </div>
    </div>
  );
}

/**
 * The card shell. Source mark and name on the left, the headline metric and the
 * link out on the right.
 */
function SourceCard({
  id,
  mark,
  eyebrow,
  heading,
  subtitle,
  metric,
  action,
  children,
  footnote,
}: {
  id: string;
  mark: React.ReactNode;
  eyebrow: string;
  heading: string;
  subtitle?: React.ReactNode;
  metric?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  footnote: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-card"
    >
      {/* `ink-50` / `ink-950` is the page background in each theme, so the header
          band sits a step back from the card in both. The usual `dark:bg-ink-900`
          is within a point of the dark `--card` and disappears. */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-ink-50 px-6 py-5 dark:bg-ink-950">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
            {mark}
          </span>
          <div className="min-w-0">
            <p className="text-label uppercase text-ink-500">{eyebrow}</p>
            <h3 className="mt-0.5 text-h3 tracking-tighter2 text-foreground">{heading}</h3>
            {subtitle ? <div className="mt-1">{subtitle}</div> : null}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {metric}
          {action}
        </div>
      </header>

      <div className="space-y-6 px-6 py-6">{children}</div>

      <footer className="border-t border-border px-6 py-4 text-small text-muted-foreground">
        {footnote}
      </footer>
    </section>
  );
}

/** "View on Google", "Search Reddit" — same treatment for both. */
function SourceLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null;
  return (
    <Link
      href={href}
      target="_blank"
      rel={EXTERNAL_REL}
      className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
    >
      {label}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

/** 5-to-1 histogram, drawn only when the listing publishes one. */
function StarHistogram({
  breakdown,
  total,
}: {
  breakdown: NonNullable<IGoogleReviewsOverview["breakdown"]>;
  total?: number;
}) {
  const byStar = new Map(breakdown.map((b) => [b.stars, b.count]));
  const sum = breakdown.reduce((acc, b) => acc + b.count, 0);
  // Scale against the biggest bar, not the total: with 24 of 27 reviews at five
  // stars, scaling by the total leaves every other bar invisible.
  const max = Math.max(...breakdown.map((b) => b.count), 1);
  const denominator = total && total > 0 ? total : sum;

  return (
    <dl className="space-y-1.5">
      {STAR_LEVELS.map((stars) => {
        const count = byStar.get(stars) ?? 0;
        const share = denominator > 0 ? Math.round((count / denominator) * 100) : 0;
        return (
          <div key={stars} className="flex items-center gap-2.5">
            <dt className="w-10 shrink-0 text-small tabular-nums text-muted-foreground">
              {stars} star
            </dt>
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-150 dark:bg-ink-800"
              role="img"
              aria-label={`${stars} star: ${count} review${count === 1 ? "" : "s"}, ${share}%`}
            >
              <div
                className="h-full rounded-full bg-star"
                style={{ width: `${Math.round((count / max) * 100)}%` }}
              />
            </div>
            <dd className="w-8 shrink-0 text-right text-small tabular-nums text-foreground">
              {formatCount(count)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function GoogleReviewsOverview({
  name,
  data,
}: {
  name: string;
  data: IGoogleReviewsOverview;
}) {
  const hasScore = data.rating != null;
  const hasNumbers = hasScore || data.reviewCount != null || Boolean(data.breakdown?.length);

  return (
    <SourceCard
      id={GOOGLE_SECTION_ID}
      mark={<GoogleMark />}
      eyebrow="Google reviews"
      heading={data.heading?.trim() || `What Google reviewers say about ${name}`}
      subtitle={
        data.profileName ? (
          <p className="text-small text-muted-foreground">
            Listed on Google as {data.profileName}
          </p>
        ) : null
      }
      metric={
        hasScore ? (
          <div className="flex items-center gap-2">
            <span className="text-h2 leading-none tabular-nums text-foreground">
              {formatRating(data.rating)}
            </span>
            <span className="flex flex-col">
              <RatingStars value={data.rating ?? 0} size={13} />
              {data.reviewCount != null && (
                <span className="text-micro text-muted-foreground">
                  {formatCount(data.reviewCount)} Google review
                  {data.reviewCount === 1 ? "" : "s"}
                </span>
              )}
            </span>
          </div>
        ) : null
      }
      action={<SourceLink href={data.profileUrl} label="View the listing" />}
      footnote={
        <>
          {data.checkedOn ? `Checked ${data.checkedOn}. ` : null}
          Ratings and reviews above are published on Google and belong to Google. They are quoted
          here for context and are not counted in this site&rsquo;s own score.
        </>
      }
    >
      {/* Width-capped: a five-bar histogram stretched across a 1200px card reads
          as a banner rather than as the small stat block it is. */}
      {hasNumbers && data.breakdown?.length ? (
        <div className="max-w-md rounded-md border border-border bg-ink-50 p-4 dark:bg-ink-900">
          <StarHistogram breakdown={data.breakdown} total={data.reviewCount} />
        </div>
      ) : null}

      <SourceProse text={data.summary} />

      <ThemeColumns
        themes={data.themes}
        positiveLabel="What reviewers praise"
        negativeLabel="What reviewers flag"
      />

      <QuoteList quotes={data.quotes} label="In their words" />
    </SourceCard>
  );
}

// ---------------------------------------------------------------------------
// Reddit
// ---------------------------------------------------------------------------

/** Tone chip. Reddit has no stars, so this is the section's headline signal. */
function ToneChip({ tone }: { tone: NonNullable<IRedditOverview["tone"]> }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-small font-medium",
        tone === "positive" && "border-success/40 bg-success/10 text-success",
        tone === "negative" && "border-destructive/40 bg-destructive/10 text-destructive",
        tone === "mixed" && "border-border-strong bg-card text-ink-700 dark:text-ink-300",
      )}
    >
      {TONE_LABELS[tone]}
    </span>
  );
}

function ThreadList({ threads }: { threads: NonNullable<IRedditOverview["threads"]> }) {
  return (
    <div>
      <h4 className="text-label uppercase text-ink-500">Threads worth reading</h4>
      <ul className="mt-2.5 divide-y divide-border rounded-md border border-border">
        {threads.map((t, i) => {
          const meta = [
            t.subreddit ? formatSubreddit(t.subreddit) : "",
            t.date ?? "",
            t.upvotes != null ? `${formatCount(t.upvotes)} upvotes` : "",
            t.comments != null ? `${formatCount(t.comments)} comments` : "",
          ].filter(Boolean);
          return (
            <li key={`${t.url}-${i}`} className="p-4">
              <Link
                href={t.url}
                target="_blank"
                rel={EXTERNAL_REL}
                className="group inline-flex items-start gap-1.5 text-body font-medium text-foreground hover:text-accent"
              >
                <span>{t.title}</span>
                <ArrowUpRight
                  className="mt-1 size-3.5 shrink-0 text-muted-foreground group-hover:text-accent"
                  aria-hidden
                />
              </Link>
              {meta.length > 0 && (
                <p className="mt-1 text-small text-muted-foreground">{meta.join(" · ")}</p>
              )}
              {t.takeaway ? (
                <p className="mt-1.5 text-small text-ink-700 dark:text-ink-300">{t.takeaway}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RedditOverview({ name, data }: { name: string; data: IRedditOverview }) {
  const subreddits = (data.subreddits ?? []).map(formatSubreddit).filter(Boolean);

  return (
    <SourceCard
      id={REDDIT_SECTION_ID}
      mark={<RedditMark />}
      eyebrow="Reddit"
      heading={data.heading?.trim() || `What Reddit says about ${name}`}
      subtitle={
        subreddits.length || data.volumeNote ? (
          <p className="text-small text-muted-foreground">
            {[subreddits.join(", "), data.volumeNote].filter(Boolean).join(" · ")}
          </p>
        ) : null
      }
      metric={data.tone ? <ToneChip tone={data.tone} /> : null}
      action={<SourceLink href={data.searchUrl} label="Read the threads" />}
      footnote={
        <>
          {data.checkedOn ? `Checked ${data.checkedOn}. ` : null}
          Reddit posts are written by anonymous accounts and are not verified by anyone, including
          us. Treat them as leads to check, not as findings, and read the threads before acting on
          them.
        </>
      }
    >
      <SourceProse text={data.summary} />

      <ThemeColumns
        themes={data.themes}
        positiveLabel="What comes up in its favour"
        negativeLabel="What keeps getting raised"
      />

      {data.threads?.length ? <ThreadList threads={data.threads} /> : null}

      <QuoteList quotes={data.quotes} label="Comments worth quoting" />
    </SourceCard>
  );
}

// ---------------------------------------------------------------------------
// The section wrapper
// ---------------------------------------------------------------------------

/**
 * Both cards under one heading, or nothing at all.
 *
 * Returning `null` for an absent pair is what makes this safe to mount
 * unconditionally on every processor: the overwhelming majority have neither
 * section, and they render exactly the page they rendered before.
 */
export function OffsiteSentiment({
  name,
  google,
  reddit,
  className,
}: {
  name: string;
  google?: IGoogleReviewsOverview;
  reddit?: IRedditOverview;
  className?: string;
}) {
  const showGoogle = hasSentimentContent(google);
  const showReddit = hasSentimentContent(reddit);
  if (!showGoogle && !showReddit) return null;

  return (
    <section aria-labelledby="offsite-heading" className={className}>
      <div className="flex items-center gap-2">
        <MessageSquare className="size-5 text-ink-400" aria-hidden />
        <h2 id="offsite-heading" className="text-h2 tracking-tighter2 text-foreground">
          What people say about {name} elsewhere
        </h2>
      </div>
      <p className="mt-2 max-w-prose text-body text-muted-foreground">
        Summaries of the public reviews and discussion on other platforms, written by our editors
        and dated. None of it is counted in the rating this site publishes.
      </p>

      <div className="mt-6 space-y-6">
        {showGoogle && google ? <GoogleReviewsOverview name={name} data={google} /> : null}
        {showReddit && reddit ? <RedditOverview name={name} data={reddit} /> : null}
      </div>
    </section>
  );
}

export default OffsiteSentiment;
