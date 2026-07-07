import { Schema, model, models, type Model } from "mongoose";

/**
 * Media — the SEO-team image library (blog media gallery).
 *
 * Records every image the gallery knows about: files uploaded through
 * `/api/seoteam/media`, external URLs registered via bulk import, and images
 * *discovered* by scanning existing `BlogPost` docs (cover / OG / inline `<img>`).
 *
 * NOT a PRD data-model collection — added for the /seoteam Media Gallery. Image
 * *usage* ("where is this attached") is NOT stored here: posts change constantly,
 * so usage is computed on read by `lib/media.ts#scanBlogImageUsage`. This model
 * only holds the asset registry + editable metadata (alt / title / tags).
 */
export type MediaProvider = "cloudinary" | "local" | "external";
export type MediaSource = "upload" | "import" | "discovered";

export interface IMedia {
  /** Public URL — the natural key. Unique. */
  url: string;
  /** Cloudinary `public_id` (or local path). The key used to delete the asset. */
  pathname?: string;
  provider: MediaProvider;
  /** Namespace the asset was uploaded under ("blog" | "og" | "uploads" | …). */
  folder?: string;
  filename?: string;
  contentType?: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
  /** Default alt text, offered when the image is picked into a post. */
  alt?: string;
  title?: string;
  tags: string[];
  source: MediaSource;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    url: { type: String, required: true, unique: true, trim: true },
    pathname: { type: String, trim: true },
    provider: {
      type: String,
      enum: ["cloudinary", "local", "external"],
      required: true,
      default: "external",
    },
    folder: { type: String, trim: true },
    filename: { type: String, trim: true },
    contentType: { type: String, trim: true },
    bytes: { type: Number },
    width: { type: Number },
    height: { type: Number },
    format: { type: String, trim: true },
    alt: { type: String, trim: true },
    title: { type: String, trim: true },
    tags: { type: [String], default: [] },
    source: {
      type: String,
      enum: ["upload", "import", "discovered"],
      required: true,
      default: "upload",
    },
  },
  { timestamps: true },
);

// --- Indexes ---
// `url` unique index is declared inline above (the dedup key).
// Primary gallery access pattern: newest first.
MediaSchema.index({ createdAt: -1 });
// Tag filtering in the gallery toolbar.
MediaSchema.index({ tags: 1 });

export const Media: Model<IMedia> =
  (models.Media as Model<IMedia>) || model<IMedia>("Media", MediaSchema);

export default Media;
