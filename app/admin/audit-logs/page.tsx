"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Card, Badge } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { Spinner, ErrorState, EmptyState, Pagination } from "@/components/ui/States";

import { api } from "@/lib/api-client";

const ENTITY_TYPES = [
  "outlet",
  "executive",
  "category",
  "item",
  "daily_entry",
  "expense",
  "bill",
  "user",
  "settings",
];

const actionTone: Record<string, "success" | "brand" | "danger" | "neutral" | "warning"> = {
  CREATE: "success",
  UPDATE: "brand",
  DELETE: "danger",
  LOGIN: "neutral",
  CONFIG_CHANGE: "warning",
};

interface LogRow {
  id: string;
  action: string;
  entityType: string;
  outletName: string | null;
  summary: string;
  createdAt: string;
  userName: string | null;
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (entityType) params.set("entityType", entityType);
    api
      .get<{ logs: LogRow[]; total: number }>(`/api/audit-logs?${params.toString()}`)
      .then((r) => {
        setRows(r.logs);
        setTotal(r.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, entityType]);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Audit Logs</h1>
          <p className="text-sm text-ink-500">Every important change, who made it, and when.</p>
        </div>
        <Select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="w-auto">
          <option value="">All types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </Select>
      </div>

      {loading && <Spinner label="Loading logs..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && rows.length === 0 && <EmptyState icon={History} title="No activity yet" />}

      {!loading && !error && rows.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm text-ink-900">{r.summary}</p>
                  <p className="mt-0.5 text-xs text-ink-300">
                    {r.userName ?? "System"}
                    {r.outletName ? ` · ${r.outletName}` : ""} ·{" "}
                    {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <Badge tone={actionTone[r.action] ?? "neutral"}>{r.action}</Badge>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={25} total={total} onPageChange={setPage} />
        </Card>
      )}
    </div>
  );
}
