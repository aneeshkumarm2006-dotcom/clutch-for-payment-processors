/**
 * Terminal leasing
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

export interface BuyoutType {
  id: string;
  label: string;
  description: string;
}

export interface DevicePrice {
  device: string;
  price: string;
  source: string;
}

export interface LeaseDefaults {
  purchasePrice: number;
  monthlyLease: number;
  termMonths: number;
  buyoutType: string;
  monthlyExtras: number;
  yearsOfUse: number;
}

export const LEASE_DEFAULTS: LeaseDefaults = {
  purchasePrice: 299,
  monthlyLease: 59,
  termMonths: 48,
  buyoutType: "fmv",
  monthlyExtras: 0,
  yearsOfUse: 5,
};

export const LEASE_BUYOUT_TYPES: BuyoutType[] = [
  {
    id: "fmv",
    label: "Fair market value",
    description: "The lessor owns the device for the whole term. At the end you return it, renew, or buy it at whatever the lessor calls market value, an amount the contract does not name when you sign. Lowest monthly payment of the three, and the only one where you can complete every payment and own nothing.",
  },
  {
    id: "one-dollar",
    label: "One dollar buyout",
    description: "A capital lease, which is an instalment purchase in lease form. The equipment sits on your balance sheet from day one and you take title for $1 at the end. Highest monthly payment of the three, and the only structure with a certain ending.",
  },
  {
    id: "ten-percent",
    label: "Ten percent purchase upon termination",
    description: "A 10% PUT. You are obliged, not merely entitled, to buy the device for 10 percent of its original purchase price when the term ends. Payments sit below a one dollar buyout because the lessor's residual is guaranteed. Note that original purchase price means the lessor's booked figure, not the street price, so the real payment can far exceed 10 percent of what the hardware is worth.",
  },
];

export const LEASE_DEVICE_PRICES: DevicePrice[] = [
  {
    device: "Square Terminal",
    price: "$299",
    source: "squareup.com/us/en/hardware, checked September 4, 2026",
  },
  {
    device: "Square Stand",
    price: "$149",
    source: "squareup.com/us/en/hardware, checked September 4, 2026",
  },
  {
    device: "Square Kiosk",
    price: "$149",
    source: "squareup.com/us/en/hardware, checked September 4, 2026",
  },
  {
    device: "Square Handheld",
    price: "$399",
    source: "squareup.com/us/en/hardware, checked September 4, 2026",
  },
  {
    device: "Square Register (2nd generation)",
    price: "$899",
    source: "squareup.com/us/en/hardware, checked September 4, 2026",
  },
  {
    device: "PayPal Terminal",
    price: "$199",
    source: "paypal.com/us/business/pos-system/hardware, checked September 4, 2026",
  },
  {
    device: "PayPal Terminal with built-in barcode scanner",
    price: "$239",
    source: "paypal.com/us/business/pos-system/hardware, checked September 4, 2026",
  },
  {
    device: "PayPal Card Reader (first unit)",
    price: "$29",
    source: "paypal.com/us/business/pos-system/hardware, checked September 4, 2026",
  },
  {
    device: "PayPal Card Reader (each additional unit)",
    price: "$79",
    source: "paypal.com/us/business/pos-system/hardware, checked September 4, 2026",
  },
  {
    device: "Stripe Reader S700",
    price: "$299",
    source: "stripe.com/terminal, checked September 4, 2026",
  },
  {
    device: "Stripe Reader S710",
    price: "$299",
    source: "stripe.com/terminal, checked September 4, 2026",
  },
  {
    device: "Stripe Reader M2",
    price: "$59",
    source: "stripe.com/terminal, checked September 4, 2026",
  },
];
