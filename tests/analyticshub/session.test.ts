import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession, SESSION_TTL_MS } from "../../lib/analyticshub/session";

process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(32, 9).toString("base64");

test("session mint → verify round-trip", () => {
  const now = 1_700_000_000_000;
  const token = signSession(SESSION_TTL_MS, now);
  assert.equal(verifySession(token, now), true);
  // Still valid a day later, well within the 30-day TTL.
  assert.equal(verifySession(token, now + 24 * 60 * 60 * 1000), true);
});

test("session rejects an expired token", () => {
  const now = 1_700_000_000_000;
  const token = signSession(1000, now); // 1s TTL
  assert.equal(verifySession(token, now + 2000), false);
});

test("session rejects tampered / malformed tokens", () => {
  const now = 1_700_000_000_000;
  const token = signSession(SESSION_TTL_MS, now);
  const [payload, sig] = token.split(".");
  assert.equal(verifySession(`${payload}.${sig!.slice(0, -2)}zz`, now), false); // bad sig
  assert.equal(verifySession(payload, now), false); // no dot
  assert.equal(verifySession("", now), false);
  assert.equal(verifySession(undefined, now), false);
  // A forged payload with a far-future exp but no valid signature is rejected.
  const forged = Buffer.from(JSON.stringify({ exp: now + 1e12 })).toString("base64url");
  assert.equal(verifySession(`${forged}.${sig}`, now), false);
});
