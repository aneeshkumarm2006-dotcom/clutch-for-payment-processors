/**
 * The rate-card barrel: every processor with a published US schedule this site
 * prices against.
 *
 * SERVER ONLY, in practice. `/tools/[tool]` is a single route with a single
 * client reference manifest, so a `"use client"` module that imports this ships
 * all ten cards to every calculator page. `ToolWidget` is a Server Component: it
 * calls `getRateCard` and passes the ONE card the page needs into
 * `BrandFeeCalculator` as a prop, so only that card is serialized. Same rule as
 * `lib/tools-data/index.ts`, and it exists for the same measured reason.
 *
 * `Record<RateCardKey, RateCard>` is load-bearing. Add a key to `RateCardKey` in
 * `lib/tools-rates.ts` without adding the module here and this file fails to
 * compile, so the union and the data cannot drift apart.
 *
 * MAINTENANCE. Each module carries its own `checked` date and its own sources,
 * both rendered in the assumptions block on the page. A wrong number renders
 * identically to a right one. Do not move a `checked` date without re-reading
 * the source.
 */

import type { RateCard, RateCardKey } from "@/lib/tools-rates";
import { STRIPE_RATE_CARD } from "@/lib/rate-cards/stripe";
import { PAYPAL_RATE_CARD } from "@/lib/rate-cards/paypal";
import { SQUARE_RATE_CARD } from "@/lib/rate-cards/square";
import { SHOPIFY_RATE_CARD } from "@/lib/rate-cards/shopify";
import { CLOVER_RATE_CARD } from "@/lib/rate-cards/clover";
import { TOAST_RATE_CARD } from "@/lib/rate-cards/toast";
import { HELCIM_RATE_CARD } from "@/lib/rate-cards/helcim";
import { ADYEN_RATE_CARD } from "@/lib/rate-cards/adyen";
import { BRAINTREE_RATE_CARD } from "@/lib/rate-cards/braintree";
import { AUTHORIZE_NET_RATE_CARD } from "@/lib/rate-cards/authorize-net";

export const RATE_CARDS: Record<RateCardKey, RateCard> = {
  stripe: STRIPE_RATE_CARD,
  paypal: PAYPAL_RATE_CARD,
  square: SQUARE_RATE_CARD,
  shopify: SHOPIFY_RATE_CARD,
  clover: CLOVER_RATE_CARD,
  toast: TOAST_RATE_CARD,
  helcim: HELCIM_RATE_CARD,
  adyen: ADYEN_RATE_CARD,
  braintree: BRAINTREE_RATE_CARD,
  "authorize-net": AUTHORIZE_NET_RATE_CARD,
};

export const getRateCard = (key: RateCardKey): RateCard => RATE_CARDS[key];
