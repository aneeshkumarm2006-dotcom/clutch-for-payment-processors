/**
 * Business loan amortization: the payment, the period by period schedule, and
 * the APR once the lender's fees are taken out of the disbursement.
 *
 * Client safe: no `@/models`, no I/O, no clock. Nothing here reads a rate sheet,
 * so the arithmetic cannot go stale. The two published schedules that DO expire,
 * the SBA guaranty fee tiers and the SBA maximum variable spreads, are kept in
 * named constants at the bottom of this file with the notice number and the date
 * they were read beside them.
 *
 * ─── Why this module exists separately from the widget ──────────────────────
 *
 * Every failure mode below is silent. Not one of them throws, and every one of
 * them returns a number that looks like a loan payment.
 *
 *   1. THE FINAL PAYMENT. A schedule that pays the same rounded amount every
 *      period does not land on zero. The interest each month is rounded to the
 *      cent independently, so the residue accumulates and the last balance is a
 *      few cents either side of nothing. A real lender fixes this by adjusting
 *      the FINAL payment, and so does this module: the last row pays whatever
 *      balance is left plus that period's interest, and the balance is then
 *      exactly zero rather than approximately zero. Most calculators on this
 *      query print a closing balance of -0.03 or 0.07 and hope nobody looks.
 *   2. THE APR BRANCH. The APR solve is a bisection on the present value of the
 *      payment stream. NPV is DECREASING in the rate, because a higher discount
 *      rate shrinks the payments while the cash advanced is fixed. So when
 *      NPV(mid) is positive the root lies ABOVE mid. Invert that one comparison
 *      and the solver converges on the top of the bracket and reports an APR in
 *      the hundreds of percent on an ordinary bank note. See the same note on
 *      `solveDailyRate` in `lib/tools-math.ts`, which had the identical trap.
 *   3. NEGATIVE AMORTIZATION. If the payment does not cover the period's
 *      interest, the balance grows and the loop never terminates. That is a
 *      browser tab that stops responding, not a wrong number, so the loop is
 *      bounded and the degenerate case is returned with a flag rather than
 *      guessed at.
 *   4. ANNUALIZING THE MONTHLY RATE. Appendix J to 12 CFR Part 1026 is explicit:
 *      "The annual percentage rate shall be the nominal annual percentage rate
 *      determined by multiplying the unit-period rate by the number of
 *      unit-periods in a year." Multiplied, not compounded. Compounding the same
 *      monthly rate produces a materially larger figure that no US disclosure
 *      means. That distinction is what `/tools/apr-vs-apy-calculator` is for.
 *
 * ─── Integer cents ──────────────────────────────────────────────────────────
 *
 * Anyone using this page is holding a term sheet or a loan statement, and binary
 * floating point produces one cent errors at exactly the moment somebody is
 * checking a schedule line by line. Balances, payments, interest and principal
 * are integers in cents from the first line to the last, and are divided by 100
 * only on the way out. The rate itself stays a float, which is correct: a rate
 * is not money.
 *
 * ─── What "APR" means here ──────────────────────────────────────────────────
 *
 * The actuarial method of Appendix J to 12 CFR Part 1026, applied to a business
 * loan that Regulation Z does not itself cover (1026.3(a) exempts business
 * purpose credit). The amount financed follows 1026.18(b): the principal loan
 * amount, plus any other amounts financed, MINUS any prepaid finance charge. An
 * origination fee, a packaging fee and an SBA guaranty fee deducted at closing
 * are prepaid finance charges, so they come off the cash the borrower receives
 * and never off the balance the borrower repays. That single asymmetry is why
 * the APR is always above the note rate whenever a fee is netted out, and it is
 * the thing this page exists to show.
 */

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/** Round half UP, which is the direction a lender's system rounds a cent. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(safe(dollars) * 100);

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

const atLeastZero = (n: number): number => Math.max(0, safe(n));

/** Bound the schedule so a pathological input cannot hang the tab. 100 years. */
const MAX_PERIODS = 1200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Fees deducted from the disbursement rather than added to the balance.
 *
 * Three fields rather than one total, because they are quoted three different
 * ways and a borrower comparing two term sheets needs to see which is which. A
 * percentage origination fee scales with the loan, a packaging or documentation
 * fee does not, and the SBA guaranty fee is computed off the guaranteed portion
 * rather than off the loan, which is the detail nearly every SBA calculator on
 * the web gets wrong.
 */
