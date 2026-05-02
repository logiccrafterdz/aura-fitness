import { Router } from "express";
import { db } from "@workspace/db";
import {
  accessPointsTable,
  accessTokensTable,
  accessLogsTable,
  timeRulesTable,
  membersTable,
  membershipsTable,
  plansTable,
} from "@workspace/db";
import { eq, and, desc, count, lt, gte, lte } from "drizzle-orm";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { requireAuth, requirePermission } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();
const QR_SECRET = process.env.QR_SECRET || "aura-qr-secret";
const QR_EXPIRY_SECONDS = 60;

// Simple in-memory rate limiter for verify endpoint
const _verifyRateMap = new Map<string, { count: number; resetAt: number }>();
function verifyRateLimit(req: any, res: any, next: any) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.ip ??
    "unknown";
  const now = Date.now();
  const entry = _verifyRateMap.get(ip);
  if (!entry || entry.resetAt < now) {
    _verifyRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  if (entry.count >= 10) {
    res.status(429).json({ error: "Too many verification attempts. Try again in 1 minute." });
    return;
  }
  entry.count++;
  next();
}

function generateQrPayload(memberId: string): string {
  const payload = {
    sub: memberId,
    type: "qr",
    iat: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, QR_SECRET, { expiresIn: `${QR_EXPIRY_SECONDS}s` });
}

function getClientIp(req: any): string {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
    req.ip ??
    req.socket?.remoteAddress ??
    "unknown"
  );
}

