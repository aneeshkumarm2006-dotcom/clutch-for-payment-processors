import dynamic from "next/dynamic";
import type { ToolDef } from "@/lib/tools";
import { MCC_CODES, MCC_GROUPS } from "@/lib/tools-data/mcc";
import { SURCHARGE_STATES } from "@/lib/tools-data/surcharge";

/**
 * Mounts the right calculator for a tool.
 *
 * A server component. The islands below are the only client code on a
 * `/tools/<slug>` page, and each renders with its default state on the server,
 * so the initial HTML already contains a worked result rather than an empty form.
 *
 * ON BUNDLE SIZE, because this was measured rather than assumed.
 *
 * `/tools/[tool]` is ONE route serving all fifteen calculators, so it has one
 * client reference manifest and every tool page downloads the same chunk set.
 * That was verified: the prerendered HTML for the Stripe page and the MCC page
 * reference an identical list of chunks. `next/dynamic` does NOT change that in
 * the App Router. It is kept here because it costs nothing and keeps `ssr: true`
 * explicit, but do not expect it to split anything.
 *
 * What actually brought the first load from 295 kB to 208 kB was removing things
 * from the client graph:
 *
 *   1. `ToolKit` and `BrandFeeCalculator` imported `lib/tools.ts` for the rate
 *      bands and rate cards, which dragged the entire tool registry, including
 *      `lib/tools-more.ts`, into every tool page. Those moved to
 *      `lib/tools-rates.ts`.
 *   2. Reference data moved from one 112 kB module to one module per tool under
 *      `lib/tools-data/`, so a widget can import only its own constants.
 *   3. The two big datasets, the 290 row MCC table and the 52 row state
 *      surcharge table, are passed as PROPS from this server component instead
 *      of imported by the client modules, so they ride only their own page's
 *      payload.
 *
 * The rule that follows: a `"use client"` module under this directory must never
 * import `@/lib/tools` or `@/lib/tools-data` (the barrel). Import the narrow
 * module, or take the data as a prop from here.
 *
 * Do not add `ssr: false` to any of these: the server-rendered default state is
 * what a crawler and an answer engine actually read.
 */
const ProcessingFeeCalculator = dynamic(() =>
  import("@/components/public/tools/ProcessingFeeCalculator.client").then((m) => m.ProcessingFeeCalculator),
);
const BrandFeeCalculator = dynamic(() =>
  import("@/components/public/tools/BrandFeeCalculator.client").then((m) => m.BrandFeeCalculator),
);
const EffectiveRateCalculator = dynamic(() =>
  import("@/components/public/tools/EffectiveRateCalculator.client").then((m) => m.EffectiveRateCalculator),
);
const PricingModelCalculator = dynamic(() =>
  import("@/components/public/tools/PricingModelCalculator.client").then((m) => m.PricingModelCalculator),
);
const AchVsCardCalculator = dynamic(() =>
  import("@/components/public/tools/AchVsCardCalculator.client").then((m) => m.AchVsCardCalculator),
);
const McaCalculator = dynamic(() =>
  import("@/components/public/tools/McaCalculator.client").then((m) => m.McaCalculator),
);
const GrossUpCalculator = dynamic(() =>
  import("@/components/public/tools/GrossUpCalculator.client").then((m) => m.GrossUpCalculator),
);
const ChargebackCalculator = dynamic(() =>
  import("@/components/public/tools/ChargebackCalculator.client").then((m) => m.ChargebackCalculator),
);
const RollingReserveCalculator = dynamic(() =>
  import("@/components/public/tools/RollingReserveCalculator.client").then((m) => m.RollingReserveCalculator),
);
const PayoutDateCalculator = dynamic(() =>
  import("@/components/public/tools/PayoutDateCalculator.client").then((m) => m.PayoutDateCalculator),
);
const MccLookup = dynamic(() => import("@/components/public/tools/MccLookup.client").then((m) => m.MccLookup));
const SurchargeCalculator = dynamic(() =>
  import("@/components/public/tools/SurchargeCalculator.client").then((m) => m.SurchargeCalculator),
);
const RestaurantFeeCalculator = dynamic(() =>
  import("@/components/public/tools/RestaurantFeeCalculator.client").then((m) => m.RestaurantFeeCalculator),
);
const ChurnCalculator = dynamic(() =>
  import("@/components/public/tools/ChurnCalculator.client").then((m) => m.ChurnCalculator),
);
const LeaseVsBuyCalculator = dynamic(() =>
  import("@/components/public/tools/LeaseVsBuyCalculator.client").then((m) => m.LeaseVsBuyCalculator),
);

export function ToolWidget({ tool }: { tool: ToolDef }) {
  switch (tool.widget) {
    case "brand-fee":
      // Guarded by the registry: a brand-fee tool without a rate card is a
      // registry bug, and rendering nothing is better than throwing on a page.
      return tool.rateCard ? <BrandFeeCalculator cardKey={tool.rateCard} /> : null;
    case "processing-fee":
      return <ProcessingFeeCalculator />;
    case "effective-rate":
      return <EffectiveRateCalculator />;
    case "pricing-model":
      return <PricingModelCalculator />;
    case "ach-vs-card":
      return <AchVsCardCalculator />;
    case "mca":
      return <McaCalculator />;
    case "gross-up":
      return <GrossUpCalculator />;
    case "chargeback":
      return <ChargebackCalculator />;
    case "rolling-reserve":
      return <RollingReserveCalculator />;
    case "payout-date":
      return <PayoutDateCalculator />;
    case "mcc-lookup":
      return <MccLookup codes={MCC_CODES} groups={MCC_GROUPS} />;
    case "surcharge":
      return <SurchargeCalculator states={SURCHARGE_STATES} />;
    case "restaurant":
      return <RestaurantFeeCalculator />;
    case "churn":
      return <ChurnCalculator />;
    case "lease-vs-buy":
      return <LeaseVsBuyCalculator />;
    default:
      return null;
  }
}

export default ToolWidget;
