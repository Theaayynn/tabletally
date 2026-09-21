import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, requireUser } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

async function getOrCreateSettings() {
  const [row] = await db.select().from(settings).where(eq(settings.id, "global")).limit(1);
  if (row) return row;
  await db.insert(settings).values({ id: "global" }).onConflictDoNothing();
  const [created] = await db.select().from(settings).where(eq(settings.id, "global")).limit(1);
  return created;
}

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  const row = await getOrCreateSettings();
  return NextResponse.json({ settings: row });
}

const updateSchema = z.object({
  taxPercent: z.number().min(0).max(100).optional(),
  currency: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  await getOrCreateSettings();
  const updates: Record<string, unknown> = {};
  if (parsed.data.taxPercent !== undefined) updates.taxPercent = parsed.data.taxPercent.toFixed(2);
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;

  await db.update(settings).set(updates).where(eq(settings.id, "global"));

  await logAudit({
    userId: session!.sub,
    action: "CONFIG_CHANGE",
    entityType: "settings",
    summary: `Updated business settings`,
    after: updates,
  });

  return NextResponse.json({ ok: true });
}
