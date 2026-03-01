import { describe, it, expect } from "vitest";
import {
  validatePatient,
  validateAppointment,
  validateChart,
  validateInvoice,
  validateRecord,
  validateBatch,
  validateReferentialIntegrity,
  V_CODES,
} from "../lib/migration/canonical/validators";
import type {
  CanonicalPatient,
  CanonicalAppointment,
  CanonicalChart,
  CanonicalInvoice,
} from "../lib/migration/canonical/schema";

describe("Canonical Validators", () => {
  describe("validatePatient", () => {
    it("passes a valid patient", () => {
      const patient: CanonicalPatient = {
        canonicalId: "p-001",
        sourceRecordId: "src-1",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        dateOfBirth: "1990-05-15",
      };
      const result = validatePatient(patient);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails on missing firstName", () => {
      const patient: CanonicalPatient = {
        canonicalId: "p-002",
        sourceRecordId: "src-2",
        firstName: "",
        lastName: "Doe",
      };
      const result = validatePatient(patient);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === V_CODES.MISSING_REQUIRED && e.field === "firstName")).toBe(true);
    });

    it("fails on missing lastName", () => {
      const patient: CanonicalPatient = {
        canonicalId: "p-003",
        sourceRecordId: "src-3",
        firstName: "Jane",
        lastName: "",
      };
      const result = validatePatient(patient);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "lastName")).toBe(true);
    });

    it("warns on invalid email", () => {
      const patient: CanonicalPatient = {
        canonicalId: "p-004",
        sourceRecordId: "src-4",
        firstName: "Jane",
        lastName: "Doe",
        email: "not-an-email",
      };
      const result = validatePatient(patient);
      expect(result.valid).toBe(true); // warning, not error
      expect(result.warnings.some((e) => e.code === V_CODES.INVALID_EMAIL)).toBe(true);
    });
  });

  describe("validateAppointment", () => {
    it("passes a valid appointment", () => {
      const appt: CanonicalAppointment = {
        canonicalId: "a-001",
        sourceRecordId: "src-a1",
        canonicalPatientId: "p-001",
        providerName: "Dr. Smith",
        startTime: "2025-01-15T10:00:00Z",
        status: "Completed",
      };
      const result = validateAppointment(appt);
      expect(result.valid).toBe(true);
    });

    it("fails on missing patient link", () => {
      const appt: CanonicalAppointment = {
        canonicalId: "a-002",
        sourceRecordId: "src-a2",
        canonicalPatientId: "",
        providerName: "Dr. Smith",
        startTime: "2025-01-15T10:00:00Z",
        status: "Completed",
      };
      const result = validateAppointment(appt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === V_CODES.MISSING_PATIENT_LINK)).toBe(true);
    });

    it("fails on missing provider", () => {
      const appt: CanonicalAppointment = {
        canonicalId: "a-003",
        sourceRecordId: "src-a3",
        canonicalPatientId: "p-001",
        providerName: "",
        startTime: "2025-01-15T10:00:00Z",
        status: "Completed",
      };
      const result = validateAppointment(appt);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === V_CODES.MISSING_PROVIDER)).toBe(true);
    });

    it("fails on missing startTime", () => {
      const appt: CanonicalAppointment = {
        canonicalId: "a-004",
        sourceRecordId: "src-a4",
        canonicalPatientId: "p-001",
        providerName: "Dr. Smith",
        startTime: "",
        status: "Completed",
      };
      const result = validateAppointment(appt);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateChart", () => {
    it("fails on missing provider attribution", () => {
      const chart: CanonicalChart = {
        canonicalId: "c-001",
        sourceRecordId: "src-c1",
        canonicalPatientId: "p-001",
        providerName: "",
        sections: [{ title: "HPI", content: "Chief complaint" }],
      };
      const result = validateChart(chart);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === V_CODES.MISSING_PROVIDER)).toBe(true);
    });

    it("warns on empty sections", () => {
      const chart: CanonicalChart = {
        canonicalId: "c-002",
        sourceRecordId: "src-c2",
        canonicalPatientId: "p-001",
        providerName: "Dr. Smith",
        sections: [],
      };
      const result = validateChart(chart);
      expect(result.valid).toBe(true); // warning only
      expect(result.warnings.some((e) => e.code === V_CODES.EMPTY_SECTIONS)).toBe(true);
    });
  });

  describe("validateInvoice", () => {
    it("fails on negative total", () => {
      const invoice: CanonicalInvoice = {
        canonicalId: "i-001",
        sourceRecordId: "src-i1",
        canonicalPatientId: "p-001",
        status: "paid",
        total: -100,
        lineItems: [{ description: "Botox", quantity: 1, unitPrice: 100, total: 100 }],
      };
      const result = validateInvoice(invoice);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === V_CODES.INVALID_AMOUNT)).toBe(true);
    });

    it("warns on no line items", () => {
      const invoice: CanonicalInvoice = {
        canonicalId: "i-002",
        sourceRecordId: "src-i2",
        canonicalPatientId: "p-001",
        status: "paid",
        total: 200,
        lineItems: [],
      };
      const result = validateInvoice(invoice);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((e) => e.code === V_CODES.MISSING_LINE_ITEMS)).toBe(true);
    });
  });

  describe("validateRecord dispatch", () => {
    it("dispatches to correct validator by entity type", () => {
      const patient: CanonicalPatient = {
        canonicalId: "p-010",
        sourceRecordId: "src-10",
        firstName: "Test",
        lastName: "User",
      };
      const result = validateRecord("patient", patient);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateBatch", () => {
    it("produces a complete report", () => {
      const records = [
        {
          entityType: "patient" as const,
          record: { canonicalId: "p-1", sourceRecordId: "s-1", firstName: "A", lastName: "B" } as CanonicalPatient,
        },
        {
          entityType: "patient" as const,
          record: { canonicalId: "p-2", sourceRecordId: "s-2", firstName: "", lastName: "C" } as CanonicalPatient,
        },
        {
          entityType: "appointment" as const,
          record: {
            canonicalId: "a-1", sourceRecordId: "s-a1",
            canonicalPatientId: "p-1", providerName: "Dr. X",
            startTime: "2025-01-01T10:00:00Z", status: "Completed",
          } as CanonicalAppointment,
        },
      ];

      const report = validateBatch(records);
      expect(report.totalRecords).toBe(3);
      expect(report.validRecords).toBe(2);
      expect(report.invalidRecords).toBe(1);
      expect(report.errorsByCode[V_CODES.MISSING_REQUIRED]).toBe(1);
      expect(report.errorsByEntity["patient"]).toBe(1);
    });
  });

  describe("validateReferentialIntegrity", () => {
    it("detects orphaned patient reference", () => {
      const records = [
        {
          entityType: "patient" as const,
          record: { canonicalId: "p-1", sourceRecordId: "s-1", firstName: "A", lastName: "B" } as CanonicalPatient,
        },
        {
          entityType: "appointment" as const,
          record: {
            canonicalId: "a-1", sourceRecordId: "s-a1",
            canonicalPatientId: "p-999", // doesn't exist
            providerName: "Dr. X",
            startTime: "2025-01-01T10:00:00Z", status: "Completed",
          } as CanonicalAppointment,
        },
      ];

      const errors = validateReferentialIntegrity(records);
      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(V_CODES.ORPHANED_REFERENCE);
      expect(errors[0].field).toBe("canonicalPatientId");
    });

    it("passes when all references resolve", () => {
      const records = [
        {
          entityType: "patient" as const,
          record: { canonicalId: "p-1", sourceRecordId: "s-1", firstName: "A", lastName: "B" } as CanonicalPatient,
        },
        {
          entityType: "appointment" as const,
          record: {
            canonicalId: "a-1", sourceRecordId: "s-a1",
            canonicalPatientId: "p-1",
            providerName: "Dr. X",
            startTime: "2025-01-01T10:00:00Z", status: "Completed",
          } as CanonicalAppointment,
        },
      ];

      const errors = validateReferentialIntegrity(records);
      expect(errors.length).toBe(0);
    });
  });
});
