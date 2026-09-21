"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Spinner, ErrorState, EmptyState, Pagination } from "@/components/ui/States";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/money";

interface EntryRow {
  id: string;
  entryDate: string;
  totalItems: number;
  totalQty: number;
  totalSales: string;
  isLocked: boolean;
}
interface EntryDetail {
  entry: EntryRow;
  items: { itemId: string; name: string; quantity: number; unitPrice: string; lineTotal: string }[];
}

export default function ExecutiveHistoryPage() {
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntryDetail | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ entries: EntryRow[]; total: number }>(`/api/daily-entries?page=${page}&pageSize=15`)
      .then((r) => {
        setRows(r.entries);
        setTotal(r.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  async function openDetail(id: string) {
    const d = await api.get<EntryDetail>(`/api/daily-entries/${id}`);
    setDetail(d);
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold tracking-tight text-ink-900">History</h1>

      {loading && <Spinner label="Loading history..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState title="No entries yet" description="Saved daily entries will show up here." />
      )}

      {!loading && !error && rows.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => openDetail(r.id)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                      {new Date(r.entryDate + "T00:00:00").toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {r.isLocked && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                    </p>
                    <p className="text-xs text-ink-300">
                      {r.totalItems} dishes · {formatNumber(r.totalQty)} qty
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-ink-900">{formatMoney(r.totalSales)}</p>
                </button>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={15} total={total} onPageChange={setPage} />
        </Card>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? new Date(detail.entry.entryDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : ""}
      >
        {detail && (
          <div>
            <ul className="mb-4 divide-y divide-slate-100">
              {detail.items.map((it) => (
                <li key={it.itemId} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink-700">
                    {it.name} <span className="text-ink-300">× {it.quantity}</span>
                  </span>
                  <span className="font-medium text-ink-900">{formatMoney(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700">
              <span>Total</span>
              <span>{formatMoney(detail.entry.totalSales)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
