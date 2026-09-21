"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner, ErrorState, EmptyState } from "@/components/ui/States";
import { DateRangeSelect } from "@/components/Filters";
import { api } from "@/lib/api-client";
import { RangeKey } from "@/lib/date-ranges";

const TYPES = [
  { key: "sales", label: "Sales" },
  { key: "items", label: "Dish-wise" },
  { key: "expense", label: "Expenses" },
] as const;

export default function ExecutiveReportsPage() {
  const [type, setType] = useState<(typeof TYPES)[number]["key"]>("sales");
  const [range, setRange] = useState<RangeKey>("this_month");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ rows: Record<string, unknown>[] }>(`/api/reports?type=${type}&range=${range}`)
      .then((r) => setRows(r.rows))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type, range]);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">Reports</h1>
        <DateRangeSelect value={range} onChange={setRange} />
      </div>

      <div className="mb-4 flex gap-2">
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
        <a
          href={`/api/reports?type=${type}&range=${range}&format=csv`}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-medium text-ink-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>
      </div>

      {loading && <Spinner label="Loading report..." />}
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
