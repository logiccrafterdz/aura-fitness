import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { membersTable } from "./members";

export const notificationTemplatesTable = pgTable("notification_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  eventTrigger: text("event_trigger").notNull(),
  titleAr: text("title_ar").notNull(),
  titleFr: text("title_fr").notNull(),
  bodyAr: text("body_ar").notNull(),
  bodyFr: text("body_fr").notNull(),
  channels: jsonb("channels")
    .$type<("push" | "email" | "sms")[]>()
    .default(["push"]),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notificationRecordsTable = pgTable("notification_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").references(
    () => notificationTemplatesTable.id,
  ),
  memberId: uuid("member_id").references(() => membersTable.id),
  channel: text("channel").notNull(),
  title: text("title"),
  body: text("body"),
  status: text("status").default("queued").notNull(),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationTemplateSchema = createInsertSchema(
  notificationTemplatesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const updateNotificationTemplateSchema =
  insertNotificationTemplateSchema.partial();

export type NotificationTemplate = typeof notificationTemplatesTable.$inferSelect;
export type NotificationRecord = typeof notificationRecordsTable.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplatesTable.$inferInsert;
