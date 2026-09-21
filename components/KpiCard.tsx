import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "./ui/Card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  changePercent,
  icon: Icon,
  iconTone = "brand",
}: {
  label: string;
  value: string;
  changePercent?: number | null;
  icon: LucideIcon;
  iconTone?: "brand" | "emerald" | "rose" | "amber";
}) {
  const toneClasses: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
  };

  const hasChange = changePercent !== null && changePercent !== undefined;
  const positive = hasChange && changePercent! >= 0;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClasses[iconTone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {hasChange && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-xs font-medium",
            positive ? "text-emerald-600" : "text-rose-600"
          )}
        >
          {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {Math.abs(changePercent!).toFixed(1)}% vs previous period
        </div>
      )}
    </Card>
  );
}
