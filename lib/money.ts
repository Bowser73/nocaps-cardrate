export function formatMoney(cents?: number | null) {
  if (cents == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function dollarsToCents(value: number) {
  return Math.round(value * 100);
}
