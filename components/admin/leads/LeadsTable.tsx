"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Download, Eye, MoreHorizontal, PhoneCall, Trash2, XCircle } from "lucide-react";
import type { AdminLeadData } from "@/lib/serialize";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/enums";
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

const STATUS_VARIANT: Record<LeadStatus, "success" | "warning" | "neutral"> = {
  new: "warning",
  contacted: "neutral",
  closed: "success",
};

type TabKey = LeadStatus | "all";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "closed", label: "Closed" },
];

export function LeadsTable({ rows }: { rows: AdminLeadData[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AdminLeadData | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminLeadData | null>(null);

  const counts = React.useMemo(() => {
    const c: Record<TabKey, number> = { all: rows.length, new: 0, contacted: 0, closed: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const filtered = React.useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.status === tab)),
    [rows, tab],
  );

  const setStatus = async (row: AdminLeadData, status: LeadStatus) => {
    setBusyId(row.id);
    try {
      await apiClient.patch(`/api/leads/${row.id}`, { status });
      toast.success(`Marked ${status}.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update the lead.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await apiClient.delete(`/api/leads/${deleteTarget.id}`);
      toast.success("Lead deleted.");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the lead.");
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<AdminLeadData>[] = [
    {
      key: "name",
      header: "Name",
      sortAccessor: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <button type="button" onClick={() => setDetail(r)} className="min-w-0 text-left">
          <span className="block truncate font-medium text-foreground hover:text-accent">
            {r.name}
          </span>
          <span className="block truncate text-micro text-muted-foreground">{r.email}</span>
        </button>
      ),
    },
    {
      key: "processor",
      header: "Processor",
      sortAccessor: (r) => r.processorName?.toLowerCase() ?? "",
      cell: (r) => <span className="text-small">{r.processorName ?? "Get matched"}</span>,
    },
    {
      key: "monthlyVolume",
      header: "Volume",
      sortAccessor: (r) => r.monthlyVolume ?? "",
      cell: (r) => <span className="text-small tabular-nums">{r.monthlyVolume ?? "—"}</span>,
    },
    {
      key: "source",
      header: "Source",
      sortAccessor: (r) => r.source,
      cell: (r) => <span className="text-micro text-muted-foreground">{humanizeEnum(r.source)}</span>,
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
      cell: (r) => <span className="text-micro text-muted-foreground">{formatDate(r.createdAt)}</span>,
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
        <Button variant="secondary" size="sm" onClick={() => exportLeadsCsv(filtered)} disabled={filtered.length === 0}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <DataTable
        rows={filtered}
        columns={columns}
        getRowKey={(r) => r.id}
        searchAccessor={(r) =>
          `${r.name} ${r.email} ${r.businessName ?? ""} ${r.processorName ?? ""} ${r.source}`
        }
        searchPlaceholder="Search leads…"
        initialSort={{ key: "createdAt", dir: "desc" }}
        emptyState="No leads in this view."
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${r.name}`}
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
              {r.status !== "closed" && (
                <DropdownMenuItem onSelect={() => void setStatus(r, "closed")}>
                  <Check className="size-4" />
                  Mark closed
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
                <DialogTitle>{detail.name}</DialogTitle>
                <DialogDescription>
                  {detail.processorName ? `Quote — ${detail.processorName}` : "Get matched"} ·{" "}
                  {formatDate(detail.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-small">
                <Badge variant={STATUS_VARIANT[detail.status]} className="capitalize">
                  {detail.status}
                </Badge>
                <DetailRow label="Email">
                  <a href={`mailto:${detail.email}`} className="text-accent hover:underline">
                    {detail.email}
                  </a>
                </DetailRow>
                {detail.phone && (
                  <DetailRow label="Phone">
                    <a href={`tel:${detail.phone}`} className="text-accent hover:underline">
                      {detail.phone}
                    </a>
                  </DetailRow>
                )}
                {detail.businessName && <DetailRow label="Business">{detail.businessName}</DetailRow>}
                {detail.businessType && <DetailRow label="Business type">{detail.businessType}</DetailRow>}
                {detail.monthlyVolume && <DetailRow label="Monthly volume">{detail.monthlyVolume}</DetailRow>}
                <DetailRow label="Source">{humanizeEnum(detail.source)}</DetailRow>
                {detail.message && (
                  <div className="rounded-md border border-border bg-ink-50 p-3 dark:bg-ink-900">
                    <p className="whitespace-pre-line text-ink-800 dark:text-ink-200">{detail.message}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                {detail.status !== "contacted" && (
                  <Button
                    variant="primary"
                    disabled={busyId === detail.id}
                    onClick={() => {
                      void setStatus(detail, "contacted");
                      setDetail(null);
                    }}
                  >
                    <PhoneCall className="size-4" />
                    Mark contacted
                  </Button>
                )}
                {detail.status !== "closed" && (
                  <Button
                    variant="secondary"
                    disabled={busyId === detail.id}
                    onClick={() => {
                      void setStatus(detail, "closed");
                      setDetail(null);
                    }}
                  >
                    <Check className="size-4" />
                    Mark closed
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
            <DialogTitle>Delete lead?</DialogTitle>
            <DialogDescription>
              This permanently deletes {deleteTarget?.name}’s enquiry. This can’t be undone.
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

/** CSV export (PRD §10.6 optional) — client-side blob download of the current view. */
function exportLeadsCsv(rows: AdminLeadData[]) {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Business",
    "Business type",
    "Monthly volume",
    "Processor",
    "Source",
    "Status",
    "Date",
    "Message",
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.phone ?? "",
      r.businessName ?? "",
      r.businessType ?? "",
      r.monthlyVolume ?? "",
      r.processorName ?? "Get matched",
      r.source,
      r.status,
      new Date(r.createdAt).toISOString(),
      (r.message ?? "").replace(/\n/g, " "),
    ]
      .map((v) => escape(String(v)))
      .join(","),
  );
  const csv = [headers.map(escape).join(","), ...lines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
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

export default LeadsTable;