export interface LoanFees {
  /** Origination or underwriting fee, as a percent of the face amount. */
  originationPct: number;
  /** Packaging, documentation, closing and filing fees, in dollars. */
  flatFees: number;
  /** SBA upfront guaranty fee in dollars. Zero on a conventional note. */
  guarantyFee: number;
}

export interface LoanInput {
  /** Face amount of the note. This is what the borrower signs for and repays. */
  principal: number;
  /** Note rate: nominal annual, accruing monthly. */
  annualRatePct: number;
  /** The months used to SIZE the payment. */
  amortizationMonths: number;
  /**
   * The months until the note matures.
   *
   * Equal to `amortizationMonths` on a fully amortizing loan. Set it SHORTER to
   * model a balloon: the payment is sized on the longer schedule, the note comes
   * due earlier, and whatever balance is left falls due in one lump.
   */
  termMonths: number;
  /** Extra principal paid alongside every scheduled payment. */
  extraPayment: number;
  fees: LoanFees;
}

export interface AmortizationRow {
  period: number;
  payment: number;
  interest: number;
  /** Principal retired by the scheduled payment, excluding the extra. */
  principal: number;
  extra: number;
  balance: number;
}

export interface YearRow {
  year: number;
  /** Number of scheduled payments falling in this year. Twelve, except the last. */
  payments: number;
  totalPaid: number;
  interest: number;
  principal: number;
  endingBalance: number;
}

export interface LoanSchedule {
  /** The regular payment, rounded to the cent the way a note states it. */
  scheduledPayment: number;
  /** The last payment, adjusted so the balance lands exactly on zero. */
  finalPayment: number;
  rows: AmortizationRow[];
  yearly: YearRow[];
  /** Payments actually made. Below the term when extra principal is paid. */
  payments: number;
  totalInterest: number;
  totalPaid: number;
  /**
   * Balance falling due in one lump at maturity on a balloon note, before that
   * final payment is applied. Zero on a fully amortizing loan.
   */
  balloonDue: number;
  fees: { origination: number; flat: number; guaranty: number; total: number };
  /** Face amount less every prepaid finance charge. What lands in the account. */
  amountFinanced: number;
  /** Interest plus fees. The whole price of the money. */
  totalCostOfCapital: number;
  noteRatePct: number;
  /** Actuarial APR on the cash actually advanced. Above the note rate if fees were netted out. */
  aprPct: number;
  /**
   * True when the payment does not cover a period's interest, so the balance
   * grows instead of shrinking. Every other figure is meaningless when it is set.
   */
  neverAmortizes: boolean;
}

// ---------------------------------------------------------------------------
// The payment
// ---------------------------------------------------------------------------

/**
 * The level payment that retires `principal` over `months` at monthly rate `i`.
 *
 *   P = L x i / (1 - (1 + i)^-n)
 *
 * L is the face amount, i is the nominal annual rate divided by twelve, n is the
 * number of monthly payments. The zero rate branch is not a rounding nicety: at
 * i = 0 the formula is 0/0, and JavaScript returns NaN rather than throwing, so
 * an interest free note would silently produce a blank schedule.
 *
 * Rounded to the cent, half up, because that is the figure a note states and the
 * figure every subsequent line of the schedule is computed from. Rounding at the
 * end instead would produce a schedule whose rows do not sum to its own total.
 */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  const L = atLeastZero(principal);
  const n = Math.floor(atLeastZero(months));
  if (n <= 0 || L <= 0) return 0;

  const i = safe(annualRatePct) / 100 / 12;
  if (i <= 0) return roundHalfUp((L * 100) / n) / 100;

  const exact = (L * i) / (1 - Math.pow(1 + i, -n));
  return roundHalfUp(exact * 100) / 100;
}

