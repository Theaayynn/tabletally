"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { IndianRupee, ClipboardList, Package, Wallet, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { KpiCard } from "@/components/KpiCard";
import { OutletSelect, DateRangeSelect } from "@/components/Filters";
import { useOutlet } from "@/components/OutletContext";
import { Spinner, ErrorState, EmptyState } from "@/components/ui/States";
import { api } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/money";
import { RangeKey } from "@/lib/date-ranges";
import Link from "next/link";

interface DashboardResponse {
  range: { from: string; to: string; label: string };
  kpis: {
    totalSales: number;
    totalEntries: number;
    totalItemsSold: number;
    totalExpenses: number;
    netAmount: number;
    salesChangePercent: number | null;
    expenseChangePercent: number | null;
  };
  salesOverview: { date: string; sales: number }[];
  topDishes: { itemId: string; name: string; quantity: number; sales: number }[];
  outletPerformance: { outletId: string; outletName: string; sales: number; items: number }[];
  expenseBreakdown: { category: string; amount: number }[];
}

export default function AdminDashboardPage() {
  const { selectedOutletId } = useOutlet();
  const [range, setRange] = useState<RangeKey>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ range, granularity });
    if (selectedOutletId) params.set("outletId", selectedOutletId);
    if (range === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    api
      .get<DashboardResponse>(`/api/dashboard?${params.toString()}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range, granularity, selectedOutletId, customFrom, customTo]);

  const maxTopQty = useMemo(
    () => Math.max(1, ...(data?.topDishes.map((d) => d.quantity) ?? [1])),
    [data]
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Dashboard</h1>
          <p className="text-sm text-ink-500">A live view of sales, expenses and performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {loading && <Spinner label="Loading dashboard..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => setRange((r) => r)} />}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Total Sales"
              value={formatMoney(data.kpis.totalSales)}
              changePercent={data.kpis.salesChangePercent}
              icon={IndianRupee}
              iconTone="brand"
            />
            <KpiCard
              label="Total Entries"
              value={formatNumber(data.kpis.totalEntries)}
              icon={ClipboardList}
              iconTone="amber"
            />
            <KpiCard
              label="Total Items Sold"
              value={formatNumber(data.kpis.totalItemsSold)}
              icon={Package}
              iconTone="brand"
            />
            <KpiCard
              label="Total Expenses"
              value={formatMoney(data.kpis.totalExpenses)}
              changePercent={
                data.kpis.expenseChangePercent === null ? null : -data.kpis.expenseChangePercent
              }
              icon={Wallet}
              iconTone="rose"
            />
            <KpiCard
              label="Net Amount"
              value={formatMoney(data.kpis.netAmount)}
              icon={TrendingUp}
              iconTone="emerald"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Sales Overview</CardTitle>
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                  {(["daily", "weekly", "monthly"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGranularity(g)}
                      className={`rounded-md px-2.5 py-1 capitalize ${
                        granularity === g ? "bg-white text-brand-700 shadow-sm" : "text-ink-500"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {data.salesOverview.length === 0 ? (
                  <EmptyState title="No sales recorded" description="Nothing was sold in this date range yet." />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.salesOverview} margin={{ left: -12, right: 12 }}>
                        <CartesianGrid vertical={false} stroke="#eef0fa" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          tick={{ fontSize: 11, fill: "#a2a4b8" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#a2a4b8" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => formatMoney(v)}
                          width={70}
                        />
                        <Tooltip
                          formatter={(v: number) => formatMoney(v)}
                          labelFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          contentStyle={{ borderRadius: 12, border: "1px solid #eef0fa", fontSize: 13 }}
                        />
                        <Line type="monotone" dataKey="sales" stroke="#5a4fe0" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expenseBreakdown.length === 0 ? (
                  <EmptyState title="No expenses" description="No expenses recorded for this date range." />
                ) : (
                  <ul className="space-y-3">
                    {data.expenseBreakdown.map((row) => {
                      const pct = (row.amount / data.kpis.totalExpenses) * 100 || 0;
                      return (
                        <li key={row.category}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-ink-700">{row.category}</span>
                            <span className="text-ink-500">{formatMoney(row.amount)}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Top Selling Dishes</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topDishes.length === 0 ? (
                  <EmptyState title="No dishes sold yet" />
                ) : (
                  <ul className="space-y-3">
                    {data.topDishes.map((d) => (
                      <li key={d.itemId}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-ink-700">{d.name}</span>
                          <span className="text-ink-500">{formatNumber(d.quantity)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-400"
                            style={{ width: `${(d.quantity / maxTopQty) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outlet Performance</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.outletPerformance.length === 0 ? (
                  <EmptyState title="No outlets yet" />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.outletPerformance.map((o) => (
                      <Link
                        key={o.outletId}
                        href={`/admin/sales?outletId=${o.outletId}`}
                        className="flex items-center justify-between px-5 py-3 text-sm hover:bg-slate-50"
                      >
                        <div>
                          <p className="font-medium text-ink-900">{o.outletName}</p>
                          <p className="text-xs text-ink-300">{formatNumber(o.items)} items sold</p>
                        </div>
                        <p className="font-semibold text-ink-900">{formatMoney(o.sales)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
