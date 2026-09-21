import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { dailyEntries, dailyEntryItems, items, outlets, users } from "@/db/schema";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { requireUser, resolveOutletScope } from "@/lib/api-auth";
import { newId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";
import { businessDateToday } from "@/lib/date-ranges";

// How many days back an EXECUTIVE may create/edit an entry for without an
// admin's help (same-day corrections). Admin can always edit any date.
const EXECUTIVE_EDIT_WINDOW_DAYS = 1;

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const scope = resolveOutletScope(session, searchParams.get("outletId"));
  if (scope.error) return scope.error;

  const executiveId = searchParams.get("executiveId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const conditions = [];
  if (scope.outletId) conditions.push(eq(dailyEntries.outletId, scope.outletId));
  if (executiveId) conditions.push(eq(dailyEntries.executiveId, executiveId));
  if (from) conditions.push(gte(dailyEntries.entryDate, from));
  if (to) conditions.push(lte(dailyEntries.entryDate, to));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: dailyEntries.id,
        entryDate: dailyEntries.entryDate,
        outletId: dailyEntries.outletId,
        outletName: outlets.name,
        executiveId: dailyEntries.executiveId,
        executiveName: users.name,
        totalItems: dailyEntries.totalItems,
        totalQty: dailyEntries.totalQty,
        totalSales: dailyEntries.totalSales,
        isLocked: dailyEntries.isLocked,
        updatedAt: dailyEntries.updatedAt,
      })
      .from(dailyEntries)
      .innerJoin(outlets, eq(dailyEntries.outletId, outlets.id))
      .innerJoin(users, eq(dailyEntries.executiveId, users.id))
      .where(where)
      .orderBy(desc(dailyEntries.entryDate), desc(dailyEntries.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(dailyEntries).where(where),
  ]);

  return NextResponse.json({ entries: rows, total: count, page, pageSize });
}

const lineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(0),
});

const createSchema = z.object({
  outletId: z.string().min(1).optional(), // ignored for executives; required for admin
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "entryDate must be YYYY-MM-DD"),
  items: z.array(lineSchema),
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
  if (!scope.outletId) {
    return NextResponse.json({ error: "Select an outlet." }, { status: 400 });
  }
  const outletId = scope.outletId;

  // Executives may only save today's or yesterday's date, and only while unlocked.
  if (session.role === "EXECUTIVE") {
    const today = businessDateToday();
    const oldestAllowed = new Date(today + "T00:00:00Z");
    oldestAllowed.setUTCDate(oldestAllowed.getUTCDate() - EXECUTIVE_EDIT_WINDOW_DAYS);
    const oldestAllowedStr = oldestAllowed.toISOString().slice(0, 10);
    if (parsed.data.entryDate > today || parsed.data.entryDate < oldestAllowedStr) {
      return NextResponse.json(
        {
          error: `You can only enter sales for today or yesterday. Ask an admin to edit older dates.`,
        },
        { status: 403 }
      );
    }
  }

  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, outletId)).limit(1);
  if (!outlet || !outlet.isActive) {
    return NextResponse.json({ error: "Outlet not found or inactive." }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(dailyEntries)
    .where(and(eq(dailyEntries.outletId, outletId), eq(dailyEntries.entryDate, parsed.data.entryDate)))
    .limit(1);

  if (existing?.isLocked && session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "This day's entry has been locked by an admin and can no longer be edited." },
      { status: 403 }
    );
  }

  const activeLines = parsed.data.items.filter((l) => l.quantity > 0);
  const itemIds = activeLines.map((l) => l.itemId);
  const priceRows = itemIds.length
    ? await db.select({ id: items.id, price: items.price, name: items.name }).from(items).where(inArray(items.id, itemIds))
    : [];
  const priceMap = new Map(priceRows.map((r) => [r.id, r]));

  if (priceRows.length !== new Set(itemIds).size) {
    return NextResponse.json({ error: "One or more selected dishes no longer exist." }, { status: 400 });
  }

  // Always price from the database, never trust a client-submitted price.
  let totalQty = 0;
  let totalSales = 0;
  const linesToInsert = activeLines.map((l) => {
    const item = priceMap.get(l.itemId)!;
    const unitPrice = parseFloat(item.price);
    const lineTotal = Math.round(unitPrice * l.quantity * 100) / 100;
    totalQty += l.quantity;
    totalSales += lineTotal;
    return {
      itemId: l.itemId,
      quantity: l.quantity,
      unitPrice: unitPrice.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
    };
  });

  const entryId = existing?.id ?? newId();

  await db.transaction(async (tx) => {
    if (existing) {
      await tx
        .update(dailyEntries)
        .set({
          totalItems: linesToInsert.length,
          totalQty,
          totalSales: totalSales.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(dailyEntries.id, existing.id));
      await tx.delete(dailyEntryItems).where(eq(dailyEntryItems.dailyEntryId, existing.id));
    } else {
      await tx.insert(dailyEntries).values({
        id: entryId,
        outletId,
        executiveId: session.sub,
        entryDate: parsed.data.entryDate,
        totalItems: linesToInsert.length,
        totalQty,
        totalSales: totalSales.toFixed(2),
      });
    }

    if (linesToInsert.length > 0) {
      await tx.insert(dailyEntryItems).values(
        linesToInsert.map((l) => ({
          id: newId(),
          dailyEntryId: entryId,
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        }))
      );
    }
  });

  await logAudit({
    userId: session.sub,
    action: existing ? "UPDATE" : "CREATE",
    entityType: "daily_entry",
    entityId: entryId,
    outletName: outlet.name,
    summary: `${existing ? "Updated" : "Saved"} ${outlet.name}'s entry for ${parsed.data.entryDate}: ${linesToInsert.length} items, ${totalQty} qty, ₹${totalSales.toFixed(2)}`,
  });

  return NextResponse.json({
    id: entryId,
    totalItems: linesToInsert.length,
    totalQty,
    totalSales: totalSales.toFixed(2),
  });
}
