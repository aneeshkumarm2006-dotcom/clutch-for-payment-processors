/**
 * Interchange downgrade cost arithmetic.
 *
 * Client safe: no `@/models`, no I/O, no clock. Every import is a TYPE import,
 * so this module has no runtime dependency on the reference data at all. The
 * caller passes the rate rows in. That is deliberate: the maths is permanent and
 * the rate sheets are not, so nothing here has to change when Visa reprices.
 *
 * ─── The failure mode this module exists to prevent ─────────────────────────
 *
 * A transaction can only downgrade ONCE. It clears in exactly one interchange
 * program. Every downgrade calculator that exists on the web at the time of
 * writing takes each cause, multiplies it by the merchant's whole volume, and
 * adds the answers up. On a merchant who ticks four boxes that produces a
 * "downgrade cost" larger than their entire interchange bill, and it does not
 * look wrong, because the individual lines are all defensible.
 *
 * So `downgradeCost` allocates instead of summing. It sorts the causes worst
 * first, gives each one the share of volume it asks for out of what is left, and
 * stops at 100 percent of the merchant's volume. A transaction that is both
 * settled late and missing a customer code is charged once, at the worse of the
 * two, which is what actually happens on a statement. The naive total is
 * returned alongside as `naiveMonthlyTotal` so the page can show the gap rather
 * than just asserting it.
 *
 * Commercial causes are capped a second time, at the merchant's commercial card
 * share, because a consumer card cannot miss a Level 3 requirement it was never
 * eligible for.
 *
 * ─── Integer cents ──────────────────────────────────────────────────────────
 *
 * Money is computed in integer cents throughout. A merchant reading this page is
 * usually holding a statement, and binary floating point produces one cent
 * errors at precisely the moment somebody is checking.
 */

import type { DowngradeBasis, DowngradeReason, EnhancedDataLadder } from "@/lib/tools-data/downgrades";

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** Round half UP, which is the direction a processor rounds. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

// ---------------------------------------------------------------------------
// Downgrade cost
// ---------------------------------------------------------------------------

export interface DowngradeSelection {
  id: string;
  /** Share of this cause's own pool that is affected, 0 to 100. */
  sharePct: number;
}

export interface DowngradeInputs {
  monthlyVolume: number;
  monthlyTransactions: number;
  /** Share of monthly volume running on commercial cards, 0 to 100. */
  commercialSharePct: number;
  selections: DowngradeSelection[];
}

export interface DowngradeLine {
  id: string;
  label: string;
  basis: DowngradeBasis;
  deltaPct: number;
  deltaCents: number;
  /** What the user asked for, as a share of this cause's own pool. */
  requestedSharePct: number;
  /** What the allocator could actually give it, as a share of TOTAL volume. */
  appliedSharePct: number;
  /** True when the allocator had to cut this line because volume ran out. */
  clipped: boolean;
  affectedVolume: number;
  affectedTransactions: number;
  monthlyCost: number;
  annualCost: number;
  /** This line's cost expressed as basis points on total monthly volume. */
  bps: number;
  fromProgram: string;
  toProgram: string;
  fix: string;
}

export interface DowngradeResult {
  lines: DowngradeLine[];
  monthlyTotal: number;
  annualTotal: number;
  /** Total cost as basis points on total monthly volume. */
  totalBps: number;
  averageTicket: number;
  /** Share of total volume the allocator marked as downgraded. */
  downgradedSharePct: number;
  anyClipped: boolean;
  /**
   * What you get by multiplying every cause by its own pool and adding up, with
   * no allocation. Always greater than or equal to `monthlyTotal`. Rendered on
   * the page as the size of the error every competing calculator makes.
   */
  naiveMonthlyTotal: number;
}

/**
 * Cost of the selected downgrade causes, ranked, allocated worst first.
 *
 * Ordering is by percentage-point delta descending, then by cents delta, then by
 * id. The id tiebreak is not cosmetic: without it the allocation of two causes
 * with identical deltas would depend on the order the widget happens to hand
 * them over, and the same inputs would produce two different answers.
 */
