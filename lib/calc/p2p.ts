/**
 * What Venmo, Cash App and Zelle cost a US business, and what a card costs beside them.
 *
 * Pure arithmetic for the `/tools/venmo-cash-app-zelle-business-fee-calculator`
 * widget. Client safe: no `@/models`, no `server-only`, no I/O, no clock. The
 * same inputs always produce the same outputs, which is what lets the server
 * render the default result into the HTML and the test assert it.
 *
 * ─── WHY EVERY FIGURE IS COMPUTED IN INTEGER CENTS ──────────────────────────
 * A merchant checks this against a Venmo or Cash App transaction list, one line
 * at a time. Binary floating point produces one cent errors exactly at that
 * moment. 2.99 percent of $50 is $1.495 in decimal and 1.4949999999999999 in a
 * double, so a naive `toFixed(2)` rounds it DOWN to $1.49 while the provider
 * rounds it UP to $1.50. Everything below therefore works in whole cents and
 * rounds half up, which is the direction a payment provider rounds.
 *
 * ─── WHY THE MONTHLY FEE IS COUNT TIMES PER PAYMENT, NOT RATE TIMES VOLUME ──
 * This is the silent failure that makes competing calculators wrong. Venmo's
 * business rate is 1.9 percent PLUS TEN CENTS on each payment, and Cash App's is
 * 2.6 percent PLUS FIFTEEN CENTS on each payment. Applying the percentage to the
 * month's volume and adding the fixed fee once understates the bill by
 * (count - 1) times the fixed fee. On the default inputs, 120 payments at a
 * $0.15 fixed fee, that is $17.85 a month hidden, and the error grows with
 * exactly the merchant profile the fixed fee hurts most: many small tickets.
 *
 * So `sellerFeeMonthly` is the per payment fee, rounded to the cent the way the
 * provider rounds it, multiplied by the transaction count. That also means the
 * rounding is applied 120 times rather than once, which is what the statement
 * does.
 *
 * ─── WHY A PAYOUT FEE IS A BAND, NOT A NUMBER ───────────────────────────────
 * Cash App publishes its instant transfer fee as a range and says the exact
 * figure is disclosed at the time of the transaction. There is no honest single
 * number, so every payout result carries `low` and `high`, and they are equal
 * where the provider publishes one rate. Collapsing the band to a midpoint would
 * be publishing a number nobody published.
 *
 * ─── THE CLAMP ORDER MATTERS ────────────────────────────────────────────────
 * Percentage first, then the minimum floor, then the maximum cap. Applying the
 * cap before the floor can return a fee below the published minimum on a tiny
 * withdrawal, and applying the floor after the cap can return a fee above the
 * published maximum. This is the same class of bug as the ACH fee ordering
 * recorded in NOTES.md, where a cap modeled as a flat percentage produced a
 * crossover that did not exist.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface P2pSellerFeeShape {
  ratePct: number;
  fixed: number;
}

export interface P2pPayoutFeeShape {
  ratePctLow: number;
  ratePctHigh: number;
  minFee: number;
  /** null where the provider publishes no ceiling. */
  maxFee: number | null;
}

export interface P2pOption {
  id: string;
  label: string;
  kind: "p2p" | "card";
  seller: P2pSellerFeeShape;
  /** null where there is no balance to move out, which is Zelle. */
  payout: P2pPayoutFeeShape | null;
  buyerDisputeRight: boolean;
  disputeFee: number;
}

export interface P2pMonthlyInput {
  monthlyVolume: number;
  transactions: number;
  /** Whether the merchant takes the balance out instantly rather than waiting for the free transfer. */
  instantPayout: boolean;
  payoutsPerMonth: number;
}

export interface P2pPaymentResult {
  id: string;
  label: string;
  kind: "p2p" | "card";
  amount: number;
  fee: number;
  net: number;
  /** The fee as a percentage of the payment. Above the headline rate whenever there is a fixed fee. */
  effectiveRate: number;
  buyerDisputeRight: boolean;
}

export interface P2pMonthlyResult {
  id: string;
  label: string;
  kind: "p2p" | "card";
  averageTicket: number;
  feePerPayment: number;
  sellerFeeMonthly: number;
  payoutFeeLow: number;
  payoutFeeHigh: number;
  totalLow: number;
  totalHigh: number;
  netLow: number;
  netHigh: number;
  effectiveRateLow: number;
  effectiveRateHigh: number;
  annualTotalHigh: number;
  buyerDisputeRight: boolean;
}

