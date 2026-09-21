"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api-client";

interface Me {
  name: string;
  email: string;
  role: string;
  outletName: string | null;
}

export default function ProfilePage() {
  const { notify } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ user: Me }>("/api/auth/me").then((r) => setMe(r.user));
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      notify("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not update password.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!me) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight text-ink-900">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Name" value={me.name} />
          <Row label="Email" value={me.email} />
          <Row label="Role" value={me.role === "ADMIN" ? "Admin" : "Executive"} />
          <Row label="Outlet" value={me.outletName ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword}>
            <FieldGroup>
              <Label>Current password</Label>
              <Input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </FieldGroup>
            <FieldGroup>
              <Label>New password</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </FieldGroup>
            <Button type="submit" loading={saving}>
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 py-2 last:border-0">
      <span className="text-ink-300">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}
