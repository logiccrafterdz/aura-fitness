import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  rolesTable,
  refreshTokensTable,
} from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
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
import bcrypt from "bcryptjs";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

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
      })
      .from(usersTable)
      .leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user || !user.isActive) {
      throw new AppError(401, "Invalid credentials");
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Invalid credentials");
    }

    await db
      .update(usersTable)
      .set({ lastLoginAt: new Date() })
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

export default router;
