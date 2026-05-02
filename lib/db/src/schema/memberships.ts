import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
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

export const membershipFreezeRequestsTable = pgTable(
  "membership_freeze_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => membershipsTable.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by").references(() => usersTable.id),
    approvedBy: uuid("approved_by").references(() => usersTable.id),
    status: text("status").notNull().default("pending"),
    freezeStart: timestamp("freeze_start").notNull(),
    freezeEnd: timestamp("freeze_end").notNull(),
    reason: text("reason"),
    adminNotes: text("admin_notes"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at"),
  },
);

export const insertFreezeRequestSchema = createInsertSchema(
  membershipFreezeRequestsTable,
).omit({ id: true, requestedAt: true });

export type MembershipFreezeRequest =
  typeof membershipFreezeRequestsTable.$inferSelect;
export type InsertFreezeRequest =
  typeof membershipFreezeRequestsTable.$inferInsert;

export const insertMembershipSchema = createInsertSchema(
  membershipsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const updateMembershipSchema = insertMembershipSchema.partial();
export const selectMembershipSchema = createSelectSchema(membershipsTable);

export type Membership = typeof membershipsTable.$inferSelect;
export type InsertMembership = typeof membershipsTable.$inferInsert;
