import {
  BarChart3,
  Banknote,
  Bitcoin,
  Building2,
  CalendarClock,
  Check,
  CircleDot,
  Code2,
  CreditCard,
  FileText,
  Globe,
  KeyRound,
  Landmark,
  LayoutTemplate,
  LifeBuoy,
  Link as LinkIcon,
  Lock,
  Monitor,
  Nfc,
  PiggyBank,
  Repeat,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Split,
  Terminal,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Feature, Integration, PaymentMethod } from "@/lib/enums";

/**
 * Token → lucide icon maps (DESIGN §7 / §6.2 method glyphs · §6.x feature
 * checklists). lucide has no brand glyphs, so these are semantic stand-ins
 * (a card for Visa, a bag for Shopify, etc.) kept monochrome by the consumer.
 */

const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  visa: CreditCard,
  mastercard: CreditCard,
  amex: CreditCard,
  discover: CreditCard,
  "apple-pay": Smartphone,
  "google-pay": Smartphone,
  paypal: Wallet,
  ach: Landmark,
  sepa: Landmark,
  bnpl: CalendarClock,
  crypto: Bitcoin,
  upi: Smartphone,
  netbanking: Building2,
  wallets: Wallet,
  wire: Banknote,
};

const INTEGRATION_ICONS: Record<Integration, LucideIcon> = {
  api: Code2,
  "hosted-checkout": ShoppingCart,
  "drop-in-ui": LayoutTemplate,
  shopify: ShoppingBag,
  woocommerce: ShoppingBag,
  magento: ShoppingBag,
  bigcommerce: ShoppingBag,
  wix: Globe,
  squarespace: Globe,
  "mobile-sdk": Smartphone,
  "virtual-terminal": Monitor,
  "payment-links": LinkIcon,
  invoicing: FileText,
  "pos-hardware": Terminal,
};

const FEATURE_ICONS: Record<Feature, LucideIcon> = {
  "recurring-billing": Repeat,
  "multi-currency": Globe,
  "fraud-protection": ShieldCheck,
  "3d-secure": Lock,
  tokenization: KeyRound,
  "marketplace-split": Split,
  "reporting-dashboard": BarChart3,
  "tap-to-pay": Nfc,
  "chargeback-protection": Shield,
  "no-rolling-reserve": PiggyBank,
  "developer-friendly": Code2,
  "24-7-support": LifeBuoy,
};

export function methodIcon(token: string): LucideIcon {
  return PAYMENT_METHOD_ICONS[token as PaymentMethod] ?? CreditCard;
}

export function integrationIcon(token: string): LucideIcon {
  return INTEGRATION_ICONS[token as Integration] ?? CircleDot;
}

export function featureIcon(token: string): LucideIcon {
  return FEATURE_ICONS[token as Feature] ?? Check;
}
