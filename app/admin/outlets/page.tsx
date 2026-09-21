"use client";

import { useEffect, useState } from "react";
import { Plus, Store, Pencil, Power } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, FieldGroup, Textarea } from "@/components/ui/Input";
import { Spinner, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";

interface Outlet {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  executiveCount: number;
  todaySales: string;
}

export default function OutletsPage() {
  const { notify } = useToast();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<{ outlets: Outlet[] }>("/api/outlets")
      .then((r) => setOutlets(r.outlets))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setAddress("");
    setModalOpen(true);
  }
  function openEdit(o: Outlet) {
    setEditing(o);
    setName(o.name);
    setAddress(o.address ?? "");
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/outlets/${editing.id}`, { name, address });
        notify("Outlet updated.");
      } else {
        await api.post("/api/outlets", { name, address });
        notify("Outlet created.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save outlet.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(o: Outlet) {
    try {
      await api.patch(`/api/outlets/${o.id}`, { isActive: !o.isActive });
      notify(o.isActive ? "Outlet disabled." : "Outlet enabled.");
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not update outlet.", "error");
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Outlets</h1>
          <p className="text-sm text-ink-500">Manage every branch in your restaurant business.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Outlet
        </Button>
      </div>

      {loading && <Spinner label="Loading outlets..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && outlets.length === 0 && (
        <EmptyState
          icon={Store}
          title="No outlets yet"
          description="Add your first outlet to start recording sales."
          action={{ label: "Add Outlet", onClick: openCreate }}
        />
      )}

      {!loading && !error && outlets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outlets.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{o.name}</p>
                  {o.address && <p className="text-xs text-ink-300">{o.address}</p>}
                </div>
                <Badge tone={o.isActive ? "success" : "neutral"}>{o.isActive ? "Active" : "Disabled"}</Badge>
              </div>
              <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2.5 text-sm">
                <span className="text-ink-500">{o.executiveCount} executive{o.executiveCount === 1 ? "" : "s"}</span>
                <span className="font-semibold text-ink-900">{formatMoney(o.todaySales)} today</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(o)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => toggleActive(o)}>
                  <Power className="h-3.5 w-3.5" />
                  {o.isActive ? "Disable" : "Enable"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Outlet" : "Add Outlet"}>
        <form onSubmit={save}>
          <FieldGroup>
            <Label>Outlet name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Connaught Place" />
          </FieldGroup>
          <FieldGroup>
            <Label>Address (optional)</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, city" />
          </FieldGroup>
          <Button type="submit" className="w-full" loading={saving}>
            {editing ? "Save Changes" : "Create Outlet"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
