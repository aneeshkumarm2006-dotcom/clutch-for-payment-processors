import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { connectForScript } from "./db";
import { Media } from "@/models";
import { uploadImage } from "@/lib/upload";

/**
 * Throwaway batch uploader for NEW listing logos (the listings do not exist in
 * the DB yet, so `migrate-logos-to-cdn.ts` cannot see them). Reads a
 * `fetch-logos.mjs` output file, uploads each data URI through the app's own
 * `uploadImage()` (WebP + compression, folder "logos"), registers a Media doc so
 * the asset is not an orphan in the gallery, and prints the CDN URL to paste
 * into `scripts/data/processors/<slug>.json`.
 *
 *   npx tsx scripts/upload-new-logos.ts <fetch-logos-output.json>
 */

const BATCH: Record<string, { slug: string; name: string }> = {
  "checkout.com": { slug: "checkout-com", name: "Checkout.com" },
  "worldpay.com": { slug: "worldpay", name: "Worldpay" },
  "gocardless.com": { slug: "gocardless", name: "GoCardless" },
  "paddle.com": { slug: "paddle", name: "Paddle" },
  "chargebee.com": { slug: "chargebee", name: "Chargebee" },
  "sumup.com": { slug: "sumup", name: "SumUp" },
  "airwallex.com": { slug: "airwallex", name: "Airwallex" },
  "bluesnap.com": { slug: "bluesnap", name: "BlueSnap" },
  "paystack.com": { slug: "paystack", name: "Paystack" },
  "bitpay.com": { slug: "bitpay", name: "BitPay" },
};

function parseDataUri(uri: string): { contentType: string; buffer: Buffer } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  const [, contentType, isBase64, payload] = m;
  if (!contentType || payload === undefined) return null;
  const buffer = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return { contentType, buffer };
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npx tsx scripts/upload-new-logos.ts <fetch-logos-output.json>");
  const logos = JSON.parse(readFileSync(file, "utf8")) as Record<string, { dataUri: string }>;

  await connectForScript();

  const results: Record<string, string> = {};
  for (const [domain, meta] of Object.entries(BATCH)) {
    const entry = logos[domain];
    if (!entry) {
      console.error(`✗ ${domain}: missing from ${file}`);
      process.exitCode = 1;
      continue;
    }
    const parsed = parseDataUri(entry.dataUri);
    if (!parsed) {
      console.error(`✗ ${domain}: unparseable data URI`);
      process.exitCode = 1;
      continue;
    }
    const result = await uploadImage(parsed.buffer, {
      filename: `${meta.slug}-logo`,
      contentType: parsed.contentType,
      folder: "logos",
    });
    await Media.updateOne(
      { url: result.url },
      {
        $set: {
          url: result.url,
          pathname: result.pathname,
          provider: result.provider ?? "cloudinary",
          folder: "logos",
          filename: `${meta.slug}-logo`,
          contentType: result.format ? `image/${result.format}` : parsed.contentType,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format,
          alt: `${meta.name} logo`,
          title: `${meta.name} logo`,
          source: "upload",
        },
        $addToSet: { tags: "processor-logo" },
      },
      { upsert: true },
    );
    results[meta.slug] = result.url;
    console.log(`✓ ${meta.slug.padEnd(14)} ${result.url}`);
  }

  console.log("\n" + JSON.stringify(results, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
