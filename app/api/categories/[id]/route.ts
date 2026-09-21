import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const [before] = await db.select().from(categories).where(eq(categories.id, params.id)).limit(1);
  if (!before) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  await db.update(categories).set(parsed.data).where(eq(categories.id, params.id));

  await logAudit({
    userId: session!.sub,
    action: "UPDATE",
    entityType: "category",
    entityId: params.id,
    summary: `Updated category "${before.name}"`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const [category] = await db.select().from(categories).where(eq(categories.id, params.id)).limit(1);
  if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });

  try {
    await db.delete(categories).where(eq(categories.id, params.id));
  } catch {
    return NextResponse.json(
      { error: "This category has dishes in it. Move or delete those dishes first." },
      { status: 409 }
    );
  }

  await logAudit({
    userId: session!.sub,
    action: "DELETE",
    entityType: "category",
    entityId: params.id,
    summary: `Deleted category "${category.name}"`,
  });

  return NextResponse.json({ ok: true });
}
