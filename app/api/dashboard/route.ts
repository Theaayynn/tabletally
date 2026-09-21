import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dailyEntries, dailyEntryItems, expenses, items, outlets } from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { requireUser, resolveOutletScope } from "@/lib/api-auth";
import { RangeKey, percentChange, previousPeriod, resolveRange } from "@/lib/date-ranges";

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const rangeKey = (searchParams.get("range") ?? "this_month") as RangeKey;
  const granularity = (searchParams.get("granularity") ?? "daily") as "daily" | "weekly" | "monthly";
  const range = resolveRange(rangeKey, {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!range) {
    return NextResponse.json({ error: "Invalid or missing date range." }, { status: 400 });
  }

  const scope = resolveOutletScope(session, searchParams.get("outletId"));
  if (scope.error) return scope.error;
  const outletId = scope.outletId; // null = all outlets (admin only)

  const entryDateFilter = [gte(dailyEntries.entryDate, range.from), lte(dailyEntries.entryDate, range.to)];
  const entryWhere = outletId
    ? and(eq(dailyEntries.outletId, outletId), ...entryDateFilter)
    : and(...entryDateFilter);

  const expenseDateFilter = [gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to)];
  const expenseWhere = outletId
    ? and(eq(expenses.outletId, outletId), ...expenseDateFilter)
    : and(...expenseDateFilter);

  async function kpisFor(where: ReturnType<typeof and>) {
    const [salesRow] = await db
      .select({
        totalSales: sql<string>`coalesce(sum(${dailyEntries.totalSales}), 0)`,
        totalEntries: sql<number>`count(*)`.mapWith(Number),
        totalItemsSold: sql<number>`coalesce(sum(${dailyEntries.totalQty}), 0)`.mapWith(Number),
      })
      .from(dailyEntries)
      .where(where);
    return salesRow;
  }

  const [current, expenseRow] = await Promise.all([
    kpisFor(entryWhere),
    db
      .select({ totalExpenses: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(expenseWhere)
      .then((r) => r[0]),
  ]);

  const totalSales = parseFloat(current.totalSales);
  const totalExpenses = parseFloat(expenseRow.totalExpenses);
  const netAmount = totalSales - totalExpenses;

  // % change vs the immediately preceding period of equal length — only when
  // there is a meaningful prior period (never fabricated for "all time").
  let comparison: { salesChange: number | null; expenseChange: number | null } = {
    salesChange: null,
    expenseChange: null,
  };
  if (rangeKey !== "all_time") {
    const prev = previousPeriod(range);
    const prevEntryWhere = outletId
      ? and(eq(dailyEntries.outletId, outletId), gte(dailyEntries.entryDate, prev.from), lte(dailyEntries.entryDate, prev.to))
      : and(gte(dailyEntries.entryDate, prev.from), lte(dailyEntries.entryDate, prev.to));
    const prevExpenseWhere = outletId
      ? and(eq(expenses.outletId, outletId), gte(expenses.expenseDate, prev.from), lte(expenses.expenseDate, prev.to))
      : and(gte(expenses.expenseDate, prev.from), lte(expenses.expenseDate, prev.to));

    const [prevSales, prevExpense] = await Promise.all([
      kpisFor(prevEntryWhere),
      db
        .select({ totalExpenses: sql<string>`coalesce(sum(${expenses.amount}), 0)` })
        .from(expenses)
        .where(prevExpenseWhere)
        .then((r) => r[0]),
    ]);
    comparison = {
      salesChange: percentChange(totalSales, parseFloat(prevSales.totalSales)),
      expenseChange: percentChange(totalExpenses, parseFloat(prevExpense.totalExpenses)),
    };
  }

  // --- Sales overview chart (bucketed by day / week / month) ---
  const bucketExpr =
    granularity === "monthly"
      ? sql<string>`to_char(date_trunc('month', ${dailyEntries.entryDate}), 'YYYY-MM-DD')`
      : granularity === "weekly"
        ? sql<string>`to_char(date_trunc('week', ${dailyEntries.entryDate}), 'YYYY-MM-DD')`
        : sql<string>`to_char(${dailyEntries.entryDate}, 'YYYY-MM-DD')`;

  const salesOverview = await db
    .select({
      bucket: bucketExpr,
      sales: sql<string>`coalesce(sum(${dailyEntries.totalSales}), 0)`,
    })
    .from(dailyEntries)
    .where(entryWhere)
    .groupBy(bucketExpr)
    .orderBy(bucketExpr);

  // --- Top selling dishes ---
  const topDishes = await db
    .select({
      itemId: items.id,
      name: items.name,
      quantity: sql<number>`coalesce(sum(${dailyEntryItems.quantity}), 0)`.mapWith(Number),
      sales: sql<string>`coalesce(sum(${dailyEntryItems.lineTotal}), 0)`,
    })
    .from(dailyEntryItems)
    .innerJoin(dailyEntries, eq(dailyEntryItems.dailyEntryId, dailyEntries.id))
    .innerJoin(items, eq(dailyEntryItems.itemId, items.id))
    .where(entryWhere)
    .groupBy(items.id, items.name)
    .orderBy(desc(sql`sum(${dailyEntryItems.quantity})`))
    .limit(10);

  // --- Outlet performance (all outlets in scope) ---
  const outletPerformance = await db
    .select({
      outletId: outlets.id,
      outletName: outlets.name,
      sales: sql<string>`coalesce(sum(${dailyEntries.totalSales}), 0)`,
      items: sql<number>`coalesce(sum(${dailyEntries.totalQty}), 0)`.mapWith(Number),
    })
    .from(outlets)
    .leftJoin(
      dailyEntries,
      and(eq(dailyEntries.outletId, outlets.id), gte(dailyEntries.entryDate, range.from), lte(dailyEntries.entryDate, range.to))
    )
    .where(outletId ? eq(outlets.id, outletId) : undefined)
    .groupBy(outlets.id, outlets.name)
    .orderBy(desc(sql`coalesce(sum(${dailyEntries.totalSales}), 0)`));

  // --- Expense breakdown by category ---
  const expenseBreakdown = await db
    .select({
      category: expenses.category,
      amount: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(expenseWhere)
    .groupBy(expenses.category)
    .orderBy(desc(sql`sum(${expenses.amount})`));

  return NextResponse.json({
    range,
    kpis: {
      totalSales,
      totalEntries: current.totalEntries,
      totalItemsSold: current.totalItemsSold,
      totalExpenses,
      netAmount,
      salesChangePercent: comparison.salesChange,
      expenseChangePercent: comparison.expenseChange,
    },
    salesOverview: salesOverview.map((r) => ({ date: r.bucket, sales: parseFloat(r.sales) })),
    topDishes: topDishes.map((r) => ({ ...r, sales: parseFloat(r.sales) })),
    outletPerformance: outletPerformance.map((r) => ({ ...r, sales: parseFloat(r.sales) })),
    expenseBreakdown: expenseBreakdown.map((r) => ({ ...r, amount: parseFloat(r.amount) })),
  });
}
