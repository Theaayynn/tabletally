"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    const n = Math.max(0, Math.floor(Number(draft) || 0));
    onChange(n);
    setEditing(false);
  };

  const btnSize = size === "sm" ? "h-8 w-8" : "h-10 w-10 sm:h-9 sm:w-9";
  const numWidth = size === "sm" ? "w-9" : "w-12";

  return (
    <div className="inline-flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className={cn(
          btnSize,
          "flex items-center justify-center rounded-lg border border-slate-200 bg-white text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700 active:scale-95 disabled:opacity-40 disabled:hover:bg-white"
        )}
      >
        <Minus className="h-4 w-4" />
      </button>

      {editing ? (
        <input
          autoFocus
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className={cn(numWidth, "rounded-lg border border-brand-300 text-center text-sm font-semibold text-ink-900 focus:outline-none py-1.5")}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(numWidth, "rounded-lg py-1.5 text-center text-sm font-semibold text-ink-900 hover:bg-slate-100")}
          title="Tap to type a quantity"
        >
          {value}
        </button>
      )}

      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        className={cn(
          btnSize,
          "flex items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-700 transition-colors hover:bg-brand-100 active:scale-95"
        )}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
