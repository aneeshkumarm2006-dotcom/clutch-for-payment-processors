/**
 * The total cost of acceptance model behind
 * `/tools/high-risk-merchant-account-cost-calculator`.
 *
 * Client-safe: no `@/models`, no `server-only`, no I/O, no `Date.now()`. Given
 * the same inputs it returns the same numbers on the server and in the browser,
 * which is what lets the widget render a real result into the initial HTML.
 *
 * --- WHY THIS IS ITS OWN MODULE AND ITS OWN TEST ----------------------------
 * Every failure mode below is SILENT: each one returns a confident, plausible
 * dollar figure when it is wrong.
 *
 *   1. THE RESERVE IS NOT A FEE AND IT IS NOT FORGONE INTEREST. A rolling
 *      reserve returns every dollar it takes, so adding the withheld amount to
 *      the cost overstates the answer by an order of magnitude. Subtracting the
 *      interest the cash would have earned in a deposit account UNDERSTATES it
 *      by an order of magnitude, which is the mistake this site has already
 *      written down once: on $90,000 that is roughly $270 a year at a national
 *      money market average against $6,075 a year at the bank prime loan rate.
 *      The reserve is modeled here as a WORKING CAPITAL hole carried at a
 *      borrowing rate the user supplies, and the steady state locked balance is
 *      monthly volume x reserve percentage x hold months, which is the same
 *      arithmetic `reserveTimeline` in `lib/tools-math.ts` produces. Do not
 *      change one without changing the other.
 *
 *   2. ANNUAL LINES MUST NOT BE DIVIDED INTO MONTHS AND MULTIPLIED BACK. An
 *      annual registration fee of $1,950 divided by twelve is $162.50, and
 *      $162.50 rounded to the cent times twelve is $1,950.00, but a $500 setup
 *      fee divided by twelve is $41.666..., which rounds to $41.67 and comes
 *      back as $500.04. Four cents is nothing and it is also exactly the kind of
 *      discrepancy that makes a merchant stop trusting a page. Annual lines are
 *      therefore computed ANNUALLY and added once.
 *
 *   3. THE PREMIUM HAS TO HOLD THE BUSINESS CONSTANT. The comparison against a
 *      standard account keeps the same volume, the same ticket, the same
 *      transaction count and the same number of chargebacks, and changes only
 *      the terms. Letting the chargeback count differ between the two sides
 *      turns "what does my risk classification cost" into "what would a
 *      different business pay", which is a question nobody asked.
 *
 *   4. MONEY A MERCHANT WILL CHECK AGAINST A STATEMENT IS COMPUTED IN INTEGER
 *      CENTS. The discount rate, the per transaction fees, the fixed fees and
 *      the network specialty fees are all statement lines, so binary floating
 *      point is not allowed anywhere near them. The chargeback and alert lines
 *      are an exception and are deliberately carried as fractional cents: a
 *      chargeback count derived from a percentage is an expectation, not an
 *      integer on a statement, and rounding it would imply a precision the input
 *      does not have.
 *
 * Every expected value in
 * `tests/tools/batch-four/high-risk-merchant-account-cost-calculator.test.ts`
 * is derived by hand or from a closed form worked separately from this file.
 */

// ---------------------------------------------------------------------------
// Cents
// ---------------------------------------------------------------------------

/**
 * Round half UP, which is what a processor does. Duplicated from
 * `lib/tools-math.ts` on purpose: importing that module would drag the payout
 * and MCA reference data into the chunk every `/tools/*` page loads, for one
 * line of arithmetic.
 */
export const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const cents = (dollars: number): number => roundHalfUp(Math.max(0, dollars) * 100);
const toDollars = (c: number): number => c / 100;
const nonNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * The terms of one merchant account.
 *
 * Both sides of the comparison are described by this same struct, so the
 * standard account is not a second code path that can drift from the first. The
 * only thing that differs between a high risk account and a standard one is the
 * numbers in here.
 */
