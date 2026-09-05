"use client";

import * as React from "react";
import {
  CHARGEBACK_COST_DEFAULTS,
  CHARGEBACK_MONITORING_ESCALATION,
  DEFAULT_MONITORING_PROGRAM,
  DEFAULT_REPRESENTMENT_BENCHMARK,
  REPRESENTMENT_WIN_RATES,
} from "@/lib/tools-data/chargeback-cost";
import {
  annualChargebackCost,
  monitoringEscalationCost,
  perChargebackCost,
  representmentEconomics,
  type ChargebackCostInput,
} from "@/lib/calc/chargeback-cost";
import {
  CalcShell,
  Callout,
  Caveat,
  CheckboxRow,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ModeTabs,
  Pill,
  ResultRow,
  SelectField,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * True Cost of a Chargeback Calculator.
 *
 * ─── The boundary with the sibling tool ─────────────────────────────────────
 * `/tools/chargeback-ratio-calculator` owns the RATIO and the THRESHOLDS: am I
 * over the line, and which line. This widget starts one step later and owns the
 * MONEY: the full multiple of order value, whether representment is worth the
 * staff hour it costs, what a year of this does to the P&L, and what the
 * assessment ladder costs once a program has already picked you up. Nothing
 * here restates a threshold, and the copy points at the other page for that.
 *
 * ─── Why the win rate is an editable field and not a benchmark table ────────
 * Nobody publishes representment win rates by reason code. One all-disputes
 * average is published and that is the number this preloads; the category select
 * changes the guidance, not the rate. See `lib/tools-data/chargeback-cost.ts`.
 *
 * No `Verdict` here on purpose: the bands score a blended monthly effective
 * rate, and none of these outputs is one.
 */
export function ChargebackCostCalculator() {
  const D = CHARGEBACK_COST_DEFAULTS;
  const [mode, setMode] = React.useState<"one" | "year" | "escalation">("one");

  const [aov, setAov] = React.useState(String(D.averageOrderValue));
  const [cogs, setCogs] = React.useState(String(D.costOfGoods));
  const [fulfil, setFulfil] = React.useState(String(D.fulfillment));
  const [rate, setRate] = React.useState(String(D.processingRatePct));
  const [fixed, setFixed] = React.useState(String(D.processingFixed));
  const [cbFee, setCbFee] = React.useState(String(D.chargebackFee));
  const [counterFee, setCounterFee] = React.useState(String(D.counterFee));
  const [counterRefunded, setCounterRefunded] = React.useState(D.counterFeeRefundedOnWin);
  const [staffMinutes, setStaffMinutes] = React.useState(String(D.staffMinutes));
  const [fightMinutes, setFightMinutes] = React.useState(String(D.fightMinutes));
  const [staffRate, setStaffRate] = React.useState(String(D.staffHourlyRate));
  const [monthlyCbs, setMonthlyCbs] = React.useState(String(D.monthlyChargebacks));
  const [monthlyTxns, setMonthlyTxns] = React.useState(String(D.monthlyTransactions));
  const [fightShare, setFightShare] = React.useState(String(D.fightSharePct));
  const [firstCycle, setFirstCycle] = React.useState(String(D.firstCycleWinRatePct));
  const [secondCycle, setSecondCycle] = React.useState(String(D.secondCycleLossPct));
  const [category, setCategory] = React.useState(D.category);
  const [programId, setProgramId] = React.useState(D.program);
  const [events, setEvents] = React.useState(String(D.monthlyChargebacks));

  const input: ChargebackCostInput = {
    averageOrderValue: num(aov),
    costOfGoods: num(cogs),
    fulfillment: num(fulfil),
    processingRatePct: num(rate),
    processingFixed: num(fixed),
    chargebackFee: num(cbFee),
    counterFee: num(counterFee),
    counterFeeRefundedOnWin: counterRefunded,
    staffMinutes: num(staffMinutes),
    fightMinutes: num(fightMinutes),
    staffHourlyRate: num(staffRate),
    monthlyChargebacks: num(monthlyCbs),
    monthlyTransactions: num(monthlyTxns),
    fightSharePct: num(fightShare),
    firstCycleWinRatePct: num(firstCycle),
    secondCycleLossPct: num(secondCycle),
  };

  const per = perChargebackCost(input);
  const rep = representmentEconomics(input);
  const year = annualChargebackCost(input);

  const chosenCategory =
    REPRESENTMENT_WIN_RATES.find((c) => c.id === category) ?? DEFAULT_REPRESENTMENT_BENCHMARK;
  const program =
    CHARGEBACK_MONITORING_ESCALATION.find((p) => p.id === programId) ?? DEFAULT_MONITORING_PROGRAM;
  const esc = monitoringEscalationCost(program, num(monthlyCbs), num(events), 12);

  const fightPays = rep.expectedValuePerFight > 0;

  const orderFields = (
    <div className="space-y-4">
      <FieldGrid>
        <Field id="cbc-aov" label="Disputed order value" prefix="$" value={aov} onChange={setAov} />
        <Field
          id="cbc-cogs"
          label="Cost of goods"
          prefix="$"
          value={cogs}
          onChange={setCogs}
          hint="Already spent. You almost never get the item back."
        />
      </FieldGrid>
      <FieldGrid>
        <Field id="cbc-fulfil" label="Fulfillment and shipping" prefix="$" value={fulfil} onChange={setFulfil} />
        <Field
          id="cbc-cbfee"
          label="Chargeback fee"
          prefix="$"
          value={cbFee}
          onChange={setCbFee}
          hint="Charged on receipt, win or lose."
        />
      </FieldGrid>
      <FieldGrid>
        <Field
          id="cbc-rate"
          label="Processing rate on the sale"
          suffix="%"
          value={rate}
          onChange={setRate}
          hint="Not refunded when a payment is disputed."
        />
        <Field id="cbc-fixed" label="Fixed fee per transaction" prefix="$" value={fixed} onChange={setFixed} />
      </FieldGrid>
      <FieldGrid>
        <Field
          id="cbc-mins"
          label="Minutes to handle one dispute"
          suffix="min"
          value={staffMinutes}
          onChange={setStaffMinutes}
          hint="Logging and reconciling it, before any decision to fight."
        />
        <Field
          id="cbc-staffrate"
          label="Loaded hourly cost of that time"
          prefix="$"
          value={staffRate}
          onChange={setStaffRate}
          hint="Default is the US private-industry average total compensation per hour worked, BLS, March 2026."
        />
      </FieldGrid>
    </div>
  );

  const representmentFields = (
    <div className="space-y-4">
      <SelectField
        id="cbc-category"
        label="Dispute reason category"
        value={category}
        onChange={setCategory}
        options={REPRESENTMENT_WIN_RATES.map((c) => ({ value: c.id, label: c.label }))}
        hint="Changes the guidance below, not the win rate. No win rate is published per category."
      />
      <FieldGrid>
        <Field
          id="cbc-fightshare"
          label="Share of disputes you fight"
          suffix="%"
          value={fightShare}
          onChange={setFightShare}
        />
        <Field
          id="cbc-fightmins"
          label="Extra minutes to build a case"
          suffix="min"
          value={fightMinutes}
          onChange={setFightMinutes}
          hint="On top of the handling time above."
        />
      </FieldGrid>
      <FieldGrid>
        <Field
          id="cbc-firstcycle"
          label="First-cycle win rate"
          suffix="%"
          value={firstCycle}
          onChange={setFirstCycle}
          hint="Industry average is 44.6%. Use your own last twelve months."
        />
        <Field
          id="cbc-secondcycle"
          label="Wins lost at the second cycle"
          suffix="%"
          value={secondCycle}
          onChange={setSecondCycle}
          hint="Pre-arbitration reversals. Industry average is 19%."
        />
      </FieldGrid>
      <Field
        id="cbc-counterfee"
        label="Fee to submit evidence"
        prefix="$"
        value={counterFee}
        onChange={setCounterFee}
        hint="Stripe calls this the dispute countered fee. Enter 0 if your processor has none."
      />
      <CheckboxRow
        checked={counterRefunded}
        onChange={() => setCounterRefunded((v) => !v)}
        label="That fee is returned if I win"
        hint="Stripe returns the countered fee on a win and keeps the received fee either way."
      />
      <FieldGrid>
        <Field id="cbc-cbs" label="Chargebacks per month" value={monthlyCbs} onChange={setMonthlyCbs} />
        <Field id="cbc-txns" label="Transactions per month" value={monthlyTxns} onChange={setMonthlyTxns} />
      </FieldGrid>
    </div>
  );

  return (
    <CalcShell
      controls={
        <div className="space-y-5">
          <ModeTabs
            value={mode}
            onChange={(v) => setMode(v as "one" | "year" | "escalation")}
            options={[
              { value: "one", label: "One chargeback" },
              { value: "year", label: "A year of them" },
              { value: "escalation", label: "If a program picks you up" },
            ]}
          />

          {mode === "one" && orderFields}
          {mode === "year" && representmentFields}
          {mode === "escalation" && (
            <div className="space-y-4">
              <SelectField
                id="cbc-program"
                label="Program you have been placed in"
                value={programId}
                onChange={setProgramId}
                options={CHARGEBACK_MONITORING_ESCALATION.map((p) => ({
                  value: p.id,
                  label: `${p.network} ${p.program}`,
                }))}
              />
              <FieldGrid>
                <Field
                  id="cbc-esc-cbs"
                  label="Chargebacks per month"
                  value={monthlyCbs}
                  onChange={setMonthlyCbs}
                  hint="Drives the issuer recovery assessment above 300."
                />
                <Field
                  id="cbc-esc-events"
                  label="Fraud reports plus disputes per month"
                  value={events}
                  onChange={setEvents}
                  hint="Visa counts both. It is a larger number than your chargeback count."
                />
              </FieldGrid>
              <Callout>
                This mode assumes you are already identified. Whether your ratio puts you inside a program is a
                different question, and it has its own page: the{" "}
                <a
                  href="/tools/chargeback-ratio-calculator"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  chargeback ratio calculator
                </a>{" "}
                scores you against the current Visa and Mastercard thresholds.
              </Callout>
            </div>
          )}
        </div>
      }
      results={
        mode === "one" ? (
          <div>
            <Headline
              label="True cost of one chargeback"
              value={money(per.cashOut)}
              sub={`Cash gone on a ${money(input.averageOrderValue)} order. With the reversed sale, ${money(
                per.totalExposure,
              )}, or ${per.multipleOfOrder.toFixed(2)}x the order value.`}
            />
            <div className="mt-5">
              <ResultRow label="Goods and fulfillment" value={money(per.goodsAndFulfillment)} note="Spent, not recovered" />
              <ResultRow
                label="Processing fee kept by the processor"
                value={money(per.processingFeeRetained)}
                note="Not returned on a dispute"
              />
              <ResultRow label="Chargeback fee" value={money(per.chargebackFee)} />
              <ResultRow label="Staff time to handle it" value={money(per.staffCost)} note={`${Math.round(num(staffMinutes))} minutes`} />
              <ResultRow label="Cash out of the bank" value={money(per.cashOut)} emphasis />
              <ResultRow label="Revenue reversed" value={money(per.revenueReversed)} note="Received at settlement, taken back at the debit" />
              <ResultRow label="Total exposure" value={money(per.totalExposure)} note="The number behind the 2x to 3x claim" />
            </div>

            <div className="mt-5">
              <ResultRow label="Gross margin on this order" value={money(per.grossMarginPerOrder)} note={pct(per.grossMarginPct)} />
              <ResultRow
                label="Orders needed to replace the cash"
                value={per.salesToBreakEven > 0 ? `${per.salesToBreakEven.toFixed(2)}` : "N/A"}
                note="At your own margin, not your revenue"
                emphasis
              />
            </div>

            <Callout>
              The settlement and the chargeback debit cancel over the life of the order, so the sale is not a cash line
              twice. What actually leaves the account is{" "}
              <strong className="text-foreground">{money(per.cashOut)}</strong>, and replacing it takes{" "}
              <strong className="text-foreground">
                {per.salesToBreakEven > 0 ? per.salesToBreakEven.toFixed(2) : "0"} more orders
              </strong>{" "}
              at a {pct(per.grossMarginPct)} margin, which is {money(per.salesToBreakEven * input.averageOrderValue)} of
              new revenue.
            </Callout>

            <Caveat>
              Excludes anything you cannot put a number on from one screen: inventory shrink, the acquirer reserve, and
              the reputational cost of a merchant account that gets repriced.
            </Caveat>
          </div>
        ) : mode === "year" ? (
          <div>
            <Headline
              label="A year of chargebacks, after representment"
              value={money0(year.netAnnualCost)}
              sub={`${Math.round(year.chargebacksPerYear)} chargebacks at a ${pct(year.disputeRatePct)} dispute rate. That is ${pct(
                year.pctOfRevenue,
              )} of revenue.`}
            />

            <div className="mt-5">
              <ResultRow label="Cash out on every chargeback received" value={money0(year.baseCashOut)} />
              <ResultRow
                label="Spent fighting"
                value={money0(year.representmentCost)}
                note={`${Math.round(rep.disputesFoughtPerYear)} cases at ${money(rep.costToFightOne)} each`}
              />
              <ResultRow
                label="Recovered by fighting"
                value={money0(year.representmentRecovered)}
                note={`${rep.disputesWonPerYear.toFixed(0)} expected wins after the second cycle`}
              />
              <ResultRow label="Net annual cost" value={money0(year.netAnnualCost)} emphasis />
            </div>

            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">Is fighting worth it?</p>
              <div className="mt-2">
                <ResultRow
                  label="Final win rate"
                  value={pct(rep.finalWinRatePct)}
                  note={`${pct(num(firstCycle))} at the first cycle, less ${pct(num(secondCycle), 0)} of those reversed later`}
                />
                <ResultRow label="Cost to fight one" value={money(rep.costToFightOne)} />
                <ResultRow label="Expected recovery per case" value={money(rep.expectedRecoveryPerFight)} />
                <ResultRow
                  label="Expected value per case fought"
                  value={money(rep.expectedValuePerFight)}
                  emphasis
                />
                <ResultRow
                  label="Order value where fighting breaks even"
                  value={money(rep.breakEvenOrderValue)}
                  note="Below this, representment costs more than it returns"
                />
              </div>
            </div>

            <Callout tone={fightPays ? "good" : "warn"}>
              {fightPays ? (
                <>
                  At {money(input.averageOrderValue)} an order, fighting the average dispute returns{" "}
                  <strong className="text-foreground">{money(rep.expectedValuePerFight)}</strong> more than it costs, so
                  representment is worth the staff hour. It stops being worth it below{" "}
                  {money(rep.breakEvenOrderValue)}.
                </>
              ) : (
                <>
                  At {money(input.averageOrderValue)} an order, fighting the average dispute loses{" "}
                  <strong className="text-foreground">{money(Math.abs(rep.expectedValuePerFight))}</strong> in
                  expectation. Fighting only pays above {money(rep.breakEvenOrderValue)} at these labor costs, so the
                  money is better spent on the reason the disputes are arriving.
                </>
              )}
            </Callout>

            <Callout>
              To earn this back you need{" "}
              <strong className="text-foreground">{Math.ceil(year.extraSalesNeeded).toLocaleString("en-US")} more orders</strong>{" "}
              at your own {pct(per.grossMarginPct)} gross margin, which is {money0(year.extraRevenueNeeded)} of extra
              revenue. Margin is the right denominator: dividing by revenue would say{" "}
              {Math.ceil(year.netAnnualCost / Math.max(1, input.averageOrderValue)).toLocaleString("en-US")} orders,
              which is the comfortable wrong answer.
            </Callout>

            <Caveat>
              {chosenCategory.label} ({chosenCategory.covers}){" "}
              {chosenCategory.sourced ? "" : "No win rate is published for this category. "}
              {chosenCategory.mechanism}
            </Caveat>
          </div>
        ) : (
          <div>
            <Headline
              label={`${program.network} ${program.program}, first twelve months`}
              value={money0(esc.twelveMonthTotal)}
              sub={
                esc.firstChargedMonth === null
                  ? "No assessment at the figures entered."
                  : `First assessment lands in month ${esc.firstChargedMonth}.`
              }
            />

            <div className="mt-5">
              <MiniTable
                columns={["Month", "Assessment", "Cumulative"]}
                align={["left", "right", "right"]}
                maxHeight="300px"
                rows={esc.months.map((m) => [
                  <span key={`m${m.month}`}>
                    Month {m.month}
                    {m.issuerRecovery > 0 && (
                      <span className="block text-micro text-muted-foreground">
                        includes {money0(m.issuerRecovery)} issuer recovery
                      </span>
                    )}
                  </span>,
                  money0(m.total),
                  money0(m.cumulative),
                ])}
              />
            </div>

            <div className="mt-5">
              <ResultRow label="Twelve month total" value={money0(esc.twelveMonthTotal)} emphasis />
              <ResultRow
                label="Against a year of chargeback cost"
                value={money0(year.netAnnualCost)}
                note="From the previous tab"
              />
              <ResultRow
                label="Assessments as a multiple of that"
                value={
                  year.netAnnualCost > 0 ? `${(esc.twelveMonthTotal / year.netAnnualCost).toFixed(2)}x` : "N/A"
                }
                emphasis
              />
            </div>

            <Callout tone="warn">
              <span className="mr-2 inline-block align-middle">
                <Pill tone="bad">Not published by the network</Pill>
              </span>
              {program.note}
            </Callout>

            <Caveat>{program.source}</Caveat>
          </div>
        )
      }
    />
  );
}

export default ChargebackCostCalculator;
