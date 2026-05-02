import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { membersTable } from "./members";
import { plansTable } from "./plans";
import { usersTable } from "./users";

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "frozen",
  "expired",
  "cancelled",
  "pending",
]);

export const membershipsTable = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plansTable.id),
  status: membershipStatusEnum("status").default("active").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  freezeStart: timestamp("freeze_start"),
  freezeEnd: timestamp("freeze_end"),
  freezeReason: text("freeze_reason"),
  frozenDaysUsed: integer("frozen_days_used").default(0).notNull(),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: uuid("cancelled_by").references(() => usersTable.id),
  cancellationReason: text("cancellation_reason"),
  sessionsUsed: integer("sessions_used").default(0).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMembershipSchema = createInsertSchema(
  membershipsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMembershipSchema = insertMembershipSchema.partial();
export const selectMembershipSchema = createSelectSchema(membershipsTable);

export type Membership = typeof membershipsTable.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
