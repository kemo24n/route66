export function fmtSyp(n: number, label = "ل.س") {
  return `${Math.round(n).toLocaleString("en-US")} ${label}`;
}

export function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

export function toUsd(syp: number, rate: number) {
  return rate > 0 ? syp / rate : 0;
}

export type Totals = { subtotal: number; discount: number; serviceCharge: number; tax: number; total: number };

/** service charge on (subtotal - discount), tax on (subtotal - discount + service) */
export function computeTotals(subtotal: number, discount: number, servicePercent: number, taxPercent: number): Totals {
  const d = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const base = subtotal - d;
  const serviceCharge = Math.round((base * servicePercent) / 100);
  const tax = Math.round(((base + serviceCharge) * taxPercent) / 100);
  return { subtotal, discount: d, serviceCharge, tax, total: base + serviceCharge + tax };
}

export const PAY_LABELS: Record<string, string> = {
  CASH_SYP: "كاش ليرة",
  CASH_USD: "كاش دولار",
  SHAM_CASH: "شام كاش",
  CARD: "بطاقة",
};