export interface AccountTerms {
  /** Discount rate, percent of settled volume. */
  ratePct: number;
  /** Acquirer per transaction fee, dollars. */
  perTransaction: number;
  /** Gateway per transaction fee, dollars. Zero on a bundled aggregator. */
  gatewayPerTransaction: number;
  /** Account, statement, PCI and gateway monthly fees, dollars, PER merchant account. */
  monthlyFixed: number;
  /** How many merchant accounts are being run. Every fixed and annual line bills per account. */
  midCount: number;
  /** One time setup or application fee, dollars, PER merchant account. */
  setupFee: number;
  /** How many months the one time setup cost is spread over for this model. */
  setupAmortizeMonths: number;
  /** Card brand registration fees, dollars a year, PER merchant account. */
  annualRegistrationFees: number;
  /** Network specialty program volume fee, basis points. */
  specialtyVolumeBps: number;
  /** Network specialty program transaction fee, dollars. */
  specialtyPerTransaction: number;
  /** Share of volume the specialty fees are billed on, percent. 100 prices the worst case. */
  specialtySharePct: number;
  /** Dollars per dispute received, win or lose. */
  chargebackFee: number;
  /** Chargeback prevention alerts purchased in a month. */
  alertsPerMonth: number;
  /** Dollars per alert. */
  alertCost: number;
  /** Monthly platform fee for a chargeback mitigation service, dollars. */
  monitoringMonthlyFee: number;
  /** Rolling reserve, percent of settled volume withheld. */
  reservePct: number;
  /** How many months each batch is held before release. */
  reserveHoldMonths: number;
  /** What the merchant pays to borrow, percent a year. NOT a deposit rate. */
  borrowingRatePct: number;
}

/** The business itself, held constant across both sides of the comparison. */
export interface BusinessProfile {
  monthlyVolume: number;
  averageTicket: number;
  /** Disputes as a percent of transaction count. */
  chargebackRatePct: number;
}

// ---------------------------------------------------------------------------
// One account
// ---------------------------------------------------------------------------

export interface MonthlyCostLines {
  discount: number;
  perTransaction: number;
  gatewayPerTransaction: number;
  fixedFees: number;
  networkSpecialty: number;
  chargebackFees: number;
  alerts: number;
  monitoring: number;
  total: number;
}

export interface AccountCostResult {
  /** Rounded to a whole transaction: you cannot run four tenths of a sale. */
  transactionsPerMonth: number;
  /** Fractional on purpose. A count derived from a percentage is an expectation. */
  chargebacksPerMonth: number;
  monthly: MonthlyCostLines;
  /** Annual lines are computed annually, never as a rounded month times twelve. */
  annualRegistrations: number;
  annualSetupCharge: number;
  /** Cash fees only. Excludes the reserve, which is not a fee. */
  annualCashFees: number;
  reserveWithheldPerMonth: number;
  /** monthly volume x reserve pct x hold months. The permanent hole. */
  reserveSteadyStateLocked: number;
  reserveAnnualCarryCost: number;
  /** annualCashFees + reserveAnnualCarryCost. */
  totalAnnualCost: number;
  annualVolume: number;
  /** Total annual cost as a percent of annual volume, reserve carry included. */
  effectiveRatePct: number;
  /** The same figure with the reserve carry taken out, so the two are separable. */
  cashEffectiveRatePct: number;
  costPerTransaction: number;
}

/**
 * The cost of accepting a year of card volume on one set of terms.
 *
 * Ordering matters in two places and nowhere else. First, the transaction count
 * is rounded to a whole number BEFORE any per transaction fee is applied, so
 * every per transaction line is an exact number of cents rather than a fraction
 * of one. Second, the annual lines are added after the twelve month total rather
 * than folded into a monthly figure, for the rounding reason in the header.
 */
