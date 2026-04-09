import { prisma } from "./prisma";
import { headers } from "next/headers";
import type { AuditAction } from "@prisma/client";

type AuditLogInput = {
  clinicId: string;
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  details?: string;
};

function extractClientInfo(headersList: Headers): { ipAddress: string | null; userAgent: string | null } {
  const ipAddress =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    null;
  const userAgent = headersList.get("user-agent") || null;
  return { ipAddress, userAgent };
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  try {
    const headersList = await headers();
    const info = extractClientInfo(headersList);
    ipAddress = info.ipAddress;
    userAgent = info.userAgent;
  } catch {
    // headers() may not be available in all contexts (e.g., scripts)
  }

  await prisma.auditLog.create({
    data: {
      clinicId: input.clinicId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details,
      ipAddress,
      userAgent,
    },
  });
}

/**
 * Create audit log from a Request object (for API routes where headers() doesn't work)
 */
export async function createAuditLogFromRequest(
  input: AuditLogInput,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = extractClientInfo(new Headers(request.headers));

  await prisma.auditLog.create({
    data: {
      clinicId: input.clinicId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details,
      ipAddress,
      userAgent,
    },
  });
}
