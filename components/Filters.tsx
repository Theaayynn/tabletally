"use client";

import { useEffect, useState } from "react";
import { Select } from "./ui/Input";
import { useOutlet } from "./OutletContext";
import { api } from "@/lib/api-client";
import { RANGE_OPTIONS, RangeKey } from "@/lib/date-ranges";

interface OutletOption {
  id: string;
  name: string;
}

export function OutletSelect() {
  const { role, selectedOutletId, setSelectedOutletId } = useOutlet();
  const [outlets, setOutlets] = useState<OutletOption[]>([]);

  useEffect(() => {
    api.get<{ outlets: OutletOption[] }>("/api/outlets").then((r) => setOutlets(r.outlets)).catch(() => {});
  }, []);

  if (role === "EXECUTIVE") return null;

  return (
    <Select
      value={selectedOutletId ?? "all"}
      onChange={(e) => setSelectedOutletId(e.target.value === "all" ? null : e.target.value)}
      className="w-auto min-w-[150px]"
    >
      <option value="all">All Outlets</option>
      {outlets.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </Select>
  );
}

export function DateRangeSelect({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  value: RangeKey;
  onChange: (key: RangeKey) => void;
  customFrom?: string;
  customTo?: string;
  onCustomChange?: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value} onChange={(e) => onChange(e.target.value as RangeKey)} className="w-auto min-w-[150px]">
        {RANGE_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </Select>
      {value === "custom" && onCustomChange && (
        <>
          <input
            type="date"
            value={customFrom ?? ""}
            onChange={(e) => onCustomChange(e.target.value, customTo ?? "")}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
          <span className="text-ink-300">to</span>
          <input
            type="date"
            value={customTo ?? ""}
            onChange={(e) => onCustomChange(customFrom ?? "", e.target.value)}
            className="h-10 rounded-xl border border-slate-200 px-3 text-sm"
          />
        </>
      )}
    </div>
  );
}
