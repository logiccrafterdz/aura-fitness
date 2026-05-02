import { Router } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable,
  invoiceItemsTable,
  paymentsTable,
  membersTable,
  membershipsTable,
  memberTimelineEventsTable,
} from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

function generateInvoiceNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${y}${m}-${rand}`;
}

router.get("/invoices", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const status = req.query.status as string | undefined;
    const memberId = req.query.memberId as string | undefined;

    const conditions = [];
    if (status) conditions.push(eq(invoicesTable.status, status as any));
    if (memberId) conditions.push(eq(invoicesTable.memberId, memberId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: invoicesTable.id,
          invoiceNumber: invoicesTable.invoiceNumber,
          memberId: invoicesTable.memberId,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          memberNumber: membersTable.memberNumber,
          total: invoicesTable.total,
          status: invoicesTable.status,
          dueDate: invoicesTable.dueDate,
          createdAt: invoicesTable.createdAt,
        })
        .from(invoicesTable)
        .leftJoin(membersTable, eq(invoicesTable.memberId, membersTable.id))
        .where(where)
        .orderBy(desc(invoicesTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(invoicesTable).where(where),
    ]);

    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/invoices", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      memberId: z.string().uuid(),
      membershipId: z.string().uuid().optional(),
      items: z.array(
        z.object({
          description: z.string(),
          quantity: z.number().int().positive().default(1),
          unitPrice: z.string(),
        }),
      ),
      discountAmount: z.string().optional(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const subtotal = data.items.reduce(
      (sum, i) => sum + parseFloat(i.unitPrice) * i.quantity,
      0,
    );
    const discount = parseFloat(data.discountAmount ?? "0");
    const total = subtotal - discount;

    let invoiceNumber: string;
    let exists = true;
    do {
      invoiceNumber = generateInvoiceNumber();
      const [ex] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(eq(invoicesTable.invoiceNumber, invoiceNumber));
      exists = !!ex;
    } while (exists);

    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        invoiceNumber,
        memberId: data.memberId,
        membershipId: data.membershipId,
        subtotal: subtotal.toFixed(2),
        discountAmount: discount.toFixed(2),
        total: total.toFixed(2),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes,
        createdBy: req.user!.sub,
      })
      .returning();

    await db.insert(invoiceItemsTable).values(
      data.items.map((i) => ({
        invoiceId: invoice.id,
        description: i.description,
        quantity: i.quantity,
        unitPrice: parseFloat(i.unitPrice).toFixed(2),
        total: (parseFloat(i.unitPrice) * i.quantity).toFixed(2),
      })),
    );

    await db.insert(memberTimelineEventsTable).values({
      memberId: data.memberId,
      eventType: "invoice_created",
      description: `Invoice ${invoiceNumber} created for ${total.toFixed(2)} DZD`,
      actorId: req.user!.sub,
    });

    await logAudit({ req, action: "create", resource: "invoices", resourceId: invoice.id, newValue: invoice });
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

router.get("/invoices/:id", requireAuth, async (req, res, next) => {
  try {
    const [invoice] = await db
      .select({
        id: invoicesTable.id,
        invoiceNumber: invoicesTable.invoiceNumber,
        memberId: invoicesTable.memberId,
        memberFirstName: membersTable.firstName,
        memberLastName: membersTable.lastName,
        memberNumber: membersTable.memberNumber,
        subtotal: invoicesTable.subtotal,
        discountAmount: invoicesTable.discountAmount,
        total: invoicesTable.total,
        status: invoicesTable.status,
        dueDate: invoicesTable.dueDate,
        paidAt: invoicesTable.paidAt,
        notes: invoicesTable.notes,
        createdAt: invoicesTable.createdAt,
      })
      .from(invoicesTable)
      .leftJoin(membersTable, eq(invoicesTable.memberId, membersTable.id))
      .where(eq(invoicesTable.id, req.params.id));
    if (!invoice) throw new AppError(404, "Invoice not found");

    const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, req.params.id));
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, req.params.id));

    res.json({ ...invoice, items, payments });
  } catch (err) {
    next(err);
  }
});

router.patch("/invoices/:id", requireAuth, async (req, res, next) => {
  try {
    const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, req.params.id));
    if (!existing) throw new AppError(404, "Invoice not found");

    const schema = z.object({
      status: z.enum(["draft", "pending", "paid", "overdue", "cancelled"]).optional(),
      notes: z.string().optional(),
      dueDate: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
    if (data.status === "paid" && existing.status !== "paid") updateData.paidAt = new Date();

    const [updated] = await db.update(invoicesTable).set(updateData).where(eq(invoicesTable.id, req.params.id)).returning();
    await logAudit({ req, action: "update", resource: "invoices", resourceId: req.params.id, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/invoices/:id/payments", requireAuth, async (req, res, next) => {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, req.params.id));
    if (!invoice) throw new AppError(404, "Invoice not found");

    const schema = z.object({
      amount: z.string(),
      method: z.enum(["cash", "baridimob", "cib", "edahabia", "other"]),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const isCash = data.method === "cash";
    const [payment] = await db
      .insert(paymentsTable)
      .values({
        invoiceId: invoice.id,
        memberId: invoice.memberId,
        amount: data.amount,
        method: data.method,
        status: isCash ? "confirmed" : "pending",
        referenceNumber: data.referenceNumber,
        confirmedBy: isCash ? req.user!.sub : undefined,
        confirmedAt: isCash ? new Date() : undefined,
        notes: data.notes,
        recordedBy: req.user!.sub,
      })
      .returning();

    if (isCash) {
      const totalPaid = await db
        .select({ sum: sql<string>`coalesce(sum(amount::numeric), 0)` })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.invoiceId, invoice.id), eq(paymentsTable.status, "confirmed")));
      if (parseFloat(totalPaid[0].sum) >= parseFloat(invoice.total)) {
        await db.update(invoicesTable).set({ status: "paid", paidAt: new Date(), updatedAt: new Date() }).where(eq(invoicesTable.id, invoice.id));
      }

      await db.insert(memberTimelineEventsTable).values({
        memberId: invoice.memberId,
        eventType: "payment_received",
        description: `Cash payment of ${data.amount} DZD received for invoice ${invoice.invoiceNumber}`,
        actorId: req.user!.sub,
      });
    }

    await logAudit({ req, action: "create", resource: "payments", resourceId: payment.id, newValue: payment });
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});

router.get("/payments", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const status = req.query.status as string | undefined;
    const method = req.query.method as string | undefined;
    const memberId = req.query.memberId as string | undefined;

    const conditions = [];
    if (status) conditions.push(eq(paymentsTable.status, status as any));
    if (method) conditions.push(eq(paymentsTable.method, method as any));
    if (memberId) conditions.push(eq(paymentsTable.memberId, memberId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: paymentsTable.id,
          invoiceId: paymentsTable.invoiceId,
          invoiceNumber: invoicesTable.invoiceNumber,
          memberId: paymentsTable.memberId,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          amount: paymentsTable.amount,
          method: paymentsTable.method,
          status: paymentsTable.status,
          proofUrl: paymentsTable.proofUrl,
          confirmedAt: paymentsTable.confirmedAt,
          createdAt: paymentsTable.createdAt,
        })
        .from(paymentsTable)
        .leftJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
        .leftJoin(membersTable, eq(paymentsTable.memberId, membersTable.id))
        .where(where)
        .orderBy(desc(paymentsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(paymentsTable).where(where),
    ]);

    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.patch("/payments/:id/confirm", requireAuth, async (req, res, next) => {
  try {
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));
    if (!payment) throw new AppError(404, "Payment not found");
    if (payment.status !== "pending") throw new AppError(400, "Payment is not pending");

    const [updated] = await db
      .update(paymentsTable)
      .set({ status: "confirmed", confirmedBy: req.user!.sub, confirmedAt: new Date(), updatedAt: new Date() })
      .where(eq(paymentsTable.id, req.params.id))
      .returning();

    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, payment.invoiceId));
    if (invoice) {
      const totalPaid = await db
        .select({ sum: sql<string>`coalesce(sum(amount::numeric), 0)` })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.invoiceId, invoice.id), eq(paymentsTable.status, "confirmed")));
      if (parseFloat(totalPaid[0].sum) >= parseFloat(invoice.total)) {
        await db.update(invoicesTable).set({ status: "paid", paidAt: new Date(), updatedAt: new Date() }).where(eq(invoicesTable.id, invoice.id));
      }
    }

    await db.insert(memberTimelineEventsTable).values({
      memberId: payment.memberId,
      eventType: "payment_confirmed",
      description: `Payment of ${payment.amount} DZD confirmed via ${payment.method}`,
      actorId: req.user!.sub,
    });

    await logAudit({ req, action: "confirm", resource: "payments", resourceId: req.params.id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch("/payments/:id/reject", requireAuth, async (req, res, next) => {
  try {
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, req.params.id));
    if (!payment) throw new AppError(404, "Payment not found");
    if (payment.status !== "pending") throw new AppError(400, "Payment is not pending");

    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);

    const [updated] = await db
      .update(paymentsTable)
      .set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
      .where(eq(paymentsTable.id, req.params.id))
      .returning();

    await logAudit({ req, action: "reject", resource: "payments", resourceId: req.params.id });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
