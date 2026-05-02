import { Router } from "express";
import { db } from "@workspace/db";
import {
  membershipsTable,
  plansTable,
  membersTable,
  memberTimelineEventsTable,
} from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

router.get("/memberships", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const status = req.query.status as string | undefined;
    const memberId = req.query.memberId as string | undefined;

    const conditions = [];
    if (status) conditions.push(eq(membershipsTable.status, status as any));
    if (memberId) conditions.push(eq(membershipsTable.memberId, memberId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: membershipsTable.id,
          memberId: membershipsTable.memberId,
          status: membershipsTable.status,
          startDate: membershipsTable.startDate,
          endDate: membershipsTable.endDate,
          planId: membershipsTable.planId,
          planName: plansTable.name,
          planPrice: plansTable.price,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          memberNumber: membersTable.memberNumber,
          createdAt: membershipsTable.createdAt,
        })
        .from(membershipsTable)
        .leftJoin(plansTable, eq(membershipsTable.planId, plansTable.id))
        .leftJoin(membersTable, eq(membershipsTable.memberId, membersTable.id))
        .where(where)
        .orderBy(desc(membershipsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(membershipsTable).where(where),
    ]);

    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/memberships", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      memberId: z.string().uuid(),
      planId: z.string().uuid(),
      startDate: z.string(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, data.planId));
    if (!plan) throw new AppError(404, "Plan not found");

    const startDate = new Date(data.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const [membership] = await db
      .insert(membershipsTable)
      .values({
        memberId: data.memberId,
        planId: data.planId,
        startDate,
        endDate,
        notes: data.notes,
        createdBy: req.user!.sub,
      })
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: data.memberId,
      eventType: "membership_created",
      description: `Membership created for plan "${plan.name}" (${plan.durationDays} days)`,
      actorId: req.user!.sub,
    });

    await logAudit({ req, action: "create", resource: "memberships", resourceId: membership.id, newValue: membership });
    res.status(201).json(membership);
  } catch (err) {
    next(err);
  }
});

router.get("/memberships/:id", requireAuth, async (req, res, next) => {
  try {
    const [row] = await db
      .select({
        id: membershipsTable.id,
        memberId: membershipsTable.memberId,
        planId: membershipsTable.planId,
        status: membershipsTable.status,
        startDate: membershipsTable.startDate,
        endDate: membershipsTable.endDate,
        freezeStart: membershipsTable.freezeStart,
        freezeEnd: membershipsTable.freezeEnd,
        freezeReason: membershipsTable.freezeReason,
        frozenDaysUsed: membershipsTable.frozenDaysUsed,
        sessionsUsed: membershipsTable.sessionsUsed,
        notes: membershipsTable.notes,
        planName: plansTable.name,
        planPrice: plansTable.price,
        maxFreezeDays: plansTable.maxFreezeDays,
        createdAt: membershipsTable.createdAt,
      })
      .from(membershipsTable)
      .leftJoin(plansTable, eq(membershipsTable.planId, plansTable.id))
      .where(eq(membershipsTable.id, req.params.id));
    if (!row) throw new AppError(404, "Membership not found");
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.patch("/memberships/:id", requireAuth, async (req, res, next) => {
  try {
    const [existing] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id));
    if (!existing) throw new AppError(404, "Membership not found");

    const schema = z.object({
      notes: z.string().optional(),
      endDate: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const [updated] = await db
      .update(membershipsTable)
      .set({ ...data, endDate: data.endDate ? new Date(data.endDate) : undefined, updatedAt: new Date() })
      .where(eq(membershipsTable.id, req.params.id))
      .returning();

    await logAudit({ req, action: "update", resource: "memberships", resourceId: req.params.id, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/memberships/:id/freeze", requireAuth, async (req, res, next) => {
  try {
    const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id));
    if (!membership) throw new AppError(404, "Membership not found");
    if (membership.status !== "active") throw new AppError(400, "Only active memberships can be frozen");

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, membership.planId));

    const schema = z.object({
      reason: z.string().min(1),
      freezeStart: z.string(),
      freezeEnd: z.string(),
    });
    const data = schema.parse(req.body);

    const freezeStart = new Date(data.freezeStart);
    const freezeEnd = new Date(data.freezeEnd);
    const freezeDays = Math.ceil((freezeEnd.getTime() - freezeStart.getTime()) / (1000 * 60 * 60 * 24));

    if (plan && plan.maxFreezeDays > 0) {
      const remaining = plan.maxFreezeDays - (membership.frozenDaysUsed ?? 0);
      if (freezeDays > remaining) {
        throw new AppError(400, `Freeze limit exceeded. Max ${remaining} days remaining`);
      }
    }

    const newEndDate = new Date(membership.endDate);
    newEndDate.setDate(newEndDate.getDate() + freezeDays);

    const [updated] = await db
      .update(membershipsTable)
      .set({
        status: "frozen",
        freezeStart,
        freezeEnd,
        freezeReason: data.reason,
        frozenDaysUsed: (membership.frozenDaysUsed ?? 0) + freezeDays,
        endDate: newEndDate,
        updatedAt: new Date(),
      })
      .where(eq(membershipsTable.id, req.params.id))
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: membership.memberId,
      eventType: "membership_frozen",
      description: `Membership frozen for ${freezeDays} days. Reason: ${data.reason}`,
      actorId: req.user!.sub,
    });

    await logAudit({ req, action: "freeze", resource: "memberships", resourceId: req.params.id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/memberships/:id/unfreeze", requireAuth, async (req, res, next) => {
  try {
    const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id));
    if (!membership) throw new AppError(404, "Membership not found");
    if (membership.status !== "frozen") throw new AppError(400, "Membership is not frozen");

    const [updated] = await db
      .update(membershipsTable)
      .set({ status: "active", freezeStart: null, freezeEnd: null, updatedAt: new Date() })
      .where(eq(membershipsTable.id, req.params.id))
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: membership.memberId,
      eventType: "membership_unfrozen",
      description: "Membership unfrozen and reactivated",
      actorId: req.user!.sub,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/memberships/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id));
    if (!membership) throw new AppError(404, "Membership not found");
    if (membership.status === "cancelled") throw new AppError(400, "Already cancelled");

    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const [updated] = await db
      .update(membershipsTable)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: req.user!.sub,
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(membershipsTable.id, req.params.id))
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: membership.memberId,
      eventType: "membership_cancelled",
      description: `Membership cancelled. Reason: ${reason}`,
      actorId: req.user!.sub,
    });

    await logAudit({ req, action: "cancel", resource: "memberships", resourceId: req.params.id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/memberships/:id/renew", requireAuth, async (req, res, next) => {
  try {
    const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id));
    if (!membership) throw new AppError(404, "Membership not found");

    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, membership.planId));
    if (!plan) throw new AppError(404, "Plan not found");

    const newStart = new Date(membership.endDate) > new Date() ? new Date(membership.endDate) : new Date();
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + plan.durationDays);

    const [newMembership] = await db
      .insert(membershipsTable)
      .values({
        memberId: membership.memberId,
        planId: membership.planId,
        status: "active",
        startDate: newStart,
        endDate: newEnd,
        createdBy: req.user!.sub,
      })
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: membership.memberId,
      eventType: "membership_renewed",
      description: `Membership renewed for plan "${plan.name}"`,
      actorId: req.user!.sub,
    });

    res.status(201).json(newMembership);
  } catch (err) {
    next(err);
  }
});

export default router;
