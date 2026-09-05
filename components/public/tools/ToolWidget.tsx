import dynamic from "next/dynamic";
import type { ToolDef } from "@/lib/tools";
import { getRateCard } from "@/lib/rate-cards";
import { MCC_CODES, MCC_GROUPS } from "@/lib/tools-data/mcc";
import { SURCHARGE_STATES } from "@/lib/tools-data/surcharge";
import { INTERCHANGE_CATEGORIES, INTERCHANGE_NETWORKS, INTERCHANGE_RATES } from "@/lib/tools-data/interchange";
import { DOWNGRADE_REASONS } from "@/lib/tools-data/downgrades";
import { PCI_SAQ_QUESTIONS, PCI_SAQ_TYPES } from "@/lib/tools-data/pci";
import { BNPL_PROVIDERS } from "@/lib/tools-data/bnpl";

/**
 * Mounts the right calculator for a tool.
 *
 * A server component. The islands below are the only client code on a
 * `/tools/<slug>` page, and each renders with its default state on the server,
 * so the initial HTML already contains a worked result rather than an empty form.
 *
 * ON BUNDLE SIZE, because this was measured rather than assumed.
 *
 * `/tools/[tool]` is ONE route serving every calculator, so it has one
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
const CompoundInterestCalculator = dynamic(() =>
  import("@/components/public/tools/CompoundInterestCalculator.client").then(
    (m) => m.CompoundInterestCalculator,
  ),
);
const SimpleInterestCalculator = dynamic(() =>
  import("@/components/public/tools/SimpleInterestCalculator.client").then((m) => m.SimpleInterestCalculator),
);

// --- batch four -------------------------------------------------------------
const HelcimFeeCalculator = dynamic(() =>
  import("@/components/public/tools/HelcimFeeCalculator.client").then((m) => m.HelcimFeeCalculator),
);
const AdyenFeeCalculator = dynamic(() =>
  import("@/components/public/tools/AdyenFeeCalculator.client").then((m) => m.AdyenFeeCalculator),
);
const P2pBusinessFeeCalculator = dynamic(() =>
  import("@/components/public/tools/P2pBusinessFeeCalculator.client").then((m) => m.P2pBusinessFeeCalculator),
);
const InterchangeLookup = dynamic(() =>
  import("@/components/public/tools/InterchangeLookup.client").then((m) => m.InterchangeLookup),
);
const DowngradeCalculator = dynamic(() =>
  import("@/components/public/tools/DowngradeCalculator.client").then((m) => m.DowngradeCalculator),
);
const ChargebackCostCalculator = dynamic(() =>
  import("@/components/public/tools/ChargebackCostCalculator.client").then((m) => m.ChargebackCostCalculator),
);
const RefundCostCalculator = dynamic(() =>
  import("@/components/public/tools/RefundCostCalculator.client").then((m) => m.RefundCostCalculator),
);
const CrossBorderFeeCalculator = dynamic(() =>
  import("@/components/public/tools/CrossBorderFeeCalculator.client").then((m) => m.CrossBorderFeeCalculator),
);
const ProcessingSavingsCalculator = dynamic(() =>
  import("@/components/public/tools/ProcessingSavingsCalculator.client").then(
    (m) => m.ProcessingSavingsCalculator,
  ),
);
const JunkFeeCalculator = dynamic(() =>
  import("@/components/public/tools/JunkFeeCalculator.client").then((m) => m.JunkFeeCalculator),
);
const PciSaqFinder = dynamic(() =>
  import("@/components/public/tools/PciSaqFinder.client").then((m) => m.PciSaqFinder),
);
const BnplFeeCalculator = dynamic(() =>
  import("@/components/public/tools/BnplFeeCalculator.client").then((m) => m.BnplFeeCalculator),
);
const FalseDeclineCalculator = dynamic(() =>
  import("@/components/public/tools/FalseDeclineCalculator.client").then((m) => m.FalseDeclineCalculator),
);
const HighRiskCostCalculator = dynamic(() =>
  import("@/components/public/tools/HighRiskCostCalculator.client").then((m) => m.HighRiskCostCalculator),
);
const AprApyCalculator = dynamic(() =>
  import("@/components/public/tools/AprApyCalculator.client").then((m) => m.AprApyCalculator),
);
const LoanAmortizationCalculator = dynamic(() =>
  import("@/components/public/tools/LoanAmortizationCalculator.client").then(
    (m) => m.LoanAmortizationCalculator,
  ),
);
const InvoiceFactoringCalculator = dynamic(() =>
  import("@/components/public/tools/InvoiceFactoringCalculator.client").then(
    (m) => m.InvoiceFactoringCalculator,
  ),
);
const EarlyPaymentDiscountCalculator = dynamic(() =>
  import("@/components/public/tools/EarlyPaymentDiscountCalculator.client").then(
    (m) => m.EarlyPaymentDiscountCalculator,
  ),
);
const CashConversionCycleCalculator = dynamic(() =>
  import("@/components/public/tools/CashConversionCycleCalculator.client").then(
    (m) => m.CashConversionCycleCalculator,
  ),
);
const BreakEvenMarginCalculator = dynamic(() =>
  import("@/components/public/tools/BreakEvenMarginCalculator.client").then(
    (m) => m.BreakEvenMarginCalculator,
  ),
);

export function ToolWidget({ tool }: { tool: ToolDef }) {
  switch (tool.widget) {
    case "brand-fee":
      // Guarded by the registry: a brand-fee tool without a rate card is a
      // registry bug, and rendering nothing is better than throwing on a page.
      // The card is resolved HERE, on the server, and passed down, so a page
      // ships one processor's card rather than all ten.
      return tool.rateCard ? <BrandFeeCalculator card={getRateCard(tool.rateCard)} /> : null;
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
    case "compound-interest":
      return <CompoundInterestCalculator />;
    case "simple-interest":
      return <SimpleInterestCalculator />;
    case "helcim-fee":
      return tool.rateCard ? <HelcimFeeCalculator card={getRateCard(tool.rateCard)} /> : null;
    case "adyen-fee":
      return tool.rateCard ? <AdyenFeeCalculator card={getRateCard(tool.rateCard)} /> : null;
    case "p2p-business":
      return <P2pBusinessFeeCalculator />;
    case "interchange-lookup":
      return (
        <InterchangeLookup
          rows={INTERCHANGE_RATES}
          networks={INTERCHANGE_NETWORKS}
          categories={INTERCHANGE_CATEGORIES}
        />
      );
    case "downgrade":
      return <DowngradeCalculator reasons={DOWNGRADE_REASONS} />;
    case "chargeback-cost":
      return <ChargebackCostCalculator />;
    case "refund-cost":
      return <RefundCostCalculator />;
    case "fx-markup":
      return <CrossBorderFeeCalculator />;
    case "savings":
      return <ProcessingSavingsCalculator />;
    case "junk-fees":
      return <JunkFeeCalculator />;
    case "pci-saq":
      return <PciSaqFinder questions={PCI_SAQ_QUESTIONS} types={PCI_SAQ_TYPES} />;
    case "bnpl":
      return <BnplFeeCalculator providers={BNPL_PROVIDERS} />;
    case "false-decline":
      return <FalseDeclineCalculator />;
    case "high-risk":
      return <HighRiskCostCalculator />;
    case "apr-apy":
      return <AprApyCalculator />;
    case "loan-amortization":
      return <LoanAmortizationCalculator />;
    case "factoring":
      return <InvoiceFactoringCalculator />;
    case "early-payment-discount":
      return <EarlyPaymentDiscountCalculator />;
    case "cash-cycle":
      return <CashConversionCycleCalculator />;
    case "margin-markup":
      return <BreakEvenMarginCalculator />;
    default:
      return null;
  }
}

export default ToolWidget;
