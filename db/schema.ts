import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Design notes
// - "dailyEntries" + "dailyEntryItems" ARE the sales record: the executive's
//   +/- quantity cart for a given outlet + date. That is functionally the
//   day's sales ticket, so a separate sales/sale_items pair was not needed.
// - Money columns are numeric(_, 2) (exact, no float). IDs are app-generated
//   UUIDs (crypto.randomUUID()) so no DB extension is required.
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["ADMIN", "EXECUTIVE"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "UPI",
  "CARD",
  "BANK_TRANSFER",
  "OTHER",
]);
export const billStatusEnum = pgEnum("bill_status", [
  "PAID",
  "PENDING",
  "PARTIALLY_PAID",
]);
export const auditActionEnum = pgEnum("audit_action", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "CONFIG_CHANGE",
]);

export const outlets = pgTable("outlets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    outletId: text("outlet_id").references(() => outlets.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index("users_outlet_idx").on(t.outletId),
  })
);

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 10, scale: 2 }),
    sku: text("sku").unique(),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    categoryIdx: index("items_category_idx").on(t.categoryId),
  })
);

// Item availability per outlet. No rows for an item => available everywhere.
export const itemOutlets = pgTable(
  "item_outlets",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    outletId: text("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniq: uniqueIndex("item_outlets_item_outlet_uniq").on(t.itemId, t.outletId),
  })
);

export const dailyEntries = pgTable(
  "daily_entries",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => outlets.id),
    executiveId: text("executive_id")
      .notNull()
      .references(() => users.id),
    entryDate: date("entry_date").notNull(),
    totalItems: integer("total_items").notNull().default(0),
    totalQty: integer("total_qty").notNull().default(0),
    totalSales: numeric("total_sales", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    isLocked: boolean("is_locked").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    outletDateUniq: uniqueIndex("daily_entries_outlet_date_uniq").on(
      t.outletId,
      t.entryDate
    ),
    outletDateIdx: index("daily_entries_outlet_date_idx").on(
      t.outletId,
      t.entryDate
    ),
    dateIdx: index("daily_entries_date_idx").on(t.entryDate),
  })
);

export const dailyEntryItems = pgTable(
  "daily_entry_items",
  {
    id: text("id").primaryKey(),
    dailyEntryId: text("daily_entry_id")
      .notNull()
      .references(() => dailyEntries.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    entryItemUniq: uniqueIndex("daily_entry_items_entry_item_uniq").on(
      t.dailyEntryId,
      t.itemId
    ),
    itemIdx: index("daily_entry_items_item_idx").on(t.itemId),
  })
);

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => outlets.id),
    category: text("category").notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("CASH"),
    expenseDate: date("expense_date").notNull(),
    enteredById: text("entered_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    outletDateIdx: index("expenses_outlet_date_idx").on(t.outletId, t.expenseDate),
  })
);

export const bills = pgTable(
  "bills",
  {
    id: text("id").primaryKey(),
    billNumber: text("bill_number").notNull(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => outlets.id),
    vendor: text("vendor"),
    description: text("description"),
    category: text("category"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("CASH"),
    status: billStatusEnum("status").notNull().default("PENDING"),
    billDate: date("bill_date").notNull(),
    notes: text("notes"),
    attachmentUrl: text("attachment_url"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    outletBillUniq: uniqueIndex("bills_outlet_billnumber_uniq").on(
      t.outletId,
      t.billNumber
    ),
    outletDateIdx: index("bills_outlet_date_idx").on(t.outletId, t.billDate),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    action: auditActionEnum("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    outletName: text("outlet_name"),
    summary: text("summary").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    createdIdx: index("audit_logs_created_idx").on(t.createdAt),
    entityIdx: index("audit_logs_entity_idx").on(t.entityType),
  })
);

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("global"),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  currency: text("currency").notNull().default("INR"),
});

// ---------------------------------------------------------------------------
// Relations (used for typed nested selects with db.query.*)
// ---------------------------------------------------------------------------

export const outletsRelations = relations(outlets, ({ many }) => ({
  users: many(users),
  dailyEntries: many(dailyEntries),
  expenses: many(expenses),
  bills: many(bills),
  itemLinks: many(itemOutlets),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  outlet: one(outlets, { fields: [users.outletId], references: [outlets.id] }),
  dailyEntries: many(dailyEntries),
  expenses: many(expenses),
  bills: many(bills),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  category: one(categories, {
    fields: [items.categoryId],
    references: [categories.id],
  }),
  outletLinks: many(itemOutlets),
  dailyEntryItems: many(dailyEntryItems),
}));

export const itemOutletsRelations = relations(itemOutlets, ({ one }) => ({
  item: one(items, { fields: [itemOutlets.itemId], references: [items.id] }),
  outlet: one(outlets, {
    fields: [itemOutlets.outletId],
    references: [outlets.id],
  }),
}));

export const dailyEntriesRelations = relations(dailyEntries, ({ one, many }) => ({
  outlet: one(outlets, {
    fields: [dailyEntries.outletId],
    references: [outlets.id],
  }),
  executive: one(users, {
    fields: [dailyEntries.executiveId],
    references: [users.id],
  }),
  items: many(dailyEntryItems),
}));

export const dailyEntryItemsRelations = relations(dailyEntryItems, ({ one }) => ({
  dailyEntry: one(dailyEntries, {
    fields: [dailyEntryItems.dailyEntryId],
    references: [dailyEntries.id],
  }),
  item: one(items, { fields: [dailyEntryItems.itemId], references: [items.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  outlet: one(outlets, { fields: [expenses.outletId], references: [outlets.id] }),
  enteredBy: one(users, {
    fields: [expenses.enteredById],
    references: [users.id],
  }),
}));

export const billsRelations = relations(bills, ({ one }) => ({
  outlet: one(outlets, { fields: [bills.outletId], references: [outlets.id] }),
  createdBy: one(users, { fields: [bills.createdById], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));
