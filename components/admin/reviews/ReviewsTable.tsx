"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeCheck,
  Check,
  Eye,
  MoreHorizontal,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { AdminReviewData } from "@/lib/serialize";
import { REVIEW_STATUSES, SUB_RATING_KEYS, type ReviewStatus, type SubRatingKey } from "@/lib/enums";
import { humanizeEnum } from "@/lib/labels";
import { formatDate, formatRating } from "@/lib/utils";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SUB_LABELS: Record<SubRatingKey, string> = {
  easeOfUse: "Ease of use",
  pricing: "Pricing",
  support: "Support",
  features: "Features",
  reliability: "Reliability",
};

const STATUS_VARIANT: Record<ReviewStatus, "success" | "warning" | "neutral"> = {
  approved: "success",
  pending: "warning",
  rejected: "neutral",
};

type TabKey = ReviewStatus | "all";
const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export function ReviewsTable({ rows }: { rows: AdminReviewData[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("pending");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AdminReviewData | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminReviewData | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<AdminReviewData | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const counts = React.useMemo(() => {
    const c: Record<TabKey, number> = { pending: 0, approved: 0, rejected: 0, all: rows.length };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const filtered = React.useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.status === tab)),
    [rows, tab],
  );

  const moderate = async (
    row: AdminReviewData,
    patch: { status?: ReviewStatus; isVerified?: boolean; rejectionReason?: string },
    successMsg: string,
  ) => {
    setBusyId(row.id);
    try {
      await apiClient.patch(`/api/reviews/${row.id}`, patch);
      toast.success(successMsg);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update the review.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    await moderate(
      rejectTarget,
      { status: "rejected", rejectionReason: rejectReason.trim() || undefined },
      "Review rejected.",
    );
    setRejectTarget(null);
    setRejectReason("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await apiClient.delete(`/api/reviews/${deleteTarget.id}`);
      toast.success("Review deleted.");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the review.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<AdminReviewData>[] = [
    {
      key: "reviewer",
      header: "Reviewer",
      sortAccessor: (r) => r.reviewerName.toLowerCase(),
      cell: (r) => (
        <button
          type="button"
          onClick={() => setDetail(r)}
          className="min-w-0 text-left"
        >
          <span className="block truncate font-medium text-foreground hover:text-accent">
            {r.reviewerName}
          </span>
          <span className="block truncate text-micro text-muted-foreground">{r.title}</span>
        </button>
      ),
    },
    {
      key: "processor",
      header: "Processor",
      sortAccessor: (r) => r.processorName?.toLowerCase() ?? "",
      cell: (r) => <span className="text-small">{r.processorName ?? "—"}</span>,
    },
    {
      key: "overallRating",
      header: "Rating",
      sortAccessor: (r) => r.overallRating,
      cell: (r) => (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Star className="size-3.5 fill-star text-star" aria-hidden />
          {formatRating(r.overallRating)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortAccessor: (r) => r.status,
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
            {r.status}
          </Badge>
          {r.isVerified && (
            <span title="Verified" className="text-accent">
              <BadgeCheck className="size-4" aria-hidden />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      sortAccessor: (r) => r.source,
      cell: (r) => <span className="text-micro text-muted-foreground">{humanizeEnum(r.source)}</span>,
    },
    {
      key: "createdAt",
      header: "Date",
      sortAccessor: (r) => r.createdAt,
      cell: (r) => <span className="text-micro text-muted-foreground">{formatDate(r.createdAt)}</span>,
    },
  ];

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
              <span className="ml-1.5 tabular-nums text-micro text-muted-foreground">
                {counts[t.key]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        rows={filtered}
        columns={columns}
        getRowKey={(r) => r.id}
        searchAccessor={(r) => `${r.reviewerName} ${r.title} ${r.processorName ?? ""} ${r.reviewerEmail}`}
        searchPlaceholder="Search reviews…"
        initialSort={{ key: "createdAt", dir: "desc" }}
        emptyState="No reviews in this view."
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${r.reviewerName}'s review`}
                disabled={busyId === r.id}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setDetail(r)}>
                <Eye className="size-4" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {r.status !== "approved" && (
                <DropdownMenuItem onSelect={() => void moderate(r, { status: "approved" }, "Review approved.")}>
                  <Check className="size-4" />
                  Approve
                </DropdownMenuItem>
              )}
              {r.status !== "rejected" && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setRejectReason(r.rejectionReason ?? "");
                    setRejectTarget(r);
                  }}
                >
                  <X className="size-4" />
                  Reject
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() =>
                  void moderate(
                    r,
                    { isVerified: !r.isVerified },
                    r.isVerified ? "Marked unverified." : "Marked verified.",
                  )
                }
              >
                <BadgeCheck className="size-4" />
                {r.isVerified ? "Remove verified" : "Mark verified"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteTarget(r);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.title}
                  {detail.isVerified && <BadgeCheck className="size-4 text-accent" aria-hidden />}
                </DialogTitle>
                <DialogDescription>
                  {detail.reviewerName}
                  {detail.reviewerTitle ? `, ${detail.reviewerTitle}` : ""} ·{" "}
                  {detail.processorName ?? "Unknown processor"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-small">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={STATUS_VARIANT[detail.status]} className="capitalize">
                    {detail.status}
                  </Badge>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Star className="size-3.5 fill-star text-star" aria-hidden />
                    {formatRating(detail.overallRating)} overall
                  </span>
                  <span className="text-muted-foreground">{formatDate(detail.createdAt)}</span>
                </div>

                <DetailRow label="Email">
                  <a href={`mailto:${detail.reviewerEmail}`} className="text-accent hover:underline">
                    {detail.reviewerEmail}
                  </a>
                </DetailRow>
                {detail.companyName && <DetailRow label="Company">{detail.companyName}</DetailRow>}
                {detail.companySize && <DetailRow label="Company size">{detail.companySize}</DetailRow>}
                {detail.industry && <DetailRow label="Industry">{detail.industry}</DetailRow>}
                {detail.monthlyVolume && (
                  <DetailRow label="Monthly volume">{detail.monthlyVolume}</DetailRow>
                )}

                <div className="rounded-md border border-border bg-ink-50 p-3 dark:bg-ink-900">
                  <p className="whitespace-pre-line text-ink-800 dark:text-ink-200">{detail.body}</p>
                </div>

                {detail.pros && <DetailRow label="Pros">{detail.pros}</DetailRow>}
                {detail.cons && <DetailRow label="Cons">{detail.cons}</DetailRow>}
                {detail.useCase && <DetailRow label="Use case">{detail.useCase}</DetailRow>}

                <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-3">
                  {SUB_RATING_KEYS.map((key) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-micro text-muted-foreground">{SUB_LABELS[key]}</span>
                      <span className="text-micro font-semibold tabular-nums">
                        {formatRating(detail.subRatings[key])}
                      </span>
                    </div>
                  ))}
                </div>

                {detail.status === "rejected" && detail.rejectionReason && (
                  <DetailRow label="Rejection reason">{detail.rejectionReason}</DetailRow>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                {detail.status !== "approved" && (
                  <Button
                    variant="primary"
                    disabled={busyId === detail.id}
                    onClick={() => {
                      void moderate(detail, { status: "approved" }, "Review approved.");
                      setDetail(null);
                    }}
                  >
                    <Check className="size-4" />
                    Approve
                  </Button>
                )}
                {detail.status !== "rejected" && (
                  <Button
                    variant="secondary"
                    disabled={busyId === detail.id}
                    onClick={() => {
                      setRejectReason(detail.rejectionReason ?? "");
                      setRejectTarget(detail);
                      setDetail(null);
                    }}
                  >
                    <X className="size-4" />
                    Reject
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this review?</DialogTitle>
            <DialogDescription>
              Optionally note why. The reviewer’s email stays private; this reason is for your
              records only.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason (optional) — e.g. spam, off-topic, unverifiable."
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
              disabled={!!busyId}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmReject()} disabled={!!busyId}>
              Reject review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete review?</DialogTitle>
            <DialogDescription>
              This permanently deletes {deleteTarget?.reviewerName}’s review. If it was approved, the
              processor’s rating will be recalculated. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={!!busyId}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={!!busyId}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label uppercase text-ink-500">{label}</span>
      <span className="whitespace-pre-line text-ink-800 dark:text-ink-200">{children}</span>
    </div>
  );
}

export default ReviewsTable;
