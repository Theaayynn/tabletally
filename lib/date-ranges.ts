// All business dates are plain YYYY-MM-DD strings (matches the Postgres
// `date` columns) evaluated in the restaurant's local timezone, not the
// server's — so "today" is correct for outlets even though Vercel servers
// run in UTC.
const TIMEZONE = "Asia/Kolkata";

export function businessDateToday(): string {
  return formatDateInTZ(new Date());
}

export function formatDateInTZ(d: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function startOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  dt.setUTCDate(dt.getUTCDate() - diffToMonday);
  return dt.toISOString().slice(0, 10);
}

function startOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `${y}-${m}-01`;
}

export type RangeKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "all_time"
  | "custom";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "all_time", label: "All Time" },
  { key: "custom", label: "Custom Range" },
];

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

export function resolveRange(
  key: RangeKey,
  custom?: { from?: string | null; to?: string | null }
): DateRange | null {
  const today = businessDateToday();
  switch (key) {
    case "today":
      return { from: today, to: today, label: "Today" };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y, label: "Yesterday" };
    }
    case "this_week":
      return { from: startOfWeek(today), to: today, label: "This Week" };
    case "last_week": {
      const s = startOfWeek(today);
      return {
        from: addDays(s, -7),
        to: addDays(s, -1),
        label: "Last Week",
      };
    }
    case "this_month":
      return { from: startOfMonth(today), to: today, label: "This Month" };
    case "last_month": {
      const s = startOfMonth(today);
      const lastMonthEnd = addDays(s, -1);
      return {
        from: startOfMonth(lastMonthEnd),
        to: lastMonthEnd,
        label: "Last Month",
      };
    }
    case "all_time":
      return { from: "2000-01-01", to: today, label: "All Time" };
    case "custom": {
      if (!custom?.from || !custom?.to) return null;
      return { from: custom.from, to: custom.to, label: "Custom Range" };
    }
    default:
      return null;
  }
}

/** The immediately preceding period of equal length, used for % change KPIs. */
export function previousPeriod(range: DateRange): DateRange {
  const fromD = new Date(range.from + "T00:00:00Z");
  const toD = new Date(range.to + "T00:00:00Z");
  const days = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
  const prevTo = addDays(range.from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo, label: "Previous period" };
}

/** Percent change, or null when there's no baseline to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
