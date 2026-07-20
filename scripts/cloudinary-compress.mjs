// Compress this project's over-300KB Cloudinary images IN PLACE.
//   - same public_id  -> stored URLs keep working (nothing on any page changes)
//   - same format     -> webp stays webp, jpg stays jpg, png stays png
//   - overwrite + invalidate + backup (restorable)
// Usage: node scripts/cloudinary-compress.mjs [--apply]   (default = dry run)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = readFileSync(path.join(root, ".env.local"), "utf8");
const cloudUrl = env.match(/^CLOUDINARY_URL=(.+)$/m)[1].trim();
const [, apiKey, apiSecret, cloudName] = cloudUrl.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
const targets = JSON.parse(readFileSync(path.join(root, "scripts", "_targets.json"), "utf8")).over;
const APPLY = process.argv.includes("--apply");

const TARGET = 300 * 1024;
const MAX_EDGE = 2560;      // cap longest edge — imperceptible at web display sizes
const MIN_EDGE = 600;       // never shrink below this while chasing the target

const QUALITIES = {
  webp: [80, 68, 56, 44, 32],
  jpg: [80, 68, 56, 44, 32],
  jpeg: [80, 68, 56, 44, 32],
  avif: [58, 48, 38, 30],
  png: [90, 80, 70, 55, 40],
};

async function encode(buf, format, quality, width) {
  let p = sharp(buf, { failOn: "none" }).rotate();
  if (width) p = p.resize({ width, withoutEnlargement: true });
  if (format === "jpg" || format === "jpeg") return p.jpeg({ quality, mozjpeg: true }).toBuffer();
  if (format === "avif") return p.avif({ quality }).toBuffer();
  if (format === "png") return p.png({ palette: true, quality, compressionLevel: 9, effort: 9 }).toBuffer();
  return p.webp({ quality }).toBuffer(); // webp + anything else
}

async function compress(buf, format) {
  const meta = await sharp(buf).metadata();
  const steps = QUALITIES[format] || [75, 60, 45, 32];
  let width = Math.min(meta.width || MAX_EDGE, MAX_EDGE);
  let smallest = null;
  for (let pass = 0; pass < 8; pass++) {
    for (const q of steps) {
      const out = await encode(buf, format, q, width);
      if (!smallest || out.length < smallest.length) smallest = out;
      if (out.length <= TARGET) return { buffer: out, width, quality: q };
    }
    const next = Math.round(width * 0.82);
    if (next < MIN_EDGE) break;
    width = next;
  }
  return { buffer: smallest, width, quality: "min" };
}

async function overwrite(publicId, buffer, format) {
  const timestamp = Math.round(Date.now() / 1000).toString();
  const signed = { backup: "true", invalidate: "true", overwrite: "true", public_id: publicId, timestamp };
  const toSign = Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join("&");
  const signature = crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: `image/${format === "jpg" ? "jpeg" : format}` }));
  form.append("api_key", apiKey);
  form.append("public_id", publicId);
  form.append("timestamp", timestamp);
  form.append("overwrite", "true");
  form.append("invalidate", "true");
  form.append("backup", "true");
  form.append("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok || !json.secure_url) throw new Error(json.error?.message || `HTTP ${res.status}`);
  return json;
}

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — ${targets.length} images\n`);
let savedTotal = 0;
for (const t of targets) {
  const res = await fetch(t.url);
  const original = Buffer.from(await res.arrayBuffer());
  const { buffer, width, quality } = await compress(original, t.format);
  const dimNote = width < t.width ? `${t.width}->${width}px wide` : `${t.width}px (kept)`;
  const line = `${(t.bytes / 1024).toFixed(0).padStart(5)}KB -> ${(buffer.length / 1024).toFixed(0).padStart(4)}KB  ${t.format.padEnd(4)} q=${String(quality).padEnd(3)} ${dimNote.padEnd(20)} ${t.id}`;
  if (buffer.length > TARGET) {
    console.log(`  !! still over target: ${line}`);
  } else {
    console.log(`  ${APPLY ? "OK" : "  "} ${line}`);
  }
  if (APPLY) {
    const out = await overwrite(t.id, buffer, t.format);
    if (out.bytes > TARGET) console.log(`     WARN cloudinary reports ${(out.bytes / 1024).toFixed(0)}KB after upload`);
  }
  savedTotal += t.bytes - buffer.length;
}
console.log(`\nTotal reduction: ${(savedTotal / 1024 / 1024).toFixed(1)} MB${APPLY ? " (applied)" : " (dry run — re-run with --apply)"}`);
