import { Router } from "express";
import { db } from "@workspace/db";
import {
  classTypesTable,
  classSessionsTable,
  bookingsTable,
  waitlistEntriesTable,
  membersTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, count, asc, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

router.get("/class-types", requireAuth, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(classTypesTable)
      .where(eq(classTypesTable.isActive, true))
      .orderBy(classTypesTable.name);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/class-types", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      durationMinutes: z.number().int().positive().default(60),
      maxCapacity: z.number().int().positive().default(20),
      difficultyLevel: z.string().optional(),
      defaultTrainerId: z.string().uuid().optional(),
      color: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const [classType] = await db
      .insert(classTypesTable)
      .values(data)
      .returning();
    res.status(201).json(classType);
  } catch (err) {
    next(err);
  }
});

router.patch("/class-types/:id", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      durationMinutes: z.number().int().positive().optional(),
      maxCapacity: z.number().int().positive().optional(),
      difficultyLevel: z.string().optional(),
      isActive: z.boolean().optional(),
      color: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const [updated] = await db
      .update(classTypesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(classTypesTable.id, req.params.id))
      .returning();
    if (!updated) throw new AppError(404, "Class type not found");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/class-sessions", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const status = req.query.status as string | undefined;
    const classTypeId = req.query.classTypeId as string | undefined;

    const conditions = [];
    if (from) conditions.push(gte(classSessionsTable.startsAt, new Date(from)));
    if (to) conditions.push(lte(classSessionsTable.startsAt, new Date(to)));
    if (status)
      conditions.push(eq(classSessionsTable.status, status as any));
    if (classTypeId)
      conditions.push(eq(classSessionsTable.classTypeId, classTypeId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: classSessionsTable.id,
          classTypeId: classSessionsTable.classTypeId,
          className: classTypesTable.name,
          classColor: classTypesTable.color,
          trainerId: classSessionsTable.trainerId,
          trainerFirstName: usersTable.firstName,
          trainerLastName: usersTable.lastName,
          room: classSessionsTable.room,
          startsAt: classSessionsTable.startsAt,
          endsAt: classSessionsTable.endsAt,
          maxCapacity: classSessionsTable.maxCapacity,
          currentBookings: classSessionsTable.currentBookings,
          status: classSessionsTable.status,
        })
        .from(classSessionsTable)
        .leftJoin(
          classTypesTable,
          eq(classSessionsTable.classTypeId, classTypesTable.id),
        )
        .leftJoin(usersTable, eq(classSessionsTable.trainerId, usersTable.id))
        .where(where)
        .orderBy(asc(classSessionsTable.startsAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(classSessionsTable).where(where),
    ]);

    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/class-sessions", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      classTypeId: z.string().uuid(),
      trainerId: z.string().uuid().optional(),
      room: z.string().optional(),
      startsAt: z.string(),
      endsAt: z.string(),
      maxCapacity: z.number().int().positive().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const [classType] = await db
      .select()
      .from(classTypesTable)
      .where(eq(classTypesTable.id, data.classTypeId));
    if (!classType) throw new AppError(404, "Class type not found");

    const [session] = await db
      .insert(classSessionsTable)
      .values({
        ...data,
        maxCapacity: data.maxCapacity ?? classType.maxCapacity,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        createdBy: req.user!.sub,
      })
      .returning();

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/class-sessions/recurring",
  requireAuth,
  async (req, res, next) => {
    try {
      const schema = z.object({
        classTypeId: z.string().uuid(),
        trainerId: z.string().uuid().optional(),
        room: z.string().optional(),
        startDate: z.string(),
        endDate: z.string(),
        daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        maxCapacity: z.number().int().positive().optional(),
        notes: z.string().optional(),
      });
      const data = schema.parse(req.body);

      const [classType] = await db
        .select()
        .from(classTypesTable)
        .where(eq(classTypesTable.id, data.classTypeId));
      if (!classType) throw new AppError(404, "Class type not found");

      const capacity = data.maxCapacity ?? classType.maxCapacity;
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);

      if (end <= start) throw new AppError(400, "End date must be after start date");

      const sessions: any[] = [];
      const current = new Date(start);

      while (current <= end) {
        if (data.daysOfWeek.includes(current.getDay())) {
          const [startH, startM] = data.startTime.split(":").map(Number);
          const [endH, endM] = data.endTime.split(":").map(Number);

          const startsAt = new Date(current);
          startsAt.setHours(startH, startM, 0, 0);

          const endsAt = new Date(current);
          endsAt.setHours(endH, endM, 0, 0);

          sessions.push({
            classTypeId: data.classTypeId,
            trainerId: data.trainerId,
            room: data.room,
            startsAt,
            endsAt,
            maxCapacity: capacity,
            notes: data.notes,
            createdBy: req.user!.sub,
          });
        }
        current.setDate(current.getDate() + 1);
      }

      if (sessions.length === 0) {
        throw new AppError(
          400,
          "No sessions generated for the specified date range and days",
        );
      }

      if (sessions.length > 200) {
        throw new AppError(400, "Cannot generate more than 200 sessions at once");
      }

      const created = await db
        .insert(classSessionsTable)
        .values(sessions)
        .returning();

      res.status(201).json({
        count: created.length,
        sessions: created,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/class-sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const [session] = await db
      .select({
        id: classSessionsTable.id,
        classTypeId: classSessionsTable.classTypeId,
        className: classTypesTable.name,
        trainerId: classSessionsTable.trainerId,
        room: classSessionsTable.room,
        startsAt: classSessionsTable.startsAt,
        endsAt: classSessionsTable.endsAt,
        maxCapacity: classSessionsTable.maxCapacity,
        currentBookings: classSessionsTable.currentBookings,
        status: classSessionsTable.status,
        notes: classSessionsTable.notes,
      })
      .from(classSessionsTable)
      .leftJoin(
        classTypesTable,
        eq(classSessionsTable.classTypeId, classTypesTable.id),
      )
      .where(eq(classSessionsTable.id, req.params.id));
    if (!session) throw new AppError(404, "Session not found");

    const [bookings, waitlist] = await Promise.all([
      db
        .select({
          id: bookingsTable.id,
          memberId: bookingsTable.memberId,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          memberNumber: membersTable.memberNumber,
          status: bookingsTable.status,
          bookedAt: bookingsTable.bookedAt,
          attendedAt: bookingsTable.attendedAt,
        })
        .from(bookingsTable)
        .leftJoin(membersTable, eq(bookingsTable.memberId, membersTable.id))
        .where(eq(bookingsTable.sessionId, req.params.id)),
      db
        .select({
          id: waitlistEntriesTable.id,
          memberId: waitlistEntriesTable.memberId,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          position: waitlistEntriesTable.position,
          notifiedAt: waitlistEntriesTable.notifiedAt,
        })
        .from(waitlistEntriesTable)
        .leftJoin(
          membersTable,
          eq(waitlistEntriesTable.memberId, membersTable.id),
        )
        .where(
          and(
            eq(waitlistEntriesTable.sessionId, req.params.id),
            eq(waitlistEntriesTable.status, "waiting"),
          ),
        )
        .orderBy(waitlistEntriesTable.position),
    ]);

    res.json({ ...session, bookings, waitlist });
  } catch (err) {
    next(err);
  }
});

router.patch("/class-sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      trainerId: z.string().uuid().optional(),
      room: z.string().optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
      status: z
        .enum(["scheduled", "ongoing", "completed", "cancelled"])
        .optional(),
      cancellationReason: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.startsAt) updateData.startsAt = new Date(data.startsAt);
    if (data.endsAt) updateData.endsAt = new Date(data.endsAt);
    if (data.status === "cancelled") updateData.cancelledAt = new Date();

    const [updated] = await db
      .update(classSessionsTable)
      .set(updateData)
      .where(eq(classSessionsTable.id, req.params.id))
      .returning();
    if (!updated) throw new AppError(404, "Session not found");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/bookings", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const sessionId = req.query.sessionId as string | undefined;
    const memberId = req.query.memberId as string | undefined;

    const conditions = [];
    if (sessionId) conditions.push(eq(bookingsTable.sessionId, sessionId));
    if (memberId) conditions.push(eq(bookingsTable.memberId, memberId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: bookingsTable.id,
          memberId: bookingsTable.memberId,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          sessionId: bookingsTable.sessionId,
          className: classTypesTable.name,
          startsAt: classSessionsTable.startsAt,
          status: bookingsTable.status,
          bookedAt: bookingsTable.bookedAt,
        })
        .from(bookingsTable)
        .leftJoin(membersTable, eq(bookingsTable.memberId, membersTable.id))
        .leftJoin(
          classSessionsTable,
          eq(bookingsTable.sessionId, classSessionsTable.id),
        )
        .leftJoin(
          classTypesTable,
          eq(classSessionsTable.classTypeId, classTypesTable.id),
        )
        .where(where)
        .orderBy(desc(bookingsTable.bookedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(bookingsTable).where(where),
    ]);

    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/bookings", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      memberId: z.string().uuid(),
      sessionId: z.string().uuid(),
    });
    const { memberId, sessionId } = schema.parse(req.body);

    const [session] = await db
      .select()
      .from(classSessionsTable)
      .where(eq(classSessionsTable.id, sessionId));
    if (!session) throw new AppError(404, "Session not found");
    if (session.status === "cancelled")
      throw new AppError(400, "Session is cancelled");

    const capacity = session.maxCapacity ?? 20;
    const existing = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.memberId, memberId),
          eq(bookingsTable.sessionId, sessionId),
          eq(bookingsTable.status, "confirmed"),
        ),
      );
    if (existing.length > 0)
      throw new AppError(400, "Already booked for this session");

    if ((session.currentBookings ?? 0) >= capacity) {
      const [lastWaitlist] = await db
        .select({ position: waitlistEntriesTable.position })
        .from(waitlistEntriesTable)
        .where(eq(waitlistEntriesTable.sessionId, sessionId))
        .orderBy(desc(waitlistEntriesTable.position))
        .limit(1);
      const position = (lastWaitlist?.position ?? 0) + 1;
      const [entry] = await db
        .insert(waitlistEntriesTable)
        .values({
          memberId,
          sessionId,
          position,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        })
        .returning();
      res.status(201).json({ waitlisted: true, position, entry });
      return;
    }

    const [booking] = await db
      .insert(bookingsTable)
      .values({ memberId, sessionId })
      .returning();
    await db
      .update(classSessionsTable)
      .set({
        currentBookings: (session.currentBookings ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(classSessionsTable.id, sessionId));
    res.status(201).json({ waitlisted: false, booking });
  } catch (err) {
    next(err);
  }
});

