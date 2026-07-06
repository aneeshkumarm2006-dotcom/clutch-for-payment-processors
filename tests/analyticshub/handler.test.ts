import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../../lib/analyticshub/handlers/dispatch";
import { makeMemoryStore } from "../../lib/analyticshub/config-store";

// Valid secret so session signing + status secret-check pass. No MONGODB_URI is
// set, so any DB-touching path (leads fetch, project auto-detect) degrades
// gracefully — exactly the "empty state" this test asserts.
process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(32, 5).toString("base64");

const BASE = "https://hub.test/api/analyticshub/";

interface ReqOpts {
  body?: unknown;
  cookie?: string;
}
function makeReq(method: string, path: string, opts: ReqOpts = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers["cookie"] = opts.cookie;
  return new Request(BASE + path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}
function sessionCookie(res: Response): string {
  const sc = res.headers.get("set-cookie") ?? "";
  const m = /analyticshub_session=([^;]+)/.exec(sc);
  return m ? `analyticshub_session=${m[1]}` : "";
}

test("first-run flow: setup → authed status → login lockout → /all empty", async () => {
  const store = makeMemoryStore();

  // 1) Status before setup — not set up, not authed, but the API is healthy.
  const pre = await handle(makeReq("GET", "status"), store);
  assert.equal(pre.status, 200);
  const preJson = (await pre.json()) as { setupComplete: boolean; authed: boolean; secret: { ok: boolean } };
  assert.equal(preJson.setupComplete, false);
  assert.equal(preJson.authed, false);
  assert.equal(preJson.secret.ok, true);

  // 2) First-run setup mints a session cookie.
  const setup = await handle(makeReq("POST", "setup", { body: { password: "supersecret1", confirm: "supersecret1" } }), store);
  assert.equal(setup.status, 200);
  const cookie = sessionCookie(setup);
  assert.match(cookie, /analyticshub_session=/);

  // 3) Authed status reflects the session + completed setup.
  const authed = await handle(makeReq("GET", "status", { cookie }), store);
  const authedJson = (await authed.json()) as { setupComplete: boolean; authed: boolean };
  assert.equal(authedJson.setupComplete, true);
  assert.equal(authedJson.authed, true);

  // 4) Setup is first-claim — a second attempt is refused.
  const dup = await handle(makeReq("POST", "setup", { body: { password: "anotherpass1", confirm: "anotherpass1" } }), store);
  assert.equal(dup.status, 409);

  // 5) A correct login works, then 8 failures trip the durable lockout (429).
  const good = await handle(makeReq("POST", "login", { body: { password: "supersecret1" } }), store);
  assert.equal(good.status, 200);

  for (let i = 0; i < 8; i += 1) {
    const bad = await handle(makeReq("POST", "login", { body: { password: "nope" } }), store);
    assert.equal(bad.status, 401, `attempt ${i + 1} should be 401`);
  }
  const locked = await handle(makeReq("POST", "login", { body: { password: "nope" } }), store);
  assert.equal(locked.status, 429);
  assert.ok(locked.headers.get("retry-after"));

  // 6) /data/all returns the normalized empty state — every source present,
  //    external sources not_connected, no cross-source contamination.
  const all = await handle(makeReq("GET", "data/all", { cookie }), store);
  assert.equal(all.status, 200);
  const allJson = (await all.json()) as { data: Record<string, { status: string; series: unknown[] }> };
  for (const s of ["ga4", "gsc", "meta", "gads", "leads"]) {
    assert.ok(allJson.data[s], `data.${s} present`);
    assert.ok(Array.isArray(allJson.data[s]!.series));
  }
  assert.equal(allJson.data.ga4!.status, "not_connected");
  assert.equal(allJson.data.gsc!.status, "not_connected");
  assert.equal(allJson.data.meta!.status, "not_connected");
  assert.equal(allJson.data.gads!.status, "not_connected");
  assert.equal(allJson.data.ga4!.series.length, 0);

  // 7) Unauthenticated data access is refused.
  const unauth = await handle(makeReq("GET", "data/all"), store);
  assert.equal(unauth.status, 401);
});
