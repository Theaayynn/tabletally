import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { bills, outlets } from "@/db/schema";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { newId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";

const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"] as const;
const STATUSES = ["PAID", "PENDING", "PARTIALLY_PAID"] as const;

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get("outletId");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const conditions = [];
  if (outletId) conditions.push(eq(bills.outletId, outletId));
  if (status) conditions.push(eq(bills.status, status as (typeof STATUSES)[number]));
  if (from) conditions.push(gte(bills.billDate, from));
  if (to) conditions.push(lte(bills.billDate, to));
  if (search) {
    conditions.push(
      or(ilike(bills.billNumber, `%${search}%`), ilike(bills.vendor, `%${search}%`))
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: bills.id,
        billNumber: bills.billNumber,
        outletId: bills.outletId,
        outletName: outlets.name,
        vendor: bills.vendor,
        description: bills.description,
        category: bills.category,
        amount: bills.amount,
        paymentMethod: bills.paymentMethod,
        status: bills.status,
        billDate: bills.billDate,
        notes: bills.notes,
      })
      .from(bills)
      .innerJoin(outlets, eq(bills.outletId, outlets.id))
      .where(where)
      .orderBy(desc(bills.billDate))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(bills).where(where),
  ]);

  return NextResponse.json({ bills: rows, total: count, page, pageSize });
}

const createSchema = z.object({
  billNumber: z.string().min(1, "Bill number is required."),
  outletId: z.string().min(1, "Outlet is required."),
  vendor: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  amount: z.number().positive("Amount must be greater than 0."),
  paymentMethod: z.enum(PAYMENT_METHODS).default("CASH"),
  status: z.enum(STATUSES).default("PENDING"),
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, parsed.data.outletId)).limit(1);
  if (!outlet) return NextResponse.json({ error: "Outlet not found." }, { status: 400 });

  const id = newId();
  try {
    await db.insert(bills).values({
      id,
      billNumber: parsed.data.billNumber,
      outletId: parsed.data.outletId,
      vendor: parsed.data.vendor || null,
      description: parsed.data.description || null,
      category: parsed.data.category || null,
      amount: parsed.data.amount.toFixed(2),
      paymentMethod: parsed.data.paymentMethod,
      status: parsed.data.status,
      billDate: parsed.data.billDate,
      notes: parsed.data.notes || null,
      createdById: session!.sub,
    });
  } catch {
    return NextResponse.json(
      { error: "That bill number already exists for this outlet." },
      { status: 409 }
    );
  }

  await logAudit({
    userId: session!.sub,
    action: "CREATE",
    entityType: "bill",
    entityId: id,
    outletName: outlet.name,
    summary: `Created bill ${parsed.data.billNumber} (₹${parsed.data.amount.toFixed(2)}) at ${outlet.name}`,
  });

  return NextResponse.json({ id }, { status: 201 });
}
