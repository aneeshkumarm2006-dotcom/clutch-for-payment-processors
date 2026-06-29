import Link from "next/link";
import {
  ArrowUpRight,
  CreditCard,
  FolderTree,
  Inbox,
  Newspaper,
  Settings as SettingsIcon,
  Star,
} from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Lead, Processor, Review, Submission } from "@/models";
import { formatDate, formatRating } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Admin dashboard (PRD §10.2) — live stat cards, recent activity, quick actions.
 */
export const dynamic = "force-dynamic";

interface PendingReview {
  id: string;
  reviewerName: string;
  title: string;
  overallRating: number;
  processorName: string;
  createdAt: string;
}

interface RecentLead {
  id: string;
  name: string;
  email: string;
  processorName?: string;
  createdAt: string;
}

export default async function AdminDashboardPage() {
  await connectToDatabase();

  const [
    processorsPublished,
    processorsDraft,
    approvedReviews,
    pendingReviews,
    newLeads,
    newSubmissions,
    pendingReviewDocs,
    recentLeadDocs,
  ] = await Promise.all([
    Processor.countDocuments({ isPublished: true }),
    Processor.countDocuments({ isPublished: false }),
    Review.countDocuments({ status: "approved" }),
    Review.countDocuments({ status: "pending" }),
    Lead.countDocuments({ status: "new" }),
    Submission.countDocuments({ status: "new" }),
    Review.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("processor", "name")
      .lean(),
    Lead.find().sort({ createdAt: -1 }).limit(5).populate("processor", "name").lean(),
  ]);

  const pendingList: PendingReview[] = pendingReviewDocs.map((r) => ({
    id: String(r._id),
    reviewerName: r.reviewerName,
    title: r.title,
    overallRating: r.overallRating,
    processorName:
      (r.processor as unknown as { name?: string } | null)?.name ?? "Unknown processor",
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  const leadList: RecentLead[] = recentLeadDocs.map((l) => ({
    id: String(l._id),
    name: l.name,
    email: l.email,
    processorName: (l.processor as unknown as { name?: string } | null)?.name,
    createdAt: new Date(l.createdAt).toISOString(),
  }));

  const stats = [
    {
      label: "Processors",
      value: processorsPublished,
      hint: `${processorsDraft} draft${processorsDraft === 1 ? "" : "s"}`,
      href: "/admin/processors",
    },
    { label: "Approved reviews", value: approvedReviews, hint: "live on profiles" },
    {
      label: "Pending reviews",
      value: pendingReviews,
      hint: "awaiting moderation",
      emphasize: pendingReviews > 0,
    },
    { label: "New leads", value: newLeads, hint: "uncontacted" },
    { label: "New submissions", value: newSubmissions, hint: "get-listed requests" },
  ];

  const quickActions = [
    { label: "Add processor", href: "/admin/processors/new", icon: CreditCard },
    { label: "Add category", href: "/admin/categories/new", icon: FolderTree },
    { label: "New post", href: "/admin/blog/new", icon: Newspaper },
    { label: "Site settings", href: "/admin/settings", icon: SettingsIcon },
  ];

  return (
    <div className="mx-auto max-w-content space-y-8">
      <div>
        <h1 className="text-h1 tracking-tighter2">Dashboard</h1>
        <p className="mt-1 text-body text-muted-foreground">
          An overview of your content, reviews, and inbound interest.
        </p>
      </div>

      {/* Stat cards */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => {
          const inner = (
            <Card className={stat.href ? "transition-colors hover:border-border-strong" : undefined}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-label uppercase text-muted-foreground">
                  {stat.label}
                  {stat.href && <ArrowUpRight className="size-4 text-ink-400" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-h1 tabular-nums text-foreground">{stat.value}</div>
                <p className="mt-1 flex items-center gap-1.5 text-small text-muted-foreground">
                  {stat.emphasize && <Badge variant="warning">Action</Badge>}
                  {stat.hint}
                </p>
              </CardContent>
            </Card>
          );
          return stat.href ? (
            <Link key={stat.label} href={stat.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={stat.label}>{inner}</div>
          );
        })}
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions" className="space-y-3">
        <h2 className="text-h3 tracking-tighter2">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button key={action.href} asChild variant="secondary">
                <Link href={action.href}>
                  <Icon className="size-4" />
                  {action.label}
                </Link>
              </Button>
            );
          })}
        </div>
      </section>

      {/* Recent activity */}
      <section aria-label="Recent activity" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-h3">
              <Star className="size-4 text-muted-foreground" />
              Reviews to moderate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingList.length === 0 ? (
              <p className="text-small text-muted-foreground">
                No pending reviews. New submissions will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-ink-150 dark:divide-ink-800">
                {pendingList.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-small font-medium text-foreground">{r.title}</p>
                      <p className="truncate text-micro text-muted-foreground">
                        {r.reviewerName} · {r.processorName}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-small tabular-nums">
                      <Star className="size-3.5 fill-star text-star" aria-hidden />
                      {formatRating(r.overallRating)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-h3">
              <Inbox className="size-4 text-muted-foreground" />
              Recent leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leadList.length === 0 ? (
              <p className="text-small text-muted-foreground">
                No leads yet. Quote requests will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-ink-150 dark:divide-ink-800">
                {leadList.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-small font-medium text-foreground">{l.name}</p>
                      <p className="truncate text-micro text-muted-foreground">
                        {l.email}
                        {l.processorName ? ` · ${l.processorName}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-micro text-muted-foreground">
                      {formatDate(l.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
