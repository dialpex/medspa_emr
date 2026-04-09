import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Guard against audit log deletion (HIPAA compliance).
 * Call this before any auditLog.delete/deleteMany operation.
 * The Prisma $extends approach was removed because it breaks Edge Runtime
 * (middleware imports prisma transitively via auth).
 */
export function assertAuditDeletionAllowed(): void {
  if (process.env.NODE_ENV === "test" || process.env.ALLOW_AUDIT_DELETE === "true") {
    return;
  }
  throw new Error("Audit logs cannot be deleted. This is a HIPAA compliance requirement.");
}
