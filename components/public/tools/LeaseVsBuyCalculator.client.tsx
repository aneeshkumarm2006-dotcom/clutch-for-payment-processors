"use client";

import * as React from "react";
import { LEASE_BUYOUT_TYPES, LEASE_DEFAULTS, LEASE_DEVICE_PRICES } from "@/lib/tools-data/lease";
import { impliedMonthlyLeaseRate } from "@/lib/tools-math";
import {
  CalcShell,
  Callout,
  Caveat,
  Field,
  FieldGrid,
  Headline,
  MiniTable,
  ResultRow,
  SelectField,
  money,
  money0,
  num,
  pct,
} from "@/components/public/tools/ToolKit";

/**
 * Terminal lease against outright purchase.
 *
 * The implied rate is the output that matters and the one no leasing company
 * discloses, because these agreements are written as rentals rather than
 * finance. A $299 terminal on a $59 monthly lease over 48 months implies about
 * 237% APR, which is the kind of number that ends the conversation.
 *
 * The fair market value buyout is deliberately left as an unknown rather than
 * estimated: the contract does not name the amount when you sign it, so neither
 * can this page. The total is shown as a floor with the gap called out.
 */
export function LeaseVsBuyCalculator() {
  const [purchasePrice, setPurchasePrice] = React.useState(String(LEASE_DEFAULTS.purchasePrice));
  const [monthlyLease, setMonthlyLease] = React.useState(String(LEASE_DEFAULTS.monthlyLease));
  const [termMonths, setTermMonths] = React.useState(String(LEASE_DEFAULTS.termMonths));
  const [buyoutType, setBuyoutType] = React.useState(LEASE_DEFAULTS.buyoutType);
  const [monthlyExtras, setMonthlyExtras] = React.useState(String(LEASE_DEFAULTS.monthlyExtras));
  const [fmvOverride, setFmvOverride] = React.useState("");

  const P = Math.max(0, num(purchasePrice));
  const L = Math.max(0, num(monthlyLease));
  const n = Math.max(0, Math.round(num(termMonths)));
  const E = Math.max(0, num(monthlyExtras));

  const totalPayments = L * n;
  const totalExtras = E * n;

  const fmvEntered = num(fmvOverride);
  const buyoutCost =
    buyoutType === "one-dollar" ? 1 : buyoutType === "ten-percent" ? Math.round(P * 10) / 100 : fmvEntered > 0 ? fmvEntered : 0;
  const fmvUnknown = buyoutType === "fmv" && fmvEntered <= 0;

  const totalLease = totalPayments + totalExtras + buyoutCost;
  const difference = totalLease - P;
  const multiple = P > 0 ? totalLease / P : 0;

  const monthlyRate = impliedMonthlyLeaseRate(P, L, n);
  const apr = monthlyRate === null ? null : monthlyRate * 12 * 100;
  const ear = monthlyRate === null ? null : (Math.pow(1 + monthlyRate, 12) - 1) * 100;
  const allInRate = impliedMonthlyLeaseRate(P, L + E, n);

  const activeBuyout = LEASE_BUYOUT_TYPES.find((b) => b.id === buyoutType);

  return (
    <CalcShell
      controls={
        <div className="space-y-6">
          <div>
            <p className="text-label uppercase text-muted-foreground">Buying it outright</p>
            <div className="mt-2.5">
              <Field
                id="lease-price"
                label="Purchase price of the device"
                prefix="$"
                value={purchasePrice}
                onChange={setPurchasePrice}
                hint="What the same terminal costs to buy. See the price list below."
              />
            </div>
          </div>

          <div>
            <p className="text-label uppercase text-muted-foreground">The lease you were offered</p>
            <div className="mt-2.5 space-y-4">
              <FieldGrid>
                <Field id="lease-monthly" label="Monthly payment" prefix="$" value={monthlyLease} onChange={setMonthlyLease} />
                <SelectField
                  id="lease-term"
                  label="Term"
                  value={String(n)}
                  onChange={setTermMonths}
                  options={[12, 24, 36, 48, 60].map((m) => ({ value: String(m), label: `${m} months` }))}
                />
              </FieldGrid>
              <SelectField
                id="lease-buyout"
                label="End of term buyout"
                value={buyoutType}
                onChange={setBuyoutType}
                options={LEASE_BUYOUT_TYPES.map((b) => ({ value: b.id, label: b.label }))}
                hint={activeBuyout?.description}
              />
              {buyoutType === "fmv" && (
                <Field
                  id="lease-fmv"
                  label="Fair market value buyout, if your contract names one"
                  prefix="$"
                  value={fmvOverride}
                  onChange={setFmvOverride}
                  hint="Leave blank if it does not. Most do not."
                />
              )}
              <Field
                id="lease-extras"
                label="Monthly add-ons"
                prefix="$"
                value={monthlyExtras}
                onChange={setMonthlyExtras}
                hint="Lease insurance, loss and damage waiver, and sales tax on the payment. Read them off your statement."
              />
            </div>
          </div>
        </div>
      }
      results={
        <div>
          <Headline
            label={apr === null ? "Total cost of the lease" : "Implied APR on the lease"}
            value={apr === null ? money(totalLease) : pct(apr, 1)}
            sub={
              apr === null
                ? "The payments do not add up to the purchase price, so there is no finance charge to imply."
                : `${money(totalLease)} over ${n} months against ${money(P)} to buy.`
            }
          />

          <div className="mt-5">
            <ResultRow label={`Lease payments (${n} x ${money(L)})`} value={money(totalPayments)} />
            {totalExtras > 0 && <ResultRow label="Add-ons over the term" value={money(totalExtras)} />}
            <ResultRow
              label="End of term buyout"
              value={fmvUnknown ? "Not named in the contract" : money(buyoutCost)}
              note={fmvUnknown ? "So the total below is a floor, not the final figure." : undefined}
            />
            <ResultRow label="Total paid on the lease" value={money(totalLease)} emphasis />
            <ResultRow label="Total to buy outright" value={money(P)} />
            <ResultRow
              label="Extra you pay to lease"
              value={money(difference)}
              note={multiple > 0 ? `${multiple.toFixed(1)}x the purchase price in total` : undefined}
              emphasis
            />
          </div>

          {monthlyRate !== null && ear !== null && (
            <div className="mt-6">
              <p className="text-label uppercase text-muted-foreground">The rate nobody quotes you</p>
              <div className="mt-2">
                <ResultRow label="Implied monthly rate" value={pct(monthlyRate * 100)} />
                <ResultRow label="Implied APR" value={pct(apr ?? 0, 1)} note="Nominal, the US convention" emphasis />
                <ResultRow label="Effective annual rate" value={pct(ear, 1)} note="With monthly compounding" />
                {allInRate !== null && E > 0 && (
                  <ResultRow
                    label="All in, including add-ons"
                    value={pct(allInRate * 12 * 100, 1)}
                    note="Insurance and tax treated as part of the payment"
                  />
                )}
              </div>
            </div>
          )}

          {apr !== null && apr > 100 && (
            <Callout tone="warn">
              An implied APR above 100% on a device you could buy for {money0(P)} is the reason these agreements are
              criticised. Most are non cancellable for the full term, so the exit is to pay it out, not to hand the
              terminal back.
            </Callout>
          )}
          {fmvUnknown && (
            <Callout>
              A fair market value buyout is not a number when you sign. The lessor decides it at the end, and the
              total above assumes it is zero, which it will not be. Treat everything here as the best case.
            </Callout>
          )}

          <div className="mt-6">
            <p className="text-label uppercase text-muted-foreground">What these devices cost to buy</p>
            <div className="mt-2">
              <MiniTable
                columns={["Device", "Price"]}
                rows={LEASE_DEVICE_PRICES.map((d) => [d.device, d.price])}
                maxHeight="220px"
              />
            </div>
          </div>

          <Caveat>
            The implied rate solves the payment stream against the purchase price and excludes the add-ons, because
            insurance and tax are fees rather than repayment of the equipment. Device prices were read from each
            vendor&rsquo;s own store; check yours before relying on the comparison.
          </Caveat>
        </div>
      }
    />
  );
}

export default LeaseVsBuyCalculator;