// ---------------------------------------------------------------------------
// The APR solve
// ---------------------------------------------------------------------------

/**
 * The monthly rate that makes the cash advanced equal the present value of the
 * payments, solved by bisection. This is the actuarial method of Appendix J to
 * 12 CFR Part 1026 applied to an irregular final payment.
 *
 * `payments` is the ACTUAL payment vector from the schedule, not a level annuity
 * repeated n times. It has to be: the final payment differs, a balloon payment
 * differs enormously, and an extra principal payment shortens the vector. Using
 * a closed form annuity here would quietly ignore all three.
 *
 * BRANCH DIRECTION, which is the whole reason this is a documented function.
 * NPV(r) = sum of payment_k / (1+r)^k, minus the advance. Raising r shrinks every
 * discounted payment while the advance stays fixed, so NPV is strictly
 * decreasing. A positive NPV at the midpoint therefore means the root is ABOVE
 * the midpoint, so the LOW end moves up. Reverse that one line and the solver
 * still converges, still returns a finite number, and reports roughly 1,200
 * percent on an ordinary bank note.
 *
 * Bracketed at 100 percent per month, which is 1,200 percent a year nominal.
 * Nothing that calls itself a business loan reaches it, and a bracket rather
 * than an unbounded search means the function always terminates.
 */
