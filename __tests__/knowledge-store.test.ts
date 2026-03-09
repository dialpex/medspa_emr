/**
 * Knowledge Store — Unit Tests
 *
 * Tests the core intelligence system: fact creation, confirmation,
 * contradiction, confidence scoring, cross-vendor transfer, and distillation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm } from "fs/promises";
import { join } from "path";
import { KnowledgeStore } from "../lib/agents/migration/knowledge/store";
import { distill } from "../lib/agents/migration/knowledge/distiller";
import type {
  MappingPatternValue,
  FormArchetypeValue,
  FieldSemanticValue,
  RunOutcome,
  ConfirmationSource,
} from "../lib/agents/migration/knowledge/types";
import { Conviction, DETERMINISTIC_THRESHOLD } from "../lib/agents/migration/knowledge/types";
import { CACHE_BASE } from "../lib/agents/_shared/memory/base";

const KNOWLEDGE_DIR = join(CACHE_BASE, "_knowledge");

function makeSource(overrides?: Partial<ConfirmationSource>): ConfirmationSource {
  return {
    runId: "test-run-1",
    vendor: "boulevard",
    clinicId: "clinic-1",
    phase: "reconcile",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("KnowledgeStore", () => {
  let store: KnowledgeStore;

  beforeEach(() => {
    store = new KnowledgeStore();
    store.clearCache();
  });

  afterEach(async () => {
    // Clean up test knowledge files
    try {
      await rm(KNOWLEDGE_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("record & get", () => {
    it("creates a new fact with initial confidence", async () => {
      const value: MappingPatternValue = {
        sourceEntity: "patients",
        sourceField: "email",
        targetEntity: "patient",
        targetField: "email",
        transferable: true,
      };

      const fact = await store.record("mapping_pattern", "test:email->email", value, makeSource());

      expect(fact.type).toBe("mapping_pattern");
      expect(fact.key).toBe("test:email->email");
      expect(fact.confidence).toBe(Conviction.HYPOTHESIS);
      expect(fact.confirmations).toBe(1);
      expect(fact.vendors).toEqual(["boulevard"]);
    });

    it("retrieves a fact by type and key", async () => {
      const value: FormArchetypeValue = {
        namePattern: "hipaa authorization",
        classification: "consent",
        reasoning: "HIPAA is always consent",
      };

      await store.record("form_archetype", "hipaa authorization", value, makeSource());
      await store.flush();

      // Clear cache and re-read from disk
      store.clearCache();
      const retrieved = await store.get<FormArchetypeValue>("form_archetype", "hipaa authorization");

      expect(retrieved).not.toBeNull();
      expect(retrieved!.value.classification).toBe("consent");
    });
  });

  describe("confirmation", () => {
    it("boosts confidence on confirmation", async () => {
      const value: MappingPatternValue = {
        sourceEntity: "patients",
        sourceField: "firstName",
        targetEntity: "patient",
        targetField: "firstName",
        transferable: true,
      };

      const initial = await store.record("mapping_pattern", "test:fn", value, makeSource());
      const initialConf = initial.confidence;

      // Confirm from same vendor, different clinic
      const confirmed = await store.record("mapping_pattern", "test:fn", value, makeSource({
        runId: "test-run-2",
        clinicId: "clinic-2",
      }));

      expect(confirmed.confidence).toBeGreaterThan(initialConf);
      expect(confirmed.confirmations).toBe(2);
    });

    it("auto-elevates to cross-vendor after 2 vendors confirm", async () => {
      const value: FieldSemanticValue = {
        labelPattern: "first name",
        category: "patient_demographic",
        patientField: "firstName",
      };

      // Record from boulevard
      await store.record("field_semantic", "first name|text", value, makeSource());

      // Confirm from different vendor
      const crossVendor = await store.record("field_semantic", "first name|text", value, makeSource({
        vendor: "aesthetics-record",
        runId: "test-run-ar",
      }));

      expect(crossVendor.scope).toBe("cross-vendor");
      expect(crossVendor.vendors).toContain("boulevard");
      expect(crossVendor.vendors).toContain("aesthetics-record");
    });
  });

  describe("contradiction", () => {
    it("reduces confidence on contradiction", async () => {
      const value: MappingPatternValue = {
        sourceEntity: "photos",
        sourceField: "url",
        targetEntity: "photo",
        targetField: "artifactKey",
        transferable: false,
      };

      await store.record("mapping_pattern", "test:url", value, makeSource(), {
        initialConfidence: Conviction.CONFIDENT,
      });

      const contradicted = await store.contradict("mapping_pattern", "test:url", {
        runId: "test-run-2",
        vendor: "boulevard",
        clinicId: "clinic-2",
        error: "Boulevard URLs are CDN links, not artifact keys",
        correctedTo: "downloadUrl",
        timestamp: new Date().toISOString(),
      });

      expect(contradicted).not.toBeNull();
      expect(contradicted!.confidence).toBeLessThan(Conviction.CONFIDENT);
      expect(contradicted!.contradictions).toBe(1);
      expect(contradicted!.healingLog).toHaveLength(1);
      expect(contradicted!.healingLog![0].trigger).toBe("contradiction");
    });
  });

  describe("user corrections", () => {
    it("records user corrections at canonical confidence", async () => {
      const value: MappingPatternValue = {
        sourceEntity: "photos",
        sourceField: "url",
        targetEntity: "photo",
        targetField: "downloadUrl",
        transferable: false,
      };

      const fact = await store.recordUserCorrection("mapping_pattern", "test:url-fix", value, {
        ...makeSource(),
        previousValue: "artifactKey",
      });

      expect(fact.confidence).toBeGreaterThanOrEqual(Conviction.CANONICAL);
    });
  });

  describe("query", () => {
    it("filters by vendor (includes cross-vendor facts)", async () => {
      // Boulevard-specific fact
      await store.record("mapping_pattern", "blvd-only", {
        sourceEntity: "a", sourceField: "b", targetEntity: "c", targetField: "d", transferable: false,
      } as MappingPatternValue, makeSource());

      // Cross-vendor fact from different vendor
      await store.record("field_semantic", "email|text", {
        labelPattern: "email", category: "patient_demographic", patientField: "email",
      } as FieldSemanticValue, makeSource({ vendor: "vagaro" }), {
        scope: "cross-vendor",
      });

      const blvdMappings = await store.query({ type: "mapping_pattern", vendor: "boulevard" });
      expect(blvdMappings.length).toBe(1);

      // Querying field_semantic for boulevard should include the cross-vendor fact from vagaro
      const blvdFields = await store.query({ type: "field_semantic", vendor: "boulevard" });
      expect(blvdFields.length).toBe(1); // cross-vendor included
    });

    it("filters by minimum confidence", async () => {
      await store.record("mapping_pattern", "low-conf", {
        sourceEntity: "a", sourceField: "b", targetEntity: "c", targetField: "d", transferable: false,
      } as MappingPatternValue, makeSource());

      const highConf = await store.query({
        type: "mapping_pattern",
        minConfidence: DETERMINISTIC_THRESHOLD,
      });
      expect(highConf.length).toBe(0); // initial confidence is HYPOTHESIS (0.5)

      const anyConf = await store.query({
        type: "mapping_pattern",
        minConfidence: 0.1,
      });
      expect(anyConf.length).toBe(1);
    });

    it("knows() returns true only above deterministic threshold", async () => {
      await store.record("form_archetype", "test-form", {
        namePattern: "test", classification: "consent", reasoning: "test",
      } as FormArchetypeValue, makeSource(), {
        initialConfidence: Conviction.CONFIDENT,
      });

      const known = await store.knows("form_archetype", "test-form");
      expect(known).toBe(true);

      const unknown = await store.knows("form_archetype", "nonexistent");
      expect(unknown).toBe(false);
    });
  });

  describe("metrics", () => {
    it("returns accurate intelligence metrics", async () => {
      await store.record("mapping_pattern", "mp1", {
        sourceEntity: "a", sourceField: "b", targetEntity: "c", targetField: "d", transferable: true,
      } as MappingPatternValue, makeSource());

      await store.record("form_archetype", "fa1", {
        namePattern: "consent", classification: "consent", reasoning: "test",
      } as FormArchetypeValue, makeSource());

      const metrics = await store.getMetrics();

      expect(metrics.totalFacts).toBe(2);
      expect(metrics.byType.mapping_pattern).toBe(1);
      expect(metrics.byType.form_archetype).toBe(1);
      expect(metrics.byVendor.boulevard).toBe(2);
      expect(metrics.avgConfidence).toBeGreaterThan(0);
    });
  });
});

describe("Distiller", () => {
  let store: KnowledgeStore;

  beforeEach(() => {
    store = new KnowledgeStore();
    store.clearCache();
  });

  afterEach(async () => {
    try {
      await rm(KNOWLEDGE_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("extracts mapping patterns from a successful run", async () => {
    const outcome: RunOutcome = {
      runId: "run-1",
      vendor: "boulevard",
      clinicId: "clinic-1",
      approvedMappingSpec: {
        sourceVendor: "boulevard",
        entityMappings: [
          {
            sourceEntity: "patients",
            targetEntity: "patient",
            fieldMappings: [
              { sourceField: "email", targetField: "email" },
              { sourceField: "firstName", targetField: "firstName" },
            ],
          },
        ],
      },
      reconciliation: {
        entityMatchRates: { patient: 1.0 },
        totalSource: 10,
        totalPromoted: 10,
        totalFailed: 0,
      },
      errors: [],
    };

    const report = await distill(store, outcome);

    expect(report.factsCreated).toBe(2); // email + firstName
    expect(report.factsConfirmed).toBe(0);

    // Verify facts were created
    const facts = await store.query({ type: "mapping_pattern", vendor: "boulevard" });
    expect(facts.length).toBe(2);

    // Transferable field (email) should be cross-vendor
    const emailFact = facts.find((f) => f.key.includes("email"));
    expect(emailFact?.scope).toBe("cross-vendor");
    expect((emailFact?.value as MappingPatternValue).transferable).toBe(true);
  });

  it("confirms existing facts on second run", async () => {
    const outcome: RunOutcome = {
      runId: "run-1",
      vendor: "boulevard",
      clinicId: "clinic-1",
      approvedMappingSpec: {
        sourceVendor: "boulevard",
        entityMappings: [{
          sourceEntity: "patients",
          targetEntity: "patient",
          fieldMappings: [{ sourceField: "email", targetField: "email" }],
        }],
      },
      reconciliation: {
        entityMatchRates: { patient: 1.0 },
        totalSource: 10,
        totalPromoted: 10,
        totalFailed: 0,
      },
      errors: [],
    };

    // First run
    await distill(store, outcome);

    // Second run (different clinic)
    const outcome2 = { ...outcome, runId: "run-2", clinicId: "clinic-2" };
    const report2 = await distill(store, outcome2);

    expect(report2.factsConfirmed).toBe(1);
    expect(report2.factsCreated).toBe(0);

    // Confidence should have increased
    const facts = await store.query({ type: "mapping_pattern", vendor: "boulevard" });
    expect(facts[0].confirmations).toBe(2);
  });

  it("skips distillation for failed runs (>20% failure rate)", async () => {
    const outcome: RunOutcome = {
      runId: "run-1",
      vendor: "boulevard",
      clinicId: "clinic-1",
      approvedMappingSpec: {
        sourceVendor: "boulevard",
        entityMappings: [{
          sourceEntity: "patients",
          targetEntity: "patient",
          fieldMappings: [{ sourceField: "email", targetField: "email" }],
        }],
      },
      reconciliation: {
        entityMatchRates: { patient: 0.5 },
        totalSource: 10,
        totalPromoted: 5,
        totalFailed: 5, // 50% failure — too high to learn from
      },
      errors: [],
    };

    const report = await distill(store, outcome);
    expect(report.factsCreated).toBe(0); // nothing learned from bad run
  });

  it("records user corrections at high confidence", async () => {
    const outcome: RunOutcome = {
      runId: "run-1",
      vendor: "boulevard",
      clinicId: "clinic-1",
      approvedMappingSpec: {
        sourceVendor: "boulevard",
        entityMappings: [],
      },
      reconciliation: {
        entityMatchRates: {},
        totalSource: 0,
        totalPromoted: 0,
        totalFailed: 0,
      },
      errors: [],
      userCorrections: [
        {
          entityType: "photos",
          sourceField: "url",
          aiProposal: "artifactKey",
          userChoice: "downloadUrl",
        },
      ],
    };

    const report = await distill(store, outcome);
    expect(report.userCorrectionsRecorded).toBe(1);

    // The correction should be stored at CANONICAL confidence
    const facts = await store.query({ type: "mapping_pattern", vendor: "boulevard" });
    const correction = facts.find((f) => f.key.includes("downloadUrl"));
    expect(correction?.confidence).toBeGreaterThanOrEqual(Conviction.CANONICAL);
  });
});
