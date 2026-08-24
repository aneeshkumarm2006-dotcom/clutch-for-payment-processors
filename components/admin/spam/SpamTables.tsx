"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import type { SpamRowData } from "@/lib/spam/admin";
import { formatDate } from "@/lib/utils";
import { apiClient, ApiClientError } from "@/components/admin/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The Spam and Blocked views.
 *
 * Every flagged row shows its category, its score, and the plain-English
 * reasons that produced the verdict. That is not decoration: an operator who
 * cannot see WHY something was flagged cannot tell a good call from a bad one,
 * and a filter nobody can audit is a filter nobody trusts.
 *
 *   Spam    — held back from the inbox and never emailed, but fully stored.
 *             "Not spam" returns it to the inbox and wipes the reasoning.
 *   Blocked — the 30-day bin behind every hard rejection. "Restore" replays the
 *             payload into its real collection through the normal validator.
 */

const FORM_LABEL: Record<string, string> = {
  lead: "Lead",
  submission: "Get listed",
  review: "Review",
};

/** Category → pill tone. Anything unmapped falls back to neutral. */
const CATEGORY_TONE: Record<string, "destructive" | "warning" | "neutral"> = {
  honeypot: "destructive",
  "impossible-field": "destructive",
  "bulk-mail": "destructive",
  "seo-outreach": "destructive",
  "agency-pitch": "warning",
  "link-spam": "warning",
  "retail-promo": "warning",
  "off-platform-contact": "warning",
  "mailing-list": "warning",
  gibberish: "warning",
  duplicate: "warning",
  automation: "neutral",
};

type TabKey = "quarantine" | "blocked";

export function SpamTables({
  quarantined,
  blocked,
}: {
  quarantined: SpamRowData[];
  blocked: SpamRowData[];
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("quarantine");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = React.useState<TabKey | null>(null);

  const rows = tab === "quarantine" ? quarantined : blocked;

  const act = async (id: string, run: () => Promise<unknown>, done: string) => {
    setBusyId(id);
    try {
      await run();
      toast.success(done);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "That didn't work.");
    } finally {
      setBusyId(null);
    }
  };

  const purge = async () => {
    if (!purgeTarget) return;
    setBusyId("purge");
    try {
      const res = (await apiClient.post("/api/spam/purge", { scope: purgeTarget })) as {
        deleted?: number;
      };
      toast.success(`Purged ${res.deleted ?? 0} row(s).`);
      setPurgeTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not purge.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="quarantine">Spam ({quarantined.length})</TabsTrigger>
            <TabsTrigger value="blocked">Blocked ({blocked.length})</TabsTrigger>
          </TabsList>
        </Tabs>

        {rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPurgeTarget(tab)}
            disabled={busyId !== null}
          >
            <Trash2 className="size-4" />
            Purge this view
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-body text-muted-foreground">
          {tab === "quarantine"
            ? "Nothing is being held back. Submissions the filter is unsure about appear here."
            : "The bin is empty. Hard-rejected submissions land here and clear themselves after 30 days."}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{FORM_LABEL[row.form] ?? row.form}</Badge>
                    <Badge variant={CATEGORY_TONE[row.category] ?? "neutral"}>{row.category}</Badge>
                    <span className="text-micro text-muted-foreground">score {row.score}</span>
                    <span className="text-micro text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-small font-medium text-foreground">
                    {row.who}
                    {row.email && (
                      <span className="ml-2 font-normal text-muted-foreground">{row.email}</span>
                    )}
                  </p>
                  <p className="mt-1 max-w-prose whitespace-pre-wrap text-small text-muted-foreground">
                    {row.preview}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  {tab === "quarantine" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId !== null}
                      onClick={() =>
                        act(
                          row.id,
                          () => apiClient.post("/api/spam/clear", { form: row.form, id: row.id }),
                          "Moved back to the inbox.",
                        )
                      }
                    >
                      {busyId === row.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="size-4" />
                      )}
                      Not spam
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() =>
                          act(
                            row.id,
                            () => apiClient.post(`/api/spam/blocked/${row.id}/restore`, {}),
                            "Restored to the inbox.",
                          )
                        }
                      >
                        {busyId === row.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() =>
                          act(
                            row.id,
                            () => apiClient.delete(`/api/spam/blocked/${row.id}`),
                            "Deleted.",
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {row.reasons.length > 0 && (
                <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
                  <p className="text-micro font-medium uppercase tracking-wide text-muted-foreground">
                    Why it was flagged
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {row.reasons.map((reason, i) => (
                      <li key={i} className="text-small text-muted-foreground">
                        · {reason}
                      </li>
                    ))}
                  </ul>
                  {(row.ip || row.network) && (
                    <p className="mt-2 text-micro text-muted-foreground">
                      {row.ip}
                      {row.network ? ` · ${row.network}` : ""}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={purgeTarget !== null} onOpenChange={(o) => !o && setPurgeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Purge {purgeTarget === "blocked" ? "the blocked bin" : "everything in Spam"}?
            </DialogTitle>
            <DialogDescription>
              {purgeTarget === "blocked"
                ? "Deletes every row in the bin now. It would otherwise clear itself after 30 days."
                : "Permanently deletes every held-back submission. Anything you already marked “Not spam” is back in the inbox and is left alone."}{" "}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={purge} disabled={busyId === "purge"}>
              {busyId === "purge" && <Loader2 className="size-4 animate-spin" />}
              Purge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SpamTables;