export function downgradeCost(inputs: DowngradeInputs, reasons: DowngradeReason[]): DowngradeResult {
  const volume = Math.max(0, safe(inputs.monthlyVolume));
  const txns = Math.max(0, safe(inputs.monthlyTransactions));
  const commercialShare = clamp(safe(inputs.commercialSharePct), 0, 100) / 100;
  const volumeCents = toCents(volume);

  const byId = new Map(reasons.map((r) => [r.id, r]));

  const picked = inputs.selections
    .map((s) => ({ reason: byId.get(s.id), sharePct: clamp(safe(s.sharePct), 0, 100) }))
    .filter((s): s is { reason: DowngradeReason; sharePct: number } => Boolean(s.reason) && s.sharePct > 0)
    .sort((a, b) => {
      if (b.reason.deltaPct !== a.reason.deltaPct) return b.reason.deltaPct - a.reason.deltaPct;
      if (b.reason.deltaCents !== a.reason.deltaCents) return b.reason.deltaCents - a.reason.deltaCents;
      return a.reason.id.localeCompare(b.reason.id);
    });

  let available = 1;
  let naiveCents = 0;
  const lines: DowngradeLine[] = [];

  for (const { reason, sharePct } of picked) {
    // A commercial cause can never reach more of the book than the commercial
    // share, however large a share of "its own volume" the user claims.
    const poolShare = reason.basis === "commercial" ? commercialShare : 1;
    const wanted = poolShare * (sharePct / 100);
    const applied = Math.min(wanted, available);
    available -= applied;

    const affectedVolumeCents = roundHalfUp(volumeCents * applied);
    const affectedTxns = roundHalfUp(txns * applied);
    const costCents =
      roundHalfUp((affectedVolumeCents * reason.deltaPct) / 100) + affectedTxns * reason.deltaCents;

    // The naive total uses `wanted`, not `applied`, which is exactly the bug.
    const naiveVolumeCents = roundHalfUp(volumeCents * wanted);
    const naiveTxns = roundHalfUp(txns * wanted);
    naiveCents +=
      roundHalfUp((naiveVolumeCents * reason.deltaPct) / 100) + naiveTxns * reason.deltaCents;

    lines.push({
      id: reason.id,
      label: reason.label,
      basis: reason.basis,
      deltaPct: reason.deltaPct,
      deltaCents: reason.deltaCents,
      requestedSharePct: sharePct,
      appliedSharePct: applied * 100,
      clipped: applied + 1e-12 < wanted,
      affectedVolume: affectedVolumeCents / 100,
      affectedTransactions: affectedTxns,
      monthlyCost: costCents / 100,
      annualCost: (costCents * 12) / 100,
      bps: volumeCents > 0 ? (costCents / volumeCents) * 10000 : 0,
      fromProgram: reason.fromProgram,
      toProgram: reason.toProgram,
      fix: reason.fix,
    });
  }

  const monthlyCents = lines.reduce((sum, l) => sum + toCents(l.monthlyCost), 0);

  return {
    lines,
    monthlyTotal: monthlyCents / 100,
    annualTotal: (monthlyCents * 12) / 100,
    totalBps: volumeCents > 0 ? (monthlyCents / volumeCents) * 10000 : 0,
    averageTicket: txns > 0 ? volume / txns : 0,
    downgradedSharePct: (1 - available) * 100,
    anyClipped: lines.some((l) => l.clipped),
    naiveMonthlyTotal: naiveCents / 100,
  };
}

// ---------------------------------------------------------------------------
// Enhanced data uplift
// ---------------------------------------------------------------------------

export interface UpliftLeg {
  network: "Visa" | "Mastercard";
  /** False when the network publishes no program at one of the two rungs. */
  available: boolean;
  unavailableNote: string;
  fromProgram: string;
  fromPct: number;
  fromCents: number;
  toProgram: string;
  toPct: number;
  toCents: number;
  /** Percentage points saved on the rate, before the participation fee. */
  rateSavingPct: number;
  /** Percentage points of participation fee added or removed by the move. */
  participationFeePct: number;
  monthlySaving: number;
  annualSaving: number;
}

export interface UpliftResult {
  legs: UpliftLeg[];
  commercialVolume: number;
  commercialTransactions: number;
  /** Smallest annual saving across the networks that publish both rungs. */
  annualLow: number;
  /** Largest annual saving across the networks that publish both rungs. */
  annualHigh: number;
  /** True when neither network publishes both rungs, so there is nothing to price. */
  empty: boolean;
}

