"use client";

import { useEffect, useState } from "react";
import { Lock, Unlock, Trash2, History as HistoryIcon } from "lucide-react";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Spinner, ErrorState, EmptyState, Pagination } from "@/components/ui/States";
import { OutletSelect } from "@/components/Filters";
import { useOutlet } from "@/components/OutletContext";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/money";

interface Entry {
  id: string;
  entryDate: string;
  outletName: string;
  executiveName: string;
  totalItems: number;
  totalQty: number;
  totalSales: string;
  isLocked: boolean;
}
interface EntryDetail {
  entry: Entry;
  items: { itemId: string; name: string; quantity: number; unitPrice: string; lineTotal: string }[];
}

export default function SalesHistoryPage() {
  const { selectedOutletId } = useOutlet();
  const { notify } = useToast();
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntryDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (selectedOutletId) params.set("outletId", selectedOutletId);
    api
      .get<{ entries: Entry[]; total: number }>(`/api/daily-entries?${params.toString()}`)
      .then((r) => {
        setRows(r.entries);
        setTotal(r.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [page, selectedOutletId]);

  async function openDetail(id: string) {
    const d = await api.get<EntryDetail>(`/api/daily-entries/${id}`);
    setDetail(d);
  }

  async function toggleLock(entry: Entry, id: string) {
    try {
      await api.patch(`/api/daily-entries/${id}`, { isLocked: !entry.isLocked });
      notify(entry.isLocked ? "Entry unlocked." : "Entry locked.");
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not update.", "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/daily-entries/${deleteTarget.id}`);
      notify("Entry deleted.");
      setDeleteTarget(null);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not delete.", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Daily Entries</h1>
          <p className="text-sm text-ink-500">Every day's saved sales, across all outlets.</p>
        </div>
        <OutletSelect />
      </div>

      {loading && <Spinner label="Loading entries..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState icon={HistoryIcon} title="No entries yet" description="Saved daily entries will appear here." />
      )}

      {!loading && !error && rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-ink-300">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Outlet</th>
                <th className="px-4 py-3 font-medium">Executive</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Sales</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-ink-900" onClick={() => openDetail(r.id)}>
                    <span className="flex items-center gap-1.5">
                      {new Date(r.entryDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      {r.isLocked && <Lock className="h-3.5 w-3.5 text-amber-500" />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-500" onClick={() => openDetail(r.id)}>{r.outletName}</td>
                  <td className="px-4 py-3 text-ink-500" onClick={() => openDetail(r.id)}>{r.executiveName}</td>
                  <td className="px-4 py-3 text-ink-500" onClick={() => openDetail(r.id)}>
                    {r.totalItems} dishes · {formatNumber(r.totalQty)} qty
                  </td>
                  <td className="px-4 py-3 font-semibold text-ink-900" onClick={() => openDetail(r.id)}>
                    {formatMoney(r.totalSales)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => toggleLock(r, r.id)}>
                        {r.isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pageSize={15} total={total} onPageChange={setPage} />
        </Card>
      )}

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.entry.outletName} — ${new Date(detail.entry.entryDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}
      >
        {detail && (
          <div>
            <p className="mb-3 text-xs text-ink-300">Entered by {detail.entry.executiveName}</p>
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

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete entry"
        description={`Delete ${deleteTarget?.outletName}'s entry for ${deleteTarget?.entryDate}? This can't be undone.`}
        loading={deleting}
      />
    </div>
  );
}
