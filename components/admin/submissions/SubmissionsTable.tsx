"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  ExternalLink,
  Eye,
  Loader2,
  MoreHorizontal,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import type { AdminSubmissionData } from "@/lib/serialize";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/enums";
import { humanizeEnum } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
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

const STATUS_VARIANT: Record<SubmissionStatus, "success" | "warning" | "neutral"> = {
  new: "warning",
  reviewing: "neutral",
  approved: "success",
  rejected: "neutral",
};

type TabKey = SubmissionStatus | "all";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "reviewing", label: "Reviewing" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export function SubmissionsTable({ rows }: { rows: AdminSubmissionData[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AdminSubmissionData | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminSubmissionData | null>(null);
  const [notes, setNotes] = React.useState("");

  const counts = React.useMemo(() => {
    const c: Record<TabKey, number> = {
      all: rows.length,
      new: 0,
      reviewing: 0,
      approved: 0,
      rejected: 0,
    };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const filtered = React.useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.status === tab)),
    [rows, tab],
  );

  const update = async (
    row: AdminSubmissionData,
    patch: { status?: SubmissionStatus; notes?: string },
    msg: string,
  ) => {
    setBusyId(row.id);
    try {
      await apiClient.patch(`/api/submissions/${row.id}`, patch);
      toast.success(msg);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not update the submission.");
    } finally {
      setBusyId(null);
    }
  };

  const convert = async (row: AdminSubmissionData) => {
    setBusyId(row.id);
    try {
      const res = await apiClient.post<{ processorId: string }>(
        `/api/submissions/${row.id}/convert`,
      );
      toast.success("Draft created — finish the listing.");
      router.push(`/admin/processors/${res.processorId}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not convert the submission.");
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await apiClient.delete(`/api/submissions/${deleteTarget.id}`);
      toast.success("Submission deleted.");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not delete the submission.");
    } finally {
      setBusyId(null);
    }
  };

  const saveNotes = async () => {
    if (!detail) return;
    await update(detail, { notes: notes.trim() }, "Notes saved.");
  };

  const columns: DataTableColumn<AdminSubmissionData>[] = [
    {
      key: "processorName",
      header: "Processor",
      sortAccessor: (r) => r.processorName.toLowerCase(),
      cell: (r) => (
        <button type="button" onClick={() => openDetail(r)} className="min-w-0 text-left">
          <span className="block truncate font-medium text-foreground hover:text-accent">
            {r.processorName}
          </span>
          <span className="block truncate text-micro text-muted-foreground">{r.website}</span>
        </button>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      sortAccessor: (r) => r.contactName.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0">
          <span className="block truncate text-small">{r.contactName}</span>
          <span className="block truncate text-micro text-muted-foreground">{r.contactEmail}</span>
        </div>
      ),
    },
    {
      key: "requestedTier",
      header: "Tier",
      sortAccessor: (r) => r.requestedTier ?? "",
      cell: (r) => (
        <span className="text-small capitalize">{r.requestedTier ?? "—"}</span>
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
      cell: (r) => <span className="text-micro text-muted-foreground">{formatDate(r.createdAt)}</span>,
    },
  ];

  function openDetail(r: AdminSubmissionData) {
    setNotes(r.notes ?? "");
    setDetail(r);
  }

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
        searchAccessor={(r) => `${r.processorName} ${r.website} ${r.contactName} ${r.contactEmail}`}
        searchPlaceholder="Search submissions…"
        initialSort={{ key: "createdAt", dir: "desc" }}
        emptyState="No submissions in this view."
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Actions for ${r.processorName}`}
                disabled={busyId === r.id}
              >
                {busyId === r.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => openDetail(r)}>
                <Eye className="size-4" />
                View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void convert(r);
                }}
              >
                <Wand2 className="size-4" />
                Convert to processor
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {r.status !== "reviewing" && (
                <DropdownMenuItem onSelect={() => void update(r, { status: "reviewing" }, "Marked reviewing.")}>
                  <ArrowUpRight className="size-4" />
                  Mark reviewing
                </DropdownMenuItem>
              )}
              {r.status !== "approved" && (
                <DropdownMenuItem onSelect={() => void update(r, { status: "approved" }, "Marked approved.")}>
                  <Check className="size-4" />
                  Mark approved
                </DropdownMenuItem>
              )}
              {r.status !== "rejected" && (
                <DropdownMenuItem onSelect={() => void update(r, { status: "rejected" }, "Marked rejected.")}>
                  <X className="size-4" />
                  Mark rejected
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
                <DialogTitle>{detail.processorName}</DialogTitle>
                <DialogDescription>
                  Submitted {formatDate(detail.createdAt)} ·{" "}
                  {detail.requestedTier ? `${humanizeEnum(detail.requestedTier)} tier` : "no tier requested"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-small">
                <Badge variant={STATUS_VARIANT[detail.status]} className="capitalize">
                  {detail.status}
                </Badge>
                <DetailRow label="Website">
                  <a
                    href={detail.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    {detail.website}
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </DetailRow>
                <DetailRow label="Contact">
                  {detail.contactName} ·{" "}
                  <a href={`mailto:${detail.contactEmail}`} className="text-accent hover:underline">
                    {detail.contactEmail}
                  </a>
                </DetailRow>
                {detail.description && (
                  <div className="rounded-md border border-border bg-ink-50 p-3 dark:bg-ink-900">
                    <p className="whitespace-pre-line text-ink-800 dark:text-ink-200">
                      {detail.description}
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <span className="text-label uppercase text-ink-500">Internal notes</span>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes for your team (not shown to the submitter)."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void saveNotes()}
                    disabled={busyId === detail.id || notes.trim() === (detail.notes ?? "")}
                  >
                    Save notes
                  </Button>
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="accent"
                  disabled={busyId === detail.id}
                  onClick={() => void convert(detail)}
                >
                  <Wand2 className="size-4" />
                  Convert to processor
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete submission?</DialogTitle>
            <DialogDescription>
              This permanently deletes the {deleteTarget?.processorName} submission. This can’t be
              undone.
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
      <span className="text-ink-800 dark:text-ink-200">{children}</span>
    </div>
  );
}

export default SubmissionsTable;
