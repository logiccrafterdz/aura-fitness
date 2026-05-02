import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { membersTable } from "./members";
import { usersTable } from "./users";

export const accessResultEnum = pgEnum("access_result", [
  "allowed",
  "denied",
]);

export const accessTokenTypeEnum = pgEnum("access_token_type", [
  "qr",
  "nfc",
  "emergency",
]);

export const accessPointsTable = pgTable("access_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  location: text("location"),
  zone: text("zone").notNull().default("main"),
  type: text("type").notNull().default("entry"),
  hardwareId: text("hardware_id"),
  isActive: boolean("is_active").default(true).notNull(),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accessTokensTable = pgTable("access_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  tokenType: accessTokenTypeEnum("token_type").default("qr").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accessLogsTable = pgTable("access_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").references(() => membersTable.id),
  accessPointId: uuid("access_point_id").references(() => accessPointsTable.id),
  tokenId: uuid("token_id"),
  result: accessResultEnum("result").notNull(),
  denialReason: text("denial_reason"),
  verifiedVia: text("verified_via"),
  rawToken: text("raw_token"),
  manualOverrideBy: uuid("manual_override_by").references(
    () => usersTable.id,
  ),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  createdAtIdx: index("access_logs_created_at_idx").on(t.createdAt),
  memberIdIdx: index("access_logs_member_id_idx").on(t.memberId),
  resultIdx: index("access_logs_result_idx").on(t.result),
}));

export const timeRulesTable = pgTable("time_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  allowedGender: text("allowed_gender"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  daysOfWeek: jsonb("days_of_week").$type<number[]>().default([0, 1, 2, 3, 4, 5, 6]),
  zone: text("zone").default("main"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAccessPointSchema = createInsertSchema(
  accessPointsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimeRuleSchema = createInsertSchema(timeRulesTable).omit({
  id: true,
  createdAt: true,
});
export const insertAccessLogSchema = createInsertSchema(accessLogsTable).omit({
  id: true,
  createdAt: true,
});

export type AccessPoint = typeof accessPointsTable.$inferSelect;
export type AccessToken = typeof accessTokensTable.$inferSelect;
export type AccessLog = typeof accessLogsTable.$inferSelect;
export type TimeRule = typeof timeRulesTable.$inferSelect;
export type InsertAccessPoint = typeof accessPointsTable.$inferInsert;
