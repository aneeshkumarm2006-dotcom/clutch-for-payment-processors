import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateSecret,
  encrypt,
  decrypt,
  scryptHash,
  scryptVerify,
  hmacSign,
  hmacVerify,
} from "../../lib/analyticshub/crypto";

// The crypto module derives keys LAZILY (at call time), so setting the env here —
// before any test callback runs — is sufficient even though imports are hoisted.
process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(32, 7).toString("base64");

test("validateSecret: missing / not-base64 / wrong-length / ok", () => {
  assert.equal(validateSecret("").reason, "missing");
  assert.equal(validateSecret("   ").reason, "missing");

  // 16 bytes → wrong length, and the message reports the decoded length.
  const short = validateSecret(Buffer.alloc(16, 1).toString("base64"));
  assert.equal(short.reason, "wrong_length");
  assert.equal(short.decodedLength, 16);
  assert.match(short.message!, /16/);

  assert.equal(validateSecret(Buffer.alloc(32, 3).toString("base64")).ok, true);
});

test("AES-256-GCM round-trip preserves plaintext (incl. unicode)", () => {
  const secret = JSON.stringify({ token: "ya29.abc", note: "café — 数据" });
  const ct = encrypt(secret);
  assert.notEqual(ct, secret);
  assert.equal(ct.split(".").length, 3);
  assert.equal(decrypt(ct), secret);
});

test("AES-256-GCM rejects tampered ciphertext (auth tag)", () => {
  const ct = encrypt("sensitive");
  const [iv, tag, body] = ct.split(".");
  // Flip a byte in the ciphertext body.
  const flipped = Buffer.from(body!, "base64");
  flipped[0] = ((flipped[0] ?? 0) ^ 0xff) & 0xff;
  const tampered = `${iv}.${tag}.${flipped.toString("base64")}`;
  assert.throws(() => decrypt(tampered));
  // Malformed shape also throws.
  assert.throws(() => decrypt("not-a-valid-payload"));
});

test("scrypt hash verifies the right password and rejects the wrong one", () => {
  const stored = scryptHash("correct horse battery staple");
  assert.ok(stored.startsWith("scrypt."));
  assert.equal(scryptVerify("correct horse battery staple", stored), true);
  assert.equal(scryptVerify("wrong password", stored), false);
  assert.equal(scryptVerify("correct horse battery staple", "garbage"), false);
});

test("HMAC sign/verify is constant-time-correct and rejects tampering", () => {
  const sig = hmacSign("payload-abc");
  assert.equal(hmacVerify("payload-abc", sig), true);
  assert.equal(hmacVerify("payload-abc", sig.slice(0, -2) + "xy"), false);
  assert.equal(hmacVerify("different-payload", sig), false);
});
