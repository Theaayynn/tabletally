import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  bills,
  categories,
  dailyEntries,
  dailyEntryItems,
  expenses,
  items,
  outlets,
  users,
} from "@/db/schema";
import { and, asc, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { requireUser, resolveOutletScope } from "@/lib/api-auth";
import { resolveRange, RangeKey } from "@/lib/date-ranges";
import { toCsv } from "@/lib/csv";

const REPORT_TYPES = ["sales", "items", "outlet", "executive", "expense", "bills"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as ReportType;
  if (!REPORT_TYPES.includes(type)) {
    return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
  }

  // Bills are an admin/back-office report; everything else is available to
  // executives too, scoped to their own outlet.
  if (type === "bills" && session.role !== "ADMIN") {
    return NextResponse.json({ error: "Bills reports are admin-only." }, { status: 403 });
  }

  const rangeKey = (searchParams.get("range") ?? "this_month") as RangeKey;
  const range = resolveRange(rangeKey, {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!range) return NextResponse.json({ error: "Invalid date range." }, { status: 400 });

  const scope = resolveOutletScope(session, searchParams.get("outletId"));
  if (scope.error) return scope.error;
  const outletId = scope.outletId;
  const format = searchParams.get("format") === "csv" ? "csv" : "json";

  let rows: Record<string, unknown>[] = [];
  let filename = `${type}-report.csv`;

  if (type === "sales") {
    const executiveId = searchParams.get("executiveId");
    const conditions = [gte(dailyEntries.entryDate, range.from), lte(dailyEntries.entryDate, range.to)];
    if (outletId) conditions.push(eq(dailyEntries.outletId, outletId));
    if (executiveId) conditions.push(eq(dailyEntries.executiveId, executiveId));

    const data = await db
      .select({
        date: dailyEntries.entryDate,
        outlet: outlets.name,
        executive: users.name,
        totalItems: dailyEntries.totalItems,
        totalQty: dailyEntries.totalQty,
        totalSales: dailyEntries.totalSales,
      })
      .from(dailyEntries)
      .innerJoin(outlets, eq(dailyEntries.outletId, outlets.id))
      .innerJoin(users, eq(dailyEntries.executiveId, users.id))
      .where(and(...conditions))
      .orderBy(desc(dailyEntries.entryDate));
    rows = data;
    filename = "sales-report.csv";
  } else if (type === "items") {
    const itemId = searchParams.get("itemId");
    const categoryId = searchParams.get("categoryId");
    const conditions = [gte(dailyEntries.entryDate, range.from), lte(dailyEntries.entryDate, range.to)];
    if (outletId) conditions.push(eq(dailyEntries.outletId, outletId));
    if (itemId) conditions.push(eq(items.id, itemId));
    if (categoryId) conditions.push(eq(items.categoryId, categoryId));

    const data = await db
      .select({
        item: items.name,
        category: categories.name,
        quantitySold: sql<number>`coalesce(sum(${dailyEntryItems.quantity}), 0)`.mapWith(Number),
        totalSales: sql<string>`coalesce(sum(${dailyEntryItems.lineTotal}), 0)`,
      })
      .from(dailyEntryItems)
      .innerJoin(dailyEntries, eq(dailyEntryItems.dailyEntryId, dailyEntries.id))
      .innerJoin(items, eq(dailyEntryItems.itemId, items.id))
      .innerJoin(categories, eq(items.categoryId, categories.id))
      .where(and(...conditions))
      .groupBy(items.id, items.name, categories.name)
      .orderBy(desc(sql`sum(${dailyEntryItems.quantity})`));
    rows = data;
    filename = "item-report.csv";
  } else if (type === "outlet") {
    if (session.role === "EXECUTIVE") {
      return NextResponse.json({ error: "Outlet reports are admin-only." }, { status: 403 });
    }
    const data = await db
      .select({
        outlet: outlets.name,
        totalSales: sql<string>`coalesce(sum(${dailyEntries.totalSales}), 0)`,
        itemsSold: sql<number>`coalesce(sum(${dailyEntries.totalQty}), 0)`.mapWith(Number),
        daysRecorded: sql<number>`count(${dailyEntries.id})`.mapWith(Number),
      })
      .from(outlets)
      .leftJoin(
        dailyEntries,
        and(eq(dailyEntries.outletId, outlets.id), gte(dailyEntries.entryDate, range.from), lte(dailyEntries.entryDate, range.to))
      )
      .groupBy(outlets.id, outlets.name)
      .orderBy(desc(sql`coalesce(sum(${dailyEntries.totalSales}), 0)`));
    rows = data;
    filename = "outlet-report.csv";
  } else if (type === "executive") {
    if (session.role === "EXECUTIVE") {
      return NextResponse.json({ error: "Executive reports are admin-only." }, { status: 403 });
    }
    const conditions = [gte(dailyEntries.entryDate, range.from), lte(dailyEntries.entryDate, range.to)];
    if (outletId) conditions.push(eq(dailyEntries.outletId, outletId));
    const data = await db
      .select({
        executive: users.name,
        outlet: outlets.name,
        entriesLogged: sql<number>`count(${dailyEntries.id})`.mapWith(Number),
        itemsSold: sql<number>`coalesce(sum(${dailyEntries.totalQty}), 0)`.mapWith(Number),
        totalSales: sql<string>`coalesce(sum(${dailyEntries.totalSales}), 0)`,
      })
      .from(dailyEntries)
      .innerJoin(users, eq(dailyEntries.executiveId, users.id))
      .innerJoin(outlets, eq(dailyEntries.outletId, outlets.id))
      .where(and(...conditions))
      .groupBy(users.id, users.name, outlets.name)
      .orderBy(desc(sql`sum(${dailyEntries.totalSales})`));
    rows = data;
    filename = "executive-report.csv";
  } else if (type === "expense") {
    const category = searchParams.get("category");
    const conditions = [gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to)];
    if (outletId) conditions.push(eq(expenses.outletId, outletId));
    if (category) conditions.push(eq(expenses.category, category));
    const data = await db
      .select({
        date: expenses.expenseDate,
        outlet: outlets.name,
        category: expenses.category,
        description: expenses.description,
        amount: expenses.amount,
        paymentMethod: expenses.paymentMethod,
        enteredBy: users.name,
      })
      .from(expenses)
      .innerJoin(outlets, eq(expenses.outletId, outlets.id))
      .innerJoin(users, eq(expenses.enteredById, users.id))
      .where(and(...conditions))
      .orderBy(desc(expenses.expenseDate));
    rows = data;
    filename = "expense-report.csv";
  } else if (type === "bills") {
    const search = searchParams.get("search")?.trim();
    const conditions = [gte(bills.billDate, range.from), lte(bills.billDate, range.to)];
    if (outletId) conditions.push(eq(bills.outletId, outletId));
    if (search) conditions.push(ilike(bills.billNumber, `%${search}%`));
    const data = await db
      .select({
        billNumber: bills.billNumber,
        date: bills.billDate,
        outlet: outlets.name,
        vendor: bills.vendor,
        category: bills.category,
        amount: bills.amount,
        status: bills.status,
        paymentMethod: bills.paymentMethod,
      })
      .from(bills)
      .innerJoin(outlets, eq(bills.outletId, outlets.id))
      .where(and(...conditions))
      .orderBy(desc(bills.billDate));
    rows = data;
    filename = "bills-report.csv";
  }

  if (format === "csv") {
    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ range, rows });
}
