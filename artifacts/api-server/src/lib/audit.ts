import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db";
import type { Request } from "express";

export async function logAudit(params: {
  req?: Request;
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  try {
    await db.insert(auditLogsTable).values({
      userId: params.userId ?? params.req?.user?.sub,
      userEmail: params.userEmail ?? params.req?.user?.email,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      oldValue: params.oldValue as any,
      newValue: params.newValue as any,
      ipAddress:
        (params.req?.headers["x-forwarded-for"] as string) ??
        params.req?.socket.remoteAddress,
      userAgent: params.req?.headers["user-agent"],
    });
  } catch (err) {
    // Audit log failure must never crash the main request
    console.error("Audit log error:", err);
  }
}
