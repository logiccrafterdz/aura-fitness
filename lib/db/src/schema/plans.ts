import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  numeric,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const plansTable = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  durationDays: integer("duration_days").notNull(),
  allowedZones: jsonb("allowed_zones").$type<string[]>().default([]),
  timeRestrictions: jsonb("time_restrictions").$type<{
    startTime?: string;
    endTime?: string;
    daysOfWeek?: number[];
    genderRestriction?: "male" | "female" | null;
  } | null>(),
  maxFreezeDays: integer("max_freeze_days").default(0).notNull(),
  sessionLimit: integer("session_limit"),
  storeDiscountPercent: numeric("store_discount_percent", {
    precision: 5,
    scale: 2,
  }),
  features: jsonb("features").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updatePlanSchema = insertPlanSchema.partial();
export const selectPlanSchema = createSelectSchema(plansTable);

export type Plan = typeof plansTable.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;
