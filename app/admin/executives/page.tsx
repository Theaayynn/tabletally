"use client";

import { useEffect, useState } from "react";
import { Plus, Users, KeyRound, Power } from "lucide-react";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, FieldGroup, Select } from "@/components/ui/Input";
import { Spinner, ErrorState, EmptyState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api-client";

interface Executive {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  outletId: string | null;
  outletName: string | null;
}
interface Outlet {
  id: string;
  name: string;
}

export default function ExecutivesPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<Executive[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Executive | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [outletId, setOutletId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get<{ executives: Executive[] }>("/api/executives"),
      api.get<{ outlets: Outlet[] }>("/api/outlets"),
    ])
      .then(([e, o]) => {
        setRows(e.executives);
        setOutlets(o.outlets);
        if (o.outlets[0]) setOutletId((id) => id || o.outlets[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function createExecutive(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/executives", { name, email, password, outletId });
      notify("Executive created.");
      setCreateOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not create executive.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function reassignOutlet(exec: Executive, newOutletId: string) {
    try {
      await api.patch(`/api/executives/${exec.id}`, { outletId: newOutletId });
      notify(`${exec.name} reassigned.`);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not reassign.", "error");
    }
  }

  async function toggleActive(exec: Executive) {
    try {
      await api.patch(`/api/executives/${exec.id}`, { isActive: !exec.isActive });
      notify(exec.isActive ? "Executive deactivated." : "Executive activated.");
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not update.", "error");
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    try {
      await api.patch(`/api/executives/${resetTarget.id}`, { newPassword });
      notify("Password reset.");
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not reset password.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Executives</h1>
          <p className="text-sm text-ink-500">Staff accounts and their outlet assignments.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={outlets.length === 0}>
          <Plus className="h-4 w-4" />
          Add Executive
        </Button>
      </div>

      {loading && <Spinner label="Loading executives..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && outlets.length === 0 && (
        <EmptyState title="Create an outlet first" description="You need at least one outlet before adding executives." />
      )}
      {!loading && !error && outlets.length > 0 && rows.length === 0 && (
        <EmptyState
          icon={Users}
          title="No executives yet"
          description="Add executive accounts so staff can log in and enter sales."
          action={{ label: "Add Executive", onClick: () => setCreateOpen(true) }}
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-ink-300">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Outlet</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink-900">{r.name}</td>
                  <td className="px-4 py-3 text-ink-500">{r.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={r.outletId ?? ""}
                      onChange={(e) => reassignOutlet(r, e.target.value)}
                      className="h-8 w-auto text-xs"
                    >
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Disabled"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setResetTarget(r)}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Executive">
        <form onSubmit={createExecutive}>
          <FieldGroup>
            <Label>Full name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label>Temporary password</Label>
            <Input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </FieldGroup>
          <FieldGroup>
            <Label>Assigned outlet</Label>
            <Select required value={outletId} onChange={(e) => setOutletId(e.target.value)}>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <Button type="submit" className="w-full" loading={saving}>
            Create Executive
          </Button>
        </form>
      </Modal>

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Reset password — ${resetTarget?.name ?? ""}`}>
        <form onSubmit={resetPassword}>
          <FieldGroup>
            <Label>New password</Label>
            <Input type="text" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </FieldGroup>
          <Button type="submit" className="w-full" loading={saving}>
            Reset Password
          </Button>
        </form>
      </Modal>
    </div>
  );
}
