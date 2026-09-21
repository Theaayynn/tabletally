"use client";

import { useEffect, useState } from "react";
import { Plus, Wallet, Pencil, Trash2 } from "lucide-react";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Input, Label, FieldGroup, Select, Textarea } from "@/components/ui/Input";
import { Spinner, ErrorState, EmptyState, Pagination } from "@/components/ui/States";
import { OutletSelect } from "@/components/Filters";
import { useOutlet } from "@/components/OutletContext";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { businessDateToday } from "@/lib/date-ranges";

const CATEGORIES = [
  "Rent",
  "Electricity",
  "Gas",
  "Salary",
  "Raw Material",
  "Maintenance",
  "Marketing",
  "Transport",
  "Packaging",
  "Other",
];
const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"];

interface Expense {
  id: string;
  outletId: string;
  outletName: string;
  category: string;
  description: string | null;
  amount: string;
  paymentMethod: string;
  expenseDate: string;
  enteredByName: string;
}
interface Outlet {
  id: string;
  name: string;
}

export default function ExpensesPage() {
  const { selectedOutletId } = useOutlet();
  const { notify } = useToast();
  const [rows, setRows] = useState<Expense[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    outletId: "",
    category: CATEGORIES[0],
    description: "",
    amount: "",
    paymentMethod: "CASH",
    expenseDate: businessDateToday(),
  });

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (selectedOutletId) params.set("outletId", selectedOutletId);
    Promise.all([
      api.get<{ expenses: Expense[]; total: number }>(`/api/expenses?${params.toString()}`),
      api.get<{ outlets: Outlet[] }>("/api/outlets"),
    ])
      .then(([e, o]) => {
        setRows(e.expenses);
        setTotal(e.total);
        setOutlets(o.outlets);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [page, selectedOutletId]);

  function openCreate() {
    setEditing(null);
    setForm({
      outletId: selectedOutletId ?? outlets[0]?.id ?? "",
      category: CATEGORIES[0],
      description: "",
      amount: "",
      paymentMethod: "CASH",
      expenseDate: businessDateToday(),
    });
    setModalOpen(true);
  }
  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      outletId: e.outletId,
      category: e.category,
      description: e.description ?? "",
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      expenseDate: e.expenseDate,
    });
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/expenses/${editing.id}`, {
          category: form.category,
          description: form.description || null,
          amount: parseFloat(form.amount),
          paymentMethod: form.paymentMethod,
          expenseDate: form.expenseDate,
        });
        notify("Expense updated.");
      } else {
        await api.post("/api/expenses", {
          outletId: form.outletId,
          category: form.category,
          description: form.description || null,
          amount: parseFloat(form.amount),
          paymentMethod: form.paymentMethod,
          expenseDate: form.expenseDate,
        });
        notify("Expense recorded.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save expense.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/expenses/${deleteTarget.id}`);
      notify("Expense deleted.");
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
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Expenses</h1>
          <p className="text-sm text-ink-500">Track outgoing costs across outlets.</p>
        </div>
        <div className="flex items-center gap-2">
          <OutletSelect />
          <Button onClick={openCreate} disabled={outlets.length === 0}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {loading && <Spinner label="Loading expenses..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState icon={Wallet} title="No expenses found" description="No expenses recorded for this filter." action={{ label: "Add Expense", onClick: openCreate }} />
      )}

      {!loading && !error && rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-ink-300">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Outlet</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 text-ink-700">{new Date(r.expenseDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                  <td className="px-4 py-3 text-ink-500">{r.outletName}</td>
                  <td className="px-4 py-3"><Badge tone="brand">{r.category}</Badge></td>
                  <td className="px-4 py-3 text-ink-500">{r.paymentMethod.replace("_", " ")}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{formatMoney(r.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" />
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Expense" : "Add Expense"}>
        <form onSubmit={save}>
          {!editing && (
            <FieldGroup>
              <Label>Outlet</Label>
              <Select required value={form.outletId} onChange={(e) => setForm((f) => ({ ...f, outletId: e.target.value }))}>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Category</Label>
              <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </FieldGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Date</Label>
              <Input
                type="date"
                required
                value={form.expenseDate}
                onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
              />
            </FieldGroup>
            <FieldGroup>
              <Label>Payment method</Label>
              <Select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label>Description (optional)</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FieldGroup>
          <Button type="submit" className="w-full" loading={saving}>
            {editing ? "Save Changes" : "Record Expense"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete expense"
        description="This can't be undone."
        loading={deleting}
      />
    </div>
  );
}
