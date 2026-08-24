import { z } from "zod";
import {
  FEE_SHEET_OFFER,
  OFFER_PAGE_TYPES,
  OFFER_SIGNUP_STATUSES,
  OFFER_VOLUMES,
} from "@/lib/enums";

/**
 * Public capture for a content offer (the fee-sheet slide-in), plus the admin
 * status update.
 *
 * Everything except the email is optional and everything except the email is
 * ATTRIBUTION, supplied by the client and therefore untrusted: the caps below
 * exist so a crafted post cannot store an essay in `referrer`. Values that fail
 * are dropped rather than rejected — losing a UTM tag must never lose the email
 * that came with it.
 */

/** Trim, drop blanks, and cap length. Over-long attribution is truncated, not fatal. */
const attribution = (max: number) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t === "" ? undefined : t.slice(0, max);
    },
    z.string().max(max).optional(),
  );

/** A site-relative path. Anything else (absolute URL, protocol-relative) is dropped. */
const pathField = z.preprocess(
  (v) => {
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return /^\/(?!\/)[^\s]*$/.test(t) ? t.slice(0, 300) : undefined;
  },
  z.string().max(300).optional(),
);

/** An enum value, or nothing. A junk value never fails the submission. */
const looseEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => (typeof v === "string" && (values as readonly string[]).includes(v) ? v : undefined),
    z.enum(values).optional(),
  );

export const offerSignupInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  // NOT `looseEnum`: this one is a real answer from a real <select>, and a value
  // outside the list is a payload no rendered dropdown could have produced.
  // The spam classifier scores exactly that, so it must survive to the guard.
  volume: z.enum(OFFER_VOLUMES).optional(),
  offer: z.string().trim().min(1).max(60).default(FEE_SHEET_OFFER),
  pagePath: pathField,
  pageType: looseEnum(OFFER_PAGE_TYPES),
  referrer: attribution(300),
  utm: z
    .object({
      source: attribution(120),
      medium: attribution(120),
      campaign: attribution(120),
    })
    .optional(),
});

/** Admin status update. */
export const offerSignupUpdate = z.object({
  status: z.enum(OFFER_SIGNUP_STATUSES),
});

export type OfferSignupInput = z.infer<typeof offerSignupInput>;
export type OfferSignupUpdateInput = z.infer<typeof offerSignupUpdate>;
