import { z } from "zod";
import { seoSchema, faqsSchema } from "./common";
import { blocksSchema, structuredDataSchema } from "./blocks";
import type { PageSeoKind } from "@/models/PageSeo";

/**
 * The kinds, restated rather than imported as a value.
 *
 * `import type` is erased at compile time; a value import of `PAGE_SEO_KINDS`
 * would pull `models/PageSeo.ts` — and therefore mongoose, and every schema it
 * touches — into the CLIENT bundle, because this file reaches client components
 * through `lib/validators`. That build succeeds and then throws
 * "Cannot read properties of undefined (reading 'PageSeo')" in the browser on
 * every page that loads the bundle.
 *
 * `satisfies` keeps the two lists honest: drop a kind from the model and this
 * stops compiling.
 */
const PAGE_SEO_KINDS = ["route", "landing"] as const satisfies readonly PageSeoKind[];

/**
 * Writable PageSeo fields.
 *
 * Two kinds share this schema (see `models/PageSeo.ts`):
 *   - `route`   — SEO for a page that exists in code. `pageKey`/`path` are seeded
 *                 identity and the update route drops them, so an editor can
 *                 never repoint `/compare`'s record at another URL.
 *   - `landing` — a standalone page that IS this record. Created in the admin,
 *                 so `path` is writable here and validated as a root-level slug.
 */

/**
 * A landing page's URL. One root-level segment, lowercase, no trailing slash —
 * that shape is what `app/(public)/[landing]/page.tsx` can actually serve, and a
 * value it can't serve would save happily and then 404.
 */
export const landingPathSchema = z
  .string()
  .trim()
  .transform((v) => (v.startsWith("/") ? v : `/${v}`))
  .transform((v) => v.replace(/\/+$/, "").toLowerCase())
  .pipe(
    z
      .string()
      .regex(
        /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Use one lowercase slug segment, e.g. /ecommerce-pos-reviews-usa",
      )
      .max(120, "Keep the path under 120 characters"),
  );

/**
 * Paths a landing page may not claim, because a real route already owns them.
 * Next.js resolves a static segment before `[landing]`, so a record on one of
 * these would simply never render — a silent, confusing dead end. Reject it at
 * the point of creation instead.
 *
 * Only root-level segments need listing: `landingPathSchema` has already
 * rejected anything deeper.
 */
export const RESERVED_LANDING_PATHS: readonly string[] = [
  "/about",
  "/admin",
  "/alternatives",
  "/analyticshub",
  "/api",
  "/blog",
  "/category",
  "/compare",
  "/contact",
  "/for-processors",
  "/glossary",
  "/methodology",
  "/payment-processors",
  "/privacy",
  "/processor",
  "/processors",
  "/search",
  "/seoteam",
  "/terms",
  "/write-review",
];

export const pageSeoInput = z.object({
  pageKey: z.string().trim().min(1),
  title: z.string().trim().min(1, "Title is required"),
  path: z.string().trim().min(1),
  kind: z.enum(PAGE_SEO_KINDS).default("route"),
  heading: z.string().trim().max(200).optional(),
  subheading: z.string().trim().max(600).optional(),
  isPublished: z.boolean().default(true),
  seo: seoSchema,
  faqs: faqsSchema,
  blocks: blocksSchema,
  structuredData: structuredDataSchema,
});

export const pageSeoUpdate = pageSeoInput.partial();

/**
 * Creating a landing page. `pageKey` is derived from `path` rather than asked
 * for: two identifiers for one page is a way to end up with a record whose key
 * says one thing and whose URL says another.
 */
export const pageSeoCreate = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    path: landingPathSchema,
    heading: z.string().trim().max(200).optional(),
    subheading: z.string().trim().max(600).optional(),
    isPublished: z.boolean().default(false),
  })
  .refine((v) => !RESERVED_LANDING_PATHS.includes(v.path), {
    message: "That path is already used by a built-in page. Pick another.",
    path: ["path"],
  })
  .transform((v) => ({ ...v, kind: "landing" as const, pageKey: v.path.slice(1) }));

export type PageSeoInput = z.infer<typeof pageSeoInput>;
export type PageSeoCreate = z.infer<typeof pageSeoCreate>;
