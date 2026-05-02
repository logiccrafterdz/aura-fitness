import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  numeric,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { membersTable } from "./members";
import { usersTable } from "./users";

export const inventoryTransactionTypeEnum = pgEnum(
  "inventory_transaction_type",
  ["purchase", "sale", "damage", "adjustment", "return"],
);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

export const productsTable = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  category: text("category").notNull().default("other"),
  description: text("description"),
  purchasePrice: numeric("purchase_price", { precision: 10, scale: 2 }),
  salePrice: numeric("sale_price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").default(0).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(5).notNull(),
  expiryDate: timestamp("expiry_date"),
  barcode: text("barcode"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryTransactionsTable = pgTable("inventory_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => productsTable.id),
  type: inventoryTransactionTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
  totalValue: numeric("total_value", { precision: 10, scale: 2 }),
  notes: text("notes"),
  actorId: uuid("actor_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posSessionsTable = pgTable("pos_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  cashierId: uuid("cashier_id")
    .notNull()
    .references(() => usersTable.id),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  openingCash: numeric("opening_cash", { precision: 10, scale: 2 }).default(
    "0",
  ),
  closingCash: numeric("closing_cash", { precision: 10, scale: 2 }),
  totalSales: numeric("total_sales", { precision: 10, scale: 2 }).default("0"),
  status: text("status").default("open").notNull(),
  notes: text("notes"),
});

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: text("order_number").notNull().unique(),
  memberId: uuid("member_id").references(() => membersTable.id),
  posSessionId: uuid("pos_session_id").references(() => posSessionsTable.id),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("cash"),
  status: orderStatusEnum("status").default("pending").notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItemsTable = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateProductSchema = insertProductSchema.partial();
export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type Product = typeof productsTable.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;
export type PosSession = typeof posSessionsTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
