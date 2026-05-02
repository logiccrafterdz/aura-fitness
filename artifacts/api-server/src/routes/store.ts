import { Router } from "express";
import { db } from "@workspace/db";
import {
  productsTable,
  inventoryTransactionsTable,
  posSessionsTable,
  ordersTable,
  orderItemsTable,
  membersTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, count, sql, ilike } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

function generateOrderNumber(): string {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `ORD-${ts}${rand}`;
}

router.get("/products", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const lowStock = req.query.lowStock === "true";

    const conditions = [eq(productsTable.isActive, true)];
    if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
    if (category) conditions.push(eq(productsTable.category, category));
    if (lowStock) conditions.push(sql`${productsTable.stockQuantity} <= ${productsTable.lowStockThreshold}`);

    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(productsTable).where(where).orderBy(productsTable.name).limit(limit).offset(offset),
      db.select({ total: count() }).from(productsTable).where(where),
    ]);
    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/products", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      nameAr: z.string().optional(),
      category: z.string().default("other"),
      description: z.string().optional(),
      purchasePrice: z.string().optional(),
      salePrice: z.string(),
      stockQuantity: z.number().int().min(0).default(0),
      lowStockThreshold: z.number().int().min(0).default(5),
      expiryDate: z.string().optional(),
      barcode: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const [product] = await db
      .insert(productsTable)
      .values({ ...data, expiryDate: data.expiryDate ? new Date(data.expiryDate) : null, createdBy: req.user!.sub })
      .returning();
    await logAudit({ req, action: "create", resource: "products", resourceId: product.id, newValue: product });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

router.get("/products/:id", requireAuth, async (req, res, next) => {
  try {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, req.params.id));
    if (!product) throw new AppError(404, "Product not found");
    const recentTxns = await db.select().from(inventoryTransactionsTable)
      .where(eq(inventoryTransactionsTable.productId, req.params.id))
      .orderBy(desc(inventoryTransactionsTable.createdAt)).limit(10);
    res.json({ ...product, recentTransactions: recentTxns });
  } catch (err) {
    next(err);
  }
});

router.patch("/products/:id", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      purchasePrice: z.string().optional(),
      salePrice: z.string().optional(),
      lowStockThreshold: z.number().int().optional(),
      expiryDate: z.string().optional(),
      barcode: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate);

    const [updated] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, req.params.id)).returning();
    if (!updated) throw new AppError(404, "Product not found");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/inventory/transactions", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const productId = req.query.productId as string | undefined;
    const conditions = productId ? [eq(inventoryTransactionsTable.productId, productId)] : [];
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: inventoryTransactionsTable.id,
          productId: inventoryTransactionsTable.productId,
          productName: productsTable.name,
          type: inventoryTransactionsTable.type,
          quantity: inventoryTransactionsTable.quantity,
          unitPrice: inventoryTransactionsTable.unitPrice,
          totalValue: inventoryTransactionsTable.totalValue,
          notes: inventoryTransactionsTable.notes,
          createdAt: inventoryTransactionsTable.createdAt,
        })
        .from(inventoryTransactionsTable)
        .leftJoin(productsTable, eq(inventoryTransactionsTable.productId, productsTable.id))
        .where(where)
        .orderBy(desc(inventoryTransactionsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(inventoryTransactionsTable).where(where),
    ]);
    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/inventory/transactions", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      productId: z.string().uuid(),
      type: z.enum(["purchase", "sale", "damage", "adjustment", "return"]),
      quantity: z.number().int(),
      unitPrice: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, data.productId));
    if (!product) throw new AppError(404, "Product not found");

    const delta =
      data.type === "purchase" || data.type === "return" || data.type === "adjustment"
        ? Math.abs(data.quantity)
        : -Math.abs(data.quantity);

    const newStock = product.stockQuantity + delta;
    if (newStock < 0) throw new AppError(400, "Insufficient stock");

    await db.update(productsTable).set({ stockQuantity: newStock, updatedAt: new Date() }).where(eq(productsTable.id, data.productId));

    const [txn] = await db
      .insert(inventoryTransactionsTable)
      .values({
        ...data,
        totalValue: data.unitPrice ? (parseFloat(data.unitPrice) * Math.abs(data.quantity)).toFixed(2) : null,
        actorId: req.user!.sub,
      })
      .returning();
    res.status(201).json(txn);
  } catch (err) {
    next(err);
  }
});

