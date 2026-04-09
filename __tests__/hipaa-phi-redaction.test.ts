import { describe, it, expect, vi } from "vitest";

// Mock prisma to avoid DB dependency
vi.mock("@/lib/prisma", () => ({
  prisma: {
    patient: {
      findMany: vi.fn().mockResolvedValue([
        { firstName: "Jane", lastName: "Smith" },
        { firstName: "John", lastName: "Doe" },
      ]),
    },
  },
}));

describe("PHI Text Redaction", () => {
  it("redacts SSN patterns", async () => {
    const { redactTextPHI } = await import("../lib/agents/_shared/phi/text-redactor");
    const result = await redactTextPHI("Patient SSN is 123-45-6789", "clinic-1");
    expect(result).toContain("[REDACTED-SSN]");
    expect(result).not.toContain("123-45-6789");
  });

  it("redacts phone number patterns", async () => {
    const { redactTextPHI } = await import("../lib/agents/_shared/phi/text-redactor");
    const result = await redactTextPHI("Call me at (555) 123-4567", "clinic-1");
    expect(result).toContain("[REDACTED-PHONE]");
    expect(result).not.toContain("555");
  });

  it("redacts email patterns", async () => {
    const { redactTextPHI } = await import("../lib/agents/_shared/phi/text-redactor");
    const result = await redactTextPHI("Email: patient@example.com please", "clinic-1");
    expect(result).toContain("[REDACTED-EMAIL]");
    expect(result).not.toContain("patient@example.com");
  });

  it("redacts DOB patterns (MM/DD/YYYY)", async () => {
    const { redactTextPHI } = await import("../lib/agents/_shared/phi/text-redactor");
    const result = await redactTextPHI("DOB: 03/15/1990", "clinic-1");
    expect(result).toContain("[REDACTED-DOB]");
    expect(result).not.toContain("03/15/1990");
  });

  it("redacts known patient names from the clinic", async () => {
    const { redactTextPHI } = await import("../lib/agents/_shared/phi/text-redactor");
    const result = await redactTextPHI(
      "Jane Smith came in for a Botox treatment. John was also present.",
      "clinic-1"
    );
    expect(result).not.toContain("Jane");
    expect(result).not.toContain("Smith");
    expect(result).not.toContain("John");
    expect(result).toContain("[REDACTED-NAME]");
  });

  it("preserves non-PHI text", async () => {
    const { redactTextPHI } = await import("../lib/agents/_shared/phi/text-redactor");
    const result = await redactTextPHI("Schedule a follow-up in 2 weeks", "clinic-1");
    expect(result).toBe("Schedule a follow-up in 2 weeks");
  });
});
