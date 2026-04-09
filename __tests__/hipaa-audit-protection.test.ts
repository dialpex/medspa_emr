import { describe, it, expect, afterEach, vi } from "vitest";
import { assertAuditDeletionAllowed } from "../lib/prisma";

describe("Audit Log Deletion Protection", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllow = process.env.ALLOW_AUDIT_DELETE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalAllow !== undefined) {
      process.env.ALLOW_AUDIT_DELETE = originalAllow;
    } else {
      delete process.env.ALLOW_AUDIT_DELETE;
    }
  });

  it("allows deletion in test environment", () => {
    process.env.NODE_ENV = "test";
    expect(() => assertAuditDeletionAllowed()).not.toThrow();
  });

  it("allows deletion with ALLOW_AUDIT_DELETE=true", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_AUDIT_DELETE = "true";
    expect(() => assertAuditDeletionAllowed()).not.toThrow();
  });

  it("blocks deletion in production without override", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_AUDIT_DELETE;
    expect(() => assertAuditDeletionAllowed()).toThrow("Audit logs cannot be deleted");
  });

  it("blocks deletion in development without override", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_AUDIT_DELETE;
    expect(() => assertAuditDeletionAllowed()).toThrow("Audit logs cannot be deleted");
  });
});