export interface P2pPayoutResult {
  id: string;
  label: string;
  amount: number;
  feeLow: number;
  feeHigh: number;
  netLow: number;
  netHigh: number;
  /** True when the published cap decided the fee rather than the percentage. */
  cappedAtHigh: boolean;
  /** True when the published minimum decided the fee rather than the percentage. */
  flooredAtLow: boolean;
  /** null where the service has no payout step at all. */
  applicable: boolean;
}

// ---------------------------------------------------------------------------
// Cents
// ---------------------------------------------------------------------------

/**
 * Round half UP. `Math.round` rounds half away from zero, so the two agree on
 * the positive amounts this module handles; writing it out states the intent,
 * which is that a half cent goes to the provider, not to the merchant.
 */
export const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(Math.max(0, dollars) * 100);

const toDollars = (cents: number): number => cents / 100;

/** A percentage of a cent amount, rounded to the cent the way a provider rounds it. */
const pctOfCents = (amountC: number, ratePct: number): number => roundHalfUp((amountC * ratePct) / 100);

// ---------------------------------------------------------------------------
// One payment
// ---------------------------------------------------------------------------

/**
 * The seller fee on a single payment, in cents.
 *
 * The fixed component is added AFTER the percentage is rounded, because that is
 * how a per transaction fee is assessed: it is not part of the percentage base.
 */
export function sellerFeeCents(amountC: number, seller: P2pSellerFeeShape): number {
  if (amountC <= 0) return 0;
  return pctOfCents(amountC, seller.ratePct) + toCents(seller.fixed);
}

/** What one payment of `amount` costs on each option, and what lands in the account. */
export function comparePerPayment(options: P2pOption[], amount: number): P2pPaymentResult[] {
  const amountC = toCents(amount);
  return options.map((o) => {
    const feeC = Math.min(sellerFeeCents(amountC, o.seller), amountC);
    return {
      id: o.id,
      label: o.label,
      kind: o.kind,
      amount: toDollars(amountC),
      fee: toDollars(feeC),
      net: toDollars(amountC - feeC),
      effectiveRate: amountC > 0 ? (feeC / amountC) * 100 : 0,
      buyerDisputeRight: o.buyerDisputeRight,
    };
  });
}

// ---------------------------------------------------------------------------
// Payout
// ---------------------------------------------------------------------------

/**
 * One end of a payout fee band, in cents.
 *
 * Percentage, then floor at the published minimum, then cap at the published
 * maximum. Order is load bearing: see the module header.
 */
function payoutEndCents(amountC: number, ratePct: number, minC: number, maxC: number | null): number {
  if (amountC <= 0) return 0;
  let feeC = pctOfCents(amountC, ratePct);
  if (feeC < minC) feeC = minC;
  if (maxC !== null && feeC > maxC) feeC = maxC;
  // A fee can never exceed the money being moved.
  return Math.min(feeC, amountC);
}

export interface PayoutFeeBand {
  low: number;
  high: number;
  cappedAtHigh: boolean;
  flooredAtLow: boolean;
}

/** The fee band to move `amount` out instantly, in dollars. */
export function payoutFee(amount: number, shape: P2pPayoutFeeShape | null): PayoutFeeBand {
  if (!shape) return { low: 0, high: 0, cappedAtHigh: false, flooredAtLow: false };
  const amountC = toCents(amount);
  const minC = toCents(shape.minFee);
  const maxC = shape.maxFee === null ? null : toCents(shape.maxFee);

  const lowC = payoutEndCents(amountC, shape.ratePctLow, minC, maxC);
  const highC = payoutEndCents(amountC, shape.ratePctHigh, minC, maxC);

  return {
    low: toDollars(lowC),
    high: toDollars(highC),
    cappedAtHigh: maxC !== null && pctOfCents(amountC, shape.ratePctHigh) > maxC,
    flooredAtLow: pctOfCents(amountC, shape.ratePctLow) < minC,
  };
}

