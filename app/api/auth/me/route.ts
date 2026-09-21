import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, outlets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/api-auth";

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      outletId: users.outletId,
      outletName: outlets.name,
    })
    .from(users)
    .leftJoin(outlets, eq(users.outletId, outlets.id))
    .where(eq(users.id, session.sub))
    .limit(1);

  if (!row || !row.isActive) {
    return NextResponse.json({ error: "Account not found." }, { status: 401 });
  }

  return NextResponse.json({ user: row });
}
