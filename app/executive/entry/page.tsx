"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Lock, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { Spinner, EmptyState, ErrorState } from "@/components/ui/States";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useOutlet } from "@/components/OutletContext";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney, toNumber } from "@/lib/money";
import { businessDateToday } from "@/lib/date-ranges";

interface ItemRow {
  id: string;
  name: string;
  price: string;
  categoryId: string;
  categoryName: string;
}
interface Category {
  id: string;
  name: string;
}

function yesterday(today: string) {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function TodayEntryPage() {
  const { selectedOutletId } = useOutlet();
  const { notify } = useToast();
  const today = useMemo(() => businessDateToday(), []);

  const [date, setDate] = useState(today);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOutletId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<{ items: ItemRow[] }>(`/api/items?outletId=${selectedOutletId}&activeOnly=true`),
      api.get<{ categories: Category[] }>(`/api/categories`),
      api.get<{ entry: { isLocked: boolean } | null; items: { itemId: string; quantity: number }[] }>(
        `/api/daily-entries/lookup?outletId=${selectedOutletId}&date=${date}`
      ),
    ])
      .then(([itemsRes, catRes, entryRes]) => {
        setItems(itemsRes.items);
        setCategories(catRes.categories);
        setIsLocked(entryRes.entry?.isLocked ?? false);
        const q: Record<string, number> = {};
        entryRes.items.forEach((l) => (q[l.itemId] = l.quantity));
        setQuantities(q);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedOutletId, date]);

  const visibleItems = items.filter((it) => {
    if (activeCategory !== "all" && it.categoryId !== activeCategory) return false;
    if (search && !it.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totals = useMemo(() => {
    let totalItems = 0;
    let totalQty = 0;
    let totalSales = 0;
    for (const it of items) {
      const qty = quantities[it.id] ?? 0;
      if (qty > 0) {
        totalItems += 1;
        totalQty += qty;
        totalSales += toNumber(it.price) * qty;
      }
    }
    return { totalItems, totalQty, totalSales };
  }, [items, quantities]);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        entryDate: date,
        items: Object.entries(quantities).map(([itemId, quantity]) => ({ itemId, quantity })),
      };
      await api.post("/api/daily-entries", payload);
      notify("Entry saved successfully.");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Unable to save entry. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-28">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">Today&apos;s Sales</h1>
          <p className="text-sm text-ink-500">
            {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
          <CalendarDays className="h-4 w-4 text-ink-300" />
          <select
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent text-sm font-medium text-ink-700 focus:outline-none"
          >
            <option value={today}>Today</option>
            <option value={yesterday(today)}>Yesterday</option>
          </select>
        </div>
      </div>

      {isLocked && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Lock className="h-4 w-4" />
          This day&apos;s entry has been locked by an admin and can&apos;t be edited.
        </div>
      )}

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search dishes..."
          className="pl-9"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory("all")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ${
            activeCategory === "all" ? "bg-brand-600 text-white" : "bg-white text-ink-500 border border-slate-200"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium ${
              activeCategory === c.id ? "bg-brand-600 text-white" : "bg-white text-ink-500 border border-slate-200"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading && <Spinner label="Loading dishes..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && visibleItems.length === 0 && (
        <EmptyState title="No dishes found" description="Try a different search or category." />
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <ul className="space-y-2">
          {visibleItems.map((it) => {
            const qty = quantities[it.id] ?? 0;
            return (
              <li
                key={it.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{it.name}</p>
                  <p className="text-xs text-ink-300">
                    {formatMoney(it.price)}
                    {qty > 0 && <span className="ml-1.5 font-medium text-brand-600">· {formatMoney(toNumber(it.price) * qty)}</span>}
                  </p>
                </div>
                <QuantityStepper
                  value={qty}
                  onChange={(next) =>
                    !isLocked && setQuantities((q) => ({ ...q, [it.id]: next }))
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Sticky summary + save */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:bottom-0 sm:left-60 md:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="text-xs text-ink-500 sm:text-sm">
            <span className="font-semibold text-ink-900">{totals.totalItems}</span> items ·{" "}
            <span className="font-semibold text-ink-900">{totals.totalQty}</span> qty ·{" "}
            <span className="font-semibold text-brand-600">{formatMoney(totals.totalSales)}</span>
          </div>
          <Button onClick={save} loading={saving} disabled={isLocked || loading}>
            Save Today&apos;s Entry
          </Button>
        </div>
      </div>
    </div>
  );
}
