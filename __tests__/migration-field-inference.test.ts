import { describe, it, expect } from "vitest";
import { heuristicFieldType } from "@/lib/agents/migration/field-inference/infer";
import { validateFieldInference, FIELD_TYPE_VALUES } from "@/lib/agents/migration/field-inference/schema";
import type { FormFieldContent } from "@/lib/migration/providers/types";

function makeField(overrides: Partial<FormFieldContent> & { fieldId: string; label: string; type: string }): FormFieldContent {
  return {
    value: null,
    ...overrides,
  };
}

describe("heuristicFieldType", () => {
  it("maps heading → heading", () => {
    expect(heuristicFieldType(makeField({ fieldId: "1", label: "Section Title", type: "heading" }))).toBe("heading");
  });

  it("maps signature → signature", () => {
    expect(heuristicFieldType(makeField({ fieldId: "2", label: "Patient Signature", type: "signature" }))).toBe("signature");
  });

  it("maps date → date", () => {
    expect(heuristicFieldType(makeField({ fieldId: "3", label: "Date of Birth", type: "date" }))).toBe("date");
  });

  it("maps connected_date → date", () => {
    expect(heuristicFieldType(makeField({ fieldId: "4", label: "Treatment Date", type: "connected_date" }))).toBe("date");
  });

  it("maps image → photo-single", () => {
    expect(heuristicFieldType(makeField({ fieldId: "5", label: "Before Photo", type: "image" }))).toBe("photo-single");
  });

  it("maps checkbox → checklist", () => {
    expect(heuristicFieldType(makeField({ fieldId: "6", label: "Areas Treated", type: "checkbox" }))).toBe("checklist");
  });

  it("maps radio → select", () => {
    expect(heuristicFieldType(makeField({ fieldId: "7", label: "Skin Type", type: "radio" }))).toBe("select");
  });

  it("maps dropdown → select", () => {
    expect(heuristicFieldType(makeField({ fieldId: "8", label: "Treatment Type", type: "dropdown" }))).toBe("select");
  });

  it("maps select → select", () => {
    expect(heuristicFieldType(makeField({ fieldId: "9", label: "Provider", type: "select" }))).toBe("select");
  });

  it("maps textarea → textarea", () => {
    expect(heuristicFieldType(makeField({ fieldId: "10", label: "Description", type: "textarea" }))).toBe("textarea");
  });

  it("maps text → text (default)", () => {
    expect(heuristicFieldType(makeField({ fieldId: "11", label: "Name", type: "text" }))).toBe("text");
  });

  it("maps unknown type → text (default)", () => {
    expect(heuristicFieldType(makeField({ fieldId: "12", label: "Something", type: "unknown_type" }))).toBe("text");
  });

  // Label-based heuristics
  it("infers number from label containing 'units'", () => {
    expect(heuristicFieldType(makeField({ fieldId: "13", label: "Total Units", type: "text" }))).toBe("number");
  });

  it("infers number from label containing 'dosage'", () => {
    expect(heuristicFieldType(makeField({ fieldId: "14", label: "Dosage Amount", type: "text" }))).toBe("number");
  });

  it("infers textarea from label containing 'notes'", () => {
    expect(heuristicFieldType(makeField({ fieldId: "15", label: "Treatment Notes", type: "text" }))).toBe("textarea");
  });

  it("infers textarea from label containing 'comments'", () => {
    expect(heuristicFieldType(makeField({ fieldId: "16", label: "Additional Comments", type: "text" }))).toBe("textarea");
  });

  it("infers json-areas from label containing 'areas treated'", () => {
    expect(heuristicFieldType(makeField({ fieldId: "17", label: "Areas Treated", type: "text" }))).toBe("json-areas");
  });

  it("infers json-areas from label containing 'injection sites'", () => {
    expect(heuristicFieldType(makeField({ fieldId: "18", label: "Injection Sites", type: "text" }))).toBe("json-areas");
  });

  it("infers json-products from label containing 'products used'", () => {
    expect(heuristicFieldType(makeField({ fieldId: "19", label: "Products Used", type: "text" }))).toBe("json-products");
  });

  it("infers first-name from label", () => {
    expect(heuristicFieldType(makeField({ fieldId: "20", label: "First Name", type: "text" }))).toBe("first-name");
  });

  it("infers last-name from label", () => {
    expect(heuristicFieldType(makeField({ fieldId: "21", label: "Last Name", type: "text" }))).toBe("last-name");
  });

  // Connected field handling
  it("maps connected_text with 'first name' label → first-name", () => {
    expect(heuristicFieldType(makeField({ fieldId: "22", label: "First Name", type: "connected_text" }))).toBe("first-name");
  });

  it("maps connected_text with 'last name' label → last-name", () => {
    expect(heuristicFieldType(makeField({ fieldId: "23", label: "Last Name", type: "connected_text" }))).toBe("last-name");
  });

  it("maps connected_text with 'date of birth' label → date", () => {
    expect(heuristicFieldType(makeField({ fieldId: "24", label: "Date of Birth", type: "connected_text" }))).toBe("date");
  });

  it("maps connected_text with generic label → text", () => {
    expect(heuristicFieldType(makeField({ fieldId: "25", label: "Phone Number", type: "connected_text" }))).toBe("text");
  });
});

