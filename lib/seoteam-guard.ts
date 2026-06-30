import "server-only";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/api";
import { SEO_COOKIE, verifySession } from "@/lib/seoteam-auth";

/**
 * Server-side defense-in-depth for /seoteam (PRD §11 analogue of `requireAdmin`).
 * The Edge middleware already gates the routes; these helpers re-check the signed
 * cookie inside server components and route handlers. Kept in a SEPARATE file from
 * `seoteam-auth.ts` so `next/headers` never enters the Edge middleware bundle.
 */

/** True when the request carries a valid, unexpired /seoteam session cookie. */
export async function isSeoTeamAuthed(): Promise<boolean> {
  return verifySession(cookies().get(SEO_COOKIE)?.value);
}

/** Throw `ApiError(401)` when the /seoteam session cookie is missing or invalid. */
export async function requireSeoTeam(): Promise<void> {
  if (!(await isSeoTeamAuthed())) {
    throw new ApiError(401, "Sign in to the SEO dashboard.");
  }
}
