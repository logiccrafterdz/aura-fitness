import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { membersTable } from "./members";
import { usersTable } from "./users";

export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "ongoing",
  "completed",
  "cancelled",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
  "no_show",
  "attended",
]);

export const classTypesTable = pgTable("class_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  durationMinutes: integer("duration_minutes").default(60).notNull(),
  maxCapacity: integer("max_capacity").default(20).notNull(),
  difficultyLevel: text("difficulty_level").default("all"),
  defaultTrainerId: uuid("default_trainer_id").references(() => usersTable.id),
  color: text("color").default("#6366f1"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const classSessionsTable = pgTable("class_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  classTypeId: uuid("class_type_id")
    .notNull()
    .references(() => classTypesTable.id),
  trainerId: uuid("trainer_id").references(() => usersTable.id),
  room: text("room"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  maxCapacity: integer("max_capacity"),
  currentBookings: integer("current_bookings").default(0).notNull(),
  status: sessionStatusEnum("status").default("scheduled").notNull(),
  notes: text("notes"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bookingsTable = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => classSessionsTable.id, { onDelete: "cascade" }),
  status: bookingStatusEnum("status").default("confirmed").notNull(),
  bookedAt: timestamp("booked_at").defaultNow().notNull(),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  attendedAt: timestamp("attended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const waitlistEntriesTable = pgTable("waitlist_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => classSessionsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  status: text("status").notNull().default("waiting"),
  notifiedAt: timestamp("notified_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClassTypeSchema = createInsertSchema(classTypesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateClassTypeSchema = insertClassTypeSchema.partial();
export const insertClassSessionSchema = createInsertSchema(
  classSessionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const updateClassSessionSchema = insertClassSessionSchema.partial();
export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true,
  createdAt: true,
  bookedAt: true,
});

export type ClassType = typeof classTypesTable.$inferSelect;
export type ClassSession = typeof classSessionsTable.$inferSelect;
export type Booking = typeof bookingsTable.$inferSelect;
export type WaitlistEntry = typeof waitlistEntriesTable.$inferSelect;
export type InsertClassType = typeof classTypesTable.$inferInsert;
export type InsertClassSession = typeof classSessionsTable.$inferInsert;
export type InsertBooking = typeof bookingsTable.$inferInsert;
