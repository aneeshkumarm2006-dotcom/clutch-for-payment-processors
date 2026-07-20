// Read-only inventory of all Cloudinary image assets.
// Usage: node scripts/cloudinary-inventory.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = readFileSync(path.join(root, ".env.local"), "utf8");
const url = env.match(/CLOUDINARY_URL=(.+)/)?.[1]?.trim();
const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
const [, apiKey, apiSecret, cloudName] = m;
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

const TARGET = 300 * 1024;
const assets = [];
let cursor;
do {
  const params = new URLSearchParams({ type: "upload", max_results: "500" });
  if (cursor) params.set("next_cursor", cursor);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?${params}`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) {
    console.error("Admin API error", res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  for (const r of data.resources ?? []) {
    assets.push({
      public_id: r.public_id,
      format: r.format,
      bytes: r.bytes ?? 0,
      width: r.width,
      height: r.height,
      folder: r.public_id.includes("/") ? r.public_id.split("/").slice(0, -1).join("/") : "(root)",
    });
  }
  cursor = data.next_cursor;
} while (cursor);

const byFormat = {};
const byFolder = {};
let over = 0, overBytes = 0, totalBytes = 0;
for (const a of assets) {
  totalBytes += a.bytes;
  byFormat[a.format] = (byFormat[a.format] || 0) + 1;
  byFolder[a.folder] = (byFolder[a.folder] || 0) + 1;
  if (a.bytes > TARGET) { over++; overBytes += a.bytes; }
}

console.log(`Total assets: ${assets.length}`);
console.log(`Total size:   ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`Over 300 KB:  ${over} assets (${(overBytes / 1024 / 1024).toFixed(1)} MB)`);
console.log(`\nBy format:`, byFormat);
console.log(`By folder:`, byFolder);
console.log(`\nLargest 20 over-limit assets:`);
assets.filter((a) => a.bytes > TARGET)
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 20)
  .forEach((a) => console.log(`  ${(a.bytes / 1024).toFixed(0).padStart(5)} KB  ${a.format.padEnd(5)} ${a.width}x${a.height}  ${a.public_id}`));