/** What one instant withdrawal of `amount` costs on each option. */
export function comparePayout(options: P2pOption[], amount: number): P2pPayoutResult[] {
  return options.map((o) => {
    const band = payoutFee(amount, o.payout);
    const amountC = toCents(amount);
    return {
      id: o.id,
      label: o.label,
      amount: toDollars(amountC),
      feeLow: band.low,
      feeHigh: band.high,
      netLow: toDollars(amountC - toCents(band.high)),
      netHigh: toDollars(amountC - toCents(band.low)),
      cappedAtHigh: band.cappedAtHigh,
      flooredAtLow: band.flooredAtLow,
      applicable: o.payout !== null,
    };
  });
}

// ---------------------------------------------------------------------------
// A month of sales
// ---------------------------------------------------------------------------

/**
 * A month of sales priced on every option.
 *
 * The average ticket is the volume divided by the count, rounded to the cent.
 * That is an approximation of a real mix, and it is the only one available when
 * the inputs are a total and a count, but it is an approximation in a knowable
 * direction: because the fixed fee is charged per payment regardless of size,
 * the monthly seller fee depends on the COUNT and barely on the distribution.
 * The percentage component is exact either way.
 *
 * The instant payout fee is charged on what is left after the seller fee,
 * because that is what is actually sitting in the balance. Charging it on gross
 * volume overstates the cost, slightly, on every service.
 */
export function compareMonthly(options: P2pOption[], input: P2pMonthlyInput): P2pMonthlyResult[] {
  const volumeC = toCents(input.monthlyVolume);
  const count = Math.max(0, Math.floor(input.transactions));
  const payouts = Math.max(1, Math.floor(input.payoutsPerMonth));
  const avgTicketC = count > 0 ? roundHalfUp(volumeC / count) : 0;

  return options.map((o) => {
    const perPaymentC = count > 0 ? Math.min(sellerFeeCents(avgTicketC, o.seller), avgTicketC) : 0;
    const sellerC = perPaymentC * count;
    const availableC = Math.max(0, volumeC - sellerC);
    const perPayoutC = roundHalfUp(availableC / payouts);

    const band = input.instantPayout ? payoutFee(toDollars(perPayoutC), o.payout) : { low: 0, high: 0 };
    const payoutLowC = toCents(band.low) * payouts;
    const payoutHighC = toCents(band.high) * payouts;

    const totalLowC = sellerC + payoutLowC;
    const totalHighC = sellerC + payoutHighC;

    return {
      id: o.id,
      label: o.label,
      kind: o.kind,
      averageTicket: toDollars(avgTicketC),
      feePerPayment: toDollars(perPaymentC),
      sellerFeeMonthly: toDollars(sellerC),
      payoutFeeLow: toDollars(payoutLowC),
      payoutFeeHigh: toDollars(payoutHighC),
      totalLow: toDollars(totalLowC),
      totalHigh: toDollars(totalHighC),
      netLow: toDollars(volumeC - totalHighC),
      netHigh: toDollars(volumeC - totalLowC),
      effectiveRateLow: volumeC > 0 ? (totalLowC / volumeC) * 100 : 0,
      effectiveRateHigh: volumeC > 0 ? (totalHighC / volumeC) * 100 : 0,
      annualTotalHigh: toDollars(totalHighC * 12),
      buyerDisputeRight: o.buyerDisputeRight,
    };
  });
}

/**
 * The payment size at which two per payment fee shapes cost the same, in dollars.
 *
 * Solved in closed form rather than searched, because both shapes are affine:
 * a1 + b1 x = a2 + b2 x, so x = (a1 - a2) / (b2 - b1) where a is the fixed fee
 * and b is the rate as a fraction. Returns null when the rates are equal (the
 * lines are parallel, so either one is always cheaper or they never cross) or
 * when the crossover is at or below zero, which means one shape wins from the
 * first cent and there is no threshold to report.
 *
 * This exists because "which is cheaper, Venmo or Cash App" has no answer that
 * is not a function of ticket size, and printing a single winner is how the
 * competing pages get it wrong.
 */
export function feeCrossover(a: P2pSellerFeeShape, b: P2pSellerFeeShape): number | null {
  const rateDiff = (b.ratePct - a.ratePct) / 100;
  if (rateDiff === 0) return null;
  const x = (a.fixed - b.fixed) / rateDiff;
  if (!Number.isFinite(x) || x <= 0) return null;
  return x;
}
