import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  rolesTable,
  permissionsTable,
  rolePermissionsTable,
  shiftsTable,
  trainerNotesTable,
  membersTable,
} from "@workspace/db";
import { eq, and, desc, count, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { hashPassword } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import { getPagination, paginated } from "../lib/paginate";

const router = Router();

router.get("/staff", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          roleId: usersTable.roleId,
          roleName: rolesTable.name,
          isActive: usersTable.isActive,
          lastLoginAt: usersTable.lastLoginAt,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(usersTable),
    ]);
    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/staff", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      roleId: z.string().uuid().optional(),
    });
    const data = schema.parse(req.body);

    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, data.email.toLowerCase()));
    if (existing) throw new AppError(400, "Email already in use");

    const passwordHash = await hashPassword(data.password);
    const [user] = await db
      .insert(usersTable)
      .values({ ...data, email: data.email.toLowerCase(), passwordHash })
      .returning();

    const { passwordHash: _, ...safeUser } = user;
    await logAudit({ req, action: "create", resource: "staff", resourceId: user.id, newValue: safeUser });
    res.status(201).json(safeUser);
  } catch (err) {
    next(err);
  }
});

router.get("/staff/:id", requireAuth, async (req, res, next) => {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        roleId: usersTable.roleId,
        roleName: rolesTable.name,
        isActive: usersTable.isActive,
        lastLoginAt: usersTable.lastLoginAt,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(eq(usersTable.id, req.params.id));
    if (!user) throw new AppError(404, "Staff member not found");
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.patch("/staff/:id", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      roleId: z.string().uuid().optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(8).optional(),
    });
    const data = schema.parse(req.body);

    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
      delete updateData.password;
    }

    const [updated] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, req.params.id)).returning();
    if (!updated) throw new AppError(404, "Staff member not found");

    const { passwordHash: _, ...safeUser } = updated;
    await logAudit({ req, action: "update", resource: "staff", resourceId: req.params.id, newValue: safeUser });
    res.json(safeUser);
  } catch (err) {
    next(err);
  }
});

router.get("/roles", requireAuth, async (req, res, next) => {
  try {
    const roles = await db.select().from(rolesTable).orderBy(rolesTable.name);
    const permsMap: Record<string, typeof permissionsTable.$inferSelect[]> = {};

    const perms = await db
      .select({ roleId: rolePermissionsTable.roleId, permission: permissionsTable })
      .from(rolePermissionsTable)
      .leftJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id));

    for (const p of perms) {
      if (!permsMap[p.roleId]) permsMap[p.roleId] = [];
      if (p.permission) permsMap[p.roleId].push(p.permission);
    }

    res.json(roles.map((r) => ({ ...r, permissions: permsMap[r.id] ?? [] })));
  } catch (err) {
    next(err);
  }
});

router.post("/roles", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1), description: z.string().optional() });
    const data = schema.parse(req.body);
    const [role] = await db.insert(rolesTable).values(data).returning();
    await logAudit({ req, action: "create", resource: "roles", resourceId: role.id, newValue: role });
    res.status(201).json(role);
  } catch (err) {
    next(err);
  }
});

router.get("/shifts", requireAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const staffId = req.query.staffId as string | undefined;

    const conditions = staffId ? [eq(shiftsTable.staffId, staffId)] : [];
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: shiftsTable.id,
          staffId: shiftsTable.staffId,
          staffFirstName: usersTable.firstName,
          staffLastName: usersTable.lastName,
          startsAt: shiftsTable.startsAt,
          endsAt: shiftsTable.endsAt,
          location: shiftsTable.location,
          notes: shiftsTable.notes,
          createdAt: shiftsTable.createdAt,
        })
        .from(shiftsTable)
        .leftJoin(usersTable, eq(shiftsTable.staffId, usersTable.id))
        .where(where)
        .orderBy(desc(shiftsTable.startsAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(shiftsTable).where(where),
    ]);
    res.json(paginated(rows, Number(total), page, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/shifts", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      staffId: z.string().uuid(),
      startsAt: z.string(),
      endsAt: z.string(),
      location: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const [shift] = await db
      .insert(shiftsTable)
      .values({ ...data, startsAt: new Date(data.startsAt), endsAt: new Date(data.endsAt), createdBy: req.user!.sub })
      .returning();
    res.status(201).json(shift);
  } catch (err) {
    next(err);
  }
});

router.get("/trainer-notes", requireAuth, async (req, res, next) => {
  try {
    const memberId = req.query.memberId as string | undefined;
    const where = memberId ? eq(trainerNotesTable.memberId, memberId) : undefined;
    const rows = await db
      .select({
        id: trainerNotesTable.id,
        trainerId: trainerNotesTable.trainerId,
        trainerFirstName: usersTable.firstName,
        trainerLastName: usersTable.lastName,
        memberId: trainerNotesTable.memberId,
        noteType: trainerNotesTable.noteType,
        content: trainerNotesTable.content,
        createdAt: trainerNotesTable.createdAt,
      })
      .from(trainerNotesTable)
      .leftJoin(usersTable, eq(trainerNotesTable.trainerId, usersTable.id))
      .where(where)
      .orderBy(desc(trainerNotesTable.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/trainer-notes", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      memberId: z.string().uuid(),
      noteType: z.string().default("progress"),
      content: z.string().min(1),
    });
    const data = schema.parse(req.body);
    const [note] = await db.insert(trainerNotesTable).values({ ...data, trainerId: req.user!.sub }).returning();
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

export default router;
