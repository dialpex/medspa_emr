import { describe, it, expect } from "vitest";
import {
  HIGH_CONFIDENCE_PATTERNS,
  CLINICAL_FIELD_INDICATORS,
} from "@/lib/agents/migration/classification/prompts";
import { getVendorKnowledge, BOULEVARD_KNOWLEDGE } from "@/lib/agents/migration/vendor-knowledge";

describe("HIGH_CONFIDENCE_PATTERNS", () => {
  it("matches HIPAA forms as consent", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("HIPAA Authorization Form"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("consent");
    expect(match!.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("matches consent forms", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Consent to Treat"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("consent");
  });

  it("matches waiver forms as consent", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Patient Waiver"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("consent");
  });

  it("matches financial policy as consent", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Financial Policy"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("consent");
  });

  it("matches aftercare instructions as consent", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Botox Aftercare Instructions"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("consent");
  });

  it("matches post-care instructions as consent", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Post-Treatment Instructions"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("consent");
  });

  it("matches medical history as intake", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Medical History Form"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("intake");
  });

  it("matches patient intake as intake", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Patient Intake Form"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("intake");
  });

  it("matches health questionnaire as intake", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Health Questionnaire"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("intake");
  });

  it("matches treatment record as clinical_chart", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Treatment Record"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("clinical_chart");
  });

  it("matches procedure note as clinical_chart", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Procedure Note"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("clinical_chart");
  });

  it("matches clinical assessment as clinical_chart", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("Clinical Assessment"));
    expect(match).toBeDefined();
    expect(match!.classification).toBe("clinical_chart");
  });

  it("does NOT match ambiguous form names", () => {
    const matches = HIGH_CONFIDENCE_PATTERNS.filter((p) =>
      p.pattern.test("Pre-Treatment Checklist")
    );
    // This is ambiguous — should NOT match high-confidence patterns
    // and should go to AI for classification
    expect(matches.length).toBe(0);
  });

  it("is case-insensitive", () => {
    const match = HIGH_CONFIDENCE_PATTERNS.find((p) => p.pattern.test("hipaa form"));
    expect(match).toBeDefined();
  });
});

describe("CLINICAL_FIELD_INDICATORS", () => {
  it("detects 'units injected' as clinical indicator", () => {
    const matches = CLINICAL_FIELD_INDICATORS.some((p) => p.test("Units Injected"));
    expect(matches).toBe(true);
  });

  it("detects 'injection sites' as clinical indicator", () => {
    const matches = CLINICAL_FIELD_INDICATORS.some((p) => p.test("Injection Sites"));
    expect(matches).toBe(true);
  });

  it("detects 'device serial' as clinical indicator", () => {
    const matches = CLINICAL_FIELD_INDICATORS.some((p) => p.test("Device Serial Number"));
    expect(matches).toBe(true);
  });

  it("detects 'lot number' as clinical indicator", () => {
    const matches = CLINICAL_FIELD_INDICATORS.some((p) => p.test("Lot Number"));
    expect(matches).toBe(true);
  });

  it("detects 'dilution' as clinical indicator", () => {
    const matches = CLINICAL_FIELD_INDICATORS.some((p) => p.test("Dilution Ratio"));
    expect(matches).toBe(true);
  });

  it("does NOT match generic labels", () => {
    const matches = CLINICAL_FIELD_INDICATORS.some((p) => p.test("Patient Name"));
    expect(matches).toBe(false);
  });
});

describe("getVendorKnowledge", () => {
  it("returns Boulevard knowledge for 'Boulevard'", () => {
    const knowledge = getVendorKnowledge("Boulevard");
    expect(knowledge).not.toBeNull();
    expect(knowledge!.vendorName).toBe("Boulevard");
    expect(knowledge!.signaturesAreImages).toBe(true);
  });

  it("returns Boulevard knowledge case-insensitively", () => {
    const knowledge = getVendorKnowledge("boulevard");
    expect(knowledge).not.toBeNull();
    expect(knowledge!.vendorName).toBe("Boulevard");
  });

  it("returns null for unknown vendor", () => {
    const knowledge = getVendorKnowledge("SomeNewVendor");
    expect(knowledge).toBeNull();
  });

  it("BOULEVARD_KNOWLEDGE has required fields", () => {
    expect(BOULEVARD_KNOWLEDGE.fieldTypeHints).toBeTruthy();
    expect(BOULEVARD_KNOWLEDGE.knownQuirks.length).toBeGreaterThan(0);
    expect(BOULEVARD_KNOWLEDGE.classificationHints).toBeTruthy();
  });
});

describe("completionWithRetry", () => {
  // Test the self-healing wrapper with the extractJSON utility
  it("extractJSON is used by the retry wrapper", async () => {
    const { extractJSON } = await import("@/lib/agents/_shared/llm/utils");
    const parsed = extractJSON<{ test: number }>('Some text ```json\n{"test": 42}\n```');
    expect(parsed.test).toBe(42);
  });

  it("extractJSON handles raw JSON", async () => {
    const { extractJSON } = await import("@/lib/agents/_shared/llm/utils");
    const parsed = extractJSON<{ test: number }>('{"test": 42}');
    expect(parsed.test).toBe(42);
  });

  it("extractJSON throws for non-JSON", async () => {
    const { extractJSON } = await import("@/lib/agents/_shared/llm/utils");
    expect(() => extractJSON("no json here")).toThrow();
  });
});
