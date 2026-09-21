"use client";

import { useEffect, useState } from "react";
import { Plus, Receipt, Pencil, Trash2, Search } from "lucide-react";
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

const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"];
const STATUSES = ["PAID", "PENDING", "PARTIALLY_PAID"];
const statusTone: Record<string, "success" | "warning" | "brand"> = {
  PAID: "success",
  PENDING: "warning",
  PARTIALLY_PAID: "brand",
};

interface Bill {
  id: string;
  billNumber: string;
  outletId: string;
  outletName: string;
  vendor: string | null;
  category: string | null;
  amount: string;
  paymentMethod: string;
  status: string;
  billDate: string;
  notes: string | null;
}
interface Outlet {
  id: string;
  name: string;
}

export default function BillsPage() {
  const { selectedOutletId } = useOutlet();
  const { notify } = useToast();
  const [rows, setRows] = useState<Bill[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    billNumber: "",
    outletId: "",
    vendor: "",
    category: "",
    amount: "",
    paymentMethod: "CASH",
    status: "PENDING",
    billDate: businessDateToday(),
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (selectedOutletId) params.set("outletId", selectedOutletId);
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    Promise.all([
      api.get<{ bills: Bill[]; total: number }>(`/api/bills?${params.toString()}`),
      api.get<{ outlets: Outlet[] }>("/api/outlets"),
    ])
      .then(([b, o]) => {
        setRows(b.bills);
        setTotal(b.total);
        setOutlets(o.outlets);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [page, selectedOutletId, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, outletId: selectedOutletId ?? outlets[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(b: Bill) {
    setEditing(b);
    setForm({
      billNumber: b.billNumber,
      outletId: b.outletId,
      vendor: b.vendor ?? "",
      category: b.category ?? "",
      amount: b.amount,
      paymentMethod: b.paymentMethod,
      status: b.status,
      billDate: b.billDate,
      notes: b.notes ?? "",
    });
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        billNumber: form.billNumber,
        vendor: form.vendor || null,
        category: form.category || null,
        amount: parseFloat(form.amount),
        paymentMethod: form.paymentMethod,
        status: form.status,
        billDate: form.billDate,
        notes: form.notes || null,
      };
      if (editing) {
        await api.patch(`/api/bills/${editing.id}`, payload);
        notify("Bill updated.");
      } else {
        await api.post("/api/bills", { ...payload, outletId: form.outletId });
        notify("Bill created.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save bill.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/bills/${deleteTarget.id}`);
      notify("Bill deleted.");
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
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Bills</h1>
          <p className="text-sm text-ink-500">Vendor bills, purchases, and other business expenses.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OutletSelect />
          <Button onClick={openCreate} disabled={outlets.length === 0}>
            <Plus className="h-4 w-4" />
            Add Bill
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill number or vendor..."
            className="w-64 pl-9"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
      </div>

      {loading && <Spinner label="Loading bills..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState icon={Receipt} title="No bills found" action={{ label: "Add Bill", onClick: openCreate }} />
      )}

      {!loading && !error && rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-ink-300">
                <th className="px-4 py-3 font-medium">Bill #</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Outlet</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink-900">{b.billNumber}</td>
                  <td className="px-4 py-3 text-ink-500">{new Date(b.billDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                  <td className="px-4 py-3 text-ink-500">{b.outletName}</td>
                  <td className="px-4 py-3 text-ink-500">{b.vendor ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{formatMoney(b.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone[b.status]}>{b.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(b)}>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Bill" : "Add Bill"}>
        <form onSubmit={save}>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Bill number</Label>
              <Input required value={form.billNumber} onChange={(e) => setForm((f) => ({ ...f, billNumber: e.target.value }))} />
            </FieldGroup>
            <FieldGroup>
              <Label>Date</Label>
              <Input type="date" required value={form.billDate} onChange={(e) => setForm((f) => ({ ...f, billDate: e.target.value }))} />
            </FieldGroup>
          </div>
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
              <Label>Vendor</Label>
              <Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} />
            </FieldGroup>
            <FieldGroup>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Vendor Purchase" />
            </FieldGroup>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FieldGroup>
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </FieldGroup>
            <FieldGroup>
              <Label>Payment</Label>
              <Select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </FieldGroup>
          <Button type="submit" className="w-full" loading={saving}>
            {editing ? "Save Changes" : "Create Bill"}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete bill"
        description="This can't be undone."
        loading={deleting}
      />
    </div>
  );
}
