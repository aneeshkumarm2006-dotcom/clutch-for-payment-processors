import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { authOptions } from "@/lib/auth";

/**
 * Shared Route Handler helpers (PRD §12 / TODO §2.1).
 *
 * Every admin mutation route follows the same shape:
 *
 *   export async function POST(req: Request) {
 *     try {
 *       await requireAdmin();
 *       const body = someSchema.parse(await req.json());
 *       ...
 *       return json(doc, 201);
 *     } catch (err) {
 *       return handleApiError(err);
 *     }
 *   }
 *
 * `requireAdmin` enforces the session server-side (PRD §11); `handleApiError`
 * maps the common failure modes to the status codes the PRD asks for:
 * 400 (validation) · 401 (unauthorized) · 404 (missing) · 409 (slug conflict).
 */

/** A controlled error whose `status` is sent verbatim to the client. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Throw 404 from anywhere in a handler. */
export function notFound(message = "Not found"): never {
  throw new ApiError(404, message);
}

/**
 * Require a valid admin session (PRD §11 — all `/api/*` admin mutations verify
 * the session server-side). Throws `ApiError(401)` when signed out.
 */
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new ApiError(401, "You must be signed in to do that.");
  }
  return session;
}

/**
 * Require an **admin** session — stricter than `requireAdmin()` (PRD §11 Phase 2).
 * Throws `ApiError(403)` when an authenticated `editor` reaches an admin-only
 * route (Users / Settings). Editors keep `requireAdmin()` access to
 * processors / categories / reviews / blog. `handleApiError` already passes the
 * 403 status through verbatim.
 */
export async function requireAdminRole() {
  const session = await requireAdmin();
  if (session.user.role !== "admin") {
    throw new ApiError(403, "You don't have permission to do that.");
  }
  return session;
}

/** Returns the session if signed in, otherwise null (no throw). For routes that serve both public + admin. */
export async function getAdminSession() {
  return getServerSession(authOptions);
}

/** JSON success response. */
export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Split a fully-validated object into Mongo `$set` (defined values) and
 * `$unset` (keys that came back `undefined`). Used by PUT full-replace handlers
 * so that clearing an optional field in the admin form actually removes it —
 * a sparse PATCH can't, because JSON drops `undefined` keys before they arrive.
 *
 * `preserve` opts a key out of the `undefined → $unset` rule, giving it three
 * states instead of two:
 *
 *   absent / undefined → leave the stored value alone
 *   explicit `[]`/`{}` → clear it
 *   a value            → set it
 *
 * This matters because some documents have more than one full-replace writer.
 * A BlogPost, for example, is PUT by both `/api/blog/[id]` (admin) and
 * `/api/seoteam/posts/[id]` (SEO team). A field that only one of those two forms
 * renders — `blocks`, `structuredData` — is simply absent from the other's
 * payload, and without `preserve` that absence would `$unset` it: saving the post
 * from one panel would silently delete work done in the other.
 */
export function diffSetUnset(
  data: Record<string, unknown>,
  opts: { preserve?: readonly string[] } = {},
): {
  $set: Record<string, unknown>;
  $unset: Record<string, "">;
} {
  const preserve = new Set(opts.preserve ?? []);
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      if (!preserve.has(key)) $unset[key] = "";
    } else {
      $set[key] = value;
    }
  }
  return { $set, $unset };
}

/**
 * Fields that must never be `$unset` just because a payload omitted them — they
 * are edited on panels that not every form renders. Pass to `diffSetUnset`.
 */
export const PRESERVE_ON_OMIT = ["blocks", "structuredData"] as const;

/** Build a Mongo update doc from a $set/$unset pair, omitting an empty $unset. */
export function buildUpdateDoc(parts: {
  $set: Record<string, unknown>;
  $unset: Record<string, "">;
}) {
  return Object.keys(parts.$unset).length > 0 ? { $set: parts.$set, $unset: parts.$unset } : { $set: parts.$set };
}

/** Detect a MongoDB duplicate-key error (E11000) — used to map slug clashes to 409. */
function isDuplicateKeyError(err: unknown): err is { code: number; keyValue?: Record<string, unknown> } {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Translate a thrown value into the right HTTP response.
 * - `ApiError`        → its own status + message (+ optional field errors)
 * - `ZodError`        → 400 with flattened field errors (matches the form's RHF shape)
 * - Mongo E11000      → 409 slug conflict
 * - anything else     → 500 (logged server-side, generic message to client)
 */
export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}) },
      { status: err.status },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields.", fieldErrors: err.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (isDuplicateKeyError(err)) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : undefined;
    const fieldErrors = field ? { [field]: ["Already in use — choose another."] } : undefined;
    return NextResponse.json(
      { error: "That value is already taken.", ...(fieldErrors ? { fieldErrors } : {}) },
      { status: 409 },
    );
  }

  // eslint-disable-next-line no-console
  console.error("[api] Unhandled error:", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
