import { Router } from "express";
import { db } from "@workspace/db";
import {
  membershipsTable,
  plansTable,
  membersTable,
  memberTimelineEventsTable,
  membershipFreezeRequestsTable,
} from "@workspace/db";
import { eq, and, desc, count, lt } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requirePermission } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

router.get("/memberships", requireAuth, requirePermission("memberships", "read"), async (req, res, next) => {
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

router.post("/memberships", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
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

router.get("/memberships/:id", requireAuth, requirePermission("memberships", "read"), async (req, res, next) => {
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
      .where(eq(membershipsTable.id, req.params.id as string));
    if (!row) throw new AppError(404, "Membership not found");
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.patch("/memberships/:id", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
  try {
    const [existing] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id as string));
    if (!existing) throw new AppError(404, "Membership not found");

    const schema = z.object({
      notes: z.string().optional(),
      endDate: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const [updated] = await db
      .update(membershipsTable)
      .set({ ...data, endDate: data.endDate ? new Date(data.endDate) : undefined, updatedAt: new Date() })
      .where(eq(membershipsTable.id, req.params.id as string))
      .returning();

    await logAudit({ req, action: "update", resource: "memberships", resourceId: req.params.id as string, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/memberships/:id/freeze", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
  try {
    const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id as string));
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
      .where(eq(membershipsTable.id, req.params.id as string))
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: membership.memberId,
      eventType: "membership_frozen",
      description: `Membership frozen for ${freezeDays} days. Reason: ${data.reason}`,
      actorId: req.user!.sub,
    });

    await logAudit({ req, action: "freeze", resource: "memberships", resourceId: req.params.id as string });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/memberships/:id/unfreeze", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
  try {
    const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id as string));
    if (!membership) throw new AppError(404, "Membership not found");
    if (membership.status !== "frozen") throw new AppError(400, "Membership is not frozen");

    const [updated] = await db
      .update(membershipsTable)
      .set({ status: "active", freezeStart: null, freezeEnd: null, updatedAt: new Date() })
      .where(eq(membershipsTable.id, req.params.id as string))
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

router.post("/memberships/:id/cancel", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
  try {
    const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id as string));
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
      .where(eq(membershipsTable.id, req.params.id as string))
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: membership.memberId,
      eventType: "membership_cancelled",
      description: `Membership cancelled. Reason: ${reason}`,
      actorId: req.user!.sub,
    });

    await logAudit({ req, action: "cancel", resource: "memberships", resourceId: req.params.id as string });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/memberships/:id/renew", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
  try {
    const [membership] = await db.select().from(membershipsTable).where(eq(membershipsTable.id, req.params.id as string));
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

// ── FREEZE REQUESTS ────────────────────────────────────────────────────────

router.get("/membership-freeze-requests", requireAuth, requirePermission("memberships", "read"), async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const status = req.query.status as string | undefined;
    const where = status ? eq(membershipFreezeRequestsTable.status, status as any) : undefined;
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: membershipFreezeRequestsTable.id,
          membershipId: membershipFreezeRequestsTable.membershipId,
          memberId: membersTable.id,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          memberNumber: membersTable.memberNumber,
          planName: plansTable.name,
          freezeStart: membershipFreezeRequestsTable.freezeStart,
          freezeEnd: membershipFreezeRequestsTable.freezeEnd,
          reason: membershipFreezeRequestsTable.reason,
          status: membershipFreezeRequestsTable.status,
          adminNotes: membershipFreezeRequestsTable.adminNotes,
          requestedAt: membershipFreezeRequestsTable.requestedAt,
        })
        .from(membershipFreezeRequestsTable)
        .leftJoin(membershipsTable, eq(membershipFreezeRequestsTable.membershipId, membershipsTable.id))
        .leftJoin(membersTable, eq(membershipsTable.memberId, membersTable.id))
        .leftJoin(plansTable, eq(membershipsTable.planId, plansTable.id))
        .where(where)
        .orderBy(desc(membershipFreezeRequestsTable.requestedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(membershipFreezeRequestsTable).where(where),
    ]);
    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.get("/memberships/:id/freeze-requests", requireAuth, requirePermission("memberships", "read"), async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(membershipFreezeRequestsTable)
      .where(eq(membershipFreezeRequestsTable.membershipId, req.params.id as string))
      .orderBy(desc(membershipFreezeRequestsTable.requestedAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/memberships/:id/freeze-requests", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      freezeStart: z.string(),
      freezeEnd: z.string(),
      reason: z.string().min(1),
    });
    const { freezeStart, freezeEnd, reason } = schema.parse(req.body);

    const [membership] = await db
      .select()
      .from(membershipsTable)
      .where(eq(membershipsTable.id, req.params.id as string));
    if (!membership) throw new AppError(404, "Membership not found");
    if (membership.status !== "active") throw new AppError(400, "Only active memberships can request a freeze");

    const pending = await db
      .select({ id: membershipFreezeRequestsTable.id })
      .from(membershipFreezeRequestsTable)
      .where(
        and(
          eq(membershipFreezeRequestsTable.membershipId, req.params.id as string),
          eq(membershipFreezeRequestsTable.status, "pending"),
        ),
      );
    if (pending.length > 0) throw new AppError(400, "A freeze request is already pending for this membership");

    const start = new Date(freezeStart);
    const end = new Date(freezeEnd);
    if (end <= start) throw new AppError(400, "freezeEnd must be after freezeStart");
    const requestedDays = Math.round((end.getTime() - start.getTime()) / 86400000);

    const [request] = await db
      .insert(membershipFreezeRequestsTable)
      .values({
        membershipId: req.params.id as string,
        memberId: membership.memberId,
        freezeStart: start,
        freezeEnd: end,
        reason,
        requestedBy: req.user!.sub,
        status: "pending",
      })
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: membership.memberId,
      eventType: "freeze_requested",
      description: `Freeze request submitted for ${requestedDays} days (${freezeStart} → ${freezeEnd}) — reason: ${reason}`,
      actorId: req.user!.sub,
    });

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

router.post("/membership-freeze-requests/:id/approve", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
  try {
    const { adminNotes } = z.object({ adminNotes: z.string().optional() }).parse(req.body);

    const [request] = await db
      .select()
      .from(membershipFreezeRequestsTable)
      .where(eq(membershipFreezeRequestsTable.id, req.params.id as string));
    if (!request) throw new AppError(404, "Freeze request not found");
    if (request.status !== "pending") throw new AppError(400, "Request is not pending");

    const [membership] = await db
      .select()
      .from(membershipsTable)
      .where(eq(membershipsTable.id, request.membershipId));
    if (!membership) throw new AppError(404, "Membership not found");

    const requestedDays = Math.round(
      (request.freezeEnd.getTime() - request.freezeStart.getTime()) / 86400000,
    );
    const newEndDate = new Date(membership.endDate);
    newEndDate.setDate(newEndDate.getDate() + requestedDays);

    await db
      .update(membershipFreezeRequestsTable)
      .set({
        status: "approved",
        approvedBy: req.user!.sub,
        reviewedAt: new Date(),
        adminNotes: adminNotes ?? null,
      })
      .where(eq(membershipFreezeRequestsTable.id, req.params.id as string));

    const [updatedMembership] = await db
      .update(membershipsTable)
      .set({
        status: "frozen",
        freezeStart: request.freezeStart,
        freezeEnd: request.freezeEnd,
        freezeReason: request.reason,
        endDate: newEndDate,
        updatedAt: new Date(),
      })
      .where(eq(membershipsTable.id, request.membershipId))
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: membership.memberId,
      eventType: "membership_frozen",
      description: `Membership frozen for ${requestedDays} days until ${request.freezeEnd.toISOString().split("T")[0]}`,
      actorId: req.user!.sub,
    });

    await logAudit({
      req,
      action: "approve_freeze",
      resource: "memberships",
      resourceId: request.membershipId,
      newValue: updatedMembership,
    });

    res.json({ request: { ...request, status: "approved" }, membership: updatedMembership });
  } catch (err) {
    next(err);
  }
});

