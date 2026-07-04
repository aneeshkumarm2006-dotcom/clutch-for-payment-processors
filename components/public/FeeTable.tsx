import { cn } from "@/lib/utils";
import type { FeesData } from "@/lib/serialize";

/**
 * Structured fee table (DESIGN §6.9 / PRD §9.3). Two columns: fee type → value,
 * border-separated, no zebra, values right-aligned with tabular figures. Only
 * rows with a value render; an all-empty `fees` shows a graceful note.
 */

const FEE_ROWS: { key: keyof FeesData; label: string }[] = [
  { key: "onlineCardRate", label: "Online card rate" },
  { key: "inPersonCardRate", label: "In-person card rate" },
  { key: "keyedInRate", label: "Keyed-in rate" },
  { key: "internationalRate", label: "International surcharge" },
  { key: "achRate", label: "ACH / bank rate" },
  { key: "monthlyFee", label: "Monthly fee" },
  { key: "setupFee", label: "Setup fee" },
  { key: "monthlyMinimum", label: "Monthly minimum" },
  { key: "chargebackFee", label: "Chargeback fee" },
  { key: "pciFee", label: "PCI fee" },
  { key: "earlyTerminationFee", label: "Early termination fee" },
  { key: "refundPolicy", label: "Refund policy" },
];

export function FeeTable({ fees, className }: { fees: FeesData; className?: string }) {
  const rows = FEE_ROWS.filter((r) => {
    const v = fees[r.key];
    return typeof v === "string" && v.trim() !== "";
  });

  if (rows.length === 0) {
    return (
      <p className={cn("text-body text-muted-foreground", className)}>
        Detailed fee breakdown isn’t published for this processor yet. Check the provider’s website
        for current pricing.
      </p>
    );
  }

  return (
    <table className={cn("w-full border-collapse text-body", className)}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-b border-ink-150 last:border-0 dark:border-ink-800">
            <th scope="row" className="py-3 pr-4 text-left font-normal text-muted-foreground">
              {r.label}
            </th>
            <td className="py-3 pl-4 text-right font-medium tabular-nums text-foreground">
              {fees[r.key]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default FeeTable;
