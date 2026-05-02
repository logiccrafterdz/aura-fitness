import { Router } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable,
  invoiceItemsTable,
  paymentsTable,
  discountsTable,
  membersTable,
  membershipsTable,
  memberTimelineEventsTable,
  cashReconciliationsTable,
} from "@workspace/db";
import { eq, and, desc, count, sql, gte, lt, lte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requirePermission } from "../lib/auth";
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

router.get("/invoices", requireAuth, requirePermission("billing", "read"), async (req, res, next) => {
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

router.post("/invoices", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
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
      discountCode: z.string().optional(),
      discountAmount: z.string().optional(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const subtotal = data.items.reduce(
      (sum, i) => sum + parseFloat(i.unitPrice) * i.quantity,
      0,
    );

    let discountApplied = parseFloat(data.discountAmount ?? "0");

    if (data.discountCode) {
      const now = new Date();
      const [disc] = await db
        .select()
        .from(discountsTable)
        .where(
          and(
            eq(discountsTable.code, data.discountCode.toUpperCase()),
            eq(discountsTable.isActive, true),
          ),
        );
      if (disc) {
        const validFrom = disc.validFrom ? disc.validFrom <= now : true;
        const validTo = disc.validUntil ? disc.validUntil >= now : true;
        const hasUses = disc.maxUses
          ? (disc.usesCount ?? 0) < disc.maxUses
          : true;
        if (validFrom && validTo && hasUses) {
          if (disc.type === "percent") {
            discountApplied = subtotal * (parseFloat(disc.value) / 100);
          } else {
            discountApplied = Math.min(parseFloat(disc.value), subtotal);
          }
          await db
            .update(discountsTable)
            .set({ usesCount: (disc.usesCount ?? 0) + 1 })
            .where(eq(discountsTable.id, disc.id));
        }
      }
    }

    const total = Math.max(0, subtotal - discountApplied);

    let invoiceNumber: string;
    let exists = true;
    do {
      invoiceNumber = generateInvoiceNumber();
      const [ex] = await db
        .select({ id: invoicesTable.id })
        .from(invoicesTable)
        .where(eq(invoicesTable.invoiceNumber, invoiceNumber));
      exists = !!ex;
    } while (exists);

    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        invoiceNumber,
        memberId: data.memberId,
        membershipId: data.membershipId,
        subtotal: subtotal.toFixed(2),
        discountAmount: discountApplied.toFixed(2),
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

    await logAudit({
      req,
      action: "create",
      resource: "invoices",
      resourceId: invoice.id,
      newValue: invoice,
    });
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

router.get("/invoices/:id", requireAuth, requirePermission("billing", "read"), async (req, res, next) => {
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
      .where(eq(invoicesTable.id, req.params.id as string));
    if (!invoice) throw new AppError(404, "Invoice not found");

    const items = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, req.params.id as string));
    const payments = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.invoiceId, req.params.id as string));

    res.json({ ...invoice, items, payments });
  } catch (err) {
    next(err);
  }
});

router.patch("/invoices/:id", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
  try {
    const [existing] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, req.params.id as string));
    if (!existing) throw new AppError(404, "Invoice not found");

    const schema = z.object({
      status: z
        .enum(["draft", "pending", "paid", "overdue", "cancelled"])
        .optional(),
      notes: z.string().optional(),
      dueDate: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
    if (data.status === "paid" && existing.status !== "paid")
      updateData.paidAt = new Date();

    const [updated] = await db
      .update(invoicesTable)
      .set(updateData)
      .where(eq(invoicesTable.id, req.params.id as string))
      .returning();
    await logAudit({
      req,
      action: "update",
      resource: "invoices",
      resourceId: req.params.id as string,
      oldValue: existing,
      newValue: updated,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/invoices/:id/payments", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
  try {
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, req.params.id as string));
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
        .select({
          sum: sql<string>`coalesce(sum(amount::numeric), 0)`,
        })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.invoiceId, invoice.id),
            eq(paymentsTable.status, "confirmed"),
          ),
        );
      if (parseFloat(totalPaid[0].sum) >= parseFloat(invoice.total)) {
        await db
          .update(invoicesTable)
          .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
          .where(eq(invoicesTable.id, invoice.id));
      }

      await db.insert(memberTimelineEventsTable).values({
        memberId: invoice.memberId,
        eventType: "payment_received",
        description: `Cash payment of ${data.amount} DZD received for invoice ${invoice.invoiceNumber}`,
        actorId: req.user!.sub,
      });
    }

    await logAudit({
      req,
      action: "create",
      resource: "payments",
      resourceId: payment.id,
      newValue: payment,
    });
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});

