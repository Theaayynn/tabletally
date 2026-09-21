import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminShell } from "@/components/AdminShell";
import { ToastProvider } from "@/components/ui/Toast";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login");

  return (
    <ToastProvider>
      <AdminShell user={{ name: session.name, email: session.email }}>{children}</AdminShell>
    </ToastProvider>
  );
}
