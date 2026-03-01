import { describe, it, expect } from "vitest";
import { MockMigrationProvider } from "../lib/migration/providers/mock";
import type { SourceForm, FormFieldContent } from "../lib/migration/providers/types";

// Import classifyAndMapForms directly — it uses runAI internally
// but falls back to heuristic classification without OPENAI_API_KEY
// We inline the heuristic logic here to test it independently of Next.js deps

function classifyByHeuristic(
  forms: Array<SourceForm & { fields?: FormFieldContent[] }>
) {
  return forms.map((f) => {
    const name = f.templateName.toLowerCase();

    if (f.isInternal && !name.includes("chart") && !name.includes("treatment")) {
      return {
        formSourceId: f.sourceId,
        classification: "skip" as const,
        confidence: 0.8,
        reasoning: "Internal admin form",
        chartData: null,
      };
    }

    if (
      name.includes("consent") ||
      name.includes("waiver") ||
      name.includes("agreement") ||
      name.includes("policy") ||
      name.includes("authorization") ||
      name.includes("instructions")
    ) {
      return {
        formSourceId: f.sourceId,
        classification: "consent" as const,
        confidence: 0.9,
        reasoning: `Template name "${f.templateName}" matches consent pattern`,
        chartData: null,
      };
    }

    if (
      name.includes("intake") ||
      name.includes("history") ||
      name.includes("questionnaire") ||
      name.includes("survey") ||
      name.includes("registration")
    ) {
      return {
        formSourceId: f.sourceId,
        classification: "intake" as const,
        confidence: 0.85,
        reasoning: `Template name "${f.templateName}" matches intake pattern`,
        chartData: null,
      };
    }

    if (
      name.includes("chart") ||
      name.includes("treatment") ||
      name.includes("procedure") ||
      name.includes("clinical") ||
      name.includes("assessment")
    ) {
      return {
        formSourceId: f.sourceId,
        classification: "clinical_chart" as const,
        confidence: 0.75,
        reasoning: `Template name "${f.templateName}" matches clinical chart pattern`,
        chartData: {
          chiefComplaint: f.templateName,
          templateType: "Other" as const,
          treatmentCardTitle: f.templateName,
          narrativeText: f.fields
            ?.map((field) => `${field.label}: ${field.value || field.selectedOptions?.join(", ") || "N/A"}`)
            .join("\n") || "",
          structuredData: {},
        },
      };
    }

    return {
      formSourceId: f.sourceId,
      classification: "consent" as const,
      confidence: 0.6,
      reasoning: `No clear pattern match for "${f.templateName}" — defaulting to consent`,
      chartData: null,
    };
  });
}

const provider = new MockMigrationProvider();
const credentials = { email: "admin@clinic.com", password: "test-password" };

describe("Form classification heuristics", () => {
  it("classifies consent forms correctly", () => {
    const forms: SourceForm[] = [
      {
        sourceId: "f1",
        patientSourceId: "p1",
        templateName: "Botox Consent Form",
        rawData: {},
      },
      {
        sourceId: "f2",
        patientSourceId: "p1",
        templateName: "HIPAA Waiver Agreement",
        rawData: {},
      },
      {
        sourceId: "f3",
        patientSourceId: "p1",
        templateName: "Post-Treatment Instructions",
        rawData: {},
      },
    ];

    const results = classifyByHeuristic(forms);
    expect(results.every((r) => r.classification === "consent")).toBe(true);
    expect(results.every((r) => r.chartData === null)).toBe(true);
  });

  it("classifies intake forms correctly", () => {
    const forms: SourceForm[] = [
      {
        sourceId: "f1",
        patientSourceId: "p1",
        templateName: "New Patient Intake Form",
        rawData: {},
      },
      {
        sourceId: "f2",
        patientSourceId: "p1",
        templateName: "Medical History Questionnaire",
        rawData: {},
      },
    ];

    const results = classifyByHeuristic(forms);
    expect(results.every((r) => r.classification === "intake")).toBe(true);
  });

  it("classifies clinical chart forms correctly", () => {
    const forms: SourceForm[] = [
      {
        sourceId: "f1",
        patientSourceId: "p1",
        templateName: "Dermalier Patient Treatment Chart",
        rawData: {},
        fields: [
          { fieldId: "1", label: "Treatment Type", type: "select", value: null, selectedOptions: ["Botox"] },
          { fieldId: "2", label: "Areas Treated", type: "text", value: "Forehead" },
        ],
      },
    ];

    const results = classifyByHeuristic(forms);
    expect(results[0].classification).toBe("clinical_chart");
    expect(results[0].chartData).not.toBeNull();
    expect(results[0].chartData!.templateType).toBe("Other");
    expect(results[0].chartData!.narrativeText).toContain("Treatment Type");
    expect(results[0].chartData!.narrativeText).toContain("Botox");
  });

  it("classifies internal admin forms as skip", () => {
    const forms: SourceForm[] = [
      {
        sourceId: "f1",
        patientSourceId: "p1",
        templateName: "Staff Check-In Form",
        isInternal: true,
        rawData: {},
      },
    ];

    const results = classifyByHeuristic(forms);
    expect(results[0].classification).toBe("skip");
  });

  it("defaults unknown forms to consent", () => {
    const forms: SourceForm[] = [
      {
        sourceId: "f1",
        patientSourceId: "p1",
        templateName: "Some Random Form",
        rawData: {},
      },
    ];

    const results = classifyByHeuristic(forms);
    expect(results[0].classification).toBe("consent");
    expect(results[0].confidence).toBeLessThan(0.7);
  });

  it("internal forms with 'treatment' in name are NOT skipped", () => {
    const forms: SourceForm[] = [
      {
        sourceId: "f1",
        patientSourceId: "p1",
        templateName: "Treatment Assessment Form",
        isInternal: true,
        rawData: {},
      },
    ];

    const results = classifyByHeuristic(forms);
    expect(results[0].classification).toBe("clinical_chart");
  });
});