router.get("/pos-sessions", requireAuth, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: posSessionsTable.id,
        cashierId: posSessionsTable.cashierId,
        cashierFirstName: usersTable.firstName,
        cashierLastName: usersTable.lastName,
        openedAt: posSessionsTable.openedAt,
        closedAt: posSessionsTable.closedAt,
        openingCash: posSessionsTable.openingCash,
        closingCash: posSessionsTable.closingCash,
        totalSales: posSessionsTable.totalSales,
        status: posSessionsTable.status,
      })
      .from(posSessionsTable)
      .leftJoin(usersTable, eq(posSessionsTable.cashierId, usersTable.id))
      .orderBy(desc(posSessionsTable.openedAt))
      .limit(20);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/pos-sessions", requireAuth, async (req, res, next) => {
  try {
    const { openingCash } = z.object({ openingCash: z.string().default("0") }).parse(req.body);
    const [session] = await db.insert(posSessionsTable).values({ cashierId: req.user!.sub, openingCash }).returning();
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.patch("/pos-sessions/:id/close", requireAuth, async (req, res, next) => {
  try {
    const { closingCash, notes } = z.object({ closingCash: z.string(), notes: z.string().optional() }).parse(req.body);
    const [session] = await db.select().from(posSessionsTable).where(eq(posSessionsTable.id, req.params.id));
    if (!session) throw new AppError(404, "POS session not found");
    if (session.status === "closed") throw new AppError(400, "Session already closed");

    const [updated] = await db.update(posSessionsTable).set({ closedAt: new Date(), closingCash, status: "closed", notes }).where(eq(posSessionsTable.id, req.params.id)).returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.get("/orders", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const status = req.query.status as string | undefined;
    const memberId = req.query.memberId as string | undefined;

    const conditions = [];
    if (status) conditions.push(eq(ordersTable.status, status as any));
    if (memberId) conditions.push(eq(ordersTable.memberId, memberId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: ordersTable.id,
          orderNumber: ordersTable.orderNumber,
          memberId: ordersTable.memberId,
          memberFirstName: membersTable.firstName,
          memberLastName: membersTable.lastName,
          total: ordersTable.total,
          paymentMethod: ordersTable.paymentMethod,
          status: ordersTable.status,
          createdAt: ordersTable.createdAt,
        })
        .from(ordersTable)
        .leftJoin(membersTable, eq(ordersTable.memberId, membersTable.id))
        .where(where)
        .orderBy(desc(ordersTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(ordersTable).where(where),
    ]);
    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/orders", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      memberId: z.string().uuid().optional(),
      posSessionId: z.string().uuid().optional(),
      items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })),
      paymentMethod: z.string().default("cash"),
      discountAmount: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);

    let subtotal = 0;
    const resolvedItems: Array<{ productId: string; quantity: number; unitPrice: string; total: string }> = [];

    for (const item of data.items) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (!product) throw new AppError(404, `Product ${item.productId} not found`);
      if (product.stockQuantity < item.quantity) throw new AppError(400, `Insufficient stock for ${product.name}`);
      const lineTotal = parseFloat(product.salePrice) * item.quantity;
      subtotal += lineTotal;
      resolvedItems.push({ productId: item.productId, quantity: item.quantity, unitPrice: product.salePrice, total: lineTotal.toFixed(2) });
    }

    const discount = parseFloat(data.discountAmount ?? "0");
    const total = subtotal - discount;

    let orderNumber: string;
    let exists = true;
    do {
      orderNumber = generateOrderNumber();
      const [ex] = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.orderNumber, orderNumber));
      exists = !!ex;
    } while (exists);

    const [order] = await db
      .insert(ordersTable)
      .values({ orderNumber, memberId: data.memberId, posSessionId: data.posSessionId, subtotal: subtotal.toFixed(2), discountAmount: discount.toFixed(2), total: total.toFixed(2), paymentMethod: data.paymentMethod, notes: data.notes, createdBy: req.user!.sub })
      .returning();

    await db.insert(orderItemsTable).values(resolvedItems.map((i) => ({ ...i, orderId: order.id })));

    for (const item of resolvedItems) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (product) {
        await db.update(productsTable).set({ stockQuantity: product.stockQuantity - item.quantity, updatedAt: new Date() }).where(eq(productsTable.id, item.productId));
        await db.insert(inventoryTransactionsTable).values({ productId: item.productId, type: "sale", quantity: item.quantity, unitPrice: item.unitPrice, totalValue: item.total, actorId: req.user!.sub });
      }
    }

    if (data.posSessionId) {
      const [sess] = await db.select().from(posSessionsTable).where(eq(posSessionsTable.id, data.posSessionId));
      if (sess) {
        const newTotal = (parseFloat(sess.totalSales ?? "0") + total).toFixed(2);
        await db.update(posSessionsTable).set({ totalSales: newTotal }).where(eq(posSessionsTable.id, data.posSessionId));
      }
    }

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

router.patch("/orders/:id/status", requireAuth, async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(["pending", "preparing", "ready", "completed", "cancelled"]) }).parse(req.body);
    const [updated] = await db.update(ordersTable).set({ status, updatedAt: new Date() }).where(eq(ordersTable.id, req.params.id)).returning();
    if (!updated) throw new AppError(404, "Order not found");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
