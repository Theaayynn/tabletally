import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/api-auth";
import { newId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";
import { asc } from "drizzle-orm";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  return NextResponse.json({ categories: rows });
}

const createSchema = z.object({
  name: z.string().min(2, "Category name is required."),
  sortOrder: z.number().int().optional(),
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
  try {
    await db.insert(categories).values({
      id,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "A category with that name already exists." }, { status: 409 });
  }

  await logAudit({
    userId: session!.sub,
    action: "CREATE",
    entityType: "category",
    entityId: id,
    summary: `Created category "${parsed.data.name}"`,
  });

  return NextResponse.json({ id }, { status: 201 });
}
