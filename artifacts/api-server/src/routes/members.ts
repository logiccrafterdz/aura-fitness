import { Router } from "express";
import { db } from "@workspace/db";
import {
  membersTable,
  memberTimelineEventsTable,
  membershipsTable,
  plansTable,
  invoicesTable,
  paymentsTable,
  bookingsTable,
  classSessionsTable,
  classTypesTable,
  accessLogsTable,
} from "@workspace/db";
import { eq, ilike, or, and, desc, count, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

function generateMemberNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `AUR${year}${rand}`;
}

router.get("/members", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const gender = req.query.gender as string | undefined;

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(membersTable.firstName, `%${search}%`),
          ilike(membersTable.lastName, `%${search}%`),
          ilike(membersTable.phone, `%${search}%`),
          ilike(membersTable.memberNumber, `%${search}%`),
          ilike(membersTable.email ?? membersTable.email, `%${search}%`),
        ),
      );
    }
    if (status) conditions.push(eq(membersTable.status, status as any));
    if (gender) conditions.push(eq(membersTable.gender, gender as any));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(membersTable)
        .where(where)
        .orderBy(desc(membersTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(membersTable).where(where),
    ]);

    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/members", requireAuth, async (req, res, next) => {
  try {
    const createSchema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      firstNameAr: z.string().optional(),
      lastNameAr: z.string().optional(),
      phone: z.string().min(1),
      email: z.string().email().optional(),
      gender: z.enum(["male", "female"]).optional(),
      dateOfBirth: z.string().optional(),
      address: z.string().optional(),
      emergencyContact: z.string().optional(),
      medicalNotes: z.string().optional(),
      notes: z.string().optional(),
      consentMarketing: z.boolean().optional(),
      consentHealthData: z.boolean().optional(),
    });

    const data = createSchema.parse(req.body);

    let memberNumber: string;
    let exists = true;
    do {
      memberNumber = generateMemberNumber();
      const [existing] = await db
        .select({ id: membersTable.id })
        .from(membersTable)
        .where(eq(membersTable.memberNumber, memberNumber));
      exists = !!existing;
    } while (exists);

    const [member] = await db
      .insert(membersTable)
      .values({
        ...data,
        memberNumber,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        createdBy: req.user!.sub,
      })
      .returning();

    await db.insert(memberTimelineEventsTable).values({
      memberId: member.id,
      eventType: "member_created",
      description: "Member profile created",
      actorId: req.user!.sub,
    });

    await logAudit({
      req,
      action: "create",
      resource: "members",
      resourceId: member.id,
      newValue: member,
    });

    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

router.get("/members/:id", requireAuth, async (req, res, next) => {
  try {
    const [member] = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, req.params.id));
    if (!member) throw new AppError(404, "Member not found");

    const [activeMembership] = await db
      .select({ id: membershipsTable.id, status: membershipsTable.status, endDate: membershipsTable.endDate, planName: plansTable.name })
      .from(membershipsTable)
      .leftJoin(plansTable, eq(membershipsTable.planId, plansTable.id))
      .where(and(eq(membershipsTable.memberId, req.params.id), eq(membershipsTable.status, "active")))
      .orderBy(desc(membershipsTable.createdAt))
      .limit(1);

    res.json({ ...member, activeMembership: activeMembership ?? null });
  } catch (err) {
    next(err);
  }
});

router.patch("/members/:id", requireAuth, async (req, res, next) => {
  try {
    const [existing] = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, req.params.id));
    if (!existing) throw new AppError(404, "Member not found");

    const updateSchema = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      firstNameAr: z.string().optional(),
      lastNameAr: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      gender: z.enum(["male", "female"]).optional(),
      dateOfBirth: z.string().optional(),
      address: z.string().optional(),
      emergencyContact: z.string().optional(),
      medicalNotes: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["active", "inactive", "suspended", "pending"]).optional(),
      consentMarketing: z.boolean().optional(),
      consentHealthData: z.boolean().optional(),
    });
    const data = updateSchema.parse(req.body);

    const [updated] = await db
      .update(membersTable)
      .set({
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(membersTable.id, req.params.id))
      .returning();

    if (data.status && data.status !== existing.status) {
      await db.insert(memberTimelineEventsTable).values({
        memberId: req.params.id,
        eventType: "status_changed",
        description: `Status changed from ${existing.status} to ${data.status}`,
        actorId: req.user!.sub,
      });
    }

    await logAudit({
      req,
      action: "update",
      resource: "members",
      resourceId: req.params.id,
      oldValue: existing,
      newValue: updated,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/members/:id/timeline", requireAuth, async (req, res, next) => {
  try {
    const events = await db
      .select()
      .from(memberTimelineEventsTable)
      .where(eq(memberTimelineEventsTable.memberId, req.params.id))
      .orderBy(desc(memberTimelineEventsTable.createdAt))
      .limit(50);
    res.json(events);
  } catch (err) {
    next(err);
  }
});

router.get("/members/:id/memberships", requireAuth, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: membershipsTable.id,
        status: membershipsTable.status,
        startDate: membershipsTable.startDate,
        endDate: membershipsTable.endDate,
        planName: plansTable.name,
        planPrice: plansTable.price,
        createdAt: membershipsTable.createdAt,
      })
      .from(membershipsTable)
      .leftJoin(plansTable, eq(membershipsTable.planId, plansTable.id))
      .where(eq(membershipsTable.memberId, req.params.id))
      .orderBy(desc(membershipsTable.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/members/:id/invoices", requireAuth, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.memberId, req.params.id))
      .orderBy(desc(invoicesTable.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/members/:id/bookings", requireAuth, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: bookingsTable.id,
        status: bookingsTable.status,
        bookedAt: bookingsTable.bookedAt,
        sessionStartsAt: classSessionsTable.startsAt,
        sessionEndsAt: classSessionsTable.endsAt,
        className: classTypesTable.name,
      })
      .from(bookingsTable)
      .leftJoin(classSessionsTable, eq(bookingsTable.sessionId, classSessionsTable.id))
      .leftJoin(classTypesTable, eq(classSessionsTable.classTypeId, classTypesTable.id))
      .where(eq(bookingsTable.memberId, req.params.id))
      .orderBy(desc(bookingsTable.bookedAt))
      .limit(20);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get("/members/:id/access-logs", requireAuth, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(accessLogsTable)
      .where(eq(accessLogsTable.memberId, req.params.id))
      .orderBy(desc(accessLogsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;
