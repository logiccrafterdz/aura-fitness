import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "inactive",
  "suspended",
  "pending",
]);

export const genderEnum = pgEnum("gender", ["male", "female"]);

export const membersTable = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberNumber: text("member_number").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  firstNameAr: text("first_name_ar"),
  lastNameAr: text("last_name_ar"),
  phone: text("phone").notNull(),
  email: text("email"),
  gender: genderEnum("gender"),
  dateOfBirth: timestamp("date_of_birth"),
  photoUrl: text("photo_url"),
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  medicalNotes: text("medical_notes"),
  status: memberStatusEnum("status").default("active").notNull(),
  consentMarketing: boolean("consent_marketing").default(false).notNull(),
  consentHealthData: boolean("consent_health_data").default(false).notNull(),
  dataExportRequestedAt: timestamp("data_export_requested_at"),
  accountDeletionRequestedAt: timestamp("account_deletion_requested_at"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  statusIdx: index("members_status_idx").on(t.status),
  createdAtIdx: index("members_created_at_idx").on(t.createdAt),
}));

export const memberTimelineEventsTable = pgTable("member_timeline_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata"),
  actorId: uuid("actor_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({
  id: true,
  memberNumber: true,
  createdAt: true,
  updatedAt: true,
});
export const updateMemberSchema = insertMemberSchema.partial();
export const selectMemberSchema = createSelectSchema(membersTable);

export type Member = typeof membersTable.$inferSelect;
export type InsertMember = typeof membersTable.$inferInsert;
export type UpdateMember = Partial<typeof membersTable.$inferInsert>;
