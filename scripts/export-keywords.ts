import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Category, PageSeo, Processor, BlogPost } from "@/models";
import { FACET_PAGES } from "@/lib/facet-pages";
import { GLOSSARY_TERMS } from "@/lib/glossary";
import { POPULAR_COMPARE_PAIRS, comparePairToParam } from "@/lib/compare-pairs";

// Domain placeholder — find/replace with the live domain after pasting.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://DOMAIN";

const rows: { kw: string; page: string; url: string; assigned: string }[] = [];
function add(kw: string, page: string, path: string, assigned: string) {
  rows.push({ kw, page, url: `${SITE}${path}`, assigned });
}

async function main() {
  await connectToDatabase();

  // 1. Static pages (PageSeo) — explicitly assigned meta keywords
  const pages = await PageSeo.find({}).lean();
  for (const p of pages) {
    for (const k of p.seo?.keywords ?? []) add(k, p.title, p.path, "assigned");
  }

  // 2. Categories — assigned keywords, else derive from name
  const cats = await Category.find({}).sort({ name: 1 }).lean();
  for (const c of cats as any[]) {
    const kws = c.seo?.keywords ?? [];
    if (kws.length) for (const k of kws) add(k, `${c.name} (category)`, `/category/${c.slug}`, "assigned");
    else add(`${c.name.toLowerCase()}`, `${c.name} (category)`, `/category/${c.slug}`, "NOT SET — derive");
  }

  // 3. Processors — assigned keywords + programmatic review & alternatives pages
  const procs = await Processor.find({}).sort({ name: 1 }).lean();
  for (const pr of procs as any[]) {
    for (const k of pr.seo?.keywords ?? []) add(k, `${pr.name} (processor profile)`, `/processor/${pr.slug}`, "assigned");
    // Review/profile page target (derived from title pattern)
    if (!(pr.seo?.keywords ?? []).length)
      add(`${pr.name.toLowerCase()} review`, `${pr.name} (processor profile)`, `/processor/${pr.slug}`, "NOT SET — derive");
    // Alternatives page (auto-generated per processor)
    add(`best ${pr.name.toLowerCase()} alternatives`, `Best ${pr.name} alternatives`, `/alternatives/${pr.slug}`, "programmatic");
  }

  // 4. Facet "best-for" landing pages (static registry) — title is the target keyword
  for (const f of FACET_PAGES) add(f.title.toLowerCase(), f.title, `/payment-processors/${f.slug}`, "static page");

  // 5. Glossary terms (static registry) — each term is its target keyword
  for (const t of GLOSSARY_TERMS) add(t.term.toLowerCase(), `${t.term} (glossary)`, `/glossary/${t.slug}`, "static page");

  // 6. Compare pairs (curated head-to-heads)
  for (const pair of POPULAR_COMPARE_PAIRS)
    add(`${pair[0]} vs ${pair[1]}`, `${pair[0]} vs ${pair[1]}`, `/compare/${comparePairToParam(pair)}`, "programmatic");

  // 7. Blog posts (published) — target keyword = assigned meta keyword, else metaTitle/title
  const posts = await BlogPost.find({ status: "published" }).sort({ title: 1 }).lean();
  for (const b of posts as any[]) {
    const kws = b.seo?.keywords ?? [];
    if (kws.length) for (const k of kws) add(k, `${b.title} (blog)`, `/blog/${b.slug}`, "assigned");
    else add((b.seo?.metaTitle || b.title).toLowerCase(), `${b.title} (blog)`, `/blog/${b.slug}`, "NOT SET — derive");
  }

  // 8. Directory hub facet pages + core static content pages (informational)
  const STATIC: { kw: string; page: string; path: string }[] = [
    { kw: "payments glossary", page: "Glossary hub", path: "/glossary" },
    { kw: "payment processors directory", page: "Payment processors directory (facet hub)", path: "/payment-processors" },
    { kw: "how we rank payment processors", page: "Methodology", path: "/methodology" },
    { kw: "about payment processing guide", page: "About", path: "/about" },
    { kw: "list your payment processor", page: "For processors (get listed)", path: "/for-processors" },
  ];
  for (const s of STATIC) add(s.kw, s.page, s.path, "static page");

  // Legal / utility pages — indexable but not keyword targets (listed for completeness)
  for (const [page, path] of [["Contact", "/contact"], ["Privacy policy", "/privacy"], ["Terms", "/terms"], ["Search", "/search"]] as const)
    add("— (no keyword target)", page, path, "utility");

  // Emit TSV + write CSV
  console.log("Keyword\tTarget page\tTarget page URL\tStatus");
  for (const r of rows) console.log(`${r.kw}\t${r.page}\t${r.url}\t${r.assigned}`);
  console.log(`\n# ${rows.length} rows`);

  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = ["Keyword,Target page,Target page URL,Status", ...rows.map((r) => [r.kw, r.page, r.url, r.assigned].map(esc).join(","))].join("\n");
  const fs = await import("node:fs");
  fs.writeFileSync("keyword-page-map.csv", csv, "utf8");
  console.error("Wrote keyword-page-map.csv");
}

main()
  .catch((err) => {
    console.error("EXPORT FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
