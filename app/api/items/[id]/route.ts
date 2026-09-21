import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { items, itemOutlets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { newId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  costPrice: z.number().nonnegative().nullable().optional(),
  sku: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  outletIds: z.array(z.string()).optional(),
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

  const [before] = await db.select().from(items).where(eq(items.id, params.id)).limit(1);
  if (!before) return NextResponse.json({ error: "Dish not found." }, { status: 404 });

  const { outletIds, price, costPrice, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (price !== undefined) updates.price = price.toFixed(2);
  if (costPrice !== undefined) updates.costPrice = costPrice === null ? null : costPrice.toFixed(2);

  await db.update(items).set(updates).where(eq(items.id, params.id));

  if (outletIds !== undefined) {
    await db.delete(itemOutlets).where(eq(itemOutlets.itemId, params.id));
    if (outletIds.length > 0) {
      await db.insert(itemOutlets).values(
        outletIds.map((oid) => ({ id: newId(), itemId: params.id, outletId: oid }))
      );
    }
  }

  await logAudit({
    userId: session!.sub,
    action: "UPDATE",
    entityType: "item",
    entityId: params.id,
    summary:
      price !== undefined && before.price !== price.toFixed(2)
        ? `Changed price of "${before.name}": ${before.price} → ${price.toFixed(2)}`
        : `Updated dish "${before.name}"`,
    before,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const [item] = await db.select().from(items).where(eq(items.id, params.id)).limit(1);
  if (!item) return NextResponse.json({ error: "Dish not found." }, { status: 404 });

  try {
    await db.delete(items).where(eq(items.id, params.id));
  } catch {
    await db.update(items).set({ isActive: false, updatedAt: new Date() }).where(eq(items.id, params.id));
    return NextResponse.json({
      ok: true,
      disabledInstead: true,
      message: "This dish has entries in sales history, so it was disabled instead of deleted.",
    });
  }

  await logAudit({
    userId: session!.sub,
    action: "DELETE",
    entityType: "item",
    entityId: params.id,
    summary: `Deleted dish "${item.name}"`,
  });

  return NextResponse.json({ ok: true });
}
