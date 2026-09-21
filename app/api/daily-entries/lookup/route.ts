import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dailyEntries, dailyEntryItems, items } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser, resolveOutletScope } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required." }, { status: 400 });

  const scope = resolveOutletScope(session, searchParams.get("outletId"));
  if (scope.error) return scope.error;
  if (!scope.outletId) return NextResponse.json({ error: "Select an outlet." }, { status: 400 });

  const [entry] = await db
    .select()
    .from(dailyEntries)
    .where(and(eq(dailyEntries.outletId, scope.outletId), eq(dailyEntries.entryDate, date)))
    .limit(1);

  if (!entry) {
    return NextResponse.json({ entry: null, items: [] });
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
