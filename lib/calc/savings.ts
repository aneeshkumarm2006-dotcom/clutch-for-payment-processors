/**
 * How much a merchant can actually take off their card processing bill.
 *
 * Client safe: no `@/models`, no I/O, no clock. The lever prices arrive as plain
 * numbers on the input rather than as an import of `lib/tools-data/savings.ts`,
 * so the arithmetic has no runtime dependency on a rate sheet that will change
 * in April and again in October.
 *
 * ─── The failure mode this module exists to prevent ─────────────────────────
 *
 * DOUBLE COUNTING, and it is completely silent. Every published savings
 * calculator computes each lever against the merchant's original statement and
 * adds the results up. That is wrong in five separate ways at once, and the
 * total it produces is confident, plausible and unreachable:
 *
 *   1. Moving invoices to ACH removes dollars from the card channel. Every
 *      lever priced per card dollar must then be computed on what is LEFT. Price
 *      them all on the original volume and you have sold the same dollar twice.
 *   2. A commercial card sent without Level 2 data IS a downgrade. Counting it
 *      once as an enhanced data opportunity and again as a downgrade repair
 *      counts one basis point gap twice, so `downgradeVolume` is capped at the
 *      NON commercial share here.
 *   3. Junk fees are part of the markup. Strip them and then negotiate the
 *      markup down to a target and you have removed the same dollars twice
 *      unless the junk fees come out first, which is the order used below.
 *   4. Moving from flat rate to interchange plus and negotiating the markup are
 *      one lever, not two. Both set the markup to a number. There is one
 *      repricing step here and there will never be a second.
 *   5. A surcharge recovers your COST OF ACCEPTANCE, so its ceiling falls every
 *      time an earlier lever works. Computed against the original statement it
 *      recovers money you no longer spend.
 *
 * So the levers are applied in a fixed order against a running balance, each one
 * priced on the volume and the fees that survive the previous ones. The order is
 * ACH, enhanced data, downgrade repair, junk fees, repricing, surcharging, and
 * the reasoning for each position is in `SAVINGS_LEVERS`.
 *
 * ─── Integer cents ──────────────────────────────────────────────────────────
 *
 * All money is computed in integer cents. Somebody using this page is holding a
 * statement, and binary floating point produces one cent errors at exactly the
 * moment a number is being checked against one. The ACH fee in particular is
 * rounded PER PAYMENT and then multiplied, never the reverse, because that is
 * how it is billed and because the cap binds per payment.
 *
 * ─── Why nothing here compounds ─────────────────────────────────────────────
 *
 * Annual figures are twelve times the monthly figure. These are flows, not
 * growth rates: twelve months of processing fees do not compound the way a churn
 * rate does (see `involuntaryChurn` in `lib/tools-math.ts` for the case where
 * multiplying instead of compounding is a real bug). The model holds volume flat
 * at the figure entered, which is a stated limit rather than a hidden one.
 */

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------

/** Round half UP, which is the direction a processor rounds. */
const roundHalfUp = (n: number): number => Math.floor(n + 0.5);

const toCents = (dollars: number): number => roundHalfUp(dollars * 100);

const safe = (n: number): number => (Number.isFinite(n) ? n : 0);

const atLeastZero = (n: number): number => Math.max(0, safe(n));

/** Clamp a user-typed percentage share into 0 to 100. */
const share = (pct: number): number => Math.min(100, Math.max(0, safe(pct)));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SavingsInput {
  /** Card volume this month, in dollars. */
  monthlyVolume: number;
  /** Card transactions this month. */
  monthlyTransactions: number;
  /** Everything the processor took this month, in dollars. */
  monthlyFees: number;
  /** The subset of `monthlyFees` that is monthly line items rather than per sale. */
  monthlyFixedFees: number;
  /** Estimated interchange plus assessments, as a percentage of volume. */
  passThroughPct: number;

  /** Dollars of monthly card volume you could genuinely collect by ACH instead. */
  achVolume: number;
  /** How many payments that volume arrives in. Drives whether the cap binds. */
  achPayments: number;
  achRatePct: number;
  achFixed: number;
  /** Per payment cap. Zero or less means uncapped. */
  achCap: number;

  /** Share of residual card volume running on commercial and business cards. */
  commercialSharePct: number;
  /** Interchange saved per dollar of commercial volume, in basis points. */
  enhancedDataBps: number;

  /** Share of residual card volume clearing in a non qualified program. */
  downgradeSharePct: number;
  /** Interchange recovered per dollar of downgraded volume, in basis points. */
  downgradeBps: number;

  /** Dollars of `monthlyFixedFees` you can actually remove. */
  removableFixedFees: number;

  /** Target processor markup over pass through, as a percentage of volume. */
  targetMarkupPct: number;
  /** Target processor markup per transaction, in dollars. */
  targetMarkupPerItem: number;

  /** Share of residual card volume that is credit AND lawfully surchargeable. */
  surchargeSharePct: number;
  /** Surcharge percentage you intend to apply. */
  surchargeRatePct: number;
  /** Network ceiling on a credit card surcharge, as a percentage. */
  surchargeCapPct: number;
}

