"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  Check,
  Download,
  Eye,
  MailWarning,
  MoreHorizontal,
  PhoneCall,
  Trash2,
  XCircle,
} from "lucide-react";
import type { AdminOfferSignupData } from "@/lib/serialize";
import { OFFER_VOLUMES, type OfferSignupStatus, type OfferVolume } from "@/lib/enums";
import { humanizeEnum } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/**
 * Fee-sheet signups inbox.
 *
 * Two axes matter here and they are deliberately given different controls. The
 * TABS are the volume segment, because that is the question the offer was built
 * to answer and the thing you act on: a `$50k+` signup is a sales conversation,
 * a `<$10k` signup is a mailing list. STATUS is a per-row menu, because it is
 * bookkeeping. Putting status on the tabs (as the Leads inbox does) would bury
 * the segmentation one click deep and make the volume dropdown pointless.
 */

const STATUS_VARIANT: Record<OfferSignupStatus, "success" | "warning" | "neutral"> = {
  new: "warning",
  contacted: "neutral",
  archived: "success",
};

/** `all` plus one tab per bucket, plus the people who never answered. */
type TabKey = "all" | OfferVolume | "unknown";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  ...OFFER_VOLUMES.map((v) => ({ key: v as TabKey, label: v })),
  { key: "unknown", label: "No volume" },
];

