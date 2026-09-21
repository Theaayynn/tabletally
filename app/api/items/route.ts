import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { items, categories, itemOutlets, outlets } from "@/db/schema";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { requireAdmin, requireUser, resolveOutletScope } from "@/lib/api-auth";
import { newId } from "@/lib/ids";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const requestedOutletId = searchParams.get("outletId");
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search")?.trim();
  const activeOnly = searchParams.get("activeOnly") !== "false";

  const scope = resolveOutletScope(session, requestedOutletId);
  if (scope.error) return scope.error;
  const outletId = scope.outletId;

  const conditions = [];
  if (activeOnly) conditions.push(eq(items.isActive, true));
  if (categoryId) conditions.push(eq(items.categoryId, categoryId));
  if (search) conditions.push(ilike(items.name, `%${search}%`));
  if (outletId) {
    conditions.push(
      sql`(
        not exists (select 1 from ${itemOutlets} io where io.item_id = ${items.id})
        or exists (select 1 from ${itemOutlets} io2 where io2.item_id = ${items.id} and io2.outlet_id = ${outletId})
      )`
    );
  }

  const rows = await db
    .select({
      id: items.id,
      name: items.name,
      price: items.price,
      costPrice: items.costPrice,
      sku: items.sku,
      imageUrl: items.imageUrl,
      isActive: items.isActive,
      categoryId: items.categoryId,
      categoryName: categories.name,
    })
    .from(items)
    .innerJoin(categories, eq(items.categoryId, categories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(categories.sortOrder), asc(items.name));

  return NextResponse.json({ items: rows });
}

const createSchema = z.object({
  name: z.string().min(1, "Dish name is required."),
  categoryId: z.string().min(1, "Category is required."),
  price: z.number().positive("Price must be greater than 0."),
  costPrice: z.number().nonnegative().optional().nullable(),
  sku: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  outletIds: z.array(z.string()).optional(), // empty/omitted = available everywhere
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

  const [category] = await db.select().from(categories).where(eq(categories.id, parsed.data.categoryId)).limit(1);
  if (!category) return NextResponse.json({ error: "Category not found." }, { status: 400 });

  const id = newId();
  try {
    await db.insert(items).values({
      id,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      price: parsed.data.price.toFixed(2),
      costPrice: parsed.data.costPrice != null ? parsed.data.costPrice.toFixed(2) : null,
      sku: parsed.data.sku || null,
      imageUrl: parsed.data.imageUrl || null,
    });
  } catch {
    return NextResponse.json({ error: "That SKU is already in use." }, { status: 409 });
  }

  if (parsed.data.outletIds && parsed.data.outletIds.length > 0) {
    const validOutlets = await db.select({ id: outlets.id }).from(outlets);
    const validIds = new Set(validOutlets.map((o) => o.id));
    const rows = parsed.data.outletIds
      .filter((oid) => validIds.has(oid))
      .map((oid) => ({ id: newId(), itemId: id, outletId: oid }));
    if (rows.length > 0) await db.insert(itemOutlets).values(rows);
  }

  await logAudit({
    userId: session!.sub,
    action: "CREATE",
    entityType: "item",
    entityId: id,
    summary: `Created dish "${parsed.data.name}" (${category.name})`,
  });

  return NextResponse.json({ id }, { status: 201 });
}
