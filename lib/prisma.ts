import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Extend with audit log deletion protection
export const prisma = basePrisma.$extends({
  query: {
    auditLog: {
      delete({ args, query }) {
        if (process.env.NODE_ENV === "test" || process.env.ALLOW_AUDIT_DELETE === "true") {
          return query(args);
        }
        throw new Error("Audit logs cannot be deleted. This is a HIPAA compliance requirement.");
      },
      deleteMany({ args, query }) {
        if (process.env.NODE_ENV === "test" || process.env.ALLOW_AUDIT_DELETE === "true") {
          return query(args);
        }
        throw new Error("Audit logs cannot be deleted. This is a HIPAA compliance requirement.");
      },
    },
  },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;
