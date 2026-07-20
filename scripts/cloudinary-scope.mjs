// Read-only: find which Cloudinary images THIS project references (in MongoDB),
// intersect with the Cloudinary account, and report the compressible scope.
// Writes the target list to scratchpad for the compression step.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dns from "node:dns";
import dnsp from "node:dns/promises";
import mongoose from "mongoose";

// Local resolver (127.0.0.1) refuses Atlas SRV lookups — use public DNS.
dns.setServers(["8.8.8.8", "1.1.1.1"]);
dnsp.setServers(["8.8.8.8", "1.1.1.1"]);

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = readFileSync(path.join(root, ".env.local"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
const mongoUri = get("MONGODB_URI");
const cloudUrl = get("CLOUDINARY_URL");
const [, apiKey, apiSecret, cloudName] = cloudUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
const OUT = process.argv[2] || path.join(root, "scripts", "_targets.json");

// --- 1. Every cloudinary URL referenced anywhere in the DB ---------------
const urlRe = new RegExp(`https?://res\\.cloudinary\\.com/${cloudName}/[^"'\\s)\\\\]+`, "gi");
await mongoose.connect(mongoUri);
const collections = await mongoose.connection.db.collections();
const referenced = new Set();
const refByCollection = {};
for (const col of collections) {
  const docs = await col.find({}).toArray();
  let hits = 0;
  for (const doc of docs) {
    const matches = JSON.stringify(doc).match(urlRe);
    if (matches) for (const u of matches) { referenced.add(u); hits++; }
  }
  if (hits) refByCollection[col.collectionName] = hits;
}
await mongoose.disconnect();

// Map a delivery URL -> public_id (strip /upload/, version, transformations, ext)
function toPublicId(u) {
  const afterUpload = u.split("/image/upload/")[1];
  if (!afterUpload) return null;
  let segs = afterUpload.split("/");
  // drop leading version segment (v1699...)
  if (/^v\d+$/.test(segs[0])) segs = segs.slice(1);
  // drop a leading transformation segment (contains a comma or key_value like w_100)
  if (segs[0] && /(^|,)[a-z]{1,3}_[^/]+/.test(segs[0]) && segs.length > 1) segs = segs.slice(1);
  let id = segs.join("/");
  id = id.replace(/\.[a-z0-9]+$/i, "").split("?")[0];
  return id;
}
const referencedIds = new Map(); // public_id -> url
for (const u of referenced) {
  const id = toPublicId(u);
  if (id) referencedIds.set(id, u);
}

// --- 2. Cloudinary account inventory (all image assets) ------------------
const assets = new Map(); // public_id -> {bytes,format,width,height}
let cursor;
do {
  const params = new URLSearchParams({ type: "upload", max_results: "500" });
  if (cursor) params.set("next_cursor", cursor);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image?${params}`,
    { headers: { Authorization: `Basic ${auth}` } });
  const data = await res.json();
  for (const r of data.resources ?? []) {
    assets.set(r.public_id, { bytes: r.bytes ?? 0, format: r.format, width: r.width, height: r.height, url: r.secure_url });
  }
  cursor = data.next_cursor;
} while (cursor);

// --- 3. Intersect + classify --------------------------------------------
const TARGET = 300 * 1024;
const matched = [], missing = [], over = [];
for (const [id, url] of referencedIds) {
  const a = assets.get(id);
  if (!a) { missing.push({ id, url }); continue; }
  matched.push({ id, ...a });
  if (a.bytes > TARGET) over.push({ id, ...a });
}

console.log(`DB collections with cloudinary refs:`, refByCollection);
console.log(`Distinct referenced cloudinary URLs: ${referenced.size}`);
console.log(`Referenced public_ids matched in account: ${matched.length}`);
console.log(`Referenced but NOT found in account (transformed/deleted?): ${missing.length}`);
if (missing.length) missing.slice(0, 10).forEach((m) => console.log(`   MISS ${m.id}`));
console.log(`\n>>> Referenced AND over 300 KB (compression scope): ${over.length} assets`);
const overBytes = over.reduce((s, a) => s + a.bytes, 0);
console.log(`    total ${(overBytes / 1024 / 1024).toFixed(1)} MB`);
over.sort((a, b) => b.bytes - a.bytes).forEach((a) =>
  console.log(`   ${(a.bytes / 1024).toFixed(0).padStart(5)} KB  ${a.format.padEnd(4)} ${a.width}x${a.height}  ${a.id}`));

writeFileSync(OUT, JSON.stringify({ cloudName, over, matchedCount: matched.length }, null, 2));
console.log(`\nWrote target list -> ${OUT}`);
