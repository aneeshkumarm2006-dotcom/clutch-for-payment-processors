"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, Minus, X } from "lucide-react";
import { cn, orDash } from "@/lib/utils";
import { humanizeEnum } from "@/lib/labels";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/public/RatingStars";
import { VisitWebsiteButton } from "@/components/public/VisitWebsiteButton";
import type { FeesData, ProcessorDetailData } from "@/lib/serialize";

/**
 * CompareTable (DESIGN §6.9 / PRD §9.4) — processors as columns, attributes as
 * rows. A sticky logo/name header, then sections: Pricing, Payment methods,
 * Integrations, Features, Company facts, and a CTAs row. The ✓/✗ matrices show
 * the union of items present across the compared columns. The first (label)
 * column is sticky so the table stays readable under horizontal scroll on mobile.
 */

const cardFee = (p: ProcessorDetailData, key: keyof FeesData) => p.fees[key];

/** Pricing rows — each pulls a value (or "—"/"Varies") from a processor. */
const PRICING_ROWS: { label: string; value: (p: ProcessorDetailData) => string }[] = [
  { label: "Online card rate", value: (p) => orDash(cardFee(p, "onlineCardRate")) },
  { label: "In-person rate", value: (p) => orDash(cardFee(p, "inPersonCardRate")) },
  { label: "Keyed-in rate", value: (p) => orDash(cardFee(p, "keyedInRate")) },
  { label: "International", value: (p) => orDash(cardFee(p, "internationalRate")) },
  { label: "ACH / bank", value: (p) => orDash(cardFee(p, "achRate")) },
  { label: "Monthly fee", value: (p) => orDash(cardFee(p, "monthlyFee")) },
  { label: "Setup fee", value: (p) => orDash(cardFee(p, "setupFee")) },
  { label: "Monthly minimum", value: (p) => orDash(cardFee(p, "monthlyMinimum")) },
  { label: "Chargeback fee", value: (p) => orDash(cardFee(p, "chargebackFee")) },
  {
    label: "Pricing model",
    value: (p) => (p.pricingModel.length ? p.pricingModel.map(humanizeEnum).join(", ") : "—"),
  },
  { label: "Contract", value: (p) => (p.contractType ? humanizeEnum(p.contractType) : "—") },
  {
    label: "Free trial",
    value: (p) => (p.freeTrial === undefined ? "—" : p.freeTrial ? "Yes" : "No"),
  },
  { label: "Payout time", value: (p) => (p.payoutTime ? humanizeEnum(p.payoutTime) : "—") },
];

/** Company-fact rows. */
const COMPANY_ROWS: { label: string; value: (p: ProcessorDetailData) => string }[] = [
  { label: "Founded", value: (p) => (p.foundedYear ? String(p.foundedYear) : "—") },
  { label: "Headquarters", value: (p) => orDash(p.headquarters) },
  { label: "Company size", value: (p) => (p.companySize ? `${p.companySize} staff` : "—") },
  {
    label: "Regions",
    value: (p) => (p.supportedRegions.length ? p.supportedRegions.join(", ") : "—"),
  },
  { label: "PCI level", value: (p) => orDash(p.pciLevel) },
  { label: "Currencies", value: (p) => orDash(p.currencies) },
  { label: "High-risk friendly", value: (p) => (p.highRiskFriendly ? "Yes" : "No") },
];

/** Union of an array-valued capability across columns, in enum-stable order. */
function unionKeys(processors: ProcessorDetailData[], pick: (p: ProcessorDetailData) => string[]) {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const p of processors) {
    for (const v of pick(p)) {
      if (!seen.has(v)) {
        seen.add(v);
        order.push(v);
      }
    }
  }
  return order;
}

