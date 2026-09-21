/** Numeric columns come back from Postgres as strings — never floats. This
 * only converts to a JS number at the final display boundary. */
export function toNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(amount: string | number | null | undefined, opts?: { decimals?: boolean }): string {
  const n = toNumber(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts?.decimals ? 2 : 0,
    minimumFractionDigits: opts?.decimals ? 2 : 0,
  }).format(n);
}

export function formatNumber(n: number | string | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(toNumber(n));
}
