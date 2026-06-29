import type { Model } from "mongoose";
import { slugify } from "@/lib/utils";

/**
 * Resolve a unique, URL-safe slug for a model with a `slug` field.
 *
 * Slugifies `source` (or an explicit `slug` if the editor typed one) and, if
 * that value already exists in the collection, appends `-2`, `-3`, … until it
 * finds a free one. Pass `excludeId` when editing an existing document so it
 * doesn't collide with itself.
 *
 * The DB `unique` index is the hard guarantee; this gives a friendly auto-suffix
 * so the admin API can avoid most 409s (PRD §8 "uniqueness check").
 */
export async function ensureUniqueSlug(
  ModelRef: Model<any>,
  source: string,
  opts: { explicitSlug?: string; excludeId?: string } = {},
): Promise<string> {
  const base = slugify(opts.explicitSlug || source) || "item";
  let candidate = base;
  let n = 2;

  // eslint-disable-next-line no-await-in-loop
  while (
    await ModelRef.exists({
      slug: candidate,
      ...(opts.excludeId ? { _id: { $ne: opts.excludeId } } : {}),
    })
  ) {
    candidate = `${base}-${n}`;
    n += 1;
  }

  return candidate;
}

/**
 * Mongoose pre-validate hook factory: auto-fills `slug` from a source field
 * (e.g. `name`/`title`) when it's blank. Combined with `lowercase: true` on the
 * schema path, this keeps slugs lowercase + present even on direct `Model.create`
 * calls that bypass the admin API. Full uniqueness suffixing is done by
 * `ensureUniqueSlug` at the API layer.
 */
export function autoSlugFrom(sourceField: string) {
  return function (this: Record<string, unknown>, next: (err?: Error) => void) {
    if (!this.slug && typeof this[sourceField] === "string") {
      this.slug = slugify(this[sourceField] as string);
    }
    next();
  };
}
