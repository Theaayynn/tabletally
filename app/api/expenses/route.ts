import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { expenses, outlets, users } from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { requireUser, resolveOutletScope } from "@/lib/api-auth";
import { newId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";

const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"] as const;

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const scope = resolveOutletScope(session, searchParams.get("outletId"));
  if (scope.error) return scope.error;

  const category = searchParams.get("category");
  const paymentMethod = searchParams.get("paymentMethod");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const conditions = [];
  if (scope.outletId) conditions.push(eq(expenses.outletId, scope.outletId));
  if (category) conditions.push(eq(expenses.category, category));
  if (paymentMethod) conditions.push(eq(expenses.paymentMethod, paymentMethod as (typeof PAYMENT_METHODS)[number]));
  if (from) conditions.push(gte(expenses.expenseDate, from));
  if (to) conditions.push(lte(expenses.expenseDate, to));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: expenses.id,
        outletId: expenses.outletId,
        outletName: outlets.name,
        category: expenses.category,
        description: expenses.description,
        amount: expenses.amount,
        paymentMethod: expenses.paymentMethod,
        expenseDate: expenses.expenseDate,
        enteredByName: users.name,
        createdAt: expenses.createdAt,
      })
      .from(expenses)
      .innerJoin(outlets, eq(expenses.outletId, outlets.id))
      .innerJoin(users, eq(expenses.enteredById, users.id))
      .where(where)
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(expenses).where(where),
  ]);

  return NextResponse.json({ expenses: rows, total: count, page, pageSize });
}

const createSchema = z.object({
  outletId: z.string().min(1).optional(),
  category: z.string().min(1, "Category is required."),
  description: z.string().optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0."),
  paymentMethod: z.enum(PAYMENT_METHODS).default("CASH"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const scope = resolveOutletScope(session, parsed.data.outletId ?? null);
  if (scope.error) return scope.error;
  if (!scope.outletId) return NextResponse.json({ error: "Select an outlet." }, { status: 400 });

  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, scope.outletId)).limit(1);
  if (!outlet) return NextResponse.json({ error: "Outlet not found." }, { status: 400 });

  const id = newId();
  await db.insert(expenses).values({
    id,
    outletId: scope.outletId,
    category: parsed.data.category,
    description: parsed.data.description || null,
    amount: parsed.data.amount.toFixed(2),
    paymentMethod: parsed.data.paymentMethod,
    expenseDate: parsed.data.expenseDate,
    enteredById: session.sub,
  });

  await logAudit({
    userId: session.sub,
    action: "CREATE",
    entityType: "expense",
    entityId: id,
    outletName: outlet.name,
    summary: `Created expense ₹${parsed.data.amount.toFixed(2)} (${parsed.data.category}) at ${outlet.name}`,
  });

  return NextResponse.json({ id }, { status: 201 });
}
