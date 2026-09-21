import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"] as const;

const updateSchema = z.object({
  category: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const [before] = await db.select().from(expenses).where(eq(expenses.id, params.id)).limit(1);
  if (!before) return NextResponse.json({ error: "Expense not found." }, { status: 404 });

  const { amount, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (amount !== undefined) updates.amount = amount.toFixed(2);

  await db.update(expenses).set(updates).where(eq(expenses.id, params.id));

  await logAudit({
    userId: session!.sub,
    action: "UPDATE",
    entityType: "expense",
    entityId: params.id,
    summary: `Edited expense (was ₹${before.amount}, ${before.category})`,
    before,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, params.id)).limit(1);
  if (!expense) return NextResponse.json({ error: "Expense not found." }, { status: 404 });

  await db.delete(expenses).where(eq(expenses.id, params.id));

  await logAudit({
    userId: session!.sub,
    action: "DELETE",
    entityType: "expense",
    entityId: params.id,
    summary: `Deleted expense ₹${expense.amount} (${expense.category})`,
    before: expense,
  });

  return NextResponse.json({ ok: true });
}