describe("validateFieldInference", () => {
  it("accepts valid inference result", () => {
    const result = validateFieldInference(
      {
        fields: [
          { fieldId: "f1", fieldType: "text", reasoning: "test" },
          { fieldId: "f2", fieldType: "textarea", reasoning: "test" },
        ],
      },
      ["f1", "f2"]
    );
    expect(result.valid).toBe(true);
  });

  it("rejects missing fields array", () => {
    const result = validateFieldInference(
      { fields: null } as unknown as { fields: Array<{ fieldId: string; fieldType: "text"; reasoning: string }> },
      ["f1"]
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("fields");
  });

  it("rejects invalid field types", () => {
    const result = validateFieldInference(
      {
        fields: [
          { fieldId: "f1", fieldType: "invalid_type" as "text", reasoning: "test" },
        ],
      },
      ["f1"]
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("invalid_type");
  });

  it("rejects when expected fields are missing from response", () => {
    const result = validateFieldInference(
      {
        fields: [
          { fieldId: "f1", fieldType: "text", reasoning: "test" },
        ],
      },
      ["f1", "f2", "f3"]
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("f2");
    expect(result.error).toContain("f3");
  });

  it("FIELD_TYPE_VALUES contains all 16 field types", () => {
    expect(FIELD_TYPE_VALUES).toHaveLength(16);
    expect(FIELD_TYPE_VALUES).toContain("text");
    expect(FIELD_TYPE_VALUES).toContain("textarea");
    expect(FIELD_TYPE_VALUES).toContain("select");
    expect(FIELD_TYPE_VALUES).toContain("multiselect");
    expect(FIELD_TYPE_VALUES).toContain("number");
    expect(FIELD_TYPE_VALUES).toContain("date");
    expect(FIELD_TYPE_VALUES).toContain("checklist");
    expect(FIELD_TYPE_VALUES).toContain("signature");
    expect(FIELD_TYPE_VALUES).toContain("photo-pair");
    expect(FIELD_TYPE_VALUES).toContain("photo-single");
    expect(FIELD_TYPE_VALUES).toContain("json-areas");
    expect(FIELD_TYPE_VALUES).toContain("json-products");
    expect(FIELD_TYPE_VALUES).toContain("heading");
    expect(FIELD_TYPE_VALUES).toContain("first-name");
    expect(FIELD_TYPE_VALUES).toContain("last-name");
    expect(FIELD_TYPE_VALUES).toContain("logo");
  });
});
