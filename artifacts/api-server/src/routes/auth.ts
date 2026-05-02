import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  rolesTable,
  refreshTokensTable,
} from "@workspace/db";
import { eq, and, gt, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import {
  comparePassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  getUserWithRole,
  requireAuth,
} from "../lib/auth";
import { logAudit } from "../lib/audit";
import { AppError } from "../lib/errors";

const router = Router();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";

    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        passwordHash: usersTable.passwordHash,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        roleId: usersTable.roleId,
        roleName: rolesTable.name,
        isActive: usersTable.isActive,
        failedLoginAttempts: usersTable.failedLoginAttempts,
        lockedUntil: usersTable.lockedUntil,
      })
      .from(usersTable)
      .leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user || !user.isActive) {
      throw new AppError(401, "Invalid credentials");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 1000 / 60,
      );
      throw new AppError(
        429,
        `Account locked. Try again in ${remaining} minute(s).`,
      );
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const updateData: any = {
        failedLoginAttempts: newAttempts,
        updatedAt: new Date(),
      };
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await db
        .update(usersTable)
        .set(updateData)
        .where(eq(usersTable.id, user.id));

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new AppError(
          429,
          "Account locked for 15 minutes due to too many failed attempts.",
        );
      }
      const attemptsLeft = MAX_FAILED_ATTEMPTS - newAttempts;
      throw new AppError(
        401,
        `Invalid credentials. ${attemptsLeft} attempt(s) remaining before lockout.`,
      );
    }

    await db
      .update(usersTable)
      .set({
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.roleName ?? "staff",
      roleId: user.roleId ?? "",
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(user.id);
    await storeRefreshToken(user.id, refreshToken);

    await logAudit({
      req,
      userId: user.id,
      userEmail: user.email,
      action: "login",
      resource: "auth",
      resourceId: user.id,
      newValue: { ip },
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.roleName,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = z
      .object({ refreshToken: z.string() })
      .parse(req.body);

    const decoded = verifyRefreshToken(refreshToken);
    const user = await getUserWithRole(decoded.sub);
    if (!user || !user.isActive) {
      throw new AppError(401, "Invalid token");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(429, "Account is locked");
    }

    await revokeRefreshToken(user.id, refreshToken);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.roleName ?? "staff",
      roleId: user.roleId ?? "",
    };

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(user.id);
    await storeRefreshToken(user.id, newRefreshToken);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/logout", requireAuth, async (req, res, next) => {
  try {
    const { refreshToken } = z
      .object({ refreshToken: z.string().optional() })
      .parse(req.body);

    if (refreshToken && req.user) {
      await revokeRefreshToken(req.user.sub, refreshToken);
    }

    await logAudit({
      req,
      action: "logout",
      resource: "auth",
      resourceId: req.user?.sub,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await getUserWithRole(req.user!.sub);
    if (!user) throw new AppError(404, "User not found");
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.roleName,
      roleId: user.roleId,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/auth/sessions", requireAuth, async (req, res, next) => {
  try {
    const sessions = await db
      .select({
        id: refreshTokensTable.id,
        createdAt: refreshTokensTable.createdAt,
        expiresAt: refreshTokensTable.expiresAt,
        revokedAt: refreshTokensTable.revokedAt,
      })
      .from(refreshTokensTable)
      .where(
        and(
          eq(refreshTokensTable.userId, req.user!.sub),
          isNull(refreshTokensTable.revokedAt),
          gt(refreshTokensTable.expiresAt, new Date()),
        ),
      )
      .orderBy(refreshTokensTable.createdAt);

    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.delete("/auth/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const [session] = await db
      .select()
      .from(refreshTokensTable)
      .where(
        and(
          eq(refreshTokensTable.id, req.params.id as string),
          eq(refreshTokensTable.userId, req.user!.sub),
        ),
      );
    if (!session) throw new AppError(404, "Session not found");

    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.id, req.params.id as string));

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/auth/sessions", requireAuth, async (req, res, next) => {
  try {
    const { except } = z
      .object({ except: z.string().optional() })
      .parse(req.body);

    const conditions: any[] = [
      eq(refreshTokensTable.userId, req.user!.sub),
      isNull(refreshTokensTable.revokedAt),
    ];
    if (except) {
      conditions.push(ne(refreshTokensTable.id, except));
    }

    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(and(...conditions));

    res.json({ success: true, message: "All other sessions revoked" });
  } catch (err) {
    next(err);
  }
});

export default router;
