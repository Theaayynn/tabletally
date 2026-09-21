import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, outlets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  outletId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(8).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const [before] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, params.id), eq(users.role, "EXECUTIVE")))
    .limit(1);
  if (!before) return NextResponse.json({ error: "Executive not found." }, { status: 404 });

  if (parsed.data.outletId) {
    const [outlet] = await db.select().from(outlets).where(eq(outlets.id, parsed.data.outletId)).limit(1);
    if (!outlet) return NextResponse.json({ error: "Selected outlet was not found." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.outletId) updates.outletId = parsed.data.outletId;
  if (typeof parsed.data.isActive === "boolean") updates.isActive = parsed.data.isActive;
  if (parsed.data.newPassword) updates.passwordHash = await hashPassword(parsed.data.newPassword);

  await db.update(users).set(updates).where(eq(users.id, params.id));

  await logAudit({
    userId: session!.sub,
    action: "UPDATE",
    entityType: "executive",
    entityId: params.id,
    summary: `Updated executive "${before.name}"`,
    before: { name: before.name, outletId: before.outletId, isActive: before.isActive },
    after: { ...updates, passwordHash: undefined },
  });

  return NextResponse.json({ ok: true });
}
