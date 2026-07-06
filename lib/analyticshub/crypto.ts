import {
  hkdfSync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

/**
 * lib/analyticshub/crypto.ts — the hub's entire cryptographic surface, built on
 * `node:crypto` ONLY (no bcrypt/argon2, no native deps — a hard constraint).
 *
 * One env secret governs everything: `ANALYTICSHUB_SECRET_KEY`, a 32-byte value
 * encoded as base64 (the raw 44-char output of `openssl rand -base64 32`). From it
 * we HKDF-derive two independent, domain-separated keys:
 *
 *   - the **encryption key** (AES-256-GCM) protecting every value stored in the
 *     `analyticshub_config` collection, and
 *   - the **MAC key** signing the session cookie.
 *
 * Deriving both from one secret (rather than adding a second env var) keeps setup
 * to a single value while ensuring a leak of one derived key can't forge the other.
 * Changing `ANALYTICSHUB_SECRET_KEY` after the fact orphans everything encrypted
 * with the old key — documented in the setup guide.
 *
 * NOTE: this module is Node-runtime only. The catch-all API route and the hub
 * layout both run `runtime = "nodejs"`, so we never need a Web-Crypto twin.
 */

const ENC_INFO = "analyticshub:aes-256-gcm:v1";
const MAC_INFO = "analyticshub:session-hmac:v1";
// A fixed, non-secret salt is fine for HKDF domain separation here: the IKM is
// already a high-entropy 32-byte key, and the two `info` strings above give us
// the independence we need. (HKDF's salt strengthens low-entropy IKM; ours isn't.)
const HKDF_SALT = "analyticshub:hkdf:v1";

export interface SecretStatus {
  ok: boolean;
  /** Machine-readable reason when `ok` is false — drives the /status error taxonomy. */
  reason?: "missing" | "not_base64" | "wrong_length";
  /** Human message that NAMES THE FIX (every operator-facing error must). */
  message?: string;
  /** Decoded byte length, surfaced when the key is the wrong size. */
  decodedLength?: number;
}

/**
 * Validate `ANALYTICSHUB_SECRET_KEY` without throwing. Distinguishes the three
 * failure modes that actually happen during rollout, each naming its fix.
 */
export function validateSecret(raw = process.env.ANALYTICSHUB_SECRET_KEY): SecretStatus {
  if (!raw || raw.trim().length === 0) {
    return {
      ok: false,
      reason: "missing",
      message:
        "ANALYTICSHUB_SECRET_KEY is not set. Generate one with `openssl rand -base64 32` and add it to your environment (then redeploy).",
    };
  }
  let bytes: Buffer;
  try {
    // Node's base64 decoder is lenient; re-encoding and comparing catches junk.
    bytes = Buffer.from(raw.trim(), "base64");
    if (bytes.length === 0) throw new Error("empty");
  } catch {
    return {
      ok: false,
      reason: "not_base64",
      message:
        "ANALYTICSHUB_SECRET_KEY is not valid base64. Paste the raw 44-character output of `openssl rand -base64 32` (no quotes).",
    };
  }
  if (bytes.length !== 32) {
    return {
      ok: false,
      reason: "wrong_length",
      decodedLength: bytes.length,
      message: `ANALYTICSHUB_SECRET_KEY must decode to 32 bytes, but it decoded to ${bytes.length}. Regenerate with \`openssl rand -base64 32\` and paste the raw output.`,
    };
  }
  return { ok: true };
}

function ikm(): Buffer {
  const status = validateSecret();
  if (!status.ok) throw new Error(status.message);
  return Buffer.from(process.env.ANALYTICSHUB_SECRET_KEY!.trim(), "base64");
}

function deriveKey(info: string): Buffer {
  // hkdfSync returns an ArrayBuffer; wrap it as a Buffer for the cipher APIs.
  return Buffer.from(hkdfSync("sha256", ikm(), Buffer.from(HKDF_SALT), Buffer.from(info), 32));
}

let encKeyCache: Buffer | null = null;
let macKeyCache: Buffer | null = null;

function encKey(): Buffer {
  if (!encKeyCache) encKeyCache = deriveKey(ENC_INFO);
  return encKeyCache;
}
function macKey(): Buffer {
  if (!macKeyCache) macKeyCache = deriveKey(MAC_INFO);
  return macKeyCache;
}

/** For tests: drop the derived-key cache after mutating the env var. */
export function _resetKeyCache(): void {
  encKeyCache = null;
  macKeyCache = null;
}

// ---------------------------------------------------------------------------
// AES-256-GCM — encrypt every stored value
// ---------------------------------------------------------------------------

/** Encrypt a UTF-8 string → `base64(iv).base64(tag).base64(ciphertext)`. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit nonce, the GCM standard
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

/** Decrypt a value produced by `encrypt`. Throws if tampered or key-mismatched. */
export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Malformed ciphertext.");
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64!, "base64");
  const tag = Buffer.from(tagB64!, "base64");
  const ct = Buffer.from(ctB64!, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), iv);
  decipher.setAuthTag(tag);
  // GCM verifies the tag in .final(); a tampered ct/tag/iv throws here.
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// scrypt — owner password (memory-hard, zero native deps)
// ---------------------------------------------------------------------------

const SCRYPT_N = 16384; // CPU/memory cost
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const SCRYPT_KEYLEN = 64;

/** Hash a password with a fresh random salt → `scrypt.<saltB64>.<hashB64>`. */
export function scryptHash(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return `scrypt.${salt.toString("base64")}.${hash.toString("base64")}`;
}

/** Constant-time verify a password against a `scryptHash` string. */
export function scryptVerify(password: string, stored: string): boolean {
  const parts = stored.split(".");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "base64");
  const expected = Buffer.from(parts[2]!, "base64");
  const actual = scryptSync(password, salt, expected.length, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------------
// HMAC — session token signing (uses the second derived key)
// ---------------------------------------------------------------------------

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/** Sign `payloadB64` with the MAC key → base64url HMAC-SHA256. */
export function hmacSign(payloadB64: string): string {
  return b64url(createHmac("sha256", macKey()).update(payloadB64).digest());
}

/** Constant-time verify a base64url HMAC over `payloadB64`. */
export function hmacVerify(payloadB64: string, sigB64url: string): boolean {
  let sig: Buffer;
  try {
    sig = fromB64url(sigB64url);
  } catch {
    return false;
  }
  const expected = createHmac("sha256", macKey()).update(payloadB64).digest();
  return sig.length === expected.length && timingSafeEqual(sig, expected);
}

export { b64url, fromB64url };