router.get(
  "/members/:memberId/access-token",
  requireAuth,
  requirePermission("access", "read"),
  async (req, res, next) => {
    try {
      const memberId = req.params.memberId as string;
      const [member] = await db
        .select({ id: membersTable.id, firstName: membersTable.firstName })
        .from(membersTable)
        .where(eq(membersTable.id, memberId));
      if (!member) throw new AppError(404, "Member not found");

      const token = generateQrPayload(memberId);
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + QR_EXPIRY_SECONDS * 1000);

      await db.insert(accessTokensTable).values({
        memberId,
        tokenHash,
        tokenType: "qr",
        expiresAt,
      });

      res.json({
        token,
        expiresAt,
        memberId,
        expiresInSeconds: QR_EXPIRY_SECONDS,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/portal/access-token/:memberNumber", async (req, res, next) => {
  try {
    const memberNumber = req.params.memberNumber as string;
    const [member] = await db
      .select({ id: membersTable.id, firstName: membersTable.firstName, status: membersTable.status })
      .from(membersTable)
      .where(eq(membersTable.memberNumber, memberNumber));
    if (!member) throw new AppError(404, "Member not found");
    if (member.status !== "active") throw new AppError(403, "Member account is not active");

    const token = generateQrPayload(member.id);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + QR_EXPIRY_SECONDS * 1000);

    await db.insert(accessTokensTable).values({
      memberId: member.id,
      tokenHash,
      tokenType: "qr",
      expiresAt,
    });

    res.json({ token, expiresAt, memberId: member.id, expiresInSeconds: QR_EXPIRY_SECONDS });
  } catch (err) {
    next(err);
  }
});

router.post("/access/verify", verifyRateLimit, async (req, res, next) => {
  try {
    const schema = z.object({
      token: z.string(),
      accessPointId: z.string().uuid().optional(),
    });
    const { token, accessPointId } = schema.parse(req.body);
    const ip = getClientIp(req);

    let memberId: string;
    try {
      const decoded = jwt.verify(token, QR_SECRET) as {
        sub: string;
        type: string;
      };
      memberId = decoded.sub;
    } catch {
      await db.insert(accessLogsTable).values({
        accessPointId: accessPointId ?? null,
        result: "denied",
        denialReason: "invalid_token",
        verifiedVia: "qr",
        rawToken: token.slice(0, 20),
        ipAddress: ip,
      });
      res.json({
        allowed: false,
        reason: "invalid_token",
        message: "Invalid or expired QR code",
      });
      return;
    }

    const [member] = await db
      .select()
      .from(membersTable)
      .where(eq(membersTable.id, memberId));
    if (!member || member.status !== "active") {
      await db.insert(accessLogsTable).values({
        memberId,
        accessPointId: accessPointId ?? null,
        result: "denied",
        denialReason: "member_inactive",
        verifiedVia: "qr",
        ipAddress: ip,
      });
      res.json({
        allowed: false,
        reason: "member_inactive",
        message: "Member account is not active",
      });
      return;
    }

    const now = new Date();
    const [membership] = await db
      .select({
        id: membershipsTable.id,
        endDate: membershipsTable.endDate,
        status: membershipsTable.status,
        planId: membershipsTable.planId,
      })
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.memberId, memberId),
          eq(membershipsTable.status, "active"),
        ),
      )
      .orderBy(desc(membershipsTable.endDate))
      .limit(1);

    if (!membership) {
      await db.insert(accessLogsTable).values({
        memberId,
        accessPointId: accessPointId ?? null,
        result: "denied",
        denialReason: "no_active_membership",
        verifiedVia: "qr",
        ipAddress: ip,
      });
      res.json({
        allowed: false,
        reason: "no_active_membership",
        message: "No active membership found",
      });
      return;
    }

    if (membership.endDate < now) {
      await db.insert(accessLogsTable).values({
        memberId,
        accessPointId: accessPointId ?? null,
        result: "denied",
        denialReason: "membership_expired",
        verifiedVia: "qr",
        ipAddress: ip,
      });
      res.json({
        allowed: false,
        reason: "membership_expired",
        message: "Membership has expired",
      });
      return;
    }

    if (accessPointId) {
      const [accessPoint] = await db
        .select()
        .from(accessPointsTable)
        .where(eq(accessPointsTable.id, accessPointId));

      if (accessPoint && accessPoint.zone && accessPoint.zone !== "main") {
        const [plan] = await db
          .select({ allowedZones: plansTable.allowedZones })
          .from(plansTable)
          .where(eq(plansTable.id, membership.planId));

        if (plan && plan.allowedZones) {
          const zones = plan.allowedZones as string[];
          if (
            zones.length > 0 &&
            !zones.includes(accessPoint.zone) &&
            !zones.includes("all")
          ) {
            await db.insert(accessLogsTable).values({
              memberId,
              accessPointId,
              result: "denied",
              denialReason: "zone_not_allowed",
              verifiedVia: "qr",
              ipAddress: ip,
            });
            res.json({
              allowed: false,
              reason: "zone_not_allowed",
              message: `Your plan does not include access to the ${accessPoint.zone} zone`,
            });
            return;
          }
        }
      }
    }

    const hour = now.getHours();
    const minute = now.getMinutes();
    const dayOfWeek = now.getDay();
    const currentTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    const activeRules = await db
      .select()
      .from(timeRulesTable)
      .where(eq(timeRulesTable.isActive, true));

    for (const rule of activeRules) {
      const days = (rule.daysOfWeek as number[]) ?? [0, 1, 2, 3, 4, 5, 6];
      if (!days.includes(dayOfWeek)) continue;
      if (currentTime < rule.startTime || currentTime > rule.endTime) continue;
      if (
        rule.allowedGender &&
        member.gender &&
        rule.allowedGender !== member.gender
      ) {
        await db.insert(accessLogsTable).values({
          memberId,
          accessPointId: accessPointId ?? null,
          result: "denied",
          denialReason: "time_rule_violation",
          verifiedVia: "qr",
          ipAddress: ip,
        });
        res.json({
          allowed: false,
          reason: "time_rule_violation",
          message: `Access not permitted at this time (${rule.name})`,
        });
        return;
      }
    }

    const [log] = await db
      .insert(accessLogsTable)
      .values({
        memberId,
        accessPointId: accessPointId ?? null,
        result: "allowed",
        verifiedVia: "qr",
        ipAddress: ip,
      })
      .returning();

    res.json({
      allowed: true,
      memberId,
      memberName: `${member.firstName} ${member.lastName}`,
      memberPhoto: member.photoUrl,
      membershipExpiry: membership.endDate,
      logId: log.id,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/access/heartbeat", async (req, res, next) => {
  try {
    const { accessPointId } = z
      .object({ accessPointId: z.string().uuid() })
      .parse(req.body);

    await db
      .update(accessPointsTable)
      .set({ lastHeartbeatAt: new Date() })
      .where(eq(accessPointsTable.id, accessPointId));

    res.json({ ok: true, timestamp: new Date() });
  } catch (err) {
    next(err);
  }
});

router.get("/access/logs", requireAuth, requirePermission("access", "read"), async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const memberId = req.query.memberId as string | undefined;
    const result = req.query.result as string | undefined;
    const accessPointId = req.query.accessPointId as string | undefined;

    const conditions = [];
    if (memberId) conditions.push(eq(accessLogsTable.memberId, memberId));
    if (result)
      conditions.push(eq(accessLogsTable.result, result as any));
    if (accessPointId)
      conditions.push(eq(accessLogsTable.accessPointId, accessPointId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: accessLogsTable.id,
          memberId: accessLogsTable.memberId,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          memberNumber: membersTable.memberNumber,
          accessPointId: accessLogsTable.accessPointId,
          accessPointName: accessPointsTable.name,
          result: accessLogsTable.result,
          denialReason: accessLogsTable.denialReason,
          verifiedVia: accessLogsTable.verifiedVia,
          ipAddress: accessLogsTable.ipAddress,
          createdAt: accessLogsTable.createdAt,
        })
        .from(accessLogsTable)
        .leftJoin(membersTable, eq(accessLogsTable.memberId, membersTable.id))
        .leftJoin(
          accessPointsTable,
          eq(accessLogsTable.accessPointId, accessPointsTable.id),
        )
        .where(where)
        .orderBy(desc(accessLogsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(accessLogsTable).where(where),
    ]);

    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.get("/access/points", requireAuth, requirePermission("access", "read"), async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(accessPointsTable)
      .orderBy(accessPointsTable.name);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/access/points", requireAuth, requirePermission("access", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      location: z.string().optional(),
      zone: z.string().default("main"),
      type: z.string().default("entry"),
      hardwareId: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const [point] = await db
      .insert(accessPointsTable)
      .values(data)
      .returning();
    await logAudit({
      req,
      action: "create",
      resource: "access_points",
      resourceId: point.id,
      newValue: point,
    });
    res.status(201).json(point);
  } catch (err) {
    next(err);
  }
});

