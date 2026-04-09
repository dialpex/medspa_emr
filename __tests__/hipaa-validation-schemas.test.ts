import { describe, it, expect } from "vitest";
import { validateInput, ValidationError } from "../lib/validation/helpers";
import {
  createPatientSchema,
  chartUpdateSchema,
  invoiceSchema,
  userCreateSchema,
  chatMessageSchema,
} from "../lib/validation/schemas";

describe("Zod Validation Schemas", () => {
  describe("createPatientSchema", () => {
    it("accepts valid patient data", () => {
      const data = validateInput(createPatientSchema, {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: "555-1234",
      });
      expect(data.firstName).toBe("Jane");
    });

    it("rejects missing firstName", () => {
      expect(() =>
        validateInput(createPatientSchema, { lastName: "Doe" })
      ).toThrow(ValidationError);
    });

    it("rejects missing lastName", () => {
      expect(() =>
        validateInput(createPatientSchema, { firstName: "Jane" })
      ).toThrow(ValidationError);
    });

    it("rejects invalid email", () => {
      expect(() =>
        validateInput(createPatientSchema, {
          firstName: "Jane",
          lastName: "Doe",
          email: "not-an-email",
        })
      ).toThrow(ValidationError);
    });

    it("accepts empty optional fields", () => {
      const data = validateInput(createPatientSchema, {
        firstName: "Jane",
        lastName: "Doe",
        email: "",
        phone: "",
      });
      expect(data.firstName).toBe("Jane");
    });
  });

  describe("chartUpdateSchema", () => {
    it("accepts valid chart update", () => {
      const data = validateInput(chartUpdateSchema, {
        chiefComplaint: "Botox touch-up",
        areasTreated: '["forehead"]',
      });
      expect(data.chiefComplaint).toBe("Botox touch-up");
    });

    it("accepts empty object (all optional)", () => {
      const data = validateInput(chartUpdateSchema, {});
      expect(data).toEqual({});
    });
  });

  describe("invoiceSchema", () => {
    it("accepts valid invoice", () => {
      const data = validateInput(invoiceSchema, {
        patientId: "cuid123",
        items: [
          { description: "Botox 20u", quantity: 1, unitPrice: 300 },
        ],
      });
      expect(data.items).toHaveLength(1);
    });

    it("rejects invoice with no items", () => {
      expect(() =>
        validateInput(invoiceSchema, { patientId: "cuid123", items: [] })
      ).toThrow(ValidationError);
    });

    it("rejects negative quantity", () => {
      expect(() =>
        validateInput(invoiceSchema, {
          patientId: "cuid123",
          items: [{ description: "Test", quantity: -1, unitPrice: 10 }],
        })
      ).toThrow(ValidationError);
    });
  });

  describe("userCreateSchema", () => {
    it("accepts valid user", () => {
      const data = validateInput(userCreateSchema, {
        name: "Dr. Smith",
        email: "smith@clinic.com",
        role: "Provider",
        password: "testpass",
      });
      expect(data.role).toBe("Provider");
    });

    it("rejects invalid role", () => {
      expect(() =>
        validateInput(userCreateSchema, {
          name: "Test",
          email: "test@test.com",
          role: "SuperAdmin",
          password: "pass",
        })
      ).toThrow(ValidationError);
    });
  });

  describe("chatMessageSchema", () => {
    it("accepts valid messages", () => {
      const data = validateInput(chatMessageSchema, {
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(data.messages).toHaveLength(1);
    });

    it("rejects empty messages array", () => {
      expect(() =>
        validateInput(chatMessageSchema, { messages: [] })
      ).toThrow(ValidationError);
    });

    it("rejects invalid role", () => {
      expect(() =>
        validateInput(chatMessageSchema, {
          messages: [{ role: "system", content: "Hello" }],
        })
      ).toThrow(ValidationError);
    });
  });

  describe("ValidationError", () => {
    it("contains structured field errors", () => {
      try {
        validateInput(createPatientSchema, { firstName: "" });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        const ve = err as ValidationError;
        expect(ve.errors.length).toBeGreaterThan(0);
        expect(ve.errors[0]).toHaveProperty("field");
        expect(ve.errors[0]).toHaveProperty("message");
      }
    });
  });
});
