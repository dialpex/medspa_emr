import { describe, it, expect } from "vitest";
import { SafeContextBuilder, maskString, maskDate, maskFreeText, maskIdentifier } from "../lib/migration/agent/safe-context-builder";
import type { SourceProfile } from "../lib/migration/adapters/types";

describe("SafeContext PHI Masking", () => {
  describe("masking functions", () => {
    it("masks strings with length", () => {
      expect(maskString("John Doe")).toBe("[string len=8]");
      expect(maskString("")).toBe("[string len=0]");
    });

    it("masks dates", () => {
      expect(maskDate("1990-01-15")).toBe("[date]");
      expect(maskDate("01/15/1990")).toBe("[date]");
    });

    it("masks free text with length", () => {
      expect(maskFreeText("Patient reports headache")).toBe("[text redacted len=24]");
    });

    it("masks identifiers with HMAC", () => {
      const masked = maskIdentifier("patient-123");
      expect(masked).toHaveLength(16);
      expect(masked).not.toContain("patient");
      // Deterministic
      expect(maskIdentifier("patient-123")).toBe(masked);
      // Different input → different output
      expect(maskIdentifier("patient-456")).not.toBe(masked);
    });
  });

  describe("SafeContextBuilder", () => {
    const mockProfile: SourceProfile = {
      entities: [
        {
          type: "patients",
          source: "patients.csv",
          recordCount: 150,
          fields: [
            {
              name: "firstName",
              inferredType: "string",
              nullRate: 0.02,
              uniqueRate: 0.85,
              sampleDistribution: "147/150 non-null, 120 unique",
              isPHI: true,
            },
            {
              name: "email",
              inferredType: "email",
              nullRate: 0.1,
              uniqueRate: 0.99,
              sampleDistribution: "135/150 non-null, 134 unique",
              isPHI: true,
            },
            {
              name: "status",
              inferredType: "enum",
              nullRate: 0,
              uniqueRate: 0.02,
              sampleDistribution: "150/150 non-null, 3 unique",
              isPHI: false,
            },
          ],
          keyCandidates: ["email"],
          relationshipHints: [],
        },
      ],
      phiClassification: {
        patients: { firstName: true, email: true, status: false },
      },
    };

    it("builds SafeContext from profile", () => {
      const builder = new SafeContextBuilder();
      const context = builder.buildFromProfile(mockProfile);

      expect(context.sourceProfile).toBeDefined();
      expect(context.targetSchema).toBeDefined();
      expect(context.targetSchema.length).toBeGreaterThan(0);
    });

    it("preserves valid statistical distributions", () => {
      const builder = new SafeContextBuilder();
      const context = builder.buildFromProfile(mockProfile);

      const patientEntity = context.sourceProfile.entities[0];
      expect(patientEntity.fields[0].sampleDistribution).toBe("147/150 non-null, 120 unique");
    });

    it("sanitizes suspicious distributions", () => {
      const badProfile: SourceProfile = {
        entities: [
          {
            type: "patients",
            source: "patients.csv",
            recordCount: 5,
            fields: [
              {
                name: "name",
                inferredType: "string",
                nullRate: 0,
                uniqueRate: 1,
                sampleDistribution: "John Doe, Jane Smith, Bob Wilson",
                isPHI: true,
              },
            ],
            keyCandidates: [],
            relationshipHints: [],
          },
        ],
        phiClassification: { patients: { name: true } },
      };

      const builder = new SafeContextBuilder();
      const context = builder.buildFromProfile(badProfile);

      // Should NOT contain actual names
      const dist = context.sourceProfile.entities[0].fields[0].sampleDistribution;
      expect(dist).not.toContain("John");
      expect(dist).not.toContain("Jane");
      expect(dist).toBe("[distribution available]");
    });

    it("includes target schema description", () => {
      const builder = new SafeContextBuilder();
      const context = builder.buildFromProfile(mockProfile);

      const patientSchema = context.targetSchema.find((s) => s.entityType === "patient");
      expect(patientSchema).toBeDefined();
      expect(patientSchema!.fields.find((f) => f.name === "firstName")?.required).toBe(true);
      expect(patientSchema!.fields.find((f) => f.name === "email")?.required).toBe(false);
    });

    it("includes existing services when provided", () => {
      const builder = new SafeContextBuilder();
      const services = [
        { id: "svc-1", name: "Botox" },
        { id: "svc-2", name: "Filler" },
      ];
      const context = builder.buildFromProfile(mockProfile, services);

      expect(context.existingServices).toEqual(services);
    });
  });
});
