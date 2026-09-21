import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, outlets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { newId } from "@/lib/ids";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      outletId: users.outletId,
      outletName: outlets.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(outlets, eq(users.outletId, outlets.id))
    .where(eq(users.role, "EXECUTIVE"))
    .orderBy(users.createdAt);

  return NextResponse.json({ executives: rows });
}

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  outletId: z.string().min(1, "Assign an outlet."),
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

  const email = parsed.data.email.toLowerCase().trim();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
  }

  const [outlet] = await db
    .select()
    .from(outlets)
    .where(and(eq(outlets.id, parsed.data.outletId), eq(outlets.isActive, true)))
    .limit(1);
  if (!outlet) {
    return NextResponse.json({ error: "Selected outlet was not found." }, { status: 400 });
  }

  const id = newId();
  const passwordHash = await hashPassword(parsed.data.password);
  await db.insert(users).values({
    id,
    name: parsed.data.name,
    email,
    passwordHash,
    role: "EXECUTIVE",
    outletId: outlet.id,
  });

  await logAudit({
    userId: session!.sub,
    action: "CREATE",
    entityType: "executive",
    entityId: id,
    outletName: outlet.name,
    summary: `Created executive "${parsed.data.name}" for ${outlet.name}`,
  });

  return NextResponse.json({ id }, { status: 201 });
}
