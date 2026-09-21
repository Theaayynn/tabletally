import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { outlets, users, dailyEntries } from "@/db/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { requireAdmin, requireUser } from "@/lib/api-auth";
import { newId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";
import { businessDateToday } from "@/lib/date-ranges";

// Any authenticated user can list outlets (executives need this for display /
// the outlet switcher shows only their own, admins see all + summary counts).
export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;

  const today = businessDateToday();

  const rows = await db
    .select({
      id: outlets.id,
      name: outlets.name,
      address: outlets.address,
      isActive: outlets.isActive,
      createdAt: outlets.createdAt,
      executiveCount: sql<number>`count(distinct ${users.id})`.mapWith(Number),
      todaySales: sql<string>`coalesce(sum(${dailyEntries.totalSales}) filter (where ${dailyEntries.entryDate} = ${today}), 0)`,
    })
    .from(outlets)
    .leftJoin(users, and(eq(users.outletId, outlets.id), eq(users.role, "EXECUTIVE")))
    .leftJoin(dailyEntries, eq(dailyEntries.outletId, outlets.id))
    .groupBy(outlets.id)
    .orderBy(outlets.createdAt);

  if (session.role === "EXECUTIVE") {
    return NextResponse.json({
      outlets: rows.filter((o) => o.id === session.outletId),
    });
  }

  return NextResponse.json({ outlets: rows });
}

const createSchema = z.object({
  name: z.string().min(2, "Outlet name is required."),
  address: z.string().optional().nullable(),
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

  const id = newId();
  await db.insert(outlets).values({
    id,
    name: parsed.data.name,
    address: parsed.data.address ?? null,
  });

  await logAudit({
    userId: session!.sub,
    action: "CREATE",
    entityType: "outlet",
    entityId: id,
    outletName: parsed.data.name,
    summary: `Created outlet "${parsed.data.name}"`,
  });

  return NextResponse.json({ id }, { status: 201 });
}