export interface LeverResult {
  id: string;
  /** Monthly saving in dollars. Never negative. */
  monthly: number;
  /** Twelve times the monthly figure. */
  annual: number;
  /** The volume, count or fee base this lever was priced on. */
  basis: number;
  /** One line explaining the arithmetic, for the result row. */
  workings: string;
}

export interface SavingsResult {
  /** Fees divided by volume, as a percentage. The number the verdict scores. */
  effectiveRate: number;
  /** Estimated interchange plus assessments, in dollars a month. */
  passThrough: number;
  passThroughRate: number;
  /** Everything above pass through. The only negotiable part of the bill. */
  markup: number;
  markupRate: number;
  /** Markup expressed the way a processor quotes one. */
  markupBps: number;

  levers: LeverResult[];
  /** Sum of the levers, monthly. */
  totalMonthly: number;
  totalAnnual: number;

  /** What the same volume would cost once every lever above has been pulled. */
  newMonthlyCost: number;
  /**
   * The new cost divided by the ORIGINAL total volume, so the before and after
   * rates are comparable. Using residual volume would flatter the result: moving
   * a third of the volume to ACH shrinks the denominator as well as the fee.
   */
  newEffectiveRate: number;
  /** Basis points off the effective rate. */
  improvementBps: number;

  /** True when there is nothing here worth a merchant's week. */
  doNothing: boolean;
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/**
 * Price one ACH payment, in cents.
 *
 * Rounded here, per payment, and multiplied afterwards. Two reasons, and both
 * change the answer: the processor prices each debit separately and rounds each
 * one separately, and the cap binds on a single payment rather than on the
 * month. Applying a 0.8 percent rate to $30,000 of monthly volume and then
 * capping at $5.00 would price twenty four separate invoices as one and report a
 * fee of $5.00 where the real fee is $120.00.
 */
function achFeeCents(amountC: number, ratePct: number, fixedC: number, capC: number): number {
  const uncapped = roundHalfUp(amountC * (atLeastZero(ratePct) / 100)) + fixedC;
  return capC > 0 ? Math.min(uncapped, capC) : uncapped;
}

export function computeSavings(input: SavingsInput): SavingsResult {
  const volumeC = toCents(atLeastZero(input.monthlyVolume));
  const transactions = Math.max(0, Math.round(safe(input.monthlyTransactions)));
  const feesC = toCents(atLeastZero(input.monthlyFees));
  const fixedC = Math.min(toCents(atLeastZero(input.monthlyFixedFees)), feesC);

  const effectiveRate = volumeC > 0 ? (feesC / volumeC) * 100 : 0;
  const passThroughC = roundHalfUp(volumeC * (atLeastZero(input.passThroughPct) / 100));
  const markupC = feesC - passThroughC;

  // -------------------------------------------------------------------------
  // 1. ACH. Runs first because it removes dollars from the card channel, and
  //    everything after it is priced per card dollar.
  // -------------------------------------------------------------------------
  const achVolC = Math.min(toCents(atLeastZero(input.achVolume)), volumeC);
  const achPayments = Math.min(Math.max(0, Math.round(safe(input.achPayments))), transactions);

  // The card cost of that volume is taken at the merchant's own VARIABLE rate,
  // fees minus monthly line items over volume. Monthly line items are excluded
  // because they do not fall when volume moves off cards, and treating them as
  // variable would credit ACH with a saving it does not produce.
  const variableFeesC = feesC - fixedC;
  const cardCostOnAchC =
    volumeC > 0 ? roundHalfUp((variableFeesC * achVolC) / volumeC) : 0;

  const achFixedC = toCents(atLeastZero(input.achFixed));
  const achCapC = toCents(atLeastZero(input.achCap));
  const perPaymentC = achPayments > 0 ? Math.floor(achVolC / achPayments) : 0;
  const achCostC =
    achPayments > 0 ? achFeeCents(perPaymentC, input.achRatePct, achFixedC, achCapC) * achPayments : 0;
  const achSavingC = Math.max(0, cardCostOnAchC - achCostC);

  // What is left on cards after the ACH migration.
  const volume2C = volumeC - achVolC;
  const transactions2 = transactions - achPayments;
  const passThrough2C = roundHalfUp(volume2C * (atLeastZero(input.passThroughPct) / 100));
  const variableFees2C = variableFeesC - cardCostOnAchC;

  // -------------------------------------------------------------------------
  // 2. Enhanced data, on the commercial share of what is left.
  // -------------------------------------------------------------------------
  const commercialVolC = roundHalfUp(volume2C * (share(input.commercialSharePct) / 100));
  const enhancedC = Math.max(
    0,
    roundHalfUp((commercialVolC * atLeastZero(input.enhancedDataBps)) / 10000),
  );

  // -------------------------------------------------------------------------
  // 3. Downgrade repair, on the NON commercial share of what is left.
  //
  //    The cap is the whole reason this step is separate from step 2. A
  //    commercial card sent without Level 2 data is itself a downgrade, so
  //    without this cap a merchant who reports 30 percent commercial volume and
  //    30 percent downgraded volume gets paid twice for one basis point gap.
  // -------------------------------------------------------------------------
  const downgradeVolC = Math.min(
    roundHalfUp(volume2C * (share(input.downgradeSharePct) / 100)),
    Math.max(0, volume2C - commercialVolC),
  );
  const downgradeC = Math.max(
    0,
    roundHalfUp((downgradeVolC * atLeastZero(input.downgradeBps)) / 10000),
  );

  // -------------------------------------------------------------------------
  // 4. Junk fees. Before repricing, never after: they are part of the markup.
  // -------------------------------------------------------------------------
  const junkC = Math.min(toCents(atLeastZero(input.removableFixedFees)), fixedC);

  // -------------------------------------------------------------------------
  // 5. Reprice the markup that survives steps 1 to 4 down to the target.
  // -------------------------------------------------------------------------
  const passThroughAfterC = Math.max(0, passThrough2C - enhancedC - downgradeC);
  // The variable markup left on card volume, measured BEFORE steps 2 and 3.
  //
  // This looks like an off by two error and is not. Enhanced data and downgrade
  // repair cut interchange, which is pass through, so they take the same number
  // of dollars out of the fees and out of the pass through estimate. The markup
  // is the difference between the two, so it does not move. Subtracting them
  // from the fees but not from the pass through, which is the obvious way to
  // write this line, would count both savings a second time inside the
  // repricing step. On the page defaults that mistake reports $1,205.08 of
  // negotiable markup where the real figure is $990.00.
  //
  // Monthly line items are excluded because step 4 handles them.
  const variableMarkupC = variableFees2C - passThrough2C;
  const targetMarkupC =
    roundHalfUp(volume2C * (atLeastZero(input.targetMarkupPct) / 100)) +
    roundHalfUp(toCents(atLeastZero(input.targetMarkupPerItem)) * transactions2);
  const repriceC = Math.max(0, variableMarkupC - targetMarkupC);

  // -------------------------------------------------------------------------
  // 6. Surcharging, last, and capped by what acceptance still costs.
  //
  //    Visa's rule is the lower of your merchant discount rate and 3 percent, so
  //    the ceiling here is the merchant's own post fix variable rate on card
  //    volume. Every lever above lowers that rate, which lowers this lever. That
  //    is not a modelling quirk, it is the rule.
  // -------------------------------------------------------------------------
  // The residual variable cost of accepting a card dollar, after levers 1 to 5.
  // `variableMarkupC - repriceC` and not `targetMarkupC`: a merchant whose
  // markup is ALREADY below the target does not get repriced upward, and using
  // the target here would hand them a surcharge ceiling above their own real
  // cost of acceptance, which is exactly what Visa's rule forbids.
  const postVariableFeesC = Math.max(0, passThroughAfterC + (variableMarkupC - repriceC));
  const postVariableRate = volume2C > 0 ? (postVariableFeesC / volume2C) * 100 : 0;
  const surchargeVolC = roundHalfUp(volume2C * (share(input.surchargeSharePct) / 100));
  const surchargeRate = Math.min(
    atLeastZero(input.surchargeRatePct),
    atLeastZero(input.surchargeCapPct),
    postVariableRate,
  );
  const surchargeC = Math.max(0, roundHalfUp(surchargeVolC * (surchargeRate / 100)));

  // -------------------------------------------------------------------------
  // Totals
  // -------------------------------------------------------------------------
  const rawTotalC = achSavingC + enhancedC + downgradeC + junkC + repriceC + surchargeC;
  // A saving cannot exceed the bill. If the inputs imply it does, something in
  // them is wrong, and reporting a negative processing cost would be worse than
  // reporting a capped one.
  const totalC = Math.min(rawTotalC, feesC);
  const newCostC = feesC - totalC;

  const dollars = (c: number) => c / 100;

  const levers: LeverResult[] = [
    {
      id: "ach",
      monthly: dollars(achSavingC),
      annual: dollars(achSavingC * 12),
      basis: dollars(achVolC),
      workings:
        achPayments > 0
          ? `${achPayments} payments averaging ${dollars(perPaymentC).toFixed(2)} cost ${dollars(achCostC).toFixed(2)} by ACH against ${dollars(cardCostOnAchC).toFixed(2)} on cards.`
          : "No invoice volume marked as ACH eligible.",
    },
    {
      id: "enhanced-data",
      monthly: dollars(enhancedC),
      annual: dollars(enhancedC * 12),
      basis: dollars(commercialVolC),
      workings: `${dollars(commercialVolC).toFixed(2)} of commercial card volume at ${atLeastZero(input.enhancedDataBps)} basis points.`,
    },
    {
      id: "downgrades",
      monthly: dollars(downgradeC),
      annual: dollars(downgradeC * 12),
      basis: dollars(downgradeVolC),
      workings: `${dollars(downgradeVolC).toFixed(2)} of downgraded volume at ${atLeastZero(input.downgradeBps)} basis points, capped so it cannot overlap the commercial share.`,
    },
    {
      id: "junk-fees",
      monthly: dollars(junkC),
      annual: dollars(junkC * 12),
      basis: dollars(fixedC),
      workings: `${dollars(junkC).toFixed(2)} removed from ${dollars(fixedC).toFixed(2)} of monthly line items.`,
    },
    {
      id: "reprice",
      monthly: dollars(repriceC),
      annual: dollars(repriceC * 12),
      basis: dollars(volume2C),
      workings: `Markup of ${dollars(variableMarkupC).toFixed(2)} on the remaining card volume against a target of ${dollars(targetMarkupC).toFixed(2)}.`,
    },
    {
      id: "surcharge",
      monthly: dollars(surchargeC),
      annual: dollars(surchargeC * 12),
      basis: dollars(surchargeVolC),
      workings:
        surchargeVolC > 0
          ? `${dollars(surchargeVolC).toFixed(2)} of surchargeable credit volume at ${surchargeRate.toFixed(2)} percent, the lower of your rate, the 3 percent network ceiling and your own cost of acceptance.`
          : "Off. Set a surchargeable credit share above to model it.",
    },
  ];

  return {
    effectiveRate,
    passThrough: dollars(passThroughC),
    passThroughRate: volumeC > 0 ? (passThroughC / volumeC) * 100 : 0,
    markup: dollars(markupC),
    markupRate: volumeC > 0 ? (markupC / volumeC) * 100 : 0,
    markupBps: volumeC > 0 ? (markupC / volumeC) * 10000 : 0,
    levers,
    totalMonthly: dollars(totalC),
    totalAnnual: dollars(totalC * 12),
    newMonthlyCost: dollars(newCostC),
    newEffectiveRate: volumeC > 0 ? (newCostC / volumeC) * 100 : 0,
    improvementBps: volumeC > 0 ? (totalC / volumeC) * 10000 : 0,
    doNothing: totalC * 12 < toCents(600),
  };
}
