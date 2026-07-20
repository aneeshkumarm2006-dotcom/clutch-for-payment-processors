// Refresh Media docs' bytes/width/height/format to match the now-compressed
// Cloudinary assets. Matches Media by public_id appearing in its stored url.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dns from "node:dns";
import dnsp from "node:dns/promises";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dnsp.setServers(["8.8.8.8", "1.1.1.1"]);

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = readFileSync(path.join(root, ".env.local"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))[1].trim();
const mongoUri = get("MONGODB_URI");
const [, apiKey, apiSecret, cloudName] = get("CLOUDINARY_URL").match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
const changed = JSON.parse(readFileSync(path.join(root, "scripts", "_targets.json"), "utf8")).over;

// Fresh metadata per changed public_id.
const fresh = {};
for (const t of changed) {
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${encodeURIComponent(t.id)}`,
    { headers: { Authorization: `Basic ${auth}` } });
  if (res.ok) {
    const r = await res.json();
    fresh[t.id] = { bytes: r.bytes, width: r.width, height: r.height, format: r.format };
  }
}

await mongoose.connect(mongoUri);
const Media = mongoose.connection.collection("media");
let updated = 0;
for (const [id, meta] of Object.entries(fresh)) {
  const r = await Media.updateMany(
    { url: new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) },
    { $set: { bytes: meta.bytes, width: meta.width, height: meta.height, format: meta.format } },
  );
  console.log(`${meta.bytes ? (meta.bytes / 1024).toFixed(0).padStart(4) : "  ?"}KB  ${meta.width}x${meta.height}  ${id}  (matched ${r.matchedCount})`);
  updated += r.modifiedCount;
}
await mongoose.disconnect();
console.log(`\nUpdated ${updated} Media docs.`);
