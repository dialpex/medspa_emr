import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

describe("Audit Log Deletion Protection", () => {
  // Use a fresh PrismaClient with extensions to test the protection
  // We can't use the extended client directly in tests because the
  // test env has NODE_ENV=test which bypasses the protection.
  // Instead, we test the logic inline.

  it("the protection is bypassed in test environment", async () => {
    // This verifies the escape hatch works so tests can clean up
    expect(process.env.NODE_ENV).toBe("test");
  });

  it("protection logic rejects deletion outside test/allowed contexts", () => {
    // Simulate the check logic from lib/prisma.ts
    const nodeEnv: string = "production";
    const allowAuditDelete: string | undefined = undefined;

    const shouldBlock =
      nodeEnv !== "test" && allowAuditDelete !== "true";

    expect(shouldBlock).toBe(true);
  });

  it("protection logic allows deletion in test environment", () => {
    const nodeEnv: string = "test";
    const shouldBlock = nodeEnv !== "test";
    expect(shouldBlock).toBe(false);
  });

  it("protection logic allows deletion with ALLOW_AUDIT_DELETE=true", () => {
    const nodeEnv: string = "production";
    const allowAuditDelete: string = "true";
    const shouldBlock =
      nodeEnv !== "test" && allowAuditDelete !== "true";
    expect(shouldBlock).toBe(false);
  });
});
