import { Router } from "express";
import { db } from "@workspace/db";
import { systemConfigTable, businessRulesTable, auditLogsTable, usersTable } from "@workspace/db";
import { eq, desc, and, count, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

router.get("/settings", requireAuth, async (req, res, next) => {
  try {
    const rows = await db.select().from(systemConfigTable).orderBy(systemConfigTable.category, systemConfigTable.key);
    const grouped: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = {};
      grouped[row.category][row.key] = row.value;
    }
    res.json(grouped);
  } catch (err) {
    next(err);
  }
});

router.patch("/settings", requireAuth, async (req, res, next) => {
  try {
    const schema = z.record(z.string(), z.string());
    const updates = schema.parse(req.body);

    for (const [key, value] of Object.entries(updates)) {
      await db
        .insert(systemConfigTable)
        .values({ key, value, updatedBy: req.user!.sub })
        .onConflictDoUpdate({ target: systemConfigTable.key, set: { value, updatedBy: req.user!.sub, updatedAt: new Date() } });
    }

    await logAudit({ req, action: "update", resource: "settings", newValue: updates });
    res.json({ success: true, updated: Object.keys(updates).length });
  } catch (err) {
    next(err);
  }
});

router.get("/business-rules", requireAuth, async (req, res, next) => {
  try {
    const rows = await db.select().from(businessRulesTable).orderBy(businessRulesTable.category, businessRulesTable.key);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.patch("/business-rules/:key", requireAuth, async (req, res, next) => {
  try {
    const { value, description } = z.object({ value: z.string(), description: z.string().optional() }).parse(req.body);

    const [existing] = await db.select().from(businessRulesTable).where(eq(businessRulesTable.key, req.params.key as string));

    if (existing) {
      const [updated] = await db
        .update(businessRulesTable)
        .set({ value, description, updatedBy: req.user!.sub, updatedAt: new Date() })
        .where(eq(businessRulesTable.key, req.params.key as string))
        .returning();
      await logAudit({ req, action: "update", resource: "business_rules", resourceId: req.params.key as string, oldValue: existing, newValue: updated });
      res.json(updated);
    } else {
      const [created] = await db
        .insert(businessRulesTable)
        .values({ key: req.params.key as string, value, description, updatedBy: req.user!.sub })
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    next(err);
  }
});

router.get("/audit-logs", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const resource = req.query.resource as string | undefined;
    const userId = req.query.userId as string | undefined;
    const action = req.query.action as string | undefined;
    const search = req.query.search as string | undefined;

    const conditions = [];
    if (resource) conditions.push(eq(auditLogsTable.resource, resource));
    if (userId) conditions.push(eq(auditLogsTable.userId, userId));
    if (action) conditions.push(eq(auditLogsTable.action, action));
    if (search) conditions.push(or(ilike(auditLogsTable.userEmail, `%${search}%`), ilike(auditLogsTable.resource, `%${search}%`)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: auditLogsTable.id,
          userId: auditLogsTable.userId,
          userEmail: auditLogsTable.userEmail,
          action: auditLogsTable.action,
          resource: auditLogsTable.resource,
          resourceId: auditLogsTable.resourceId,
          ipAddress: auditLogsTable.ipAddress,
          createdAt: auditLogsTable.createdAt,
        })
        .from(auditLogsTable)
        .where(where)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(auditLogsTable).where(where),
    ]);

    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.get("/audit-logs/:id", requireAuth, async (req, res, next) => {
  try {
    const [log] = await db.select().from(auditLogsTable).where(eq(auditLogsTable.id, req.params.id as string));
    if (!log) throw new AppError(404, "Audit log not found");
    res.json(log);
  } catch (err) {
    next(err);
  }
});

export default router;
