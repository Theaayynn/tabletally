import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { outlets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const [before] = await db.select().from(outlets).where(eq(outlets.id, params.id)).limit(1);
  if (!before) return NextResponse.json({ error: "Outlet not found." }, { status: 404 });

  await db
    .update(outlets)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(outlets.id, params.id));

  await logAudit({
    userId: session!.sub,
    action: "UPDATE",
    entityType: "outlet",
    entityId: params.id,
    outletName: before.name,
    summary: `Updated outlet "${before.name}"`,
    before,
    after: { ...before, ...parsed.data },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, params.id)).limit(1);
  if (!outlet) return NextResponse.json({ error: "Outlet not found." }, { status: 404 });

  try {
    await db.delete(outlets).where(eq(outlets.id, params.id));
  } catch {
    // Foreign-key constraint: outlet has related executives / entries / bills / expenses.
    await db.update(outlets).set({ isActive: false, updatedAt: new Date() }).where(eq(outlets.id, params.id));
    await logAudit({
      userId: session!.sub,
      action: "UPDATE",
      entityType: "outlet",
      entityId: params.id,
      outletName: outlet.name,
      summary: `"${outlet.name}" has existing records, so it was disabled instead of deleted`,
    });
    return NextResponse.json({
      ok: true,
      disabledInstead: true,
      message: "This outlet has historical records, so it was disabled instead of permanently deleted.",
    });
  }

  await logAudit({
    userId: session!.sub,
    action: "DELETE",
    entityType: "outlet",
    entityId: params.id,
    outletName: outlet.name,
    summary: `Deleted outlet "${outlet.name}"`,
  });

  return NextResponse.json({ ok: true });
}
