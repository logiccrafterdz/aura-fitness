import { Router } from "express";
import { db } from "@workspace/db";
import { notificationTemplatesTable, notificationRecordsTable, membersTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requirePermission } from "../lib/auth";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

router.get("/notification-templates", requireAuth, requirePermission("notifications", "read"), async (req, res, next) => {
  try {
    const rows = await db.select().from(notificationTemplatesTable).orderBy(notificationTemplatesTable.eventTrigger);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/notification-templates", requireAuth, requirePermission("notifications", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      key: z.string().min(1),
      eventTrigger: z.string().min(1),
      titleAr: z.string().min(1),
      titleFr: z.string().min(1),
      bodyAr: z.string().min(1),
      bodyFr: z.string().min(1),
      channels: z.array(z.enum(["push", "email", "sms"])).default(["push"]),
      isActive: z.boolean().default(true),
    });
    const data = schema.parse(req.body);
    const [template] = await db.insert(notificationTemplatesTable).values(data).returning();
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

router.patch("/notification-templates/:id", requireAuth, requirePermission("notifications", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      titleAr: z.string().optional(),
      titleFr: z.string().optional(),
      bodyAr: z.string().optional(),
      bodyFr: z.string().optional(),
      channels: z.array(z.enum(["push", "email", "sms"])).optional(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const [updated] = await db
      .update(notificationTemplatesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notificationTemplatesTable.id, req.params.id as string))
      .returning();
    if (!updated) throw new AppError(404, "Template not found");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/notification-records", requireAuth, requirePermission("notifications", "read"), async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const memberId = req.query.memberId as string | undefined;
    const where = memberId ? eq(notificationRecordsTable.memberId, memberId) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: notificationRecordsTable.id,
          templateId: notificationRecordsTable.templateId,
          templateKey: notificationTemplatesTable.key,
          memberId: notificationRecordsTable.memberId,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          channel: notificationRecordsTable.channel,
          title: notificationRecordsTable.title,
          status: notificationRecordsTable.status,
          sentAt: notificationRecordsTable.sentAt,
          createdAt: notificationRecordsTable.createdAt,
        })
        .from(notificationRecordsTable)
        .leftJoin(notificationTemplatesTable, eq(notificationRecordsTable.templateId, notificationTemplatesTable.id))
        .leftJoin(membersTable, eq(notificationRecordsTable.memberId, membersTable.id))
        .where(where)
        .orderBy(desc(notificationRecordsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(notificationRecordsTable).where(where),
    ]);
    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/notifications/send", requireAuth, requirePermission("notifications", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      eventTrigger: z.string().min(1),
      memberId: z.string().uuid(),
      language: z.enum(["ar", "fr"]).default("ar"),
      variables: z.record(z.string()).optional(),
    });
    const { eventTrigger, memberId, language, variables } = schema.parse(req.body);

    const [member] = await db
      .select({ id: membersTable.id })
      .from(membersTable)
      .where(eq(membersTable.id, memberId));
    if (!member) throw new AppError(404, "Member not found");

    const [template] = await db
      .select()
      .from(notificationTemplatesTable)
      .where(
        and(
          eq(notificationTemplatesTable.eventTrigger, eventTrigger),
          eq(notificationTemplatesTable.isActive, true),
        ),
      );
    if (!template) throw new AppError(404, `No active template for trigger: ${eventTrigger}`);

    const title = language === "ar" ? template.titleAr : template.titleFr;
    const body = language === "ar" ? template.bodyAr : template.bodyFr;
    const channels = (template.channels as string[]) ?? ["push"];

    const records = [];
    for (const channel of channels) {
      const [record] = await db
        .insert(notificationRecordsTable)
        .values({
          templateId: template.id,
          memberId,
          channel,
          title,
          body,
          status: "queued",
          metadata: variables as any,
        })
        .returning();
      records.push(record);
    }

    res.status(201).json({ sent: records.length, records });
  } catch (err) {
    next(err);
  }
});

export async function triggerNotification(params: {
  eventTrigger: string;
  memberId: string;
  language?: "ar" | "fr";
  variables?: Record<string, string>;
}) {
  try {
    const [template] = await db
      .select()
      .from(notificationTemplatesTable)
      .where(and(eq(notificationTemplatesTable.eventTrigger, params.eventTrigger), eq(notificationTemplatesTable.isActive, true)));

    if (!template) return;

    const lang = params.language ?? "ar";
    const title = lang === "ar" ? template.titleAr : template.titleFr;
    const body = lang === "ar" ? template.bodyAr : template.bodyFr;

    const channels = (template.channels as string[]) ?? ["push"];
    for (const channel of channels) {
      await db.insert(notificationRecordsTable).values({
        templateId: template.id,
        memberId: params.memberId,
        channel,
        title,
        body,
        status: "queued",
        metadata: params.variables as any,
      });
    }
  } catch {}
}

export default router;
