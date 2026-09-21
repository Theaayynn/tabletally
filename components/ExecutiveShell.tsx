"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ClipboardList, History, FileBarChart, UserCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { OutletProvider } from "./OutletContext";

const NAV = [
  { href: "/executive", label: "Dashboard", icon: LayoutDashboard },
  { href: "/executive/entry", label: "Today's Entry", icon: ClipboardList },
  { href: "/executive/history", label: "History", icon: History },
  { href: "/executive/reports", label: "Reports", icon: FileBarChart },
  { href: "/executive/profile", label: "Profile", icon: UserCircle },
];

export function ExecutiveShell({
  user,
  outletId,
  outletName,
  children,
}: {
  user: { name: string; email: string };
  outletId: string | null;
  outletName: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/executive" ? pathname === href : pathname.startsWith(href));

  return (
    <OutletProvider role="EXECUTIVE" assignedOutletId={outletId}>
      <div className="min-h-screen bg-surface pb-20 md:pb-0 md:flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-100 bg-white md:flex">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              T
            </div>
            <span className="text-sm font-semibold tracking-tight text-ink-900">TableTally</span>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-slate-50 hover:text-ink-900"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-100 p-3">
            <p className="px-2 text-sm font-medium text-ink-900">{user.name}</p>
            <p className="truncate px-2 text-xs text-ink-300">{outletName ?? "No outlet assigned"}</p>
            <button
              onClick={logout}
              className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </aside>

        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 md:hidden">
          <div>
            <p className="text-sm font-semibold text-ink-900">{user.name}</p>
            <p className="text-xs text-ink-300">{outletName ?? "No outlet assigned"}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-ink-500 hover:bg-slate-100" aria-label="Log out">
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-100 bg-white/95 backdrop-blur md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                isActive(item.href) ? "text-brand-600" : "text-ink-300"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </OutletProvider>
  );
}
