import "./env";

import { db, pool } from "./index";
import {
  outlets,
  categories,
  items,
  users,
  dailyEntries,
  dailyEntryItems,
  expenses,
  bills,
  settings,
  itemOutlets,
  auditLogs,
} from "./schema";
import { hashPassword } from "../lib/auth";
import { newId } from "../lib/ids";

// Deterministic PRNG so re-running the seed produces the same demo data.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

async function insertInChunks<T extends Record<string, unknown>>(table: any, rows: T[], size: number) {
  for (let i = 0; i < rows.length; i += size) {
    await db.insert(table).values(rows.slice(i, i + size));
  }
}

async function main() {
  console.log("Seeding database (this wipes existing demo data)...");

  // Wipe in dependency order — this is a demo/dev seed script only.
  await db.delete(auditLogs);
  await db.delete(dailyEntryItems);
  await db.delete(dailyEntries);
  await db.delete(expenses);
  await db.delete(bills);
  await db.delete(itemOutlets);
  await db.delete(items);
  await db.delete(categories);
  await db.delete(users);
  await db.delete(outlets);
  await db.delete(settings);

  await db.insert(settings).values({ id: "global", taxPercent: "5.00", currency: "INR" });

  // --- Outlets ---
  const outletDefs = [
    { name: "Connaught Place", address: "Block A, Connaught Place, New Delhi" },
    { name: "Saket", address: "Select Citywalk Road, Saket, New Delhi" },
    { name: "Noida", address: "Sector 18, Noida, Uttar Pradesh" },
  ];
  const outletRows = outletDefs.map((o) => ({ id: newId(), ...o }));
  await db.insert(outlets).values(outletRows);
  const [cp, saket, noida] = outletRows;

  // --- Admin ---
  const adminId = newId();
  await db.insert(users).values({
    id: adminId,
    name: "Anita Sharma",
    email: "admin@tabletally.test",
    passwordHash: await hashPassword("Admin@12345"),
    role: "ADMIN",
  });

  // --- Executives ---
  const execDefs = [
    { name: "Priya Nair", email: "priya@tabletally.test", outletId: cp.id },
    { name: "Neha Gupta", email: "neha@tabletally.test", outletId: cp.id },
    { name: "Rahul Verma", email: "rahul@tabletally.test", outletId: saket.id },
    { name: "Amit Kumar", email: "amit@tabletally.test", outletId: noida.id },
    { name: "Vikram Singh", email: "vikram@tabletally.test", outletId: noida.id },
  ];
  const execRows = execDefs.map((e) => ({ id: newId(), ...e }));
  for (const e of execRows) {
    await db.insert(users).values({
      id: e.id,
      name: e.name,
      email: e.email,
      passwordHash: await hashPassword("Exec@12345"),
      role: "EXECUTIVE",
      outletId: e.outletId,
    });
  }
  const execByOutlet: Record<string, string[]> = {};
  for (const e of execRows) {
    (execByOutlet[e.outletId] ??= []).push(e.id);
  }

  // --- Categories ---
  const categoryNames = ["Starters", "Main Course", "Rice & Biryani", "Breads", "Chinese", "Soups", "Drinks", "Desserts"];
  const categoryRows = categoryNames.map((name, i) => ({ id: newId(), name, sortOrder: i }));
  await db.insert(categories).values(categoryRows);
  const catId = (name: string) => categoryRows.find((c) => c.name === name)!.id;

  // --- Dishes ---
  const itemDefs: { name: string; category: string; price: number }[] = [
    { name: "Paneer Tikka", category: "Starters", price: 280 },
    { name: "Chicken Tikka", category: "Starters", price: 320 },
    { name: "Veg Spring Roll", category: "Starters", price: 220 },
    { name: "Chilli Paneer", category: "Starters", price: 260 },
    { name: "Tandoori Chicken (Half)", category: "Starters", price: 350 },
    { name: "Butter Chicken", category: "Main Course", price: 350 },
    { name: "Dal Makhani", category: "Main Course", price: 260 },
    { name: "Paneer Butter Masala", category: "Main Course", price: 300 },
    { name: "Kadai Chicken", category: "Main Course", price: 340 },
    { name: "Palak Paneer", category: "Main Course", price: 280 },
    { name: "Chana Masala", category: "Main Course", price: 220 },
    { name: "Mutton Rogan Josh", category: "Main Course", price: 420 },
    { name: "Chicken Biryani", category: "Rice & Biryani", price: 320 },
    { name: "Veg Biryani", category: "Rice & Biryani", price: 260 },
    { name: "Jeera Rice", category: "Rice & Biryani", price: 180 },
    { name: "Mutton Biryani", category: "Rice & Biryani", price: 380 },
    { name: "Butter Naan", category: "Breads", price: 60 },
    { name: "Tandoori Roti", category: "Breads", price: 35 },
    { name: "Garlic Naan", category: "Breads", price: 70 },
    { name: "Laccha Paratha", category: "Breads", price: 65 },
    { name: "Veg Hakka Noodles", category: "Chinese", price: 220 },
    { name: "Chicken Fried Rice", category: "Chinese", price: 250 },
    { name: "Veg Manchurian", category: "Chinese", price: 230 },
    { name: "Tomato Soup", category: "Soups", price: 140 },
    { name: "Hot & Sour Soup", category: "Soups", price: 160 },
    { name: "Cold Drink", category: "Drinks", price: 60 },
    { name: "Fresh Lime Soda", category: "Drinks", price: 90 },
    { name: "Masala Chaas", category: "Drinks", price: 70 },
    { name: "Mineral Water", category: "Drinks", price: 30 },
    { name: "Gulab Jamun (2 pc)", category: "Desserts", price: 110 },
    { name: "Gajar Ka Halwa", category: "Desserts", price: 140 },
  ];
  const itemRows = itemDefs.map((d) => ({
    id: newId(),
    name: d.name,
    categoryId: catId(d.category),
    price: d.price.toFixed(2),
    costPrice: (d.price * 0.4).toFixed(2),
  }));
  await db.insert(items).values(itemRows);

  // --- 35 days of daily entries per outlet ---
  const DAYS = 35;
  const today = new Date();
  const dailyEntryRows: (typeof dailyEntries.$inferInsert)[] = [];
  const dailyEntryItemRows: (typeof dailyEntryItems.$inferInsert)[] = [];

  for (const outlet of outletRows) {
    const execs = execByOutlet[outlet.id];
    for (let d = DAYS; d >= 1; d--) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const entryDate = date.toISOString().slice(0, 10);
      const executiveId = pick(execs);

      const numDishes = randInt(12, 22);
      const shuffled = [...itemRows].sort(() => rand() - 0.5);
      const dayItems = shuffled.slice(0, numDishes);

      const entryId = newId();
      let totalQty = 0;
      let totalSales = 0;
      const lines = dayItems.map((it) => {
        const qty = randInt(2, 35);
        const unitPrice = parseFloat(it.price);
        const lineTotal = Math.round(unitPrice * qty * 100) / 100;
        totalQty += qty;
        totalSales += lineTotal;
        return {
          id: newId(),
          dailyEntryId: entryId,
          itemId: it.id,
          quantity: qty,
          unitPrice: unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        };
      });

      dailyEntryRows.push({
        id: entryId,
        outletId: outlet.id,
        executiveId,
        entryDate,
        totalItems: lines.length,
        totalQty,
        totalSales: totalSales.toFixed(2),
      });
      dailyEntryItemRows.push(...lines);
    }
  }
  await insertInChunks(dailyEntries, dailyEntryRows, 200);
  await insertInChunks(dailyEntryItems, dailyEntryItemRows, 500);

  // --- Expenses ---
  const expenseCategories = ["Rent", "Electricity", "Gas", "Salary", "Raw Material", "Maintenance", "Marketing", "Transport", "Packaging", "Other"];
  const paymentMethods = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"] as const;
  const expenseRows: (typeof expenses.$inferInsert)[] = [];
  for (const outlet of outletRows) {
    const execs = execByOutlet[outlet.id];
    for (let d = DAYS; d >= 1; d -= randInt(1, 3)) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      expenseRows.push({
        id: newId(),
        outletId: outlet.id,
        category: pick(expenseCategories),
        description: null,
        amount: randInt(500, 15000).toFixed(2),
        paymentMethod: pick([...paymentMethods]),
        expenseDate: date.toISOString().slice(0, 10),
        enteredById: pick([adminId, ...execs]),
      });
    }
  }
  await insertInChunks(expenses, expenseRows, 200);

  // --- Bills ---
  const vendors = ["Fresh Farms Supplies", "Metro Wholesale", "Delhi Gas Agency", "Spice World Traders", "CleanPro Services"];
  const statuses = ["PAID", "PENDING", "PARTIALLY_PAID"] as const;
  const billRows: (typeof bills.$inferInsert)[] = [];
  let billCounter = 1000;
  for (const outlet of outletRows) {
    for (let i = 0; i < 8; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - randInt(1, DAYS));
      billRows.push({
        id: newId(),
        billNumber: `BILL-${billCounter++}`,
        outletId: outlet.id,
        vendor: pick(vendors),
        description: "Monthly supply order",
        category: "Vendor Purchase",
        amount: randInt(2000, 45000).toFixed(2),
        paymentMethod: pick([...paymentMethods]),
        status: pick([...statuses]),
        billDate: date.toISOString().slice(0, 10),
        createdById: adminId,
      });
    }
  }
  await db.insert(bills).values(billRows);

  console.log(
    `Seeded ${outletRows.length} outlets, ${execRows.length + 1} users, ${categoryRows.length} categories, ` +
      `${itemRows.length} dishes, ${dailyEntryRows.length} daily entries, ${expenseRows.length} expenses, ${billRows.length} bills.`
  );
  console.log("\nDemo logins:");
  console.log("  Admin      admin@tabletally.test / Admin@12345");
  console.log("  Executive  priya@tabletally.test / Exec@12345  (Connaught Place)");
  console.log("  Executive  rahul@tabletally.test / Exec@12345  (Saket)");
  console.log("  Executive  amit@tabletally.test  / Exec@12345  (Noida)");
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seeding failed:", err);
    await pool.end();
    process.exit(1);
  });
