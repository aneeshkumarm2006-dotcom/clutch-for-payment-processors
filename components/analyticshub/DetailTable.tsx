"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtNumber, fmtCurrency, fmtPercent, fmtPosition } from "@/lib/analyticshub/format";
import type { DetailTable as DetailTableData, DetailColumn } from "@/lib/analyticshub/types";

/**
 * components/analyticshub/DetailTable.tsx — renders a normalized DetailTable
 * (GA4 top pages/sources, GSC top queries, recent leads). Numbers are
 * right-aligned tabular figures per the Mono Minimal table spec (§6.9).
 */
function renderCell(col: DetailColumn, value: string | number, currency: string): string {
  if (value == null || value === "") return "—";
  switch (col.type) {
    case "number":
      return typeof value === "number" ? fmtNumber(value) : String(value);
    case "currency":
      return typeof value === "number" ? fmtCurrency(value, currency) : String(value);
    case "percent":
      return typeof value === "number" ? fmtPercent(value, 2, true) : String(value);
    case "duration":
    case "link":
    case "text":
    default:
      if (col.key === "position" && typeof value === "number") return fmtPosition(value);
      return String(value);
  }
}

export function DetailTable({ table, currency = "USD" }: { table: DetailTableData; currency?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-h4 text-foreground">{table.title}</h3>
      </div>
      {table.rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-small text-muted-foreground">No data in this range.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {table.columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn("text-label uppercase text-muted-foreground", col.align === "right" && "text-right")}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row, i) => (
              <TableRow key={i}>
                {table.columns.map((col) => {
                  const right = col.align === "right" || ["number", "currency", "percent"].includes(col.type);
                  return (
                    <TableCell
                      key={col.key}
                      className={cn(
                        "py-3 text-body",
                        right ? "text-right tabular-nums text-foreground" : "text-muted-foreground",
                        col.type === "text" && col.align !== "right" && "max-w-[22rem] truncate",
                      )}
                      title={col.type === "text" ? String(row[col.key] ?? "") : undefined}
                    >
                      {renderCell(col, row[col.key] as string | number, currency)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default DetailTable;
