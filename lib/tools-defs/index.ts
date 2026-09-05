/**
 * Batch four of the `/tools/*` registry: twenty five entries, one file each.
 *
 * WHY A DIRECTORY RATHER THAN A FOURTH FLAT MODULE. `lib/tools-more.ts` is
 * 1,900 lines for ten tools. Twenty five in one file would be roughly 5,000
 * lines of prose that nobody can review and every edit conflicts in. One file
 * per page means a page's copy has its own diff, its own history, and its own
 * blame line, which matters because this copy carries dated factual claims.
 *
 * Each module default-exports nothing and named-exports a single `ToolDef`. The
 * array below is HUB ORDER, so it is also the order the tiers render in on
 * `/tools`. All of them import `ToolDef` from `@/lib/tools` as a TYPE, so the
 * import is erased at compile time and there is no runtime cycle with the
 * registry that concatenates them.
 *
 * SERVER SIDE ONLY, like the rest of the registry. A `"use client"` module must
 * never import this, `@/lib/tools`, or the `@/lib/tools-data` barrel: one route
 * serves every calculator, so anything a widget imports ships to all of them.
 */

import type { ToolDef } from "@/lib/tools";

// Brand fee calculators.
import { SHOPIFY_PAYMENTS_FEE_TOOL } from "@/lib/tools-defs/shopify-payments-fee-calculator";
import { CLOVER_FEE_TOOL } from "@/lib/tools-defs/clover-fee-calculator";
import { TOAST_FEE_TOOL } from "@/lib/tools-defs/toast-fee-calculator";
import { HELCIM_FEE_TOOL } from "@/lib/tools-defs/helcim-fee-calculator";
import { ADYEN_FEE_TOOL } from "@/lib/tools-defs/adyen-fee-calculator";
import { BRAINTREE_FEE_TOOL } from "@/lib/tools-defs/braintree-fee-calculator";
import { AUTHORIZE_NET_FEE_TOOL } from "@/lib/tools-defs/authorize-net-fee-calculator";
import { P2P_BUSINESS_FEE_TOOL } from "@/lib/tools-defs/venmo-cash-app-zelle-business-fee-calculator";

// Interchange and cost-of-acceptance tools.
import { INTERCHANGE_LOOKUP_TOOL } from "@/lib/tools-defs/interchange-fee-lookup";
import { INTERCHANGE_DOWNGRADE_TOOL } from "@/lib/tools-defs/interchange-downgrade-calculator";
import { CHARGEBACK_COST_TOOL } from "@/lib/tools-defs/chargeback-cost-calculator";
import { REFUND_COST_TOOL } from "@/lib/tools-defs/refund-cost-calculator";
import { CROSS_BORDER_FEE_TOOL } from "@/lib/tools-defs/cross-border-fee-calculator";
import { PROCESSING_SAVINGS_TOOL } from "@/lib/tools-defs/credit-card-processing-savings-calculator";
import { JUNK_FEE_TOOL } from "@/lib/tools-defs/merchant-account-junk-fee-calculator";
import { PCI_SAQ_TOOL } from "@/lib/tools-defs/pci-saq-level-finder";
import { BNPL_FEE_TOOL } from "@/lib/tools-defs/bnpl-fee-calculator";
import { FALSE_DECLINE_TOOL } from "@/lib/tools-defs/false-decline-cost-calculator";
import { HIGH_RISK_COST_TOOL } from "@/lib/tools-defs/high-risk-merchant-account-cost-calculator";

// Business finance arithmetic.
import { APR_VS_APY_TOOL } from "@/lib/tools-defs/apr-vs-apy-calculator";
import { LOAN_AMORTIZATION_TOOL } from "@/lib/tools-defs/business-loan-amortization-calculator";
import { INVOICE_FACTORING_TOOL } from "@/lib/tools-defs/invoice-factoring-calculator";
import { EARLY_PAYMENT_DISCOUNT_TOOL } from "@/lib/tools-defs/early-payment-discount-calculator";
import { CASH_CONVERSION_CYCLE_TOOL } from "@/lib/tools-defs/cash-conversion-cycle-calculator";
import { BREAK_EVEN_MARGIN_TOOL } from "@/lib/tools-defs/break-even-and-margin-calculator";

export const BATCH_FOUR_TOOLS: ToolDef[] = [
  SHOPIFY_PAYMENTS_FEE_TOOL,
  CLOVER_FEE_TOOL,
  TOAST_FEE_TOOL,
  HELCIM_FEE_TOOL,
  ADYEN_FEE_TOOL,
  BRAINTREE_FEE_TOOL,
  AUTHORIZE_NET_FEE_TOOL,
  P2P_BUSINESS_FEE_TOOL,
  INTERCHANGE_LOOKUP_TOOL,
  INTERCHANGE_DOWNGRADE_TOOL,
  CHARGEBACK_COST_TOOL,
  REFUND_COST_TOOL,
  CROSS_BORDER_FEE_TOOL,
  PROCESSING_SAVINGS_TOOL,
  JUNK_FEE_TOOL,
  PCI_SAQ_TOOL,
  BNPL_FEE_TOOL,
  FALSE_DECLINE_TOOL,
  HIGH_RISK_COST_TOOL,
  APR_VS_APY_TOOL,
  LOAN_AMORTIZATION_TOOL,
  INVOICE_FACTORING_TOOL,
  EARLY_PAYMENT_DISCOUNT_TOOL,
  CASH_CONVERSION_CYCLE_TOOL,
  BREAK_EVEN_MARGIN_TOOL,
];
