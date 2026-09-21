import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { outlets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExecutiveShell } from "@/components/ExecutiveShell";
import { ToastProvider } from "@/components/ui/Toast";

export default async function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "EXECUTIVE") redirect("/login");

  let outletName: string | null = null;
  if (session.outletId) {
    const [outlet] = await db.select().from(outlets).where(eq(outlets.id, session.outletId)).limit(1);
    outletName = outlet?.name ?? null;
  }

  return (
    <ToastProvider>
      <ExecutiveShell
        user={{ name: session.name, email: session.email }}
        outletId={session.outletId}
        outletName={outletName}
      >
        {children}
      </ExecutiveShell>
    </ToastProvider>
  );
}
