import { handle } from "@/lib/analyticshub/handlers/dispatch";
import { mongoStore, getStubStore, type ConfigStore } from "@/lib/analyticshub/config-store";

// In production this is always the Mongo-backed store; ANALYTICSHUB_STUB swaps in
// an in-memory store for local visual verification (never set in prod).
function store(): ConfigStore {
  return process.env.ANALYTICSHUB_STUB === "1" ? getStubStore() : mongoStore;
}

/**
 * The ENTIRE /analyticshub API in one catch-all serverless function (a hard
 * constraint — Vercel Hobby caps at 12 functions). The dispatcher parses the
 * sub-path from `req.url` (not the `[...path]` param) and enforces auth. Node
 * runtime because everything uses `node:crypto`; force-dynamic + no caching
 * because responses are per-owner and per-range.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request): Promise<Response> {
  return handle(req, store());
}

export function POST(req: Request): Promise<Response> {
  return handle(req, store());
}