export function CompareTable({
  processors,
  onRemove,
}: {
  processors: ProcessorDetailData[];
  onRemove?: (slug: string) => void;
}) {
  const methods = unionKeys(processors, (p) => p.paymentMethods);
  const integrations = unionKeys(processors, (p) => p.integrations);
  const features = unionKeys(processors, (p) => p.features);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] border-collapse text-small">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-20 w-44 min-w-[11rem] border-b border-border-strong bg-card p-3 text-left align-bottom"
            >
              <span className="text-label uppercase text-ink-500">Compare</span>
            </th>
            {processors.map((p) => (
              <th
                key={p.id}
                scope="col"
                className="min-w-[12rem] border-b border-l border-border-strong bg-card p-3 text-left align-top"
              >
                <div className="flex items-start gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded border bg-ink-0">
                    {p.logo ? (
                      <Image
                        src={p.logo}
                        alt={`${p.name} logo`}
                        width={36}
                        height={36}
                        className="size-9 object-contain p-1"
                        unoptimized
                      />
                    ) : (
                      <span className="text-body font-semibold text-ink-400">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/processor/${p.slug}`}
                      className="block truncate text-body font-semibold text-foreground hover:text-accent"
                    >
                      {p.name}
                    </Link>
                    <RatingStars
                      value={p.ratingAverage}
                      count={p.ratingCount}
                      showValue
                      showCount
                      emptyLabel="No reviews"
                      size={13}
                      className="mt-1"
                    />
                  </div>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(p.slug)}
                      aria-label={`Remove ${p.name} from comparison`}
                      className="rounded-sm p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {p.isSponsored && (
                  <Badge variant="sponsored" className="mt-2">
                    Sponsored
                  </Badge>
                )}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <ValueSection title="Pricing" rows={PRICING_ROWS} processors={processors} />

          <MatrixSection
            title="Payment methods"
            keys={methods}
            processors={processors}
            has={(p, k) => p.paymentMethods.includes(k as never)}
          />
          <MatrixSection
            title="Integrations"
            keys={integrations}
            processors={processors}
            has={(p, k) => p.integrations.includes(k as never)}
          />
          <MatrixSection
            title="Features"
            keys={features}
            processors={processors}
            has={(p, k) => p.features.includes(k as never)}
          />

          <ValueSection title="Company" rows={COMPANY_ROWS} processors={processors} />

          {/* CTAs row */}
          <SectionRow title="Get started" span={processors.length} />
          <tr>
            <th scope="row" className="sticky left-0 z-10 bg-card p-3 text-left align-top">
              <span className="text-secondary">Visit / profile</span>
            </th>
            {processors.map((p) => (
              <td key={p.id} className="border-l border-ink-150 p-3 align-top dark:border-ink-800">
                <div className="flex flex-col gap-2">
                  <VisitWebsiteButton
                    website={p.website}
                    affiliateUrl={p.affiliateUrl}
                    slug={p.slug}
                    variant="primary"
                    size="sm"
                    className="w-full"
                  />
                  <Link
                    href={`/processor/${p.slug}`}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-full")}
                  >
                    View profile
                  </Link>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** A full-width section band (faint ink-50 band per DESIGN §6.9). */
function SectionRow({ title, span }: { title: string; span: number }) {
  return (
    <tr>
      <th
        scope="colgroup"
        colSpan={span + 1}
        className="sticky left-0 bg-ink-50 px-3 py-2 text-left text-label uppercase text-ink-600 dark:bg-ink-900"
      >
        {title}
      </th>
    </tr>
  );
}

function ValueSection({
  title,
  rows,
  processors,
}: {
  title: string;
  rows: { label: string; value: (p: ProcessorDetailData) => string }[];
  processors: ProcessorDetailData[];
}) {
  return (
    <>
      <SectionRow title={title} span={processors.length} />
      {rows.map((row) => (
        <tr key={row.label} className="border-t border-ink-150 dark:border-ink-800">
          <th
            scope="row"
            className="sticky left-0 z-10 bg-card p-3 text-left font-normal text-secondary"
          >
            {row.label}
          </th>
          {processors.map((p) => (
            <td
              key={p.id}
              className="border-l border-ink-150 p-3 tabular-nums text-foreground dark:border-ink-800"
            >
              {row.value(p)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function MatrixSection({
  title,
  keys,
  processors,
  has,
}: {
  title: string;
  keys: string[];
  processors: ProcessorDetailData[];
  has: (p: ProcessorDetailData, key: string) => boolean;
}) {
  if (keys.length === 0) return null;
  return (
    <>
      <SectionRow title={title} span={processors.length} />
      {keys.map((key) => (
        <tr key={key} className="border-t border-ink-150 dark:border-ink-800">
          <th
            scope="row"
            className="sticky left-0 z-10 bg-card p-3 text-left font-normal text-secondary"
          >
            {humanizeEnum(key)}
          </th>
          {processors.map((p) => (
            <td
              key={p.id}
              className="border-l border-ink-150 p-3 dark:border-ink-800"
            >
              {has(p, key) ? (
                <>
                  <Check className="size-4 text-accent" aria-hidden />
                  <span className="sr-only">Yes</span>
                </>
              ) : (
                <>
                  <Minus className="size-4 text-ink-300" aria-hidden />
                  <span className="sr-only">No</span>
                </>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default CompareTable;
