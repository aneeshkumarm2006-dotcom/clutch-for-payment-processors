/**
 * Payout timing and the Federal Reserve holiday calendar
 *
 * Generated reference data for the `/tools/*` calculators. The maintenance
 * contract is in `lib/tools-data/index.ts`: every figure here was read from a
 * primary source on the date recorded beside it, and a checked date must never
 * be moved without re-reading the source.
 *
 * ONE MODULE PER TOOL, ON PURPOSE. `/tools/[tool]` is a single route serving
 * every calculator, so anything a client widget imports lands in the chunk that
 * EVERY tool page loads. Splitting these is what keeps the 290 row MCC table off
 * the Stripe fee calculator. Do not merge them back into one file, and do not
 * import from `lib/tools-data/index.ts` inside a `"use client"` module.
 */

export interface FedHoliday {
  /** ISO date of a day the Federal Reserve is closed, observance rules already applied. */
  date: string;
  name: string;
}

export interface PayoutProfile {
  processorSlug: string;
  name: string;
  /** Business days from capture to funds leaving the processor. */
  standardDays: number;
  /**
   * Either the literal string "none" when the processor publishes no hourly
   * cutoff, or an "HH:MM ZONE" string. The calculator reads those two shapes and
   * nothing else.
   */
  cutoff: string;
  instant: string;
  note: string;
}

/**
 * US Federal Reserve holidays for 2026 and 2027. THIS DATASET EXPIRES.
 *
 * Extend it before January 2027 or the payout calculator will quietly begin
 * treating a Reserve Bank holiday as a business day. A test asserts the last
 * entry is not in the past.
 *
 * Saturday-dated entries are present so the UI can explain why nothing was
 * skipped, and are dropped from the closure set rather than shifted: when a
 * holiday falls on a Saturday the Reserve Banks are open the preceding Friday.
 */
export const FED_HOLIDAYS: FedHoliday[] = [
  {
    date: "2026-01-01",
    name: "New Year's Day",
  },
  {
    date: "2026-01-19",
    name: "Martin Luther King Jr. Day",
  },
  {
    date: "2026-02-16",
    name: "Washington's Birthday (Presidents Day)",
  },
  {
    date: "2026-05-25",
    name: "Memorial Day",
  },
  {
    date: "2026-06-19",
    name: "Juneteenth National Independence Day",
  },
  {
    date: "2026-07-04",
    name: "Independence Day (falls Saturday, Reserve Banks open Friday July 3, no settlement day lost)",
  },
  {
    date: "2026-09-07",
    name: "Labor Day",
  },
  {
    date: "2026-10-12",
    name: "Columbus Day",
  },
  {
    date: "2026-11-11",
    name: "Veterans Day",
  },
  {
    date: "2026-11-26",
    name: "Thanksgiving Day",
  },
  {
    date: "2026-12-25",
    name: "Christmas Day",
  },
  {
    date: "2027-01-01",
    name: "New Year's Day",
  },
  {
    date: "2027-01-18",
    name: "Martin Luther King Jr. Day",
  },
  {
    date: "2027-02-15",
    name: "Washington's Birthday (Presidents Day)",
  },
  {
    date: "2027-05-31",
    name: "Memorial Day",
  },
  {
    date: "2027-06-19",
    name: "Juneteenth National Independence Day (falls Saturday, Reserve Banks open Friday June 18, no settlement day lost)",
  },
  {
    date: "2027-07-05",
    name: "Independence Day observed (July 4 falls Sunday, Reserve Banks closed Monday July 5)",
  },
  {
    date: "2027-09-06",
    name: "Labor Day",
  },
  {
    date: "2027-10-11",
    name: "Columbus Day",
  },
  {
    date: "2027-11-11",
    name: "Veterans Day",
  },
  {
    date: "2027-11-25",
    name: "Thanksgiving Day",
  },
  {
    date: "2027-12-25",
    name: "Christmas Day (falls Saturday, Reserve Banks open Friday December 24, no settlement day lost)",
  },
];

