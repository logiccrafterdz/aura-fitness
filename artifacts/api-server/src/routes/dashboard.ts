import { Router } from "express";
import { db } from "@workspace/db";
import {
  membersTable,
  membershipsTable,
  invoicesTable,
  paymentsTable,
  accessLogsTable,
  bookingsTable,
  classSessionsTable,
  classTypesTable,
  plansTable,
  productsTable,
  ordersTable,
} from "@workspace/db";
import { eq, and, gte, lte, desc, count, sql, lt } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/reports/dashboard", requireAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

    const [
      [{ totalMembers }],
      [{ activeMembers }],
      [{ activeMemberships }],
      [{ expiringSoon }],
      [{ todayRevenue }],
      [{ monthRevenue }],
      [{ todayAccess }],
      [{ pendingPayments }],
      [{ pendingBaridimob }],
      [{ todayBookings }],
      recentActivity,
      membersByStatus,
      lowStockProducts,
    ] = await Promise.all([
      db.select({ totalMembers: count() }).from(membersTable),
      db
        .select({ activeMembers: count() })
        .from(membersTable)
        .where(eq(membersTable.status, "active")),
      db
        .select({ activeMemberships: count() })
        .from(membershipsTable)
        .where(eq(membershipsTable.status, "active")),
      db
        .select({ expiringSoon: count() })
        .from(membershipsTable)
        .where(
          and(
            eq(membershipsTable.status, "active"),
            lte(membershipsTable.endDate, sevenDaysFromNow),
            gte(membershipsTable.endDate, now),
          ),
        ),
      db
        .select({
          todayRevenue: sql<string>`coalesce(sum(amount::numeric), 0)`,
        })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.status, "confirmed"),
            gte(paymentsTable.confirmedAt!, todayStart),
            lt(paymentsTable.confirmedAt!, todayEnd),
          ),
        ),
      db
        .select({
          monthRevenue: sql<string>`coalesce(sum(amount::numeric), 0)`,
        })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.status, "confirmed"),
            gte(paymentsTable.confirmedAt!, monthStart),
          ),
        ),
      db
        .select({ todayAccess: count() })
        .from(accessLogsTable)
        .where(
          and(
            eq(accessLogsTable.result, "allowed"),
            gte(accessLogsTable.createdAt, todayStart),
            lt(accessLogsTable.createdAt, todayEnd),
          ),
        ),
      db
        .select({ pendingPayments: count() })
        .from(paymentsTable)
        .where(eq(paymentsTable.status, "pending")),
      db
        .select({ pendingBaridimob: count() })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.status, "pending"),
            eq(paymentsTable.method, "baridimob"),
          ),
        ),
      db
        .select({ todayBookings: count() })
        .from(bookingsTable)
        .where(gte(bookingsTable.bookedAt, todayStart)),
      db
        .select({
          memberId: accessLogsTable.memberId,
          firstName: membersTable.firstName,
          lastName: membersTable.lastName,
          result: accessLogsTable.result,
          createdAt: accessLogsTable.createdAt,
        })
        .from(accessLogsTable)
        .leftJoin(membersTable, eq(accessLogsTable.memberId, membersTable.id))
        .orderBy(desc(accessLogsTable.createdAt))
        .limit(15),
      db
        .select({ status: membersTable.status, count: count() })
        .from(membersTable)
        .groupBy(membersTable.status),
      db
        .select({
          id: productsTable.id,
          name: productsTable.name,
          category: productsTable.category,
          stockQuantity: productsTable.stockQuantity,
          lowStockThreshold: productsTable.lowStockThreshold,
        })
        .from(productsTable)
        .where(
          and(
            eq(productsTable.isActive, true),
            sql`${productsTable.stockQuantity} <= ${productsTable.lowStockThreshold}`,
          ),
        )
        .orderBy(productsTable.stockQuantity)
        .limit(10),
    ]);

    const [expiringSoonMembers, todaysClasses, revenueByMethod] =
      await Promise.all([
        db
          .select({
            id: membershipsTable.id,
            memberId: membershipsTable.memberId,
            firstName: membersTable.firstName,
            lastName: membersTable.lastName,
            memberNumber: membersTable.memberNumber,
            endDate: membershipsTable.endDate,
            planName: plansTable.name,
          })
          .from(membershipsTable)
          .leftJoin(
            membersTable,
            eq(membershipsTable.memberId, membersTable.id),
          )
          .leftJoin(plansTable, eq(membershipsTable.planId, plansTable.id))
          .where(
            and(
              eq(membershipsTable.status, "active"),
              lte(membershipsTable.endDate, sevenDaysFromNow),
              gte(membershipsTable.endDate, now),
            ),
          )
          .orderBy(membershipsTable.endDate)
          .limit(10),
        db
          .select({
            id: classSessionsTable.id,
            className: classTypesTable.name,
            classColor: classTypesTable.color,
            startsAt: classSessionsTable.startsAt,
            endsAt: classSessionsTable.endsAt,
            maxCapacity: classSessionsTable.maxCapacity,
            currentBookings: classSessionsTable.currentBookings,
            room: classSessionsTable.room,
            status: classSessionsTable.status,
          })
          .from(classSessionsTable)
          .leftJoin(
            classTypesTable,
            eq(classSessionsTable.classTypeId, classTypesTable.id),
          )
          .where(
            and(
              gte(classSessionsTable.startsAt, todayStart),
              lt(classSessionsTable.startsAt, todayEnd),
            ),
          )
          .orderBy(classSessionsTable.startsAt),
        db.execute(sql`
          SELECT method, count(*) as count, coalesce(sum(amount::numeric), 0) as total
          FROM payments
          WHERE status = 'confirmed' AND confirmed_at >= ${monthStart}
          GROUP BY method
          ORDER BY total DESC
        `),
      ]);

    res.json({
      members: {
        total: Number(totalMembers),
        active: Number(activeMembers),
        byStatus: membersByStatus,
      },
      memberships: {
        active: Number(activeMemberships),
        expiringSoon: Number(expiringSoon),
        expiringSoonList: expiringSoonMembers,
      },
      revenue: {
        today: parseFloat(todayRevenue),
        thisMonth: parseFloat(monthRevenue),
        byMethod: revenueByMethod.rows,
      },
      access: {
        today: Number(todayAccess),
        recentActivity,
      },
      operations: {
        pendingPayments: Number(pendingPayments),
        pendingBaridimob: Number(pendingBaridimob),
        todayBookings: Number(todayBookings),
        todaysClasses: todaysClasses.map((s) => ({
          ...s,
          fillRate:
            s.maxCapacity && s.maxCapacity > 0
              ? Math.round(((s.currentBookings ?? 0) / s.maxCapacity) * 100)
              : 0,
          spotsLeft: Math.max(
            0,
            (s.maxCapacity ?? 0) - (s.currentBookings ?? 0),
          ),
        })),
        lowStockProducts,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/revenue", requireAuth, async (req, res, next) => {
  try {
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const groupBy = (req.query.groupBy as string) ?? "day";

    const dateTrunc =
      groupBy === "month" ? "month" : groupBy === "week" ? "week" : "day";

    const revenueData = await db.execute(sql`
      SELECT 
        date_trunc(${dateTrunc}, confirmed_at) as period,
        count(*) as transactions,
        sum(amount::numeric) as total,
        method
      FROM payments
      WHERE status = 'confirmed'
        AND confirmed_at >= ${from}
        AND confirmed_at <= ${to}
      GROUP BY period, method
      ORDER BY period ASC
    `);

    const invoiceData = await db.execute(sql`
      SELECT 
        status,
        count(*) as count,
        sum(total::numeric) as amount
      FROM invoices
      WHERE created_at >= ${from} AND created_at <= ${to}
      GROUP BY status
    `);

    res.json({
      period: { from, to, groupBy },
      revenueByPeriod: revenueData.rows,
      invoiceSummary: invoiceData.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/members", requireAuth, async (req, res, next) => {
  try {
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 90 * 86400000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const [newMembers, cancelledMemberships, byGender, byPlan] =
      await Promise.all([
        db.execute(sql`
          SELECT date_trunc('week', created_at) as week, count(*) as count
          FROM members WHERE created_at >= ${from} AND created_at <= ${to}
          GROUP BY week ORDER BY week
        `),
        db.execute(sql`
          SELECT date_trunc('week', cancelled_at) as week, count(*) as count
          FROM memberships WHERE cancelled_at >= ${from} AND cancelled_at <= ${to}
          GROUP BY week ORDER BY week
        `),
        db
          .select({ gender: membersTable.gender, count: count() })
          .from(membersTable)
          .groupBy(membersTable.gender),
        db.execute(sql`
          SELECT p.name as plan_name, count(*) as count, ms.status
          FROM memberships ms
          JOIN plans p ON p.id = ms.plan_id
          WHERE ms.created_at >= ${from}
          GROUP BY p.name, ms.status
          ORDER BY count DESC
        `),
      ]);

    res.json({
      newMembers: newMembers.rows,
      cancelledMemberships: cancelledMemberships.rows,
      byGender,
      byPlan: byPlan.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/access", requireAuth, async (req, res, next) => {
  try {
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 30 * 86400000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const [daily, byResult, peakHours, byPoint] = await Promise.all([
      db.execute(sql`
        SELECT date_trunc('day', created_at) as day, count(*) as total,
          sum(case when result='allowed' then 1 else 0 end) as allowed,
          sum(case when result='denied' then 1 else 0 end) as denied
        FROM access_logs WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY day ORDER BY day
      `),
      db.execute(sql`
        SELECT result, denial_reason, count(*) as count
        FROM access_logs WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY result, denial_reason ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT extract(hour from created_at) as hour, count(*) as count
        FROM access_logs WHERE result='allowed' AND created_at >= ${from} AND created_at <= ${to}
        GROUP BY hour ORDER BY hour
      `),
      db.execute(sql`
        SELECT ap.name as point_name, count(*) as total
        FROM access_logs al
        LEFT JOIN access_points ap ON ap.id = al.access_point_id
        WHERE al.created_at >= ${from} AND al.created_at <= ${to}
        GROUP BY ap.name ORDER BY total DESC
      `),
    ]);

    res.json({
      daily: daily.rows,
      byResult: byResult.rows,
      peakHours: peakHours.rows,
      byPoint: byPoint.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/classes", requireAuth, async (req, res, next) => {
  try {
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 30 * 86400000);

    const [sessionStats, bookingStats, attendanceRate] = await Promise.all([
      db.execute(sql`
        SELECT ct.name, count(cs.id) as sessions, sum(cs.current_bookings) as total_bookings
        FROM class_sessions cs
        JOIN class_types ct ON ct.id = cs.class_type_id
        WHERE cs.starts_at >= ${from}
        GROUP BY ct.name ORDER BY total_bookings DESC
      `),
      db.execute(sql`
        SELECT status, count(*) as count FROM bookings
        WHERE booked_at >= ${from} GROUP BY status
      `),
      db.execute(sql`
        SELECT ct.name,
          count(b.id) as total_bookings,
          sum(case when b.status='attended' then 1 else 0 end) as attended,
          sum(case when b.status='no_show' then 1 else 0 end) as no_show
        FROM bookings b
        JOIN class_sessions cs ON cs.id = b.session_id
        JOIN class_types ct ON ct.id = cs.class_type_id
        WHERE b.booked_at >= ${from}
        GROUP BY ct.name ORDER BY total_bookings DESC
      `),
    ]);

    res.json({
      sessionStats: sessionStats.rows,
      bookingStats: bookingStats.rows,
      attendanceRate: attendanceRate.rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/store", requireAuth, async (req, res, next) => {
  try {
    const from = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 30 * 86400000);

    const [topProducts, salesByDay, lowStock] = await Promise.all([
      db.execute(sql`
        SELECT p.name, p.category, sum(oi.quantity) as units_sold, sum(oi.total::numeric) as revenue
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= ${from} AND o.status != 'cancelled'
        GROUP BY p.name, p.category ORDER BY revenue DESC LIMIT 20
      `),
      db.execute(sql`
        SELECT date_trunc('day', created_at) as day, sum(total::numeric) as revenue, count(*) as orders
        FROM orders WHERE created_at >= ${from} AND status != 'cancelled'
        GROUP BY day ORDER BY day
      `),
      db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.isActive, true),
            sql`${productsTable.stockQuantity} <= ${productsTable.lowStockThreshold}`,
          ),
        )
        .orderBy(productsTable.stockQuantity),
    ]);

    res.json({
      topProducts: topProducts.rows,
      salesByDay: salesByDay.rows,
      lowStock,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
