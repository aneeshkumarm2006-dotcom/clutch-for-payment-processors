"use client";

import type { AuditLogData } from "@/lib/serialize";
import type { AuditAction } from "@/models/AuditLog";
import { humanizeEnum } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";

const ACTION_VARIANT: Record<AuditAction, "success" | "warning" | "destructive" | "neutral"> = {
  create: "success",
  update: "warning",
  moderate: "neutral",
  delete: "destructive",
};

/** Read-only audit trail (Phase 2 — PRD §11). Search + sort + paginate only. */
export function AuditTable({ rows }: { rows: AuditLogData[] }) {
  const columns: DataTableColumn<AuditLogData>[] = [
    {
      key: "createdAt",
      header: "When",
      sortAccessor: (r) => r.createdAt,
      cell: (r) => <span className="text-small text-muted-foreground">{formatDate(r.createdAt)}</span>,
    },
    {
      key: "actorName",
      header: "Actor",
      sortAccessor: (r) => r.actorName.toLowerCase(),
      cell: (r) => <span className="font-medium text-foreground">{r.actorName}</span>,
    },
    {
      key: "action",
      header: "Action",
      sortAccessor: (r) => r.action,
      cell: (r) => (
        <Badge variant={ACTION_VARIANT[r.action]} className="capitalize">
          {r.action}
        </Badge>
      ),
    },
    {
      key: "entity",
      header: "Entity",
      sortAccessor: (r) => r.entity,
      cell: (r) => (
        <div className="min-w-0">
          <span className="block text-small capitalize text-foreground">{humanizeEnum(r.entity)}</span>
          {r.entityLabel && (
            <span className="block truncate text-micro text-muted-foreground">{r.entityLabel}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(r) => r.id}
      searchAccessor={(r) => `${r.actorName} ${r.action} ${r.entity} ${r.entityLabel ?? ""}`}
      searchPlaceholder="Search the audit log…"
      initialSort={{ key: "createdAt", dir: "desc" }}
      emptyState="No admin activity recorded yet."
    />
  );
}

export default AuditTable;
