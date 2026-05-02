import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { membersTable } from "./members";

export const pointsRulesTable = pgTable("points_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull().unique(),
  points: integer("points").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rewardsTable = pgTable("rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  pointsCost: integer("points_cost").notNull(),
  stock: integer("stock"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const memberPointsLedgerTable = pgTable("member_points_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => membersTable.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  direction: text("direction").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: uuid("source_id"),
  description: text("description"),
  balance: integer("balance").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const challengesTable = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  targetValue: integer("target_value").notNull(),
  targetMetric: text("target_metric").notNull(),
  rewardPoints: integer("reward_points").default(0),
  rewardId: uuid("reward_id").references(() => rewardsTable.id),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PointsRule = typeof pointsRulesTable.$inferSelect;
export type Reward = typeof rewardsTable.$inferSelect;
export type MemberPointsLedger = typeof memberPointsLedgerTable.$inferSelect;
