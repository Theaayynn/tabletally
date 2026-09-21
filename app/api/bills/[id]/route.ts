import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { bills } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"] as const;
const STATUSES = ["PAID", "PENDING", "PARTIALLY_PAID"] as const;

const updateSchema = z.object({
  billNumber: z.string().min(1).optional(),
  vendor: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(STATUSES).optional(),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const [before] = await db.select().from(bills).where(eq(bills.id, params.id)).limit(1);
  if (!before) return NextResponse.json({ error: "Bill not found." }, { status: 404 });

  const { amount, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (amount !== undefined) updates.amount = amount.toFixed(2);

  await db.update(bills).set(updates).where(eq(bills.id, params.id));

  await logAudit({
    userId: session!.sub,
    action: "UPDATE",
    entityType: "bill",
    entityId: params.id,
    summary: `Edited bill ${before.billNumber}`,
    before,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const [bill] = await db.select().from(bills).where(eq(bills.id, params.id)).limit(1);
  if (!bill) return NextResponse.json({ error: "Bill not found." }, { status: 404 });

  await db.delete(bills).where(eq(bills.id, params.id));

  await logAudit({
    userId: session!.sub,
    action: "DELETE",
    entityType: "bill",
    entityId: params.id,
    summary: `Deleted bill ${bill.billNumber}`,
    before: bill,
  });

  return NextResponse.json({ ok: true });
}