export const PAYOUT_PROFILES: PayoutProfile[] = [
  {
    processorSlug: "stripe",
    name: "Stripe",
    standardDays: 2,
    cutoff: "none",
    instant: "Instant Payouts, 1.5% of the amount, 0.50 USD minimum, 9,999 USD maximum per payout, up to 10 per day. Funds usually arrive within 30 minutes and the service runs on weekends and holidays.",
    note: "US default is 2 business days counted from the day the charge is created. Stripe publishes no hourly cutoff, so the clock time of the sale does not change the date. A new account's first payout completes 7 to 14 days after the first live payment. Separately, manual payouts initiated before 17:00 US Eastern are eligible for same day settlement, limited to 10 per day.",
  },
  {
    processorSlug: "square",
    name: "Square",
    standardDays: 1,
    cutoff: "20:00 ET",
    instant: "Instant Transfer, 1.95% per transfer, available 24 hours a day including bank holidays. New sellers are limited to one instant transfer a day of up to 2,000 USD. Same-Day Transfer sends at 5:15 PM PT / 8:15 PM ET, or 15 minutes after your close of day, for the same 1.95%.",
    note: "Payments taken before 5 PM PT / 8 PM ET are available the next business day. Payments after that are available by the second business day. Square holds Friday transfers in your balance over the weekend by default so instant transfer stays available. During bank holidays the regular transfer arrives the day after the holiday. Square's own wording for a Friday sale is that it posts by Monday morning depending on your bank's processing speeds, so treat the hour as your bank's decision.",
  },
  {
    processorSlug: "paypal",
    name: "PayPal",
    standardDays: 1,
    cutoff: "19:00 ET",
    instant: "Instant Transfer, 1.50% for business accounts, 0.50 USD minimum. Maximum 25,000 USD per transaction to a bank account and 50,000 USD per transaction to a card. Typically within minutes, up to 30 minutes depending on your bank.",
    note: "Card money lands in your PayPal balance first, then you withdraw it, so the time you enter should be when you start the withdrawal, not when the sale happened. Standard withdrawals are typically completed within 1 business day but can take 1 to 3. Transfers initiated after 7:00 PM ET, or on a weekend or holiday, may take an additional day. Standard transfers to a bank account are free where no currency conversion is involved.",
  },
  {
    processorSlug: "helcim",
    name: "Helcim",
    standardDays: 1,
    cutoff: "19:00 MT",
    instant: "No instant payout product. Helcim Faster Deposits gives next business day access at no cost, moving money over the RTP and FedNow real time rails for merchants at eligible US banks.",
    note: "Close your batch by 7:00 PM MT to qualify for next business day funding. Card deposits generally arrive within 1 to 2 business days after the batch settles. Terminals default to a 5:00 PM auto settlement in your account time zone. Settle on a Friday evening and the business day count starts Monday. Merchants whose bank does not support RTP or FedNow fall back to a wider 1 to 3 business day window. ACH takes 3 to 5 business days.",
  },
  {
    processorSlug: "adyen",
    name: "Adyen",
    standardDays: 2,
    cutoff: "none",
    instant: "No instant payout. Payout frequency defaults to daily and the settlement delay can be shortened at a premium.",
    note: "A sales day runs midnight to midnight in the merchant account's local time zone, so clock time does not change the date. Payout delay is 2 business days where at least 80% of transactions are in USD, EUR, GBP, CAD, AUD, NZD, SEK or RON and acquired in their regions, and 3 business days otherwise. A bank holiday on the sales day, on the payout day, or anywhere in between increases the delay. Adyen also notes it can take up to two days for funds to arrive depending on the banks involved.",
  },
  {
    processorSlug: "clover",
    name: "Clover",
    standardDays: 1,
    cutoff: "none",
    instant: "Rapid Deposit, 1.75% per deposit deducted from your next standard deposit, to an eligible Visa or Mastercard debit card. Typically within a few minutes, up to 30 minutes.",
    note: "Clover's published standard funding schedule is 1 to 3 business days after the batch closes. Clover assigns your closeout method and closeout time from the details on your application, so there is no single default hour to apply and this calculator does not shift your batch date on clock time. Check your own closeout time in the Dashboard, because a sale after it lands in the next day's batch. New accounts can be held additional days while application verification finishes.",
  },
  {
    processorSlug: "toast",
    name: "Toast",
    standardDays: 1,
    cutoff: "21:30 ET",
    instant: "No instant payout product published for card deposits.",
    note: "Batch before 9:30 PM ET and the deposit arrives the next business day. Batch after 9:30 PM ET, or let the 4:00 AM local auto batch run, and it arrives two business days later. If a federal banking holiday falls on your scheduled deposit day, the deposit is delayed by one day.",
  },
  {
    processorSlug: "sumup",
    name: "SumUp",
    standardDays: 2,
    cutoff: "none",
    instant: "No instant payout to an external bank account. Money routed to a SumUp Business Account is the faster option.",
    note: "SumUp sends payouts daily, every day except federal holidays and weekends, and says payouts take 1 to 2 business days to arrive from the time they are sent. Because that clock starts when SumUp sends the payout rather than when the sale happens, the earliest realistic total is 2 business days. No hourly cutoff is published. Weekly payouts go out every Monday, monthly payouts on the third business day of the following month.",
  },
];
