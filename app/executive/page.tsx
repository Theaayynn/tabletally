"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IndianRupee, Package, Wallet, ClipboardList, ArrowRight } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip, CartesianGrid } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { KpiCard } from "@/components/KpiCard";
import { Spinner, ErrorState, EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/money";

interface DashboardResponse {
  kpis: {
    totalSales: number;
    totalEntries: number;
    totalItemsSold: number;
    totalExpenses: number;
  };
  salesOverview: { date: string; sales: number }[];
}

export default function ExecutiveDashboardPage() {
  const [today, setToday] = useState<DashboardResponse | null>(null);
  const [week, setWeek] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<DashboardResponse>("/api/dashboard?range=today"),
      api.get<DashboardResponse>("/api/dashboard?range=this_week"),
    ])
      .then(([t, w]) => {
        setToday(t);
        setWeek(w);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading your dashboard..." />;
  if (error || !today || !week) return <ErrorState message={error ?? "Could not load dashboard."} />;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">Good day 👋</h1>
        <p className="text-sm text-ink-500">Here&apos;s how your outlet is doing today.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Today's Sales" value={formatMoney(today.kpis.totalSales)} icon={IndianRupee} iconTone="brand" />
        <KpiCard label="Items Sold Today" value={formatNumber(today.kpis.totalItemsSold)} icon={Package} iconTone="amber" />
        <KpiCard label="Today's Expenses" value={formatMoney(today.kpis.totalExpenses)} icon={Wallet} iconTone="rose" />
        <KpiCard
          label="Today's Net"
          value={formatMoney(today.kpis.totalSales - today.kpis.totalExpenses)}
          icon={ClipboardList}
          iconTone="emerald"
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>This Week&apos;s Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {week.salesOverview.length === 0 ? (
            <EmptyState title="No sales yet this week" />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={week.salesOverview}>
                  <CartesianGrid vertical={false} stroke="#eef0fa" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en-IN", { weekday: "short" })}
                    tick={{ fontSize: 11, fill: "#a2a4b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ borderRadius: 12, fontSize: 13 }} />
                  <Line type="monotone" dataKey="sales" stroke="#5a4fe0" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Link href="/executive/entry">
        <Button className="mt-4 w-full" size="lg">
          Go to Today&apos;s Entry
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
