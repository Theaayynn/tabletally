import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { dailyEntries, dailyEntryItems, items, outlets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, requireUser } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireUser();
  if (error) return error;

  const [entry] = await db.select().from(dailyEntries).where(eq(dailyEntries.id, params.id)).limit(1);
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  if (session.role === "EXECUTIVE" && entry.outletId !== session.outletId) {
    return NextResponse.json({ error: "You can't view another outlet's entry." }, { status: 403 });
  }

  const lines = await db
    .select({
      itemId: dailyEntryItems.itemId,
      quantity: dailyEntryItems.quantity,
      unitPrice: dailyEntryItems.unitPrice,
      lineTotal: dailyEntryItems.lineTotal,
      name: items.name,
    })
    .from(dailyEntryItems)
    .innerJoin(items, eq(dailyEntryItems.itemId, items.id))
    .where(eq(dailyEntryItems.dailyEntryId, entry.id));

  return NextResponse.json({ entry, items: lines });
}

const lockSchema = z.object({ isLocked: z.boolean() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = lockSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const [entry] = await db.select().from(dailyEntries).where(eq(dailyEntries.id, params.id)).limit(1);
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  await db
    .update(dailyEntries)
    .set({ isLocked: parsed.data.isLocked, updatedAt: new Date() })
    .where(eq(dailyEntries.id, params.id));

  await logAudit({
    userId: session!.sub,
    action: "UPDATE",
    entityType: "daily_entry",
    entityId: params.id,
    summary: `${parsed.data.isLocked ? "Locked" : "Unlocked"} entry for ${entry.entryDate}`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const [entry] = await db.select().from(dailyEntries).where(eq(dailyEntries.id, params.id)).limit(1);
  if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, entry.outletId)).limit(1);

  await db.delete(dailyEntries).where(eq(dailyEntries.id, params.id));

  await logAudit({
    userId: session!.sub,
    action: "DELETE",
    entityType: "daily_entry",
    entityId: params.id,
    outletName: outlet?.name,
    summary: `Deleted ${outlet?.name ?? "outlet"}'s entry for ${entry.entryDate}`,
  });

  return NextResponse.json({ ok: true });
}
