import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

const planSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  price: z.string(),
  durationDays: z.number().int().positive(),
  allowedZones: z.array(z.string()).optional(),
  timeRestrictions: z
    .object({
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      daysOfWeek: z.array(z.number()).optional(),
      genderRestriction: z.enum(["male", "female"]).nullable().optional(),
    })
    .nullable()
    .optional(),
  maxFreezeDays: z.number().int().min(0).optional(),
  sessionLimit: z.number().int().positive().nullable().optional(),
  storeDiscountPercent: z.string().nullable().optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

router.get("/plans", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const activeOnly = req.query.active === "true";

    const where = activeOnly ? eq(plansTable.isActive, true) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(plansTable).where(where).orderBy(desc(plansTable.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(plansTable).where(where),
    ]);

    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/plans", requireAuth, async (req, res, next) => {
  try {
    const data = planSchema.parse(req.body);
    const [plan] = await db
      .insert(plansTable)
      .values({ ...data, createdBy: req.user!.sub })
      .returning();

    await logAudit({ req, action: "create", resource: "plans", resourceId: plan.id, newValue: plan });
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
});

router.get("/plans/:id", requireAuth, async (req, res, next) => {
  try {
    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, req.params.id));
    if (!plan) throw new AppError(404, "Plan not found");
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

router.patch("/plans/:id", requireAuth, async (req, res, next) => {
  try {
    const [existing] = await db.select().from(plansTable).where(eq(plansTable.id, req.params.id));
    if (!existing) throw new AppError(404, "Plan not found");

    const data = planSchema.partial().parse(req.body);
    const [updated] = await db
      .update(plansTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(plansTable.id, req.params.id))
      .returning();

    await logAudit({ req, action: "update", resource: "plans", resourceId: req.params.id, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/plans/:id", requireAuth, async (req, res, next) => {
  try {
    const [existing] = await db.select().from(plansTable).where(eq(plansTable.id, req.params.id));
    if (!existing) throw new AppError(404, "Plan not found");

    await db.update(plansTable).set({ isActive: false, updatedAt: new Date() }).where(eq(plansTable.id, req.params.id));
    await logAudit({ req, action: "delete", resource: "plans", resourceId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
