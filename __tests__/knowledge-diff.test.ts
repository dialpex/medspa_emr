import { describe, it, expect } from "vitest";
import { diffMappingSpecs, correctionsToOutcome } from "@/lib/agents/migration/knowledge/diff";

describe("diffMappingSpecs", () => {
  const baseDraft = {
    sourceVendor: "boulevard",
    entityMappings: [
      {
        sourceEntity: "clients",
        targetEntity: "patient",
        fieldMappings: [
          { sourceField: "firstName", targetField: "firstName", transform: "trim" },
          { sourceField: "lastName", targetField: "lastName", transform: "trim" },
          { sourceField: "email", targetField: "email", transform: "normalizeEmail" },
          { sourceField: "phone", targetField: "phone", transform: "normalizePhone" },
        ],
      },
    ],
  };

  it("returns empty array when specs are identical", () => {
    const corrections = diffMappingSpecs(baseDraft, baseDraft);
    expect(corrections).toEqual([]);
  });

  it("returns empty array for null/undefined specs", () => {
    expect(diffMappingSpecs(null, baseDraft)).toEqual([]);
    expect(diffMappingSpecs(baseDraft, null)).toEqual([]);
    expect(diffMappingSpecs(null, null)).toEqual([]);
    expect(diffMappingSpecs(undefined, undefined)).toEqual([]);
  });

  it("detects changed target field", () => {
    const approved = {
      ...baseDraft,
      entityMappings: [
        {
          ...baseDraft.entityMappings[0],
          fieldMappings: [
            ...baseDraft.entityMappings[0].fieldMappings.slice(0, 3),
            // phone → changed from "phone" to "mobilePhone"
            { sourceField: "phone", targetField: "mobilePhone", transform: "normalizePhone" },
          ],
        },
      ],
    };

    const corrections = diffMappingSpecs(baseDraft, approved);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      entityType: "clients->patient",
      sourceField: "phone",
      aiProposal: "phone",
      userChoice: "mobilePhone",
      correctionType: "changed_target",
    });
  });

  it("detects changed transform", () => {
    const approved = {
      ...baseDraft,
      entityMappings: [
        {
          ...baseDraft.entityMappings[0],
          fieldMappings: [
            { sourceField: "firstName", targetField: "firstName", transform: "toUpper" },
            ...baseDraft.entityMappings[0].fieldMappings.slice(1),
          ],
        },
      ],
    };

    const corrections = diffMappingSpecs(baseDraft, approved);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      sourceField: "firstName",
      correctionType: "changed_transform",
    });
  });

  it("detects added field mapping", () => {
    const approved = {
      ...baseDraft,
      entityMappings: [
        {
          ...baseDraft.entityMappings[0],
          fieldMappings: [
            ...baseDraft.entityMappings[0].fieldMappings,
            { sourceField: "dateOfBirth", targetField: "dateOfBirth", transform: "normalizeDate" },
          ],
        },
      ],
    };

    const corrections = diffMappingSpecs(baseDraft, approved);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      sourceField: "dateOfBirth",
      aiProposal: "unmapped",
      userChoice: "dateOfBirth",
      correctionType: "added",
    });
  });

  it("detects removed field mapping", () => {
    const approved = {
      ...baseDraft,
      entityMappings: [
        {
          ...baseDraft.entityMappings[0],
          fieldMappings: baseDraft.entityMappings[0].fieldMappings.slice(0, 2),
        },
      ],
    };

    const corrections = diffMappingSpecs(baseDraft, approved);
    expect(corrections).toHaveLength(2);
    expect(corrections.map((c) => c.correctionType)).toEqual(["removed", "removed"]);
    expect(corrections.map((c) => c.sourceField)).toEqual(["email", "phone"]);
  });

  it("detects multiple correction types at once", () => {
    const approved = {
      sourceVendor: "boulevard",
      entityMappings: [
        {
          sourceEntity: "clients",
          targetEntity: "patient",
          fieldMappings: [
            { sourceField: "firstName", targetField: "firstName", transform: "trim" },
            // lastName removed
            { sourceField: "email", targetField: "contactEmail", transform: "normalizeEmail" }, // target changed
            { sourceField: "phone", targetField: "phone", transform: "normalizePhone" },
            { sourceField: "dob", targetField: "dateOfBirth", transform: "normalizeDate" }, // added
          ],
        },
      ],
    };

    const corrections = diffMappingSpecs(baseDraft, approved);
    expect(corrections).toHaveLength(3);

    const byType = new Map(corrections.map((c) => [c.correctionType, c]));
    expect(byType.get("removed")?.sourceField).toBe("lastName");
    expect(byType.get("changed_target")?.sourceField).toBe("email");
    expect(byType.get("added")?.sourceField).toBe("dob");
  });

  it("handles multiple entity mappings", () => {
    const draft = {
      sourceVendor: "boulevard",
      entityMappings: [
        {
          sourceEntity: "clients",
          targetEntity: "patient",
          fieldMappings: [
            { sourceField: "id", targetField: "sourceRecordId" },
          ],
        },
        {
          sourceEntity: "orders",
          targetEntity: "invoice",
          fieldMappings: [
            { sourceField: "id", targetField: "sourceRecordId" },
            { sourceField: "total", targetField: "total" },
          ],
        },
      ],
    };

    const approved = {
      sourceVendor: "boulevard",
      entityMappings: [
        {
          sourceEntity: "clients",
          targetEntity: "patient",
          fieldMappings: [
            { sourceField: "id", targetField: "sourceRecordId" },
          ],
        },
        {
          sourceEntity: "orders",
          targetEntity: "invoice",
          fieldMappings: [
            { sourceField: "id", targetField: "sourceRecordId" },
            { sourceField: "total", targetField: "totalAmount" }, // changed
          ],
        },
      ],
    };

    const corrections = diffMappingSpecs(draft, approved);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      entityType: "orders->invoice",
      sourceField: "total",
      aiProposal: "total",
      userChoice: "totalAmount",
    });
  });
});

describe("correctionsToOutcome", () => {
  it("converts corrections to RunOutcome format", () => {
    const corrections = [
      {
        entityType: "clients->patient",
        sourceField: "phone",
        aiProposal: "phone",
        userChoice: "mobilePhone",
        correctionType: "changed_target" as const,
      },
    ];

    const result = correctionsToOutcome(corrections);
    expect(result).toHaveLength(1);
    expect(result![0]).toEqual({
      entityType: "clients->patient",
      sourceField: "phone",
      aiProposal: "phone",
      userChoice: "mobilePhone",
    });
  });
});