router.patch("/access/points/:id", requireAuth, requirePermission("access", "write"), async (req, res, next) => {
  try {
    const [existing] = await db
      .select()
      .from(accessPointsTable)
      .where(eq(accessPointsTable.id, req.params.id as string));
    if (!existing) throw new AppError(404, "Access point not found");

    const schema = z.object({
      name: z.string().optional(),
      location: z.string().optional(),
      zone: z.string().optional(),
      isActive: z.boolean().optional(),
      hardwareId: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const [updated] = await db
      .update(accessPointsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accessPointsTable.id, req.params.id as string))
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/access/points/:id", requireAuth, requirePermission("access", "write"), async (req, res, next) => {
  try {
    await db
      .update(accessPointsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(accessPointsTable.id, req.params.id as string));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/access/time-rules", requireAuth, requirePermission("access", "read"), async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(timeRulesTable)
      .orderBy(timeRulesTable.name);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/access/time-rules", requireAuth, requirePermission("access", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      allowedGender: z.string().nullable().optional(),
      startTime: z.string(),
      endTime: z.string(),
      daysOfWeek: z.array(z.number()).optional(),
      zone: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const [rule] = await db.insert(timeRulesTable).values(data).returning();
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/access/time-rules/:id",
  requireAuth,
  requirePermission("access", "write"),
  async (req, res, next) => {
    try {
      const schema = z.object({
        name: z.string().optional(),
        allowedGender: z.string().nullable().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        daysOfWeek: z.array(z.number()).optional(),
        isActive: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const [updated] = await db
        .update(timeRulesTable)
        .set(data)
        .where(eq(timeRulesTable.id, req.params.id as string))
        .returning();
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
