import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import {
  usersTable,
  rolesTable,
  permissionsTable,
  rolePermissionsTable,
  refreshTokensTable,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "aura-secret-change-in-prod";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "aura-refresh-secret-change-in-prod";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  roleId: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { sub: string };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUserWithRole(userId: string) {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      roleId: usersTable.roleId,
      roleName: rolesTable.name,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.id, userId));
  return user;
}

export async function getRolePermissions(roleId: string): Promise<string[]> {
  const rows = await db
    .select({ resource: permissionsTable.resource, action: permissionsTable.action })
    .from(rolePermissionsTable)
    .innerJoin(
      permissionsTable,
      eq(rolePermissionsTable.permissionId, permissionsTable.id),
    )
    .where(eq(rolePermissionsTable.roleId, roleId));
  return rows.map((r) => `${r.resource}:${r.action}`);
}

export async function storeRefreshToken(
  userId: string,
  token: string,
): Promise<void> {
  const tokenHash = await bcrypt.hash(token, 8);
  await db.insert(refreshTokensTable).values({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
}

export async function revokeRefreshToken(userId: string, token: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(refreshTokensTable)
    .where(
      and(
        eq(refreshTokensTable.userId, userId),
        gt(refreshTokensTable.expiresAt, new Date()),
      ),
    );
  for (const row of rows) {
    if (!row.revokedAt && (await bcrypt.compare(token, row.tokenHash))) {
      await db
        .update(refreshTokensTable)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokensTable.id, row.id));
      return true;
    }
  }
  return false;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      permissions?: string[];
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (req.user.role === "super_admin") {
      next();
      return;
    }
    const perms = await getRolePermissions(req.user.roleId);
    if (perms.includes(`${resource}:${action}`) || perms.includes(`${resource}:*`)) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden" });
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