router.delete("/bookings/:id", requireAuth, async (req, res, next) => {
  try {
    const { reason } = z
      .object({ reason: z.string().optional() })
      .parse(req.body);
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, req.params.id));
    if (!booking) throw new AppError(404, "Booking not found");

    await db
      .update(bookingsTable)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: reason,
      })
      .where(eq(bookingsTable.id, req.params.id));

    const [session] = await db
      .select()
      .from(classSessionsTable)
      .where(eq(classSessionsTable.id, booking.sessionId));
    if (session && (session.currentBookings ?? 0) > 0) {
      await db
        .update(classSessionsTable)
        .set({
          currentBookings: (session.currentBookings ?? 0) - 1,
          updatedAt: new Date(),
        })
        .where(eq(classSessionsTable.id, booking.sessionId));

      const [nextWaitlist] = await db
        .select()
        .from(waitlistEntriesTable)
        .where(
          and(
            eq(waitlistEntriesTable.sessionId, booking.sessionId),
            eq(waitlistEntriesTable.status, "waiting"),
          ),
        )
        .orderBy(waitlistEntriesTable.position)
        .limit(1);

      if (nextWaitlist) {
        await db
          .update(waitlistEntriesTable)
          .set({ status: "promoted", notifiedAt: new Date() })
          .where(eq(waitlistEntriesTable.id, nextWaitlist.id));
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/bookings/:id/attendance",
  requireAuth,
  async (req, res, next) => {
    try {
      const { status } = z
        .object({ status: z.enum(["attended", "no_show"]) })
        .parse(req.body);
      const [updated] = await db
        .update(bookingsTable)
        .set({
          status,
          attendedAt: status === "attended" ? new Date() : null,
        })
        .where(eq(bookingsTable.id, req.params.id))
        .returning();
      if (!updated) throw new AppError(404, "Booking not found");
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
