"use client";

import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select as SelectInput } from "@/components/ui/Input";
import { Spinner, ErrorState, EmptyState } from "@/components/ui/States";
import { DateRangeSelect, OutletSelect } from "@/components/Filters";
import { useOutlet } from "@/components/OutletContext";
import { api } from "@/lib/api-client";
import { RangeKey } from "@/lib/date-ranges";

const TYPES = [
  { key: "sales", label: "Sales" },
  { key: "items", label: "Dish-wise" },
  { key: "outlet", label: "Outlet-wise" },
  { key: "executive", label: "Executive-wise" },
  { key: "expense", label: "Expenses" },
  { key: "bills", label: "Bills" },
] as const;
type ReportType = (typeof TYPES)[number]["key"];

interface Executive {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const { selectedOutletId } = useOutlet();
  const [type, setType] = useState<ReportType>("sales");
  const [range, setRange] = useState<RangeKey>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [executiveId, setExecutiveId] = useState("");
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ executives: Executive[] }>("/api/executives").then((r) => setExecutives(r.executives)).catch(() => {});
  }, []);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ type, range });
    if (selectedOutletId) params.set("outletId", selectedOutletId);
    if (type === "sales" && executiveId) params.set("executiveId", executiveId);
    if (range === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    api
      .get<{ rows: Record<string, unknown>[] }>(`/api/reports?${params.toString()}`)
      .then((r) => setRows(r.rows))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type, range, selectedOutletId, executiveId, customFrom, customTo]);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  function exportUrl() {
    const params = new URLSearchParams({ type, range, format: "csv" });
    if (selectedOutletId) params.set("outletId", selectedOutletId);
    if (type === "sales" && executiveId) params.set("executiveId", executiveId);
    if (range === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    return `/api/reports?${params.toString()}`;
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Reports</h1>
          <p className="text-sm text-ink-500">Every report is generated live from the database.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <OutletSelect />
          <DateRangeSelect
            value={range}
            onChange={setRange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomChange={(f, t) => {
              setCustomFrom(f);
              setCustomTo(t);
            }}
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 no-print">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
              type === t.key ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-ink-500"
            }`}
          >
            {t.label}
          </button>
        ))}

        {type === "sales" && (
          <SelectInput value={executiveId} onChange={(e) => setExecutiveId(e.target.value)} className="w-auto">
            <option value="">All executives</option>
            {executives.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </SelectInput>
        )}

        <div className="ml-auto flex gap-2">
          <a
            href={exportUrl()}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-medium text-ink-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
          <button
            onClick={() => window.print()}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-medium text-ink-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      {loading && <Spinner label="Generating report..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && rows.length === 0 && <EmptyState title="No data for this range" />}

      {!loading && !error && rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-ink-300">
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-3 font-medium capitalize">
                    {c.replace(/([A-Z])/g, " $1")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  {columns.map((c) => (
                    <td key={c} className="whitespace-nowrap px-4 py-2.5 text-ink-700">
                      {String(row[c] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