router.get("/payments", requireAuth, requirePermission("billing", "read"), async (req, res, next) => {
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
          referenceNumber: paymentsTable.referenceNumber,
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

router.patch("/payments/:id/confirm", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
  try {
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, req.params.id as string));
    if (!payment) throw new AppError(404, "Payment not found");
    if (payment.status !== "pending")
      throw new AppError(400, "Payment is not pending");

    const [updated] = await db
      .update(paymentsTable)
      .set({
        status: "confirmed",
        confirmedBy: req.user!.sub,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, req.params.id as string))
      .returning();

    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, payment.invoiceId));
    if (invoice) {
      const totalPaid = await db
        .select({
          sum: sql<string>`coalesce(sum(amount::numeric), 0)`,
        })
        .from(paymentsTable)
        .where(
          and(
            eq(paymentsTable.invoiceId, invoice.id),
            eq(paymentsTable.status, "confirmed"),
          ),
        );
      if (parseFloat(totalPaid[0].sum) >= parseFloat(invoice.total)) {
        await db
          .update(invoicesTable)
          .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
          .where(eq(invoicesTable.id, invoice.id));
      }
    }

    await db.insert(memberTimelineEventsTable).values({
      memberId: payment.memberId,
      eventType: "payment_confirmed",
      description: `Payment of ${payment.amount} DZD confirmed via ${payment.method}`,
      actorId: req.user!.sub,
    });

    await logAudit({
      req,
      action: "confirm",
      resource: "payments",
      resourceId: req.params.id as string,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.patch("/payments/:id/reject", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
  try {
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, req.params.id as string));
    if (!payment) throw new AppError(404, "Payment not found");
    if (payment.status !== "pending")
      throw new AppError(400, "Payment is not pending");

    const { reason } = z
      .object({ reason: z.string().optional() })
      .parse(req.body);

    const [updated] = await db
      .update(paymentsTable)
      .set({
        status: "rejected",
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, req.params.id as string))
      .returning();

    await logAudit({
      req,
      action: "reject",
      resource: "payments",
      resourceId: req.params.id as string,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/discounts", requireAuth, requirePermission("billing", "read"), async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(discountsTable)
        .orderBy(desc(discountsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(discountsTable),
    ]);
    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/discounts", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      code: z.string().min(2).max(30).toUpperCase(),
      type: z.enum(["fixed", "percent"]),
      value: z.string(),
      maxUses: z.number().int().positive().optional(),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
      description: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const [existing] = await db
      .select({ id: discountsTable.id })
      .from(discountsTable)
      .where(eq(discountsTable.code, data.code));
    if (existing) throw new AppError(400, "Discount code already exists");

    const [discount] = await db
      .insert(discountsTable)
      .values({
        code: data.code,
        type: data.type,
        value: data.value,
        maxUses: data.maxUses,
        description: data.description,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        createdBy: req.user!.sub,
      })
      .returning();

    await logAudit({
      req,
      action: "create",
      resource: "discounts",
      resourceId: discount.id,
      newValue: discount,
    });
    res.status(201).json(discount);
  } catch (err) {
    next(err);
  }
});

router.patch("/discounts/:id", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      description: z.string().optional(),
      maxUses: z.number().int().optional(),
      validUntil: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const updateData: any = { description: data.description, maxUses: data.maxUses, isActive: data.isActive };
    if (data.validUntil) updateData.validUntil = new Date(data.validUntil);

    const [updated] = await db
      .update(discountsTable)
      .set(updateData)
      .where(eq(discountsTable.id, req.params.id as string))
      .returning();
    if (!updated) throw new AppError(404, "Discount not found");

    await logAudit({
      req,
      action: "update",
      resource: "discounts",
      resourceId: req.params.id as string,
      newValue: updated,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/discounts/:id", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
  try {
    const [updated] = await db
      .update(discountsTable)
      .set({ isActive: false })
      .where(eq(discountsTable.id, req.params.id as string))
      .returning();
    if (!updated) throw new AppError(404, "Discount not found");
    await logAudit({
      req,
      action: "deactivate",
      resource: "discounts",
      resourceId: req.params.id as string,
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/discounts/validate", requireAuth, requirePermission("billing", "read"), async (req, res, next) => {
  try {
    const schema = z.object({
      code: z.string(),
      amount: z.string().optional(),
    });
    const { code, amount } = schema.parse(req.body);
    const now = new Date();

    const [disc] = await db
      .select()
      .from(discountsTable)
      .where(
        and(
          eq(discountsTable.code, code.toUpperCase()),
          eq(discountsTable.isActive, true),
        ),
      );

    if (!disc) {
      res.json({ valid: false, reason: "Code not found or inactive" });
      return;
    }

    if (disc.validFrom && disc.validFrom > now) {
      res.json({ valid: false, reason: "Code not yet active" });
      return;
    }
    if (disc.validUntil && disc.validUntil < now) {
      res.json({ valid: false, reason: "Code has expired" });
      return;
    }
    if (disc.maxUses && (disc.usesCount ?? 0) >= disc.maxUses) {
      res.json({ valid: false, reason: "Code usage limit reached" });
      return;
    }

    const subtotal = amount ? parseFloat(amount) : 0;
    let discountAmount = 0;
    if (disc.type === "percent") {
      discountAmount = subtotal * (parseFloat(disc.value) / 100);
    } else {
      discountAmount = Math.min(parseFloat(disc.value), subtotal || parseFloat(disc.value));
    }

    res.json({
      valid: true,
      code: disc.code,
      type: disc.type,
      value: disc.value,
      discountAmount: discountAmount.toFixed(2),
      description: disc.description,
    });
  } catch (err) {
    next(err);
  }
});

// ── CASH RECONCILIATIONS ───────────────────────────────────────────────────

router.get("/cash-reconciliations", requireAuth, requirePermission("billing", "read"), async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(cashReconciliationsTable)
        .orderBy(desc(cashReconciliationsTable.date))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(cashReconciliationsTable),
    ]);
    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.get("/cash-reconciliations/current", requireAuth, requirePermission("billing", "read"), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];
    const [current] = await db
      .select()
      .from(cashReconciliationsTable)
      .where(eq(cashReconciliationsTable.date, todayStr))
      .orderBy(desc(cashReconciliationsTable.openedAt))
      .limit(1);

    res.json(current ?? null);
  } catch (err) {
    next(err);
  }
});

router.get("/cash-reconciliations/:id", requireAuth, requirePermission("billing", "read"), async (req, res, next) => {
  try {
    const [row] = await db
      .select()
      .from(cashReconciliationsTable)
      .where(eq(cashReconciliationsTable.id, req.params.id as string));
    if (!row) throw new AppError(404, "Reconciliation not found");
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post("/cash-reconciliations", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      date: z.string().optional(),
      openingBalance: z.string().default("0"),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const reconcDate = data.date ?? new Date().toISOString().split("T")[0];

    const [row] = await db
      .insert(cashReconciliationsTable)
      .values({
        date: reconcDate,
        openingBalance: data.openingBalance,
        openedBy: req.user!.sub,
        notes: data.notes,
        status: "open",
      })
      .returning();

    await logAudit({
      req,
      action: "create",
      resource: "cash_reconciliations",
      resourceId: row.id,
      newValue: row,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.patch("/cash-reconciliations/:id", requireAuth, requirePermission("billing", "write"), async (req, res, next) => {
  try {
    const schema = z.object({
      closingBalance: z.string().optional(),
      cashIn: z.string().optional(),
      cashOut: z.string().optional(),
      expectedBalance: z.string().optional(),
      discrepancy: z.string().optional(),
      status: z.enum(["open", "closed", "disputed"]).optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const [existing] = await db
      .select()
      .from(cashReconciliationsTable)
      .where(eq(cashReconciliationsTable.id, req.params.id as string));
    if (!existing) throw new AppError(404, "Reconciliation not found");

    const updateData: any = { ...data };
    if (data.status === "closed") {
      updateData.closedAt = new Date();
      updateData.closedBy = req.user!.sub;
    }

    if (data.closingBalance && data.expectedBalance) {
      updateData.discrepancy = (
        parseFloat(data.closingBalance) - parseFloat(data.expectedBalance)
      ).toFixed(2);
    } else if (data.closingBalance && data.cashIn) {
      const opening = parseFloat(existing.openingBalance ?? "0");
      const cashIn = parseFloat(data.cashIn);
      const cashOut = parseFloat(data.cashOut ?? existing.cashOut ?? "0");
      const expected = opening + cashIn - cashOut;
      updateData.expectedBalance = expected.toFixed(2);
      updateData.discrepancy = (parseFloat(data.closingBalance) - expected).toFixed(2);
    }

    const [updated] = await db
      .update(cashReconciliationsTable)
      .set(updateData)
      .where(eq(cashReconciliationsTable.id, req.params.id as string))
      .returning();

    await logAudit({
      req,
      action: "update",
      resource: "cash_reconciliations",
      resourceId: req.params.id as string,
      newValue: updated,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
