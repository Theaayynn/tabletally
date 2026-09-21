"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldGroup } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api-client";

interface Settings {
  taxPercent: string;
  currency: string;
}

export default function SettingsPage() {
  const { notify } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [taxPercent, setTaxPercent] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ settings: Settings }>("/api/settings").then((r) => {
      setSettings(r.settings);
      setTaxPercent(r.settings.taxPercent);
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/api/settings", { taxPercent: parseFloat(taxPercent) });
      notify("Settings saved.");
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Could not save settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <Spinner />;

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold tracking-tight text-ink-900">Settings</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Business Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save}>
            <FieldGroup>
              <Label>Tax / GST percentage</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-ink-300">
                Kept configurable rather than hardcoded — currently applied nowhere automatically; wire it into
                billing if your outlets charge tax.
              </p>
            </FieldGroup>
            <Button type="submit" loading={saving}>
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