export function OfferSignupsTable({ rows }: { rows: AdminOfferSignupData[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AdminOfferSignupData | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminOfferSignupData | null>(null);

  const counts = React.useMemo(() => {
    const c = Object.fromEntries(TABS.map((t) => [t.key, 0])) as Record<TabKey, number>;
    c.all = rows.length;
    for (const r of rows) c[(r.volume ?? "unknown") as TabKey] += 1;
    return c;
  }, [rows]);

  const filtered = React.useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => (r.volume ?? "unknown") === tab)),
    [rows, tab],
  );

  const setStatus = async (row: AdminOfferSignupData, status: OfferSignupStatus) => {
    setBusyId(row.id);
    try {
      await apiClient.patch(`/api/offer-signups/${row.id}`, { status });
      toast.success(`Marked ${status}.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update the signup.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await apiClient.delete(`/api/offer-signups/${deleteTarget.id}`);
      toast.success("Signup deleted.");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the signup.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<AdminOfferSignupData>[] = [
    {
      key: "email",
      header: "Email",
      sortAccessor: (r) => r.email,
      cell: (r) => (
        <button type="button" onClick={() => setDetail(r)} className="min-w-0 text-left">
          <span className="block truncate font-medium text-foreground hover:text-accent">
            {r.email}
          </span>
          {r.submissions > 1 && (
            <span className="block text-micro text-muted-foreground">
              asked {r.submissions} times
            </span>
          )}
        </button>
      ),
    },
    {
      key: "volume",
      header: "Volume",
      // Sorts in bucket order, not alphabetically: "<$10k" and "$50k+" sort by
      // their first character otherwise, which is meaningless. Unknown last.
      sortAccessor: (r) => (r.volume ? OFFER_VOLUMES.indexOf(r.volume) : OFFER_VOLUMES.length),
      cell: (r) =>
        r.volume ? (
          <Badge variant="neutral" className="tabular-nums">
            {r.volume}
          </Badge>
        ) : (
          <span className="text-small text-muted-foreground">Not given</span>
        ),
    },
    {
      key: "pagePath",
      header: "Signed up on",
      sortAccessor: (r) => r.pagePath ?? "",
      cell: (r) =>
        r.pagePath ? (
          <a
            href={r.pagePath}
            target="_blank"
            rel="noopener"
            className="block max-w-[22ch] truncate text-small text-accent hover:underline"
          >
            {r.pagePath}
          </a>
        ) : (
          <span className="text-small text-muted-foreground">Unknown</span>
        ),
    },
    {
      key: "delivered",
      header: "Sheet",
      sortAccessor: (r) => (r.delivered ? 1 : 0),
      cell: (r) =>
        r.delivered ? (
          <span className="text-small text-muted-foreground">Sent</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-small text-warning">
            <MailWarning className="size-3.5" aria-hidden />
            {r.deliveryError ? "Failed" : "Not sent"}
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortAccessor: (r) => r.status,
      cell: (r) => (
        <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
          {r.status}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Date",
      sortAccessor: (r) => r.createdAt,
      cell: (r) => (
        <span className="text-micro text-muted-foreground">{formatDate(r.createdAt)}</span>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <Button
          variant="secondary"
          size="sm"
          onClick={() => exportSignupsCsv(filtered, tab)}
          disabled={filtered.length === 0}
        >
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        getRowKey={(r) => r.id}
        searchAccessor={(r) =>
          `${r.email} ${r.volume ?? ""} ${r.pagePath ?? ""} ${r.utmCampaign ?? ""} ${r.utmSource ?? ""}`
        }
        searchPlaceholder="Search signups…"
        initialSort={{ key: "createdAt", dir: "desc" }}
        emptyState="No signups in this view."
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${r.email}`}
                disabled={busyId === r.id}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => setDetail(r)}>
                <Eye className="size-4" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {r.status !== "contacted" && (
                <DropdownMenuItem onSelect={() => void setStatus(r, "contacted")}>
                  <PhoneCall className="size-4" />
                  Mark contacted
                </DropdownMenuItem>
              )}
              {r.status !== "archived" && (
                <DropdownMenuItem onSelect={() => void setStatus(r, "archived")}>
                  <Archive className="size-4" />
                  Archive
                </DropdownMenuItem>
              )}
              {r.status !== "new" && (
                <DropdownMenuItem onSelect={() => void setStatus(r, "new")}>
                  <XCircle className="size-4" />
                  Reopen (new)
                </DropdownMenuItem>
              )}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="break-all">{detail.email}</DialogTitle>
                <DialogDescription>
                  {humanizeEnum(detail.offer)} · {formatDate(detail.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-small">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={STATUS_VARIANT[detail.status]} className="capitalize">
                    {detail.status}
                  </Badge>
                  {detail.volume && <Badge variant="neutral">{detail.volume}</Badge>}
                </div>

                <DetailRow label="Email">
                  <a href={`mailto:${detail.email}`} className="break-all text-accent hover:underline">
                    {detail.email}
                  </a>
                </DetailRow>
                <DetailRow label="Monthly volume">{detail.volume ?? "Not given"}</DetailRow>
                <DetailRow label="Signed up on">
                  {detail.pagePath ? (
                    <a
                      href={detail.pagePath}
                      target="_blank"
                      rel="noopener"
                      className="break-all text-accent hover:underline"
                    >
                      {detail.pagePath}
                    </a>
                  ) : (
                    "Unknown"
                  )}
                </DetailRow>
                {detail.pageType && (
                  <DetailRow label="Page type">{humanizeEnum(detail.pageType)}</DetailRow>
                )}
                {detail.submissions > 1 && (
                  <DetailRow label="Requests">
                    {detail.submissions} (asked for the sheet more than once)
                  </DetailRow>
                )}
                {(detail.utmSource || detail.utmMedium || detail.utmCampaign) && (
                  <DetailRow label="Campaign">
                    {[detail.utmSource, detail.utmMedium, detail.utmCampaign]
                      .filter(Boolean)
                      .join(" / ")}
                  </DetailRow>
                )}
                {detail.referrer && (
                  <DetailRow label="Referrer">
                    <span className="break-all">{detail.referrer}</span>
                  </DetailRow>
                )}

                <DetailRow label="Sheet delivery">
                  {detail.delivered
                    ? `Emailed ${detail.deliveredAt ? formatDate(detail.deliveredAt) : ""}`.trim()
                    : detail.deliveryError
                      ? `Failed: ${detail.deliveryError}`
                      : "Never sent. Email it to them by hand."}
                </DetailRow>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                {!detail.delivered && (
                  <Button variant="primary" asChild>
                    <a href={`mailto:${detail.email}?subject=${encodeURIComponent("Your processor fee comparison sheet")}`}>
                      Send it by hand
                    </a>
                  </Button>
                )}
                {detail.status !== "contacted" && (
                  <Button
                    variant="secondary"
                    disabled={busyId === detail.id}
                    onClick={() => {
                      void setStatus(detail, "contacted");
                      setDetail(null);
                    }}
                  >
                    <Check className="size-4" />
                    Mark contacted
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete signup?</DialogTitle>
            <DialogDescription>
              This permanently removes {deleteTarget?.email} from the fee-sheet list. Use it for
              erasure requests; otherwise archive instead, so the address is not re-added silently.
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

/**
 * CSV of the CURRENT view, so "export the $50k+ segment" is select-tab-then-click
 * rather than a spreadsheet filter afterwards. The filename records the segment
 * for the same reason.
 */
function exportSignupsCsv(rows: AdminOfferSignupData[], tab: string) {
  const headers = [
    "Email",
    "Monthly volume",
    "Offer",
    "Status",
    "Signed up on",
    "Page type",
    "UTM source",
    "UTM medium",
    "UTM campaign",
    "Referrer",
    "Sheet sent",
    "Requests",
    "Date",
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.email,
      r.volume ?? "",
      r.offer,
      r.status,
      r.pagePath ?? "",
      r.pageType ?? "",
      r.utmSource ?? "",
      r.utmMedium ?? "",
      r.utmCampaign ?? "",
      r.referrer ?? "",
      r.delivered ? "yes" : "no",
      String(r.submissions),
      new Date(r.createdAt).toISOString(),
    ]
      .map((v) => escape(String(v)))
      .join(","),
  );
  const csv = [headers.map(escape).join(","), ...lines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Volume buckets contain "$", "<" and "+", none of which belong in a filename.
  const segment = tab === "all" ? "all" : tab.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  a.download = `fee-sheet-signups-${segment}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-label uppercase text-ink-500">{label}</span>
      <span className="text-ink-800 dark:text-ink-200">{children}</span>
    </div>
  );
}

export default OfferSignupsTable;
