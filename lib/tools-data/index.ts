/**
 * Reference data for the `/tools/*` calculators, one module per tool.
 *
 * THE MAINTENANCE CONTRACT
 *
 * Every figure in these modules was read from a primary source on the date
 * recorded beside it, and the pages render that provenance. A wrong number
 * renders identically to a right one, so:
 *
 *   - Do not move a checked date without re-reading the source.
 *   - Do not add a row you could not verify. `SURCHARGE_STATES` carries an
 *     "Unclear" status precisely so an unverified state need not be guessed at.
 *   - `FED_HOLIDAYS` is the one dataset that EXPIRES. It covers 2026 and 2027.
 *     A test fails once the last entry falls into the past.
 *   - `CHARGEBACK_PROGRAMS` tracks card network programme rules, which the
 *     networks revise on their own schedule and have revised recently.
 *
 * THIS BARREL IS FOR SERVER CODE AND TESTS ONLY. A `"use client"` module must
 * import the specific file it needs (`@/lib/tools-data/mcc`), never this index:
 * `/tools/[tool]` is one route serving every calculator, so importing the barrel
 * from a widget puts every tool's dataset into the chunk every tool page loads.
 */

/** The date the bulk of this data was verified against primary sources. */
export const DATA_CHECKED = "4 September 2026";
export * from "@/lib/tools-data/mca";
export * from "@/lib/tools-data/gross-up";
export * from "@/lib/tools-data/chargebacks";
export * from "@/lib/tools-data/reserve";
export * from "@/lib/tools-data/payouts";
export * from "@/lib/tools-data/mcc";
export * from "@/lib/tools-data/surcharge";
export * from "@/lib/tools-data/restaurant";
export * from "@/lib/tools-data/churn";
export * from "@/lib/tools-data/lease";
