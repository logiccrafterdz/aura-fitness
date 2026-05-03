import { Router } from "express";
import { db } from "@workspace/db";
import {
  pointsRulesTable,
  rewardsTable,
  memberPointsLedgerTable,
  membersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requirePermission } from "../lib/auth";
import { AppError } from "../lib/errors";
import { logAudit } from "../lib/audit";

const router = Router();

// ==========================================
// Rules
// ==========================================

router.get(
  "/loyalty/rules",
  requireAuth,
  requirePermission("settings", "read"),
  async (req, res, next) => {
    try {
      const rows = await db
        .select()
        .from(pointsRulesTable)
        .orderBy(pointsRulesTable.eventType);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/loyalty/rules",
  requireAuth,
  requirePermission("settings", "write"),
  async (req, res, next) => {
    try {
      const schema = z.object({
        eventType: z.string().min(1),
        points: z.number().int(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      });
      const data = schema.parse(req.body);

      const [rule] = await db
        .insert(pointsRulesTable)
        .values(data)
        .onConflictDoUpdate({
          target: pointsRulesTable.eventType,
          set: {
            points: data.points,
            description: data.description,
            isActive: data.isActive !== undefined ? data.isActive : true,
          },
        })
        .returning();

      await logAudit({
        req,
        action: "create",
        resource: "loyalty_rules",
        resourceId: rule.id,
        newValue: rule,
      });

      res.status(201).json(rule);
    } catch (err) {
      next(err);
    }
  },
);

// ==========================================
// Rewards
// ==========================================

router.get(
  "/loyalty/rewards",
  requireAuth,
  requirePermission("settings", "read"),
  async (req, res, next) => {
    try {
      const rows = await db
        .select()
        .from(rewardsTable)
        .orderBy(desc(rewardsTable.createdAt));
      res.json(rows);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/loyalty/rewards",
  requireAuth,
  requirePermission("settings", "write"),
  async (req, res, next) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        nameAr: z.string().optional(),
        description: z.string().optional(),
        pointsCost: z.number().int().positive(),
        stock: z.number().int().min(0).nullable().optional(),
        isActive: z.boolean().optional(),
      });
      const data = schema.parse(req.body);

      const [reward] = await db
        .insert(rewardsTable)
        .values(data)
        .returning();

      await logAudit({
        req,
        action: "create",
        resource: "loyalty_rewards",
        resourceId: reward.id,
        newValue: reward,
      });

      res.status(201).json(reward);
    } catch (err) {
      next(err);
    }
  },
);

// ==========================================
// Member Ledger & Redeem
// ==========================================

router.get(
  "/loyalty/members/:memberId/ledger",
  requireAuth,
  requirePermission("members", "read"),
  async (req, res, next) => {
    try {
      const memberId = req.params.memberId as string;
      const rows = await db
        .select()
        .from(memberPointsLedgerTable)
        .where(eq(memberPointsLedgerTable.memberId, memberId))
        .orderBy(desc(memberPointsLedgerTable.createdAt));
      
      const balance = rows.length > 0 ? rows[0].balance : 0;

      res.json({ balance, ledger: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/loyalty/members/:memberId/adjust",
  requireAuth,
  requirePermission("members", "write"),
  async (req, res, next) => {
    try {
      const memberId = req.params.memberId as string;
      const schema = z.object({
        points: z.number().int(),
        description: z.string().min(1),
      });
      const { points, description } = schema.parse(req.body);

      if (points === 0) throw new AppError(400, "Points must not be 0");

      const [member] = await db
        .select()
        .from(membersTable)
        .where(eq(membersTable.id, memberId));
      if (!member) throw new AppError(404, "Member not found");

      const [lastEntry] = await db
        .select()
        .from(memberPointsLedgerTable)
        .where(eq(memberPointsLedgerTable.memberId, memberId))
        .orderBy(desc(memberPointsLedgerTable.createdAt))
        .limit(1);

      const currentBalance = lastEntry ? lastEntry.balance : 0;
      const newBalance = currentBalance + points;

      if (newBalance < 0) {
        throw new AppError(400, "Insufficient points balance");
      }

      const [entry] = await db
        .insert(memberPointsLedgerTable)
        .values({
          memberId,
          points: Math.abs(points),
          direction: points > 0 ? "in" : "out",
          sourceType: "manual_adjustment",
          description,
          balance: newBalance,
        })
        .returning();

      await logAudit({
        req,
        action: "update",
        resource: "members",
        resourceId: memberId,
        newValue: { points_adjusted: points, new_balance: newBalance, reason: description },
      });

      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/loyalty/members/:memberId/redeem",
  requireAuth,
  requirePermission("members", "write"),
  async (req, res, next) => {
    try {
      const memberId = req.params.memberId as string;
      const schema = z.object({
        rewardId: z.string().uuid(),
      });
      const { rewardId } = schema.parse(req.body);

      const [reward] = await db
        .select()
        .from(rewardsTable)
        .where(eq(rewardsTable.id, rewardId));

      if (!reward) throw new AppError(404, "Reward not found");
      if (!reward.isActive) throw new AppError(400, "Reward is inactive");
      if (reward.stock !== null && reward.stock <= 0) {
        throw new AppError(400, "Reward is out of stock");
      }

      const [lastEntry] = await db
        .select()
        .from(memberPointsLedgerTable)
        .where(eq(memberPointsLedgerTable.memberId, memberId))
        .orderBy(desc(memberPointsLedgerTable.createdAt))
        .limit(1);

      const currentBalance = lastEntry ? lastEntry.balance : 0;

      if (currentBalance < reward.pointsCost) {
        throw new AppError(400, "Insufficient points");
      }

      const newBalance = currentBalance - reward.pointsCost;

      // Update stock
      if (reward.stock !== null) {
        await db
          .update(rewardsTable)
          .set({ stock: reward.stock - 1, updatedAt: new Date() })
          .where(eq(rewardsTable.id, rewardId));
      }

      const [entry] = await db
        .insert(memberPointsLedgerTable)
        .values({
          memberId,
          points: reward.pointsCost,
          direction: "out",
          sourceType: "redeem_reward",
          sourceId: reward.id,
          description: `Redeemed reward: ${reward.name}`,
          balance: newBalance,
        })
        .returning();

      await logAudit({
        req,
        action: "update",
        resource: "members",
        resourceId: memberId,
        newValue: { reward_redeemed: reward.name, cost: reward.pointsCost },
      });

      res.status(201).json(entry);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
