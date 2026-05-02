import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  numeric,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { membersTable } from "./members";
import { membershipsTable } from "./memberships";
import { usersTable } from "./users";

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "pending",
  "paid",
  "overdue",
  "cancelled",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "baridimob",
  "cib",
  "edahabia",
  "other",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "confirmed",
  "rejected",
]);

export const invoicesTable = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id),
  membershipId: uuid("membership_id").references(() => membershipsTable.id),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  memberIdIdx: index("invoices_member_id_idx").on(t.memberId),
  statusIdx: index("invoices_status_idx").on(t.status),
  createdAtIdx: index("invoices_created_at_idx").on(t.createdAt),
}));

export const invoiceItemsTable = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoicesTable.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
});

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoicesTable.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  referenceNumber: text("reference_number"),
  proofUrl: text("proof_url"),
  confirmedBy: uuid("confirmed_by").references(() => usersTable.id),
  confirmedAt: timestamp("confirmed_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  recordedBy: uuid("recorded_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  memberIdIdx: index("payments_member_id_idx").on(t.memberId),
  statusIdx: index("payments_status_idx").on(t.status),
  methodIdx: index("payments_method_idx").on(t.method),
  confirmedAtIdx: index("payments_confirmed_at_idx").on(t.confirmedAt),
}));

export const discountsTable = pgTable("discounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  description: text("description"),
  type: text("type").notNull().default("percent"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  maxUses: integer("max_uses"),
  usesCount: integer("uses_count").default(0).notNull(),
  applicablePlanIds: text("applicable_plan_ids").array(),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cashReconciliationsTable = pgTable("cash_reconciliations", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: text("date").notNull(),
  openingBalance: numeric("opening_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  closingBalance: numeric("closing_balance", { precision: 10, scale: 2 }),
  cashIn: numeric("cash_in", { precision: 10, scale: 2 }).notNull().default("0"),
  cashOut: numeric("cash_out", { precision: 10, scale: 2 }).notNull().default("0"),
  expectedBalance: numeric("expected_balance", { precision: 10, scale: 2 }),
  discrepancy: numeric("discrepancy", { precision: 10, scale: 2 }).default("0"),
  status: text("status").notNull().default("open"),
  openedBy: uuid("opened_by").references(() => usersTable.id),
  closedBy: uuid("closed_by").references(() => usersTable.id),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  notes: text("notes"),
});

export const insertCashReconciliationSchema = createInsertSchema(
  cashReconciliationsTable,
).omit({ id: true, openedAt: true });

export type CashReconciliation = typeof cashReconciliationsTable.$inferSelect;
export type InsertCashReconciliation = typeof cashReconciliationsTable.$inferInsert;

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  invoiceNumber: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updatePaymentSchema = insertPaymentSchema.partial();

export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type Discount = typeof discountsTable.$inferSelect;
export type InsertInvoice = typeof invoicesTable.$inferInsert;
export type InsertPayment = typeof paymentsTable.$inferInsert;
