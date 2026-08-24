import { Schema, model, models, type Model } from "mongoose";
import {
  FEE_SHEET_OFFER,
  OFFER_PAGE_TYPES,
  OFFER_SIGNUP_STATUSES,
  OFFER_VOLUMES,
  type OfferPageType,
  type OfferSignupStatus,
  type OfferVolume,
} from "@/lib/enums";
import { SpamMetaSchema, type ISpamMeta } from "./spamMeta";

/**
 * OfferSignup — email captured by a content offer (the fee-sheet slide-in).
 *
 * NOT a `Lead`. A Lead is a sales enquiry: it requires a name, usually names a
 * processor, and moves through new → contacted → closed because somebody is
 * going to work it. This is a one-field download in exchange for an email, and
 * folding the two together would wreck both — the Leads inbox is sorted and
 * searched by name, its CSV is a hand-off to a salesperson, and burying real
 * quote requests under a mailing list is how an inbox stops being read.
 *
 * `offer` is a key, not prose, so a second magnet later shares this collection
 * and the admin table gains a filter rather than a migration.
 *
 * The context fields (`pagePath`, `pageType`, `referrer`, `utm`) are what turn a
 * list of addresses into something you can act on: which page earned the signup
 * and which campaign sent the reader.
 */

/** Re-exported so `@/models` consumers get it without a second import path. */
export { FEE_SHEET_OFFER };

export interface IOfferUtm {
  source?: string;
  medium?: string;
  campaign?: string;
}

export interface IOfferSignup {
  email: string;
  /** Optional by design — a required qualifier on a download kills the download. */
  volume?: OfferVolume;
  offer: string;
  status: OfferSignupStatus;
  /** Path the slide-in converted on, e.g. `/compare/stripe-vs-square`. */
  pagePath?: string;
  pageType?: OfferPageType;
  /** External referrer only; same-origin navigation is dropped client-side. */
  referrer?: string;
  utm?: IOfferUtm;
  /**
   * Whether the sheet actually reached them. `false` with no `deliveryError`
   * means delivery was never attempted (no sheet URL configured yet), which is
   * a different problem from a bounced send and is surfaced differently in the
   * admin.
   */
  delivered: boolean;
  deliveredAt?: Date;
  /** Why the delivery send failed, verbatim, for the admin row detail. */
  deliveryError?: string;
  /** How many times this address submitted the form. Repeats upsert, not insert. */
  submissions: number;
  /** Classifier verdict, same shape every public form stores. */
  spam?: ISpamMeta;
  createdAt: Date;
  updatedAt: Date;
}

const UtmSchema = new Schema<IOfferUtm>(
  {
    source: { type: String, trim: true },
    medium: { type: String, trim: true },
    campaign: { type: String, trim: true },
  },
  { _id: false },
);

const OfferSignupSchema = new Schema<IOfferSignup>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    volume: { type: String, enum: OFFER_VOLUMES },
    offer: { type: String, required: true, trim: true, default: FEE_SHEET_OFFER },
    status: { type: String, enum: OFFER_SIGNUP_STATUSES, default: "new" },
    pagePath: { type: String, trim: true },
    pageType: { type: String, enum: OFFER_PAGE_TYPES },
    referrer: { type: String, trim: true },
    utm: { type: UtmSchema, required: false },
    delivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    deliveryError: { type: String, trim: true },
    submissions: { type: Number, default: 1 },
    spam: { type: SpamMetaSchema, required: false },
  },
  { timestamps: true },
);

// --- Indexes ---
/**
 * One row per address per offer. A mailing list with duplicates is a mailing
 * list nobody trusts, and a visitor who fills the form twice (different device,
 * cleared storage, lost the email) means "send it again", not "add me twice" —
 * the route upserts on this key and bumps `submissions`.
 */
OfferSignupSchema.index({ offer: 1, email: 1 }, { unique: true });
// Quarantined rows are filtered out of the default table on every load.
OfferSignupSchema.index({ "spam.verdict": 1, createdAt: -1 });
OfferSignupSchema.index({ offer: 1, createdAt: -1 });
OfferSignupSchema.index({ volume: 1 });

export const OfferSignup: Model<IOfferSignup> =
  (models.OfferSignup as Model<IOfferSignup>) ||
  model<IOfferSignup>("OfferSignup", OfferSignupSchema);

export default OfferSignup;
