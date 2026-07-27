import {
  BadgeCheck,
  CheckCircle2,
  CircleDot,
  Clock,
  CreditCard,
  FileText,
  GitCompare,
  Globe,
  Handshake,
  LineChart,
  Lock,
  PencilLine,
  PiggyBank,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon palette offered by the landing-page editor for "How it works" steps and
 * the CTA band. Stored on the settings document as the string key, resolved to a
 * component at render time — a lucide component can't be serialized into Mongo,
 * and an editor shouldn't be typing component names.
 *
 * Keys are permanent: renaming one silently blanks the icon on every saved
 * section that used it. Add new entries, don't rename old ones.
 */
export const HOME_ICONS = {
  search: Search,
  compare: GitCompare,
  check: CheckCircle2,
  verified: BadgeCheck,
  shield: ShieldCheck,
  lock: Lock,
  star: Star,
  pencil: PencilLine,
  store: Store,
  card: CreditCard,
  wallet: Wallet,
  savings: PiggyBank,
  chart: LineChart,
  users: Users,
  clock: Clock,
  zap: Zap,
  globe: Globe,
  document: FileText,
  handshake: Handshake,
  sparkles: Sparkles,
} as const satisfies Record<string, LucideIcon>;

export type HomeIconKey = keyof typeof HOME_ICONS;

export const HOME_ICON_KEYS = Object.keys(HOME_ICONS) as HomeIconKey[];

/** Human labels for the admin icon picker. */
export const HOME_ICON_LABELS: Record<HomeIconKey, string> = {
  search: "Search",
  compare: "Compare",
  check: "Check",
  verified: "Verified badge",
  shield: "Shield",
  lock: "Lock",
  star: "Star",
  pencil: "Pencil",
  store: "Store",
  card: "Credit card",
  wallet: "Wallet",
  savings: "Savings",
  chart: "Chart",
  users: "People",
  clock: "Clock",
  zap: "Lightning",
  globe: "Globe",
  document: "Document",
  handshake: "Handshake",
  sparkles: "Sparkles",
};

/** Never throws — an icon key removed from the palette renders as a neutral dot. */
export function homeIcon(key?: string): LucideIcon {
  if (key && key in HOME_ICONS) return HOME_ICONS[key as HomeIconKey];
  return CircleDot;
}