router.post("/membership-freeze-requests/:id/reject", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
  try {
    const { adminNotes } = z.object({ adminNotes: z.string().optional() }).parse(req.body);

    const [request] = await db
      .select()
      .from(membershipFreezeRequestsTable)
      .where(eq(membershipFreezeRequestsTable.id, req.params.id as string));
    if (!request) throw new AppError(404, "Freeze request not found");
    if (request.status !== "pending") throw new AppError(400, "Request is not pending");

    const [updated] = await db
      .update(membershipFreezeRequestsTable)
      .set({
        status: "rejected",
        approvedBy: req.user!.sub,
        reviewedAt: new Date(),
        adminNotes: adminNotes ?? null,
      })
      .where(eq(membershipFreezeRequestsTable.id, req.params.id as string))
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: request.memberId,
      eventType: "freeze_rejected",
      description: `Freeze request rejected${adminNotes ? `: ${adminNotes}` : ""}`,
      actorId: req.user!.sub,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/memberships/auto-expire", requireAuth, requirePermission("memberships", "write"), async (req, res, next) => {
  try {
    const now = new Date();

    const [expiredResult, resumedResult] = await Promise.all([
      db
        .update(membershipsTable)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(membershipsTable.status, "active"),
            lt(membershipsTable.endDate, now),
          ),
        )
        .returning({ id: membershipsTable.id }),
      db
        .update(membershipsTable)
        .set({ status: "active", freezeStart: null, freezeEnd: null, updatedAt: now })
        .where(
          and(
            eq(membershipsTable.status, "frozen"),
            lt(membershipsTable.freezeEnd!, now),
          ),
        )
        .returning({ id: membershipsTable.id }),
    ]);

    req.log.info(
      { expired: expiredResult.length, resumed: resumedResult.length },
      "auto-expire run",
    );

    res.json({
      expired: expiredResult.length,
      resumed: resumedResult.length,
      processedAt: now,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