/**
 * What moving from one rung of the enhanced data ladder to another is worth on a
 * merchant's commercial card volume, per network.
 *
 * Two things here are easy to get wrong and are handled explicitly.
 *
 * A rung can be MISSING. Visa retired the general Commercial Level II program in
 * April 2026 and Mastercard publishes no Data Rate III for small business
 * credit. Those rungs carry `null` rates in the data module, and this function
 * returns `available: false` for that network rather than falling back to the
 * neighbouring rate, which would invent a saving out of a gap in a rate sheet.
 *
 * The Visa participation fee is charged on ENHANCED DATA submissions, so it is
 * applied to the target rung when the target carries enhanced data and removed
 * from the source rung when the source already did. Adding it unconditionally
 * overstates the cost of a level 2 to level 3 move by five basis points, which
 * is small, plausible and wrong.
 */
export function enhancedDataUplift(
  ladder: EnhancedDataLadder,
  fromLevelId: string,
  toLevelId: string,
  commercialVolume: number,
  commercialTransactions: number,
  visaParticipationFeePct: number,
): UpliftResult {
  const volume = Math.max(0, safe(commercialVolume));
  const txns = Math.max(0, safe(commercialTransactions));
  const volumeCents = toCents(volume);
  const roundedTxns = roundHalfUp(txns);

  const from = ladder.rungs.find((r) => r.id === fromLevelId);
  const to = ladder.rungs.find((r) => r.id === toLevelId);

  const isEnhanced = (id: string) => id === "level2" || id === "level3";

  const leg = (network: "Visa" | "Mastercard"): UpliftLeg => {
    const fromProgram = network === "Visa" ? from?.visaProgram : from?.mcProgram;
    const toProgram = network === "Visa" ? to?.visaProgram : to?.mcProgram;
    const fromPct = network === "Visa" ? from?.visaPct : from?.mcPct;
    const toPct = network === "Visa" ? to?.visaPct : to?.mcPct;
    const fromCents = network === "Visa" ? from?.visaCents : from?.mcCents;
    const toCentsVal = network === "Visa" ? to?.visaCents : to?.mcCents;

    if (
      !fromProgram ||
      !toProgram ||
      fromPct == null ||
      toPct == null ||
      fromCents == null ||
      toCentsVal == null
    ) {
      return {
        network,
        available: false,
        unavailableNote: !fromProgram
          ? `${network} publishes no program at this starting level for ${ladder.label.toLowerCase()}.`
          : `${network} publishes no program at this target level for ${ladder.label.toLowerCase()}.`,
        fromProgram: fromProgram ?? "no published program",
        fromPct: fromPct ?? 0,
        fromCents: fromCents ?? 0,
        toProgram: toProgram ?? "no published program",
        toPct: toPct ?? 0,
        toCents: toCentsVal ?? 0,
        rateSavingPct: 0,
        participationFeePct: 0,
        monthlySaving: 0,
        annualSaving: 0,
      };
    }

    const feeDelta =
      network === "Visa"
        ? (isEnhanced(toLevelId) ? visaParticipationFeePct : 0) -
          (isEnhanced(fromLevelId) ? visaParticipationFeePct : 0)
        : 0;

    const rateSavingPct = fromPct - toPct;
    const savingCents =
      roundHalfUp((volumeCents * (rateSavingPct - feeDelta)) / 100) +
      roundedTxns * (fromCents - toCentsVal);

    return {
      network,
      available: true,
      unavailableNote: "",
      fromProgram,
      fromPct,
      fromCents,
      toProgram,
      toPct,
      toCents: toCentsVal,
      rateSavingPct,
      participationFeePct: feeDelta,
      monthlySaving: savingCents / 100,
      annualSaving: (savingCents * 12) / 100,
    };
  };

  const legs: UpliftLeg[] = [leg("Visa"), leg("Mastercard")];
  const live = legs.filter((l) => l.available);

  return {
    legs,
    commercialVolume: volume,
    commercialTransactions: roundedTxns,
    annualLow: live.length > 0 ? Math.min(...live.map((l) => l.annualSaving)) : 0,
    annualHigh: live.length > 0 ? Math.max(...live.map((l) => l.annualSaving)) : 0,
    empty: live.length === 0,
  };
}