export function accountCost(business: BusinessProfile, terms: AccountTerms): AccountCostResult {
  const volume = nonNeg(business.monthlyVolume);
  const ticket = nonNeg(business.averageTicket);
  const volumeC = cents(volume);
  const mids = Math.max(1, Math.round(nonNeg(terms.midCount)));

  const transactions = ticket > 0 ? Math.round(volume / ticket) : 0;
  const chargebacks = transactions * (nonNeg(business.chargebackRatePct) / 100);

  // Statement lines, in exact cents.
  const discountC = roundHalfUp((volumeC * nonNeg(terms.ratePct)) / 100);
  const perTxnC = transactions * cents(terms.perTransaction);
  const gatewayTxnC = transactions * cents(terms.gatewayPerTransaction);
  const fixedC = cents(terms.monthlyFixed) * mids;

  const share = Math.min(100, nonNeg(terms.specialtySharePct)) / 100;
  const specialtyVolumeC = roundHalfUp((volumeC * share * nonNeg(terms.specialtyVolumeBps)) / 10000);
  const specialtyTxnC = roundHalfUp(transactions * share * cents(terms.specialtyPerTransaction));
  const specialtyC = specialtyVolumeC + specialtyTxnC;

  // Expectation lines, carried as fractional cents. See header note 4.
  const chargebackC = chargebacks * cents(terms.chargebackFee);
  const alertsC = nonNeg(terms.alertsPerMonth) * cents(terms.alertCost);
  const monitoringC = cents(terms.monitoringMonthlyFee);

  const monthlyTotalC =
    discountC + perTxnC + gatewayTxnC + fixedC + specialtyC + chargebackC + alertsC + monitoringC;

  const annualRegistrationsC = cents(terms.annualRegistrationFees) * mids;
  // A one time cost spread over N months costs 12/N of it in a year. At the
  // default N of 12 that is the fee itself, which is the honest first year view.
  const amortMonths = Math.max(1, nonNeg(terms.setupAmortizeMonths));
  const annualSetupC = (cents(terms.setupFee) * mids * 12) / amortMonths;

  const annualCashFeesC = monthlyTotalC * 12 + annualRegistrationsC + annualSetupC;

  const withheldC = roundHalfUp((volumeC * nonNeg(terms.reservePct)) / 100);
  const lockedC = withheldC * Math.max(0, Math.round(nonNeg(terms.reserveHoldMonths)));
  const carryC = (lockedC * nonNeg(terms.borrowingRatePct)) / 100;

  const totalC = annualCashFeesC + carryC;
  const annualVolume = volume * 12;

  return {
    transactionsPerMonth: transactions,
    chargebacksPerMonth: chargebacks,
    monthly: {
      discount: toDollars(discountC),
      perTransaction: toDollars(perTxnC),
      gatewayPerTransaction: toDollars(gatewayTxnC),
      fixedFees: toDollars(fixedC),
      networkSpecialty: toDollars(specialtyC),
      chargebackFees: toDollars(chargebackC),
      alerts: toDollars(alertsC),
      monitoring: toDollars(monitoringC),
      total: toDollars(monthlyTotalC),
    },
    annualRegistrations: toDollars(annualRegistrationsC),
    annualSetupCharge: toDollars(annualSetupC),
    annualCashFees: toDollars(annualCashFeesC),
    reserveWithheldPerMonth: toDollars(withheldC),
    reserveSteadyStateLocked: toDollars(lockedC),
    reserveAnnualCarryCost: toDollars(carryC),
    totalAnnualCost: toDollars(totalC),
    annualVolume,
    effectiveRatePct: annualVolume > 0 ? (toDollars(totalC) / annualVolume) * 100 : 0,
    cashEffectiveRatePct: annualVolume > 0 ? (toDollars(annualCashFeesC) / annualVolume) * 100 : 0,
    costPerTransaction: transactions > 0 ? toDollars(totalC) / (transactions * 12) : 0,
  };
}

// ---------------------------------------------------------------------------
// The comparison
// ---------------------------------------------------------------------------

export interface HighRiskCostInput extends BusinessProfile {
  /** Where the merchant wants the dispute rate to get to, percent of transactions. */
  targetChargebackRatePct: number;
  highRisk: AccountTerms;
  standard: AccountTerms;
}

export interface DisputeReductionResult {
  targetRatePct: number;
  chargebacksAvoidedPerYear: number;
  /** Chargeback fees plus alert fees saved. Nothing else: the rate does not move on its own. */
  annualFeeSaving: number;
  /** How much of the classification premium that saving actually closes. */
  shareOfPremiumPct: number;
}

export interface HighRiskComparison {
  highRisk: AccountCostResult;
  standard: AccountCostResult;
  /** The number the page exists to produce: what the classification costs a year. */
  annualPremium: number;
  monthlyPremium: number;
  /** The same premium expressed as basis points of volume. */
  premiumBps: number;
  premiumPerTransaction: number;
  /** How much of the premium is the reserve carry rather than a fee. */
  reserveShareOfPremiumPct: number;
  /** Annual cost of every merchant account beyond the first. */
  extraMidAnnualCost: number;
  disputeReduction: DisputeReductionResult;
}

