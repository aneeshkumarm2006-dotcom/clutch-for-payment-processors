import { loadEnv } from "./loadEnv";
loadEnv();

import mongoose from "mongoose";
import { connectForScript } from "./db";
import { BlogPost, Media, Processor } from "@/models";
import { uploadImage } from "@/lib/upload";

/**
 * Move every inline `data:` image URI in the database onto the CDN.
 *
 * Covers `processors.logo` (45 of them) and `blogposts.coverImage`.
 *
 *   npx tsx scripts/migrate-logos-to-cdn.ts --dry-run   # report only
 *   npx tsx scripts/migrate-logos-to-cdn.ts             # upload + rewrite
 *   npx tsx scripts/migrate-logos-to-cdn.ts --only=stripe,square
 *
 * WHY (all three are Semrush audit failures, one root cause):
 *
 *  1. Structured data. `processorJsonLd` passes `logo` through `absoluteUrl()`,
 *     which resolves a relative path against the site origin — and a `data:` URI
 *     does not look like `https?://`, so it is treated as a path and becomes
 *     `https://www.paymentprocessingguide.com/data:image/jpeg;base64,…`. That is
 *     not a fetchable image, so `Product.image` is invalid on every profile.
 *  2. Page weight. The 45 logos are 1–14 KB of base64 EACH, inlined once in the
 *     HTML and AGAIN in the RSC flight payload. `/processors` renders all of them:
 *     624 KB of HTML. Semrush flags 76 of 78 pages "low text to HTML ratio".
 *  3. Caching. A data URI is re-downloaded with every page. A CDN URL is fetched
 *     once and cached across the whole site.
 *
 * The upload path is the app's own `uploadImage()`, so logos land in Cloudinary
 * converted to WebP and compressed exactly like an admin upload would be, and
 * each one is registered in the Media library so the gallery knows about it.
 *
 * Idempotent: a processor whose logo is already an `http(s)` URL is skipped, so
 * re-running after a partial failure only does the remaining work.
 */

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = process.argv
  .find((a) => a.startsWith("--only="))
  ?.slice("--only=".length)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Split `data:image/png;base64,AAAA` into its MIME type and raw bytes. */
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

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

async function main() {
  await connectForScript();

  const query: Record<string, unknown> = { logo: { $regex: "^data:" } };
  if (ONLY?.length) query.slug = { $in: ONLY };

  const processors = await Processor.find(query)
    .select("slug name logo isPublished")
    .lean<{ _id: mongoose.Types.ObjectId; slug: string; name: string; logo: string; isPublished: boolean }[]>();

  if (!processors.length) {
    console.log("No processor logo is stored as a data: URI.");
  }

  const beforeBytes = processors.reduce((sum, p) => sum + p.logo.length, 0);
  console.log(
    `${processors.length} processor logo(s) stored inline, ${kb(beforeBytes)} of base64 total.\n` +
      (DRY_RUN ? "DRY RUN: nothing will be written.\n" : ""),
  );

  let migrated = 0;
  let afterBytes = 0;
  const failures: { slug: string; error: string }[] = [];

  for (const p of processors) {
    const parsed = parseDataUri(p.logo);
    if (!parsed) {
      failures.push({ slug: p.slug, error: "logo is not a parseable data: URI" });
      continue;
    }

    const label = `${p.slug.padEnd(28)} ${kb(p.logo.length).padStart(9)} base64`;

    if (DRY_RUN) {
      console.log(`${label}  ->  would upload ${kb(parsed.buffer.length)} of ${parsed.contentType}`);
      continue;
    }

    try {
      const result = await uploadImage(parsed.buffer, {
        filename: `${p.slug}-logo`,
        contentType: parsed.contentType,
        folder: "logos",
      });

      await Processor.updateOne({ _id: p._id }, { $set: { logo: result.url } });

      // Register in the Media library so the asset is manageable from /seoteam
      // rather than being an orphan nobody can find or replace.
      await Media.updateOne(
        { url: result.url },
        {
          $set: {
            url: result.url,
            pathname: result.pathname,
            provider: result.provider ?? "cloudinary",
            folder: "logos",
            filename: `${p.slug}-logo`,
            contentType: result.format ? `image/${result.format}` : parsed.contentType,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            format: result.format,
            alt: `${p.name} logo`,
            title: `${p.name} logo`,
            source: "upload",
          },
          $addToSet: { tags: "processor-logo" },
        },
        { upsert: true },
      );

      afterBytes += result.url.length;
      migrated += 1;
      console.log(`${label}  ->  ${result.url}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ slug: p.slug, error: message });
      console.error(`${label}  ->  FAILED: ${message}`);
    }
  }

  if (!DRY_RUN) {
    console.log(
      `\nMigrated ${migrated}/${processors.length}. ` +
        `Inline payload ${kb(beforeBytes)} -> ${kb(afterBytes)} of URLs ` +
        `(${kb(beforeBytes - afterBytes)} removed from every page that renders these logos).`,
    );
  }

  // --- Blog cover images ----------------------------------------------------
  // Same defect, different collection: a data: URI here is an unfetchable
  // `og:image` and an unfetchable `BlogPosting.image`, on top of the page weight.
  if (!ONLY?.length) {
    const posts = await BlogPost.find({ coverImage: { $regex: "^data:" } })
      .select("slug title coverImage")
      .lean<{ _id: mongoose.Types.ObjectId; slug: string; title: string; coverImage: string }[]>();

    for (const post of posts) {
      const parsed = parseDataUri(post.coverImage);
      if (!parsed) {
        failures.push({ slug: post.slug, error: "coverImage is not a parseable data: URI" });
        continue;
      }
      const label = `blog/${post.slug.slice(0, 36).padEnd(36)} ${kb(post.coverImage.length).padStart(9)} base64`;
      if (DRY_RUN) {
        console.log(`${label}  ->  would upload ${kb(parsed.buffer.length)} of ${parsed.contentType}`);
        continue;
      }
      try {
        const result = await uploadImage(parsed.buffer, {
          filename: `${post.slug}-cover`,
          contentType: parsed.contentType,
          folder: "blog",
        });
        await BlogPost.updateOne({ _id: post._id }, { $set: { coverImage: result.url } });
        await Media.updateOne(
          { url: result.url },
          {
            $set: {
              url: result.url,
              pathname: result.pathname,
              provider: result.provider ?? "cloudinary",
              folder: "blog",
              filename: `${post.slug}-cover`,
              contentType: result.format ? `image/${result.format}` : parsed.contentType,
              bytes: result.bytes,
              width: result.width,
              height: result.height,
              format: result.format,
              alt: post.title,
              source: "upload",
            },
            $addToSet: { tags: "blog-cover" },
          },
          { upsert: true },
        );
        console.log(`${label}  ->  ${result.url}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ slug: post.slug, error: message });
        console.error(`${label}  ->  FAILED: ${message}`);
      }
    }
  }

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const f of failures) console.error(`  ${f.slug}: ${f.error}`);
  }

  await mongoose.disconnect();
  if (failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
