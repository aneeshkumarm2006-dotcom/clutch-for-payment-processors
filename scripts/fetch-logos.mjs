/**
 * Favicon -> inline base64 data URI, for processor `logo` fields.
 *
 * Every processor logo in this DB is stored as an inline `data:image/png;base64,`
 * URI (see `scripts/add-revenuecat.ts`), NOT a remote URL. `logo.clearbit.com`,
 * which `scripts/seed.ts` still points at, is dead. This script produces the data
 * URIs so an upsert script has no network dependency at write time.
 *
 *   node scripts/fetch-logos.mjs <outfile.json> <domain> [domain...]
 *
 * For each domain it parses the homepage for <link rel="icon">/apple-touch-icon,
 * picks the largest raster or SVG candidate, then resizes to 128px and PNG-
 * compresses with sharp. `.ico` is skipped (sharp cannot decode it); the Google
 * favicon mirror is the last resort so a brand that only ships an .ico still
 * gets a usable mark.
 *
 * Output: { "<domain>": { dataUri, bytes, source } }
 */

import { writeFileSync } from "node:fs";
import { setServers } from "node:dns";
import { setServers as setServersPromise } from "node:dns/promises";
import { parse } from "node-html-parser";
import sharp from "sharp";

// Same reason as `scripts/loadEnv.ts`: the local resolver on this machine refuses
// some lookups outright (`Could not resolve host: sellix.io`). Route through
// public DNS, and set BOTH resolvers because Node keeps them separately.
try {
  const servers = (process.env.DNS_SERVERS ?? "8.8.8.8,1.1.1.1").split(",").map((s) => s.trim());
  setServers(servers);
  setServersPromise(servers);
} catch {
  // Non-fatal: fall back to the system resolver.
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function get(url, as = "buffer") {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === "text" ? res.text() : Buffer.from(await res.arrayBuffer());
}

/** Rank a candidate: bigger declared size wins, apple-touch-icon beats a bare icon. */
function score(href, rel, sizes) {
  const n = Number.parseInt(String(sizes ?? "").split("x")[0], 10);
  let s = Number.isFinite(n) ? n : 0;
  if (/apple-touch-icon/.test(rel)) s += 180;
  if (/\.svg(\?|$)/i.test(href)) s += 400; // vector rasterises cleanly at any size
  if (/\.ico(\?|$)/i.test(href)) s -= 200; // decodable (see unpackIco) but usually 32px
  return s;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/**
 * Pull the largest frame out of a Windows .ico, which sharp cannot read.
 * Worth doing: several of these brands (NOWPayments) ship only an .ico, and its
 * 64px frame is a far better logo than the wordmark or the Google mirror.
 *
 * Returns a sharp-ready `{ buf, opts }`, or null when the container is not an ICO
 * or holds only frame formats we do not unpack.
 */
function unpackIco(buf) {
  if (buf.length < 22 || buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const count = buf.readUInt16LE(4);
  let best = null;
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    if (e + 16 > buf.length) break;
    // 0 in the width/height byte means 256 (the field is one byte wide).
    const w = buf[e] || 256;
    const h = buf[e + 1] || 256;
    const size = buf.readUInt32LE(e + 8);
    const offset = buf.readUInt32LE(e + 12);
    if (offset + size > buf.length) continue;
    if (!best || w * h > best.w * best.h) best = { w, h, offset, size };
  }
  if (!best) return null;
  const frame = buf.subarray(best.offset, best.offset + best.size);

  // Modern .ico files usually just embed a PNG per frame.
  if (frame.subarray(0, 4).equals(PNG_MAGIC)) return { buf: frame, opts: {} };

  // Otherwise it is a BITMAPINFOHEADER DIB. Only 32bpp BGRA is unpacked; the
  // palettised variants are rare at these sizes and not worth the code.
  if (frame.length < 40 || frame.readUInt32LE(0) !== 40) return null;
  if (frame.readUInt16LE(14) !== 32) return null;
  const w = frame.readInt32LE(4);
  const h = Math.abs(frame.readInt32LE(8)) / 2; // biHeight counts the AND mask too
  const px = frame.subarray(40, 40 + w * h * 4);
  if (px.length < w * h * 4) return null;
  // DIB rows run bottom-up and are BGRA; sharp wants top-down RGBA.
  const out = Buffer.allocUnsafe(w * h * 4);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4;
    const dst = y * w * 4;
    for (let x = 0; x < w * 4; x += 4) {
      out[dst + x] = px[src + x + 2];
      out[dst + x + 1] = px[src + x + 1];
      out[dst + x + 2] = px[src + x];
      out[dst + x + 3] = px[src + x + 3];
    }
  }
  return { buf: out, opts: { raw: { width: w, height: h, channels: 4 } } };
}

async function candidatesFor(domain) {
  // Plenty of these sites only answer on one of the two hostnames, so try both.
  const hosts = domain.startsWith("www.")
    ? [domain, domain.slice(4)]
    : [domain, `www.${domain}`];
  const out = [];
  for (const host of hosts) {
    const origin = `https://${host}`;
    try {
      const html = await get(origin, "text");
      const root = parse(html);
      for (const el of root.querySelectorAll('link[rel*="icon"]')) {
        const href = el.getAttribute("href");
        if (!href) continue;
        out.push({
          url: new URL(href, origin).href,
          score: score(href, el.getAttribute("rel") ?? "", el.getAttribute("sizes")),
        });
      }
      // Older WordPress builds ship no <link rel="icon"> at all but do set an
      // og:image / TileImage pointing at the brand mark (merchantone.com does).
      // Ranked below every real icon, above the Google mirror.
      for (const sel of ['meta[property="og:image"]', 'meta[name="msapplication-TileImage"]']) {
        const c = root.querySelector(sel)?.getAttribute("content");
        if (c) out.push({ url: new URL(c, origin).href, score: -10 });
      }
    } catch {
      // Homepage unreachable or JS-rendered. The conventional paths below still apply.
    }
    out.push({ url: `${origin}/apple-touch-icon.png`, score: 100 });
    out.push({ url: `${origin}/favicon.png`, score: 50 });
    out.push({ url: `${origin}/favicon.svg`, score: 60 });
  }
  out.sort((a, b) => b.score - a.score);
  // Google's mirror flattens whatever the site actually ships, including .ico.
  out.push({ url: `https://www.google.com/s2/favicons?sz=128&domain=${domain}`, score: -Infinity });
  return out;
}

async function toDataUri(input) {
  const ico = unpackIco(input);
  const { buf, opts } = ico ?? { buf: input, opts: {} };
  const png = await sharp(buf, { density: 384, ...opts })
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  return { dataUri: `data:image/png;base64,${png.toString("base64")}`, bytes: png.length };
}

async function logoFor(domain) {
  const seen = new Set();
  for (const c of await candidatesFor(domain)) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    try {
      const buf = await get(c.url);
      if (buf.length < 64) continue;
      const { dataUri, bytes } = await toDataUri(buf);
      // The Google mirror serves a generic globe for domains it has never seen.
      if (bytes < 200) continue;
      return { dataUri, bytes, source: c.url };
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(`no usable icon for ${domain}`);
}

const [outfile, ...domains] = process.argv.slice(2);
if (!outfile || !domains.length) {
  console.error(
    "usage: node scripts/fetch-logos.mjs <outfile.json> <domain|key=https://exact/icon.png> ...",
  );
  process.exit(1);
}

const results = {};
for (const arg of domains) {
  // `key=url` pins an exact image, for brands whose own domain will not resolve
  // (sellix.io currently has a lame delegation) or that ship no icon at all.
  const eq = arg.indexOf("=");
  const [domain, pinned] = eq > 0 ? [arg.slice(0, eq), arg.slice(eq + 1)] : [arg, null];
  try {
    if (pinned) {
      const { dataUri, bytes } = await toDataUri(await get(pinned));
      results[domain] = { dataUri, bytes, source: pinned };
    } else {
      results[domain] = await logoFor(domain);
    }
    console.log(`✓ ${domain.padEnd(26)} ${results[domain].bytes} B  <- ${results[domain].source}`);
  } catch (err) {
    console.error(`✗ ${domain.padEnd(26)} ${err.message}`);
  }
}
writeFileSync(outfile, JSON.stringify(results, null, 2));
console.log(`\nWrote ${Object.keys(results).length}/${domains.length} to ${outfile}`);