export function solveMonthlyRate(advanceCents: number, paymentsCents: number[]): number {
  if (advanceCents <= 0 || paymentsCents.length === 0) return 0;

  const total = paymentsCents.reduce((a, b) => a + b, 0);
  // No finance charge at all: an interest free, fee free note. The rate is zero,
  // and bisecting for it would return the bottom of the bracket anyway.
  if (total <= advanceCents) return 0;

  const npv = (r: number): number => {
    let pv = 0;
    let k = 1;
    for (const c of paymentsCents) {
      pv += c / Math.pow(1 + r, k);
      k += 1;
    }
    return pv - advanceCents;
  };

  let lo = 0;
  let hi = 1;
  // 200 halvings of a unit bracket is far past double precision. It costs
  // nothing here and removes any question about convergence tolerance.
  for (let n = 0; n < 200; n += 1) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// The schedule
// ---------------------------------------------------------------------------

/**
 * Build the full period by period schedule, then price it.
 *
 * The loop is deliberately not a closed form. A closed form cannot express the
 * three things that make this a BUSINESS loan calculator rather than a mortgage
 * clone: an adjusted final payment, an extra principal payment that moves the
 * payoff date, and a balloon that stops the schedule early. Each period rounds
 * its own interest to the cent, exactly as a servicer does, so the printed rows
 * add up to the printed totals.
 */
export function buildSchedule(input: LoanInput): LoanSchedule {
  const principalC = toCents(atLeastZero(input.principal));
  const noteRate = atLeastZero(input.annualRatePct);
  const i = noteRate / 100 / 12;
  const amortMonths = Math.floor(atLeastZero(input.amortizationMonths));
  // A term longer than the amortization is not a balloon, it is a typo. Clamp it.
  const termMonths = Math.min(Math.floor(atLeastZero(input.termMonths)) || amortMonths, amortMonths);
  const extraC = toCents(atLeastZero(input.extraPayment));

  const originationFeeC = roundHalfUp((principalC * atLeastZero(input.fees.originationPct)) / 100);
  const flatFeeC = toCents(atLeastZero(input.fees.flatFees));
  const guarantyFeeC = toCents(atLeastZero(input.fees.guarantyFee));
  const totalFeeC = originationFeeC + flatFeeC + guarantyFeeC;
  const amountFinancedC = principalC - totalFeeC;

  const fees = {
    origination: originationFeeC / 100,
    flat: flatFeeC / 100,
    guaranty: guarantyFeeC / 100,
    total: totalFeeC / 100,
  };

  const empty: LoanSchedule = {
    scheduledPayment: 0,
    finalPayment: 0,
    rows: [],
    yearly: [],
    payments: 0,
    totalInterest: 0,
    totalPaid: 0,
    balloonDue: 0,
    fees,
    amountFinanced: amountFinancedC / 100,
    totalCostOfCapital: 0,
    noteRatePct: noteRate,
    aprPct: 0,
    neverAmortizes: false,
  };
  if (principalC <= 0 || amortMonths <= 0) return empty;

  const paymentC = toCents(monthlyPayment(principalC / 100, noteRate, amortMonths));
  if (paymentC <= 0) return empty;

  // Negative amortization check, done before the loop rather than inside it. At
  // period one the interest is at its largest, so if the payment clears it there
  // it clears it everywhere.
  const firstInterestC = roundHalfUp(principalC * i);
  if (paymentC + extraC <= firstInterestC) {
    return { ...empty, scheduledPayment: paymentC / 100, neverAmortizes: true };
  }

  const rows: AmortizationRow[] = [];
  const paymentsC: number[] = [];
  let balanceC = principalC;
  let totalInterestC = 0;
  let totalPaidC = 0;
  let balloonDueC = 0;
  let finalPaymentC = paymentC;

  for (let period = 1; period <= MAX_PERIODS && balanceC > 0; period += 1) {
    const interestC = roundHalfUp(balanceC * i);
    const maturityReached = period >= termMonths;

    let thisPaymentC: number;
    let principalPartC: number;
    let extraPartC: number;

    if (maturityReached) {
      // A balloon note: the balance falls due here in one lump. What the regular
      // payment would NOT have retired is the balloon, reported separately so the
      // page can say the figure out loud rather than burying it in a table cell.
      balloonDueC = Math.max(0, balanceC - (paymentC - interestC));
      thisPaymentC = balanceC + interestC;
      principalPartC = balanceC;
      extraPartC = 0;
      balanceC = 0;
    } else if (paymentC - interestC + extraC >= balanceC) {
      // The last regular payment. Pay the remaining balance plus this period's
      // interest, so the closing balance is EXACTLY zero rather than a few cents
      // of accumulated rounding residue. This is the line most calculators skip.
      thisPaymentC = balanceC + interestC;
      principalPartC = Math.min(balanceC, paymentC - interestC);
      extraPartC = balanceC - principalPartC;
      balanceC = 0;
    } else {
      thisPaymentC = paymentC + extraC;
      principalPartC = paymentC - interestC;
      extraPartC = extraC;
      balanceC -= principalPartC + extraPartC;
    }

    totalInterestC += interestC;
    totalPaidC += thisPaymentC;
    paymentsC.push(thisPaymentC);
    finalPaymentC = thisPaymentC;

    rows.push({
      period,
      payment: thisPaymentC / 100,
      interest: interestC / 100,
      principal: principalPartC / 100,
      extra: extraPartC / 100,
      balance: balanceC / 100,
    });
  }

  const yearly: YearRow[] = [];
  for (let start = 0; start < rows.length; start += 12) {
    const chunk = rows.slice(start, start + 12);
    yearly.push({
      year: start / 12 + 1,
      payments: chunk.length,
      totalPaid: chunk.reduce((a, r) => a + r.payment, 0),
      interest: chunk.reduce((a, r) => a + r.interest, 0),
      principal: chunk.reduce((a, r) => a + r.principal + r.extra, 0),
      endingBalance: chunk[chunk.length - 1]?.balance ?? 0,
    });
  }

  const monthlyRate = solveMonthlyRate(amountFinancedC, paymentsC);

  return {
    scheduledPayment: paymentC / 100,
    finalPayment: finalPaymentC / 100,
    rows,
    yearly,
    payments: rows.length,
    totalInterest: totalInterestC / 100,
    totalPaid: totalPaidC / 100,
    balloonDue: balloonDueC / 100,
    fees,
    amountFinanced: amountFinancedC / 100,
    totalCostOfCapital: (totalInterestC + totalFeeC) / 100,
    noteRatePct: noteRate,
    // Nominal annual, per Appendix J: the unit period rate multiplied by the
    // number of unit periods in a year. Never compounded.
    aprPct: monthlyRate * 12 * 100,
    neverAmortizes: false,
  };
}

// ---------------------------------------------------------------------------
// Extra payments
// ---------------------------------------------------------------------------

export interface ExtraPaymentEffect {
  baselinePayments: number;
  baselineInterest: number;
  acceleratedPayments: number;
  acceleratedInterest: number;
  interestSaved: number;
  monthsSaved: number;
  /** Total extra principal actually paid, which is what bought the saving. */
  extraPaid: number;
}

/**
 * What an extra principal payment is worth, computed as the DIFFERENCE between
 * two full schedules rather than from a formula.
 *
 * There is a closed form for the shortened term, and it is wrong by a month
 * either side once the final payment adjustment and per period cent rounding are
 * in play. Running the same loop twice costs nothing at these sizes and
 * guarantees the saving quoted on the page is the difference between two
 * schedules the same page can print.
 */
export function extraPaymentEffect(input: LoanInput): ExtraPaymentEffect {
  const baseline = buildSchedule({ ...input, extraPayment: 0 });
  const accelerated = buildSchedule(input);

  const extraPaid = accelerated.rows.reduce((a, r) => a + r.extra, 0);

  return {
    baselinePayments: baseline.payments,
    baselineInterest: baseline.totalInterest,
    acceleratedPayments: accelerated.payments,
    acceleratedInterest: accelerated.totalInterest,
    interestSaved: baseline.totalInterest - accelerated.totalInterest,
    monthsSaved: baseline.payments - accelerated.payments,
    extraPaid,
  };
}

// ---------------------------------------------------------------------------
// The merchant cash advance a borrower is usually choosing between
// ---------------------------------------------------------------------------

/**
 * The factor rate an advance would have to carry to cost the same dollars.
 *
 * factor = total repaid / cash received. That is the definition of a factor
 * rate, so this is a translation and not a model.
 *
 * IT IS NOT AN EQUIVALENT PRICE, and the page has to say so. A factor rate
 * contains no time. An advance repaid out of daily card settlement in seven
 * months at the same total dollars as a ten year note is a far more expensive
 * product, because the money was borrowed for a fourteenth of the time. The
 * factor answers "how many dollars", the APR answers "how expensive", and
 * `/tools/merchant-cash-advance-calculator` does the second.
 */
export function equivalentFactorRate(amountFinanced: number, totalRepaid: number): number {
  const cash = atLeastZero(amountFinanced);
  if (cash <= 0) return 0;
  return atLeastZero(totalRepaid) / cash;
}

// ---------------------------------------------------------------------------
// SBA 7(a): the guaranty fee, and the rate ceiling
// ---------------------------------------------------------------------------

/**
 * The FY 2026 SBA upfront guaranty fee schedule.
 *
 * Read from SBA Information Notice 5000-872051, "7(a) Fees Effective October 1,
 * 2025 for Fiscal Year 2026 and 90-Day Rule Clarification", effective 28 August
 * 2025, checked 5 September 2026. It applies to 7(a) loans approved from
 * 1 October 2025 through 30 September 2026 and the notice expires 1 October
 * 2026, so this table has a clock on it. Re-read the successor notice before
 * FY 2027 and do not move the checked date without re-reading the source.
 *
 * THE TRAP, and it is the single most common error on this query: every one of
 * these percentages applies to the GUARANTEED PORTION of the loan, not to the
 * loan. SBA guarantees 85 percent of a loan of $150,000 or less and 75 percent
 * above that, so a 3 percent fee on a $500,000 loan is 3 percent of $375,000,
 * which is $11,250 and not $15,000. Calculators that apply the rate to the face
 * amount overstate the fee by a third.
 */
export const SBA_FEE_SCHEDULE = {
  notice: "SBA Information Notice 5000-872051, 7(a) Fees Effective October 1, 2025 for Fiscal Year 2026, effective 28 August 2025",
  checked: "2026-09-05",
  /** Guaranty percentage of the gross loan amount. */
  guarantyPct: { atOrBelow150k: 85, above150k: 75 },
  /** Upfront fee on a maturity of 12 months or less, of the guaranteed portion. */
  shortTermPct: 0.25,
  /**
   * Upfront fee tiers on a maturity exceeding 12 months, of the guaranteed
   * portion. Named properties rather than an array so `sbaGuarantyFee` reads
   * them directly: there is exactly one source of truth for each percentage and
   * each label, and no indexed lookup that could quietly miss.
   */
  tiers: {
    small: { maxGross: 150_000, pct: 2, label: "Loans of $150,000 or less" },
    mid: { maxGross: 700_000, pct: 3, label: "Loans of $150,001 to $700,000" },
    large: { maxGross: 5_000_000, pct: 3.5, label: "Loans of $700,001 to $5,000,000" },
  },
  /** Applied to the slice of the GUARANTEED portion above one million dollars. */
  aboveOneMillionPct: 3.75,
  /** Lenders may not pass this on to the borrower, so it is not in the APR. */
  lenderAnnualServiceFeePct: 0.55,
} as const;

/**
 * SBA maximum allowable spreads over the base rate on a variable rate 7(a) loan.
 *
 * Read from sba.gov, "Terms, conditions, and eligibility", 5 September 2026.
 * These are ceilings, not prices: a lender may charge less and usually does.
 * They are on the page because a borrower cannot tell whether a quote is
 * aggressive or abusive without knowing where the ceiling sits.
 */
const SBA_TOP_SPREAD = { upTo: Number.POSITIVE_INFINITY, spreadPct: 3.0 } as const;

export const SBA_MAX_VARIABLE_SPREADS = [
  { upTo: 50_000, spreadPct: 6.5 },
  { upTo: 250_000, spreadPct: 6.0 },
  { upTo: 350_000, spreadPct: 4.5 },
  SBA_TOP_SPREAD,
] as const;

export interface SbaGuarantyFee {
  guarantyPct: number;
  guaranteedPortion: number;
  feePct: number;
  fee: number;
  tier: string;
  /** True when the loan exceeds the $5,000,000 7(a) program maximum. */
  overProgramMax: boolean;
}

/**
 * The SBA upfront guaranty fee on a 7(a) loan.
 *
 * Two steps, in this order, and reversing them is the error described on
 * `SBA_FEE_SCHEDULE`: work out the guaranteed portion from the GROSS loan
 * amount, then apply the fee percentage to that portion. The top tier is
 * piecewise on the guaranteed portion itself, 3.5 percent up to and including
 * one million dollars plus 3.75 percent above it, so a large loan is two
 * multiplications rather than one.
 */
export function sbaGuarantyFee(grossAmount: number, termMonths: number): SbaGuarantyFee {
  const gross = atLeastZero(grossAmount);
  const months = atLeastZero(termMonths);

  const guarantyPct =
    gross <= 150_000 ? SBA_FEE_SCHEDULE.guarantyPct.atOrBelow150k : SBA_FEE_SCHEDULE.guarantyPct.above150k;
  const guaranteedPortion = (gross * guarantyPct) / 100;

  if (gross <= 0) {
    return { guarantyPct, guaranteedPortion: 0, feePct: 0, fee: 0, tier: "No loan amount entered", overProgramMax: false };
  }

  const overProgramMax = gross > 5_000_000;

  if (months > 0 && months <= 12) {
    const fee = (guaranteedPortion * SBA_FEE_SCHEDULE.shortTermPct) / 100;
    return {
      guarantyPct,
      guaranteedPortion,
      feePct: SBA_FEE_SCHEDULE.shortTermPct,
      fee: roundHalfUp(fee * 100) / 100,
      tier: "Maturity of 12 months or less",
      overProgramMax,
    };
  }

  const { small, mid, large } = SBA_FEE_SCHEDULE.tiers;

  if (gross <= small.maxGross) {
    const fee = (guaranteedPortion * small.pct) / 100;
    return {
      guarantyPct,
      guaranteedPortion,
      feePct: small.pct,
      fee: roundHalfUp(fee * 100) / 100,
      tier: small.label,
      overProgramMax,
    };
  }

  if (gross <= mid.maxGross) {
    const fee = (guaranteedPortion * mid.pct) / 100;
    return {
      guarantyPct,
      guaranteedPortion,
      feePct: mid.pct,
      fee: roundHalfUp(fee * 100) / 100,
      tier: mid.label,
      overProgramMax,
    };
  }

  // The top tier is piecewise on the GUARANTEED portion, not on the loan: 3.5
  // percent up to and including one million dollars of guaranteed portion, plus
  // 3.75 percent on the slice above it. Two multiplications, not one.
  const lowerSlice = Math.min(guaranteedPortion, 1_000_000);
  const upperSlice = Math.max(0, guaranteedPortion - 1_000_000);
  const fee = (lowerSlice * large.pct) / 100 + (upperSlice * SBA_FEE_SCHEDULE.aboveOneMillionPct) / 100;

  return {
    guarantyPct,
    guaranteedPortion,
    // A blended percentage, because the top tier does not have a single rate.
    feePct: guaranteedPortion > 0 ? (fee / guaranteedPortion) * 100 : 0,
    fee: roundHalfUp(fee * 100) / 100,
    tier: large.label,
    overProgramMax,
  };
}

/** The SBA ceiling on a variable rate 7(a) loan of this size, at this base rate. */
export function sbaMaxVariableRate(grossAmount: number, basePct: number): { spreadPct: number; maxRatePct: number } {
  const gross = atLeastZero(grossAmount);
  // The last band's ceiling is Infinity so `find` always succeeds. The fallback
  // is named rather than looked up by index, so the top band cannot go missing.
  const band = SBA_MAX_VARIABLE_SPREADS.find((b) => gross <= b.upTo) ?? SBA_TOP_SPREAD;
  return { spreadPct: band.spreadPct, maxRatePct: atLeastZero(basePct) + band.spreadPct };
}

// ---------------------------------------------------------------------------
// Widget defaults
// ---------------------------------------------------------------------------

/**
 * The widget's default state, kept here rather than as literals in the component
 * so the page copy, the worked example and the tests all read the same numbers
 * from one place. A default that drifts from the worked example above it is the
 * defect this site has already shipped once.
 *
 * The prime rate is the Federal Reserve H.15 bank prime loan rate, 6.75 percent,
 * from the release dated 4 September 2026. It moves with the FOMC, so it carries
 * its own date and is the first thing to re-check.
 */
export const LOAN_AMORTIZATION_DEFAULTS = {
  principal: 250_000,
  annualRatePct: 9.25,
  termMonths: 120,
  amortizationMonths: 120,
  originationPct: 2,
  flatFees: 1_500,
  extraPayment: 250,
  balloonTermMonths: 60,
  /** SBA mode. */
  sbaPrincipal: 250_000,
  sbaTermMonths: 120,
  sbaSpreadPct: 2.75,
  primeRatePct: 6.75,
  primeSource: "Federal Reserve H.15, bank prime loan rate, release dated 4 September 2026",
} as const;
