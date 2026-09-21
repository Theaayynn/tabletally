"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Users,
  UtensilsCrossed,
  Receipt,
  Wallet,
  FileBarChart,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { OutletProvider } from "./OutletContext";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/sales", label: "Daily Entries", icon: History },
  { href: "/admin/dishes", label: "Dishes & Menu", icon: UtensilsCrossed },
  { href: "/admin/outlets", label: "Outlets", icon: Store },
  { href: "/admin/executives", label: "Executives", icon: Users },
  { href: "/admin/bills", label: "Bills", icon: Receipt },
  { href: "/admin/expenses", label: "Expenses", icon: Wallet },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: History },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function logout() {
    await api.post("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  return (
    <OutletProvider role="ADMIN" assignedOutletId={null}>
      <div className="min-h-screen bg-surface md:flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-100 bg-white md:flex">
          <Brand />
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {NAV.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>
          <UserFooter user={user} onLogout={logout} />
        </aside>

        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 md:hidden">
          <Brand compact />
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-ink-700 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-ink-900/40" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-3">
                <Brand compact />
                <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" onClick={() => setDrawerOpen(false)}>
                {NAV.map((item) => (
                  <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
                ))}
              </nav>
              <UserFooter user={user} onLogout={logout} />
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </OutletProvider>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 px-5", compact ? "py-0" : "py-5")}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
        T
      </div>
      <span className="text-sm font-semibold tracking-tight text-ink-900">TableTally</span>
    </div>
  );
}

function SidebarLink({
  item,
  active,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-slate-50 hover:text-ink-900"
      )}
    >
      <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
      {item.label}
    </Link>
  );
}

function UserFooter({ user, onLogout }: { user: { name: string; email: string }; onLogout: () => void }) {
  return (
    <div className="border-t border-slate-100 p-3">
      <Link
        href="/admin/profile"
        className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <UserCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">{user.name}</p>
          <p className="truncate text-xs text-ink-300">{user.email}</p>
        </div>
      </Link>
      <button
        onClick={onLogout}
        className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-500 hover:bg-slate-50"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </div>
  );
}