export function compareHighRiskCost(input: HighRiskCostInput): HighRiskComparison {
  const business: BusinessProfile = {
    monthlyVolume: input.monthlyVolume,
    averageTicket: input.averageTicket,
    chargebackRatePct: input.chargebackRatePct,
  };

  const highRisk = accountCost(business, input.highRisk);
  // The standard side holds the BUSINESS constant and changes only the terms.
  // See header note 3.
  const standard = accountCost(business, input.standard);

  const annualPremium = highRisk.totalAnnualCost - standard.totalAnnualCost;
  const annualVolume = highRisk.annualVolume;
  const txnsPerYear = highRisk.transactionsPerMonth * 12;

  // Every account beyond the first duplicates the fixed monthly, the annual
  // registrations and the setup fee. It does NOT duplicate the discount rate or
  // the per transaction fees, because the volume is split between the accounts
  // rather than doubled, which is the whole point of the arrangement.
  const extraMids = Math.max(0, Math.round(nonNeg(input.highRisk.midCount)) - 1);
  const amortMonths = Math.max(1, nonNeg(input.highRisk.setupAmortizeMonths));
  const extraMidAnnualCost =
    extraMids *
    (nonNeg(input.highRisk.monthlyFixed) * 12 +
      nonNeg(input.highRisk.annualRegistrationFees) +
      (nonNeg(input.highRisk.setupFee) * 12) / amortMonths);

  return {
    highRisk,
    standard,
    annualPremium,
    monthlyPremium: annualPremium / 12,
    premiumBps: annualVolume > 0 ? (annualPremium / annualVolume) * 10000 : 0,
    premiumPerTransaction: txnsPerYear > 0 ? annualPremium / txnsPerYear : 0,
    reserveShareOfPremiumPct:
      annualPremium > 0 ? (highRisk.reserveAnnualCarryCost / annualPremium) * 100 : 0,
    extraMidAnnualCost,
    disputeReduction: disputeReductionSaving(input, annualPremium),
  };
}

/**
 * What cutting the dispute rate is worth in FEES ALONE.
 *
 * Deliberately narrow, and the narrowness is the finding. Fewer disputes means
 * fewer chargeback fees and fewer alerts, and that is all it means directly: the
 * discount rate and the reserve do not fall because your ratio fell, they fall
 * because you renegotiated them. On the page's default inputs this saving is
 * under twelve percent of the classification premium, which is the honest answer
 * to "should I buy a chargeback tool or renegotiate my rate".
 *
 * Alerts are assumed to scale with the dispute rate. That is a modeling choice
 * and it is stated on the page: alert volume tracks attempted disputes, which is
 * a larger population than realized chargebacks, so a merchant who resolves
 * everything through alerts will see the alert line fall more slowly than this.
 */
export function disputeReductionSaving(
  input: HighRiskCostInput,
  annualPremium: number,
): DisputeReductionResult {
  const current = nonNeg(input.chargebackRatePct);
  const target = Math.min(current, nonNeg(input.targetChargebackRatePct));
  const ticket = nonNeg(input.averageTicket);
  const transactions = ticket > 0 ? Math.round(nonNeg(input.monthlyVolume) / ticket) : 0;

  const currentCbs = transactions * (current / 100);
  const targetCbs = transactions * (target / 100);
  const avoidedPerMonth = currentCbs - targetCbs;

  const feeSaving = avoidedPerMonth * nonNeg(input.highRisk.chargebackFee) * 12;
  // Alerts scale with the rate, so the ratio of the rates is the ratio of the
  // alerts. A zero current rate has no ratio and saves nothing.
  const alertScale = current > 0 ? 1 - target / current : 0;
  const alertSaving = nonNeg(input.highRisk.alertsPerMonth) * alertScale * nonNeg(input.highRisk.alertCost) * 12;
  const annualFeeSaving = feeSaving + alertSaving;

  return {
    targetRatePct: target,
    chargebacksAvoidedPerYear: avoidedPerMonth * 12,
    annualFeeSaving,
    shareOfPremiumPct: annualPremium > 0 ? (annualFeeSaving / annualPremium) * 100 : 0,
  };
}

/**
 * How many months of the classification premium a one time spend is worth.
 *
 * The output nobody publishes. A merchant told that reclassification, a
 * fulfillment overhaul or a 3-D Secure rollout will cost $15,000 has no way to
 * judge it without knowing what the premium runs per month. Returns Infinity
 * when there is no premium to recover the spend out of, which the widget renders
 * as a sentence rather than as a number.
 */
export function premiumPaybackMonths(annualPremium: number, oneTimeSpend: number): number {
  const monthly = annualPremium / 12;
  if (!(monthly > 0)) return Number.POSITIVE_INFINITY;
  return nonNeg(oneTimeSpend) / monthly;
}