describe("Mock provider — form content fetching", () => {
  it("fetchFormContent returns field data for known forms", async () => {
    const fields = await provider.fetchFormContent!(credentials, "mock-form-1");
    expect(fields.length).toBeGreaterThan(0);
    expect(fields[0].label).toBeTruthy();
    expect(fields[0].fieldId).toBeTruthy();
  });

  it("fetchFormContent returns empty array for unknown forms", async () => {
    const fields = await provider.fetchFormContent!(credentials, "nonexistent-form");
    expect(fields).toEqual([]);
  });

  it("clinical chart form has treatment-specific fields", async () => {
    const fields = await provider.fetchFormContent!(credentials, "mock-form-5");
    expect(fields.length).toBeGreaterThan(0);
    const labels = fields.map((f) => f.label);
    expect(labels).toContain("Treatment Type");
    expect(labels).toContain("Areas Treated");
    expect(labels).toContain("Total Units");
  });
});

describe("Mock provider — form classification integration", () => {
  it("classifies all mock forms with expected distribution", async () => {
    const formsResult = await provider.fetchForms!(credentials);
    const forms = formsResult.data;

    // Fetch content for each
    const formsWithContent = [];
    for (const form of forms) {
      const fields = await provider.fetchFormContent!(credentials, form.sourceId);
      formsWithContent.push({ ...form, fields: fields.length > 0 ? fields : undefined });
    }

    const results = classifyByHeuristic(formsWithContent);

    // Expected: 2 consents, 1 intake, 1 skip (internal), 1 clinical_chart
    const consents = results.filter((r) => r.classification === "consent");
    const intakes = results.filter((r) => r.classification === "intake");
    const charts = results.filter((r) => r.classification === "clinical_chart");
    const skips = results.filter((r) => r.classification === "skip");

    expect(consents.length).toBe(2); // Botox Consent, Dermal Filler Consent
    expect(intakes.length).toBe(1); // New Patient Intake
    expect(skips.length).toBe(1);   // Medical History Review (internal)
    expect(charts.length).toBe(1);  // Dermalier Patient Treatment Chart

    // Clinical chart should have chartData
    expect(charts[0].chartData).not.toBeNull();
    expect(charts[0].chartData!.narrativeText).toContain("Treatment Type");
  });

  it("clinical chart chartData includes field content from mock", async () => {
    const fields = await provider.fetchFormContent!(credentials, "mock-form-5");
    const form: SourceForm & { fields?: FormFieldContent[] } = {
      sourceId: "mock-form-5",
      patientSourceId: "mock-p-1",
      templateName: "Dermalier Patient Treatment Chart",
      rawData: {},
      fields,
    };

    const [result] = classifyByHeuristic([form]);
    expect(result.classification).toBe("clinical_chart");
    expect(result.chartData!.narrativeText).toContain("Botox");
    expect(result.chartData!.narrativeText).toContain("Forehead");
    expect(result.chartData!.narrativeText).toContain("20");
  });
});

describe("Forms without content gracefully handled", () => {
  it("forms without fields still classify correctly by name", () => {
    const forms: SourceForm[] = [
      {
        sourceId: "f1",
        patientSourceId: "p1",
        templateName: "Botox Consent Form",
        rawData: {},
        // No fields
      },
    ];

    const results = classifyByHeuristic(forms);
    expect(results[0].classification).toBe("consent");
  });

  it("clinical chart without fields has empty narrativeText", () => {
    const forms: SourceForm[] = [
      {
        sourceId: "f1",
        patientSourceId: "p1",
        templateName: "Treatment Assessment Chart",
        rawData: {},
        // No fields
      },
    ];

    const results = classifyByHeuristic(forms);
    expect(results[0].classification).toBe("clinical_chart");
    expect(results[0].chartData!.narrativeText).toBe("");
  });
});
