import { describe, it, expect } from "vitest";
import { validateMappingSpec, type MappingSpec } from "../lib/migration/canonical/mapping-spec";

describe("MappingSpec Validation", () => {
  const validSpec: MappingSpec = {
    version: 1,
    sourceVendor: "boulevard",
    entityMappings: [
      {
        sourceEntity: "patients",
        targetEntity: "patient",
        fieldMappings: [
          {
            sourceField: "first_name",
            targetField: "firstName",
            transform: "trim",
            confidence: 0.95,
            requiresApproval: false,
          },
          {
            sourceField: "last_name",
            targetField: "lastName",
            transform: "trim",
            confidence: 0.95,
            requiresApproval: false,
          },
          {
            sourceField: "email_address",
            targetField: "email",
            transform: "normalizeEmail",
            confidence: 0.9,
            requiresApproval: false,
          },
          {
            sourceField: "phone",
            targetField: "phone",
            transform: "normalizePhone",
            confidence: 0.85,
            requiresApproval: false,
          },
          {
            sourceField: "dob",
            targetField: "dateOfBirth",
            transform: "normalizeDate",
            confidence: 0.8,
            requiresApproval: false,
          },
        ],
        enumMaps: {},
      },
      {
        sourceEntity: "appointments",
        targetEntity: "appointment",
        fieldMappings: [
          {
            sourceField: "patient_id",
            targetField: "canonicalPatientId",
            transform: null,
            confidence: 0.9,
            requiresApproval: false,
          },
          {
            sourceField: "provider",
            targetField: "providerName",
            transform: "trim",
            confidence: 0.7,
            requiresApproval: true,
          },
          {
            sourceField: "start",
            targetField: "startTime",
            transform: "normalizeDate",
            confidence: 0.95,
            requiresApproval: false,
          },
          {
            sourceField: "status",
            targetField: "status",
            transform: "mapEnum",
            confidence: 0.6,
            requiresApproval: true,
          },
        ],
        enumMaps: {
          status: {
            completed: "Completed",
            cancelled: "Cancelled",
            no_show: "NoShow",
          },
        },
      },
    ],
  };

  it("validates a correct mapping spec", () => {
    const result = validateMappingSpec(validSpec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects null/undefined", () => {
    expect(validateMappingSpec(null).valid).toBe(false);
    expect(validateMappingSpec(undefined).valid).toBe(false);
  });

  it("rejects missing version", () => {
    const spec = { ...validSpec, version: 0 };
    const result = validateMappingSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "version")).toBe(true);
  });

  it("rejects missing sourceVendor", () => {
    const spec = { ...validSpec, sourceVendor: "" };
    const result = validateMappingSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "sourceVendor")).toBe(true);
  });

  it("rejects invalid entity type", () => {
    const spec = {
      ...validSpec,
      entityMappings: [
        {
          sourceEntity: "patients",
          targetEntity: "invalid_entity",
          fieldMappings: [],
          enumMaps: {},
        },
      ],
    };
    const result = validateMappingSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("targetEntity"))).toBe(true);
  });

  it("rejects non-allowlisted transforms", () => {
    const spec = {
      ...validSpec,
      entityMappings: [
        {
          sourceEntity: "patients",
          targetEntity: "patient",
          fieldMappings: [
            {
              sourceField: "name",
              targetField: "firstName",
              transform: "eval",
              confidence: 0.9,
              requiresApproval: false,
            },
          ],
          enumMaps: {},
        },
      ],
    };
    const result = validateMappingSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("not in the allowlist"))).toBe(true);
  });

  it("rejects confidence out of range", () => {
    const spec = {
      ...validSpec,
      entityMappings: [
        {
          sourceEntity: "patients",
          targetEntity: "patient",
          fieldMappings: [
            {
              sourceField: "name",
              targetField: "firstName",
              transform: null,
              confidence: 1.5,
              requiresApproval: false,
            },
          ],
          enumMaps: {},
        },
      ],
    };
    const result = validateMappingSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("confidence"))).toBe(true);
  });

  it("allows null transform", () => {
    const spec = {
      ...validSpec,
      entityMappings: [
        {
          sourceEntity: "patients",
          targetEntity: "patient",
          fieldMappings: [
            {
              sourceField: "id",
              targetField: "sourceRecordId",
              transform: null,
              confidence: 1.0,
              requiresApproval: false,
            },
          ],
          enumMaps: {},
        },
      ],
    };
    const result = validateMappingSpec(spec);
    expect(result.valid).toBe(true);
  });
});
